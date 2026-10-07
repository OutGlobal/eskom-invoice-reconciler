/**
 * ENERA RECONCILIATION ENGINE: VARIANCE ENGINE (REQUIREMENT 21)
 * ============================================================
 * Single authoritative implementation of variance arithmetic:
 *
 *   absolute_variance   = billed - expected
 *   variance_percentage = (billed - expected) / expected × 100   (only where defined)
 *
 * Core Principles:
 *   1. expected = 0 never causes a division error.
 *   2. A percentage is NEVER manufactured where it is mathematically undefined.
 *      When expected = 0 the percentage is `null` and the reason is recorded
 *      explicitly (`percentage_status`), rather than substituting 0% or 100%.
 *   3. Sign convention: positive variance = billed above expected (overbilled),
 *      negative variance = billed below expected (underbilled).
 *   4. Decimal precision throughout (decimal.js-light). No floating point.
 */

import Decimal from "decimal.js-light";

export type DecimalInput = number | string | Decimal;

export type VariancePercentageStatus =
  /** expected ≠ 0: percentage computed normally */
  | "DEFINED"
  /** expected = 0 and billed = 0: 0/0 is indeterminate; no percentage reported */
  | "UNDEFINED_ZERO_BASELINE_NO_VARIANCE"
  /** expected = 0 and billed ≠ 0: x/0 is undefined; no percentage reported */
  | "UNDEFINED_ZERO_BASELINE_WITH_VARIANCE";

export type VarianceEngineDirection = "MATCH" | "OVERBILLED" | "UNDERBILLED";

export interface VarianceResult {
  billed: Decimal;
  expected: Decimal;
  /** billed - expected */
  absolute_variance: Decimal;
  /** |billed - expected| */
  absolute_variance_magnitude: Decimal;
  /** (billed - expected) / expected × 100, or null where mathematically undefined */
  variance_percentage: Decimal | null;
  percentage_status: VariancePercentageStatus;
  direction: VarianceEngineDirection;
  /** Human-readable explanation of the formula and any undefined result */
  methodology: string;
}

export interface VarianceTolerance {
  /** Absolute tolerance in the unit of the compared values (e.g. ZAR, kWh) */
  absolute?: DecimalInput;
  /** Percentage tolerance expressed in percent (e.g. 0.5 = 0.5%) */
  percentage?: DecimalInput;
}

export type ToleranceOutcome =
  | "EXACT_MATCH"
  | "WITHIN_TOLERANCE"
  | "OUTSIDE_TOLERANCE"
  /** No tolerance configured; a non-zero variance cannot be classified as acceptable */
  | "NO_TOLERANCE_CONFIGURED";

import type { VarianceStatus } from "./varianceStatus";
export type { VarianceStatus };

export interface ToleranceEvaluation {
  outcome: ToleranceOutcome;
  /** Authoritative business variance status (Requirement 22) */
  status: VarianceStatus;
  within_absolute: boolean | null;
  within_percentage: boolean | null;
  absolute_tolerance: Decimal | null;
  percentage_tolerance: Decimal | null;
  rule: string;
}

