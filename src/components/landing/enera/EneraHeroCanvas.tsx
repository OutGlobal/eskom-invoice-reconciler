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
  speed: number;
  color: string;
  width: number;
  glow: number;
}

interface FloatingDataUnit {
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

export function EneraHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cinematic Choreography Phases:
  // Phase 0: Near darkness (0-1.2s)
  // Phase 1: Energy particles ignite (1.2s - 2.8s)
  // Phase 2: Flowing luminous data streams enter toward center (2.8s - 4.5s)
  // Phase 3: Streams construct E -> EN -> ENE -> ENER -> ENERA (4.5s - 10s)
  // Phase 4: Energy transitions into data (floating units appear)
  // Phase 5: "Every bill contains a signal." -> Pause -> "ENERA finds it."
  const [logoState, setLogoState] = useState<string>("E");
  const [taglineStage, setTaglineStage] = useState<number>(0); // 0: hidden, 1: "Every bill contains a signal.", 2: "ENERA finds it."
  const [choreographyPhase, setChoreographyPhase] = useState<number>(1);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // Logo construction sequence: E -> EN -> ENE -> ENER -> ENERA
  useEffect(() => {
    const letters = ["E", "E N", "E N E", "E N E R", "E N E R A"];
    let step = 0;

    const interval = setInterval(() => {
      step = (step + 1) % (letters.length + 4); // Pause 4 ticks on full ENERA
      if (step < letters.length) {
        setLogoState(letters[step]);
      } else {
        setLogoState("E N E R A");
      }
    }, 1300);

    return () => clearInterval(interval);
  }, []);

  // Tagline reveal cycle: "Every bill contains a signal." -> Pause -> "ENERA finds it."
  useEffect(() => {
    let state = 1;
    const tagTimer = setInterval(() => {
      state = (state + 1) % 3;
      setTaglineStage(state);
    }, 3800);

    return () => clearInterval(tagTimer);
  }, []);

  // Reduced motion detection
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

    // Mouse coordinates for gentle deflection
    let mouseX = width / 2;
    let mouseY = height * 0.4;
    let targetMouseX = width / 2;
    let targetMouseY = height * 0.4;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Floating Engineering Units (All 11 required: kWh, kVA, kVAh, kVArh, R/kWh, PEAK, STANDARD, OFF-PEAK, DEMAND, TARIFF, VAT)
    const dataUnits: FloatingDataUnit[] = [
      { text: "kWh", x: width * 0.16, y: height * 0.22, vx: 0.16, vy: -0.12, alpha: 0.45, color: "#22d3ee" },
      { text: "kVA", x: width * 0.82, y: height * 0.26, vx: -0.14, vy: 0.15, alpha: 0.5, color: "#10b981" },
      { text: "kVAh", x: width * 0.12, y: height * 0.65, vx: 0.12, vy: 0.14, alpha: 0.35, color: "#8b5cf6" },
      { text: "kVArh", x: width * 0.86, y: height * 0.62, vx: -0.15, vy: -0.12, alpha: 0.4, color: "#22d3ee" },
      { text: "R/kWh", x: width * 0.26, y: height * 0.82, vx: 0.11, vy: -0.14, alpha: 0.38, color: "#10b981" },
      { text: "PEAK", x: width * 0.76, y: height * 0.42, vx: -0.12, vy: 0.16, alpha: 0.42, color: "#f43f5e" },
      { text: "STANDARD", x: width * 0.18, y: height * 0.44, vx: 0.15, vy: -0.1, alpha: 0.38, color: "#38bdf8" },
      { text: "OFF-PEAK", x: width * 0.68, y: height * 0.84, vx: -0.13, vy: -0.12, alpha: 0.35, color: "#10b981" },
      { text: "DEMAND", x: width * 0.34, y: height * 0.16, vx: 0.14, vy: 0.12, alpha: 0.4, color: "#22d3ee" },
      { text: "TARIFF", x: width * 0.64, y: height * 0.18, vx: -0.15, vy: 0.11, alpha: 0.45, color: "#8b5cf6" },
      { text: "VAT", x: width * 0.52, y: height * 0.86, vx: 0.08, vy: -0.13, alpha: 0.35, color: "#94a3b8" },
    ];

