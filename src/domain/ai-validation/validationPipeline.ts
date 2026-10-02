/**
 * ENERA AI VALIDATION — VALIDATION PIPELINE ORCHESTRATOR
 * ========================================================
 * Implements the complete 8-stage Validation Architecture:
 *
 *   Candidate Data
 *         ↓
 *   Evidence Check
 *         ↓
 *   AI Semantic Validation
 *         ↓
 *   Deterministic Rules
 *         ↓
 *   Cross-Field Validation
 *         ↓
 *   Confidence Calculation
 *         ↓
 *   Exception Generation
 *         ↓
 *   Approval / Review
 *
 * STRICT SEPARATION OF CONCERNS:
 * - Extraction: "What information appears in the document?" (OCR / Native text)
 * - AI Validation: "Does the extracted information agree with available evidence?"
 * - Deterministic Validation: "Do the values mathematically and structurally agree?"
 * - Reconciliation: "What should the customer have been charged?" (Deferred to feature/reconciliation-engine)
 */

import type {
  CandidateFieldValidationInput,
  CompleteValidationResult,
  ValidationApprovalRecord,
  ValidationLifecycleStatus,
} from "./types";
import type {
  AiValidationStructuredPackage,
  AiValidationFieldEvidence,
} from "../intelligence/aiValidationInputBuilder";
import { EvidenceCheckEngine } from "./evidenceCheckEngine";
import { AiSemanticValidator } from "./aiSemanticValidator";
import { DeterministicRuleEngine } from "./deterministicRuleEngine";
import { CrossFieldValidator } from "./crossFieldValidator";
import { ValidationConfidenceCalculator } from "./validationConfidenceCalculator";
import { ExceptionGenerator } from "./exceptionGenerator";

