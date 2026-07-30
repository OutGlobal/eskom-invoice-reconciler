import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, Cell, ComposedChart,
} from "recharts";
import toast from "react-hot-toast";
import {
  TrendingUp, Scale, CheckCircle2, AlertTriangle, FileSpreadsheet, Download, RefreshCw, Layers, ShieldCheck, DollarSign,
} from "lucide-react";
import { Panel, MetricCard, ZAR, NUM } from "@/components/dashboard/parts";
import { InvoiceSelector } from "@/components/InvoiceSelector";
import { useApp } from "@/lib/store";
import { exportCustomCsv } from "@/lib/exportReports";

export const Route = createFileRoute("/trends")({
  head: () => ({ meta: [{ title: "Trends & Overcharge Recoveries — Eskom Bill Balancer" }] }),
  component: TrendsPage,
});

interface RecoveryRecord {
  period: string;
  dates: string;
  invoiceNo: string;
  chargeCategory: string;
  invoicedAmount: number;
  calculatedAmount: number;
  recoveryAmount: number;
  rootCause: string;
  tariffRef: string;
  status: "approved" | "pending" | "ready";
  actionLoad: () => void;
}

const HISTORICAL_TRENDS_DATA = [
  {
    period: "Feb 2026",
    peakEnergy: 17719245.25,
    standardEnergy: 30240946.76,
    offPeakEnergy: 26042409.43,
    networkCapacity: 3084925.20,
    demandCharge: 2089075.22,
    subsidiesAndLegacy: 15680874.35,
    totalInvoice: 97009239.11,
    recoveryAmount: 878835.00,
  },
  {
    period: "March 2026",
    peakEnergy: 19459345.54,
    standardEnergy: 31433067.54,
    offPeakEnergy: 24479482.75,
    networkCapacity: 3344280.48,
    demandCharge: 2246559.07,
    subsidiesAndLegacy: 15814589.65,
    totalInvoice: 98380358.13,
    recoveryAmount: 601365.00,
  },
  {
    period: "April 2026",
    peakEnergy: 16398169.56,
    standardEnergy: 27598950.78,
    offPeakEnergy: 24846738.18,
    networkCapacity: 3233935.40,
    demandCharge: 2094064.80,
    subsidiesAndLegacy: 14701554.13,
    totalInvoice: 91251855.72,
    recoveryAmount: 620450.40,
  },
  {
    period: "May 2026",
    peakEnergy: 16393641.26,
    standardEnergy: 29774184.81,
    offPeakEnergy: 27084272.58,
    networkCapacity: 3355006.20,
    demandCharge: 2132962.38,
    subsidiesAndLegacy: 15839918.55,
    totalInvoice: 97169250.00,
    recoveryAmount: 318000.00,
  },
];

