/**
 * ENERA PRODUCTION OCR ENGINE — RETRY & IDEMPOTENCY ENGINE (Requirement 23)
 * =========================================================================
 * Safe, idempotent retry execution for OCR processing runs and chunk tasks:
 *
 *   FAILED
 *     ↓
 *   RETRY 1
 *     ↓
 *   RETRY 2
 *     ↓
 *   REVIEW_REQUIRED
 *
 * Mandatory invariants:
 * 1. Do NOT create duplicate records during retries.
 * 2. Processing must be idempotent (reuse same run ID / idempotency key, upserting in-place).
 * 3. Never fail silently or loop infinitely; transition to REVIEW_REQUIRED when retries are exhausted.
 */

import type {
  OcrProcessingRun,
  OcrPageProcessingRun,
  OcrProcessingRunStatus,
  OcrRetryAttempt,
  OcrRetryPolicy,
  OcrPageChunk,
} from "./types";
import { OcrProcessingRunEngine } from "./ocrProcessingRunEngine";

export interface RetryExecutionOptions {
  runId?: string;
  documentId?: string;
  idempotencyKey?: string;
  policy?: Partial<OcrRetryPolicy>;
  onRetry?: (attempt: number, error: Error, nextStatus: OcrProcessingRunStatus) => void;
  strategyName?: string;
}

export class OcrRetryEngine {
  public static readonly DEFAULT_RETRY_POLICY: OcrRetryPolicy = {
    maxRetries: 2, // 2 retries = 3 total attempts (Initial, Retry 1, Retry 2) -> REVIEW_REQUIRED
    initialBackoffMs: 200,
    maxBackoffMs: 5000,
    backoffMultiplier: 2,
    jitter: true,
    retryableErrorCodes: [
      "OCR_WORKER_TIMEOUT",
      "OCR_WORKER_CRASHED",
      "TRANSIENT_RASTER_ERROR",
      "OUT_OF_MEMORY_WORKER",
      "PROVIDER_RATE_LIMIT",
      "NETWORK_TIMEOUT",
      "PAGE_OCR_ERROR",
      "OCR_EXECUTION_FAILURE",
      "RESOURCE_EXHAUSTED",
    ],
  };

  /**
   * Evaluates the next status after a processing attempt failure:
   * Attempt 1 fails -> RETRY_1
   * Attempt 2 fails -> RETRY_2
   * Attempt >= maxRetries fails -> REVIEW_REQUIRED
   */
  public static getNextStatusOnFailure(
    attemptIndex: number,
    maxRetries: number = 2,
  ): OcrProcessingRunStatus {
    if (attemptIndex === 1) {
      return "RETRY_1";
    }
    if (attemptIndex === 2) {
      return "RETRY_2";
    }
    return "REVIEW_REQUIRED";
  }

  /**
   * Classifies whether an error is safely retryable.
   */
  public static isRetryable(
    error: any,
    policy: OcrRetryPolicy = this.DEFAULT_RETRY_POLICY,
  ): boolean {
    if (!error) return false;
    const msg = String(error.message || error).toLowerCase();
    const code = String(error.code || "").toUpperCase();

    // Check custom retryable error codes
    if (policy.retryableErrorCodes && policy.retryableErrorCodes.includes(code)) {
      return true;
    }

    // Common transient patterns in browser/worker/node OCR
    const transientKeywords = [
      "timeout",
      "worker",
      "terminated",
      "busy",
      "rate limit",
      "network",
      "fetch failed",
      "econnreset",
      "etimedout",
      "deadlock",
      "temporary",
      "memory",
      "crashed",
    ];

    return transientKeywords.some((kw) => msg.includes(kw));
  }

  /**
   * Computes the exponential backoff delay with optional jitter in milliseconds.
   */
  public static computeBackoffDelay(
    attemptIndex: number,
    policy: OcrRetryPolicy = this.DEFAULT_RETRY_POLICY,
  ): number {
    const exponent = Math.max(0, attemptIndex - 1);
    const baseDelay = policy.initialBackoffMs * Math.pow(policy.backoffMultiplier, exponent);
    const cappedDelay = Math.min(baseDelay, policy.maxBackoffMs);

    if (policy.jitter) {
      const jitterFactor = 0.5 + Math.random() * 0.5; // 50% - 100%
      return Math.round(cappedDelay * jitterFactor);
    }

    return cappedDelay;
  }

  /**
   * Records a retry attempt on a processing run idempotently.
   */
  public static recordRetryOnRun(
    run: OcrProcessingRun,
    attemptIndex: number,
    status: OcrProcessingRunStatus,
    error: any,
    durationMs: number = 0,
    strategyApplied?: string,
  ): OcrProcessingRun {
    const errorObj =
      error instanceof Error
        ? { code: (error as any).code || "OCR_RETRYABLE_ERROR", message: error.message, stack: error.stack }
        : typeof error === "object" && error !== null
          ? error
          : { code: "OCR_RETRYABLE_ERROR", message: String(error) };

    const attemptRecord: OcrRetryAttempt = {
      attempt: attemptIndex,
      status,
      timestamp: new Date().toISOString(),
      error: errorObj,
      durationMs,
      strategyApplied,
    };

    run.retryAttempt = attemptIndex;
    run.status = status;
    run.error = errorObj;
    run.updatedAt = attemptRecord.timestamp;

    if (!run.retryHistory) {
      run.retryHistory = [];
    }

    // Idempotent record: replace existing attempt with same index or push
    const existingIndex = run.retryHistory.findIndex((a) => a.attempt === attemptIndex);
    if (existingIndex >= 0) {
      run.retryHistory[existingIndex] = attemptRecord;
    } else {
      run.retryHistory.push(attemptRecord);
    }

    OcrProcessingRunEngine.recordRun(run);
    return run;
  }

