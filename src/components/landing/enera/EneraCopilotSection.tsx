import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  ShieldCheck,
  Zap,
  TrendingUp,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface ExecutiveQuery {
  id: string;
  category: string;
  question: string;
  findingTitle: string;
  findingNarrative: string;
  exposure: string;
  exposureLabel: string;
  exposureType: "increase" | "recovery" | "savings";
  citation: string;
  telemetryEvidence: string;
  actionProtocol: string;
  dossierType: string;
}

const EXECUTIVE_QUERIES: ExecutiveQuery[] = [
  {
    id: "cost-drivers",
    category: "Cost Drivers",
    question: "Why did our electricity bill increase by 24% this month?",
    findingTitle: "Seasonal Tariff Transition + Unscheduled Demand Spike",
    findingNarrative:
      "High-season Megaflex tariffs took effect on 1 June (+58% peak energy rate adjustment). Concurrently, Site 04 recorded an unscheduled simultaneous maximum demand of 9,120 kVA during the evening peak window on 12 June.",
    exposure: "+R 184,300.00",
    exposureLabel: "Cost Driver Delta",
    exposureType: "increase",
    citation: "NERSA Schedule 2, Clause 8.4",
    telemetryEvidence: "2,880 AMR Half-Hour Registers",
    actionProtocol:
      "Deploy automated peak load-shifting protocol for 17:00–19:00 window. Lodge formal inquiry for transient 120 kVA spike caused by upstream sub-station switching.",
    dossierType: "Eskom Query Form 102",
  },
  {
    id: "site-diagnostics",
    category: "Site Diagnostics",
    question: "Which site has the highest demand variance against telemetry?",
    findingTitle: "Site 04 (Rustenburg Smelter Sub-Station)",
    findingNarrative:
      "Site 04 exhibits a 22.7% billed demand overstatement compared to physical AMR 30-minute interval telemetry. The utility billed 9,450 kVA against a verified revenue meter peak of 7,705 kVA.",
    exposure: "R 18,420.00 Overcharge",
    exposureLabel: "Recoverable Capital",
    exposureType: "recovery",
    citation: "Eskom NRS 048-4 / CT-400 Spec",
    telemetryEvidence: "Hardware Pulse Log Synchronised",
    actionProtocol:
      "Issue formal Section 21 demand dispute accompanied by raw half-hour interval logs and stamped meter calibration certificates.",
    dossierType: "Section 21 Demand Dispute",
  },
  {
    id: "audit-filter",
    category: "Audit Filter",
    question: "Show invoices with potential overcharges across Q2.",
    findingTitle: "3 Invoices Flagged Across Q2 (R 421,890 Recoverable)",
    findingNarrative:
      "Isolated 2 incorrect public holiday substitutions (Worker's Day and Youth Day billed at peak weekday rates instead of statutory Sunday off-peak rates) plus 1 meter multiplier misconfiguration following a CT ratio upgrade.",
    exposure: "R 421,890.00",
    exposureLabel: "Recoverable Overcharges",
    exposureType: "recovery",
    citation: "NERSA Tariff Book Rule 4.3",
    telemetryEvidence: "Revenue Check Meter Synchronised",
    actionProtocol:
      "Pre-assembled dispute dossier submitted with line-item credit note requisitions directly into Eskom Key Care executive channels.",
    dossierType: "Credit Note Requisition Dossier",
  },
  {
    id: "tariff-opt",
    category: "Tariff Optimization",
    question: "Which tariff structure would minimize our annual spend?",
    findingTitle: "Tariff Analysis: Megaflex vs Miniflex vs Nightsave",
    findingNarrative:
      "Due to your high baseline load factor (>78%) and on-site solar PV peak shaving between 11:00 and 15:00, remaining on Megaflex yields net annual savings compared to Miniflex despite higher fixed access charges.",
    exposure: "R 820,800.00 / yr",
    exposureLabel: "Modeled Optimization",
    exposureType: "savings",
    citation: "Eskom Schedule of Standard Prices",
    telemetryEvidence: "8,760 Annual Interval Models",
    actionProtocol:
      "Maintain current Megaflex transmission connection agreement. Evaluate BESS battery storage arbitrage for the 07:00 morning peak window.",
    dossierType: "Tariff Migration Evaluation",
  },
];

