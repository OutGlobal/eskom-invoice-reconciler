import React, { useState } from "react";
import { ChevronDown, HelpCircle, ArrowRight } from "lucide-react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "data-requirements",
    category: "DATA & INGESTION",
    question: "What data does ENERA need to reconcile an account?",
    answer:
      "ENERA analyzes monthly utility invoices alongside 30-minute interval meter telemetry from AMR systems or data loggers. Comparing billed determinants directly against physical meter load exposes calculation errors, demand discrepancies, and unearned charges.",
  },
  {
    id: "tariffs-supported",
    category: "TARIFFS & SCHEDULES",
    question: "Which tariffs and regulatory schedules are supported?",
    answer:
      "ENERA natively models national NERSA statutory schedules, Eskom tariffs (including Megaflex, Miniflex, and Nightsave), as well as municipal multi-tier Time-of-Use structures across South Africa.",
  },
  {
    id: "discrepancy-types",
    category: "ANOMALY DETECTION",
    question: "What types of billing discrepancies does ENERA identify?",
    answer:
      "Common discrepancies include statutory public holidays billed as weekday peak hours, maximum demand ratchet overstatements, power factor penalty errors, transmission surcharge miscalculations, and unrecorded meter rollover intervals.",
  },
  {
    id: "dispute-evidence",
    category: "AUDIT & RECOVERY",
    question: "What evidence is provided for utility dispute recovery?",
    answer:
      "ENERA compiles structured reconciliation dossiers cited with statutory tariff schedules, interval timestamps, and financial delta summaries. These audit packs give finance teams the verification needed to claim utility credits.",
  },
  {
    id: "stakeholder-access",
    category: "PLATFORM & TEAMS",
    question: "Who uses ENERA across an organisation?",
    answer:
      "Energy managers, finance teams, facility engineers, and internal auditors use ENERA collaboratively. Role-based views give operational staff interval insights while providing CFOs with consolidated financial exposure ledgers.",
  },
  {
    id: "security-governance",
    category: "SECURITY & TRUST",
    question: "How is our energy and financial data protected?",
    answer:
      "All ingested telemetry and invoice records are protected by enterprise role-based access controls, cryptographic data integrity hashes, encrypted transmission, and comprehensive audit logs.",
  },
];

export function EneraFaqSection() {
  const [openId, setOpenId] = useState<string | null>("data-requirements");

  const toggleItem = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  return (
    <section
      id="faq"
      className="py-24 sm:py-32 bg-slate-50/60 text-slate-900 border-t border-slate-200/80 font-sans scroll-mt-12"
      aria-label="Resources and Frequently Asked Questions"
    >
      {/* Backwards-compatible anchors */}
      <div id="resources" className="sr-only" aria-hidden="true" />
      <div id="insights" className="sr-only" aria-hidden="true" />
      <div id="guides" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-700 mb-3 font-semibold flex items-center gap-2">
          <HelpCircle className="h-3.5 w-3.5 text-cyan-700" />
          <span>RESOURCES & FAQ</span>
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight font-sans max-w-3xl">
          FREQUENTLY ASKED QUESTIONS
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-3xl mb-14">
          Clear answers about ENERA's reconciliation methodology, supported tariffs, data security, and dispute resolution workflows.
        </p>

        {/* 4. Visual or capability: Accessible Accordion List */}
        <div className="max-w-4xl space-y-3">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-200 hover:border-cyan-300"
              >
                <button
                  type="button"
                  id={`faq-btn-${item.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${item.id}`}
                  onClick={() => toggleItem(item.id)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left focus-ring-enera"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-700 uppercase block">
                      {item.category}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 font-sans">
                      {item.question}
                    </h3>
                  </div>
                  <div
                    className={`shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 transition-transform duration-200 ${
                      isOpen ? "rotate-180 bg-cyan-50 text-cyan-700" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-panel-${item.id}`}
                    role="region"
                    aria-labelledby={`faq-btn-${item.id}`}
                    className="px-6 pb-6 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed font-sans border-t border-slate-100"
                  >
                    <p>{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 5. Supporting info & 6. Progressive CTA */}
        <div className="mt-12 pt-6 border-t border-slate-200/80 max-w-4xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-600">
          <span>Need specialized tariff analysis or custom portfolio ingestion?</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-700 hover:text-cyan-800 font-semibold transition-colors focus-ring-enera shrink-0"
          >
            <span>Speak with our analysts</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
