import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Mail,
  Building,
  Phone,
  CheckCircle2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

interface FinalCtaSectionProps {
  onAnalyseClick?: () => void;
}

export function FinalCtaSection({ onAnalyseClick }: FinalCtaSectionProps) {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: "",
    email: "",
    company: "",
    monthlySpend: "R 500k - R 2M",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.success("Demo request received! Our energy financial specialists will contact you shortly.");
    setTimeout(() => {
      setDemoModalOpen(false);
      setSubmitted(false);
    }, 2500);
  };

  return (
    <footer className="relative bg-background text-foreground overflow-hidden">
      {/* Upper Call to Action Block */}
      <div className="relative py-24 md:py-36 border-b border-border/60">
        {/* Subtle Animated Energy Grid Background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span>Protect Your Energy Capital</span>
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-foreground leading-[1.05]">
            Your Next Bill Shouldn&apos;t Be a{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-cyan-400 to-emerald-400">
              Surprise.
            </span>
          </h2>

          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Let intelligence check it before you pay it. Uncover billing errors, isolate demand spikes,
            and recover lost capital.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={
                onAnalyseClick ||
                (() => {
                  const el = document.getElementById("interactive-demo");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                })
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xl shadow-primary/25 group"
            >
              <Sparkles className="h-4 w-4" />
              <span>Analyse a Bill</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => setDemoModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold border border-border bg-card/80 hover:bg-muted/80 text-foreground transition-colors"
            >
              <span>Request a Demo</span>
            </button>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Lock className="h-4 w-4" />
              <span>Client Portal</span>
            </Link>
          </div>

          <div className="pt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>100% Deterministic</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>NERSA 2025/26 Certified</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Zero Floating Point Error</span>
            </span>
          </div>
        </div>
      </div>

      {/* Enterprise Sitemap & Regulatory Footer */}
      <div className="py-12 bg-card/30 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-8 border-b border-border/50">
            {/* Col 1: Brand */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm tracking-wider uppercase">
                  Eskom Reconciler
                </span>
              </div>
              <p className="text-muted-foreground max-w-sm leading-relaxed text-[11px]">
                Autonomous Energy Financial Control System. Deterministic utility billing
                reconciliation, AMR telemetry verification, and dispute recovery for South African
                enterprises.
              </p>
              <div className="text-[10px] text-muted-foreground font-mono">
                NERSA Table 1-3 (Megaflex, Miniflex, Nightsave, Businessrate) compliant.
              </div>
            </div>

            {/* Col 2: Platform */}
            <div className="space-y-2">
              <div className="font-bold text-foreground text-[11px] uppercase tracking-wider">
                Platform
              </div>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>
                  <a href="#interactive-demo" className="hover:text-foreground transition-colors">
                    Bill Analyzer
                  </a>
                </li>
                <li>
                  <a href="#flow" className="hover:text-foreground transition-colors">
                    Money Flow Engine
                  </a>
                </li>
                <li>
                  <a href="#intelligence" className="hover:text-foreground transition-colors">
                    AI Insights
                  </a>
                </li>
                <li>
                  <a href="#enterprise" className="hover:text-foreground transition-colors">
                    Multi-Site Portfolios
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Workspaces */}
            <div className="space-y-2">
              <div className="font-bold text-foreground text-[11px] uppercase tracking-wider">
                Workspaces
              </div>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>
                  <Link to="/login" className="hover:text-foreground transition-colors">
                    Command Centre
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-foreground transition-colors">
                    Invoice Workspace
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-foreground transition-colors">
                    Reconciliation Workbench
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-foreground transition-colors">
                    Telemetry Stream
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Governance */}
            <div className="space-y-2">
              <div className="font-bold text-foreground text-[11px] uppercase tracking-wider">
                Compliance
              </div>
              <ul className="space-y-1.5 text-muted-foreground">
                <li>
                  <a href="#trust" className="hover:text-foreground transition-colors">
                    12-Node Audit Trail
                  </a>
                </li>
                <li>
                  <a href="#trust" className="hover:text-foreground transition-colors">
                    Cryptographic Ledger
                  </a>
                </li>
                <li>
                  <span className="text-muted-foreground/60">POPIA & ISO 27001</span>
                </li>
                <li>
                  <span className="text-muted-foreground/60">NERSA Tariff Gazette</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-muted-foreground text-[11px]">
            <div>
              &copy; {new Date().getFullYear()} OutGlobal Energy Systems. All rights reserved.
            </div>
            <div className="flex items-center gap-4 font-mono text-[10px]">
              <span>SYSTEM: v2.0.0 DETERMINISTIC</span>
              <span>·</span>
              <span className="text-emerald-400">STATUS: OPERATIONAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* Request Demo Interactive Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Schedule Executive Walkthrough</h3>
              </div>
              <button
                onClick={() => setDemoModalOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {submitted ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <div className="text-sm font-bold text-foreground">Request Received!</div>
                <p className="text-xs text-muted-foreground">
                  Our energy financial engineers will contact your team to schedule a live audit.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitDemo} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={demoForm.name}
                    onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                    placeholder="e.g. Johan van der Merwe"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">
                    Work Email
                  </label>
                  <input
                    type="email"
                    required
                    value={demoForm.email}
                    onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                    placeholder="e.g. johan@miningcorp.co.za"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    required
                    value={demoForm.company}
                    onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })}
                    placeholder="e.g. Impala Platinum SOC"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1 font-medium">
                    Approximate Monthly Electricity Spend
                  </label>
                  <select
                    value={demoForm.monthlySpend}
                    onChange={(e) => setDemoForm({ ...demoForm, monthlySpend: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs"
                  >
                    <option value="< R 250k">&lt; R 250,000 / month</option>
                    <option value="R 250k - R 1M">R 250,000 – R 1,000,000 / month</option>
                    <option value="R 1M - R 5M">R 1,000,000 – R 5,000,000 / month</option>
                    <option value="> R 5M">&gt; R 5,000,000 / month (Large Industrial)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                  >
                    Confirm Walkthrough Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </footer>
  );
}
