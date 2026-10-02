/**
 * ENERA AI VALIDATION — EXCEPTION GENERATOR (STAGE 6 OF VALIDATION)
 * ==================================================================
 * Synthesizes findings across evidence checking, semantic validation,
 * deterministic arithmetic, and cross-field rules into actionable, structured
 * exception records with clear severity levels and remediation advice.
 */

import type {
  CandidateFieldValidationInput,
  GroundedEvidenceCheckResult,
  AiSemanticValidationResult,
  DeterministicValidationResult,
  CrossFieldValidationResult,
  ValidationConfidenceBreakdown,
  ValidationExceptionRecord,
  ExceptionSeverity,
} from "./types";

export class ExceptionGenerator {
  /**
   * Generates structured exception records for all pipeline anomalies.
   */
  public static generateExceptions(params: {
    documentId: string;
    candidateFields: CandidateFieldValidationInput[];
    evidenceResults: GroundedEvidenceCheckResult[];
    semanticResult: AiSemanticValidationResult;
    deterministicResult: DeterministicValidationResult;
    crossFieldResult: CrossFieldValidationResult;
    confidence: ValidationConfidenceBreakdown;
  }): ValidationExceptionRecord[] {
    const {
      documentId,
      evidenceResults,
      semanticResult,
      deterministicResult,
      crossFieldResult,
      confidence,
    } = params;

    const exceptions: ValidationExceptionRecord[] = [];
    const now = new Date().toISOString();

    // 1. Evidence Grounding Exceptions
    for (const ev of evidenceResults) {
      if (!ev.isGrounded) {
        exceptions.push({
          exceptionId: `exc-grounding-${documentId}-${ev.fieldKey}-${Date.now()}`,
          documentId,
          fieldKey: ev.fieldKey,
          category: "UNGROUNDED_FIELD",
          severity: "CRITICAL",
          title: `Ungrounded Field: '${ev.fieldKey}'`,
          description: ev.reason,
          suggestedAction:
            "Manually review original document image to verify or locate the physical field value.",
          pageNumber: ev.pageNumber,
          boundingBox: ev.boundingBox,
          createdAt: now,
        });
      }
    }

    // 2. Deterministic Arithmetic Failures
    for (const det of deterministicResult.evaluations) {
      if (!det.isPassed) {
        exceptions.push({
          exceptionId: `exc-det-${documentId}-${det.ruleType}-${Date.now()}`,
          documentId,
          category: "ARITHMETIC_MISMATCH",
          severity: "CRITICAL",
          title: `Deterministic Rule Failure: ${det.ruleName}`,
          description:
            det.errorMessage ||
            `Rule '${det.ruleName}' failed. Expected: ${det.expectedValue}, Actual: ${det.actualValue}.`,
          suggestedAction:
            "Verify individual line item calculations and check for unextracted line charges or surcharges.",
          observedValue: det.actualValue,
          expectedValue: det.expectedValue,
          createdAt: now,
        });
      }
    }

    // 3. AI Semantic Anomalies
    for (const sem of semanticResult.findings) {
      if (sem.anomalyDetected && sem.anomalyDescription) {
        exceptions.push({
          exceptionId: `exc-sem-${documentId}-${sem.fieldKey}-${Date.now()}`,
          documentId,
          fieldKey: sem.fieldKey,
          category: "SEMANTIC_INCONSISTENCY",
          severity: sem.consistencyLevel === "INCONSISTENT" ? "HIGH" : "MEDIUM",
          title: `Semantic Anomaly: '${sem.fieldKey}'`,
          description: sem.anomalyDescription,
          suggestedAction:
            "Check document context to ensure field was not misclassified from another section.",
          createdAt: now,
        });
      }
    }

    // 4. Cross-Field Conflicts
    for (const cross of crossFieldResult.findings) {
      if (!cross.isConsistent) {
        exceptions.push({
          exceptionId: `exc-cross-${documentId}-${cross.ruleCode}-${Date.now()}`,
          documentId,
          category: "CROSS_FIELD_CONFLICT",
          severity: "MEDIUM",
          title: `Cross-Field Inconsistency: ${cross.ruleCode}`,
          description: cross.details,
          suggestedAction:
            "Review relationship between interdependent fields (e.g. VAT rate, TOU rate hierarchy).",
          createdAt: now,
        });
      }
    }

    // 5. Low Overall Confidence Warning
    if (confidence.tier === "LOW") {
      exceptions.push({
        exceptionId: `exc-conf-${documentId}-${Date.now()}`,
        documentId,
        category: "LOW_CONFIDENCE",
        severity: "HIGH",
        title: "Low Aggregate Validation Confidence",
        description: `Overall validation confidence is ${confidence.overallScore}% (Tier: LOW). Optical score: ${confidence.opticalScore}%, Deterministic score: ${confidence.deterministicScore}%.`,
        suggestedAction:
          "Full human review required before exporting invoice to downstream reconciliation.",
        createdAt: now,
      });
    }

    return exceptions;
  }
}
