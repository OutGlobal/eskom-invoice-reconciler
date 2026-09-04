/**
 * Automated Test Suite: Enterprise Governance & Approval Workflows
 * Tests lifecycle state transitions (DRAFT -> PROCESSING -> REVIEW -> APPROVED -> FINALIZED),
 * immutability enforcement, append-only run revision spawning, actor audit tracking,
 * and governance settings administration.
 */

import { ApprovalWorkflowEngine } from "../../domain/governance/approvalWorkflowEngine";
import { GovernanceAdminService } from "../../domain/governance/governanceAdminService";
import { TransitionActorSignature } from "../../domain/governance/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ GOVERNANCE TEST FAILED: ${message}`);
    throw new Error(`GOVERNANCE TEST FAILED: ${message}`);
  } else {
    console.log(`✅ GOVERNANCE TEST PASSED: ${message}`);
  }
}

export function runGovernanceWorkflowTests() {
  console.log("\n=== RUNNING ENTERPRISE GOVERNANCE & APPROVAL WORKFLOW TEST SUITE ===\n");
  GovernanceAdminService.resetDefaults();

  const auditorActor: TransitionActorSignature = {
    userId: "usr-auditor-01",
    userName: "Lead Energy Auditor",
    userRole: "AUDITOR",
    timestamp: new Date().toISOString(),
  };

  const managerActor: TransitionActorSignature = {
    userId: "usr-mgr-01",
    userName: "Site Energy Manager",
    userRole: "ENERGY_MANAGER",
    timestamp: new Date().toISOString(),
  };

  const approverActor: TransitionActorSignature = {
    userId: "usr-rev-01",
    userName: "Finance Approver",
    userRole: "REVIEWER",
    timestamp: new Date().toISOString(),
  };

  // Test 1: Create Initial DRAFT Run
  console.log("--- Test 1: Create Initial DRAFT Reconciliation Run ---");
  let run = ApprovalWorkflowEngine.createDraftRun({
    invoiceId: "inv-9901",
    invoiceNumber: "INV-2026-03-9901",
    meterId: "ESK-AGA-99104",
    organisationId: "org-001",
    billingPeriodStr: "March 2026",
    actor: auditorActor,
    billedTotalZar: 495000.0,
    calculatedTotalZar: 472500.0,
    varianceZar: 22500.0,
    reconciliationStatus: "MATERIAL_DISCREPANCY",
    auditLedgerHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  });

  assert(run.state === "DRAFT", "Initial state is DRAFT");
  assert(run.isImmutable === false, "Draft run is mutable (isImmutable = false)");
  assert(run.createdBy.userId === "usr-auditor-01", "Tracks createdBy actor ID");
  assert(run.sequenceNumber === 1, "Initial run sequence number is 1");

  // Test 2: Valid State Transitions (DRAFT -> PROCESSING -> REVIEW -> APPROVED -> FINALIZED)
  console.log("\n--- Test 2: Valid State Transitions (DRAFT -> PROCESSING -> REVIEW -> APPROVED -> FINALIZED) ---");
  run = ApprovalWorkflowEngine.transitionState(run, "PROCESSING", auditorActor, "Processing AMR telemetry");
  assert(run.state === "PROCESSING", "Transitioned DRAFT -> PROCESSING");
  assert(run.processingStartedAt !== undefined, "Recorded processingStartedAt timestamp");

  run = ApprovalWorkflowEngine.transitionState(run, "REVIEW", managerActor, "Submitted for financial review");
  assert(run.state === "REVIEW", "Transitioned PROCESSING -> REVIEW");
  assert(run.reviewedBy?.userId === "usr-mgr-01", "Recorded reviewedBy actor signature");

  run = ApprovalWorkflowEngine.transitionState(run, "APPROVED", approverActor, "Variance verified and approved");
  assert(run.state === "APPROVED", "Transitioned REVIEW -> APPROVED");
  assert(run.approvedBy?.userId === "usr-rev-01", "Recorded approvedBy actor signature");

  run = ApprovalWorkflowEngine.transitionState(run, "FINALIZED", auditorActor, "Finalized & locked for audit compliance");
  assert(run.state === "FINALIZED", "Transitioned APPROVED -> FINALIZED");
  assert(run.isImmutable === true, "Finalized state sets isImmutable = true");
  assert(run.finalizedBy?.userId === "usr-auditor-01", "Recorded finalizedBy actor signature");

  // Test 3: Immutability Enforcement (Modifying FINALIZED run MUST fail)
  console.log("\n--- Test 3: Immutability Enforcement on FINALIZED Run ---");
  let caughtImmutabilityError = false;
  try {
    ApprovalWorkflowEngine.transitionState(run, "DRAFT", auditorActor, "Attempting illegal edit");
  } catch (err: any) {
    caughtImmutabilityError = true;
    assert(err.message.includes("IMMUTABILITY VIOLATION"), "Throws IMMUTABILITY VIOLATION error");
  }
  assert(caughtImmutabilityError === true, "Enforced strict immutability check on FINALIZED run");

  // Test 4: Append-Only Revision Spawning (New Run ID, incremented sequence)
  console.log("\n--- Test 4: Append-Only Revision Spawning ---");
  const newRun = ApprovalWorkflowEngine.spawnNewRun(run, auditorActor, "hash-rev-2-sha256");
  assert(newRun.runId !== run.runId, "New run receives a distinct run_id");
  assert(newRun.sequenceNumber === 2, "New run sequence number incremented to 2");
  assert(newRun.previousRunId === run.runId, "New run references previousRunId");
  assert(newRun.state === "DRAFT", "New run starts in state DRAFT");
  assert(newRun.isImmutable === false, "New run is mutable");

  // Ensure historical finalized run remained unchanged
  assert(run.state === "FINALIZED", "Historical run remains in state FINALIZED");
  assert(run.isImmutable === true, "Historical run remains immutable");

  // Test 5: Governance Settings Administration
  console.log("\n--- Test 5: Governance Settings Administration ---");
  const settings = GovernanceAdminService.getGovernanceSettings();
  assert(settings.tolerance.varianceToleranceZar === 1000.0, "Default ZAR tolerance is R1,000");
  assert(settings.tolerance.powerFactorThreshold === 0.96, "Default PF threshold is 0.96");
  assert(settings.dataRetention.retentionPeriodYears === 7, "Default retention period is 7 years");

  const updatedSettings = GovernanceAdminService.updateToleranceSettings({
    varianceToleranceZar: 1500.0,
    powerFactorThreshold: 0.95,
  });
  assert(updatedSettings.tolerance.varianceToleranceZar === 1500.0, "Updated variance ZAR tolerance to R1,500");
  assert(updatedSettings.tolerance.powerFactorThreshold === 0.95, "Updated PF threshold to 0.95");

  console.log("\n=== ALL ENTERPRISE GOVERNANCE TESTS PASSED SUCCESSFULLY ===\n");
}
