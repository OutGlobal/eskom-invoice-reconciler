import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Layers,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  FileText,
  Scale,
  Activity,
  ArrowDown,
  Eye,
  BadgeCheck,
} from "lucide-react";
import { EnginePhaseTag } from "./EneraBrandPrimitives";

interface AuditStep {
  step: number;
  label: string;
  sub: string;
  category: string;
  detail: string;
  trustPillar: string;
  statute: string;
  assurance: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AUDIT_STEPS: AuditStep[] = [
  {
    step: 1,
    label: "SOURCE INVOICE",
    sub: "Document Sovereign Ingestion",
    category: "Document Integrity",
    detail:
      "Original Eskom utility statements or municipal bills are ingested within a client-isolated security boundary, preserving full sovereign ownership and zero external sharing.",
    trustPillar: "Data Sovereignty Standard",
    statute: "Electronic Communications & Transactions Act 25",
    assurance: "Zero Client Data Shared with Third Parties",
    icon: FileText,
  },
  {
    step: 2,
    label: "DETERMINANT AUDIT",
    sub: "Line-Item Determinant Mapping",
    category: "Extraction Integrity",
    detail:
      "Every numerical determinant—active energy kWh, maximum demand kVA, and reactive power—is systematically decomposed and linked to physical connection points.",
    trustPillar: "Determinant Traceability",
    statute: "Tax Administration Act 28 (Section 29)",
    assurance: "100% Line-Item Determinant Provenance",
    icon: Layers,
  },
  {
    step: 3,
    label: "FISCAL ACCURACY",
    sub: "Statutory Accounting Precision",
    category: "Computational Standard",
    detail:
      "Calculations are performed strictly to statutory South African revenue accounting precision, eliminating utility rounding discrepancies and cumulative billing drift.",
    trustPillar: "Exact Fiscal Calculation",
    statute: "Public Finance Management Act (PFMA)",
    assurance: "Zero Floating-Point Drift Tolerated",
    icon: Scale,
  },
  {
    step: 4,
    label: "GAZETTE GOVERNANCE",
    sub: "Official NERSA Tariff Book",
    category: "Regulatory Authority",
    detail:
      "Every tariff component is cross-referenced against the legally gazetted NERSA schedule, seasonal boundary rules (Winter vs Summer), and official SAST calendar dates.",
    trustPillar: "NERSA Schedule Compliance",
    statute: "Electricity Regulation Act 4 of 2006",
    assurance: "Grounded in Legally Gazetted Tariff Books",
    icon: Scale,
  },
  {
    step: 5,
    label: "VARIANCE ISOLATION",
    sub: "Deterministic Overcharge Classification",
    category: "Discrepancy Analysis",
    detail:
      "Discrepancies are isolated into definitive commercial categories: Peak TOU Overcharges, Demand Ratchet Penalties, or Uncredited Public Holiday Credits.",
    trustPillar: "Independent Fiduciary Verification",
    statute: "SANS 474 Code of Practice for Metering",
    assurance: "Substantiated Capital Overpayment Identified",
    icon: Activity,
  },
  {
    step: 6,
    label: "METER GROUND TRUTH",
    sub: "Revenue-Grade Check Telemetry",
    category: "Physical Telemetry",
    detail:
      "Direct correlation against SANS 474 and NRS 057 revenue-grade check-meter data-loggers, verifying half-hour interval pulse data against billed amounts.",
    trustPillar: "Class 0.2S Hardware Telemetry",
    statute: "NRS 057 Code of Practice for Metering",
    assurance: "Physical Hardware Consumption Proof",
    icon: FileCheck,
  },
  {
    step: 7,
    label: "DISPUTE DOSSIER",
    sub: "Executive Claim Documentation",
    category: "Regulatory Resolution",
    detail:
      "Audit-ready regulatory dispute dossiers compiled for formal submission to municipal councils and Eskom customer executive billing resolution committees.",
    trustPillar: "Form 102 Regulatory Pack",
    statute: "NERSA Dispute Resolution Procedures",
    assurance: "Immediate Credit Note Requisition Submission",
    icon: BadgeCheck,
  },
];

const SUPPORTING_STATEMENTS = [
  {
    quote: "Nothing disappears into a black box.",
    sub: "Complete architectural transparency with zero hidden proprietary weights or black-box guesswork.",
    tag: "OPEN AUDITABILITY",
    colorClass: "border-cyan-500/30 text-cyan-300",
  },
  {
    quote: "Every calculation can be traced.",
    sub: "Rigorous statutory accounting precision down to individual half-hour time-of-use tariff rate tables.",
    tag: "MATHEMATICAL RIGOR",
    colorClass: "border-emerald-500/30 text-emerald-300",
  },
  {
    quote: "Every finding has supporting evidence.",
    sub: "Backed by revenue-grade AMR telemetry and official gazetted NERSA schedule clauses.",
    tag: "EVIDENTIARY TRUTH",
    colorClass: "border-amber-500/30 text-amber-300",
  },
];

export function EneraAuditTrailSection() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const cur = AUDIT_STEPS.find((s) => s.step === activeStep) || AUDIT_STEPS[0];

