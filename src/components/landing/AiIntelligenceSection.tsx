import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Bot,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  FileSearch,
  CheckCircle2,
  Lock,
} from "lucide-react";

interface AiQuery {
  id: string;
  question: string;
  category: string;
  response: {
    title: string;
    summary: string;
    keyFinding: string;
    variance: string;
    confidence: string;
    actionLabel: string;
  };
}

const AI_QUERIES: AiQuery[] = [
  {
    id: "increase",
    question: "Why did our electricity bill increase 18%?",
    category: "Cost Drivers",
    response: {
      title: "Root Cause: High-Season Seasonal Transition & Peak Demand Exceedance",
      summary:
        "The 18.2% increase is driven by two isolated factors: 1) The transition to NERSA High-Season rates on June 1 (+140% peak rate differential), and 2) A 340 kVA unnotified demand exceedance on Feeder 02 during a production start sequence.",
      keyFinding: "Seasonal shift accounts for R 112,400; unnotified demand penalty accounts for R 18,450.",
      variance: "R 130,850.00 Total Increase",
      confidence: "96.4%",
      actionLabel: "Inspect June Seasonal Transition Audit",
    },
  },
  {
    id: "demand",
    question: "Which sites have unusual demand?",
    category: "Demand Anomalies",
    response: {
      title: "Site 04 (Rustenburg Smelter) Demand Spike Outlier",
      summary:
        "Site 04 experienced a 22.7% increase in billed demand (8,421 kVA vs 6,860 kVA 12-month rolling average). Interval telemetry indicates peak demand occurred during a 1-hour load-shedding curtailment window.",
      keyFinding: "Utility billed on full curtailment spike instead of contractually agreed average.",
      variance: "R 37,840.00 Overcharge Risk",
      confidence: "94.0%",
      actionLabel: "Generate Curtailment Dispute Pack",
    },
  },
  {
    id: "overcharges",
    question: "Which invoices contain possible overcharges?",
    category: "Financial Leakage",
    response: {
      title: "3 Invoices Identified with Defensible Billing Overcharges",
      summary:
        "Automated cross-check detected 3 invoices with discrepancies above tolerance: #785101497007 (Rate misapplication: R 51,227), #785762166034 (Demand ratchet dispute: R 42,100), and #785684906677 (Rural subsidy error: R 18,920).",
      keyFinding: "Total recoverable capital across 3 active invoices: R 112,247.00.",
      variance: "R 112,247.00 Total Recoverable",
      confidence: "98.2%",
      actionLabel: "View Consolidated Claims Ledger",
    },
  },
  {
    id: "tariff-opt",
    question: "Which tariff would have produced the lowest cost?",
    category: "Tariff Optimization",
    response: {
      title: "Optimization Simulator: Miniflex vs Megaflex Comparative Run",
      summary:
        "Based on the site's load factor of 78.4% and high off-peak ratio (47.5%), Megaflex remains optimal. However, shifting 12% of peak crushing operations to standard hours would reduce annual expenditure by R 480,000.",
      keyFinding: "Current tariff structure is mathematically correct; operational shift yields 5.8% savings.",
      variance: "R 480,000.00 Annual Opportunity",
      confidence: "91.5%",
      actionLabel: "Run Full Tariff Simulation Engine",
    },
  },
  {
    id: "anomalies",
    question: "Show me all anomalies above R10,000.",
    category: "Threshold Filter",
    response: {
      title: "4 High-Severity Financial Anomalies Isolated",
      summary:
        "Four anomalies exceed the R 10,000 material materiality threshold: 1) Peak Energy Rate misclassification (R 51,227), 2) NMD Demand Ratchet Exceedance (R 37,840), 3) Reactive Power Penalty PF 0.91 (R 18,450), 4) Unnotified Surcharge (R 12,200).",
      keyFinding: "All 4 anomalies have complete 12-node evidence chains prepared.",
      variance: "R 119,717.00 High Severity Sum",
      confidence: "97.5%",
      actionLabel: "Open Anomaly Diagnostic Dashboard",
    },
  },
];

export function AiIntelligenceSection() {
  const [selectedId, setSelectedId] = useState<string>("demand");

  const current = AI_QUERIES.find((q) => q.id === selectedId) || AI_QUERIES[1];

  return (
    <section id="intelligence" className="py-20 md:py-32 bg-card/10 border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Energy Assistant</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Don&apos;t Wait for the Error. Let AI Find It.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Ask natural language questions about your energy bills, tariffs, and consumption.
          </p>
        </div>

        {/* Interactive Query Console */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Query Prompts List (5 cols) */}
          <div className="lg:col-span-5 space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider px-1 pb-1">
              Select Sample Inquiry:
            </div>
            {AI_QUERIES.map((q) => {
              const isSelected = selectedId === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                      : "border-border/60 bg-card/60 hover:bg-card/90 hover:border-border"
                  }`}
                >
                  <div className="space-y-0.5 pr-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      {q.category}
                    </span>
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {q.question}
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* AI Response Card (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-foreground">
                      ESKOM RECONCILER AI
                    </span>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      Ground truth backed by NERSA gazettes & telemetry
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    CONFIDENCE {current.response.confidence}
                  </span>
                </div>
              </div>

              {/* Title & Summary */}
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-foreground">
                  {current.response.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {current.response.summary}
                </p>
              </div>

              {/* Key Finding Card */}
              <div className="p-4 rounded-xl bg-background/80 border border-border/60 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Executive Finding
                </div>
                <div className="text-xs text-foreground font-medium">
                  {current.response.keyFinding}
                </div>
              </div>

              {/* Impact & Action */}
              <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Financial Impact
                  </div>
                  <div className="text-base font-mono font-bold text-amber-400">
                    {current.response.variance}
                  </div>
                </div>

                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                >
                  <span>Investigate in Platform</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