export class ValidationPipeline {
  /**
   * Executes the full 8-stage AI and deterministic validation pipeline.
   */
  public static async executePipeline(
    inputPackage:
      | AiValidationStructuredPackage
      | {
          documentId: string;
          organisationId?: string;
          candidateFields: CandidateFieldValidationInput[];
          fullDocumentText?: string;
        },
  ): Promise<CompleteValidationResult> {
    const now = new Date().toISOString();
    const documentId = inputPackage.documentId;
    const organisationId = inputPackage.organisationId;

    // --- STAGE 1: CANDIDATE DATA NORMALIZATION ---
    let candidateFields: CandidateFieldValidationInput[] = [];
    let fullDocumentText = "";

    if ("hierarchy" in inputPackage) {
      // Input from AiValidationStructuredPackage
      candidateFields = inputPackage.hierarchy.candidateFields.map(
        (f: AiValidationFieldEvidence) => ({
          fieldKey: f.fieldKey,
          fieldLabel: f.fieldLabel,
          value: f.value,
          rawValue: f.rawValue,
          sourcePage: f.sourcePage,
          boundingBox: f.ocrEvidence.boundingBox,
          opticalConfidence: f.confidence,
          wordTokens: f.ocrEvidence.wordTokens,
          sourceText: f.ocrEvidence.sourceText,
          processingRunId: f.ocrEvidence.processingRunId,
        }),
      );
      fullDocumentText = inputPackage.promptContextSummary || "";
    } else {
      candidateFields = inputPackage.candidateFields;
      fullDocumentText = inputPackage.fullDocumentText || "";
    }

    // --- STAGE 2: EVIDENCE CHECK ---
    const evidenceCheck = EvidenceCheckEngine.verifyGrounding(candidateFields);

    // --- STAGE 3: AI SEMANTIC VALIDATION ---
    const semanticValidation = AiSemanticValidator.validateSemantics(
      documentId,
      candidateFields,
      fullDocumentText,
    );

    // --- STAGE 4: DETERMINISTIC RULES ---
    const deterministicValidation = DeterministicRuleEngine.evaluateRules(
      documentId,
      candidateFields,
    );

    // --- STAGE 5: CROSS-FIELD VALIDATION ---
    const crossFieldValidation = CrossFieldValidator.validateCrossFields(candidateFields);

    // --- STAGE 6: CONFIDENCE CALCULATION ---
    const confidence = ValidationConfidenceCalculator.calculateConfidence({
      candidateFields,
      evidenceResults: evidenceCheck.results,
      semanticResult: semanticValidation,
      deterministicResult: deterministicValidation,
      crossFieldResult: crossFieldValidation,
    });

    // --- STAGE 7: EXCEPTION GENERATION ---
    const exceptions = ExceptionGenerator.generateExceptions({
      documentId,
      candidateFields,
      evidenceResults: evidenceCheck.results,
      semanticResult: semanticValidation,
      deterministicResult: deterministicValidation,
      crossFieldResult: crossFieldValidation,
      confidence,
    });

    const criticalExceptions = exceptions.filter((e) => e.severity === "CRITICAL");
    const blockingExceptionsCount = criticalExceptions.length;

    // --- STAGE 8: APPROVAL / REVIEW ---
    let status: ValidationLifecycleStatus = "REVIEW_REQUIRED";
    let approvalMethod: "AUTOMATIC" | "MANUAL" | "NONE" = "NONE";
    let approvedAt: string | undefined = undefined;

    if (confidence.isReliable && blockingExceptionsCount === 0 && exceptions.length === 0) {
      status = "AUTOMATICALLY_APPROVED";
      approvalMethod = "AUTOMATIC";
      approvedAt = now;
    } else {
      status = "REVIEW_REQUIRED";
      approvalMethod = "NONE";
    }

    const approval: ValidationApprovalRecord = {
      status,
      approvalMethod,
      approvedAt,
      approvedBy: approvalMethod === "AUTOMATIC" ? "SYSTEM_DETERMINISTIC_GATE" : undefined,
      blockingExceptionCount: blockingExceptionsCount,
      reviewNotes:
        status === "AUTOMATICALLY_APPROVED"
          ? "All evidence checks, semantic validations, and deterministic arithmetic rules verified 100%."
          : `${exceptions.length} exception(s) require human review before reconciliation handoff.`,
    };

    // Build Validated Fields Map with Field Validation Scores (Reqs 10 & 11)
    const validatedFields: CompleteValidationResult["validatedFields"] = {};
    for (const f of candidateFields) {
      const fieldEvidence = evidenceCheck.results.find((r) => r.fieldKey === f.fieldKey);
      const isFieldGrounded = fieldEvidence?.isGrounded ?? false;
      const fieldScore = confidence.fieldScores[f.fieldKey];

      const fieldState =
        fieldScore?.status || (isFieldGrounded && f.value !== null ? "VALID" : "MISSING");

      validatedFields[f.fieldKey] = {
        value: fieldState === "MISSING" ? null : f.value,
        rawValue: f.rawValue,
        confidence: f.opticalConfidence,
        validationScore: fieldScore,
        isGrounded: isFieldGrounded,
        status: fieldState,
        provenance: {
          pageNumber: f.sourcePage,
          boundingBox: f.boundingBox,
          sourceText: f.sourceText,
        },
      };
    }

    const validationRunId = `val-run-${documentId}-${Date.now()}`;

    return {
      validationRunId,
      documentId,
      organisationId,
      validatedAt: now,
      status,
      overallConfidence: confidence,
      evidenceCheck: {
        totalFieldsChecked: candidateFields.length,
        groundedFieldsCount: evidenceCheck.groundedCount,
        ungroundedFieldsCount: evidenceCheck.ungroundedCount,
        results: evidenceCheck.results,
      },
      semanticValidation,
      deterministicValidation,
      crossFieldValidation,
      exceptions,
      approval,
      validatedFields,
      reconciliationHandoffReady: status === "AUTOMATICALLY_APPROVED",
    };
  }
}
