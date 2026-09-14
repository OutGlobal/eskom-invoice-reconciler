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
      className="py-20 sm:py-24 bg-white text-slate-900 border-t border-slate-200/80 font-sans scroll-mt-12"
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
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-12">
          ENERA brings together the information behind your energy costs and consumption, helping teams move from fragmented data to clear financial and operational insight.
        </p>

        {/* 4. Visual or capability: 4 Clean, Compact Capability Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="p-6 rounded-xl bg-slate-50 border border-slate-200/90 shadow-sm hover:border-slate-300 hover:shadow transition-all flex flex-col justify-start"
              >
                {/* Simple icon */}
                <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center mb-5 text-cyan-700">
                  <Icon className="h-5 w-5" />
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

        {/* 5. Optional supporting information & 6. Optional CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-500">
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
