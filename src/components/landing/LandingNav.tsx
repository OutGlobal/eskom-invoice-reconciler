import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Zap,
  ShieldCheck,
  ArrowRight,
  Menu,
  X,
  LogIn,
  Layers,
  Sparkles,
} from "lucide-react";

interface LandingNavProps {
  onOpenDemo?: () => void;
}

export function LandingNav({ onOpenDemo }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border/60 py-3 shadow-lg shadow-black/20"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo with Energy Pulse */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 border border-primary/30 group-hover:border-primary/60 transition-all shadow-sm">
              <Zap className="h-5 w-5 text-primary animate-pulse" />
              <div className="absolute -inset-0.5 rounded-lg bg-primary/20 blur opacity-40 group-hover:opacity-75 transition" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <span>Eskom</span>
                <span className="text-primary">Reconciler</span>
              </span>
              <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase">
                Energy Financial Control
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-card/40 border border-border/40 rounded-full px-4 py-1.5 backdrop-blur-sm text-xs font-medium text-muted-foreground">
            <button
              onClick={() => scrollTo("platform")}
              className="px-3 py-1 hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              Platform
            </button>
            <button
              onClick={() => scrollTo("how-it-works")}
              className="px-3 py-1 hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollTo("flow")}
              className="px-3 py-1 hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              Follow The Money
            </button>
            <button
              onClick={() => scrollTo("intelligence")}
              className="px-3 py-1 hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              Intelligence
            </button>
            <button
              onClick={() => scrollTo("enterprise")}
              className="px-3 py-1 hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              Multi-Site
            </button>
            <button
              onClick={() => scrollTo("use-cases")}
              className="px-3 py-1 hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              Use Cases
            </button>
            <button
              onClick={() => scrollTo("trust")}
              className="px-3 py-1 hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              Audit Trail
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Client Portal</span>
            </Link>

            <button
              onClick={onOpenDemo || (() => scrollTo("interactive-demo"))}
              className="relative group inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-md shadow-primary/20 overflow-hidden"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Analyse a Bill</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="md:hidden flex items-center gap-2">
            <Link
              to="/login"
              className="p-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              title="Client Login"
            >
              <LogIn className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 pb-4 border-t border-border/60 bg-card/95 backdrop-blur-lg rounded-xl p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-2 gap-2 text-xs font-medium">
              <button
                onClick={() => scrollTo("platform")}
                className="p-2 text-left hover:bg-muted/50 rounded-md transition-colors"
              >
                Platform
              </button>
              <button
                onClick={() => scrollTo("how-it-works")}
                className="p-2 text-left hover:bg-muted/50 rounded-md transition-colors"
              >
                How It Works
              </button>
              <button
                onClick={() => scrollTo("flow")}
                className="p-2 text-left hover:bg-muted/50 rounded-md transition-colors"
              >
                Follow The Money
              </button>
              <button
                onClick={() => scrollTo("intelligence")}
                className="p-2 text-left hover:bg-muted/50 rounded-md transition-colors"
              >
                AI Intelligence
              </button>
              <button
                onClick={() => scrollTo("enterprise")}
                className="p-2 text-left hover:bg-muted/50 rounded-md transition-colors"
              >
                Multi-Site
              </button>
              <button
                onClick={() => scrollTo("use-cases")}
                className="p-2 text-left hover:bg-muted/50 rounded-md transition-colors"
              >
                Use Cases
              </button>
              <button
                onClick={() => scrollTo("trust")}
                className="p-2 text-left hover:bg-muted/50 rounded-md transition-colors"
              >
                Audit Trail
              </button>
            </div>

            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenDemo) onOpenDemo();
                  else scrollTo("interactive-demo");
                }}
                className="w-full py-2.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground text-center"
              >
                Analyse a Bill Now
              </button>
              <Link
                to="/login"
                className="w-full py-2 rounded-lg text-xs font-medium border border-border text-center hover:bg-muted/50"
              >
                Client Portal Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
