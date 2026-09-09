import { ArrowRight, Scale, TrendingUp, Zap, CheckCircle2, ShieldCheck } from "lucide-react";

export function ReconciliationVisualSection() {
  return (
    <section className="py-20 md:py-28 bg-background border-b border-border/60 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <Scale className="h-3.5 w-3.5" />
            <span>Telemetry vs Billing Delta</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Two Streams Enter. Truth Emerges.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            How independent 30-minute interval telemetry uncovers invisible invoice variance.
          </p>
        </div>

        {/* Dual Stream Convergence Visual */}
        <div className="relative rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Stream 1: Billed Energy (4 cols) */}
            <div className="md:col-span-4 p-5 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2 text-center md:text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 h-16 w-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
                STREAM A // UTILITY INVOICE
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-foreground">
                4,218,441 <span className="text-xs font-normal text-muted-foreground">kWh</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Revenue meter billed figure extracted from official Eskom invoice document.
              </p>
            </div>

            {/* Middle Convergence Node (4 cols) */}
            <div className="md:col-span-4 flex flex-col items-center justify-center space-y-3 text-center py-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 border border-primary flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1 font-mono">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  DETERMINISTIC CONVERGENCE
                </div>
                <div className="text-xs font-bold text-foreground">
                  Variance Detected:
                </div>
                <div className="text-lg font-bold text-amber-400">
                  131,227 kWh
                </div>
              </div>
            </div>

            {/* Stream 2: Actual / Meter Energy (4 cols) */}
            <div className="md:col-span-4 p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2 text-center md:text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                STREAM B // ACTUAL AMR TELEMETRY
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-black text-foreground">
                4,087,214 <span className="text-xs font-normal text-muted-foreground">kWh</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Independent check meter recorded 2,880 intervals verified at SAST timestamp.
              </p>
            </div>
          </div>

          {/* Result Outcome Banner */}
          <div className="rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-background/80 to-amber-500/10 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-[11px] font-mono text-amber-400 uppercase font-semibold">
                FINANCIAL DISPUTE QUANTIFICATION
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground">
                Potential Recoverable Impact:{" "}
                <span className="text-amber-400 font-mono">R 51,227.00</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Calculated across TOU differential rates + corresponding 15% VAT adjustment.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                <span>DISPUTE READY</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
