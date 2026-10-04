/**
 * ENERA RECONCILIATION ENGINE: INVOICE CHARGE RECONCILIATION (REQUIREMENT 19)
 * ===========================================================================
 * Clean, decoupled interface calculating expected charges from tariff rates:
 *
 *   Tariff Engine
 *         ↓
 *   Applicable Rates
 *         ↓
 *   Reconciliation Engine
 *         ↓
 *   Expected Charges
 *
 * Core Principles:
 *   1. Formula:
 *      Billed Quantity × Applicable Rate = Expected Charge
 *   2. Tariff rates MUST come from the Tariff Engine (feature/tariff-engine).
 *      Do NOT hard-code tariff rates here.
 *   3. Clean interface contracts:
 *      - ApplicableRateItem & ApplicableRateSchedule (Tariff Engine output)
 *      - ChargeDeterminantInput (Reconciliation Engine input)
 *      - ExpectedChargeItem & InvoiceChargeReconciliationSummary (Output)
 *   4. Mathematical precision via Decimal (decimal.js-light) with exact currency rounding.
 *   5. Lineage tracking: records the rate rule ID, tariff code, and formula expression.
 */

import Decimal from "decimal.js-light";
import type {
  TariffVersionDefinition,
  TariffComponentRule,
  SeasonType,
  TouPeriodType,
} from "../tariff/types";

/**
 * Interface 1: Tariff Engine Output Contract
 * The Tariff Engine provides applicable rates via this structure.
 * Zero rates are hardcoded in the reconciliation engine.
 */
export interface ApplicableRateItem {
  component_code: string; // e.g. "ACTIVE_ENERGY_PEAK", "NETWORK_DEMAND", "SERVICE_CHARGE"
  component_name: string;
  component_type?: string; // e.g. "ACTIVE_ENERGY", "NETWORK_DEMAND", "REACTIVE_ENERGY", "SERVICE_CHARGE"
  rate_value: Decimal; // Gazetted rate value provided by Tariff Engine
  unit_of_measure: "c/kWh" | "R/kVA/month" | "R/kW/month" | "R/kVARh" | "R/day" | "R/month" | "%" | string;
  season?: SeasonType | "all";
  tou_period?: TouPeriodType | "all";
  rule_id: string; // Tariff engine authoritative rule identifier
  tariff_code: string; // e.g. "MEGAFLEX"
  tariff_version: string; // e.g. "2025.1"
  effective_date?: string;
  source_document?: string; // e.g. "NERSA Gazette 2025/2026"
  formula_template?: string; // e.g. "quantity * rate / 100"
}

export interface ApplicableRateSchedule {
  tariff_code: string;
  tariff_version: string;
  season?: SeasonType | "all";
  utility: string;
  rates: ApplicableRateItem[];
  vat_rate?: Decimal; // e.g. 0.15 for 15% VAT
  source_document?: string;
  created_at: string;
}

/**
 * Interface 2: Reconciliation Engine Determinant Input
 * Determinant quantities extracted from invoice or derived from AMR telemetry.
 */
export interface ChargeDeterminantInput {
  component_code: string;
  billed_quantity: number | Decimal | string;
  billed_amount_zar?: number | Decimal | string | null;
  component_name?: string;
  quantity_unit?: string; // e.g. "kWh", "kVA", "days", "months"
}

export interface ExpectedChargeItem {
  component_code: string;
  component_name: string;
  billed_quantity: Decimal;
  quantity_unit: string;
  applicable_rate: Decimal;
  rate_unit: string;
  expected_charge_zar: Decimal;
  billed_charge_zar?: Decimal;
  charge_variance_zar?: Decimal; // billed - expected
  percentage_variance?: Decimal; // (variance / expected) * 100
  is_within_tolerance?: boolean;
  discrepancy_classification?: "EXACT_MATCH" | "WITHIN_TOLERANCE" | "MATERIAL_DISCREPANCY";
  rate_lineage: {
    rule_id: string;
    tariff_code: string;
    tariff_version: string;
    source_document?: string;
    formula_expression: string;
  };
}

export interface InvoiceChargeReconciliationInput {
  determinants: ChargeDeterminantInput[];
  applicable_rates: ApplicableRateSchedule; // Supplied by Tariff Engine
  billed_subtotal_zar?: number | Decimal | string | null;
  billed_vat_zar?: number | Decimal | string | null;
  billed_total_zar?: number | Decimal | string | null;
  tolerance?: {
    absolute_tolerance_zar?: number | Decimal | string; // default R 5.00
    percentage_tolerance?: number | Decimal | string; // default 0.0005 (0.05%)
  };
}

