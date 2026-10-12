/**
 * ENERA AI VALIDATION — CENTRALIZED VALIDATION TOLERANCES (REQUIREMENT 16)
 * =========================================================================
 * Centralized, documented tolerances for mathematical and physical validation checks.
 *
 * MANDATE:
 * 1. Do NOT scatter arbitrary tolerance values throughout the codebase.
 * 2. Document WHY each tolerance exists based on utility billing realities.
 * 3. Provide structured tolerance evaluation results (expected vs actual vs allowed difference).
 */

import Decimal from "decimal.js-light";

export interface ToleranceDefinition {
  code: string;
  name: string;
  value: number;
  unit: string;
  rationale: string;
}

/**
 * Centralized System Validation Tolerances
 */
export const VALIDATION_TOLERANCES = {
  /**
   * Financial Cent Tolerance (R 0.02)
   * RATIONALE: Legitimate cent rounding occurs when calculating multiple discrete rate line items
   * (e.g., c/kWh energy rates multiplied by kWh quantities and rounded to 2 decimal places before summing).
   */
  FINANCIAL_CENT: {
    code: "FINANCIAL_CENT",
    name: "Financial Cent Rounding Tolerance",
    value: 0.02,
    unit: "ZAR",
    rationale:
      "Accommodates up to 2 cents rounding discrepancy arising from summing multiple 2-decimal rounded line charges.",
  },

  /**
   * Financial Relative Percentage Tolerance (0.05%)
   * RATIONALE: On large high-voltage bulk transmission accounts (> R 10,000,000), cumulative intermediate
   * rounding across 50+ tariff components can legitimately produce small sub-cent rounding aggregates.
   */
  FINANCIAL_RELATIVE_PERCENT: {
    code: "FINANCIAL_RELATIVE_PERCENT",
    name: "Financial Relative Percentage Tolerance",
    value: 0.0005, // 0.05%
    unit: "fraction",
    rationale:
      "Permits 0.05% relative divergence on large enterprise invoices with numerous line items.",
  },

  /**
   * TOU Energy Sum Tolerance (1.0 kWh)
   * RATIONALE: TOU register readings on municipal and Eskom meters are often displayed as integer kWh values,
   * leading to a ±1 kWh truncation/rounding artifact when summing Peak + Standard + Off-Peak.
   */
  ENERGY_KWH: {
    code: "ENERGY_KWH",
    name: "Active Energy Register Rounding Tolerance",
    value: 1.0,
    unit: "kWh",
    rationale:
      "Accommodates integer truncation rounding across 3 discrete TOU active energy registers.",
  },

  /**
   * Demand Meter Register Resolution Tolerance (0.5 kVA)
   * RATIONALE: 30-minute integrating demand meters record maximum demand with typical 0.1 to 0.5 kVA register resolution.
   */
  DEMAND_KVA: {
    code: "DEMAND_KVA",
    name: "Demand Meter Resolution Tolerance",
    value: 0.5,
    unit: "kVA",
    rationale: "Accommodates 0.5 kVA resolution rounding on maximum demand registers.",
  },

  /**
   * Power Factor Resolution Tolerance (0.01)
   * RATIONALE: Power Factor is a dimensionless ratio (kW / kVA) rounded to 2 decimal places on utility statements.
   */
  POWER_FACTOR: {
    code: "POWER_FACTOR",
    name: "Power Factor Calculation Tolerance",
    value: 0.01,
    unit: "dimensionless",
    rationale:
      "Permits 0.01 discrepancy between extracted PF and calculated active/apparent power ratio.",
  },

  /**
   * South African Statutory VAT Rate Tolerance (0.5% -> 14.5% to 15.5%)
   * RATIONALE: While South African standard VAT is exactly 15.0%, utility bills may include small zero-rated
   * or exempt components (such as interest charges or municipal levies), shifting the effective rate slightly.
   */
  VAT_RATE_PERCENT: {
    code: "VAT_RATE_PERCENT",
    name: "Effective VAT Rate Tolerance",
    value: 0.5,
    unit: "%",
    rationale:
      "Permits 14.5% to 15.5% effective VAT rate to accommodate minor exempt or zero-rated charges.",
  },

  /**
   * Meter Reading Consumption Delta Tolerance (2.0 kWh)
   * RATIONALE: Meter multiplier scaling and initial index rollover on high-ratio CT/VT meters.
   */
  METER_CONSUMPTION_DELTA: {
    code: "METER_CONSUMPTION_DELTA",
    name: "Meter Reading Consumption Delta Tolerance",
    value: 2.0,
    unit: "kWh",
    rationale:
      "Permits up to 2.0 kWh difference between (Current Index - Previous Index) * Multiplier and Billed Active Energy.",
  },

  /**
   * Standard Utility Billing Cycle Day Range (25 to 35 days)
   * RATIONALE: Calendar month variation and meter reading schedule shifts (weekends/holidays).
   */
  BILLING_CYCLE_DAYS: {
    code: "BILLING_CYCLE_DAYS",
    name: "Billing Cycle Duration Boundaries",
    minDays: 25,
    maxDays: 35,
    unit: "days",
    rationale: "Standard monthly utility reading cycle spans between 25 and 35 calendar days.",
  },
} as const;

export interface ToleranceEvaluationResult {
  isPassed: boolean;
  expectedValue: number;
  actualValue: number;
  difference: number;
  toleranceApplied: number;
  unit: string;
  toleranceCode: string;
  rationale: string;
  message?: string;
}

export class ValidationToleranceEvaluator {
  /**
   * Evaluates if an actual value is within the allowed tolerance of an expected value.
   */
  public static evaluateNumericTolerance(params: {
    expected: number;
    actual: number;
    toleranceDef: { code: string; value: number; unit: string; rationale: string };
  }): ToleranceEvaluationResult {
    const { expected, actual, toleranceDef } = params;
    const diff = Math.abs(new Decimal(expected).minus(new Decimal(actual)).toNumber());
    const isPassed = diff <= toleranceDef.value;

    return {
      isPassed,
      expectedValue: expected,
      actualValue: actual,
      difference: Number(diff.toFixed(4)),
      toleranceApplied: toleranceDef.value,
      unit: toleranceDef.unit,
      toleranceCode: toleranceDef.code,
      rationale: toleranceDef.rationale,
      message: isPassed
        ? undefined
        : `Divergence of ${diff.toFixed(2)} ${toleranceDef.unit} exceeds allowed tolerance of ${toleranceDef.value} ${toleranceDef.unit} (${toleranceDef.code}).`,
    };
  }
}
