/**
 * ENERA AI VALIDATION — APPROVAL STATES (REQUIREMENT 30)
 * =======================================================
 * Implements the authoritative document approval lifecycle:
 *
 *   PENDING_VALIDATION
 *         ↓
 *     VALIDATING
 *    ↙    ↓     ↘
 * VALID  PARTIALLY_VALID  REVIEW_REQUIRED
 *    ↘    ↓     ↙
 *     APPROVED    →   RECONCILIATION ENGINE
 *         ↓
 *     REJECTED
 *
 * CORE INVARIANTS:
 * 1. Only APPROVED and VALID states are eligible to enter the reconciliation engine.
 * 2. All state transitions are strictly governed by transition matrices with audit trail logging.
 * 3. Terminal REJECTED or intermediate REVIEW_REQUIRED/PARTIALLY_VALID documents cannot bypass review.
 */

import type {
  ApprovalState,
  ApprovalStateTransitionRecord,
  CompleteValidationResult,
  HumanReviewSession,
  ValidationLifecycleStatus,
} from "./types";

export class ApprovalStateManager {
  /**
   * The complete list of 7 formal document approval states.
   */
  public static readonly APPROVAL_STATES: readonly ApprovalState[] = [
    "PENDING_VALIDATION",
    "VALIDATING",
    "VALID",
    "PARTIALLY_VALID",
    "REVIEW_REQUIRED",
    "APPROVED",
    "REJECTED",
  ] as const;

  /**
   * States that are permitted to cross the reconciliation boundary.
   */
  public static readonly RECONCILIATION_ELIGIBLE_STATES: ReadonlySet<ApprovalState> = new Set([
    "APPROVED",
    "VALID",
  ]);

  /**
   * Allowed state transition rules.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<ApprovalState, ReadonlySet<ApprovalState>> = {
    PENDING_VALIDATION: new Set(["VALIDATING", "REJECTED"]),
    VALIDATING: new Set(["VALID", "PARTIALLY_VALID", "REVIEW_REQUIRED", "REJECTED"]),
    VALID: new Set(["APPROVED", "REVIEW_REQUIRED", "REJECTED"]),
    PARTIALLY_VALID: new Set(["REVIEW_REQUIRED", "APPROVED", "REJECTED"]),
    REVIEW_REQUIRED: new Set(["APPROVED", "REJECTED", "VALIDATING"]),
    APPROVED: new Set(["REVIEW_REQUIRED", "REJECTED"]), // Can be re-opened for review if new contradictory evidence emerges
    REJECTED: new Set(["PENDING_VALIDATION"]), // Re-submission allowed only via explicit re-initiation
  };

  /**
   * Determines if a given approval state is allowed into the downstream reconciliation engine.
   */
  public static isEligibleForReconciliation(state: ApprovalState | ValidationLifecycleStatus): boolean {
    const normalized = this.normalizeState(state);
    return this.RECONCILIATION_ELIGIBLE_STATES.has(normalized);
  }

  /**
   * Normalizes legacy or internal lifecycle status strings to the standard ApprovalState enum.
   */
  public static normalizeState(status: ValidationLifecycleStatus | string): ApprovalState {
    switch (status) {
      case "PENDING_VALIDATION":
      case "PENDING":
        return "PENDING_VALIDATION";
      case "VALIDATING":
        return "VALIDATING";
      case "VALID":
      case "AUTOMATICALLY_APPROVED":
      case "DOCUMENT_VERIFIED":
        return "VALID";
      case "PARTIALLY_VALID":
      case "DOCUMENT_PARTIALLY_VERIFIED":
        return "PARTIALLY_VALID";
      case "REVIEW_REQUIRED":
      case "DOCUMENT_REQUIRES_REVIEW":
        return "REVIEW_REQUIRED";
      case "APPROVED":
      case "MANUALLY_APPROVED":
        return "APPROVED";
      case "REJECTED":
      case "DOCUMENT_INVALID":
        return "REJECTED";
      default:
        return "REVIEW_REQUIRED";
    }
  }

  /**
   * Evaluates the appropriate approval state from a validation pipeline result.
   */
  public static deriveApprovalState(result: CompleteValidationResult): ApprovalState {
    // 1. If explicit manual approval or rejection exists in review record
    if (result.approval?.status === "MANUALLY_APPROVED" || result.approval?.status === "APPROVED") {
      return "APPROVED";
    }
    if (result.approval?.status === "REJECTED") {
      return "REJECTED";
    }

    // 2. Check for critical or blocking exceptions
    const criticalExceptions = result.exceptions?.filter(
      (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
    ) || [];

    if (criticalExceptions.length > 0) {
      return "REVIEW_REQUIRED";
    }

    // 3. Multi-source conflicts or duplicate conflicts
    if (result.multiSourceReconciliation?.hasConflicts) {
      return "REVIEW_REQUIRED";
    }
    if (result.duplicateFieldDetection?.hasConflicts) {
      return "REVIEW_REQUIRED";
    }

    // 4. OCR errors requiring confirmation
    if (result.ocrErrorDetection?.findings?.some((f) => f.requiresUserConfirmation)) {
      return "REVIEW_REQUIRED";
    }

    // 5. Deterministic arithmetic validation
    if (!result.deterministicValidation?.allRulesPassed) {
      return "REVIEW_REQUIRED";
    }

    // 6. Overall Confidence Tier
    const tier = result.overallConfidence?.tier;
    const score = result.overallConfidence?.overallScore ?? 0;

    if (tier === "HIGH" && score >= 85 && result.reconciliationHandoffReady) {
      return "VALID";
    }

    if (tier === "MEDIUM" || (score >= 65 && score < 85)) {
      return "PARTIALLY_VALID";
    }

    return "REVIEW_REQUIRED";
  }

  /**
   * Checks if a transition between two states is valid.
   */
  public static canTransition(fromState: ApprovalState, toState: ApprovalState): boolean {
    const allowedTargets = this.ALLOWED_TRANSITIONS[fromState];
    return allowedTargets ? allowedTargets.has(toState) : false;
  }

  /**
   * Executes a state transition with validation and audit trail recording.
   */
  public static transitionState(params: {
    currentState: ApprovalState;
    targetState: ApprovalState;
    actor: string;
    reason: string;
  }): {
    success: boolean;
    newState: ApprovalState;
    record: ApprovalStateTransitionRecord;
    errorMessage?: string;
  } {
    const { currentState, targetState, actor, reason } = params;
    const now = new Date().toISOString();

    if (!this.canTransition(currentState, targetState)) {
      const record: ApprovalStateTransitionRecord = {
        fromState: currentState,
        toState: targetState,
        timestamp: now,
        actor,
        reason,
        isAllowed: false,
      };

      return {
        success: false,
        newState: currentState,
        record,
        errorMessage: `Illegal approval state transition: Cannot transition from '${currentState}' to '${targetState}'.`,
      };
    }

    const record: ApprovalStateTransitionRecord = {
      fromState: currentState,
      toState: targetState,
      timestamp: now,
      actor,
      reason,
      isAllowed: true,
    };

    return {
      success: true,
      newState: targetState,
      record,
    };
  }

  /**
   * Returns list of allowed next states from the given state.
   */
  public static getAllowedNextStates(currentState: ApprovalState): ApprovalState[] {
    const targets = this.ALLOWED_TRANSITIONS[currentState];
    return targets ? Array.from(targets) : [];
  }
}
