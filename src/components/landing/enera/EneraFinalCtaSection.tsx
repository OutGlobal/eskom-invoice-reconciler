import React, { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Building2,
  Send,
  Lock,
  FileCheck2,
  Calendar,
  Layers,
  ChevronRight,
  Globe2,
} from "lucide-react";

interface NetworkNode {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  label?: string;
}

interface PulsePacket {
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
  color: string;
}

export function EneraFinalCtaSection() {
  const [demoRequested, setDemoRequested] = useState(false);
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [monthlySpend, setMonthlySpend] = useState("R 1M – R 5M");
  const [reducedMotion, setReducedMotion] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false });

  // Handle prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  // Subtle Animated Energy Network Canvas echoing opening hero
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = false;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible;
        isVisible = entry.isIntersecting;
        if (!wasVisible && isVisible) {
          animationFrameId = requestAnimationFrame(render);
        } else if (wasVisible && !isVisible) {
          cancelAnimationFrame(animationFrameId);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(canvas);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", handleResize, { passive: true });

    // Generate constellation of energy network nodes echoing Hero telemetry (Scaled for mobile)
    const nodeCount = width < 430 ? 12 : width < 768 ? 16 : Math.min(32, Math.max(18, Math.floor(width / 45)));
    const nodes: NetworkNode[] = [];
    const colors = ["#06b6d4", "#22d3ee", "#10b981", "#8b5cf6"];
    const labels = ["MTR-01", "GRID-α", "SUB-04", "FEED-02", "TX-07", "AMR-99", "RECON-01", "SYNC-β"];

    for (let i = 0; i < nodeCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 2 + 1.5,
        color: colors[i % colors.length],
        alpha: Math.random() * 0.4 + 0.3,
        label: i < labels.length ? labels[i] : undefined,
      });
    }

    // Traveling photon packets pulsing through the network
    const pulses: PulsePacket[] = [];
    const spawnPulse = () => {
      if (nodes.length < 2) return;
      const from = Math.floor(Math.random() * nodes.length);
      // Find a nearby node
      let closest = -1;
      let minDist = 220;
      for (let j = 0; j < nodes.length; j++) {
        if (j === from) continue;
        const dx = nodes[from].x - nodes[j].x;
        const dy = nodes[from].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closest = j;
        }
      }
      if (closest !== -1) {
        pulses.push({
          fromNode: from,
          toNode: closest,
          progress: 0,
          speed: Math.random() * 0.015 + 0.008,
          color: nodes[from].color,
        });
      }
    };

    let lastPulseTime = 0;
    const maxConnectionDistance = 180;

    const render = (time: number) => {
      if (!isVisible) return;
      ctx.clearRect(0, 0, width, height);

      // Subtle background radial gradient
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        50,
        width / 2,
        height / 2,
        Math.max(width, height) / 1.5
      );
      gradient.addColorStop(0, "rgba(6, 182, 212, 0.04)");
      gradient.addColorStop(0.5, "rgba(16, 185, 129, 0.02)");
      gradient.addColorStop(1, "rgba(3, 7, 18, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Update and draw network conduits
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];

        if (!reducedMotion) {
          n1.x += n1.vx;
          n1.y += n1.vy;

          if (n1.x < 20 || n1.x > width - 20) n1.vx *= -1;
          if (n1.y < 20 || n1.y > height - 20) n1.vy *= -1;

          // Mouse gentle attraction/repulsion
          if (mouseRef.current.active) {
            const mdx = mouseRef.current.x - n1.x;
            const mdy = mouseRef.current.y - n1.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 140 && mdist > 0) {
              const force = (140 - mdist) / 140;
              n1.x -= (mdx / mdist) * force * 1.2;
              n1.y -= (mdy / mdist) * force * 1.2;
            }
          }
        }

        // Draw connections to nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxConnectionDistance) {
            const lineAlpha = (1 - dist / maxConnectionDistance) * 0.22;
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${lineAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Spawn and update photon pulses
      if (!reducedMotion) {
        if (time - lastPulseTime > 350 && pulses.length < 16) {
          spawnPulse();
          lastPulseTime = time;
        }

        for (let p = pulses.length - 1; p >= 0; p--) {
          const pulse = pulses[p];
          pulse.progress += pulse.speed;

          if (pulse.progress >= 1) {
            pulses.splice(p, 1);
            continue;
          }

          const from = nodes[pulse.fromNode];
          const to = nodes[pulse.toNode];
          if (!from || !to) continue;

          const px = from.x + (to.x - from.x) * pulse.progress;
          const py = from.y + (to.y - from.y) * pulse.progress;

          // Glowing photon bead
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = pulse.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Soft outer halo
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 182, 212, ${node.alpha * 0.15})`;
        ctx.fill();

        // Node core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Monospace telemetry tag if present
        if (node.label && width > 768) {
          ctx.font = "9px monospace";
          ctx.fillStyle = "rgba(148, 163, 184, 0.45)";
          ctx.fillText(node.label, node.x + 8, node.y + 3);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [reducedMotion]);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current.active = false;
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setDemoRequested(true);
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative py-32 sm:py-40 bg-[#030712] text-white overflow-hidden border-t border-white/5"
      aria-label="Final Cinematic Call to Action"
    >
      {/* Background Animated Energy Network Canvas echoing Opening Hero */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Atmospheric Central Glow Layers */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[550px] md:w-[750px] h-[240px] sm:h-[350px] md:h-[450px] rounded-full bg-cyan-500/10 blur-[50px] md:blur-[160px] pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] sm:w-[400px] md:w-[550px] h-[180px] sm:h-[280px] md:h-[350px] rounded-full bg-emerald-500/10 blur-[40px] md:blur-[130px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Subtle Micro-Grid Overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[10px] sm:text-xs font-mono mb-6 sm:mb-8 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <Zap className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
          <span className="tracking-wide">STAGE 16 // ENERGY FINANCIAL INTELLIGENCE</span>
        </div>

        {/* Core Headline matching exact prompt */}
        <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight enera-text-gradient leading-tight">
          YOUR NEXT BILL
          <br />
          SHOULDN&apos;T BE A SURPRISE.
        </h2>

        {/* Supporting Text matching exact prompt */}
        <p className="mt-4 sm:mt-6 text-base sm:text-xl md:text-2xl lg:text-3xl text-slate-300 font-light max-w-2xl mx-auto leading-relaxed">
          &ldquo;Let intelligence check it before you pay it.&rdquo;
        </p>

        {/* Primary and Secondary Action CTAs */}
        <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-lg mx-auto">
          {/* Primary CTA: Analyse Your Energy → */}
          <Link
            to="/upload"
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 min-h-[48px] px-8 py-3.5 sm:py-4.5 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-cyan-400 via-cyan-300 to-emerald-300 shadow-[0_0_40px_rgba(6,182,212,0.45)] hover:brightness-110 active:scale-[0.98] transition-all overflow-hidden font-mono"
          >
            <span>Analyse Your Energy</span>
            <div className="relative flex items-center justify-center">
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              <span className="absolute -left-1 w-2 h-2 rounded-full bg-white/60 blur-[1px] group-hover:animate-ping" />
            </div>
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="w-1/2 h-full bg-white/25 skew-x-12 animate-enera-pulse" />
            </div>
          </Link>

          {/* Secondary CTA: Request a Demo → */}
          <button
            type="button"
            onClick={() => {
              setShowDemoForm(true);
              const formElement = document.getElementById("demo-request-box");
              formElement?.scrollIntoView({ behavior: "smooth" });
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4.5 rounded-2xl font-semibold text-sm text-slate-200 hover:text-white border border-white/10 hover:border-cyan-400/40 bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md transition-all font-mono group shadow-lg"
          >
            <Calendar className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Request a Demo</span>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>

        {/* Interactive Architecture Briefing / Demo Booking Module */}
        <div id="demo-request-box" className="mt-14 max-w-xl mx-auto">
          {!demoRequested ? (
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0d1117]/90 border border-cyan-500/25 backdrop-blur-xl shadow-[0_0_60px_-15px_rgba(6,182,212,0.2)] text-left">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase text-cyan-300 font-bold tracking-wider">
                    EXECUTIVE DEMO &amp; PORTFOLIO AUDIT BRIEFING
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">2-HR RESPONSE SLA</span>
              </div>

              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cfo@enterprise.co.za"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                      Company / Facility
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Rand Mining Corp"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
                      Monthly Electricity Spend
                    </label>
                    <select
                      value={monthlySpend}
                      onChange={(e) => setMonthlySpend(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value="R 500K – R 1M">R 500K – R 1M / mo</option>
                      <option value="R 1M – R 5M">R 1M – R 5M / mo</option>
                      <option value="R 5M – R 15M">R 5M – R 15M / mo</option>
                      <option value="R 15M+">R 15M+ / mo (Mining / Heavy)</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2 group"
                >
                  <span>SCHEDULE EXECUTIVE DEMONSTRATION</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </form>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-center gap-3 text-xs font-mono text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.25)] animate-in fade-in">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="font-bold text-white text-sm">Demo Request Confirmed</div>
                <div className="text-slate-300 mt-0.5">
                  An ENERA Energy Financial Engineer will connect with <strong className="text-emerald-300">{email}</strong> within 2 business hours.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Institutional Trust Badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-mono text-slate-400 border-t border-white/5 pt-8">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            <span>Zero software installation</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-cyan-400" />
            <span>All Eskom &amp; Municipal Tariffs</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-cyan-400" />
            <span>POPIA &amp; ISO 27001 Cryptographic Enclave</span>
          </div>
        </div>
      </div>
    </section>
  );
}
