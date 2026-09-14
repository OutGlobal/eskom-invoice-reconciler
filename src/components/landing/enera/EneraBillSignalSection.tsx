import React, { useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Gauge,
  Activity,
  Sliders,
  ShieldCheck,
  ArrowRight,
  Layers,
} from "lucide-react";

interface DeterminantItem {
  id: string;
  name: string;
  category: string;
  invoiceDisplay: {
    label: string;
    value: string;
    limitation: string;
  };
  eneraDisplay: {
    label: string;
    value: string;
    resolution: string;
    status: "verified" | "variance" | "monitored";
    statutoryRule: string;
  };
}

const DETERMINANTS: DeterminantItem[] = [
  {
    id: "consumption",
    name: "Active Energy (kWh)",
    category: "TIME-OF-USE ENERGY",
    invoiceDisplay: {
      label: "Total Aggregated Active Energy",
      value: "4,218,441 kWh",
      limitation: "Single monthly total without half-hour interval distribution across Peak, Standard, and Off-Peak windows.",
    },
    eneraDisplay: {
      label: "Reconciled Interval Spectrum",
      value: "4,087,214 kWh Reconciled",
      resolution: "1,488 30-minute AMR interval registers cross-referenced against NERSA TOU calendars.",
      status: "variance",
      statutoryRule: "NERSA Megaflex TOU Distribution Gazette 2025/26",
    },
  },
  {
    id: "demand",
    name: "Maximum Demand (kVA)",
    category: "CAPACITY CHARGES",
    invoiceDisplay: {
      label: "Billed Peak Demand",
      value: "8,421 kVA",
      limitation: "Peak kVA registered on invoice with zero timestamp visibility or confirmation of ratchet period.",
    },
    eneraDisplay: {
      label: "Validated Demand Peak",
      value: "8,014 kVA (Peak at 18:30 on 14 July)",
      resolution: "Exact half-hour window identified. 407 kVA discrepancy isolated against utility ratchet baseline.",
      status: "variance",
      statutoryRule: "Eskom Transmission Tariff Rules Sec. 4.2",
    },
  },
  {
    id: "reactive",
    name: "Reactive Energy (kVArh)",
    category: "POWER FACTOR PENALTIES",
    invoiceDisplay: {
      label: "Excess Reactive Surcharge",
      value: "R 18,420.00 Surcharge",
      limitation: "Aggregate penalty applied without indication of capacitive vs inductive leading/lagging intervals.",
    },
    eneraDisplay: {
      label: "Power Factor Vector Breakdown",
      value: "0.94 PF Monitored (R 0.00 justified)",
      resolution: "Deterministic 30-min vector audit reveals power factor remained within statutory 0.92 limit.",
      status: "verified",
      statutoryRule: "Grid Code for System Operation (SA Grid Code v4.1)",
    },
  },
  {
    id: "tariffs",
    name: "Tariff Determinants",
    category: "REGULATORY COMPLIANCE",
    invoiceDisplay: {
      label: "Applied Rate Code",
      value: "Megaflex Transmission >66kV",
      limitation: "Multi-layered rate blocks billed without verification of annual gazetted municipal or Eskom adjustments.",
    },
    eneraDisplay: {
      label: "Gazette Rate Verification",
      value: "Exact 2025/26 Gazette Verified",
      resolution: "Deterministic engine validates network access charge, reliability service charge, and ancillary levies.",
      status: "verified",
      statutoryRule: "Electricity Regulation Act No. 4 of 2006",
    },
  },
];

export function EneraBillSignalSection() {
  const [selectedId, setSelectedId] = useState<string>("consumption");

  const current = DETERMINANTS.find((d) => d.id === selectedId) || DETERMINANTS[0];

  return (
    <section
      id="how-it-works"
      className="relative py-24 sm:py-32 bg-[#05080f] text-white border-t border-white/10 overflow-hidden scroll-mt-12"
      aria-label="How ENERA Works — Deterministic Signal Decomposition"
    >
      {/* Backwards-compatible anchor */}
      <div id="signal" className="sr-only" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          HOW IT WORKS
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          Every utility bill has an underlying signal.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-12">
          Traditional utility statements lump complex charges into opaque totals. ENERA decodes raw 30-minute interval telemetry to verify every determinant against statutory regulatory schedules.
        </p>

        {/* 4. Visual or capability: Determinant Switcher Tabs & Side-by-Side Comparison */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">

          {DETERMINANTS.map((det) => {
            const isSelected = det.id === selectedId;
            return (
              <button
                key={det.id}
                type="button"
                onClick={() => setSelectedId(det.id)}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition-all border shrink-0 flex items-center gap-2 ${
                  isSelected
                    ? "bg-cyan-950/40 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm"
                    : "bg-[#0b101b] text-slate-400 border-white/5 hover:text-white hover:border-white/20"
                }`}
              >
                <span>{det.name}</span>
                {det.eneraDisplay.status === "variance" ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Variance detected" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Verified" />
                )}
              </button>
            );
          })}
        </div>

        {/* Side-by-Side Comparison Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          {/* Card 1: Traditional Opaque Bill */}
          <div className="rounded-xl bg-[#090d16] border border-white/10 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">
                      Traditional Utility Invoice
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">AGGREGATED SUMMARY VIEW</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Opaque
                </span>
              </div>

              <div className="space-y-6">
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    {current.invoiceDisplay.label}
                  </span>
                  <div className="text-2xl sm:text-3xl font-mono font-semibold text-slate-200">
                    {current.invoiceDisplay.value}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400/90 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-300 block mb-1">
                        Inherent Visibility Gap
                      </span>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {current.invoiceDisplay.limitation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>SOURCE: STANDARD MONTHLY PDF</span>
              <span>NO AUDIT TRAIL</span>
            </div>
          </div>

          {/* Card 2: ENERA Ground-Truth Telemetry */}
          <div className="rounded-xl bg-[#09111e] border border-cyan-500/25 p-6 sm:p-8 flex flex-col justify-between relative shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">
                      ENERA Deterministic Engine
                    </h3>
                    <p className="text-[11px] font-mono text-cyan-400">AMR GROUND-TRUTH RECONCILIATION</p>
                  </div>
                </div>
                {current.eneraDisplay.status === "variance" ? (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">
                    Variance Isolated
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Verified Match
                  </span>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    {current.eneraDisplay.label}
                  </span>
                  <div className="text-2xl sm:text-3xl font-mono font-semibold text-cyan-300">
                    {current.eneraDisplay.value}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-black/40 border border-cyan-500/15">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block mb-1">
                        High-Resolution Deterministic Proof
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {current.eneraDisplay.resolution}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-cyan-500/15 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="text-cyan-400/90 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{current.eneraDisplay.statutoryRule}</span>
              </span>
              <span className="text-emerald-400">CRYPTOGRAPHIC AUDIT TRAIL</span>
            </div>
          </div>
        </div>

        {/* Bottom Insight Bar */}
        <div className="mt-8 p-5 rounded-xl bg-[#080d16] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs sm:text-sm text-slate-300 font-sans">
              Reconciling across <strong className="text-white font-medium">1,488 half-hour AMR intervals</strong> isolates discrepancies that traditional accounts payable workflows miss completely.
            </span>
          </div>

          <a
            href="#reconciliation"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors shrink-0 focus-ring-enera"
          >
            <span>Examine Reconciliation Case</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
