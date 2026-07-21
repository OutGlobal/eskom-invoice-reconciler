import * as XLSX from "xlsx";
import type { InvoiceData, InvoiceLineItemStored } from "./store";

export interface ReconciliationRowExport {
  charge: string;
  calculated: number;
  invoice: number;
  varianceR: number;
  variancePct: number;
  status: string;
  reason?: string;
}

export function exportToExcel(
  invoice: InvoiceData | null,
  rows: ReconciliationRowExport[],
  lineItems: InvoiceLineItemStored[],
  filenamePrefix = "Eskom_Reconciliation_Report"
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary & Metadata
  const metaData = [
    ["ESKOM INVOICE RECONCILIATION REPORT"],
    ["Generated At", new Date().toLocaleString()],
    [],
    ["CUSTOMER & INVOICE METADATA"],
    ["Customer Name", invoice?.customerName || "—"],
    ["Account Number", invoice?.accountNumber || "—"],
    ["Tax Invoice Number", invoice?.invoiceNo || invoice?.taxInvoiceNo || "—"],
    ["Invoice Number", invoice?.invoiceNumber || "—"],
    ["Premise ID", invoice?.premiseId || "—"],
    ["Meter Number", invoice?.meterNumber || "—"],
    ["Tariff Name", invoice?.tariffName || "—"],
    ["Region / Billing Office", `${invoice?.region || "—"} / ${invoice?.billingOffice || "—"}`],
    ["Billing Period", invoice?.billingPeriod || "—"],
    ["Billing Date / Due Date", `${invoice?.billingDate || "—"} / ${invoice?.dueDate || "—"}`],
    ["VAT Registration No", invoice?.vatReg || "—"],
    ["Notified Max Demand (kVA)", invoice?.nmd || "—"],
    ["Utilised Capacity (kVA)", invoice?.utilisedCapacity || "—"],
    ["Load Factor (%)", invoice?.loadFactor ? `${invoice.loadFactor}%` : "—"],
    [],
    ["CONSUMPTION DATA"],
    ["Peak Energy (kWh)", invoice?.peakKWh || 0],
    ["Standard Energy (kWh)", invoice?.standardKWh || 0],
    ["Off-Peak Energy (kWh)", invoice?.offPeakKWh || 0],
    ["Total Energy (kWh)", invoice?.totalKWh || 0],
    ["Demand Peak (kVA)", invoice?.demandPeak || 0],
    ["Demand Std (kVA)", invoice?.demandStd || 0],
    ["Demand Off-Peak (kVA)", invoice?.demandOffPeak || 0],
    ["Max Demand (kVA)", invoice?.maxDemandKVA || 0],
    ["Reactive Total (kVArh)", invoice?.reactiveTotal || 0],
  ];

  const wsMeta = XLSX.utils.aoa_to_sheet(metaData);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Summary & Metadata");

  // Sheet 2: Reconciliation Table
  const reconData = [
    ["Charge Item", "Calculated (R)", "Invoice (R)", "Variance (R)", "Variance (%)", "Status", "Notes / Cause"],
    ...rows.map((r) => [
      r.charge,
      r.calculated,
      r.invoice > 0 ? r.invoice : "Not Found",
      r.invoice > 0 ? r.varianceR : "—",
      r.invoice > 0 ? `${r.variancePct >= 0 ? "+" : ""}${r.variancePct.toFixed(2)}%` : "—",
      r.status,
      r.reason || "",
    ]),
  ];

  const wsRecon = XLSX.utils.aoa_to_sheet(reconData);
  XLSX.utils.book_append_sheet(wb, wsRecon, "Reconciliation Table");

  // Sheet 3: Extracted Charge Line Items (As Printed)
  const lineData = [
    ["Line Item Label", "Normalized Charge Name", "Quantity", "Unit", "Rate (R)", "Amount (R)", "OCR Confidence", "Review Flag"],
    ...lineItems.map((li) => [
      li.label,
      li.normalizedName || "Unmapped",
      li.quantity ?? "—",
      li.unit || "—",
      li.rate ?? "—",
      li.amount,
      li.confidence != null ? `${li.confidence.toFixed(1)}%` : "—",
      li.needsReview ? "Flagged" : "Clear",
    ]),
  ];

  const wsLines = XLSX.utils.aoa_to_sheet(lineData);
  XLSX.utils.book_append_sheet(wb, wsLines, "Extracted Line Items");

  const invNum = invoice?.invoiceNumber || invoice?.invoiceNo || "batch";
  const filename = `${filenamePrefix}_${invNum}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportToCsv(
  invoice: InvoiceData | null,
  rows: ReconciliationRowExport[],
  filenamePrefix = "Eskom_Reconciliation"
) {
  const headers = ["Charge Item", "Calculated (R)", "Invoice (R)", "Variance (R)", "Variance (%)", "Status", "Notes"];
  const csvRows = [
    headers.join(","),
    ...rows.map((r) => [
      `"${r.charge.replace(/"/g, '""')}"`,
      r.calculated.toFixed(2),
      r.invoice > 0 ? r.invoice.toFixed(2) : "",
      r.invoice > 0 ? r.varianceR.toFixed(2) : "",
      r.invoice > 0 ? `${r.variancePct.toFixed(2)}%` : "",
      `"${r.status}"`,
      `"${(r.reason || "").replace(/"/g, '""')}"`,
    ].join(",")),
  ];

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const invNum = invoice?.invoiceNumber || invoice?.invoiceNo || "report";
  a.href = url;
  a.download = `${filenamePrefix}_${invNum}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJson(invoice: InvoiceData | null, filenamePrefix = "Eskom_Invoice_Data") {
  if (!invoice) return;
  const jsonContent = JSON.stringify(invoice.normalizedJson || invoice, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const invNum = invoice.invoiceNumber || invoice.invoiceNo || "data";
  a.href = url;
  a.download = `${filenamePrefix}_${invNum}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPdfPrint() {
  window.print();
}
