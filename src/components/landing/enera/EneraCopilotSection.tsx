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
    definition: "Physical grid supply and meter interval records.",
    metricLabel: "Telemetry Resolution",
    metricValue: "1,488 30-min registers",
    icon: Zap,
  },
  {
    step: "02",
    name: "CONSUMPTION",
    definition: "Usage across peak, standard, and off-peak periods.",
    metricLabel: "Time-of-Use Profile",
    metricValue: "High-season weekday",
    icon: Activity,
  },
  {
    step: "03",
    name: "BILLING",
    definition: "Utility line items, demand charges, and statutory levies.",
    metricLabel: "Invoice Aggregation",
    metricValue: "Gazetted tariff rates",
    icon: Receipt,
  },
  {
    step: "04",
    name: "COST",
    definition: "Financial impact realized on your organization's balance sheet.",
    metricLabel: "Expenditure Realized",
    metricValue: "Direct balance sheet debit",
    icon: Coins,
  },
  {
    step: "05",
    name: "INSIGHT",
    definition: "Identification of billing variances, drift, and unearned charges.",
    metricLabel: "Variance Isolated",
    metricValue: "Mathematical proof",
    icon: Search,
  },
  {
    step: "06",
    name: "DECISION",
    definition: "Evidence-backed dispute dossiers and operational adjustments.",
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
    impact: "Direct balance sheet exposure across active energy rates and demand charges.",
    icon: Coins,
  },
  {
    dimension: "Budget",
    impact: "Variance control between projected utility allocations and actual spend.",
    icon: Calendar,
  },
  {
    dimension: "Billing",
    impact: "Verification of utility line items against physical meter registers.",
    icon: Receipt,
  },
  {
    dimension: "Forecasting",
    impact: "Informed projections for seasonal tariff changes and operational shifts.",
    icon: TrendingUp,
  },
  {
    dimension: "Risk",
    impact: "Early warnings for demand ratchet resets and unapplied holiday credits.",
    icon: ShieldAlert,
  },
  {
    dimension: "Performance",
    impact: "Benchmarking load factor and energy efficiency across facilities.",
    icon: Gauge,
  },
  {
    dimension: "Decision-Making",
    impact: "Certified evidence to support disputes and operational choices.",
    icon: FileSpreadsheet,
  },
];

interface StreamScenario {
  id: string;
  name: string;
  category: string;
  packets: string[];
  rule: string;
  metricValue: string;
  metricLabel: string;
  metricSubtext: string;
  confidence: string;
}

const STREAM_SCENARIOS: StreamScenario[] = [
  {
    id: "holiday",
    name: "Holiday Reclassification",
    category: "CALENDAR MATRIX",
    packets: [
      "16-Jun 06:00:00 · Interval #1440 · 842.1 kWh · Billed: High-Season Peak (R 0.742/kWh)",
      "16-Jun 07:00:00 · Interval #1442 · 890.4 kWh · NERSA Rule: Statutory Sunday Schedule",
      "16-Jun 08:30:00 · Interval #1445 · 940.2 kWh · Corrected: Off-Peak (R 0.250/kWh)",
    ],
    rule: "NERSA Schedule 2 · Youth Day Statutory Holiday Off-Peak Substitution",
    metricValue: "+R 24,180.00",
    metricLabel: "Recoverable Energy Charge Credit",
    metricSubtext: "Reclassified 23,200 kWh from High-Season Peak to statutory Off-Peak rates",
    confidence: "100% Deterministic Match",
  },
  {
    id: "demand",
    name: "Peak Demand Ratchet",
    category: "CAPACITY INTEGRATION",
    packets: [
      "Statement Peak Stated: 5,100 kVA (Utility Stated Invoice Determinant)",
      "AMR Max Measured: 4,850 kVA @ 08:30 (SANS 474 Certified Check Meter)",
      "Discrepancy: +250 kVA Capacity Charge Billed Above Physical Maximum",
    ],
    rule: "NERSA Capacity Rule · Actual Integrated 30-Min High-Season Demand",
    metricValue: "+R 14,166.00",
    metricLabel: "Unearned Demand Capacity Credit",
    metricSubtext: "250 kVA Overstatement @ R 56.66/kVA High Season Demand Rate",
    confidence: "Verified Across 1,488 Intervals",
  },
  {
    id: "power-factor",
    name: "Power Factor Boundary",
    category: "REACTIVE ENERGY",
    packets: [
      "Utility Stated Surcharge: R 27,800.00 (Reactive Energy Surcharge Stated)",
      "Active: 3,412,080 kWh · Reactive: 994,200 kvarh (Monthly Totals)",
      "Vector Derivation: cos(arctan(994200 / 3412080)) = 0.96 lagging",
    ],
    rule: "NERSA Power Factor Threshold · Compliant (> 0.85 Lagging Exemption)",
    metricValue: "+R 27,800.00",
    metricLabel: "Invalid Surcharge Reversal",
    metricSubtext: "Full exemption from reactive penalty under gazetted rules",
    confidence: "Vector Compliance Certified",
  },
];

