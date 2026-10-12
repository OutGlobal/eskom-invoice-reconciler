import React, { useEffect, useState } from "react";

export interface EneraBrandLoaderProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function EneraBrandLoader({ onComplete, forceShow = false }: EneraBrandLoaderProps) {
  const [phase, setPhase] = useState<"loading" | "complete" | "exited">("loading");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("INITIALIZING DETERMINISTIC ENGINE...");

  useEffect(() => {
    // Check session storage so internal page transitions do not repeatedly block
    if (typeof window !== "undefined" && !forceShow) {
      const alreadyShown = sessionStorage.getItem("enera_intro_loaded");
      if (alreadyShown) {
        setPhase("exited");
        if (onComplete) onComplete();
        return;
      }
    }

    const startTime = Date.now();
    const duration = 1600; // 1.6 seconds optimal cinematic pace

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      if (pct < 30) {
        setStatusText("INITIALIZING DETERMINISTIC ENGINE...");
      } else if (pct < 65) {
        setStatusText("CALIBRATING TARIFF & AMR MATRICES...");
      } else if (pct < 95) {
        setStatusText("SYNCHRONIZING ZERO-EXPOSURE VAULT...");
      } else {
        setStatusText("ENERA AI · SYSTEM ONLINE");
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        setPhase("complete");
        if (typeof window !== "undefined") {
          sessionStorage.setItem("enera_intro_loaded", "true");
        }

        // Allow 400ms for the "complete" glow, then dissolve
        setTimeout(() => {
          setPhase("exited");
          if (onComplete) onComplete();
        }, 450);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [forceShow, onComplete]);

  const handleSkip = () => {
    setPhase("exited");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("enera_intro_loaded", "true");
    }
    if (onComplete) onComplete();
  };

  if (phase === "exited") {
    return null;
  }

  const isFadingOut = phase === "complete";

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#030712] cursor-pointer select-none transition-all duration-700 ease-out ${
        isFadingOut
          ? "opacity-0 scale-105 blur-[3px] pointer-events-none"
          : "opacity-100 scale-100 blur-0"
      }`}
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 45%, rgba(6, 182, 212, 0.16) 0%, rgba(16, 185, 129, 0.08) 35%, transparent 70%),
          radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 32px 32px",
      }}
      aria-live="polite"
      aria-label="ENERA AI Loading"
    >
      {/* Subtle ambient animated flux grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-r from-cyan-500/20 via-emerald-500/15 to-blue-500/20 rounded-full blur-[90px] animate-pulse" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center">
        {/* Glowing Logo Mark & Wordmark */}
        <div className="relative group mb-8 flex items-center justify-center">
          {/* Neon energy halo */}
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-2xl opacity-30 blur-xl animate-pulse" />

          {/* Official ENERA AI Brand Logo with dynamic sheen */}
          <div className="relative flex items-center justify-center overflow-hidden rounded-xl p-3 bg-black/40 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_35px_rgba(6,182,212,0.35)]">
            <img
              src="/images/enera-ai-logo.png"
              alt="ENERA AI"
              className="h-14 sm:h-16 w-auto object-contain filter drop-shadow-[0_0_16px_rgba(6,182,212,0.55)] transition-transform duration-500 hover:scale-105"
              draggable={false}
            />

            {/* Futuristic light beam sweep over the logo */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Subtitle with expanding letter tracking */}
        <div className="text-[11px] sm:text-xs font-mono font-semibold tracking-[0.32em] text-slate-300 uppercase mb-6 drop-shadow-sm flex items-center gap-2">
          <span>Energy Financial Intelligence</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        </div>

        {/* Progress Bar Container */}
        <div className="w-64 sm:w-80 flex flex-col gap-2">
          <div className="h-1.5 w-full bg-slate-900/90 rounded-full overflow-hidden border border-cyan-500/30 p-[1px] shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 rounded-full transition-all duration-75 ease-out shadow-[0_0_12px_rgba(6,182,212,0.8)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Telemetry Status Line */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
            <span className="text-cyan-400/90 font-medium truncate max-w-[200px]">
              {statusText}
            </span>
            <span className="text-slate-300 font-bold tabular-nums">{progress}%</span>
          </div>
        </div>

        {/* Subtle skip affordance */}
        <div className="mt-12 text-[10px] font-mono text-slate-400 hover:text-slate-300 transition-colors tracking-wider">
          CLICK ANYWHERE TO ENTER ↵
        </div>
      </div>
    </div>
  );
}
