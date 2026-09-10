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
  ArrowDown,
  Info,
  ExternalLink,
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
    codeSnippet: "OCR_STREAM: Ingested Eskom_Megaflex_Statement_9921402.pdf [5 pages, SHA-256: 4f1a...]",
  },
  {
    step: 2,
    title: "EXTRACTING DATA",
    desc: "Account numbers, POD ID, billing period, and 8 tariff determinant vectors.",
    metric: "8 Vectors Extracted",
    codeSnippet: "EXTRACT: POD: 00029410 | Period: 01 Jun - 30 Jun | Active Energy: 4,218,441 kWh",
  },
  {
    step: 3,
    title: "UNDERSTANDING TARIFF",
    desc: "Mapping Megaflex / Miniflex 2024/2025 NERSA gazetted rate schedules.",
    metric: "High Season Peak Confirmed",
    codeSnippet: "TARIFF_RULE: NERSA Schedule 2 | Megaflex High Season (Jun–Aug) | Peak TOU Rate: R 4.2811/kWh",
  },
  {
    step: 4,
    title: "CHECKING CONSUMPTION",
    desc: "Cross-referencing 2,880 half-hour AMR interval telemetry pulse points.",
    metric: "2,880 Intervals (100% Sync)",
    codeSnippet: "AMR_SYNC: Correlating Class 0.2S interval recorder logs | Missing: 0 | Duplicates: 0",
  },
  {
    step: 5,
    title: "RECONCILING",
    desc: "Executing Decimal.js high-precision calculation against delivered physical power.",
    metric: "Δ 131,227 kWh Variance",
    codeSnippet: "RECON: Billed 4,218,441 kWh vs Actual 4,087,214 kWh | Variance Delta: -131,227 kWh",
  },
  {
    step: 6,
    title: "DETECTING ANOMALIES",
    desc: "Flagging uncredited public holidays, demand ratchets, and multiplier drift.",
    metric: "R 51,227.00 Overcharge",
    codeSnippet: "ANOMALY_FLAG: Youth Day billed at weekday peak rate instead of Sunday off-peak (-R 18,420)",
  },
  {
    step: 7,
    title: "GENERATING INSIGHT",
    desc: "Compiling Section 21 dispute package and executive audit certificate.",
    metric: "Dossier Ready for Claim",
    codeSnippet: "OUTPUT: Form 102 Regulatory Dispute Dossier Compiled | Audit Trail Hash Chain Verified",
  },
];

const SAMPLE_INVOICES = [
  { name: "Megaflex Mining Facility (Jun 2024)", size: "2.4 MB", type: "PDF", code: "ESK-99214" },
  { name: "Rustenburg Smelter 11kV Interval Data", size: "1.8 MB", type: "CSV", code: "RST-4401" },
  { name: "City Power TOU Commercial Register", size: "3.1 MB", type: "XLSX", code: "CP-8812" },
];

