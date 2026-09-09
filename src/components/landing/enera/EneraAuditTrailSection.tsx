import React, { useState } from "react";
import { ShieldCheck, FileCheck, CheckCircle2, Lock, ArrowRight, Layers, FileCode } from "lucide-react";

interface AuditStep {
  step: number;
  label: string;
  sub: string;
  detail: string;
  verification: string;
}

const AUDIT_STEPS: AuditStep[] = [
  {
    step: 1,
    label: "SOURCE DOCUMENT",
    sub: "SHA-256 Immutable Hash",
    detail: "Original Eskom PDF preserved in write-once cryptographic ledger with source timestamp.",
    verification: "hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  {
    step: 2,
    label: "EXTRACTED DATA",
    sub: "Bounding Box Coordinates",
    detail: "Every numeric determinant mapped with page number, spatial coordinate, and confidence score.",
    verification: "Confidence: 99.4% · Spatial Box [x: 142, y: 388, w: 94, h: 18]",
  },
  {
    step: 3,
    label: "CALCULATION",
    sub: "Decimal.js-light Precision",
    detail: "Zero floating-point arithmetic errors. Strict Decimal arithmetic matching statutory billing formulas.",
    verification: "Rounding: ROUND_HALF_UP · Precision: 20 decimal places",
  },
  {
    step: 4,
    label: "RULE APPLIED",
    sub: "NERSA Gazette Reference",
    detail: "Versioned tariff logic citing official government gazette clause, effective dates, and season boundary.",
    verification: "Tariff Book: 2025/2026 Schedule 4 · Version 2025.1",
  },
  {
    step: 5,
    label: "FINDING",
    sub: "Deterministic Classification",
    detail: "Discrepancy isolated into specific categorisation: Peak TOU Overcharge, Multiplier Error, or NMD Spike.",
    verification: "Classification: MATERIAL_DISCREPANCY (Confidence: 98.7%)",
  },
  {
    step: 6,
    label: "EVIDENCE",
    sub: "30-Min Interval Telemetry Log",
    detail: "Meter serial number, channel ID, raw pulse value, CT/VT multiplier, and timestamp lineage.",
    verification: "Revenue AMR Meter #021-MS-90412 · SANS 474 Class 0.2s Certified",
  },
  {
    step: 7,
    label: "REPORT",
    sub: "Section 21 Dispute Package",
    detail: "Court-ready, NERSA-compliant statutory dispute dossier ready for submission to utility billing authorities.",
    verification: "Audit Trail: 100% Cryptographically Reproducible",
  },
];

export function EneraAuditTrailSection() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const cur = AUDIT_STEPS.find((s) => s.step === activeStep) || AUDIT_STEPS[0];

  return (
    <section id="security" className="relative py-28 bg-[#030712] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-4">
            <Lock className="h-3 w-3" />
            <span>FINANCIAL INTEGRITY & AUDIT TRAIL</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            EVERY NUMBER HAS A TRAIL.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            Nothing disappears into a black box. Every calculation can be traced. Every finding has
            supporting evidence. Every action is logged.
          </p>
        </div>

        {/* 7-Step Interactive Lineage Chain */}
        <div className="max-w-5xl mx-auto">
          {/* Horizontal Progress Timeline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {AUDIT_STEPS.map((s) => {
              const isSelected = activeStep === s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => setActiveStep(s.step)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-cyan-950/60 border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                      : "bg-[#0d1117]/60 border-white/5 hover:border-white/20 hover:bg-[#161b22]"
                  }`}
                >
                  <span
                    className={`text-[10px] font-mono font-bold block ${
                      isSelected ? "text-cyan-400" : "text-slate-500"
                    }`}
                  >
                    STEP 0{s.step}
                  </span>
                  <div className="text-xs font-semibold text-white mt-1 leading-snug">
                    {s.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Evidence Inspection Card */}
          <div className="mt-8 enera-glass rounded-3xl p-6 sm:p-10 border-cyan-500/30 relative overflow-hidden shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs font-mono uppercase text-cyan-400 font-bold tracking-wider">
                  LINEAGE NODE 0{cur.step} OF 07
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono">
                  {cur.label}
                </h3>
                <span className="text-xs text-slate-400 font-mono mt-0.5 block">{cur.sub}</span>
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono self-start sm:self-auto">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>CRYPTOGRAPHICALLY VERIFIED</span>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">{cur.detail}</p>

              {/* Technical Proof Verification Block */}
              <div className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-cyan-300 flex items-start gap-3">
                <FileCode className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="overflow-x-auto">
                  <span className="text-slate-500 text-[10px] uppercase block mb-1">
                    VERIFICATION PAYLOAD PROOF
                  </span>
                  <span className="text-white/90">{cur.verification}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">
                    GOVERNANCE STANDARD
                  </span>
                  <span className="font-semibold text-white">SANS 474 / NRS 057</span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">
                    REGULATORY JURISDICTION
                  </span>
                  <span className="font-semibold text-white">NERSA Electricity Act</span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">
                    AUDIT PERSISTENCE
                  </span>
                  <span className="font-semibold text-white">7-Year Statutory Ledger</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
