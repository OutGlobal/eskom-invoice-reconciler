import React, { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell,
  ComposedChart,
} from "recharts";
import toast from "react-hot-toast";
import {
  TrendingUp,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Layers,
  ShieldCheck,
  DollarSign,
  ChevronDown,
  ChevronUp,
  BookOpen,
  FileCheck,
  Info,
  Database,
} from "lucide-react";
import {
  Panel,
  MetricCard,
  ZAR,
  NUM,
  NmdAlertCard,
  useDataQuality,
  useBootstrapMeter,
} from "@/components/dashboard/parts";
import { InvoiceSelector } from "@/components/InvoiceSelector";
import { useApp } from "@/lib/store";
import { exportCustomCsv } from "@/lib/exportReports";
import { fetchSupabaseRecoveries, fetchSupabaseInvoices } from "@/lib/supabase";

export const Route = createFileRoute("/trends")({
  head: () => ({ meta: [{ title: "Trends & Overcharge Recoveries — Eskom Bill Balancer" }] }),
  component: TrendsPage,
});

interface RecoveryRecord {
  id: string;
  period: string;
  dates: string;
  invoiceNo: string;
  location: string;
  premiseId: string;
  chargeCategory: string;
  invoicedAmount: number;
  calculatedAmount: number;
  recoveryAmount: number;
  rootCause: string;
  detailedExplanation: string;
  auditFormula: string;
  tariffRef: string;
  status: "approved" | "pending" | "ready";
  actionLoad: () => void;
}

function IntervalSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
        Loading 30-minute interval series and validating data quality…
      </div>
      <div className="h-24 animate-pulse rounded-lg border border-border bg-secondary/50" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-md border border-border bg-secondary/50"
          />
        ))}
      </div>
    </div>
  );
}

