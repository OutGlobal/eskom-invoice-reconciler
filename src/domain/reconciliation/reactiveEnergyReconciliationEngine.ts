/**
 * ENERA RECONCILIATION ENGINE: REACTIVE ENERGY (REQUIREMENT 18)
 * =============================================================
 * Where available:
 *   1. Compares:
 *      Invoice kVArh vs AMR kVArh
 *      and:
 *      Invoice power factor vs AMR-derived power factor
 *   2. Flags significant differences (with configurable sensitivity thresholds).
 *   3. STRICT COMPLIANCE RULE:
 *      Do NOT calculate reactive penalties in this branch UNLESS the applicable
 *      tariff rule is supplied by the Tariff Engine.
 *      If no tariff rule is supplied, penalty calculation is explicitly skipped
 *      with documented explanation.
 */

import Decimal from "decimal.js-light";
import {
  PowerFactorEngine,
  PowerFactorAuditRecord,
  PowerFactorDirection,
} from "./powerFactorEngine";
import { VarianceEngine, type VariancePercentageStatus } from "./varianceEngine";
import type { VarianceStatus } from "./varianceStatus";
import { CentralToleranceRegistry, type RecordedTolerance } from "./toleranceModel";

export type ReactivePenaltyStatus =
  "SKIPPED_NO_TARIFF_RULE" | "CALCULATED_FROM_TARIFF_RULE" | "NOT_APPLICABLE_PF_COMPLIANT";

export interface ReactiveEnergyReconciliationInput {
  // Invoice values
  invoice_kvarh?: number | Decimal | string | null;
  invoice_power_factor?: number | Decimal | string | null;
  invoice_pf_direction?: PowerFactorDirection;

  // AMR values (can be provided directly or derived from intervals)
  amr_kvarh?: number | Decimal | string | null;
  amr_kwh?: number | Decimal | string | null;
  amr_kvah?: number | Decimal | string | null;
  amr_power_factor?: number | Decimal | string | null;
  amr_pf_direction?: PowerFactorDirection;

  // Intervals (optional for automatic PF derivation via PowerFactorEngine)
  intervals?: any[];

  // Significance thresholds
  significance_thresholds?: {
    kvarh_absolute_threshold?: number | Decimal | string; // default 50 kVArh
    kvarh_percentage_threshold?: number | Decimal | string; // default 0.01 (1.0%)
    pf_difference_threshold?: number | Decimal | string; // default 0.02 (e.g. 0.95 vs 0.92)
    threshold_source?: string;
  };

  // Applicable tariff reactive rule (OPTIONAL from Tariff Engine)
  // "Do not calculate reactive penalties in this branch unless the applicable tariff rule is supplied by the Tariff Engine."
  tariff_reactive_rule?: {
    rule_id: string;
    tariff_code: string;
    tariff_version?: string;
    pf_threshold: Decimal | number | string; // e.g. 0.95
    reactive_penalty_rate_zar_per_kvarh: Decimal | number | string; // e.g. R 0.25 / kVARh
    allowance_tan_phi?: Decimal | number | string; // quota factor
    season?: string;
    description?: string;
  };
}

export interface ReactiveEnergyComparison {
  invoice_kvarh?: Decimal;
  amr_kvarh?: Decimal;
  absolute_variance?: Decimal; // invoice - amr
  percentage_variance?: Decimal | null; // (absolute / amr) * 100; null when amr = 0 (undefined)
  percentage_variance_status?: VariancePercentageStatus;
  is_significant_difference: boolean;
  variance_direction?: "OVERBILLED" | "UNDERBILLED" | "EXACT_MATCH";
  kvarh_data_available: boolean;
  /** Authoritative business variance status (Requirement 22) */
  variance_status: VarianceStatus;
  /** Recorded tolerance snapshot used for this comparison (Requirement 23) */
  recorded_tolerance: RecordedTolerance;
}

