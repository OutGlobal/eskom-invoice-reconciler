import React, { useState } from "react";
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

interface ChartProps {
  dailyData?: Array<{
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
  }>;
}

export const EnterpriseReconciliationCharts: React.FC<ChartProps> = ({ dailyData = [] }) => {
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

  // Fallback synthetic data if dailyData is empty
  const chartData =
    dailyData.length > 0
      ? dailyData
      : Array.from({ length: 31 }, (_, i) => {
          const day = i + 1;
          const date = `2026-03-${day.toString().padStart(2, "0")}`;
          const peak = 1200 + Math.sin(i) * 300;
          const std = 2200 + Math.cos(i) * 400;
          const off = 1800 + Math.sin(i * 0.5) * 200;
          const total = peak + std + off;
          const kw = 180 + Math.random() * 40;
          const kva = kw / 0.95;
          const pf = 0.94 + Math.random() * 0.05;
          const actualKvarh = total * 0.35;
          const allowedKvarh = total * 0.329;
          const billedZar = total * 1.85 + 450;
          const calculatedZar = total * 1.82 + 450;
          const varianceZar = billedZar - calculatedZar;

          return {
            date: date.substring(8),
            peakKwh: Math.round(peak),
            standardKwh: Math.round(std),
            offPeakKwh: Math.round(off),
            totalKwh: Math.round(total),
            peakKw: Math.round(kw),
            peakKva: Math.round(kva),
            nmdKva: 250,
            pf: Number(pf.toFixed(3)),
            actualKvarh: Math.round(actualKvarh),
            allowedKvarh: Math.round(allowedKvarh),
            billedZar: Number(billedZar.toFixed(2)),
            calculatedZar: Number(calculatedZar.toFixed(2)),
            varianceZar: Number(varianceZar.toFixed(2)),
          };
        });

  // Monthly summary bar chart data
  const monthlyData = [
    { name: "Jan 2026", Billed: 425000, Calculated: 421000, Variance: 4000 },
    { name: "Feb 2026", Billed: 438000, Calculated: 438200, Variance: -200 },
    { name: "Mar 2026", Billed: 495000, Calculated: 472500, Variance: 22500 },
  ];

  // Financial Impact Distribution Data
  const financialImpactData = [
    { name: "Peak Energy TOU", value: 12450, color: "#ef4444" },
    { name: "Standard Energy TOU", value: 4200, color: "#f59e0b" },
    { name: "Demand Ratchet kVA", value: 5800, color: "#3b82f6" },
    { name: "Reactive Penalty", value: 2450, color: "#8b5cf6" },
    { name: "VAT Calculation Delta", value: 3735, color: "#10b981" },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl mb-6">
      {/* Chart Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Enterprise Analytics & Consumption Visualizations
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
          ) : activeTab === "tou" ? (
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              <Legend />
              <ReferenceLine
                y={250}
                label="NMD Limit (250 kVA)"
                stroke="#ef4444"
                strokeDasharray="3 3"
              />
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
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
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
          ) : (
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
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
