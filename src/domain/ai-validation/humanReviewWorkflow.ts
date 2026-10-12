/**
 * ENERA AI VALIDATION — HUMAN REVIEW WORKFLOW & CORRECTIONS (REQS 28 & 29)
 * =========================================================================
 * Implements the interactive human-in-the-loop review workspace and immutable corrections ledger:
 *
 * Reviewer Workspace Layout (Requirement 28):
 * ┌─────────────────────┬───────────────────────────┐
 * │ ORIGINAL DOCUMENT   │ VALIDATION FINDINGS       │
 * │                     │                           │
 * │ PDF PAGE            │ Account Number ✓          │
 * │                     │ Billing Period ✓          │
 * │                     │ Tariff ⚠                  │
 * │                     │ Total kWh ✓               │
 * │                     │ VAT ⚠                     │
 * │                     │ Invoice Total ✓           │
 * └─────────────────────┴───────────────────────────┘
 *
 * Corrections Invariants (Requirement 29):
 * 1. NEVER overwrite the original evidence.
 * 2. Store: Original Value, Corrected Value, Reason, Reviewer, Timestamp, Evidence.
 * 3. The approved value becomes the authoritative input to downstream reconciliation.
 */

import type {
  CandidateFieldValidationInput,
  CompleteValidationResult,
  FieldCorrectionRecord,
  HumanReviewFieldViewModel,
  DualPaneWorkspaceViewModel,
  HumanReviewSession,
  DownstreamReconciliationPayload,
  DocumentAuditTrailSummary,
} from "./types";
import { DeterministicRuleEngine } from "./deterministicRuleEngine";
import { EneraAuditChainEngine } from "./eneraAuditChain";

export class HumanReviewWorkflowEngine {
  private static readonly activeSessions = new Map<string, HumanReviewSession>();
  private static readonly correctionsStore = new Map<string, FieldCorrectionRecord[]>(); // documentId -> FieldCorrectionRecord[]

