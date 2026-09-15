import React, { useState, useEffect } from "react";

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
  const [prevSlide, setPrevSlide] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

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

    const interval = setInterval(() => {
      setCurrentSlide((curr) => {
        setPrevSlide(curr);
        return (curr + 1) % HERO_SLIDES.length;
      });
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [reducedMotion, isPaused]);

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden select-none z-0"
      aria-hidden="true"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* 1. Slide Images: Smooth Left-Sliding Carousel Engine */}
      {HERO_SLIDES.map((slide, index) => {
        const isActive = index === currentSlide;
        const isPrev = index === prevSlide;

        let transformStyle = "translateX(100%)";
        let opacityStyle = 0;
        let transitionStyle = "none";
        let zIndex = 0;

        if (isActive) {
          transformStyle = "translateX(0%)";
          opacityStyle = 1;
          transitionStyle = "transform 1000ms cubic-bezier(0.16, 1, 0.3, 1), opacity 800ms ease";
          zIndex = 2;
        } else if (isPrev) {
          transformStyle = "translateX(-100%)";
          opacityStyle = 0;
          transitionStyle = "transform 1000ms cubic-bezier(0.16, 1, 0.3, 1), opacity 800ms ease";
          zIndex = 1;
        }

        return (
          <div
            key={slide.src}
            className="absolute inset-0 w-full h-full will-change-transform pointer-events-none"
            style={{
              transform: transformStyle,
              opacity: opacityStyle,
              transition: transitionStyle,
              zIndex,
            }}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className="w-full h-full object-cover object-center filter brightness-[0.88] contrast-[1.08] saturate-[1.05]"
              loading="eager"
              decoding="sync"
            />
          </div>
        );
      })}

      {/* 2. Calibrated Contrast Overlays: Images are clearly visible while typography is 100% readable */}
      {/* Base dark tint */}
      <div className="absolute inset-0 bg-[#0c121e]/50 pointer-events-none z-[3]" />

      {/* Vertical gradient: seamless top header transition and bottom visual integration */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c121e]/85 via-[#0c121e]/35 to-[#0c121e]/95 pointer-events-none z-[3]" />

      {/* Center elliptical vignette: dims center behind headline */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(12,18,30,0.3)_0%,_rgba(12,18,30,0.75)_100%)] pointer-events-none z-[3]" />

      {/* 3. Slide Indicators with 3.5s Progress Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 pointer-events-auto">
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <button
              key={slide.src}
              type="button"
              onClick={() => {
                setPrevSlide(currentSlide);
                setCurrentSlide(index);
              }}
              className={`group relative h-1.5 rounded-full overflow-hidden transition-all duration-300 focus-ring-enera ${
                isActive ? "w-10 bg-white/20" : "w-3 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Go to slide ${index + 1}: ${slide.label}`}
              title={slide.label}
            >
              {isActive && (
                <span
                  key={`progress-${currentSlide}`}
                  className="absolute inset-y-0 left-0 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                  style={{
                    animation: reducedMotion ? "none" : `enera-slide-progress ${SLIDE_INTERVAL_MS}ms linear forwards`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Slide Badge Pill (Shows active South African grid aspect) */}
      <div className="absolute top-28 right-6 z-20 hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-[10px] font-mono text-slate-300 shadow-md backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-cyan-300 font-semibold">{HERO_SLIDES[currentSlide].label}</span>
      </div>
    </div>
  );
}
