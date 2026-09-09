import { Zap } from "lucide-react";

export function BigIdeaSection() {
  return (
    <section className="relative py-24 md:py-36 bg-background border-y border-border/50 overflow-hidden">
      {/* Background Subtle Gradient Lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span>The Financial Reality</span>
        </div>

        {/* Large Typographic Narrative Progression */}
        <div className="space-y-6 sm:space-y-8">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tight text-muted-foreground leading-tight">
            Your electricity bill is not just an invoice.
          </h2>

          <div className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-foreground">
            It is a{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-cyan-400 to-emerald-400">
              dataset.
            </span>
          </div>

          <p className="text-xl sm:text-3xl md:text-4xl font-normal text-muted-foreground/90 max-w-4xl mx-auto leading-snug">
            And inside that dataset are errors, patterns, inefficiencies and money.
          </p>

          <div className="pt-4">
            <span className="inline-block text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-primary font-mono border-b-2 border-primary/40 pb-2">
              We find them.
            </span>
          </div>
        </div>

        {/* Metric proof bar */}
        <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto border-t border-border/50 text-left">
          <div className="p-3">
            <div className="text-xl font-bold font-mono text-foreground">14</div>
            <div className="text-xs text-muted-foreground">Determinants per bill</div>
          </div>
          <div className="p-3">
            <div className="text-xl font-bold font-mono text-foreground">2,880</div>
            <div className="text-xs text-muted-foreground">30-min intervals / month</div>
          </div>
          <div className="p-3">
            <div className="text-xl font-bold font-mono text-foreground">100%</div>
            <div className="text-xs text-muted-foreground">Deterministic audit trail</div>
          </div>
          <div className="p-3">
            <div className="text-xl font-bold font-mono text-emerald-400">0%</div>
            <div className="text-xs text-muted-foreground">Float rounding error</div>
          </div>
        </div>
      </div>
    </section>
  );
}
