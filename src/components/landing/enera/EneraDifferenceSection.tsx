import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Scale,
  ArrowRight,
  TrendingDown,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export function EneraDifferenceSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [activeMetric, setActiveMetric] = useState<"active" | "demand" | "reactive">("active");

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Viewport intersection observer to trigger animated counting
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Datasets (Default is the exact required Active Energy: 4,218,441 vs 4,087,214 = 131,227 / R 51,227)
  const METRIC_DATA = {
    active: {
      unit: "kWh",
      billedVal: 4218441,
      actualVal: 4087214,
      varianceVal: 131227,
      billedDisplay: "4,218,441",
      actualDisplay: "4,087,214",
      varianceDisplay: "131,227",
      financialImpact: "R 51,227",
      label: "Active Energy",
    },
    demand: {
      unit: "kVA",
      billedVal: 8421,
      actualVal: 7940,
      varianceVal: 481,
      billedDisplay: "8,421",
      actualDisplay: "7,940",
      varianceDisplay: "481",
      financialImpact: "R 46,176",
      label: "Maximum Demand",
    },
    reactive: {
      unit: "kVArh",
      billedVal: 342100,
      actualVal: 112040,
      varianceVal: 230060,
      billedDisplay: "342,100",
      actualDisplay: "112,040",
      varianceDisplay: "230,060",
      financialImpact: "R 28,758",
      label: "Reactive Energy",
    },
  };

  const cur = METRIC_DATA[activeMetric];

  // Number animation counters
  const [billedCounter, setBilledCounter] = useState(0);
  const [actualCounter, setActualCounter] = useState(0);
  const [varianceCounter, setVarianceCounter] = useState(0);
  const [impactCounter, setImpactCounter] = useState(0);
  const [stage, setStage] = useState<number>(reducedMotion ? 3 : 0);

  useEffect(() => {
    if (reducedMotion) {
      setBilledCounter(cur.billedVal);
      setActualCounter(cur.actualVal);
      setVarianceCounter(cur.varianceVal);
      setImpactCounter(51227);
      setStage(3);
      return;
    }

    if (!isVisible) return;

    // Reset counters on tab change or visibility trigger
    setBilledCounter(0);
    setActualCounter(0);
    setVarianceCounter(0);
    setImpactCounter(0);
    setStage(1);

    const duration = 1600;
    let startTimestamp: number | null = null;
    let activeRafId: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      setBilledCounter(Math.floor(ease * cur.billedVal));
      setActualCounter(Math.floor(ease * cur.actualVal));

      if (progress < 1) {
        activeRafId = requestAnimationFrame(step);
      } else {
        setBilledCounter(cur.billedVal);
        setActualCounter(cur.actualVal);
        setStage(2);

        // Sequence: Then Variance reveals and counts up
        let vStart: number | null = null;
        const vStep = (vTimestamp: number) => {
          if (!vStart) vStart = vTimestamp;
          const vElapsed = vTimestamp - vStart;
          const vProgress = Math.min(vElapsed / 900, 1);
          const vEase = 1 - Math.pow(1 - vProgress, 3);

          setVarianceCounter(Math.floor(vEase * cur.varianceVal));

          if (vProgress < 1) {
            activeRafId = requestAnimationFrame(vStep);
          } else {
            setVarianceCounter(cur.varianceVal);
            setStage(3);

            // Sequence: Then Potential Financial Impact reveals
            let fStart: number | null = null;
            const targetMoney =
              activeMetric === "active" ? 51227 : activeMetric === "demand" ? 46176 : 28758;
            const fStep = (fTimestamp: number) => {
              if (!fStart) fStart = fTimestamp;
              const fElapsed = fTimestamp - fStart;
              const fProgress = Math.min(fElapsed / 800, 1);
              const fEase = 1 - Math.pow(1 - fProgress, 3);
              setImpactCounter(Math.floor(fEase * targetMoney));
              if (fProgress < 1) {
                activeRafId = requestAnimationFrame(fStep);
              } else {
                setImpactCounter(targetMoney);
              }
            };
            activeRafId = requestAnimationFrame(fStep);
          }
        };
        activeRafId = requestAnimationFrame(vStep);
      }
    };

    activeRafId = requestAnimationFrame(step);

    return () => {
      if (activeRafId) cancelAnimationFrame(activeRafId);
    };
  }, [isVisible, activeMetric, reducedMotion, cur.actualVal, cur.billedVal, cur.varianceVal]);

  return (
    <section
      ref={sectionRef}
      id="reconciliation"
      className="relative py-28 sm:py-36 bg-[#030712] text-white overflow-hidden border-t border-white/5"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/3 w-[650px] h-[650px] rounded-full bg-cyan-500/[0.04] blur-[160px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/3 w-[650px] h-[650px] rounded-full bg-amber-500/[0.03] blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-5 shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)]">
            <Scale className="h-3.5 w-3.5" />
            <span className="tracking-widest uppercase font-semibold">
              DETERMINISTIC GROUND TRUTH · BILLED VS CONSUMED
            </span>
          </div>

          {/* Title: FIND THE DIFFERENCE. */}
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-none font-sans">
            FIND THE DIFFERENCE.
          </h2>

          <p className="mt-5 text-base sm:text-xl text-slate-400 font-light max-w-xl mx-auto">
            When utility billing determinants meet certified meter intervals, overcharges have
            nowhere to hide.
          </p>

          {/* Metric Selector Tabs */}
          <div
            role="tablist"
            aria-label="Reconciliation metric comparison selector"
            className="mt-8 inline-flex max-w-full overflow-x-auto scrollbar-none items-center p-1 rounded-xl bg-[#0d1117]/80 border border-white/10 backdrop-blur-md"
          >
            {(["active", "demand", "reactive"] as const).map((tab) => {
              const isSelected = activeMetric === tab;
              return (
                <button
                  key={tab}
                  role="tab"
                  id={`metric-tab-${tab}`}
                  aria-selected={isSelected}
                  aria-controls={`metric-panel-${tab}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveMetric(tab)}
                  className={`px-3 sm:px-4 py-1.5 text-xs font-mono rounded-lg transition-all shrink-0 focus-ring-enera ${
                    isSelected
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <span className="sm:hidden">
                    {tab === "active" ? "Active" : tab === "demand" ? "Demand" : "Reactive"}
                  </span>
                  <span className="hidden sm:inline">
                    {tab === "active"
                      ? "Active Energy (kWh)"
                      : tab === "demand"
                        ? "Max Demand (kVA)"
                        : "Reactive Energy (kVArh)"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. Two Large Values: BILLED versus ACTUAL */}
        <div
          role="tabpanel"
          id={`metric-panel-${activeMetric}`}
          aria-labelledby={`metric-tab-${activeMetric}`}
          aria-live="polite"
          className="mt-14 max-w-5xl mx-auto"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch relative">
            {/* BILLED Card */}
            <div className="group relative rounded-3xl bg-[#0d1117]/90 border border-white/10 p-7 sm:p-10 flex flex-col justify-between shadow-2xl enera-glass hover:border-white/20 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-mono font-bold tracking-[0.25em] text-slate-400 uppercase">
                  BILLED
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold">
                  UTILITY INVOICE
                </span>
              </div>

              <div className="my-8">
                {/* Large animated value */}
                <div className="text-4xl sm:text-6xl md:text-7xl font-extrabold font-mono text-white tracking-tight leading-none drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                  {billedCounter.toLocaleString()}
                </div>
                <div className="text-lg sm:text-2xl font-mono text-slate-400 mt-2 font-semibold tracking-wider">
                  {cur.unit}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>ACCOUNT: 9021-4819-2041</span>
                <span>RATE MULTIPLIER STATED</span>
              </div>
            </div>

            {/* Visual Comparison Bridge (Desktop Central Indicator) */}
            <div
              aria-hidden="true"
              className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-[#030712] border border-cyan-500/40 items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.4)]"
            >
              <span className="text-xs font-mono font-extrabold text-cyan-300">VS</span>
            </div>

            {/* ACTUAL Card */}
            <div className="group relative rounded-3xl bg-gradient-to-br from-[#0d1117] via-[#0d1117] to-cyan-950/30 border border-cyan-500/40 p-7 sm:p-10 flex flex-col justify-between shadow-[0_0_50px_-10px_rgba(6,182,212,0.2)] enera-glass hover:border-cyan-500/60 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
                <span className="text-xs font-mono font-bold tracking-[0.25em] text-cyan-300 uppercase">
                  ACTUAL
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
                  AMR GROUND TRUTH
                </span>
              </div>

              <div className="my-8">
                {/* Large animated value */}
                <div className="text-4xl sm:text-6xl md:text-7xl font-extrabold font-mono text-cyan-300 tracking-tight leading-none drop-shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                  {actualCounter.toLocaleString()}
                </div>
                <div className="text-lg sm:text-2xl font-mono text-cyan-400/90 mt-2 font-semibold tracking-wider">
                  {cur.unit}
                </div>
              </div>

              <div className="pt-4 border-t border-cyan-500/20 flex items-center justify-between text-xs font-mono text-cyan-400/80">
                <span>METER ID: 021-MS-90412</span>
                <span>1,488 HALF-HOUR INTERVALS</span>
              </div>
            </div>
          </div>

          {/* 2. Elegant SVG Visual Connection Between the Two Datasets */}
          <div className="my-6 flex justify-center" aria-hidden="true">
            <svg
              className="w-full max-w-lg h-16 overflow-visible pointer-events-none"
              viewBox="0 0 400 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="streamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="1" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.4" />
                </linearGradient>
                <filter id="laserGlow">
                  <feGaussianBlur stdDeviation="3" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Converging Stream Lines from Billed & Actual to Variance */}
              <path
                d="M 60 5 C 60 40, 170 50, 200 55"
                stroke="#f43f5e"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="opacity-60"
              />
              <path
                d="M 340 5 C 340 40, 230 50, 200 55"
                stroke="#22d3ee"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="opacity-60"
              />

              {/* Central Differential Node */}
              <circle cx="200" cy="55" r="5" fill="#f59e0b" filter="url(#laserGlow)" />
              <circle
                cx="200"
                cy="55"
                r="10"
                stroke="#f59e0b"
                strokeWidth="1"
                className="animate-ping opacity-75"
              />
            </svg>
          </div>

          {/* 3. The Reconciled Output: 131,227 kWh VARIANCE + Potential financial impact R 51,227 */}
          <div
            className={`rounded-3xl bg-[#0d1117]/95 border border-amber-500/50 p-6 sm:p-10 shadow-[0_0_50px_-5px_rgba(245,158,11,0.25)] flex flex-col md:flex-row items-center justify-between gap-8 transition-all duration-700 ${
              stage >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {/* Left Chamber: 131,227 kWh VARIANCE */}
            <div className="text-center md:text-left space-y-1.5">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
                <span className="text-xs font-mono font-bold tracking-[0.25em] text-amber-400 uppercase">
                  UNRECONCILED DISCREPANCY ISOLATED
                </span>
              </div>

              {/* The Discrepancy Number */}
              <div className="text-4xl sm:text-5xl md:text-6xl font-extrabold font-mono text-amber-300 tracking-tight leading-none drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                {varianceCounter.toLocaleString()}{" "}
                <span className="text-2xl sm:text-3xl text-amber-400/80">{cur.unit}</span>
              </div>

              <div className="text-sm sm:text-base font-mono uppercase tracking-[0.3em] text-amber-400 font-bold pt-1">
                VARIANCE
              </div>
            </div>

            {/* Right Chamber: Potential financial impact R 51,227 */}
            <div
              className={`w-full md:w-auto rounded-2xl bg-emerald-950/30 border border-emerald-500/40 p-5 sm:p-6 text-center md:text-right shadow-[0_0_35px_-5px_rgba(16,185,129,0.25)] transition-all duration-700 ${
                stage >= 3 ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
            >
              <span className="text-xs font-mono font-semibold tracking-wider text-slate-300 uppercase block">
                Potential financial impact
              </span>

              <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-mono text-emerald-300 mt-1.5 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                {activeMetric === "active"
                  ? `R ${impactCounter.toLocaleString()}`
                  : cur.financialImpact}
              </div>

              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 font-semibold">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>Audited Overcharge Recovery Dossier Ready</span>
              </div>
            </div>
          </div>

          {/* Action Link to Live Reconciliation Workflow */}
          <div className="mt-8 flex justify-center">
            <Link
              to="/reconciliation"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 transition-all text-xs font-mono font-medium group focus-ring-enera"
            >
              <Scale className="h-4 w-4 text-cyan-400" />
              <span>Explore Live 14-Determinant Reconciliation Engine</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
