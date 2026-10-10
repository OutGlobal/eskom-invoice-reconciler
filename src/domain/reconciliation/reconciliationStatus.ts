/**
 * ENERA RECONCILIATION ENGINE: RECONCILIATION STATUS (REQUIREMENT 25)
 * ====================================================================
 * Authoritative lifecycle status model for utility billing and AMR interval reconciliation.
 *
 * Core Statuses:
 *   - PENDING
 *   - PROCESSING
 *   - COMPLETED
 *   - COMPLETED_WITH_EXCEPTIONS
 *   - REVIEW_REQUIRED
 *   - FAILED
 *
 * Fundamental Business Invariant (Requirement 25):
 *   "A completed reconciliation with incomplete AMR data must NOT be represented as a clean successful reconciliation."
 *
 * Status Transition Matrix:
 *   - No reconciliation can achieve 'COMPLETED' (clean) if:
 *     1. AMR interval data coverage is incomplete (< 100% or missing intervals).
 *     2. Any exceptions are open / unresolved.
 *     3. Any component variance breaches configured tolerance.
 *     4. Meter, account, or billing period mismatches exist.
 */

import Decimal from "decimal.js-light";
import type {
  ReconciliationException,
  ReconciliationExceptionCode,
  ExceptionSeverity,
} from "./reconciliationExceptions";
import type { VarianceStatus } from "./varianceStatus";

export type ReconciliationStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_EXCEPTIONS"
  | "REVIEW_REQUIRED"
  | "FAILED";

export interface ReconciliationStatusDefinition {
  status: ReconciliationStatus;
  label: string;
  business_meaning: string;
  is_terminal: boolean;
  is_clean_success: boolean;
  requires_human_attention: boolean;
  allows_automatic_payment_release: boolean;
}

export const RECONCILIATION_STATUS_REGISTRY: Readonly<
  Record<ReconciliationStatus, ReconciliationStatusDefinition>
> = {
  PENDING: {
    status: "PENDING",
    label: "Pending Ingestion",
    business_meaning:
      "Reconciliation has been registered and is waiting for invoice ingestion, AMR telemetry, or tariff resolution.",
    is_terminal: false,
    is_clean_success: false,
    requires_human_attention: false,
    allows_automatic_payment_release: false,
  },
  PROCESSING: {
    status: "PROCESSING",
    label: "In Progress",
    business_meaning:
      "Deterministic reconciliation pipeline is actively executing interval aggregation, TOU windowing, and charge calculations.",
    is_terminal: false,
    is_clean_success: false,
    requires_human_attention: false,
    allows_automatic_payment_release: false,
  },
  COMPLETED: {
    status: "COMPLETED",
    label: "Clean Match (Completed)",
    business_meaning:
      "Reconciliation completed with 100% complete AMR telemetry, zero exceptions, matching meter/account identifiers, and zero unallowed variances.",
    is_terminal: true,
    is_clean_success: true,
    requires_human_attention: false,
    allows_automatic_payment_release: true,
  },
  COMPLETED_WITH_EXCEPTIONS: {
    status: "COMPLETED_WITH_EXCEPTIONS",
    label: "Completed with Exceptions",
    business_meaning:
      "Calculations completed, but non-blocking exceptions, minor interval gaps, or non-material variances exist that do not warrant complete failure.",
    is_terminal: true,
    is_clean_success: false,
    requires_human_attention: true,
    allows_automatic_payment_release: false,
  },
  REVIEW_REQUIRED: {
    status: "REVIEW_REQUIRED",
    label: "Review Required",
    business_meaning:
      "High or critical severity discrepancies detected (e.g. meter mismatch, significant energy/demand variance, severe AMR gaps) requiring human energy auditor sign-off.",
    is_terminal: true,
    is_clean_success: false,
    requires_human_attention: true,
    allows_automatic_payment_release: false,
  },
  FAILED: {
    status: "FAILED",
    label: "Failed",
    business_meaning:
      "Reconciliation could not complete due to an unrecoverable failure, missing tariff schedule, or corrupted source files.",
    is_terminal: true,
    is_clean_success: false,
    requires_human_attention: true,
    allows_automatic_payment_release: false,
  },
};

