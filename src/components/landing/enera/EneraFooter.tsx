import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, LogIn } from "lucide-react";
import { useSupabaseSession } from "@/components/AuthGate";

export function EneraFooter() {
  const { session } = useSupabaseSession();

  return (
    <footer
      className="py-12 sm:py-16 bg-[#070c16] text-slate-400 border-t border-slate-800/80 font-sans"
      aria-label="Footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Bar: Brand & Quick Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 mb-10 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 focus-ring-enera rounded"
              aria-label="ENERA Energy Financial Intelligence homepage"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#0c1322] border border-cyan-500/40">
                <span className="font-mono text-xs font-bold text-cyan-400">E</span>
              </div>
              <span className="font-mono text-base font-bold tracking-[0.24em] text-white">
                E N E R A
              </span>
            </Link>
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              Energy Financial Intelligence
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={session ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-md text-xs font-mono text-slate-300 hover:text-white border border-white/10 hover:border-white/20 transition-colors focus-ring-enera"
            >
              <LogIn className="h-3.5 w-3.5 text-slate-400" />
              <span>{session ? "Client Portal" : "SIGN IN"}</span>
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-md text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-colors font-sans focus-ring-enera"
            >
              <span>REQUEST A DEMO</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* 5-Column Navigation Grid */}
        <nav
          className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10"
          aria-label="Footer Navigation"
        >
          {/* Column 1: PLATFORM */}
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 block mb-3">
              PLATFORM
            </span>
            <ul className="space-y-2 text-xs font-sans">
              <li>
                <a href="#hero" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Overview
                </a>
              </li>
              <li>
                <a href="#capabilities" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Capabilities
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  How It Works
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: SOLUTIONS */}
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 block mb-3">
              SOLUTIONS
            </span>
            <ul className="space-y-2 text-xs font-sans">
              <li>
                <a href="#solutions" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Energy
                </a>
              </li>
              <li>
                <a href="#insights" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Finance
                </a>
              </li>
              <li>
                <a href="#solutions" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Facilities
                </a>
              </li>
              <li>
                <a href="#reconciliation" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Audit
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: RESOURCES */}
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 block mb-3">
              RESOURCES
            </span>
            <ul className="space-y-2 text-xs font-sans">
              <li>
                <a href="#insights" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Insights
                </a>
              </li>
              <li>
                <a href="#guides" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Guides
                </a>
              </li>
              <li>
                <a href="#faq" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: COMPANY */}
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 block mb-3">
              COMPANY
            </span>
            <ul className="space-y-2 text-xs font-sans">
              <li>
                <a href="#about" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#contact" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#contact" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Request a Demo
                </a>
              </li>
            </ul>
          </div>

          {/* Column 5: LEGAL */}
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-200 block mb-3">
              LEGAL
            </span>
            <ul className="space-y-2 text-xs font-sans">
              <li>
                <a href="#privacy" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#terms" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Terms
                </a>
              </li>
              <li>
                <a href="#security" className="text-slate-400 hover:text-cyan-300 transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* Bottom Bar: Copyright & Compliance */}
        <div className="pt-8 mt-10 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} ENERA Technologies. All rights reserved.
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Deterministic Engine · Client-Isolated Processing</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
