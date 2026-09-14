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
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRODUCT_CAPABILITIES: ProductSignalCapability[] = [
  {
    title: "Billing Intelligence",
    description:
      "Immediate clarity on every line item across utility invoices, validated against official rate gazettes to eliminate hidden fees and calculation errors.",
    icon: Receipt,
  },
  {
    title: "Energy Reconciliation",
    description:
      "Side-by-side verification comparing stated utility charges against physical meter interval data to expose unearned charges before invoice payment.",
    icon: Scale,
  },
  {
    title: "Consumption Analysis",
    description:
      "Granular visibility into active energy usage across peak, standard, and off-peak periods to understand true operational cost drivers.",
    icon: TrendingUp,
  },
  {
    title: "Demand & Power Analysis",
    description:
      "Continuous tracking of peak kVA demand, power factor penalties, and capacity utilization to prevent costly ratchet surcharges.",
    icon: Zap,
  },
  {
    title: "Tariff Intelligence",
    description:
      "Accurate rate modeling for complex Eskom and municipal tariff schedules, ensuring correct seasonal pricing and statutory public holiday treatments.",
    icon: FileText,
  },
  {
    title: "Anomaly Detection",
    description:
      "Automated alerts for billing spikes, meter rollovers, missing intervals, and unannounced rate shifts requiring immediate finance team attention.",
    icon: AlertTriangle,
  },
  {
    title: "Multi-Site Visibility",
    description:
      "Unified executive overview of energy spend, consumption trends, and billing accuracy across your entire commercial or industrial property portfolio.",
    icon: Building2,
  },
  {
    title: "Reporting & Evidence",
    description:
      "Export-ready executive audit packs, discrepancy dossiers, and structured dispute documentation for seamless utility credit claims.",
    icon: FileSpreadsheet,
  },
];

export function EneraProductSignalsSection() {
  return (
    <section
      id="product-capabilities"
      className="py-20 sm:py-28 bg-[#030712] text-white border-t border-white/5 font-sans scroll-mt-12"
      aria-label="Product Capabilities"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          PRODUCT CAPABILITIES
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          ONE PLATFORM.<br />
          MULTIPLE ENERGY SIGNALS.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-12">
          Comprehensive energy financial visibility across your entire portfolio, delivering actionable clarity from raw utility and telemetry streams.
        </p>

        {/* 4. Visual or capability: 8 Clean, Compact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {PRODUCT_CAPABILITIES.map((capability) => {
            const Icon = capability.icon;
            return (
              <div
                key={capability.title}
                className="p-6 rounded-xl bg-[#080d1a] border border-white/10 hover:border-white/20 transition-colors flex flex-col justify-start"
              >
                {/* Small icon */}
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-cyan-400">
                  <Icon className="h-5 w-5" />
                </div>

                {/* Heading */}
                <h3 className="text-base font-bold text-white font-sans mb-2">
                  {capability.title}
                </h3>

                {/* Short explanation (maximum ~25 words, what the user gets) */}
                <p className="text-sm text-slate-400 font-sans leading-relaxed">
                  {capability.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* 5. Optional supporting information & 6. Optional CTA */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Designed for corporate treasury, facility directors, and energy management teams.</span>
          <a
            href="#solutions"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera shrink-0"
          >
            <span>Explore sector solutions</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