export interface PowerFactorComparison {
  invoice_pf?: Decimal;
  amr_pf?: Decimal;
  pf_difference?: Decimal; // invoice_pf - amr_pf
  is_significant_difference: boolean;
  invoice_direction?: PowerFactorDirection;
  amr_direction?: PowerFactorDirection;
  has_direction_mismatch: boolean; // e.g. invoice claims lagging when meter shows leading
  pf_data_available: boolean;
  amr_pf_audit?: PowerFactorAuditRecord;
  /** Authoritative business variance status (Requirement 22) */
  variance_status: VarianceStatus;
  /** Recorded tolerance snapshot used for this comparison (Requirement 23) */
  recorded_tolerance: RecordedTolerance;
}

export interface ReactivePenaltyResult {
  status: ReactivePenaltyStatus;
  rule_id?: string;
  pf_threshold_applied?: Decimal;
  penalty_rate_zar_per_kvarh?: Decimal;
  excess_kvarh?: Decimal;
  calculated_penalty_zar?: Decimal;
  explanation: string;
}

export interface ReactiveEnergyReconciliationResult {
  kvarh_comparison: ReactiveEnergyComparison;
  power_factor_comparison: PowerFactorComparison;
  reactive_penalty: ReactivePenaltyResult;
  has_significant_discrepancy: boolean;
  flagged_reasons: string[];
  /** Authoritative overall variance status (Requirement 22) */
  overall_variance_status: VarianceStatus;
  /** Recorded tolerance snapshots used for every component (Requirement 23) */
  recorded_tolerances: RecordedTolerance[];
  audit_timestamp: string;
}

export class ReactiveEnergyReconciliationEngine {
  public static readonly DEFAULT_KVARH_ABS_THRESHOLD = new Decimal("50.00"); // 50 kVArh
  public static readonly DEFAULT_KVARH_PCT_THRESHOLD = new Decimal("0.01"); // 1.0%
  public static readonly DEFAULT_PF_DIFF_THRESHOLD = new Decimal("0.02"); // 0.02 PF points

  /**
   * Safe parser for Decimal inputs
   */
  private static parseDecimal(val: number | Decimal | string | null | undefined): Decimal | null {
    if (val === undefined || val === null || val === "") return null;
    try {
      return val instanceof Decimal ? val : new Decimal(String(val));
    } catch {
      return null;
    }
  }