export function EneraCopilotSection() {
  const [activeStage, setActiveStage] = useState<number>(3); // Default to "COST"
  const [activeScenarioIdx, setActiveScenarioIdx] = useState<number>(0);
  const currentScenario = STREAM_SCENARIOS[activeScenarioIdx];

  return (
    <section
      id="insights"
      className="py-24 sm:py-32 bg-slate-50/60 text-slate-900 border-t border-slate-200/80 overflow-hidden scroll-mt-12"
      aria-label="Financial Intelligence"
    >
      {/* Backwards-compatible anchors */}
      <div id="intelligence" className="sr-only" aria-hidden="true" />
      <div id="financial-intelligence" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold">
          FINANCIAL INTELLIGENCE
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          SEE THE FINANCIAL SIGNAL.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-14">
          Energy data is not only an operational concern. It directly governs cost, budget, billing, forecasting, risk, performance, and strategic decision-making across the enterprise balance sheet.
        </p>

        {/* 4. Sophisticated But Simple Transformation Visual: ENERGY -> CONSUMPTION -> BILLING -> COST -> INSIGHT -> DECISION */}
        <div className="mb-14 p-6 sm:p-8 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-slate-200/80 mb-6">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-700 font-bold block mb-1">
                VALUE TRANSFORMATION PIPELINE
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-sans">
                From Raw Energy to Board-Level Decision
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-600">
              Stage {FLOW_STAGES[activeStage].step} of 06: <strong className="text-cyan-700">{FLOW_STAGES[activeStage].name}</strong>
            </span>
          </div>

          {/* 6-Stage Progression Track with Energy Trace */}
          <div
            role="tablist"
            aria-label="Value Transformation Pipeline Stages"
            className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 relative"
          >
            {/* Subtle desktop energy connection line */}
            <div
              className="hidden lg:block absolute top-1/2 left-6 right-6 -translate-y-1/2 h-[2px] pointer-events-none z-0"
              aria-hidden="true"
            >
              <svg className="w-full h-2 overflow-visible" preserveAspectRatio="none">
                <line
                  x1="0%"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                  stroke="rgba(14, 116, 144, 0.12)"
                  strokeWidth="1"
                />
                <line
                  x1="0%"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                  stroke="rgba(6, 182, 212, 0.3)"
                  strokeWidth="1.5"
                  className="enera-energy-stream"
                />
              </svg>
            </div>

            {FLOW_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isSelected = activeStage === idx;
              const isLast = idx === FLOW_STAGES.length - 1;

              return (
                <button
                  key={stage.name}
                  id={`copilot-tab-${stage.step}`}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="copilot-stage-detail"
                  tabIndex={isSelected ? 0 : -1}
                  type="button"
                  onClick={() => setActiveStage(idx)}
                  className={`p-4 rounded-xl text-left transition-all border relative z-10 flex flex-col justify-between group focus-ring-enera ${
                    isSelected
                      ? "bg-cyan-50/80 border-cyan-300 shadow-sm enera-glow-cyan"
                      : "bg-slate-50 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/90"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          isSelected ? "text-cyan-800" : "text-slate-600"
                        }`}
                      >
                        {stage.step}
                      </span>
                      <div
                        className={`p-1 rounded-md transition-transform duration-200 ${
                          isSelected
                            ? "text-cyan-700 scale-110"
                            : "text-slate-600 group-hover:scale-105"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="text-xs sm:text-sm font-bold font-mono tracking-wider text-slate-900 uppercase mb-1.5">
                      {stage.name}
                    </div>

                    <p className="text-[11px] text-slate-600 leading-snug line-clamp-2 font-sans">
                      {stage.definition}
                    </p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-600">Flow</span>
                    {!isLast && (
                      <span className="text-cyan-700 hidden lg:inline font-mono">
                        ↓ Next
                      </span>
                    )}
                    {isLast && (
                      <span className="text-emerald-700 font-mono font-medium">
                        Action
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Stage Detail Callout with Transition */}
          <div
            id="copilot-stage-detail"
            role="tabpanel"
            aria-labelledby={`copilot-tab-${FLOW_STAGES[activeStage].step}`}
            key={FLOW_STAGES[activeStage].name}
            className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded bg-cyan-100 text-cyan-900 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse" aria-hidden="true" />
                {FLOW_STAGES[activeStage].name}
              </span>
              <span className="text-slate-700 font-sans">
                {FLOW_STAGES[activeStage].definition}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 shrink-0">
              <span className="text-slate-600">{FLOW_STAGES[activeStage].metricLabel}:</span>
              <span className="text-slate-900 font-bold">{FLOW_STAGES[activeStage].metricValue}</span>
            </div>
          </div>

          {/* DATA STREAM TO FINANCIAL METRIC RESOLUTION */}
          <div className="mt-8 pt-6 border-t border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-700 font-bold block mb-1">
                  TELEMETRY STREAM TO FINANCIAL METRIC RESOLUTION
                </span>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 font-sans">
                  Watch Continuous Interval Streams Resolve Into Certified Balance-Sheet Metrics
                </h4>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {STREAM_SCENARIOS.map((scenario, idx) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => setActiveScenarioIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap focus-ring-enera ${
                      activeScenarioIdx === idx
                        ? "bg-cyan-100 text-cyan-900 font-bold border border-cyan-300 shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 border border-transparent"
                    }`}
                  >
                    {scenario.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-inner">
              {/* Left: Continuous Data Stream */}
              <div className="lg:col-span-5 space-y-2 font-mono">
                <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1.5 border-b border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
                    <span>INCOMING TELEMETRY STREAM</span>
                  </span>
                  <span className="text-cyan-400 text-[10px]">{currentScenario.category}</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {currentScenario.packets.map((pkt, i) => (
                    <div key={i} className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
                      {pkt}
                    </div>
                  ))}
                </div>
              </div>

              {/* Center: Stream Conduit with animated pulse */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center p-3 text-center space-y-2">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                  Deterministic Tariff Engine
                </span>
                {/* Animated Stream Pulse Conduit */}
                <div className="w-full h-8 flex items-center justify-center relative overflow-hidden" aria-hidden="true">
                  <svg className="w-full h-6" preserveAspectRatio="none">
                    <line
                      x1="0%"
                      y1="50%"
                      x2="100%"
                      y2="50%"
                      stroke="rgba(34, 211, 238, 0.2)"
                      strokeWidth="2"
                    />
                    <line
                      x1="0%"
                      y1="50%"
                      x2="100%"
                      y2="50%"
                      stroke="rgba(34, 211, 238, 0.8)"
                      strokeWidth="2"
                      className="enera-data-stream-pulse"
                    />
                  </svg>
                </div>
                <span className="text-[10px] font-mono text-slate-400 max-w-[200px] leading-tight">
                  {currentScenario.rule}
                </span>
              </div>

              {/* Right: Resolved Financial Metric */}
              <div className="lg:col-span-4 p-4 rounded-xl bg-slate-950 border border-cyan-500/30 enera-glow-cyan space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400 uppercase tracking-wider">RESOLVED FINANCIAL METRIC</span>
                  <span className="text-emerald-400 font-bold">{currentScenario.confidence}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-mono font-extrabold text-amber-400">
                  {currentScenario.metricValue}
                </div>
                <div className="text-xs font-semibold text-white font-sans">
                  {currentScenario.metricLabel}
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-snug">
                  {currentScenario.metricSubtext}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 5. What Energy Data Governs Across the Enterprise: 7 Clean Balance-Sheet Dimensions */}
        <div>
          <div className="mb-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-700 font-bold block mb-1">
              ORGANIZATIONAL GOVERNANCE
            </span>
            <h3 className="text-xl font-bold text-slate-900 font-sans">
              Seven Enterprise Dimensions Influenced by Energy Data
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {AFFECTED_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <div
                  key={area.dimension}
                  className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-cyan-300 hover:shadow-[0_4px_20px_-4px_rgba(6,182,212,0.1)] transition-all duration-300 flex flex-col justify-start group"
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 shrink-0 transition-transform duration-200 group-hover:scale-105 group-hover:border-cyan-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h4 className="text-sm font-bold font-mono tracking-wide text-slate-900 uppercase">
                      {area.dimension}
                    </h4>
                  </div>

                  <p className="text-xs text-slate-600 font-sans leading-relaxed">
                    {area.impact}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Supporting information & Progressive CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-600">
          <span>Deterministic financial governance grounded in statutory NERSA tariff frameworks.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-700 hover:text-cyan-800 font-semibold transition-colors focus-ring-enera shrink-0"
          >
            <span>REQUEST A DEMO</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
