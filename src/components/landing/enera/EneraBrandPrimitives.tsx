import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * ENERA Brand Design Tokens
 * 
 * Color Palette:
 * - Near-Black:   #030712
 * - Graphite:     #0d1117
 * - Deep Charcoal: #161b22
 * - Crisp White:  #f8fafc
 * - Electric Cyan: #06b6d4 / #22d3ee
 * - Controlled Green: #10b981
 * - Soft Violet:  #8b5cf6
 */

export interface EneraBrandMarkProps {
  size?: "sm" | "md" | "lg";
  showDescriptor?: boolean;
  className?: string;
}

export function EneraBrandMark({
  size = "md",
  showDescriptor = true,
  className = "",
}: EneraBrandMarkProps) {
  const sizeClasses = {
    sm: {
      emblem: "w-6 h-6 text-xs",
      logo: "text-sm tracking-[0.2em]",
      descriptor: "text-[8px] tracking-[0.18em]",
    },
    md: {
      emblem: "w-8 h-8 text-sm",
      logo: "text-base sm:text-lg tracking-[0.25em]",
      descriptor: "text-[9px] tracking-[0.2em]",
    },
    lg: {
      emblem: "w-11 h-11 text-lg",
      logo: "text-2xl tracking-[0.3em]",
      descriptor: "text-[10px] tracking-[0.25em]",
    },
  }[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Luminous Emblem */}
      <div
        className={`relative flex items-center justify-center rounded-lg bg-gradient-to-br from-cyan-950 via-[#0d1117] to-slate-900 border border-cyan-500/30 shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] shrink-0 ${sizeClasses.emblem}`}
      >
        <span className="font-mono font-bold tracking-widest text-cyan-400">E</span>
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping opacity-75" />
        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-white ${sizeClasses.logo}`}>
            E N E R A
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-semibold">
            2025/26
          </span>
        </div>
        {showDescriptor && (
          <span className={`uppercase text-slate-400 font-medium font-mono ${sizeClasses.descriptor}`}>
            Energy Financial Intelligence
          </span>
        )}
      </div>
    </div>
  );
}

export interface EneraCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glow-cyan" | "glow-emerald" | "subtle";
  children: React.ReactNode;
}

export function EneraCard({
  variant = "default",
  className = "",
  children,
  ...props
}: EneraCardProps) {
  const variantStyles = {
    default:
      "enera-glass hover:border-white/20 transition-all shadow-[0_4px_30px_rgba(0,0,0,0.5)]",
    "glow-cyan":
      "enera-glass border-cyan-500/30 shadow-[0_0_35px_-5px_rgba(6,182,212,0.2)] hover:border-cyan-400/50 transition-all",
    "glow-emerald":
      "enera-glass border-emerald-500/30 shadow-[0_0_35px_-5px_rgba(16,185,129,0.2)] hover:border-emerald-400/50 transition-all",
    subtle:
      "bg-[#0d1117]/60 border border-white/5 hover:border-white/15 transition-all",
  }[variant];

  return (
    <div className={`rounded-2xl p-6 ${variantStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface EneraBadgeProps {
  children: React.ReactNode;
  variant?: "cyan" | "emerald" | "violet" | "amber";
  className?: string;
}

export function EneraBadge({
  children,
  variant = "cyan",
  className = "",
}: EneraBadgeProps) {
  const variantStyles = {
    cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    violet: "bg-violet-500/10 border-violet-500/30 text-violet-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-medium tracking-wide ${variantStyles} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      <span>{children}</span>
    </span>
  );
}

export interface EneraButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  asLink?: boolean;
  to?: string;
  showPulse?: boolean;
  children: React.ReactNode;
}

export function EneraButton({
  variant = "primary",
  asLink = false,
  to = "/upload",
  showPulse = true,
  children,
  className = "",
  ...props
}: EneraButtonProps) {
  const baseStyles =
    "group relative inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 active:scale-[0.98]";

  const variantStyles = {
    primary:
      "text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 hover:brightness-110 shadow-[0_0_25px_-3px_rgba(6,182,212,0.4)]",
    secondary:
      "text-slate-200 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 backdrop-blur-md",
    outline:
      "text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40",
  }[variant];

  const content = (
    <>
      <span>{children}</span>
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      {variant === "primary" && showPulse && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
        </div>
      )}
    </>
  );

  if (asLink) {
    return (
      <Link to={to} className={`${baseStyles} ${variantStyles} ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {content}
    </button>
  );
}
