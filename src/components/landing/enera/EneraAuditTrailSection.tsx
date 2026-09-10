import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Layers,
  FileCode,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Copy,
  Terminal,
  FileText,
  Binary,
  Scale,
  Activity,
  ArrowDown,
  Eye,
  BadgeCheck,
} from "lucide-react";

interface AuditStep {
  step: number;
  label: string;
  sub: string;
  category: string;
  detail: string;
  verification: string;
  prevHash: string;
  currentHash: string;
  governance: string;
  statute: string;
  retention: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AUDIT_STEPS: AuditStep[] = [
  {
    step: 1,
    label: "SOURCE DOCUMENT",
    sub: "Cryptographic File Ingestion",
    category: "Ingestion Root",
    detail: "Original Eskom utility PDF or municipal statement preserved in an immutable, write-once cryptographic ledger with timestamped SHA-256 seal.",
    verification: "hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 · Bytes: 2,481,902",
    prevHash: "GENESIS_ROOT_00000000000000000000000000000000000000000000000000000000",
    currentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    governance: "ISO 27001 / WORM Storage",
    statute: "Electronic Communications and Transactions Act 25",
    retention: "7-Year Statutory Fiscal Ledger",
    icon: FileText,
  },
  {
    step: 2,
    label: "EXTRACTED DATA",
    sub: "Spatial Bounding Box Geometry",
    category: "Extraction Layer",
    detail: "Every numeric determinant mapped with PDF page number, spatial pixel bounding coordinates, and confidence score vector.",
    verification: "Confidence: 99.8% · Determinants Extracted: 8 · Geometry: [x: 142, y: 388, w: 94, h: 18, p: 2]",
    prevHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    currentHash: "7a89bc213ef091a823cd110992384a77bc124982cba128941098492837bcda11",
    governance: "OCR Ground Truth Validation",
    statute: "Tax Administration Act 28 (Section 29)",
    retention: "Pixel-Coordinate Matrix Attached",
    icon: Binary,
  },
  {
    step: 3,
    label: "CALCULATION",
    sub: "Decimal.js-light Precision",
    category: "Deterministic Arithmetic",
    detail: "Zero floating-point rounding drifts. Exact Decimal arithmetic matching statutory South African utility billing formulas.",
    verification: "Rounding: ROUND_HALF_UP · Precision: 20 Decimals · IEEE 754 Drift: Eliminated",
    prevHash: "7a89bc213ef091a823cd110992384a77bc124982cba128941098492837bcda11",
    currentHash: "3f9801ac8849b28394019283eacb920194829384729183940192839485761029",
    governance: "High-Precision Monetary Math",
    statute: "Public Finance Management Act (PFMA)",
    retention: "Bit-level Calculation Traces",
    icon: Layers,
  },
  {
    step: 4,
    label: "RULE APPLIED",
    sub: "Gazetted NERSA Clause Citing",
    category: "Regulatory Verification",
    detail: "Versioned tariff schedule logic citing official government gazette clauses, seasonal boundary dates, and SAST calendar rules.",
    verification: "Tariff Book: NERSA Schedule 2 (Megaflex High Season) · Section 8.4 Public Holiday TOU Rule",
    prevHash: "3f9801ac8849b28394019283eacb920194829384729183940192839485761029",
    currentHash: "1192830495867182930495867182930495867182930495867182930495867182",
    governance: "NERSA Electricity Act 41",
    statute: "Electricity Regulation Act 4 of 2006",
    retention: "Indexed Tariff Schedule Snapshot",
    icon: Scale,
  },
  {
    step: 5,
    label: "FINDING",
    sub: "Categorical Determinant Isolation",
    category: "Discrepancy Analysis",
    detail: "Discrepancy isolated into deterministic classifications: Peak TOU Overcharge, Multiplier Ratio Drift, or NMD Demand Spike.",
    verification: "Classification: MATERIAL_DISCREPANCY · Confidence: 99.2% · Delta: R 51,227.00 Potential Overcharge",
    prevHash: "1192830495867182930495867182930495867182930495867182930495867182",
    currentHash: "99887766554433221100aabbccddeeff99887766554433221100aabbccddeeff",
    governance: "Audit Anomaly Threshold",
    statute: "SANS 474 Code of Practice for Metering",
    retention: "Discrepancy Signature Recorded",
    icon: Activity,
  },
  {
    step: 6,
    label: "EVIDENCE",
    sub: "30-Min Telemetry Lineage",
    category: "Hardware Pulse Ground Truth",
    detail: "Revenue check meter serial number, channel ID, raw pulse log, CT/VT multiplier verification, and physical timestamp lineage.",
    verification: "Revenue AMR Meter #021-MS-90412 · CT Ratio 400:5 · SANS 474 Class 0.2S Certified Physical Pulses",
    prevHash: "99887766554433221100aabbccddeeff99887766554433221100aabbccddeeff",
    currentHash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
    governance: "SABS / SANS 474 Metering Spec",
    statute: "NRS 057 Code of Practice for Metering",
    retention: "Physical Hardware Calibration Chain",
    icon: FileCheck,
  },
  {
    step: 7,
    label: "REPORT",
    sub: "Section 21 Dispute Package",
    category: "Statutory Resolution",
    detail: "Court-ready, NERSA-compliant statutory dispute dossier ready for formal submission to Eskom executive billing resolution committees.",
    verification: "Audit Trail: 100% Cryptographically Reproducible · Form 102 Line-Item Annexures Auto-Generated",
    prevHash: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
    currentHash: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    governance: "Section 21 Regulatory Dispute Pack",
    statute: "NERSA Dispute Resolution Rules",
    retention: "Permanent Legal Dispute Repository",
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
    sub: "Bit-level arithmetic logs down to individual half-hour time-of-use tariff rate tables and statutory formulas.",
    tag: "MATHEMATICAL RIGOR",
    colorClass: "border-emerald-500/30 text-emerald-300",
  },
  {
    quote: "Every finding has supporting evidence.",
    sub: "Anchored in physical Class 0.2S revenue-grade AMR telemetry, OCR coordinates, and NERSA gazettes.",
    tag: "GROUND TRUTH",
    colorClass: "border-amber-500/30 text-amber-300",
  },
  {
    quote: "Every action is logged.",
    sub: "Permanent, immutable SHA-256 hash chaining guarantees tamper-evident dispute packages.",
    tag: "NON-REPUDIATION",
    colorClass: "border-purple-500/30 text-purple-300",
  },
];

export function EneraAuditTrailSection() {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);

