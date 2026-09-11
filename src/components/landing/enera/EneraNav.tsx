import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X, Sparkles, LogIn } from "lucide-react";
import { useSupabaseSession } from "@/components/AuthGate";

export function EneraNav() {
  const { session } = useSupabaseSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navLinks = [
    { label: "Platform", href: "#platform" },
    { label: "Capabilities", href: "#capabilities" },
    { label: "Intelligence", href: "#intelligence" },
    { label: "Use Cases", href: "#use-cases" },
    { label: "Resources", href: "#resources" },
    { label: "About", href: "#about" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      setMobileMenuOpen(false);
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", href);
        if (targetId === "demo-request-box") {
          setTimeout(() => {
            const input = document.getElementById("demo-email");
            if (input) input.focus();
          }, 600);
        }
      }
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-[#030712]/85 backdrop-blur-xl border-b border-white/10 py-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
            : "bg-transparent py-5 border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Brand Logo Lockup */}
          <Link
            to="/"
            className="group flex items-center gap-2.5 sm:gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-md py-1"
            aria-label="ENERA Energy Financial Intelligence Home"
          >
            <div className="relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-950 via-[#0d1117] to-slate-900 border border-cyan-500/30 group-hover:border-cyan-400 transition-colors shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)]">
              <span className="font-mono text-xs sm:text-sm font-bold tracking-widest text-cyan-400">
                E
              </span>
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping opacity-75" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base lg:text-lg font-semibold tracking-[0.2em] sm:tracking-[0.25em] text-white font-mono">
                  E N E R A
                </span>
                <span className="hidden xs:inline text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold tracking-wide">
                  2025/26
                </span>
              </div>
              <span className="hidden xs:block text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-slate-400 font-medium">
                Energy Financial Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links — 6 Public Recommended Categories */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-1 lg:gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.07] backdrop-blur-md"
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-full hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Action CTAs — Secondary: Login | Primary: Request a Demo */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Secondary CTA: Login */}
            <Link
              to={session ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white border border-white/10 hover:border-white/20 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <LogIn className="h-3.5 w-3.5 text-cyan-400" />
              <span>Login</span>
            </Link>

            {/* Primary CTA: Request a Demo */}
            <a
              href="#demo-request-box"
              onClick={(e) => handleNavClick(e, "#demo-request-box")}
              className="group relative inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_-3px_rgba(6,182,212,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span>Request a Demo</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                <div className="w-1/2 h-full bg-white/30 skew-x-12 animate-enera-pulse" />
              </div>
            </a>
          </div>

          {/* Mobile Action & Menu Toggle */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              to={session ? "/dashboard" : "/login"}
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white border border-white/10 rounded-md bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Login
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white rounded-lg bg-white/[0.04] border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Refined Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
          className="fixed inset-0 z-40 sm:hidden"
        >
          {/* Backdrop blur overlay */}
          <div
            className="fixed inset-0 bg-[#030712]/90 backdrop-blur-2xl transition-opacity animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed top-16 inset-x-4 bottom-6 rounded-2xl bg-[#0d1117] border border-white/10 p-6 flex flex-col justify-between shadow-2xl animate-in zoom-in-95 duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex flex-col">
                  <span className="text-xs font-mono font-bold tracking-widest text-cyan-400">
                    E N E R A
                  </span>
                  <span className="text-[10px] text-slate-400">Energy Financial Intelligence</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  <span>2025/26</span>
                </div>
              </div>

              {/* Simplified 6 Public Categories */}
              <nav aria-label="Mobile Navigation Links" className="mt-6 flex flex-col space-y-2">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="flex items-center justify-between p-3 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/[0.05] rounded-xl transition-colors"
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </a>
                ))}
              </nav>
            </div>

            {/* Mobile Action CTAs: Primary Request a Demo & Secondary Login */}
            <div className="space-y-2.5 pt-5 border-t border-white/10">
              <a
                href="#demo-request-box"
                onClick={(e) => handleNavClick(e, "#demo-request-box")}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-300 rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all"
              >
                <span>Request a Demo</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                to={session ? "/dashboard" : "/login"}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-slate-300 hover:text-white border border-white/10 rounded-xl bg-white/[0.03] transition-colors"
              >
                <LogIn className="h-4 w-4 text-cyan-400" />
                <span>Login</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
