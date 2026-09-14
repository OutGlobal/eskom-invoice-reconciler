import React, { useState, useEffect } from "react";
import {
  Zap,
  FileText,
  Scale,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  Check,
} from "lucide-react";

interface FlowStage {
  id: string;
  stepNumber: string;
  name: string;
  category: string;
  shortDesc: string;
  sampleMetric: string;
  telemetryTag: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  activeBorder: string;
  activeBg: string;
  evidenceCode: string;
  evidenceLabel: string;
}

const FLOW_STAGES: FlowStage[] = [
  {
    id: "energy-data",
    stepNumber: "01",
    name: "Energy data",
    category: "RAW TELEMETRY",
    shortDesc: "1,488 monthly 30-minute interval meter registers and physical hardware pulse logs.",
    sampleMetric: "4,087,214 kWh",
    telemetryTag: "AMR CHECK METER",
    icon: Zap,
    accentColor: "text-cyan-400",
    activeBorder: "border-cyan-500/40",
    activeBg: "bg-cyan-500/[0.08]",
    evidenceLabel: "PHYSICAL TELEMETRY STREAM",
    evidenceCode: "Meter #AMR-7721-JHB · 30-min intervals: 1,488/1,488 (100% integrity) · Active: 4,087,214 kWh · Peak Demand: 8,421 kVA",
  },
  {
    id: "billing-info",
    stepNumber: "02",
    name: "Billing information",
    category: "UTILITY DETERMINANTS",
    shortDesc: "Aggregated municipal and Eskom invoice determinants, tariff schedules, and claimed line items.",
    sampleMetric: "R 842,431 Stated",
    telemetryTag: "UTILITY INVOICE",
    icon: FileText,
    accentColor: "text-slate-200",
    activeBorder: "border-slate-400/40",
    activeBg: "bg-slate-400/[0.08]",
    evidenceLabel: "BILLED UTILITY DETERMINANTS",
    evidenceCode: "Invoice #INV-2026-0891 · Stated kWh: 4,218,441 · Stated Demand: 8,950 kVA · Billed Charge: R 842,431.20 (Incl VAT)",
  },
  {
    id: "analysis",
    stepNumber: "03",
    name: "Analysis",
    category: "MATHEMATICAL RECON",
    shortDesc: "Deterministic TOU matrix cross-audit, seasonal tariff verification, and power factor calculation.",
    sampleMetric: "Megaflex TOU Validated",
    telemetryTag: "NERSA 2025/26 ENGINE",
    icon: Scale,
    accentColor: "text-blue-400",
    activeBorder: "border-blue-500/40",
    activeBg: "bg-blue-500/[0.08]",
    evidenceLabel: "DETERMINISTIC TOU CALCULATION",
    evidenceCode: "NERSA Schedule 2 · High-Season Winter Matrix · Peak: 642,110 kWh · Standard: 1,980,410 kWh · Off-Peak: 1,464,694 kWh",
  },
  {
    id: "insight",
    stepNumber: "04",
    name: "Insight",
    category: "ANOMALY ISOLATED",
    shortDesc: "Discrepancies flagged: unearned charges, holiday rate misapplication, and demand ratchet overstatement.",
    sampleMetric: "131,227 kWh Variance",
    telemetryTag: "ANOMALY DETECTED",
    icon: AlertCircle,
    accentColor: "text-amber-400",
    activeBorder: "border-amber-500/40",
    activeBg: "bg-amber-500/[0.08]",
    evidenceLabel: "MATERIAL VARIANCE DISCOVERED",
    evidenceCode: "Public Holiday (27 Apr) billed at High-Season Peak instead of statutory Off-Peak · Demand overstatement: +529 kVA",
  },
  {
    id: "decision",
    stepNumber: "05",
    name: "Decision",
    category: "EXECUTIVE RESOLUTION",
    shortDesc: "Audit-ready Form 102 dispute dossiers, evidence packs, and treasury credit recovery instructions.",
    sampleMetric: "R 51,227 Recovered",
    telemetryTag: "FIDUCIARY DOSSIER",
    icon: CheckCircle2,
    accentColor: "text-emerald-400",
    activeBorder: "border-emerald-500/40",
    activeBg: "bg-emerald-500/[0.08]",
    evidenceLabel: "RECOVERY DOSSIER & REMEDIATION",
    evidenceCode: "Dispute Claim #DIS-2026-441 compiled · Direct Credit Note: R 51,227.00 · Fiduciary hash chain SHA-256 verified",
  },
];

