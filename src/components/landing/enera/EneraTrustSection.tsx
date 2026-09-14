import React from "react";
import {
  FileSearch,
  Eye,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Globe,
  SlidersHorizontal,
  Lock,
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
      "Every finding connects directly to underlying meter intervals and gazetted rates.",
    icon: FileSearch,
  },
  {
    title: "Transparent",
    statement: "Understand the basis of important findings.",
    description:
      "Every calculation step is verifiable, with zero black-box adjustments.",
    icon: Eye,
  },
  {
    title: "Controlled",
    statement: "Designed around appropriate access and information handling.",
    description:
      "Role-based access and tenant isolation safeguard your organizational data.",
    icon: ShieldCheck,
  },
  {
    title: "Decision-ready",
    statement: "Turn complex information into usable outputs.",
    description:
      "Complex interval telemetry is synthesized into structured evidence and audit packs.",
    icon: CheckCircle2,
  },
];

interface DisclosureTier {
  level: string;
  name: string;
  badge: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  summary: string;
  items: string[];
}

const DISCLOSURE_TIERS: DisclosureTier[] = [
  {
    level: "LEVEL 1",
    name: "PUBLIC",
    badge: "Safe to explain",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: Globe,
    iconClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    summary: "Clear visibility into platform capabilities, business outcomes, workflows, and reporting.",
    items: [
      "Platform capabilities and business outcomes",
      "Industry use cases, workflows, and benefits",
      "Energy and billing intelligence",
      "Reconciliation and variance identification",
      "Consumption analysis and load profiles",
      "Executive reporting and financial visibility",
    ],
  },
  {
    level: "LEVEL 2",
    name: "CONTROLLED",
    badge: "High level only",
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
    icon: SlidersHorizontal,
    iconClass: "text-cyan-700 bg-cyan-50 border-cyan-200",
    summary: "Conceptual explanations of processing, security posture, and evidence handling under enterprise NDA.",
    items: [
      "Data processing and alignment concepts",
      "AI-assisted analytical workflows",
      "Utility and telemetry integration methods",
      "Security approach and encryption posture",
      "Tenant data segregation and handling",
      "Audit trail structure and evidence lineage",
    ],
  },
  {
    level: "LEVEL 3",
    name: "PRIVATE",
    badge: "Zero public exposure",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    icon: Lock,
    iconClass: "text-slate-700 bg-slate-100 border-slate-300",
    summary: "Strict embargo on proprietary implementations, system configurations, and credentials.",
    items: [
      "Source code and proprietary calculation engines",
      "Database schemas, tables, and internal IDs",
      "Private API endpoints and webhook routes",
      "Secrets, credentials, and environment tokens",
      "Authentication and security internals",
      "Model prompts and internal system thresholds",
      "Cloud infrastructure topology and host details",
    ],
  },
];

export function EneraTrustSection() {
  return (
    <section
      id="trust"
      className="py-20 sm:py-24 bg-slate-50 text-slate-900 border-t border-slate-200/80 font-sans scroll-mt-12"
      aria-label="Trust & Governance — Intelligence You Can Trace"
    >
      {/* Backwards-compatible navigation anchors */}
      <div id="about" className="sr-only" aria-hidden="true" />
      <div id="governance" className="sr-only" aria-hidden="true" />
      <div id="security" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-700" />
          <span>TRUST & GOVERNANCE</span>
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          INTELLIGENCE YOU CAN TRACE.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-12">
          Every metric and finding in ENERA links directly to verifiable data sources and transparent calculation logic.
        </p>

        {/* 4. Visual or capability: 4 Clean Principle Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_PRINCIPLES.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-cyan-300 hover:shadow-[0_4px_20px_-4px_rgba(6,182,212,0.12)] transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 mb-4 transition-transform duration-200 group-hover:scale-105 group-hover:border-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 font-sans mb-1">
                    {p.title}
                  </h3>

                  <p className="text-sm font-semibold text-cyan-800 font-sans mb-2.5">
                    {p.statement}
                  </p>

                  <p className="text-xs text-slate-600 font-sans leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Public Disclosure Model Matrix */}
        <div className="mt-14 pt-12 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 font-semibold mb-1">
                DATA GOVERNANCE STANDARD
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans tracking-tight">
                PUBLIC DISCLOSURE MODEL
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-sans max-w-md sm:text-right">
              A strict three-tier classification safeguarding enterprise security while ensuring clear operational visibility.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {DISCLOSURE_TIERS.map((tier) => {
              const Icon = tier.icon;
              return (
                <div
                  key={tier.level}
                  className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tier.iconClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 block tracking-wider">
                            {tier.level}
                          </span>
                          <span className="text-sm font-bold text-slate-900 font-sans">
                            {tier.name}
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${tier.badgeClass}`}>
                        {tier.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 font-sans mb-4 leading-relaxed">
                      {tier.summary}
                    </p>

                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold tracking-wider block">
                        Scope Definition:
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-600 font-sans">
                        {tier.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="text-cyan-600 shrink-0 mt-0.5 text-xs leading-none">•</span>
                            <span className="leading-tight">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Supporting information & CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <span>Verifiable source lineage linking findings directly to underlying utility and telemetry records.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-700 hover:text-cyan-800 transition-colors font-semibold focus-ring-enera shrink-0"
          >
            <span>REQUEST A DEMO</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
