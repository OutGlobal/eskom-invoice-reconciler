/**
 * ENERA RECONCILIATION ENGINE: DEMAND RECONCILIATION (REQUIREMENT 17)
 * ===================================================================
 * Configurable Demand Reconciliation & Verification Engine.
 *
 * Core Principles:
 *   1. Where interval demand data exists:
 *      Calculate applicable demand values.
 *   2. Compare:
 *      Invoice Demand vs AMR-derived Demand.
 *   3. Supports:
 *      - Maximum Demand
 *      - Time-of-Use (TOU) Demand (Peak, Standard, Off-Peak windowing)
 *      - Notified Maximum Demand (NMD) & Exceedance Evaluation
 *      - Utilised Demand (Contractual ratchet percentages & minimum billing demand)
 *   4. DO NOT ASSUME that invoice demand is always simply the maximum raw interval kW.
 *      In South African Eskom/NERSA tariffs, demand is typically billed in kVA,
 *      evaluated during Peak & Standard periods only, and subject to NMD ratchets.
 *   5. The applicable demand methodology MUST be supplied by configuration/tariff rules.
 *   6. Record configured tolerance separately and do not hide small variances.
 */

import Decimal from "decimal.js-light";
import {
  TouMappingEngine,
  TariffPeriodDefinition,
  TouPeriod,
} from "./touMappingEngine";
import { VarianceEngine, type VariancePercentageStatus } from "./varianceEngine";

export type DemandMeasurementUnit = "kVA" | "kW";

export type DemandWindowScope =
  | "ALL_HOURS"
  | "PEAK_AND_STANDARD_ONLY"
  | "PEAK_ONLY"
  | "OFF_PEAK_ONLY";

export type DemandRatchetType =
  | "NONE"
  | "PERCENTAGE_OF_NMD"
  | "MINIMUM_DEMAND_FLOOR";

export type DiscrepancyClassification =
  | "EXACT_MATCH"
  | "WITHIN_TOLERANCE"
  | "MATERIAL_DISCREPANCY";

/**
 * Requirement 17: Demand Methodology Rule Contract
 * Pure configuration/tariff data structure dictating how demand is measured and billed.
 */
export interface DemandMethodologyConfig {
  rule_id: string;
  methodology_name: string;
  measurement_unit: DemandMeasurementUnit; // "kVA" or "kW"
  tou_window_scope: DemandWindowScope; // e.g. "PEAK_AND_STANDARD_ONLY"
  nmd_kva?: number | Decimal | string;
  nmd_ratchet_percentage?: number | Decimal | string; // e.g. 70 for 70% of NMD
  minimum_billing_demand?: number | Decimal | string; // e.g. 50 kVA
  demand_integration_minutes?: number; // e.g. 30
  description: string;
}

export interface DemandReconciliationInput {
  invoice_demand_value: number | Decimal | string;
  invoice_demand_unit?: DemandMeasurementUnit; // defaults to methodology's unit

  // Pre-calculated AMR values (optional if intervals are supplied)
  amr_raw_max_kw?: number | Decimal | string | null;
  amr_raw_max_kva?: number | Decimal | string | null;
  amr_tou_peak_kw?: number | Decimal | string | null;
  amr_tou_peak_kva?: number | Decimal | string | null;
  amr_tou_standard_kw?: number | Decimal | string | null;
  amr_tou_standard_kva?: number | Decimal | string | null;
  amr_tou_off_peak_kw?: number | Decimal | string | null;
  amr_tou_off_peak_kva?: number | Decimal | string | null;

  // Or pass raw intervals + tariff_period_definition to compute dynamically
  intervals?: any[];
  tariff_period_definition?: TariffPeriodDefinition;

  // Applicable demand methodology (supplied by tariff rules / configuration)
  demand_methodology: DemandMethodologyConfig;

  // Configured tolerances
  tolerance?: {
    absolute_tolerance?: number | Decimal | string; // e.g. 5.0 kVA
    percentage_tolerance?: number | Decimal | string; // e.g. 0.005 (0.5%)
    tolerance_rule_source?: string;
  };
}

