/**
 * Enterprise Reconciliation Approval Workflow Engine
 * 
 * STRICT GOVERNANCE RULES:
 * 1. Lifecycle: DRAFT -> PROCESSING -> REVIEW -> APPROVED / REJECTED -> FINALIZED
 * 2. Immutability: Once FINALIZED, a run is 100% immutable.
 * 3. Re-calculations MUST create a new distinct run_id. Previous finalized runs are NEVER overwritten.
 * 4. Audit signatures (created_by, reviewed_by, approved_by, rejected_by, finalized_by) are tracked with ISO timestamps.
 */

import {
  ReconciliationLifecycleState,
  ReconciliationWorkflowRun,
  TransitionActorSignature,
} from "./types";

export class ApprovalWorkflowEngine {
  private static readonly VALID_TRANSITIONS: Record<
    ReconciliationLifecycleState,
    ReconciliationLifecycleState[]
  > = {
    DRAFT: ["PROCESSING"],
    PROCESSING: ["REVIEW"],
    REVIEW: ["APPROVED", "REJECTED"],
    APPROVED: ["FINALIZED", "REVIEW"],
    REJECTED: ["DRAFT", "PROCESSING"],
    FINALIZED: [], // Terminal & Immutable
  };

  /**
   * Spawns an initial DRAFT reconciliation workflow run
   */
  public static createDraftRun(params: {
    invoiceId: string;
    invoiceNumber: string;
    meterId: string;
    organisationId: string;
    billingPeriodStr: string;
    actor: TransitionActorSignature;
    billedTotalZar?: number;
    calculatedTotalZar?: number;
    varianceZar?: number;
    reconciliationStatus?: string;
    auditLedgerHash?: string;
  }): ReconciliationWorkflowRun {
    const runId = `recon-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return {
      runId,
      sequenceNumber: 1,
      invoiceId: params.invoiceId,
      invoiceNumber: params.invoiceNumber,
      meterId: params.meterId,
      organisationId: params.organisationId,
      billingPeriodStr: params.billingPeriodStr,
      state: "DRAFT",
      isImmutable: false,
      createdBy: params.actor,
      billedTotalZar: params.billedTotalZar || 0,
      calculatedTotalZar: params.calculatedTotalZar || 0,
      varianceZar: params.varianceZar || 0,
      reconciliationStatus: params.reconciliationStatus || "DRAFT",
      auditLedgerHash: params.auditLedgerHash || "hash-draft-000",
    };
  }

  /**
   * Validates state transition legal paths
   */
  public static isValidTransition(
    currentState: ReconciliationLifecycleState,
    targetState: ReconciliationLifecycleState
  ): boolean {
    const allowed = this.VALID_TRANSITIONS[currentState] || [];
    return allowed.includes(targetState);
  }

  /**
   * Transitions a reconciliation workflow run to a target state
   */
  public static transitionState(
    run: ReconciliationWorkflowRun,
    targetState: ReconciliationLifecycleState,
    actor: TransitionActorSignature,
    notes?: string
  ): ReconciliationWorkflowRun {
    // 1. Immutability Guard
    if (run.isImmutable || run.state === "FINALIZED") {
      throw new Error(
        `IMMUTABILITY VIOLATION: Reconciliation run ${run.runId} is FINALIZED and cannot be modified. Re-calculations must spawn a new run_id.`
      );
    }

    // 2. Transition Validity Guard
    if (!this.isValidTransition(run.state, targetState)) {
      throw new Error(
        `INVALID TRANSITION: Cannot transition reconciliation run from state '${run.state}' to '${targetState}'. Allowed transitions: [${(
          this.VALID_TRANSITIONS[run.state] || []
        ).join(", ")}]`
      );
    }

    const updatedActor: TransitionActorSignature = {
      ...actor,
      timestamp: new Date().toISOString(),
      notes,
    };

    const updatedRun: ReconciliationWorkflowRun = {
      ...run,
      state: targetState,
    };

    // Record state transition signature
    switch (targetState) {
      case "PROCESSING":
        updatedRun.processingStartedAt = updatedActor.timestamp;
        break;
      case "REVIEW":
        updatedRun.reviewedBy = updatedActor;
        break;
      case "APPROVED":
        updatedRun.approvedBy = updatedActor;
        break;
      case "REJECTED":
        updatedRun.rejectedBy = updatedActor;
        break;
      case "FINALIZED":
        updatedRun.finalizedBy = updatedActor;
        updatedRun.isImmutable = true; // Lock run immutably
        break;
    }

    return updatedRun;
  }

  /**
   * Spawns a new versioned reconciliation run from a previous run (Append-Only model)
   */
  public static spawnNewRun(
    previousRun: ReconciliationWorkflowRun,
    actor: TransitionActorSignature,
    newAuditHash?: string
  ): ReconciliationWorkflowRun {
    const newRunId = `recon-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return {
      runId: newRunId,
      sequenceNumber: previousRun.sequenceNumber + 1,
      previousRunId: previousRun.runId,
      invoiceId: previousRun.invoiceId,
      invoiceNumber: previousRun.invoiceNumber,
      meterId: previousRun.meterId,
      organisationId: previousRun.organisationId,
      billingPeriodStr: previousRun.billingPeriodStr,
      state: "DRAFT",
      isImmutable: false,
      createdBy: {
        ...actor,
        timestamp: new Date().toISOString(),
        notes: `Spawned revision v${previousRun.sequenceNumber + 1} from run ${previousRun.runId}`,
      },
      billedTotalZar: previousRun.billedTotalZar,
      calculatedTotalZar: previousRun.calculatedTotalZar,
      varianceZar: previousRun.varianceZar,
      reconciliationStatus: "DRAFT_REVISION",
      auditLedgerHash: newAuditHash || `hash-rev-${previousRun.sequenceNumber + 1}`,
    };
  }

  /**
   * Checks if an edit or update attempt is allowed on a run
   */
  public static assertMutable(run: ReconciliationWorkflowRun): void {
    if (run.isImmutable || run.state === "FINALIZED") {
      throw new Error(
        `IMMUTABILITY VIOLATION: Run ${run.runId} is locked in state FINALIZED. Historical results cannot be overwritten.`
      );
    }
  }
}
