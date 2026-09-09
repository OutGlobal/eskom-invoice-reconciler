import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Zap,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  FileText,
  Activity,
  Cpu,
  Layers,
  CheckCircle2,
  Lock,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface HeroSectionProps {
  onAnalyseClick?: () => void;
}

export function HeroSection({ onAnalyseClick }: HeroSectionProps) {
  const [activeStage, setActiveStage] = useState(0);

  const stages = [
    { label: "INVOICE", detail: "PDF & OCR Ingestion", color: "text-blue-400" },
    { label: "AI EXTRACTION", detail: "14 Billing Determinants", color: "text-cyan-400" },
    { label: "TARIFF ENGINE", detail: "NERSA Gazetted Rules", color: "text-indigo-400" },
    { label: "METER DATA", detail: "30-Min AMR Streams", color: "text-emerald-400" },
    { label: "RECONCILIATION", detail: "Zero-Float Variance Audit", color: "text-purple-400" },
    { label: "ANOMALY DETECTION", detail: "3 Violations Isolated", color: "text-amber-400" },
    { label: "RECOVERY", detail: "R 51,227 Claim Pack", color: "text-emerald-300" },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [stages.length]);

  return (
    <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-gradient-to-b from-background via-background/95 to-card/20">
      {/* Background Animated Ambient Energy Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none -z-10"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "4rem 4rem",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Narrative Headline & CTAs (45–50%) */}
          <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
            {/* Category Definition Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary backdrop-blur-sm shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="uppercase tracking-widest text-[10px]">
                Energy Financial Control System
              </span>
            </div>

            {/* Cinematic Headline */}
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-foreground leading-[1.08]">
              Turn Every Electricity Bill Into{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-cyan-400 to-emerald-400">
                Intelligence.
              </span>
            </h1>

            {/* Supporting Statement */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              AI-powered utility reconciliation that finds billing errors, exposes energy anomalies
              and shows exactly where your money is going.
            </p>

            {/* Core Value Proposition Axiom */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm text-xs font-mono space-y-1 max-w-md mx-auto lg:mx-0 text-left border-l-4 border-l-primary">
              <div className="text-muted-foreground flex items-center gap-1.5">
                <span className="text-primary font-bold">01</span>
                <span>Know what you should pay.</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-1.5">
                <span className="text-cyan-400 font-bold">02</span>
                <span>Know what you actually paid.</span>
              </div>
              <div className="text-foreground font-semibold flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">03</span>
                <span>Know where the difference went.</span>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
              <button
                onClick={
                  onAnalyseClick ||
                  (() => {
                    const el = document.getElementById("interactive-demo");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  })
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-lg shadow-primary/25 group"
              >
                <Sparkles className="h-4 w-4" />
                <span>Analyse Your First Bill</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium border border-border bg-card/80 hover:bg-muted/80 text-foreground transition-colors"
              >
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span>Client Portal Login</span>
              </Link>
            </div>

            {/* Trust Statement */}
            <p className="text-xs text-muted-foreground/80 flex items-center justify-center lg:justify-start gap-2 pt-1">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Built for Eskom, municipal and multi-site energy environments.</span>
            </p>
          </div>

          {/* Right Column: Interactive Energy Intelligence Engine Visual (50–55%) */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl p-5 md:p-6 shadow-2xl shadow-black/40 overflow-hidden space-y-5">
              {/* Header Bar of the Intelligence Engine */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs font-mono font-medium text-muted-foreground">
                    ENERGY_INTELLIGENCE_ENGINE // PIPELINE_RUN_ACTIVE
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-400">TELEMETRY_SYNCED</span>
                </div>
              </div>

              {/* Live Flow Pipeline Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>SYSTEM PIPELINE STAGE</span>
                  <span className="text-primary font-semibold">
                    {stages[activeStage].label} (0{activeStage + 1}/07)
                  </span>
                </div>

                {/* Progress Pipeline Nodes */}
                <div className="grid grid-cols-7 gap-1 bg-background/50 p-1.5 rounded-lg border border-border/60">
                  {stages.map((stage, idx) => {
                    const isCurrent = idx === activeStage;
                    const isDone = idx < activeStage;
                    return (
                      <div
                        key={stage.label}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          isCurrent
                            ? "bg-gradient-to-r from-primary to-cyan-400 shadow-sm shadow-primary"
                            : isDone
                            ? "bg-emerald-500/60"
                            : "bg-muted/40"
                        }`}
                        title={stage.label}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Core Financial Delta Card (Realistic Product Intelligence) */}
              <div className="rounded-xl border border-border/90 bg-background/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div>
                    <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                      Impala Mining Complex · Feeder #04 (Megaflex High Voltage)
                    </div>
                    <div className="text-xs font-semibold text-foreground">
                      Active Period Billing Audit Settlement
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    3 BILLING ANOMALIES DETECTED
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/40 space-y-0.5">
                    <div className="text-[10px] font-mono text-muted-foreground">INVOICE VALUE</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-foreground">
                      R 842,431
                    </div>
                    <div className="text-[9px] text-muted-foreground">Billed by Utility</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-card/60 border border-border/40 space-y-0.5">
                    <div className="text-[10px] font-mono text-muted-foreground">EXPECTED VALUE</div>
                    <div className="text-base sm:text-lg font-mono font-bold text-emerald-400">
                      R 791,204
                    </div>
                    <div className="text-[9px] text-emerald-500">Calculated Tariff</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-0.5">
                    <div className="text-[10px] font-mono text-amber-400 font-semibold">
                      VARIANCE RECOVERABLE
                    </div>
                    <div className="text-base sm:text-lg font-mono font-bold text-amber-400 flex items-center justify-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>R 51,227</span>
                    </div>
                    <div className="text-[9px] text-amber-300 font-mono">+6.47% Overcharge</div>
                  </div>
                </div>
              </div>

              {/* Realistic Telemetry UI Fragments Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-background/50 border border-border/50 space-y-1">
                  <div className="text-[10px] text-muted-foreground font-mono">kWh Billed</div>
                  <div className="font-mono font-bold text-foreground">4,218,441</div>
                  <div className="text-[9px] text-muted-foreground">Utility Meter #785</div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/50 border border-border/50 space-y-1">
                  <div className="text-[10px] text-muted-foreground font-mono">Actual kWh (AMR)</div>
                  <div className="font-mono font-bold text-emerald-400">4,087,214</div>
                  <div className="text-[9px] text-emerald-500">30-min Check Meter</div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/50 border border-border/50 space-y-1">
                  <div className="text-[10px] text-muted-foreground font-mono">Peak Demand</div>
                  <div className="font-mono font-bold text-foreground">8,421 kVA</div>
                  <div className="text-[9px] text-amber-400">Exceeds NMD by 42kVA</div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/50 border border-border/50 space-y-1">
                  <div className="text-[10px] text-muted-foreground font-mono">AI Confidence</div>
                  <div className="font-mono font-bold text-primary">97.8%</div>
                  <div className="text-[9px] text-primary/80">Deterministic Audit</div>
                </div>
              </div>

              {/* Animated Live Pipeline Trace Item */}
              <div className="p-3 rounded-lg bg-gradient-to-r from-card/90 via-background/90 to-card/90 border border-primary/30 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary animate-spin" />
                  <span className="text-muted-foreground">ANALYSIS:</span>
                  <span className="text-foreground font-semibold">
                    {stages[activeStage].detail}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-primary/20 text-primary font-bold">
                  VERIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