export function TrendsPage() {
  const invoice = useApp((s) => s.invoice);
  const invoiceLines = useApp((s) => s.invoiceLines);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const recoveryItems: RecoveryRecord[] = useMemo(() => [
    {
      period: "Feb 2026",
      dates: "17/01/2026 - 16/02/2026",
      invoiceNo: "785101497007",
      chargeCategory: "TX Network Capacity Rate Overcharge",
      invoicedAmount: 878835.00,
      calculatedAmount: 0.00,
      recoveryAmount: 878835.00,
      rootCause: "Unnotified Transmission Rate Escalation without 30-day NERSA Gazette notice.",
      tariffRef: "Megaflex Diversity 33kV Sec 4.2",
      status: "approved",
      actionLoad: () => useApp.getState().loadFeb2026SampleInvoice(),
    },
    {
      period: "March 2026",
      dates: "17/02/2026 - 18/03/2026",
      invoiceNo: "7856504676",
      chargeCategory: "Peak Demand Ratchet Reversal",
      invoicedAmount: 2246559.07,
      calculatedAmount: 1645194.07,
      recoveryAmount: 601365.00,
      rootCause: "Simultaneous Maximum Demand reading misapplied during emergency load reduction window.",
      tariffRef: "NERSA Megaflex Schedule 2025/26",
      status: "approved",
      actionLoad: () => useApp.getState().loadMarch2026SampleInvoice(),
    },
    {
      period: "April 2026",
      dates: "19/03/2026 - 16/04/2026",
      invoiceNo: "785684906677",
      chargeCategory: "Mid-Month Tariff Adjustment Variance",
      invoicedAmount: 3233935.40,
      calculatedAmount: 2613485.00,
      recoveryAmount: 620450.40,
      rootCause: "Sub-period day weighting error (13d vs 16d) applied to Network Capacity base rate.",
      tariffRef: "Megaflex Mid-Year Rate Adjustment Rule",
      status: "pending",
      actionLoad: () => useApp.getState().loadApril2026SampleInvoice(),
    },
    {
      period: "May 2026",
      dates: "17/04/2026 - 16/05/2026",
      invoiceNo: "785595072130",
      chargeCategory: "Ancillary & Legacy Subsidy Double Charge",
      invoicedAmount: 11240346.71,
      calculatedAmount: 10922346.71,
      recoveryAmount: 318000.00,
      rootCause: "Electrification Subsidy rate applied to gross consumption before renewable offsets.",
      tariffRef: "Eskom Schedule of Standard Prices 2026",
      status: "ready",
      actionLoad: () => useApp.getState().loadMay2026SampleInvoice(),
    },
  ], []);

  const totalInvoiced4Months = HISTORICAL_TRENDS_DATA.reduce((a, b) => a + b.totalInvoice, 0);
  const totalRecoveries4Months = recoveryItems.reduce((a, b) => a + b.recoveryAmount, 0);
  const approvedRecoveries = recoveryItems.filter((r) => r.status === "approved").reduce((a, b) => a + b.recoveryAmount, 0);
  const pendingRecoveries = recoveryItems.filter((r) => r.status === "pending").reduce((a, b) => a + b.recoveryAmount, 0);
  const readyRecoveries = recoveryItems.filter((r) => r.status === "ready").reduce((a, b) => a + b.recoveryAmount, 0);

  const filteredRecoveries = useMemo(() => {
    if (filterCategory === "all") return recoveryItems;
    return recoveryItems.filter((r) => r.status === filterCategory);
  }, [recoveryItems, filterCategory]);

  const handleExportDisputePackage = () => {
    const headers = [
      "Billing Period",
      "Dates",
      "Invoice Number",
      "Overcharge Category",
      "Invoiced Amount (R)",
      "Reconciled Amount (R)",
      "Recovery Claim Amount (R)",
      "Status",
      "Root Cause",
      "Tariff Contract Reference",
    ];
    const rows = filteredRecoveries.map((r) => [
      r.period,
      r.dates,
      r.invoiceNo,
      r.chargeCategory,
      r.invoicedAmount,
      r.calculatedAmount,
      r.recoveryAmount,
      r.status.toUpperCase(),
      r.rootCause,
      r.tariffRef,
    ]);
    exportCustomCsv("Eskom_Overcharge_Dispute_Package", headers, rows);
    toast.success("Eskom Overcharge Dispute & Recovery Claim Package Exported!");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Charge Trends &amp; Overcharge Recoveries
          </h1>
          <p className="text-xs text-muted-foreground">
            Multi-period Eskom charge trend analytics, billing variance tracking, and recovery claim auditing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportDisputePackage}
            className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 font-medium transition shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Recovery Claims Package
          </button>
        </div>
      </div>

      {/* Invoice Selector Component */}
      <div className="rounded-lg border border-primary/20 bg-card p-3 shadow-sm">
        <InvoiceSelector />
      </div>

      {/* Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="4-Month Eskom Invoiced Total"
          value={ZAR(totalInvoiced4Months)}
          sub="Feb 2026 – May 2026 Total"
        />
        <MetricCard
          label="Identified Overcharge Recoveries"
          value={ZAR(totalRecoveries4Months)}
          accent
          sub="Potential refunds across 4 cycles"
        />
        <MetricCard
          label="Approved Eskom Credits"
          value={ZAR(approvedRecoveries)}
          sub="2 Claims Processed &amp; Credited"
        />
        <MetricCard
          label="Pending &amp; Filing Pipeline"
          value={ZAR(pendingRecoveries + readyRecoveries)}
          sub="2 Active Dispute Claims"
        />
      </div>

      {/* Trend Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charge Breakdown Trend Chart */}
        <Panel
          title="Eskom Charge Component Breakdown & Overall Bill Trend Line (ZAR)"
          subtitle="Monthly breakdown of Peak, Standard, Off-Peak Energy, Network & Subsidies with overall Invoiced Bill Trend Line."
        >
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={HISTORICAL_TRENDS_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="period" stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={10} tickFormatter={(v) => `R ${(v / 1e6).toFixed(1)}M`} />
                <Tooltip
                  formatter={(val: number, name: string) => [ZAR(val), name]}
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "#334155", borderRadius: "6px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="peakEnergy" name="Peak Energy" stackId="a" fill="#ef4444" />
                <Bar dataKey="standardEnergy" name="Standard Energy" stackId="a" fill="#eab308" />
                <Bar dataKey="offPeakEnergy" name="Off-Peak Energy" stackId="a" fill="#10b981" />
                <Bar dataKey="networkCapacity" name="Network Capacity" stackId="a" fill="#3b82f6" />
                <Bar dataKey="demandCharge" name="Demand Charge" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="subsidiesAndLegacy" name="Subsidies & Legacy" stackId="a" fill="#64748b" />
                <Line
                  type="monotone"
                  dataKey="totalInvoice"
                  name="Total Invoiced Bill (Trend Line)"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#06b6d4" }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Identified Overcharge Recoveries Trend */}
        <Panel
          title="Identified Overcharge Recoveries & Recovery Trend Line (ZAR)"
          subtitle="Monthly overcharge recoveries identified by system calculations overlayed with 4-month recovery trend line."
        >
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={HISTORICAL_TRENDS_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="period" stroke="#888888" fontSize={11} />
                <YAxis stroke="#888888" fontSize={10} tickFormatter={(v) => `R ${(v / 1e3).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: number, name: string) => [ZAR(val), name]}
                  contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderColor: "#334155", borderRadius: "6px", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                <Bar dataKey="recoveryAmount" name="Recovery Amount (ZAR)">
                  {HISTORICAL_TRENDS_DATA.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 || index === 1 ? "#10b981" : index === 2 ? "#f59e0b" : "#06b6d4"}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="recoveryAmount"
                  name="Recovery Trend Line"
                  stroke="#10b981"
                  strokeWidth={3}
                  strokeDasharray="4 4"
                  dot={{ r: 5, fill: "#10b981" }}
                  activeDot={{ r: 7 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Period-by-Period Recoveries Audit Table */}
      <Panel
        title="Period-by-Period Overcharge & Recovery Audit Log"
        subtitle="Detailed register of identified billing overcharges, supply points, Eskom tariff non-compliance, and claim status."
        action={
          <div className="flex items-center gap-1 bg-secondary p-0.5 rounded border border-border text-xs">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Recoveries ({recoveryItems.length})
            </button>
            <button
              onClick={() => setFilterCategory("approved")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "approved" ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Approved (2)
            </button>
            <button
              onClick={() => setFilterCategory("pending")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "pending" ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Under Review (1)
            </button>
            <button
              onClick={() => setFilterCategory("ready")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "ready" ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ready for Filing (1)
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">Billing Period</th>
                <th className="text-left px-3 py-2.5">Supply Location</th>
                <th className="text-left px-3 py-2.5">Overcharge Category</th>
                <th className="text-right px-3 py-2.5">Invoiced (R)</th>
                <th className="text-right px-3 py-2.5">Reconciled (R)</th>
                <th className="text-right px-3 py-2.5">Recovery Claim (R)</th>
                <th className="text-left px-3 py-2.5">Tariff Ref &amp; Root Cause</th>
                <th className="text-center px-3 py-2.5">Status</th>
                <th className="text-right px-3 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecoveries.map((item, idx) => (
                <tr key={idx} className="hover:bg-muted/40 transition">
                  <td className="px-3 py-3">
                    <div className="font-medium text-xs">{item.period}</div>
                    <div className="text-[11px] text-muted-foreground">{item.dates}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">Inv: {item.invoiceNo}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-medium">Millennium 33kV</div>
                    <div className="text-[10px] text-muted-foreground font-mono">Premise: 7856504226</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-xs">{item.chargeCategory}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{ZAR(item.invoicedAmount)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground">{ZAR(item.calculatedAmount)}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-emerald-400">
                    {ZAR(item.recoveryAmount)}
                  </td>
                  <td className="px-3 py-3 max-w-xs">
                    <div className="text-xs text-foreground truncate">{item.rootCause}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{item.tariffRef}</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {item.status === "approved" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" /> Approved &amp; Credited
                      </span>
                    )}
                    {item.status === "pending" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/30">
                        <AlertTriangle className="h-3 w-3" /> Dispute Under Review
                      </span>
                    )}
                    {item.status === "ready" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-500/30">
                        <ShieldCheck className="h-3 w-3" /> Ready for Filing
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => {
                        item.actionLoad();
                        toast.success(`Loaded ${item.period} Invoice into active session!`);
                      }}
                      className="text-xs bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded px-2.5 py-1 font-medium transition"
                    >
                      Load Session
                    </button>
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