export class VarianceEngine {
  public static toDecimal(value: DecimalInput, field = "value"): Decimal {
    if (value instanceof Decimal) return value;
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`VarianceEngine: ${field} must be a finite number (received ${value}).`);
    }
    try {
      return new Decimal(String(value).trim());
    } catch {
      throw new Error(`VarianceEngine: ${field} is not a valid decimal (received '${String(value)}').`);
    }
  }

  /**
   * Compute variance between a billed value and an expected value.
   * Never divides by zero; never fabricates a percentage.
   */
  public static calculate(billedInput: DecimalInput, expectedInput: DecimalInput): VarianceResult {
    const billed = this.toDecimal(billedInput, "billed");
    const expected = this.toDecimal(expectedInput, "expected");

    const absoluteVariance = billed.minus(expected);
    const direction: VarianceEngineDirection = absoluteVariance.isZero()
      ? "MATCH"
      : absoluteVariance.greaterThan(0)
        ? "OVERBILLED"
        : "UNDERBILLED";

    if (expected.isZero()) {
      const noVariance = absoluteVariance.isZero();
      return {
        billed,
        expected,
        absolute_variance: absoluteVariance,
        absolute_variance_magnitude: absoluteVariance.abs(),
        variance_percentage: null,
        percentage_status: noVariance
          ? "UNDEFINED_ZERO_BASELINE_NO_VARIANCE"
          : "UNDEFINED_ZERO_BASELINE_WITH_VARIANCE",
        direction,
        methodology: noVariance
          ? "absolute_variance = billed - expected = 0. variance_percentage not reported: expected = 0 (0/0 is indeterminate)."
          : `absolute_variance = billed - expected = ${absoluteVariance.toString()}. ` +
            "variance_percentage not reported: expected = 0 (division by zero is undefined).",
      };
    }

    const pct = absoluteVariance.dividedBy(expected).times(100);
    return {
      billed,
      expected,
      absolute_variance: absoluteVariance,
      absolute_variance_magnitude: absoluteVariance.abs(),
      variance_percentage: pct,
      percentage_status: "DEFINED",
      direction,
      methodology:
        `absolute_variance = ${billed.toString()} - ${expected.toString()} = ${absoluteVariance.toString()}; ` +
        `variance_percentage = (${absoluteVariance.toString()} / ${expected.toString()}) × 100 = ${pct.toDecimalPlaces(6).toString()}%`,
    };
  }

  /**
   * Evaluate a variance against configured tolerances.
   * A variance is within tolerance if it satisfies ANY configured tolerance.
   * Percentage tolerance is not applied when the percentage is undefined.
   */
  public static evaluateTolerance(
    variance: VarianceResult,
    tolerance?: VarianceTolerance | null,
  ): ToleranceEvaluation {
    const absTol =
      tolerance?.absolute !== undefined && tolerance?.absolute !== null
        ? this.toDecimal(tolerance.absolute, "tolerance.absolute").abs()
        : null;
    const pctTol =
      tolerance?.percentage !== undefined && tolerance?.percentage !== null
        ? this.toDecimal(tolerance.percentage, "tolerance.percentage").abs()
        : null;

    const withinAbs = absTol ? variance.absolute_variance_magnitude.lessThanOrEqualTo(absTol) : null;
    const withinPct =
      pctTol && variance.variance_percentage !== null
        ? variance.variance_percentage.abs().lessThanOrEqualTo(pctTol)
        : null;

    const ruleParts: string[] = [];
    if (absTol) ruleParts.push(`|variance| ≤ ${absTol.toString()}`);
    if (pctTol) {
      ruleParts.push(
        variance.variance_percentage === null
          ? `|variance %| ≤ ${pctTol.toString()}% (not applicable: percentage undefined)`
          : `|variance %| ≤ ${pctTol.toString()}%`,
      );
    }
    const rule = ruleParts.length ? ruleParts.join(" OR ") : "No tolerance configured";

    let outcome: ToleranceOutcome;
    let status: VarianceStatus;
    if (variance.absolute_variance.isZero()) {
      outcome = "EXACT_MATCH";
      status = "MATCH";
    } else if (!absTol && !pctTol) {
      outcome = "NO_TOLERANCE_CONFIGURED";
      status = "OUTSIDE_TOLERANCE";
    } else if (withinAbs === true || withinPct === true) {
      outcome = "WITHIN_TOLERANCE";
      status = "WITHIN_TOLERANCE";
    } else {
      outcome = "OUTSIDE_TOLERANCE";
      status = "OUTSIDE_TOLERANCE";
    }

    return {
      outcome,
      status,
      within_absolute: withinAbs,
      within_percentage: withinPct,
      absolute_tolerance: absTol,
      percentage_tolerance: pctTol,
      rule,
    };
  }
}
