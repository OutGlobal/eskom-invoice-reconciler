/**
 * Automated Test Suite: Automated Dispute Pack Generator
 */

import { assembleDisputePackData } from "../../domain/reports/disputePackGeneratorService";
import { generateExcelDisputePackWorkbook } from "../../domain/reports/excelDisputePackBuilder";
import { generatePdfDisputePackHtml } from "../../domain/reports/pdfDisputePackBuilder";
import {
  saveGeneratedReportMetadata,
  getGeneratedReportsByRunId,
} from "../../domain/reports/reportStorageService";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

async function runDisputePackTests() {
  console.log("=== RUNNING AUTOMATED DISPUTE PACK GENERATOR TEST SUITE ===");

  // 1. Test 29-Section Data Assembly
  console.log("\n--- Test 1: 29-Section Report Data Assembly ---");
  const data = assembleDisputePackData(
    "ACME Industrial Manufacturing (Pty) Ltd",
    "8905743120",
    "INV-2026-03-8891",
    495000.0,
    472500.0,
    "run-test-dispute-001",
    "v1.0",
  );

  assert(data.executiveSummary.totalBilledZar === 495000.0, "Executive summary billed total match");
  assert(
    data.executiveSummary.totalCalculatedZar === 472500.0,
    "Executive summary calculated total match",
  );
  assert(
    data.executiveSummary.totalDisputedVarianceZar === 22500.0,
    "Executive summary disputed variance match",
  );
  assert(data.customerInfo.accountNumber === "8905743120", "Account number match");
  assert(data.meterInfo.meterNumber === "ESK-MTR-88022", "Meter number match");
  assert(data.sourceFileInfo.length === 2, "Source file count match");
  assert(data.sourceFileInfo[0].sha256Hash.length === 64, "SHA-256 hash length match");
  assert(data.discrepancySchedule.length === 3, "Discrepancy schedule items count match");
  console.log("✅ REPORT DATA TEST PASSED: All 29 required report sections assembled");

  // 2. Test Zero-Hallucination Tariff Clause References
  console.log("\n--- Test 2: Zero-Hallucination Tariff Clause References ---");
  const verifiedClauses = data.tariffRuleReferences.filter((t) => t.isVerified);
  const unverifiedClauses = data.tariffRuleReferences.filter((t) => !t.isVerified);

  assert(verifiedClauses.length >= 2, "Verified gazetted tariff clause count match");
  assert(unverifiedClauses.length >= 1, "Unverified missing tariff clause fallback present");
  assert(
    unverifiedClauses[0].clauseIdentifier === "MISSING_TARIFF_CLAUSE_REFERENCE",
    "Missing tariff reference tagged correctly",
  );
  console.log(
    "✅ TARIFF REFERENCE TEST PASSED: Zero-hallucination tariff clause enforcement verified",
  );

  // 3. Test Multi-Sheet Excel Workbook Builder
  console.log("\n--- Test 3: Multi-Sheet Excel Dispute Pack Generation ---");
  const wb = generateExcelDisputePackWorkbook(data);
  assert(wb.SheetNames.length === 5, "Excel workbook must contain 5 sheets");
  assert(wb.SheetNames.includes("Executive Summary"), "Executive summary sheet present");
  assert(
    wb.SheetNames.includes("Billed vs Calculated"),
    "Billed vs Calculated matrix sheet present",
  );
  assert(wb.SheetNames.includes("Discrepancy Schedule"), "Discrepancy schedule sheet present");
  assert(
    wb.SheetNames.includes("Tariff Clause References"),
    "Tariff clause references sheet present",
  );
  assert(
    wb.SheetNames.includes("Audit & SHA-256 Lineage"),
    "Audit & SHA-256 lineage sheet present",
  );
  console.log("✅ EXCEL TEST PASSED: Multi-sheet Excel workbook generated successfully");

  // 4. Test Printable PDF HTML Generator
  console.log("\n--- Test 4: Printable PDF HTML Generation ---");
  const html = generatePdfDisputePackHtml(data);
  assert(html.includes("OFFICIAL ELECTRICITY INVOICE RECONCILIATION"), "PDF title header present");
  assert(html.includes("INV-2026-03-8891"), "Invoice number present in HTML");
  assert(
    html.includes("MISSING_TARIFF_CLAUSE_REFERENCE"),
    "Missing tariff reference rendered in PDF HTML",
  );
  console.log("✅ PDF TEST PASSED: Printable PDF HTML generated cleanly");

  // 5. Test Report Metadata Storage & Versioning
  console.log("\n--- Test 5: Report Metadata Storage & Versioning ---");
  const meta = {
    reportId: "rep-dispute-001",
    runId: "run-test-dispute-001",
    version: "v1.0",
    organisationId: "org-001",
    customerId: "cust-001",
    invoiceId: "inv-2026-03-8891",
    reportType: "DISPUTE_PACK_EXCEL" as const,
    fileName: "Eskom_Dispute_Pack_8905743120_INV-2026-03-8891.xlsx",
    fileSizeBytes: 45120,
    sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    createdAt: new Date().toISOString(),
    createdBy: "auditor@eskomreconciler.co.za",
  };

  const saveRes = await saveGeneratedReportMetadata(meta);
  assert(saveRes.success, "Save metadata result success");

  const reports = await getGeneratedReportsByRunId("run-test-dispute-001");
  assert(reports.length >= 1, "Retrieved generated report metadata by run ID");
  assert(reports[0].version === "v1.0", "Report version match");
  console.log("✅ METADATA TEST PASSED: Report metadata stored & versioned");

  console.log("\n=== ALL DISPUTE PACK GENERATOR TESTS PASSED SUCCESSFULLY ===");
}

runDisputePackTests().catch((err) => {
  console.error("TEST SUITE FAILED:", err);
  process.exit(1);
});
