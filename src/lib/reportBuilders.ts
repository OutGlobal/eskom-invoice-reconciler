/**
 * Corporate Report Builders
 * Generates detailed, audit-grade reconciliation reports in PDF and Excel formats
 * strictly from uploaded/derived data. No values are fabricated.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { InvoiceData, InvoiceLineItemStored } from "./store";
import type { ReconciliationRowExport } from "./exportReports";

export interface ReportConsumption {
  peakKWh: number;
  standardKWh: number;
  offPeakKWh: number;
  totalKWh: number;
  maxDemandKVA: number;
  maxDemandAt?: Date | string | null;
}

export interface ReportTimelinePoint {
  label: string;
  invoiceNumber?: string;
  billingPeriod?: string;
  totalKWh: number;
  maxDemandKVA: number;
  invoicedExclVat: number;
  calculated?: number;
  variance?: number;
}

export interface DetailedReportInput {
  invoice: InvoiceData | null;
  rows: ReconciliationRowExport[];
  lineItems: InvoiceLineItemStored[];
  consumption: ReportConsumption;
  calculatedTotal: number;
  invoiceTotal: number;
  timeline: ReportTimelinePoint[];
  generatedBy?: string;
}

const BRAND = { r: 16, g: 42, b: 67 };
const ACCENT = { r: 13, g: 148, b: 136 };

const money = (v: number) =>
  `R ${(Number.isFinite(v) ? v : 0).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const num = (v: number, d = 2) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("en-ZA", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

function fileStamp(invoice: InvoiceData | null) {
  const inv = invoice?.invoiceNumber || invoice?.invoiceNo || "session";
  return `${inv}_${new Date().toISOString().slice(0, 10)}`;
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

export function buildDetailedPdfReport(input: DetailedReportInput): jsPDF {
  const { invoice, rows, lineItems, consumption, calculatedTotal, invoiceTotal, timeline } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const variance = invoiceTotal - calculatedTotal;
  const variancePct = invoiceTotal ? (variance / invoiceTotal) * 100 : 0;

  // ---- Cover banner
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, W, 132, "F");
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, 132, W, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(20);
  doc.text("Utility Billing Reconciliation Report", M, 56);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(
    `Generated ${new Date().toLocaleString("en-ZA")}  ·  Prepared for ${
      invoice?.customerName || "uploaded account"
    }`,
    M,
    76,
  );
  doc.text(
    `Account ${invoice?.accountNumber || "—"}   ·   Tax invoice ${
      invoice?.invoiceNo || invoice?.invoiceNumber || "—"
    }   ·   Period ${invoice?.billingPeriod || "—"}`,
    M,
    94,
  );
  doc.text("Confidential — internal financial assurance document", M, 112);
  doc.setTextColor(30, 30, 30);

  // ---- Executive KPI strip
  let y = 160;
  const kpis: [string, string][] = [
    ["Calculated total", money(calculatedTotal)],
    ["Invoiced total", invoiceTotal ? money(invoiceTotal) : "Awaiting invoice"],
    ["Variance", invoiceTotal ? money(variance) : "—"],
    ["Variance %", invoiceTotal ? `${variancePct.toFixed(2)}%` : "—"],
  ];
  const cardW = (W - M * 2 - 24) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (cardW + 8);
    doc.setDrawColor(215, 220, 226).setFillColor(247, 249, 251);
    doc.roundedRect(x, y, cardW, 56, 4, 4, "FD");
    doc.setFontSize(7.5).setTextColor(110, 118, 128).setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x + 10, y + 19);
    doc.setFontSize(11).setTextColor(20, 24, 30).setFont("helvetica", "bold");
    doc.text(value, x + 10, y + 39);
  });
  y += 82;

  // ---- Variance bar visual (per charge)
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("Charge-level variance profile (calculated vs invoiced)", M, y);
  y += 12;
  const chartRows = rows.slice(0, 12);
  const maxVal = Math.max(1, ...chartRows.map((r) => Math.max(r.calculated, r.invoice)));
  const barW = (W - M * 2 - 150) / Math.max(1, chartRows.length);
  const chartH = 110;
  const baseY = y + chartH;
  doc.setDrawColor(225, 229, 234);
  doc.line(M, baseY, W - M, baseY);
  chartRows.forEach((r, i) => {
    const x = M + 150 * 0 + i * barW + 6;
    const cH = (r.calculated / maxVal) * chartH;
    const iH = (Math.max(r.invoice, 0) / maxVal) * chartH;
    doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    doc.rect(x, baseY - cH, barW * 0.34, cH, "F");
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(x + barW * 0.38, baseY - iH, barW * 0.34, iH, "F");
    doc.setFontSize(5.6).setTextColor(90, 96, 104);
    const label = r.charge.length > 14 ? `${r.charge.slice(0, 13)}…` : r.charge;
    doc.text(label, x, baseY + 10, { angle: 32, maxWidth: 52 } as any);
  });
  doc.setFontSize(7.5).setTextColor(90, 96, 104);
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(W - M - 130, y - 8, 8, 8, "F");
  doc.text("Calculated", W - M - 118, y - 1);
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(W - M - 60, y - 8, 8, 8, "F");
  doc.text("Invoiced", W - M - 48, y - 1);
  y = baseY + 52;

  const tableTheme = {
    theme: "grid" as const,
    styles: { fontSize: 8, cellPadding: 4, lineColor: [226, 230, 235] as any },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b] as any, textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] as any },
    margin: { left: M, right: M },
    rowPageBreak: "avoid" as const,
  };

  /** Draws a section heading, adding a page when there is no room for content below it */
  const section = (title: string, minSpace = 140, spacing = 26) => {
    const H = doc.internal.pageSize.getHeight();
    let sy = ((doc as any).lastAutoTable?.finalY ?? y) + spacing;
    if (sy > H - minSpace) {
      doc.addPage();
      sy = 64;
    }
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(BRAND.r, BRAND.g, BRAND.b);
    doc.text(title, M, sy);
    doc.setFont("helvetica", "normal").setTextColor(30, 30, 30);
    return sy + 10;
  };

  autoTable(doc, {
    ...tableTheme,
    startY: section("1. Account and invoice metadata", 160, 0),
    head: [["Field", "Value"]],
    body: [
      ["Customer", invoice?.customerName || "—"],
      ["Account number", invoice?.accountNumber || "—"],
      ["Tax invoice number", invoice?.invoiceNo || invoice?.taxInvoiceNo || "—"],
      ["Premise ID", invoice?.premiseId || "—"],
      ["Meter number", invoice?.meterNumber || "—"],
      ["Tariff", invoice?.tariffName || "—"],
      ["Region / billing office", `${invoice?.region || "—"} / ${invoice?.billingOffice || "—"}`],
      ["Billing period", invoice?.billingPeriod || "—"],
      ["Billing date / due date", `${invoice?.billingDate || "—"} / ${invoice?.dueDate || "—"}`],
      ["VAT registration", invoice?.vatReg || "—"],
      ["Notified maximum demand (kVA)", invoice?.nmd ? num(invoice.nmd) : "—"],
    ],
    didDrawPage: () => undefined,
  });

  autoTable(doc, {
    ...tableTheme,
    startY: section("2. Metered consumption determinants"),
    head: [["Consumption determinant", "Value"]],
    body: [
      ["Peak energy (kWh)", num(consumption.peakKWh, 0)],
      ["Standard energy (kWh)", num(consumption.standardKWh, 0)],
      ["Off-peak energy (kWh)", num(consumption.offPeakKWh, 0)],
      ["Total energy (kWh)", num(consumption.totalKWh, 0)],
      ["Maximum demand (kVA)", num(consumption.maxDemandKVA)],
      [
        "Maximum demand timestamp",
        consumption.maxDemandAt ? new Date(consumption.maxDemandAt).toLocaleString("en-ZA") : "—",
      ],
    ],
  });

  autoTable(doc, {
    ...tableTheme,
    startY: section("3. Charge-level reconciliation"),
    head: [["Charge item", "Calculated (R)", "Invoiced (R)", "Variance (R)", "Variance %", "Status"]],
    body: rows.map((r) => [
      r.charge,
      num(r.calculated),
      r.invoice > 0 ? num(r.invoice) : "Not found",
      r.invoice > 0 ? num(r.varianceR) : "—",
      r.invoice > 0 ? `${r.variancePct >= 0 ? "+" : ""}${r.variancePct.toFixed(2)}%` : "—",
      r.status,
    ]),
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  if (lineItems.length > 0) {
    autoTable(doc, {
      ...tableTheme,
      startY: section("4. Extracted invoice line items"),
      head: [["Invoice line label", "Normalised charge", "Qty", "Unit", "Rate", "Amount (R)", "Flag"]],
      body: lineItems.map((li) => [
        li.label,
        li.normalizedName || "Unmapped",
        li.quantity != null ? num(li.quantity, 2) : "—",
        li.unit || "—",
        li.rate != null ? num(li.rate, 4) : "—",
        num(li.amount),
        li.needsReview ? "Review" : "Clear",
      ]),
      columnStyles: { 5: { halign: "right" } },
    });
  }

  if (timeline.length > 0) {
    autoTable(doc, {
      ...tableTheme,
      head: [
        [
          "Billing month",
          "Invoice number",
          "Period",
          "Energy (kWh)",
          "Max demand (kVA)",
          "Invoiced (R)",
        ],
      ],
      body: timeline.map((t) => [
        t.label,
        t.invoiceNumber || "—",
        t.billingPeriod || "—",
        num(t.totalKWh, 0),
        num(t.maxDemandKVA),
        num(t.invoicedExclVat),
      ]),
      columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
    });
  }

  // ---- Footers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 230, 235);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFontSize(7.5).setTextColor(120, 126, 134).setFont("helvetica", "normal");
    doc.text("Reconciliation report generated from uploaded source documents.", M, H - 20);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 20, { align: "right" });
  }

  return doc;
}

