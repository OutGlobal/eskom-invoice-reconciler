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
  Sparkles,
  Info,
} from "lucide-react";

interface MetricStat {
  label: string;
  targetNum: number;
  prefix: string;
  suffix: string;
  decimals: number;
  subtitle: string;
  tag: string;
  colorClass: string;
  textGlowClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATS: MetricStat[] = [
  {
    label: "MONTHLY ENERGY SPEND",
    targetNum: 8.42,
    prefix: "R ",
    suffix: "M",
    decimals: 2,
    subtitle: "Illustrative monthly billing volume modeled for a high-voltage industrial facility.",
    tag: "SAMPLE BENCHMARK",
    colorClass: "border-white/10 hover:border-cyan-500/40 bg-[#0d1117]",
    textGlowClass: "text-white",
    icon: Zap,
  },
  {
    label: "POTENTIAL RECOVERY",
    targetNum: 421,
    prefix: "R ",
    suffix: "K",
    decimals: 0,
    subtitle: "Modeled verifiable overcharge recovery identified per fiscal quarter.",
    tag: "DEMO PROJECTION",
    colorClass:
      "border-emerald-500/30 bg-emerald-950/15 hover:border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]",
    textGlowClass: "text-emerald-300",
    icon: TrendingUp,
  },
  {
    label: "ACTIVE ANOMALIES",
    targetNum: 17,
    prefix: "",
    suffix: "",
    decimals: 0,
    subtitle: "Sample determinant discrepancies quarantined for regulatory review.",
    tag: "SYNTHETIC EXCEPTIONS",
    colorClass:
      "border-amber-500/30 bg-amber-950/15 hover:border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.1)]",
    textGlowClass: "text-amber-300",
    icon: AlertCircle,
  },
  {
    label: "RECONCILED",
    targetNum: 98.7,
    prefix: "",
    suffix: "%",
    decimals: 1,
    subtitle: "Benchmark confidence score grounded in SANS 474 check metering standards.",
    tag: "SIMULATED CONFIDENCE",
    colorClass:
      "border-cyan-500/30 bg-cyan-950/15 hover:border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.1)]",
    textGlowClass: "text-cyan-300",
    icon: ShieldCheck,
  },
];

const PRESETS = [
  { label: "Light Industrial", value: 1_000_000 },
  { label: "Heavy Manufacturing", value: 5_000_000 },
  { label: "Mining / Multi-Site", value: 15_000_000 },
];

export function EneraImpactSection() {
  const [hasEnteredViewport, setHasEnteredViewport] = useState<boolean>(false);
  const [countProgress, setCountProgress] = useState<number>(0); // 0 to 1
  const [monthlySpend, setMonthlySpend] = useState<number>(5_000_000); // Default R 5M demo
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Viewport trigger using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEnteredViewport(true);
        }
      },
      { threshold: 0.15 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Smooth count-up animation loop upon viewport entry
  useEffect(() => {
    if (!hasEnteredViewport) return;

    if (prefersReducedMotion) {
      setCountProgress(1);
      return;
    }

    const duration = 1800; // 1.8 seconds for smooth ease-out
    const startTime = performance.now();
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic: 1 - (1 - p)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      setCountProgress(eased);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [hasEnteredViewport, prefersReducedMotion]);

  // Derived ROI calculations based on South African C&I benchmarks (5.1% avg recoverable variance)
  const { annualSpend, annualRecovery, quarterlyRecovery, breakdown } = useMemo(() => {
    const annual = monthlySpend * 12;
    const totalRecovery = annual * 0.051; // 5.1% benchmark
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
      className="relative py-28 sm:py-36 bg-[#030712] text-white border-y border-white/5 overflow-hidden"
      aria-label="Financial Impact and Benchmark Statistics"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1050px] h-[600px] bg-emerald-500/5 rounded-full blur-[170px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-mono mb-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            <span className="tracking-wide uppercase">FINANCIAL IMPACT · RECOVERABLE ENTERPRISE LEAKAGE</span>
          </div>

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight enera-text-gradient leading-tight">
            TURN ENERGY DATA INTO ADVANTAGE.
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            Commercial and industrial enterprises lose an estimated{" "}
            <span className="text-emerald-300 font-medium">3% to 7%</span> of their annual
            electricity budget to unverified billing determinants, tariff misclassifications, and
            uncredited public holidays.
          </p>

          {/* Explicit Demonstration Notice Badge */}
          <div className="mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-400">
            <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>SAMPLE / DEMONSTRATION VALUES · NOT ACTUAL CUSTOMER STATISTICS</span>
          </div>
        </div>

        {/* 4 Animated Statistics Cards with Viewport-Triggered Count-Up */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            const animatedValue = (stat.targetNum * countProgress).toFixed(stat.decimals);

            return (
              <div
                key={stat.label}
                className={`rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all duration-300 border flex flex-col justify-between group hover:scale-[1.02] ${stat.colorClass}`}
              >
                <div>
                  {/* Top Bar with Tag & Icon */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                      {stat.tag}
                    </span>
                    <Icon className="h-4 w-4 text-slate-400 group-hover:text-cyan-300 transition-colors" />
                  </div>

                  {/* Prominent Large Number (Count-Up) */}
                  <div
                    className={`text-4xl sm:text-5xl font-black font-mono tracking-tight mt-5 ${stat.textGlowClass}`}
                  >
                    <span>{stat.prefix}</span>
                    <span>{animatedValue}</span>
                    <span>{stat.suffix}</span>
                  </div>

                  {/* Clean Statistic Label */}
                  <div className="text-xs sm:text-sm font-mono font-bold text-slate-200 uppercase tracking-wider mt-2">
                    {stat.label}
                  </div>
                </div>

                {/* Subtitle / Context Note */}
                <p className="mt-6 text-xs text-slate-400 leading-relaxed font-sans border-t border-white/5 pt-3.5">
                  {stat.subtitle}
                </p>
              </div>
            );
          })}
        </div>

        {/* Interactive Demonstration ROI Calculator Widget */}
        <div className="mt-16 max-w-5xl mx-auto rounded-3xl bg-gradient-to-b from-[#0d1117] to-[#070b12] border border-cyan-500/25 p-6 sm:p-10 shadow-[0_0_80px_-20px_rgba(6,182,212,0.2)]">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Calculator className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white font-mono">
                  ENTERPRISE AUDIT ESTIMATOR (SIMULATION MODEL)
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Calculate projected overcharge recoveries based on sample commercial electricity
                  tariffs.
                </p>
              </div>
            </div>

            {/* Benchmark Spend Presets */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Spend benchmark presets"
            >
              {PRESETS.map((p) => {
                const isActive = monthlySpend === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setMonthlySpend(p.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all focus-ring-enera ${
                      isActive
                        ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                        : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 items-center">
            {/* Left Column: Spend Slider Input */}
            <div className="lg:col-span-6 space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                  <label htmlFor="spend-slider" id="spend-slider-label">
                    SAMPLE MONTHLY UTILITY SPEND
                  </label>
                  <span className="text-cyan-400 font-bold text-sm" aria-live="polite">
                    {formatZar(monthlySpend)} / mo
                  </span>
                </div>

                <input
                  id="spend-slider"
                  type="range"
                  min={500_000}
                  max={25_000_000}
                  step={250_000}
                  value={monthlySpend}
                  aria-labelledby="spend-slider-label"
                  aria-valuenow={monthlySpend}
                  aria-valuemin={500_000}
                  aria-valuemax={25_000_000}
                  aria-valuetext={`${formatZar(monthlySpend)} per month`}
                  onChange={(e) => setMonthlySpend(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus-ring-enera"
                />

                <div
                  className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5"
                  aria-hidden="true"
                >
                  <span>R 500K</span>
                  <span>R 10M</span>
                  <span>R 25M+</span>
                </div>
              </div>

              {/* Annual Summary Box */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>ANNUALIZED SAMPLE UTILITY EXPENDITURE:</span>
                  <span className="text-white font-bold">{formatZar(annualSpend)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TYPICAL AUDIT PAYBACK PERIOD:</span>
                  <span className="text-emerald-400 font-semibold">&lt; 14 Business Days</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>REGULATORY METHODOLOGY:</span>
                  <span className="text-cyan-400 font-semibold">100% NERSA Gazette Aligned</span>
                </div>
              </div>
            </div>

            {/* Right Column: Estimated Recovery Breakdown */}
            <div
              aria-live="polite"
              className="lg:col-span-6 p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-[#0b1319] to-cyan-950/20 border border-emerald-500/30 space-y-5"
            >
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold block">
                  PROJECTED ANNUAL RECOVERY (5.1% BENCHMARK SAMPLE)
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-300 mt-1.5 tracking-tight">
                  {formatZar(annualRecovery)}
                  <span className="text-xs font-mono font-normal text-emerald-400/80 ml-2">
                    ({formatZar(quarterlyRecovery)} / quarter)
                  </span>
                </div>
              </div>

              {/* Determinant Disaggregation */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
                  SAMPLE RECOVERY BY BILLING DETERMINANT
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">DEMAND SPIKES</span>
                    <span className="text-white font-semibold">
                      {formatZar(breakdown.demandRatchet)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">PUBLIC HOLIDAYS</span>
                    <span className="text-white font-semibold">
                      {formatZar(breakdown.publicHoliday)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">CT / MULTIPLIER DRIFT</span>
                    <span className="text-white font-semibold">
                      {formatZar(breakdown.multiplierError)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-slate-400 text-[10px] block">POWER FACTOR SURCHARGE</span>
                    <span className="text-white font-semibold">
                      {formatZar(breakdown.powerFactor)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Link to Upload Gateway */}
              <div className="pt-2">
                <Link
                  to="/upload"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all group focus-ring-enera"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>AUDIT YOUR FIRST REAL INVOICE WITH ENERA</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Legal / Demo Footnote */}
        <div className="mt-8 text-center text-xs font-mono text-slate-400 max-w-2xl mx-auto leading-relaxed">
          * Disclaimer: The statistics above reflect sample demonstration values based on an
          illustrative benchmark dataset modeled from South African C&I manufacturing, cold-chain,
          and mining profiles. They do not claim to represent any specific real customer
          confidential data.
        </div>
      </div>
    </section>
  );
}
