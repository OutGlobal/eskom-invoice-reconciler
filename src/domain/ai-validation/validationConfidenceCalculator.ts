/**
 * ENERA AI VALIDATION — CONFIDENCE CALCULATOR (STAGE 5 OF VALIDATION)
 * ====================================================================
 * Calculates:
 * 1. Holistic multi-factor document confidence score across 5 weighted pillars.
 * 2. Field-level validation confidence scores (Requirements 10 & 11).
 *
 * VALIDATION STATES SUPPORTED:
 * - VALID
 * - INVALID
 * - UNCERTAIN
 * - MISSING
 * - CONFLICT
 * - REVIEW_REQUIRED
 *
 * NOTE: Confidence scores are explicit validation scores measuring evidence agreement,
 * not statistically calibrated Bayesian probabilities.
 */

import type {
  CandidateFieldValidationInput,
  GroundedEvidenceCheckResult,
  AiSemanticValidationResult,
  DeterministicValidationResult,
  CrossFieldValidationResult,
  ValidationConfidenceBreakdown,
  ValidationConfidenceTier,
  FieldValidationConfidenceScore,
  AiFieldValidationState,
} from "./types";

export class ValidationConfidenceCalculator {
  /**
   * Computes the holistic validation confidence breakdown and field-level scores.
   */
  public static calculateConfidence(params: {
    candidateFields: CandidateFieldValidationInput[];
    evidenceResults: GroundedEvidenceCheckResult[];
    semanticResult: AiSemanticValidationResult;
    deterministicResult: DeterministicValidationResult;
    crossFieldResult: CrossFieldValidationResult;
  }): ValidationConfidenceBreakdown {
    const {
      candidateFields,
      evidenceResults,
      semanticResult,
      deterministicResult,
      crossFieldResult,
    } = params;

    // --- 1. FIELD-LEVEL CONFIDENCE CALCULATIONS (REQ 11) ---
    const fieldScores: Record<string, FieldValidationConfidenceScore> = {};

    for (const field of candidateFields) {
      const evidence = evidenceResults.find((e) => e.fieldKey === field.fieldKey);
      const semantic = semanticResult.findings.find((f) => f.fieldKey === field.fieldKey);
      const detFails = deterministicResult.evaluations.filter(
        (e) => !e.isPassed && e.evaluatedFields.includes(field.fieldKey),
      );

      // 1a. Optical Token Clarity
      const opticalClarity = field.value !== null ? field.opticalConfidence || 85 : 0;

      // 1b. Spatial Bounding Box Presence
      const spatialBounding = evidence?.spatialBoundingBoxPresent ? 100 : 0;

      // 1c. Semantic Agreement
      let semanticAgreement = 90;
      if (!semantic || field.value === null) {
        semanticAgreement = 0;
      } else if (semantic.consistencyLevel === "CONSISTENT") {
        semanticAgreement = 96;
      } else if (semantic.consistencyLevel === "AMBIGUOUS") {
        semanticAgreement = 60;
      } else if (semantic.consistencyLevel === "INCONSISTENT") {
        semanticAgreement = 25;
      }

      // 1d. Deterministic Math & Structure Agreement
      const deterministicAgreement = detFails.length === 0 ? 100 : 35;

      // Weighted Field-Level Validation Score
      let fieldScore = 0;
      if (field.value !== null) {
        fieldScore = Math.round(
          opticalClarity * 0.35 +
            spatialBounding * 0.25 +
            semanticAgreement * 0.2 +
            deterministicAgreement * 0.2,
        );
      }

      // Determine Field State (Requirement 10)
      let status: AiFieldValidationState = "VALID";
      let reasoning = `Field '${field.fieldKey}' verified with ${fieldScore}% validation confidence.`;

      if (field.value === null || field.rawValue === "") {
        status = "MISSING";
        fieldScore = 0;
        reasoning = `Field '${field.fieldKey}' is not present in document evidence (MISSING).`;
      } else if (detFails.length > 0 || evidence?.groundedStatus === "UNGROUNDED") {
        status = "INVALID";
        reasoning = `Field '${field.fieldKey}' failed deterministic arithmetic or grounding checks.`;
      } else if (semantic?.consistencyLevel === "AMBIGUOUS" || opticalClarity < 75) {
        status = "UNCERTAIN";
        reasoning = `Field '${field.fieldKey}' exhibits optical ambiguity or lower clarity (${opticalClarity}%).`;
      } else if (fieldScore < 85) {
        status = "REVIEW_REQUIRED";
        reasoning = `Field '${field.fieldKey}' validation score (${fieldScore}%) requires human spotlight review.`;
      }

      fieldScores[field.fieldKey] = {
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        score: fieldScore,
        status,
        scoreType: "VALIDATION_CONFIDENCE_SCORE",
        breakdown: {
          opticalClarity,
          spatialBounding,
          semanticAgreement,
          deterministicAgreement,
        },
        reasoning,
      };
    }

    // --- 2. DOCUMENT-LEVEL WEIGHTED AGGREGATE ---
    let opticalScore = 85.0;
    if (candidateFields.length > 0) {
      const sum = candidateFields.reduce((acc, f) => acc + (f.opticalConfidence || 80), 0);
      opticalScore = sum / candidateFields.length;
    }

    let groundingScore = 100.0;
    if (evidenceResults.length > 0) {
      const grounded = evidenceResults.filter((r) => r.isGrounded).length;
      groundingScore = (grounded / evidenceResults.length) * 100;
    }

    let semanticScore = 90.0;
    if (semanticResult.overallSemanticConsistency === "CONSISTENT") {
      semanticScore = 95.0;
    } else if (semanticResult.overallSemanticConsistency === "AMBIGUOUS") {
      semanticScore = 65.0;
    } else if (semanticResult.overallSemanticConsistency === "INCONSISTENT") {
      semanticScore = 30.0;
    } else {
      semanticScore = 50.0;
    }

    let deterministicScore = 100.0;
    if (deterministicResult.evaluations.length > 0) {
      const passed = deterministicResult.passedCount;
      deterministicScore = (passed / deterministicResult.evaluations.length) * 100;
    }

    let crossFieldScore = 100.0;
    if (crossFieldResult.findings.length > 0) {
      const consistent = crossFieldResult.findings.filter((f) => f.isConsistent).length;
      crossFieldScore = (consistent / crossFieldResult.findings.length) * 100;
    }

    const overallScore = Math.round(
      opticalScore * 0.25 +
        groundingScore * 0.25 +
        semanticScore * 0.2 +
        deterministicScore * 0.2 +
        crossFieldScore * 0.1,
    );

    let tier: ValidationConfidenceTier = "LOW";
    if (overallScore >= 85) {
      tier = "HIGH";
    } else if (overallScore >= 70) {
      tier = "MEDIUM";
    } else {
      tier = "LOW";
    }

    const allFieldsValid = Object.values(fieldScores).every(
      (f) => f.status === "VALID" || (f.status === "MISSING" && !f.fieldKey.includes("Total")),
    );
    const isReliable =
      tier === "HIGH" &&
      deterministicResult.allRulesPassed &&
      groundingScore >= 90 &&
      allFieldsValid;
    const requiresReview = !isReliable;

    return {
      opticalScore: Math.round(opticalScore),
      groundingScore: Math.round(groundingScore),
      semanticScore: Math.round(semanticScore),
      deterministicScore: Math.round(deterministicScore),
      crossFieldScore: Math.round(crossFieldScore),
      overallScore,
      tier,
      isReliable,
      requiresReview,
      fieldScores,
    };
  }
}