export function EneraHeroFlowVisual() {
  const [activeIdx, setActiveIdx] = useState<number>(3); // Default highlighting Insight/Analysis
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Subtle automated progression every 5 seconds (disabled on hover, click, or reduced motion)
  useEffect(() => {
    if (reducedMotion || isPaused) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % FLOW_STAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [reducedMotion, isPaused]);

  const activeStage = FLOW_STAGES[activeIdx];

  return (
    <div
      className="w-full max-w-5xl mx-auto mt-12 sm:mt-16 text-left"
      aria-label="ENERA Energy Intelligence Transformation Flow"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="rounded-2xl bg-[#080d16] border border-white/10 p-5 sm:p-7 shadow-2xl backdrop-blur-sm transition-all">
        {/* Top Control & Trust Line */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-white/10 gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full bg-cyan-400 ${
                reducedMotion ? "" : "animate-pulse"
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
              ENERA Energy Intelligence Pipeline
            </span>
          </div>

          {/* Prompt-mandated textual flow indicator */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 overflow-x-auto py-1">
            <span className={activeIdx === 0 ? "text-cyan-400 font-semibold" : ""}>Energy data</span>
            <span className="text-slate-600">↓</span>
            <span className={activeIdx === 1 ? "text-slate-200 font-semibold" : ""}>Billing information</span>
            <span className="text-slate-600">↓</span>
            <span className={activeIdx === 2 ? "text-blue-400 font-semibold" : ""}>Analysis</span>
            <span className="text-slate-600">↓</span>
            <span className={activeIdx === 3 ? "text-amber-400 font-semibold" : ""}>Insight</span>
            <span className="text-slate-600">↓</span>
            <span className={activeIdx === 4 ? "text-emerald-400 font-semibold" : ""}>Decision</span>
          </div>
        </div>

        {/* 5-Stage Transformation Visual Grid (Desktop: Horizontal with energy connector line; Mobile: Vertical stack) */}
        <div
          role="tablist"
          aria-label="5-Stage Energy Intelligence Pipeline"
          className="grid grid-cols-1 lg:grid-cols-5 gap-3 relative"
        >
          {/* Subtle desktop energy connection line spanning across the 5 stages */}
          <div
            className="hidden lg:block absolute top-1/2 left-4 right-4 -translate-y-1/2 h-[2px] pointer-events-none z-0"
            aria-hidden="true"
          >
            <svg className="w-full h-2 overflow-visible" preserveAspectRatio="none">
              <line
                x1="0%"
                y1="50%"
                x2="100%"
                y2="50%"
                stroke="rgba(34, 211, 238, 0.15)"
                strokeWidth="1"
              />
              <line
                x1="0%"
                y1="50%"
                x2="100%"
                y2="50%"
                stroke="rgba(34, 211, 238, 0.4)"
                strokeWidth="1.5"
                className="enera-energy-stream"
              />
            </svg>
          </div>

          {FLOW_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isSelected = activeIdx === idx;

            return (
              <React.Fragment key={stage.id}>
                <button
                  type="button"
                  role="tab"
                  id={`tab-${stage.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${stage.id}`}
                  tabIndex={0}
                  onClick={() => {
                    setActiveIdx(idx);
                    setIsPaused(true);
                  }}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between group focus-ring-enera relative z-10 ${
                    isSelected
                      ? `${stage.activeBg} ${stage.activeBorder} shadow-lg ring-1 ring-white/10 enera-glow-cyan`
                      : "bg-[#05080f]/90 border-white/5 hover:border-white/20 hover:bg-[#0b101c]"
                  }`}
                >
                  <div>
                    {/* Top Row: Stage number + Icon */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        {stage.stepNumber}
                      </span>
                      <div
                        className={`p-1.5 rounded-md bg-white/5 ${stage.accentColor} transition-transform duration-200 ${
                          isSelected ? "scale-110" : "group-hover:scale-105"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Stage Name (matching prompt exactly) */}
                    <h3
                      className={`text-sm font-semibold font-sans leading-tight ${
                        isSelected ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {stage.name}
                    </h3>

                    {/* Micro Category */}
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mt-1">
                      {stage.category}
                    </span>
                  </div>

                  {/* Sample Metric & Status Indicator */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-slate-200 block truncate">
                      {stage.sampleMetric}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" aria-hidden="true" />
                    )}
                  </div>
                </button>

                {/* Mobile downward flow connector (showing Energy data ↓ Billing information ↓ Analysis ↓ Insight ↓ Decision) */}
                {idx < FLOW_STAGES.length - 1 && (
                  <div
                    className="flex lg:hidden justify-center py-1 text-slate-600"
                    aria-hidden="true"
                  >
                    <ArrowDown className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Live Active Stage Telemetry Preview (20% Data Visualisation) */}
        <div
          id={`panel-${activeStage.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeStage.id}`}
          key={activeStage.id}
          className="mt-5 pt-5 border-t border-white/10 transition-all duration-300"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#05080f]/90 border border-white/5 rounded-xl p-4 sm:p-5 relative overflow-hidden">
            {/* Subtle corner energy accent */}
            <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/[0.03] rounded-full blur-2xl pointer-events-none" />

            {/* Stage Summary Description */}
            <div className="md:col-span-6 space-y-1.5 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300 font-semibold">
                  STAGE {activeStage.stepNumber} · {activeStage.name.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {activeStage.telemetryTag}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
                {activeStage.shortDesc}
              </p>
            </div>

            {/* Verifiable Telemetry Evidence Box */}
            <div className="md:col-span-6 bg-black/40 border border-white/5 rounded-lg p-3 space-y-1 relative z-10">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-1 border-b border-white/5">
                <span className="uppercase tracking-wider">{activeStage.evidenceLabel}</span>
                <span className="text-emerald-400 flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                  <Check className="h-3 w-3" /> VERIFIED
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300 font-medium leading-normal break-all">
                {activeStage.evidenceCode}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Statutory Footnote */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] font-mono text-slate-400 pt-2">
          <span>SANS 474 Statutory Check-Metering &amp; NERSA 2025/26 Regulatory Compliance</span>
          <span className="mt-1 sm:mt-0 text-slate-400">
            {isPaused ? "Paused on inspection" : "Auto-cycling 5s · Click any stage to inspect"}
          </span>
        </div>
      </div>
    </div>
  );
}

