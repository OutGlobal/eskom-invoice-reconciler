import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Cpu,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Search,
  Check,
  Database,
  Layers,
  FileCheck,
} from "lucide-react";

interface SimulationStep {
  step: number;
  title: string;
  desc: string;
  metric: string;
  codeSnippet: string;
}

const SIMULATION_STAGES: SimulationStep[] = [
  {
    step: 1,
    title: "READING DOCUMENT",
    desc: "OCR text layer rasterization & multi-page PDF structure parsing.",
    metric: "99.8% OCR Quality",
    codeSnippet: 'OCR_STREAM: Ingested Eskom_Megaflex_Statement_9921402.pdf [5 pages, SHA-256: 4f1a...]',
  },
  {
    step: 2,
    title: "EXTRACTING DETERMINANTS",
    desc: "Account numbers, POD ID, billing period, and 8 tariff determinant vectors.",
    metric: "8 Vectors Extracted",
    codeSnippet: 'EXTRACT: POD: 00029410 | Period: 01 Jun - 30 Jun | Active Energy: 4,218,441 kWh',
  },
  {
    step: 3,
    title: "UNDERSTANDING TARIFF",
    desc: "Mapping Megaflex / Miniflex 2024/2025 NERSA gazetted rate schedules.",
    metric: "High Season Peak Confirmed",
    codeSnippet: 'TARIFF_RULE: NERSA Schedule 2 | Megaflex High Season (Jun–Aug) | Peak TOU Rate: R 4.2811/kWh',
  },
  {
    step: 4,
    title: "CHECKING CONSUMPTION",
    desc: "Cross-referencing 2,880 half-hour AMR interval telemetry pulse points.",
    metric: "2,880 Intervals (100% Sync)",
    codeSnippet: 'AMR_SYNC: Correlating Class 0.2S interval recorder logs | Missing: 0 | Duplicates: 0',
  },
  {
    step: 5,
    title: "RECONCILING LIABILITIES",
    desc: "Executing Decimal.js high-precision calculation against delivered physical power.",
    metric: "Δ 131,227 kWh Variance",
    codeSnippet: 'RECON: Billed 4,218,441 kWh vs Actual 4,087,214 kWh | Variance Delta: -131,227 kWh',
  },
  {
    step: 6,
    title: "DETECTING ANOMALIES",
    desc: "Flagging uncredited public holidays, demand ratchets, and multiplier drift.",
    metric: "R 51,227.00 Overcharge",
    codeSnippet: 'ANOMALY_FLAG: Youth Day billed at weekday peak rate instead of Sunday off-peak (-R 18,420)',
  },
  {
    step: 7,
    title: "GENERATING INSIGHT & DOSSIER",
    desc: "Compiling Section 21 dispute package and executive audit certificate.",
    metric: "Dossier Ready for Claim",
    codeSnippet: 'OUTPUT: Form 102 Regulatory Dispute Dossier Compiled | Audit Trail Hash Chain Verified',
  },
];

const SAMPLE_INVOICES = [
  { name: "Megaflex Mining Facility (Jun 2024)", size: "2.4 MB PDF", code: "ESK-99214" },
  { name: "Rustenburg Smelter 11kV (Jul 2024)", size: "1.8 MB PDF", code: "RST-4401" },
  { name: "City Power TOU Commercial (May 2024)", size: "3.1 MB PDF", code: "CP-8812" },
];

