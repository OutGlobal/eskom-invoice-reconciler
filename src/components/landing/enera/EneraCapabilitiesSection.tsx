import React from "react";
import { Link } from "@tanstack/react-router";
import { Scale, Eye, Search, CheckCircle2, ArrowRight } from "lucide-react";

interface Pillar {
  number: string;
  title: string;
  tagline: string;
  description: string;
  fiduciaryOutcome: string;
  icon: React.ComponentType<{ className?: string }>;
  linkTo?: string;
}

const CORE_PILLARS: Pillar[] = [
  {
    number: "01",
    title: "RECONCILE",
    tagline: "Deterministic Line-Item Verification",
    description:
      "Automated mathematical comparison between monthly utility invoices and revenue-grade AMR interval data, eliminating estimated billing and unearned charges.",
    fiduciaryOutcome: "Recovers 3% to 7% of unearned energy spend before invoice payment",
    icon: Scale,
    linkTo: "/reconciliation",
  },
  {
    number: "02",
    title: "UNDERSTAND",
    tagline: "Multi-Vector Tariff Governance",
    description:
      "Deconstructs opaque utility statements across active power, maximum demand, reactive draw, and official NERSA gazetted rate schedules.",
    fiduciaryOutcome: "Complete visibility into every electricity determinant on the balance sheet",
    icon: Eye,
    linkTo: "/tariff",
  },
  {
    number: "03",
    title: "DETECT",
    tagline: "Autonomous Anomaly Isolation",
    description:
      "Surfaces hidden billing discrepancies: incorrect seasonal transitions, uncredited public holiday rules, and CT/VT multiplier drifts.",
    fiduciaryOutcome: "Halts silent monthly balance sheet leakage and compound overcharges",
    icon: Search,
    linkTo: "/anomalies",
  },
  {
    number: "04",
    title: "RECOVER",
    tagline: "Audit-Ready Regulatory Dossiers",
    description:
      "Auto-generates formal dispute packages and Eskom Form 102 claim packs supported by cryptographic interval evidence and signed calibration proofs.",
    fiduciaryOutcome: "Arms treasury and legal teams with substantive proof for swift credit notes",
    icon: CheckCircle2,
    linkTo: "/reports",
  },
];

export function EneraCapabilitiesSection() {
  return (
    <section
      id="products"
      className="py-24 sm:py-32 bg-[#050811] text-white border-t border-white/5 font-sans scroll-mt-12"
      aria-label="Core Products and Capabilities"
    >
      {/* Backwards-compatible anchor */}
      <div id="capabilities" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          PRODUCTS
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          From raw utility statements to balance sheet recovery.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-14">
          Four disciplined pillars engineered for corporate finance and technical operations to eliminate utility overcharges and restore financial control.
        </p>

        {/* 4. Visual or capability: 4 Core Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {CORE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.number}
                className="p-6 sm:p-7 rounded-2xl bg-[#090d16] border border-white/10 hover:border-white/20 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <span className="font-mono text-xs font-bold text-cyan-400 tracking-wider">
                      PILLAR {pillar.number}
                    </span>
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>

                  <h3 className="text-lg font-bold text-white font-sans mt-4">
                    {pillar.title}
                  </h3>
                  <div className="text-xs font-mono text-slate-400 mt-0.5 mb-3">
                    {pillar.tagline}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500 block text-[10px] uppercase font-mono mb-0.5">
                      Fiduciary Impact
                    </span>
                    <span className="text-slate-200 font-medium">{pillar.fiduciaryOutcome}</span>
                  </div>

                  {pillar.linkTo && (
                    <Link
                      to={pillar.linkTo}
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-mono focus-ring-enera"
                    >
                      <span>Explore feature</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Optional supporting information & 6. Optional CTA */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Standardized on SANS 474 Class 0.2S interval telemetry, dual fiscal calendars, and NERSA Schedule 2 gazettes.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera shrink-0"
          >
            <span>Request a product demo</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}

