import React, { useState, useEffect, useRef } from "react";

interface HeroSlide {
  src: string;
  alt: string;
  label: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    src: "/images/hero-slide-grid.jpg",
    alt: "South African electrical transmission grid and substation at dusk",
    label: "Transmission Grid & Substation",
  },
  {
    src: "/images/hero-slide-industrial.jpg",
    alt: "Commercial and industrial manufacturing power infrastructure",
    label: "Industrial Infrastructure",
  },
  {
    src: "/images/hero-slide-storage.jpg",
    alt: "Commercial battery energy storage and utility transformer installation",
    label: "Storage & Microgrid Systems",
  },
];

const SLIDE_INTERVAL_MS = 3500; // 3.5 seconds

export function EneraHeroImageSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, SLIDE_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reducedMotion, isPaused]);

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 select-none"
      aria-hidden="true"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Horizontal sliding track (slides left every 3.5s) */}
      <div
        className="flex w-full h-full transition-transform duration-1000 ease-out will-change-transform"
        style={{
          transform: `translateX(-${currentSlide * 100}%)`,
        }}
      >
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className="w-full h-full min-w-full flex-shrink-0 relative"
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className="w-full h-full object-cover object-center filter brightness-[0.75] contrast-[1.05]"
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </div>
        ))}
      </div>

      {/* 2. Multi-layered dark overlays to protect text contrast and readability */}
      {/* Deep dark tint overlay */}
      <div className="absolute inset-0 bg-[#0c121e]/75 backdrop-blur-[0.5px]" />

      {/* Vertical gradient overlay: smooth transition from nav and into flow visual */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c121e]/95 via-[#0c121e]/65 to-[#0c121e]" />

      {/* Center elliptical vignette: dims the hero center so headline & text pop out */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(12,18,30,0.5)_0%,_rgba(12,18,30,0.92)_100%)]" />

      {/* 3. Subtle slide indicator tabs at bottom */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 pointer-events-auto">
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <button
              key={slide.src}
              type="button"
              onClick={() => setCurrentSlide(index)}
              className={`h-1.5 rounded-full transition-all duration-500 focus-ring-enera ${
                isActive
                  ? "w-8 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.6)]"
                  : "w-2 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Go to slide ${index + 1}: ${slide.label}`}
              tabIndex={0}
            />
          );
        })}
      </div>
    </div>
  );
}
