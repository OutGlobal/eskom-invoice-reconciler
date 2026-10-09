/**
 * Automated Enterprise Test Suite: 41. REAL DATA END-TO-END TEST
 * ================================================================
 * Validates the full real-data processing journey using a legitimate
 * Eskom TOU invoice and corresponding half-hourly AMR interval telemetry:
 *
 *   UPLOAD INVOICE
 *         ↓
 *   DOCUMENT INTELLIGENCE
 *         ↓
 *   OCR
 *         ↓
 *   AI VALIDATION
 *         ↓
 *   APPROVED INVOICE
 *         ↓
 *   UPLOAD AMR
 *         ↓
 *   AMR VALIDATION
 *         ↓
 *   MATCH ACCOUNT/METER
 *         ↓
 *   MATCH BILLING PERIOD
 *         ↓
 *   LOAD TARIFF INTERFACE
 *         ↓
 *   RECONCILIATION
 *         ↓
 *   VARIANCE
 *         ↓
 *   DATABASE
 *         ↓
 *   DASHBOARD
 *
 *   Verify every result is persistent.
 */

import { RealDataEndToEndEngine } from "../../domain/testing/realDataEndToEndEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ ${message}`);
  }
}

export async function runRealDataEndToEndTests(): Promise<void> {
  console.log("=================================================================");
  console.log("  REQUIREMENT 41: REAL DATA END-TO-END ENTERPRISE LIFECYCLE     ");
  console.log("=================================================================\n");

  const summary = await RealDataEndToEndEngine.executeRealDataLifecycle();

  console.log("\n--- EXECUTING REAL DATA LIFECYCLE STAGES ---");
  for (const stage of summary.stages) {
    assert(
      stage.passed === true,
      `Stage ${stage.stageNumber} [${stage.stageName}]: ${stage.details}`,
    );
  }

  console.log("\n--- VERIFYING MASTER END-TO-END SUMMARY ---");
  assert(
    summary.totalStages === 15,
    `Total stages executed is exactly 15 (got ${summary.totalStages})`,
  );
  assert(
    summary.passedStages === 15,
    `All 15 stages passed successfully (got ${summary.passedStages}/${summary.totalStages})`,
  );
  assert(
    summary.failedStages === 0,
    `Zero pipeline stage failures occurred (got ${summary.failedStages})`,
  );
  assert(
    summary.isFullyPersistent === true,
    "Full data persistence confirmed across all database, storage, and dashboard layers",
  );
  assert(
    summary.invoiceId.startsWith("DOC-"),
    `Valid persistent invoice document ID generated: ${summary.invoiceId}`,
  );
  assert(
    summary.runId.startsWith("RUN-REAL-41-"),
    `Valid persistent reconciliation run ID generated: ${summary.runId}`,
  );

  console.log("\n=================================================================");
  console.log("  ALL REQUIREMENT 41 REAL DATA TESTS PASSED WITH 100% SUCCESS!   ");
  console.log("=================================================================\n");
}

// Allow standalone execution via `npx tsx src/lib/__tests__/real_data_end_to_end.test.ts`
if (process.argv.some((a) => a.includes("real_data_end_to_end"))) {
  runRealDataEndToEndTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
