import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, Lock } from "lucide-react";

export function EneraFooter() {
  return (
    <footer
      className="relative py-16 sm:py-20 bg-[#02050e] text-white border-t border-white/10 font-sans overflow-hidden"
      aria-label="Footer"
    >
      {/* Subtle Background Glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[200px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Minimal Grid: Brand + Navigation + Company + Primary CTA */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 pb-14 border-b border-white/10 items-start">
          {/* Brand Column (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:border-cyan-400 transition-colors">
                <span className="font-mono text-sm font-bold text-cyan-400">E</span>
              </div>
              <span className="font-mono text-xl font-bold tracking-[0.2em] sm:tracking-[0.28em] text-white">
                E N E R A
              </span>
            </Link>

            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Energy Financial Intelligence
            </div>

            <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-sans">
              Autonomous electricity invoice reconciliation and deterministic energy financial
              governance for commercial and industrial enterprises.
            </p>

            <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SANS 474 &amp; 2024/2025 NERSA Tariffs Active</span>
            </div>
          </div>

          {/* Navigation Column (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="text-xs font-mono uppercase text-slate-300 tracking-wider font-semibold block">
              Navigation
            </span>
            <ul className="space-y-2.5 text-xs text-slate-400 font-sans">
              <li>
                <a href="#platform" className="hover:text-cyan-300 transition-colors">
                  Platform
                </a>
              </li>
              <li>
                <a href="#intelligence" className="hover:text-cyan-300 transition-colors">
                  Intelligence
                </a>
              </li>
              <li>
                <a href="#reconciliation" className="hover:text-cyan-300 transition-colors">
                  Reconciliation
                </a>
              </li>
              <li>
                <a href="#insights" className="hover:text-cyan-300 transition-colors">
                  Insights
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-cyan-300 transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>

          {/* Company Column (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="text-xs font-mono uppercase text-slate-300 tracking-wider font-semibold block">
              Company
            </span>
            <ul className="space-y-2.5 text-xs text-slate-400 font-sans">
              <li>
                <a href="#ecosystem" className="hover:text-cyan-300 transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-cyan-300 transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <span className="hover:text-slate-300 cursor-pointer transition-colors">
                  Privacy
                </span>
              </li>
              <li>
                <span className="hover:text-slate-300 cursor-pointer transition-colors">
                  Terms
                </span>
              </li>
            </ul>
          </div>

          {/* Primary CTA Column (4 cols) */}
          <div className="md:col-span-4 space-y-4 rounded-2xl bg-white/[0.02] border border-white/5 p-6 backdrop-blur-sm">
            <div className="space-y-1">
              <span className="text-xs font-mono uppercase text-slate-300 tracking-wider font-semibold block">
                Instant Verification
              </span>
              <p className="text-xs text-slate-400 font-sans">
                Audit your facility&rsquo;s latest Eskom or municipal electricity statement.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* Primary CTA: Analyse a Bill → */}
              <Link
                to="/upload"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_25px_rgba(6,182,212,0.35)] hover:brightness-110 active:scale-[0.98] transition-all font-mono group"
              >
                <span>Analyse a Bill</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>

              <div className="text-center pt-1">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors"
                >
                  <ShieldCheck className="h-3 w-3 text-cyan-400" />
                  <span>Authorized Portal Sign In →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-400">ENERA OPERATIONAL · 42ms LATENCY</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <span>&copy; {new Date().getFullYear()} ENERA. All rights reserved.</span>
            <span>&middot;</span>
            <span>POPIA &amp; ISO 27001 Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
