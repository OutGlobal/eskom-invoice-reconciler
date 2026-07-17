import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useBootstrapMeter, useDerived, Panel, MetricCard, TotalsRow, PeriodPicker,
  EnergyLineChart, TouBarChart, NUM,
} from "@/components/dashboard/parts";
import { TOU_COLOR } from "@/lib/tariff";
import { useApp } from "@/lib/store";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";

export const Route = createFileRoute("/energy")({
  head: () => ({ meta: [{ title: "Energy Analysis — Meter Reconciliation" }] }),
  component: EnergyPage,
});

type Bucket = "day" | "week" | "month" | "period";

function EnergyPage() {
  useBootstrapMeter();
  const { rows, totals } = useDerived();
  const validation = useApp((s) => s.validation);
  const [bucket, setBucket] = useState<Bucket>("period");

  const filteredByBucket = useMemo(() => {
    if (bucket === "period" || !rows.length) return rows;
    const last = rows[rows.length - 1].ts;
    let start: Date;
    if (bucket === "day") start = startOfDay(last);
    else if (bucket === "week") start = startOfWeek(last, { weekStartsOn: 1 });
    else start = startOfMonth(last);
    return rows.filter((r) => r.ts >= start);
  }, [rows, bucket]);

  const bucketTotals = useMemo(() => {
    let p = 0, s = 0, o = 0;
    for (const r of filteredByBucket) {
      const k = r.kW * 0.5;
      if (r.tou === "peak") p += k;
      else if (r.tou === "standard") s += k;
      else o += k;
    }
    return { peak: p, std: s, off: o, total: p + s + o };
  }, [filteredByBucket]);

  const touData = [
    { period: "Peak", value: bucketTotals.peak, color: TOU_COLOR.peak },
    { period: "Standard", value: bucketTotals.std, color: TOU_COLOR.standard },
    { period: "Off-Peak", value: bucketTotals.off, color: TOU_COLOR.offPeak },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Energy Analysis</h1>
          <p className="text-xs text-muted-foreground">Real power consumption from 30-minute measurements.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["day", "week", "month", "period"] as const).map((b) => (
              <button key={b} onClick={() => setBucket(b)}
                className={`px-3 py-1.5 capitalize ${bucket === b ? "bg-accent text-accent-foreground" : "hover:bg-secondary"}`}>
                {b === "period" ? "Billing" : b}
              </button>
            ))}
          </div>
          <PeriodPicker />
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Peak Energy" value={`${NUM(bucketTotals.peak, 0)} kWh`} />
        <MetricCard label="Standard Energy" value={`${NUM(bucketTotals.std, 0)} kWh`} />
        <MetricCard label="Off-Peak Energy" value={`${NUM(bucketTotals.off, 0)} kWh`} />
        <MetricCard label="Total Energy" value={`${NUM(bucketTotals.total, 0)} kWh`} accent />
      </section>

      <Panel title="Energy Consumption (kW)" subtitle={`X-axis: Date &amp; Time · Y-axis: kW · Filter: ${bucket === "period" ? "Billing Period" : bucket}`}>
        <EnergyLineChart rows={filteredByBucket} />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Energy Consumption by TOU (kWh)">
          <TouBarChart data={touData} unit="kWh" />
          <TotalsRow unit="kWh" items={[
            { label: "Peak", v: totals.peakKWh },
            { label: "Standard", v: totals.standardKWh },
            { label: "Off-Peak", v: totals.offPeakKWh },
            { label: "Total", v: totals.totalKWh, strong: true },
          ]} />
        </Panel>
        <Panel title="Data Validation" subtitle="Checks against the raw meter file.">
          <ul className="space-y-2 text-sm">
            {validation.map((v, i) => (
              <li key={i} className="flex items-center justify-between rounded border border-border px-3 py-2">
                <span className={v.severity === "error" ? "text-red-500" : "text-amber-500"}>{v.message}</span>
                {v.count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{v.count} row(s)</span>}
              </li>
            ))}
            {!validation.length && <li className="text-muted-foreground">No file loaded.</li>}
            <li className="text-xs text-muted-foreground pt-2">
              Loaded rows: {rows.length.toLocaleString()} · First: {rows[0] ? format(rows[0].ts, "dd MMM HH:mm") : "—"} · Last: {rows.at(-1) ? format(rows.at(-1)!.ts, "dd MMM HH:mm") : "—"}
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
