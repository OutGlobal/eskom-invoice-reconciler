import { Building2, MapPin, TrendingUp, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface SiteCard {
  city: string;
  province: string;
  facility: string;
  utility: string;
  monthlySpend: string;
  reconciliationStatus: string;
  recoveryPotential: string;
  anomaliesCount: number;
  statusBadge: "clean" | "action" | "review";
}

const SITES: SiteCard[] = [
  {
    city: "Johannesburg",
    province: "Gauteng",
    facility: "Industrial Smelter Complex",
    utility: "City Power / Eskom Megaflex",
    monthlySpend: "R 1.84M",
    reconciliationStatus: "98.4% Reconciled",
    recoveryPotential: "R 34,200",
    anomaliesCount: 1,
    statusBadge: "clean",
  },
  {
    city: "Cape Town",
    province: "Western Cape",
    facility: "Cold Chain Distribution Hub",
    utility: "City of Cape Town LPU",
    monthlySpend: "R 1.21M",
    reconciliationStatus: "92.1% Reconciled",
    recoveryPotential: "R 58,100",
    anomaliesCount: 3,
    statusBadge: "action",
  },
  {
    city: "Durban",
    province: "KwaZulu-Natal",
    facility: "Petrochemical Logistics Depot",
    utility: "eThekwini Electricity TOU",
    monthlySpend: "R 964K",
    reconciliationStatus: "89.5% Reconciled",
    recoveryPotential: "R 82,400",
    anomaliesCount: 4,
    statusBadge: "action",
  },
  {
    city: "Rustenburg",
    province: "North West",
    facility: "Platinum Shaft & Concentrator",
    utility: "Eskom Transmission 33kV",
    monthlySpend: "R 4.38M",
    reconciliationStatus: "96.2% Reconciled",
    recoveryPotential: "R 246,300",
    anomaliesCount: 9,
    statusBadge: "review",
  },
];

export function MultiSiteSection() {
  return (
    <section id="enterprise" className="py-20 md:py-32 bg-background border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5" />
            <span>Enterprise Multi-Facility Intelligence</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            One View. Every Site. Every Meter. Every Rand.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Centralize utility billing reconciliation across multi-province industrial, commercial, and municipal portfolios.
          </p>
        </div>

        {/* Aggregate Portfolio KPI Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-6 text-center">
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-foreground">24</div>
            <div className="text-xs text-muted-foreground font-mono">Monitored Sites</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-foreground">186</div>
            <div className="text-xs text-muted-foreground font-mono">AMR Check Meters</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-primary">R 8.4M</div>
            <div className="text-xs text-muted-foreground font-mono">Monthly Energy Spend</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">R 421K</div>
            <div className="text-xs text-muted-foreground font-mono">Potential Recoveries</div>
          </div>
          <div className="col-span-2 md:col-span-1 space-y-0.5">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-amber-400">17</div>
            <div className="text-xs text-muted-foreground font-mono">Active Anomalies</div>
          </div>
        </div>

        {/* Site Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {SITES.map((site) => (
            <div
              key={site.city}
              className="rounded-xl border border-border/70 bg-card/70 hover:border-primary/50 transition-all p-5 space-y-4 shadow-sm group"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{site.province}</span>
                  </div>
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {site.city}
                  </h3>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {site.facility}
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                    site.statusBadge === "clean"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : site.statusBadge === "action"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  {site.statusBadge === "clean" ? "PASS" : `${site.anomaliesCount} ANOMALIES`}
                </span>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Monthly Spend:</span>
                  <span className="font-bold text-foreground">{site.monthlySpend}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Reconciliation:</span>
                  <span className="text-foreground">{site.reconciliationStatus}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Potential Recovery:</span>
                  <span className="text-amber-400 font-bold">{site.recoveryPotential}</span>
                </div>
              </div>

              <div className="text-[10px] text-muted-foreground/80 truncate border-t border-border/40 pt-2">
                Tariff: {site.utility}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