export interface TouDemandBreakdown {
  peak_demand: Decimal;
  standard_demand: Decimal;
  off_peak_demand: Decimal;
  peak_and_standard_max: Decimal;
  all_hours_max: Decimal;
  peak_timestamp?: string;
}

export interface DemandReconciliationResult {
  invoice_demand: Decimal;
  invoice_unit: DemandMeasurementUnit;

  // AMR demand values
  raw_amr_maximum_demand: Decimal; // Raw maximum observed in interval data
  raw_maximum_interval_kw: Decimal; // Raw interval kW (to demonstrate contrast with applicable demand)
  raw_maximum_interval_kva: Decimal;
  applicable_measured_demand: Decimal; // Demand measured per tariff TOU window rules
  utilised_billing_demand: Decimal; // Demand after ratchet / minimum billing rules applied

  // NMD & Ratchet Evaluation
  notified_maximum_demand?: Decimal;
  nmd_ratchet_floor?: Decimal;
  nmd_exceedance_amount: Decimal;
  has_nmd_exceedance: boolean;

  // Variances against applicable billed demand
  absolute_variance: Decimal; // invoice_demand - utilised_billing_demand
  percentage_variance: Decimal | null; // (absolute_variance / utilised_billing_demand) * 100; null when baseline = 0
  percentage_variance_status: VariancePercentageStatus;
  variance_direction: "OVERBILLED" | "UNDERBILLED" | "EXACT_MATCH";

  // "Record the configured tolerance separately. Do not hide small variances."
  configured_tolerance: {
    absolute_tolerance: Decimal;
    percentage_tolerance: Decimal;
    tolerance_rule_source: string;
  };
  is_within_tolerance: boolean;
  discrepancy_classification: DiscrepancyClassification;

  // Breakdown across TOU periods
  tou_demand_breakdown: TouDemandBreakdown;

  // Full methodology audit record
  methodology_record: {
    rule_id: string;
    methodology_name: string;
    measurement_unit: DemandMeasurementUnit;
    tou_window_scope: DemandWindowScope;
    is_assumed_raw_kw: boolean; // Explicitly false!
    ratchet_applied: boolean;
    ratchet_explanation?: string;
    methodology_description: string;
  };
  explanation: string;
  audit_timestamp: string;
}

export class DemandReconciliationEngine {
  public static readonly DEFAULT_ABSOLUTE_TOLERANCE = new Decimal("5.00"); // 5 kVA / kW
  public static readonly DEFAULT_PERCENTAGE_TOLERANCE = new Decimal("0.005"); // 0.5%

  /**
   * Standard Eskom Megaflex Demand Methodology:
   *   - Measured in kVA (not kW)
   *   - Evaluated during Peak & Standard hours only (Off-Peak demand excluded)
   *   - Minimum ratchet: 70% of NMD (or configured minimum)
   */
  public static readonly ESKOM_MEGAFLEX_DEMAND_RULE: DemandMethodologyConfig = {
    rule_id: "ESKOM_MEGAFLEX_DEMAND_DEFAULT",
    methodology_name: "Eskom Megaflex Peak/Standard kVA Demand Rule",
    measurement_unit: "kVA",
    tou_window_scope: "PEAK_AND_STANDARD_ONLY",
    nmd_ratchet_percentage: new Decimal("70"), // 70% of NMD
    minimum_billing_demand: new Decimal("50"), // 50 kVA
    demand_integration_minutes: 30,
    description:
      "Billed demand is the maximum apparent demand (kVA) measured over 30-minute integration periods " +
      "during Peak and Standard hours only. Off-Peak demand is excluded. " +
      "Utilised billing demand is subject to a 70% ratchet of Notified Maximum Demand.",
  };

