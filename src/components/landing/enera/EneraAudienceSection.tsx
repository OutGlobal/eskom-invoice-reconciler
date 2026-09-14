import React from "react";
import {
  Activity,
  Calculator,
  Building2,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

interface AudienceCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AUDIENCES: AudienceCard[] = [
  {
    title: "ENERGY MANAGEMENT",
    description: "Understand consumption, demand and operational patterns.",
    icon: Activity,
  },
  {
    title: "FINANCE",
    description: "Improve visibility into energy costs and billing discrepancies.",
    icon: Calculator,
  },
  {
    title: "FACILITIES",
    description: "Monitor energy performance across sites and locations.",
    icon: Building2,
  },
  {
    title: "AUDIT & COMPLIANCE",
    description: "Create clearer evidence trails and reporting.",
    icon: ShieldCheck,
  },
  {
    title: "EXECUTIVE LEADERSHIP",
    description: "Turn energy information into financial and operational visibility.",
    icon: TrendingUp,
  },
];

export function EneraAudienceSection() {
  return (
    <section
      id="audience"
      className="py-20 sm:py-28 bg-[#030712] text-white border-t border-white/5 font-sans scroll-mt-12"
      aria-label="Built For The People Who Manage Energy"
    >
      {/* Backwards-compatible anchor */}
      <div id="stakeholders" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          STAKEHOLDERS & SOLUTIONS
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          BUILT FOR THE PEOPLE WHO MANAGE ENERGY.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-12">
          Designed for cross-functional teams responsible for energy procurement, financial governance, and physical facility operations.
        </p>

        {/* 4. Visual or capability: 5 Clean Audience Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {AUDIENCES.map((audience) => {
            const Icon = audience.icon;
            return (
              <div
                key={audience.title}
                className="p-6 rounded-xl bg-[#080d1a] border border-white/10 hover:border-white/20 transition-colors flex flex-col justify-start"
              >
                {/* Small icon */}
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-cyan-400">
                  <Icon className="h-5 w-5" />
                </div>

                {/* Heading */}
                <h3 className="text-sm font-bold font-mono tracking-wider text-white uppercase mb-2">
                  {audience.title}
                </h3>

                {/* Short explanation (exact user copy, no unsupported claims) */}
                <p className="text-sm text-slate-400 font-sans leading-relaxed">
                  {audience.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* 5. Supporting info & 6. Optional CTA */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Role-based access controls and customized views tailored to each operational mandate.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera shrink-0"
          >
            <span>Schedule a multi-team demonstration</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
