import React, { useState } from "react";
import { Scale, ArrowRight, TrendingDown, DollarSign, ShieldAlert, Check } from "lucide-react";

export function EneraDifferenceSection() {
  const [activeTab, setActiveTab] = useState<"active" | "demand" | "reactive">("active");

  const data = {
    active: {
      title: "Active Energy Consumption (kWh)",
      billed: "4,218,441",
      actual: "4,087,214",
      variance: "131,227",
      financialImpact: "R 51,227.00",
      reason: "Peak period multiplier error and holiday classification omission.",
    },
    demand: {
      title: "Maximum Demand (kVA)",
      billed: "8,421",
      actual: "7,940",
      variance: "481",
      financialImpact: "R 46,176.00",
      reason: "Simultaneous interval occurred during municipal load curtailment window.",
    },
    reactive: {
      title: "Excess Reactive Energy (kVArh)",
      billed: "342,100",
      actual: "112,040",
      variance: "230,060",
      financialImpact: "R 28,757.50",
      reason: "Billed power factor calculated at 0.91 instead of metered 0.96 lagging.",
    },
  };

  const cur = data[activeTab];

  return (
    <section id="reconciliation" className="relative py-28 bg-[#0a0e17] text-white overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4">
            <Scale className="h-3 w-3" />
            <span>GROUND TRUTH RECONCILIATION</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            FIND THE DIFFERENCE.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light">
            When raw revenue meter telemetry meets the utility bill, discrepancies have nowhere to
            hide.
          </p>

          {/* Metric Category Toggle */}
          <div className="mt-8 inline-flex p-1.5 rounded-xl bg-white/[0.03] border border-white/10">
            {(["active", "demand", "reactive"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab === "active" ? "Active Energy" : tab === "demand" ? "Max Demand" : "Reactive Power"}
              </button>
            ))}
          </div>
        </div>

        {/* Big Dual-Stream Reconciliation Visual Board */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Stream A: Utility Billed */}
            <div className="rounded-2xl bg-[#0d1117]/90 border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-xl">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-mono text-slate-400 tracking-wider uppercase">
                    STREAM A — UTILITY BILLED
                  </span>
                  <span className="text-xs font-mono text-rose-400 font-medium">ESKOM INVOICE</span>
                </div>

                <div className="mt-6">
                  <span className="text-xs font-mono text-slate-500">STATED TOTAL</span>
                  <div className="text-4xl sm:text-5xl font-extrabold font-mono text-white mt-1">
                    {cur.billed}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-1 block">
                    {cur.title.split("(")[1].replace(")", "")}
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10 text-xs text-slate-400">
                Extracted directly from line item schedules on PDF billing document.
              </div>
            </div>

            {/* Stream B: AMR Actual Ground Truth */}
            <div className="rounded-2xl bg-gradient-to-br from-cyan-950/40 via-[#0d1117] to-emerald-950/20 border border-cyan-500/40 p-6 sm:p-8 flex flex-col justify-between shadow-[0_0_40px_-10px_rgba(6,182,212,0.2)]">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
                  <span className="text-xs font-mono text-cyan-300 tracking-wider uppercase">
                    STREAM B — GROUND TRUTH
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">REVENUE AMR METER</span>
                </div>

                <div className="mt-6">
                  <span className="text-xs font-mono text-cyan-400">AUDITED SUMMATION</span>
                  <div className="text-4xl sm:text-5xl font-extrabold font-mono text-cyan-300 mt-1 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                    {cur.actual}
                  </div>
                  <span className="text-xs font-mono text-slate-300 mt-1 block">
                    {cur.title.split("(")[1].replace(")", "")}
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-cyan-500/20 text-xs text-cyan-300/80">
                Synthesized across 1,488 interval records certified under SANS 474.
              </div>
            </div>
          </div>

          {/* Converged Variance & Financial Recovery Output Bar */}
          <div className="mt-6 rounded-2xl bg-[#161b22] border border-amber-500/40 p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs font-mono uppercase text-amber-400 font-bold tracking-wider">
                  DETERMINISTIC VARIANCE ISOLATED
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-amber-300">
                {cur.variance}{" "}
                <span className="text-lg font-normal text-amber-400/80">
                  {cur.title.split("(")[1].replace(")", "")}
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-xl">{cur.reason}</p>
            </div>

            <div className="px-6 py-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center md:text-right w-full md:w-auto">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                POTENTIAL FINANCIAL IMPACT
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 mt-1">
                {cur.financialImpact}
              </div>
              <span className="text-[10px] font-mono text-emerald-300/80">
                Recovery Dossier Generated
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
