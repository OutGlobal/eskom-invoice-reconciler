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

import {
  type CandidateFieldValidationInput,
  type GroundedEvidenceCheckResult,
  type AiSemanticValidationResult,
  type DeterministicValidationResult,
  type CrossFieldValidationResult,
  type OcrErrorDetectionResult,
  type MultiSourceReconciliationResult,
  type ValidationConfidenceBreakdown,
  type ValidationConfidenceTier,
  type FieldValidationConfidenceScore,
  type AiFieldValidationState,
  type DocumentValidationStatus,
  type ConfidenceTierPolicyAction,
  type ValidationConfidenceThresholds,
  type DocumentValidationQualitySummary,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  CRITICAL_DOCUMENT_FIELDS,
} from "./types";

export class ValidationConfidenceCalculator {
  /**
   * Computes the holistic validation confidence breakdown, field-level scores,
   * document-level validation status, and enforces anti-masking protection for critical financial fields.
   */
  public static calculateConfidence(params: {
    candidateFields: CandidateFieldValidationInput[];
    evidenceResults: GroundedEvidenceCheckResult[];
    semanticResult: AiSemanticValidationResult;
    deterministicResult: DeterministicValidationResult;
    crossFieldResult: CrossFieldValidationResult;
    ocrErrorResult?: OcrErrorDetectionResult;
    multiSourceResult?: MultiSourceReconciliationResult;
    thresholds?: Partial<ValidationConfidenceThresholds>;
  }): ValidationConfidenceBreakdown {
    const {
      candidateFields,
      evidenceResults,
      semanticResult,
      deterministicResult,
      crossFieldResult,
      ocrErrorResult,
      multiSourceResult,
      thresholds: userThresholds,
    } = params;

    const thresholds: ValidationConfidenceThresholds = {
      ...DEFAULT_CONFIDENCE_THRESHOLDS,
      ...(userThresholds || {}),
    };

    // --- 1. FIELD-LEVEL CONFIDENCE CALCULATIONS (REQ 11) ---
    const fieldScores: Record<string, FieldValidationConfidenceScore> = {};

    for (const field of candidateFields) {
      const evidence = evidenceResults.find((e) => e.fieldKey === field.fieldKey);
      const semantic = semanticResult.findings.find((f) => f.fieldKey === field.fieldKey);
      const detFails = deterministicResult.evaluations.filter(
        (e) => !e.isPassed && e.evaluatedFields.includes(field.fieldKey),
      );
      const ocrFinding = ocrErrorResult?.findings.find((f) => f.fieldKey === field.fieldKey);
      const multiComparison = multiSourceResult?.comparisons.find(
        (c) => c.fieldKey === field.fieldKey,
      );

      // 1a. Optical Token Clarity (with OCR error penalty if detected)
      let opticalClarity = field.value !== null ? field.opticalConfidence || 85 : 0;
      if (ocrFinding) {
        opticalClarity = Math.max(10, opticalClarity - ocrFinding.confidencePenalty);
      }

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

        // Multi-Source Adjustment (Req 19)
        if (multiComparison) {
          if (multiComparison.status === "AGREED") {
            fieldScore = Math.min(100, fieldScore + multiComparison.confidenceAdjustment);
          } else if (multiComparison.status === "CONFLICT") {
            fieldScore = Math.max(10, fieldScore + multiComparison.confidenceAdjustment);
          }
        }
      }

      // Determine Field State (Requirement 10 & 19)
      let status: AiFieldValidationState = "VALID";
      let reasoning = `Field '${field.fieldKey}' verified with ${fieldScore}% validation confidence.`;

      if (field.value === null || field.rawValue === "") {
        status = "MISSING";
        fieldScore = 0;
        reasoning = `Field '${field.fieldKey}' is not present in document evidence (MISSING).`;
      } else if (multiComparison?.status === "CONFLICT") {
        status = "CONFLICT";
        reasoning = multiComparison.reasoning;
      } else if (detFails.length > 0 || evidence?.groundedStatus === "UNGROUNDED") {
        status = "INVALID";
        reasoning = `Field '${field.fieldKey}' failed deterministic arithmetic or grounding checks.`;
      } else if (ocrFinding) {
        status = "UNCERTAIN";
        reasoning = ocrFinding.explanation;
      } else if (semantic?.consistencyLevel === "AMBIGUOUS" || opticalClarity < 75) {
        status = "UNCERTAIN";
        reasoning = `Field '${field.fieldKey}' exhibits optical ambiguity or lower clarity (${opticalClarity}%).`;
      } else if (fieldScore < thresholds.highThreshold) {
        status = "REVIEW_REQUIRED";
        reasoning = `Field '${field.fieldKey}' validation score (${fieldScore}%) is below high threshold (${thresholds.highThreshold}%).`;
      } else if (multiComparison?.status === "AGREED") {
        reasoning = multiComparison.reasoning;
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

    // --- 2. DOCUMENT-LEVEL PILLAR SCORES ---
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

    // --- 3. CRITICAL FIELD ANTI-MASKING AUDIT (REQUIREMENT 13) ---
    const criticalFieldsList = candidateFields.filter((f) =>
      CRITICAL_DOCUMENT_FIELDS.includes(f.fieldKey),
    );
    const nonCriticalFieldsList = candidateFields.filter(
      (f) => !CRITICAL_DOCUMENT_FIELDS.includes(f.fieldKey),
    );

    const criticalScores = criticalFieldsList
      .map((f) => fieldScores[f.fieldKey])
      .filter((s): s is FieldValidationConfidenceScore => s !== undefined);
    const nonCriticalScores = nonCriticalFieldsList
      .map((f) => fieldScores[f.fieldKey])
      .filter((s): s is FieldValidationConfidenceScore => s !== undefined);

    const criticalFieldsScore =
      criticalScores.length > 0
        ? Math.round(
            criticalScores.reduce((acc, s) => acc + s.score, 0) / criticalScores.length,
          )
        : 0;

    const nonCriticalFieldsScore =
      nonCriticalScores.length > 0
        ? Math.round(
            nonCriticalScores.reduce((acc, s) => acc + s.score, 0) / nonCriticalScores.length,
          )
        : 100;

    // Identify critical field failures
    const criticalFieldFailures: string[] = [];
    let hasInvalidCriticalField = false;

    // Check if mandatory critical financial total is extracted
    const hasFinancialTotal = candidateFields.some(
      (f) =>
        (f.fieldKey === "totalAmountDue" ||
          f.fieldKey === "invoiceTotal" ||
          f.fieldKey === "totalDue" ||
          f.fieldKey === "subtotal" ||
          f.fieldKey === "totalExclVat") &&
        f.value !== null &&
        f.value !== "",
    );

    if (!hasFinancialTotal && candidateFields.length > 0) {
      criticalFieldFailures.push(
        "Critical financial total field (invoiceTotal / totalAmountDue / subtotal) is missing or unresolved.",
      );
    }

    for (const critScore of criticalScores) {
      const isExtracted = candidateFields.some(
        (f) => f.fieldKey === critScore.fieldKey && f.value !== null,
      );

      if (critScore.status === "INVALID") {
        hasInvalidCriticalField = true;
        criticalFieldFailures.push(
          `Critical field '${critScore.fieldKey}' is INVALID (fails arithmetic or grounding).`,
        );
      } else if (
        isExtracted &&
        (critScore.status === "UNCERTAIN" ||
          critScore.status === "CONFLICT" ||
          critScore.score < thresholds.criticalFieldFloorScore)
      ) {
        criticalFieldFailures.push(
          `Critical field '${critScore.fieldKey}' has insufficient validation score (${critScore.score}%, floor is ${thresholds.criticalFieldFloorScore}%).`,
        );
      }
    }

    const hasFailingCriticalField = criticalFieldFailures.length > 0;

    // Standard raw aggregate
    let rawOverallScore = Math.round(
      opticalScore * 0.2 +
        groundingScore * 0.2 +
        semanticScore * 0.15 +
        deterministicScore * 0.25 +
        crossFieldScore * 0.1 +
        (criticalFieldsScore / 100) * 10,
    );

    // ANTI-MASKING PENALTY:
    // If critical fields fail, do not allow high auxiliary scores to inflate overall score to HIGH
    let isAntiMaskingTriggered = false;
    let antiMaskingReason: string | undefined;

    if (hasFailingCriticalField && rawOverallScore >= thresholds.highThreshold) {
      isAntiMaskingTriggered = true;
      rawOverallScore = Math.min(rawOverallScore, thresholds.highThreshold - 1);
      antiMaskingReason = `Anti-masking activated: High-confidence non-critical fields cannot mask ${criticalFieldFailures.length} critical financial field failure(s).`;
    }

    const overallScore = Math.min(100, Math.max(0, rawOverallScore));

    // --- 4. CONFIDENCE CATEGORY TIER & POLICY ACTION (REQUIREMENT 12) ---
    let tier: ValidationConfidenceTier = "LOW";
    let policyAction: ConfidenceTierPolicyAction = "REVIEW_REQUIRED";

    if (overallScore >= thresholds.highThreshold && !hasFailingCriticalField) {
      tier = "HIGH";
      policyAction = "ELIGIBLE_FOR_AUTOMATIC_PROGRESSION";
    } else if (overallScore >= thresholds.mediumThreshold && !hasInvalidCriticalField) {
      tier = "MEDIUM";
      policyAction = "ADDITIONAL_DETERMINISTIC_CHECKS";
    } else {
      tier = "LOW";
      policyAction = "REVIEW_REQUIRED";
    }

    // --- 5. DOCUMENT-LEVEL VALIDATION STATUS (REQUIREMENT 13) ---
    let documentStatus: DocumentValidationStatus = "DOCUMENT_REQUIRES_REVIEW";

    if (hasInvalidCriticalField || !deterministicResult.allRulesPassed) {
      documentStatus = "DOCUMENT_INVALID";
    } else if (tier === "HIGH" && !hasFailingCriticalField && groundingScore >= thresholds.criticalFieldGroundedThreshold) {
      const nonCriticalHasIssue = nonCriticalScores.some(
        (s) => s.status === "UNCERTAIN" || s.score < thresholds.mediumThreshold,
      );
      if (nonCriticalHasIssue) {
        documentStatus = "DOCUMENT_PARTIALLY_VERIFIED";
      } else {
        documentStatus = "DOCUMENT_VERIFIED";
      }
    } else if (tier === "MEDIUM" && !hasInvalidCriticalField) {
      documentStatus = "DOCUMENT_PARTIALLY_VERIFIED";
    } else {
      documentStatus = "DOCUMENT_REQUIRES_REVIEW";
    }

    const isReliable = documentStatus === "DOCUMENT_VERIFIED";
    const requiresReview = documentStatus !== "DOCUMENT_VERIFIED";

    const qualitySummary: DocumentValidationQualitySummary = {
      documentStatus,
      overallScore,
      tier,
      policyAction,
      criticalFieldsScore,
      nonCriticalFieldsScore,
      hasFailingCriticalField,
      criticalFieldFailures,
      isAntiMaskingTriggered,
      antiMaskingReason,
      configuredThresholds: thresholds,
    };

    return {
      opticalScore: Math.round(opticalScore),
      groundingScore: Math.round(groundingScore),
      semanticScore: Math.round(semanticScore),
      deterministicScore: Math.round(deterministicScore),
      crossFieldScore: Math.round(crossFieldScore),
      overallScore,
      tier,
      policyAction,
      documentStatus,
      qualitySummary,
      isReliable,
      requiresReview,
      fieldScores,
    };
  }
}
