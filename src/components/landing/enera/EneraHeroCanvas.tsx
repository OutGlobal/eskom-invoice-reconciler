import React, { useRef, useEffect, useState } from "react";

/**
 * Calm Ambient Energy Canvas
 * 10% Futuristic Personality: Gentle, low-contrast telemetry grid lines and slow, subtle energy stream.
 * 100% unobtrusive: never competes with typography or interactive CTAs.
 */
export function EneraHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let isVisible = true;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          animId = requestAnimationFrame(render);
        } else {
          cancelAnimationFrame(animId);
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(canvas);

    const handleResize = () => {
      if (!canvas) return;
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize, { passive: true });

    let t = 0;

    const render = () => {
      t += 0.006;
      ctx.clearRect(0, 0, w, h);

      // Subtle horizontal baseline grid lines (representing 30-min TOU interval telemetry)
      const lineCount = 5;
      const spacing = h / (lineCount + 1);

      ctx.lineWidth = 1;
      for (let i = 1; i <= lineCount; i++) {
        const y = i * spacing;
        const lineAlpha = 0.03 + 0.015 * Math.sin(t * 1.5 + i);
        ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        // Slow, quiet single traveling packet along 2 of the lines
        if (i === 2 || i === 4) {
          const speed = i === 2 ? 0.08 : 0.05;
          const px = ((t * speed * w) + (i * 120)) % w;
          ctx.beginPath();
          ctx.arc(px, y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(34, 211, 238, 0.4)";
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      if (isVisible) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [reducedMotion]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Subtle, calm atmospheric gradient centered behind content */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] rounded-full bg-cyan-950/15 blur-[120px] pointer-events-none" />
    </div>
  );
}
