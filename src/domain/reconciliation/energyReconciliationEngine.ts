/**
 * ENERA RECONCILIATION ENGINE: ENERGY RECONCILIATION (REQUIREMENT 16)
 * ===================================================================
 * Compares invoice energy against AMR-derived energy with mathematical precision.
 *
 * Core Principles:
 *   1. Compares:
 *      - Invoice Peak kWh vs AMR Peak kWh
 *      - Invoice Standard kWh vs AMR Standard kWh
 *      - Invoice Off-Peak kWh vs AMR Off-Peak kWh
 *      - Invoice Total kWh vs AMR Total kWh
 *      - (and optionally Reactive Energy kVArh)
 *   2. Calculates:
 *      - absolute_variance = invoice_kwh - amr_kwh (signed: positive = overbilled)
 *      - percentage_variance = (absolute_variance / amr_kwh) * 100
 *   3. Do not hide small variances:
 *      Even 0.01 kWh or 0.0001% variance is never suppressed or zeroed out.
 *   4. Record the configured tolerance separately:
 *      The threshold tolerance policy is stored independently from the mathematical variance.
 *   5. Decimal.js-light high-precision arithmetic with zero floating-point drift.
 */

import Decimal from "decimal.js-light";
import {
  TouMappingEngine,
  TariffPeriodDefinition,
  TouConsumptionSummary,
} from "./touMappingEngine";

export type EnergyComponentCode =
  | "PEAK_KWH"
  | "STANDARD_KWH"
  | "OFF_PEAK_KWH"
  | "TOTAL_KWH"
  | "REACTIVE_KVARH";

export type VarianceDirection = "OVERBILLED" | "UNDERBILLED" | "EXACT_MATCH";

export type DiscrepancyClassification =
  | "EXACT_MATCH"
  | "WITHIN_TOLERANCE"
  | "MATERIAL_DISCREPANCY";

export interface ComponentToleranceConfig {
  absolute_tolerance: Decimal; // e.g. 100.00 kWh
  percentage_tolerance: Decimal; // e.g. 0.001 (0.1%) or 0.5%
  tolerance_rule_source?: string;
}

export interface EnergyComponentComparison {
  component_code: EnergyComponentCode;
  component_name: string;
  invoice_value: Decimal;
  amr_value: Decimal;
  absolute_variance: Decimal; // invoice_value - amr_value
  percentage_variance: Decimal; // (absolute_variance / amr_value) * 100
  unit_of_measure: "kWh" | "kVArh";
  variance_direction: VarianceDirection;

  // "Record the configured tolerance separately. Do not hide small variances."
  configured_tolerance: {
    absolute_tolerance: Decimal;
    percentage_tolerance: Decimal;
    tolerance_rule_source: string;
  };
  is_within_tolerance: boolean;
  discrepancy_classification: DiscrepancyClassification;
  explanation: string;
}

export interface EnergyReconciliationInput {
  invoice_peak_kwh?: number | Decimal | string | null;
  invoice_standard_kwh?: number | Decimal | string | null;
  invoice_off_peak_kwh?: number | Decimal | string | null;
  invoice_total_kwh?: number | Decimal | string | null;
  invoice_reactive_kvarh?: number | Decimal | string | null;

  // AMR derived values (can be supplied directly or aggregated from intervals)
  amr_peak_kwh?: number | Decimal | string | null;
  amr_standard_kwh?: number | Decimal | string | null;
  amr_off_peak_kwh?: number | Decimal | string | null;
  amr_total_kwh?: number | Decimal | string | null;
  amr_reactive_kvarh?: number | Decimal | string | null;

  // Optional: pass intervals + tariff_period_definition to aggregate dynamically
  intervals?: any[];
  tariff_period_definition?: TariffPeriodDefinition;

  // Configured tolerances
  tolerances?: Partial<
    Record<
      EnergyComponentCode,
      {
        absolute?: number | Decimal | string;
        percentage?: number | Decimal | string;
        source?: string;
      }
    >
  >;
}

