import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Terminal,
  ArrowRight,
  CornerDownRight,
  Check,
  Bot,
  Play,
  Pause,
  ShieldCheck,
  FileText,
  Clock,
  Layers,
  Zap,
  TrendingUp,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { EnginePhaseTag } from "./EneraBrandPrimitives";

interface AiQuery {
  question: string;
  category: string;
  tag: string;
  response: {
    title: string;
    body: string;
    variance: string;
    varianceType: "overcharge" | "increase" | "savings" | "recovery";
    confidence: string;
    citation: string;
    evidence: string;
    action: string;
    disputeForm: string;
    highlightTerms: string[];
  };
}

const QUERIES: AiQuery[] = [
  {
    question: "Why did our electricity bill increase by 24% this month?",
    category: "Cost Drivers",
    tag: "Rate & Demand Spike",
    response: {
      title: "Tariff Season Transition + Notified Demand Spike",
      body: "High-season Megaflex tariffs took effect on June 1 (+58% peak energy rate adjustment). Concurrently, Site 04 recorded an unscheduled simultaneous maximum demand of 9,120 kVA during evening peak hours on June 12.",
      variance: "+R 184,300.00",
      varianceType: "increase",
      confidence: "98.4%",
      citation: "NERSA Schedule 2, Clause 8.4",
      evidence: "2,880 AMR Intervals Verified",
      action:
        "Trigger automatic load-shifting protocol for 17:00–19:00 peak hours. Dispute 120 kVA transient peak caused by upstream sub-station transformer switching fault.",
      disputeForm: "Eskom Billing Query (Form 102)",
      highlightTerms: ["June 1", "+58%", "Site 04", "9,120 kVA", "June 12"],
    },
  },
  {
    question: "Which site has the highest demand variance against telemetry?",
    category: "Site Diagnostics",
    tag: "Site 04 Audit",
    response: {
      title: "Site 04 (Rustenburg Smelter Sub-Station)",
      body: "Site 04 exhibits a 22.7% billed demand overstatement compared to AMR 30-minute interval telemetry. The utility billed 9,450 kVA against an actual verified physical meter peak of 7,705 kVA.",
      variance: "R 18,420.00 Overcharge",
      varianceType: "overcharge",
      confidence: "99.2%",
      citation: "Eskom NRS 048-4 / Meter Spec CT-400",
      evidence: "Hardware Pulse Log Synchronised",
      action:
        "Issue formal Section 21 Eskom billing query accompanied by verified interval log evidence and signed calibration certificate.",
      disputeForm: "Section 21 Formal Demand Dispute",
      highlightTerms: ["Site 04", "22.7%", "9,450 kVA", "7,705 kVA", "Section 21"],
    },
  },
  {
    question: "Show invoices with potential overcharges across Q2.",
    category: "Audit Filter",
    tag: "3 Invoices Flagged",
    response: {
      title: "3 Invoices Flagged Across Q2 (R 421,890 Recoverable)",
      body: "Identified 2 incorrect public holiday substitutions (Worker's Day and Youth Day billed at peak weekday rates instead of Sunday off-peak rates) plus 1 meter multiplier misconfiguration following CT ratio upgrade.",
      variance: "R 421,890.00 Recoverable",
      varianceType: "recovery",
      confidence: "99.7%",
      citation: "NERSA Tariff Book 2024/25, Rule 4.3",
      evidence: "Revenue Check Meter Synchronized",
      action:
        "Dispute dossier auto-compiled into formal NERSA regulatory dispute package with line-item credit note requisitions.",
      disputeForm: "Credit Note Requisition Dossier",
      highlightTerms: [
        "Worker's Day",
        "Youth Day",
        "Sunday off-peak",
        "CT ratio upgrade",
        "R 421,890.00",
      ],
    },
  },
  {
    question: "Which tariff would have minimized our annual spend?",
    category: "Tariff Optimization",
    tag: "Megaflex vs Miniflex",
    response: {
      title: "Tariff Comparison: Megaflex vs Miniflex vs Nightsave",
      body: "Due to your high load factor (>78%) and on-site solar PV peak shaving between 11:00 and 15:00, staying on Megaflex saves R 68,400/month compared to standard Miniflex, despite higher network access charges.",
      variance: "R 820,800.00 Annual Savings",
      varianceType: "savings",
      confidence: "96.8%",
      citation: "Eskom Schedule of Standard Prices 2024",
      evidence: "8,760 Hourly Profile Modelled",
      action:
        "Maintain current Megaflex transmission connection agreement. Evaluate BESS battery storage arbitrage for 07:00 morning peak.",
      disputeForm: "Tariff Migration Evaluation Rep",
      highlightTerms: [">78%", "11:00 and 15:00", "R 68,400/month", "Megaflex"],
    },
  },
  {
    question: "Find all anomalies above R10,000 in the latest cycle.",
    category: "Threshold Anomaly",
    tag: "4 High-Impact Isolations",
    response: {
      title: "4 High-Impact Line-Item Anomalies Isolated",
      body: "1. Peak demand mismatch at Durban plant (R 46,176). 2. Low power factor surcharge miscalculation (R 28,757). 3. Mid-month seasonal rate transition pro-rata error (R 18,420). 4. Unbilled ancillary service charge dispute (R 12,300).",
      variance: "R 105,653.00 Net Impact",
      varianceType: "recovery",
      confidence: "97.5%",
      citation: "Eskom Distribution Code Sec 6.2",
      evidence: "4 Discrepancy Vectors Isolated",
      action:
        "All 4 claims auto-formatted into Eskom Billing Resolution Form 102 with line-item mathematical breakdown and meter interval logs.",
      disputeForm: "Form 102 Regulatory Pack",
      highlightTerms: ["R 46,176", "R 28,757", "R 18,420", "R 12,300", "Form 102"],
    },
  },
  {
    question: "Validate public holiday billing rules for the entire year.",
    category: "Compliance & Holiday",
    tag: "TOU Calendar Audit",
    response: {
      title: "12 Public Holidays Reconciled: 2 Non-Compliant Billing Events",
      body: "Under Eskom Megaflex regulations, recognized public holidays must be billed at Sunday off-peak time-of-use tariffs. Human Rights Day and Freedom Day were improperly billed as normal high-tariff weekdays on Meter ESK-9921.",
      variance: "R 73,410.00 Overbilled",
      varianceType: "overcharge",
      confidence: "99.9%",
      citation: "Public Holidays Act 36 of 1994 & NERSA TOU",
      evidence: "Official Calendar Gazette Verified",
      action:
        "Immediate credit note request submitted via Eskom Customer Executive portal with calendar reconciliation annexure.",
      disputeForm: "NERSA TOU Non-Compliance Notice",
      highlightTerms: [
        "Sunday off-peak",
        "Human Rights Day",
        "Freedom Day",
        "ESK-9921",
        "R 73,410.00",
      ],
    },
  },
];

