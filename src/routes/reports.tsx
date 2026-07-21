import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Download, FileJson, FileText, FileSpreadsheet } from "lucide-react";
import { Panel, MetricCard, ZAR, NUM, useBootstrapMeter, useDerived } from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";
import { exportToExcel, exportToCsv, exportToJson } from "@/lib/exportReports";
import { buildStandardReconciliationTable } from "@/lib/reconciliation";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reconciliation Reports — Eskom Bill Balancer" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  useBootstrapMeter();
  const { rows, totals, charges, calculatedTotal } = useDerived();
  const customer = useApp((s) => s.customer);
  const tariff = useApp((s) => s.tariff);
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const invoice = useApp((s) => s.invoice);
  const invoiceLines = useApp((s) => s.invoiceLines);
  const invoiceItems = useApp((s) => s.invoiceItems);
  const batchInvoices = useApp((s) => s.batchInvoices);

  const diff = invoiceTotal - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;

  const reconRows = buildStandardReconciliationTable(invoiceLines, charges, invoice?.vat, invoice?.invoiceTotal || invoiceTotal);
  const exportRows = reconRows.map((r) => ({
    charge: r.charge,
    calculated: r.calculated,
    invoice: r.invoice,
    varianceR: r.varianceR,
    variancePct: r.variancePct,
    status: r.statusText,
    reason: r.reason,
  }));

  const handleExportExcel = () => {
    exportToExcel(invoice, exportRows, invoiceItems);
    toast.success("Excel report downloaded");
  };

  const handleExportCsv = () => {
    exportToCsv(invoice, exportRows);
    toast.success("CSV report downloaded");
  };

  const handleExportJson = () => {
    exportToJson(invoice);
    toast.success("JSON extracted data downloaded");
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reconciliation Reports &amp; Exports</h1>
        <p className="text-xs text-muted-foreground">
          Export full enterprise reconciliation packages in Excel, PDF, JSON, and CSV formats.
        </p>
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
              <div className="text-xs text-muted-foreground">Metadata, 13-point recon table, and line items.</div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>

        <button
          onClick={handleExportPdf}
          className="text-left rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:bg-primary/5 transition group"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">PDF Report</div>
              <div className="text-xs text-muted-foreground">Print-friendly full reconciliation report.</div>
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
              <div className="text-xs text-muted-foreground">Normalized JSON for API or ERP integration.</div>
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
              <div className="text-xs text-muted-foreground">Comma-separated reconciliation variance table.</div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>
      </div>

      <Panel title="Session Reconciliation Overview" subtitle="Key metrics for active invoice reconciliation session.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Calculated Total" value={ZAR(calculatedTotal)} accent />
          <MetricCard label="Eskom Invoice Total" value={invoiceTotal ? ZAR(invoiceTotal) : "Awaiting invoice"} />
          <MetricCard label="Variance Amount" value={invoiceTotal ? ZAR(diff) : "—"} />
          <MetricCard label="% Error" value={invoiceTotal ? `${pctErr.toFixed(2)}%` : "—"} />
        </div>
      </Panel>

      {batchInvoices.length > 0 && (
        <Panel title="Batch Session Invoices" subtitle={`${batchInvoices.length} extracted invoices available for report export.`}>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Invoice No</th>
                  <th className="text-left px-3 py-2">Customer</th>
                  <th className="text-left px-3 py-2">Tariff</th>
                  <th className="text-right px-3 py-2">Total Charges</th>
                  <th className="text-right px-3 py-2">OCR Confidence</th>
                  <th className="text-left px-3 py-2">Export</th>
                </tr>
              </thead>
              <tbody>
                {batchInvoices.map((inv, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{inv.invoiceNumber || inv.invoiceNo || "—"}</td>
                    <td className="px-3 py-2">{inv.customerName || "—"}</td>
                    <td className="px-3 py-2">{inv.tariffName || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {inv.invoiceTotal ? ZAR(inv.invoiceTotal) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {inv.extraction ? `${inv.extraction.overallConfidence.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <button
                        onClick={() => exportToJson(inv)}
                        className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                      >
                        <FileJson className="h-3 w-3" /> Export JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
