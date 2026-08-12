import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Download, FileJson, FileText, FileSpreadsheet } from "lucide-react";
import {
  Panel,
  MetricCard,
  ZAR,
  NUM,
  useBootstrapMeter,
  useDerived,
} from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";
import { exportToExcel, exportToCsv, exportToJson } from "@/lib/exportReports";
import { buildStandardReconciliationTable } from "@/lib/reconciliation";

import { InvoiceSelector } from "@/components/InvoiceSelector";

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

  const reconRows = buildStandardReconciliationTable(
    invoiceLines,
    charges,
    invoice?.vat,
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
                Metadata, 13-point recon table, and line items.
              </div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </button>

        <a
          href="/system_architecture_report.pdf"
          download="Eskom_Bill_Balancer_System_Architecture_and_Formulas.pdf"
          className="text-left rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:bg-primary/5 transition group block"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-sm">System Architecture PDF</div>
              <div className="text-xs text-muted-foreground">
                Download full technical &amp; audit formula PDF.
              </div>
            </div>
            <Download className="ml-auto h-4 w-4 opacity-60 group-hover:opacity-100" />
          </div>
        </a>

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
        title="4-Month Impala Platinum Mine Eskom Billing Comparison Matrix"
        subtitle="Side-by-side historical audit tracking consumption, demand, and invoiced charges across all 4 extracted billing periods."
      >
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
              <tr className="hover:bg-muted/40 transition">
                <td className="px-3 py-2.5 font-medium">February 2026</td>
                <td className="px-3 py-2.5 font-mono text-xs">785101497007</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  17/01/2026 - 16/02/2026
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(49264449.6, 0)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(87034.19, 2)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-medium">{ZAR(97009239.11)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                  {ZAR(111560624.98)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                    🟢 Reconciled
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => {
                      useApp.getState().loadFeb2026SampleInvoice();
                      toast.success("Loaded February 2026 Invoice into session!");
                    }}
                    className="text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded px-2 py-1 font-medium transition"
                  >
                    Load Session
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-muted/40 transition">
                <td className="px-3 py-2.5 font-medium">March 2026</td>
                <td className="px-3 py-2.5 font-mono text-xs">7856504676</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  17/02/2026 - 18/03/2026
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(49248061.2, 0)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(92948.29, 2)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-medium">{ZAR(98380358.13)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                  {ZAR(113137411.85)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                    🟢 Reconciled
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => {
                      useApp.getState().loadMarch2026SampleInvoice();
                      toast.success("Loaded March 2026 Invoice into session!");
                    }}
                    className="text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded px-2 py-1 font-medium transition"
                  >
                    Load Session
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-muted/40 transition">
                <td className="px-3 py-2.5 font-medium">April 2026</td>
                <td className="px-3 py-2.5 font-mono text-xs">785684906677</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  19/03/2026 - 16/04/2026
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(44148796.8, 0)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(85760.81, 2)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-medium">{ZAR(91251855.72)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                  {ZAR(104939634.08)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-500/30">
                    🟢 Reconciled (Split Rates)
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => {
                      useApp.getState().loadApril2026SampleInvoice();
                      toast.success("Loaded April 2026 Invoice into session!");
                    }}
                    className="text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded px-2 py-1 font-medium transition"
                  >
                    Load Session
                  </button>
                </td>
              </tr>

              <tr className="hover:bg-muted/40 transition">
                <td className="px-3 py-2.5 font-medium">May 2026</td>
                <td className="px-3 py-2.5 font-mono text-xs">785595072130</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  17/04/2026 - 16/05/2026
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(45766884.0, 0)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                  {NUM(84529.33, 2)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-medium">{ZAR(97169250.0)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                  {ZAR(111744637.5)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-400 border border-purple-500/30">
                    🟢 Reconciled
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => {
                      useApp.getState().loadMay2026SampleInvoice();
                      toast.success("Loaded May 2026 Invoice into session!");
                    }}
                    className="text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded px-2 py-1 font-medium transition"
                  >
                    Load Session
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
