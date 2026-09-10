import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  TrendingUp,
  ShieldCheck,
  DollarSign,
  Zap,
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Sparkles,
} from "lucide-react";

interface MetricStat {
  label: string;
  targetNum: number;
  prefix: string;
  suffix: string;
  decimals: number;
  subtitle: string;
  colorClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATS: MetricStat[] = [
  {
    label: "MONTHLY ENERGY SPEND",
    targetNum: 8.42,
    prefix: "R ",
    suffix: "M",
    decimals: 2,
    subtitle: "Aggregated monthly billing volume across reconciled enterprise facilities.",
    colorClass: "text-white border-white/10 hover:border-cyan-500/30",
    icon: Zap,
  },
  {
    label: "POTENTIAL RECOVERY",
    targetNum: 421.89,
    prefix: "R ",
    suffix: "K",
    decimals: 0,
    subtitle: "Average verifiable overcharge recovery identified per fiscal quarter.",
    colorClass: "text-emerald-300 border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50",
    icon: TrendingUp,
  },
  {
    label: "ACTIVE ANOMALIES",
    targetNum: 17,
    prefix: "",
    suffix: "",
    decimals: 0,
    subtitle: "High-impact determinant discrepancies quarantined for formal dispute resolution.",
    colorClass: "text-amber-300 border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50",
    icon: AlertCircle,
  },
  {
    label: "RECONCILED ACCURACY",
    targetNum: 98.7,
    prefix: "",
    suffix: "%",
    decimals: 1,
    subtitle: "Confidence score grounded in SANS 474 revenue metering ground truth.",
    colorClass: "text-cyan-300 border-cyan-500/30 bg-cyan-950/10 hover:border-cyan-500/50",
    icon: ShieldCheck,
  },
];

const PRESETS = [
  { label: "Light Industrial", value: 1_000_000 },
  { label: "Heavy Manufacturing", value: 5_000_000 },
  { label: "Mining / Multi-Site", value: 15_000_000 },
];

export function EneraImpactSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [countProgress, setCountProgress] = useState(0); // 0 to 1
  const [monthlySpend, setMonthlySpend] = useState<number>(5_000_000); // Default R 5M
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Smooth count-up animation loop
  useEffect(() => {
    if (!isVisible) return;
    if (prefersReducedMotion) {
      setCountProgress(1);
      return;
    }

    const duration = 1800;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCountProgress(eased);

      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    const handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [isVisible, prefersReducedMotion]);

  // Derived ROI calculations based on South African C&I benchmarks (5.1% avg recoverable variance)
  const { annualSpend, annualRecovery, quarterlyRecovery, breakdown } = useMemo(() => {
    const annual = monthlySpend * 12;
    const totalRecovery = annual * 0.051; // 5.1%
    const quarterly = totalRecovery / 4;

    return {
      annualSpend: annual,
      annualRecovery: totalRecovery,
      quarterlyRecovery: quarterly,
      breakdown: {
        demandRatchet: totalRecovery * 0.38,
        publicHoliday: totalRecovery * 0.24,
        multiplierError: totalRecovery * 0.22,
        powerFactor: totalRecovery * 0.16,
      },
    };
  }, [monthlySpend]);

  const formatZar = (amt: number) => {
    if (amt >= 1_000_000) {
      return `R ${(amt / 1_000_000).toFixed(2)}M`;
    }
    if (amt >= 1_000) {
      return `R ${Math.round(amt / 1_000).toLocaleString()}K`;
    }
    return `R ${Math.round(amt).toLocaleString()}`;
  };

  return (
    <section
      ref={sectionRef}
      id="insights"
      className="relative py-28 sm:py-32 bg-[#030712] text-white border-y border-white/5 overflow-hidden"
      aria-label="Executive ROI and Enterprise Impact"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-mono mb-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span className="tracking-wide">EXECUTIVE ROI // MEASURABLE ADVANTAGE</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            TURN ENERGY DATA INTO ADVANTAGE.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            Commercial and industrial enterprises lose an estimated <span className="text-emerald-300 font-medium">3% to 7%</span> of
            their annual electricity budget to unverified billing determinants, tariff misclassifications, and uncredited public holidays.
          </p>
        </div>

        {/* 4 Animated Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            const currentVal = (stat.targetNum * countProgress).toFixed(stat.decimals);

            return (
              <div
                key={stat.label}
                className={`rounded-2xl p-6 relative overflow-hidden transition-all duration-300 border bg-[#0d1117] shadow-lg hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col justify-between ${stat.colorClass}`}
              >
                <div>
                  <div className="flex items-center justify-between text-slate-400 pb-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
                      {stat.label}
                    </span>
                    <Icon className="h-4 w-4 text-cyan-400" />
                  </div>

                  <div className="text-3xl sm:text-4xl font-extrabold font-mono mt-3 tracking-tight">
                    <span>{stat.prefix}</span>
                    <span>{currentVal}</span>
                    <span>{stat.suffix}</span>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-400 leading-relaxed font-sans border-t border-white/5 pt-3">
                  {stat.subtitle}
                </p>
              </div>
            );
          })}
        </div>

        {/* Interactive Enterprise Savings Calculator */}
        <div className="mt-14 max-w-5xl mx-auto rounded-3xl bg-gradient-to-b from-[#0d1117] to-[#070b12] border border-cyan-500/25 p-6 sm:p-10 shadow-[0_0_80px_-20px_rgba(6,182,212,0.2)]">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white font-mono">
                  ENTERPRISE AUDIT ROI CALCULATOR
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Estimate verifiable overcharge recovery based on your monthly Eskom or municipal account spend.
                </p>
              </div>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setMonthlySpend(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    monthlySpend === p.value
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                      : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 items-center">
            {/* Left: Spend Input & Slider */}
            <div className="lg:col-span-6 space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                  <span>MONTHLY UTILITY SPEND (ZAR)</span>
                  <span className="text-cyan-400 font-bold">{formatZar(monthlySpend)} / month</span>
                </div>

                <input
                  type="range"
                  min={500_000}
                  max={25_000_000}
                  step={250_000}
                  value={monthlySpend}
                  onChange={(e) => setMonthlySpend(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  aria-label="Monthly spend slider"
                />

                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1.5">
                  <span>R 500K</span>
                  <span>R 10M</span>
                  <span>R 25M+</span>
                </div>
              </div>

              {/* Annualized Spend Summary */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>ANNUAL GROSS UTILITY BUDGET:</span>
                  <span className="text-white font-bold">{formatZar(annualSpend)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>ESTIMATED PAYBACK PERIOD:</span>
                  <span className="text-emerald-400 font-semibold">&lt; 14 Days</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>AUDIT READINESS SCORE:</span>
                  <span className="text-cyan-400 font-semibold">100% NERSA Verified</span>
                </div>
              </div>
            </div>

            {/* Right: Estimated Recoverable Yield */}
            <div className="lg:col-span-6 p-6 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-[#0b1319] to-cyan-950/20 border border-emerald-500/30 space-y-5">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                  PROJECTED ANNUAL OVERCHARGE RECOVERY (5.1% BENCHMARK)
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-300 mt-1.5 tracking-tight">
                  {formatZar(annualRecovery)}
                  <span className="text-xs font-mono font-normal text-emerald-400/80 ml-2">
                    ({formatZar(quarterlyRecovery)} / quarter)
                  </span>
                </div>
              </div>

              {/* 4 Determinant Breakdown Bars */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
                  HISTORICAL RECOVERY DISAGGREGATION
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">DEMAND SPIKES</span>
                    <span className="text-white font-semibold">{formatZar(breakdown.demandRatchet)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">PUBLIC HOLIDAYS</span>
                    <span className="text-white font-semibold">{formatZar(breakdown.publicHoliday)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">CT / MULTIPLIER DRIFT</span>
                    <span className="text-white font-semibold">{formatZar(breakdown.multiplierError)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">POWER FACTOR PENALTIES</span>
                    <span className="text-white font-semibold">{formatZar(breakdown.powerFactor)}</span>
                  </div>
                </div>
              </div>

              {/* Direct Ingestion Bridge CTA */}
              <div className="pt-2">
                <Link
                  to="/upload"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all group"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>UPLOAD YOUR FIRST INVOICE — RECOVER OVERCHARGES</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footnote */}
        <div className="mt-8 text-center text-xs font-mono text-slate-500">
          * Representative enterprise benchmark figures based on South African C&I manufacturing, cold-chain & mining audit portfolios.
        </div>
      </div>
    </section>
  );
}