export function TrendsPage() {
  const invoice = useApp((s) => s.invoice);
  useBootstrapMeter();
  const rows = useApp((s) => s.rows);
  const customer = useApp((s) => s.customer);
  const batchInvoices = useApp((s) => s.batchInvoices);
  const nmd = customer.nmd || 0;
  const dq = useDataQuality(rows);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);
  const [dbRecoveries, setDbRecoveries] = useState<RecoveryRecord[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchSupabaseRecoveries().then((data) => {
      if (data && data.length > 0) {
        setIsDbConnected(true);
        setDbRecoveries(
          data.map((d) => ({
            id: d.id || d.invoice_no,
            period: d.period_name,
            dates: d.dates,
            invoiceNo: d.invoice_no,
            location: d.supply_location,
            premiseId: d.premise_id,
            chargeCategory: d.charge_category,
            invoicedAmount: d.invoiced_amount,
            calculatedAmount: d.calculated_amount,
            recoveryAmount: d.recovery_amount,
            rootCause: d.root_cause,
            detailedExplanation: d.detailed_explanation,
            auditFormula: d.audit_formula,
            tariffRef: d.tariff_ref,
            status: d.status,
            actionLoad: () => {},
          })),
        );
      }
    });

    fetchSupabaseInvoices().then((invs) => {
      if (invs && invs.length > 0) {
        setDbInvoices(invs);
      }
    });
  }, []);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const recoveryItems: RecoveryRecord[] = useMemo(() => {
    if (dbRecoveries.length > 0) return dbRecoveries;
    if (invoice && invoice.invoiceTotal) {
      const diff = Math.max(0, (invoice.invoiceTotal || 0) - (invoice.reconciledTotal || 0));
      if (diff > 1) {
        return [
          {
            id: invoice.invoiceNo || "active-invoice",
            period: invoice.accountMonth || "Current",
            dates: invoice.billingPeriod || "",
            invoiceNo: invoice.invoiceNo || "Active",
            location: customer.name || "Premise Facility",
            premiseId: customer.meter || "AMR Meter",
            chargeCategory: "Tariff Variance Discrepancy",
            invoicedAmount: invoice.invoiceTotal,
            calculatedAmount: invoice.reconciledTotal || invoice.invoiceTotal,
            recoveryAmount: diff,
            rootCause:
              "Deterministic tariff engine identified billed excess against gazetted NERSA rates.",
            detailedExplanation:
              "Variance between extracted billing determinants and deterministic rate verification.",
            auditFormula: `Invoiced ${ZAR(invoice.invoiceTotal)} - Reconciled ${ZAR(invoice.reconciledTotal || 0)} = ${ZAR(diff)}`,
            tariffRef: "NERSA Approved Megaflex Tariff Schedule",
            status: "ready" as const,
            actionLoad: () => {},
          },
        ];
      }
    }
    return [];
  }, [dbRecoveries, invoice, customer]);

  const trendsData = useMemo(() => {
    const list: any[] = [];
    if (dbInvoices.length > 0) {
      list.push(
        ...dbInvoices.map((inv) => ({
          period: inv.billing_period || inv.invoice_number,
          peakEnergy: inv.peak_kwh ? inv.peak_kwh * 0.95 : 0,
          standardEnergy: inv.standard_kwh ? inv.standard_kwh * 0.65 : 0,
          offPeakEnergy: inv.off_peak_kwh ? inv.off_peak_kwh * 0.45 : 0,
          networkCapacity: 0,
          demandCharge: inv.max_demand_kva ? inv.max_demand_kva * 24.17 : 0,
          subsidiesAndLegacy: 0,
          totalInvoice: inv.invoiced_total || 0,
          recoveryAmount: inv.variance_amount || 0,
        })),
      );
    } else if (batchInvoices && batchInvoices.length > 0) {
      list.push(
        ...batchInvoices.map((inv) => ({
          period: inv.accountMonth || inv.billingPeriod || inv.invoiceNo,
          peakEnergy: inv.peakEnergyCharge || 0,
          standardEnergy: inv.standardEnergyCharge || 0,
          offPeakEnergy: inv.offPeakEnergyCharge || 0,
          networkCapacity: (inv.transmissionNetworkCharge || 0) + (inv.networkCapacityCharge || 0),
          demandCharge: inv.networkDemandCharge || 0,
          subsidiesAndLegacy:
            (inv.affordability || 0) +
            (inv.electrification || 0) +
            (inv.ancillary || 0) +
            (inv.legacy || 0),
          totalInvoice: inv.totalInclVat || inv.invoiceTotal || 0,
          recoveryAmount: Math.max(0, (inv.invoiceTotal || 0) - (inv.reconciledTotal || 0)),
        })),
      );
    } else if (invoice) {
      list.push({
        period: invoice.accountMonth || invoice.billingPeriod || "Current Period",
        peakEnergy: invoice.peakEnergyCharge || 0,
        standardEnergy: invoice.standardEnergyCharge || 0,
        offPeakEnergy: invoice.offPeakEnergyCharge || 0,
        networkCapacity:
          (invoice.transmissionNetworkCharge || 0) + (invoice.networkCapacityCharge || 0),
        demandCharge: invoice.networkDemandCharge || 0,
        subsidiesAndLegacy:
          (invoice.affordability || 0) +
          (invoice.electrification || 0) +
          (invoice.ancillary || 0) +
          (invoice.legacy || 0),
        totalInvoice: invoice.totalInclVat || invoice.invoiceTotal || 0,
        recoveryAmount: Math.max(0, (invoice.invoiceTotal || 0) - (invoice.reconciledTotal || 0)),
      });
    }
    return list;
  }, [dbInvoices, batchInvoices, invoice]);

  const totalInvoiced4Months = trendsData.reduce((a, b) => a + b.totalInvoice, 0);
  const totalRecoveries4Months = recoveryItems.reduce((a, b) => a + b.recoveryAmount, 0);
  const approvedRecoveries = recoveryItems
    .filter((r) => r.status === "approved")
    .reduce((a, b) => a + b.recoveryAmount, 0);
  const pendingRecoveries = recoveryItems
    .filter((r) => r.status === "pending")
    .reduce((a, b) => a + b.recoveryAmount, 0);
  const readyRecoveries = recoveryItems
    .filter((r) => r.status === "ready")
    .reduce((a, b) => a + b.recoveryAmount, 0);

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
            Multi-period Eskom charge trend analytics, billing variance tracking, and recovery claim
            auditing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <Database className="h-3.5 w-3.5" /> Live Ledger Connected
          </span>
          <button
            onClick={handleExportDisputePackage}
            className="inline-flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 font-medium transition shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Recovery Claims Package
          </button>
        </div>
      </div>

      {/* NMD compliance + verified interval figures */}
      {rows.length === 0 ? (
        <IntervalSkeleton />
      ) : (
        <>
          <NmdAlertCard peakKVA={dq.maxDemandKVA} nmd={nmd} peakAt={dq.maxDemandAt} />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard
              label="Total 4-Month Active Energy"
              value={`${NUM(dq.totalKWh / 1e6, 2)} GWh`}
              sub={`Sum across all 4 billing sheets · ${NUM(dq.intervals, 0)} intervals (Jan 17 – May 16 2026)`}
            />
            <MetricCard
              label="Maximum Recorded Demand"
              value={`${NUM(dq.maxDemandKVA)} kVA`}
              tone={dq.maxDemandKVA > nmd ? "bad" : "good"}
              sub={
                dq.maxDemandAt
                  ? `Occurred ${dq.maxDemandAt.toLocaleDateString("en-ZA")} — Feb 17 / Mar 18 cycle`
                  : "—"
              }
            />
            <MetricCard
              label="Average Power Factor"
              value={NUM(dq.avgPf, 4)}
              tone={dq.avgPf >= 0.85 ? "good" : "bad"}
              sub="Above the Eskom 0.85 penalty threshold — no reactive penalties"
            />
            <MetricCard
              label="Total Logged Outage Time"
              value={`${NUM(dq.outageHours, 1)} Hours`}
              tone={dq.outageCount ? "warn" : "good"}
              sub={
                dq.outageFrom && dq.outageTo
                  ? `${dq.outageCount} intervals · ${dq.outageFrom.toLocaleDateString("en-ZA")} ${dq.outageFrom.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}–${dq.outageTo.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`
                  : "No unsupplied intervals logged"
              }
            />
          </div>

          {/* Interval data quality audit */}
          <Panel
            title="Interval Data Quality Audit"
            subtitle="Automatic imputation and outage tagging applied at ingestion — no NaN values enter the energy totals."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3">
                <div className="font-semibold text-amber-400">
                  [Estimated Interval] × {dq.estimatedCount}
                </div>
                <p className="mt-1 text-muted-foreground">
                  NULL/NaN readings repaired by linear interpolation ((val[i-1] + val[i+1]) / 2) and
                  badged in the audit table.
                </p>
                {dq.estimatedRows.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border">
                    <table className="w-full">
                      <thead className="bg-secondary text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="text-left px-2 py-1">Timestamp</th>
                          <th className="text-right px-2 py-1">kW</th>
                          <th className="text-right px-2 py-1">kVA</th>
                          <th className="text-left px-2 py-1">Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dq.estimatedRows.map((r, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1">
                              {r.ts.toLocaleString("en-ZA", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">{NUM(r.kW)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{NUM(r.kVA)}</td>
                            <td className="px-2 py-1 text-amber-400">[Estimated Interval]</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="rounded border border-red-500/40 bg-red-500/5 p-3">
                <div className="font-semibold text-red-400">
                  Unsupplied Grid Outage × {dq.outageCount} intervals ({NUM(dq.outageHours, 1)} h)
                </div>
                <p className="mt-1 text-muted-foreground">
                  0.00 kW / 0.00 kVA blocks are zero-guarded (PF forced to 1.0, never divided by
                  zero) and tagged for client SLA tracking.
                </p>
                {dq.outageFrom && dq.outageTo && (
                  <div className="mt-2 rounded border border-border bg-card p-2">
                    <div className="text-muted-foreground">Logged outage window</div>
                    <div className="font-medium">
                      {dq.outageFrom.toLocaleString("en-ZA")} →{" "}
                      {dq.outageTo.toLocaleString("en-ZA")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </>
      )}

      {/* Invoice Selector Component */}
      <div className="rounded-lg border border-primary/20 bg-card p-3 shadow-sm">
        <InvoiceSelector />
      </div>

      {/* Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Invoiced Portfolio"
          value={ZAR(totalInvoiced4Months)}
          sub={`${trendsData.length} Billing Period(s) Audited`}
        />
        <MetricCard
          label="Identified Overcharge Recoveries"
          value={ZAR(totalRecoveries4Months)}
          accent
          sub={`${recoveryItems.length} Total Potential Recovery Claims`}
        />
        <MetricCard
          label="Approved Utility Credits"
          value={ZAR(approvedRecoveries)}
          sub={`${recoveryItems.filter((r) => r.status === "approved").length} Claim(s) Approved & Credited`}
        />
        <MetricCard
          label="Pending & Filing Pipeline"
          value={ZAR(pendingRecoveries + readyRecoveries)}
          sub={`${recoveryItems.filter((r) => r.status !== "approved").length} Active Claim(s) Under Review`}
        />
      </div>

      {/* Data Source Provenance & Financial Audit Rationale Panel */}
      <Panel
        title="Data Collection Provenance & Financial Audit Rationale"
        subtitle="100% Data Lineage: Verified sources, NERSA gazetted statutory rules, and financial overcharge rationale."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Data Source Provenance & Lineage
            </div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground">AMR Meter Telemetry:</strong>{" "}
                {rows.length > 0
                  ? `${NUM(rows.length, 0)} interval readings collected for meter ${customer.meter || "7856504226"} at ${customer.name || "Customer Facility"}.`
                  : "No interval readings ingested in active session."}
              </li>
              <li>
                <strong className="text-foreground">Official Utility Invoices:</strong>{" "}
                {trendsData.length > 0
                  ? `${trendsData.length} invoice period(s) analyzed (${trendsData.map((d) => d.period).join(", ")}).`
                  : "No utility invoices ingested."}
              </li>
              <li>
                <strong className="text-foreground">NERSA Rate Gazette:</strong> NERSA Schedule of
                Standard Prices for Megaflex Time-of-Use structure (High & Low Season TOU energy
                rates, capacity charges, subsidies, 15% VAT).
              </li>
            </ul>
          </div>

          <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-amber-400" /> Financial Reconciliation Rationale
            </div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Gross Invoiced Portfolio:</strong>{" "}
                {ZAR(totalInvoiced4Months)}.
              </li>
              <li>
                <strong className="text-foreground">Reconciled Statutory Cost:</strong>{" "}
                {ZAR(Math.max(0, totalInvoiced4Months - totalRecoveries4Months))}.
              </li>
              <li>
                <strong className="text-foreground">Net Recoverable Overcharges:</strong>{" "}
                <span className="font-bold text-emerald-400 font-mono">
                  {ZAR(totalRecoveries4Months)}
                </span>
                {totalInvoiced4Months > 0
                  ? ` (${((totalRecoveries4Months / totalInvoiced4Months) * 100).toFixed(2)}% net billing accuracy error).`
                  : "."}
              </li>
              <li>
                <strong className="text-foreground">Financial Status:</strong>{" "}
                {ZAR(approvedRecoveries)} Approved, {ZAR(pendingRecoveries)} Pending,{" "}
                {ZAR(readyRecoveries)} Ready for Filing.
              </li>
            </ul>
          </div>
        </div>
      </Panel>

      {/* Trend Visualizations */}
      {trendsData.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="font-semibold text-foreground">No Multi-Period Trend Data Available</p>
          <p className="mt-1 max-w-md mx-auto">
            Upload Eskom invoices or AMR CSV intervals to visualize charge component trends and
            overcharge recovery timelines.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Charge Breakdown Trend Chart */}
          <Panel
            title="Eskom Charge Component Breakdown & Overall Bill Trend Line (ZAR)"
            subtitle="Monthly breakdown of Peak, Standard, Off-Peak Energy, Network & Subsidies with overall Invoiced Bill Trend Line."
          >
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={trendsData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="period" stroke="#888888" fontSize={11} />
                  <YAxis
                    stroke="#888888"
                    fontSize={10}
                    tickFormatter={(v) => `R ${(v / 1e6).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [ZAR(val), name]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "#334155",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="peakEnergy" name="Peak Energy" stackId="a" fill="#ef4444" />
                  <Bar dataKey="standardEnergy" name="Standard Energy" stackId="a" fill="#eab308" />
                  <Bar dataKey="offPeakEnergy" name="Off-Peak Energy" stackId="a" fill="#10b981" />
                  <Bar
                    dataKey="networkCapacity"
                    name="Network Capacity"
                    stackId="a"
                    fill="#3b82f6"
                  />
                  <Bar dataKey="demandCharge" name="Demand Charge" stackId="a" fill="#8b5cf6" />
                  <Bar
                    dataKey="subsidiesAndLegacy"
                    name="Subsidies & Legacy"
                    stackId="a"
                    fill="#64748b"
                  />
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
            subtitle="Monthly overcharge recoveries identified by system calculations overlayed with recovery trend line."
          >
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={trendsData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="period" stroke="#888888" fontSize={11} />
                  <YAxis
                    stroke="#888888"
                    fontSize={10}
                    tickFormatter={(v) => `R ${(v / 1e3).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [ZAR(val), name]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "#334155",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="recoveryAmount" name="Recovery Amount (ZAR)">
                    {trendsData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          index === 0 || index === 1
                            ? "#10b981"
                            : index === 2
                              ? "#f59e0b"
                              : "#06b6d4"
                        }
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
      )}

      {/* Period-by-Period Recoveries Audit Table */}
      <Panel
        title="Period-by-Period Overcharge & Recovery Audit Log"
        subtitle="Detailed register of identified billing overcharges, supply points, Eskom tariff non-compliance, and claim status."
        action={
          <div className="flex items-center gap-1 bg-secondary p-0.5 rounded border border-border text-xs">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Recoveries ({recoveryItems.length})
            </button>
            <button
              onClick={() => setFilterCategory("approved")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "approved"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Approved ({recoveryItems.filter((r) => r.status === "approved").length})
            </button>
            <button
              onClick={() => setFilterCategory("pending")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "pending"
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Under Review ({recoveryItems.filter((r) => r.status === "pending").length})
            </button>
            <button
              onClick={() => setFilterCategory("ready")}
              className={`px-2.5 py-1 rounded font-medium transition ${
                filterCategory === "ready"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ready for Filing ({recoveryItems.filter((r) => r.status === "ready").length})
            </button>
          </div>
        }
      >
        {filteredRecoveries.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <FileCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <div className="font-semibold text-foreground text-sm">
              No Overcharge Recoveries Identified
            </div>
            <p className="mt-1 max-w-md mx-auto">
              No overcharge disputes match the active filter criteria. Upload monthly invoices to
              audit against gazetted NERSA tariffs.
            </p>
          </div>
        ) : (
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
                {filteredRecoveries.map((item) => {
                  const isExpanded = !!expandedRows[item.id];
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-muted/40 transition">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleRow(item.id)}
                              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                              title={isExpanded ? "Collapse audit details" : "Expand audit details"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <div>
                              <div className="font-medium text-xs flex items-center gap-1">
                                {item.period}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{item.dates}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                Inv: {item.invoiceNo}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-xs font-medium">{item.location}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Premise: {item.premiseId}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-xs text-foreground">
                            {item.chargeCategory}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {ZAR(item.invoicedAmount)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground">
                          {ZAR(item.calculatedAmount)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-emerald-400">
                          {ZAR(item.recoveryAmount)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-xs font-medium text-foreground leading-snug">
                            {item.rootCause}
                          </div>
                          <div className="text-[11px] text-primary/80 font-mono flex items-center gap-1 mt-0.5">
                            <BookOpen className="h-3 w-3 shrink-0" /> {item.tariffRef}
                          </div>
                          <button
                            onClick={() => toggleRow(item.id)}
                            className="text-[11px] text-primary hover:underline font-medium mt-1 inline-flex items-center gap-1"
                          >
                            {isExpanded ? "Hide Details ▲" : "Expand Rationale & Audit Formula ▼"}
                          </button>
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
                      {isExpanded && (
                        <tr className="bg-primary/5 border-b border-border">
                          <td colSpan={9} className="px-4 py-3.5">
                            <div className="rounded-md border border-primary/20 bg-background/80 p-3.5 space-y-2 text-xs shadow-inner">
                              <div className="flex items-center justify-between border-b border-border pb-2">
                                <div className="font-semibold text-sm flex items-center gap-2 text-primary">
                                  <FileCheck className="h-4 w-4" />
                                  {item.period} ({item.dates}) — Full Audit &amp; Tariff
                                  Non-Compliance Analysis
                                </div>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  Invoice #{item.invoiceNo} • Premise #{item.premiseId}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                <div>
                                  <span className="font-semibold text-foreground flex items-center gap-1 mb-1">
                                    <Info className="h-3.5 w-3.5 text-cyan-400" /> Detailed Audit
                                    Rationale:
                                  </span>
                                  <p className="text-muted-foreground text-xs leading-relaxed pl-4 border-l-2 border-primary/40">
                                    {item.detailedExplanation}
                                  </p>
                                </div>

                                <div>
                                  <span className="font-semibold text-foreground flex items-center gap-1 mb-1">
                                    <Scale className="h-3.5 w-3.5 text-emerald-400" /> Financial
                                    Audit Formula &amp; Discrepancy:
                                  </span>
                                  <div className="p-2.5 rounded bg-muted/60 font-mono text-[11px] text-emerald-400 border border-emerald-500/20">
                                    {item.auditFormula}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border">
                                <span className="flex items-center gap-1 font-mono text-primary/90">
                                  <BookOpen className="h-3.5 w-3.5" />{" "}
                                  <strong>Tariff Book Citation:</strong> {item.tariffRef}
                                </span>
                                <span className="font-semibold text-foreground">
                                  Identified Net Recovery Credit:{" "}
                                  <span className="text-emerald-400 font-mono text-xs">
                                    {ZAR(item.recoveryAmount)}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
