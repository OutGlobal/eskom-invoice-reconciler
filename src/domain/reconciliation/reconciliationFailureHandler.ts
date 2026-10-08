/**
 * ENERA RECONCILIATION FAILURE HANDLING SUBSYSTEM (REQUIREMENT 39)
 * ===============================================================
 *
 * Implements strict failure handling invariants:
 * 1. If reconciliation fails, 'FAILED' must be stored.
 * 2. Capture:
 *    - error code
 *    - stage
 *    - message
 *    - run ID
 *    - timestamp
 * 3. Do not silently return zero.
 * 4. A calculation failure must NEVER appear as: Variance = R0
 */

export type ReconciliationFailureStage =
  | "INVOICE_VALIDATION"
  | "AMR_MATCHING"
  | "AMR_INGESTION"
  | "TARIFF_RESOLUTION"
  | "DETERMINANT_DERIVATION"
  | "CHARGE_CALCULATION"
  | "VARIANCE_EVALUATION"
  | "PERSISTENCE";

export type ReconciliationFailureCode =
  | "ERR_MISSING_TARIFF"
  | "ERR_TARIFF_VERSION_MISMATCH"
  | "ERR_INCOMPLETE_AMR_COVERAGE"
  | "ERR_AMBIGUOUS_AMR_MATCH"
  | "ERR_INVALID_INVOICE_DETERMINANTS"
  | "ERR_ZERO_DIVISION_RISK"
  | "ERR_TEMPORAL_WINDOW_MISMATCH"
  | "ERR_CALCULATION_ENGINE_CRASH"
  | "ERR_STORAGE_PERSISTENCE_FAILED"
  | "ERR_UNAUTHORIZED_ORGANISATION_ACCESS";

export interface ReconciliationFailureRecord {
  run_id: string;
  reconciliation_id: string;
  status: "FAILED";
  error_code: ReconciliationFailureCode | string;
  stage: ReconciliationFailureStage;
  message: string;
  timestamp: string;
  organisation_id: string;
  invoice_id?: string;
  meter_id?: string;
  billing_period_start?: string;
  billing_period_end?: string;
  stack?: string;

  /**
   * INVARIANT (Requirement 39):
   * A calculation failure must NEVER appear as Variance = R0 or calculated_total = 0.
   * These fields MUST be null/undefined, never numeric 0.
   */
  variance_total_zar: null;
  calculated_total_zar: null;
  billed_total_zar?: number | null;
  variance_percentage: null;
  is_calculation_failure: true;
}

export class ReconciliationFailureHandler {
  /**
   * Constructs an authoritative failure record meeting all Requirement 39 criteria
   */
  public static createFailureRecord(params: {
    runId: string;
    organisationId: string;
    stage: ReconciliationFailureStage;
    errorCode: ReconciliationFailureCode | string;
    message: string;
    invoiceId?: string;
    meterId?: string;
    billingPeriodStart?: string;
    billingPeriodEnd?: string;
    billedTotalZar?: number | null;
    error?: unknown;
  }): ReconciliationFailureRecord {
    const timestamp = new Date().toISOString();
    const stack =
      params.error instanceof Error
        ? params.error.stack
        : typeof params.error === "string"
          ? params.error
          : undefined;

    return {
      run_id: params.runId,
      reconciliation_id: params.runId,
      status: "FAILED",
      error_code: params.errorCode,
      stage: params.stage,
      message: params.message,
      timestamp,
      organisation_id: params.organisationId,
      invoice_id: params.invoiceId,
      meter_id: params.meterId,
      billing_period_start: params.billingPeriodStart,
      billing_period_end: params.billingPeriodEnd,
      billed_total_zar: params.billedTotalZar ?? null,
      stack,

      // Absolute invariant: NEVER silently return zero or claim Variance = R0
      variance_total_zar: null,
      calculated_total_zar: null,
      variance_percentage: null,
      is_calculation_failure: true,
    };
  }

  /**
   * Formats display representation of variance for UI and export reports.
   * Enforces that a failure NEVER renders as 'R0.00' or '0%'.
   */
  public static formatVarianceDisplay(
    status: string,
    varianceZar: number | null | undefined
  ): { text: string; isError: boolean; isValidNumber: boolean } {
    if (status === "FAILED") {
      return {
        text: "CALCULATION FAILED (No Variance Computed)",
        isError: true,
        isValidNumber: false,
      };
    }

    if (varianceZar === null || varianceZar === undefined || isNaN(varianceZar)) {
      return {
        text: "UNAVAILABLE",
        isError: true,
        isValidNumber: false,
      };
    }

    return {
      text: `R ${varianceZar.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      isError: false,
      isValidNumber: true,
    };
  }

  /**
   * Asserts that a calculation failure does not mask itself as zero variance
   */
  public static assertFailureInvariants(failure: ReconciliationFailureRecord): void {
    if (failure.status !== "FAILED") {
      throw new Error(`Invalid failure status: expected 'FAILED', received '${failure.status}'`);
    }

    if (!failure.error_code) {
      throw new Error("Requirement 39 Invariant Violated: Failure record must capture 'error_code'");
    }

    if (!failure.stage) {
      throw new Error("Requirement 39 Invariant Violated: Failure record must capture 'stage'");
    }

    if (!failure.message) {
      throw new Error("Requirement 39 Invariant Violated: Failure record must capture 'message'");
    }

    if (!failure.run_id) {
      throw new Error("Requirement 39 Invariant Violated: Failure record must capture 'run_id'");
    }

    if (!failure.timestamp) {
      throw new Error("Requirement 39 Invariant Violated: Failure record must capture 'timestamp'");
    }

    if (failure.variance_total_zar !== null) {
      throw new Error(
        "Requirement 39 Invariant Violated: A calculation failure must NEVER set variance_total_zar = 0 or a number. It must be null."
      );
    }

    if (failure.calculated_total_zar !== null) {
      throw new Error(
        "Requirement 39 Invariant Violated: A calculation failure must NEVER set calculated_total_zar = 0. It must be null."
      );
    }
  }
}
