import React, { useState } from "react";
import { ShieldCheck, CheckCircle2, Lock, ArrowRight, Layers } from "lucide-react";

interface AuditStep {
  step: number;
  label: string;
  sub: string;
  category: string;
  detail: string;
  trustPillar: string;
  statute: string;
  assurance: string;
}

const AUDIT_STEPS: AuditStep[] = [
  {
    step: 1,
    label: "Sovereign Ingestion",
    sub: "Client-Isolated Perimeter",
    category: "Data Sovereignty",
    detail:
      "Utility statements and municipal bills are ingested within a dedicated client security boundary. Ingested data is encrypted under client keys and never shared with third parties or public models.",
    trustPillar: "Data Sovereignty Standard",
    statute: "Protection of Personal Information Act (POPIA) & ECT Act 25",
    assurance: "Zero external model training or third-party leakage",
  },
  {
    step: 2,
    label: "Determinant Extraction",
    sub: "Line-Item Determinant Mapping",
    category: "Extraction Integrity",
    detail:
      "Active energy (kWh), maximum demand (kVA), and reactive energy (kVArh) vectors are systematically isolated and correlated against physical supply meters and account identifiers.",
    trustPillar: "Determinant Traceability",
    statute: "Tax Administration Act 28 (Section 29)",
    assurance: "100% deterministic line-item extraction without probabilistic hallucination",
  },
  {
    step: 3,
    label: "Fiscal Accuracy",
    sub: "Statutory Accounting Precision",
    category: "Computational Standard",
    detail:
      "Calculations are performed strictly using statutory decimal precision matching South African Revenue Service and PFMA audit standards, eliminating cumulative rounding drift.",
    trustPillar: "Exact Fiscal Calculation",
    statute: "Public Finance Management Act (PFMA)",
    assurance: "Zero floating-point rounding errors tolerated",
  },
  {
    step: 4,
    label: "Gazette Governance",
    sub: "Official NERSA Schedule Sync",
    category: "Regulatory Authority",
    detail:
      "Every tariff determinant is cross-referenced against legally gazetted NERSA schedules, official seasonal transitions (Winter vs Summer), and gazetted public holiday substitutions.",
    trustPillar: "NERSA Gazette Compliance",
    statute: "Electricity Regulation Act No. 4 of 2006",
    assurance: "Grounded exclusively in approved, gazetted rate structures",
  },
  {
    step: 5,
    label: "Variance Isolation",
    sub: "Deterministic Classification",
    category: "Discrepancy Analysis",
    detail:
      "Identified variances are classified into concrete recovery categories: Peak TOU overcharges, demand ratchet over-assessments, or missed public holiday credits.",
    trustPillar: "Fiduciary Verification",
    statute: "SANS 474 Code of Practice for Metering",
    assurance: "Substantiated overcharge recovery dossiers compiled",
  },
  {
    step: 6,
    label: "AMR Ground Truth",
    sub: "Hardware Pulse Validation",
    category: "Physical Telemetry",
    detail:
      "Direct correlation against SANS 474 and NRS 057 revenue-grade check meters, cross-checking 1,488 half-hour interval registers per month to eliminate estimated reading errors.",
    trustPillar: "Class 0.2S Telemetry",
    statute: "NRS 057 Code of Practice for Electricity Metering",
    assurance: "Physical hardware interval proof for every kilowatt-hour",
  },
  {
    step: 7,
    label: "Dispute Dossier",
    sub: "Executive Claim Documentation",
    category: "Regulatory Resolution",
    detail:
      "Production of audit-ready Eskom Billing Resolution Form 102 dossiers complete with interval timestamps, rate citations, and signed calibration certificates for executive submission.",
    trustPillar: "Form 102 Dispute Pack",
    statute: "NERSA Dispute Resolution Regulations",
    assurance: "Formal credit note requisition format accepted by utility key accounts",
  },
];

export function EneraAuditTrailSection() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const cur = AUDIT_STEPS.find((s) => s.step === activeStep) || AUDIT_STEPS[0];

  return (
    <section
      id="about"
      className="relative py-24 sm:py-32 bg-[#05080f] text-white border-t border-white/10 overflow-hidden scroll-mt-12"
      aria-label="About ENERA — Institutional Governance, Sovereignty & Lineage"
    >
      {/* Backwards-compatible anchors */}
      <div id="governance" className="sr-only" aria-hidden="true" />
      <div id="resources" className="sr-only" aria-hidden="true" />
      <div id="security" className="sr-only" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          ABOUT ENERA
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          Every number has a cryptographic lineage.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-14">
          ENERA replaces blind utility trust with verifiable mathematical lineage — linking every
          billed cent directly to physical meter registers and statutory gazettes.
        </p>

        {/* 4. Visual or capability: 7-Stage Lineage Pipeline Console */}
        <div className="rounded-2xl bg-[#080d16] border border-white/10 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 mb-6 gap-2">
            <span className="text-xs font-mono uppercase text-slate-300 font-semibold tracking-wider flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span>Cryptographic Lineage Pipeline (01 Ingestion → 07 Dispute Dossier)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Select stage to inspect audit standard
            </span>
          </div>

          {/* Stepper Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
            {AUDIT_STEPS.map((s) => {
              const isSelected = activeStep === s.step;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setActiveStep(s.step)}
                  className={`p-3 rounded-lg text-left transition-all border focus-ring-enera ${
                    isSelected
                      ? "bg-cyan-950/40 border-cyan-500/50 text-white"
                      : "bg-black/30 border-white/5 hover:border-white/20 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span
                    className={`text-[10px] font-mono block font-semibold ${
                      isSelected ? "text-cyan-400" : "text-slate-500"
                    }`}
                  >
                    0{s.step}
                  </span>
                  <div className="text-xs font-semibold font-sans mt-0.5 truncate text-slate-200">
                    {s.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Node Detail Card */}
          <div className="rounded-lg bg-black/40 border border-white/5 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                  Stage 0{cur.step} of 07 · {cur.category}
                </span>
                <h3 className="text-lg font-semibold text-white font-sans mt-0.5">
                  {cur.label}: {cur.sub}
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold self-start sm:self-auto">
                {cur.trustPillar}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
              {cur.detail}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 rounded bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase block mb-0.5">
                  Statutory &amp; Regulatory Standard
                </span>
                <span className="text-slate-200 font-medium font-sans text-xs">{cur.statute}</span>
              </div>
              <div className="p-3 rounded bg-white/[0.02] border border-white/5">
                <span className="text-[10px] text-emerald-400 uppercase block mb-0.5">
                  Institutional Assurance
                </span>
                <span className="text-emerald-300 font-medium font-sans text-xs">
                  {cur.assurance}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Optional supporting information & 6. Optional CTA */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>
            Protected by client-isolated data perimeter, strict tenant separation, and audit-ready
            lineage.
          </span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium transition-colors focus-ring-enera shrink-0"
          >
            <span>Request compliance dossier</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
