import fs from "fs";
import path from "path";
import { SpreadsheetInvoiceExtractor } from "@/domain/invoice/spreadsheetInvoiceExtractor";
import { AmrIntervalIngestionEngine } from "@/domain/telemetry/amrIntervalIngestionEngine";
import { isGarbledOrScrambledText } from "@/lib/pdfInvoice";
import {
  runAutomaticReconciliation,
  runMultiPeriodReconciliation,
  periodToInvoiceData,
} from "@/domain/reconciliation/autoReconciliationRunner";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`TEST FAILED: ${message}`);
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

export async function runReferenceWorkbookTests() {
  console.log("================================================================================");
  console.log("  ESKOM REFERENCE WORKBOOK (FEB-MAY 2026) & MULTI-PERIOD INGESTION TEST SUITE");
  console.log("================================================================================\n");

  const WORKBOOK_PATH =
    "/Users/admin/Downloads/Spreadsheets/Eskom Millennium 33kV Billing Summary Feb - May 2026.xlsx";
  const TELEMETRY_PATH =
    "/Users/admin/Downloads/MOTHEE/New Data/TrendExport_Millennium 33kV 17 Jan - 16 May 2026.xlsx";

  // 1. Scanned PDF Garbled Text & Corrupt Font Protection
  console.log("--- 1. Testing Scanned PDF Garbled Text & OCR Trigger Logic ---");
  assert(isGarbledOrScrambledText(""), "Empty string flagged as garbled");
  assert(
    isGarbledOrScrambledText("bEJ*eG ? / # ~ $ % ^ & * ( ) _ + ! @ # $"),
    "Scrambled printer character soup flagged as garbled",
  );
  assert(
    isGarbledOrScrambledText("\uE001\uE002\uE003\uE004\uE005\uE006\uE007\uE008\uE009\uE010 unmapped glyphs"),
    "Private Use Area unmapped glyphs flagged as garbled",
  );
  assert(
    !isGarbledOrScrambledText(
      "ESKOM HOLDINGS SOC LTD TAX INVOICE Account Number 7856504676 Total Due R 111,560,974.85 Megaflex 33kV",
    ),
    "Legitimate Eskom Tax Invoice text correctly recognized as authentic embedded text",
  );
  assert(!isGarbledOrScrambledText("Impala Platinum Mine"), "Clean customer name recognized as valid");

  // 2. Reference Workbook Extraction (Feb - May 2026)
  console.log("\n--- 2. Testing 4-Month Reference Workbook Ingestion ---");
  if (!fs.existsSync(WORKBOOK_PATH)) {
    console.warn("⚠️ Reference workbook not found at path, skipping disk-dependent tests.");
    return;
  }

  const wbBytes = new Uint8Array(fs.readFileSync(WORKBOOK_PATH));
  const res = await SpreadsheetInvoiceExtractor.extract(
    path.basename(WORKBOOK_PATH),
    wbBytes,
    "test-workbook-job",
  );

  assert(res.success, "Workbook extraction succeeded");
  assert(res.extractedFields !== undefined, "Extracted fields populated");

  const f = res.extractedFields!;
  assert(f.accountNumber === "7856504676", `Account number is 7856504676 (got ${f.accountNumber})`);
  assert(f.customerName === "Impala Platinum Mine", `Customer is Impala Platinum Mine (got ${f.customerName})`);
  assert(f.tariff.includes("Megaflex"), `Tariff contains Megaflex (got ${f.tariff})`);
  assert(f.voltage.replace(/\s+/g, "").toLowerCase() === "33kv", `Voltage is 33kV (got ${f.voltage})`);

  const periods = (f as any).monthlyPeriods;
  const periodNames = periods.map((p: any) => p.sheetName);
  assert(
    periodNames.length === 4 &&
      periodNames.some((n: string) => n.includes("Feb 2026")) &&
      periodNames.some((n: string) => n.includes("Mar 2026")) &&
      periodNames.some((n: string) => n.includes("Apr 2026")) &&
      periodNames.some((n: string) => n.includes("May 2026")),
    `All 4 monthly sheets extracted: ${periodNames.join(", ")}`,
  );

  // Sheet 1: Feb 2026
  console.log("\n--- Validating Sheet 1: Feb 2026 ---");
  const feb = periods[0];
  assert(feb.billingStart === "2026-01-17", `Feb billingStart is 2026-01-17`);
  assert(feb.billingEnd === "2026-02-16", `Feb billingEnd is 2026-02-16`);
  assertCloseTo(feb.activeEnergy.peakKwh, 6401924.41, 1, "Feb Peak Energy kWh");
  assertCloseTo(feb.activeEnergy.standardKwh, 19432557.61, 1, "Feb Standard Energy kWh");
  assertCloseTo(feb.activeEnergy.offPeakKwh, 23429967.61, 1, "Feb Off-Peak Energy kWh");
  assertCloseTo(feb.activeEnergy.totalKwh, 49264449.63, 1, "Feb Total Active Energy kWh");

  // Strict Demand Aggregation Rule: MAX(Peak, Std, Off-Peak), NOT sum
  assertCloseTo(feb.maxDemandKva.peakKva, 85783.18, 1, "Feb Peak Demand kVA");
  assertCloseTo(feb.maxDemandKva.standardKva, 87034.19, 1, "Feb Standard Demand kVA");
  const febOffPeakKva = feb.maxDemandKva.offPeakKva ?? feb.maxDemandKva.offpeakKva;
  assertCloseTo(febOffPeakKva, 85031.36, 1, "Feb Off-Peak Demand kVA");
  assertCloseTo(feb.maxDemandKva.total, 87034.19, 0.1, "Feb Total Max Demand is strictly MAX(Peak, Std, Off-Peak)");
  assert(
    Math.abs(feb.maxDemandKva.total - (feb.maxDemandKva.peakKva + feb.maxDemandKva.standardKva + febOffPeakKva)) > 10000,
    "Strict rule verified: Total Max Demand is NOT the sum of TOU periods",
  );

  // Charges Feb 2026
  assertCloseTo(feb.charges.subtotalBeforeVat, 97009543.35, 2, "Feb Subtotal Before VAT");
  assertCloseTo(feb.charges.vatAmount, 14551431.50, 2, "Feb VAT @ 15%");
  assertCloseTo(feb.charges.totalInvoiceAmount, 111560974.85, 2, "Feb Total Invoiced Due Amount");

  // Sheet 2: Mar 2026
  console.log("\n--- Validating Sheet 2: Mar 2026 ---");
  const mar = periods[1];
  assertCloseTo(mar.activeEnergy.totalKwh, 49248061.21, 1, "Mar Total Active Energy kWh");
  assertCloseTo(mar.maxDemandKva.total, 92948.30, 0.1, "Mar Total Max Demand kVA");
  assertCloseTo(mar.charges.totalInvoiceAmount, 113135957.57, 2, "Mar Total Invoiced Due Amount");

  // Sheet 3: Apr 2026
  console.log("\n--- Validating Sheet 3: Apr 2026 ---");
  const apr = periods[2];
  assertCloseTo(apr.activeEnergy.totalKwh, 44148796.84, 1, "Apr Total Active Energy kWh");
  assertCloseTo(apr.maxDemandKva.total, 85760.81, 0.1, "Apr Total Max Demand kVA");
  assertCloseTo(apr.charges.totalInvoiceAmount, 100546924.10, 2, "Apr Total Invoiced Due Amount");

  // Sheet 4: May 2026
  console.log("\n--- Validating Sheet 4: May 2026 ---");
  const may = periods[3];
  assertCloseTo(may.activeEnergy.totalKwh, 45766884.01, 1, "May Total Active Energy kWh");
  assertCloseTo(may.maxDemandKva.total, 84529.33, 0.1, "May Total Max Demand kVA");
  assertCloseTo(may.charges.totalInvoiceAmount, 103191676.94, 2, "May Total Invoiced Due Amount");

  // 3. Multi-Sheet AMR Interval Telemetry Concatenation
  console.log("\n--- 3. Testing Multi-Sheet AMR Interval Concatenation ---");
  if (!fs.existsSync(TELEMETRY_PATH)) {
    console.warn("⚠️ TrendExport telemetry file not found at path, skipping interval tests.");
    return;
  }

  const telBytes = new Uint8Array(fs.readFileSync(TELEMETRY_PATH));
  const telRes = AmrIntervalIngestionEngine.processIntervalStream(
    path.basename(TELEMETRY_PATH),
    telBytes,
    { sourceFileId: "test-telemetry-job" },
  );

  assert(telRes.success, "AMR telemetry processing succeeded");
  assert(telRes.intervals.length === 5760, `Exactly 5,760 intervals concatenated (got ${telRes.intervals.length})`);

  const firstTs = telRes.intervals[0].local_timestamp;
  const lastTs = telRes.intervals[telRes.intervals.length - 1].local_timestamp;
  assert(firstTs.includes("2026-01-17"), `First interval begins on 2026-01-17 (got ${firstTs})`);
  assert(lastTs.includes("2026-05-1"), `Last interval extends to 2026-05-16/17 (got ${lastTs})`);

  // 4. Multi-Period Automated Reconciliation
  console.log("\n--- 4. Testing Multi-Period Automated Reconciliation ---");
  const measurements = telRes.intervals.map((it) => ({
    ts: it.ts,
    kW: it.active_energy_kwh * 2,
    kVA: it.active_power_kw ? it.active_power_kw / 0.98 : it.active_energy_kwh * 2 / 0.98,
    kVAR: it.reactive_energy_kvarh * 2,
    kvarh: it.reactive_energy_kvarh,
    tou: "standard" as const,
  }));

  const reconResults = runMultiPeriodReconciliation(res.extractedFields, measurements);
  assert(reconResults.length === 4, `Reconciled all 4 monthly periods (got ${reconResults.length})`);

  for (const r of reconResults) {
    assert(r.outcome.status === "COMPLETED", `Period ${r.period} reconciliation completed`);
    assert(r.outcome.payload !== null, `Period ${r.period} has authoritative reconciliation payload`);
    const p = r.outcome.payload!;
    console.log(`   Period [${r.period}]: Status = ${p.status}, Billed = R ${p.billed_total_zar.toFixed(2)}, Calculated = R ${p.calculated_total_zar.toFixed(2)}, Variance = R ${p.variance_total_zar.toFixed(2)} (${p.variance_percentage.toFixed(2)}%), Determinants = ${p.determinant_comparisons?.length || 0}`);
  }

  console.log("\n================================================================================");
  console.log("  ALL REFERENCE WORKBOOK & MULTI-PERIOD TESTS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================\n");
}

// Auto-execute
runReferenceWorkbookTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
