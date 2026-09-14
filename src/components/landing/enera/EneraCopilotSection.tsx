import React, { useState } from "react";
import {
  Zap,
  Activity,
  Receipt,
  Coins,
  Search,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Gauge,
  FileSpreadsheet,
} from "lucide-react";

interface FlowStage {
  step: string;
  name: string;
  definition: string;
  metricLabel: string;
  metricValue: string;
  icon: React.ComponentType<{ className?: string }>;
}

const FLOW_STAGES: FlowStage[] = [
  {
    step: "01",
    name: "ENERGY",
    definition: "Physical grid supply and active/reactive raw feeder generation.",
    metricLabel: "Telemetry Resolution",
    metricValue: "1,488 30-min registers",
    icon: Zap,
  },
  {
    step: "02",
    name: "CONSUMPTION",
    definition: "Temporal distribution across statutory Peak, Standard, and Off-Peak windows.",
    metricLabel: "Time-of-Use Profile",
    metricValue: "High-season weekday",
    icon: Activity,
  },
  {
    step: "03",
    name: "BILLING",
    definition: "Multi-layered utility line items, access charges, and regulatory levies.",
    metricLabel: "Invoice Aggregation",
    metricValue: "Gazetted tariff rates",
    icon: Receipt,
  },
  {
    step: "04",
    name: "COST",
    definition: "Financial realization of capacity, maximum demand, and active energy determinants.",
    metricLabel: "Expenditure Realized",
    metricValue: "Direct balance sheet debit",
    icon: Coins,
  },
  {
    step: "05",
    name: "INSIGHT",
    definition: "Deterministic detection of variances, unearned charges, and rate drift.",
    metricLabel: "Variance Isolated",
    metricValue: "Mathematical proof",
    icon: Search,
  },
  {
    step: "06",
    name: "DECISION",
    definition: "Evidence-backed dispute packages, treasury adjustments, and load shifting.",
    metricLabel: "Operational Impact",
    metricValue: "Audit-ready governance",
    icon: CheckCircle2,
  },
];

interface AffectedArea {
  dimension: string;
  impact: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AFFECTED_AREAS: AffectedArea[] = [
  {
    dimension: "Cost",
    impact: "Direct balance sheet exposure across active energy rates, peak demand charges, and capacity levies.",
    icon: Coins,
  },
  {
    dimension: "Budget",
    impact: "Variance control between projected utility allocations and actual operational consumption.",
    icon: Calendar,
  },
  {
    dimension: "Billing",
    impact: "Cross-verification of opaque utility line items against verified interval meter registers.",
    icon: Receipt,
  },
  {
    dimension: "Forecasting",
    impact: "Predictive modeling for seasonal tariff changes, winter multipliers, and plant schedule shifts.",
    icon: TrendingUp,
  },
  {
    dimension: "Risk",
    impact: "Early warning for maximum demand ratchet resets, power factor penalties, and uncredited public holidays.",
    icon: ShieldAlert,
  },
  {
    dimension: "Performance",
    impact: "Benchmarking load factor efficiency and off-peak energy utilization across facilities.",
    icon: Gauge,
  },
  {
    dimension: "Decision-Making",
    impact: "Supplying corporate treasury and facility directors with certified evidence for utility disputes.",
    icon: FileSpreadsheet,
  },
];

export function EneraCopilotSection() {
  const [activeStage, setActiveStage] = useState<number>(3); // Default to "COST"

  return (
    <section
      id="insights"
      className="py-20 sm:py-28 bg-[#05080f] text-white border-t border-white/10 overflow-hidden scroll-mt-12"
      aria-label="Financial Intelligence"
    >
      {/* Backwards-compatible anchors */}
      <div id="intelligence" className="sr-only" aria-hidden="true" />
      <div id="financial-intelligence" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          FINANCIAL INTELLIGENCE
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          SEE THE FINANCIAL SIGNAL.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-12">
          Energy data is not only an operational concern. It directly governs cost, budget, billing, forecasting, risk, performance, and strategic decision-making across the enterprise balance sheet.
        </p>

        {/* 4. Sophisticated But Simple Transformation Visual: ENERGY -> CONSUMPTION -> BILLING -> COST -> INSIGHT -> DECISION */}
        <div className="mb-14 p-6 sm:p-8 rounded-2xl bg-[#080d1a] border border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-white/5 mb-6">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold block mb-1">
                VALUE TRANSFORMATION PIPELINE
              </span>
              <h3 className="text-lg font-bold text-white font-sans">
                From Raw Energy to Board-Level Decision
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Stage {FLOW_STAGES[activeStage].step} of 06: <strong className="text-cyan-300">{FLOW_STAGES[activeStage].name}</strong>
            </span>
          </div>

          {/* 6-Stage Progression Track */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 relative">
            {FLOW_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isSelected = activeStage === idx;
              const isLast = idx === FLOW_STAGES.length - 1;

              return (
                <button
                  key={stage.name}
                  type="button"
                  onClick={() => setActiveStage(idx)}
                  className={`p-4 rounded-xl text-left transition-all border relative flex flex-col justify-between focus-ring-enera ${
                    isSelected
                      ? "bg-cyan-500/10 border-cyan-500/40 shadow-sm"
                      : "bg-[#0a1122] border-white/5 hover:border-white/15"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          isSelected ? "text-cyan-300" : "text-slate-500"
                        }`}
                      >
                        {stage.step}
                      </span>
                      <Icon
                        className={`h-4 w-4 ${
                          isSelected ? "text-cyan-400" : "text-slate-400"
                        }`}
                      />
                    </div>

                    <div className="text-xs sm:text-sm font-bold font-mono tracking-wider text-white uppercase mb-1.5">
                      {stage.name}
                    </div>

                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                      {stage.definition}
                    </p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Flow</span>
                    {!isLast && (
                      <span className="text-cyan-400/60 hidden lg:inline font-mono">
                        ↓ Next
                      </span>
                    )}
                    {isLast && (
                      <span className="text-emerald-400 font-mono">
                        Action
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Stage Detail Callout */}
          <div className="mt-6 p-4 rounded-xl bg-[#0a1122] border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-cyan-400/15 text-cyan-300 font-bold">
                {FLOW_STAGES[activeStage].name}
              </span>
              <span className="text-slate-300 font-sans">
                {FLOW_STAGES[activeStage].definition}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 shrink-0">
              <span className="text-slate-500">{FLOW_STAGES[activeStage].metricLabel}:</span>
              <span className="text-white font-bold">{FLOW_STAGES[activeStage].metricValue}</span>
            </div>
          </div>
        </div>

        {/* 5. What Energy Data Governs Across the Enterprise: 7 Clean Balance-Sheet Dimensions */}
        <div>
          <div className="mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold block mb-1">
              ORGANIZATIONAL GOVERNANCE
            </span>
            <h3 className="text-xl font-bold text-white font-sans">
              Seven Enterprise Dimensions Influenced by Energy Data
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {AFFECTED_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <div
                  key={area.dimension}
                  className="p-5 rounded-xl bg-[#080d1a] border border-white/10 hover:border-white/20 transition-colors flex flex-col justify-start"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h4 className="text-sm font-bold font-mono tracking-wide text-white uppercase">
                      {area.dimension}
                    </h4>
                  </div>

                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    {area.impact}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Supporting information & CTA */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Deterministic financial governance grounded in statutory NERSA tariff frameworks.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera shrink-0"
          >
            <span>Request a financial portfolio audit</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
