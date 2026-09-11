import React, { useRef, useEffect, useState } from "react";

// The 6 carefully selected signals representing the complete energy-to-financial lifecycle
type SignalType = "kWh" | "kVA" | "TARIFF" | "DEMAND" | "COST" | "VARIANCE";

interface EnergySignal {
  id: string;
  label: SignalType;
  sub: string;
  baseRelX: number; // 0 to 1
  baseRelY: number; // 0 to 1
  x: number;
  y: number;
  color: string;
  glowColor: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  phase: number;
}

interface StreamLine {
  startX: number;
  startY: number;
  controlX1: number;
  controlY1: number;
  controlX2: number;
  controlY2: number;
  endX: number;
  endY: number;
  color: string;
  speed: number;
}

export function EneraHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible;
        isVisible = entry.isIntersecting;
        if (!wasVisible && isVisible) {
          animationFrameId = requestAnimationFrame(render);
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(canvas);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      updateSignalCoordinates();
    };
    window.addEventListener("resize", handleResize, { passive: true });

    // Interactive mouse / touch coordinates
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetMouseX = e.touches[0].clientX;
        targetMouseY = e.touches[0].clientY;
      }
    };
    const handleTouchEnd = () => {
      targetMouseX = width / 2;
      targetMouseY = height / 2;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    // The 6 carefully selected signals - framed around the central reading column
    const signals: EnergySignal[] = [
      {
        id: "s1",
        label: "kWh",
        sub: "ACTIVE TELEMETRY",
        baseRelX: 0.16,
        baseRelY: 0.28,
        x: width * 0.16,
        y: height * 0.28,
        color: "#22d3ee",
        glowColor: "rgba(34, 211, 238, 0.4)",
      },
      {
        id: "s2",
        label: "kVA",
        sub: "APPARENT DEMAND",
        baseRelX: 0.84,
        baseRelY: 0.28,
        x: width * 0.84,
        y: height * 0.28,
        color: "#10b981",
        glowColor: "rgba(16, 185, 129, 0.4)",
      },
      {
        id: "s3",
        label: "TARIFF",
        sub: "STATUTORY SCHEDULE",
        baseRelX: 0.12,
        baseRelY: 0.54,
        x: width * 0.12,
        y: height * 0.54,
        color: "#a78bfa",
        glowColor: "rgba(167, 139, 250, 0.4)",
      },
      {
        id: "s4",
        label: "DEMAND",
        sub: "PEAK DETERMINANT",
        baseRelX: 0.88,
        baseRelY: 0.54,
        x: width * 0.88,
        y: height * 0.54,
        color: "#f59e0b",
        glowColor: "rgba(245, 158, 11, 0.4)",
      },
      {
        id: "s5",
        label: "COST",
        sub: "BILLED LIABILITY",
        baseRelX: 0.22,
        baseRelY: 0.78,
        x: width * 0.22,
        y: height * 0.78,
        color: "#38bdf8",
        glowColor: "rgba(56, 189, 248, 0.4)",
      },
      {
        id: "s6",
        label: "VARIANCE",
        sub: "ISOLATED DELTA",
        baseRelX: 0.78,
        baseRelY: 0.78,
        x: width * 0.78,
        y: height * 0.78,
        color: "#f43f5e",
        glowColor: "rgba(244, 63, 94, 0.4)",
      },
    ];

    const updateSignalCoordinates = () => {
      const isMobile = width < 768;
      signals.forEach((s) => {
        const relX = isMobile
          ? s.baseRelX < 0.5
            ? Math.max(0.12, s.baseRelX * 0.85)
            : Math.min(0.88, 1 - (1 - s.baseRelX) * 0.85)
          : s.baseRelX;
        s.x = width * relX;
        s.y = height * s.baseRelY;
      });
    };
    updateSignalCoordinates();

    // Ambient particles (reduced count, subtle, never competing with headline)
    const particleCount = reducedMotion ? 12 : width < 768 ? 20 : 40;
    const particles: Particle[] = [];
    const colors = ["#22d3ee", "#10b981", "#a78bfa", "#f59e0b", "#38bdf8"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.8,
        alpha: Math.random() * 0.25 + 0.1,
        color: colors[i % colors.length],
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Converging and circulating energy streams
    const streams: StreamLine[] = [
      // Left energy stream feeding into kWh & TARIFF
      {
        startX: 0,
        startY: height * 0.2,
        controlX1: width * 0.08,
        controlY1: height * 0.24,
        controlX2: width * 0.12,
        controlY2: height * 0.26,
        endX: width * 0.16,
        endY: height * 0.28,
        color: "#22d3ee",
        speed: 0.008,
      },
      // Right energy stream feeding into kVA & DEMAND
      {
        startX: width,
        startY: height * 0.22,
        controlX1: width * 0.92,
        controlY1: height * 0.25,
        controlX2: width * 0.88,
        controlY2: height * 0.27,
        endX: width * 0.84,
        endY: height * 0.28,
        color: "#10b981",
        speed: 0.009,
      },
      // Lower-left stream into TARIFF & COST
      {
        startX: 0,
        startY: height * 0.65,
        controlX1: width * 0.06,
        controlY1: height * 0.58,
        controlX2: width * 0.09,
        controlY2: height * 0.55,
        endX: width * 0.12,
        endY: height * 0.54,
        color: "#a78bfa",
        speed: 0.007,
      },
      // Lower-right stream into DEMAND & VARIANCE
      {
        startX: width,
        startY: height * 0.68,
        controlX1: width * 0.94,
        controlY1: height * 0.6,
        controlX2: width * 0.91,
        controlY2: height * 0.56,
        endX: width * 0.88,
        endY: height * 0.54,
        color: "#f59e0b",
        speed: 0.008,
      },
    ];

    // Total Continuous Evolutionary Cycle: 24 seconds
    // 0s - 6s:   ENERGY (Pure flowing energy currents and traveling particles)
    // 6s - 12s:  DATA (The 6 signals crystallize, illuminate, and beacon)
    // 12s - 18s: INTELLIGENCE (Structured vectors connect the signals into an intelligence matrix)
    // 18s - 22s: INSIGHT (Vectors converge, VARIANCE is isolated with resolution beacon)
    // 22s - 24s: RESET (Structured intelligence dissolves back into pure energy streams)
    const CYCLE_DURATION = 24;
    let time = 0;

    const render = () => {
      time += 0.016;
      const cycleTime = time % CYCLE_DURATION;
      const progress = cycleTime / CYCLE_DURATION; // 0.0 to 1.0

      let dataAlpha = 0;
      let lineAlpha = 0;
      let insightAlpha = 0;

      if (progress < 0.25) {
        // ENERGY PHASE (0.0 to 0.25)
        const t = progress / 0.25;
        dataAlpha = 0.2 * t; // signals start very faint
        lineAlpha = 0;
        insightAlpha = 0;
      } else if (progress < 0.5) {
        // DATA PHASE (0.25 to 0.50)
        const t = (progress - 0.25) / 0.25;
        dataAlpha = 0.2 + 0.65 * t; // signals illuminate
        lineAlpha = 0.2 * t; // connections begin to trace
        insightAlpha = 0;
      } else if (progress < 0.75) {
        // INTELLIGENCE PHASE (0.50 to 0.75)
        const t = (progress - 0.5) / 0.25;
        dataAlpha = 0.85;
        lineAlpha = 0.2 + 0.65 * t; // network lines fully visible
        insightAlpha = 0.3 * t;
      } else if (progress < 0.9) {
        // INSIGHT PHASE (0.75 to 0.90)
        const t = (progress - 0.75) / 0.15;
        dataAlpha = 0.85;
        lineAlpha = 0.85 - 0.2 * t;
        insightAlpha = 0.4 + 0.6 * Math.sin(t * Math.PI); // pulsing insight beacon
      } else {
        // RESET PHASE (0.90 to 1.0)
        const t = (progress - 0.9) / 0.1;
        dataAlpha = 0.85 * (1 - t);
        lineAlpha = 0.65 * (1 - t);
        insightAlpha = 0.4 * (1 - t);
      }

      // Smooth mouse damping
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      // Soft clear with slight persistence for motion fluidity
      ctx.fillStyle = "rgba(3, 7, 18, 0.26)";
      ctx.fillRect(0, 0, width, height);

      // Central Headline Clearance Calculation (Ensuring animation NEVER competes with headline)
      const centerX = width / 2;
      const centerY = height * 0.42;
      const clearanceRadius = Math.min(width * 0.38, 320);

      // 1. Draw Energy Streams (Atmospheric flowing energy lines)
      streams.forEach((stream, sIdx) => {
        ctx.save();
        const streamAlpha = reducedMotion ? 0.12 : 0.18 + 0.08 * Math.sin(time * 2 + sIdx);
        ctx.strokeStyle = stream.color;
        ctx.lineWidth = 1.2;
        ctx.shadowColor = stream.color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = streamAlpha;

        ctx.beginPath();
        ctx.moveTo(stream.startX, stream.startY);
        ctx.bezierCurveTo(
          stream.controlX1,
          stream.controlY1,
          stream.controlX2,
          stream.controlY2,
          stream.endX,
          stream.endY,
        );
        ctx.stroke();

        // Traveling energy photon along the stream
        if (!reducedMotion) {
          const streamProgress = (time * stream.speed * 8 + sIdx * 0.25) % 1;
          const u = streamProgress;
          const u2 = u * u;
          const u3 = u2 * u;
          const t = 1 - u;
          const t2 = t * t;
          const t3 = t2 * t;

          // Cubic bezier point
          const px =
            t3 * stream.startX +
            3 * t2 * u * stream.controlX1 +
            3 * t * u2 * stream.controlX2 +
            u3 * stream.endX;
          const py =
            t3 * stream.startY +
            3 * t2 * u * stream.controlY1 +
            3 * t * u2 * stream.controlY2 +
            u3 * stream.endY;

          // Center dimming check so photons never distract from headline
          const distToCenter = Math.hypot(px - centerX, py - centerY);
          const centerDim = distToCenter < clearanceRadius ? Math.max(0.1, distToCenter / clearanceRadius) : 1;

          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = stream.color;
          ctx.shadowBlur = 12;
          ctx.globalAlpha = streamAlpha * 2 * centerDim;
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // 2. Structured Intelligence Vectors (Connecting the 6 signals during Intelligence/Insight phase)
      if (lineAlpha > 0.02) {
        const connections: [number, number][] = [
          [0, 2], // kWh -> TARIFF
          [2, 4], // TARIFF -> COST
          [1, 3], // kVA -> DEMAND
          [3, 5], // DEMAND -> VARIANCE
          [4, 5], // COST -> VARIANCE (Reconciliation & Recovery)
          [0, 1], // kWh -> kVA (Dual Energy Vector)
        ];

        connections.forEach(([fromIdx, toIdx], cIdx) => {
          const from = signals[fromIdx];
          const to = signals[toIdx];
          if (!from || !to) return;

          ctx.save();
          const isRecoveryVector = cIdx === 4;
          ctx.strokeStyle = isRecoveryVector ? "#f43f5e" : "rgba(34, 211, 238, 0.35)";
          ctx.lineWidth = isRecoveryVector ? 1.5 : 1;
          ctx.shadowColor = isRecoveryVector ? "#f43f5e" : "#22d3ee";
          ctx.shadowBlur = isRecoveryVector ? 10 : 6;
          ctx.globalAlpha = (isRecoveryVector ? lineAlpha * 1.2 : lineAlpha * 0.6) * (0.7 + 0.3 * Math.sin(time * 3 + cIdx));

          // Dashed line pattern for digital telemetry aesthetic
          ctx.setLineDash([4, 6]);
          ctx.lineDashOffset = -time * 15;

          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          ctx.setLineDash([]); // Reset line dash

          // Traveling intelligence packet along connection line
          if (!reducedMotion && lineAlpha > 0.25) {
            const lineProgress = (time * 0.4 + cIdx * 0.2) % 1;
            const lx = from.x + (to.x - from.x) * lineProgress;
            const ly = from.y + (to.y - from.y) * lineProgress;

            const distToCenter = Math.hypot(lx - centerX, ly - centerY);
            const centerDim = distToCenter < clearanceRadius ? Math.max(0.1, distToCenter / clearanceRadius) : 1;

            ctx.fillStyle = isRecoveryVector ? "#fb7185" : "#ffffff";
            ctx.shadowColor = isRecoveryVector ? "#f43f5e" : "#22d3ee";
            ctx.shadowBlur = 10;
            ctx.globalAlpha = lineAlpha * centerDim;
            ctx.beginPath();
            ctx.arc(lx, ly, isRecoveryVector ? 2.5 : 1.8, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        });
      }

      // 3. Draw The 6 Carefully Selected Signals (kWh, kVA, TARIFF, DEMAND, COST, VARIANCE)
      signals.forEach((signal, idx) => {
        // Subtle organic float around base anchor
        const floatOffset = reducedMotion ? 0 : Math.sin(time * 1.8 + idx * 1.2) * 4;
        const sigX = signal.x + (reducedMotion ? 0 : (mouseX - centerX) * 0.015);
        const sigY = signal.y + floatOffset + (reducedMotion ? 0 : (mouseY - centerY) * 0.015);

        // Compute gentle proximity illumination if cursor moves near signal
        const distToMouse = Math.hypot(sigX - mouseX, sigY - mouseY);
        const mouseProximity = distToMouse < 110 ? (110 - distToMouse) / 110 : 0;

        const effectiveAlpha = Math.max(0.08, Math.min(0.85, dataAlpha + mouseProximity * 0.2));

        ctx.save();
        ctx.globalAlpha = effectiveAlpha;

        // Is this the VARIANCE node during the INSIGHT phase?
        const isInsightTarget = signal.label === "VARIANCE" && insightAlpha > 0.05;

        // Outer glow halo around the signal node
        ctx.beginPath();
        const haloRadius = isInsightTarget ? 18 + insightAlpha * 8 : 12;
        ctx.arc(sigX, sigY, haloRadius, 0, Math.PI * 2);
        ctx.fillStyle = signal.glowColor;
        ctx.shadowColor = signal.color;
        ctx.shadowBlur = isInsightTarget ? 25 : 14;
        ctx.fill();

        // Insight harmonic ripple ring around VARIANCE
        if (isInsightTarget) {
          ctx.beginPath();
          ctx.arc(sigX, sigY, haloRadius + 10 * Math.sin(time * 4), 0, Math.PI * 2);
          ctx.strokeStyle = signal.color;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = insightAlpha * 0.6;
          ctx.stroke();
        }

        // Signal Node Core Beacon
        ctx.beginPath();
        ctx.arc(sigX, sigY, isInsightTarget ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isInsightTarget ? "#ffffff" : signal.color;
        ctx.shadowColor = signal.color;
        ctx.shadowBlur = 12;
        ctx.fill();

        // Elegant Signal Text Lockup (Clean, restrained monospace font)
        const isLeftSide = signal.baseRelX < 0.5;
        const textAnchorX = isLeftSide ? sigX + 10 : sigX - 10;
        ctx.textAlign = isLeftSide ? "left" : "right";

        // Signal Primary Label (kWh, kVA, TARIFF, etc.)
        ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = isInsightTarget ? "#ffffff" : signal.color;
        ctx.shadowColor = signal.color;
        ctx.shadowBlur = 8;
        ctx.fillText(signal.label, textAnchorX, sigY + 3.5);

        // Signal Subtext (Only displayed on tablet/desktop for ultra-clarity)
        if (width >= 640 && effectiveAlpha > 0.25) {
          ctx.font = "500 8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillStyle = "rgba(148, 163, 184, 0.75)";
          ctx.shadowBlur = 0;
          ctx.fillText(signal.sub, textAnchorX, sigY + 14);
        }

        ctx.restore();
      });

      // 4. Ambient Energy Particles (Soft drifting stardust, reduced near center)
      particles.forEach((p) => {
        p.phase += 0.02;
        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        const distToCenter = Math.hypot(p.x - centerX, p.y - centerY);
        const centerDim = distToCenter < clearanceRadius ? Math.max(0.12, distToCenter / clearanceRadius) : 1;

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = p.alpha * centerDim * (0.7 + 0.3 * Math.sin(p.phase));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Loop request
      if (isVisible) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      observer.disconnect();
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [reducedMotion]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* 1. Cinematic Background Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 2. Atmospheric Core Glow (Soft background depth, non-distracting) */}
      <div className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[450px] md:w-[650px] h-[220px] sm:h-[350px] rounded-full bg-cyan-500/10 blur-[50px] md:blur-[130px] pointer-events-none" />
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] sm:w-[320px] h-[160px] sm:h-[240px] rounded-full bg-emerald-500/10 blur-[40px] md:blur-[100px] pointer-events-none" />
    </div>
  );
}
