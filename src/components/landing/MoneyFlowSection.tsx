import { useState } from "react";
import {
  FileText,
  Database,
  Receipt,
  Activity,
  Scale,
  AlertTriangle,
  BadgeDollarSign,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface FlowNode {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  bgColor: string;
  badge: string;
  explanation: {
    headline: string;
    points: string[];
    technicalDetail: string;
  };
}

export function MoneyFlowSection() {
  const [selectedNode, setSelectedNode] = useState<string>("RECONCILIATION");

  const nodes: FlowNode[] = [
    {
      id: "INVOICE",
      step: "01",
      title: "UTILITY BILL",
      subtitle: "PDF / Scanned Bill",
      icon: FileText,
      color: "text-blue-400",
      borderColor: "border-blue-500/40",
      bgColor: "bg-blue-500/10",
      badge: "Ingestion",
      explanation: {
        headline: "Every charge extracted. Every determinant captured. Nothing hidden in the PDF.",
        points: [
          "14 distinct billing determinants extracted via optical & text parsers",
          "Sub-account, meter numbers, premise identifiers verified",
          "Account period & gazetted calendar cross-referenced",
        ],
        technicalDetail: "Deterministic extraction confidence: 100% on native PDFs, >95% on scans.",
      },
    },
    {
      id: "DATA",
      step: "02",
      title: "DATA",
      subtitle: "Telemetry Cleanse",
      icon: Database,
      color: "text-cyan-400",
      borderColor: "border-cyan-500/40",
      bgColor: "bg-cyan-500/10",
      badge: "Normalization",
      explanation: {
        headline: "High-frequency telemetry intervals normalized and SAST clock synchronized.",
        points: [
          "Conversion of active power (kW) to energy (kWh) at 30-min integration",
          "Detection of missing intervals, duplicated timestamps, or negative jumps",
          "Non-destructive quarantine ledger for anomalous intervals",
        ],
        technicalDetail: "Throughput: 75,000 intervals/sec benchmarked across multi-site streams.",
      },
    },
    {
      id: "TARIFF",
      step: "03",
      title: "TARIFF",
      subtitle: "Gazetted NERSA",
      icon: Receipt,
      color: "text-indigo-400",
      borderColor: "border-indigo-500/40",
      bgColor: "bg-indigo-500/10",
      badge: "Regulation",
      explanation: {
        headline: "Verify the rate structure, TOU periods, demand charges and applicable tariff.",
        points: [
          "Official NERSA approved Megaflex, Miniflex, Nightsave schedules",
          "High season (Jun-Aug) vs Low season (Sep-May) day-weighted boundaries",
          "Public holiday substitution rules (5 Sunday holidays, remainder Saturday)",
        ],
        technicalDetail: "Full versioned tariff database (2025/26 & 2026/27 pro-rata transitions).",
      },
    },
    {
      id: "METER",
      step: "04",
      title: "METER",
      subtitle: "AMR Telemetry",
      icon: Activity,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/40",
      bgColor: "bg-emerald-500/10",
      badge: "Ground Truth",
      explanation: {
        headline: "Compare billed consumption against independent meter / AMR data.",
        points: [
          "Primary check meter vs utility revenue meter reconciliation",
          "Power factor (PF = 0.96) conversion: kW to kVA and kWh to kVAh",
          "Simultaneous maximum demand timestamp isolation",
        ],
        technicalDetail: "Direct integration with MV90, CSV interval feeds, and IoT gateways.",
      },
    },
    {
      id: "RECONCILIATION",
      step: "05",
      title: "RECONCILIATION",
      subtitle: "Statutory Audit",
      icon: Scale,
      color: "text-purple-400",
      borderColor: "border-purple-500/40",
      bgColor: "bg-purple-500/10",
      badge: "Financial Engine",
      explanation: {
        headline: "Determine exactly where billed and actual values diverge.",
        points: [
          "Capacity charges verified against Notified Maximum Demand (NMD)",
          "Active energy charges verified across Peak, Standard, and Off-Peak",
          "Subsidies (Ancillary, Legacy, Affordability, Electrification) independently computed",
        ],
        technicalDetail: "Arbitrary-precision Decimal.js-light arithmetic (zero floating-point drift).",
      },
    },
    {
      id: "ANOMALY",
      step: "06",
      title: "ANOMALY",
      subtitle: "Root-Cause Triage",
      icon: AlertTriangle,
      color: "text-amber-400",
      borderColor: "border-amber-500/40",
      bgColor: "bg-amber-500/10",
      badge: "Detection",
      explanation: {
        headline: "Isolate rate spikes, demand exceedances, and unapproved tariff changes.",
        points: [
          "12 standardized discrepancy diagnostic codes",
          "Distinction between utility overcharge vs client operational spike",
          "Ratcheted demand exposure and penalty fee forecasting",
        ],
        technicalDetail: "Root-cause inference engine maps variances directly to NERSA clauses.",
      },
    },
    {
      id: "RECOVERY",
      step: "07",
      title: "RECOVERY",
      subtitle: "Dispute & Credits",
      icon: BadgeDollarSign,
      color: "text-emerald-300",
      borderColor: "border-emerald-500/40",
      bgColor: "bg-emerald-500/10",
      badge: "Settlement",
      explanation: {
        headline: "Quantify the financial impact and produce evidence.",
        points: [
          "Cryptographically hashed 12-node audit trail pack",
          "Automated PDF & XLSX dispute dossiers for Eskom / Municipal revenue offices",
          "Tracking of credited adjustments and billing corrections",
        ],
        technicalDetail: "Complete evidence package accepted in commercial dispute proceedings.",
      },
    },
  ];

  const current = nodes.find((n) => n.id === selectedNode) || nodes[4];

  return (
    <section id="flow" className="py-20 md:py-32 bg-card/10 border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>The End-to-End Pipeline</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Follow the Money.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Click each stage to explore how data streams from raw PDF invoice to recovered cash.
          </p>
        </div>

        {/* Horizontal Pipeline Navigation Nodes */}
        <div className="relative">
          {/* Connecting Line */}
          <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-0.5 bg-gradient-to-r from-blue-500/20 via-primary/30 to-emerald-500/20 -translate-y-1/2 z-0" />

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 relative z-10">
            {nodes.map((node) => {
              const isSelected = selectedNode === node.id;
              const Icon = node.icon;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`p-3 sm:p-4 rounded-xl border text-left transition-all duration-300 flex flex-col justify-between space-y-3 group ${
                    isSelected
                      ? `${node.borderColor} ${node.bgColor} ring-2 ring-primary/40 shadow-lg shadow-black/30 scale-[1.02]`
                      : "border-border/60 bg-card/60 hover:bg-card/90 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono font-bold text-muted-foreground">
                      {node.step}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                        isSelected ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground"
                      }`}
                    >
                      {node.badge}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md bg-background/60 ${node.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-xs font-bold text-foreground truncate">
                        {node.title}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {node.subtitle}
                    </div>
                  </div>

                  <div
                    className={`h-1 w-full rounded-full transition-all ${
                      isSelected ? "bg-primary" : "bg-transparent group-hover:bg-muted"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Detail Card for Selected Node */}
        <div className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-md p-6 sm:p-8 shadow-xl max-w-4xl mx-auto space-y-5 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${current.bgColor} ${current.borderColor} border`}>
                <current.icon className={`h-6 w-6 ${current.color}`} />
              </div>
              <div>
                <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
                  STAGE {current.step} — {current.badge}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  {current.title}: {current.subtitle}
                </h3>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">
              AUDITED COMPONENT
            </span>
          </div>

          <div className="space-y-3">
            <h4 className="text-base sm:text-lg font-semibold text-foreground">
              {current.explanation.headline}
            </h4>

            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
              {current.explanation.points.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground font-mono">
            <div>
              <strong className="text-foreground">Technical Specification:</strong>{" "}
              {current.explanation.technicalDetail}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