export function EneraInteractiveUploadSection() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [selectedSample, setSelectedSample] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Progressive simulation stepper
  useEffect(() => {
    if (!isRunning || prefersReducedMotion) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev >= 7 ? 1 : prev + 1));
    }, 2800);

    return () => clearInterval(timer);
  }, [isRunning, prefersReducedMotion]);

  const activeStage = SIMULATION_STAGES[currentStep - 1] || SIMULATION_STAGES[0];

  return (
    <section
      id="use-cases"
      className="relative py-28 sm:py-32 bg-[#0a0e17] text-white overflow-hidden"
      aria-label="Interactive Verification Workbench"
    >
      {/* Background ambient gradient */}
      <div
        className="absolute top-1/4 left-1/3 w-[800px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono mb-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <UploadCloud className="h-3.5 w-3.5 text-cyan-400" />
            <span className="tracking-wide">INSTANT VERIFICATION WORKBENCH // 7-STEP PIPELINE</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            DROP A BILL. WATCH ENERA THINK.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            Drop an Eskom or municipal invoice. The engine reconstructs the entire tariff hierarchy,
            compares it against physical interval telemetry, and validates every single line item.
          </p>
        </div>

        {/* Workbench Container */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Interactive Drop Chamber & Sample Selector */}
          <div className="lg:col-span-5 rounded-3xl bg-[#030712]/95 border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
                  INGESTION CHAMBER
                </span>
                <span className="text-[11px] font-mono text-cyan-400">PDF · CSV · XLSX</span>
              </div>

              {/* Interactive Drag & Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  setCurrentStep(1);
                }}
                className={`mt-6 border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                  isDragOver
                    ? "border-cyan-400 bg-cyan-950/30 scale-[1.02]"
                    : "border-cyan-500/30 bg-cyan-950/10 hover:bg-cyan-950/20 hover:border-cyan-400/50"
                }`}
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0d1117] border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-white font-mono">
                  Drop any Eskom or Municipal Bill
                </div>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Auto-detects Megaflex, Miniflex, Nightsave & Municipal TOU tariffs.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>POPIA & ISO 27001 Compliant</span>
                </div>
              </div>

              {/* Sample Invoices Selector */}
              <div className="mt-6 space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block">
                  OR TEST WITH PRE-LOADED SAMPLE BILLS
                </span>
                <div className="space-y-1.5">
                  {SAMPLE_INVOICES.map((sample, idx) => (
                    <button
                      key={sample.code}
                      onClick={() => {
                        setSelectedSample(idx);
                        setCurrentStep(1);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between border ${
                        selectedSample === idx
                          ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                          : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{sample.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{sample.size}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Direct Link to Working Upload Workflow */}
            <div className="mt-8 pt-4 border-t border-white/10">
              <Link
                to="/upload"
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] font-mono"
              >
                <span>LAUNCH PRODUCTION INGESTION GATEWAY</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right Column: 7-Stage Dynamic Cognitive Progress Pipeline */}
          <div className="lg:col-span-7 rounded-3xl bg-[#0d1117] border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
            <div>
              {/* Header with Step Counter & Play/Pause */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-mono uppercase text-cyan-300 font-bold tracking-wider">
                    COGNITIVE RECONCILIATION PIPELINE
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">STEP {currentStep} OF 7</span>
                  <button
                    onClick={() => setIsRunning(!isRunning)}
                    className="px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-1 text-[11px]"
                  >
                    {isRunning ? (
                      <>
                        <Pause className="h-3 w-3" />
                        <span>PAUSE</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 text-cyan-400" />
                        <span>RUN</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 7-Step Interactive Pipeline List */}
              <div className="mt-5 space-y-2.5">
                {SIMULATION_STAGES.map((s) => {
                  const isDone = currentStep > s.step;
                  const isCurrent = currentStep === s.step;

                  return (
                    <button
                      key={s.step}
                      onClick={() => setCurrentStep(s.step)}
                      className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-gradient-to-r from-cyan-950/50 to-transparent border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                          : isDone
                            ? "bg-white/[0.02] border-emerald-500/20 text-slate-300 hover:bg-white/[0.04]"
                            : "bg-white/[0.01] border-transparent text-slate-500 hover:text-slate-400 hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                            isDone
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isCurrent
                                ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                                : "bg-white/[0.05] text-slate-500 border border-white/5"
                          }`}
                        >
                          {isDone ? <Check className="h-3.5 w-3.5" /> : s.step}
                        </div>

                        <div>
                          <div
                            className={`text-xs font-mono font-bold flex items-center gap-2 ${
                              isCurrent ? "text-cyan-300" : isDone ? "text-white" : "text-slate-500"
                            }`}
                          >
                            <span>{s.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans mt-0.5">{s.desc}</div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isCurrent ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold animate-pulse">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            {s.metric}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Live Step Telemetry Stream Terminal */}
              <div className="mt-5 p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase pb-1 mb-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    LIVE COGNITIVE LOGPAYLOAD
                  </span>
                  <span className="text-cyan-400">{activeStage.metric}</span>
                </div>
                <div className="text-cyan-300 text-[11px] leading-relaxed break-all">
                  <code>{activeStage.codeSnippet}</code>
                </div>
              </div>
            </div>

            {/* Bottom Guarantee Banner */}
            <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>CRYPTOGRAPHIC AUDIT CHAIN HASH VERIFIED</span>
              </div>
              <span className="text-cyan-400">ZERO DATA LEAKAGE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
