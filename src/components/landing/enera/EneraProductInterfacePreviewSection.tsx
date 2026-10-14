import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingDown,
  Clock,
  Radar,
  Info,
} from "lucide-react";
import { EneraSectionHeader } from "./EneraBrandPrimitives";

interface PreviewTab {
  id: string;
  label: string;
  badge: string;
  icon: typeof FileText;
  title: string;
  description: string;
}

const TABS: PreviewTab[] = [
  {
    id: "reconciliation",
    label: "Reconciliation Signal",
    badge: "View 1",
    icon: FileText,
    title: "Arbitrary-Precision Determinant Comparison",
    description:
      "Cross-references billed utility invoice totals against meter-derived interval totals across peak, standard, off-peak energy, maximum demand, and power factor surcharges.",
  },
  {
    id: "discrepancy-matrix",
    label: "14-Point Audit Matrix",
    badge: "View 2",
    icon: ShieldCheck,
    title: "Determinant Discrepancy Matrix",
    description:
      "Line-by-line verification comparing gazetted Eskom Megaflex tariffs against billed rates, revealing hidden compounding charges and calculation variances.",
  },
  {
    id: "interval-telemetry",
    label: "AMR Telemetry Stream",
    badge: "View 3",
    icon: Activity,
    title: "24-Hour Demand & Interval Telemetry",
    description:
      "High-frequency interval data stream validating peak load times, public holiday exemptions, and maximum demand threshold occurrences.",
  },
  {
    id: "anomaly-radar",
    label: "Anomaly Detection",
    badge: "View 4",
    icon: Radar,
    title: "Deterministic Exception Radar",
    description:
      "Automated detection of irregular spikes, meter multiplier errors, and over-notified maximum demand charges.",
  },
];

const INTERVAL_BARS = [
  { time: "00:00", h: 32, type: "off-peak", label: "Off-Peak Night" },
  { time: "02:00", h: 28, type: "off-peak", label: "Off-Peak Base" },
  { time: "04:00", h: 36, type: "off-peak", label: "Early Shift" },
  { time: "06:00", h: 74, type: "morning-peak", label: "Morning Ramp" },
  { time: "07:00", h: 88, type: "morning-peak", label: "Morning Peak Waypoint" },
  { time: "09:00", h: 92, type: "morning-peak", label: "Peak Sustained" },
  { time: "11:00", h: 64, type: "standard", label: "Midday Plateau" },
  { time: "13:00", h: 58, type: "standard", label: "Standard Operational" },
  { time: "15:00", h: 62, type: "standard", label: "Standard Shift" },
  { time: "17:00", h: 94, type: "evening-peak", label: "Evening Peak Waypoint" },
  { time: "19:00", h: 86, type: "evening-peak", label: "High Demand Peak" },
  { time: "21:00", h: 48, type: "standard", label: "Evening Ramp Down" },
  { time: "23:00", h: 34, type: "off-peak", label: "Night Baseload" },
];

