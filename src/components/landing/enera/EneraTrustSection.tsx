import React from "react";
import {
  FileSearch,
  Eye,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface TrustPrinciple {
  title: string;
  statement: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TRUST_PRINCIPLES: TrustPrinciple[] = [
  {
    title: "Evidence-led",
    statement: "Clear source information.",
    description:
      "Every variance, metric, and total links directly to underlying interval meter telemetry and official tariff gazettes.",
    icon: FileSearch,
  },
  {
    title: "Transparent",
    statement: "Understand the basis of important findings.",
    description:
      "Deterministic calculation steps and rate schedules are open to inspection, with no black-box adjustments.",
    icon: Eye,
  },
  {
    title: "Controlled",
    statement: "Designed around appropriate access and information handling.",
    description:
      "Tenant-isolated environments and role-based access govern how organizational energy information is handled.",
    icon: ShieldCheck,
  },
  {
    title: "Decision-ready",
    statement: "Turn complex information into usable outputs.",
    description:
      "High-frequency interval data and complex utility statements are organized into structured evidence and clear reports.",
    icon: CheckCircle2,
  },
];

export function EneraTrustSection() {
  return (
    <section
      id="trust"
      className="py-20 sm:py-28 bg-[#030712] text-white border-t border-white/5 font-sans scroll-mt-12"
      aria-label="Trust & Governance — Intelligence You Can Trace"
    >
      {/* Backwards-compatible navigation anchors */}
      <div id="about" className="sr-only" aria-hidden="true" />
      <div id="governance" className="sr-only" aria-hidden="true" />
      <div id="security" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
          <span>TRUST & GOVERNANCE</span>
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          INTELLIGENCE YOU CAN TRACE.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-12">
          Every variance, metric, and finding in ENERA is tied directly to verifiable data sources and transparent logic, providing finance and operations teams with complete confidence.
        </p>

        {/* 4. Visual or capability: 4 Clean Principle Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_PRINCIPLES.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="p-6 rounded-xl bg-[#080d1a] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="text-lg font-bold text-white font-sans mb-1">
                    {p.title}
                  </h3>

                  <p className="text-sm font-medium text-cyan-300 font-sans mb-2.5">
                    {p.statement}
                  </p>

                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Supporting information & CTA */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Verifiable source lineage linking findings directly to underlying utility and telemetry records.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera shrink-0"
          >
            <span>Request a technical briefing</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
