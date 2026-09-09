import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

export function EneraFinalCtaSection() {
  const [demoRequested, setDemoRequested] = useState(false);
  const [email, setEmail] = useState("");

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setDemoRequested(true);
  };

  return (
    <section className="relative py-32 bg-[#030712] text-white overflow-hidden">
      {/* Background Echo Energy Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] rounded-full bg-cyan-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[250px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono mb-8 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <Zap className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
          <span>AUTONOMOUS UTILITY GOVERNANCE</span>
        </div>

        <h2 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight enera-text-gradient leading-tight">
          YOUR NEXT BILL <br />
          SHOULDN&apos;T BE A SURPRISE.
        </h2>

        <p className="mt-6 text-lg sm:text-2xl text-slate-300 font-light max-w-2xl mx-auto">
          Let intelligence check it before you pay it.
        </p>

        {/* Action Row */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link
            to="/upload"
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_35px_rgba(6,182,212,0.5)] hover:brightness-110 active:scale-[0.98] transition-all overflow-hidden"
          >
            <span>Analyse Your Energy</span>
            <div className="relative flex items-center justify-center">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute -left-1 w-2 h-2 rounded-full bg-white/60 blur-[1px] group-hover:animate-ping" />
            </div>
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
            </div>
          </Link>

          <Link
            to="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-medium text-sm text-slate-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur-md transition-all"
          >
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>Client Portal</span>
          </Link>
        </div>

        {/* Interactive Demo Request Inline Form */}
        {!demoRequested ? (
          <form
            onSubmit={handleDemoSubmit}
            className="mt-12 max-w-md mx-auto flex items-center gap-2 p-1.5 rounded-2xl bg-[#0d1117]/80 border border-white/10 backdrop-blur-md shadow-xl"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter enterprise work email..."
              className="flex-1 bg-transparent px-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
              required
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-cyan-300 border border-white/10 transition-colors shrink-0"
            >
              Request a Demo
            </button>
          </form>
        ) : (
          <div className="mt-12 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 max-w-md mx-auto flex items-center justify-center gap-2 text-xs font-mono text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Architecture briefing scheduled. An energy engineer will contact {email}.</span>
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>Zero software install required</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>Compatible with all Eskom Tariffs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>256-Bit Encrypted Data Isolation</span>
          </div>
        </div>
      </div>
    </section>
  );
}
