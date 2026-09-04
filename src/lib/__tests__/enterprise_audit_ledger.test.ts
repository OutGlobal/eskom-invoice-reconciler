/**
 * Enterprise Audit Ledger & Lineage Test Suite
 * Automated verification of reproducible run snapshots & SHA-256 cryptographic hash chain ledger
 */

import { AuditLedgerService } from "../../domain/audit/auditLedgerService";
import { HashChainEngine } from "../../domain/audit/hashChainEngine";
import type {
  AuditEventRecord,
  AuditEventType,
  ReproducibleRunSnapshot,
} from "../../domain/audit/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ AUDIT TEST PASSED: ${message}`);
}

async function runAuditTestSuite() {
  console.log("=== RUNNING ENTERPRISE AUDIT & CRYPTOGRAPHIC LINEAGE TEST SUITE ===\n");

  // --- Test 1: Reproducible Reconciliation Run Snapshot ---
  console.log("--- Test 1: Reproducible Run Snapshot Storage & Retrieval ---");
  const sampleSnapshot: ReproducibleRunSnapshot = {
    run_id: "a0000000-0000-4000-8000-000000000001",
    user_id: "b0000000-0000-4000-8000-000000000002",
    organisation_id: "c0000000-0000-4000-8000-000000000003",
    source_file_ids: ["src-001.csv", "src-002.csv"],
    source_file_hashes: ["sha256-hash-file-1", "sha256-hash-file-2"],
    invoice_id: "INV-2026-99",
    meter_id: "MTR-887766",
    tariff_version_id: "2025-2026-V1",
    tariff_snapshot: {
      tariff_code: "ESKOM_MEGAFLEX_HV_2025_2026",
      peak_rate: 6.6692,
      std_rate: 2.1215,
    },
    calendar_version: "2025/2026-V1",
    parser_version: "1.0.0",
    calculation_engine_version: "2.0.0",
    application_version: "1.0.0",
    configuration_snapshot: { nmd_ratchet_pct: 0.7, pf_threshold: 0.96 },
    started_at: new Date(Date.now() - 5000).toISOString(),
    completed_at: new Date().toISOString(),
    execution_environment: "production-browser",
    status: "COMPLETED",
    created_at: new Date().toISOString(),
  };

  const saved = await AuditLedgerService.saveRunSnapshot(sampleSnapshot);
  assert(saved, "Saved reproducible reconciliation run snapshot");

  const retrieved = await AuditLedgerService.getRunSnapshot("a0000000-0000-4000-8000-000000000001");
  assert(retrieved !== undefined, "Retrieved reproducible run snapshot by run ID");
  assert(retrieved?.run_id === "a0000000-0000-4000-8000-000000000001", "Snapshot run ID matches");
  assert(retrieved?.parser_version === "1.0.0", "Retrieved exact parser version (1.0.0)");
  assert(
    retrieved?.calculation_engine_version === "2.0.0",
    "Retrieved exact calculation engine version (2.0.0)",
  );
  assert(retrieved?.source_file_hashes.length === 2, "Retrieved source file cryptographic hashes");

  // --- Test 2: SHA-256 Hashing ---
  console.log("\n--- Test 2: Cryptographic SHA-256 Hashing ---");
  const hash1 = await HashChainEngine.calculateSHA256("Eskom Bill Balancer Test Payload");
  const hash2 = await HashChainEngine.calculateSHA256("Eskom Bill Balancer Test Payload");
  const hash3 = await HashChainEngine.calculateSHA256("Modified Test Payload");

  assert(typeof hash1 === "string" && hash1.length > 0, "Generated valid SHA-256 hash string");
  assert(hash1 === hash2, "Deterministic SHA-256 hash is reproducible for identical input");
  assert(hash1 !== hash3, "SHA-256 hash differs for modified payload");

  // --- Test 3: 12 Major Lifecycle Event Types & Hash Chain Linking ---
  console.log("\n--- Test 3: 12 Major Lifecycle Event Types & Hash Chain Linking ---");
  const eventTypes: AuditEventType[] = [
    "FILE_UPLOADED",
    "FILE_PARSED",
    "FILE_VALIDATED",
    "INVOICE_CREATED",
    "TARIFF_SELECTED",
    "RECONCILIATION_STARTED",
    "RECONCILIATION_COMPLETED",
    "DISCREPANCY_CREATED",
    "REPORT_GENERATED",
    "EXPORT_GENERATED",
    "USER_REVIEWED",
    "USER_APPROVED",
  ];

  const loggedEvents: AuditEventRecord[] = [];
  const actor = "auditor@eskombalancer.co.za";

  for (let i = 0; i < eventTypes.length; i++) {
    const type = eventTypes[i];
    const rec = await AuditLedgerService.logEvent(
      type,
      "test_object",
      `obj-${i + 1}`,
      { step: i + 1, detail: `Event ${type} logged` },
      actor,
    );
    loggedEvents.push(rec);
  }

  assert(loggedEvents.length === 12, "Logged all 12 major lifecycle audit event types");

  // Verify hash chain link H_n -> H_{n-1}
  for (let i = 1; i < loggedEvents.length; i++) {
    const prev = loggedEvents[i - 1];
    const current = loggedEvents[i];
    assert(
      current.previous_event_hash === prev.current_event_hash,
      `Event #${current.sequence_number} (${current.event_type}) correctly linked previous_event_hash to Event #${prev.sequence_number}`,
    );
  }

  // --- Test 4: Cryptographic Hash Chain Integrity Verification ---
  console.log("\n--- Test 4: Cryptographic Hash Chain Integrity Verification ---");
  const integrityResult = await HashChainEngine.verifyChainIntegrity(loggedEvents);
  assert(
    integrityResult.is_valid,
    "Full cryptographic hash chain verified 100% valid & untampered",
  );
  assert(integrityResult.total_events_checked === 12, "Checked all 12 sequential events in ledger");
  assert(integrityResult.tampered_event_ids.length === 0, "Zero tampered event IDs found");

  // --- Test 5: Detection of Tampering & Sequence Alteration ---
  console.log("\n--- Test 5: Detection of Tampering & Sequence Alteration ---");
  // Create tampered copy of events by altering payload_hash of item 5
  const tamperedEvents: AuditEventRecord[] = loggedEvents.map((evt, idx) => {
    if (idx === 4) {
      return {
        ...evt,
        payload_hash: "tampered-fake-sha256-hash-0000000000000000000000000000000000",
      };
    }
    return { ...evt };
  });

  const tamperedResult = await HashChainEngine.verifyChainIntegrity(tamperedEvents);
  assert(
    !tamperedResult.is_valid,
    "Successfully detected tampering in intermediate hash chain event",
  );
  assert(
    tamperedResult.tampered_sequence_numbers.includes(loggedEvents[4].sequence_number),
    "Accurately identified tampered sequence number",
  );
  assert(
    tamperedResult.first_broken_sequence_number === loggedEvents[4].sequence_number,
    "Identified exact first broken sequence number",
  );

  console.log("\n=== ALL ENTERPRISE AUDIT & CRYPTOGRAPHIC LINEAGE TESTS PASSED SUCCESSFULLY ===");
}

runAuditTestSuite().catch((err) => {
  console.error("❌ AUDIT TEST SUITE FAILED:", err);
  process.exit(1);
});
