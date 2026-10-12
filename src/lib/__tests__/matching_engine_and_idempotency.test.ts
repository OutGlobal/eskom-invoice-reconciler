/**
 * ENERA TEST SUITE: REQUIREMENTS 30 & 31
 * =====================================
 * 30. MATCHING ENGINE:
 *     - Explicit matching rules for: account, site, meter, billing period, invoice, AMR dataset.
 *     - If multiple candidates match: AMBIGUOUS_MATCH (do not randomly select one).
 *
 * 31. IDEMPOTENCY:
 *     - Running the same reconciliation twice must not create duplicate financial results.
 *     - Deterministic reconciliation identity based on source/version identifiers.
 *     - If user deliberately requests a new calculation version, create a new run without mutating history.
 */

import assert from "node:assert";
import Decimal from "decimal.js-light";
import {
  MatchingEngine,
  type InvoiceMatchTarget,
  type AmrDatasetCandidate,
} from "../../domain/reconciliation/matchingEngine";
import {
  ReconciliationIdempotencyEngine,
  type DeterministicIdentitySource,
} from "../../domain/reconciliation/idempotencyEngine";
import {
  AutomaticProcessingPipeline,
} from "../../domain/reconciliation/automaticProcessingPipeline";
import {
  CALCULATION_ENGINE_V1,
  CALCULATION_ENGINE_V2,
} from "../../domain/reconciliation/calculationVersioningEngine";
import { ReconciliationStorageService } from "../../domain/reconciliation/reconciliationStorageService";
import type { Measurement } from "../parseMeter";

