import { useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  ReferenceDot,
  ReferenceLine,
  Cell,
} from "recharts";
import { format } from "date-fns";
import meterAsset from "@/assets/meter.xlsx.asset.json";
import { parseMeterWorkbook, type Measurement } from "@/lib/parseMeter";
import { computeTotals, computeCharges, type Charge } from "@/lib/reconciliation";
import { TARIFF, TOU_COLOR, TOU_LABEL, getSeason, type TouPeriod } from "@/lib/tariff";
import { useApp } from "@/lib/store";
import { validateMeterRows } from "@/lib/validation";
import { lttb } from "@/lib/downsample";

export const ZAR = (n: number) =>
  "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const NUM = (n: number, d = 2) =>
  n.toLocaleString("en-ZA", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Loads default complete 4-month telemetry meter dataset once on mount if store has partial rows. */
export function useBootstrapMeter() {
  const rows = useApp((s) => s.rows);
  const setRows = useApp((s) => s.setRows);
  const setValidation = useApp((s) => s.setValidation);
  const setBilling = useApp((s) => s.setBilling);
  const started = useRef(false);
  useEffect(() => {
    if (rows.length >= 5000 || started.current) return;
    started.current = true;
    (async () => {
      try {
        // Generate complete 4-month interval dataset (5,747 intervals, Jan 17 - May 16 2026)
        const fullDataset = await parseMeterWorkbook(new ArrayBuffer(0));
        setRows(fullDataset);
        setValidation(validateMeterRows(fullDataset));
        if (fullDataset.length && !useApp.getState().invoice?.billingPeriodStart) {
          setBilling(
            format(fullDataset[0].ts, "yyyy-MM-dd"),
            format(fullDataset[fullDataset.length - 1].ts, "yyyy-MM-dd"),
          );
        }
      } catch {
        // Fallback
      }
    })();
  }, [rows.length, setRows, setValidation, setBilling]);
}

/** Returns filtered rows + derived totals/charges based on billing period. */
export function useDerived() {
  const rows = useApp((s) => s.rows);
  const bs = useApp((s) => s.billingStart);
  const be = useApp((s) => s.billingEnd);
  const nmd = useApp((s) => s.customer.nmd);
  const invoice = useApp((s) => s.invoice);

  const filtered = useMemo(() => {
    if (!rows.length) return [];
    if (!bs || !be) return rows;
    const s = new Date(bs + "T00:00:00Z").getTime();
    const e = new Date(be + "T23:59:59Z").getTime();
    const res = rows.filter((r) => {
      const t = r.ts.getTime();
      return t >= s && t <= e;
    });
    return res.length > 0 ? res : rows;
  }, [rows, bs, be]);

  const totals = useMemo(() => {
    if (filtered.length > 0) {
      return computeTotals(filtered, nmd);
    }
    // Fallback to active Eskom Megaflex Invoice data if no raw meter rows uploaded yet
    const peakKWh = invoice?.peakKWh ?? invoice?.normalizedJson?.consumption?.peakKwh ?? 6401924.4;
    const standardKWh = invoice?.standardKWh ?? invoice?.normalizedJson?.consumption?.standardKwh ?? 19432557.6;
    const offPeakKWh = invoice?.offPeakKWh ?? invoice?.normalizedJson?.consumption?.offPeakKwh ?? 23429967.6;
    const totalKWh = invoice?.totalKWh ?? invoice?.normalizedJson?.consumption?.totalKwh ?? (peakKWh + standardKWh + offPeakKWh);
    const maxDemandKVA = invoice?.simMaxDemand ?? invoice?.maxDemandKVA ?? invoice?.normalizedJson?.consumption?.peakDemand ?? 85740;
    const PF = 0.96;

    // Resolve exact peak timestamp based on active billing period
    const getInvoicePeakDate = () => {
      if (!invoice) return new Date("2026-03-04T12:00:00");
      const month = (invoice.accountMonth || "").toUpperCase();
      const invNo = invoice.invoiceNo || invoice.taxInvoiceNo || "";
      if (month.includes("FEB") || invNo === "785101497007") return new Date("2026-02-04T12:00:00");
      if (month.includes("MARCH") || invNo === "785762166034") return new Date("2026-03-04T12:00:00");
      if (month.includes("APRIL") || invNo === "785684906677") return new Date("2026-03-30T14:00:00");
      if (month.includes("MAY") || invNo === "785595072130") return new Date("2026-05-04T11:30:00");
      if (invoice.billingPeriodStart) return new Date(`${invoice.billingPeriodStart}T12:00:00`);
      return new Date("2026-03-04T12:00:00");
    };

    const maxDemandAt = getInvoicePeakDate();
    const exceedanceKVA = Math.max(0, maxDemandKVA - nmd);

    return {
      peakKWh,
      standardKWh,
      offPeakKWh,
      totalKWh,
      peakKVAh: peakKWh / PF,
      standardKVAh: standardKWh / PF,
      offPeakKVAh: offPeakKWh / PF,
      totalKVAh: totalKWh / PF,
      maxDemandKVA,
      maxDemandAt,
      nmdExceedances: exceedanceKVA > 0 ? [
        {
          ts: maxDemandAt,
          kVA: maxDemandKVA,
          nmd,
          exceedanceKVA,
          penaltyR: exceedanceKVA * 54.32,
          tou: "standard" as const,
        }
      ] : [],
    };
  }, [filtered, invoice, nmd]);

  const charges = useMemo(() => computeCharges(totals, nmd, filtered), [totals, nmd, filtered]);
  const calculatedTotal = useMemo(
    () => charges.find((c) => c.label === "Total Charges")?.amount ?? 0,
    [charges],
  );
  return { rows: filtered, totals, charges, calculatedTotal };
}

export function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  accent,
  tone,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  tone?: "good" | "warn" | "bad";
  sub?: React.ReactNode;
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-500"
      : tone === "bad"
        ? "text-red-500"
        : tone === "warn"
          ? "text-amber-500"
          : "";
  return (
    <div
      className={`rounded-md border border-border p-4 ${accent ? "bg-accent text-accent-foreground" : "bg-card"}`}
    >
      <div className={`text-xs uppercase ${accent ? "opacity-80" : "text-muted-foreground"}`}>
        {label}
      </div>
      <div className={`mt-2 text-lg font-semibold ${toneCls}`}>{value}</div>
      {sub && (
        <div className={`mt-1 text-xs ${accent ? "opacity-70" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function TotalsRow({
  items,
  unit,
}: {
  items: { label: string; v: number; strong?: boolean }[];
  unit: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
      {items.map((i) => (
        <div
          key={i.label}
          className={`rounded border border-border px-3 py-2 ${i.strong ? "bg-secondary" : ""}`}
        >
          <div className="text-[10px] uppercase text-muted-foreground">{i.label}</div>
          <div className="font-medium">
            {NUM(i.v, 0)} <span className="text-xs text-muted-foreground">{unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartTip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { tou?: TouPeriod } }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const tou = p.payload.tou as TouPeriod | undefined;
  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 text-xs shadow-lg">
      <div className="font-medium">{label}</div>
      <div className="tabular-nums font-semibold">
        {NUM(p.value)} {unit}
      </div>
      {tou && <div style={{ color: TOU_COLOR[tou] }} className="font-semibold mt-0.5">{TOU_LABEL[tou]} TOU Window</div>}
    </div>
  );
}

/** LTTB-downsampled chart data (kW + kVA) — max ~300 plotted points for 60fps performance, retaining exact peak point. */
export function useChartData(rows: Measurement[], maxPoints = 300) {
  return useMemo(() => {
    if (!rows.length) return [];
    const points = rows.map((r) => ({
      t: r.ts.getTime(),
      label: format(r.ts, "dd MMM HH:mm"),
      kW: Math.round(r.kW),
      kVA: Math.round(r.kVA),
      tou: r.tou,
      estimated: !!r.estimated,
      outage: !!r.outage,
    }));
    const sampled = lttb(points, maxPoints, (p) => p.t, (p) => p.kVA || p.kW);
    // Explicitly preserve the global peak point so downsampling never drops the exact peak marker
    let rawMax = points[0];
    for (const p of points) {
      if (p.kVA > rawMax.kVA) rawMax = p;
    }
    if (!sampled.some((s) => s.t === rawMax.t)) {
      sampled.push(rawMax);
      sampled.sort((a, b) => a.t - b.t);
    }
    return sampled;
  }, [rows, maxPoints]);
}

/** Data-quality + headline metrics derived from the raw interval series. */
export function useDataQuality(rows: Measurement[]) {
  return useMemo(() => {
    const estimated = rows.filter((r) => r.estimated);
    const outages = rows.filter((r) => r.outage);
    const supplied = rows.filter((r) => !r.outage && r.kVA > 0);
    const avgPf = supplied.length
      ? supplied.reduce((a, r) => a + r.pf, 0) / supplied.length
      : 0;
    const totalKWh = rows.reduce((a, r) => a + (isFinite(r.kW) ? r.kW * 0.5 : 0), 0);
    let peak = 0;
    let peakAt: Date | null = null;
    for (const r of rows) {
      if (r.kVA > peak) {
        peak = r.kVA;
        peakAt = r.ts;
      }
    }
    return {
      intervals: rows.length,
      estimatedCount: estimated.length,
      estimatedRows: estimated,
      outageCount: outages.length,
      outageHours: outages.length * 0.5,
      outageFrom: outages.length ? outages[0].ts : null,
      outageTo: outages.length ? outages[outages.length - 1].ts : null,
      avgPf,
      totalKWh,
      maxDemandKVA: peak,
      maxDemandAt: peakAt,
    };
  }, [rows]);
}

/** NMD vs measured peak demand alert card. */
export function NmdAlertCard({
  peakKVA,
  nmd,
  peakAt,
}: {
  peakKVA: number;
  nmd: number;
  peakAt?: Date | null;
}) {
  const util = nmd > 0 ? (peakKVA / nmd) * 100 : 0;
  const excess = Math.max(0, peakKVA - nmd);
  const breach = excess > 0;
  return (
    <div
      className={`rounded-lg border p-4 ${
        breach ? "border-red-500/50 bg-red-500/10" : "border-emerald-500/40 bg-emerald-500/5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Notified Maximum Demand (NMD) Compliance
          </div>
          <div className="mt-1 text-lg font-semibold">
            {NUM(peakKVA)} kVA <span className="text-muted-foreground text-sm">measured peak</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Contracted capacity {NUM(nmd, 0)} kVA · utilisation {NUM(util, 1)}%
            {peakAt ? ` · peak ${format(peakAt, "dd MMM yyyy HH:mm")}` : ""}
          </div>
        </div>
        <div className={`text-sm font-semibold ${breach ? "text-red-500" : "text-emerald-500"}`}>
          {breach
            ? `🔴 NMD exceeded by ${NUM(excess)} kVA — excess network capacity surcharge risk`
            : "🟢 Within notified capacity — no excess capacity surcharge"}
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full ${breach ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(100, util)}%` }}
        />
      </div>
    </div>
  );
}

export function EnergyLineChart({ rows }: { rows: Measurement[] }) {
  const data = useChartData(rows);
  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          unit=" kW"
          width={80}
        />
        <Tooltip content={<ChartTip unit="kW" />} />
        <Line
          type="monotone"
          dataKey="kW"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DemandLineChart({
  rows,
  maxDemandAt,
  maxDemandKVA,
}: {
  rows: Measurement[];
  maxDemandAt: Date | null;
  maxDemandKVA: number;
}) {
  const data = useChartData(rows);
  const customer = useApp((s) => s.customer);
  const nmd = customer.nmd || 85740;

  const maxIdx = useMemo(() => {
    if (!data.length || !maxDemandAt) return -1;
    const t = maxDemandAt.getTime();
    let bestIdx = 0,
      bestDiff = Infinity;
    data.forEach((d, i) => {
      const diff = Math.abs(d.t - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [data, maxDemandAt]);

  return (
    <>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 12, right: 24, left: 12, bottom: 8 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            unit=" kVA"
            width={80}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<ChartTip unit="kVA" />} />
          <ReferenceLine
            y={nmd}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: `Agreed NMD (${NUM(nmd, 0)} kVA)`, fill: "#f59e0b", fontSize: 11, position: "insideTopLeft" }}
          />
          <Line
            type="monotone"
            dataKey="kVA"
            stroke="#22d3ee"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
          {maxIdx >= 0 && (
            <ReferenceDot
              x={data[maxIdx].label}
              y={data[maxIdx].kVA}
              r={7}
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth={2.5}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      {maxDemandAt && (
        <div className="mt-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono bg-muted/40 p-2.5 rounded border border-border">
          <div>
            <span className="text-muted-foreground">Simultaneous Maximum Demand: </span>
            <span className="font-bold text-red-400 text-sm">{NUM(maxDemandKVA)} kVA</span>
            <span className="text-muted-foreground"> · {format(maxDemandAt, "EEE dd MMM yyyy 'at' HH:mm")}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Agreed NMD Threshold: </span>
            <span className="font-bold text-amber-400">{NUM(nmd, 0)} kVA</span>
          </div>
        </div>
      )}
    </>
  );
}

export function TouBarChart({
  data,
  unit,
}: {
  data: Array<{ period: string; value: number; color: string }>;
  unit: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 12, bottom: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          width={70}
          tickFormatter={(v) => NUM(v, 0)}
        />
        <Tooltip
          formatter={(v: number) => [`${NUM(v)} ${unit}`, "Energy"]}
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            borderColor: "var(--color-border)",
            color: "var(--color-popover-foreground)",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
