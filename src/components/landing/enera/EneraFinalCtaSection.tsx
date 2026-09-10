import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Building2,
  Send,
  Lock,
  FileCheck2,
} from "lucide-react";

export function EneraFinalCtaSection() {
  const [demoRequested, setDemoRequested] = useState(false);
  const [email, setEmail] = useState("");
  const [facilityType, setFacilityType] = useState("Manufacturing");

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setDemoRequested(true);
  };

  return (
    <section
      id="contact"
      className="relative py-32 sm:py-36 bg-[#030712] text-white overflow-hidden border-t border-white/5"
      aria-label="Call to Action"
    >
      {/* Background Echo Energy Glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-cyan-500/10 blur-[150px] pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Decorative Grid Lines */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono mb-8 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <Zap className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
          <span className="tracking-wide">AUTONOMOUS UTILITY RECONCILIATION // ZERO SPREADSHEETS</span>
        </div>

        {/* Core Headline */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight enera-text-gradient leading-tight">
          YOUR NEXT BILL <br />
          SHOULDN&apos;T BE A SURPRISE.
        </h2>

        {/* Narrative Subtitle */}
        <p className="mt-6 text-lg sm:text-2xl text-slate-300 font-light max-w-2xl mx-auto leading-relaxed">
          Let intelligence check it before you pay it.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link
            to="/upload"
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:brightness-110 active:scale-[0.98] transition-all overflow-hidden font-mono"
          >
            <span>Analyse Your Energy</span>
            <div className="relative flex items-center justify-center">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute -left-1 w-2 h-2 rounded-full bg-white/60 blur-[1px] group-hover:animate-ping" />
            </div>
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
            </div>
          </Link>

          <Link
            to="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-semibold text-sm text-slate-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md transition-all font-mono"
          >
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>Client Portal</span>
          </Link>
        </div>

        {/* Interactive Architecture Briefing / Demo Inline Form */}
        <div className="mt-12 max-w-lg mx-auto">
          {!demoRequested ? (
            <form
              onSubmit={handleDemoSubmit}
              className="p-2 rounded-2xl bg-[#0d1117]/90 border border-white/10 backdrop-blur-md shadow-2xl flex flex-col sm:flex-row items-center gap-2"
            >
              <div className="relative flex-1 w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter enterprise email for briefing..."
                  className="w-full bg-transparent px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-colors shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center justify-center gap-1.5"
              >
                <span>Request Briefing</span>
                <Send className="h-3 w-3" />
              </button>
            </form>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center gap-2 text-xs font-mono text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.2)] animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Briefing confirmed for <strong className="text-white">{email}</strong>. An energy reconciliation engineer will connect within 2 business hours.
              </span>
            </div>
          )}
        </div>

        {/* Institutional Trust Badges */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-mono text-slate-400 border-t border-white/5 pt-8">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>Zero software installation</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>All Eskom & Municipal Tariffs</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
            <span>POPIA & ISO 27001 Cryptographic Enclave</span>
          </div>
        </div>
      </div>
    </section>
  );
}
