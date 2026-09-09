import {
  Activity,
  DollarSign,
  Wrench,
  Scale,
  Building2,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

interface PersonaCard {
  role: string;
  headline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  deliverable: string;
}

const PERSONAS: PersonaCard[] = [
  {
    role: "ENERGY MANAGERS",
    headline: "Know where consumption and cost are moving.",
    description:
      "Monitor Peak, Standard, and Off-Peak distribution in real-time. Detect power factor dips and unnotified maximum demand spikes before utility penalties trigger.",
    icon: Activity,
    deliverable: "Interval load factor & TOU optimization analytics",
  },
  {
    role: "FINANCE TEAMS",
    headline: "Validate utility expenditure before it hits the books.",
    description:
      "Eliminate manual invoice verification spreadsheets. Automatically reconcile utility billing against independent meters and ensure payments reflect true contracted NERSA rates.",
    icon: DollarSign,
    deliverable: "Pre-payment reconciliation & credit memo tracking",
  },
  {
    role: "FACILITIES & OPERATIONS",
    headline: "Detect abnormal usage and operational issues.",
    description:
      "Pinpoint sudden baseload shifts, equipment malfunction surges, and curtailment misclassifications with sub-hourly interval granularity.",
    icon: Wrench,
    deliverable: "Root-cause equipment anomaly alerts",
  },
  {
    role: "INTERNAL & EXTERNAL AUDITORS",
    headline: "Build an evidence-backed reconciliation trail.",
    description:
      "Generate complete 12-node audit chains proving calculation lineage from source PDF tokens to bank payments with zero floating-point error.",
    icon: Scale,
    deliverable: "Cryptographic dispute dossiers & NERSA compliance packs",
  },
  {
    role: "PROPERTY & REIT PORTFOLIOS",
    headline: "Compare energy performance across every site.",
    description:
      "Benchmark utility costs across multi-province commercial real estate, industrial parks, and retail centers with unified regional tariff models.",
    icon: Building2,
    deliverable: "Portfolio benchmarking & tenant recovery statements",
  },
  {
    role: "C-SUITE EXECUTIVES",
    headline: "See the financial impact in seconds.",
    description:
      "Executive visibility into utility expenditure, active billing disputes, and verified capital recovery opportunities on a consolidated dashboard.",
    icon: TrendingUp,
    deliverable: "Executive energy ROI & recovery command centre",
  },
];

export function UseCasesSection() {
  return (
    <section id="use-cases" className="py-20 md:py-32 bg-background border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <span>Tailored Solutions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Engineered for Every Stakeholder
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            From technical engineering teams to the CFO office, unified utility intelligence empowers every decision.
          </p>
        </div>

        {/* 6 Personas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PERSONAS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.role}
                className="p-6 rounded-2xl border border-border/70 bg-card/60 hover:bg-card/95 hover:border-primary/50 transition-all duration-300 space-y-4 shadow-sm group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-primary uppercase">
                      {item.role}
                    </span>
                    <div className="p-2 rounded-xl bg-background border border-border text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                    {item.headline}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                  <strong className="text-foreground">Core Deliverable:</strong>{" "}
                  {item.deliverable}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
