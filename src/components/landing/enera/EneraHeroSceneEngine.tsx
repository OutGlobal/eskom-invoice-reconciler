import React, { useState, useEffect } from "react";
import {
  Zap,
  FileText,
  Cpu,
  Scale,
  AlertTriangle,
  BarChart3,
  RotateCcw,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
} from "lucide-react";

export type SceneId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface SceneMeta {
  id: SceneId;
  label: string;
  sub: string;
}

const SCENES: SceneMeta[] = [
  { id: 1, label: "01 ENERGY", sub: "Raw Telemetry & Physics" },
  { id: 2, label: "02 BILL", sub: "Utility Invoice Extraction" },
  { id: 3, label: "03 ANALYSIS", sub: "Determinant Fragmentation" },
  { id: 4, label: "04 RECONCILIATION", sub: "Dual-Stream Balancing" },
  { id: 5, label: "05 ANOMALY", sub: "Statistical & Tariff Detection" },
  { id: 6, label: "06 INTELLIGENCE", sub: "Financial Control Interface" },
  { id: 7, label: "07 RESET", sub: "Cycle Recalibration" },
];

export function EneraHeroSceneEngine() {
  const [activeScene, setActiveScene] = useState<SceneId>(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);

  // 5-second automatic progression cycle
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveScene((prev) => (prev === 7 ? 1 : ((prev + 1) as SceneId)));
    }, 4800);

    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  return (
    <div className="relative w-full max-w-4xl mx-auto mt-6 rounded-2xl bg-[#0d1117]/85 border border-white/10 backdrop-blur-2xl shadow-[0_0_50px_-10px_rgba(6,182,212,0.15)] overflow-hidden transition-all">
      {/* Top Scene Progress Rail */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[11px] font-mono font-semibold tracking-wider text-cyan-300 uppercase">
            ENERA VISUAL STATE ENGINE
          </span>
        </div>

        {/* Scene Selector Pills */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full py-1">
          {SCENES.map((scene) => {
            const isActive = activeScene === scene.id;
            return (
              <button
                key={scene.id}
                onClick={() => {
                  setActiveScene(scene.id);
                  setIsAutoPlaying(false);
                }}
                className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
                aria-label={`Jump to scene ${scene.label}`}
              >
                {scene.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scene Presentation Chamber */}
      <div className="p-6 sm:p-8 min-h-[310px] flex items-center justify-center">
        {/* SCENE 01 — ENERGY */}
        {activeScene === 1 && (
          <div className="w-full flex flex-col items-center text-center animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(6,182,212,0.25)]">
              <Zap className="h-8 w-8 text-cyan-400 animate-pulse" />
            </div>
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1">
              SCENE 01 — ENERGY FLOW
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              30-Minute Interval Telemetry Stream
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-lg">
              Continuous active and reactive AMR pulses flowing from revenue meters into the ENERA
              data lake at 0.96 power factor.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-slate-300">
                ACTIVE ENERGY: <span className="text-cyan-400 font-semibold">kWh</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-slate-300">
                APPARENT DEMAND: <span className="text-emerald-400 font-semibold">kVA</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] font-mono text-xs text-slate-300">
                REACTIVE POWER: <span className="text-violet-400 font-semibold">kVArh</span>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 02 — BILL */}
        {activeScene === 2 && (
          <div className="w-full max-w-xl animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  SCENE 02 — UTILITY INVOICE DETECTED
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">ESKOM ENTERPRISE BILL</span>
            </div>

            <div className="rounded-xl bg-[#161b22] border border-white/10 p-5 space-y-3 font-mono shadow-inner">
              <div className="flex justify-between items-center pb-2 border-b border-white/10 text-xs">
                <span className="text-slate-400">TARIFF SCHEDULE</span>
                <span className="text-cyan-300 font-bold">MEGAFLEX (HIGH SEASON)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">BILLED CONSUMPTION</span>
                <span className="text-white font-semibold text-sm">4,218,441 kWh</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">MAXIMUM DEMAND (NMD)</span>
                <span className="text-white font-semibold text-sm">8,421 kVA</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10 text-xs">
                <span className="text-slate-400">TOTAL ENERGY CHARGE</span>
                <span className="text-emerald-400 font-bold text-base">R 842,431.00</span>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 03 — ANALYSIS */}
        {activeScene === 3 && (
          <div className="w-full flex flex-col items-center text-center animate-in fade-in duration-500">
            <div className="w-14 h-14 rounded-2xl bg-violet-950/60 border border-violet-500/30 flex items-center justify-center mb-3 shadow-[0_0_25px_rgba(139,92,246,0.25)]">
              <Cpu className="h-7 w-7 text-violet-400 animate-spin" style={{ animationDuration: "12s" }} />
            </div>
            <span className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-1">
              SCENE 03 — DECONSTRUCTING DETERMINANTS
            </span>
            <h3 className="text-xl font-bold text-white">
              OCR & Determinant Vector Fragmentation
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-md">
              Invoice line items shatter into structured data vectors and stream directly into the
              deterministic NERSA rule matrix.
            </p>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-lg">
              {["Peak TOU kWh", "Standard kWh", "Off-Peak kWh", "Voltage Surcharge"].map((tag) => (
                <div
                  key={tag}
                  className="px-2 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[11px] font-mono text-violet-300 text-center"
                >
                  {tag}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCENE 04 — RECONCILIATION */}
        {activeScene === 4 && (
          <div className="w-full max-w-xl animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                SCENE 04 — RECONCILIATION DISCOVERY
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#161b22] border border-white/10 p-4">
                <span className="text-[10px] font-mono uppercase text-slate-400">BILLED VOLUME</span>
                <div className="text-lg font-bold text-white font-mono mt-1">4,218,441 kWh</div>
                <span className="text-[10px] text-slate-500">From Eskom Invoice PDF</span>
              </div>

              <div className="rounded-xl bg-[#161b22] border border-cyan-500/30 p-4 bg-cyan-950/20">
                <span className="text-[10px] font-mono uppercase text-cyan-400">ACTUAL GROUND TRUTH</span>
                <div className="text-lg font-bold text-cyan-300 font-mono mt-1">4,087,214 kWh</div>
                <span className="text-[10px] text-cyan-400/80">From Revenue AMR Meter</span>
              </div>
            </div>

            {/* Revealed Variance */}
            <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                  DETERMINISTIC VARIANCE REVEALED
                </span>
                <div className="text-base font-bold font-mono text-amber-300">
                  +131,227 kWh OVERBILLED
                </div>
              </div>
              <TrendingDown className="h-6 w-6 text-amber-400" />
            </div>
          </div>
        )}

        {/* SCENE 05 — ANOMALY */}
        {activeScene === 5 && (
          <div className="w-full max-w-xl animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-rose-400 animate-pulse" />
              <span className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                SCENE 05 — ANOMALY ISOLATION
              </span>
            </div>

            <div className="rounded-xl bg-rose-950/20 border border-rose-500/30 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-rose-200">
                  CRITICAL BILLING ANOMALY DETECTED
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono text-rose-300 font-bold">
                  FLAGGED
                </span>
              </div>

              <p className="text-xs text-slate-300">
                Peak TOU rate applied across 84 off-peak weekend intervals due to incorrect public
                holiday calendar substitution schedule.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-rose-500/20">
                <div>
                  <span className="text-[10px] font-mono text-slate-400">POTENTIAL VARIANCE</span>
                  <div className="text-lg font-bold font-mono text-rose-400">R 51,227.00</div>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-slate-400">AI CONFIDENCE</span>
                  <div className="text-lg font-bold font-mono text-emerald-400">97.8%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 06 — INTELLIGENCE */}
        {activeScene === 6 && (
          <div className="w-full max-w-2xl animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                  SCENE 06 — EXECUTIVE FINANCIAL CONTROL
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">PORTFOLIO SUMMARY</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#161b22] border border-white/10">
                <span className="text-[10px] font-mono text-slate-400">ENERGY SPEND</span>
                <div className="text-base font-bold font-mono text-white mt-1">R 8.42M</div>
                <span className="text-[9px] text-slate-500">Monthly Portfolios</span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                <span className="text-[10px] font-mono text-emerald-400">POTENTIAL RECOVERY</span>
                <div className="text-base font-bold font-mono text-emerald-300 mt-1">R 421K</div>
                <span className="text-[9px] text-emerald-400/80">Identified Overcharge</span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
                <span className="text-[10px] font-mono text-amber-400">ACTIVE ANOMALIES</span>
                <div className="text-base font-bold font-mono text-amber-300 mt-1">17</div>
                <span className="text-[9px] text-amber-400/80">Under Review</span>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30">
                <span className="text-[10px] font-mono text-cyan-400">RECONCILED</span>
                <div className="text-base font-bold font-mono text-cyan-300 mt-1">98.7%</div>
                <span className="text-[9px] text-cyan-400/80">Audited Accuracy</span>
              </div>
            </div>
          </div>
        )}

        {/* SCENE 07 — RESET */}
        {activeScene === 7 && (
          <div className="w-full flex flex-col items-center text-center animate-in fade-in duration-500">
            <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mb-3">
              <RotateCcw className="h-6 w-6 text-cyan-400 animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-1">
              SCENE 07 — RECALIBRATION
            </span>
            <h3 className="text-xl font-bold text-white">Dissolving Back Into Pure Energy Flow</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-md">
              Every month, the cycle repeats. ENERA monitors each invoice the moment it arrives.
            </p>
          </div>
        )}
      </div>

      {/* Interactive Bottom Control Rail */}
      <div className="px-4 sm:px-6 py-2.5 border-t border-white/10 bg-white/[0.01] flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span>STATE {activeScene} OF 7:</span>
          <span className="text-white font-medium">{SCENES[activeScene - 1].sub}</span>
        </div>

        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {isAutoPlaying ? "Pause Loop" : "Resume Auto-Play"}
        </button>
      </div>
    </div>
  );
}
