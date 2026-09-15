import React from "react";
import {
  Receipt,
  Scale,
  TrendingUp,
  Zap,
  FileText,
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";

interface ProductSignalCapability {
  category: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRODUCT_CAPABILITIES: ProductSignalCapability[] = [
  {
    category: "BILLING",
    title: "Verify every bill.",
    description:
      "Check utility invoice line items against official tariffs to catch calculation errors and hidden charges.",
    icon: Receipt,
  },
  {
    category: "ENERGY",
    title: "Understand your energy.",
    description:
      "See active consumption across peak, standard, and off-peak periods to know what drives your costs.",
    icon: TrendingUp,
  },
  {
    category: "TARIFF",
    title: "Apply the right rates.",
    description:
      "Ensure correct seasonal pricing, time-of-use schedules, and public holiday rules on every bill.",
    icon: FileText,
  },
  {
    category: "DEMAND",
    title: "Control peak demand.",
    description:
      "Track peak kVA and power factor in real time to prevent avoidable penalty surcharges.",
    icon: Zap,
  },
  {
    category: "ANOMALY",
    title: "Spot what needs attention.",
    description:
      "Get immediate notice when usage spikes, meters drop intervals, or rate schedules shift unexpectedly.",
    icon: AlertTriangle,
  },
  {
    category: "REPORTING",
    title: "Back every claim.",
    description:
      "Generate structured dispute dossiers and audit packs ready for utility credit recovery.",
    icon: FileSpreadsheet,
  },
  {
    category: "MULTI-SITE",
    title: "Track all your sites.",
    description:
      "Monitor energy spend and billing accuracy across your entire property and facility portfolio.",
    icon: Building2,
  },
];

export function EneraProductSignalsSection() {
  return (
    <section
      id="platform-capabilities"
      className="py-20 sm:py-24 bg-white text-slate-900 border-t border-slate-200/80 font-sans scroll-mt-12"
      aria-label="Platform Capabilities"
    >
      {/* Backwards-compatible anchors */}
      <div id="product-capabilities" className="sr-only" aria-hidden="true" />
      <div id="products" className="sr-only" aria-hidden="true" />
      <div id="capabilities" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold">
          PLATFORM CAPABILITIES
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          ONE PLATFORM.<br />
          MULTIPLE ENERGY SIGNALS.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-12">
          Bring your utility bills and interval meter data together. See what changed, verify every charge, and make confident operational and financial decisions.
        </p>

        {/* 4. Visual or capability: 7 Clean, Compact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
          {PRODUCT_CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            return (
              <div
                key={capability.category}
                className="p-6 rounded-xl bg-slate-50 border border-slate-200 shadow-sm hover:border-cyan-300 hover:shadow-[0_4px_20px_-4px_rgba(6,182,212,0.12)] transition-all duration-300 flex flex-col justify-start group"
              >
                {/* Header with Icon and Category Tag */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 transition-transform duration-200 group-hover:scale-105 group-hover:border-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-700 uppercase bg-cyan-50/60 px-2 py-0.5 rounded border border-cyan-100">
                    {capability.category}
                  </span>
                </div>

                {/* Heading */}
                <h3 className="text-base font-bold text-slate-900 font-sans mb-2">
                  {capability.title}
                </h3>

                {/* Short explanation (maximum ~25 words, what the user gets) */}
                <p className="text-sm text-slate-600 font-sans leading-relaxed">
                  {capability.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* 5. Supporting information & 6. Clean Progressive CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-600">
          <span>Deterministic analysis grounded in revenue-grade interval telemetry and official NERSA schedules.</span>
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