  return (
    <section
      id="security"
      className="relative py-28 sm:py-36 bg-[#030712] text-white overflow-hidden border-t border-white/5"
      aria-label="Trust, Governance and Statutory Auditability"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[750px] h-[550px] bg-cyan-500/5 rounded-full blur-[170px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <EnginePhaseTag
            phase="05"
            name="ANOMALY"
            sub="CRYPTOGRAPHIC EVIDENCE & AUDIT CHAIN"
          />

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight enera-text-gradient leading-tight">
            EVERY NUMBER HAS A TRAIL.
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            Because energy decisions are balance-sheet decisions. ENERA replaces institutional
            utility trust with verifiable mathematical lineage — linking every billed cent directly
            to physical electrons and gazetted legal statutes.
          </p>
        </div>

        {/* 4 Core Supporting Statements Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {SUPPORTING_STATEMENTS.map((item) => (
            <div
              key={item.quote}
              className="p-6 rounded-3xl bg-[#0d1117]/90 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between shadow-xl group hover:scale-[1.01]"
            >
              <div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-white/[0.04] border ${item.colorClass}`}
                >
                  {item.tag}
                </span>
                <blockquote className="mt-4 text-lg font-bold text-white font-mono tracking-tight leading-snug">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
              </div>
              <p className="mt-4 text-xs text-slate-400 font-sans leading-relaxed pt-3 border-t border-white/5">
                {item.sub}
              </p>
            </div>
          ))}
        </div>

        {/* 7-Node Sequence Visual Flow with Explicit Downward Transition Arrows (↓) */}
        <div className="mb-10 p-6 sm:p-8 rounded-3xl bg-[#0a0e17] border border-cyan-500/20 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-bold uppercase tracking-wider">
              <Layers className="h-4 w-4 text-cyan-400" />
              <span>CRYPTOGRAPHIC LINEAGE PIPELINE (SOURCE → REPORT)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              CLICK ANY NODE TO INSPECT EVIDENCE
            </span>
          </div>

          {/* Desktop & Tablet Sequential Step Flow with Downward/Forward Arrows */}
          <div
            role="tablist"
            aria-label="Cryptographic lineage pipeline stages"
            className="flex flex-col lg:flex-row items-center justify-between gap-2"
          >
            {AUDIT_STEPS.map((s, idx) => {
              const isSelected = activeStep === s.step;
              const isPassed = activeStep > s.step;
              const Icon = s.icon;

              return (
                <React.Fragment key={s.step}>
                  <button
                    type="button"
                    role="tab"
                    id={`audit-node-${s.step}`}
                    aria-controls="audit-node-panel"
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setActiveStep(s.step)}
                    className={`w-full lg:w-auto flex-1 p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between focus-ring-enera ${
                      isSelected
                        ? "bg-gradient-to-b from-cyan-950/70 to-[#0d1117] border-cyan-500/70 shadow-[0_0_25px_rgba(6,182,212,0.35)] scale-[1.03]"
                        : isPassed
                          ? "bg-[#0d1117]/80 border-emerald-500/30 text-slate-300 hover:border-emerald-500/50"
                          : "bg-[#0d1117]/40 border-white/5 hover:border-white/20 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          isSelected
                            ? "text-cyan-400"
                            : isPassed
                              ? "text-emerald-400"
                              : "text-slate-400"
                        }`}
                      >
                        0{s.step}
                      </span>
                      {isPassed ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Icon
                          className={`h-3 w-3 ${isSelected ? "text-cyan-400" : "text-slate-400"}`}
                        />
                      )}
                    </div>

                    <div className="text-xs font-bold text-white mt-2 leading-tight font-mono">
                      {s.label}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                      {s.sub}
                    </span>
                  </button>

                  {/* Downward/Forward Connector Arrow (↓) */}
                  {idx < AUDIT_STEPS.length - 1 && (
                    <div
                      className="flex items-center justify-center py-1 lg:py-0 lg:px-1"
                      aria-hidden="true"
                    >
                      <span
                        className={`text-sm font-bold font-mono transition-colors ${
                          activeStep > s.step
                            ? "text-emerald-400"
                            : activeStep === s.step
                              ? "text-cyan-400 animate-pulse"
                              : "text-slate-600"
                        }`}
                      >
                        <span className="hidden lg:inline">→</span>
                        <span className="lg:hidden">↓</span>
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Active Node Deep-Dive Proof Console */}
        <div
          role="tabpanel"
          id="audit-node-panel"
          aria-labelledby={`audit-node-${activeStep}`}
          aria-live="polite"
          className="rounded-3xl bg-[#0d1117] border border-cyan-500/30 p-6 sm:p-10 relative overflow-hidden shadow-[0_0_80px_-20px_rgba(6,182,212,0.2)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-cyan-400 font-bold tracking-wider">
                  LINEAGE NODE 0{cur.step} OF 07
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {cur.category}
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-mono">
                {cur.label}
              </h3>
              <span className="text-xs text-slate-400 font-mono mt-0.5 block">{cur.sub}</span>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono self-start sm:self-auto shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>STATUTORY RECONCILIATION BENCHMARK</span>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans">
              {cur.detail}
            </p>

            {/* Executive Trust Proof Box */}
            <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 uppercase border-b border-white/5 pb-2">
                <span className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  INSTITUTIONAL TRUST CRITERIA · {cur.trustPillar}
                </span>
                <span className="text-[10px] text-slate-400">STATUTORY AUDIT GROUNDING</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1 font-semibold">
                    REGULATORY AUTHORITY
                  </span>
                  <span className="text-white font-medium font-sans text-xs">
                    {cur.statute}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase block mb-1 font-semibold">
                    ENTERPRISE ASSURANCE
                  </span>
                  <span className="text-emerald-300 font-medium font-sans text-xs">
                    {cur.assurance}
                  </span>
                </div>
              </div>
            </div>

            {/* Governance Standard Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">
                  GOVERNANCE CATEGORY
                </span>
                <span className="font-semibold text-white font-mono mt-1 block">
                  {cur.category}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">
                  LEGAL FRAMEWORK
                </span>
                <span className="font-semibold text-white font-mono mt-1 block truncate">
                  {cur.statute}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                <span className="text-[10px] font-mono text-slate-400 uppercase block">
                  FIDUCIARY VALUE
                </span>
                <span className="font-semibold text-cyan-300 font-mono mt-1 block">
                  Board-Ready Evidence
                </span>
              </div>
            </div>

            {/* Navigation Steppers & Portal Link */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeStep === 1}
                  onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                  aria-label="Navigate to previous lineage node"
                  className="px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 focus-ring-enera"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>PREVIOUS NODE</span>
                </button>

                <button
                  type="button"
                  disabled={activeStep === AUDIT_STEPS.length}
                  onClick={() => setActiveStep((prev) => Math.min(AUDIT_STEPS.length, prev + 1))}
                  aria-label="Navigate to next lineage node"
                  className="px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1 focus-ring-enera"
                >
                  <span>NEXT NODE</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <Link
                to="/reconciliation"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-200 focus-ring-enera px-2 py-1 rounded"
              >
                <span>Explore Live 12-Node Evidence Chain in Portal</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
