import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock, LogIn } from "lucide-react";
import { useSupabaseSession } from "@/components/AuthGate";

export function EneraFooter() {
  const { session } = useSupabaseSession();

  return (
    <footer
      className="relative py-16 sm:py-20 bg-[#02050b] text-white border-t border-white/10 font-sans"
      aria-label="Footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main 4-Column Institutional Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 pb-14 border-b border-white/10 items-start">
          {/* Column 1: Brand & Independent Positioning (4 cols) */}
          <div className="md:col-span-4 space-y-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 group focus-ring-enera rounded"
              aria-label="ENERA Energy Financial Intelligence homepage"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#0c1322] border border-cyan-500/40">
                <span className="font-mono text-xs font-bold text-cyan-400">E</span>
              </div>
              <span className="font-mono text-lg font-bold tracking-[0.24em] text-white">
                E N E R A
              </span>
            </Link>

            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              Energy Financial Intelligence
            </div>

            <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-sans">
              Autonomous electricity invoice reconciliation and deterministic energy financial governance for commercial, industrial, and municipal power consumers.
            </p>

            <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Independent Private Platform · Zero State or Utility Affiliation</span>
            </div>
          </div>

          {/* Column 2: Products & Solutions (3 cols) */}
          <nav className="md:col-span-3 space-y-4" aria-label="Products and Solutions">
            <div>
              <span className="text-xs font-mono uppercase text-slate-200 tracking-wider font-semibold block mb-2">
                Products
              </span>
              <ul className="space-y-1.5 text-xs text-slate-400 font-sans">
                <li>
                  <a href="#reconciliation" className="hover:text-cyan-300 transition-colors">
                    Invoice Reconciliation
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-cyan-300 transition-colors">
                    AMR Telemetry Auditor
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="hover:text-cyan-300 transition-colors">
                    Tariff Gazette Compliance
                  </a>
                </li>
                <li>
                  <a href="#insights" className="hover:text-cyan-300 transition-colors">
                    Financial Query Studio
                  </a>
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-white/5">
              <span className="text-xs font-mono uppercase text-slate-200 tracking-wider font-semibold block mb-2">
                Solutions
              </span>
              <ul className="space-y-1.5 text-xs text-slate-400 font-sans">
                <li>
                  <a href="#solutions" className="hover:text-cyan-300 transition-colors">
                    Commercial &amp; Industrial
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="hover:text-cyan-300 transition-colors">
                    Mining &amp; Smelting
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="hover:text-cyan-300 transition-colors">
                    Municipal Distributors
                  </a>
                </li>
              </ul>
            </div>
          </nav>

          {/* Column 3: Platform & Company (2 cols) */}
          <nav className="md:col-span-2 space-y-3" aria-label="Platform and Company Information">
            <span className="text-xs font-mono uppercase text-slate-200 tracking-wider font-semibold block">
              Platform
            </span>
            <ul className="space-y-2 text-xs text-slate-400 font-sans">
              <li>
                <a href="#how-it-works" className="hover:text-cyan-300 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#insights" className="hover:text-cyan-300 transition-colors">
                  Insights
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-cyan-300 transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-cyan-300 transition-colors">
                  Contact
                </a>
              </li>
              <li className="pt-2 border-t border-white/5">
                <span className="text-[10px] font-mono text-slate-500 uppercase block">STANDARDS</span>
                <span className="text-[11px] text-slate-400">SANS 474 · NRS 057</span>
              </li>
            </ul>
          </nav>

          {/* Column 4: Client Actions & Engagement (3 cols) */}
          <div className="md:col-span-3 space-y-4 rounded-xl bg-[#090d16] border border-white/10 p-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-white block">
                Executive Engagement
              </span>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Connect your revenue meter telemetry for preliminary overcharge screening.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href="#contact"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-xs text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors font-sans"
              >
                <span>REQUEST A DEMO</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>

              <a
                href="#how-it-works"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors font-sans"
              >
                <span>EXPLORE ENERA</span>
              </a>

              <Link
                to={session ? "/dashboard" : "/login"}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors"
              >
                <LogIn className="h-3 w-3" />
                <span>{session ? "CLIENT PORTAL" : "SIGN IN"}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Compliance */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Deterministic Engine Active · Client-Isolated Processing</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <span>&copy; {new Date().getFullYear()} ENERA Technologies. All rights reserved.</span>
            <span>·</span>
            <span>Role-Based Access</span>
            <span>·</span>
            <span>Audit-Ready Lineage</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