    // Particle pool
    const particleCount = reducedMotion ? 20 : width < 768 ? 40 : 85;
    const particles: Particle[] = [];
    const colors = ["#22d3ee", "#06b6d4", "#10b981", "#8b5cf6", "#e2e8f0"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.4 + 0.1,
        maxAlpha: Math.random() * 0.5 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        pulseSpeed: 0.015 + Math.random() * 0.02,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Luminous Electrical Data Streams converging toward the centre
    const streamCount = reducedMotion ? 4 : 8;
    const streams: StreamLine[] = [];
    const centerX = width / 2;
    const centerY = height * 0.38;

    for (let s = 0; s < streamCount; s++) {
      const angle = (s / streamCount) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.48;
      const startX = centerX + Math.cos(angle) * radius;
      const startY = centerY + Math.sin(angle) * radius;

      const points = [];
      const steps = 7;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const px = startX + (centerX - startX) * t + (Math.random() - 0.5) * 35;
        const py = startY + (centerY - startY) * t + (Math.random() - 0.5) * 35;
        points.push({ x: px, y: py });
      }

      streams.push({
        startX,
        startY,
        points,
        speed: 0.02 + Math.random() * 0.018,
        color: s % 3 === 0 ? "#10b981" : s % 2 === 0 ? "#22d3ee" : "#8b5cf6",
        width: Math.random() * 1.5 + 0.8,
        glow: Math.random() * 12 + 6,
      });
    }

    let time = 0;

    const render = () => {
      time += 0.016;
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // Deep graphite clear
      ctx.fillStyle = "rgba(3, 7, 18, 0.28)";
      ctx.fillRect(0, 0, width, height);

      // 1. Subtle Background Grid
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

      // 2. Converging Luminous Streams (Digital Electricity)
      streams.forEach((stream, idx) => {
        ctx.save();
        ctx.strokeStyle = stream.color;
        ctx.lineWidth = stream.width;
        ctx.shadowColor = stream.color;
        ctx.shadowBlur = stream.glow;

        const pulseOffset = Math.sin(time * 3 + idx) * 0.35 + 0.65;
        ctx.globalAlpha = 0.3 * pulseOffset;

        ctx.beginPath();
        ctx.moveTo(stream.startX, stream.startY);

        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        const bendX = (dx * 0.07 * (idx + 1)) / streamCount;
        const bendY = (dy * 0.07 * (idx + 1)) / streamCount;

        for (let p = 1; p < stream.points.length; p++) {
          const pt = stream.points[p];
          const prevPt = stream.points[p - 1];
          const midX = (prevPt.x + pt.x) / 2 + bendX;
          const midY = (prevPt.y + pt.y) / 2 + bendY;
          ctx.quadraticCurveTo(prevPt.x + bendX, prevPt.y + bendY, midX, midY);
        }
        ctx.stroke();

        // High-velocity digital data packet traveling along the electrical stream
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
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      // 3. Ambient Floating Energy Particles
      particles.forEach((p) => {
        p.phase += p.pulseSpeed;
        const currentAlpha = p.alpha + Math.sin(p.phase) * (p.maxAlpha - p.alpha);

        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130 && dist > 0) {
          const force = (130 - dist) / 130;
          p.x += (dx / dist) * force * 1.5;
          p.y += (dy / dist) * force * 1.5;
        }

        p.x += p.vx;
        p.y += p.vy;

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

      // 4. Floating Engineering Data Values (Transition from Energy to Data)
      ctx.save();
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

      dataUnits.forEach((u) => {
        u.x += u.vx;
        u.y += u.vy;

        if (u.x < 20 || u.x > width - 50) u.vx *= -1;
        if (u.y < 40 || u.y > height - 40) u.vy *= -1;

        ctx.fillStyle = u.color;
        ctx.globalAlpha = u.alpha * (0.8 + Math.sin(time * 2 + u.x) * 0.2);
        ctx.shadowColor = u.color;
        ctx.shadowBlur = 10;
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
      {/* 1. Cinematic Background Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* 2. Atmospheric Core Glow */}
      <div className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] sm:w-[650px] h-[350px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[240px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

      {/* 3. The Living ENERA Energy Logo Construction (E -> EN -> ENE -> ENER -> ENERA) */}
      <div className="absolute top-[22%] sm:top-[24%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-auto">
        <div className="inline-flex flex-col items-center">
          <div className="relative mb-2 px-6 sm:px-8 py-2.5 rounded-2xl bg-[#0d1117]/80 border border-cyan-500/30 backdrop-blur-xl shadow-[0_0_45px_-5px_rgba(6,182,212,0.35)]">
            <span className="font-mono text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-[0.35em] text-white drop-shadow-[0_0_25px_rgba(34,211,238,0.7)]">
              {logoState}
            </span>
            {/* Luminous energy baseline */}
            <div className="absolute -bottom-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee]" />
          </div>

          <div className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.3em] text-cyan-400/90 font-medium">
            ENERGY FINANCIAL INTELLIGENCE
          </div>
        </div>

        {/* 4. Sequential Signal Reveal: "Every bill contains a signal." -> Pause -> "ENERA finds it." */}
        <div className="h-8 mt-3 flex items-center justify-center">
          {taglineStage === 1 && (
            <p className="text-xs sm:text-sm font-mono text-slate-400 tracking-wide animate-in fade-in duration-700">
              Every bill contains a signal.
            </p>
          )}
          {taglineStage === 2 && (
            <p className="text-xs sm:text-sm font-mono text-cyan-300 font-semibold tracking-wide animate-in fade-in duration-700 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">
              ENERA finds it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
