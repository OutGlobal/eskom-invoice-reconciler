/**
 * ENERA AI VALIDATION — CONFIDENCE CALCULATOR (STAGE 5 OF VALIDATION)
 * ====================================================================
 * Calculates multi-factor validation confidence across five weighted pillars:
 * 1. Optical OCR Token Score (25%)
 * 2. Evidence Grounding & Bounding Box Coordinates (25%)
 * 3. AI Semantic Consistency (20%)
 * 4. Deterministic Arithmetic & Structural Rules (20%)
 * 5. Cross-Field Relational Sanity (10%)
 *
 * TIERS:
 * - HIGH (>= 85%): Reliable for automated downstream processing.
 * - MEDIUM (70% - 84%): Requires supervisor spotlight or conditional review.
 * - LOW (< 70%): Automatic REVIEW_REQUIRED flag.
 */

import type {
  CandidateFieldValidationInput,
  GroundedEvidenceCheckResult,
  AiSemanticValidationResult,
  DeterministicValidationResult,
  CrossFieldValidationResult,
  ValidationConfidenceBreakdown,
  ValidationConfidenceTier,
} from "./types";

export class ValidationConfidenceCalculator {
  /**
   * Computes the holistic validation confidence breakdown.
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

    // 1. Optical Score (Average optical confidence across candidate fields)
    let opticalScore = 85.0;
    if (candidateFields.length > 0) {
      const sum = candidateFields.reduce((acc, f) => acc + (f.opticalConfidence || 80), 0);
      opticalScore = sum / candidateFields.length;
    }

    // 2. Grounding Score (% of fields fully grounded with bounding boxes)
    let groundingScore = 100.0;
    if (evidenceResults.length > 0) {
      const grounded = evidenceResults.filter((r) => r.isGrounded).length;
      groundingScore = (grounded / evidenceResults.length) * 100;
    }

    // 3. Semantic Score
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

    // 4. Deterministic Score (% of passed arithmetic and structural rules)
    let deterministicScore = 100.0;
    if (deterministicResult.evaluations.length > 0) {
      const passed = deterministicResult.passedCount;
      deterministicScore = (passed / deterministicResult.evaluations.length) * 100;
    }

    // 5. Cross-Field Score (% of passed cross-field checks)
    let crossFieldScore = 100.0;
    if (crossFieldResult.findings.length > 0) {
      const consistent = crossFieldResult.findings.filter((f) => f.isConsistent).length;
      crossFieldScore = (consistent / crossFieldResult.findings.length) * 100;
    }

    // Weighted Overall Score
    const overallScore = Math.round(
      opticalScore * 0.25 +
        groundingScore * 0.25 +
        semanticScore * 0.2 +
        deterministicScore * 0.2 +
        crossFieldScore * 0.1,
    );

    // Tier Classification
    let tier: ValidationConfidenceTier = "LOW";
    if (overallScore >= 85) {
      tier = "HIGH";
    } else if (overallScore >= 70) {
      tier = "MEDIUM";
    } else {
      tier = "LOW";
    }

    const isReliable =
      tier === "HIGH" && deterministicResult.allRulesPassed && groundingScore >= 90;
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
    };
  }
}