export interface EnergyReconciliationSummary {
  peak_comparison: EnergyComponentComparison;
  standard_comparison: EnergyComponentComparison;
  off_peak_comparison: EnergyComponentComparison;
  total_comparison: EnergyComponentComparison;
  reactive_comparison?: EnergyComponentComparison;

  all_components: EnergyComponentComparison[];
  total_invoice_kwh: Decimal;
  total_amr_kwh: Decimal;
  net_active_kwh_variance: Decimal;
  net_active_kwh_percentage_variance: Decimal;

  has_material_discrepancy: boolean;
  all_components_within_tolerance: boolean;
  summation_integrity: {
    invoice_components_sum: Decimal;
    invoice_stated_total: Decimal;
    invoice_sum_matches_total: boolean;
    amr_components_sum: Decimal;
    amr_stated_total: Decimal;
    amr_sum_matches_total: boolean;
  };
  audit_timestamp: string;
}

export class EnergyReconciliationEngine {
  public static readonly DEFAULT_TOLERANCES: Record<
    EnergyComponentCode,
    ComponentToleranceConfig
  > = {
    PEAK_KWH: {
      absolute_tolerance: new Decimal("100.00"), // 100 kWh
      percentage_tolerance: new Decimal("0.001"), // 0.1%
      tolerance_rule_source: "DEFAULT_UTILITY_POLICY",
    },
    STANDARD_KWH: {
      absolute_tolerance: new Decimal("100.00"),
      percentage_tolerance: new Decimal("0.001"),
      tolerance_rule_source: "DEFAULT_UTILITY_POLICY",
    },
    OFF_PEAK_KWH: {
      absolute_tolerance: new Decimal("100.00"),
      percentage_tolerance: new Decimal("0.001"),
      tolerance_rule_source: "DEFAULT_UTILITY_POLICY",
    },
    TOTAL_KWH: {
      absolute_tolerance: new Decimal("200.00"), // 200 kWh
      percentage_tolerance: new Decimal("0.001"), // 0.1%
      tolerance_rule_source: "DEFAULT_UTILITY_POLICY",
    },
    REACTIVE_KVARH: {
      absolute_tolerance: new Decimal("50.00"), // 50 kVArh
      percentage_tolerance: new Decimal("0.005"), // 0.5%
      tolerance_rule_source: "DEFAULT_UTILITY_POLICY",
    },
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
   * Compare a single energy component between invoice and AMR telemetry.
   *
   * Requirement 16 Rules:
   *   - Calculate absolute_variance and percentage_variance.
   *   - Do not hide small variances.
   *   - Record the configured tolerance separately.
   */
  public static compareComponent(
    code: EnergyComponentCode,
    name: string,
    invoiceVal: Decimal,
    amrVal: Decimal,
    unit: "kWh" | "kVArh",
    customTolerance?: {
      absolute?: number | Decimal | string;
      percentage?: number | Decimal | string;
      source?: string;
    }
  ): EnergyComponentComparison {
    const defaultTol = this.DEFAULT_TOLERANCES[code];
    const absTol = customTolerance?.absolute !== undefined
      ? new Decimal(String(customTolerance.absolute))
      : defaultTol.absolute_tolerance;

    const pctTol = customTolerance?.percentage !== undefined
      ? new Decimal(String(customTolerance.percentage))
      : defaultTol.percentage_tolerance;

    const tolSource = customTolerance?.source ?? defaultTol.tolerance_rule_source ?? "DEFAULT_UTILITY_POLICY";

    // 1. Calculate absolute variance (invoice - amr)
    // Positive means utility billed more energy than meter registered.
    const absoluteVariance = invoiceVal.minus(amrVal);

    // 2. Calculate percentage variance (relative to AMR registered energy)
    let percentageVariance = new Decimal(0);
    if (!amrVal.isZero()) {
      percentageVariance = absoluteVariance.dividedBy(amrVal).times(100);
    } else if (!invoiceVal.isZero()) {
      percentageVariance = new Decimal(100); // Billed with zero AMR registered
    }

    // 3. Direction
    let direction: VarianceDirection = "EXACT_MATCH";
    if (absoluteVariance.greaterThan(0)) {
      direction = "OVERBILLED";
    } else if (absoluteVariance.lessThan(0)) {
      direction = "UNDERBILLED";
    }

    // 4. Tolerance check (evaluated against configured tolerance without hiding the variance)
    const absVarianceMag = absoluteVariance.abs();
    const pctVarianceMag = amrVal.isZero()
      ? new Decimal(0)
      : absVarianceMag.dividedBy(amrVal);

    const isWithinAbs = absVarianceMag.lessThanOrEqualTo(absTol);
    const isWithinPct = pctVarianceMag.lessThanOrEqualTo(pctTol);
    const isWithinTolerance = isWithinAbs || isWithinPct;

    let discrepancyClassification: DiscrepancyClassification = "MATERIAL_DISCREPANCY";
    if (absoluteVariance.isZero()) {
      discrepancyClassification = "EXACT_MATCH";
    } else if (isWithinTolerance) {
      discrepancyClassification = "WITHIN_TOLERANCE";
    }

    // 5. Plain-English audit explanation preserving full mathematical details
    const explanation = absoluteVariance.isZero()
      ? `Exact match: Invoice ${name} equals AMR registered ${name} (${amrVal.toString()} ${unit}).`
      : `Variance of ${absoluteVariance.toString()} ${unit} (${percentageVariance.toDecimalPlaces(4).toString()}%) ` +
        `evaluated against configured tolerance (Absolute: ${absTol.toString()} ${unit}, Percentage: ${pctTol.times(100).toString()}%). ` +
        `Classification: ${discrepancyClassification}.`;

    return {
      component_code: code,
      component_name: name,
      invoice_value: invoiceVal,
      amr_value: amrVal,
      absolute_variance: absoluteVariance,
      percentage_variance: percentageVariance,
      unit_of_measure: unit,
      variance_direction: direction,
      configured_tolerance: {
        absolute_tolerance: absTol,
        percentage_tolerance: pctTol,
        tolerance_rule_source: tolSource,
      },
      is_within_tolerance: isWithinTolerance,
      discrepancy_classification: discrepancyClassification,
      explanation,
    };
  }

  /**
   * Reconcile all energy components (Peak, Standard, Off-Peak, Total, Reactive).
   */
  public static reconcileEnergy(input: EnergyReconciliationInput): EnergyReconciliationSummary {
    let amrPeak = this.parseDecimal(input.amr_peak_kwh);
    let amrStd = this.parseDecimal(input.amr_standard_kwh);
    let amrOff = this.parseDecimal(input.amr_off_peak_kwh);
    let amrTotal = this.parseDecimal(input.amr_total_kwh);
    let amrKvarh = this.parseDecimal(input.amr_reactive_kvarh);

    // If intervals and tariff_period_definition are supplied, aggregate dynamically via TouMappingEngine
    if (input.intervals && input.intervals.length > 0 && input.tariff_period_definition) {
      const touAgg: TouConsumptionSummary = TouMappingEngine.aggregateIntervalsByTou(
        input.intervals,
        input.tariff_period_definition
      );
      amrPeak = touAgg.by_period.PEAK.total_kwh;
      amrStd = touAgg.by_period.STANDARD.total_kwh;
      amrOff = touAgg.by_period["OFF-PEAK"].total_kwh;
      amrTotal = touAgg.total_active_kwh;
      amrKvarh = touAgg.total_reactive_kvarh;
    } else if (amrTotal.isZero() && (!amrPeak.isZero() || !amrStd.isZero() || !amrOff.isZero())) {
      // Sum AMR components if total wasn't provided directly
      amrTotal = amrPeak.plus(amrStd).plus(amrOff);
    }

    const invPeak = this.parseDecimal(input.invoice_peak_kwh);
    const invStd = this.parseDecimal(input.invoice_standard_kwh);
    const invOff = this.parseDecimal(input.invoice_off_peak_kwh);
    let invTotal = this.parseDecimal(input.invoice_total_kwh);
    const invKvarh = this.parseDecimal(input.invoice_reactive_kvarh);

    if (invTotal.isZero() && (!invPeak.isZero() || !invStd.isZero() || !invOff.isZero())) {
      invTotal = invPeak.plus(invStd).plus(invOff);
    }

    // Compare each component individually
    const peakComparison = this.compareComponent(
      "PEAK_KWH",
      "Peak Energy",
      invPeak,
      amrPeak,
      "kWh",
      input.tolerances?.PEAK_KWH
    );

    const standardComparison = this.compareComponent(
      "STANDARD_KWH",
      "Standard Energy",
      invStd,
      amrStd,
      "kWh",
      input.tolerances?.STANDARD_KWH
    );

    const offPeakComparison = this.compareComponent(
      "OFF_PEAK_KWH",
      "Off-Peak Energy",
      invOff,
      amrOff,
      "kWh",
      input.tolerances?.OFF_PEAK_KWH
    );

    const totalComparison = this.compareComponent(
      "TOTAL_KWH",
      "Total Energy",
      invTotal,
      amrTotal,
      "kWh",
      input.tolerances?.TOTAL_KWH
    );

    let reactiveComparison: EnergyComponentComparison | undefined;
    if (!invKvarh.isZero() || !amrKvarh.isZero()) {
      reactiveComparison = this.compareComponent(
        "REACTIVE_KVARH",
        "Reactive Energy",
        invKvarh,
        amrKvarh,
        "kVArh",
        input.tolerances?.REACTIVE_KVARH
      );
    }

    const allComponents = [
      peakComparison,
      standardComparison,
      offPeakComparison,
      totalComparison,
    ];
    if (reactiveComparison) {
      allComponents.push(reactiveComparison);
    }

    // Net active variance and percentage
    const netActiveVariance = invTotal.minus(amrTotal);
    let netActivePctVariance = new Decimal(0);
    if (!amrTotal.isZero()) {
      netActivePctVariance = netActiveVariance.dividedBy(amrTotal).times(100);
    }

    const hasMaterialDiscrepancy = allComponents.some(
      (c) => c.discrepancy_classification === "MATERIAL_DISCREPANCY"
    );

    const allWithinTolerance = allComponents.every((c) => c.is_within_tolerance);

    // Summation integrity cross-check
    const invoiceComponentsSum = invPeak.plus(invStd).plus(invOff);
    const invoiceSumMatches = invoiceComponentsSum.equals(invTotal);

    const amrComponentsSum = amrPeak.plus(amrStd).plus(amrOff);
    const amrSumMatches = amrComponentsSum.equals(amrTotal);

    return {
      peak_comparison: peakComparison,
      standard_comparison: standardComparison,
      off_peak_comparison: offPeakComparison,
      total_comparison: totalComparison,
      reactive_comparison: reactiveComparison,
      all_components: allComponents,
      total_invoice_kwh: invTotal,
      total_amr_kwh: amrTotal,
      net_active_kwh_variance: netActiveVariance,
      net_active_kwh_percentage_variance: netActivePctVariance,
      has_material_discrepancy: hasMaterialDiscrepancy,
      all_components_within_tolerance: allWithinTolerance,
      summation_integrity: {
        invoice_components_sum: invoiceComponentsSum,
        invoice_stated_total: invTotal,
        invoice_sum_matches_total: invoiceSumMatches,
        amr_components_sum: amrComponentsSum,
        amr_stated_total: amrTotal,
        amr_sum_matches_total: amrSumMatches,
      },
      audit_timestamp: new Date().toISOString(),
    };
  }
}