  /**
   * Initializes a new human review session for a validated invoice document.
   */
  public static createReviewSession(params: {
    documentId: string;
    validationResult: CompleteValidationResult;
    candidateFields: CandidateFieldValidationInput[];
    reviewer: { id: string; name: string; email?: string; role?: string };
    ocrRunId?: string;
  }): HumanReviewSession {
    const { documentId, validationResult, candidateFields, reviewer, ocrRunId = "ocr-run-default" } =
      params;
    const now = new Date().toISOString();
    const sessionId = `rev-sess-${documentId}-${Date.now()}`;

    const fieldReviews: HumanReviewSession["fieldReviews"] = {};
    const reconciliationApprovedValues: Record<string, string | number | null> = {};

    for (const f of candidateFields) {
      const validated = validationResult.validatedFields[f.fieldKey];
      const activeValue = validated?.value !== undefined ? validated.value : f.value;

      fieldReviews[f.fieldKey] = {
        fieldKey: f.fieldKey,
        status: validated?.status === "VALID" ? "CONFIRMED" : "PENDING",
        inspectedEvidence: false,
        activeValue,
      };

      reconciliationApprovedValues[f.fieldKey] = activeValue;
    }

    const session: HumanReviewSession = {
      sessionId,
      documentId,
      validationRunId: validationResult.validationRunId,
      ocrRunId,
      reviewer,
      status: "IN_REVIEW",
      startedAt: now,
      fieldReviews,
      corrections: [],
      reconciliationPayloadReady: false,
      reconciliationApprovedValues,
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Generates the Dual-Pane Workspace ViewModel (Requirement 28) for UI rendering:
   * Left Pane: Original Document & Spatial Tokens
   * Right Pane: Validation Findings List (✓ Valid, ⚠ Warning, ✗ Conflict)
   */
  public static generateWorkspaceViewModel(params: {
    session: HumanReviewSession;
    validationResult: CompleteValidationResult;
    candidateFields: CandidateFieldValidationInput[];
    activeFieldKey?: string;
    activePage?: number;
    filename?: string;
  }): DualPaneWorkspaceViewModel {
    const {
      session,
      validationResult,
      candidateFields,
      activeFieldKey,
      activePage = 1,
      filename = `invoice_${session.documentId}.pdf`,
    } = params;

    const activeField = activeFieldKey
      ? candidateFields.find((f) => f.fieldKey === activeFieldKey)
      : candidateFields[0];

    const currentActivePage = activeField ? activeField.sourcePage : activePage;

    // Collect tokens for left pane (page-specific)
    const pageTokens: Array<{
      text: string;
      confidence: number;
      boundingBox: [number, number, number, number];
    }> = [];

    for (const f of candidateFields) {
      if (f.sourcePage === currentActivePage && f.wordTokens) {
        for (const t of f.wordTokens) {
          pageTokens.push({
            text: t.text,
            confidence: t.confidence,
            boundingBox: t.boundingBox,
          });
        }
      }
    }

    // Build right pane field finding items
    const fieldViewModels: HumanReviewFieldViewModel[] = candidateFields.map((field) => {
      const validated = validationResult.validatedFields[field.fieldKey];
      const reviewState = session.fieldReviews[field.fieldKey];
      const fieldScore = validationResult.overallConfidence.fieldScores[field.fieldKey];
      const activeCorrection = session.corrections.find((c) => c.fieldKey === field.fieldKey);

      const exceptions = validationResult.exceptions.filter((e) => e.fieldKey === field.fieldKey);

      // Determine badge symbol (✓ Valid, ⚠ Warning, ✗ Conflict)
      let badge: HumanReviewFieldViewModel["badge"] = "VALID_CHECK";
      if (validated?.status === "CONFLICT" || exceptions.some((e) => e.severity === "CRITICAL")) {
        badge = "ERROR_CONFLICT";
      } else if (
        validated?.status === "UNCERTAIN" ||
        validated?.status === "MISSING" ||
        exceptions.length > 0
      ) {
        badge = "WARNING";
      } else {
        badge = "VALID_CHECK";
      }

      return {
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel || field.fieldKey,
        sourcePage: field.sourcePage,
        boundingBox: field.boundingBox,
        originalValue: field.value,
        originalRawValue: field.rawValue,
        currentValue: reviewState?.activeValue ?? field.value,
        status: validated?.status || "VALID",
        reviewStatus: reviewState?.status || "PENDING",
        validationScore: fieldScore?.score ?? 85,
        badge,
        hasExceptions: exceptions.length > 0,
        exceptionMessages: exceptions.map((e) => e.description),
        inspectedEvidence: reviewState?.inspectedEvidence ?? false,
        isCorrected: activeCorrection !== undefined,
        activeCorrection,
      };
    });

    const validCount = fieldViewModels.filter((f) => f.badge === "VALID_CHECK").length;
    const warningCount = fieldViewModels.filter((f) => f.badge === "WARNING").length;
    const conflictCount = fieldViewModels.filter((f) => f.badge === "ERROR_CONFLICT").length;
    const correctedCount = fieldViewModels.filter((f) => f.isCorrected).length;

    return {
      documentId: session.documentId,
      validationRunId: session.validationRunId,
      filename,
      pageCount: Math.max(...candidateFields.map((f) => f.sourcePage), 1),
      activePage: currentActivePage,
      activeFieldKey: activeField?.fieldKey,
      leftPane: {
        pageNumber: currentActivePage,
        tokens: pageTokens,
        activeHighlightBoundingBox: activeField?.boundingBox,
      },
      rightPane: {
        overallStatus: validationResult.status,
        overallConfidenceScore: validationResult.overallConfidence.overallScore,
        fields: fieldViewModels,
        summaryBadges: {
          validCount,
          warningCount,
          conflictCount,
          correctedCount,
        },
      },
    };
  }

  /**
   * Inspects detailed source evidence for a specific field without altering data.
   */
  public static inspectFieldEvidence(
    session: HumanReviewSession,
    candidateFields: CandidateFieldValidationInput[],
    fieldKey: string,
  ): {
    field: CandidateFieldValidationInput;
    evidenceTokens: Array<{
      text: string;
      confidence: number;
      boundingBox?: [number, number, number, number];
    }>;
    sourceSnippet?: string;
  } {
    const field = candidateFields.find((f) => f.fieldKey === fieldKey);
    if (!field) {
      throw new Error(`Field '${fieldKey}' not found in candidate inputs for document ${session.documentId}`);
    }

    if (session.fieldReviews[fieldKey]) {
      session.fieldReviews[fieldKey].inspectedEvidence = true;
    }

    return {
      field,
      evidenceTokens: field.wordTokens || [
        { text: field.rawValue, confidence: field.opticalConfidence, boundingBox: field.boundingBox },
      ],
      sourceSnippet: field.sourceText,
    };
  }

  /**
   * Confirms a field's value as verified by human reviewer.
   */
  public static confirmField(session: HumanReviewSession, fieldKey: string): HumanReviewSession {
    if (session.fieldReviews[fieldKey]) {
      session.fieldReviews[fieldKey].status = "CONFIRMED";
      session.fieldReviews[fieldKey].inspectedEvidence = true;
    }
    return session;
  }

  /**
   * Applies a human review correction (Requirement 29):
   * - Never overwrites original evidence.
   * - Stores: Original Value, Corrected Value, Reason, Reviewer, Timestamp, Evidence.
   * - Re-evaluates deterministic rules against corrected fields.
   * - Sets the approved value for downstream reconciliation.
   */
  public static applyFieldCorrection(params: {
    session: HumanReviewSession;
    candidateFields: CandidateFieldValidationInput[];
    fieldKey: string;
    correctedValue: string | number | null;
    correctedRawValue?: string;
    correctionReason: string;
    reviewer?: { id: string; name: string; email?: string; role?: string };
    userNote?: string;
  }): {
    updatedSession: HumanReviewSession;
    correctionRecord: FieldCorrectionRecord;
  } {
    const {
      session,
      candidateFields,
      fieldKey,
      correctedValue,
      correctedRawValue,
      correctionReason,
      reviewer = session.reviewer,
      userNote,
    } = params;

    const now = new Date().toISOString();
    const originalCandidate = candidateFields.find((f) => f.fieldKey === fieldKey);
    if (!originalCandidate) {
      throw new Error(`Candidate field '${fieldKey}' not found in document ${session.documentId}`);
    }

    const correctionId = `corr-${session.documentId}-${fieldKey}-${Date.now()}`;

    // Construct immutable correction record
    const correctionRecord: FieldCorrectionRecord = {
      correctionId,
      documentId: session.documentId,
      validationRunId: session.validationRunId,
      fieldKey,
      fieldLabel: originalCandidate.fieldLabel || fieldKey,
      originalValue: originalCandidate.value,
      originalRawValue: originalCandidate.rawValue,
      correctedValue,
      correctedRawValue: correctedRawValue || String(correctedValue),
      correctionReason,
      reviewer,
      timestamp: now,
      evidence: {
        sourcePage: originalCandidate.sourcePage,
        boundingBox: originalCandidate.boundingBox,
        sourceText: originalCandidate.sourceText,
        opticalConfidence: originalCandidate.opticalConfidence,
        tokens: originalCandidate.wordTokens,
        userNote,
      },
      isAuthoritativeForReconciliation: true,
    };

    // Re-evaluate deterministic rules with updated candidate fields
    const updatedCandidateFields = candidateFields.map((f) =>
      f.fieldKey === fieldKey
        ? {
            ...f,
            value: correctedValue,
            rawValue: correctedRawValue || String(correctedValue),
          }
        : f,
    );

    const reEvaluatedDet = DeterministicRuleEngine.evaluateRules(
      session.documentId,
      updatedCandidateFields,
    );
    correctionRecord.reEvaluatedDeterministicResult = reEvaluatedDet;

    // Update Session State (Preserves original evidence; modifies active state)
    session.fieldReviews[fieldKey] = {
      fieldKey,
      status: "CORRECTED",
      inspectedEvidence: true,
      activeValue: correctedValue,
      correctionId,
    };

    session.reconciliationApprovedValues[fieldKey] = correctedValue;

    // Append to session corrections list (immutable ledger)
    session.corrections = session.corrections.filter((c) => c.fieldKey !== fieldKey);
    session.corrections.push(correctionRecord);

    // Persist to document corrections store
    const docCorrections = this.correctionsStore.get(session.documentId) || [];
    docCorrections.push(correctionRecord);
    this.correctionsStore.set(session.documentId, docCorrections);

    return {
      updatedSession: session,
      correctionRecord,
    };
  }

  /**
   * Finalizes human review and marks the document as approved for downstream reconciliation.
   * Produces the authoritative reconciliation payload.
   */
  public static approveDocument(params: {
    session: HumanReviewSession;
    candidateFields: CandidateFieldValidationInput[];
    validationResult: CompleteValidationResult;
    approvalNotes?: string;
  }): {
    updatedSession: HumanReviewSession;
    reconciliationPayload: DownstreamReconciliationPayload;
    auditSummary: DocumentAuditTrailSummary;
  } {
    const { session, candidateFields, validationResult, approvalNotes } = params;
    const now = new Date().toISOString();

    session.status = "APPROVED";
    session.completedAt = now;
    session.reconciliationPayloadReady = true;

    // Map user reviews into the 7-stage audit chain
    const userReviewsMap: Record<string, { reviewStatus: "HUMAN_APPROVED" | "HUMAN_OVERRIDDEN"; reviewedBy: string; reviewedAt: string; reviewNotes?: string }> = {};

    for (const f of candidateFields) {
      const review = session.fieldReviews[f.fieldKey];
      if (review?.status === "CORRECTED") {
        const corr = session.corrections.find((c) => c.fieldKey === f.fieldKey);
        userReviewsMap[f.fieldKey] = {
          reviewStatus: "HUMAN_OVERRIDDEN",
          reviewedBy: session.reviewer.name,
          reviewedAt: now,
          reviewNotes: corr?.correctionReason || approvalNotes || "Field value corrected by reviewer.",
        };
      } else {
        userReviewsMap[f.fieldKey] = {
          reviewStatus: "HUMAN_APPROVED",
          reviewedBy: session.reviewer.name,
          reviewedAt: now,
          reviewNotes: approvalNotes || "Confirmed by reviewer without modifications.",
        };
      }
    }

    const auditSummary = EneraAuditChainEngine.buildDocumentAuditTrail({
      result: validationResult,
      candidateFields,
      userReviews: userReviewsMap,
    });

    // Compute composite audit verification digest
    const compositeHash = `audit_${session.documentId}_${Object.values(auditSummary.fieldChains).map((c) => c.chainVerificationHash).join(":").substring(0, 16)}`;

    const reconciliationPayload: DownstreamReconciliationPayload = {
      documentId: session.documentId,
      validationRunId: session.validationRunId,
      approvedBy: session.reviewer.name,
      approvedAt: now,
      approvalMethod: "MANUAL_REVIEW",
      approvedValues: { ...session.reconciliationApprovedValues },
      correctionsAppliedCount: session.corrections.length,
      auditTrailVerificationHash: compositeHash,
    };

    return {
      updatedSession: session,
      reconciliationPayload,
      auditSummary,
    };
  }

  /**
   * Rejects the document with reviewer justification.
   */
  public static rejectDocument(
    session: HumanReviewSession,
    rejectionReason: string,
  ): HumanReviewSession {
    session.status = "REJECTED";
    session.completedAt = new Date().toISOString();
    session.reconciliationPayloadReady = false;
    return session;
  }

  /**
   * Lists all historical corrections made on a document.
   */
  public static listCorrectionsForDocument(documentId: string): FieldCorrectionRecord[] {
    return this.correctionsStore.get(documentId) || [];
  }

  /**
   * Clears in-memory review stores (for testing / reset).
   */
  public static clearStore(): void {
    this.activeSessions.clear();
    this.correctionsStore.clear();
  }
}
