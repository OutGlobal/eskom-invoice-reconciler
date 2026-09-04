import * as XLSX from "xlsx";
import { DisputePackDocumentData } from "./types";

export function generateExcelDisputePackWorkbook(data: DisputePackDocumentData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // SHEET 1: Executive Summary & Overview
  const execRows = [
    ["OFFICIAL ELECTRICITY INVOICE RECONCILIATION & DISPUTE DOSSIER"],
    ["Generated At", new Date().toISOString()],
    ["Report Version", data.tariffInfo.version],
    ["Reconciliation Run ID", data.auditInfo.runId],
    [],
    ["1. CUSTOMER & SITE INFORMATION"],
    ["Customer Name", data.customerInfo.customerName],
    ["Account Number", data.customerInfo.accountNumber],
    ["Premise ID", data.customerInfo.premiseId],
    ["Physical Address", data.customerInfo.physicalAddress],
    [],
    ["2. INVOICE & METER INFORMATION"],
    ["Invoice Number", data.invoiceInfo.invoiceNumber],
    ["Invoice Date", data.invoiceInfo.invoiceDate],
    ["Meter Serial Number", data.meterInfo.meterNumber],
    ["CT Ratio", data.meterInfo.ctRatio],
    ["Billing Period Start", data.billingPeriod.startDate],
    ["Billing Period End", data.billingPeriod.endDate],
    [],
    ["3. FINANCIAL SUMMARY (ZAR)"],
    ["Billed Invoice Total (ZAR)", data.executiveSummary.totalBilledZar],
    ["Calculated Tariff Total (ZAR)", data.executiveSummary.totalCalculatedZar],
    ["Net Disputed Overcharge (ZAR)", data.executiveSummary.totalDisputedVarianceZar],
    ["Variance Percentage (%)", `${data.executiveSummary.variancePct}%`],
    ["Reconciliation Status", data.executiveSummary.reconciliationStatus],
    [],
    ["4. DATA QUALITY ASSESSMENT"],
    ["Overall Data Quality Score", `${data.qualityAssessment.overallQualityScorePct}%`],
    ["Telemetry Completeness", `${data.qualityAssessment.telemetryCompletenessPct}%`],
    ["Invoice OCR Confidence", `${data.qualityAssessment.invoiceExtractionConfidencePct}%`],
  ];

  const wsExec = XLSX.utils.aoa_to_sheet(execRows);
  wsExec["!cols"] = [{ wch: 32 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsExec, "Executive Summary");

  // SHEET 2: Billed vs Calculated Matrix
  const matrixHeaders = [
    "Billing Component",
    "Extracted Billed (ZAR)",
    "Calculated Tariff (ZAR)",
    "Variance (ZAR)",
    "Status",
  ];
  const matrixDataRows = data.summaryMatrix.map((item) => [
    item.component,
    item.billedZar,
    item.calculatedZar,
    item.varianceZar,
    item.status,
  ]);
  const wsMatrix = XLSX.utils.aoa_to_sheet([matrixHeaders, ...matrixDataRows]);
  wsMatrix["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsMatrix, "Billed vs Calculated");

  // SHEET 3: Detailed Discrepancy Schedule
  const discHeaders = [
    "Claim ID",
    "Discrepancy Category",
    "Severity",
    "Extracted Billed (ZAR)",
    "Calculated Tariff (ZAR)",
    "Disputed Overcharge (ZAR)",
    "Detailed Evidence & Audit Note",
  ];
  const discDataRows = data.discrepancySchedule.map((d) => [
    d.claimId,
    d.category,
    d.severity,
    d.billedZar,
    d.calculatedZar,
    d.disputedOverchargeZar,
    d.evidenceText,
  ]);
  const wsDisc = XLSX.utils.aoa_to_sheet([discHeaders, ...discDataRows]);
  wsDisc["!cols"] = [{ wch: 14 }, { wch: 32 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 24 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, wsDisc, "Discrepancy Schedule");

  // SHEET 4: Tariff Clause References & Trace
  const tariffHeaders = [
    "Clause Identifier",
    "Source Document",
    "Section Title",
    "Gazetted Clause Text / Verification Status",
    "Verified in Gazette",
  ];
  const tariffDataRows = data.tariffRuleReferences.map((t) => [
    t.clauseIdentifier,
    t.sourceDocumentName,
    t.sectionTitle,
    t.clauseContentText,
    t.isVerified ? "VERIFIED" : "UNVERIFIED (MISSING REFERENCE)",
  ]);
  const wsTariff = XLSX.utils.aoa_to_sheet([tariffHeaders, ...tariffDataRows]);
  wsTariff["!cols"] = [{ wch: 32 }, { wch: 45 }, { wch: 35 }, { wch: 70 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsTariff, "Tariff Clause References");

  // SHEET 5: Cryptographic Audit & File Hashes
  const auditRows = [
    ["CRYPTOGRAPHIC AUDIT & LINEAGE LEDGER"],
    ["Reconciliation Run ID", data.auditInfo.runId],
    ["Ledger Sequence Number", data.auditInfo.ledgerSequenceNumber],
    ["Run Snapshot SHA-256 Hash", data.auditInfo.snapshotHash],
    ["Previous Event Hash", data.auditInfo.previousEventHash],
    ["Current Event Hash", data.auditInfo.currentEventHash],
    ["Calculation Engine Version", data.auditInfo.engineVersion],
    ["Parser Adapter Version", data.auditInfo.parserVersion],
    [],
    ["SOURCE FILE CRYPTOGRAPHIC FINGERPRINTS"],
    ["File Name", "File Size (Bytes)", "SHA-256 Cryptographic Hash", "Import Timestamp"],
    ...data.sourceFileInfo.map((f) => [f.fileName, f.fileSizeBytes, f.sha256Hash, f.importedAt]),
  ];
  const wsAudit = XLSX.utils.aoa_to_sheet(auditRows);
  wsAudit["!cols"] = [{ wch: 35 }, { wch: 20 }, { wch: 68 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsAudit, "Audit & SHA-256 Lineage");

  return wb;
}