const CYCLE_DURATION_MS = 8000;
const CYCLE_STEP_MS = 80;

export function EneraCopilotSection() {
  const [selectedIdx, setSelectedIdx] = useState<number>(1); // Default to Site 04 query
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [typedPrompt, setTypedPrompt] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  const cur = QUERIES[selectedIdx];
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isInView, setIsInView] = useState<boolean>(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }
  }, []);

  // Viewport intersection observer to pause rotation when off-screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Typewriter streaming effect when query changes
  useEffect(() => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    const fullText = cur.question;

    if (prefersReducedMotion) {
      setTypedPrompt(fullText);
      setIsTyping(false);
      return;
    }

    setTypedPrompt("");
    setIsTyping(true);
    let charIdx = 0;

    typingTimerRef.current = setInterval(() => {
      charIdx++;
      if (charIdx <= fullText.length) {
        setTypedPrompt(fullText.slice(0, charIdx));
      } else {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
        setIsTyping(false);
      }
    }, 18);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [selectedIdx, prefersReducedMotion, cur.question]);

  // Auto-rotation timer loop (Paused when offscreen or hovered)
  useEffect(() => {
    if (!isAutoPlaying || isHovered || !isInView) {
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (CYCLE_STEP_MS / CYCLE_DURATION_MS) * 100;
        if (next >= 100) {
          setSelectedIdx((currentIdx) => (currentIdx + 1) % QUERIES.length);
          return 0;
        }
        return next;
      });
    }, CYCLE_STEP_MS);

    return () => clearInterval(interval);
  }, [isAutoPlaying, isHovered, isInView]);

  const handleSelectQuery = useCallback((idx: number) => {
    setSelectedIdx(idx);
    setProgress(0);
  }, []);

  const toggleAutoPlay = useCallback(() => {
    setIsAutoPlaying((prev) => !prev);
    setProgress(0);
  }, []);

  // Highlight specific keywords in text
  const renderHighlightedText = (text: string, terms: string[]) => {
    if (!terms || terms.length === 0) return text;
    // Build regex to match terms safely
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isMatch = terms.some((t) => t.toLowerCase() === part.toLowerCase());
      if (isMatch) {
        return (
          <span
            key={i}
            className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-200 font-mono font-medium border border-cyan-500/20"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getVarianceColorClasses = (type: AiQuery["response"]["varianceType"]) => {
    switch (type) {
      case "overcharge":
      case "recovery":
        return {
          bg: "bg-rose-950/30",
          border: "border-rose-500/30",
          text: "text-rose-300",
          badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        };
      case "savings":
        return {
          bg: "bg-emerald-950/30",
          border: "border-emerald-500/30",
          text: "text-emerald-300",
          badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        };
      case "increase":
      default:
        return {
          bg: "bg-amber-950/30",
          border: "border-amber-500/30",
          text: "text-amber-300",
          badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        };
    }
  };

  const varianceColors = getVarianceColorClasses(cur.response.varianceType);

  return (
    <section
      ref={sectionRef}
      id="intelligence"
      className="relative py-28 sm:py-32 bg-[#030712] text-white overflow-hidden"
      aria-label="AI Energy Copilot Cognition"
    >
      {/* Ambient background glow accents */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-1/4 w-[500px] h-[350px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <EnginePhaseTag
            phase="03"
            name="UNDERSTANDING"
            sub="COGNITIVE GRID SYNTHESIS"
          />

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight enera-text-gradient">
            ASK YOUR ENERGY DATA.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            AI-assisted analysis helps users investigate complex energy information faster. Ask in
            plain English to analyze billing and consumption signals, surface unusual patterns, and
            identify material differences in real time.
          </p>
        </div>

        {/* Main Copilot Console Container */}
        <div
          className="mt-14 max-w-6xl mx-auto rounded-2xl bg-[#0d1117] border border-white/10 shadow-[0_0_80px_-20px_rgba(6,182,212,0.2)] overflow-hidden transition-all"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Terminal Chrome Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {/* macOS window control dots */}
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600/40 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/40 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/40 inline-block" />
              </div>
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-mono text-slate-300 font-medium">
                  enera-recon-core // copilot-v2.4
                </span>
              </div>
            </div>

            {/* Status indicators & auto-cycle control */}
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 -ml-3" />
                <span>ONLINE · GROUNDED IN NERSA TARIFFS</span>
              </div>

              {/* Auto-cycle toggle button */}
              <button
                type="button"
                onClick={toggleAutoPlay}
                aria-label={
                  isAutoPlaying ? "Pause automated query cycle" : "Resume automated query cycle"
                }
                title={isAutoPlaying ? "Pause auto-rotation" : "Resume auto-rotation"}
                className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition-colors focus-ring-enera ${
                  isAutoPlaying
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
                    : "bg-white/5 border-white/10 text-slate-300 hover:text-white"
                }`}
              >
                {isAutoPlaying ? (
                  <>
                    <Pause className="h-3 w-3" />
                    <span className="hidden md:inline">AUTO (8s)</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    <span className="hidden md:inline">PAUSED</span>
                  </>
                )}
              </button>

              <span className="text-slate-500 hidden sm:inline" aria-hidden="true">
                |
              </span>
              <span className="text-[11px] text-cyan-400/90 hidden md:inline">LATENCY: 42ms</span>
            </div>
          </div>

          {/* Active Auto-cycle Progress Line */}
          {isAutoPlaying && (
            <div className="h-0.5 w-full bg-white/5 relative overflow-hidden" aria-hidden="true">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all ease-linear"
                style={{
                  width: `${progress}%`,
                  transitionDuration: `${CYCLE_STEP_MS}ms`,
                }}
              />
            </div>
          )}

          {/* Interactive Console Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: Natural Language Prompt Selector */}
            <div className="lg:col-span-5 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-white/10 space-y-2 bg-[#080c14]/70">
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3 w-3 text-cyan-400" />
                  FREQUENT EXECUTIVE QUERIES
                </span>
                {isHovered && isAutoPlaying && (
                  <span className="text-[10px] font-mono text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20 animate-pulse">
                    PAUSED ON HOVER
                  </span>
                )}
              </div>

              <div className="space-y-1.5" role="tablist" aria-label="Energy queries">
                {QUERIES.map((q, idx) => {
                  const isSelected = selectedIdx === idx;
                  return (
                    <button
                      key={q.question}
                      role="tab"
                      id={`copilot-tab-${idx}`}
                      aria-controls="copilot-panel"
                      aria-selected={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => handleSelectQuery(idx)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                          e.preventDefault();
                          handleSelectQuery((idx + 1) % QUERIES.length);
                        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                          e.preventDefault();
                          handleSelectQuery((idx - 1 + QUERIES.length) % QUERIES.length);
                        } else if (e.key === "Home") {
                          e.preventDefault();
                          handleSelectQuery(0);
                        } else if (e.key === "End") {
                          e.preventDefault();
                          handleSelectQuery(QUERIES.length - 1);
                        }
                      }}
                      className={`w-full text-left p-3 rounded-xl text-xs transition-all relative overflow-hidden flex flex-col gap-1.5 group focus-ring-enera ${
                        isSelected
                          ? "bg-gradient-to-r from-cyan-500/15 to-transparent border border-cyan-500/40 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                          : "text-slate-300 hover:text-white hover:bg-white/[0.03] border border-transparent"
                      }`}
                    >
                      {/* Active indicator border highlight */}
                      {isSelected && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400"
                          aria-hidden="true"
                        />
                      )}

                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                          {q.category}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400/80 group-hover:text-cyan-300">
                          {q.tag}
                        </span>
                      </div>

                      <div className="flex items-start gap-2 pl-0.5">
                        <CornerDownRight
                          className={`h-3.5 w-3.5 mt-0.5 shrink-0 transition-transform ${
                            isSelected
                              ? "text-cyan-400 translate-x-0.5"
                              : "text-slate-500 group-hover:text-slate-300"
                          }`}
                        />
                        <span
                          className={`leading-snug ${isSelected ? "font-medium text-slate-100" : ""}`}
                        >
                          &ldquo;{q.question}&rdquo;
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Console Prompt Quick Hint */}
              <div className="pt-2 px-2 text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-white/5">
                <span>Select a query or use arrow keys</span>
                <span className="text-cyan-400/80 font-semibold">
                  {selectedIdx + 1} / {QUERIES.length}
                </span>
              </div>
            </div>

            {/* Right Column: AI Intelligence Synthesis Engine */}
            <div
              role="tabpanel"
              id="copilot-panel"
              aria-labelledby={`copilot-tab-${selectedIdx}`}
              aria-live="polite"
              className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-transparent to-[#0a0e17]/80"
            >
              <div>
                {/* Active Terminal Input Line Simulation */}
                <div
                  className="mb-6 p-3.5 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-cyan-300 flex items-center gap-2 overflow-x-auto"
                  aria-label={`Prompt: ${cur.question}`}
                >
                  <span className="text-emerald-400 font-bold select-none">&gt;</span>
                  <span className="text-slate-500 select-none">enera.ask(</span>
                  <span className="text-cyan-200 flex-1 whitespace-normal">
                    &ldquo;{typedPrompt}&rdquo;
                    {isTyping && (
                      <span className="inline-block w-2 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                    )}
                  </span>
                  <span className="text-slate-500 select-none">)</span>
                </div>

                {/* Synthesis Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-mono uppercase text-cyan-400 font-bold tracking-wider">
                      AI RECONCILIATION SYNTHESIS
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      {cur.response.confidence} CONFIDENCE
                    </span>
                  </div>
                </div>

                {/* Structured Synthesis Output */}
                <div className="mt-5 space-y-5">
                  {/* Finding Title */}
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                      DIAGNOSTIC FINDING
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white font-mono tracking-tight leading-tight">
                      {cur.response.title}
                    </h3>
                  </div>

                  {/* Body Paragraph with Highlighting */}
                  <div className="text-sm text-slate-300 leading-relaxed font-sans bg-white/[0.015] p-4 rounded-xl border border-white/5">
                    {renderHighlightedText(cur.response.body, cur.response.highlightTerms)}
                  </div>

                  {/* Telemetry Metrics Grid (4 Cards) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Variance Metric Card */}
                    <div
                      className={`p-3.5 rounded-xl border ${varianceColors.bg} ${varianceColors.border}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                          FINANCIAL VARIANCE
                        </span>
                        <TrendingUp className={`h-3 w-3 ${varianceColors.text}`} />
                      </div>
                      <div
                        className={`text-base sm:text-lg font-bold font-mono mt-1 ${varianceColors.text}`}
                      >
                        {cur.response.variance}
                      </div>
                    </div>

                    {/* Regulatory Citation Card */}
                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wide">
                          REGULATORY BASIS
                        </span>
                        <FileText className="h-3 w-3 text-cyan-400" />
                      </div>
                      <div className="text-xs sm:text-sm font-semibold font-mono text-cyan-200 mt-1 truncate">
                        {cur.response.citation}
                      </div>
                    </div>

                    {/* Evidence Source Card */}
                    <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wide">
                          TELEMETRY AUDIT
                        </span>
                        <Zap className="h-3 w-3 text-purple-400" />
                      </div>
                      <div className="text-xs sm:text-sm font-semibold font-mono text-purple-200 mt-1 truncate">
                        {cur.response.evidence}
                      </div>
                    </div>

                    {/* Statutory Claim Status Card */}
                    <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                          STATUTORY CLAIM
                        </span>
                        <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-emerald-300 mt-1 font-semibold truncate">
                        {cur.response.disputeForm}
                      </div>
                    </div>
                  </div>

                  {/* Recommended Action Protocol */}
                  <div className="p-4 rounded-xl bg-[#161b22] border border-white/10 text-xs text-slate-300 flex items-start gap-3 shadow-inner">
                    <div className="p-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                          RECOMMENDED AUDIT ACTION
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                          {cur.response.disputeForm}
                        </span>
                      </div>
                      <p className="text-slate-200 leading-normal font-sans">
                        {cur.response.action}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Interactive Dispatch Footer */}
              <div className="mt-8 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>ENGINE: ENERA-RECON-V2.4 (ZERO HALLUCINATION GUARANTEE)</span>
                </div>

                <Link
                  to="/reconciliation"
                  className="inline-flex items-center gap-1.5 text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg border border-cyan-500/30 transition-all font-sans font-medium text-xs group focus-ring-enera"
                >
                  <span>Query In Live Portal</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
