import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Layers,
  Cpu,
  Database,
  CheckCircle2,
  ArrowRight,
  Zap,
  Activity,
  Calendar,
  Gauge,
  Sliders,
  DollarSign,
  FileCheck,
  Network,
} from "lucide-react";
import { EnginePhaseTag } from "./EneraBrandPrimitives";

export interface DecodedElement {
  id: string;
  name: string;
  category: string;
  invoiceValue: string;
  decodedVector: string;
  networkTarget: string;
  separationThreshold: number; // 0.0 to 1.0 progress when it detaches
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DECODED_ELEMENTS: DecodedElement[] = [
  {
    id: "charges",
    name: "charges",
    category: "FINANCIAL DETERMINANT",
    invoiceValue: "R 842,431.00",
    decodedVector: "Active energy rate table multiplier decomposed into Peak/Std/Off-Peak",
    networkTarget: "Tariff Rate Verification Engine",
    separationThreshold: 0.25,
    color: "#22d3ee",
    icon: DollarSign,
  },
  {
    id: "consumption",
    name: "consumption",
    category: "ENERGY VECTOR",
    invoiceValue: "4,218,441 kWh",
    decodedVector: "1,488 half-hour AMR intervals integrated across TOU blocks",
    networkTarget: "AMR Telemetry Ground Truth Bus",
    separationThreshold: 0.32,
    color: "#10b981",
    icon: Zap,
  },
  {
    id: "demand",
    name: "demand",
    category: "PEAK CAPACITY",
    invoiceValue: "8,421 kVA",
    decodedVector: "Simultaneous registered half-hour maximum demand at 18:30 on 14 July",
    networkTarget: "Maximum Demand Load Peak Auditor",
    separationThreshold: 0.38,
    color: "#f59e0b",
    icon: Gauge,
  },
  {
    id: "tariffs",
    name: "tariffs",
    category: "REGULATORY SCHEDULE",
    invoiceValue: "MEGAFLEX Transmission >66kV",
    decodedVector: "NERSA 2025/26 approved multi-season gazette rule definitions",
    networkTarget: "NERSA Regulatory Gazette Matrix",
    separationThreshold: 0.44,
    color: "#8b5cf6",
    icon: Sliders,
  },
  {
    id: "dates",
    name: "dates",
    category: "TEMPORAL HORIZON",
    invoiceValue: "2025/07/01 – 2025/07/31 (31 Days)",
    decodedVector: "744 statutory hours mapped to SAST calendar & public holiday substitution",
    networkTarget: "Astronomical Calendar Validator",
    separationThreshold: 0.5,
    color: "#38bdf8",
    icon: Calendar,
  },
  {
    id: "meter readings",
    name: "meter readings",
    category: "RAW AMR REGISTERS",
    invoiceValue: "Prev: 42,108,920 → Pres: 46,327,361",
    decodedVector: "CT/VT multiplied register delta checked for rollover and counter resets",
    networkTarget: "Revenue Meter Integrity Hash Chain",
    separationThreshold: 0.56,
    color: "#06b6d4",
    icon: Activity,
  },
  {
    id: "adjustments",
    name: "adjustments",
    category: "SURCHARGE & PENALTY",
    invoiceValue: "R 18,420.00 Surcharge",
    decodedVector: "342,100 kVArh reactive power assessed against 0.96 lagging threshold",
    networkTarget: "Reactive Energy Vector Auditor",
    separationThreshold: 0.62,
    color: "#f43f5e",
    icon: Layers,
  },
  {
    id: "VAT",
    name: "VAT",
    category: "STATUTORY TAXATION",
    invoiceValue: "R 128,432.00 (15%)",
    decodedVector: "Statutory South African Revenue Service Decimal.js exact precision split",
    networkTarget: "Fiscal Compliance Engine",
    separationThreshold: 0.68,
    color: "#e2e8f0",
    icon: FileCheck,
  },
];

export function EneraBillSignalSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0.55); // Default to active decoded state
  const [selectedElementId, setSelectedElementId] = useState<string>("consumption");
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isManualScrub, setIsManualScrub] = useState<boolean>(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Scroll Progress Listener: progressively decodes the bill as user scrolls (active only when in viewport, RAF-throttled)
  useEffect(() => {
    if (reducedMotion || isManualScrub) return;

    const el = sectionRef.current;
    if (!el) return;

    let ticking = false;
    const updateProgress = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Calculate 0.0 to 1.0 progress through this section
      const totalDist = rect.height + windowHeight * 0.4;
      const currentDist = windowHeight - rect.top;
      const rawProgress = currentDist / totalDist;
      const clamped = Math.min(Math.max(rawProgress, 0), 1);
      setScrollProgress(clamped);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateProgress);
        ticking = true;
      }
    };

    let isObserving = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!isObserving) {
            window.addEventListener("scroll", handleScroll, { passive: true });
            handleScroll();
            isObserving = true;
          }
        } else {
          if (isObserving) {
            window.removeEventListener("scroll", handleScroll);
            isObserving = false;
          }
        }
      },
      { threshold: 0.05 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (isObserving) {
        window.removeEventListener("scroll", handleScroll);
      }
    };
  }, [reducedMotion, isManualScrub]);

  const activeElement =
    DECODED_ELEMENTS.find((el) => el.id === selectedElementId) || DECODED_ELEMENTS[1];

  return (
    <section
      ref={sectionRef}
      id="platform"
      className="relative py-28 bg-[#030712] text-white border-t border-white/5 overflow-hidden"
    >
      {/* Background radial ambient lights */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.03] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-emerald-500/[0.03] blur-[130px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* 1. Large Editorial Typography */}
        <div className="text-center max-w-4xl mx-auto mb-14 sm:mb-20">
          <EnginePhaseTag
            phase="02"
            name="DATA"
            sub="DETERMINANT SIGNAL DECOMPOSITION"
          />

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-tight font-sans">
            EVERY BILL HAS A SIGNAL.
          </h2>

          <div className="mt-6 text-lg sm:text-2xl md:text-3xl text-slate-300 font-light leading-relaxed max-w-2xl mx-auto space-y-2">
            <p className="text-slate-400">Most organisations see an invoice.</p>
            <p className="text-white font-medium drop-shadow-[0_0_25px_rgba(255,255,255,0.25)]">
              ENERA sees thousands of data points.
            </p>
          </div>

          {/* Interactive Decoding Scrubber Bar */}
          <div
            role="tablist"
            aria-label="Bill decoding progression stages"
            className="mt-8 inline-flex max-w-full overflow-x-auto scrollbar-none items-center gap-2 sm:gap-3 p-1.5 rounded-xl bg-[#0d1117]/80 border border-white/10 backdrop-blur-md"
          >
            <button
              role="tab"
              aria-selected={scrollProgress < 0.25}
              onClick={() => {
                setIsManualScrub(true);
                setScrollProgress(0.15);
              }}
              className={`px-2.5 sm:px-3 py-1 text-xs font-mono rounded-lg transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                scrollProgress < 0.25
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="sm:hidden">1. Invoice</span>
              <span className="hidden sm:inline">1. Assembled Invoice</span>
            </button>
            <button
              role="tab"
              aria-selected={scrollProgress >= 0.25 && scrollProgress < 0.7}
              onClick={() => {
                setIsManualScrub(true);
                setScrollProgress(0.55);
              }}
              className={`px-2.5 sm:px-3 py-1 text-xs font-mono rounded-lg transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                scrollProgress >= 0.25 && scrollProgress < 0.7
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="sm:hidden">2. Elements</span>
              <span className="hidden sm:inline">2. Separating Elements</span>
            </button>
            <button
              role="tab"
              aria-selected={scrollProgress >= 0.7}
              onClick={() => {
                setIsManualScrub(true);
                setScrollProgress(0.85);
              }}
              className={`px-2.5 sm:px-3 py-1 text-xs font-mono rounded-lg transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                scrollProgress >= 0.7
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="sm:hidden">3. Network</span>
              <span className="hidden sm:inline">3. Connected Network</span>
            </button>
            {isManualScrub && (
              <button
                onClick={() => setIsManualScrub(false)}
                className="text-[10px] font-mono text-cyan-400/80 underline px-2 hover:text-cyan-300 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label="Reset manual scrubber back to scroll-driven progression"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* 2. Interactive Invoice Decoding & Intelligence Network Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (5 cols): The Digital Invoice (Elements progressively separate) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="h-3.5 w-3.5 text-cyan-400" />
                <span>ORIGINAL UTILITY INVOICE</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-300">
                {scrollProgress < 0.25
                  ? "INTACT BILL"
                  : scrollProgress >= 0.7
                    ? "DECODED (8 VECTORS DETACHED)"
                    : "SEPARATING IN PROGRESS..."}
              </span>
            </div>

            {/* Document Paper Container */}
            <div className="relative rounded-2xl bg-[#090d14] border border-white/10 p-5 sm:p-6 shadow-2xl overflow-hidden enera-glass">
              {/* Document Header */}
              <div className="pb-4 mb-4 border-b border-white/10 flex items-start justify-between">
                <div>
                  <div className="text-xs font-mono font-bold tracking-widest text-slate-300 uppercase">
                    ESKOM DIRECT BILLING SUMMARY
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    ACCOUNT: 9021-4819-2041 | MTR: 021-MS-90412
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                    TAX INVOICE
                  </span>
                </div>
              </div>

              {/* The 8 Progressive Bill Determinants */}
              <div className="space-y-2.5">
                {DECODED_ELEMENTS.map((el, idx) => {
                  const isSeparated = scrollProgress >= el.separationThreshold;
                  const isSelected = selectedElementId === el.id;

                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      aria-label={`Determinant ${el.name}: ${el.invoiceValue}, category ${el.category}. Status: ${isSeparated ? "Decoded into vector" : "Attached to invoice"}`}
                      onClick={() => setSelectedElementId(el.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedElementId(el.id);
                        }
                      }}
                      className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-300 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        isSelected
                          ? "bg-cyan-950/40 border-cyan-500/50 shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]"
                          : isSeparated
                            ? "bg-[#0d1117]/80 border-cyan-500/20 hover:border-cyan-500/40"
                            : "bg-white/[0.02] border-white/5 hover:border-white/20"
                      }`}
                      style={{
                        transform:
                          reducedMotion || !isSeparated
                            ? "none"
                            : `translate3d(${isSeparated ? idx * 2 : 0}px, 0, 0)`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: el.color }}
                          />
                          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 group-hover:text-white">
                            {el.name}
                          </span>
                        </div>

                        {/* Separation Status Badge */}
                        <div className="flex items-center gap-1.5">
                          {isSeparated ? (
                            <span className="text-[9px] font-mono font-bold tracking-widest text-cyan-300 uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                              DECODED →
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono text-slate-400 uppercase">
                              ATTACHED
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-xs font-mono pl-3.5">
                        <span className="text-white font-semibold">{el.invoiceValue}</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                          {el.category}
                        </span>
                      </div>

                      {/* Traveling laser sweep when separated */}
                      {isSeparated && (
                        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none opacity-40">
                          <div className="w-1/3 h-full bg-cyan-400/10 skew-x-12 animate-enera-pulse" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Document Footer */}
              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>INVOICE TOTAL DUE</span>
                <span className="text-white font-bold font-mono text-sm">R 989,283.00</span>
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): The Decoded Intelligence Network */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Network className="h-3.5 w-3.5" />
                <span>INTELLIGENCE NETWORK COUPLING (8 LIVE VECTORS)</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>ACTIVE DECODING</span>
              </span>
            </div>

            {/* Network Vector Cluster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DECODED_ELEMENTS.map((el) => {
                const isSeparated = scrollProgress >= el.separationThreshold;
                const isSelected = selectedElementId === el.id;
                const IconComponent = el.icon;

                return (
                  <div
                    key={`net-${el.id}`}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 border ${
                      isSelected
                        ? "bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_30px_-5px_rgba(6,182,212,0.35)] scale-[1.02]"
                        : isSeparated
                          ? "enera-glass hover:border-cyan-500/30 hover:bg-[#161b22]/90"
                          : "opacity-40 bg-[#090d14] border-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center border"
                          style={{
                            backgroundColor: `${el.color}15`,
                            borderColor: `${el.color}35`,
                            color: el.color,
                          }}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                            {el.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">{el.category}</div>
                        </div>
                      </div>

                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                        style={{
                          backgroundColor: `${el.color}20`,
                          color: el.color,
                        }}
                      >
                        VEC-{el.id.substring(0, 3).toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-3 text-xs font-mono text-slate-300 leading-snug">
                      {el.decodedVector}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-cyan-400/90">
                      <span>DESTINATION:</span>
                      <span className="font-semibold text-slate-300 group-hover:text-cyan-300">
                        {el.networkTarget}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Deep-Dive Telemetry Console on the Selected Vector */}
            <div className="mt-4 enera-glass rounded-2xl p-5 sm:p-6 border-cyan-500/30 shadow-[0_0_35px_-8px_rgba(6,182,212,0.2)]">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider">
                  <Cpu className="h-4 w-4 text-cyan-400 animate-pulse" />
                  <span>VECTOR TELEMETRY INSPECTOR: {activeElement.name.toUpperCase()}</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  RECONCILED
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    INVOICE VALUE
                  </span>
                  <div className="text-sm font-mono font-bold text-white mt-1">
                    {activeElement.invoiceValue}
                  </div>
                </div>

                <div className="sm:col-span-2 p-3 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    NETWORK ENGINE TARGET
                  </span>
                  <div className="text-xs font-mono font-semibold text-cyan-300 mt-1">
                    {activeElement.networkTarget}
                  </div>
                </div>
              </div>

              <div className="mt-3 p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs font-mono text-slate-300 leading-relaxed">
                <span className="text-cyan-400 font-bold block mb-1">
                  DECODING LOGIC & CROSS-CHECK:
                </span>
                {activeElement.decodedVector}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
