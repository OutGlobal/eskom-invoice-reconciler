/**
 * ENERA AI VALIDATION — EVIDENCE CHECK ENGINE (STAGE 1 OF VALIDATION)
 * ===================================================================
 * Verifies that all candidate fields are strictly grounded in:
 * - Source page number
 * - OCR optical character / word tokens
 * - Exact spatial bounding box coordinates [ymin, xmin, ymax, xmax]
 *
 * MANDATE:
 * "AI may interpret evidence. AI may NOT invent evidence."
 * If evidence is missing, unreadable, or fabricated without token backing,
 * the field MUST be marked UNGROUNDED / UNKNOWN.
 */

import type {
  CandidateFieldValidationInput,
  GroundedEvidenceCheckResult,
  GroundedStatus,
} from "./types";

export class EvidenceCheckEngine {
  /**
   * Evaluates grounding of candidate fields against optical OCR evidence.
   */
  public static verifyGrounding(candidateFields: CandidateFieldValidationInput[]): {
    results: GroundedEvidenceCheckResult[];
    allGrounded: boolean;
    groundedCount: number;
    ungroundedCount: number;
  } {
    const results: GroundedEvidenceCheckResult[] = [];

    for (const field of candidateFields) {
      const check = this.verifySingleField(field);
      results.push(check);
    }

    const groundedCount = results.filter((r) => r.isGrounded).length;
    const ungroundedCount = results.length - groundedCount;

    return {
      results,
      allGrounded: ungroundedCount === 0,
      groundedCount,
      ungroundedCount,
    };
  }

  /**
   * Verifies a single candidate field.
   */
  public static verifySingleField(
    field: CandidateFieldValidationInput,
  ): GroundedEvidenceCheckResult {
    // Check 1: Value existence
    if (field.value === null || field.value === undefined || field.rawValue === "") {
      return {
        fieldKey: field.fieldKey,
        isGrounded: false,
        groundedStatus: "UNKNOWN",
        matchingTokensCount: 0,
        spatialBoundingBoxPresent: false,
        pageNumber: field.sourcePage || 1,
        reason: `Field '${field.fieldKey}' has no extracted value (empty/null).`,
      };
    }

    // Check 2: Spatial bounding box presence and validity
    const hasValidBoundingBox =
      Array.isArray(field.boundingBox) &&
      field.boundingBox.length === 4 &&
      field.boundingBox.every((coord) => typeof coord === "number" && !isNaN(coord));

    // Check 3: Optical tokens or raw text backing
    const hasWordTokens = Array.isArray(field.wordTokens) && field.wordTokens.length > 0;
    const hasSourceText =
      typeof field.sourceText === "string" && field.sourceText.trim().length > 0;

    const tokenCount = hasWordTokens ? field.wordTokens!.length : hasSourceText ? 1 : 0;

    if (!hasValidBoundingBox && !hasWordTokens && !hasSourceText) {
      return {
        fieldKey: field.fieldKey,
        isGrounded: false,
        groundedStatus: "UNGROUNDED",
        matchingTokensCount: 0,
        spatialBoundingBoxPresent: false,
        pageNumber: field.sourcePage || 1,
        reason: `UNAUTHENTICATED/UNGROUNDED FIELD: '${field.fieldKey}' lacks optical tokens and bounding boxes. Value cannot be accepted without physical evidence.`,
      };
    }

    if (hasValidBoundingBox && (hasWordTokens || hasSourceText)) {
      return {
        fieldKey: field.fieldKey,
        isGrounded: true,
        groundedStatus: "FULLY_GROUNDED",
        matchingTokensCount: tokenCount,
        spatialBoundingBoxPresent: true,
        boundingBox: field.boundingBox,
        pageNumber: field.sourcePage || 1,
        reason: `Field '${field.fieldKey}' is fully grounded with ${tokenCount} token(s) and bounding box.`,
      };
    }

    return {
      fieldKey: field.fieldKey,
      isGrounded: true,
      groundedStatus: "PARTIALLY_GROUNDED",
      matchingTokensCount: tokenCount,
      spatialBoundingBoxPresent: Boolean(hasValidBoundingBox),
      boundingBox: field.boundingBox,
      pageNumber: field.sourcePage || 1,
      reason: `Field '${field.fieldKey}' is partially grounded (partial coordinates or text token match).`,
    };
  }
}
