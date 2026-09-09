import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { EneraHeroCanvas } from "./EneraHeroCanvas";
import { EneraHeroSceneEngine } from "./EneraHeroSceneEngine";

export function EneraHeroSection() {
  const [headlineStage, setHeadlineStage] = useState<number>(0);

  // Headline animation sequence: SEE -> SEE BEYOND -> SEE BEYOND THE BILL.
  useEffect(() => {
    const t1 = setTimeout(() => setHeadlineStage(1), 300);
    const t2 = setTimeout(() => setHeadlineStage(2), 1200);
    const t3 = setTimeout(() => setHeadlineStage(3), 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <section className="relative min-h-screen pt-32 pb-20 overflow-hidden flex flex-col justify-between bg-[#030712] text-white">
      {/* 1. Cinematic Canvas Particle & Electrical Stream Engine */}
      <EneraHeroCanvas />

      {/* 2. Main Hero Typography & Call-To-Action Chamber */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        {/* Subtle Category Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-cyan-500/20 backdrop-blur-md mb-6 shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)]">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span className="text-[11px] font-mono text-cyan-300 font-medium tracking-wider uppercase">
            AUTONOMOUS REVENUE METER RECONCILIATION
          </span>
        </div>

        {/* Cinematic Headline with Opacity/Blur/Translate Transition */}
        <div className="min-h-[90px] sm:min-h-[130px] flex items-center justify-center">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-white leading-none">
            {headlineStage === 1 && (
              <span className="inline-block animate-in fade-in zoom-in-95 blur-sm duration-500 enera-text-gradient">
                SEE
              </span>
            )}
            {headlineStage === 2 && (
              <span className="inline-block animate-in fade-in zoom-in-95 duration-500 enera-text-gradient">
                SEE BEYOND
              </span>
            )}
            {headlineStage >= 3 && (
              <span className="inline-block animate-in fade-in zoom-in-95 duration-700 enera-text-gradient">
                SEE BEYOND THE BILL.
              </span>
            )}
          </h1>
        </div>

        {/* Supporting Statement */}
        <p className="mt-4 sm:mt-6 text-sm sm:text-base md:text-lg text-slate-300/90 max-w-2xl mx-auto font-normal leading-relaxed">
          AI-powered energy intelligence that reconciles every charge, detects hidden anomalies and
          shows where your energy money is going.
        </p>

        {/* Action Button Row */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          {/* Primary CTA: Analyse Your Energy with traveling pulse arrow */}
          <Link
            to="/upload"
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_35px_-5px_rgba(6,182,212,0.5)] hover:brightness-110 active:scale-[0.98] transition-all overflow-hidden"
          >
            <span>Analyse Your Energy</span>
            {/* Pulsing arrow icon */}
            <div className="relative flex items-center justify-center">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute -left-1 w-2 h-2 rounded-full bg-white/60 blur-[1px] group-hover:animate-ping" />
            </div>
            {/* Shimmer line effect */}
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
            </div>
          </Link>

          {/* Secondary CTA: Explore ENERA */}
          <a
            href="#platform"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium text-sm text-slate-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur-md transition-all"
          >
            <span>Explore ENERA</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
          </a>
        </div>

        {/* 3. Floating Glassmorphic Intelligence Cards around Hero */}
        <div className="w-full max-w-5xl mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {/* Card 1: Energy Spend */}
          <div className="enera-glass rounded-2xl p-4.5 transition-all hover:border-cyan-500/30 shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                ENERGY SPEND
              </span>
              <div className="text-2xl font-bold text-white font-mono mt-1">R 8.42M</div>
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono mt-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>↑ 4.8% vs last cycle</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400">
              <span className="text-[10px] font-mono">ZAR</span>
            </div>
          </div>

          {/* Card 2: AI Anomaly */}
          <div className="enera-glass rounded-2xl p-4.5 transition-all hover:border-amber-500/30 shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-semibold">
                AI ANOMALY DETECTED
              </span>
              <div className="text-2xl font-bold text-amber-300 font-mono mt-1">R 51,227</div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-mono mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Potential billing variance</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <span className="text-[10px] font-mono">98%</span>
            </div>
          </div>

          {/* Card 3: Consumption */}
          <div className="enera-glass rounded-2xl p-4.5 transition-all hover:border-emerald-500/30 shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                CONSUMPTION
              </span>
              <div className="text-2xl font-bold text-emerald-300 font-mono mt-1">4.21 GWh</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono mt-1">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>97.8% AI confidence</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <span className="text-[10px] font-mono">AMR</span>
            </div>
          </div>
        </div>

        {/* 4. Controlled 7-Scene Visual State Engine Chamber */}
        <EneraHeroSceneEngine />
      </div>
    </section>
  );
}
