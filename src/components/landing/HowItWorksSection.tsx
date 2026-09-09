import { UploadCloud, Cpu, Scale, FileSpreadsheet, ArrowRight } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "UPLOAD",
      description: "Invoices, meter data and utility information enter the platform.",
      details: "Upload Eskom or municipal PDFs, CSV interval feeds, or MV90 check-meter files.",
      icon: UploadCloud,
      color: "text-blue-400",
      borderColor: "border-blue-500/30",
    },
    {
      step: "02",
      title: "UNDERSTAND",
      description: "AI extracts billing determinants, tariffs and consumption data.",
      details: "Automated extraction of 14 determinants, season boundaries, and applicable tariff schedules.",
      icon: Cpu,
      color: "text-cyan-400",
      borderColor: "border-cyan-500/30",
    },
    {
      step: "03",
      title: "RECONCILE",
      description: "The system compares invoices against actual and historical data.",
      details: "Calculates exact capacity charges, TOU active energy, subsidies, and simultaneous demand.",
      icon: Scale,
      color: "text-purple-400",
      borderColor: "border-purple-500/30",
    },
    {
      step: "04",
      title: "ACT",
      description: "Generate findings, reports, disputes, savings opportunities and decisions.",
      details: "Export cryptographically-signed audit packs and dispute dossiers for Eskom revenue offices.",
      icon: FileSpreadsheet,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-background border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <span>The Workflow</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            From raw paper or PDF document to verified financial settlement in four steps.
          </p>
        </div>

        {/* 4 Connected Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className={`rounded-2xl border ${item.borderColor} bg-card/60 backdrop-blur-sm p-6 space-y-4 hover:bg-card/90 transition-all duration-300 relative group shadow-sm`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-mono font-black text-muted-foreground/50 group-hover:text-primary transition-colors">
                    {item.step}
                  </span>
                  <div className={`p-2 rounded-xl bg-background border border-border ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground tracking-wide">
                    {item.title}
                  </h3>
                  <p className="text-xs font-medium text-foreground/90 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
                  {item.details}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
