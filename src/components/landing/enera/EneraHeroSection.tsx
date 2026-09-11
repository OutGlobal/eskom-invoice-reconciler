import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { EneraHeroCanvas } from "./EneraHeroCanvas";
import { EneraHeroSceneEngine } from "./EneraHeroSceneEngine";

export function EneraHeroSection() {
  const [headlineStage, setHeadlineStage] = useState<number>(0);
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Headline animation sequence: SEE -> SEE BEYOND -> SEE BEYOND THE BILL.
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

  // Desktop mouse movement, touch, and scroll parallax listener (Subtle, non-exaggerated)
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  useEffect(() => {
    if (reducedMotion) return;

    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    let isVisible = true;
    let isMoving = false;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      targetX = (e.clientX / innerWidth - 0.5) * 2; // -1 to +1
      targetY = (e.clientY / innerHeight - 0.5) * 2;
      isMoving = true;
      if (isVisible && !rafId) {
        rafId = requestAnimationFrame(updateParallax);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        targetX = (touch.clientX / window.innerWidth - 0.5) * 1.4;
        targetY = (touch.clientY / window.innerHeight - 0.5) * 1.4;
        isMoving = true;
        if (isVisible && !rafId) {
          rafId = requestAnimationFrame(updateParallax);
        }
      }
    };

    const handleTouchEnd = () => {
      targetX = 0;
      targetY = 0;
      isMoving = true;
      if (isVisible && !rafId) {
        rafId = requestAnimationFrame(updateParallax);
      }
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      setScrollOffset(Math.min(scrollY * 0.08, 30));
    };

    const updateParallax = () => {
      if (!isVisible) {
        rafId = 0;
        return;
      }

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
        isMoving = false;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && isMoving && !rafId) {
          rafId = requestAnimationFrame(updateParallax);
        }
      },
      { threshold: 0.1 },
    );

    const sectionEl = document.getElementById("hero");
    if (sectionEl) observer.observe(sectionEl);

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  return (
    <section
      id="hero"
      className="relative min-h-screen pt-32 pb-20 overflow-hidden flex flex-col justify-between bg-[#030712] text-white"
    >
      {/* 1. Cinematic Canvas Particle & Electrical Stream Engine */}
      <EneraHeroCanvas />

      {/* Dual atmospheric background shift (Non-exaggerated, multi-plane depth) */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] rounded-full bg-cyan-500/5 blur-[140px] pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: reducedMotion
            ? "translate(-50%, -50%)"
            : `translate(calc(-50% + ${mouseOffset.x * 8}px), calc(-50% + ${mouseOffset.y * 8 - scrollOffset * 0.3}px))`,
        }}
      />
      <div
        className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none transition-transform duration-500 ease-out"
        style={{
          transform: reducedMotion
            ? "translate(-50%, -50%)"
            : `translate(calc(-50% + ${mouseOffset.x * -6}px), calc(-50% + ${mouseOffset.y * -6 - scrollOffset * 0.2}px))`,
        }}
      />

      {/* 2. Main Hero Typography & Call-To-Action Chamber */}
      <div className="relative z-10 max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 w-full">
        {/* MOBILE HERO: Intentional Composition for 320px, 375px, 390px, 430px */}
        <div className="w-full flex flex-col items-center text-center md:hidden pt-2 pb-6 px-1">
          {/* 1. ENERA */}
          <div className="relative mb-2 px-5 py-2 rounded-xl bg-[#0d1117]/90 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_25px_-5px_rgba(6,182,212,0.35)]">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-[0.3em] text-white drop-shadow-[0_0_15px_rgba(34,211,238,0.7)]">
              ENERA
            </span>
            <div className="absolute -bottom-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#22d3ee]" />
          </div>

          {/* 2. Energy Financial Intelligence */}
          <div className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.22em] text-cyan-400 font-medium mb-4">
            Energy Financial Intelligence
          </div>

          {/* 3. SEE BEYOND THE BILL. */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight enera-text-gradient mb-4">
            SEE BEYOND THE BILL.
          </h1>

          <p className="text-xs sm:text-sm text-slate-300/90 font-normal leading-relaxed max-w-sm mb-6">
            Reconstructing raw AMR telemetry against gazetted utility tariffs to detect
            mathematical drift, ratchet penalties, and reclaim lost corporate capital.
          </p>

          {/* 4. Action CTAs: Analyse Your Energy → & Explore ENERA */}
          <div className="w-full max-w-xs mb-8 flex flex-col gap-2.5">
            <Link
              to="/upload"
              className="group relative w-full inline-flex items-center justify-center gap-2.5 min-h-[48px] py-3.5 px-6 rounded-xl font-bold text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_30px_rgba(6,182,212,0.45)] active:scale-[0.98] transition-all font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span>Analyse Your Energy</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/dashboard"
              className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-200 hover:text-white border border-white/10 hover:border-cyan-500/30 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md transition-all font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>Explore ENERA</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>

          {/* 5. Then the animation */}
          <div className="w-full">
            <EneraHeroSceneEngine />
          </div>

          {/* 6. Compact Mobile Intelligence Metrics */}
          <div className="w-full grid grid-cols-3 gap-2 mt-6 text-left">
            <div className="enera-glass rounded-xl p-3 border border-white/10">
              <span className="text-[9px] font-mono text-slate-400 uppercase block">SPEND</span>
              <span className="text-xs sm:text-sm font-bold text-white font-mono">R 8.42M</span>
              <span className="text-[9px] font-mono text-cyan-400 block mt-0.5">ZAR</span>
            </div>
            <div className="enera-glass rounded-xl p-3 border border-amber-500/20 bg-amber-950/10">
              <span className="text-[9px] font-mono text-slate-400 uppercase block">LEAKAGE</span>
              <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono">
                R 51,227
              </span>
              <span className="text-[9px] font-mono text-amber-400 block mt-0.5">98% conf</span>
            </div>
            <div className="enera-glass rounded-xl p-3 border border-emerald-500/20 bg-emerald-950/10">
              <span className="text-[9px] font-mono text-slate-400 uppercase block">DELIVERED</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-300 font-mono">
                4.21 GWh
              </span>
              <span className="text-[9px] font-mono text-emerald-400 block mt-0.5">AMR sync</span>
            </div>
          </div>
        </div>

        {/* DESKTOP & TABLET HERO (768px, 1024px, 1280px, 1440px, 1920px) */}
        <div className="hidden md:flex md:flex-col md:items-center text-center">
          {/* Subtle Category Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-cyan-500/20 backdrop-blur-md mb-6 shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)]">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span className="text-[11px] font-mono text-cyan-300 font-medium tracking-wider uppercase">
              ENERGY FINANCIAL INTELLIGENCE · UNCOVER HIDDEN TARIFF LEAKAGE
            </span>
          </div>

          {/* Cinematic Headline with Opacity/Blur/Translate/Scale Transition (Zero typewriter effect) */}
          <div className="min-h-[90px] sm:min-h-[130px] flex items-center justify-center">
            <h1
              aria-label="SEE BEYOND THE BILL."
              className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-white leading-none"
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
          <p className="mt-4 sm:mt-6 text-sm sm:text-base md:text-lg text-slate-300/90 max-w-2xl mx-auto font-normal leading-relaxed">
            Cross-examining half-hourly revenue meter telemetry against gazetted utility tariffs
            to expose mathematical drift, uncredited holidays, and reclaim unearned energy overcharges.
          </p>

          {/* Action Button Row */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
            {/* Primary CTA: Analyse Your Energy → with traveling arrow pulse */}
            <Link
              to="/upload"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_35px_-5px_rgba(6,182,212,0.5)] hover:shadow-[0_0_45px_-2px_rgba(6,182,212,0.7)] hover:brightness-110 active:scale-[0.98] transition-all overflow-hidden font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span>Analyse Your Energy</span>

              {/* Interactive Arrow Chamber with Traveling Energy Pulse */}
              <div className="relative flex items-center justify-center w-4 h-4 overflow-visible">
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                {/* Traveling energy photon pulse along the arrow */}
                <span className="absolute -left-2 right-0 flex items-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="h-1 w-2.5 rounded-full bg-white shadow-[0_0_8px_#ffffff,0_0_14px_#22d3ee] animate-enera-arrow-pulse" />
                </span>
              </div>

              {/* Shimmer line effect */}
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
              </div>
            </Link>

            {/* Secondary CTA: Explore ENERA → Leads directly to the live application experience */}
            <Link
              to="/dashboard"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-medium text-sm text-slate-300 hover:text-white border border-white/10 hover:border-cyan-500/30 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur-md transition-all shadow-[0_0_20px_-8px_transparent] hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.2)] font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <span>Explore ENERA</span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cyan-300" />
            </Link>
          </div>

          {/* 3. Floating Glassmorphic Intelligence Cards (Float gently, subtle parallax, glassmorphism, subtle glow) */}
          <div className="w-full max-w-5xl mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {/* Card 1: Energy Spend */}
            <div className={reducedMotion ? "w-full" : "w-full animate-enera-float-1"}>
              <div
                className="group relative enera-glass rounded-2xl p-5 transition-all duration-300 hover:border-cyan-500/40 shadow-[0_0_30px_-8px_rgba(6,182,212,0.18)] hover:shadow-[0_0_35px_-4px_rgba(6,182,212,0.3)] flex items-start justify-between overflow-hidden"
                style={{
                  transform: reducedMotion
                    ? "none"
                    : `perspective(1000px) translate3d(${mouseOffset.x * 5}px, ${mouseOffset.y * 5 - scrollOffset * 0.35}px, 0) rotateX(${mouseOffset.y * -1.2}deg) rotateY(${mouseOffset.x * 1.2}deg)`,
                }}
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-cyan-500/10 blur-xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />

                <div>
                  <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                    ENERGY SPEND
                  </span>
                  <div className="text-2xl font-bold text-white font-mono mt-1 tracking-tight">
                    R 8.42M
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono mt-1 font-medium">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>↑ 4.8%</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                  <span className="text-[10px] font-mono font-bold">ZAR</span>
                </div>
              </div>
            </div>

            {/* Card 2: AI Anomaly */}
            <div className={reducedMotion ? "w-full" : "w-full animate-enera-float-2"}>
              <div
                className="group relative enera-glass rounded-2xl p-5 transition-all duration-300 hover:border-amber-500/40 shadow-[0_0_30px_-8px_rgba(245,158,11,0.18)] hover:shadow-[0_0_35px_-4px_rgba(245,158,11,0.3)] flex items-start justify-between overflow-hidden"
                style={{
                  transform: reducedMotion
                    ? "none"
                    : `perspective(1000px) translate3d(${mouseOffset.x * -4}px, ${mouseOffset.y * -3 - scrollOffset * 0.5}px, 0) rotateX(${mouseOffset.y * -0.9}deg) rotateY(${mouseOffset.x * -0.9}deg)`,
                }}
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />

                <div>
                  <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-semibold">
                    DETECTED LEAKAGE
                  </span>
                  <div className="text-2xl font-bold text-amber-300 font-mono mt-1 tracking-tight">
                    R 51,227
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-mono mt-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Recoverable variance</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                  <span className="text-[10px] font-mono font-bold">98%</span>
                </div>
              </div>
            </div>

            {/* Card 3: Consumption */}
            <div className={reducedMotion ? "w-full" : "w-full animate-enera-float-3"}>
              <div
                className="group relative enera-glass rounded-2xl p-5 transition-all duration-300 hover:border-emerald-500/40 shadow-[0_0_30px_-8px_rgba(16,185,129,0.18)] hover:shadow-[0_0_35px_-4px_rgba(16,185,129,0.3)] flex items-start justify-between overflow-hidden"
                style={{
                  transform: reducedMotion
                    ? "none"
                    : `perspective(1000px) translate3d(${mouseOffset.x * 4}px, ${mouseOffset.y * -4 - scrollOffset * 0.4}px, 0) rotateX(${mouseOffset.y * -1.1}deg) rotateY(${mouseOffset.x * 1.1}deg)`,
                }}
              >
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />

                <div>
                  <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                    CONSUMPTION
                  </span>
                  <div className="text-2xl font-bold text-emerald-300 font-mono mt-1 tracking-tight">
                    4.21 GWh
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono mt-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>97.8% confidence</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="text-[10px] font-mono font-bold">AMR</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Controlled 7-Scene Visual State Engine Chamber */}
          <EneraHeroSceneEngine />
        </div>
      </div>
    </section>
  );
}
