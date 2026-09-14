import React, { useState } from "react";
import {
  LayoutDashboard,
  Scale,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Download,
  Calendar,
  Building,
  Zap,
  Clock,
  ShieldCheck,
} from "lucide-react";

type PreviewTab = "dashboard" | "reconciliation" | "trends" | "anomalies" | "reporting";

interface TabConfig {
  id: PreviewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const TABS: TabConfig[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "reconciliation", label: "Billing Reconciliation", icon: Scale, badge: "R 53.3k Variance" },
  { id: "trends", label: "Energy Trends", icon: TrendingUp },
  { id: "anomalies", label: "Anomaly Insight", icon: AlertTriangle, badge: "2 Flagged" },
  { id: "reporting", label: "Reporting", icon: FileCheck },
];

export function EneraProductInterfacePreviewSection() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("dashboard");

  return (
    <section
      id="interface-previews"
      className="py-20 sm:py-24 bg-[#0c121e] text-white border-t border-slate-800/80 font-sans scroll-mt-12"
      aria-label="Product Interface Previews"
    >
      {/* Backwards-compatible anchors */}
      <div id="reconciliation" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          PLATFORM INTERFACE
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          SEE THE SIGNAL BEHIND THE NUMBER.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-10">
          Explore how ENERA turns interval meter telemetry and complex utility statements into clear, verifiable answers.
        </p>

        {/* 4. Tab Navigation (5 Views) */}
        <div
          role="tablist"
          aria-label="Platform Views"
          className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/10 no-scrollbar"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap focus-ring-enera ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm enera-glow-cyan"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-cyan-400/20 text-cyan-200"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 5. Synthetic Desktop Viewport Shell */}
        <div className="rounded-2xl border border-white/10 bg-[#070b16] shadow-2xl overflow-hidden">
          {/* Top Window Chrome */}
          <div className="px-4 py-3 bg-[#0a0f1d] border-b border-white/5 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="hidden sm:inline-block ml-3 text-slate-400">
                enera.platform / intelligence / executive-suite
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-400">
                <Building className="h-3 w-3 text-cyan-400" />
                <span className="hidden md:inline">Entity:</span> Apex Precision Manufacturing
              </span>
              <span className="text-slate-400">|</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="h-3 w-3 text-cyan-400" />
                <span>Aug 2026 (Winter)</span>
              </span>
            </div>
          </div>

          {/* Viewport Content Area */}
          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="p-5 sm:p-7 min-h-[440px] flex flex-col justify-between focus:outline-none"
          >
            {/* VIEW 1: DASHBOARD */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                      Total Utility Billed
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-white">
                      R 1,842,500.00
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Stated statement amount
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                      Reconciled Determinant
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-cyan-300">
                      R 1,789,120.00
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Verified interval total
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30">
                    <span className="text-[11px] font-mono text-cyan-400 uppercase block mb-1">
                      Net Discrepancy
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-amber-400">
                      R 53,380.00
                    </div>
                    <span className="text-[11px] text-amber-400/80 font-mono mt-1 block">
                      +2.90% Overcharge Isolated
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                      Power Factor Index
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-400">
                      0.96 lagging
                    </div>
                    <span className="text-[11px] text-emerald-400/80 mt-1 block">
                      Compliant (&gt; 0.85 standard)
                    </span>
                  </div>
                </div>

                {/* TOU Split Overview Bar */}
                <div className="p-5 rounded-xl bg-[#0b1224] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Time-of-Use Volume Distribution</span>
                    <span className="font-mono text-slate-400">Total: 3,412,080 kWh</span>
                  </div>

                  {/* Multi-segment visual bar */}
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                    <div style={{ width: "24%" }} className="bg-amber-500" title="Peak: 24%" />
                    <div style={{ width: "42%" }} className="bg-cyan-500" title="Standard: 42%" />
                    <div style={{ width: "34%" }} className="bg-slate-500" title="Off-Peak: 34%" />
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      Peak: 818,900 kWh (24%)
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                      Standard: 1,433,070 kWh (42%)
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      Off-Peak: 1,160,110 kWh (34%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: BILLING RECONCILIATION */}
            {activeTab === "reconciliation" && (
              <div className="space-y-4">
                <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                  <span>LINE-ITEM CROSS-VERIFICATION (STATED VS MEASURED)</span>
                  <span className="text-cyan-400">SANS 474 Interval Certified</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 font-mono">
                        <th className="py-2.5 pr-4">Line Item Determinant</th>
                        <th className="py-2.5 px-3">Billed (Utility)</th>
                        <th className="py-2.5 px-3">Reconciled (Interval)</th>
                        <th className="py-2.5 px-3">Variance</th>
                        <th className="py-2.5 pl-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Active Energy — Peak (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">842,100 kWh / R 624,838</td>
                        <td className="py-3 px-3 text-cyan-300">818,900 kWh / R 607,624</td>
                        <td className="py-3 px-3 text-amber-400">+23,200 kWh (+R 17,214)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            Discrepancy
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Active Energy — Standard (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">1,433,070 kWh / R 544,566</td>
                        <td className="py-3 px-3 text-cyan-300">1,433,070 kWh / R 544,566</td>
                        <td className="py-3 px-3 text-slate-400">0 kWh (R 0.00)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">
                            Clean Match
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Active Energy — Off-Peak (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">1,136,910 kWh / R 284,228</td>
                        <td className="py-3 px-3 text-cyan-300">1,160,110 kWh / R 290,028</td>
                        <td className="py-3 px-3 text-cyan-400">-23,200 kWh (-R 5,800)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            Holiday Shift
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Maximum Demand Charge (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">5,100 kVA / R 288,868</td>
                        <td className="py-3 px-3 text-cyan-300">4,850 kVA / R 274,702</td>
                        <td className="py-3 px-3 text-amber-400">+250 kVA (+R 14,166)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            Overstated Peak
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Reactive Energy Levy (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">R 27,800 (Stated)</td>
                        <td className="py-3 px-3 text-cyan-300">R 0.00 (Exempt)</td>
                        <td className="py-3 px-3 text-amber-400">+R 27,800.00</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300">
                            Invalid Surcharge
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 3: ENERGY TRENDS */}
            {activeTab === "trends" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-white">24-Hour Interval Demand Profile</span>
                    <span className="text-slate-400 ml-2">High Season Weekday (SAST)</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-amber-500" /> Peak Hours (06:00-09:00, 17:00-19:00)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-cyan-400" /> Measured kVA Demand
                    </span>
                  </div>
                </div>

                {/* Simulated SVG Interval Profile with Live Telemetry Scanner */}
                <div className="w-full h-48 bg-[#0b1224] rounded-xl border border-white/5 p-4 flex flex-col justify-between relative overflow-hidden">
                  {/* Subtle telemetry scanner line across 24h profile */}
                  <div
                    className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent pointer-events-none"
                    style={{ animation: "enera-scan 10s linear infinite" }}
                    aria-hidden="true"
                  />

                  <div className="flex justify-between text-[10px] font-mono text-slate-400 relative z-10">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      5,000 kVA (Ratchet Limit)
                    </span>
                    <span className="text-amber-400 font-bold">Max Peak: 4,850 kVA @ 08:30</span>
                  </div>

                  <div className="w-full h-28 relative flex items-end z-10">
                    {/* Simulated bars for 24 half-hour blocks */}
                    <div className="w-full h-full flex items-end gap-1 sm:gap-1.5">
                      {[
                        { h: 30, t: "off" }, { h: 28, t: "off" }, { h: 32, t: "off" }, { h: 35, t: "off" },
                        { h: 42, t: "std" }, { h: 58, t: "std" }, { h: 88, t: "peak" }, { h: 96, t: "peak" },
                        { h: 92, t: "peak" }, { h: 72, t: "std" }, { h: 68, t: "std" }, { h: 65, t: "std" },
                        { h: 64, t: "std" }, { h: 62, t: "std" }, { h: 60, t: "std" }, { h: 66, t: "std" },
                        { h: 82, t: "peak" }, { h: 90, t: "peak" }, { h: 78, t: "peak" }, { h: 52, t: "std" },
                        { h: 44, t: "std" }, { h: 38, t: "off" }, { h: 34, t: "off" }, { h: 30, t: "off" },
                      ].map((bar, i) => (
                        <div
                          key={i}
                          style={{ height: `${bar.h}%` }}
                          className={`flex-1 rounded-t transition-all duration-300 ${
                            bar.t === "peak"
                              ? "bg-gradient-to-t from-amber-600 to-amber-400 hover:brightness-110"
                              : bar.t === "std"
                              ? "bg-gradient-to-t from-cyan-600 to-cyan-400 hover:brightness-110"
                              : "bg-slate-700 hover:bg-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5 relative z-10">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:59</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#0b1224] border border-white/5">
                    <span className="text-slate-400 block text-[10px]">PEAK RATIO</span>
                    <span className="text-white font-bold">24.0%</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0b1224] border border-white/5">
                    <span className="text-slate-400 block text-[10px]">LOAD FACTOR</span>
                    <span className="text-white font-bold">78.4%</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0b1224] border border-white/5">
                    <span className="text-slate-400 block text-[10px]">OFF-PEAK UTILIZATION</span>
                    <span className="text-cyan-400 font-bold">Optimal</span>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: ANOMALY INSIGHT */}
            {activeTab === "anomalies" && (
              <div className="space-y-4">
                <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                  <span>ISOLATED ANOMALIES (2 REQUIRING TREASURY ACTION)</span>
                  <span className="text-amber-400">Total Recovery Value: R 53,380.00</span>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-amber-500/30 enera-glow-amber flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold">
                          CRITICAL
                        </span>
                        <h3 className="text-sm font-bold text-white">
                          Statutory Public Holiday Billed as Weekday Peak
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        Youth Day (16 June) was billed at High-Season Peak weekday rates instead of statutory Sunday Off-Peak schedule under NERSA Schedule 2 rules.
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-amber-400">
                        +R 24,180.00
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Unearned Tariff Charge</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-amber-500/30 enera-glow-amber flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold">
                          WARNING
                        </span>
                        <h3 className="text-sm font-bold text-white">
                          Maximum Demand Ratchet Overstatement
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        Utility stated peak demand at 5,100 kVA. Physical meter interval telemetry confirms maximum peak reached was 4,850 kVA at 08:30.
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-amber-400">
                        +R 14,166.00
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">250 kVA Discrepancy</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                          VERIFIED
                        </span>
                        <h3 className="text-sm font-bold text-white">
                          Power Factor Boundary Compliant
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        Average power factor maintained at 0.96 lagging across billing cycle. Invalid reactive levy of R 27,800 reversed.
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-emerald-400">
                        +R 27,800.00
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Exempt from Penalty</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 5: REPORTING */}
            {activeTab === "reporting" && (
              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                        EXECUTIVE RECONCILIATION DOSSIER
                      </span>
                      <h3 className="text-base font-bold text-white font-sans">
                        Apex Precision Manufacturing — August 2026 Audit Pack
                      </h3>
                    </div>
                      <a
                        href="#contact"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono hover:bg-cyan-500/20 transition-colors"
                      >
                        <span>REQUEST A DEMO</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                  </div>

                  <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">STATUTORY BASIS</span>
                      <span className="text-slate-200">NERSA Sched 2 / Megaflex</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">TELEMETRY REGISTERS</span>
                      <span className="text-slate-200">1,488 Intervals (100%)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ISOLATED CREDIT CLAIM</span>
                      <span className="text-amber-400 font-bold">R 53,380.00</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">AUDIT STATUS</span>
                      <span className="text-emerald-400 font-bold">Dispute Ready</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#070b16] border border-white/5 text-xs text-slate-400 font-sans space-y-1">
                    <span className="font-semibold text-slate-200 block">Dossier Contents:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                      <li>Eskom Form 102 structured claim summary with line-item discrepancy breakdowns.</li>
                      <li>Certified 30-minute interval telemetry export matching SANS 474 revenue standards.</li>
                      <li>Statutory NERSA high-season calendar mapping and gazetted tariff proofs.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. Supporting Notice & Optional CTA */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Simulated enterprise environment. All displayed entity names and financial values are synthetic demonstration data.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera shrink-0"
          >
            <span>REQUEST A DEMO</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
