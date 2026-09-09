import { useEffect, useState } from "react";
import { TrendingUp, ShieldCheck, DollarSign, Activity } from "lucide-react";

export function ExecutiveRoiSection() {
  const [counts, setCounts] = useState({
    spend: 0,
    recovery: 0,
    accuracy: 0,
    anomalies: 0,
  });

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const intervalTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = Math.min(1, step / steps);
      // Ease out quartic
      const ease = 1 - Math.pow(1 - progress, 4);

      setCounts({
        spend: parseFloat((8.4 * ease).toFixed(1)),
        recovery: Math.round(421 * ease),
        accuracy: parseFloat((98.7 * ease).toFixed(1)),
        anomalies: Math.round(17 * ease),
      });

      if (step >= steps) {
        clearInterval(timer);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-24 md:py-36 bg-gradient-to-b from-card/30 via-background to-background border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Executive Financial Impact</span>
          </div>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground">
            Stop Managing Bills.
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-cyan-400 to-emerald-400">
              Start Managing Energy Spend.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Measurable balance-sheet ROI achieved through automated billing dispute recovery and precision demand optimization.
          </p>
        </div>

        {/* 4 Large Counter Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Metric 1 */}
          <div className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-2 text-center hover:border-primary/50 transition-colors">
            <div className="text-xs font-mono uppercase text-muted-foreground tracking-wider font-semibold">
              Energy Spend Audited
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-black text-foreground">
              R {counts.spend}M+
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Monthly enterprise utility expenditure protected
            </div>
          </div>

          {/* Metric 2 */}
          <div className="p-6 sm:p-8 rounded-2xl border border-amber-500/40 bg-amber-500/5 backdrop-blur-sm space-y-2 text-center hover:border-amber-500/60 transition-colors">
            <div className="text-xs font-mono uppercase text-amber-400 tracking-wider font-semibold">
              Potential Recoveries
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-black text-amber-400">
              R {counts.recovery}K+
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Direct billing overcharges surfaced for credit claims
            </div>
          </div>

          {/* Metric 3 */}
          <div className="p-6 sm:p-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 backdrop-blur-sm space-y-2 text-center hover:border-emerald-500/60 transition-colors">
            <div className="text-xs font-mono uppercase text-emerald-400 tracking-wider font-semibold">
              Settlement Accuracy
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-black text-emerald-400">
              {counts.accuracy}%
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Zero-float precision arithmetic against NERSA rules
            </div>
          </div>

          {/* Metric 4 */}
          <div className="p-6 sm:p-8 rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm space-y-2 text-center hover:border-primary/50 transition-colors">
            <div className="text-xs font-mono uppercase text-muted-foreground tracking-wider font-semibold">
              Active Anomalies
            </div>
            <div className="text-4xl sm:text-5xl font-mono font-black text-primary">
              {counts.anomalies}
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Operational leaks & demand ratchets under management
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
