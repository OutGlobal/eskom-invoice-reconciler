import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Zap,
  Lock,
} from "lucide-react";

interface SamplePreset {
  id: string;
  name: string;
  utility: string;
  tariff: string;
  invoiceValue: string;
  expectedValue: string;
  varianceValue: string;
  consumption: string;
  demand: string;
  confidence: string;
  anomalies: number;
}

const PRESETS: SamplePreset[] = [
  {
    id: "impala",
    name: "Mining & Heavy Smelter",
    utility: "Eskom Transmission",
    tariff: "Megaflex HV (33kV)",
    invoiceValue: "R 842,431.00",
    expectedValue: "R 791,204.00",
    varianceValue: "R 51,227.00",
    consumption: "4,218,441 kWh",
    demand: "8,421 kVA",
    confidence: "97.8%",
    anomalies: 3,
  },
  {
    id: "mfg",
    name: "Industrial Manufacturing",
    utility: "City of Johannesburg (City Power)",
    tariff: "Large Power User MV",
    invoiceValue: "R 364,120.00",
    expectedValue: "R 342,850.00",
    varianceValue: "R 21,270.00",
    consumption: "1,850,220 kWh",
    demand: "3,210 kVA",
    confidence: "98.4%",
    anomalies: 2,
  },
  {
    id: "muni",
    name: "Municipal Bulk Incomer",
    utility: "Eskom Distribution",
    tariff: "Megaflex Non-Local Authority",
    invoiceValue: "R 1,480,950.00",
    expectedValue: "R 1,412,300.00",
    varianceValue: "R 68,650.00",
    consumption: "8,120,400 kWh",
    demand: "14,850 kVA",
    confidence: "99.1%",
    anomalies: 4,
  },
];

const PROCESSING_STEPS = [
  "01 Reading invoice & parsing document tokens",
  "02 Extracting 14 billing determinants (kWh, kVA, rates)",
  "03 Identifying applicable gazetted NERSA tariff schedule",
  "04 Validating TOU clock schedule & seasonal boundaries",
  "05 Comparing historical interval telemetry & baseline usage",
  "06 Reconciling 30-min meter AMR data stream with power factor",
  "07 Detecting rate, demand, and reactive anomalies",
  "08 Calculating net recoverable financial variance",
];

