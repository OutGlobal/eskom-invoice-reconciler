/**
 * ENERA AI VALIDATION — VALIDATION RUN STORE (REQUIREMENT 26)
 * ============================================================
 * Persists immutable validation run records with full auditability:
 *
 * Store:
 *   - validation run ID
 *   - document ID
 *   - OCR run ID
 *   - model/provider
 *   - prompt version
 *   - validation version
 *   - start time
 *   - end time
 *   - status
 *   - findings
 *   - confidence
 *   - errors
 *
 * CORE INVARIANTS:
 * 1. Historical runs are NEVER overwritten. Every execution appends an immutable record.
 * 2. Runs are queryable by document ID, OCR run ID, status, model, and date ranges.
 * 3. Full execution snapshot is retained for reproducible auditing.
 */

import type {
  CompleteValidationResult,
  PersistentValidationRun,
  ValidationRunQueryOptions,
} from "./types";

export class ValidationRunStore {
  private static readonly runs = new Map<string, PersistentValidationRun>();
  private static readonly documentIndex = new Map<string, string[]>(); // documentId -> validationRunId[]
  private static readonly ocrRunIndex = new Map<string, string[]>(); // ocrRunId -> validationRunId[]

  public static readonly DEFAULT_MODEL_PROVIDER = "google-gemini-pro";
  public static readonly DEFAULT_PROMPT_VERSION = "v2.4.0-prompt-contract";

  /**
   * Persists a validation run to the immutable append-only store.
   */
  public static persistRun(params: {
    result: CompleteValidationResult;
    ocrRunId?: string;
    modelProvider?: string;
    promptVersion?: string;
    startTime: string;
    endTime: string;
    durationMs?: number;
  }): PersistentValidationRun {
    const {
      result,
      ocrRunId = result.processingRunId || "ocr-run-default",
      modelProvider = this.DEFAULT_MODEL_PROVIDER,
      promptVersion = this.DEFAULT_PROMPT_VERSION,
      startTime,
      endTime,
      durationMs = Math.max(0, new Date(endTime).getTime() - new Date(startTime).getTime()),
    } = params;

    const validationRunId = result.validationRunId;
    const documentId = result.documentId;
    const validationVersion = result.validationVersion || 1;

    // Aggregate findings across all validation layers
    const semanticCount = result.semanticValidation?.findings?.length || 0;
    const deterministicCount = result.deterministicValidation?.evaluations?.length || 0;
    const crossFieldCount = result.crossFieldValidation?.findings?.length || 0;
    const ocrErrorsCount = result.ocrErrorDetection?.findings?.length || 0;
    const duplicateConflictsCount = result.duplicateFieldDetection?.conflictList?.length || 0;
    const missingDataCount = result.missingDataAudit?.totalMissingCount || 0;

    const persistentRecord: PersistentValidationRun = {
      validationRunId,
      documentId,
      ocrRunId,
      modelProvider,
      promptVersion,
      validationVersion,
      startTime,
      endTime,
      durationMs,
      status: result.status,
      findings: {
        semanticCount,
        deterministicCount,
        crossFieldCount,
        ocrErrorsCount,
        duplicateConflictsCount,
        missingDataCount,
        totalFindings:
          semanticCount +
          deterministicCount +
          crossFieldCount +
          ocrErrorsCount +
          duplicateConflictsCount +
          missingDataCount,
      },
      confidence: result.overallConfidence,
      errors: result.exceptions || [],
      aiFailure: result.aiFailure,
      fullResultSnapshot: result,
      createdAt: new Date().toISOString(),
    };

    // Immutable append
    this.runs.set(validationRunId, persistentRecord);

    // Update document index
    const docRuns = this.documentIndex.get(documentId) || [];
    if (!docRuns.includes(validationRunId)) {
      docRuns.push(validationRunId);
      this.documentIndex.set(documentId, docRuns);
    }

    // Update OCR run index
    const ocrRuns = this.ocrRunIndex.get(ocrRunId) || [];
    if (!ocrRuns.includes(validationRunId)) {
      ocrRuns.push(validationRunId);
      this.ocrRunIndex.set(ocrRunId, ocrRuns);
    }

    return persistentRecord;
  }

  /**
   * Retrieves a validation run by its unique validation run ID.
   */
  public static getRun(validationRunId: string): PersistentValidationRun | undefined {
    return this.runs.get(validationRunId);
  }

  /**
   * Lists all historical validation runs for a specific document in chronological order.
   */
  public static listRunsForDocument(documentId: string): PersistentValidationRun[] {
    const runIds = this.documentIndex.get(documentId) || [];
    return runIds.map((id) => this.runs.get(id)!).filter(Boolean);
  }

  /**
   * Lists all validation runs associated with an OCR extraction run ID.
   */
  public static listRunsForOcrRun(ocrRunId: string): PersistentValidationRun[] {
    const runIds = this.ocrRunIndex.get(ocrRunId) || [];
    return runIds.map((id) => this.runs.get(id)!).filter(Boolean);
  }

  /**
   * Queries validation runs by filtering options.
   */
  public static queryRuns(options: ValidationRunQueryOptions = {}): PersistentValidationRun[] {
    let allRuns = Array.from(this.runs.values());

    if (options.documentId) {
      allRuns = allRuns.filter((r) => r.documentId === options.documentId);
    }
    if (options.ocrRunId) {
      allRuns = allRuns.filter((r) => r.ocrRunId === options.ocrRunId);
    }
    if (options.status) {
      allRuns = allRuns.filter((r) => r.status === options.status);
    }
    if (options.modelProvider) {
      allRuns = allRuns.filter((r) => r.modelProvider === options.modelProvider);
    }
    if (options.startDate) {
      allRuns = allRuns.filter((r) => r.startTime >= options.startDate!);
    }
    if (options.endDate) {
      allRuns = allRuns.filter((r) => r.startTime <= options.endDate!);
    }

    if (options.limit && options.limit > 0) {
      allRuns = allRuns.slice(0, options.limit);
    }

    return allRuns;
  }

  /**
   * Summarizes historical runs for a document.
   */
  public static getHistoricalRunsSummary(documentId: string): {
    totalRuns: number;
    latestRunId?: string;
    versions: number[];
    statuses: string[];
  } {
    const runs = this.listRunsForDocument(documentId);
    return {
      totalRuns: runs.length,
      latestRunId: runs.length > 0 ? runs[runs.length - 1].validationRunId : undefined,
      versions: runs.map((r) => r.validationVersion),
      statuses: runs.map((r) => r.status),
    };
  }

  /**
   * Clears the validation run store (for testing or reset purposes).
   */
  public static clearStore(): void {
    this.runs.clear();
    this.documentIndex.clear();
    this.ocrRunIndex.clear();
  }
}