export interface StatusDerivationContext {
  /** Execution lifecycle phase */
  lifecycle_phase?: "PENDING" | "PROCESSING" | "EXECUTION_COMPLETE" | "FAILED";
  /** Fatal execution error if pipeline halted */
  fatal_error?: string | Error | null;
  /** All exceptions identified during ingestion, coverage validation, and comparison */
  exceptions: ReconciliationException[];
  /** Explicit flag indicating whether AMR data is incomplete (Requirement 25) */
  has_incomplete_amr?: boolean;
  /** AMR data coverage percentage (e.g. 98.5 for 98.5%) */
  coverage_percentage?: Decimal | number | string | null;
  /** Whether meter identifiers matched between invoice and telemetry */
  has_meter_mismatch?: boolean;
  /** Whether account numbers matched between invoice and site register */
  has_account_mismatch?: boolean;
  /** Whether the billing period matched between invoice and telemetry window */
  has_billing_period_mismatch?: boolean;
  /** Whether authoritative tariff was available */
  has_tariff_unavailable?: boolean;
  /** Overall variance status from VarianceEngine / VarianceStatus */
  overall_variance_status?: VarianceStatus;
  /** Whether all evaluated components fell within tolerance */
  all_components_within_tolerance?: boolean;
}

export interface StatusDerivationResult {
  status: ReconciliationStatus;
  definition: ReconciliationStatusDefinition;
  reason: string;
  is_clean_success: boolean;
  has_amr_data_deficiency: boolean;
  unresolved_exception_count: number;
  critical_exception_count: number;
  high_exception_count: number;
}