export function EneraInteractiveUploadSection() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [selectedSample, setSelectedSample] = useState<number>(0);
  const [userFileName, setUserFileName] = useState<string | null>(null);
  const [userFileSize, setUserFileSize] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isInView, setIsInView] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Viewport observer to pause simulation progress when offscreen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Progressive simulation stepper (Paused when off-screen or reduced motion)
  useEffect(() => {
    if (!isRunning || prefersReducedMotion || !isInView) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev >= 7 ? 1 : prev + 1));
    }, 2800);

    return () => clearInterval(timer);
  }, [isRunning, prefersReducedMotion, isInView]);

  const activeStage = SIMULATION_STAGES[currentStep - 1] || SIMULATION_STAGES[0];

  const handleDemoFileSelection = (file: File) => {
    setUserFileName(file.name);
    setUserFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    setCurrentStep(1);
    setIsRunning(true);
  };

  return (
    <section
      ref={sectionRef}
      id="use-cases"
      className="relative py-28 sm:py-36 bg-[#0a0e17] text-white overflow-hidden border-t border-white/5"
      aria-label="Interactive Bill Upload and Cognitive Pipeline"
    >
      {/* Background ambient gradient */}
      <div
        className="absolute top-1/4 left-1/3 w-[850px] h-[550px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono mb-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <UploadCloud className="h-3.5 w-3.5 text-cyan-400" />
            <span className="tracking-wide">STAGE 13 // INTERACTIVE BILL UPLOAD</span>
          </div>

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight enera-text-gradient leading-tight">
            DROP A BILL.
            <br />
            WATCH ENERA THINK.
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            Drop an Eskom or municipal invoice. The engine reconstructs the entire tariff hierarchy,
            compares it against physical interval telemetry, and validates every single line item.
          </p>

          {/* Demonstration Notice */}
          <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-400">
            <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>INTERACTIVE DEMONSTRATION STATE · CONNECT TO PRODUCTION GATEWAY FOR LIVE INGESTION</span>
          </div>
        </div>

        {/* Workbench Container */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Interactive Drop Chamber & Sample Selector */}
          <div className="lg:col-span-5 rounded-3xl bg-[#030712]/95 border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div>
              {/* Header with Format Support Badges */}
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                <span className="text-xs font-mono text-slate-300 uppercase tracking-wider font-semibold">
                  UPLOAD COMPONENT
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-slate-400 mr-1">Supported:</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 font-bold">
                    PDF
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold">
                    CSV
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-[10px] font-mono text-amber-300 font-bold">
                    XLSX
                  </span>
                </div>
              </div>

              {/* Hidden file input for demo selection */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.csv,.xlsx"
                aria-label="Upload an Eskom or municipal electricity invoice (PDF, CSV, XLSX)"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    handleDemoFileSelection(files[0]);
                  }
                }}
              />

              {/* Interactive Drag & Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    handleDemoFileSelection(files[0]);
                  }
                }}
                className={`mt-6 border-2 border-dashed rounded-2xl p-7 sm:p-9 text-center cursor-pointer transition-all focus-ring-enera ${
                  isDragOver
                    ? "border-cyan-400 bg-cyan-950/40 scale-[1.02]"
                    : "border-cyan-500/30 bg-cyan-950/10 hover:bg-cyan-950/20 hover:border-cyan-400/60"
                }`}
                role="button"
                tabIndex={0}
                aria-label="Drop an Eskom or municipal invoice here. Press Enter or Space to choose a file."
              >
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0d1117] border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3.5 shadow-[0_0_25px_rgba(6,182,212,0.25)] group-hover:scale-105 transition-transform">
                  <FileText className="h-6 w-6" />
                </div>

                {/* Exact Required Prompt String */}
                <div className="text-sm sm:text-base font-semibold text-white font-mono">
                  &ldquo;Drop an Eskom or municipal invoice here.&rdquo;
                </div>

                <p className="text-xs text-slate-400 mt-1.5 font-sans">
                  Click to select a sample file or drop any Megaflex, Miniflex, or Municipal bill.
                </p>

                {/* Formats pill */}
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-mono text-cyan-300/80">
                  <span>Supported:</span>
                  <span className="font-bold text-white">PDF · CSV · XLSX</span>
                </div>

                {/* Active user file feedback if loaded */}
                {userFileName ? (
                  <div className="mt-4 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-left flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span className="text-cyan-200 truncate">{userFileName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 ml-2">{userFileSize}</span>
                  </div>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Client-Side Preview Mode · Zero Data Stored</span>
                  </div>
                )}
              </div>

              {/* Sample Invoices Selector */}
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  <span>PRE-LOADED DEMONSTRATION BILLS</span>
                  <span className="text-cyan-400">CLICK TO SIMULATE</span>
                </div>
                <div className="space-y-1.5" role="group" aria-label="Pre-loaded demonstration bills">
                  {SAMPLE_INVOICES.map((sample, idx) => {
                    const isSelected = selectedSample === idx && !userFileName;
                    return (
                      <button
                        key={sample.code}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Simulate demo invoice: ${sample.name}, ${sample.type}, ${sample.size}`}
                        onClick={() => {
                          setSelectedSample(idx);
                          setUserFileName(null);
                          setCurrentStep(1);
                          setIsRunning(true);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between border focus-ring-enera ${
                          isSelected
                            ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                            : "bg-white/[0.02] border-white/5 text-slate-300 hover:text-white hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-slate-300">
                            {sample.type}
                          </span>
                          <span className="truncate">{sample.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{sample.size}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Direct Connection to the Existing Application Upload Workflow */}
            <div className="mt-8 pt-4 border-t border-white/10 space-y-2">
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Ready to audit live data? Connect to production:</span>
              </div>

              <Link
                to="/upload"
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] font-mono group focus-ring-enera"
              >
                <span>LAUNCH PRODUCTION UPLOAD GATEWAY</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
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
                    PROCESSING ANIMATION PIPELINE
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">STEP {currentStep} OF 7</span>
                  <button
                    type="button"
                    onClick={() => setIsRunning(!isRunning)}
                    aria-label={isRunning ? "Pause cognitive processing pipeline simulation" : "Resume cognitive processing pipeline simulation"}
                    className="px-2 py-0.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-1 text-[11px] focus-ring-enera"
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
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(1);
                      setIsRunning(true);
                    }}
                    className="p-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-ring-enera"
                    aria-label="Restart simulation from stage 1"
                    title="Restart Simulation"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* 7-Step Pipeline with Downward Transition Arrows (↓) */}
              <div className="mt-5 space-y-1.5" role="list" aria-label="Cognitive audit processing steps">
                {SIMULATION_STAGES.map((s, idx) => {
                  const isDone = currentStep > s.step;
                  const isCurrent = currentStep === s.step;

                  return (
                    <React.Fragment key={s.step}>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(s.step)}
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={`Step ${s.step}: ${s.title}. ${isCurrent ? "Currently active." : isDone ? "Completed." : "Pending."} ${s.desc}`}
                        className={`w-full text-left p-3 rounded-xl transition-all border flex items-center justify-between gap-3 focus-ring-enera ${
                          isCurrent
                            ? "bg-gradient-to-r from-cyan-950/60 to-transparent border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.25)]"
                            : isDone
                              ? "bg-white/[0.02] border-emerald-500/20 text-slate-300 hover:bg-white/[0.04]"
                              : "bg-white/[0.01] border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                              isDone
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : isCurrent
                                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                                  : "bg-white/[0.05] text-slate-400 border border-white/5"
                            }`}
                          >
                            {isDone ? <Check className="h-3.5 w-3.5" /> : s.step}
                          </div>

                          <div>
                            <div
                              className={`text-xs font-mono font-bold tracking-wide flex items-center gap-2 ${
                                isCurrent ? "text-cyan-300" : isDone ? "text-white" : "text-slate-300"
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
                          ) : isDone ? (
                            <span className="text-[10px] font-mono text-emerald-400/80">VERIFIED</span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400">{s.metric}</span>
                          )}
                        </div>
                      </button>

                      {/* Explicit Downward Connector Arrow (↓) */}
                      {idx < SIMULATION_STAGES.length - 1 && (
                        <div className="flex items-center justify-center py-0.5" aria-hidden="true">
                          <div
                            className={`flex items-center gap-1 text-[11px] font-mono transition-colors ${
                              currentStep > s.step
                                ? "text-emerald-400/60"
                                : currentStep === s.step
                                  ? "text-cyan-400 animate-pulse font-bold"
                                  : "text-slate-600"
                            }`}
                          >
                            <span>↓</span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Live Step Telemetry Stream Terminal */}
              <div
                aria-live="polite"
                className="mt-5 p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase pb-1 mb-1 border-b border-white/5">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    LIVE PIPELINE TELEMETRY STREAM
                  </span>
                  <span className="text-cyan-400">{activeStage.metric}</span>
                </div>
                <div className="text-cyan-300 text-[11px] leading-relaxed break-all">
                  <code>
                    {userFileName && currentStep === 1
                      ? `OCR_STREAM: Ingested ${userFileName} [${userFileSize}, SHA-256 verified]`
                      : activeStage.codeSnippet}
                  </code>
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
