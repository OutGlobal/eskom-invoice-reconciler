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
    title: "ENERGY",
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
    title: "AUDIT",
    description: "Create clearer evidence trails and reporting.",
    icon: ShieldCheck,
  },
  {
    title: "EXECUTIVES",
    description: "Turn energy information into financial and operational visibility.",
    icon: TrendingUp,
  },
];

export function EneraAudienceSection() {
  return (
    <section
      id="audience"
      className="py-24 sm:py-32 bg-slate-50/60 text-slate-900 border-t border-slate-200/80 font-sans scroll-mt-12"
      aria-label="Built For The People Who Manage Energy"
    >
      {/* Backwards-compatible anchors */}
      <div id="stakeholders" className="sr-only" aria-hidden="true" />
      <div id="solutions" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold">
          STAKEHOLDERS
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          BUILT FOR THE PEOPLE WHO MANAGE ENERGY.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-14">
          Designed for cross-functional teams responsible for energy procurement, financial governance, and physical facility operations.
        </p>

        {/* 4. Visual or capability: 5 Clean Audience Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {AUDIENCES.map((audience) => {
            const Icon = audience.icon;
            return (
              <div
                key={audience.title}
                className="p-7 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:border-cyan-300 hover:shadow-[0_8px_30px_-6px_rgba(6,182,212,0.12)] transition-all duration-300 flex flex-col justify-start group"
              >
                {/* Small icon with micro-interaction */}
                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center mb-4 text-slate-700 transition-transform duration-200 group-hover:scale-105 group-hover:border-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>

                {/* Heading */}
                <h3 className="text-sm font-bold font-mono tracking-wider text-slate-900 uppercase mb-2">
                  {audience.title}
                </h3>

                {/* Short explanation */}
                <p className="text-sm text-slate-600 font-sans leading-relaxed">
                  {audience.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* 5. Supporting info & 6. Progressive CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-600">
          <span>Role-based access controls and customized views tailored to each operational mandate.</span>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 text-cyan-700 hover:text-cyan-800 font-semibold transition-colors focus-ring-enera shrink-0"
          >
            <span>EXPLORE ENERA</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