  /**
   * Reconcile reactive energy and power factor with strict tariff penalty gating.
   *
   * Requirement 18:
   *   - Where available: compare Invoice kVArh vs AMR kVArh
   *   - and: Invoice power factor vs AMR-derived power factor
   *   - Flag significant differences
   *   - Do not calculate reactive penalties in this branch unless the applicable tariff rule is supplied by the Tariff Engine.
   */
  public static reconcileReactiveEnergy(
    input: ReactiveEnergyReconciliationInput,
  ): ReactiveEnergyReconciliationResult {
    const flaggedReasons: string[] = [];

    // Thresholds
    const kvarhAbsThreshold =
      input.significance_thresholds?.kvarh_absolute_threshold !== undefined
        ? new Decimal(String(input.significance_thresholds.kvarh_absolute_threshold))
        : this.DEFAULT_KVARH_ABS_THRESHOLD;

    const kvarhPctThreshold =
      input.significance_thresholds?.kvarh_percentage_threshold !== undefined
        ? new Decimal(String(input.significance_thresholds.kvarh_percentage_threshold))
        : this.DEFAULT_KVARH_PCT_THRESHOLD;

    const pfDiffThreshold =
      input.significance_thresholds?.pf_difference_threshold !== undefined
        ? new Decimal(String(input.significance_thresholds.pf_difference_threshold))
        : this.DEFAULT_PF_DIFF_THRESHOLD;

    // -------------------------------------------------------------------------
    // 1. RESOLVE AMR REACTIVE & POWER FACTOR VALUES
    // -------------------------------------------------------------------------
    let amrKvarh = this.parseDecimal(input.amr_kvarh);
    let amrKwh = this.parseDecimal(input.amr_kwh);
    let amrKvah = this.parseDecimal(input.amr_kvah);
    let amrPf = this.parseDecimal(input.amr_power_factor);
    let amrDirection: PowerFactorDirection = input.amr_pf_direction ?? "unknown";
    let amrPfAudit: PowerFactorAuditRecord | undefined;

    // If intervals are provided, aggregate using PowerFactorEngine
    if (input.intervals && input.intervals.length > 0) {
      try {
        const pfSummary = PowerFactorEngine.calculateBillingPeriodPowerFactor(input.intervals);
        amrPf = pfSummary.billing_period_pf;
        amrKvarh = pfSummary.total_kvarh;
        amrKwh = pfSummary.total_kwh;
        amrKvah = pfSummary.total_kvah;
        amrDirection = pfSummary.lag_lead_direction;
        amrPfAudit = pfSummary.audit_record;
      } catch {
        // Continue with any directly supplied values
      }
    } else if (amrPf === null && amrKwh !== null && (amrKvah !== null || amrKvarh !== null)) {
      // Derive AMR power factor from available energy registers
      try {
        amrPfAudit = PowerFactorEngine.calculatePowerFactor({
          kWh: amrKwh,
          kVAh: amrKvah,
          kVArh: amrKvarh,
        });
        amrPf = amrPfAudit.calculated_pf;
        amrDirection = amrPfAudit.lag_lead_direction;
      } catch {
        // PF remains null if registers insufficient
      }
    }

    // -------------------------------------------------------------------------
    // 2. COMPARE INVOICE KVARH VS AMR KVARH
    // -------------------------------------------------------------------------
    const invKvarh = this.parseDecimal(input.invoice_kvarh);
    let kvarhComp: ReactiveEnergyComparison;

    if (invKvarh !== null && amrKvarh !== null) {
      const dimEval = CentralToleranceRegistry.evaluateDimension(
        "reactive_energy",
        invKvarh,
        amrKvarh,
        {
          customAbsolute: input.significance_thresholds?.kvarh_absolute_threshold,
          customPercentage: input.significance_thresholds?.kvarh_percentage_threshold,
          customUnit: "kVArh",
        },
      );

      const variance = dimEval.variance;
      const absVar = variance.absolute_variance;
      const pctVar = variance.variance_percentage; // null when AMR kVArh = 0 (Req 21)

      let dir: "OVERBILLED" | "UNDERBILLED" | "EXACT_MATCH" = "EXACT_MATCH";
      if (absVar.greaterThan(0)) dir = "OVERBILLED";
      else if (absVar.lessThan(0)) dir = "UNDERBILLED";

      const isSignificant = !dimEval.is_within_tolerance && !variance.absolute_variance.isZero();

      if (isSignificant) {
        flaggedReasons.push(
          `Significant reactive energy variance: Invoice (${invKvarh.toString()} kVArh) vs ` +
            `AMR (${amrKvarh.toString()} kVArh), difference of ${absVar.toString()} kVArh ` +
            `(${pctVar !== null ? pctVar.toDecimalPlaces(2).toString() + "%" : "percentage undefined: AMR kVArh is 0"}). ` +
            `Status: ${dimEval.status}.`,
        );
      }

      kvarhComp = {
        invoice_kvarh: invKvarh,
        amr_kvarh: amrKvarh,
        absolute_variance: absVar,
        percentage_variance: pctVar,
        percentage_variance_status: variance.percentage_status,
        is_significant_difference: isSignificant,
        variance_direction: dir,
        kvarh_data_available: true,
        variance_status: dimEval.status,
        recorded_tolerance: dimEval.recorded_tolerance,
      };
    } else {
      const recordedTolerance = CentralToleranceRegistry.recordTolerance("reactive_energy", {
        customUnit: "kVArh",
      });
      kvarhComp = {
        invoice_kvarh: invKvarh ?? undefined,
        amr_kvarh: amrKvarh ?? undefined,
        is_significant_difference: false,
        kvarh_data_available: false,
        variance_status: "INSUFFICIENT_DATA",
        recorded_tolerance: recordedTolerance,
      };
    }

    // -------------------------------------------------------------------------
    // 3. COMPARE INVOICE POWER FACTOR VS AMR-DERIVED POWER FACTOR
    // -------------------------------------------------------------------------
    const invPf = this.parseDecimal(input.invoice_power_factor);
    const invDirection: PowerFactorDirection = input.invoice_pf_direction ?? "unknown";

    let pfComp: PowerFactorComparison;
    if (invPf !== null && amrPf !== null) {
      const pfDiff = invPf.minus(amrPf);

      // Check quadrant/direction mismatch (e.g. capacitive vs inductive)
      let directionMismatch = false;
      if (
        invDirection !== "unknown" &&
        amrDirection !== "unknown" &&
        invDirection !== amrDirection &&
        invDirection !== "unity" &&
        amrDirection !== "unity"
      ) {
        directionMismatch = true;
        flaggedReasons.push(
          `Power factor direction mismatch: Invoice states ${invDirection.toUpperCase()}, ` +
            `but AMR telemetry registers ${amrDirection.toUpperCase()}.`,
        );
      }

      const dimEval = CentralToleranceRegistry.evaluateDimension("reactive_energy", invPf, amrPf, {
        customAbsolute: pfDiffThreshold,
        customUnit: "PF",
        unresolvedReason: directionMismatch
          ? `Power factor direction mismatch: Invoice states ${invDirection.toUpperCase()}, but AMR telemetry registers ${amrDirection.toUpperCase()}.`
          : undefined,
      });

      const isSignificantPf = !dimEval.is_within_tolerance && !pfDiff.isZero();

      if (isSignificantPf) {
        flaggedReasons.push(
          `Significant power factor difference: Invoice PF (${invPf.toString()}) vs ` +
            `AMR-derived PF (${amrPf.toString()}), variance of ${pfDiff.toString()} exceeds threshold of ${pfDiffThreshold.toString()}. ` +
            `Status: ${dimEval.status}.`,
        );
      }

      pfComp = {
        invoice_pf: invPf,
        amr_pf: amrPf,
        pf_difference: pfDiff,
        is_significant_difference: isSignificantPf,
        invoice_direction: invDirection,
        amr_direction: amrDirection,
        has_direction_mismatch: directionMismatch,
        pf_data_available: true,
        amr_pf_audit: amrPfAudit,
        variance_status: dimEval.status,
        recorded_tolerance: dimEval.recorded_tolerance,
      };
    } else {
      const recordedTolerance = CentralToleranceRegistry.recordTolerance("reactive_energy", {
        customUnit: "PF",
      });
      pfComp = {
        invoice_pf: invPf ?? undefined,
        amr_pf: amrPf ?? undefined,
        is_significant_difference: false,
        has_direction_mismatch: false,
        pf_data_available: false,
        amr_pf_audit: amrPfAudit,
        variance_status: "INSUFFICIENT_DATA",
        recorded_tolerance: recordedTolerance,
      };
    }

    // -------------------------------------------------------------------------
    // 4. REACTIVE PENALTIES (STRICT GATING BY TARIFF ENGINE RULE)
    // "Do not calculate reactive penalties in this branch unless the applicable
    // tariff rule is supplied by the Tariff Engine."
    // -------------------------------------------------------------------------
    let penaltyResult: ReactivePenaltyResult;

    if (!input.tariff_reactive_rule) {
      // RULE: Do not calculate reactive penalties without tariff engine rule!
      penaltyResult = {
        status: "SKIPPED_NO_TARIFF_RULE",
        explanation:
          "Reactive energy penalty calculation skipped: No applicable reactive tariff rule " +
          "was supplied by the Tariff Engine. In accordance with Requirement 18, reactive penalties " +
          "must be governed strictly by authoritative tariff rules and cannot be synthesized arbitrarily.",
      };
    } else {
      // Tariff Engine supplied the rule!
      const rule = input.tariff_reactive_rule;
      const pfThreshold = new Decimal(String(rule.pf_threshold));
      const penaltyRate = new Decimal(String(rule.reactive_penalty_rate_zar_per_kvarh));

      // Active kWh and Reactive kVArh required for penalty derivation
      const activeKwh = amrKwh ?? new Decimal(0);
      const reactiveKvarh = amrKvarh ?? invKvarh ?? new Decimal(0);

      // Check if PF is below threshold
      const effectivePf = amrPf ?? invPf;
      const isPfCompliant = effectivePf !== null && effectivePf.greaterThanOrEqualTo(pfThreshold);

      if (isPfCompliant) {
        penaltyResult = {
          status: "NOT_APPLICABLE_PF_COMPLIANT",
          rule_id: rule.rule_id,
          pf_threshold_applied: pfThreshold,
          penalty_rate_zar_per_kvarh: penaltyRate,
          excess_kvarh: new Decimal(0),
          calculated_penalty_zar: new Decimal(0),
          explanation:
            `Power factor (${effectivePf.toString()}) meets or exceeds the tariff threshold of ` +
            `${pfThreshold.toString()} under ${rule.tariff_code}. No reactive penalty applicable.`,
        };
      } else {
        // Calculate excess kVArh per standard tariff formula
        // Standard NERSA allowance factor: tan(acos(0.95)) = 0.328684 (approx 33% of active kWh)
        const allowanceFactor =
          rule.allowance_tan_phi !== undefined
            ? new Decimal(String(rule.allowance_tan_phi))
            : new Decimal("0.328684");

        const allowedKvarh = activeKwh
          .times(allowanceFactor)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const rawExcess = reactiveKvarh.minus(allowedKvarh);
        const excessKvarh = rawExcess.greaterThan(0) ? rawExcess : new Decimal(0);
        const penaltyZar = excessKvarh.times(penaltyRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        penaltyResult = {
          status: "CALCULATED_FROM_TARIFF_RULE",
          rule_id: rule.rule_id,
          pf_threshold_applied: pfThreshold,
          penalty_rate_zar_per_kvarh: penaltyRate,
          excess_kvarh: excessKvarh,
          calculated_penalty_zar: penaltyZar,
          explanation:
            `Power factor (${effectivePf ? effectivePf.toString() : "unknown"}) is below threshold (${pfThreshold.toString()}). ` +
            `Excess reactive energy of ${excessKvarh.toString()} kVArh billed at ${penaltyRate.toString()} R/kVArh ` +
            `per tariff rule ${rule.rule_id}. Calculated penalty: R ${penaltyZar.toString()}.`,
        };
      }
    }

    const hasSignificant =
      kvarhComp.is_significant_difference ||
      pfComp.is_significant_difference ||
      pfComp.has_direction_mismatch;

    // Overall status across reactive components (Requirement 22)
    let overallStatus: VarianceStatus = "MATCH";
    const componentStatuses = [kvarhComp.variance_status, pfComp.variance_status];
    if (componentStatuses.includes("OUTSIDE_TOLERANCE")) {
      overallStatus = "OUTSIDE_TOLERANCE";
    } else if (componentStatuses.includes("UNRESOLVED")) {
      overallStatus = "UNRESOLVED";
    } else if (componentStatuses.includes("WITHIN_TOLERANCE")) {
      overallStatus = "WITHIN_TOLERANCE";
    } else if (componentStatuses.every((s) => s === "INSUFFICIENT_DATA")) {
      overallStatus = "INSUFFICIENT_DATA";
    }

    const recordedTolerances: RecordedTolerance[] = [
      kvarhComp.recorded_tolerance,
      pfComp.recorded_tolerance,
    ];

    return {
      kvarh_comparison: kvarhComp,
      power_factor_comparison: pfComp,
      reactive_penalty: penaltyResult,
      has_significant_discrepancy: hasSignificant,
      flagged_reasons: flaggedReasons,
      overall_variance_status: overallStatus,
      recorded_tolerances: recordedTolerances,
      audit_timestamp: new Date().toISOString(),
    };
  }
}
