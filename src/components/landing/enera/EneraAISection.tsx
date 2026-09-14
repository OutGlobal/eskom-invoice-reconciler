import React, { useState } from "react";
import {
  HelpCircle,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Search,
  Building2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface AIQuestionOutcome {
  id: string;
  question: string;
  category: string;
  outcomeTitle: string;
  outcomeDescription: string;
  keyDeliverable: string;
  icon: React.ComponentType<{ className?: string }>;
}

const QUESTION_OUTCOMES: AIQuestionOutcome[] = [
  {
    id: "cost-change",
    question: "Why did this site's energy cost change?",
    category: "Cost Drivers",
    outcomeTitle: "Separate Rate Changes from Usage",
    outcomeDescription:
      "Isolate whether cost increases stem from seasonal tariff hikes, peak demand charges, or higher active consumption.",
    keyDeliverable: "Clearly distinguish utility price increases from internal operational shifts.",
    icon: TrendingUp,
  },
  {
    id: "billing-periods",
    question: "Which billing periods require attention?",
    category: "Audit Priorities",
    outcomeTitle: "Target Problem Billing Cycles",
    outcomeDescription:
      "Highlight billing months where utility statements disagree with physical meter interval records.",
    keyDeliverable: "Prioritize statements with verified discrepancies for immediate credit claims.",
    icon: AlertTriangle,
  },
  {
    id: "unusual-patterns",
    question: "Where are unusual consumption patterns appearing?",
    category: "Operational Diagnostics",
    outcomeTitle: "Locate Operational Inefficiencies",
    outcomeDescription:
      "Identify unexpected baseload creep, uncharacteristic weekend usage, or reactive energy draw across facilities.",
    keyDeliverable: "Pinpoint abnormal equipment runtimes before they drive up demand surcharges.",
    icon: Search,
  },
  {
    id: "multi-site-comparison",
    question: "What changed across our sites?",
    category: "Portfolio Visibility",
    outcomeTitle: "Compare Facility Performance",
    outcomeDescription:
      "Review cross-site energy trends, load factor changes, and capacity utilization over any billing period.",
    keyDeliverable: "Gain a unified portfolio view to benchmark performance across locations.",
    icon: Building2,
  },
  {
    id: "investigate-first",
    question: "Which areas should we investigate first?",
    category: "Action Roadmap",
    outcomeTitle: "Rank Issues by Financial Value",
    outcomeDescription:
      "Sort identified billing variances and operational anomalies by monetary impact and dispute deadlines.",
    keyDeliverable: "Focus your team's attention on the largest recovery opportunities first.",
    icon: CheckCircle2,
  },
];

export function EneraAISection() {
  const [selectedId, setSelectedId] = useState<string>("cost-change");

  const current =
    QUESTION_OUTCOMES.find((q) => q.id === selectedId) || QUESTION_OUTCOMES[0];
  const CurrentIcon = current.icon;

  return (
    <section
      id="ai-assistant"
      className="py-20 sm:py-24 bg-white text-slate-900 border-t border-slate-200/80 font-sans scroll-mt-12"
      aria-label="Intelligent Energy Assistance"
    >
      {/* Backwards-compatible anchor */}
      <div id="ask-better-questions" className="sr-only" aria-hidden="true" />
      <div id="faq" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-cyan-700" />
          <span>INTELLIGENT ASSISTANCE</span>
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          ASK BETTER QUESTIONS.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-12">
          Ask plain-language questions to understand your energy data. ENERA identifies cost drivers, highlights priorities, and guides investigations.
        </p>

        {/* 4. Visual or capability: Interactive Questions & Outcomes Studio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Column: 5 Example Inquiries */}
          <div className="lg:col-span-5 space-y-2.5">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-3 px-1">
              Select an Example Inquiry
            </span>

            {QUESTION_OUTCOMES.map((q) => {
              const isSelected = q.id === selectedId;
              const Icon = q.icon;

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-200 border block focus-ring-enera group ${
                    isSelected
                      ? "bg-cyan-50/90 border-cyan-400 shadow-sm enera-glow-cyan ring-1 ring-cyan-400/20"
                      : "bg-slate-50 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                    <span
                      className={`${
                        isSelected ? "text-cyan-800 font-semibold" : "text-slate-500"
                      }`}
                    >
                      {q.category}
                    </span>
                    <Icon
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        isSelected ? "text-cyan-700 scale-110" : "text-slate-400 group-hover:scale-105"
                      }`}
                    />
                  </div>

                  <p
                    className={`text-sm font-sans font-medium ${
                      isSelected ? "text-slate-900 font-semibold" : "text-slate-700"
                    }`}
                  >
                    "{q.question}"
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right Column: Concrete Operational & Financial Outcome */}
          <div
            key={current.id}
            className="lg:col-span-7 rounded-xl bg-slate-50 border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm transition-all duration-300"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700">
                  <CurrentIcon className="h-4 w-4" />
                </div>
                <span className="text-xs font-mono text-slate-700 uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse" aria-hidden="true" />
                  DELIVERED OUTCOME: {current.category}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs">
                Decision Support
              </span>
            </div>

            <div>
              <span className="text-xs font-mono text-cyan-700 uppercase tracking-wider block mb-1">
                INQUIRY ANSWER
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans leading-tight">
                {current.outcomeTitle}
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 leading-relaxed font-sans shadow-2xs">
              {current.outcomeDescription}
            </div>

            <div className="p-4 rounded-xl bg-cyan-50/60 border border-cyan-200 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-cyan-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-cyan-900 block mb-0.5 font-mono">
                  MANAGEMENT VALUE
                </span>
                <p className="text-xs text-slate-700 font-sans leading-relaxed">
                  {current.keyDeliverable}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono text-slate-500">
              <span>Grounded in interval telemetry and statutory gazettes.</span>
              <span className="text-emerald-700 font-medium">Deterministic Lineage</span>
            </div>
          </div>
        </div>

        {/* 5. Supporting information & Progressive CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <span>Information synthesized directly from verified interval telemetry and statutory tariff schedules.</span>
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
