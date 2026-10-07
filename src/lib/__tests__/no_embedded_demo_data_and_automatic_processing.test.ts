/**
 * UNIT TEST SUITE: NO EMBEDDED DEMO DATA & AUTOMATIC PROCESSING
 * ==============================================================
 * Tests Requirement 28 (Elimination of embedded mock/demo data on production paths)
 * and Requirement 29 (Full 6-stage automatic reconciliation processing pipeline).
 */

import assert from "node:assert/strict";
import Decimal from "decimal.js-light";

import {
  AutomaticProcessingPipeline,
  type AutomatedProcessingJobResult,
} from "../../domain/reconciliation/automaticProcessingPipeline";
import { runAutomaticReconciliation } from "../../domain/reconciliation/autoReconciliationRunner";
import { RealtimeRefreshManager } from "../../domain/realtime/realtimeRefreshManager";
import type { InvoiceData } from "../../lib/store";
import type { Measurement } from "../../lib/parseMeter";

async function runSuite() {
  console.log("=========================================================");
  console.log("  TEST SUITE: REQUIREMENTS 28 & 29");
  console.log("  (Zero Demo Data & 6-Stage Automatic Reconciliation)");
  console.log("=========================================================\n");

  // ------------------------------------------------------------------------
  // REQUIREMENT 28 TESTS
  // ------------------------------------------------------------------------
  console.log("--- Req 28: Prohibits fallback copying of invoice quantities when telemetry rows are absent ---");
  const outcome = runAutomaticReconciliation(
    {
      invoiceNumber: "INV-DEMO-CHECK",
      billingPeriodStart: "2024-06-01",
      billingPeriodEnd: "2024-06-30",
      totalKWh: 50000,
      peakKWh: 15000,
    },
    [], // Empty telemetry!
  );

  assert.strictEqual(outcome.status, "AWAITING_METER_DATA");
  assert.strictEqual(outcome.payload, null);
  assert.ok(outcome.message.includes("waiting for interval meter data"));
  console.log("✅ PASSED: Rejects empty telemetry without copying invoice determinants.\n");

  console.log("--- Req 28: Honest non-zero variances when AMR diverges from invoice ---");
  const invoice: Partial<InvoiceData> = {
    invoiceNumber: "INV-REAL-001",
    accountNumber: "ACC-REAL-001",
    meterNumber: "MET-001",
    billingPeriodStart: "2024-06-01",
    billingPeriodEnd: "2024-06-30",
    totalKWh: 100000,
    peakKWh: 30000,
    standardKWh: 50000,
    offPeakKWh: 20000,
    maxDemandKVA: 500,
    reactive: 15000,
    totalInclVat: 250000,
  };

  const d1 = new Date("2024-06-05T10:00:00Z");
  const d2 = new Date("2024-06-15T14:00:00Z");

  const telemetry: Measurement[] = [
    {
      ts: d1,
      kW: 180, // in 30 mins: 90 kWh
      kVA: 200,
      kVAR: 50,
      pf: 0.90,
    },
    {
      ts: d2,
      kW: 200, // in 30 mins: 100 kWh
      kVA: 220,
      kVAR: 60,
      pf: 0.91,
    },
  ];

  const divergenceOutcome = runAutomaticReconciliation(invoice, telemetry);
  assert.strictEqual(divergenceOutcome.status, "COMPLETED");
  assert.ok(divergenceOutcome.payload !== null);
  assert.strictEqual(divergenceOutcome.payload.billed_total_zar.toNumber(), 250000);

  const totalComp = divergenceOutcome.payload.determinant_comparisons.find(
    (c) => c.determinant_code === "TOTAL_KWH",
  );
  assert.ok(totalComp !== undefined);
  assert.strictEqual(totalComp.billed_value.toNumber(), 100000);
  assert.strictEqual(totalComp.calculated_value.toNumber(), 190);
  assert.strictEqual(totalComp.classification, "CRITICAL");
  console.log("✅ PASSED: Genuine non-zero variance computed from real AMR intervals.\n");

  // ------------------------------------------------------------------------
  // REQUIREMENT 29 TESTS
  // ------------------------------------------------------------------------
  const sampleValidatedInvoice: Partial<InvoiceData> = {
    invoiceNumber: "INV-AUTO-2024-06",
    accountNumber: "ACC-AUTO-9988",
    meterNumber: "MET-AUTO-01",
    billingPeriodStart: "2024-06-01",
    billingPeriodEnd: "2024-06-30",
    totalKWh: 120000,
    peakKWh: 30000,
    standardKWh: 60000,
    offPeakKWh: 30000,
    maxDemandKVA: 450,
    reactive: 20000,
    peakEnergyCharge: 195000,
    standardEnergyCharge: 120000,
    offPeakEnergyCharge: 36000,
    networkDemandCharge: 18000,
    serviceCharge: 5500,
    ancillary: 3000,
    vat: 56625,
    totalInclVat: 434125,
  };

  const sampleTelemetryRows: Measurement[] = [
    {
      ts: new Date("2024-06-05T08:00:00Z"),
      kW: 240, // 120 kWh
      kVA: 260,
      kVAR: 80,
      pf: 0.92,
    },
    {
      ts: new Date("2024-06-10T12:00:00Z"),
      kW: 300, // 150 kWh
      kVA: 320,
      kVAR: 90,
      pf: 0.94,
    },
    {
      ts: new Date("2024-06-20T18:00:00Z"),
      kW: 280, // 140 kWh
      kVA: 310,
      kVAR: 85,
      pf: 0.93,
    },
  ];

  console.log("--- Req 29: Stage 1 validation pause when invoice missing ---");
  const stage1Res = await AutomaticProcessingPipeline.execute({
    invoice: null,
    telemetryRows: sampleTelemetryRows,
  });
  assert.strictEqual(stage1Res.status, "AWAITING_INVOICE_VALIDATION");
  assert.strictEqual(stage1Res.reconciliationPayload, null);
  assert.strictEqual(stage1Res.dashboardNotified, false);
  assert.strictEqual(stage1Res.persisted, false);
  console.log("✅ PASSED: Pipeline pauses at Stage 1 if invoice is unvalidated.\n");

  console.log("--- Req 29: Stage 2 matching pause when AMR data is missing ---");
  const stage2Res = await AutomaticProcessingPipeline.execute({
    invoice: sampleValidatedInvoice,
    telemetryRows: [],
  });
  assert.strictEqual(stage2Res.status, "AWAITING_AMR_DATA");
  assert.strictEqual(stage2Res.reconciliationPayload, null);
  assert.strictEqual(stage2Res.dashboardNotified, false);
  assert.strictEqual(stage2Res.persisted, false);
  console.log("✅ PASSED: Pipeline pauses at Stage 2 if AMR interval data is missing.\n");

  console.log("--- Req 29: Complete 6-Stage Automatic Lifecycle Execution ---");
  let notifiedEvent: any = null;
  const unsubscribe = RealtimeRefreshManager.subscribe("PROCESSING_COMPLETED", (event) => {
    if (event.entityType === "reconciliation") {
      notifiedEvent = event;
    }
  });

  try {
    const res: AutomatedProcessingJobResult = await AutomaticProcessingPipeline.execute({
      invoice: sampleValidatedInvoice,
      telemetryRows: sampleTelemetryRows,
      organisationId: "ORG-AUTO-TEST",
    });

    // 1. Stage 1 & 2: Validated invoice & matched intervals
    assert.strictEqual(res.invoiceId, "INV-AUTO-2024-06");
    assert.strictEqual(res.telemetryIntervalsProcessed, 3);

    // 2. Stage 3 & 4: Created job and processed determinants deterministically
    assert.ok(res.jobId.startsWith("JOB-AUTO-RECON-"));
    assert.ok(res.reconciliationId.startsWith("RECON-"));
    assert.ok(Number(res.calculatedValues.totalKwh) > 0);
    assert.ok(Number(res.calculatedValues.maximumDemandKva) > 0);
    assert.ok(Number(res.calculatedValues.vectorPowerFactor) > 0);

    // 3. Stage 5: Saved results and built complete Audit Model (Req 26)
    assert.strictEqual(res.persisted, true);
    assert.ok(res.auditModel !== null);
    assert.strictEqual(res.auditModel.invoice.invoice_number, "INV-AUTO-2024-06");
    assert.strictEqual(res.auditModel.approval.status, "AUTO_APPROVED");

    // 4. Stage 6: Update dashboard broadcasted
    assert.strictEqual(res.dashboardNotified, true);
    assert.ok(notifiedEvent !== null);
    assert.strictEqual(notifiedEvent.entityType, "reconciliation");
    assert.strictEqual(notifiedEvent.metadata.invoiceId, "INV-AUTO-2024-06");
    console.log("✅ PASSED: 6-Stage lifecycle completed, audited, persisted & broadcasted.\n");
  } finally {
    unsubscribe();
  }

  console.log("--- Req 29: User does not have to manually enter calculated values ---");
  const autoValuesRes = await AutomaticProcessingPipeline.execute({
    invoice: sampleValidatedInvoice,
    telemetryRows: sampleTelemetryRows,
  });

  assert.notStrictEqual(autoValuesRes.calculatedValues.peakKwh, undefined);
  assert.notStrictEqual(autoValuesRes.calculatedValues.standardKwh, undefined);
  assert.notStrictEqual(autoValuesRes.calculatedValues.offPeakKwh, undefined);
  assert.notStrictEqual(autoValuesRes.calculatedValues.totalKwh, undefined);
  assert.notStrictEqual(autoValuesRes.calculatedValues.maximumDemandKva, undefined);
  assert.notStrictEqual(autoValuesRes.calculatedValues.vectorPowerFactor, undefined);
  assert.notStrictEqual(autoValuesRes.calculatedValues.calculatedTotalZar, undefined);

  // Sum of kWh is 120 + 150 + 140 = 410 kWh
  assert.strictEqual(autoValuesRes.calculatedValues.totalKwh, "410.00");
  console.log("✅ PASSED: All derived determinants calculated automatically with zero manual entry.\n");

  console.log("=========================================================");
  console.log("  ALL REQUIREMENTS 28 & 29 TESTS PASSED 100%");
  console.log("=========================================================");
  process.exit(0);
}

runSuite().catch((err) => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
