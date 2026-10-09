/**
 * ENERA AI VALIDATION — IDEMPOTENCY MANAGER (STAGE 25)
 * ======================================================
 * Manages deterministic idempotency and lineage tracking across validation runs:
 *
 * Composite Idempotency Key:
 *   document_id + processing_run_id + validation_version
 *
 * CORE INVARIANTS:
 * 1. Retrying validation with identical composite key MUST return the existing validation record.
 * 2. Zero duplicate validation records are created on retry.
 * 3. Re-validations with an incremented version supersede previous versions cleanly with audit pointers.
 * 4. Concurrent duplicate requests for the same composite key are safely deduplicated in-flight.
 */

import type {
  CompleteValidationResult,
  ValidationIdempotencyRecord,
  IdempotencyValidationOptions,
} from "./types";

export class IdempotencyManager {
  private static readonly store = new Map<string, ValidationIdempotencyRecord>();
  private static readonly documentIndex = new Map<string, string[]>(); // documentId -> idempotencyKey[]
  private static readonly inFlightRequests = new Map<string, Promise<CompleteValidationResult>>();

  /**
   * Generates a canonical composite idempotency key.
   * Format: val_${document_id}_${processing_run_id}_v${validation_version}
   */
  public static generateIdempotencyKey(
    documentId: string,
    processingRunId?: string,
    validationVersion: number = 1,
  ): string {
    const cleanDoc = documentId.trim();
    const cleanRun = (processingRunId || "default-run").trim();
    const cleanVer = Math.max(1, Math.floor(validationVersion));
    return `val_${cleanDoc}_${cleanRun}_v${cleanVer}`;
  }

  /**
   * Simple deterministic hash of candidate payload to detect content mutations.
   */
  public static computePayloadHash(payload: unknown): string {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
    let hash = 5381;
    for (let i = 0; i < serialized.length; i++) {
      hash = ((hash << 5) + hash + serialized.charCodeAt(i)) | 0;
    }
    return `hash_${(hash >>> 0).toString(16)}`;
  }

  /**
   * Retrieves an existing idempotency record by key.
   */
  public static getRecord(idempotencyKey: string): ValidationIdempotencyRecord | undefined {
    return this.store.get(idempotencyKey);
  }

  /**
   * Saves a validation record in the idempotency store and manages document-level lineage.
   */
  public static saveRecord(params: {
    idempotencyKey: string;
    documentId: string;
    processingRunId: string;
    validationVersion: number;
    payloadHash: string;
    result: CompleteValidationResult;
  }): ValidationIdempotencyRecord {
    const { idempotencyKey, documentId, processingRunId, validationVersion, payloadHash, result } =
      params;
    const now = new Date().toISOString();

    // Check if this supersedes previous versions of the same document
    const docKeys = this.documentIndex.get(documentId) || [];
    let previousRunId: string | undefined = undefined;

    for (const prevKey of docKeys) {
      if (prevKey !== idempotencyKey) {
        const prevRecord = this.store.get(prevKey);
        if (prevRecord && prevRecord.isCurrent && prevRecord.validationVersion < validationVersion) {
          prevRecord.isCurrent = false;
          prevRecord.supersededBy = result.validationRunId;
          prevRecord.updatedAt = now;
          previousRunId = prevRecord.result.validationRunId;
        }
      }
    }

    const idempotencyRecord: ValidationIdempotencyRecord = {
      idempotencyKey,
      documentId,
      processingRunId,
      validationVersion,
      payloadHash,
      createdAt: now,
      updatedAt: now,
      result: {
        ...result,
        processingRunId,
        validationVersion,
        idempotencyKey,
        isIdempotentReplay: false,
      },
      isCurrent: true,
      previousRunId,
    };

    this.store.set(idempotencyKey, idempotencyRecord);

    if (!docKeys.includes(idempotencyKey)) {
      docKeys.push(idempotencyKey);
      this.documentIndex.set(documentId, docKeys);
    }

    return idempotencyRecord;
  }

  /**
   * Executes a validation operation idempotently.
   * If a matching completed record exists and forceRerun is false, returns the cached result without creating duplicates.
   * If an in-flight operation with the same key is active, re-uses the in-flight promise.
   */
  public static async executeIdempotently(
    options: IdempotencyValidationOptions,
    payload: unknown,
    executeFn: () => Promise<CompleteValidationResult>,
  ): Promise<CompleteValidationResult> {
    const {
      documentId,
      processingRunId = "default-run",
      validationVersion = 1,
      forceRerun = false,
    } = options;

    const idempotencyKey = this.generateIdempotencyKey(
      documentId,
      processingRunId,
      validationVersion,
    );
    const payloadHash = this.computePayloadHash(payload);

    // 1. Check for existing cached record (Idempotent Replay)
    if (!forceRerun) {
      const existing = this.store.get(idempotencyKey);
      if (existing) {
        // Return existing result with replay flag
        return {
          ...existing.result,
          isIdempotentReplay: true,
          idempotencyKey,
          processingRunId,
          validationVersion,
        };
      }
    }

    // 2. In-flight Deduplication (Thread-safe concurrency protection)
    if (this.inFlightRequests.has(idempotencyKey)) {
      const inFlightPromise = this.inFlightRequests.get(idempotencyKey)!;
      const result = await inFlightPromise;
      return {
        ...result,
        isIdempotentReplay: true,
        idempotencyKey,
        processingRunId,
        validationVersion,
      };
    }

    // 3. Fresh Execution
    const executionPromise = (async () => {
      try {
        const freshResult = await executeFn();
        const saved = this.saveRecord({
          idempotencyKey,
          documentId,
          processingRunId,
          validationVersion,
          payloadHash,
          result: freshResult,
        });
        return saved.result;
      } finally {
        this.inFlightRequests.delete(idempotencyKey);
      }
    })();

    this.inFlightRequests.set(idempotencyKey, executionPromise);
    return executionPromise;
  }

  /**
   * Retrieves all validation run records for a specific document.
   */
  public static listRecordsForDocument(documentId: string): ValidationIdempotencyRecord[] {
    const keys = this.documentIndex.get(documentId) || [];
    return keys.map((k) => this.store.get(k)!).filter(Boolean);
  }

  /**
   * Retrieves the current/active validation record for a document.
   */
  public static getLatestRecordForDocument(
    documentId: string,
  ): ValidationIdempotencyRecord | undefined {
    const records = this.listRecordsForDocument(documentId);
    return records.find((r) => r.isCurrent) || records[records.length - 1];
  }

  /**
   * Clears the entire idempotency store (useful for testing or cache invalidation).
   */
  public static clearRegistry(): void {
    this.store.clear( );
    this.documentIndex.clear();
    this.inFlightRequests.clear();
  }
}
