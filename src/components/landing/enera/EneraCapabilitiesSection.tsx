import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Scale,
  BarChart3,
  AlertTriangle,
  Eye,
  Sliders,
  Activity,
  FileText,
  Building2,
  TrendingUp,
  Bot,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { EnginePhaseTag } from "./EneraBrandPrimitives";

export interface CapabilityItem {
  id: string;
  name: string;
  category: "financial" | "operational" | "strategic";
  categoryLabel: string;
  tagline: string;
  description: string;
  executiveOutcome: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badgeColor: string;
  linkTo?: string;
  externalAnchor?: string;
}

export const LEVEL_1_CAPABILITIES: CapabilityItem[] = [
  {
    id: "invoice-reconciliation",
    name: "Invoice Reconciliation",
    category: "financial",
    categoryLabel: "FINANCIAL GOVERNANCE",
    tagline: "Deterministic Line-Item Verification",
    description:
      "ENERA compares relevant billing and consumption information to identify material differences and eliminate unearned utility charges.",
    executiveOutcome: "Recovers 3% to 7% of unearned energy spend before invoice settlement",
    icon: Scale,
    accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
    badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-950/40",
    linkTo: "/reconciliation",
  },
  {
    id: "energy-analytics",
    name: "Energy Analytics",
    category: "operational",
    categoryLabel: "OPERATIONAL INTELLIGENCE",
    tagline: "Multi-Vector Load Visibility",
    description:
      "Continuous analytical intelligence across active power, apparent demand, reactive draw, and seasonal load curves to optimize enterprise capacity utilization.",
    executiveOutcome: "Identifies demand spikes and capacity bottlenecks across all operating shifts",
    icon: BarChart3,
    accentColor: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    badgeColor: "text-emerald-400 border-emerald-500/30 bg-emerald-950/40",
    externalAnchor: "#topology",
  },
  {
    id: "anomaly-identification",
    name: "Anomaly Identification",
    category: "financial",
    categoryLabel: "FINANCIAL GOVERNANCE",
    tagline: "Autonomous Variance Isolation",
    description:
      "ENERA analyses billing and consumption signals to surface unusual patterns and potential discrepancies across tariffs, public holidays, and seasonal boundaries.",
    executiveOutcome: "Prevents silent monthly balance sheet leakage and compound utility overcharges",
    icon: AlertTriangle,
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
    badgeColor: "text-amber-400 border-amber-500/30 bg-amber-950/40",
    externalAnchor: "#reconciliation",
  },
  {
    id: "billing-visibility",
    name: "Billing Visibility",
    category: "financial",
    categoryLabel: "FINANCIAL GOVERNANCE",
    tagline: "Deterministic Cost Transparency",
    description:
      "Deconstructs opaque utility bills into clean, auditable financial determinants: energy charges, maximum demand, network access, and statutory environmental levies.",
    executiveOutcome: "Gives CFOs and Treasury complete transparency into every electricity line item",
    icon: Eye,
    accentColor: "from-sky-500/20 via-sky-500/5 to-transparent",
    badgeColor: "text-sky-400 border-sky-500/30 bg-sky-950/40",
    externalAnchor: "#signal",
  },
  {
    id: "tariff-intelligence",
    name: "Tariff Intelligence",
    category: "strategic",
    categoryLabel: "REGULATORY & STRATEGIC",
    tagline: "Gazetted Rate Governance",
    description:
      "Real-time benchmarking against official NERSA gazettes, Eskom Megaflex, Miniflex, Nightsave, and municipal supply schedules to ensure optimal tariff selection.",
    executiveOutcome: "Validates rate legality and models savings on alternative authorized structures",
    icon: Sliders,
    accentColor: "from-purple-500/20 via-purple-500/5 to-transparent",
    badgeColor: "text-purple-400 border-purple-500/30 bg-purple-950/40",
    linkTo: "/tariff",
  },
  {
    id: "consumption-analysis",
    name: "Consumption Analysis",
    category: "operational",
    categoryLabel: "OPERATIONAL INTELLIGENCE",
    tagline: "30-Minute Interval Ground Truth",
    description:
      "High-resolution evaluation of half-hourly AMR data loggers, synchronizing physical power delivery with production schedules to curb peak-period energy exposure.",
    executiveOutcome: "Pinpoints high-cost Time-of-Use consumption to enable peak shaving",
    icon: Activity,
    accentColor: "from-teal-500/20 via-teal-500/5 to-transparent",
    badgeColor: "text-teal-400 border-teal-500/30 bg-teal-950/40",
    linkTo: "/telemetry",
  },
  {
    id: "reporting",
    name: "Reporting",
    category: "strategic",
    categoryLabel: "REGULATORY & STRATEGIC",
    tagline: "Audit-Ready Evidence Packages",
    description:
      "Automated compilation of formal utility dispute dossiers, CFO board decks, ESG greenhouse compliance schedules, and PFMA/Tax Administration Act audit packs.",
    executiveOutcome: "Arm legal and treasury teams with substantive proof for swift credit claims",
    icon: FileText,
    accentColor: "from-blue-500/20 via-blue-500/5 to-transparent",
    badgeColor: "text-blue-400 border-blue-500/30 bg-blue-950/40",
    linkTo: "/reports",
  },
  {
    id: "multi-site-visibility",
    name: "Multi-Site Visibility",
    category: "strategic",
    categoryLabel: "REGULATORY & STRATEGIC",
    tagline: "Consolidated Portfolio Governance",
    description:
      "Unified enterprise oversight across multiple industrial plants, retail centers, mining shafts, and municipal connections under a single financial pane of glass.",
    executiveOutcome: "Normalizes disparate regional municipal tariffs across national operations",
    icon: Building2,
    accentColor: "from-indigo-500/20 via-indigo-500/5 to-transparent",
    badgeColor: "text-indigo-400 border-indigo-500/30 bg-indigo-950/40",
    linkTo: "/dashboard",
  },
  {
    id: "financial-insight",
    name: "Financial Insight",
    category: "financial",
    categoryLabel: "FINANCIAL GOVERNANCE",
    tagline: "Balance Sheet Capital Recovery",
    description:
      "Quantifies recoverable capital, tracks utility credit note approvals, forecasts future energy liability, and models power factor mitigation capital investments.",
    executiveOutcome: "Directly improves EBITDA by eliminating unjustified operational overhead",
    icon: TrendingUp,
    accentColor: "from-rose-500/20 via-rose-500/5 to-transparent",
    badgeColor: "text-rose-400 border-rose-500/30 bg-rose-950/40",
    externalAnchor: "#impact",
  },
  {
    id: "ai-assisted-analysis",
    name: "AI-Assisted Analysis",
    category: "operational",
    categoryLabel: "OPERATIONAL INTELLIGENCE",
    tagline: "Autonomous Natural Language Copilot",
    description:
      "AI-assisted analysis helps users investigate complex energy information faster, answering high-impact financial questions and evaluating tariffs in seconds.",
    executiveOutcome: "Reduces complex multi-week engineering billing reviews to immediate answers",
    icon: Bot,
    accentColor: "from-cyan-400/20 via-emerald-500/5 to-transparent",
    badgeColor: "text-cyan-300 border-cyan-400/30 bg-cyan-950/40",
    externalAnchor: "#intelligence",
  },
];