export function EneraCopilotSection() {
  const [selectedId, setSelectedId] = useState<string>("site-diagnostics");
  const current = EXECUTIVE_QUERIES.find((q) => q.id === selectedId) || EXECUTIVE_QUERIES[1];

  return (
    <section
      id="insights"
      className="relative py-24 sm:py-32 bg-[#05080f] text-white border-t border-white/10 overflow-hidden scroll-mt-12"
      aria-label="Executive Financial Intelligence Studio"
    >
      {/* Backwards-compatible anchor */}
      <div id="intelligence" className="sr-only" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          INSIGHTS
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          Ask your energy data.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-14">
          Plain-language inquiries synthesized by deterministic billing algorithms. Surface cost drivers, demand anomalies, and statutory tariff discrepancies with exact regulatory citations.
        </p>

        {/* 4. Visual or capability: Executive Query Studio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: Executive Query Selector (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-3 px-1">
              Frequent Executive Inquiries
            </span>

            {EXECUTIVE_QUERIES.map((query) => {
              const isSelected = query.id === selectedId;
              return (
                <button
                  key={query.id}
                  type="button"
                  onClick={() => setSelectedId(query.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all border block ${
                    isSelected
                      ? "bg-[#0c1424] border-cyan-500/50 shadow-sm"
                      : "bg-[#080d16] border-white/5 hover:border-white/15 hover:bg-[#0b101b]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-slate-300">
                      {query.category}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-semibold ${
                        query.exposureType === "recovery"
                          ? "text-emerald-400"
                          : query.exposureType === "savings"
                            ? "text-cyan-400"
                            : "text-amber-400"
                      }`}
                    >
                      {query.exposure}
                    </span>
                  </div>

                  <p
                    className={`text-sm font-sans leading-snug ${
                      isSelected ? "text-white font-medium" : "text-slate-300"
                    }`}
                  >
                    &ldquo;{query.question}&rdquo;
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right Column: Executive Synthesis Dossier (7 cols) */}
          <div className="lg:col-span-7 rounded-xl bg-[#090e18] border border-white/10 p-6 sm:p-8 space-y-6">
            {/* Header: Finding Title */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <span>DETERMINISTIC INTELLIGENCE SYNTHESIS</span>
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold">
                  Zero Hallucination Verified
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-semibold text-white font-sans leading-tight">
                {current.findingTitle}
              </h3>
            </div>

            {/* Narrative Body */}
            <div className="p-4 rounded-lg bg-black/40 border border-white/5 text-sm text-slate-300 leading-relaxed font-sans">
              {current.findingNarrative}
            </div>

            {/* 4 Quantitative Data Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-[#0b101c] border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  {current.exposureLabel}
                </span>
                <div
                  className={`text-lg sm:text-xl font-mono font-semibold mt-1 ${
                    current.exposureType === "recovery"
                      ? "text-emerald-400"
                      : current.exposureType === "savings"
                        ? "text-cyan-300"
                        : "text-amber-400"
                  }`}
                >
                  {current.exposure}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#0b101c] border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Regulatory Basis
                </span>
                <div className="text-sm font-mono font-semibold text-slate-200 mt-1 truncate">
                  {current.citation}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#0b101c] border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Telemetry Evidence
                </span>
                <div className="text-sm font-mono font-semibold text-slate-200 mt-1 truncate">
                  {current.telemetryEvidence}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#0b101c] border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Statutory Package
                </span>
                <div className="text-sm font-mono font-semibold text-cyan-300 mt-1 truncate">
                  {current.dossierType}
                </div>
              </div>
            </div>

            {/* Action Protocol */}
            <div className="p-4 rounded-lg bg-[#071318] border border-cyan-500/20 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-cyan-300 block mb-1">
                  Recommended Action Protocol
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {current.actionProtocol}
                </p>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-slate-400">
              <span>GROUNDED IN NERSA TARIFF GAZETTES & ACT 4 OF 2006</span>
              <Link
                to="/reconciliation"
                className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera"
              >
                <span>Launch in Live Client Portal</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