async function runMatchingEngineAndIdempotencyTests() {
  console.log("==================================================================");
  console.log("  ENERA TEST SUITE: MATCHING ENGINE & IDEMPOTENCY (REQ 30 & 31)");
  console.log("==================================================================\n");

  ReconciliationStorageService.clearMemoryStore();

  // -----------------------------------------------------------------------------
  // TEST 1: MatchingEngine - EXACT_MATCH when single candidate matches all criteria
  // -----------------------------------------------------------------------------
  console.log("--- Test 1: MatchingEngine returns EXACT_MATCH for unambiguous candidate ---");
  const target1: InvoiceMatchTarget = {
    invoiceId: "INV-2026-001",
    invoiceNumber: "INV-2026-001",
    accountNumber: "ACC-998877",
    siteId: "SITE-JHB-EAST",
    meterNumber: "MTR-554433",
    billingPeriodStart: "2026-04-01",
    billingPeriodEnd: "2026-04-30",
    tenantId: "TENANT-ACME",
  };

  const candidates1: AmrDatasetCandidate[] = [
    {
      datasetId: "AMR-DATASET-001",
      meterNumber: "MTR-554433",
      accountNumber: "ACC-998877",
      siteId: "SITE-JHB-EAST",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      intervalCount: 1440,
    },
    {
      datasetId: "AMR-DATASET-OTHER",
      meterNumber: "MTR-999999", // Different meter
      accountNumber: "ACC-998877",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      intervalCount: 1440,
    },
  ];

  const result1 = MatchingEngine.matchInvoiceToAmrCandidates(target1, candidates1);
  assert.strictEqual(result1.decision, "EXACT_MATCH");
  assert.strictEqual(result1.matchedCandidate?.datasetId, "AMR-DATASET-001");
  assert.strictEqual(result1.allMatchingCandidates.length, 1);
  assert.strictEqual(result1.requiresUserResolution, false);
  console.log("✅ Test 1 Passed: Single candidate unambiguous exact match confirmed.\n");

  // -----------------------------------------------------------------------------
  // TEST 2: MatchingEngine - AMBIGUOUS_MATCH when multiple candidates match (NO RANDOM SELECTION)
  // -----------------------------------------------------------------------------
  console.log("--- Test 2: MatchingEngine returns AMBIGUOUS_MATCH (refuses to pick randomly) ---");
  const candidatesAmbiguous: AmrDatasetCandidate[] = [
    {
      datasetId: "AMR-FEED-A",
      meterNumber: "MTR-554433",
      accountNumber: "ACC-998877",
      siteId: "SITE-JHB-EAST",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      intervalCount: 1440,
    },
    {
      datasetId: "AMR-FEED-B-SUBSTATION",
      meterNumber: "MTR-554433",
      accountNumber: "ACC-998877",
      siteId: "SITE-JHB-EAST",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      intervalCount: 1440,
    },
  ];

  const resultAmbiguous = MatchingEngine.matchInvoiceToAmrCandidates(target1, candidatesAmbiguous);
  assert.strictEqual(resultAmbiguous.decision, "AMBIGUOUS_MATCH");
  // CORE INVARIANT: Must NOT randomly pick one candidate
  assert.strictEqual(resultAmbiguous.matchedCandidate, null, "Must NOT arbitrarily select a candidate on ambiguity");
  assert.strictEqual(resultAmbiguous.allMatchingCandidates.length, 2);
  assert.strictEqual(resultAmbiguous.requiresUserResolution, true);
  assert.ok(resultAmbiguous.explanation.includes("Refusing to select randomly"));
  console.log("✅ Test 2 Passed: Ambiguous match correctly detected and random selection refused.\n");

  // -----------------------------------------------------------------------------
  // TEST 3: MatchingEngine - PARTIAL_MATCH when meter matches but period does not cover
  // -----------------------------------------------------------------------------
  console.log("--- Test 3: MatchingEngine returns PARTIAL_MATCH on date period mismatch ---");
  const candidatesPartial: AmrDatasetCandidate[] = [
    {
      datasetId: "AMR-DATASET-MAY",
      meterNumber: "MTR-554433",
      accountNumber: "ACC-998877",
      periodStart: "2026-05-01", // May instead of April
      periodEnd: "2026-05-31",
      intervalCount: 1440,
    },
  ];

  const resultPartial = MatchingEngine.matchInvoiceToAmrCandidates(target1, candidatesPartial);
  assert.strictEqual(resultPartial.decision, "PARTIAL_MATCH");
  assert.strictEqual(resultPartial.matchedCandidate, null);
  assert.strictEqual(resultPartial.candidateEvaluations[0].meterMatch, true);
  assert.strictEqual(resultPartial.candidateEvaluations[0].periodCoverageMatch, false);
  console.log("✅ Test 3 Passed: Partial match correctly identified with period failure reason.\n");

  // -----------------------------------------------------------------------------
  // TEST 4: ReconciliationIdempotencyEngine - Deterministic Run ID generation
  // -----------------------------------------------------------------------------
  console.log("--- Test 4: Deterministic run identity is 100% reproducible for identical sources ---");
  const sourceA: DeterministicIdentitySource = {
    tenantId: "TENANT_ACME",
    invoiceId: "INV-2026-8800",
    meterId: "MTR-12345",
    billingPeriodStart: "2026-05-01",
    billingPeriodEnd: "2026-05-31",
    amrSourceChecksum: "SHA256:AMR-A1B2C3D4E5F6",
    tariffVersionId: "MEGAFLEX_2025_2026_V1",
    calculationEngineVersion: CALCULATION_ENGINE_V1,
    toleranceProfileName: "DEFAULT_PROFILE",
  };

  const runId1 = await ReconciliationIdempotencyEngine.generateDeterministicRunId(sourceA);
  const runId2 = await ReconciliationIdempotencyEngine.generateDeterministicRunId(sourceA);
  assert.strictEqual(runId1, runId2, "Deterministic run IDs must be identical for identical sources");
  assert.ok(runId1.startsWith("RECON-DET-"), "Run ID must use RECON-DET prefix");
  console.log(`✅ Test 4 Passed: Generated deterministic run identity: ${runId1}\n`);

  // -----------------------------------------------------------------------------
  // TEST 5: Deliberate Calculation Version Upgrade creates distinct deterministic ID
  // -----------------------------------------------------------------------------
  console.log("--- Test 5: Calculation version upgrade produces distinct deterministic run ID ---");
  const sourceB_v2: DeterministicIdentitySource = {
    ...sourceA,
    calculationEngineVersion: CALCULATION_ENGINE_V2,
  };

  const runId_v2 = await ReconciliationIdempotencyEngine.generateDeterministicRunId(sourceB_v2);
  assert.notStrictEqual(runId1, runId_v2, "Different calculation versions must have distinct run IDs");

  const evalResult = await ReconciliationIdempotencyEngine.evaluateIdempotency({
    source: sourceB_v2,
    existingRuns: [{ run_id: runId1, calculation_engine_version: CALCULATION_ENGINE_V1 }],
    priorRunUnderDifferentVersion: {
      run_id: runId1,
      calculation_engine_version: CALCULATION_ENGINE_V1,
    },
  });

  assert.strictEqual(evalResult.action, "NEW_CALCULATION_VERSION_RUN");
  assert.strictEqual(evalResult.supersedesRunId, runId1);
  console.log(`✅ Test 5 Passed: Version transition v1 (${runId1}) -> v2 (${runId_v2}) verified.\n`);

  // -----------------------------------------------------------------------------
  // TEST 6: AutomaticProcessingPipeline with AMBIGUOUS_MATCH candidates
  // -----------------------------------------------------------------------------
  console.log("--- Test 6: Pipeline stops on AMBIGUOUS_MATCH without user candidate selection ---");
  const invoiceData = {
    invoiceNumber: "INV-2026-TEST",
    accountNumber: "ACC-998877",
    meterNumber: "MTR-554433",
    billingPeriodStart: "2026-04-01",
    billingPeriodEnd: "2026-04-30",
    totalKWh: 10000,
    totalInclVat: 50000,
  };

  const pipelineAmbiguousResult = await AutomaticProcessingPipeline.execute({
    invoice: invoiceData,
    amrCandidates: candidatesAmbiguous, // 2 matching candidates for 2026-04
  });

  assert.strictEqual(pipelineAmbiguousResult.status, "AMBIGUOUS_MATCH");
  assert.strictEqual(pipelineAmbiguousResult.reconciliationPayload, null);
  assert.ok(pipelineAmbiguousResult.message.includes("AMBIGUOUS_MATCH"));
  console.log("✅ Test 6 Passed: Pipeline halted on ambiguous match as required.\n");

  // -----------------------------------------------------------------------------
  // TEST 7: AutomaticProcessingPipeline Idempotency (Running twice produces NO duplicate results)
  // -----------------------------------------------------------------------------
  console.log("--- Test 7: Pipeline idempotency - running twice does not duplicate financial results ---");
  ReconciliationStorageService.clearMemoryStore();

  const mockIntervals: Measurement[] = [
    { ts: new Date("2026-04-02T10:00:00Z"), kW: 120, kWh: 60, kVA: 125, kvarh: 10 },
    { ts: new Date("2026-04-02T10:30:00Z"), kW: 140, kWh: 70, kVA: 145, kvarh: 12 },
    { ts: new Date("2026-04-02T11:00:00Z"), kW: 110, kWh: 55, kVA: 115, kvarh: 8 },
  ];

  // Execution 1: Initial run
  const exec1 = await AutomaticProcessingPipeline.execute({
    invoice: invoiceData,
    telemetryRows: mockIntervals,
    calculationEngineVersion: CALCULATION_ENGINE_V1,
  });

  assert.strictEqual(exec1.status, "COMPLETED_WITH_EXCEPTIONS");
  assert.strictEqual(exec1.isIdempotentReplay, false);
  const reconId1 = exec1.reconciliationId;
  assert.ok(reconId1.startsWith("RECON-DET-"));

  const runsCountAfterFirst = (await ReconciliationStorageService.getAllRuns()).length;
  assert.strictEqual(runsCountAfterFirst, 1, "Exactly 1 run stored after first execution");

  // Execution 2: Re-running the EXACT same reconciliation
  const exec2 = await AutomaticProcessingPipeline.execute({
    invoice: invoiceData,
    telemetryRows: mockIntervals,
    calculationEngineVersion: CALCULATION_ENGINE_V1,
  });

  assert.strictEqual(exec2.isIdempotentReplay, true, "Second execution must be recognized as idempotent replay");
  assert.strictEqual(exec2.reconciliationId, reconId1, "Reconciliation identity must match exactly");
  assert.ok(exec2.message.includes("Idempotent replay"));

  const runsCountAfterSecond = (await ReconciliationStorageService.getAllRuns()).length;
  assert.strictEqual(runsCountAfterSecond, 1, "Must NOT create duplicate run in storage");
  console.log(`✅ Test 7 Passed: Idempotent replay confirmed (${reconId1}). Zero duplicate financial results.\n`);

  // -----------------------------------------------------------------------------
  // TEST 8: Deliberate New Calculation Version Run in Pipeline
  // -----------------------------------------------------------------------------
  console.log("--- Test 8: Deliberate upgrade to calculation version v2 creates new distinct run ---");
  const exec3_v2 = await AutomaticProcessingPipeline.execute({
    invoice: invoiceData,
    telemetryRows: mockIntervals,
    calculationEngineVersion: CALCULATION_ENGINE_V2,
    forceNewCalculationVersion: true,
  });

  assert.strictEqual(exec3_v2.isIdempotentReplay, false);
  const reconId_v2 = exec3_v2.reconciliationId;
  assert.notStrictEqual(reconId_v2, reconId1, "New calculation version must have a new distinct run ID");

  const runsCountAfterV2 = (await ReconciliationStorageService.getAllRuns()).length;
  assert.strictEqual(runsCountAfterV2, 2, "Storage now holds both historical v1 run and new v2 run");

  const historicalRun = ReconciliationStorageService.getRun(reconId1);
  assert.ok(historicalRun, "Historical v1 run must still exist intact");
  assert.strictEqual(historicalRun.engine_version, CALCULATION_ENGINE_V1);

  const newVersionRun = ReconciliationStorageService.getRun(reconId_v2);
  assert.ok(newVersionRun, "New v2 run must exist in storage");
  assert.strictEqual(newVersionRun.engine_version, CALCULATION_ENGINE_V2);

  console.log(`✅ Test 8 Passed: Version v1 (${reconId1}) preserved; Version v2 (${reconId_v2}) created cleanly.\n`);

  console.log("==================================================================");
  console.log("  ALL REQUIREMENTS 30 & 31 TESTS PASSED SUCCESSFULLY (8/8)");
  console.log("==================================================================");
  process.exit(0);
}

runMatchingEngineAndIdempotencyTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
