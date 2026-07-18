import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import {
  useBootstrapMeter, useDerived, Panel, MetricCard, PeriodPicker,
  ChargeTable, DeficitAnalysis, ZAR, NUM,
} from "@/components/dashboard/parts";
import { useApp } from "@/lib/store";
import { TOU_COLOR } from "@/lib/tariff";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({ meta: [{ title: "Reconciliation — Meter Reconciliation" }] }),
  component: ReconPage,
});

function ReconPage() {
  useBootstrapMeter();
  const { totals, charges, calculatedTotal } = useDerived();
  const nmd = useApp((s) => s.customer.nmd);
  const setCustomer = useApp((s) => s.setCustomer);
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const setInvoiceTotal = useApp((s) => s.setInvoiceTotal);
  const invoice = useApp((s) => s.invoice);
  const invoiceLines = useApp((s) => s.invoiceLines);

  const diff = invoiceTotal - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;
  const abs = Math.abs(pctErr);
  const tone: "good" | "warn" | "bad" | undefined = !invoiceTotal ? undefined : abs < 2 ? "good" : abs < 5 ? "warn" : "bad";
  const verdict = !invoiceTotal ? "Awaiting invoice" : abs < 2 ? "PASS" : "FAIL";

  // Variance table across the standard reconciliation dimensions
  const rows = useMemo(() => reconciliationRows(invoice, invoiceLines, totals, charges), [invoice, invoiceLines, totals, charges]);
  const matches = rows.filter((r) => r.status === "match").length;
  const variances = rows.filter((r) => r.status !== "match" && r.hasInvoice).length;
  const accuracy = rows.length ? (matches / rows.filter((r) => r.hasInvoice).length) * 100 : 0;

  const energyCmp = [
    { name: "Peak kWh", Invoice: invoice?.peakKWh || 0, Calculated: Math.round(totals.peakKWh) },
    { name: "Standard kWh", Invoice: invoice?.standardKWh || 0, Calculated: Math.round(totals.standardKWh) },
    { name: "Off-Peak kWh", Invoice: invoice?.offPeakKWh || 0, Calculated: Math.round(totals.offPeakKWh) },
    { name: "Total kWh", Invoice: invoice?.totalKWh || 0, Calculated: Math.round(totals.totalKWh) },
  ];
  const demandCmp = [
    { name: "Max Demand kVA", Invoice: invoice?.maxDemandKVA || 0, Calculated: Math.round(totals.maxDemandKVA) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reconciliation</h1>
          <p className="text-xs text-muted-foreground">Automatic comparison between raw meter data and the Eskom invoice.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">NMD (kVA)</label>
          <input type="number" value={nmd} onChange={(e) => setCustomer({ nmd: Number(e.target.value) || 0 })}
            className="w-28 bg-transparent border border-border rounded px-2 py-1 text-sm" />
          <PeriodPicker />
        </div>
      </div>

      {/* Executive summary banner */}
      <div className={`rounded-lg border p-5 ${!invoiceTotal ? "border-border bg-card" : abs < 2 ? "border-emerald-500/40 bg-emerald-500/5" : abs < 5 ? "border-amber-500/40 bg-amber-500/5" : "border-red-500/40 bg-red-500/5"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Executive Summary</div>
            <div className={`text-lg font-semibold ${tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-red-500" : tone === "warn" ? "text-amber-500" : ""}`}>
              {!invoiceTotal ? "Upload Eskom invoice PDF to auto-reconcile"
                : abs < 2 ? "✓ Billing Period Successfully Reconciled"
                : abs < 5 ? "⚠ Minor Variance Detected"
                : "✗ Invoice Reconciliation Failed"}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Stat label="Invoice Total" value={invoiceTotal ? ZAR(invoiceTotal) : "—"} />
            <Stat label="Calculated" value={ZAR(calculatedTotal)} />
            <Stat label="Difference" value={invoiceTotal ? ZAR(diff) : "—"} />
            <Stat label="% Error" value={invoiceTotal ? `${pctErr.toFixed(2)}%` : "—"} />
            <Stat label="Accuracy" value={invoiceTotal ? `${accuracy.toFixed(0)}% (${matches}/${matches + variances})` : "—"} />
          </div>
        </div>
      </div>

      {invoice && (
        <Panel title="Extracted Invoice Summary" subtitle={`Source: ${invoice.source ?? "PDF"} · auto-parsed`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Customer" value={invoice.customerName || "—"} />
            <Info label="Account" value={invoice.accountNumber || "—"} />
            <Info label="Meter" value={invoice.meterNumber || "—"} />
            <Info label="Tariff" value={invoice.tariffName || "—"} />
            <Info label="Voltage" value={invoice.voltage || "—"} />
            <Info label="NMD" value={invoice.nmd ? `${NUM(invoice.nmd, 0)} kVA` : "—"} />
            <Info label="Billing Period" value={invoice.billingPeriod || "—"} />
            <Info label="Max Demand" value={invoice.maxDemandKVA ? `${NUM(invoice.maxDemandKVA, 0)} kVA` : "—"} />
            <Info label="Peak kWh" value={NUM(invoice.peakKWh, 0)} />
            <Info label="Standard kWh" value={NUM(invoice.standardKWh, 0)} />
            <Info label="Off-Peak kWh" value={NUM(invoice.offPeakKWh, 0)} />
            <Info label="Total kWh" value={NUM(invoice.totalKWh, 0)} />
            <Info label="VAT" value={invoice.vat ? ZAR(invoice.vat) : "—"} />
            <Info label="Invoice (excl VAT)" value={invoice.invoiceTotal ? ZAR(invoice.invoiceTotal) : "—"} />
            <Info label="Total (incl VAT)" value={invoice.totalInclVat ? ZAR(invoice.totalInclVat) : "—"} />
            <Info label="Reactive" value={invoice.reactive ? ZAR(invoice.reactive) : "—"} />
          </div>
        </Panel>
      )}

      {/* Automatic variance table */}
      <Panel title="Automatic Variance Analysis" subtitle="Every calculated value auto-matched to its invoice counterpart.">
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Invoice</th>
                <th className="text-right px-3 py-2">Calculated</th>
                <th className="text-right px-3 py-2">Difference</th>
                <th className="text-right px-3 py-2">% Δ</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Likely Cause</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.item}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.hasInvoice ? r.fmt(r.invoice) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.fmt(r.calc)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${statusClass(r.status)}`}>{r.hasInvoice ? r.fmt(r.invoice - r.calc) : "—"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${statusClass(r.status)}`}>{r.hasInvoice ? `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(2)}%` : "—"}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} hasInvoice={r.hasInvoice} /></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.hasInvoice && r.status !== "match" ? r.reason : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

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

      <Panel title="Calculated Charges" subtitle="Rates from the extracted Eskom Tariff Book (excl. VAT).">
        <ChargeTable charges={charges} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <MetricCard label="Calculated Total" value={ZAR(calculatedTotal)} accent />
          <div className="rounded-md border border-border bg-card p-4">
            <div className="text-xs uppercase text-muted-foreground">Eskom Invoice Total (excl VAT)</div>
            <input type="number" value={invoiceTotal || ""} placeholder="Auto-filled from PDF"
              onChange={(e) => setInvoiceTotal(Number(e.target.value) || 0)}
              className="mt-2 w-full bg-transparent border border-border rounded px-2 py-1 text-lg font-semibold" />
          </div>
          <MetricCard label="Difference" value={invoiceTotal ? ZAR(diff) : "—"} tone={tone} />
          <MetricCard label="% Error / Verdict"
            value={invoiceTotal ? `${pctErr.toFixed(2)}%  ·  ${verdict}` : verdict}
            tone={tone}
            sub={invoiceTotal ? (abs < 2 ? "Green · Match" : abs < 5 ? "Amber · Small variance" : "Red · Large variance") : undefined}
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

type Status = "match" | "minor" | "major" | "none";
function statusClass(s: Status) {
  return s === "match" ? "text-emerald-500" : s === "minor" ? "text-amber-500" : s === "major" ? "text-red-500" : "";
}
function StatusBadge({ status, hasInvoice }: { status: Status; hasInvoice: boolean }) {
  if (!hasInvoice) return <span className="text-xs text-muted-foreground">no invoice value</span>;
  const map: Record<Status, string> = {
    match: "🟢 Match",
    minor: "🟡 Minor variance",
    major: "🔴 Significant variance",
    none: "—",
  };
  return <span className={`text-xs ${statusClass(status)}`}>{map[status]}</span>;
}

interface Row {
  item: string;
  invoice: number;
  calc: number;
  pct: number;
  hasInvoice: boolean;
  status: Status;
  reason: string;
  fmt: (n: number) => string;
}

function reconciliationRows(
  invoice: ReturnType<typeof useApp.getState>["invoice"],
  invoiceLines: Record<string, number>,
  totals: { peakKWh: number; standardKWh: number; offPeakKWh: number; totalKWh: number; maxDemandKVA: number },
  charges: { label: string; amount: number }[],
): Row[] {
  const chargeMap: Record<string, number> = Object.fromEntries(charges.map((c) => [c.label, c.amount]));
  const kwh = (n: number) => `${NUM(n, 0)} kWh`;
  const kva = (n: number) => `${NUM(n, 0)} kVA`;

  const mk = (item: string, inv: number, calc: number, fmt: (n: number) => string, unit: "energy" | "demand" | "money"): Row => {
    const hasInvoice = inv > 0;
    const pct = calc ? ((inv - calc) / calc) * 100 : 0;
    const abs = Math.abs(pct);
    const status: Status = !hasInvoice ? "none" : abs < 0.5 ? "match" : abs < 5 ? "minor" : "major";
    let reason = "";
    if (hasInvoice && status !== "match") {
      const dir = inv > calc ? "higher" : "lower";
      if (unit === "energy") reason = `Invoice ${dir} than meter. Check for missing intervals, TOU misclassification, or holiday calendar drift.`;
      else if (unit === "demand") reason = `Invoice ${dir} than meter. Possible demand spike outside sampled window or incorrect chargeable demand rule.`;
      else reason = `Invoice ${dir} than calc. Check tariff rate, NMD, or subsidy applicability.`;
    }
    return { item, invoice: inv, calc, pct, hasInvoice, status, reason, fmt };
  };

  return [
    mk("Peak Energy", invoice?.peakKWh || 0, totals.peakKWh, kwh, "energy"),
    mk("Standard Energy", invoice?.standardKWh || 0, totals.standardKWh, kwh, "energy"),
    mk("Off-Peak Energy", invoice?.offPeakKWh || 0, totals.offPeakKWh, kwh, "energy"),
    mk("Total Energy", invoice?.totalKWh || 0, totals.totalKWh, kwh, "energy"),
    mk("Maximum Demand", invoice?.maxDemandKVA || 0, totals.maxDemandKVA, kva, "demand"),
    mk("Transmission Network Charge", invoiceLines["Transmission Network Charge"] || 0, chargeMap["Transmission Network Charge"] || 0, ZAR, "money"),
    mk("Distribution Network Capacity Charge", invoiceLines["Distribution Network Capacity Charge"] || 0, chargeMap["Distribution Network Capacity Charge"] || 0, ZAR, "money"),
    mk("Generation Capacity Charge", invoiceLines["Generation Capacity Charge"] || 0, chargeMap["Generation Capacity Charge"] || 0, ZAR, "money"),
    mk("Network Demand Charge", invoiceLines["Network Demand Charge"] || 0, chargeMap["Network Demand Charge"] || 0, ZAR, "money"),
    mk("Peak Energy Charge", invoiceLines["Peak Energy"] || 0, chargeMap["Peak Energy"] || 0, ZAR, "money"),
    mk("Standard Energy Charge", invoiceLines["Standard Energy"] || 0, chargeMap["Standard Energy"] || 0, ZAR, "money"),
    mk("Off-Peak Energy Charge", invoiceLines["Off-Peak Energy"] || 0, chargeMap["Off-Peak Energy"] || 0, ZAR, "money"),
    mk("Ancillary Service Charge", invoiceLines["Ancillary Service Charge"] || 0, chargeMap["Ancillary Service Charge"] || 0, ZAR, "money"),
    mk("Legacy Charge", invoiceLines["Legacy Charge"] || 0, chargeMap["Legacy Charge"] || 0, ZAR, "money"),
    mk("Affordability Subsidy", invoiceLines["Affordability Subsidy"] || 0, chargeMap["Affordability Subsidy"] || 0, ZAR, "money"),
    mk("Electrification & Rural Subsidy", invoiceLines["Electrification & Rural Subsidy"] || 0, chargeMap["Electrification & Rural Subsidy"] || 0, ZAR, "money"),
  ];
}

function ComparisonBar({ data, unit }: { data: { name: string; Invoice: number; Calculated: number }[]; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
        <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={80} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", fontSize: 12 }}
          formatter={(v: number) => `${NUM(v, 0)} ${unit}`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Invoice" fill="#22d3ee" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill="#22d3ee" />)}
        </Bar>
        <Bar dataKey="Calculated" fill={TOU_COLOR.standard} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