export function EneraCapabilitiesSection() {
  const [activeFilter, setActiveFilter] = useState<"all" | "financial" | "operational" | "strategic">("all");

  const filteredCapabilities =
    activeFilter === "all"
      ? LEVEL_1_CAPABILITIES
      : LEVEL_1_CAPABILITIES.filter((c) => c.category === activeFilter);

  return (
    <section
      id="capabilities"
      className="relative py-24 sm:py-32 bg-[#02050e] text-white border-t border-white/5 overflow-hidden font-sans"
      aria-label="Core Enterprise Capabilities"
    >
      {/* Subtle Background Glows */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-cyan-500/5 rounded-full blur-[160px] pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[11px] font-mono font-semibold text-cyan-300 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
            <span>LEVEL 1 — PUBLIC CAPABILITIES MATRIX</span>
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight enera-text-gradient leading-tight">
            TEN PILLARS OF
            <br />
            ENERGY FINANCIAL INTELLIGENCE.
          </h2>

          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-300 font-light max-w-2xl mx-auto leading-relaxed">
            From deterministic line-item invoice reconciliation to autonomous tariff intelligence —
            built for institutional C-suite governance.
          </p>

          {/* Interactive Category Filter */}
          <div
            role="tablist"
            aria-label="Filter capabilities by category"
            className="mt-8 inline-flex max-w-full overflow-x-auto scrollbar-none items-center p-1 rounded-xl bg-[#0d1117]/80 border border-white/10 backdrop-blur-md"
          >
            {[
              { id: "all", label: "All Capabilities (10)" },
              { id: "financial", label: "Financial Governance" },
              { id: "operational", label: "Operational Intelligence" },
              { id: "strategic", label: "Regulatory & Strategic" },
            ].map((tab) => {
              const isSelected = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
                  className={`px-3 sm:px-4 py-1.5 text-xs font-mono rounded-lg transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isSelected
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 10 Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {filteredCapabilities.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="group relative rounded-3xl bg-[#0d1117]/90 border border-white/10 p-6 sm:p-7 flex flex-col justify-between hover:border-cyan-500/40 transition-all duration-300 shadow-xl backdrop-blur-sm overflow-hidden"
              >
                {/* Dynamic Gradient Corner Accent */}
                <div
                  className={`absolute top-0 right-0 w-44 h-44 bg-gradient-to-br ${item.accentColor} rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500`}
                  aria-hidden="true"
                />

                <div className="relative z-10 space-y-4">
                  {/* Top Bar: Icon + Category Badge */}
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:border-cyan-400/50 group-hover:bg-cyan-950/40 transition-colors shadow-inner">
                      <Icon className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}
                    >
                      {item.categoryLabel}
                    </span>
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-cyan-200 transition-colors font-sans">
                      {item.name}
                    </h3>
                    <div className="text-xs font-mono text-cyan-400/90 font-medium mt-0.5">
                      {item.tagline}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Bottom Bar: Executive Outcome */}
                <div className="relative z-10 pt-4 mt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-start gap-2 text-xs font-sans text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.executiveOutcome}</span>
                  </div>

                  {/* Link or Action Indicator */}
                  <div className="flex items-center justify-end pt-1">
                    {item.linkTo ? (
                      <Link
                        to={item.linkTo}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors group-hover:translate-x-0.5"
                      >
                        <span>Access Feature</span>
                        <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                      </Link>
                    ) : item.externalAnchor ? (
                      <a
                        href={item.externalAnchor}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors group-hover:translate-x-0.5"
                      >
                        <span>Explore Workflow</span>
                        <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Level 1 Disclosure Assurance Footer Strip */}
        <div className="mt-14 p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-semibold">
              SAFE MARKETING CLASSIFICATION · ZERO PROPRIETARY LEAKS
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-400">
              Need technical or API integration details?
            </span>
            <Link
              to="/upload"
              className="text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4"
            >
              Analyse a Sample Bill &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
