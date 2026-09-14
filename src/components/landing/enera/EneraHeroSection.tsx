import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EneraHeroCanvas } from "./EneraHeroCanvas";
import { EneraHeroFlowVisual } from "./EneraHeroFlowVisual";

export function EneraHeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-[85vh] pt-32 pb-20 sm:pt-36 sm:pb-24 flex flex-col justify-center items-center text-center overflow-hidden bg-[#0c121e] text-white border-b border-slate-800/80"
      aria-label="ENERA Platform Overview"
    >
      {/* Calm ambient energy baseline (subtle, non-distracting telemetry grid) */}
      <EneraHeroCanvas />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Subtle pill positioning */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 mb-6 font-sans shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            Energy Financial Intelligence
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 font-mono text-[11px]">SANS 474 / NERSA Standard</span>
        </div>

        {/* Primary headline (controlled, authoritative) */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          SEE BEYOND THE BILL.
        </h1>

        {/* Supporting statement */}
        <p className="mt-5 text-base sm:text-xl text-slate-200 font-normal max-w-2xl mx-auto leading-relaxed font-sans">
          ENERA turns complex energy and billing information into clear, actionable intelligence.
        </p>

        {/* Secondary statement */}
        <p className="mt-3 text-sm sm:text-base text-slate-400 font-normal max-w-xl mx-auto leading-relaxed font-sans">
          Reconcile energy data, understand costs, identify anomalies and make better decisions from one intelligent platform.
        </p>

        {/* High-contrast Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <a
            href="#contact"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-lg font-semibold text-sm text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors shadow-sm font-sans focus-ring-enera"
          >
            <span>REQUEST A DEMO</span>
            <ArrowRight className="h-4 w-4" />
          </a>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg font-medium text-sm text-slate-200 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition-colors font-sans focus-ring-enera"
          >
            <span>EXPLORE ENERA</span>
          </a>
        </div>

        {/* Authorized Client Portal Access */}
        <div className="mt-4">
          <Link
            to="/login"
            className="text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1.5 focus-ring-enera"
          >
            <span>Authorized Client Portal</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {/* One Sophisticated ENERA Energy-Intelligence Visual: 5-Stage Transformation Pipeline */}
        <EneraHeroFlowVisual />
      </div>
    </section>
  );
}

