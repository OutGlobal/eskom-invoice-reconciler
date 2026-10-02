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
  OcrErrorDetectionResult,
  MultiSourceReconciliationResult,
  DuplicateFieldDetectionResult,
  MissingDataAuditResult,
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
    ocrErrorResult?: OcrErrorDetectionResult;
    multiSourceResult?: MultiSourceReconciliationResult;
    duplicateFieldResult?: DuplicateFieldDetectionResult;
    missingDataAudit?: MissingDataAuditResult;
    confidence: ValidationConfidenceBreakdown;
  }): ValidationExceptionRecord[] {
    const {
      documentId,
      evidenceResults,
      semanticResult,
      deterministicResult,
      crossFieldResult,
      ocrErrorResult,
      multiSourceResult,
      duplicateFieldResult,
      missingDataAudit,
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

    // 5. Suspected OCR Optical Errors (Requirement 18)
    if (ocrErrorResult && ocrErrorResult.findings.length > 0) {
      for (const ocr of ocrErrorResult.findings) {
        exceptions.push({
          exceptionId: `exc-ocr-${documentId}-${ocr.fieldKey}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          documentId,
          fieldKey: ocr.fieldKey,
          category: "POSSIBLE_OCR_ERROR",
          severity: ocr.requiresUserConfirmation ? "HIGH" : "MEDIUM",
          title: `Possible OCR Error: '${ocr.fieldLabel || ocr.fieldKey}' (${ocr.errorType})`,
          description: ocr.explanation,
          suggestedAction:
            "Review original document image to confirm whether OCR character substitution or decimal shift occurred. Do not auto-overwrite without user confirmation.",
          observedValue: ocr.rawObserved,
          expectedValue: ocr.candidateAlternative ?? null,
          createdAt: now,
        });
      }
    }

    // 6. Multi-Source Evidence Conflicts (Requirement 19)
    if (multiSourceResult && multiSourceResult.conflictList.length > 0) {
      for (const conf of multiSourceResult.conflictList) {
        exceptions.push({
          exceptionId: `exc-multi-source-${documentId}-${conf.fieldKey}-${Date.now()}`,
          documentId,
          fieldKey: conf.fieldKey,
          category: "MULTI_SOURCE_CONFLICT",
          severity: "CRITICAL",
          title: `Multi-Source Evidence Conflict: '${conf.fieldLabel || conf.fieldKey}'`,
          description: conf.reasoning,
          suggestedAction:
            "Compare conflicting candidate values across OCR Result, Native PDF Text, and Table Extraction. Arbitrary selection prohibited; human verification required.",
          observedValue: conf.readings.map((r) => `${r.source}: ${r.rawValue}`).join(" | "),
          createdAt: now,
        });
      }
    }

    // 6a. Cross-Page Duplicate Field Conflicts (Requirement 20)
    if (duplicateFieldResult && duplicateFieldResult.conflictList.length > 0) {
      for (const dup of duplicateFieldResult.conflictList) {
        exceptions.push({
          exceptionId: `exc-duplicate-field-${documentId}-${dup.fieldKey}-${Date.now()}`,
          documentId,
          fieldKey: dup.fieldKey,
          category: "DUPLICATE_FIELD_CONFLICT",
          severity: "CRITICAL",
          title: `Cross-Page Duplicate Conflict: '${dup.fieldLabel || dup.fieldKey}'`,
          description: dup.reasoning,
          suggestedAction:
            "Compare occurrences across pages. Do not arbitrarily choose one page's value; human reconciliation required.",
          observedValue: dup.occurrences.map((o) => `${o.locationLabel || `Page ${o.pageNumber}`}: ${o.rawValue}`).join(" | "),
          createdAt: now,
        });
      }
    }

    // 6b. Rejected Synthetic Industry Defaults (Requirement 21)
    if (missingDataAudit && missingDataAudit.syntheticDefaultsPreventedCount > 0) {
      for (const finding of missingDataAudit.findings.filter((f) => f.wasSyntheticDefaultAttempted)) {
        exceptions.push({
          exceptionId: `exc-synthetic-${documentId}-${finding.fieldKey}-${Date.now()}`,
          documentId,
          fieldKey: finding.fieldKey,
          category: "SYNTHETIC_DEFAULT_REJECTED",
          severity: "HIGH",
          title: `Synthetic Default Rejected: '${finding.fieldLabel || finding.fieldKey}'`,
          description: finding.reasoning,
          suggestedAction:
            "Verify whether field was actually present on document. Missing data must remain missing (null) rather than filled with industry defaults.",
          observedValue: finding.rejectedDefaultValue !== undefined ? String(finding.rejectedDefaultValue) : null,
          expectedValue: "NOT FOUND (null)",
          createdAt: now,
        });
      }
    }

    // 7. Critical Field Failures (Requirement 14)
    if (confidence.qualitySummary.hasFailingCriticalField) {
      for (const failure of confidence.qualitySummary.criticalFieldFailures) {
        exceptions.push({
          exceptionId: `exc-critical-${documentId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          documentId,
          category: "MISSING_MANDATORY_FIELD",
          severity: "CRITICAL",
          title: "Critical Field Validation Failure",
          description: failure,
          suggestedAction:
            "Resolve missing or unverified critical field prior to financial reconciliation.",
          createdAt: now,
        });
      }
    }

    // 8. Low Overall Confidence Warning
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
