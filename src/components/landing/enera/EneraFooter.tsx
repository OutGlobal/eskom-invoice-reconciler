import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, Lock, FileCheck2, Cpu } from "lucide-react";

export function EneraFooter() {
  return (
    <footer
      className="relative py-16 sm:py-20 bg-[#02050e] text-white border-t border-white/10 font-sans overflow-hidden"
      aria-label="Footer"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[750px] h-[250px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-14 border-b border-white/10">
          {/* Brand & Mission Column (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:border-cyan-400 transition-colors">
                <span className="font-mono text-sm font-bold text-cyan-400">E</span>
              </div>
              <span className="font-mono text-lg font-bold tracking-[0.25em] text-white">
                E N E R A
              </span>
            </Link>

            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              ENERGY FINANCIAL INTELLIGENCE
            </div>

            <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-sans">
              Autonomous electricity invoice reconciliation and deterministic energy financial
              governance for commercial and industrial facilities across South Africa.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>2024/2025 NERSA Tariffs Active</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 text-cyan-300">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                <span>SANS 474 Certified</span>
              </span>
            </div>
          </div>

          {/* Navigation Architecture Column (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="text-xs font-mono uppercase text-slate-300 tracking-wider font-semibold block">
              ARCHITECTURE
            </span>
            <ul className="space-y-2.5 text-xs text-slate-400 font-sans">
              <li>
                <a href="#platform" className="hover:text-cyan-300 transition-colors">
                  Signal Decoding
                </a>
              </li>
              <li>
                <a href="#reconciliation" className="hover:text-cyan-300 transition-colors">
                  Dual-Stream Ground Truth
                </a>
              </li>
              <li>
                <a href="#intelligence" className="hover:text-cyan-300 transition-colors">
                  AI Energy Copilot
                </a>
              </li>
              <li>
                <a href="#platform" className="hover:text-cyan-300 transition-colors">
                  Topology Network
                </a>
              </li>
              <li>
                <a href="#insights" className="hover:text-cyan-300 transition-colors">
                  Executive ROI Analytics
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-cyan-300 transition-colors">
                  7-Node Audit Trail
                </a>
              </li>
            </ul>
          </div>

          {/* Regulatory Standards Column (2 cols) */}
          <div className="md:col-span-2 space-y-3">
            <span className="text-xs font-mono uppercase text-slate-300 tracking-wider font-semibold block">
              REGULATORY BASIS
            </span>
            <ul className="space-y-2.5 text-xs text-slate-400 font-sans">
              <li>
                <span className="hover:text-slate-300 transition-colors">
                  NERSA Electricity Act
                </span>
              </li>
              <li>
                <span className="hover:text-slate-300 transition-colors">
                  Eskom Megaflex TOU
                </span>
              </li>
              <li>
                <span className="hover:text-slate-300 transition-colors">
                  SANS 474 / NRS 057
                </span>
              </li>
              <li>
                <span className="hover:text-slate-300 transition-colors">
                  Public Holidays Act 36
                </span>
              </li>
              <li>
                <span className="hover:text-slate-300 transition-colors">
                  ISO 27001 Security
                </span>
              </li>
              <li>
                <span className="hover:text-slate-300 transition-colors">
                  POPIA Compliance
                </span>
              </li>
            </ul>
          </div>

          {/* Enterprise Gateway Column (3 cols) */}
          <div className="md:col-span-3 space-y-4">
            <span className="text-xs font-mono uppercase text-slate-300 tracking-wider font-semibold block">
              ENTERPRISE PLATFORM
            </span>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Verify your facility&apos;s latest electricity statement against verified physical interval telemetry.
            </p>

            <div className="space-y-2.5">
              <Link
                to="/upload"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-300 hover:brightness-110 transition-all font-mono shadow-[0_0_20px_rgba(6,182,212,0.25)]"
              >
                <span>Analyse an Invoice</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              <div className="pt-1">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Authorized Portal Sign In →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Operational Status & Legal Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-400">SYSTEM: ALL 8 DETERMINANT ENGINES OPERATIONAL (42ms)</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span>© {new Date().getFullYear()} ENERA Technologies. All rights reserved.</span>
            <span>·</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Privacy Policy</span>
            <span>·</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Security Whitepaper</span>
            <span>·</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">Audit Disclosures</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
