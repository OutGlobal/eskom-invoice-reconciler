import React from "react";
import { Link2, Search, Eye, CheckCircle2, ArrowRight } from "lucide-react";

interface StepItem {
  number: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepItem[] = [
  {
    number: "01",
    title: "CONNECT",
    description: "Bring relevant energy and billing information together.",
    icon: Link2,
  },
  {
    number: "02",
    title: "ANALYSE",
    description:
      "ENERA examines the information and surfaces meaningful patterns and discrepancies.",
    icon: Search,
  },
  {
    number: "03",
    title: "UNDERSTAND",
    description: "See what changed, where it matters and what requires attention.",
    icon: Eye,
  },
  {
    number: "04",
    title: "ACT",
    description: "Use evidence and insights to support operational and financial decisions.",
    icon: CheckCircle2,
  },
];

export function EneraBillSignalSection() {
  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32 bg-white text-slate-900 border-t border-slate-200/80 overflow-hidden scroll-mt-12"
      aria-label="How ENERA Works"
    >
      {/* Backwards-compatible anchor */}
      <div id="signal" className="sr-only" aria-hidden="true" />
      <div id="guides" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold">
          METHODOLOGY
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          HOW ENERA WORKS
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-14">
          A straightforward four-step sequence from raw energy inputs to verified financial
          decisions.
        </p>

        {/* 4. Visual or capability: 4-Step Horizontal Flow with Energy Trace */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Subtle desktop energy connection line spanning across the 4 steps */}
          <div
            className="hidden lg:block absolute top-1/2 left-8 right-8 -translate-y-1/2 h-[2px] pointer-events-none z-0"
            aria-hidden="true"
          >
            <svg className="w-full h-2 overflow-visible" preserveAspectRatio="none">
              <line
                x1="0%"
                y1="50%"
                x2="100%"
                y2="50%"
                stroke="rgba(14, 116, 144, 0.15)"
                strokeWidth="1"
              />
              <line
                x1="0%"
                y1="50%"
                x2="100%"
                y2="50%"
                stroke="rgba(6, 182, 212, 0.35)"
                strokeWidth="1.5"
                className="enera-energy-stream"
              />
            </svg>
          </div>

          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === STEPS.length - 1;

            return (
              <div
                key={step.number}
                className="relative p-7 rounded-xl bg-slate-50/80 border border-slate-200/90 shadow-sm hover:border-cyan-300 hover:shadow-[0_8px_30px_-6px_rgba(6,182,212,0.12)] transition-all duration-300 flex flex-col justify-between group z-10"
              >
                <div>
                  {/* Step counter and icon header */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
                    <span className="font-mono text-xs font-bold text-cyan-700 tracking-wider">
                      STEP {step.number}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 transition-transform duration-200 group-hover:scale-105 group-hover:border-cyan-300">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Heading */}
                  <h3 className="text-base font-bold font-mono tracking-wider text-slate-900 uppercase mb-2">
                    {step.title}
                  </h3>

                  {/* Short Explanation */}
                  <p className="text-sm text-slate-600 font-sans leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Step position indicator */}
                <div className="mt-6 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-600">
                  <span>Phase {index + 1} of 4</span>
                  {!isLast && (
                    <span className="text-cyan-700 hidden lg:inline font-mono">→ Next</span>
                  )}
                  {isLast && (
                    <span className="text-emerald-700 font-mono font-medium">Outcome</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Supporting information & 6. Progressive CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-600">
          <span>Deterministic, reproducible pipeline with complete audit lineage.</span>
          <a
            href="#interface-previews"
            className="inline-flex items-center gap-1.5 text-cyan-700 hover:text-cyan-800 transition-colors font-semibold focus-ring-enera shrink-0"
          >
            <span>EXPLORE THE PLATFORM</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
