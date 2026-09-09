import React, { useState, useEffect } from "react";
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
  RotateCcw,
} from "lucide-react";

const SIMULATION_STAGES = [
  { step: 1, title: "READING DOCUMENT", desc: "OCR text layer rasterization & PDF structure parsing" },
  { step: 2, title: "EXTRACTING DATA", desc: "Account number, POD, period, and determinant line items" },
  { step: 3, title: "UNDERSTANDING TARIFF", desc: "Mapping Megaflex / Miniflex 2025/2026 NERSA tariff rules" },
  { step: 4, title: "CHECKING CONSUMPTION", desc: "Correlating 1,488 half-hour AMR interval telemetry points" },
  { step: 5, title: "RECONCILING", desc: "Evaluating active, demand, and reactive variances" },
  { step: 6, title: "DETECTING ANOMALIES", desc: "Flagging holiday rate errors and peak demand misallocations" },
  { step: 7, title: "GENERATING INSIGHT", desc: "Compiling Section 21 dispute package and executive report" },
];

export function EneraInteractiveUploadSection() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isRunning, setIsRunning] = useState<boolean>(true);

  // Progressive simulation stepper
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev >= 7 ? 1 : prev + 1));
    }, 2400);

    return () => clearInterval(timer);
  }, [isRunning]);

  return (
    <section id="use-cases" className="relative py-28 bg-[#0a0e17] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-4">
            <UploadCloud className="h-3 w-3" />
            <span>INSTANT VERIFICATION WORKBENCH</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            DROP A BILL. WATCH ENERA THINK.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light">
            Drop an Eskom or municipal invoice. The engine reconstructs the entire tariff hierarchy,
            compares it to interval telemetry, and validates every rand.
          </p>
        </div>

        {/* Upload & Processing Simulation Grid */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Interactive Drop Gateway */}
          <div className="lg:col-span-5 rounded-3xl bg-[#030712]/90 border border-white/10 p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  INGESTION CHAMBER
                </span>
                <span className="text-[11px] font-mono text-cyan-400">PDF · CSV · XLSX</span>
              </div>

              {/* Visual Drop Area */}
              <div className="mt-6 border-2 border-dashed border-cyan-500/30 rounded-2xl p-8 text-center bg-cyan-950/10 hover:bg-cyan-950/20 hover:border-cyan-400/50 transition-all group">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0d1117] border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.2)] group-hover:scale-105 transition-transform">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-white">
                  Drop an Eskom or municipal invoice here
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Supports Megaflex, Miniflex, Nightsave, and City of JHB / Cape Town formats
                </p>

                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>POPIA & ISO 27001 Compliant</span>
                </div>
              </div>
            </div>

            {/* Direct Link to Working Upload Workflow */}
            <div className="mt-8 pt-4 border-t border-white/10">
              <Link
                to="/upload"
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg"
              >
                <span>Launch Production Ingestion Gateway</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right: 7-Stage Dynamic Cognitive Progress Pipeline */}
          <div className="lg:col-span-7 rounded-3xl bg-[#0d1117] border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-mono uppercase text-cyan-300 font-bold">
                    RECONCILIATION COGNITION ENGINE
                  </span>
                </div>

                <button
                  onClick={() => setIsRunning(!isRunning)}
                  className="text-[11px] font-mono text-slate-400 hover:text-white flex items-center gap-1.5"
                >
                  {isRunning ? (
                    <span>Pause Demo</span>
                  ) : (
                    <span className="text-cyan-400">Resume Demo</span>
                  )}
                </button>
              </div>

              {/* 7-Step Timeline Display */}
              <div className="mt-6 space-y-3">
                {SIMULATION_STAGES.map((s) => {
                  const isDone = currentStep > s.step;
                  const isCurrent = currentStep === s.step;

                  return (
                    <div
                      key={s.step}
                      className={`p-3.5 rounded-xl transition-all border flex items-center justify-between gap-4 ${
                        isCurrent
                          ? "bg-cyan-950/40 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                          : isDone
                            ? "bg-white/[0.02] border-emerald-500/20 text-slate-300"
                            : "bg-white/[0.01] border-transparent text-slate-500 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                            isDone
                              ? "bg-emerald-500/20 text-emerald-400"
                              : isCurrent
                                ? "bg-cyan-500 text-slate-950"
                                : "bg-white/[0.05] text-slate-500"
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.step}
                        </div>

                        <div>
                          <div
                            className={`text-xs font-mono font-bold ${
                              isCurrent ? "text-cyan-300" : isDone ? "text-white" : "text-slate-500"
                            }`}
                          >
                            {s.title}
                          </div>
                          <div className="text-[11px] text-slate-400">{s.desc}</div>
                        </div>
                      </div>

                      {isCurrent && (
                        <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold animate-pulse shrink-0">
                          PROCESSING
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Proof Note */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>STATUS: LIVE RECONCILIATION ENGINE</span>
              <span className="text-emerald-400 font-semibold">100% AUDIT REPRODUCIBLE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
