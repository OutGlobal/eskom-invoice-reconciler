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
  wsDisc["!cols"] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 65 },
  ];
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

  // OPTIONAL MULTI-PERIOD SHEETS (for multi-month statistical workbooks)
  if (Array.isArray(data.monthlyPeriods) && data.monthlyPeriods.length > 0) {
    for (const p of data.monthlyPeriods) {
      const sheetTitle = (p.sheetName || "Period").substring(0, 31);
      const periodRows = [
        [`ESKOM TOU BILLING DETERMINANTS & RECONCILIATION — ${p.sheetName || "MONTHLY PERIOD"}`],
        ["Customer Name", p.customerName || data.customerInfo.customerName],
        ["Account Number", p.accountNumber || data.customerInfo.accountNumber],
        ["Billing Period", p.billingPeriod || `${p.billingStart} to ${p.billingEnd}`],
        ["Tariff & Voltage", `${p.tariff || "Megaflex"} @ ${p.voltage || "33kV"}`],
        ["Feeders", Array.isArray(p.feeders) ? p.feeders.join(", ") : "N/A"],
        [],
        ["1. ACTIVE ENERGY DETERMINANTS", "Peak", "Standard", "Off-Peak", "Total kWh", "Source Lineage"],
        [
          "Active Energy [kWh]",
          p.activeEnergy?.peakKwh ?? 0,
          p.activeEnergy?.standardKwh ?? 0,
          p.activeEnergy?.offPeakKwh ?? 0,
          p.activeEnergy?.totalKwh ?? 0,
          p.activeEnergy?.lineage?.total || "Workbook Extraction",
        ],
        [],
        ["2. REACTIVE ENERGY & EXCESS VARS", "Peak", "Standard", "Off-Peak", "Total kVarh", "Source Lineage"],
        [
          "Reactive Energy [kVarh]",
          p.reactiveEnergy?.peakKvarh ?? 0,
          p.reactiveEnergy?.standardKvarh ?? 0,
          p.reactiveEnergy?.offPeakKvarh ?? 0,
          p.reactiveEnergy?.totalKvarh ?? 0,
          p.reactiveEnergy?.lineage?.total || "Workbook Extraction",
        ],
        [
          "Excess Vars [kVarh]",
          p.excessVars?.peakKvarh ?? 0,
          p.excessVars?.standardKvarh ?? 0,
          p.excessVars?.offPeakKvarh ?? 0,
          p.excessVars?.totalKvarh ?? 0,
          p.excessVars?.lineage?.total || "Workbook Extraction",
        ],
        [],
        ["3. MAXIMUM DEMAND (Strict Aggregation Rule: MAX across TOU periods, NEVER the sum)", "Peak", "Standard", "Off-Peak", "Billed Maximum", "Occurrence Dates"],
        [
          "Max Demand [kW]",
          p.maxDemandKw?.peakKw ?? 0,
          p.maxDemandKw?.standardKw ?? 0,
          p.maxDemandKw?.offpeakKw ?? 0,
          p.maxDemandKw?.total ?? 0,
          `Pk: ${p.maxDemandKw?.peakDate || "-"}, Std: ${p.maxDemandKw?.standardDate || "-"}`,
        ],
        [
          "Max Demand [kVA]",
          p.maxDemandKva?.peakKva ?? 0,
          p.maxDemandKva?.standardKva ?? 0,
          p.maxDemandKva?.offPeakKva ?? p.maxDemandKva?.offpeakKva ?? 0,
          p.maxDemandKva?.total ?? 0,
          `Pk: ${p.maxDemandKva?.peakDate || "-"}, Std: ${p.maxDemandKva?.standardDate || "-"}`,
        ],
        [],
        ["4. CHARGE RECONSTRUCTION (ZAR)", "Rate Applied", "Billed Determinant", "Charge Amount (ZAR)"],
        ["Peak Energy Charge", "c/kWh", p.activeEnergy?.peakKwh ?? 0, p.charges?.peakEnergy ?? 0],
        ["Standard Energy Charge", "c/kWh", p.activeEnergy?.standardKwh ?? 0, p.charges?.standardEnergy ?? 0],
        ["Off-Peak Energy Charge", "c/kWh", p.activeEnergy?.offPeakKwh ?? 0, p.charges?.offPeakEnergy ?? 0],
        ["Network Demand Charge", "R/kVA", p.maxDemandKva?.total ?? 0, p.charges?.networkDemand ?? 0],
        ["Transmission Network Charge", "R/kVA", p.maxDemandKva?.total ?? 0, p.charges?.transmissionNetwork ?? 0],
        ["Distribution Network Capacity", "R/kVA", p.maxDemandKva?.total ?? 0, p.charges?.networkCapacity ?? 0],
        ["Generation Capacity Charge", "R/kVA", p.maxDemandKva?.total ?? 0, p.charges?.generationCapacity ?? 0],
        ["Ancillary Service Charge", "c/kWh", p.activeEnergy?.totalKwh ?? 0, p.charges?.ancillaryService ?? 0],
        ["Legacy Charge", "c/kWh", p.activeEnergy?.totalKwh ?? 0, p.charges?.legacy ?? 0],
        ["Affordability Subsidy", "c/kWh", p.activeEnergy?.totalKwh ?? 0, p.charges?.affordabilitySubsidy ?? 0],
        ["Electrification Subsidy", "c/kWh", p.activeEnergy?.totalKwh ?? 0, p.charges?.electrificationSubsidy ?? 0],
        ["Service & Admin Charges", "R/day", p.daysInPeriod ?? 30, (p.charges?.serviceCharge || 0) + (p.charges?.administrationCharge || 0)],
        ["Excess Reactive Charges", "c/kVarh", p.excessVars?.totalKvarh ?? 0, p.charges?.excessReactive ?? 0],
        ["Fixed Connection Charges", "lot", 1, p.charges?.connectionCharges ?? 0],
        [],
        ["SUBTOTAL (EXCL. VAT)", "", "", p.charges?.subtotalBeforeVat ?? 0],
        ["VALUE ADDED TAX (15%)", "", "", p.charges?.vatAmount ?? 0],
        ["TOTAL INVOICE AMOUNT DUE (ZAR)", "", "", p.charges?.totalInvoiceAmount ?? 0],
      ];

      const wsPeriod = XLSX.utils.aoa_to_sheet(periodRows);
      wsPeriod["!cols"] = [{ wch: 35 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, wsPeriod, sheetTitle);
    }
  }

  return wb;
}
