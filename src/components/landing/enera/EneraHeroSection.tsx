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
    const t1 = setTimeout(() => setHeadlineStage(1), 300);
    const t2 = setTimeout(() => setHeadlineStage(2), 1200);
    const t3 = setTimeout(() => setHeadlineStage(3), 2200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Desktop mouse movement, touch, and scroll parallax listener (Subtle, non-exaggerated)
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  useEffect(() => {
    if (reducedMotion) return;

    let rafId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      targetX = (e.clientX / innerWidth - 0.5) * 2; // -1 to +1
      targetY = (e.clientY / innerHeight - 0.5) * 2;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        targetX = (touch.clientX / window.innerWidth - 0.5) * 1.4;
        targetY = (touch.clientY / window.innerHeight - 0.5) * 1.4;
      }
    };

    const handleTouchEnd = () => {
      targetX = 0;
      targetY = 0;
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      setScrollOffset(Math.min(scrollY * 0.08, 30));
    };

    const updateParallax = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      setMouseOffset({ x: currentX, y: currentY });
      rafId = requestAnimationFrame(updateParallax);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    rafId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  return (
    <section className="relative min-h-screen pt-32 pb-20 overflow-hidden flex flex-col justify-between bg-[#030712] text-white">
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
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
        {/* Subtle Category Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-cyan-500/20 backdrop-blur-md mb-6 shadow-[0_0_15px_-3px_rgba(6,182,212,0.2)]">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span className="text-[11px] font-mono text-cyan-300 font-medium tracking-wider uppercase">
            AUTONOMOUS REVENUE METER RECONCILIATION
          </span>
        </div>

        {/* Cinematic Headline with Opacity/Blur/Translate Transition */}
        <div className="min-h-[90px] sm:min-h-[130px] flex items-center justify-center">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight text-white leading-none">
            {headlineStage === 1 && (
              <span className="inline-block animate-in fade-in zoom-in-95 blur-sm duration-500 enera-text-gradient">
                SEE
              </span>
            )}
            {headlineStage === 2 && (
              <span className="inline-block animate-in fade-in zoom-in-95 duration-500 enera-text-gradient">
                SEE BEYOND
              </span>
            )}
            {headlineStage >= 3 && (
              <span className="inline-block animate-in fade-in zoom-in-95 duration-700 enera-text-gradient">
                SEE BEYOND THE BILL.
              </span>
            )}
          </h1>
        </div>

        {/* Supporting Statement */}
        <p className="mt-4 sm:mt-6 text-sm sm:text-base md:text-lg text-slate-300/90 max-w-2xl mx-auto font-normal leading-relaxed">
          AI-powered energy intelligence that reconciles every charge, detects hidden anomalies and
          shows where your energy money is going.
        </p>

        {/* Action Button Row */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          {/* Primary CTA: Analyse Your Energy with traveling pulse arrow */}
          <Link
            to="/upload"
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_35px_-5px_rgba(6,182,212,0.5)] hover:brightness-110 active:scale-[0.98] transition-all overflow-hidden"
          >
            <span>Analyse Your Energy</span>
            {/* Pulsing arrow icon */}
            <div className="relative flex items-center justify-center">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute -left-1 w-2 h-2 rounded-full bg-white/60 blur-[1px] group-hover:animate-ping" />
            </div>
            {/* Shimmer line effect */}
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
            </div>
          </Link>

          {/* Secondary CTA: Explore ENERA */}
          <a
            href="#platform"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-medium text-sm text-slate-300 hover:text-white border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur-md transition-all"
          >
            <span>Explore ENERA</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
          </a>
        </div>

        {/* 3. Floating Glassmorphic Intelligence Cards with Subtle Parallax & Tilt */}
        <div className="w-full max-w-5xl mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {/* Card 1: Energy Spend (Responds with gentle parallax) */}
          <div
            className="enera-glass rounded-2xl p-4.5 transition-all duration-300 hover:border-cyan-500/40 shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] flex items-start justify-between hover:scale-[1.01]"
            style={{
              transform: reducedMotion
                ? "none"
                : `perspective(1000px) translate3d(${mouseOffset.x * 5}px, ${mouseOffset.y * 5 - scrollOffset * 0.35}px, 0) rotateX(${mouseOffset.y * -1.2}deg) rotateY(${mouseOffset.x * 1.2}deg)`,
            }}
          >
            <div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                ENERGY SPEND
              </span>
              <div className="text-2xl font-bold text-white font-mono mt-1">R 8.42M</div>
              <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono mt-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>↑ 4.8% vs last cycle</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400">
              <span className="text-[10px] font-mono">ZAR</span>
            </div>
          </div>

          {/* Card 2: AI Anomaly (Subtle opposing parallax & tilt) */}
          <div
            className="enera-glass rounded-2xl p-4.5 transition-all duration-300 hover:border-amber-500/40 shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] flex items-start justify-between hover:scale-[1.01]"
            style={{
              transform: reducedMotion
                ? "none"
                : `perspective(1000px) translate3d(${mouseOffset.x * -4}px, ${mouseOffset.y * -3 - scrollOffset * 0.5}px, 0) rotateX(${mouseOffset.y * -0.9}deg) rotateY(${mouseOffset.x * -0.9}deg)`,
            }}
          >
            <div>
              <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-semibold">
                AI ANOMALY DETECTED
              </span>
              <div className="text-2xl font-bold text-amber-300 font-mono mt-1">R 51,227</div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400/90 font-mono mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Potential billing variance</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <span className="text-[10px] font-mono">98%</span>
            </div>
          </div>

          {/* Card 3: Consumption (Subtle complementary parallax & tilt) */}
          <div
            className="enera-glass rounded-2xl p-4.5 transition-all duration-300 hover:border-emerald-500/40 shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)] flex items-start justify-between hover:scale-[1.01]"
            style={{
              transform: reducedMotion
                ? "none"
                : `perspective(1000px) translate3d(${mouseOffset.x * 4}px, ${mouseOffset.y * -4 - scrollOffset * 0.4}px, 0) rotateX(${mouseOffset.y * -1.1}deg) rotateY(${mouseOffset.x * 1.1}deg)`,
            }}
          >
            <div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                CONSUMPTION
              </span>
              <div className="text-2xl font-bold text-emerald-300 font-mono mt-1">4.21 GWh</div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono mt-1">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>97.8% AI confidence</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <span className="text-[10px] font-mono">AMR</span>
            </div>
          </div>
        </div>

        {/* 4. Controlled 7-Scene Visual State Engine Chamber */}
        <EneraHeroSceneEngine />
      </div>
    </section>
  );
}
