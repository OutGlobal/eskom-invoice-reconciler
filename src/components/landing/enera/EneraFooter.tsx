import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";

export function EneraFooter() {
  return (
    <footer className="relative py-16 bg-[#02050e] text-white border-t border-white/10 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-white/10">
          {/* Brand & Mission Column */}
          <div className="md:col-span-5 space-y-4">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-500/30">
                <span className="font-mono text-xs font-bold text-cyan-400">E</span>
              </div>
              <span className="font-mono text-base font-semibold tracking-[0.25em] text-white">
                E N E R A
              </span>
            </Link>

            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              ENERGY FINANCIAL INTELLIGENCE
            </div>

            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Autonomous electricity invoice reconciliation and deterministic energy financial
              governance for commercial and industrial facilities across South Africa.
            </p>

            <div className="pt-2 flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>2025/2026 NERSA Tariff Compliant</span>
              </span>
            </div>
          </div>

          {/* Navigation Links Column */}
          <div className="md:col-span-3 space-y-3">
            <span className="text-xs font-mono uppercase text-slate-400 tracking-wider font-semibold">
              PLATFORM
            </span>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#platform" className="hover:text-cyan-300 transition-colors">
                  Energy Signal Decoding
                </a>
              </li>
              <li>
                <a href="#intelligence" className="hover:text-cyan-300 transition-colors">
                  AI Energy Copilot
                </a>
              </li>
              <li>
                <a href="#reconciliation" className="hover:text-cyan-300 transition-colors">
                  Dual-Stream Ground Truth
                </a>
              </li>
              <li>
                <a href="#insights" className="hover:text-cyan-300 transition-colors">
                  Executive ROI Analytics
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-cyan-300 transition-colors">
                  Cryptographic Audit Trail
                </a>
              </li>
            </ul>
          </div>

          {/* Enterprise Gateway Column */}
          <div className="md:col-span-4 space-y-4">
            <span className="text-xs font-mono uppercase text-slate-400 tracking-wider font-semibold">
              ENTERPRISE ACCESS
            </span>
            <p className="text-xs text-slate-400">
              Ready to verify your facility’s latest electricity bill against raw interval meter data?
            </p>

            <div className="space-y-2">
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-300 hover:brightness-110 transition-all"
              >
                <span>Analyse a Bill</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              <div className="block">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Authorized Client Portal Sign In →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>© {new Date().getFullYear()} ENERA Technologies. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Privacy Notice</span>
            <span>·</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms of Service</span>
            <span>·</span>
            <span className="hover:text-slate-400 cursor-pointer">Security Whitepaper</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
