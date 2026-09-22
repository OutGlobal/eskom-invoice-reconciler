import React, { useState, useMemo } from "react";
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
import { TOU_COLOR } from "@/lib/tariff";
import { ChartEmptyState } from "@/components/charts/ChartEmptyState";

interface DailyReconciliationRecord {
  date: string;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  totalKwh: number;
  peakKw: number;
  peakKva: number;
  nmdKva: number;
  pf: number;
  actualKvarh: number;
  allowedKvarh: number;
  billedZar: number;
  calculatedZar: number;
  varianceZar: number;
}

interface ChartProps {
  dailyData?: DailyReconciliationRecord[];
  nmdBaselineKva?: number;
}

export const EnterpriseReconciliationCharts: React.FC<ChartProps> = ({
  dailyData = [],
  nmdBaselineKva = 250,
}) => {
  const [activeTab, setActiveTab] = useState<
    | "monthly"
    | "tou"
    | "daily"
    | "demand"
    | "powerfactor"
    | "reactive"
    | "variancetrend"
    | "financialimpact"
  >("monthly");

  // Dynamically derive monthly data from daily reconciliation records
  const monthlyData = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    const map = new Map<
      string,
      { name: string; Billed: number; Calculated: number; Variance: number }
    >();

    for (const d of dailyData) {
      const monthKey = d.date.length >= 7 ? d.date.substring(0, 7) : "Active Period";
      const existing = map.get(monthKey) || {
        name: monthKey,
        Billed: 0,
        Calculated: 0,
        Variance: 0,
      };
      existing.Billed += d.billedZar;
      existing.Calculated += d.calculatedZar;
      existing.Variance += d.varianceZar;
      map.set(monthKey, existing);
    }

    return Array.from(map.values()).map((m) => ({
      ...m,
      Billed: Math.round(m.Billed),
      Calculated: Math.round(m.Calculated),
      Variance: Math.round(m.Variance),
    }));
  }, [dailyData]);

  // Dynamically derive financial impact distribution from real daily variance
  const financialImpactData = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return [];
    let peakVar = 0;
    let stdVar = 0;
    let offVar = 0;
    let demandVar = 0;
    let reactiveVar = 0;

    for (const d of dailyData) {
      if (d.varianceZar > 0) {
        const totKwh = d.totalKwh || 1;
        peakVar += (d.peakKwh / totKwh) * d.varianceZar;
        stdVar += (d.standardKwh / totKwh) * d.varianceZar;
        offVar += (d.offPeakKwh / totKwh) * d.varianceZar;
      }
      if (d.peakKva > d.nmdKva) {
        demandVar += (d.peakKva - d.nmdKva) * 54.32;
      }
      if (d.actualKvarh > d.allowedKvarh) {
        reactiveVar += (d.actualKvarh - d.allowedKvarh) * 0.28;
      }
    }

    const items = [
      { name: "Peak Energy Discrepancy", value: Math.round(peakVar), color: TOU_COLOR.peak },
      { name: "Standard Energy Discrepancy", value: Math.round(stdVar), color: TOU_COLOR.standard },
      { name: "Off-Peak Energy Discrepancy", value: Math.round(offVar), color: TOU_COLOR.offPeak },
      { name: "Demand Ratchet Exposure", value: Math.round(demandVar), color: "#3b82f6" },
      { name: "Reactive Penalty Impact", value: Math.round(reactiveVar), color: "#8b5cf6" },
    ].filter((i) => i.value > 0);

    return items;
  }, [dailyData]);

  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl mb-6">
        <ChartEmptyState
          title="No Reconciliation Telemetry Data"
          message="No daily telemetry interval records available for enterprise reconciliation analytics. Ingest AMR intervals to view reconciliation curves."
          actionText="Upload AMR Data"
          actionLink="/invoices"
          icon="chart"
          minHeight="240px"
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl mb-6">
      {/* Chart Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Enterprise Analytics &amp; Consumption Visualizations
        </h3>
        <div className="flex flex-wrap gap-1">
          {[
            { id: "monthly", label: "1. Monthly Billed vs Calc" },
            { id: "tou", label: "2. Peak/Std/Off-Peak" },
            { id: "daily", label: "3. Daily Consumption" },
            { id: "demand", label: "4. Demand Profile" },
            { id: "powerfactor", label: "5. Power Factor" },
            { id: "reactive", label: "6. Reactive Energy" },
            { id: "variancetrend", label: "7. Variance Trend" },
            { id: "financialimpact", label: "8. Financial Impact" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === "monthly" ? (
            monthlyData.length > 0 ? (
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    color: "#f8fafc",
                  }}
                  formatter={(v: any) => [`R ${Number(v).toLocaleString()}`, ""]}
                />
                <Legend />
                <Bar
                  dataKey="Billed"
                  fill="#3b82f6"
                  name="Billed Amount (ZAR)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Calculated"
                  fill="#10b981"
                  name="Calculated Tariff (ZAR)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <ChartEmptyState
                title="No Monthly Aggregates"
                message="No monthly billing determinants extracted from daily intervals."
                minHeight="220px"
              />
            )
          ) : activeTab === "tou" ? (
            <BarChart data={dailyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v} kWh`} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              <Legend />
              <Bar dataKey="peakKwh" fill={TOU_COLOR.peak} name="Peak kWh" stackId="a" />
              <Bar
                dataKey="standardKwh"
                fill={TOU_COLOR.standard}
                name="Standard kWh"
                stackId="a"
              />
              <Bar dataKey="offPeakKwh" fill={TOU_COLOR.offPeak} name="Off-Peak kWh" stackId="a" />
            </BarChart>
          ) : activeTab === "daily" ? (
            <AreaChart data={dailyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              <Legend />
              <Area
                type="monotone"
                dataKey="totalKwh"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.2}
                name="Total Daily kWh"
              />
            </AreaChart>
          ) : activeTab === "demand" ? (
            <LineChart data={dailyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              <Legend />
              {nmdBaselineKva > 0 && (
                <ReferenceLine
                  y={nmdBaselineKva}
                  label={`NMD Limit (${nmdBaselineKva} kVA)`}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                />
              )}
              <Line
                type="monotone"
                dataKey="peakKw"
                stroke="#3b82f6"
                name="Peak kW"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="peakKva"
                stroke="#8b5cf6"
                name="Apparent kVA"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : activeTab === "powerfactor" ? (
            <LineChart data={dailyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis domain={[0.85, 1.0]} stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              <Legend />
              <ReferenceLine
                y={0.96}
                label="PF Threshold (0.96)"
                stroke="#f59e0b"
                strokeDasharray="4 4"
              />
              <Line
                type="monotone"
                dataKey="pf"
                stroke="#10b981"
                name="Vector Power Factor"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          ) : activeTab === "reactive" ? (
            <BarChart data={dailyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              <Legend />
              <Bar dataKey="actualKvarh" fill="#8b5cf6" name="Actual kVARh" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="allowedKvarh"
                fill="#64748b"
                name="Allowed kVARh"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : activeTab === "variancetrend" ? (
            <LineChart data={dailyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `R${v}`} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              <Legend />
              <ReferenceLine y={0} stroke="#64748b" />
              <Line
                type="monotone"
                dataKey="varianceZar"
                stroke="#f59e0b"
                name="Daily Variance (ZAR)"
                strokeWidth={2.5}
              />
            </LineChart>
          ) : financialImpactData.length > 0 ? (
            <PieChart>
              <Pie
                data={financialImpactData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {financialImpactData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
            </PieChart>
          ) : (
            <ChartEmptyState
              title="No Financial Variance"
              message="No daily financial variance detected in the telemetry dataset."
              minHeight="220px"
            />
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