export class ReconciliationStatusResolver {
  /**
   * Authoritatively derive the reconciliation status in strict compliance with Requirement 25:
   *
   * "A completed reconciliation with incomplete AMR data must NOT be represented as a clean successful reconciliation."
   */
  public static deriveStatus(context: StatusDerivationContext): StatusDerivationResult {
    // 1. Check early lifecycle phases
    if (context.lifecycle_phase === "PENDING") {
      return this.buildResult(
        "PENDING",
        "Reconciliation has not started yet; queued or pending inputs.",
      );
    }
    if (context.lifecycle_phase === "PROCESSING") {
      return this.buildResult("PROCESSING", "Reconciliation pipeline is actively processing.");
    }

    // 2. Check for fatal execution errors or unrecoverable conditions
    if (
      context.fatal_error ||
      context.lifecycle_phase === "FAILED" ||
      context.has_tariff_unavailable
    ) {
      const msg =
        typeof context.fatal_error === "object" && context.fatal_error !== null
          ? (context.fatal_error as Error).message
          : context.fatal_error ||
            "Reconciliation encountered an unrecoverable failure or missing tariff.";
      return this.buildResult("FAILED", `Reconciliation failed: ${msg}`);
    }

    // 3. Inspect exceptions
    const activeExceptions = context.exceptions.filter(
      (e) => e.status === "OPEN" || e.status === "ESCALATED" || e.status === "INVESTIGATING",
    );

    const criticalCount = activeExceptions.filter((e) => e.severity === "CRITICAL").length;
    const highCount = activeExceptions.filter((e) => e.severity === "HIGH").length;

    // 4. Incomplete AMR data check (Requirement 25)
    // Incomplete if explicitly flagged, or coverage < 100%, or INCOMPLETE/MISSING exceptions exist
    let coverageNum: number | null = null;
    if (context.coverage_percentage !== undefined && context.coverage_percentage !== null) {
      try {
        coverageNum =
          context.coverage_percentage instanceof Decimal
            ? context.coverage_percentage.toNumber()
            : Number(context.coverage_percentage);
      } catch {
        coverageNum = null;
      }
    }

    const hasIncompleteAmrException = activeExceptions.some(
      (e) => e.code === "INCOMPLETE_AMR_DATA" || e.code === "MISSING_AMR_DATA",
    );

    const isIncompleteAmr =
      Boolean(context.has_incomplete_amr) ||
      hasIncompleteAmrException ||
      (coverageNum !== null && coverageNum < 100);

    // 5. Evaluate critical blocker conditions that mandate REVIEW_REQUIRED
    const hasIdentifierMismatch =
      Boolean(context.has_meter_mismatch) ||
      Boolean(context.has_account_mismatch) ||
      activeExceptions.some((e) => e.code === "METER_MISMATCH" || e.code === "ACCOUNT_MISMATCH");

    const hasSevereVariance =
      context.overall_variance_status === "OUTSIDE_TOLERANCE" ||
      context.overall_variance_status === "UNRESOLVED" ||
      context.all_components_within_tolerance === false ||
      activeExceptions.some(
        (e) =>
          (e.code === "ENERGY_VARIANCE" ||
            e.code === "DEMAND_VARIANCE" ||
            e.code === "CHARGE_VARIANCE") &&
          (e.severity === "HIGH" || e.severity === "CRITICAL"),
      );

    if (criticalCount > 0 || hasIdentifierMismatch) {
      const blocker = hasIdentifierMismatch
        ? "Meter or account identifier mismatch detected between invoice and AMR asset register"
        : `${criticalCount} critical reconciliation exception(s) detected`;
      return this.buildResult(
        "REVIEW_REQUIRED",
        `Review required: ${blocker}. Human intervention required prior to settlement.`,
        { isIncompleteAmr, activeExceptions, criticalCount, highCount },
      );
    }

    if (hasSevereVariance || highCount > 0) {
      const reason = hasSevereVariance
        ? "Material variance outside permissible tolerance detected"
        : `${highCount} high-severity exception(s) detected`;
      return this.buildResult("REVIEW_REQUIRED", `Review required: ${reason}.`, {
        isIncompleteAmr,
        activeExceptions,
        criticalCount,
        highCount,
      });
    }

    // 6. ENFORCE REQUIREMENT 25 INVARIANT:
    // A completed reconciliation with incomplete AMR data must NOT be represented as a clean successful reconciliation!
    if (isIncompleteAmr) {
      const covDesc =
        coverageNum !== null ? ` (telemetry coverage: ${coverageNum.toFixed(2)}%)` : "";
      return this.buildResult(
        "COMPLETED_WITH_EXCEPTIONS",
        `Completed with exceptions: AMR interval telemetry is incomplete${covDesc}. Cannot be certified as a clean reconciliation.`,
        { isIncompleteAmr: true, activeExceptions, criticalCount, highCount },
      );
    }

    // 7. If any remaining non-critical/medium/low exceptions exist
    if (activeExceptions.length > 0) {
      const codes = [...new Set(activeExceptions.map((e) => e.code))].join(", ");
      return this.buildResult(
        "COMPLETED_WITH_EXCEPTIONS",
        `Completed with ${activeExceptions.length} non-blocking exception(s) (${codes}).`,
        { isIncompleteAmr: false, activeExceptions, criticalCount, highCount },
      );
    }

    // 8. If non-zero variance exists within tolerance, or clean exact match
    if (context.overall_variance_status === "WITHIN_TOLERANCE") {
      return this.buildResult(
        "COMPLETED",
        "Clean reconciliation: All variances are strictly within configured permissible tolerance boundaries and AMR telemetry is 100% complete.",
        { isIncompleteAmr: false, activeExceptions, criticalCount, highCount },
      );
    }

    // 9. Pristine exact match with 100% complete AMR telemetry
    return this.buildResult(
      "COMPLETED",
      "Clean reconciliation: Stated invoice determinants match 100% complete AMR interval telemetry and authoritative tariff rates exactly.",
      { isIncompleteAmr: false, activeExceptions, criticalCount, highCount },
    );
  }

  private static buildResult(
    status: ReconciliationStatus,
    reason: string,
    extra?: {
      isIncompleteAmr?: boolean;
      activeExceptions?: ReconciliationException[];
      criticalCount?: number;
      highCount?: number;
    },
  ): StatusDerivationResult {
    const def = RECONCILIATION_STATUS_REGISTRY[status];
    return {
      status,
      definition: def,
      reason,
      is_clean_success: def.is_clean_success,
      has_amr_data_deficiency: Boolean(extra?.isIncompleteAmr),
      unresolved_exception_count: extra?.activeExceptions?.length || 0,
      critical_exception_count: extra?.criticalCount || 0,
      high_exception_count: extra?.highCount || 0,
    };
  }
}
