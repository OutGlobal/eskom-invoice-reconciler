import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Scale,
  TrendingUp,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Download,
  Calendar,
  Building,
  Zap,
  Clock,
  ShieldCheck,
} from "lucide-react";

type PreviewTab = "dashboard" | "reconciliation" | "trends" | "anomalies" | "reporting";

interface TabConfig {
  id: PreviewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const TABS: TabConfig[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "reconciliation", label: "Billing Reconciliation", icon: Scale, badge: "R 53.3k Variance" },
  { id: "trends", label: "Energy Trends", icon: TrendingUp },
  { id: "anomalies", label: "Anomaly Insight", icon: AlertTriangle, badge: "2 Flagged" },
  { id: "reporting", label: "Reporting", icon: FileCheck },
];

const INTERVAL_BARS = [
  { h: 30, t: "off" }, { h: 28, t: "off" }, { h: 32, t: "off" }, { h: 35, t: "off" },
  { h: 42, t: "std" }, { h: 58, t: "std" }, { h: 88, t: "peak" }, { h: 96, t: "peak" },
  { h: 92, t: "peak" }, { h: 72, t: "std" }, { h: 68, t: "std" }, { h: 65, t: "std" },
  { h: 64, t: "std" }, { h: 62, t: "std" }, { h: 60, t: "std" }, { h: 66, t: "std" },
  { h: 82, t: "peak" }, { h: 90, t: "peak" }, { h: 78, t: "peak" }, { h: 52, t: "std" },
  { h: 44, t: "std" }, { h: 38, t: "off" }, { h: 34, t: "off" }, { h: 30, t: "off" },
];