export function EneraProductInterfacePreviewSection() {
  const [activeTab, setActiveTab] = useState<string>("reconciliation");
  const [transitionView, setTransitionView] = useState<"billed" | "verified">("verified");
  const [hasEnteredViewport, setHasEnteredViewport] = useState<boolean>(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEnteredViewport(true);
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <section
      ref={sectionRef}
      id="interface-previews"
      className="py-20 sm:py-28 bg-[#040812] border-t border-slate-800/80 font-sans relative overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-cyan-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[280px] bg-emerald-500/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <EneraSectionHeader
          badge="Product Interface"
          title="Engineered for Financial Rigour"
          description="High-density, deterministic financial intelligence workbench designed specifically for commercial energy managers and audit teams."
          centered
        />

        {/* Accessible Tab Navigation */}
        <div
          role="tablist"
          aria-label="Platform Views"
          className="flex flex-wrap items-center justify-center gap-2 mb-10"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-mono transition-all duration-200 border ${
                  isActive
                    ? "bg-slate-900/90 text-cyan-300 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "bg-slate-950/40 text-slate-400 border-white/5 hover:text-slate-200 hover:border-white/10"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? "bg-cyan-950 text-cyan-300" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Mock Interface Card */}
        <div
          id={`panel-${currentTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="rounded-xl border border-white/10 bg-[#070c18]/90 backdrop-blur-md shadow-2xl overflow-hidden p-6 sm:p-8"
        >
          {/* Header Chrome with Decorative Dots */}
          <div className="flex flex-col lg:flex-row items-start justify-between gap-6 pb-6 border-b border-white/5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {/* Decorative Window Chrome Dots */}
                <div className="flex items-center gap-1.5 mr-2" aria-hidden="true">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  {currentTab.badge} — Active Workbench
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                {currentTab.title}
              </h3>
              <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
                {currentTab.description}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono text-slate-400">STATE:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Clean Match Engine
              </span>
            </div>
          </div>

          {/* Tab View Content */}
          <div className="mt-6">
            {/* VIEW 1: Reconciliation Signal Transition */}
            {activeTab === "reconciliation" && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-cyan-950/40 text-cyan-400 border border-cyan-800/40">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-xs font-mono text-cyan-400 block">
                        Reconciliation Signal Transition
                      </span>
                      <span className="text-sm font-semibold text-white">
                        Utility Billing Line-Item vs Deterministic Engine
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTransitionView("billed")}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                        transitionView === "billed"
                          ? "bg-slate-800 text-white border border-white/10"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Billed View
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransitionView("verified")}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                        transitionView === "verified"
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-500/30"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Deterministic Verification
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-5 rounded-lg bg-slate-900/60 border border-white/5">
                    <span className="text-xs font-mono text-slate-400 block mb-1">
                      BILLED INVOICE TOTAL
                    </span>
                    <span className="text-2xl font-bold font-mono text-white">R 1,842,500.00</span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Account 7856504676 (High Season)
                    </span>
                  </div>

                  <div className="p-5 rounded-lg bg-slate-900/60 border border-white/5">
                    <span className="text-xs font-mono text-slate-400 block mb-1">
                      DETERMINISTIC RECALCULATION
                    </span>
                    <span className="text-2xl font-bold font-mono text-cyan-300">
                      R 1,789,120.00
                    </span>
                    <span className="text-xs text-slate-400 mt-1 block">
                      Validated Against Gazetted Schedule
                    </span>
                  </div>

                  <div className="p-5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                    <span className="text-xs font-mono text-emerald-400 block mb-1">
                      IDENTIFIED VARIANCE
                    </span>
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      +R 53,380.00 Credit
                    </span>
                    <span className="text-xs text-emerald-400/80 mt-1 block">
                      16-June Public Holiday Peak misclassification
                    </span>
                  </div>
                </div>

                {/* Audit Finding Callout */}
                <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-500/20 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs font-mono">
                    <span className="font-semibold text-amber-300 uppercase tracking-wide block mb-1">
                      Deterministic Verification Audit Note
                    </span>
                    <p className="text-slate-300 leading-relaxed">
                      On 16 June (Youth Day statutory gazetted public holiday), 24,500 kWh was billed
                      at Peak TOU tariff (c 412.50/kWh) instead of Off-Peak TOU tariff (c 194.20/kWh).
                      Resulting in a verified refundable credit of <strong>+R 53,380.00 Credit</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: 14-Point Audit Matrix */}
            {activeTab === "discrepancy-matrix" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-white/5 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-white/5">
                      <tr>
                        <th className="p-3">DETERMINANT</th>
                        <th className="p-3">BILLED CHARGE</th>
                        <th className="p-3">RECALCULATED</th>
                        <th className="p-3">VARIANCE</th>
                        <th className="p-3">AUDIT STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      <tr>
                        <td className="p-3 font-medium text-white">Peak Energy (c/kWh)</td>
                        <td className="p-3">245,000 kWh @ 412.50c</td>
                        <td className="p-3">231,200 kWh @ 412.50c</td>
                        <td className="p-3 text-emerald-400">-13,800 kWh</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            Discrepancy
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Maximum Demand (kVA)</td>
                        <td className="p-3">1,850 kVA</td>
                        <td className="p-3">1,720 kVA</td>
                        <td className="p-3 text-emerald-400">-130 kVA</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            Discrepancy
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Off-Peak Energy (c/kWh)</td>
                        <td className="p-3">412,000 kWh @ 194.20c</td>
                        <td className="p-3">412,000 kWh @ 194.20c</td>
                        <td className="p-3 text-slate-400">0.00 kWh</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            Clean Match
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white">Reactive Energy (kVArh)</td>
                        <td className="p-3">82,400 kVArh</td>
                        <td className="p-3">71,000 kVArh</td>
                        <td className="p-3 text-amber-400">+11,400 kVArh</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="h-3 w-3" />
                            WARNING
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 3: AMR Telemetry Stream & 24-Hour Demand Chart */}
            {activeTab === "interval-telemetry" && (
              <div className="space-y-6">
                <div className="relative p-6 rounded-lg bg-slate-900/70 border border-white/5 overflow-hidden">
                  {/* Telemetry scanner line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400/80 via-cyan-400 to-transparent enera-scan pointer-events-none"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider block">
                        24-Hour Interval Demand Profile (Megaflex High Season)
                      </span>
                      <span className="text-xs text-slate-400">
                        1,440 readings synchronized to SAST calendar
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        <span className="w-2.5 h-2.5 rounded bg-cyan-400" /> Morning Peak Waypoint
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <span className="w-2.5 h-2.5 rounded bg-amber-400" /> Evening Peak Waypoint
                      </span>
                    </div>
                  </div>

                  {/* SVG overlay with traveling energy line */}
                  <div className="relative h-48 w-full flex items-end gap-2 pt-6">
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      preserveAspectRatio="none"
                      viewBox="0 0 100 100"
                    >
                      <defs>
                        <linearGradient id="chartEnergyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                          <stop offset="50%" stopColor="#38bdf8" stopOpacity="1" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 0,68 Q 25,60 35,26 T 50,36 T 75,6 T 100,66"
                        fill="none"
                        stroke="url(#chartEnergyGradient)"
                        strokeWidth="2"
                        className="enera-chart-traveling-line"
                      />
                    </svg>

                    {/* Dynamic Bar Charts with Viewport Animation & Reduced Motion Safeguard */}
                    {INTERVAL_BARS.map((bar, index) => {
                      const isMorningPeak = bar.type === "morning-peak";
                      const isEveningPeak = bar.type === "evening-peak";
                      const barColor = isEveningPeak
                        ? "bg-amber-500/80 hover:bg-amber-400"
                        : isMorningPeak
                        ? "bg-cyan-500/80 hover:bg-cyan-400"
                        : "bg-slate-700/60 hover:bg-slate-600";

                      return (
                        <div
                          key={bar.time}
                          className="flex-1 flex flex-col items-center gap-2 group h-full justify-end relative"
                        >
                          {/* Anomaly radar indicator on evening peak waypoint */}
                          {bar.time === "17:00" && (
                            <div className="absolute -top-3 enera-anomaly-radar">
                              <span className="h-2 w-2 rounded-full bg-amber-400 block" />
                            </div>
                          )}

                          <div
                            className={`w-full rounded-t transition-all duration-700 ease-out ${barColor}`}
                            style={{
                              height: hasEnteredViewport ? `${bar.h}%` : "0%",
                              transitionDelay: `${index * 35}ms`,
                            }}
                          />
                          <span className="text-[10px] font-mono text-slate-400 group-hover:text-white">
                            {bar.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: Anomaly Radar & Variance Flags */}
            {activeTab === "anomaly-radar" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-slate-900/60 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-cyan-400 uppercase">
                        Maximum Demand Threshold
                      </span>
                      <span className="enera-anomaly-radar px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        CRITICAL EXCEPTION
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Flagged: +250 kVA Overstated
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Utility invoice registered 2,100 kVA billed maximum demand, while verified meter
                      interval integration peaked at 1,850 kVA on 04 June 18:30 SAST.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900/60 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-cyan-400 uppercase">
                        Power Factor Surcharge
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        NORMALIZED
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Lagging PF 0.94 within Permissible Envelope
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Reactive determinant was verified at 0.94 power factor, well above the 0.85
                      penalty boundary. Zero penalty surcharge applicable.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section Action Link with standardized CTA */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-400">
              Need a personalized evaluation of your commercial billing portfolio?
            </span>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors font-sans focus-ring-enera shadow-lg shadow-cyan-950/30"
            >
              <span>REQUEST A DEMO</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