  const cur = AUDIT_STEPS.find((s) => s.step === activeStep) || AUDIT_STEPS[0];

  const handleCopyHash = () => {
    navigator.clipboard.writeText(cur.currentHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <section
      id="security"
      className="relative py-28 sm:py-36 bg-[#030712] text-white overflow-hidden border-t border-white/5"
      aria-label="Trust, Auditability and Cryptographic Proof"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[750px] h-[550px] bg-cyan-500/5 rounded-full blur-[170px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono mb-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="tracking-wide">STAGE 15 // TRUST &amp; AUDITABILITY</span>
          </div>

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
                <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-white/[0.04] border ${item.colorClass}`}>
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
            <span className="text-[11px] font-mono text-slate-400">CLICK ANY NODE TO INSPECT EVIDENCE</span>
          </div>

          {/* Desktop & Tablet Sequential Step Flow with Downward/Forward Arrows */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-2">
            {AUDIT_STEPS.map((s, idx) => {
              const isSelected = activeStep === s.step;
              const isPassed = activeStep > s.step;
              const Icon = s.icon;

              return (
                <React.Fragment key={s.step}>
                  <button
                    onClick={() => setActiveStep(s.step)}
                    className={`w-full lg:w-auto flex-1 p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
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
                              : "text-slate-500"
                        }`}
                      >
                        0{s.step}
                      </span>
                      {isPassed ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Icon className={`h-3 w-3 ${isSelected ? "text-cyan-400" : "text-slate-600"}`} />
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
                    <div className="flex items-center justify-center py-1 lg:py-0 lg:px-1">
                      <span
                        className={`text-sm font-bold font-mono transition-colors ${
                          activeStep > s.step
                            ? "text-emerald-400"
                            : activeStep === s.step
                              ? "text-cyan-400 animate-pulse"
                              : "text-slate-700"
                        }`}
                        title="Lineage transition"
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
        <div className="rounded-3xl bg-[#0d1117] border border-cyan-500/30 p-6 sm:p-10 relative overflow-hidden shadow-[0_0_80px_-20px_rgba(6,182,212,0.2)]">
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
              <span>CRYPTOGRAPHICALLY VERIFIED &amp; TAMPER-EVIDENT</span>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans">
              {cur.detail}
            </p>

            {/* Cryptographic SHA-256 Hash Chaining Block */}
            <div className="p-4 sm:p-5 rounded-2xl bg-black/70 border border-white/10 font-mono text-xs text-cyan-300 space-y-2.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase border-b border-white/5 pb-1.5">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                  IMMUTABLE HASH CHAIN LINK (BLOCK #{cur.step})
                </span>
                <button
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Copy className="h-3 w-3" />
                  <span>{copiedHash ? "COPIED" : "COPY HASH"}</span>
                </button>
              </div>

              <div className="space-y-1.5 pt-1 text-[11px]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 text-slate-400">
                  <span className="text-slate-500 shrink-0 font-bold">PREVIOUS_HASH:</span>
                  <span className="text-slate-300 truncate font-mono">{cur.prevHash}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 text-cyan-300">
                  <span className="text-cyan-500 shrink-0 font-bold">CURRENT_HASH:</span>
                  <span className="font-bold truncate font-mono">{cur.currentHash}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 text-slate-400 pt-1.5 border-t border-white/5">
                  <span className="text-slate-500 shrink-0 font-bold">PAYLOAD_PROOF:</span>
                  <span className="text-emerald-300 truncate font-mono">{cur.verification}</span>
                </div>
              </div>
            </div>

            {/* Governance Standard Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">
                  GOVERNANCE STANDARD
                </span>
                <span className="font-semibold text-white font-mono mt-1 block">
                  {cur.governance}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">
                  STATUTORY BASIS
                </span>
                <span className="font-semibold text-white font-mono mt-1 block truncate">
                  {cur.statute}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-300">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">
                  AUDIT PERSISTENCE
                </span>
                <span className="font-semibold text-white font-mono mt-1 block">
                  {cur.retention}
                </span>
              </div>
            </div>

            {/* Navigation Steppers & Portal Link */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  disabled={activeStep === 1}
                  onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>PREVIOUS NODE</span>
                </button>

                <button
                  disabled={activeStep === AUDIT_STEPS.length}
                  onClick={() => setActiveStep((prev) => Math.min(AUDIT_STEPS.length, prev + 1))}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
                >
                  <span>NEXT NODE</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <Link
                to="/reconciliation"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-200"
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
