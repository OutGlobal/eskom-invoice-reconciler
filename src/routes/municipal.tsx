import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MetricCard, Panel, ZAR } from "@/components/dashboard/parts";
import { EMFULENI_CUSTOMERS, EMFULENI_STATEMENTS } from "@/lib/emfuleniData";
import { reconcileAll, type ReconStatus } from "@/lib/municipalRecon";

export const Route = createFileRoute("/municipal")({
  head: () => ({
    meta: [
      { title: "Municipal Statement Reconciliation — Emfuleni | Bill Balancer" },
      {
        name: "description",
        content:
          "Automated Emfuleni Local Municipality statement reconciliation: electricity, water, sewerage, refuse and assessment rates audited line-by-line against the 2025/26 tariff booklets.",
      },
      { property: "og:title", content: "Municipal Statement Reconciliation — Emfuleni" },
      {
        property: "og:description",
        content:
          "Line-by-line variance audit of Emfuleni municipal statements against approved 2025/26 tariffs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MunicipalPage,
});

const DOT: Record<ReconStatus, string> = {
  match: "🟢",
  minor: "🟡",
  significant: "🔴",
};
const TONE: Record<ReconStatus, string> = {
  match: "text-emerald-500",
  minor: "text-amber-500",
  significant: "text-red-500",
};
const LABEL: Record<ReconStatus, string> = {
  match: "Match (≤1%)",
  minor: "Minor (1–5%)",
  significant: "Significant (>5%)",
};

function MunicipalPage() {
  const results = useMemo(() => reconcileAll(EMFULENI_STATEMENTS), []);
  const [activeId, setActiveId] = useState(results[0].statement.id);
  const active = results.find((r) => r.statement.id === activeId)!;
  const s = active.statement;
  const customer = EMFULENI_CUSTOMERS.find((c) => c.accountNumber === s.accountNumber);

  const categoryData = useMemo(() => {
    const map = new Map<string, { category: string; Calculated: number; Billed: number }>();
    for (const l of active.lines) {
      const key = l.line.category;
      const e = map.get(key) || { category: key, Calculated: 0, Billed: 0 };
      e.Calculated += l.expectedExcl;
      e.Billed += l.line.billedExcl;
      map.set(key, e);
    }
    return [...map.values()];
  }, [active]);

  const varianceData = useMemo(
    () =>
      active.lines.map((l) => ({
        name: l.line.description.length > 26 ? l.line.description.slice(0, 24) + "…" : l.line.description,
        variance: Number(l.variance.toFixed(2)),
        status: l.status,
      })),
    [active],
  );

  const trend = useMemo(
    () =>
      results
        .filter((r) => r.statement.accountNumber === s.accountNumber)
        .map((r) => {
          const elec = r.lines.find((l) => l.line.rule.kind === "electricityEnergy");
          return {
            period: r.statement.label.split(" — ")[0],
            kWh: elec?.line.quantity ?? 0,
            Billed: Number(r.totalBilled.toFixed(2)),
            Calculated: Number(r.totalExpected.toFixed(2)),
          };
        }),
    [results, s.accountNumber],
  );

  const portfolioBilled = results.reduce((a, r) => a + r.totalBilled, 0);
  const portfolioExpected = results.reduce((a, r) => a + r.totalExpected, 0);
  const portfolioVariance = portfolioBilled - portfolioExpected;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3.5">
        <div>
          <h1 className="text-base font-semibold">Municipal Statement Reconciliation</h1>
          <p className="text-xs text-muted-foreground">
            Emfuleni Local Municipality — {results.length} statements audited against the approved
            2025/26 electricity and consolidated tariff booklets.
          </p>
        </div>
        <select
          value={activeId}
          onChange={(e) => setActiveId(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          {results.map((r) => (
            <option key={r.statement.id} value={r.statement.id}>
              {r.statement.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard label="Statement Total (excl VAT)" value={ZAR(active.totalBilled)} accent />
        <MetricCard label="Tariff-Calculated Total" value={ZAR(active.totalExpected)} />
        <MetricCard
          label="Net Variance"
          value={`${active.totalVariance >= 0 ? "+" : ""}${ZAR(active.totalVariance)}`}
          tone={active.status === "match" ? "good" : active.status === "minor" ? "warn" : "bad"}
          sub={`${active.totalVariancePct.toFixed(2)}% • ${LABEL[active.status]}`}
        />
        <MetricCard
          label="Over-Billed Lines"
          value={ZAR(active.overBilled)}
          tone={active.overBilled > 0 ? "bad" : "good"}
        />
        <MetricCard
          label="Portfolio Variance (all statements)"
          value={`${portfolioVariance >= 0 ? "+" : ""}${ZAR(portfolioVariance)}`}
          tone={Math.abs(portfolioVariance) > 1000 ? "bad" : "good"}
          sub={`Billed ${ZAR(portfolioBilled)} vs calculated ${ZAR(portfolioExpected)}`}
        />
      </div>

      <Panel
        title="Statement & Customer Details"
        subtitle="Extracted directly from the uploaded municipal tax invoice."
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
          {[
            ["Customer", s.customerName],
            ["Account Number", s.accountNumber],
            ["Invoice Number", s.invoiceNumber],
            ["VAT Reg No", customer?.vatRegNo ?? "—"],
            ["Property Address", s.address],
            ["Erf / Stand", s.erf],
            ["Ward", s.ward],
            ["Township", s.township],
            ["Stand Area", `${s.standAreaM2.toLocaleString("en-ZA")} m²`],
            ["Improved Value", ZAR(s.improvedValue)],
            ["Statement Date", s.statementDate],
            ["Due Date", s.dueDate],
            ["Billing Period", `${s.periodStart} → ${s.periodEnd}`],
            ["Electricity Meter", customer?.electricityMeter ?? "—"],
            ["Water Meter", customer?.waterMeter ?? "—"],
            ["Tariff", customer?.tariff ?? "—"],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
              <div className="font-medium break-words">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded-md border border-border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Balance Brought Forward</div>
            <div className="font-semibold tabular-nums">{ZAR(s.broughtForward)}</div>
          </div>
          {s.payments.map((p) => (
            <div key={p.date} className="rounded-md border border-border p-3">
              <div className="text-[11px] uppercase text-muted-foreground">Payment {p.date}</div>
              <div className="font-semibold tabular-nums text-emerald-500">{ZAR(p.amount)}</div>
            </div>
          ))}
          <div className="rounded-md border border-border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Total Current Levy (incl VAT)</div>
            <div className="font-semibold tabular-nums">{ZAR(s.totalIncl)}</div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Line-by-Line Charge Reconciliation"
        subtitle="Each billed line recalculated from the approved tariff schedule. 🟢 ≤1% • 🟡 1–5% • 🔴 >5%"
      >
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Charge Description</th>
                <th className="text-right px-3 py-2">Quantity</th>
                <th className="text-right px-3 py-2">Rate Billed</th>
                <th className="text-right px-3 py-2">Tariff Rate</th>
                <th className="text-right px-3 py-2">Billed (excl)</th>
                <th className="text-right px-3 py-2">Calculated</th>
                <th className="text-right px-3 py-2">Variance</th>
                <th className="text-right px-3 py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {active.lines.map((l, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2">{DOT[l.status]}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{l.line.category}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.line.description}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.line.meter ? `Meter ${l.line.meter} • ` : ""}
                      {l.line.prevReading != null && l.line.currReading != null
                        ? `Reading ${l.line.prevReading.toLocaleString("en-ZA")} → ${l.line.currReading.toLocaleString("en-ZA")} • `
                        : ""}
                      {l.basis}
                    </div>
                    {l.line.note && (
                      <div className="text-[11px] text-amber-500 mt-0.5">⚠ {l.line.note}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.line.quantity != null
                      ? `${l.line.quantity.toLocaleString("en-ZA")} ${l.line.unit ?? ""}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.appliedRate != null ? l.appliedRate.toFixed(4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {l.tariffRate != null ? l.tariffRate.toFixed(4) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{ZAR(l.line.billedExcl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ZAR(l.expectedExcl)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${TONE[l.status]}`}>
                    {l.variance >= 0 ? "+" : ""}
                    {ZAR(l.variance)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${TONE[l.status]}`}>
                    {l.variancePct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-secondary/60 font-semibold">
              <tr className="border-t border-border">
                <td className="px-3 py-2" colSpan={6}>
                  Total excluding VAT
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{ZAR(active.totalBilled)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{ZAR(active.totalExpected)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${TONE[active.status]}`}>
                  {active.totalVariance >= 0 ? "+" : ""}
                  {ZAR(active.totalVariance)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${TONE[active.status]}`}>
                  {active.totalVariancePct.toFixed(2)}%
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="px-3 py-2" colSpan={6}>
                  VAT @ 15% (rates zero-rated)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{ZAR(active.vatBilled)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{ZAR(active.vatExpected)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {ZAR(active.vatBilled - active.vatExpected)}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Calculated vs Billed by Service"
          subtitle="Excluding VAT, per municipal service category."
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => ZAR(v)} />
                <Legend />
                <Bar dataKey="Calculated" fill="hsl(var(--chart-2, 200 80% 50%))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Billed" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Variance by Charge Line" subtitle="Positive = over-billed, negative = under-billed.">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={varianceData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => ZAR(v)} />
                <Bar dataKey="variance" radius={[0, 3, 3, 0]}>
                  {varianceData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={
                        d.status === "match"
                          ? "#10b981"
                          : d.status === "minor"
                            ? "#f59e0b"
                            : "#ef4444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel
        title={`Consumption & Cost Trend — Account ${s.accountNumber}`}
        subtitle="Electricity consumption against billed and tariff-calculated statement totals."
      >
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
              <YAxis
                yAxisId="r"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v: number, n: string) => (n === "kWh" ? `${v.toLocaleString("en-ZA")} kWh` : ZAR(v))} />
              <Legend />
              <Line yAxisId="l" type="monotone" dataKey="Billed" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              <Line yAxisId="l" type="monotone" dataKey="Calculated" stroke="#10b981" strokeWidth={2} dot />
              <Line yAxisId="r" type="monotone" dataKey="kWh" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Audit Findings" subtitle="Automatically generated from the variance analysis.">
        <ul className="space-y-2 text-sm">
          {active.lines
            .filter((l) => l.status !== "match")
            .map((l, i) => (
              <li key={i} className="rounded-md border border-border p-3">
                <span className={`font-medium ${TONE[l.status]}`}>
                  {DOT[l.status]} {l.line.description}
                </span>{" "}
                — billed {ZAR(l.line.billedExcl)} against a tariff-calculated {ZAR(l.expectedExcl)} (
                {l.variance >= 0 ? "over" : "under"}-billed by {ZAR(Math.abs(l.variance))},{" "}
                {Math.abs(l.variancePct).toFixed(2)}%). Basis: {l.basis}.
                {l.line.note ? ` ${l.line.note}` : ""}
              </li>
            ))}
          {active.lines.every((l) => l.status === "match") && (
            <li className="rounded-md border border-border p-3 text-emerald-500">
              🟢 All charge lines reconcile within 1% of the approved tariff schedule.
            </li>
          )}
        </ul>
      </Panel>

      <Panel title="Portfolio Summary" subtitle="All uploaded Emfuleni statements.">
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Statement</th>
                <th className="text-left px-3 py-2">Invoice No</th>
                <th className="text-right px-3 py-2">Billed (excl)</th>
                <th className="text-right px-3 py-2">Calculated</th>
                <th className="text-right px-3 py-2">Variance</th>
                <th className="text-right px-3 py-2">%</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.statement.id}
                  className={`border-t border-border cursor-pointer hover:bg-secondary/40 ${
                    r.statement.id === activeId ? "bg-secondary/30" : ""
                  }`}
                  onClick={() => setActiveId(r.statement.id)}
                >
                  <td className="px-3 py-2 font-medium">{r.statement.label}</td>
                  <td className="px-3 py-2 text-xs">{r.statement.invoiceNumber}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ZAR(r.totalBilled)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{ZAR(r.totalExpected)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${TONE[r.status]}`}>
                    {r.totalVariance >= 0 ? "+" : ""}
                    {ZAR(r.totalVariance)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${TONE[r.status]}`}>
                    {r.totalVariancePct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {DOT[r.status]} {LABEL[r.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
