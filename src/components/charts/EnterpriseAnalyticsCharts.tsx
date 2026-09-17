import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Activity,
  DollarSign,
  Building2,
  AlertTriangle,
  History,
  RefreshCw,
} from "lucide-react";
import { TOU_COLOR } from "@/lib/tariff";
import { ZAR, NUM } from "@/components/dashboard/parts";
import { ChartDataService } from "@/domain/charts/chartDataService";
import type { AllChartsData } from "@/domain/charts/types";
import type { DashboardFilterState } from "@/domain/dashboard/types";
import { ChartEmptyState } from "./ChartEmptyState";
import { useApp } from "@/lib/store";
import { useDerived } from "@/components/dashboard/parts";

export type ChartTabKey =
  | "monthly_consumption"
  | "monthly_cost"
  | "tou_breakdown"
  | "demand_profile"
  | "variance_trend"
  | "site_comparison"
  | "billing_trend"
  | "anomaly_trend";

interface EnterpriseAnalyticsChartsProps {
  filters?: DashboardFilterState;
  defaultTab?: ChartTabKey;
}

export const EnterpriseAnalyticsCharts: React.FC<EnterpriseAnalyticsChartsProps> = ({
  filters = { source: "database" },
  defaultTab = "monthly_consumption",
}) => {
  const [activeTab, setActiveTab] = useState<ChartTabKey>(defaultTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [chartsData, setChartsData] = useState<AllChartsData | null>(null);

  // Reactive store context
  const invoice = useApp((s) => s.invoice);
  const calculatedTotal = useDerived().calculatedTotal;
  const totals = useDerived().totals;
  const charges = useDerived().charges;
  const invoiceTotal = useApp((s) => s.invoiceTotal);
  const customer = useApp((s) => s.customer);
  const rows = useApp((s) => s.rows);
  const batchInvoices = useApp((s) => s.batchInvoices);
  const validationIssues = useApp((s) => s.validation);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await ChartDataService.getAllChartsData(filters, {
        invoice,
        totals,
        charges,
        calculatedTotal,
        invoiceTotal,
        customer,
        rows,
        batchInvoices,
        validationIssues,
      });
      setChartsData(result);
    } catch (err) {
      console.error("Failed to load real chart data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    filters.organisationId,
    filters.siteId,
    filters.accountNumber,
    filters.startDate,
    filters.endDate,
    filters.source,
    invoice,
    calculatedTotal,
    invoiceTotal,
    rows.length,
    batchInvoices?.length,
  ]);

  const tabs: Array<{ id: ChartTabKey; label: string; icon: any }> = [
    { id: "monthly_consumption", label: "1. Monthly Consumption", icon: BarChart3 },
    { id: "monthly_cost", label: "2. Monthly Cost", icon: DollarSign },
    { id: "tou_breakdown", label: "3. Peak / Std / Off-Peak", icon: Zap },
    { id: "demand_profile", label: "4. Demand vs NMD", icon: Activity },
    { id: "variance_trend", label: "5. Variance Trend", icon: TrendingUp },
    { id: "site_comparison", label: "6. Site Comparison", icon: Building2 },
    { id: "billing_trend", label: "7. Billing Trend", icon: History },
    { id: "anomaly_trend", label: "8. Anomaly Trend", icon: AlertTriangle },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header & Refresh Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight uppercase flex items-center gap-2 text-foreground">
            <BarChart3 className="h-4 w-4 text-primary" />
            Enterprise Analytics &amp; Energy Intelligence Visualizations
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real database audit records, verified deterministic tariff calculations &amp; telemetry profiles
          </p>
        </div>

        <div className="flex items-center gap-2">
          {chartsData && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                chartsData.isLiveDatabase
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : "bg-blue-500/10 text-blue-500 border-blue-500/30"
              }`}
            >
              {chartsData.isLiveDatabase ? "Live Database Feed" : "Store Ingestion Feed"}
            </span>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-secondary hover:bg-accent text-foreground transition"
            title="Refresh chart datasets"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chart Canvas or Loading Skeleton */}
      <div className="w-full min-h-[320px] relative">
        {loading && !chartsData ? (
          <div className="h-[320px] w-full flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : !chartsData ? (
          <ChartEmptyState
            title="No Data Available"
            message="No active database records or session invoices found."
          />
        ) : (
          <>
            {/* 1. Monthly Consumption */}
            {activeTab === "monthly_consumption" && (
              chartsData.monthlyConsumption.hasData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartsData.monthlyConsumption.data}
                    margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickFormatter={(v) => `${(v / 1000).toLocaleString()} MWh`}
                      width={85}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${NUM(v, 0)} kWh`, "Consumption"]}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="totalKwh" name="Total Consumption (kWh)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  title="No Monthly Consumption Data"
                  message={chartsData.monthlyConsumption.emptyReason}
                  icon="chart"
                />
              )
            )}

            {/* 2. Monthly Cost */}
            {activeTab === "monthly_cost" && (
              chartsData.monthlyCost.hasData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartsData.monthlyCost.data}
                    margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                      width={85}
                    />
                    <Tooltip
                      formatter={(v: number) => [ZAR(v), ""]}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="billedZar" name="Billed Amount (ZAR)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="calculatedZar" name="Calculated Tariff (ZAR)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  title="No Monthly Cost Data"
                  message={chartsData.monthlyCost.emptyReason}
                  icon="database"
                />
              )
            )}

            {/* 3. Peak / Standard / Off-Peak TOU */}
            {activeTab === "tou_breakdown" && (
              chartsData.touBreakdown.hasData ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[320px]">
                  <div className="lg:col-span-2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartsData.touBreakdown.data}
                        margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                      >
                        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          width={75}
                        />
                        <Tooltip
                          formatter={(v: number) => [`${NUM(v, 0)} kWh`, ""]}
                          contentStyle={{
                            backgroundColor: "var(--color-popover)",
                            borderColor: "var(--color-border)",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="peakKwh" name="Peak kWh" stackId="tou" fill={TOU_COLOR.peak} />
                        <Bar dataKey="standardKwh" name="Standard kWh" stackId="tou" fill={TOU_COLOR.standard} />
                        <Bar dataKey="offPeakKwh" name="Off-Peak kWh" stackId="tou" fill={TOU_COLOR.offPeak} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-full flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-card/50">
                    <div className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">
                      Aggregate TOU Ratio
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={chartsData.touBreakdown.distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {chartsData.touBreakdown.distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, name: string) => [`${NUM(v, 0)} kWh`, name]}
                          contentStyle={{
                            backgroundColor: "var(--color-popover)",
                            borderColor: "var(--color-border)",
                            borderRadius: "6px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 justify-center text-[10px] font-mono">
                      {chartsData.touBreakdown.distribution.map((d) => (
                        <div key={d.name} className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span>{d.name.split(" ")[0]}: {d.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <ChartEmptyState
                  title="No TOU Determinants Available"
                  message={chartsData.touBreakdown.emptyReason}
                  icon="chart"
                />
              )
            )}

            {/* 4. Demand Profile vs NMD */}
            {activeTab === "demand_profile" && (
              chartsData.demandProfile.hasData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={chartsData.demandProfile.data}
                    margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} minTickGap={30} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      unit=" kVA"
                      width={80}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${NUM(v, 1)} kVA`, "Demand"]}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    {chartsData.demandProfile.data[0]?.nmdKva > 0 && (
                      <ReferenceLine
                        y={chartsData.demandProfile.data[0].nmdKva}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{
                          value: `Agreed NMD (${NUM(chartsData.demandProfile.data[0].nmdKva, 0)} kVA)`,
                          fill: "#f59e0b",
                          fontSize: 11,
                          position: "insideTopLeft",
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="demandKva"
                      name="Measured Demand (kVA)"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  title="No Demand Telemetry Recorded"
                  message={chartsData.demandProfile.emptyReason}
                  icon="upload"
                />
              )
            )}

            {/* 5. Variance Trend */}
            {activeTab === "variance_trend" && (
              chartsData.varianceTrend.hasData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartsData.varianceTrend.data}
                    margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                      width={85}
                    />
                    <Tooltip
                      formatter={(v: number) => [ZAR(v), ""]}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <ReferenceLine y={0} stroke="var(--color-border)" />
                    <Bar dataKey="overbillingZar" name="Overbilling Recovery Claim (ZAR)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="underbillingZar" name="Underbilling Exposure (ZAR)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  title="No Reconciliation Variance Records"
                  message={chartsData.varianceTrend.emptyReason}
                  icon="database"
                />
              )
            )}

            {/* 6. Site Comparison */}
            {activeTab === "site_comparison" && (
              chartsData.siteComparison.hasData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartsData.siteComparison.data}
                    margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="siteName" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)} MWh`}
                      width={85}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name.includes("Cost") ? ZAR(v) : `${NUM(v, 0)} kWh`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="totalKwh" name="Energy Consumed (kWh)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  title="No Site Portfolio Data"
                  message={chartsData.siteComparison.emptyReason}
                  icon="chart"
                />
              )
            )}

            {/* 7. Billing Trend */}
            {activeTab === "billing_trend" && (
              chartsData.billingTrend.hasData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={chartsData.billingTrend.data}
                    margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                      width={80}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      unit=" R/kWh"
                      width={70}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name.includes("Rate") ? `R ${v.toFixed(4)} / kWh` : ZAR(v),
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="billedZar"
                      name="Billed Cost (ZAR)"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="calculatedZar"
                      name="Calculated Tariff (ZAR)"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="effectiveRateZarPerKwh"
                      name="Effective Blended Rate (R/kWh)"
                      stroke="#8b5cf6"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  title="Insufficient Billing Trend Cycles"
                  message={chartsData.billingTrend.emptyReason}
                  icon="database"
                />
              )
            )}

            {/* 8. Anomaly Trend */}
            {activeTab === "anomaly_trend" && (
              chartsData.anomalyTrend.hasData ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={chartsData.anomalyTrend.data}
                    margin={{ top: 12, right: 24, left: 12, bottom: 20 }}
                  >
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      allowDecimals={false}
                      width={45}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v} anomalies`, name]}
                      contentStyle={{
                        backgroundColor: "var(--color-popover)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="criticalCount" name="Critical Anomalies" fill="#ef4444" stackId="anom" />
                    <Bar dataKey="majorCount" name="Major Anomalies" fill="#f59e0b" stackId="anom" />
                    <Bar dataKey="minorCount" name="Minor Anomalies" fill="#3b82f6" stackId="anom" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmptyState
                  title="No Anomalies Detected"
                  message={chartsData.anomalyTrend.emptyReason}
                  icon="info"
                />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};
