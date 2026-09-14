import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Scale,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Zap,
  Gauge,
  Activity,
} from "lucide-react";

type MetricKey = "active" | "demand" | "reactive";

interface TOUIntervalRow {
  window: string;
  billed: string;
  actual: string;
  variance: string;
  rate: string;
  financialImpact: string;
}

interface ReconciliationDataSet {
  id: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  billedSummary: string;
  actualSummary: string;
  varianceSummary: string;
  impactSummary: string;
  accountReference: string;
  meterReference: string;
  statutoryNotice: string;
  rows: TOUIntervalRow[];
}

const RECONCILIATION_DATA: Record<MetricKey, ReconciliationDataSet> = {
  active: {
    id: "active",
    label: "Active Energy (kWh)",
    shortLabel: "Active Energy",
    unit: "kWh",
    icon: Zap,
    billedSummary: "4,218,441",
    actualSummary: "4,087,214",
    varianceSummary: "131,227",
    impactSummary: "R 51,227",
    accountReference: "Synthetic Account: SYN-01",
    meterReference: "Synthetic Interval Feed (1,488 Intervals)",
    statutoryNotice: "NERSA Megaflex Schedule 2 — High Season TOU Gazette 2025/26",
    rows: [
      {
        window: "Peak Hours (06:00-09:00, 17:00-19:00)",
        billed: "892,100 kWh",
        actual: "854,200 kWh",
        variance: "37,900 kWh",
        rate: "R 4.1284 / kWh",
        financialImpact: "R 24,180",
      },
      {
        window: "Standard Hours (09:00-17:00, 19:00-22:00)",
        billed: "1,642,300 kWh",
        actual: "1,598,110 kWh",
        variance: "44,190 kWh",
        rate: "R 1.4820 / kWh",
        financialImpact: "R 18,914",
      },
      {
        window: "Off-Peak Hours (22:00-06:00, Weekends)",
        billed: "1,684,041 kWh",
        actual: "1,634,904 kWh",
        variance: "49,137 kWh",
        rate: "R 0.8912 / kWh",
        financialImpact: "R 8,133",
      },
    ],
  },
  demand: {
    id: "demand",
    label: "Maximum Demand (kVA)",
    shortLabel: "Max Demand",
    unit: "kVA",
    icon: Gauge,
    billedSummary: "8,421",
    actualSummary: "7,940",
    varianceSummary: "481",
    impactSummary: "R 46,176",
    accountReference: "Synthetic Account: SYN-01",
    meterReference: "Synthetic Interval Feed (Peak 14 Jul 18:30)",
    statutoryNotice: "Eskom Transmission Tariff Rules — Section 4.2 Demand Assessment",
    rows: [
      {
        window: "Registered Monthly Peak (14 Jul 18:30)",
        billed: "8,421 kVA",
        actual: "7,940 kVA",
        variance: "481 kVA",
        rate: "R 96.00 / kVA",
        financialImpact: "R 46,176",
      },
      {
        window: "Historical 12-Month Ratchet Baseline",
        billed: "8,200 kVA (Over-ratcheted)",
        actual: "7,940 kVA Verified",
        variance: "260 kVA",
        rate: "Ratchet Factor 0.70",
        financialImpact: "Protected",
      },
    ],
  },
  reactive: {
    id: "reactive",
    label: "Reactive Energy (kVArh)",
    shortLabel: "Reactive Energy",
    unit: "kVArh",
    icon: Activity,
    billedSummary: "342,100",
    actualSummary: "112,040",
    varianceSummary: "230,060",
    impactSummary: "R 28,758",
    accountReference: "Synthetic Account: SYN-01",
    meterReference: "Synthetic Interval Feed (Vector Sum)",
    statutoryNotice: "SA Grid Code v4.1 — Deterministic Power Factor Compliance",
    rows: [
      {
        window: "Billed Reactive Energy Surcharge",
        billed: "342,100 kVArh",
        actual: "112,040 kVArh",
        variance: "230,060 kVArh",
        rate: "R 0.1250 / kVArh",
        financialImpact: "R 28,758",
      },
      {
        window: "Effective Power Factor Ratio",
        billed: "0.88 Lagging (Penalty)",
        actual: "0.94 Compliant",
        variance: "+0.06 PF",
        rate: "Threshold ≥0.92",
        financialImpact: "Full Waiver",
      },
    ],
  },
};

