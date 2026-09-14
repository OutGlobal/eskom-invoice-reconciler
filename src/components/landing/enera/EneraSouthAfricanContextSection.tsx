import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Clock,
  Calendar,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

type SeasonType = "high" | "low";
type DayType = "weekday" | "saturday" | "sunday";

interface HourBlock {
  hour: number;
  period: "Peak" | "Standard" | "Off-Peak";
}

export function EneraSouthAfricanContextSection() {
  const [activeSeason, setActiveSeason] = useState<SeasonType>("high");
  const [activeDay, setActiveDay] = useState<DayType>("weekday");
  const [isPublicHoliday, setIsPublicHoliday] = useState<boolean>(false);

  // Generate 24-hour TOU block disaggregation based on South African Megaflex rules
  const schedule: HourBlock[] = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      // Public holidays and Sundays are ALWAYS 100% Off-Peak under NERSA Schedule 2
      if (isPublicHoliday || activeDay === "sunday") {
        return { hour: h, period: "Off-Peak" };
      }

      if (activeDay === "saturday") {
        // Saturdays: Standard 07:00 - 12:00, 18:00 - 20:00, rest Off-Peak
        if ((h >= 7 && h < 12) || (h >= 18 && h < 20)) {
          return { hour: h, period: "Standard" };
        }
        return { hour: h, period: "Off-Peak" };
      }

      // Weekdays
      if (activeSeason === "high") {
        // Winter Weekdays: Peak 06-09 & 17-19
        if ((h >= 6 && h < 9) || (h >= 17 && h < 19)) {
          return { hour: h, period: "Peak" };
        }
        // Off-Peak: 00-06 & 22-24
        if (h < 6 || h >= 22) {
          return { hour: h, period: "Off-Peak" };
        }
        return { hour: h, period: "Standard" };
      } else {
        // Summer Weekdays: Peak 07-10 & 18-20
        if ((h >= 7 && h < 10) || (h >= 18 && h < 20)) {
          return { hour: h, period: "Peak" };
        }
        // Off-Peak: 00-06 & 22-24
        if (h < 6 || h >= 22) {
          return { hour: h, period: "Off-Peak" };
        }
        return { hour: h, period: "Standard" };
      }
    });
  }, [activeSeason, activeDay, isPublicHoliday]);

  const peakHours = schedule.filter((s) => s.period === "Peak").length;
  const standardHours = schedule.filter((s) => s.period === "Standard").length;
  const offPeakHours = schedule.filter((s) => s.period === "Off-Peak").length;

  return (
    <section
      id="solutions"
      className="relative py-24 sm:py-32 bg-[#030712] text-white border-t border-white/10 overflow-hidden scroll-mt-12"
      aria-label="Enterprise Grid Solutions"
    >
      {/* Backwards-compatible anchors */}
      <div id="regulatory-grid" className="sr-only" aria-hidden="true" />
      <div id="ecosystem" className="sr-only" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. SMALL EYEBROW */}
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-3 font-semibold">
          SOLUTIONS
        </div>

        {/* 2. Large headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans max-w-3xl">
          Native to South Africa&rsquo;s grid. Built for enterprise rigor.
        </h2>

        {/* 3. Short explanation */}
        <p className="mt-4 text-base sm:text-lg text-slate-400 font-light leading-relaxed max-w-3xl mb-14">
          Deterministic modeling across Eskom Megaflex and municipal billing frameworks, matching statutory tariff gazettes with treasury-grade precision.
        </p>

        {/* 4. Visual or capability: Interactive 24-Hour TOU Determinant Engine Console */}
        <div className="rounded-2xl bg-[#090d16] border border-white/10 p-6 sm:p-8 space-y-6 shadow-xl">
          {/* Header of the Console */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-cyan-400">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white font-sans flex items-center gap-2">
                  <span>Time-of-Use (TOU) Determinant Schedule</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-300">
                    SAST (UTC+2)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Inspect how active kWh and reactive kVArh map across statutory temporal windows.
                </p>
              </div>
            </div>

            {/* Interactive Season Toggles */}
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Tariff Season">
              <button
                type="button"
                role="radio"
                aria-checked={activeSeason === "high"}
                onClick={() => setActiveSeason("high")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border focus-ring-enera ${
                  activeSeason === "high"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                    : "bg-[#0b101b] text-slate-400 border-white/5 hover:text-white"
                }`}
              >
                High Season (Winter)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={activeSeason === "low"}
                onClick={() => setActiveSeason("low")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border focus-ring-enera ${
                  activeSeason === "low"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold"
                    : "bg-[#0b101b] text-slate-400 border-white/5 hover:text-white"
                }`}
              >
                Low Season (Summer)
              </button>
            </div>
          </div>

          {/* Secondary Controls: Day Profile & Public Holiday Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-white/5 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400">Day Profile:</span>
              <button
                type="button"
                onClick={() => {
                  setActiveDay("weekday");
                  setIsPublicHoliday(false);
                }}
                className={`px-2.5 py-1 rounded-md text-xs transition-all focus-ring-enera ${
                  activeDay === "weekday" && !isPublicHoliday
                    ? "bg-white/15 text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Monday – Friday
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDay("saturday");
                  setIsPublicHoliday(false);
                }}
                className={`px-2.5 py-1 rounded-md text-xs transition-all focus-ring-enera ${
                  activeDay === "saturday" && !isPublicHoliday
                    ? "bg-white/15 text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Saturday
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveDay("sunday");
                  setIsPublicHoliday(false);
                }}
                className={`px-2.5 py-1 rounded-md text-xs transition-all focus-ring-enera ${
                  activeDay === "sunday" && !isPublicHoliday
                    ? "bg-white/15 text-white font-medium"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sunday
              </button>
            </div>

            {/* Public Holiday Exemption Switch */}
            <button
              type="button"
              aria-pressed={isPublicHoliday}
              onClick={() => setIsPublicHoliday(!isPublicHoliday)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all focus-ring-enera ${
                isPublicHoliday
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>
                Public Holidays Act 36 ({isPublicHoliday ? "Active: 100% Off-Peak" : "Standard"})
              </span>
            </button>
          </div>

          {/* 24-Hour Timeline Block Visualizer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>24-Hour Determinant Allocation</span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span className="text-white font-medium">Peak ({peakHours}h)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
                  <span className="text-white font-medium">Standard ({standardHours}h)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-700" />
                  <span className="text-slate-300">Off-Peak ({offPeakHours}h)</span>
                </span>
              </div>
            </div>

            {/* 24 Columns */}
            <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] min-w-[620px] gap-1 p-2 rounded-xl bg-black/40 border border-white/10">
                {schedule.map((block) => {
                  const isPeak = block.period === "Peak";
                  const isStandard = block.period === "Standard";

                  let bgClass = "bg-slate-800 text-slate-400";
                  if (isPeak) {
                    bgClass = "bg-rose-600 text-white font-semibold";
                  } else if (isStandard) {
                    bgClass = "bg-cyan-600 text-white font-semibold";
                  }

                  return (
                    <div
                      key={block.hour}
                      className={`h-12 rounded flex flex-col items-center justify-between p-1 transition-all ${bgClass}`}
                      title={`${String(block.hour).padStart(2, "0")}:00 – ${block.period}`}
                    >
                      <span className="text-[9px] font-mono leading-none">
                        {String(block.hour).padStart(2, "0")}
                      </span>
                      <span className="text-[8px] font-mono uppercase font-bold tracking-tighter">
                        {block.period === "Peak" ? "P" : block.period === "Standard" ? "S" : "OP"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1">
              <span>00:00 (Midnight)</span>
              <span>06:00 (Morning)</span>
              <span>12:00 (Noon)</span>
              <span>18:00 (Evening)</span>
              <span>23:00 (Night)</span>
            </div>
          </div>

          {/* 3 Core Discrepancy Scenarios */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-rose-400 font-semibold text-[10px] uppercase block">
                STATUTORY RULE
              </span>
              <div className="text-white font-medium">Public Holiday Exemption</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Mandatory off-peak tariff substitution on gazetted holidays under NERSA Schedule 2.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-cyan-400 font-semibold text-[10px] uppercase block">
                CAPACITY RATIO
              </span>
              <div className="text-white font-medium">Demand Ratchet Verification</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Separates true 30-min operational demand peaks from transient network disturbances.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1">
              <span className="text-emerald-400 font-semibold text-[10px] uppercase block">
                POWER FACTOR CODE
              </span>
              <div className="text-white font-medium">kVArh Vector Auditing</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Validates reactive draw exclusively during billable Peak/Standard High-Season hours.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Optional supporting information & 6. Optional CTA */}
        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <span>Engineered for Commercial &amp; Industrial, Mining Operations, and Municipal Distributors.</span>
          <a
            href="#contact"
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium transition-colors focus-ring-enera shrink-0"
          >
            <span>Explore sector solutions</span>
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      </div>
    </section>
  );
}

