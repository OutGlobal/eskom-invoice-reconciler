import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { Download, FileJson, FileText, FileSpreadsheet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Panel,
  MetricCard,
  ZAR,
  NUM,
  useBootstrapMeter,
  useDerived,
} from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";
import { exportToCsv, exportToJson } from "@/lib/exportReports";
import {
  downloadDetailedPdfReport,
  downloadDetailedWorkbook,
  type DetailedReportInput,
  type ReportTimelinePoint,
} from "@/lib/reportBuilders";
import { buildStandardReconciliationTable } from "@/lib/reconciliation";

import { InvoiceSelector } from "@/components/InvoiceSelector";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reconciliation Reports & Audit Exports — ENERA" },
      {
        name: "description",
        content:
          "Generate detailed utility billing reconciliation reports with corporate charts, billing timelines, and PDF or Excel downloads.",
      },
      { property: "og:title", content: "Reconciliation Reports & Audit Exports — ENERA" },
      {
        property: "og:description",
        content:
          "Detailed reconciliation reporting with charge-level variance charts, billing timelines, and PDF/Excel exports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  useBootstrapMeter();
  const { totals, charges, calculatedTotal } = useDerived();
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const invoice = useApp((s) => s.invoice);
  const invoiceLines = useApp((s) => s.invoiceLines);
  const invoiceItems = useApp((s) => s.invoiceItems);
  const batchInvoices = useApp((s) => s.batchInvoices);

  const diff = invoiceTotal - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;

  const invoicesToCompare =
    batchInvoices && batchInvoices.length > 0 ? batchInvoices : invoice ? [invoice] : [];

  const reconRows = buildStandardReconciliationTable(
    invoiceLines,
    charges,
    invoice?.vat ?? undefined,
    invoice?.invoiceTotal || invoiceTotal,
  );
  const exportRows = reconRows.map((r) => ({
    charge: r.charge,
    calculated: r.calculated,
    invoice: r.invoice,
    varianceR: r.varianceR,
    variancePct: r.variancePct,
    status: r.statusText,
    reason: r.reason,
  }));

  const timeline: ReportTimelinePoint[] = useMemo(
    () =>
      invoicesToCompare.map((inv, idx) => ({
        label: inv.accountMonth || inv.billingPeriod || `Period ${idx + 1}`,
        invoiceNumber: inv.invoiceNo || inv.invoiceNumber || undefined,
        billingPeriod:
          inv.billingPeriod ||
          (inv.billingPeriodStart || inv.billingPeriodEnd
            ? `${inv.billingPeriodStart || "—"} to ${inv.billingPeriodEnd || "—"}`
            : undefined),
        totalKWh: inv.totalKWh || 0,
        maxDemandKVA: inv.maxDemandKVA || inv.simMaxDemand || 0,
        invoicedExclVat: inv.invoiceTotal || 0,
      })),
    [invoicesToCompare],
  );

  const varianceChartData = useMemo(
    () =>
      reconRows
        .filter((r) => r.calculated > 0 || r.invoice > 0)
        .slice(0, 14)
        .map((r) => ({
          name: r.charge.length > 22 ? `${r.charge.slice(0, 21)}…` : r.charge,
          calculated: Number(r.calculated.toFixed(2)),
          invoiced: Number((r.invoice > 0 ? r.invoice : 0).toFixed(2)),
          variance: Number((r.invoice > 0 ? r.varianceR : 0).toFixed(2)),
        })),
    [reconRows],
  );

  const reportInput: DetailedReportInput = {
    invoice,
    rows: exportRows,
    lineItems: invoiceItems,
    consumption: {
      peakKWh: totals.peakKWh,
      standardKWh: totals.standardKWh,
      offPeakKWh: totals.offPeakKWh,
      totalKWh: totals.totalKWh,
      maxDemandKVA: totals.maxDemandKVA,
      maxDemandAt: totals.maxDemandAt ?? null,
    },
    calculatedTotal,
    invoiceTotal,
    timeline,
  };

  const hasData = exportRows.length > 0 || timeline.length > 0;

  const handleExportExcel = () => {
    if (!hasData) {
      toast.error("Upload an invoice and meter data before generating reports");
      return;
    }
    downloadDetailedWorkbook(reportInput);
    toast.success("Detailed Excel report downloaded");
  };

  const handleExportPdf = () => {
    if (!hasData) {
      toast.error("Upload an invoice and meter data before generating reports");
      return;
    }
    downloadDetailedPdfReport(reportInput);
    toast.success("Detailed PDF report downloaded");
  };

  const handleExportCsv = () => {
    exportToCsv(invoice, exportRows);
    toast.success("CSV report downloaded");
  };

  const handleExportJson = () => {
    exportToJson(invoice);
    toast.success("JSON extracted data downloaded");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold">Reconciliation Reports &amp; Audit Exports</h1>
          <p className="text-xs text-muted-foreground">
            Export full enterprise reconciliation packages in Excel, PDF, JSON, and CSV formats.
          </p>
        </div>
        <InvoiceSelector />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={handleExportExcel}
          className="text-left rounded-lg border border-border bg-card p-5 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Excel Package (.xlsx)</div>
              <div className="text-xs text-muted-foreground">
                Metadata, 15-point recon table, and line items.
              </div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>

        <button
          onClick={handleExportPdf}
          className="text-left rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:bg-primary/5 transition group block w-full"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">Full Report (.pdf)</div>
              <div className="text-xs text-muted-foreground">
                Branded pack: summary, variance chart, tables, timeline.
              </div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>

        <button
          onClick={handleExportJson}
          className="text-left rounded-lg border border-border bg-card p-5 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-cyan-500/10 p-2 text-cyan-400">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">JSON Data (.json)</div>
              <div className="text-xs text-muted-foreground">
                Normalized JSON for API or ERP integration.
              </div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>

        <button
          onClick={handleExportCsv}
          className="text-left rounded-lg border border-border bg-card p-5 hover:border-border/80 hover:bg-secondary/60 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-secondary p-2 text-foreground">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">CSV File (.csv)</div>
              <div className="text-xs text-muted-foreground">
                Comma-separated reconciliation variance table.
              </div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>
      </div>

      <Panel
        title="Session Reconciliation Overview"
        subtitle="Key metrics for active invoice reconciliation session."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Calculated Total" value={ZAR(calculatedTotal)} accent />
          <MetricCard
            label="Eskom Invoice Total"
            value={invoiceTotal ? ZAR(invoiceTotal) : "Awaiting invoice"}
          />
          <MetricCard label="Variance Amount" value={invoiceTotal ? ZAR(diff) : "—"} />
          <MetricCard label="% Error" value={invoiceTotal ? `${pctErr.toFixed(2)}%` : "—"} />
        </div>
      </Panel>

      <Panel
        title="Historical Utility Billing Comparison Matrix"
        subtitle="Side-by-side audit tracking consumption, demand, and invoiced charges across extracted billing periods."
      >
        {invoicesToCompare.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-border rounded-lg space-y-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                No Billing Records Available for Comparison
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Ingest multiple utility tax invoices to populate cross-period audit matrices,
                multi-month demand tracking, and statutory variance reporting.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <a
                href="/upload"
                className="px-3.5 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-md"
              >
                Upload Invoices
              </a>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2.5">Billing Month</th>
                  <th className="text-left px-3 py-2.5">Invoice Number</th>
                  <th className="text-left px-3 py-2.5">Billing Period</th>
                  <th className="text-right px-3 py-2.5">Total Consumption (kWh)</th>
                  <th className="text-right px-3 py-2.5">Max Demand (kVA)</th>
                  <th className="text-right px-3 py-2.5">Invoiced Total (excl VAT)</th>
                  <th className="text-right px-3 py-2.5">Total Incl. VAT (15%)</th>
                  <th className="text-center px-3 py-2.5">Recon Verdict</th>
                  <th className="text-right px-3 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoicesToCompare.map((inv, idx) => {
                  const totalKwh = inv.totalKWh || 0;
                  const maxDemand = inv.maxDemandKVA || inv.simMaxDemand || 0;
                  const exclVat = inv.invoiceTotal || 0;
                  const inclVat = inv.totalInclVat || (exclVat > 0 ? exclVat * 1.15 : 0);

                  return (
                    <tr
                      key={inv.invoiceNo || inv.invoiceNumber || idx}
                      className="hover:bg-muted/40 transition"
                    >
                      <td className="px-3 py-2.5 font-medium">
                        {inv.accountMonth || "Current Period"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {inv.invoiceNo || inv.invoiceNumber || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {inv.billingPeriod ||
                          `${inv.billingPeriodStart || "—"} to ${inv.billingPeriodEnd || "—"}`}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {NUM(totalKwh, 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {NUM(maxDemand, 2)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-medium">
                        {ZAR(exclVat)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                        {ZAR(inclVat)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                          🟢 Reconciled
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => {
                            useApp.getState().setInvoice(inv);
                            toast.success(
                              `Loaded ${inv.accountMonth || "invoice"} into active session`,
                            );
                          }}
                          className="text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded px-2 py-1 font-medium transition"
                        >
                          Load Session
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