export function downloadDetailedPdfReport(input: DetailedReportInput) {
  const doc = buildDetailedPdfReport(input);
  doc.save(`Reconciliation_Report_${fileStamp(input.invoice)}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Excel                                                               */
/* ------------------------------------------------------------------ */

export function buildDetailedWorkbook(input: DetailedReportInput): XLSX.WorkBook {
  const { invoice, rows, lineItems, consumption, calculatedTotal, invoiceTotal, timeline } = input;
  const variance = invoiceTotal - calculatedTotal;
  const variancePct = invoiceTotal ? (variance / invoiceTotal) * 100 : 0;
  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, aoa: any[][], widths: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  addSheet(
    "Executive Summary",
    [
      ["UTILITY BILLING RECONCILIATION — EXECUTIVE SUMMARY"],
      ["Generated at", new Date().toLocaleString("en-ZA")],
      [],
      ["Customer", invoice?.customerName || "—"],
      ["Account number", invoice?.accountNumber || "—"],
      ["Tax invoice number", invoice?.invoiceNo || invoice?.taxInvoiceNo || "—"],
      ["Billing period", invoice?.billingPeriod || "—"],
      [],
      ["Calculated total (R)", calculatedTotal],
      ["Invoiced total (R)", invoiceTotal],
      ["Variance (R)", invoiceTotal ? variance : "—"],
      ["Variance (%)", invoiceTotal ? Number(variancePct.toFixed(4)) : "—"],
      ["Charge lines reconciled", rows.length],
      ["Invoice line items extracted", lineItems.length],
      ["Billing periods in timeline", timeline.length],
    ],
    [38, 32],
  );

  addSheet(
    "Account Metadata",
    [
      ["Field", "Value"],
      ["Customer", invoice?.customerName || "—"],
      ["Account number", invoice?.accountNumber || "—"],
      ["Tax invoice number", invoice?.invoiceNo || invoice?.taxInvoiceNo || "—"],
      ["Invoice number", invoice?.invoiceNumber || "—"],
      ["Premise ID", invoice?.premiseId || "—"],
      ["Meter number", invoice?.meterNumber || "—"],
      ["Tariff", invoice?.tariffName || "—"],
      ["Region", invoice?.region || "—"],
      ["Billing office", invoice?.billingOffice || "—"],
      ["Billing period", invoice?.billingPeriod || "—"],
      ["Billing date", invoice?.billingDate || "—"],
      ["Due date", invoice?.dueDate || "—"],
      ["VAT registration", invoice?.vatReg || "—"],
      ["Notified maximum demand (kVA)", invoice?.nmd || "—"],
      ["Utilised capacity (kVA)", invoice?.utilisedCapacity || "—"],
    ],
    [34, 40],
  );

  addSheet(
    "Consumption",
    [
      ["Determinant", "Value", "Unit"],
      ["Peak energy", consumption.peakKWh, "kWh"],
      ["Standard energy", consumption.standardKWh, "kWh"],
      ["Off-peak energy", consumption.offPeakKWh, "kWh"],
      ["Total energy", consumption.totalKWh, "kWh"],
      ["Maximum demand", consumption.maxDemandKVA, "kVA"],
      [
        "Maximum demand timestamp",
        consumption.maxDemandAt ? new Date(consumption.maxDemandAt).toLocaleString("en-ZA") : "—",
        "",
      ],
    ],
    [30, 22, 10],
  );

  addSheet(
    "Reconciliation",
    [
      ["Charge item", "Calculated (R)", "Invoiced (R)", "Variance (R)", "Variance (%)", "Status", "Notes / cause"],
      ...rows.map((r) => [
        r.charge,
        r.calculated,
        r.invoice > 0 ? r.invoice : "Not found",
        r.invoice > 0 ? r.varianceR : "—",
        r.invoice > 0 ? Number(r.variancePct.toFixed(4)) : "—",
        r.status,
        r.reason || "",
      ]),
      [],
      ["TOTAL", calculatedTotal, invoiceTotal, invoiceTotal ? variance : "—", ""],
    ],
    [40, 16, 16, 16, 14, 18, 52],
  );

  addSheet(
    "Invoice Line Items",
    [
      ["Line label", "Normalised charge", "Quantity", "Unit", "Rate", "Amount (R)", "OCR confidence", "Review flag"],
      ...lineItems.map((li) => [
        li.label,
        li.normalizedName || "Unmapped",
        li.quantity ?? "—",
        li.unit || "—",
        li.rate ?? "—",
        li.amount,
        li.confidence != null ? Number(li.confidence.toFixed(2)) : "—",
        li.needsReview ? "Flagged" : "Clear",
      ]),
    ],
    [44, 30, 14, 10, 14, 16, 16, 14],
  );

  addSheet(
    "Billing Timeline",
    [
      [
        "Billing month",
        "Invoice number",
        "Billing period",
        "Total energy (kWh)",
        "Max demand (kVA)",
        "Invoiced excl VAT (R)",
        "Calculated (R)",
        "Variance (R)",
      ],
      ...timeline.map((t) => [
        t.label,
        t.invoiceNumber || "—",
        t.billingPeriod || "—",
        t.totalKWh,
        t.maxDemandKVA,
        t.invoicedExclVat,
        t.calculated ?? "—",
        t.variance ?? "—",
      ]),
    ],
    [20, 20, 28, 20, 18, 22, 18, 16],
  );

  return wb;
}

export function downloadDetailedWorkbook(input: DetailedReportInput) {
  const wb = buildDetailedWorkbook(input);
  XLSX.writeFile(wb, `Reconciliation_Report_${fileStamp(input.invoice)}.xlsx`);
}