export interface InvoiceChargeReconciliationSummary {
  tariff_code: string;
  tariff_version: string;
  utility: string;
  items: ExpectedChargeItem[];
  expected_subtotal_zar: Decimal;
  expected_vat_zar: Decimal;
  expected_total_zar: Decimal;
  billed_subtotal_zar?: Decimal;
  billed_vat_zar?: Decimal;
  billed_total_zar?: Decimal;
  subtotal_variance_zar?: Decimal;
  total_variance_zar?: Decimal;
  has_material_discrepancy: boolean;
  all_items_within_tolerance: boolean;
  tolerance_applied: {
    absolute_tolerance_zar: Decimal;
    percentage_tolerance: Decimal;
  };
  audit_timestamp: string;
}

export class InvoiceChargeReconciliationEngine {
  public static readonly DEFAULT_VAT_RATE = new Decimal("0.15"); // 15% SA VAT
  public static readonly DEFAULT_ABSOLUTE_TOLERANCE_ZAR = new Decimal("5.00"); // R 5.00
  public static readonly DEFAULT_PERCENTAGE_TOLERANCE = new Decimal("0.0005"); // 0.05%

  /**
   * Safe parser for Decimal inputs
   */
  private static parseDecimal(val: number | Decimal | string | null | undefined): Decimal {
    if (val === undefined || val === null || val === "") return new Decimal(0);
    try {
      return val instanceof Decimal ? val : new Decimal(String(val));
    } catch {
      return new Decimal(0);
    }
  }

