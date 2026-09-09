import React, { useState } from "react";
import { Sparkles, Terminal, ArrowRight, CornerDownRight, Check, Bot } from "lucide-react";

interface AiQuery {
  question: string;
  category: string;
  response: {
    title: string;
    body: string;
    variance: string;
    confidence: string;
    action: string;
  };
}

const QUERIES: AiQuery[] = [
  {
    question: "Why did our electricity bill increase by 24% this month?",
    category: "Cost Drivers",
    response: {
      title: "Tariff Season Transition + Notified Demand Spike",
      body: "High-season Megaflex tariffs took effect on June 1 (+58% peak rate adjustment). Additionally, Site 04 recorded an unscheduled simultaneous maximum demand of 9,120 kVA during peak hours on June 12.",
      variance: "R 184,300 increase",
      confidence: "98.4%",
      action: "Load shifting protocol recommended for 17:00–19:00 peak hours.",
    },
  },
  {
    question: "Which site has the highest demand variance?",
    category: "Site Diagnostics",
    response: {
      title: "Site 04 (Rustenburg Processing)",
      body: "Site 04 shows a 22.7% increase in billed demand compared with AMR interval telemetry. Historical consumption does not support this billed capacity value.",
      variance: "R 18,420 potential overcharge",
      confidence: "94.0%",
      action: "Issue formal Section 21 Eskom billing query with interval log proof.",
    },
  },
  {
    question: "Show invoices with potential overcharges.",
    category: "Audit Filter",
    response: {
      title: "3 Invoices Flagged Across Q2",
      body: "Found 2 incorrect public holiday substitutions (Worker's Day and Youth Day billed at weekday rates) and 1 meter multiplier misconfiguration following CT ratio upgrade.",
      variance: "R 421,890 total recoverable",
      confidence: "99.1%",
      action: "Dispute dossier exported with 12-node cryptographic evidence chain.",
    },
  },
  {
    question: "Which tariff would have reduced our overall cost?",
    category: "Tariff Optimization",
    response: {
      title: "Miniflex vs Megaflex Comparative Analysis",
      body: "Due to your high load factor (>78%) and solar self-generation peak shaving between 11:00 and 15:00, staying on Megaflex saves R 68,000/month compared to standard Miniflex.",
      variance: "Optimal tariff confirmed",
      confidence: "96.5%",
      action: "Maintain current Megaflex transmission connection agreement.",
    },
  },
  {
    question: "Find all anomalies above R10,000.",
    category: "Threshold Anomaly",
    response: {
      title: "4 High-Impact Anomalies Isolated",
      body: "1. Peak demand mismatch at Durban plant (R 46,176). 2. Power factor penalty miscalculation (R 28,757). 3. Mid-month rate transition pro-rata calculation error (R 18,420). 4. Unbilled ancillary service charge dispute (R 12,300).",
      variance: "R 105,653 net impact",
      confidence: "97.2%",
      action: "All 4 claims auto-formatted into NERSA regulatory dispute templates.",
    },
  },
];

export function EneraCopilotSection() {
  const [selectedIdx, setSelectedIdx] = useState<number>(1); // Default to Site 04 query

  const cur = QUERIES[selectedIdx];

  return (
    <section id="intelligence" className="relative py-28 bg-[#030712] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-4">
            <Sparkles className="h-3 w-3 animate-pulse" />
            <span>AI COPILOT COGNITION</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            ASK YOUR ENERGY DATA.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light">
            No complex SQL or manual spreadsheet pivot tables. Query your enterprise utility billing
            dataset in plain English.
          </p>
        </div>

        {/* Console Container */}
        <div className="mt-14 max-w-5xl mx-auto rounded-2xl bg-[#0d1117] border border-white/10 shadow-[0_0_60px_-15px_rgba(6,182,212,0.15)] overflow-hidden">
          {/* Terminal Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-mono text-slate-400">
                enera-intelligence-core // copilot-v2.0
              </span>
            </div>

            <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              <span>ONLINE · GROUNDED IN NERSA TARIFFS</span>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Suggested Natural Language Questions */}
            <div className="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-white/10 space-y-2 bg-black/20">
              <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block px-2 mb-3">
                FREQUENT EXECUTIVE QUERIES
              </span>

              {QUERIES.map((q, idx) => {
                const isSelected = selectedIdx === idx;
                return (
                  <button
                    key={q.question}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full text-left p-3 rounded-xl text-xs transition-all flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 font-medium"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <CornerDownRight className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
                      <span>&ldquo;{q.question}&rdquo;</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right: AI Intelligence Output Card */}
            <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase text-cyan-400 font-bold tracking-wider">
                      AI INSIGHT REPORT
                    </span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                    {cur.response.confidence} CONFIDENCE
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <h3 className="text-lg sm:text-xl font-bold text-white font-mono">
                    {cur.response.title}
                  </h3>

                  <p className="text-sm text-slate-300 leading-relaxed font-sans">
                    {cur.response.body}
                  </p>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase">
                        FINANCIAL VARIANCE
                      </span>
                      <div className="text-base font-bold font-mono text-cyan-200 mt-1">
                        {cur.response.variance}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                      <span className="text-[10px] font-mono text-emerald-400 uppercase">
                        AI CONFIDENCE SCORE
                      </span>
                      <div className="text-base font-bold font-mono text-emerald-300 mt-1">
                        {cur.response.confidence}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#161b22] border border-white/10 text-xs text-slate-300 flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 font-mono text-[10px] uppercase block">
                        RECOMMENDED ACTION
                      </span>
                      <span>{cur.response.action}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>MODEL: ENERA-RECON-V2</span>
                <span className="text-cyan-400">LATENCY: 42ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
