import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EneraHeroCanvas } from "./EneraHeroCanvas";
import { EneraHeroFlowVisual } from "./EneraHeroFlowVisual";
import { EneraHeroImageSlider } from "./EneraHeroImageSlider";

export function EneraHeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-[90vh] pt-36 pb-24 sm:pt-44 sm:pb-32 flex flex-col justify-center items-center text-center overflow-hidden bg-[#0c121e] text-white border-b border-slate-800/80"
      aria-label="ENERA Platform Overview"
    >
      {/* Background Image Slides (slides left every 3.5s with contrast-preserving dark overlay) */}
      <EneraHeroImageSlider />

      {/* Calm ambient energy baseline (subtle, non-distracting telemetry grid) */}
      <EneraHeroCanvas />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Institutional Eyebrow Pill */}
        <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px] text-slate-300 mb-8 font-mono tracking-wider shadow-sm flex-wrap text-center max-w-full">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" aria-hidden="true" />
          <span className="uppercase text-cyan-300 font-semibold">Energy Financial Intelligence</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">SANS 474 / NERSA Standard</span>
        </div>

        {/* Primary headline (authoritative, institutional) */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-4xl drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]">
          SEE BEYOND THE BILL.
        </h1>

        {/* Single clear, concise institutional proposition */}
        <p className="mt-6 text-base sm:text-xl text-slate-100 font-normal max-w-2xl mx-auto leading-relaxed font-sans drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">
          ENERA turns complex energy and billing information into clear, actionable intelligence.
        </p>

        {/* Secondary clear outcomes */}
        <p className="mt-3 text-sm sm:text-base text-slate-300 font-normal max-w-xl mx-auto leading-relaxed font-sans drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
          Reconcile energy data, understand costs, identify anomalies and make better decisions from one intelligent platform.
        </p>

        {/* High-contrast Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-md">
          <a
            href="#contact"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-8 py-3 rounded-md font-semibold text-xs tracking-wider uppercase text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors shadow-sm font-sans focus-ring-enera"
          >
            <span>REQUEST A DEMO</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-8 py-3 rounded-md font-medium text-xs tracking-wider uppercase text-slate-200 hover:text-white border border-white/10 hover:border-white/25 bg-white/[0.02] hover:bg-white/[0.05] transition-colors font-sans focus-ring-enera"
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

