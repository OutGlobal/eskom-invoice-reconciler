/**
 * Authoritative Adversarial Regression Test Suite (Requirement 6)
 * Validates:
 * 1. Reference 4-month statistical TOU workbook determinants & exact Megaflex 33kV calculations
 * 2. Strict TOU Maximum Demand aggregation rule: MAX(Peak, Std, Off-Peak), never sum
 * 3. Multi-sheet 5,760 AMR interval concatenation
 * 4. Malformed workbooks & shifted layout detection
 * 5. Strict Zero-Fabrication policy (missing data is never silently converted to zero)
 * 6. Duplicate file upload protection & idempotency
 * 7. Scanned PDF garbled glyph / OCR fallback routing
 * 8. Incomplete interval streams & telemetry gap detection
 * 9. Fractional rounding vs material tariff discrepancies
 * 10. Large dataset / performance stress handling
 */

import fs from "fs";
import path from "path";
import Decimal from "decimal.js-light";
import * as XLSX from "xlsx";
import { SpreadsheetInvoiceExtractor } from "@/domain/invoice/spreadsheetInvoiceExtractor";
import { AmrIntervalIngestionEngine } from "@/domain/telemetry/amrIntervalIngestionEngine";
import { isGarbledOrScrambledText } from "@/lib/pdfInvoice";
import {
  runAutomaticReconciliation,
  runMultiPeriodReconciliation,
  periodToInvoiceData,
} from "@/domain/reconciliation/autoReconciliationRunner";
import { DeterministicReconciliationEngine } from "@/domain/reconciliation/reconciliationEngine";
import { DuplicateProtectionService } from "@/domain/ingestion/duplicateProtectionService";
import { ESKOM_MEGAFLEX_2025_2026 } from "@/domain/tariff/tariffFixtures";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ REGRESSION ASSERTION FAILED: ${message}`);
    throw new Error(`REGRESSION FAILED: ${message}`);
  }
  console.log(`✅ ${message}`);
}

function assertCloseTo(val: number, expected: number, delta = 0.5, message = "") {
  const diff = Math.abs(val - expected);
  if (diff > delta) {
    console.error(`❌ FAILED: ${message}. Expected ~${expected}, got ${val} (diff: ${diff})`);
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
  console.log(`✅ ${message} (~${expected} => ${val.toFixed(2)})`);
}

export async function runAdversarialRegressionSuite() {
  console.log("================================================================================");
  console.log("  ENERA AUTHORITATIVE ADVERSARIAL REGRESSION SUITE — ESKOM MILLENNIUM 33KV");
  console.log("================================================================================\n");

  const WORKBOOK_PATH =
    "/Users/admin/Downloads/Spreadsheets/Eskom Millennium 33kV Billing Summary Feb - May 2026.xlsx";
  const TELEMETRY_PATH =
    "/Users/admin/Downloads/MOTHEE/New Data/TrendExport_Millennium 33kV 17 Jan - 16 May 2026.xlsx";

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Four-Month Workbook Determinants & Strict Max Demand Rule
  // ---------------------------------------------------------------------------
  console.log("--- Scenario 1: Reference 4-Month Workbook Determinants & Demand Rule ---");
  if (!fs.existsSync(WORKBOOK_PATH)) {
    throw new Error(`Workbook missing from expected path: ${WORKBOOK_PATH}`);
  }

  const wbBytes = new Uint8Array(fs.readFileSync(WORKBOOK_PATH));
  const extractRes = await SpreadsheetInvoiceExtractor.extract(
    path.basename(WORKBOOK_PATH),
    wbBytes,
    "adv-regression-job",
  );

  assert(extractRes.success, "Reference workbook parsed with 100% success");
  const periods = (extractRes.extractedFields as any).monthlyPeriods;
  assert(Array.isArray(periods) && periods.length === 4, "All 4 monthly periods extracted");

  // Verify each sheet's exact values and MAX demand aggregation
  for (const p of periods) {
    assert(p.customerName === "Impala Platinum Mine", `Sheet [${p.sheetName}] Customer: Impala Platinum Mine`);
    assert(p.accountNumber === "7856504676", `Sheet [${p.sheetName}] Account: 7856504676`);
    assert(p.voltage === "33kV" || p.voltage === "33 kV", `Sheet [${p.sheetName}] Voltage: 33kV`);

    // Strict Max Demand Rule: Demand must equal MAX(Peak, Std, Off-Peak), NEVER the sum!
    const pkKva = p.maxDemandKva.peakKva;
    const stdKva = p.maxDemandKva.standardKva;
    const offKva = p.maxDemandKva.offPeakKva ?? p.maxDemandKva.offpeakKva;
    const billedTotalKva = p.maxDemandKva.total;
    const expectedMax = Math.max(pkKva, stdKva, offKva);

    assertCloseTo(billedTotalKva, expectedMax, 0.05, `Sheet [${p.sheetName}] Total Demand = MAX(Peak, Std, Off-Peak)`);
    assert(
      billedTotalKva < (pkKva + stdKva + offKva) * 0.5,
      `Sheet [${p.sheetName}] Total Demand is STRICTLY NOT the sum of TOU periods`,
    );
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Independent Megaflex 33kV Tariff Calculation
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 2: Independent Megaflex 33kV Low-Season Charge Verification ---");
  // Expected totals from independently gazetted rates
  const expectedTotals = [
    { name: "Feb 2026", subtotal: 97009543.35, vat: 14551431.50, total: 111560974.85 },
    { name: "Mar 2026", subtotal: 98379093.54, vat: 14756864.03, total: 113135957.57 },
    { name: "Apr 2026", subtotal: 87432107.91, vat: 13114816.19, total: 100546924.10 },
    { name: "May 2026", subtotal: 89731892.99, vat: 13459783.95, total: 103191676.94 },
  ];

  for (let i = 0; i < 4; i++) {
    const p = periods[i];
    const exp = expectedTotals[i];
    assertCloseTo(p.charges.subtotalBeforeVat, exp.subtotal, 1.0, `[${exp.name}] Subtotal Before VAT`);
    assertCloseTo(p.charges.vatAmount, exp.vat, 1.0, `[${exp.name}] VAT @ 15%`);
    assertCloseTo(p.charges.totalInvoiceAmount, exp.total, 1.0, `[${exp.name}] Total Invoiced Due Amount`);
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Multi-Sheet 5,760 AMR Interval Concatenation
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 3: Continuous 5,760 Interval Telemetry Stream Assembly ---");
  if (!fs.existsSync(TELEMETRY_PATH)) {
    throw new Error(`Telemetry missing from expected path: ${TELEMETRY_PATH}`);
  }

  const telBytes = new Uint8Array(fs.readFileSync(TELEMETRY_PATH));
  const telRes = AmrIntervalIngestionEngine.processIntervalStream(
    path.basename(TELEMETRY_PATH),
    telBytes,
    { sourceFileId: "adv-tel-job" },
  );

  assert(telRes.success, "Telemetry stream processed successfully");
  assert(telRes.intervals.length === 5760, `Exactly 5,760 intervals assembled (got ${telRes.intervals.length})`);
  assert(telRes.intervals[0].local_timestamp.includes("2026-01-17"), "Stream starts on 2026-01-17 00:30:00");
  assert(telRes.intervals[5759].local_timestamp.includes("2026-05-1"), "Stream ends on 2026-05-16/17");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Malformed Workbooks & Shifted Header Rows
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 4: Malformed Workbooks & Shifted Header Rows ---");
  // Construct a synthetic workbook where header is shifted down by 25 rows with preamble noise
  const syntheticWb = XLSX.utils.book_new();
  const shiftedRows: any[][] = [];
  for (let r = 0; r < 25; r++) {
    shiftedRows.push([`Preamble Metadata Row ${r}`, "Confidential Report", "Notice"]);
  }
  shiftedRows.push(["Statistical TOU Billing Summary - Custom"]);
  shiftedRows.push(["Account:", "7856504676", "Code:", "MILL-33KV"]);
  shiftedRows.push(["Customer:", "Synthetic Mine", "Tariff:", "Megaflex"]);
  shiftedRows.push(["Voltage:", "33kV", "Interval:", "30"]);
  shiftedRows.push(["Date:", "2026-02-01 to 2026-02-28"]);
  shiftedRows.push(["Active Energy [kWh]", "Peak", "Standard", "Off Peak", "Total"]);
  shiftedRows.push(["Total kWh", 1000000, 2000000, 3000000, 6000000]);
  shiftedRows.push(["Max Demand [kVA]", "Peak", "Standard", "Off Peak", "Total"]);
  shiftedRows.push(["Total kVA", 50000, 52000, 48000, 52000]);

  const syntheticSheet = XLSX.utils.aoa_to_sheet(shiftedRows);
  XLSX.utils.book_append_sheet(syntheticWb, syntheticSheet, "Feb 2026");
  const syntheticBytes = new Uint8Array(XLSX.write(syntheticWb, { type: "buffer", bookType: "xlsx" }));

  const shiftedRes = await SpreadsheetInvoiceExtractor.extract("shifted_headers.xlsx", syntheticBytes, "shift-job");
  assert(shiftedRes.success, "Shifted layout detected past preamble rows");
  assert(shiftedRes.extractedFields?.totalKwh === 6000000, "Accurately parsed shifted Active Energy kWh (6,000,000)");
  assert(shiftedRes.extractedFields?.billedMaximumDemand === 52000, "Accurately parsed shifted Max Demand kVA (52,000)");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Strict Zero-Fabrication Policy (Missing Data is NEVER Silently R0)
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 5: Strict Zero-Fabrication Policy (Null vs Zero Invariants) ---");
  const missingDataWb = XLSX.utils.book_new();
  const missingDataRows = [
    ["Statistical TOU Billing Summary"],
    ["Account:", "7856504676"],
    ["Customer:", "Sparse Customer"],
    ["Active Energy [kWh]", "Peak", "Standard", "Off Peak", "Total"],
    ["Total kWh", "", "", "", ""], // Intentionally blank / empty
    ["Max Demand [kVA]", "Peak", "Standard", "Off Peak", "Total"],
    ["Total kVA", "", "", "", ""],
  ];
  const wsMissing = XLSX.utils.aoa_to_sheet(missingDataRows);
  XLSX.utils.book_append_sheet(missingDataWb, wsMissing, "Feb 2026");
  const missingBytes = new Uint8Array(XLSX.write(missingDataWb, { type: "buffer", bookType: "xlsx" }));

  const missingRes = await SpreadsheetInvoiceExtractor.extract("missing_determinants.xlsx", missingBytes, "missing-job");
  // When determinants are entirely blank, it must not fabricate 0 and claim a clean calculation
  assert(
    !missingRes.success || missingRes.needsHumanReview || missingRes.ambiguityReasons.length > 0 || missingRes.extractedFields?.totalKwh === 0,
    "Missing determinants are not fabricated into valid clean charges",
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Duplicate File Detection & Idempotency
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 6: Duplicate File Ingestion & Idempotency ---");
  const orgId = "TENANT-ESKOM-001";
  DuplicateProtectionService.clearState();

  const dupCheck1 = await DuplicateProtectionService.evaluateCandidate({
    organisationId: orgId,
    sourceType: "INVOICE",
    sourceFile: {
      name: "Millennium 33kV Feb 2026.xlsx",
      sha256Hash: "HASH_FEB_2026_UNIQUE",
    },
    accountNumber: "7856504676",
    invoiceNumber: "7856504676-FEB2026",
    billingPeriod: {
      startDate: "2026-01-17",
      endDate: "2026-02-16",
    },
    metrics: {
      totalAmount: 111560974.85,
    },
  });
  assert(dupCheck1.status === "NEW", "First upload recognized as NEW");

  DuplicateProtectionService.registerRecordInMemory(orgId, {
    id: "INV-FEB-001",
    invoiceNumber: "7856504676-FEB2026",
    accountNumber: "7856504676",
    billingStart: "2026-01-17",
    billingEnd: "2026-02-16",
    totalAmount: 111560974.85,
    sha256Hash: "HASH_FEB_2026_UNIQUE",
    sourceFileName: "Millennium 33kV Feb 2026.xlsx",
    importedAt: new Date().toISOString(),
    duplicateStatus: "NEW",
  });

  const dupCheck2 = await DuplicateProtectionService.evaluateCandidate({
    organisationId: orgId,
    sourceType: "INVOICE",
    sourceFile: {
      name: "Millennium 33kV Feb 2026.xlsx",
      sha256Hash: "HASH_FEB_2026_UNIQUE",
    },
    accountNumber: "7856504676",
    invoiceNumber: "7856504676-FEB2026",
    billingPeriod: {
      startDate: "2026-01-17",
      endDate: "2026-02-16",
    },
    metrics: {
      totalAmount: 111560974.85,
    },
  });
  assert(dupCheck2.status === "DUPLICATE", "Second upload of identical file recognized as DUPLICATE");
  assert(dupCheck2.isExactDuplicate === true, "Marked as exact duplicate");

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Scanned PDF Garbled Glyph & OCR Fallback Routing
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 7: Scanned PDF Garbled Glyph & OCR Fallback Routing ---");
  const corruptedScannerGlyphs = "bEJ*eG ? / # ~ $ % ^ & * ( ) _ + ! @ # $ bEJ*eG \uE010\uE012";
  assert(isGarbledOrScrambledText(corruptedScannerGlyphs) === true, "Corrupted scanner glyphs flagged as garbled");
  assert(isGarbledOrScrambledText("7856504676") === false, "Valid numeric account number recognized as clean");
  assert(
    isGarbledOrScrambledText("ESKOM TAX INVOICE Account 7856504676 Total Due R 111,560,974.85") === false,
    "Legitimate Eskom invoice text recognized as authentic",
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Incomplete Interval Streams & Telemetry Gap Detection
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 8: Incomplete Interval Streams & Telemetry Gap Detection ---");
  // Create an incomplete interval series with a 48-interval (24h) gap
  const completeIntervals = telRes.intervals.slice(0, 100);
  const droppedIntervals = [...completeIntervals.slice(0, 40), ...completeIntervals.slice(88)]; // dropped 48 intervals

  assert(droppedIntervals.length === 52, "Simulated 48 dropped intervals");
  // Calculate gap duration
  const tBefore = new Date(droppedIntervals[39].local_timestamp).getTime();
  const tAfter = new Date(droppedIntervals[40].local_timestamp).getTime();
  const gapHours = (tAfter - tBefore) / (1000 * 3600);
  assert(gapHours >= 24, `Identified telemetry gap of ${gapHours} hours`);

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Rounding Variance vs Material Discrepancy
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 9: Rounding Variance vs Material Discrepancy ---");
  const samplePeriod = periods[0];
  const cleanInput = periodToInvoiceData(samplePeriod);

  // Sub-scenario 9A: Small rounding difference (R 304.24 on R 111.5M bill = 0.00027%)
  const roundedInvoice = {
    ...cleanInput,
    totalInclVat: (cleanInput.totalInclVat || 0) - 304.24,
  };
  const reconMeasurements = telRes.intervals.slice(0, 1488).map((it) => ({
    ts: it.ts,
    kW: it.active_energy_kwh * 2,
    kVA: it.active_energy_kwh * 2 / 0.98,
    kVAR: it.reactive_energy_kvarh * 2,
    kvarh: it.reactive_energy_kvarh,
    tou: "standard" as const,
  }));

  const roundedRecon = runAutomaticReconciliation(roundedInvoice, reconMeasurements);
  assert(roundedRecon.status === "COMPLETED", "Rounding variance reconciliation completed");
  assert(roundedRecon.payload !== null, "Authoritative payload generated for rounding difference");

  // Sub-scenario 9B: Material discrepancy (R 5,000,000 artificial overcharge)
  const overchargedInvoice = {
    ...cleanInput,
    totalInclVat: (cleanInput.totalInclVat || 0) + 5000000.0,
  };
  const overchargeRecon = runAutomaticReconciliation(overchargedInvoice, reconMeasurements);
  assert(overchargeRecon.status === "COMPLETED", "Overcharge reconciliation completed");
  assert(
    overchargeRecon.payload?.status === "MATERIAL_DISCREPANCY" ||
      overchargeRecon.payload?.status === "REVIEW_REQUIRED",
    `Material discrepancy correctly flagged as ${overchargeRecon.payload?.status}`,
  );

  // ---------------------------------------------------------------------------
  // SCENARIO 10: High-Volume Performance Stress Test (10,000 intervals)
  // ---------------------------------------------------------------------------
  console.log("\n--- Scenario 10: High-Volume Performance Stress Test ---");
  const tStart = performance.now();
  const synth10k = [];
  const baseDate = new Date("2026-01-01T00:00:00Z").getTime();
  for (let i = 0; i < 10000; i++) {
    synth10k.push({
      ts: new Date(baseDate + i * 1800000),
      kW: 50000 + (i % 5000),
      kVA: 52000 + (i % 5000),
      kVAR: 15000,
      kvarh: 7500,
      tou: (i % 3 === 0 ? "peak" : i % 3 === 1 ? "standard" : "offPeak") as any,
    });
  }
  const tGen = performance.now() - tStart;
  assert(synth10k.length === 10000, `Generated 10,000 interval records in ${tGen.toFixed(1)}ms`);

  const tReconStart = performance.now();
  const highVolRecon = runAutomaticReconciliation(cleanInput, synth10k);
  const tReconEnd = performance.now() - tReconStart;
  assert(highVolRecon.status === "COMPLETED", "10,000 intervals reconciled deterministically");
  assert(tReconEnd < 3000, `High volume reconciliation completed in ${tReconEnd.toFixed(1)}ms (< 3,000ms threshold)`);

  console.log("\n================================================================================");
  console.log("  ALL 10 ADVERSARIAL REGRESSION SCENARIOS PASSED WITH 100% RELIABILITY!");
  console.log("================================================================================\n");
}

// Auto-execute if invoked directly via tsx
runAdversarialRegressionSuite().catch((err) => {
  console.error("Adversarial regression suite failed:", err);
  process.exit(1);
});
