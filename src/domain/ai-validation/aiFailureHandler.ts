/**
 * ENERA AI VALIDATION — AI FAILURE HANDLER (STAGE 24)
 * ====================================================
 * Robust failure handling, classification, and non-destructive fallback for AI validation:
 *
 * Supported AI Failure Types (Requirement 24):
 *   - TIMEOUT
 *   - RATE_LIMIT
 *   - PROVIDER_ERROR
 *   - INVALID_RESPONSE
 *   - SCHEMA_ERROR
 *   - TOKEN_LIMIT
 *   - UNAVAILABLE
 *
 * CORE INVARIANTS:
 * 1. A failed AI call must NOT corrupt the document.
 * 2. Original OCR tokens, candidate data, bounding boxes, and document evidence remain pristine.
 * 3. Fallback to deterministic validation occurs seamlessly, allowing subsequent retry or manual review.
 */

import type {
  CandidateFieldValidationInput,
  AiSemanticValidationResult,
  AiFailureReason,
  AiFailureRecord,
  SemanticValidationFinding,
} from "./types";

export interface ErrorClassification {
  reason: AiFailureReason;
  isRetryable: boolean;
  retryAfterMs?: number;
  errorMessage: string;
}

export class AiFailureHandler {
  private static readonly DEFAULT_MAX_RETRIES = 3;

  /**
   * Classifies any runtime or network exception into standard AI failure categories.
   */
  public static classifyError(error: unknown): ErrorClassification {
    const rawMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error) || "Unknown AI invocation error";

    const lower = rawMessage.toLowerCase();

    // 1. TIMEOUT
    if (
      lower.includes("timeout") ||
      lower.includes("timed out") ||
      lower.includes("deadline exceeded") ||
      lower.includes("aborterror") ||
      lower.includes("etimedout")
    ) {
      return {
        reason: "TIMEOUT",
        isRetryable: true,
        retryAfterMs: 3000,
        errorMessage: `AI request timed out: ${rawMessage}`,
      };
    }

    // 2. RATE_LIMIT
    if (
      lower.includes("rate limit") ||
      lower.includes("429") ||
      lower.includes("too many requests") ||
      lower.includes("quota exceeded") ||
      lower.includes("resource exhausted")
    ) {
      return {
        reason: "RATE_LIMIT",
        isRetryable: true,
        retryAfterMs: 5000,
        errorMessage: `AI provider rate limit / quota exceeded: ${rawMessage}`,
      };
    }

    // 3. SCHEMA_ERROR
    if (
      lower.includes("schema") ||
      lower.includes("zod") ||
      lower.includes("validation error") ||
      lower.includes("missing required property") ||
      lower.includes("type mismatch")
    ) {
      return {
        reason: "SCHEMA_ERROR",
        isRetryable: false,
        errorMessage: `AI response failed structured schema validation: ${rawMessage}`,
      };
    }

    // 4. INVALID_RESPONSE
    if (
      lower.includes("unexpected token") ||
      lower.includes("json parse") ||
      lower.includes("invalid json") ||
      lower.includes("malformed") ||
      lower.includes("empty response")
    ) {
      return {
        reason: "INVALID_RESPONSE",
        isRetryable: true,
        retryAfterMs: 2000,
        errorMessage: `AI returned malformed or unparseable response: ${rawMessage}`,
      };
    }

    // 5. TOKEN_LIMIT
    if (
      lower.includes("token limit") ||
      lower.includes("max tokens") ||
      lower.includes("context length") ||
      lower.includes("maximum context") ||
      lower.includes("finish_reason length")
    ) {
      return {
        reason: "TOKEN_LIMIT",
        isRetryable: false,
        errorMessage: `AI model prompt/response exceeded maximum token limit: ${rawMessage}`,
      };
    }

    // 6. PROVIDER_ERROR
    if (
      lower.includes("provider error") ||
      lower.includes("500") ||
      lower.includes("502") ||
      lower.includes("internal server error") ||
      lower.includes("bad gateway") ||
      lower.includes("upstream error")
    ) {
      return {
        reason: "PROVIDER_ERROR",
        isRetryable: true,
        retryAfterMs: 4000,
        errorMessage: `AI upstream provider error: ${rawMessage}`,
      };
    }

