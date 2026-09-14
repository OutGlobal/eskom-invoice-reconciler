import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X, ChevronDown, LogIn, Shield, Zap, Scale, FileText, Building2, Factory, Landmark, Building } from "lucide-react";
import { useSupabaseSession } from "@/components/AuthGate";

interface DropdownItem {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRODUCT_ITEMS: DropdownItem[] = [
  {
    title: "Invoice Reconciliation",
    description: "Deterministic cross-audit of utility charges against physical meter intervals.",
    href: "#reconciliation",
    icon: Scale,
  },
  {
    title: "AMR Telemetry Auditor",
    description: "30-minute interval profile validation and hardware multiplier verification.",
    href: "#how-it-works",
    icon: Zap,
  },
  {
    title: "Tariff Gazette Compliance",
    description: "NERSA Megaflex multi-season schedules and statutory holiday rule enforcement.",
    href: "#solutions",
    icon: FileText,
  },
  {
    title: "Financial Query Studio",
    description: "Plain-language balance-sheet intelligence to isolate unexpected cost spikes.",
    href: "#insights",
    icon: Shield,
  },
];

const SOLUTION_ITEMS: DropdownItem[] = [
  {
    title: "Commercial & Industrial",
    description: "Multi-site facility energy cost governance and maximum demand optimization.",
    href: "#solutions",
    icon: Factory,
  },
  {
    title: "Mining & Smelting",
    description: "High-voltage bulk transmission tariffs (>66kV) and ratchet protection.",
    href: "#solutions",
    icon: Building2,
  },
  {
    title: "Municipal Distributors",
    description: "Dual fiscal calendar alignment (April 1 vs July 1) and wheeling settlements.",
    href: "#solutions",
    icon: Landmark,
  },
  {
    title: "Property Portfolios",
    description: "Commercial tenant sub-metering recovery and bulk utility reconciliation.",
    href: "#solutions",
    icon: Building,
  },
];

export function EneraNav() {
  const { session } = useSupabaseSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"products" | "solutions" | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setActiveDropdown(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDropdownEnter = (type: "products" | "solutions") => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setActiveDropdown(type);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    setActiveDropdown(null);
    if (href.startsWith("#")) {
      e.preventDefault();
      setMobileMenuOpen(false);
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", href);
        if (targetId === "contact" || targetId === "briefing") {
          setTimeout(() => {
            const input = document.getElementById("workEmail");
            if (input) input.focus();
          }, 500);
        }
      }
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          isScrolled
            ? "bg-[#030712]/95 backdrop-blur-md border-b border-white/10 py-3 shadow-lg"
            : "bg-transparent py-5 border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: ENERA Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 focus-ring-enera rounded py-1 shrink-0"
            aria-label="ENERA Energy Financial Intelligence Homepage"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#0c1322] border border-cyan-500/40 text-cyan-400 font-mono text-xs font-bold shadow-sm">
              E
            </div>
            <span className="text-base font-bold tracking-[0.24em] text-white font-mono">
              E N E R A
            </span>
          </Link>

          {/* Center: Simplified 6-Item Information Architecture */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-7 text-xs font-sans text-slate-300"
          >
            {/* 1. Products Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownEnter("products")}
              onMouseLeave={handleDropdownLeave}
            >
              <a
                href="#products"
                onClick={(e) => handleNavClick(e, "#products")}
                className="flex items-center gap-1 hover:text-white py-2 transition-colors focus-ring-enera rounded"
                aria-expanded={activeDropdown === "products"}
                aria-haspopup="true"
              >
                <span>Products</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${activeDropdown === "products" ? "rotate-180 text-cyan-400" : "text-slate-500"}`} />
              </a>

              {activeDropdown === "products" && (
                <div className="absolute top-full left-0 w-80 pt-2 z-50">
                  <div className="rounded-xl bg-[#090e17] border border-white/10 p-2 shadow-2xl backdrop-blur-xl space-y-1">
                    {PRODUCT_ITEMS.map((item) => (
                      <a
                        key={item.title}
                        href={item.href}
                        onClick={(e) => handleNavClick(e, item.href)}
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group"
                      >
                        <div className="p-1.5 rounded-md bg-white/5 text-cyan-400 group-hover:text-cyan-300 mt-0.5 shrink-0">
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                            {item.description}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Solutions Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownEnter("solutions")}
              onMouseLeave={handleDropdownLeave}
            >
              <a
                href="#solutions"
                onClick={(e) => handleNavClick(e, "#solutions")}
                className="flex items-center gap-1 hover:text-white py-2 transition-colors focus-ring-enera rounded"
                aria-expanded={activeDropdown === "solutions"}
                aria-haspopup="true"
              >
                <span>Solutions</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${activeDropdown === "solutions" ? "rotate-180 text-cyan-400" : "text-slate-500"}`} />
              </a>

              {activeDropdown === "solutions" && (
                <div className="absolute top-full left-0 w-80 pt-2 z-50">
                  <div className="rounded-xl bg-[#090e17] border border-white/10 p-2 shadow-2xl backdrop-blur-xl space-y-1">
                    {SOLUTION_ITEMS.map((item) => (
                      <a
                        key={item.title}
                        href={item.href}
                        onClick={(e) => handleNavClick(e, item.href)}
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group"
                      >
                        <div className="p-1.5 rounded-md bg-white/5 text-emerald-400 group-hover:text-emerald-300 mt-0.5 shrink-0">
                          <item.icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                            {item.description}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. How It Works */}
            <a
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, "#how-it-works")}
              className="hover:text-white py-2 transition-colors focus-ring-enera rounded"
            >
              How It Works
            </a>

            {/* 4. Insights */}
            <a
              href="#insights"
              onClick={(e) => handleNavClick(e, "#insights")}
              className="hover:text-white py-2 transition-colors focus-ring-enera rounded"
            >
              Insights
            </a>

            {/* 5. About */}
            <a
              href="#about"
              onClick={(e) => handleNavClick(e, "#about")}
              className="hover:text-white py-2 transition-colors focus-ring-enera rounded"
            >
              About
            </a>

            {/* 6. Contact */}
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, "#contact")}
              className="hover:text-white py-2 transition-colors focus-ring-enera rounded"
            >
              Contact
            </a>
          </nav>

          {/* Right: Exact Action CTAs (Sign In, Explore ENERA, Request a Demo) */}
          <div className="hidden sm:flex items-center gap-3">
            {/* SIGN IN */}
            <Link
              to={session ? "/dashboard" : "/login"}
              className="text-xs font-sans text-slate-300 hover:text-white px-2.5 py-1.5 transition-colors focus-ring-enera rounded flex items-center gap-1.5"
            >
              <LogIn className="h-3.5 w-3.5 text-slate-400" />
              <span>{session ? "Client Portal" : "SIGN IN"}</span>
            </Link>

            {/* EXPLORE ENERA (Secondary CTA) */}
            <a
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, "#how-it-works")}
              className="hidden xl:inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white border border-white/10 hover:border-white/25 rounded-md bg-white/[0.02] transition-colors focus-ring-enera font-sans"
            >
              EXPLORE ENERA
            </a>

            {/* REQUEST A DEMO (Primary CTA) */}
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, "#contact")}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors focus-ring-enera font-sans shadow-sm"
            >
              <span>REQUEST A DEMO</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              to={session ? "/dashboard" : "/login"}
              className="px-2.5 py-1 text-xs text-slate-300 border border-white/10 rounded font-sans"
            >
              {session ? "Portal" : "SIGN IN"}
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-300 hover:text-white rounded border border-white/10"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 lg:hidden bg-[#030712]/98 p-6 pt-20 flex flex-col justify-between overflow-y-auto"
        >
          <nav className="flex flex-col space-y-3 pt-2">
            <a
              href="#products"
              onClick={(e) => handleNavClick(e, "#products")}
              className="text-base font-medium text-slate-200 hover:text-white py-2 border-b border-white/5 flex items-center justify-between"
            >
              <span>Products</span>
              <span className="text-xs font-mono text-cyan-400">01</span>
            </a>
            <a
              href="#solutions"
              onClick={(e) => handleNavClick(e, "#solutions")}
              className="text-base font-medium text-slate-200 hover:text-white py-2 border-b border-white/5 flex items-center justify-between"
            >
              <span>Solutions</span>
              <span className="text-xs font-mono text-emerald-400">02</span>
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, "#how-it-works")}
              className="text-base font-medium text-slate-200 hover:text-white py-2 border-b border-white/5 flex items-center justify-between"
            >
              <span>How It Works</span>
              <span className="text-xs font-mono text-slate-400">03</span>
            </a>
            <a
              href="#insights"
              onClick={(e) => handleNavClick(e, "#insights")}
              className="text-base font-medium text-slate-200 hover:text-white py-2 border-b border-white/5 flex items-center justify-between"
            >
              <span>Insights</span>
              <span className="text-xs font-mono text-slate-400">04</span>
            </a>
            <a
              href="#about"
              onClick={(e) => handleNavClick(e, "#about")}
              className="text-base font-medium text-slate-200 hover:text-white py-2 border-b border-white/5 flex items-center justify-between"
            >
              <span>About</span>
              <span className="text-xs font-mono text-slate-400">05</span>
            </a>
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, "#contact")}
              className="text-base font-medium text-slate-200 hover:text-white py-2 border-b border-white/5 flex items-center justify-between"
            >
              <span>Contact</span>
              <span className="text-xs font-mono text-slate-400">06</span>
            </a>
          </nav>

          <div className="space-y-3 pt-6 border-t border-white/10 mt-6">
            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, "#contact")}
              className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md font-sans"
            >
              <span>REQUEST A DEMO</span>
              <ArrowRight className="h-4 w-4" />
            </a>

            <a
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, "#how-it-works")}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-slate-200 border border-white/15 rounded-md bg-white/[0.02] font-sans"
            >
              <span>EXPLORE ENERA</span>
            </a>

            <Link
              to={session ? "/dashboard" : "/login"}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-slate-300 border border-white/10 rounded-md font-sans"
            >
              <span>{session ? "CLIENT PORTAL" : "SIGN IN"}</span>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