  /**
   * Adapter: Extracts Applicable Rates from a Tariff Engine TariffVersionDefinition.
   * This bridges feature/tariff-engine without hardcoding rates in the reconciliation branch.
   */
  public static extractApplicableRates(
    tariffDef: TariffVersionDefinition,
    options: {
      season?: SeasonType;
      filterComponents?: string[];
    } = {}
  ): ApplicableRateSchedule {
    const targetSeason = options.season ?? tariffDef.header.season;

    const applicableRates: ApplicableRateItem[] = tariffDef.components
      .filter((rule) => {
        // Filter by season if component is season-specific
        if (rule.season && rule.season !== "all" && rule.season !== targetSeason) {
          return false;
        }
        if (options.filterComponents && !options.filterComponents.includes(rule.component_code)) {
          return false;
        }
        return true;
      })
      .map((rule) => ({
        component_code: rule.component_code,
        component_name: rule.component_name,
        component_type: rule.component_type,
        rate_value: rule.rate_value,
        unit_of_measure: rule.unit_of_measure,
        season: rule.season,
        tou_period: rule.tou_period,
        rule_id: rule.rule_id,
        tariff_code: tariffDef.header.tariff_code,
        tariff_version: tariffDef.header.version,
        effective_date: tariffDef.header.effective_date,
        source_document: tariffDef.header.source_document,
        formula_template: rule.formula_template,
      }));

    return {
      tariff_code: tariffDef.header.tariff_code,
      tariff_version: tariffDef.header.version,
      season: targetSeason,
      utility: tariffDef.header.utility,
      rates: applicableRates,
      vat_rate: tariffDef.header.vat_treatment === "zero_rated" ? new Decimal(0) : this.DEFAULT_VAT_RATE,
      source_document: tariffDef.header.source_document,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Helper to locate the matching applicable rate item for a given component code.
   * Matches exact code, or standard reconciliation aliases (e.g. ACTIVE_ENERGY_PEAK <-> PEAK_ENERGY_HIGH).
   */
  public static findApplicableRate(
    rates: ApplicableRateItem[],
    componentCode: string
  ): ApplicableRateItem | undefined {
    if (!componentCode || !rates || rates.length === 0) return undefined;
    const normalized = componentCode.trim().toUpperCase();

    // 1. Exact match by component_code
    const exact = rates.find((r) => r.component_code.toUpperCase() === normalized);
    if (exact) return exact;

    // 2. Alias & semantic matching based on component_type and tou_period
    return rates.find((r) => {
      const rCode = r.component_code.toUpperCase();
      const rType = r.component_type?.toUpperCase();
      const rTou = r.tou_period?.toUpperCase();

      // Peak active energy
      if (normalized === "ACTIVE_ENERGY_PEAK" || normalized === "PEAK_ENERGY" || normalized === "ENERGY_PEAK") {
        if (rType === "ACTIVE_ENERGY" && rTou === "PEAK") return true;
        if (rCode.includes("PEAK") && !rCode.includes("OFF") && (rType === "ACTIVE_ENERGY" || rCode.includes("ENERGY"))) {
          return true;
        }
      }

      // Standard active energy
      if (normalized === "ACTIVE_ENERGY_STANDARD" || normalized === "STANDARD_ENERGY" || normalized === "ENERGY_STANDARD") {
        if (rType === "ACTIVE_ENERGY" && rTou === "STANDARD") return true;
        if (rCode.includes("STANDARD") && (rType === "ACTIVE_ENERGY" || rCode.includes("ENERGY"))) {
          return true;
        }
      }

      // Off-peak active energy
      if (normalized === "ACTIVE_ENERGY_OFF_PEAK" || normalized === "OFF_PEAK_ENERGY" || normalized === "ENERGY_OFF_PEAK") {
        if (rType === "ACTIVE_ENERGY" && (rTou === "OFF_PEAK" || rTou === "OFFPEAK")) return true;
        if ((rCode.includes("OFF_PEAK") || rCode.includes("OFFPEAK")) && (rType === "ACTIVE_ENERGY" || rCode.includes("ENERGY"))) {
          return true;
        }
      }

      // Network Demand
      if (normalized === "NETWORK_DEMAND" || normalized === "DEMAND_NETWORK" || normalized === "NETWORK_DEMAND_CHARGE") {
        if (rType === "NETWORK_DEMAND" || (rCode.includes("NETWORK") && rCode.includes("DEMAND"))) return true;
      }

      // Reactive Energy
      if (normalized === "REACTIVE_ENERGY" || normalized === "REACTIVE_ENERGY_CHARGE" || normalized === "REACTIVE_PENALTY") {
        if (rType === "REACTIVE_ENERGY" || rCode.includes("REACTIVE")) return true;
      }

      // Service Charge
      if (normalized === "SERVICE_CHARGE" || normalized === "SERVICE" || normalized === "ADMIN_CHARGE") {
        if (rType === "SERVICE_CHARGE" || rCode.includes("SERVICE") || rCode.includes("ADMIN")) return true;
      }

      // Normalized underscore-stripped fallback
      if (rCode.replace(/_/g, "") === normalized.replace(/_/g, "")) return true;

      return false;
    });
  }

  /**
   * Calculate Expected Charge:
   *   Billed Quantity × Applicable Rate = Expected Charge
   *
   * Requirement 19:
   *   - Billed Quantity × Applicable Rate = Expected Charge
   *   - Tariff rates must come from the Tariff Engine interface
   *   - Do NOT hard-code tariff rates here.
   */
  public static calculateExpectedCharge(
    quantity: Decimal,
    rateItem: ApplicableRateItem
  ): { expected_charge_zar: Decimal; formula_expression: string } {
    const rate = rateItem.rate_value;
    let expectedChargeZar: Decimal;
    let formula: string;

    const unit = rateItem.unit_of_measure.toLowerCase();

    if (unit === "c/kwh" || unit === "c/kvarh") {
      // Rates in cents per kWh or cents per kVArh: divide by 100 to yield ZAR
      expectedChargeZar = quantity.times(rate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      formula = `(${quantity.toString()} × ${rate.toString()} ${rateItem.unit_of_measure}) / 100 = R ${expectedChargeZar.toString()}`;
    } else {
      // Rates directly in R/kVA/month, R/kW/month, R/day, R/month
      expectedChargeZar = quantity.times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      formula = `${quantity.toString()} × ${rate.toString()} ${rateItem.unit_of_measure} = R ${expectedChargeZar.toString()}`;
    }

    return {
      expected_charge_zar: expectedChargeZar,
      formula_expression: formula,
    };
  }

  /**
   * Reconcile invoice line item charges against expected charges derived from the Tariff Engine.
   */
  public static reconcileCharges(
    input: InvoiceChargeReconciliationInput
  ): InvoiceChargeReconciliationSummary {
    const rateSchedule = input.applicable_rates;
    const absTol = input.tolerance?.absolute_tolerance_zar !== undefined
      ? new Decimal(String(input.tolerance.absolute_tolerance_zar))
      : this.DEFAULT_ABSOLUTE_TOLERANCE_ZAR;

    const pctTol = input.tolerance?.percentage_tolerance !== undefined
      ? new Decimal(String(input.tolerance.percentage_tolerance))
      : this.DEFAULT_PERCENTAGE_TOLERANCE;

    const items: ExpectedChargeItem[] = [];
    let expectedSubtotal = new Decimal(0);

    for (const det of input.determinants) {
      const quantity = this.parseDecimal(det.billed_quantity);

      // Find applicable rate supplied by the Tariff Engine (supporting aliases)
      const rateItem = this.findApplicableRate(rateSchedule.rates, det.component_code);

      if (!rateItem) {
        throw new Error(
          `InvoiceChargeReconciliationEngine: No applicable rate supplied by the Tariff Engine for ` +
            `component '${det.component_code}' under tariff '${rateSchedule.tariff_code}' (version ${rateSchedule.tariff_version}). ` +
            `Tariff rates must come from the Tariff Engine and cannot be hardcoded.`
        );
      }

      const calc = this.calculateExpectedCharge(quantity, rateItem);
      const expectedCharge = calc.expected_charge_zar;
      expectedSubtotal = expectedSubtotal.plus(expectedCharge);

      let billedCharge: Decimal | undefined;
      let chargeVar: Decimal | undefined;
      let pctVar: Decimal | undefined;
      let isWithinTol: boolean | undefined;
      let classification: "EXACT_MATCH" | "WITHIN_TOLERANCE" | "MATERIAL_DISCREPANCY" | undefined;

      if (det.billed_amount_zar !== undefined && det.billed_amount_zar !== null) {
        billedCharge = this.parseDecimal(det.billed_amount_zar);
        chargeVar = billedCharge.minus(expectedCharge);

        if (!expectedCharge.isZero()) {
          pctVar = chargeVar.dividedBy(expectedCharge).times(100);
        } else if (!billedCharge.isZero()) {
          pctVar = new Decimal(100);
        } else {
          pctVar = new Decimal(0);
        }

        const absVarMag = chargeVar.abs();
        const pctVarMag = expectedCharge.isZero() ? new Decimal(0) : absVarMag.dividedBy(expectedCharge);

        const isAbsOk = absVarMag.lessThanOrEqualTo(absTol);
        const isPctOk = pctVarMag.lessThanOrEqualTo(pctTol);
        isWithinTol = isAbsOk || isPctOk;

        if (chargeVar.isZero()) {
          classification = "EXACT_MATCH";
        } else if (isWithinTol) {
          classification = "WITHIN_TOLERANCE";
        } else {
          classification = "MATERIAL_DISCREPANCY";
        }
      }

      items.push({
        component_code: det.component_code,
        component_name: det.component_name ?? rateItem.component_name,
        billed_quantity: quantity,
        quantity_unit: det.quantity_unit ?? rateItem.unit_of_measure,
        applicable_rate: rateItem.rate_value,
        rate_unit: rateItem.unit_of_measure,
        expected_charge_zar: expectedCharge,
        billed_charge_zar: billedCharge,
        charge_variance_zar: chargeVar,
        percentage_variance: pctVar,
        is_within_tolerance: isWithinTol,
        discrepancy_classification: classification,
        rate_lineage: {
          rule_id: rateItem.rule_id,
          tariff_code: rateItem.tariff_code,
          tariff_version: rateItem.tariff_version,
          source_document: rateItem.source_document,
          formula_expression: calc.formula_expression,
        },
      });
    }

    // VAT & Totals
    const vatRate = rateSchedule.vat_rate ?? this.DEFAULT_VAT_RATE;
    const expectedVat = expectedSubtotal.times(vatRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const expectedTotal = expectedSubtotal.plus(expectedVat);

    const billedSubtotal = input.billed_subtotal_zar !== undefined && input.billed_subtotal_zar !== null
      ? this.parseDecimal(input.billed_subtotal_zar)
      : undefined;

    const billedVat = input.billed_vat_zar !== undefined && input.billed_vat_zar !== null
      ? this.parseDecimal(input.billed_vat_zar)
      : undefined;

    const billedTotal = input.billed_total_zar !== undefined && input.billed_total_zar !== null
      ? this.parseDecimal(input.billed_total_zar)
      : undefined;

    const subtotalVar = billedSubtotal ? billedSubtotal.minus(expectedSubtotal) : undefined;
    const totalVar = billedTotal ? billedTotal.minus(expectedTotal) : undefined;

    const hasMaterialDiscrepancy = items.some(
      (it) => it.discrepancy_classification === "MATERIAL_DISCREPANCY"
    );

    const allWithinTol = items.every(
      (it) => it.is_within_tolerance === undefined || it.is_within_tolerance === true
    );

    return {
      tariff_code: rateSchedule.tariff_code,
      tariff_version: rateSchedule.tariff_version,
      utility: rateSchedule.utility,
      items,
      expected_subtotal_zar: expectedSubtotal,
      expected_vat_zar: expectedVat,
      expected_total_zar: expectedTotal,
      billed_subtotal_zar: billedSubtotal,
      billed_vat_zar: billedVat,
      billed_total_zar: billedTotal,
      subtotal_variance_zar: subtotalVar,
      total_variance_zar: totalVar,
      has_material_discrepancy: hasMaterialDiscrepancy,
      all_items_within_tolerance: allWithinTol,
      tolerance_applied: {
        absolute_tolerance_zar: absTol,
        percentage_tolerance: pctTol,
      },
      audit_timestamp: new Date().toISOString(),
    };
  }
}
