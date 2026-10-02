import React, { useState, useEffect } from "react";

interface HeroSlide {
  src: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    src: "/images/hero-slide-grid.jpg",
  },
  {
    src: "/images/hero-slide-industrial.jpg",
  },
  {
    src: "/images/hero-slide-storage.jpg",
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
      {/* 1. Slide Images: Smooth Left-Sliding Carousel with Increased Brightness */}
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
              alt=""
              className="w-full h-full object-cover object-center filter brightness-[1.08] contrast-[1.05] saturate-[1.1]"
              loading="eager"
              decoding="sync"
            />
          </div>
        );
      })}

      {/* 2. Balanced Contrast Overlays: Bright images clearly visible while typography is 100% readable */}
      {/* Smooth vertical gradient: ensures seamless top navigation and bottom flow visual */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c121e]/65 via-transparent to-[#0c121e]/85 pointer-events-none z-[3]" />

      {/* Subtle radial center scrim: keeps hero typography ultra-crisp */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(12,18,30,0.15)_0%,_rgba(12,18,30,0.65)_100%)] pointer-events-none z-[3]" />

      {/* 3. Slide Indicators with 3.5s Progress Bar (No text names or labels) */}
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
                isActive ? "w-10 bg-white/30" : "w-3 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Slide ${index + 1}`}
            >
              {isActive && (
                <span
                  key={`progress-${currentSlide}`}
                  className="absolute inset-y-0 left-0 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                  style={{
                    animation: reducedMotion
                      ? "none"
                      : `enera-slide-progress ${SLIDE_INTERVAL_MS}ms linear forwards`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
