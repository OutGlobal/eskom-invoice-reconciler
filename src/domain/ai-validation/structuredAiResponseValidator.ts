/**
 * ENERA AI VALIDATION — STRUCTURED AI RESPONSE VALIDATOR (REQUIREMENT 9)
 * =======================================================================
 * Validates that all AI model outputs conform strictly to the expected JSON schema.
 *
 * MANDATES:
 * 1. AI must return structured JSON — never free-form prose for machine decisions.
 * 2. Strict Zod schema validation.
 * 3. Rejects malformed AI output and safely transitions to REVIEW_REQUIRED.
 */

import { z } from "zod";
import type {
  AiSemanticValidationResult,
  SemanticValidationFinding,
  SemanticConsistencyLevel,
} from "./types";

// --- 1. ZOD OUTPUT SCHEMAS ---

export const StructuredAiFieldEvidenceSchema = z.object({
  page: z.number().int().positive(),
  source_text: z.string(),
  bounding_box: z.array(z.number()).length(4).optional(),
});

export const StructuredAiFieldValidationSchema = z.object({
  field: z.string().min(1),
  status: z.enum(["VALID", "AMBIGUOUS", "INVALID", "UNKNOWN"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  evidence: z.array(StructuredAiFieldEvidenceSchema).default([]),
  suggested_correction: z.union([z.string(), z.number()]).optional(),
});

export const StructuredAiDocumentValidationSchema = z.object({
  document_id: z.string().min(1),
  overall_status: z.enum(["VALID", "REVIEW_REQUIRED", "REJECTED"]),
  overall_confidence: z.number().min(0).max(1),
  supplier_context: z.string().nullable().optional(),
  validated_fields: z.array(StructuredAiFieldValidationSchema),
  anomalies_detected: z.array(z.string()).default([]),
});

export type StructuredAiFieldEvidence = z.infer<typeof StructuredAiFieldEvidenceSchema>;
export type StructuredAiFieldValidation = z.infer<typeof StructuredAiFieldValidationSchema>;
export type StructuredAiDocumentValidation = z.infer<typeof StructuredAiDocumentValidationSchema>;

// --- 2. VALIDATOR & SANITIZER ENGINE ---

export class StructuredAiResponseValidator {
  /**
   * Sanitizes raw text string by stripping markdown code fences.
   */
  public static sanitizeJsonString(rawOutput: string): string {
    let clean = rawOutput.trim();

    // Strip ```json ... ``` or ``` ... ```
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```(?:json)?\s*/i, "");
      clean = clean.replace(/\s*```$/i, "");
    }

    return clean.trim();
  }

  /**
   * Validates raw AI output against the strict schema.
   */
  public static validateResponse(
    rawOutput: string | unknown,
    expectedDocumentId: string,
  ): {
    isValid: boolean;
    data: StructuredAiDocumentValidation | null;
    errorMessage?: string;
    schemaErrors?: string[];
  } {
    let parsed: unknown = rawOutput;

    // Parse JSON string if necessary
    if (typeof rawOutput === "string") {
      try {
        const sanitized = this.sanitizeJsonString(rawOutput);
        parsed = JSON.parse(sanitized);
      } catch (err: any) {
        return {
          isValid: false,
          data: null,
          errorMessage: `MALFORMED_AI_OUTPUT: Response is not valid JSON (${err.message}).`,
        };
      }
    }

    // Validate with Zod schema
    const result = StructuredAiDocumentValidationSchema.safeParse(parsed);

    if (!result.success) {
      const errorMessages = result.error.errors.map(
        (e) => `Field '${e.path.join(".")}': ${e.message}`,
      );
      return {
        isValid: false,
        data: null,
        errorMessage: "SCHEMA_VALIDATION_FAILED: AI output violates required JSON schema.",
        schemaErrors: errorMessages,
      };
    }

    const validatedData = result.data;

    // Verify document ID alignment
    if (validatedData.document_id !== expectedDocumentId) {
      return {
        isValid: false,
        data: null,
        errorMessage: `DOCUMENT_ID_MISMATCH: AI returned document_id '${validatedData.document_id}', expected '${expectedDocumentId}'.`,
      };
    }

    return {
      isValid: true,
      data: validatedData,
    };
  }

  /**
   * Converts validated AI output to the internal AiSemanticValidationResult model.
   */
  public static toSemanticValidationResult(
    validatedAiData: StructuredAiDocumentValidation,
  ): AiSemanticValidationResult {
    const findings: SemanticValidationFinding[] = validatedAiData.validated_fields.map((f) => {
      let consistencyLevel: SemanticConsistencyLevel = "CONSISTENT";
      if (f.status === "INVALID") consistencyLevel = "INCONSISTENT";
      else if (f.status === "AMBIGUOUS") consistencyLevel = "AMBIGUOUS";
      else if (f.status === "UNKNOWN") consistencyLevel = "UNKNOWN";

      const isAnomaly = f.status === "INVALID" || f.status === "AMBIGUOUS";
      const snippets = f.evidence.map((e) => e.source_text);

      return {
        fieldKey: f.field,
        consistencyLevel,
        semanticConfidence: Math.round(f.confidence * 100),
        interpretationSummary: f.reason,
        anomalyDetected: isAnomaly,
        anomalyDescription: isAnomaly ? f.reason : undefined,
        evidenceSnippets: snippets,
        isInventedValuePrevented: true,
      };
    });

    const hasInconsistency = findings.some((f) => f.consistencyLevel === "INCONSISTENT");
    const hasAmbiguity = findings.some((f) => f.consistencyLevel === "AMBIGUOUS");

    const overallLevel: SemanticConsistencyLevel = hasInconsistency
      ? "INCONSISTENT"
      : hasAmbiguity
        ? "AMBIGUOUS"
        : "CONSISTENT";

    return {
      documentId: validatedAiData.document_id,
      overallSemanticConsistency: overallLevel,
      supplierDetected: validatedAiData.supplier_context || null,
      documentClassificationMatch: Boolean(validatedAiData.supplier_context),
      findings,
      summaryNotes: `AI semantic validation completed via structured JSON schema. Status: ${validatedAiData.overall_status}.`,
      unresolvedAmbiguities: validatedAiData.anomalies_detected,
    };
  }

  /**
   * Generates a safe fallback when AI returns malformed or invalid output.
   */
  public static createFallbackResult(
    documentId: string,
    rejectionReason: string,
  ): AiSemanticValidationResult {
    return {
      documentId,
      overallSemanticConsistency: "AMBIGUOUS",
      supplierDetected: null,
      documentClassificationMatch: false,
      findings: [],
      summaryNotes: `AI response rejected due to schema error: ${rejectionReason}. Deterministic fallback initiated.`,
      unresolvedAmbiguities: [`AI_RESPONSE_REJECTED: ${rejectionReason}`],
    };
  }
}