export function InteractiveBillDemo() {
  const [activePreset, setActivePreset] = useState<SamplePreset>(PRESETS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(true);

  const runSimulation = (preset: SamplePreset) => {
    setActivePreset(preset);
    setIsProcessing(true);
    setAnalysisComplete(false);
    setCurrentStepIndex(0);
  };

  useEffect(() => {
    if (!isProcessing) return;

    if (currentStepIndex < PROCESSING_STEPS.length) {
      const stepTimer = setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 420);
      return () => clearTimeout(stepTimer);
    } else {
      setIsProcessing(false);
      setAnalysisComplete(true);
    }
  }, [isProcessing, currentStepIndex]);

  return (
    <section id="interactive-demo" className="py-20 md:py-32 bg-background border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5" />
            <span>Interactive Demonstration</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Drop a Bill. Watch the Intelligence Begin.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Test the reconciliation engine with real-world sample energy invoices.
          </p>
        </div>

        {/* Preset Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground font-mono mr-2">Select a Sample Bill:</span>
          {PRESETS.map((p) => {
            const isSelected = activePreset.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => runSimulation(p)}
                disabled={isProcessing}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 font-semibold"
                    : "bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        {/* Interactive Workspace Container */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Dropzone & Live Processing Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Simulated Drag and Drop Zone */}
            <div
              onClick={() => runSimulation(activePreset)}
              className="relative rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/60 bg-card/40 hover:bg-card/70 p-8 text-center transition-all cursor-pointer group space-y-4 shadow-sm"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/25 text-primary group-hover:scale-110 transition-transform">
                <UploadCloud className="h-7 w-7" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold text-foreground">
                  Drop an Eskom or municipal invoice here
                </div>
                <p className="text-xs text-muted-foreground">
                  or click to trigger automated audit simulation
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                  PDF
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                  CSV
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                  XLSX
                </span>
              </div>
            </div>

            {/* Processing Steps Checklist */}
            <div className="rounded-xl border border-border/80 bg-card/60 p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-border/50 pb-2 text-xs font-mono">
                <span className="text-muted-foreground">ENGINE TRACE</span>
                <span className="text-primary font-semibold">
                  {isProcessing ? "PROCESSING..." : "AUDIT COMPLETE"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                {PROCESSING_STEPS.map((step, idx) => {
                  const isDone = analysisComplete || idx < currentStepIndex;
                  const isCurrent = isProcessing && idx === currentStepIndex;
                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-2 py-1 px-2 rounded transition-colors ${
                        isCurrent
                          ? "bg-primary/15 text-primary font-semibold"
                          : isDone
                          ? "text-foreground"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                      )}
                      <span className="truncate text-[11px]">{step}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Analysis Dashboard Result Column (7 cols) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-6 shadow-xl space-y-5">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {activePreset.utility}
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {activePreset.name} — {activePreset.tariff}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{activePreset.anomalies} ANOMALIES FOUND</span>
                </span>
              </div>

              {/* Top 3 Core Financials */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-background/60 border border-border/50">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Invoice Value
                  </div>
                  <div className="text-base sm:text-lg font-mono font-bold text-foreground mt-1">
                    {activePreset.invoiceValue}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Billed Amount</div>
                </div>

                <div className="p-3 rounded-xl bg-background/60 border border-border/50">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    Expected Value
                  </div>
                  <div className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-1">
                    {activePreset.expectedValue}
                  </div>
                  <div className="text-[10px] text-emerald-500">NERSA Tariff</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <div className="text-[10px] font-mono text-amber-400 uppercase font-semibold">
                    Potential Variance
                  </div>
                  <div className="text-base sm:text-lg font-mono font-bold text-amber-400 mt-1 flex items-center justify-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>{activePreset.varianceValue}</span>
                  </div>
                  <div className="text-[10px] text-amber-300 font-mono">Overcharge Claim</div>
                </div>
              </div>

              {/* Determinants Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                  <div className="text-[10px] text-muted-foreground font-mono">Consumption</div>
                  <div className="font-mono font-bold text-foreground mt-0.5">
                    {activePreset.consumption}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                  <div className="text-[10px] text-muted-foreground font-mono">Peak Demand</div>
                  <div className="font-mono font-bold text-foreground mt-0.5">
                    {activePreset.demand}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                  <div className="text-[10px] text-muted-foreground font-mono">Tariff Structure</div>
                  <div className="font-mono font-bold text-foreground mt-0.5 truncate">
                    Megaflex HV
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-background/40 border border-border/40">
                  <div className="text-[10px] text-muted-foreground font-mono">AI Confidence</div>
                  <div className="font-mono font-bold text-primary mt-0.5">
                    {activePreset.confidence}
                  </div>
                </div>
              </div>

              {/* Discrepancy Evidence Alert */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-xs">
                <div className="font-semibold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Root-Cause Anomaly Breakdown</span>
                </div>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  <li>
                    <strong className="text-foreground">Peak Energy Misclassification:</strong>{" "}
                    131,227 kWh billed at high season rate instead of gazetted low season rate.
                  </li>
                  <li>
                    <strong className="text-foreground">Demand Ratchet Discrepancy:</strong> Billed on
                    8,421 kVA vs recorded interval maximum demand of 8,110 kVA.
                  </li>
                  <li>
                    <strong className="text-foreground">Rural Subsidy Base Error:</strong> Billed
                    determinant does not align with active monthly energy sum.
                  </li>
                </ul>
              </div>

              {/* Portal Gateway CTA */}
              <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Live client portal access required for proprietary invoices.</span>
                </div>
                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Sign In to Run on Live Invoices →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
