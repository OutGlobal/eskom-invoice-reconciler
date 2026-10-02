/**
 * ENERA AI VALIDATION — VALIDATION PIPELINE ORCHESTRATOR
 * ========================================================
 * Implements the complete 8-stage Validation Architecture:
 *
 *   Candidate Data
 *         ↓
 *   Evidence Check
 *         ↓
 *   AI Semantic Validation (with Failure Handling — Req 24)
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
 * IDEMPOTENCY (Req 25):
 *   document_id + processing_run_id + validation_version
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
  ValidationConfidenceThresholds,
  AiSemanticValidationResult,
  IdempotencyValidationOptions,
} from "./types";
import type {
  AiValidationStructuredPackage,
  AiValidationFieldEvidence,
} from "../intelligence/aiValidationInputBuilder";
import { EvidenceCheckEngine } from "./evidenceCheckEngine";
import { MissingDataGuard } from "./missingDataGuard";
import { AiSemanticValidator } from "./aiSemanticValidator";
import { AiFailureHandler } from "./aiFailureHandler";
import { IdempotencyManager } from "./idempotencyManager";
import { DeterministicRuleEngine } from "./deterministicRuleEngine";
import { CrossFieldValidator } from "./crossFieldValidator";
import { OcrErrorDetector } from "./ocrErrorDetector";
import { MultiEvidenceReconciler } from "./multiEvidenceReconciler";
import { DuplicateFieldDetector } from "./duplicateFieldDetector";
import { ValidationConfidenceCalculator } from "./validationConfidenceCalculator";
import { ExceptionGenerator } from "./exceptionGenerator";

export interface ValidationPipelineExecutionOptions {
  thresholds?: Partial<ValidationConfidenceThresholds>;
  processingRunId?: string;
  validationVersion?: number;
  forceRerun?: boolean;
  aiSemanticExecutor?: (
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
    fullDocumentText: string,
  ) => Promise<AiSemanticValidationResult>;
}

export class ValidationPipeline {
  /**
   * Executes the full AI and deterministic validation pipeline with idempotency guarantees,
   * AI failure handling, OCR Error Detection, Multi-Source Reconciliation, Duplicate Field Detection,
   * and Missing Data Integrity Guarding.
   */
  public static async executePipeline(
    inputPackage:
      | AiValidationStructuredPackage
      | {
          documentId: string;
          organisationId?: string;
          processingRunId?: string;
          validationVersion?: number;
          candidateFields: CandidateFieldValidationInput[];
          fullDocumentText?: string;
        },
    options?: ValidationPipelineExecutionOptions,
  ): Promise<CompleteValidationResult> {
    const documentId = inputPackage.documentId;
    const processingRunId =
      options?.processingRunId ||
      ("processingRunId" in inputPackage ? inputPackage.processingRunId : undefined) ||
      "run-default";
    const validationVersion =
      options?.validationVersion ||
      ("validationVersion" in inputPackage ? inputPackage.validationVersion : undefined) ||
      1;
    const forceRerun = options?.forceRerun ?? false;

    const idempotencyOptions: IdempotencyValidationOptions = {
      documentId,
      processingRunId,
      validationVersion,
      forceRerun,
    };

    return IdempotencyManager.executeIdempotently(
      idempotencyOptions,
      inputPackage,
      async () => {
        return this.runPipelineInternal(inputPackage, options, processingRunId, validationVersion);
      },
    );
  }

  /**
   * Internal pipeline execution logic without external idempotency wrapper.
   */
  private static async runPipelineInternal(
    inputPackage:
      | AiValidationStructuredPackage
      | {
          documentId: string;
          organisationId?: string;
          processingRunId?: string;
          validationVersion?: number;
          candidateFields: CandidateFieldValidationInput[];
          fullDocumentText?: string;
        },
    options?: ValidationPipelineExecutionOptions,
    processingRunId: string = "run-default",
    validationVersion: number = 1,
  ): Promise<CompleteValidationResult> {
    const now = new Date().toISOString();
    const documentId = inputPackage.documentId;
    const organisationId = inputPackage.organisationId;

    // --- STAGE 1: CANDIDATE DATA NORMALIZATION ---
    let rawCandidateFields: CandidateFieldValidationInput[] = [];
    let fullDocumentText = "";

    if ("hierarchy" in inputPackage) {
      // Input from AiValidationStructuredPackage
      rawCandidateFields = inputPackage.hierarchy.candidateFields.map(
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
          processingRunId: f.ocrEvidence.processingRunId || processingRunId,
        }),
      );
      fullDocumentText = inputPackage.promptContextSummary || "";
    } else {
      rawCandidateFields = inputPackage.candidateFields;
      fullDocumentText = inputPackage.fullDocumentText || "";
    }

    // --- STAGE 2: EVIDENCE CHECK ---
    const evidenceCheck = EvidenceCheckEngine.verifyGrounding(rawCandidateFields);

    // --- STAGE 2a: MISSING DATA INTEGRITY & ANTI-DEFAULT GUARD (REQ 21) ---
    const { guardedFields: candidateFields, auditResult: missingDataAudit } =
      MissingDataGuard.auditAndGuardMissingData(
        documentId,
        rawCandidateFields,
        evidenceCheck.results,
      );

    // --- STAGE 2b: OCR ERROR DETECTION (REQ 18) ---
    const ocrErrorDetection = OcrErrorDetector.detectErrors(documentId, candidateFields);

    // --- STAGE 2c: MULTI-SOURCE EVIDENCE RECONCILIATION (REQ 19) ---
    const multiSourceReconciliation = MultiEvidenceReconciler.reconcileSources(
      documentId,
      candidateFields,
    );

    // --- STAGE 2d: DUPLICATE FIELD CROSS-PAGE DETECTION (REQ 20) ---
    const duplicateFieldDetection = DuplicateFieldDetector.detectDuplicates(
      documentId,
      candidateFields,
    );

    // --- STAGE 3: AI SEMANTIC VALIDATION (WITH ROBUST FAILURE HANDLING — REQ 24) ---
    let semanticValidation: AiSemanticValidationResult;
    try {
      if (options?.aiSemanticExecutor) {
        semanticValidation = await options.aiSemanticExecutor(
          documentId,
          candidateFields,
          fullDocumentText,
        );
      } else {
        semanticValidation = AiSemanticValidator.validateSemantics(
          documentId,
          candidateFields,
          fullDocumentText,
        );
      }
    } catch (aiError) {
      const failureRecord = AiFailureHandler.createAiFailureRecord({
        documentId,
        processingRunId,
        validationVersion,
        error: aiError,
        candidateFields,
        fullDocumentText,
      });

      semanticValidation = AiFailureHandler.createSafeFallbackSemanticResult({
        documentId,
        candidateFields,
        failureRecord,
      });
    }

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
      ocrErrorResult: ocrErrorDetection,
      multiSourceResult: multiSourceReconciliation,
      duplicateFieldResult: duplicateFieldDetection,
      missingDataAudit,
      thresholds: options?.thresholds,
    });

    // --- STAGE 7: EXCEPTION GENERATION ---
    const exceptions = ExceptionGenerator.generateExceptions({
      documentId,
      candidateFields,
      evidenceResults: evidenceCheck.results,
      semanticResult: semanticValidation,
      deterministicResult: deterministicValidation,
      crossFieldResult: crossFieldValidation,
      ocrErrorResult: ocrErrorDetection,
      multiSourceResult: multiSourceReconciliation,
      duplicateFieldResult: duplicateFieldDetection,
      missingDataAudit,
      confidence,
    });

    const criticalExceptions = exceptions.filter((e) => e.severity === "CRITICAL");
    const blockingExceptionsCount = criticalExceptions.length;

    // --- STAGE 8: APPROVAL / REVIEW ---
    let status: ValidationLifecycleStatus = "REVIEW_REQUIRED";
    let approvalMethod: "AUTOMATIC" | "MANUAL" | "NONE" = "NONE";
    let approvedAt: string | undefined = undefined;

    // Automatic approval only if reliable, zero exceptions, zero AI failures, and zero blocking exceptions
    if (
      confidence.isReliable &&
      blockingExceptionsCount === 0 &&
      exceptions.length === 0 &&
      !semanticValidation.aiFailure
    ) {
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
    const idempotencyKey = IdempotencyManager.generateIdempotencyKey(
      documentId,
      processingRunId,
      validationVersion,
    );

    return {
      validationRunId,
      documentId,
      organisationId,
      processingRunId,
      validationVersion,
      idempotencyKey,
      isIdempotentReplay: false,
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
      ocrErrorDetection,
      multiSourceReconciliation,
      duplicateFieldDetection,
      missingDataAudit,
      aiFailure: semanticValidation.aiFailure,
      exceptions,
      approval,
      validatedFields,
      reconciliationHandoffReady: status === "AUTOMATICALLY_APPROVED",
    };
  }
}