export function EneraDifferenceSection() {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("active");
  const dataset = RECONCILIATION_DATA[activeMetric];

  return (
    <section
      id="reconciliation"
      className="relative py-24 sm:py-32 bg-[#030712] text-white border-t border-white/10 overflow-hidden scroll-mt-12"
      aria-label="Deterministic Reconciliation Ledger"
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          RECONCILIATION
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          Find the difference.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-8">
          Deterministic line-item comparison between billed utility registers and raw half-hour AMR telemetry to isolate unearned charges before settlement.
        </p>

        {/* Metric Selector Pills */}
        <div className="mb-10 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {(["active", "demand", "reactive"] as const).map((key) => {
              const item = RECONCILIATION_DATA[key];
              const isSelected = activeMetric === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMetric(key)}
                  className={`px-4 py-2 rounded-lg text-xs font-mono transition-all border shrink-0 flex items-center gap-2 ${
                    isSelected
                      ? "bg-cyan-950/40 text-cyan-300 border-cyan-500/40 font-semibold"
                      : "bg-[#0b101b] text-slate-400 border-white/5 hover:text-white hover:border-white/20"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

        {/* Top Quantitative Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* 1. Billed Card */}
          <div className="rounded-xl bg-[#090d16] border border-white/10 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Billed Register
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase px-1.5 py-0.5 rounded bg-white/5">
                Invoice
              </span>
            </div>
            <div className="my-4">
              <div className="text-3xl sm:text-4xl font-mono font-semibold text-slate-200">
                {dataset.billedSummary}
              </div>
              <span className="text-xs font-mono text-slate-400 mt-1 block">
                {dataset.unit}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 truncate">
              {dataset.accountReference}
            </span>
          </div>

          {/* 2. Actual Ground Truth Card */}
          <div className="rounded-xl bg-[#09111e] border border-cyan-500/25 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                AMR Ground Truth
              </span>
              <span className="text-[10px] font-mono text-emerald-400 uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-semibold">
                Verified
              </span>
            </div>
            <div className="my-4">
              <div className="text-3xl sm:text-4xl font-mono font-semibold text-cyan-300">
                {dataset.actualSummary}
              </div>
              <span className="text-xs font-mono text-cyan-400/80 mt-1 block">
                {dataset.unit}
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400/70 truncate">
              {dataset.meterReference}
            </span>
          </div>

          {/* 3. Variance Card */}
          <div className="rounded-xl bg-[#140f09] border border-amber-500/30 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
                Isolated Variance
              </span>
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="my-4">
              <div className="text-3xl sm:text-4xl font-mono font-semibold text-amber-300">
                {dataset.varianceSummary}
              </div>
              <span className="text-xs font-mono text-amber-400/80 mt-1 block">
                {dataset.unit} Discrepancy
              </span>
            </div>
            <span className="text-[10px] font-mono text-amber-400/70">
              UNRECONCILED DELTA
            </span>
          </div>

          {/* 4. Financial Impact Card */}
          <div className="rounded-xl bg-[#091612] border border-emerald-500/30 p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                Financial Impact
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="my-4">
              <div className="text-3xl sm:text-4xl font-mono font-semibold text-emerald-300">
                {dataset.impactSummary}
              </div>
              <span className="text-xs font-mono text-emerald-400/80 mt-1 block">
                Potential Overcharge
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400/80">
              RECOVERY DOSSIER GENERATED
            </span>
          </div>
        </div>

        {/* Detailed Deterministic Breakdown Table */}
        <div className="rounded-xl bg-[#0a0e17] border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200">
                Granular Interval Determinant Breakdown
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {dataset.statutoryNotice}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-black/40 text-slate-400">
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider text-[10px]">
                    Tariff Interval Window
                  </th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider text-[10px]">
                    Billed Register
                  </th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider text-[10px]">
                    AMR Actual
                  </th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider text-[10px]">
                    Variance
                  </th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider text-[10px]">
                    Gazetted Tariff
                  </th>
                  <th className="py-3 px-6 font-semibold uppercase tracking-wider text-[10px] text-right">
                    Variance Impact
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {dataset.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-6 font-medium text-white">{row.window}</td>
                    <td className="py-3.5 px-6 text-slate-300">{row.billed}</td>
                    <td className="py-3.5 px-6 text-cyan-300 font-semibold">{row.actual}</td>
                    <td className="py-3.5 px-6 text-amber-300 font-semibold">{row.variance}</td>
                    <td className="py-3.5 px-6 text-slate-400">{row.rate}</td>
                    <td className="py-3.5 px-6 text-right font-semibold text-emerald-300">
                      {row.financialImpact}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Deterministic Verification Complete • NERSA Tariff Gazette 2025/26 Ref. #ZA-NR-25</span>
            </div>

            <Link
              to="/reconciliation"
              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera"
            >
              <span>Launch Comprehensive Reconciliation Studio</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