export function EneraProductInterfacePreviewSection() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("dashboard");
  const [hasEnteredViewport, setHasEnteredViewport] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [transitionView, setTransitionView] = useState<"raw" | "transition" | "insight">("insight");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    if (mq.matches) {
      setHasEnteredViewport(true);
    }
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEnteredViewport(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);

    return () => {
      mq.removeEventListener("change", handler);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      id="interface-previews"
      className="py-24 sm:py-32 bg-[#0c121e] text-white border-t border-slate-800/80 font-sans scroll-mt-12"
      aria-label="Product Interface Previews"
    >
      {/* Backwards-compatible anchors */}
      <div id="reconciliation" className="sr-only" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          PLATFORM INTERFACE
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          SEE THE SIGNAL BEHIND THE NUMBER.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-12">
          Explore how ENERA turns interval meter telemetry and complex utility statements into clear, verifiable answers.
        </p>

        {/* 4. Tab Navigation (5 Views) */}
        <div
          role="tablist"
          aria-label="Platform Views"
          className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 border-b border-white/10 no-scrollbar"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap focus-ring-enera ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm enera-glow-cyan"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-cyan-400/20 text-cyan-200"
                        : "bg-white/5 text-slate-400"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 5. Synthetic Desktop Viewport Shell */}
        <div className="rounded-2xl border border-white/10 bg-[#070b16] shadow-2xl overflow-hidden">
          {/* Top Window Chrome */}
          <div className="px-4 py-3 bg-[#0a0f1d] border-b border-white/5 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="hidden sm:inline-block ml-3 text-slate-400">
                enera.platform / intelligence / executive-suite
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-slate-400">
                <Building className="h-3 w-3 text-cyan-400" />
                <span className="hidden md:inline">Entity:</span> Apex Precision Manufacturing
              </span>
              <span className="text-slate-400">|</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Calendar className="h-3 w-3 text-cyan-400" />
                <span>Aug 2026 (Winter)</span>
              </span>
            </div>
          </div>

          {/* Viewport Content Area */}
          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="p-5 sm:p-7 min-h-[440px] flex flex-col justify-between focus:outline-none"
          >
            {/* VIEW 1: DASHBOARD */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                      Total Utility Billed
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-white">
                      R 1,842,500.00
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Stated statement amount
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                      Reconciled Determinant
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-cyan-300">
                      R 1,789,120.00
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Verified interval total
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-cyan-500/30">
                    <span className="text-[11px] font-mono text-cyan-400 uppercase block mb-1">
                      Net Discrepancy
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-amber-400">
                      R 53,380.00
                    </div>
                    <span className="text-[11px] text-amber-400/80 font-mono mt-1 block">
                      +2.90% Overcharge Isolated
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                      Power Factor Index
                    </span>
                    <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-400">
                      0.96 lagging
                    </div>
                    <span className="text-[11px] text-emerald-400/80 mt-1 block">
                      Compliant (&gt; 0.85 standard)
                    </span>
                  </div>
                </div>

                {/* BILLING NUMBER TRANSITIONING INTO A CLEAN INSIGHT */}
                <div className="p-5 rounded-xl bg-[#0b1224] border border-cyan-500/20 shadow-lg space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                        Reconciliation Signal Transition
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                      <span className="text-slate-400">State:</span>
                      <button
                        type="button"
                        onClick={() => setTransitionView("raw")}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors focus-ring-enera ${
                          transitionView === "raw" ? "bg-white/10 text-white font-bold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        1. Raw Stated
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransitionView("transition")}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors focus-ring-enera ${
                          transitionView === "transition" ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        2. Cross-Verification
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransitionView("insight")}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors focus-ring-enera ${
                          transitionView === "insight" ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        3. Clean Insight
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Stated Billing Number */}
                    <div className={`md:col-span-4 p-4 rounded-lg border transition-all duration-300 ${
                      transitionView === "raw" ? "bg-[#070b16] border-white/30 shadow-inner ring-1 ring-white/10" : "bg-[#070b16]/60 border-white/5 opacity-85"
                    }`}>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                        1. Raw Billed Statement
                      </span>
                      <div className="text-xl sm:text-2xl font-mono font-bold text-white">
                        R 1,842,500.00
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Aggregated monthly utility statement amount without interval cross-examination.
                      </p>
                    </div>

                    {/* Transition Conduit */}
                    <div className={`md:col-span-4 flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all duration-300 ${
                      transitionView === "transition" ? "bg-cyan-950/40 border-cyan-500/50 enera-glow-cyan" : "bg-cyan-950/20 border-cyan-500/20"
                    }`}>
                      <div className="text-[10px] font-mono text-cyan-400 font-bold uppercase mb-1">
                        2. Deterministic Verification
                      </div>
                      <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 py-1">
                        <span>1,488 Intervals</span>
                        <ArrowRight className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                        <span>NERSA Sched 2</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Continuous TOU matrix cross-referencing holiday and peak determinants
                      </span>
                    </div>

                    {/* Clean Insight Number */}
                    <div className={`md:col-span-4 p-4 rounded-lg border transition-all duration-300 ${
                      transitionView === "insight" ? "bg-[#070b16] border-amber-500/40 enera-glow-amber ring-1 ring-amber-500/20" : "bg-[#070b16]/60 border-white/5 opacity-85"
                    }`}>
                      <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block mb-1">
                        3. Clean Audited Insight
                      </span>
                      <div className="text-xl sm:text-2xl font-mono font-bold text-amber-400">
                        +R 53,380.00 Credit
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Isolated 16-June Public Holiday Peak misclassification &amp; 250 kVA demand overcharge.
                      </p>
                    </div>
                  </div>
                </div>

                {/* TOU Split Overview Bar */}
                <div className="p-5 rounded-xl bg-[#0b1224] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Time-of-Use Volume Distribution</span>
                    <span className="font-mono text-slate-400">Total: 3,412,080 kWh</span>
                  </div>

                  {/* Multi-segment visual bar with viewport entrance animation */}
                  <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                    <div
                      style={{
                        width: hasEnteredViewport ? "24%" : "0%",
                        transition: reducedMotion ? "none" : "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                      className="bg-amber-500"
                      title="Peak: 24%"
                    />
                    <div
                      style={{
                        width: hasEnteredViewport ? "42%" : "0%",
                        transition: reducedMotion ? "none" : "width 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s",
                      }}
                      className="bg-cyan-500"
                      title="Standard: 42%"
                    />
                    <div
                      style={{
                        width: hasEnteredViewport ? "34%" : "0%",
                        transition: reducedMotion ? "none" : "width 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s",
                      }}
                      className="bg-slate-500"
                      title="Off-Peak: 34%"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      Peak: 818,900 kWh (24%)
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                      Standard: 1,433,070 kWh (42%)
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      Off-Peak: 1,160,110 kWh (34%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: BILLING RECONCILIATION */}
            {activeTab === "reconciliation" && (
              <div className="space-y-4">
                <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                  <span>LINE-ITEM CROSS-VERIFICATION (STATED VS MEASURED)</span>
                  <span className="text-cyan-400">SANS 474 Interval Certified</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 font-mono">
                        <th className="py-2.5 pr-4">Line Item Determinant</th>
                        <th className="py-2.5 px-3">Billed (Utility)</th>
                        <th className="py-2.5 px-3">Reconciled (Interval)</th>
                        <th className="py-2.5 px-3">Variance</th>
                        <th className="py-2.5 pl-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Active Energy — Peak (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">842,100 kWh / R 624,838</td>
                        <td className="py-3 px-3 text-cyan-300">818,900 kWh / R 607,624</td>
                        <td className="py-3 px-3 text-amber-400">+23,200 kWh (+R 17,214)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            Discrepancy
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Active Energy — Standard (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">1,433,070 kWh / R 544,566</td>
                        <td className="py-3 px-3 text-cyan-300">1,433,070 kWh / R 544,566</td>
                        <td className="py-3 px-3 text-slate-400">0 kWh (R 0.00)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">
                            Clean Match
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Active Energy — Off-Peak (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">1,136,910 kWh / R 284,228</td>
                        <td className="py-3 px-3 text-cyan-300">1,160,110 kWh / R 290,028</td>
                        <td className="py-3 px-3 text-cyan-400">-23,200 kWh (-R 5,800)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            Holiday Shift
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Maximum Demand Charge (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">5,100 kVA / R 288,868</td>
                        <td className="py-3 px-3 text-cyan-300">4,850 kVA / R 274,702</td>
                        <td className="py-3 px-3 text-amber-400">+250 kVA (+R 14,166)</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            Overstated Peak
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 pr-4 font-sans text-white font-medium">
                          Reactive Energy Levy (High Season)
                        </td>
                        <td className="py-3 px-3 text-slate-300">R 27,800 (Stated)</td>
                        <td className="py-3 px-3 text-cyan-300">R 0.00 (Exempt)</td>
                        <td className="py-3 px-3 text-amber-400">+R 27,800.00</td>
                        <td className="py-3 pl-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300">
                            Invalid Surcharge
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 3: ENERGY TRENDS */}
            {activeTab === "trends" && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-white">24-Hour Interval Demand Profile</span>
                    <span className="text-slate-400 ml-2">High Season Weekday (SAST)</span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-amber-500" /> Peak Hours (06:00-09:00, 17:00-19:00)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded bg-cyan-400" /> Measured kVA Demand
                    </span>
                  </div>
                </div>

                {/* Simulated SVG Interval Profile with Live Telemetry Scanner & Traveling Energy Line */}
                <div className="w-full h-56 bg-[#0b1224] rounded-xl border border-white/5 p-4 flex flex-col justify-between relative overflow-hidden">
                  {/* Subtle telemetry scanner line across 24h profile */}
                  <div
                    className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent pointer-events-none"
                    style={{ animation: "enera-scan 10s linear infinite" }}
                    aria-hidden="true"
                  />

                  <div className="flex justify-between text-[10px] font-mono text-slate-400 relative z-10">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      5,000 kVA (Ratchet Limit)
                    </span>
                    <span className="text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 enera-anomaly-radar" />
                      Max Peak: 4,850 kVA @ 08:30 (Measured)
                    </span>
                  </div>

                  <div className="w-full h-32 relative flex items-end z-10">
                    {/* Subtle Continuous Load Curve with Traveling Energy Line */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
                      preserveAspectRatio="none"
                      viewBox="0 0 1000 120"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="chartEnergyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                          <stop offset="28%" stopColor="#f59e0b" stopOpacity="1" />
                          <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.8" />
                          <stop offset="72%" stopColor="#f59e0b" stopOpacity="1" />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.8" />
                        </linearGradient>
                      </defs>

                      {/* Static Load Curve Guide */}
                      <path
                        d="M 20 84 C 100 86, 150 72, 210 48 C 260 20, 290 8, 312 6 C 340 8, 370 32, 420 40 C 500 44, 600 42, 650 32 C 700 18, 720 12, 740 12 C 770 14, 820 48, 880 74 C 940 84, 980 84, 1000 84"
                        stroke="rgba(34, 211, 238, 0.2)"
                        strokeWidth="1.5"
                        fill="none"
                      />

                      {/* Traveling Energy Line */}
                      <path
                        d="M 20 84 C 100 86, 150 72, 210 48 C 260 20, 290 8, 312 6 C 340 8, 370 32, 420 40 C 500 44, 600 42, 650 32 C 700 18, 720 12, 740 12 C 770 14, 820 48, 880 74 C 940 84, 980 84, 1000 84"
                        stroke="url(#chartEnergyGradient)"
                        strokeWidth="2.5"
                        fill="none"
                        className="enera-chart-traveling-line"
                      />

                      {/* Morning Peak Waypoint @ 08:30 (x=312, y=6) */}
                      <circle cx="312" cy="6" r="4" fill="#f59e0b" className="animate-pulse" />
                      <circle cx="312" cy="6" r="8" stroke="#f59e0b" strokeWidth="1" fill="none" opacity="0.5" />

                      {/* Evening Peak Waypoint @ 18:00 (x=740, y=12) */}
                      <circle cx="740" cy="12" r="3.5" fill="#f59e0b" />
                      <circle cx="740" cy="12" r="7" stroke="#f59e0b" strokeWidth="1" fill="none" opacity="0.4" />
                    </svg>

                    {/* Anomaly Indicator Radar Pill directly above 08:30 Peak */}
                    <div
                      className="absolute left-[31.2%] -top-4 -translate-x-1/2 flex items-center gap-1.5 z-30 pointer-events-none"
                      aria-hidden="true"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 enera-anomaly-radar" />
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono border border-amber-500/30 whitespace-nowrap hidden sm:inline-block shadow-sm">
                        Flagged: +250 kVA Overstated
                      </span>
                    </div>

                    {/* Simulated bars for 24 half-hour blocks animating upon viewport entrance */}
                    <div className="w-full h-full flex items-end gap-1 sm:gap-1.5">
                      {INTERVAL_BARS.map((bar, i) => (
                        <div
                          key={i}
                          style={{
                            height: hasEnteredViewport ? `${bar.h}%` : "0%",
                            transition: reducedMotion ? "none" : "height 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
                            transitionDelay: reducedMotion ? "0ms" : `${i * 22}ms`,
                          }}
                          className={`flex-1 rounded-t ${
                            bar.t === "peak"
                              ? "bg-gradient-to-t from-amber-600 to-amber-400 hover:brightness-110"
                              : bar.t === "std"
                              ? "bg-gradient-to-t from-cyan-600 to-cyan-400 hover:brightness-110"
                              : "bg-slate-700 hover:bg-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5 relative z-10">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:59</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#0b1224] border border-white/5">
                    <span className="text-slate-400 block text-[10px]">PEAK RATIO</span>
                    <span className="text-white font-bold">24.0%</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0b1224] border border-white/5">
                    <span className="text-slate-400 block text-[10px]">LOAD FACTOR</span>
                    <span className="text-white font-bold">78.4%</span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#0b1224] border border-white/5">
                    <span className="text-slate-400 block text-[10px]">OFF-PEAK UTILIZATION</span>
                    <span className="text-cyan-400 font-bold">Optimal</span>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: ANOMALY INSIGHT */}
            {activeTab === "anomalies" && (
              <div className="space-y-4">
                <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                  <span>ISOLATED ANOMALIES (2 REQUIRING TREASURY ACTION)</span>
                  <span className="text-amber-400">Total Recovery Value: R 53,380.00</span>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#0b1224] border border-amber-500/30 enera-glow-amber flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold enera-anomaly-radar inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                          CRITICAL
                        </span>
                        <h3 className="text-sm font-bold text-white">
                          Statutory Public Holiday Billed as Weekday Peak
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        Youth Day (16 June) was billed at High-Season Peak weekday rates instead of statutory Sunday Off-Peak schedule under NERSA Schedule 2 rules.
                      </p>

                      {/* Subtle rate comparison breakdown */}
                      <div className="mt-3 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono border-t border-white/5">
                        <div className="p-2 rounded bg-black/40 border border-white/5">
                          <span className="text-slate-400 block text-[9px] uppercase">Utility Stated Rate</span>
                          <span className="text-rose-300 font-bold">R 0.742/kWh (Peak)</span>
                        </div>
                        <div className="p-2 rounded bg-black/40 border border-white/5">
                          <span className="text-slate-400 block text-[9px] uppercase">NERSA Schedule Rate</span>
                          <span className="text-cyan-300 font-bold">R 0.250/kWh (Off-Peak)</span>
                        </div>
                        <div className="p-2 rounded bg-amber-950/20 border border-amber-500/20">
                          <span className="text-amber-400 block text-[9px] uppercase">Unearned Variance</span>
                          <span className="text-amber-300 font-bold">+R 24,180.00 Recovery</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-amber-400">
                        +R 24,180.00
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Unearned Tariff Charge</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-amber-500/30 enera-glow-amber flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />
                          WARNING
                        </span>
                        <h3 className="text-sm font-bold text-white">
                          Maximum Demand Ratchet Overstatement
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        Utility stated peak demand at 5,100 kVA. Physical meter interval telemetry confirms maximum peak reached was 4,850 kVA at 08:30.
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-amber-400">
                        +R 14,166.00
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">250 kVA Discrepancy</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0b1224] border border-white/5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                          VERIFIED
                        </span>
                        <h3 className="text-sm font-bold text-white">
                          Power Factor Boundary Compliant
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        Average power factor maintained at 0.96 lagging across billing cycle. Invalid reactive levy of R 27,800 reversed.
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-emerald-400">
                        +R 27,800.00
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Exempt from Penalty</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 5: REPORTING */}
            {activeTab === "reporting" && (
              <div className="space-y-5">
                <div className="p-5 rounded-xl bg-[#0b1224] border border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                        EXECUTIVE RECONCILIATION DOSSIER
                      </span>
                      <h3 className="text-base font-bold text-white font-sans">
                        Apex Precision Manufacturing — August 2026 Audit Pack
                      </h3>
                    </div>
                      <a
                        href="#contact"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-mono hover:bg-cyan-500/20 transition-colors"
                      >
                        <span>REQUEST A DEMO</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                  </div>

                  <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px]">STATUTORY BASIS</span>
                      <span className="text-slate-200">NERSA Sched 2 / Megaflex</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">TELEMETRY REGISTERS</span>
                      <span className="text-slate-200">1,488 Intervals (100%)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ISOLATED CREDIT CLAIM</span>
                      <span className="text-amber-400 font-bold">R 53,380.00</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">AUDIT STATUS</span>
                      <span className="text-emerald-400 font-bold">Dispute Ready</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#070b16] border border-white/5 text-xs text-slate-400 font-sans space-y-1">
                    <span className="font-semibold text-slate-200 block">Dossier Contents:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                      <li>Eskom Form 102 structured claim summary with line-item discrepancy breakdowns.</li>
                      <li>Certified 30-minute interval telemetry export matching SANS 474 revenue standards.</li>
                      <li>Statutory NERSA high-season calendar mapping and gazetted tariff proofs.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. Supporting Notice & Optional CTA */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Simulated enterprise environment. All displayed entity names and financial values are synthetic demonstration data.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors font-medium focus-ring-enera shrink-0"
          >
            <span>REQUEST A DEMO</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}
