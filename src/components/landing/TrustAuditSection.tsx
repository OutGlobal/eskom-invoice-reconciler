import { ShieldCheck, Lock, FileCheck, CheckCircle2, ChevronRight, Hash, Database } from "lucide-react";

export function TrustAuditSection() {
  const trailNodes = [
    { name: "Source Document", desc: "PDF / Telemetry stream SHA-256 fingerprint" },
    { name: "Extracted Data", desc: "14 validated determinants" },
    { name: "Calculation", desc: "Arbitrary-precision Decimal arithmetic" },
    { name: "Rule Applied", desc: "Gazetted NERSA 2025/26 clause" },
    { name: "Finding", desc: "Mathematical variance isolation" },
    { name: "Evidence", desc: "Timestamped interval audit" },
    { name: "Report", desc: "Cryptographic dispute dossier" },
  ];

  return (
    <section id="trust" className="py-20 md:py-32 bg-card/20 border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Auditability & Governance</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            Every Number Has a Trail.
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Built as institutional financial infrastructure. Complete transparency from source document to ledger settlement.
          </p>
        </div>

        {/* 12-Node Evidence Chain Visual */}
        <div className="rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl p-6 sm:p-10 shadow-xl space-y-8 max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Hash className="h-4 w-4 text-primary" />
              <span>CRYPTOGRAPHIC AUDIT CHAIN // 12-NODE TRACEABILITY</span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              TAMPER EVIDENT
            </span>
          </div>

          {/* Sequential Trail Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {trailNodes.map((node, i) => (
              <div
                key={node.name}
                className="p-3.5 rounded-xl border border-border/60 bg-background/60 space-y-1.5 text-center sm:text-left relative group hover:border-primary/50 transition-colors"
              >
                <div className="text-[10px] font-mono font-bold text-primary">
                  0{i + 1}
                </div>
                <div className="text-xs font-bold text-foreground truncate">
                  {node.name}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight">
                  {node.desc}
                </div>
              </div>
            ))}
          </div>

          {/* 4 Pillars of Institutional Trust */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-border/60">
            <div className="p-4 rounded-xl bg-background/40 border border-border/40 space-y-1.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Zero Black Box</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Nothing disappears into opaque AI. Every formula, multiplier, and deduction is inspectable.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background/40 border border-border/40 space-y-1.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Full Calculation Lineage</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Every calculation can be traced backward to original meter interval telemetry and NERSA gazettes.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background/40 border border-border/40 space-y-1.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Defensible Evidence</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Every identified variance is backed by interval evidence packages accepted by utility auditors.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background/40 border border-border/40 space-y-1.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Immutable Action Log</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Every document ingestion, verification, dispute submission, and credit resolution is permanently logged.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