  /**
   * Standard Municipal Flat Commercial Demand Methodology:
   *   - Measured in kW across all hours
   *   - No TOU window restriction
   */
  public static readonly MUNICIPAL_ALL_HOURS_KW_RULE: DemandMethodologyConfig = {
    rule_id: "MUNICIPAL_ALL_HOURS_KW_DEFAULT",
    methodology_name: "Municipal Flat All-Hours kW Demand Rule",
    measurement_unit: "kW",
    tou_window_scope: "ALL_HOURS",
    demand_integration_minutes: 30,
    description:
      "Billed demand is the maximum active demand (kW) measured across all 24 hours of the billing month.",
  };

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
   * Helper to find maximum Decimal value (safe replacement for Decimal.max which is absent in decimal.js-light)
   */
  private static maxDecimal(...decimals: Decimal[]): Decimal {
    if (decimals.length === 0) return new Decimal(0);
    return decimals.reduce((max, curr) => (curr.greaterThan(max) ? curr : max), decimals[0]);
  }

  /**
   * Reconcile invoice demand against AMR-derived demand per the configured tariff methodology.
   *
   * Requirement 17 Rules:
   *   - Calculate applicable demand values where interval demand exists.
   *   - Compare: Invoice Demand vs AMR-derived Demand.
   *   - Support: maximum demand, TOU demand, notified demand, utilised demand.
   *   - Do not assume that invoice demand is always simply the maximum raw interval kW.
   *   - The applicable demand methodology must be supplied by configuration/tariff rules.
   */
  public static reconcileDemand(input: DemandReconciliationInput): DemandReconciliationResult {
    const config = input.demand_methodology;
    const unit = config.measurement_unit;

    let peakKw = this.parseDecimal(input.amr_tou_peak_kw);
    let peakKva = this.parseDecimal(input.amr_tou_peak_kva);
    let stdKw = this.parseDecimal(input.amr_tou_standard_kw);
    let stdKva = this.parseDecimal(input.amr_tou_standard_kva);
    let offKw = this.parseDecimal(input.amr_tou_off_peak_kw);
    let offKva = this.parseDecimal(input.amr_tou_off_peak_kva);
    let rawMaxKw = this.parseDecimal(input.amr_raw_max_kw);
    let rawMaxKva = this.parseDecimal(input.amr_raw_max_kva);
    let peakTimestamp: string | undefined;

    // 1. If intervals and tariff_period_definition are provided, compute demand from raw intervals
    if (input.intervals && input.intervals.length > 0 && input.tariff_period_definition) {
      const mapped = TouMappingEngine.mapIntervals(
        input.intervals,
        input.tariff_period_definition
      );

      for (const m of mapped) {
        const kw = m.kW;
        const kva = m.kVA;

        if (kw.greaterThan(rawMaxKw)) rawMaxKw = kw;
        if (kva.greaterThan(rawMaxKva)) {
          rawMaxKva = kva;
          peakTimestamp = m.timestampLocal;
        }

        if (m.period === "PEAK") {
          if (kw.greaterThan(peakKw)) peakKw = kw;
          if (kva.greaterThan(peakKva)) peakKva = kva;
        } else if (m.period === "STANDARD") {
          if (kw.greaterThan(stdKw)) stdKw = kw;
          if (kva.greaterThan(stdKva)) stdKva = kva;
        } else if (m.period === "OFF-PEAK") {
          if (kw.greaterThan(offKw)) offKw = kw;
          if (kva.greaterThan(offKva)) offKva = kva;
        }
      }
    } else {
      // Ensure raw max values are at least as large as the TOU components
      const maxTouKw = this.maxDecimal(peakKw, stdKw, offKw);
      const maxTouKva = this.maxDecimal(peakKva, stdKva, offKva);
      if (maxTouKw.greaterThan(rawMaxKw)) rawMaxKw = maxTouKw;
      if (maxTouKva.greaterThan(rawMaxKva)) rawMaxKva = maxTouKva;
    }

    // 2. Determine TOU demand breakdown based on requested measurement unit (kVA or kW)
    const rawUnitMax = unit === "kVA" ? rawMaxKva : rawMaxKw;
    const peakDemand = unit === "kVA" ? peakKva : peakKw;
    const stdDemand = unit === "kVA" ? stdKva : stdKw;
    const offDemand = unit === "kVA" ? offKva : offKw;

    const peakAndStdMax = (peakDemand.isZero() && stdDemand.isZero() && !rawUnitMax.isZero())
      ? rawUnitMax
      : this.maxDecimal(peakDemand, stdDemand);

    const allHoursMax = this.maxDecimal(peakDemand, stdDemand, offDemand, rawUnitMax);

    const touBreakdown: TouDemandBreakdown = {
      peak_demand: peakDemand,
      standard_demand: stdDemand,
      off_peak_demand: offDemand,
      peak_and_standard_max: peakAndStdMax,
      all_hours_max: allHoursMax,
      peak_timestamp: peakTimestamp,
    };

    // 3. Calculate APPLICABLE MEASURED DEMAND according to configured TOU window scope
    // "Do not assume that invoice demand is always simply the maximum raw interval kW."
    let applicableMeasuredDemand: Decimal;
    switch (config.tou_window_scope) {
      case "PEAK_AND_STANDARD_ONLY":
        applicableMeasuredDemand = peakAndStdMax;
        break;
      case "PEAK_ONLY":
        applicableMeasuredDemand = peakDemand;
        break;
      case "OFF_PEAK_ONLY":
        applicableMeasuredDemand = offDemand;
        break;
      case "ALL_HOURS":
      default:
        applicableMeasuredDemand = allHoursMax;
        break;
    }

    // 4. Calculate UTILISED DEMAND (Ratchet & Minimum Billing Demand Rules)
    let utilisedBillingDemand = applicableMeasuredDemand;
    let ratchetApplied = false;
    let ratchetExplanation: string | undefined;
    let nmdFloor: Decimal | undefined;

    const nmdVal = config.nmd_kva ? this.parseDecimal(config.nmd_kva) : undefined;

    if (nmdVal && !nmdVal.isZero() && config.nmd_ratchet_percentage) {
      const ratchetPct = this.parseDecimal(config.nmd_ratchet_percentage);
      nmdFloor = nmdVal.times(ratchetPct).dividedBy(100);

      if (nmdFloor.greaterThan(utilisedBillingDemand)) {
        ratchetApplied = true;
        ratchetExplanation =
          `Measured demand (${applicableMeasuredDemand.toString()} ${unit}) is below the ${ratchetPct.toString()}% ` +
          `NMD ratchet floor (${nmdFloor.toString()} ${unit}). Contractual billing demand increased to ${nmdFloor.toString()} ${unit}.`;
        utilisedBillingDemand = nmdFloor;
      }
    }

    if (config.minimum_billing_demand) {
      const minDemand = this.parseDecimal(config.minimum_billing_demand);
      if (minDemand.greaterThan(utilisedBillingDemand)) {
        ratchetApplied = true;
        ratchetExplanation =
          `Demand is below tariff minimum billing threshold of ${minDemand.toString()} ${unit}. ` +
          `Billed demand floored at ${minDemand.toString()} ${unit}.`;
        utilisedBillingDemand = minDemand;
      }
    }

    // 5. Evaluate Notified Maximum Demand (NMD) Exceedance
    let nmdExceedanceAmount = new Decimal(0);
    let hasNmdExceedance = false;
    if (nmdVal && !nmdVal.isZero()) {
      if (applicableMeasuredDemand.greaterThan(nmdVal)) {
        nmdExceedanceAmount = applicableMeasuredDemand.minus(nmdVal);
        hasNmdExceedance = true;
      }
    }

    // 6. Compare with Invoice Demand
    const invDemand = this.parseDecimal(input.invoice_demand_value);
    const variance = VarianceEngine.calculate(invDemand, utilisedBillingDemand);
    const absoluteVariance = variance.absolute_variance;
    const percentageVariance = variance.variance_percentage; // null when baseline is 0 (Req 21)

    // Direction
    let direction: "OVERBILLED" | "UNDERBILLED" | "EXACT_MATCH" = "EXACT_MATCH";
    if (absoluteVariance.greaterThan(0)) {
      direction = "OVERBILLED";
    } else if (absoluteVariance.lessThan(0)) {
      direction = "UNDERBILLED";
    }

    // 7. Tolerance Evaluation
    const absTol = input.tolerance?.absolute_tolerance !== undefined
      ? new Decimal(String(input.tolerance.absolute_tolerance))
      : this.DEFAULT_ABSOLUTE_TOLERANCE;

    const pctTol = input.tolerance?.percentage_tolerance !== undefined
      ? new Decimal(String(input.tolerance.percentage_tolerance))
      : this.DEFAULT_PERCENTAGE_TOLERANCE;

    const tolSource = input.tolerance?.tolerance_rule_source ?? "DEFAULT_UTILITY_POLICY";

    const absVarianceMag = absoluteVariance.abs();
    const isWithinAbs = absVarianceMag.lessThanOrEqualTo(absTol);
    const isWithinPct = utilisedBillingDemand.isZero()
      ? false
      : absVarianceMag.dividedBy(utilisedBillingDemand).lessThanOrEqualTo(pctTol);
    const isWithinTolerance = isWithinAbs || isWithinPct;

    let discrepancyClassification: DiscrepancyClassification = "MATERIAL_DISCREPANCY";
    if (absoluteVariance.isZero()) {
      discrepancyClassification = "EXACT_MATCH";
    } else if (isWithinTolerance) {
      discrepancyClassification = "WITHIN_TOLERANCE";
    }

    const explanation = absoluteVariance.isZero()
      ? `Exact match: Invoice demand (${invDemand.toString()} ${unit}) matches AMR-derived utilised billing demand.`
      : `Variance of ${absoluteVariance.toString()} ${unit} (${percentageVariance !== null ? percentageVariance.toDecimalPlaces(4).toString() + "%" : "percentage undefined: baseline is 0"}) ` +
        `against utilised billing demand (${utilisedBillingDemand.toString()} ${unit}). ` +
        `Configured tolerance: Absolute ${absTol.toString()} ${unit}, Percentage ${pctTol.times(100).toString()}%. ` +
        `Classification: ${discrepancyClassification}.`;

    return {
      invoice_demand: invDemand,
      invoice_unit: unit,
      raw_amr_maximum_demand: unit === "kVA" ? rawMaxKva : rawMaxKw,
      raw_maximum_interval_kw: rawMaxKw,
      raw_maximum_interval_kva: rawMaxKva,
      applicable_measured_demand: applicableMeasuredDemand,
      utilised_billing_demand: utilisedBillingDemand,
      notified_maximum_demand: nmdVal,
      nmd_ratchet_floor: nmdFloor,
      nmd_exceedance_amount: nmdExceedanceAmount,
      has_nmd_exceedance: hasNmdExceedance,
      absolute_variance: absoluteVariance,
      percentage_variance: percentageVariance,
      percentage_variance_status: variance.percentage_status,
      variance_direction: direction,
      configured_tolerance: {
        absolute_tolerance: absTol,
        percentage_tolerance: pctTol,
        tolerance_rule_source: tolSource,
      },
      is_within_tolerance: isWithinTolerance,
      discrepancy_classification: discrepancyClassification,
      tou_demand_breakdown: touBreakdown,
      methodology_record: {
        rule_id: config.rule_id,
        methodology_name: config.methodology_name,
        measurement_unit: unit,
        tou_window_scope: config.tou_window_scope,
        is_assumed_raw_kw: false, // Refused assumption: tariff rules applied
        ratchet_applied: ratchetApplied,
        ratchet_explanation: ratchetExplanation,
        methodology_description: config.description,
      },
      explanation,
      audit_timestamp: new Date().toISOString(),
    };
  }
}