    // 7. UNAVAILABLE
    if (
      lower.includes("unavailable") ||
      lower.includes("503") ||
      lower.includes("econnrefused") ||
      lower.includes("enotfound") ||
      lower.includes("dns") ||
      lower.includes("offline") ||
      lower.includes("network error")
    ) {
      return {
        reason: "UNAVAILABLE",
        isRetryable: true,
        retryAfterMs: 10000,
        errorMessage: `AI provider service unavailable or unreachable: ${rawMessage}`,
      };
    }

    // Default Fallback
    return {
      reason: "PROVIDER_ERROR",
      isRetryable: true,
      retryAfterMs: 4000,
      errorMessage: `AI invocation error: ${rawMessage}`,
    };
  }

  /**
   * Generates a complete, structured AI failure record with full evidence preservation metrics.
   */
  public static createAiFailureRecord(params: {
    documentId: string;
    processingRunId?: string;
    validationVersion?: number;
    error: unknown;
    candidateFields: CandidateFieldValidationInput[];
    fullDocumentText?: string;
    attemptCount?: number;
    maxRetries?: number;
  }): AiFailureRecord {
    const {
      documentId,
      processingRunId,
      validationVersion = 1,
      error,
      candidateFields,
      fullDocumentText = "",
      attemptCount = 1,
      maxRetries = this.DEFAULT_MAX_RETRIES,
    } = params;

    const classification = this.classifyError(error);
    const now = new Date().toISOString();

    const totalWordTokens = candidateFields.reduce(
      (sum, f) => sum + (f.wordTokens?.length || 0),
      0,
    );

    return {
      failureId: `fail-${documentId}-${classification.reason.toLowerCase()}-${Date.now()}`,
      documentId,
      processingRunId,
      validationVersion,
      reason: classification.reason,
      errorMessage: classification.errorMessage,
      rawErrorDetails: error instanceof Error ? { name: error.name, stack: error.stack } : error,
      timestamp: now,
      isRetryable: classification.isRetryable && attemptCount < maxRetries,
      retryAfterMs: classification.retryAfterMs,
      attemptCount,
      maxRetries,
      evidencePreserved: true,
      ocrEvidenceSummary: {
        totalTokensPreserved: totalWordTokens,
        totalCandidateFieldsPreserved: candidateFields.length,
        documentTextPreserved: fullDocumentText.length > 0,
      },
    };
  }

  /**
   * Builds a non-destructive fallback semantic validation result when AI call fails.
   * Ensures deterministic rules and downstream pipeline stages can continue without corruption.
   */
  public static createSafeFallbackSemanticResult(params: {
    documentId: string;
    candidateFields: CandidateFieldValidationInput[];
    failureRecord: AiFailureRecord;
  }): AiSemanticValidationResult {
    const { documentId, candidateFields, failureRecord } = params;

    const findings: SemanticValidationFinding[] = candidateFields.map((field) => ({
      fieldKey: field.fieldKey,
      consistencyLevel: "AMBIGUOUS",
      status: "UNCERTAIN",
      semanticConfidence: 40,
      interpretationSummary: `AI Semantic Validation bypassed due to ${failureRecord.reason}. Optical evidence preserved.`,
      anomalyDetected: true,
      anomalyDescription: `AI Service Error (${failureRecord.reason}): ${failureRecord.errorMessage}`,
      evidenceSnippets: field.sourceText ? [field.sourceText] : [],
      isInventedValuePrevented: true,
    }));

    return {
      documentId,
      overallSemanticConsistency: "AMBIGUOUS",
      supplierDetected: null,
      documentClassificationMatch: false,
      findings,
      summaryNotes: `AI Semantic Validation failed (${failureRecord.reason}: ${failureRecord.errorMessage}). OCR and deterministic evidence preserved intact. Retry available: ${failureRecord.isRetryable ? "YES" : "NO"}.`,
      unresolvedAmbiguities: [
        `AI validation offline (${failureRecord.reason}) — falling back to authoritative deterministic checks.`,
      ],
      aiFailure: failureRecord,
    };
  }

  /**
   * Verifies that candidate fields were not corrupted or modified during AI failure.
   */
  public static verifyEvidenceIntegrity(
    before: CandidateFieldValidationInput[],
    after: CandidateFieldValidationInput[],
  ): boolean {
    if (before.length !== after.length) return false;

    for (let i = 0; i < before.length; i++) {
      const b = before[i];
      const a = after[i];
      if (b.fieldKey !== a.fieldKey || b.value !== a.value || b.rawValue !== a.rawValue) {
        return false;
      }
    }
    return true;
  }
}
