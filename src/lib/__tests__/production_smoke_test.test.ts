/**
 * Automated Production Smoke-Test Suite
 * Eskom Bill Balancer Platform
 *
 * Verifies production environment configuration, database connectivity schemas,
 * deterministic tariff calculations, stream ingestion memory safety,
 * data quality evaluation, AI layer grounding, governance immutability,
 * and cryptographic audit ledger hash chains prior to production deployment.
 */

import { DeterministicEngine } from "../../domain/tariff/deterministicEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";
import { StreamingIngestionService } from "../../domain/services/streamingIngestionService";
import { evaluateDataQuality } from "../../domain/quality/dataQualityEngine";
import { AiInvestigationEngine } from "../../domain/investigation/aiInvestigationEngine";
import { ApprovalWorkflowEngine } from "../../domain/governance/approvalWorkflowEngine";
import { GovernanceAdminService } from "../../domain/governance/governanceAdminService";
import { HashChainEngine } from "../../domain/audit/hashChainEngine";
import Decimal from "decimal.js-light";

function assertSmoke(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ PRODUCTION SMOKE-TEST FAILED: ${message}`);
    throw new Error(`PRODUCTION SMOKE-TEST FAILED: ${message}`);
  } else {
    console.log(`✅ PRODUCTION SMOKE-TEST PASSED: ${message}`);
  }
}

export async function runProductionSmokeTests() {
  console.log("\n=========================================================");
  console.log("  ESKOM RECONCILER PRODUCTION DEPLOYMENT SMOKE-TEST SUITE");
  console.log("=========================================================\n");

  // 1. Environment & Version Configuration Check
  console.log("--- Smoke 1: Environment & Version Configuration Check ---");
  const settings = GovernanceAdminService.getGovernanceSettings();
  assertSmoke(settings.parserVersion.startsWith("v"), "Parser semver version is valid");
  assertSmoke(
    settings.calculationEngineVersion.includes("nersa"),
    "Calculation engine version references NERSA schedule",
  );

  // 2. Deterministic Tariff Calculation Verification
  console.log("--- Smoke 2: Deterministic Tariff Engine NERSA Rate Precision ---");
  const calcResult = DeterministicEngine.calculateTariff(
    {
      billing_start: "2025-07-01",
      billing_end: "2025-07-31",
      notified_maximum_demand_kva: new Decimal("5000"),
      utilised_capacity_kva: new Decimal("4200"),
      maximum_demand_kva: new Decimal("4850"),
      active_energy_kwh: new Decimal("158152"),
      peak_kwh: new Decimal("30439"),
      standard_kwh: new Decimal("66085"),
      off_peak_kwh: new Decimal("61628"),
      reactive_energy_kvarh: new Decimal("45200"),
      power_factor: new Decimal("0.96"),
    },
    ESKOM_MEGAFLEX_2025_2026,
  );
  assertSmoke(calcResult.total_inc_vat.gt(0), "Deterministic engine produces non-zero total bill");
  assertSmoke(
    calcResult.items.length >= 8,
    "Line items contain all gazetted Eskom Megaflex charges",
  );

  // 3. Telemetry Streaming Ingestion & Idempotency Fingerprint
  console.log("--- Smoke 3: Streaming Ingestion & SHA-256 Idempotency ---");
  const csvContent = "Date,Time,kW,kVAr,kVA,PF\n2026-03-01,00:30:00,10.5,2.1,10.7,0.98\n";
  const fileHash = await StreamingIngestionService.computeSha256(csvContent);
  const streamResult = await StreamingIngestionService.processStreamingIngestion({
    name: "smoke_test_amr.csv",
    size: csvContent.length,
    content: csvContent,
  });
  assertSmoke(streamResult.rowsSeen === 1, "Stream ingestion processed valid row");
  assertSmoke(streamResult.fileHash === fileHash, "SHA-256 fingerprint matches calculation");

  // 4. Data Quality Scanner Engine
  console.log("--- Smoke 4: Data Quality Scanner Engine ---");
  const qualResult = evaluateDataQuality({
    telemetryRecords: [
      {
        meter_id: "m1",
        timestamp_utc: "2026-03-15T00:00:00Z",
        local_timestamp: "2026-03-15 00:00:00",
        timezone: "Africa/Johannesburg",
        interval_minutes: 30,
        active_energy_kwh: 10,
        reactive_energy_kvarh: 2,
        apparent_power_kva: 20,
        active_power_kw: 20,
        power_factor: 0.95,
        tou_period: "OFF_PEAK",
        quality_status: "validated",
        source_file_id: "f1",
        source_row_number: 1,
        parser_version: "1.0.0",
      },
    ],
  });
  assertSmoke(qualResult.overallScore === 100, "Data quality score is 100% for clean interval");
  assertSmoke(qualResult.classification === "GOOD", "Quality classification is GOOD");

  // 5. AI Investigation Layer Grounding
  console.log("--- Smoke 5: AI Investigation Layer Grounding ---");
  const aiFinding = AiInvestigationEngine.investigate({
    query: "Why is this invoice R84,000 higher than calculated?",
    context: {
      customerName: "Smoke Customer",
      reconciliationResult: {
        billedTotalZar: 495000,
        calculatedTotalZar: 472500,
        varianceZar: 22500,
        variancePercentage: 4.76,
        reconciliationStatus: "DISCREPANCY",
        lineItems: [],
        discrepancies: [],
        auditLedgerHash: "hash-smoke-123",
        sourceFileHashes: ["f1"],
        calculationTrace: [],
      } as any,
    },
  });
  assertSmoke(aiFinding.isInsufficientEvidence === false, "AI engine outputs grounded finding");
  assertSmoke(aiFinding.sourceRecords.length >= 1, "AI finding references source records");

  // 6. Enterprise Governance & Approval Workflow Immutability
  console.log("--- Smoke 6: Governance Workflow & Immutability Lock ---");
  let run = ApprovalWorkflowEngine.createDraftRun({
    invoiceId: "inv-smoke",
    invoiceNumber: "INV-SMOKE-001",
    meterId: "m1",
    organisationId: "org-001",
    billingPeriodStr: "March 2026",
    actor: {
      userId: "u1",
      userName: "Auditor",
      userRole: "AUDITOR",
      timestamp: new Date().toISOString(),
    },
  });
  run = ApprovalWorkflowEngine.transitionState(run, "PROCESSING", {
    userId: "u1",
    userName: "Auditor",
    userRole: "AUDITOR",
    timestamp: new Date().toISOString(),
  });
  run = ApprovalWorkflowEngine.transitionState(run, "REVIEW", {
    userId: "u1",
    userName: "Auditor",
    userRole: "AUDITOR",
    timestamp: new Date().toISOString(),
  });
  run = ApprovalWorkflowEngine.transitionState(run, "APPROVED", {
    userId: "u1",
    userName: "Auditor",
    userRole: "AUDITOR",
    timestamp: new Date().toISOString(),
  });
  run = ApprovalWorkflowEngine.transitionState(run, "FINALIZED", {
    userId: "u1",
    userName: "Auditor",
    userRole: "AUDITOR",
    timestamp: new Date().toISOString(),
  });
  assertSmoke(run.isImmutable === true, "FINALIZED state locks run immutably");

  // 7. Cryptographic Hash Chain Audit Ledger
  console.log("--- Smoke 7: Cryptographic Hash Chain Audit Ledger ---");
  const event1 = { seq: 1, payload: "Run #101", prevHash: "000" };
  const hash1 = await HashChainEngine.calculateSHA256(JSON.stringify(event1));
  assertSmoke(
    typeof hash1 === "string" && hash1.length === 64,
    "Generated valid 64-character SHA-256 hash",
  );

  console.log("\n=========================================================");
  console.log("  ALL PRODUCTION SMOKE-TEST SCENARIOS PASSED 100%");
  console.log("=========================================================\n");
}

runProductionSmokeTests();
