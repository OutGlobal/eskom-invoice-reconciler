import React, { useRef, useEffect, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  pulseSpeed: number;
  phase: number;
}

interface StreamLine {
  startX: number;
  startY: number;
  points: { x: number; y: number }[];
  targetIndex: number;
  speed: number;
  color: string;
  width: number;
  glow: number;
}

export function EneraHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [logoState, setLogoState] = useState<string>("E");
  const [taglineState, setTaglineState] = useState<number>(0); // 0: hidden, 1: "Every bill contains a signal", 2: "ENERA finds it."
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Logo construction sequence: E -> EN -> ENE -> ENER -> ENERA
  useEffect(() => {
    const letters = ["E", "E N", "E N E", "E N E R", "E N E R A"];
    let currentIdx = 0;
    const interval = setInterval(() => {
      currentIdx = (currentIdx + 1) % (letters.length + 3); // pause at ENERA
      if (currentIdx < letters.length) {
        setLogoState(letters[currentIdx]);
      } else {
        setLogoState("E N E R A");
      }
    }, 1400);

    return () => clearInterval(interval);
  }, []);

  // Tagline cycle: "Every bill contains a signal" -> "ENERA finds it."
  useEffect(() => {
    const tagInterval = setInterval(() => {
      setTaglineState((prev) => (prev + 1) % 3);
    }, 4200);

    return () => clearInterval(tagInterval);
  }, []);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // High-performance canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Mouse coordinates for gentle electrical deflection
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = width / 2;
    let targetMouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Floating engineering energy units
    const units = [
      { text: "kWh", x: width * 0.15, y: height * 0.25, vx: 0.2, vy: -0.15, alpha: 0.35 },
      { text: "kVA", x: width * 0.82, y: height * 0.3, vx: -0.18, vy: 0.12, alpha: 0.4 },
      { text: "kVAh", x: width * 0.2, y: height * 0.7, vx: 0.15, vy: 0.1, alpha: 0.3 },
      { text: "kVArh", x: width * 0.75, y: height * 0.65, vx: -0.12, vy: -0.15, alpha: 0.35 },
      { text: "R/kWh", x: width * 0.3, y: height * 0.82, vx: 0.1, vy: -0.12, alpha: 0.28 },
      { text: "PEAK", x: width * 0.85, y: height * 0.45, vx: -0.15, vy: 0.18, alpha: 0.32 },
      { text: "STANDARD", x: width * 0.12, y: height * 0.5, vx: 0.14, vy: -0.1, alpha: 0.3 },
      { text: "OFF-PEAK", x: width * 0.68, y: height * 0.8, vx: -0.1, vy: -0.14, alpha: 0.25 },
      { text: "DEMAND", x: width * 0.35, y: height * 0.18, vx: 0.12, vy: 0.15, alpha: 0.3 },
      { text: "TARIFF", x: width * 0.62, y: height * 0.22, vx: -0.14, vy: 0.1, alpha: 0.35 },
      { text: "VAT", x: width * 0.48, y: height * 0.88, vx: 0.08, vy: -0.1, alpha: 0.28 },
    ];

    // Initialize particles
    const particleCount = reducedMotion ? 25 : width < 768 ? 45 : 90;
    const particles: Particle[] = [];
    const colors = ["#22d3ee", "#06b6d4", "#10b981", "#8b5cf6", "#e2e8f0"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.1,
        maxAlpha: Math.random() * 0.5 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        pulseSpeed: 0.015 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Electrical data streams converging towards center
    const streamCount = reducedMotion ? 3 : 8;
    const streams: StreamLine[] = [];
    const centerX = width / 2;
    const centerY = height * 0.42;

    for (let s = 0; s < streamCount; s++) {
      const angle = (s / streamCount) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.45;
      const startX = centerX + Math.cos(angle) * radius;
      const startY = centerY + Math.sin(angle) * radius;

      // Create zigzag bezier points towards center
      const points = [];
      const steps = 6;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const px = startX + (centerX - startX) * t + (Math.random() - 0.5) * 30;
        const py = startY + (centerY - startY) * t + (Math.random() - 0.5) * 30;
        points.push({ x: px, y: py });
      }

      streams.push({
        startX,
        startY,
        points,
        targetIndex: 0,
        speed: 0.02 + Math.random() * 0.015,
        color: s % 3 === 0 ? "#10b981" : s % 2 === 0 ? "#22d3ee" : "#8b5cf6",
        width: Math.random() * 1.5 + 0.8,
        glow: Math.random() * 10 + 5,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.016;
      // Gentle spring smoothing on mouse
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Clear with dark subtle fade
      ctx.fillStyle = "rgba(3, 7, 18, 0.25)";
      ctx.fillRect(0, 0, width, height);

      // 1. Draw subtle background coordinate grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 64;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw converging electrical data streams
      streams.forEach((stream, idx) => {
        ctx.save();
        ctx.strokeStyle = stream.color;
        ctx.lineWidth = stream.width;
        ctx.shadowColor = stream.color;
        ctx.shadowBlur = stream.glow;

        const pulseOffset = Math.sin(time * 3 + idx) * 0.3 + 0.7;
        ctx.globalAlpha = 0.25 * pulseOffset;

        ctx.beginPath();
        ctx.moveTo(stream.startX, stream.startY);

        // Curvature deflected by gentle mouse position
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        const bendX = (dx * 0.08 * (idx + 1)) / streamCount;
        const bendY = (dy * 0.08 * (idx + 1)) / streamCount;

        for (let p = 1; p < stream.points.length; p++) {
          const pt = stream.points[p];
          const prevPt = stream.points[p - 1];
          const midX = (prevPt.x + pt.x) / 2 + bendX;
          const midY = (prevPt.y + pt.y) / 2 + bendY;
          ctx.quadraticCurveTo(prevPt.x + bendX, prevPt.y + bendY, midX, midY);
        }
        ctx.stroke();

        // Traveling electrical packet along the stream
        const progress = (time * stream.speed * 4) % 1;
        const packetIdx = Math.floor(progress * (stream.points.length - 1));
        const currentPt = stream.points[packetIdx];
        const nextPt = stream.points[Math.min(packetIdx + 1, stream.points.length - 1)];
        if (currentPt && nextPt) {
          const subProgress = (progress * (stream.points.length - 1)) % 1;
          const px = currentPt.x + (nextPt.x - currentPt.x) * subProgress + bendX;
          const py = currentPt.y + (nextPt.y - currentPt.y) * subProgress + bendY;

          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = stream.color;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // 3. Draw and update particles
      particles.forEach((p) => {
        p.phase += p.pulseSpeed;
        const currentAlpha = p.alpha + Math.sin(p.phase) * (p.maxAlpha - p.alpha);

        // Subtle mouse repulsion
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140 && dist > 0) {
          const force = (140 - dist) / 140;
          p.x += (dx / dist) * force * 1.5;
          p.y += (dy / dist) * force * 1.5;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.05, Math.min(0.8, currentAlpha));
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 4. Draw floating engineering units
      ctx.save();
      ctx.font = "600 11px monospace";
      units.forEach((u) => {
        u.x += u.vx;
        u.y += u.vy;
        if (u.x < 20 || u.x > width - 40) u.vx *= -1;
        if (u.y < 40 || u.y > height - 40) u.vy *= -1;

        ctx.fillStyle = "#94a3b8";
        ctx.globalAlpha = u.alpha * (0.8 + Math.sin(time + u.x) * 0.2);
        ctx.fillText(u.text, u.x, u.y);
      });
      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [reducedMotion]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Background canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Atmospheric center glow */}
      <div className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[600px] h-[340px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[220px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

      {/* Dynamic Animated Logo Construction Overlay */}
      <div className="absolute top-[22%] sm:top-[24%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto">
        <div className="inline-flex flex-col items-center">
          {/* Energy brand emblem */}
          <div className="relative mb-2 px-6 py-2 rounded-2xl bg-[#0d1117]/60 border border-cyan-500/30 backdrop-blur-xl shadow-[0_0_40px_-5px_rgba(6,182,212,0.3)]">
            <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-[0.35em] text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]">
              {logoState}
            </span>
            <div className="absolute -bottom-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_#22d3ee]" />
          </div>

          <div className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.3em] text-cyan-400/90 font-medium">
            ENERGY FINANCIAL INTELLIGENCE
          </div>
        </div>

        {/* Narrative Signal reveal: "Every bill contains a signal." -> "ENERA finds it." */}
        <div className="h-8 mt-3 flex items-center justify-center">
          {taglineState === 1 && (
            <p className="text-xs sm:text-sm font-mono text-slate-400 tracking-wide animate-in fade-in duration-700">
              Every bill contains a signal.
            </p>
          )}
          {taglineState === 2 && (
            <p className="text-xs sm:text-sm font-mono text-cyan-300 font-semibold tracking-wide animate-in fade-in duration-700 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
              ENERA finds it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
