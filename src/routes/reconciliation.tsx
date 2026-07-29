import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import toast from "react-hot-toast";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Edit2,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  useBootstrapMeter,
  useDerived,
  Panel,
  MetricCard,
  PeriodPicker,
  ChargeTable,
  DeficitAnalysis,
  ZAR,
  NUM,
} from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";
import { TOU_COLOR } from "@/lib/tariff";
import { buildStandardReconciliationTable } from "@/lib/reconciliation";
import {
  exportToExcel,
  exportToCsv,
  exportToJson,
  exportToPdfPrint,
} from "@/lib/exportReports";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({ meta: [{ title: "Reconciliation — Eskom Bill Balancer" }] }),
  component: ReconPage,
});

function ReconPage() {
  useBootstrapMeter();
  const { totals, charges, calculatedTotal } = useDerived();
  const nmd = useApp((s) => s.customer.nmd);
  const setCustomer = useApp((s) => s.setCustomer);

  const invoice = useApp((s) => s.invoice);
  const invoiceLines = useApp((s) => s.invoiceLines);
  const invoiceItems = useApp((s) => s.invoiceItems);
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const overrideInvoiceChargeLine = useApp((s) => s.overrideInvoiceChargeLine);
  const loadMarch2026SampleInvoice = useApp((s) => s.loadMarch2026SampleInvoice);

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editVal, setEditVal] = useState<string>("");

  // Build the 13 standard reconciliation table rows
  const reconRows = useMemo(
    () =>
      buildStandardReconciliationTable(
        invoiceLines,
        charges,
        invoice?.vat,
        invoice?.invoiceTotal || invoiceTotal
      ),
    [invoiceLines, charges, invoice, invoiceTotal]
  );

  const matchedCount = reconRows.filter((r) => r.status === "green").length;
  const foundCount = reconRows.filter((r) => r.hasInvoice).length;
  const accuracyPct = foundCount > 0 ? (matchedCount / foundCount) * 100 : 0;

  const diff = (invoiceTotal || invoice?.invoiceTotal || 0) - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;
  const absPct = Math.abs(pctErr);
  const tone: "good" | "warn" | "bad" | undefined = !invoiceTotal
    ? undefined
    : absPct <= 1
    ? "good"
    : absPct < 5
    ? "warn"
    : "bad";

  const energyCmp = [
    { name: "Peak kWh", Invoice: invoice?.peakKWh || 0, Calculated: Math.round(totals.peakKWh) },
    { name: "Standard kWh", Invoice: invoice?.standardKWh || 0, Calculated: Math.round(totals.standardKWh) },
    { name: "Off-Peak kWh", Invoice: invoice?.offPeakKWh || 0, Calculated: Math.round(totals.offPeakKWh) },
    { name: "Total kWh", Invoice: invoice?.totalKWh || 0, Calculated: Math.round(totals.totalKWh) },
  ];

  const demandCmp = [
    { name: "Max Demand kVA", Invoice: invoice?.maxDemandKVA || 0, Calculated: Math.round(totals.maxDemandKVA) },
  ];

  const handleSaveEdit = (chargeName: string) => {
    const num = parseFloat(editVal.replace(/[^0-9.]/g, ""));
    if (isNaN(num)) {
      toast.error("Invalid number format");
      return;
    }
    overrideInvoiceChargeLine(chargeName, num);
    setEditingItem(null);
    toast.success(`Updated ${chargeName} to ${ZAR(num)}`);
  };

  const exportRowsForReport = reconRows.map((r) => ({
    charge: r.charge,
    calculated: r.calculated,
    invoice: r.invoice,
    varianceR: r.varianceR,
    variancePct: r.variancePct,
    status: r.statusText,
    reason: r.reason,
  }));

  return (
    <div className="space-y-6">
      {/* Top Bar with Controls & Export Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Eskom Invoice Reconciliation</h1>
          <p className="text-xs text-muted-foreground">
            Automatic zero-manual-entry reconciliation between raw meter data and the Eskom invoice.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">NMD (kVA)</label>
          <input
            type="number"
            value={nmd}
            onChange={(e) => setCustomer({ nmd: Number(e.target.value) || 0 })}
            className="w-28 bg-transparent border border-border rounded px-2 py-1 text-sm"
          />
          <PeriodPicker />

          {/* Export Action Bar */}
          <div className="flex items-center gap-1.5 border-l border-border pl-3 ml-2">
            <button
              onClick={() => {
                loadMarch2026SampleInvoice();
                toast.success("Loaded Impala March 2026 Eskom Invoice!");
              }}
              className="inline-flex items-center gap-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded px-2.5 py-1 font-medium transition"
              title="Load Impala Platinum Mine March 2026 Invoice Sample"
            >
              Load March 2026 Invoice
            </button>

            <button
              onClick={() => exportToExcel(invoice, exportRowsForReport, invoiceItems)}
              className="inline-flex items-center gap-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded px-2.5 py-1 font-medium transition"
              title="Export Excel Report (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>

            <button
              onClick={() => exportToCsv(invoice, exportRowsForReport)}
              className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 border border-border rounded px-2.5 py-1 font-medium transition"
              title="Export CSV (.csv)"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>

            <button
              onClick={() => exportToJson(invoice)}
              className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 border border-border rounded px-2.5 py-1 font-medium transition"
              title="Export JSON Data (.json)"
            >
              <FileText className="h-3.5 w-3.5" /> JSON
            </button>

            <button
              onClick={exportToPdfPrint}
              className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 border border-border rounded px-2.5 py-1 font-medium transition"
              title="Print / Save PDF"
            >
              <Printer className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Banner */}
      <div
        className={`rounded-lg border p-5 ${
          !invoiceTotal
            ? "border-border bg-card"
            : absPct <= 1
            ? "border-emerald-500/40 bg-emerald-500/5"
            : absPct <= 5
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-red-500/40 bg-red-500/5"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Executive Summary
              {invoice?.extraction && (
                <span
                  className={`text-[10px] rounded px-1.5 py-0.5 font-mono ${
                    invoice.extraction.needsReview
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  OCR: {invoice.extraction.overallConfidence.toFixed(1)}% (
                  {invoice.extraction.documentType})
                </span>
              )}
            </div>
            <div
              className={`text-lg font-semibold mt-0.5 ${
                tone === "good"
                  ? "text-emerald-500"
                  : tone === "bad"
                  ? "text-red-500"
                  : tone === "warn"
                  ? "text-amber-500"
                  : ""
              }`}
            >
              {!invoiceTotal
                ? "Upload Eskom invoice PDF/Scan to auto-reconcile"
                : absPct <= 1
                ? "✓ Eskom Invoice Successfully Reconciled"
                : absPct <= 5
                ? "⚠ Minor Billing Variance Detected"
                : "✗ Invoice Billing Discrepancy Detected"}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Stat label="Invoice Total" value={invoiceTotal ? ZAR(invoiceTotal) : "—"} />
            <Stat label="Calculated" value={ZAR(calculatedTotal)} />
            <Stat label="Difference" value={invoiceTotal ? ZAR(diff) : "—"} />
            <Stat label="% Error" value={invoiceTotal ? `${pctErr.toFixed(2)}%` : "—"} />
            <Stat
              label="Recon Accuracy"
              value={invoiceTotal ? `${accuracyPct.toFixed(0)}% (${matchedCount}/${foundCount})` : "—"}
            />
          </div>
        </div>

        {invoice?.extraction?.needsReview && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Some fields have OCR confidence below 90% or total validation warnings. Review flagged fields in the tables below. Original OCR values are preserved for audit.
            </span>
          </div>
        )}
      </div>

      {/* 13-Row Automatic Reconciliation Table */}
      <Panel
        title="Automated 13-Point Eskom Reconciliation Table"
        subtitle="Every calculated charge auto-compared to invoice value. Green (Match 0%), Amber (Within ±1%), Red (Discrepancy >1%), Grey (Not Found)."
      >
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">Charge Line Item</th>
                <th className="text-right px-3 py-2.5">Calculated Amount</th>
                <th className="text-right px-3 py-2.5">Invoice Amount</th>
                <th className="text-right px-3 py-2.5">Variance (R)</th>
                <th className="text-right px-3 py-2.5">Variance (%)</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Action / Audit</th>
              </tr>
            </thead>
            <tbody>
              {reconRows.map((r) => {
                const isEditing = editingItem === r.charge;
                return (
                  <tr
                    key={r.charge}
                    className={`border-t border-border transition ${
                      r.status === "green"
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : r.status === "amber"
                        ? "bg-amber-500/5 hover:bg-amber-500/10"
                        : r.status === "red"
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : "hover:bg-secondary/40"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium">{r.charge}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{ZAR(r.calculated)}</td>

                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="text"
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            className="w-28 bg-background border border-primary rounded px-1.5 py-0.5 text-xs text-right"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(r.charge)}
                            className="text-emerald-400 hover:text-emerald-300 p-0.5"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : r.hasInvoice ? (
                        ZAR(r.invoice)
                      ) : (
                        <span className="text-muted-foreground italic font-normal">Blank</span>
                      )}
                    </td>

                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.status === "green"
                          ? "text-emerald-500 font-medium"
                          : r.status === "amber"
                          ? "text-amber-500 font-medium"
                          : r.status === "red"
                          ? "text-red-500 font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r.hasInvoice ? ZAR(r.varianceR) : "—"}
                    </td>

                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.status === "green"
                          ? "text-emerald-500 font-medium"
                          : r.status === "amber"
                          ? "text-amber-500 font-medium"
                          : r.status === "red"
                          ? "text-red-500 font-semibold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r.hasInvoice ? `${r.variancePct >= 0 ? "+" : ""}${r.variancePct.toFixed(2)}%` : "—"}
                    </td>

                    <td className="px-3 py-2 text-xs">{r.statusText}</td>

                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{r.reason || (r.hasInvoice ? "Auto-matched" : "Not present on invoice")}</span>
                        <button
                          onClick={() => {
                            setEditingItem(r.charge);
                            setEditVal(r.hasInvoice ? String(r.invoice) : "");
                          }}
                          className="text-muted-foreground hover:text-primary p-0.5 rounded hover:bg-secondary"
                          title="Override value (audit preserved)"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Extracted Invoice Metadata Card */}
      {invoice && (
        <Panel title="Extracted Invoice Summary" subtitle={`Source: ${invoice.source ?? "PDF"} · documentType: ${invoice.extraction?.documentType}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Customer" value={invoice.customerName || "—"} />
            <Info label="Address" value={invoice.address || "—"} />
            <Info label="Account No" value={invoice.accountNumber || "—"} />
            <Info label="Tax Invoice No" value={invoice.taxInvoiceNo || invoice.invoiceNo || "—"} />
            <Info label="Invoice No" value={invoice.invoiceNumber || "—"} />
            <Info label="Document Type" value={invoice.extraction?.documentType || "—"} />
            <Info label="Extraction Confidence" value={invoice.extraction ? `${invoice.extraction.overallConfidence.toFixed(1)}%` : "—"} />
            <Info label="Total Validation" value={invoice.extraction?.totalValidation || "passed"} />
            <Info label="Region" value={invoice.region || "—"} />
            <Info label="Billing Office" value={invoice.billingOffice || "—"} />
            <Info label="Account Month" value={invoice.accountMonth || "—"} />
            <Info label="Billing Date" value={invoice.billingDate || "—"} />
            <Info label="Due Date" value={invoice.dueDate || "—"} />
            <Info label="VAT Reg No" value={invoice.vatReg || "—"} />
            <Info label="Premise ID" value={invoice.premiseId || invoice.meterNumber || "—"} />
            <Info label="Tariff" value={invoice.tariffName || "—"} />
            <Info label="Voltage" value={invoice.voltage || "—"} />
            <Info label="Billing Period" value={invoice.billingPeriod || "—"} />
            <Info label="Notified Max Demand" value={invoice.nmd ? `${NUM(invoice.nmd, 0)} kVA` : "—"} />
            <Info label="Utilised Capacity" value={invoice.utilisedCapacity ? `${NUM(invoice.utilisedCapacity, 0)} kVA` : "—"} />
            <Info label="Load Factor" value={invoice.loadFactor ? `${NUM(invoice.loadFactor, 2)} %` : "—"} />
            <Info label="Simultaneous Max Demand" value={invoice.simMaxDemand ? `${NUM(invoice.simMaxDemand, 2)} kVA` : "—"} />
            <Info label="Peak Energy (kWh)" value={NUM(invoice.peakKWh, 0)} />
            <Info label="Standard Energy (kWh)" value={NUM(invoice.standardKWh, 0)} />
            <Info label="Off-Peak Energy (kWh)" value={NUM(invoice.offPeakKWh, 0)} />
            <Info label="Total Energy (kWh)" value={NUM(invoice.totalKWh, 0)} />
            <Info label="Demand Peak (kVA)" value={invoice.demandPeak ? NUM(invoice.demandPeak, 2) : "—"} />
            <Info label="Demand Std (kVA)" value={invoice.demandStd ? NUM(invoice.demandStd, 2) : "—"} />
            <Info label="Demand Off-Peak (kVA)" value={invoice.demandOffPeak ? NUM(invoice.demandOffPeak, 2) : "—"} />
            <Info label="Reactive Total (kVArh)" value={invoice.reactiveTotal ? NUM(invoice.reactiveTotal, 0) : "—"} />
            <Info label="VAT" value={invoice.vat ? ZAR(invoice.vat) : "—"} />
            <Info label="Total Charges (excl VAT)" value={invoice.invoiceTotal ? ZAR(invoice.invoiceTotal) : "—"} />
            <Info label="Total Due (incl VAT)" value={invoice.totalInclVat ? ZAR(invoice.totalInclVat) : "—"} />
          </div>
        </Panel>
      )}

      {/* Extracted Charge Line Items (As Printed) */}
      {invoice && invoiceItems.length > 0 && (
        <Panel
          title="Extracted Charge Line Items &amp; Rates (As Printed)"
          subtitle={`${invoiceItems.length} billing line item(s) extracted with description, units, quantity, rate, and amount.`}
        >
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Charge Description</th>
                  <th className="text-left px-3 py-2">Normalized Tariff Charge</th>
                  <th className="text-right px-3 py-2">Quantity</th>
                  <th className="text-left px-3 py-2">Unit</th>
                  <th className="text-right px-3 py-2">Rate (R)</th>
                  <th className="text-right px-3 py-2">Amount (R)</th>
                  <th className="text-left px-3 py-2">OCR Confidence</th>
                </tr>
              </thead>
              <tbody>
                {invoiceItems.map((li, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{li.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{li.normalizedName || "Unmapped"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{li.quantity ? NUM(li.quantity, 2) : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{li.unit || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{li.rate ? NUM(li.rate, 4) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{ZAR(li.amount)}</td>
                    <td className="px-3 py-2 text-xs">
                      {li.confidence != null ? (
                        <span className={li.needsReview ? "text-amber-400 font-medium" : "text-emerald-400"}>
                          {li.confidence.toFixed(1)}%{li.needsReview ? " · review" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-secondary/40 font-semibold">
                  <td className="px-3 py-2">TOTAL CHARGES (excl VAT)</td>
                  <td colSpan={4} />
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">
                    {ZAR(invoice.invoiceTotal || invoiceItems.reduce((a, b) => a + b.amount, 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Visual Comparison Charts */}
      {invoice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Invoice vs Calculated · Energy (kWh)">
            <ComparisonBar data={energyCmp} unit="kWh" />
          </Panel>
          <Panel title="Invoice vs Calculated · Demand (kVA)">
            <ComparisonBar data={demandCmp} unit="kVA" />
          </Panel>
        </div>
      )}

      <Panel title="System Calculated Charges Breakdown" subtitle="Rates calculated from Eskom Tariff Structure and interval data (excl. VAT).">
        <ChargeTable charges={charges} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <MetricCard label="System Calculated Total" value={ZAR(calculatedTotal)} accent />
          <MetricCard label="Eskom Invoice Total" value={invoiceTotal ? ZAR(invoiceTotal) : "Awaiting invoice"} />
          <MetricCard label="Variance Amount" value={invoiceTotal ? ZAR(diff) : "—"} tone={tone} />
          <MetricCard
            label="% Error / Verdict"
            value={invoiceTotal ? `${pctErr.toFixed(2)}%  ·  ${absPct <= 1 ? "PASS" : "FAIL"}` : "Awaiting invoice"}
            tone={tone}
            sub={invoiceTotal ? (absPct <= 1 ? "Green · Reconciled" : absPct < 5 ? "Amber · Small variance" : "Red · High variance") : undefined}
          />
        </div>
      </Panel>

      <DeficitAnalysis charges={charges} totals={totals} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium truncate">{value}</div>
    </div>
  );
}

function ComparisonBar({ data, unit }: { data: { name: string; Invoice: number; Calculated: number }[]; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={80} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", fontSize: 12 }}
          formatter={(v: number) => `${NUM(v, 0)} ${unit}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Invoice" fill="#22d3ee" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#22d3ee" />
          ))}
        </Bar>
        <Bar dataKey="Calculated" fill={TOU_COLOR.standard} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
