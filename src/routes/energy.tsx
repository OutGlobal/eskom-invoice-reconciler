import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useBootstrapMeter,
  useDerived,
  Panel,
  MetricCard,
  TotalsRow,
  PeriodPicker,
  EnergyLineChart,
  TouBarChart,
  NUM,
} from "@/components/dashboard/parts";
import { TOU_COLOR } from "@/lib/tariff";
import { useApp } from "@/lib/store";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { InvoiceSelector } from "@/components/InvoiceSelector";

export const Route = createFileRoute("/energy")({
  head: () => ({ meta: [{ title: "Energy Analysis — Meter Reconciliation" }] }),
  component: EnergyPage,
});

type Bucket = "day" | "week" | "month" | "period";

export function EnergyPage() {
  useBootstrapMeter();
  const { rows, totals } = useDerived();
  const validation = useApp((s) => s.validation);
  const invoice = useApp((s) => s.invoice);
  const billingStart = useApp((s) => s.billingStart);
  const billingEnd = useApp((s) => s.billingEnd);
  const setBilling = useApp((s) => s.setBilling);

  const [bucket, setBucket] = useState<Bucket>("period");
  const [customStart, setCustomStart] = useState<string>(billingStart || "2026-02-17");
  const [customEnd, setCustomEnd] = useState<string>(billingEnd || "2026-03-18");

  const filteredByBucket = useMemo(() => {
    if (!rows.length) return rows;
    if (bucket === "period") {
      const s = new Date(`${customStart}T00:00:00Z`).getTime();
      const e = new Date(`${customEnd}T23:59:59Z`).getTime();
      return rows.filter((r) => {
        const t = r.ts.getTime();
        return t >= s && t <= e;
      });
    }
    const last = rows[rows.length - 1].ts;
    let start: Date;
    if (bucket === "day") start = startOfDay(last);
    else if (bucket === "week") start = startOfWeek(last, { weekStartsOn: 1 });
    else start = startOfMonth(last);
    return rows.filter((r) => r.ts >= start);
  }, [rows, bucket, customStart, customEnd]);

  const bucketTotals = useMemo(() => {
    let p = 0,
      s = 0,
      o = 0;
    for (const r of filteredByBucket) {
      const kWh = r.kW * 0.5;
      if (r.tou === "peak") p += kWh;
      else if (r.tou === "standard") s += kWh;
      else o += kWh;
    }
    return { peakKWh: p, standardKWh: s, offPeakKWh: o, totalKWh: p + s + o };
  }, [filteredByBucket]);

  const displayTotals = bucket === "period" ? (bucketTotals.totalKWh > 0 ? bucketTotals : totals) : bucketTotals;

  // Comparison figures with Eskom Invoice
  const invoicePeakKWh = invoice?.peakKWh ?? 6401924.4;
  const invoiceStdKWh = invoice?.standardKWh ?? 19432557.6;
  const invoiceOffKWh = invoice?.offPeakKWh ?? 23429967.6;
  const invoiceTotalKWh = invoice?.totalKWh ?? (invoicePeakKWh + invoiceStdKWh + invoiceOffKWh);

  const comparisonData = [
    {
      label: "Peak Energy",
      tou: "peak" as const,
      meterKWh: displayTotals.peakKWh,
      eskomKWh: invoicePeakKWh,
      varianceKWh: displayTotals.peakKWh - invoicePeakKWh,
      variancePct: invoicePeakKWh > 0 ? ((displayTotals.peakKWh - invoicePeakKWh) / invoicePeakKWh) * 100 : 0,
      color: TOU_COLOR.peak,
    },
    {
      label: "Standard Energy",
      tou: "standard" as const,
      meterKWh: displayTotals.standardKWh,
      eskomKWh: invoiceStdKWh,
      varianceKWh: displayTotals.standardKWh - invoiceStdKWh,
      variancePct: invoiceStdKWh > 0 ? ((displayTotals.standardKWh - invoiceStdKWh) / invoiceStdKWh) * 100 : 0,
      color: TOU_COLOR.standard,
    },
    {
      label: "Off-Peak Energy",
      tou: "offPeak" as const,
      meterKWh: displayTotals.offPeakKWh,
      eskomKWh: invoiceOffKWh,
      varianceKWh: displayTotals.offPeakKWh - invoiceOffKWh,
      variancePct: invoiceOffKWh > 0 ? ((displayTotals.offPeakKWh - invoiceOffKWh) / invoiceOffKWh) * 100 : 0,
      color: TOU_COLOR.offPeak,
    },
  ];

  const totalVarianceKWh = displayTotals.totalKWh - invoiceTotalKWh;
  const totalVariancePct = invoiceTotalKWh > 0 ? (totalVarianceKWh / invoiceTotalKWh) * 100 : 0;

  const touData = [
    { period: "Peak", value: displayTotals.peakKWh, color: TOU_COLOR.peak },
    { period: "Standard", value: displayTotals.standardKWh, color: TOU_COLOR.standard },
    { period: "Off-Peak", value: displayTotals.offPeakKWh, color: TOU_COLOR.offPeak },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold">Meter Data: Energy Consumption (units: kW)</h1>
          <p className="text-xs text-muted-foreground">
            30-minute interval active power (kW) &amp; monthly active energy (kWh) compared against Eskom Invoice
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/demand"
            className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
          >
            Convert to Demand Consumption (kVA) →
          </a>
          <InvoiceSelector />
        </div>
      </div>

      {/* Filter and Date Range Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["day", "week", "month", "period"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`px-3 py-1.5 capitalize font-medium ${
                  bucket === b ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {b === "period" ? "Billing Range" : b}
              </button>
            ))}
          </div>

          {bucket === "period" && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted-foreground">Start:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setBilling(e.target.value, customEnd);
                }}
                className="bg-background border border-border px-2 py-1 rounded text-xs"
              />
              <span className="text-muted-foreground">End:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setBilling(customStart, e.target.value);
                }}
                className="bg-background border border-border px-2 py-1 rounded text-xs"
              />
            </div>
          )}
        </div>
        <PeriodPicker />
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Peak Energy" value={`${NUM(displayTotals.peakKWh, 0)} kWh`} />
        <MetricCard label="Standard Energy" value={`${NUM(displayTotals.standardKWh, 0)} kWh`} />
        <MetricCard label="Off-Peak Energy" value={`${NUM(displayTotals.offPeakKWh, 0)} kWh`} />
        <MetricCard label="Total Monthly Energy" value={`${NUM(displayTotals.totalKWh, 0)} kWh`} accent />
      </section>

      {/* Graph 1.a: Energy Consumption (units: kW) */}
      <Panel
        title="Energy Consumption"
        subtitle={`Units: kW · Interval Active Power Measurements · Range: ${customStart} to ${customEnd}`}
      >
        <EnergyLineChart rows={filteredByBucket} />
      </Panel>

      {/* Comparison Table 1.b: Energy Consumption by TOU compared with Eskom Invoice */}
      <Panel
        title="Energy Consumption: Standard, Peak & Off-Peak [kWh] vs Eskom Invoice"
        subtitle="1.b Deterministic comparison of monthly interval measurements against Eskom billed active energy"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="py-2.5 px-3 font-semibold">TOU Period</th>
                <th className="py-2.5 px-3 font-semibold text-right">Meter Telemetry [kWh]</th>
                <th className="py-2.5 px-3 font-semibold text-right">Eskom Invoice [kWh]</th>
                <th className="py-2.5 px-3 font-semibold text-right">Variance [kWh]</th>
                <th className="py-2.5 px-3 font-semibold text-right">Variance [%]</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {comparisonData.map((row) => {
                const isMatch = Math.abs(row.varianceKWh) < 1.0;
                return (
                  <tr key={row.label} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                      {row.label}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium">{NUM(row.meterKWh, 1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{NUM(row.eskomKWh, 1)}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-semibold ${
                      isMatch ? "text-muted-foreground" : row.varianceKWh > 0 ? "text-amber-500" : "text-emerald-500"
                    }`}>
                      {row.varianceKWh > 0 ? `+${NUM(row.varianceKWh, 1)}` : NUM(row.varianceKWh, 1)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-medium ${
                      isMatch ? "text-muted-foreground" : "text-amber-500"
                    }`}>
                      {row.variancePct > 0 ? `+${row.variancePct.toFixed(2)}%` : `${row.variancePct.toFixed(2)}%`}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        isMatch
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      }`}>
                        {isMatch ? "Clean Match" : "Discrepancy"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Total Monthly Energy Row */}
              <tr className="bg-muted/60 font-bold border-t-2 border-border">
                <td className="py-3 px-3">Total for the Month (ALL Peak + Standard + Off-Peak)</td>
                <td className="py-3 px-3 text-right font-mono text-primary">{NUM(displayTotals.totalKWh, 1)} kWh</td>
                <td className="py-3 px-3 text-right font-mono">{NUM(invoiceTotalKWh, 1)} kWh</td>
                <td className={`py-3 px-3 text-right font-mono font-bold ${
                  Math.abs(totalVarianceKWh) < 1.0 ? "text-emerald-500" : "text-amber-500"
                }`}>
                  {totalVarianceKWh > 0 ? `+${NUM(totalVarianceKWh, 1)}` : NUM(totalVarianceKWh, 1)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-amber-500">
                  {totalVariancePct > 0 ? `+${totalVariancePct.toFixed(2)}%` : `${totalVariancePct.toFixed(2)}%`}
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                    Audited Total
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Energy Consumption by TOU (kWh)">
          <TouBarChart data={touData} unit="kWh" />
          <TotalsRow
            unit="kWh"
            items={[
              { label: "Peak", v: displayTotals.peakKWh },
              { label: "Standard", v: displayTotals.standardKWh },
              { label: "Off-Peak", v: displayTotals.offPeakKWh },
              { label: "Total", v: displayTotals.totalKWh, strong: true },
            ]}
          />
        </Panel>
        <Panel title="Data Validation" subtitle="Checks against the raw meter file.">
          <ul className="space-y-2 text-sm">
            {validation.map((v, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded border border-border px-3 py-2"
              >
                <span className={v.severity === "error" ? "text-red-500" : "text-amber-500"}>
                  {v.message}
                </span>
                {v.count !== undefined && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {v.count} row(s)
                  </span>
                )}
              </li>
            ))}
            {!validation.length && <li className="text-muted-foreground">No file loaded.</li>}
            <li className="text-xs text-muted-foreground pt-2">
              Loaded rows: {rows.length.toLocaleString()} · First:{" "}
              {rows[0] ? format(rows[0].ts, "dd MMM HH:mm") : "—"} · Last:{" "}
              {rows.at(-1) ? format(rows.at(-1)!.ts, "dd MMM HH:mm") : "—"}
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
