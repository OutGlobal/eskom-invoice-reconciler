import { useState } from "react";
import {
  Cpu,
  ArrowRight,
  Database,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Activity,
  Layers,
} from "lucide-react";
import { EneraSectionHeader } from "./EneraBrandPrimitives";

interface CopilotScenario {
  id: string;
  stageName: string;
  badge: string;
  telemetryInput: string;
  engineStep: string;
  resolvedMetric: string;
  financialGain: string;
  explanation: string;
}

const SCENARIOS: CopilotScenario[] = [
  {
    id: "peak-shift",
    stageName: "Youth Day Public Holiday Rate Rectification",
    badge: "Megaflex TOU",
    telemetryInput: "30-min AMR interval: 24,500 kWh logged 16-Jun 07:00-10:00 (Youth Day gazetted)",
    engineStep: "Deterministic Tariff Engine recalculates active rate from High Peak (412.50c) to Off-Peak (194.20c)",
    resolvedMetric: "Discrepancy: Peak to Off-Peak rate credit of +R 24,180.00",
    financialGain: "+R 24,180.00",
    explanation:
      "Statutory South African public holidays are gazetted as Off-Peak time-of-use windows under Eskom Megaflex rules. The engine mathematically verified and corrected the erroneous peak surcharge.",
  },
  {
    id: "demand-threshold",
    stageName: "Maximum Demand Envelope Normalisation",
    badge: "kVA Determinant",
    telemetryInput: "Raw meter log registered momentary 2,120 kVA instantaneous spike (duration: 38 sec)",
    engineStep: "Deterministic Tariff Engine applies standard 30-min integrating thermal demand window algorithm",
    resolvedMetric: "Demand Normalised: Integrated peak verified at 1,840 kVA (+R 14,166.00 recovery)",
    financialGain: "+R 14,166.00",
    explanation:
      "Utility billing registered instantaneous spike rather than the regulatory 30-minute thermal demand integration window. Deterministic recalculation protects commercial accounts from over-billing.",
  },
  {
    id: "reactive-reconciliation",
    stageName: "High Season Reactive Energy Waiver",
    badge: "kVArh Envelope",
    telemetryInput: "Off-peak reactive consumption: 84,000 kVArh during winter low-demand period",
    engineStep: "Deterministic Tariff Engine validates lagging power factor boundary and seasonal waiver rules",
    resolvedMetric: "Surcharge Voided: Penalty charge reversed with credit of +R 27,800.00",
    financialGain: "+R 27,800.00",
    explanation:
      "Reactive energy charges are only legally billable during gazetted peak and standard operational windows when lagging power factor drops below 0.85 threshold.",
  },
];

export function EneraCopilotSection() {
  const [activeStageId, setActiveStageId] = useState<string>("peak-shift");

  const currentScenario =
    SCENARIOS.find((s) => s.id === activeStageId) || SCENARIOS[0];

  return (
    <section
      id="copilot"
      className="py-20 sm:py-28 bg-[#030712] border-t border-slate-800/80 font-sans relative overflow-hidden"
    >
      {/* Background ambient gradient */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[650px] h-[300px] bg-cyan-600/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <EneraSectionHeader
          badge="Audit Intelligence"
          title="Autonomous Verification Engine"
          description="Continuous telemetry streaming directly into deterministic tariff logic, transforming raw interval pulses into verified financial recoveries."
          centered
        />

        {/* Section Workflow Visual: TELEMETRY STREAM TO FINANCIAL METRIC RESOLUTION */}
        <div className="mt-12 rounded-xl border border-white/10 bg-[#070c18]/90 backdrop-blur-md shadow-2xl overflow-hidden p-6 sm:p-8">
          <div className="border-b border-white/5 pb-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold tracking-wider text-cyan-400 uppercase">
              TELEMETRY STREAM TO FINANCIAL METRIC RESOLUTION
            </span>
            <span className="text-xs font-mono text-slate-400">
              Deterministic Rule Pipeline v4.2
            </span>
          </div>

          {/* Scenario Tablist */}
          <div
            role="tablist"
            aria-label="Copilot Audit Scenarios"
            className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8"
          >
            {SCENARIOS.map((scenario) => {
              const isSelected = scenario.id === activeStageId;
              return (
                <button
                  key={scenario.id}
                  id={`copilot-tab-${scenario.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="copilot-stage-detail"
                  onClick={() => setActiveStageId(scenario.id)}
                  className={`text-left p-4 rounded-lg border transition-all duration-200 ${
                    isSelected
                      ? "bg-slate-900/90 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.12)] text-white"
                      : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/30">
                      {scenario.badge}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      {scenario.financialGain}
                    </span>
                  </div>
                  <div className="text-xs font-semibold tracking-tight text-slate-200">
                    {scenario.stageName}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tabpanel: Resolution Flow Visualisation */}
          <div
            id="copilot-stage-detail"
            role="tabpanel"
            aria-labelledby={`copilot-tab-${activeStageId}`}
            className="space-y-6"
          >
            {/* 3-Step Mathematical Flow */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative">
              {/* Step 1: Incoming Telemetry Stream */}
              <div className="p-5 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                      STEP 01 — TELEMETRY
                    </span>
                    <Activity className="h-4 w-4 text-cyan-400" />
                  </div>
                  <h4 className="text-xs font-mono font-bold text-white mb-2">
                    INCOMING TELEMETRY STREAM
                  </h4>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    {currentScenario.telemetryInput}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                  <svg className="w-full h-3" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <line
                      x1="0"
                      y1="5"
                      x2="100"
                      y2="5"
                      stroke="#22d3ee"
                      strokeWidth="2"
                      className="enera-data-stream-pulse"
                    />
                  </svg>
                </div>
              </div>

              {/* Step 2: Deterministic Tariff Engine */}
              <div className="p-5 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                      STEP 02 — FORMULA EVALUATION
                    </span>
                    <Calculator className="h-4 w-4 text-amber-400" />
                  </div>
                  <h4 className="text-xs font-mono font-bold text-white mb-2">
                    Deterministic Tariff Engine
                  </h4>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">
                    {currentScenario.engineStep}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Accuracy: Arbitrary Precision</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </div>
              </div>

              {/* Step 3: Resolved Financial Metric */}
              <div className="p-5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                      STEP 03 — RECOVERY LEDGER
                    </span>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h4 className="text-xs font-mono font-bold text-emerald-300 mb-2">
                    RESOLVED FINANCIAL METRIC
                  </h4>
                  <p className="text-xs text-emerald-200 font-mono font-bold leading-relaxed">
                    {currentScenario.resolvedMetric}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-emerald-400">Ledger Status</span>
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    {currentScenario.financialGain}
                  </span>
                </div>
              </div>
            </div>

            {/* Context Explanation */}
            <div className="p-4 rounded-lg bg-slate-900/40 border border-white/5 text-xs text-slate-400 leading-relaxed font-sans">
              <span className="text-slate-300 font-medium mr-1.5">Deterministic Audit Lineage:</span>
              {currentScenario.explanation}
            </div>
          </div>

          {/* Action Footer with Standardized CTA */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-400">
              Run automated reconciliation against your historical billing data
            </span>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors font-sans focus-ring-enera shadow-lg shadow-cyan-950/30"
            >
              <span>REQUEST A DEMO</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
