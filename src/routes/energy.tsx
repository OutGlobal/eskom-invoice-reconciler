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

  const displayTotals = bucket === "period" ? totals : bucketTotals;

  const touData = [
    { period: "Peak", value: displayTotals.peakKWh, color: TOU_COLOR.peak },
    { period: "Standard", value: displayTotals.standardKWh, color: TOU_COLOR.standard },
    { period: "Off-Peak", value: displayTotals.offPeakKWh, color: TOU_COLOR.offPeak },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-semibold">Time-Of-Use (TOU) Energy Analysis</h1>
          <p className="text-xs text-muted-foreground">30-minute interval active power (kW) &amp; kWh energy breakdown</p>
        </div>
        <InvoiceSelector />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {(["day", "week", "month", "period"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`px-3 py-1.5 capitalize ${bucket === b ? "bg-accent text-accent-foreground" : "hover:bg-secondary"}`}
              >
                {b === "period" ? "Billing" : b}
              </button>
            ))}
          </div>
          <PeriodPicker />
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Peak Energy" value={`${NUM(displayTotals.peakKWh, 0)} kWh`} />
        <MetricCard label="Standard Energy" value={`${NUM(displayTotals.standardKWh, 0)} kWh`} />
        <MetricCard label="Off-Peak Energy" value={`${NUM(displayTotals.offPeakKWh, 0)} kWh`} />
        <MetricCard label="Total Energy" value={`${NUM(displayTotals.totalKWh, 0)} kWh`} accent />
      </section>

      <Panel
        title="Energy Consumption (kW)"
        subtitle={`X-axis: Date &amp; Time · Y-axis: kW · Filter: ${bucket === "period" ? "Billing Period" : bucket}`}
      >
        <EnergyLineChart rows={filteredByBucket} />
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
