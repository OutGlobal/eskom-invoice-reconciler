import React from "react";
import { Scale, Eye, Search, CheckCircle2, ArrowRight } from "lucide-react";

interface Capability {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CAPABILITIES: Capability[] = [
  {
    title: "RECONCILE",
    description: "Compare billing information with underlying energy data.",
    icon: Scale,
  },
  {
    title: "UNDERSTAND",
    description: "See consumption, demand, costs and trends in context.",
    icon: Eye,
  },
  {
    title: "DETECT",
    description: "Identify unusual patterns, discrepancies and areas requiring attention.",
    icon: Search,
  },
  {
    title: "ACT",
    description: "Turn findings into evidence, reports and informed decisions.",
    icon: CheckCircle2,
  },
];

export function EneraCapabilitiesSection() {
  return (
    <section
      id="from-data-to-decision"
      className="py-24 sm:py-32 bg-white text-slate-900 border-t border-slate-200/80 font-sans scroll-mt-12"
      aria-label="From Energy Data to Decision"
    >
      {/* Backwards-compatible anchors for navigation links */}
      <div id="products" className="sr-only" aria-hidden="true" />
      <div id="capabilities" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold">
          CAPABILITIES
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          FROM ENERGY DATA TO DECISION
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-14">
          ENERA brings together the information behind your energy costs and consumption, helping teams move from fragmented data to clear financial and operational insight.
        </p>

        {/* 4. Visual or capability: 4 Clean, Compact Capability Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CAPABILITIES.map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="p-7 rounded-xl bg-slate-50/80 border border-slate-200 shadow-sm hover:border-cyan-300 hover:shadow-[0_8px_30px_-6px_rgba(6,182,212,0.12)] transition-all duration-300 flex flex-col justify-start group"
              >
                {/* Header with Step indicator and Icon */}
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 transition-transform duration-200 group-hover:scale-105 group-hover:border-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-mono font-bold tracking-wider text-slate-400 group-hover:text-cyan-700 transition-colors">
                    0{idx + 1}
                  </span>
                </div>

                {/* Short heading */}
                <h3 className="text-base font-bold font-mono tracking-wider text-slate-900 uppercase mb-2">
                  {cap.title}
                </h3>

                {/* Maximum 2–3 lines of copy */}
                <p className="text-sm text-slate-600 font-sans leading-relaxed">
                  {cap.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Enterprise Operations Center Showcase */}
        <div className="mt-10 rounded-2xl overflow-hidden border border-slate-200/90 shadow-lg bg-slate-950 text-white relative group">
          <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full overflow-hidden">
            <img
              src="/images/enera-telemetry-ecosystem.jpg"
              alt="ENERA Enterprise Operations Center displaying multi-site facility benchmarking and real-time AMR interval telemetry"
              className="w-full h-full object-cover object-center group-hover:scale-[1.01] transition-transform duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex items-end p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-300 font-semibold block mb-1">
                    ENTERPRISE OPERATIONS
                  </span>
                  <p className="text-sm sm:text-base font-medium text-white max-w-xl">
                    Multi-site facility benchmarking and deterministic reconciliation deployed across corporate, industrial, and municipal operations.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/20 text-xs font-mono text-cyan-300 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real-Time AMR Stream</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Optional supporting information & 6. Optional CTA */}
        <div className="mt-12 pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-600">
          <span>Deterministic analysis grounded in revenue-grade interval telemetry and official NERSA schedules.</span>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 text-cyan-700 hover:text-cyan-800 transition-colors font-semibold focus-ring-enera shrink-0"
          >
            <span>See how it works</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