  /**
   * Records a retry attempt on a page chunk idempotently.
   */
  public static recordRetryOnChunk(
    chunk: OcrPageChunk,
    attemptIndex: number,
    status: OcrProcessingRunStatus,
    error: any,
    durationMs: number = 0,
    strategyApplied?: string,
  ): OcrPageChunk {
    const errorObj =
      error instanceof Error
        ? { code: (error as any).code || "CHUNK_RETRYABLE_ERROR", message: error.message, stack: error.stack }
        : typeof error === "object" && error !== null
          ? error
          : { code: "CHUNK_RETRYABLE_ERROR", message: String(error) };

    const attemptRecord: OcrRetryAttempt = {
      attempt: attemptIndex,
      status,
      timestamp: new Date().toISOString(),
      error: errorObj,
      durationMs,
      strategyApplied,
    };

    chunk.retryAttempt = attemptIndex;
    chunk.status = status as any;
    chunk.error = errorObj;

    if (!chunk.retryHistory) {
      chunk.retryHistory = [];
    }

    const existingIndex = chunk.retryHistory.findIndex((a) => a.attempt === attemptIndex);
    if (existingIndex >= 0) {
      chunk.retryHistory[existingIndex] = attemptRecord;
    } else {
      chunk.retryHistory.push(attemptRecord);
    }

    return chunk;
  }

  /**
   * Executes an asynchronous task with safe retries, adhering strictly to:
   * FAILED -> RETRY 1 -> RETRY 2 -> REVIEW_REQUIRED
   *
   * Idempotently reuses existing run records.
   */
  public static async executeWithRetry<T>(
    taskFn: (attempt: number, retryStatus?: OcrProcessingRunStatus) => Promise<T>,
    options: RetryExecutionOptions = {},
  ): Promise<{ result?: T; success: boolean; finalStatus: OcrProcessingRunStatus; attempts: number; error?: any }> {
    const policy: OcrRetryPolicy = {
      ...this.DEFAULT_RETRY_POLICY,
      ...(options.policy || {}),
    };
    const maxRetries = policy.maxRetries;
    const totalMaxAttempts = maxRetries + 1; // e.g. initial attempt + 2 retries = 3 attempts

    let lastError: any = null;
    let currentStatus: OcrProcessingRunStatus = "RUNNING";

    for (let attempt = 0; attempt < totalMaxAttempts; attempt++) {
      const attemptNumber = attempt; // 0 = initial, 1 = retry 1, 2 = retry 2
      const startTime = Date.now();

      try {
        const result = await taskFn(attemptNumber, currentStatus);

        // Success: if there was an associated run, mark completed
        if (options.runId) {
          const run = OcrProcessingRunEngine.getRun(options.runId);
          if (run) {
            run.status = "COMPLETED";
            run.error = null;
            OcrProcessingRunEngine.recordRun(run);
          }
        }

        return {
          result,
          success: true,
          finalStatus: "COMPLETED",
          attempts: attempt + 1,
        };
      } catch (err) {
        lastError = err;
        const duration = Date.now() - startTime;
        const nextAttemptIndex = attempt + 1;
        const isLastAttempt = nextAttemptIndex >= totalMaxAttempts;

        // Transition: Attempt 0 fail -> RETRY_1, Attempt 1 fail -> RETRY_2, Attempt 2 fail -> REVIEW_REQUIRED
        currentStatus = this.getNextStatusOnFailure(nextAttemptIndex, maxRetries);

        // Update run state idempotently
        if (options.runId) {
          const run = OcrProcessingRunEngine.getRun(options.runId);
          if (run) {
            this.recordRetryOnRun(
              run,
              nextAttemptIndex,
              currentStatus,
              err,
              duration,
              options.strategyName,
            );
          }
        }

        if (options.onRetry) {
          options.onRetry(nextAttemptIndex, err instanceof Error ? err : new Error(String(err)), currentStatus);
        }

        if (isLastAttempt) {
          // All retries exhausted -> REVIEW_REQUIRED
          return {
            success: false,
            finalStatus: "REVIEW_REQUIRED",
            attempts: totalMaxAttempts,
            error: lastError,
          };
        }

        // Wait with backoff before next retry
        const delayMs = this.computeBackoffDelay(nextAttemptIndex, policy);
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    return {
      success: false,
      finalStatus: "REVIEW_REQUIRED",
      attempts: totalMaxAttempts,
      error: lastError,
    };
  }
}
