import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, ReferenceDot, Cell,
} from "recharts";
import { format } from "date-fns";
import meterAsset from "@/assets/meter.xlsx.asset.json";
import { parseMeterWorkbook, type Measurement } from "@/lib/parseMeter";
import { computeTotals, computeCharges, type Charge } from "@/lib/reconciliation";
import { TARIFF, TOU_COLOR, TOU_LABEL, type TouPeriod } from "@/lib/tariff";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eskom Meter Data Reconciliation Engine" },
      { name: "description", content: "Automatically classify 30-minute meter data by Eskom TOU periods, calculate all billing components, and reconcile against the Eskom invoice." },
      { property: "og:title", content: "Meter Data Reconciliation Engine" },
      { property: "og:description", content: "TOU classification, energy & demand analytics, and invoice reconciliation for Eskom Megaflex customers." },
    ],
  }),
  component: Dashboard,
});

const ZAR = (n: number) =>
  "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM = (n: number, d = 2) =>
  n.toLocaleString("en-ZA", { minimumFractionDigits: d, maximumFractionDigits: d });

function Dashboard() {
  const [rows, setRows] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [nmd, setNmd] = useState(90000);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceLines, setInvoiceLines] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(meterAsset.url);
        const buf = await res.arrayBuffer();
        const parsed = await parseMeterWorkbook(buf);
        if (alive) { setRows(parsed); setLoading(false); }
      } catch (e) {
        if (alive) { setErr(String(e)); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  useEffect(() => {
    if (rows.length && !start) {
      setStart(format(rows[0].ts, "yyyy-MM-dd"));
      setEnd(format(rows[rows.length - 1].ts, "yyyy-MM-dd"));
    }
  }, [rows, start]);

  const filtered = useMemo(() => {
    if (!rows.length) return [];
    const s = start ? new Date(start + "T00:00:00") : rows[0].ts;
    const e = end ? new Date(end + "T23:59:59") : rows[rows.length - 1].ts;
    return rows.filter((r) => r.ts >= s && r.ts <= e);
  }, [rows, start, end]);

  const totals = useMemo(() => computeTotals(filtered), [filtered]);
  const charges = useMemo(() => computeCharges(totals, nmd, filtered), [totals, nmd, filtered]);
  const calculatedTotal = useMemo(() => charges.reduce((a, c) => a + c.amount, 0), [charges]);

  // Chart data — downsample to daily peaks/averages to keep charts readable
  const chartData = useMemo(() => {
    if (!filtered.length) return [];
    const step = Math.max(1, Math.floor(filtered.length / 800));
    const out: { t: number; label: string; kW: number; kVA: number; tou: TouPeriod }[] = [];
    for (let i = 0; i < filtered.length; i += step) {
      const r = filtered[i];
      out.push({
        t: r.ts.getTime(),
        label: format(r.ts, "dd MMM HH:mm"),
        kW: Math.round(r.kW),
        kVA: Math.round(r.kW / TARIFF.powerFactor),
        tou: r.tou,
      });
    }
    return out;
  }, [filtered]);

  const maxIdx = useMemo(() => {
    if (!chartData.length || !totals.maxDemandAt) return -1;
    const t = totals.maxDemandAt.getTime();
    let bestIdx = 0, bestDiff = Infinity;
    chartData.forEach((d, i) => {
      const diff = Math.abs(d.t - t);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    });
    return bestIdx;
  }, [chartData, totals.maxDemandAt]);

  const touBars = useMemo(() => [
    { period: "Peak", kWh: totals.peakKWh, kVAh: totals.peakKVAh, color: TOU_COLOR.peak },
    { period: "Standard", kWh: totals.standardKWh, kVAh: totals.standardKVAh, color: TOU_COLOR.standard },
    { period: "Off-Peak", kWh: totals.offPeakKWh, kVAh: totals.offPeakKVAh, color: TOU_COLOR.offPeak },
  ], [totals]);

  const diff = invoiceTotal - calculatedTotal;
  const pctErr = invoiceTotal ? (diff / invoiceTotal) * 100 : 0;
  const pass = invoiceTotal > 0 && Math.abs(pctErr) <= 2;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLoading(true);
    const buf = await f.arrayBuffer();
    const parsed = await parseMeterWorkbook(buf);
    setRows(parsed);
    setStart(""); setEnd("");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center text-accent-foreground font-bold">MR</div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Meter Data Reconciliation Engine</h1>
              <p className="text-xs text-muted-foreground">Eskom Megaflex · 2025/2026 Tariff Book · 30-min interval analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-secondary/80 transition"
            >Upload meter file</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-6">
        {/* Customer / period summary */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <SummaryTile label="Customer" value="Millennium" />
          <SummaryTile label="Meter" value="33kV Sub Incomer" />
          <SummaryTile label="Tariff" value="Megaflex" />
          <SummaryTile label="Voltage" value="≥500V & <66kV" />
          <SummaryTile label="NMD (kVA)" value={
            <input
              type="number" value={nmd} onChange={(e) => setNmd(Number(e.target.value) || 0)}
              className="w-full bg-transparent border border-border rounded px-2 py-1 text-sm"
            />
          } />
          <SummaryTile label="Billing period" value={
            <div className="flex items-center gap-1 text-xs">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="bg-transparent border border-border rounded px-1 py-0.5" />
              <span>→</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="bg-transparent border border-border rounded px-1 py-0.5" />
            </div>
          } />
        </section>

        {loading && <Panel><p className="p-8 text-center text-muted-foreground">Loading meter data…</p></Panel>}
        {err && <Panel><p className="p-6 text-destructive">{err}</p></Panel>}

        {!loading && !err && (
          <>
            {/* Graphs */}
            <div className="grid grid-cols-1 gap-6">
              <Panel title="Energy Consumption (kW)" subtitle="Real-power measurements per 30-min interval">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} unit=" kW" width={80} />
                    <Tooltip content={<ChartTip unit="kW" />} />
                    <Line type="monotone" dataKey="kW" stroke="var(--color-accent)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Demand Consumption (kVA)" subtitle={`kVA = kW ÷ PF (${TARIFF.powerFactor}). Red marker = Simultaneous Maximum Demand`}>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} unit=" kVA" width={80} />
                    <Tooltip content={<ChartTip unit="kVA" />} />
                    <Line type="monotone" dataKey="kVA" stroke="#22d3ee" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    {maxIdx >= 0 && (
                      <ReferenceDot x={chartData[maxIdx].label} y={chartData[maxIdx].kVA}
                        r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                {totals.maxDemandAt && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Simultaneous Maximum Demand: </span>
                    <span className="font-semibold">{NUM(totals.maxDemandKVA)} kVA</span>
                    <span className="text-muted-foreground"> · {format(totals.maxDemandAt, "EEE dd MMM yyyy 'at' HH:mm")}</span>
                  </div>
                )}
              </Panel>
            </div>

            {/* Energy + Demand totals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Energy Consumption by TOU (kWh)">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={touBars}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={80} />
                    <Tooltip content={<ChartTip unit="kWh" />} />
                    <Bar dataKey="kWh" radius={[6, 6, 0, 0]}>
                      {touBars.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <TotalsRow items={[
                  { label: "Peak", v: totals.peakKWh },
                  { label: "Standard", v: totals.standardKWh },
                  { label: "Off-Peak", v: totals.offPeakKWh },
                  { label: "Total", v: totals.totalKWh, strong: true },
                ]} unit="kWh" />
              </Panel>

              <Panel title="Demand Consumption by TOU (kVAh)">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={touBars}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={80} />
                    <Tooltip content={<ChartTip unit="kVAh" />} />
                    <Bar dataKey="kVAh" radius={[6, 6, 0, 0]}>
                      {touBars.map((b, i) => <Cell key={i} fill={b.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <TotalsRow items={[
                  { label: "Peak", v: totals.peakKVAh },
                  { label: "Standard", v: totals.standardKVAh },
                  { label: "Off-Peak", v: totals.offPeakKVAh },
                  { label: "Total", v: totals.totalKVAh, strong: true },
                ]} unit="kVAh" />
              </Panel>
            </div>

            {/* Charge breakdown */}
            <Panel title="Reconciliation — Calculated Charges" subtitle="Rates sourced from Eskom Tariffs & Charges Booklet 2025/2026 (excl. VAT)">
              <ChargeTable charges={charges} />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                <MetricCard label="Calculated Total" value={ZAR(calculatedTotal)} accent />
                <div className="rounded-md border border-border bg-card p-4">
                  <div className="text-xs uppercase text-muted-foreground">Eskom Invoice Total (excl VAT)</div>
                  <input type="number" value={invoiceTotal || ""} placeholder="Enter invoice R value"
                    onChange={(e) => setInvoiceTotal(Number(e.target.value) || 0)}
                    className="mt-2 w-full bg-transparent border border-border rounded px-2 py-1 text-lg font-semibold" />
                </div>
                <MetricCard label="Difference" value={invoiceTotal ? ZAR(diff) : "—"}
                  tone={invoiceTotal ? (Math.abs(diff) < 1 ? "good" : diff > 0 ? "warn" : "bad") : undefined} />
                <MetricCard label="% Error / Verdict"
                  value={invoiceTotal
                    ? `${pctErr.toFixed(2)}%  ·  ${pass ? "PASS" : "FAIL"}`
                    : "Enter invoice total"}
                  tone={invoiceTotal ? (pass ? "good" : "bad") : undefined} />
              </div>
            </Panel>

            {/* Deficit Analysis: line-item cost vs invoice + cost per kWh */}
            <DeficitAnalysis
              charges={charges}
              invoiceLines={invoiceLines}
              setInvoiceLines={setInvoiceLines}
              totals={totals}
            />

            {/* Daily cost vs consumption comparison */}
            <DailyCostPanel rows={filtered} />


            <p className="text-xs text-muted-foreground text-center pt-2">
              Tariff: {TARIFF.name} · Zone {TARIFF.zone} · Voltage {TARIFF.voltage} · PF {TARIFF.powerFactor} · Data: {filtered.length.toLocaleString()} intervals
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      {title && (
        <header className="mb-3">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function MetricCard({ label, value, accent, tone }: { label: string; value: React.ReactNode; accent?: boolean; tone?: "good" | "warn" | "bad" }) {
  const toneCls = tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-red-500" : tone === "warn" ? "text-amber-500" : "";
  return (
    <div className={`rounded-md border border-border p-4 ${accent ? "bg-accent text-accent-foreground" : "bg-card"}`}>
      <div className={`text-xs uppercase ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
      <div className={`mt-2 text-lg font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

function TotalsRow({ items, unit }: { items: { label: string; v: number; strong?: boolean }[]; unit: string }) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
      {items.map((i) => (
        <div key={i.label} className={`rounded border border-border px-3 py-2 ${i.strong ? "bg-secondary" : ""}`}>
          <div className="text-[10px] uppercase text-muted-foreground">{i.label}</div>
          <div className="font-medium">{NUM(i.v, 0)} <span className="text-xs text-muted-foreground">{unit}</span></div>
        </div>
      ))}
    </div>
  );
}

function ChargeTable({ charges }: { charges: Charge[] }) {
  const groups: { title: string; key: Charge["group"] }[] = [
    { title: "Fixed Charges (based on NMD)", key: "fixed" },
    { title: "Energy Charges (Peak / Standard / Off-Peak)", key: "energy" },
    { title: "Additional Charges (per Total kWh)", key: "additional" },
    { title: "Demand Charge (Max Demand × Network Demand Rate)", key: "demand" },
  ];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{g.title}</div>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Charge</th>
                  <th className="text-left px-3 py-2">Basis</th>
                  <th className="text-right px-3 py-2">Quantity</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-right px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {charges.filter((c) => c.group === g.key).map((c) => (
                  <tr key={c.label} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{c.label}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{c.basis}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{NUM(c.quantity, c.qtyUnit === "kVA" ? 2 : 0)} <span className="text-xs text-muted-foreground">{c.qtyUnit}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{NUM(c.rate, 4)} <span className="text-xs text-muted-foreground">{c.rateUnit}</span></td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{ZAR(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartTip({ active, payload, label, unit }: { active?: boolean; payload?: Array<{ value: number; payload: { tou?: TouPeriod } }>; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const tou = p.payload.tou as TouPeriod | undefined;
  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground px-3 py-2 text-xs shadow-lg">
      <div className="font-medium">{label}</div>
      <div className="tabular-nums">{NUM(p.value)} {unit}</div>
      {tou && <div style={{ color: TOU_COLOR[tou] }}>{TOU_LABEL[tou]}</div>}
    </div>
  );
}
