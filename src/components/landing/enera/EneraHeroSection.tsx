import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { EneraHeroCanvas } from "./EneraHeroCanvas";

export function EneraHeroSection() {
  const [headlineStage, setHeadlineStage] = useState<number>(0);
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Cinematic headline sequence: SEE -> SEE BEYOND -> SEE BEYOND THE BILL.
  useEffect(() => {
    if (reducedMotion) {
      setHeadlineStage(3);
      return;
    }

    const t1 = setTimeout(() => setHeadlineStage(1), 300);
    const t2 = setTimeout(() => setHeadlineStage(2), 1200);
    const t3 = setTimeout(() => setHeadlineStage(3), 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [reducedMotion]);

  // Subtle mouse/scroll listener for background ambient glow
  useEffect(() => {
    if (reducedMotion) return;

    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      targetX = (e.clientX / innerWidth - 0.5) * 2;
      targetY = (e.clientY / innerHeight - 0.5) * 2;
      if (!rafId) rafId = requestAnimationFrame(updateParallax);
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      setScrollOffset(Math.min(scrollY * 0.08, 30));
    };

    const updateParallax = () => {
      const diffX = targetX - currentX;
      const diffY = targetY - currentY;

      if (Math.abs(diffX) > 0.002 || Math.abs(diffY) > 0.002) {
        currentX += diffX * 0.05;
        currentY += diffY * 0.05;
        setMouseOffset({ x: currentX, y: currentY });
        rafId = requestAnimationFrame(updateParallax);
      } else {
        currentX = targetX;
        currentY = targetY;
        setMouseOffset({ x: currentX, y: currentY });
        rafId = 0;
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  return (
    <section
      id="hero"
      className="relative min-h-[92vh] md:min-h-screen pt-32 pb-24 sm:pt-40 sm:pb-32 flex flex-col justify-center items-center text-center overflow-hidden bg-[#030712] text-white"
      aria-label="ENERA Energy Financial Intelligence"
    >
      {/* 1. Cinematic Canvas Particle & Electrical Stream Engine (Communicating Complexity) */}
      <EneraHeroCanvas />

      {/* Subtle Atmospheric Ambient Glows */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[460px] rounded-full bg-cyan-500/5 blur-[140px] pointer-events-none transition-transform duration-300 ease-out -z-10"
        style={{
          transform: reducedMotion
            ? "translate(-50%, -50%)"
            : `translate(calc(-50% + ${mouseOffset.x * 8}px), calc(-50% + ${mouseOffset.y * 8 - scrollOffset * 0.3}px))`,
        }}
      />
      <div
        className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[360px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none transition-transform duration-500 ease-out -z-10"
        style={{
          transform: reducedMotion
            ? "translate(-50%, -50%)"
            : `translate(calc(-50% + ${mouseOffset.x * -6}px), calc(-50% + ${mouseOffset.y * -6 - scrollOffset * 0.2}px))`,
        }}
      />

      {/* 2. Focused Typography Chamber (Communicating Pure Simplicity) */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Small Supporting Statement */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs font-mono text-cyan-300 mb-6 sm:mb-8 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
          <span className="font-semibold tracking-[0.2em] uppercase">
            Energy Financial Intelligence
          </span>
        </div>

        {/* ONE IDEA: Headline with cinematic stage reveal */}
        <div className="min-h-[70px] sm:min-h-[110px] md:min-h-[140px] flex items-center justify-center mb-4 sm:mb-6">
          <h1
            aria-label="SEE BEYOND THE BILL."
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-extrabold tracking-tight text-white leading-none"
          >
            {headlineStage === 1 && (
              <span
                key="stage-1"
                className={`inline-block enera-text-gradient ${
                  reducedMotion ? "opacity-100" : "animate-enera-headline"
                }`}
              >
                SEE
              </span>
            )}
            {headlineStage === 2 && (
              <span
                key="stage-2"
                className={`inline-block enera-text-gradient ${
                  reducedMotion ? "opacity-100" : "animate-enera-headline"
                }`}
              >
                SEE BEYOND
              </span>
            )}
            {headlineStage >= 3 && (
              <span
                key="stage-3"
                className={`inline-block enera-text-gradient ${
                  reducedMotion ? "opacity-100" : "animate-enera-headline"
                }`}
              >
                SEE BEYOND THE BILL.
              </span>
            )}
          </h1>
        </div>

        {/* Supporting Statement */}
        <p className="text-base sm:text-xl md:text-2xl text-slate-300 font-light max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-10">
          ENERA turns complex energy and billing information into clear, actionable intelligence.
        </p>

        {/* Action Button Row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 w-full max-w-md">
          {/* Primary CTA: Analyse Your Energy */}
          <Link
            to="/upload"
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl sm:rounded-2xl font-bold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_35px_-5px_rgba(6,182,212,0.5)] hover:shadow-[0_0_45px_-2px_rgba(6,182,212,0.7)] hover:brightness-110 active:scale-[0.98] transition-all overflow-hidden font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span>Analyse Your Energy</span>
            <div className="relative flex items-center justify-center w-4 h-4 overflow-visible">
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              <span className="absolute -left-2 right-0 flex items-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="h-1 w-2.5 rounded-full bg-white shadow-[0_0_8px_#ffffff,0_0_14px_#22d3ee] animate-enera-arrow-pulse" />
              </span>
            </div>
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
            </div>
          </Link>

          {/* Secondary CTA: Explore ENERA */}
          <Link
            to="/dashboard"
            className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-xl sm:rounded-2xl font-semibold text-sm text-slate-200 hover:text-white border border-white/10 hover:border-cyan-500/30 bg-white/[0.03] hover:bg-white/[0.07] backdrop-blur-md transition-all shadow-[0_0_20px_-8px_transparent] hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.2)] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span>Explore ENERA</span>
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cyan-300" />
          </Link>
        </div>
      </div>
    </section>
  );
}
