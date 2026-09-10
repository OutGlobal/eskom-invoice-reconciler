import React, { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Zap,
  Globe2,
  Building2,
  Cpu,
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Layers,
  ArrowRight,
  Sliders,
  Sparkles,
  Info,
} from "lucide-react";

// Time-of-Use Schedule Definition for South African High vs Low Season
// High Season (Winter: June - August)
// Weekdays:
//   Off-Peak: 00:00 - 06:00, 22:00 - 24:00 (8h)
//   Standard: 09:00 - 17:00, 19:00 - 22:00 (11h)
//   Peak:     06:00 - 09:00, 17:00 - 19:00 (5h)
// Low Season (Summer: September - May)
// Weekdays:
//   Off-Peak: 00:00 - 06:00, 22:00 - 24:00 (8h)
//   Standard: 06:00 - 07:00, 10:00 - 18:00, 20:00 - 22:00 (11h)
//   Peak:     07:00 - 10:00, 18:00 - 20:00 (5h)

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
  const [activeTab, setActiveTab] = useState<"tariffs" | "amr" | "vectors">("tariffs");

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
      id="ecosystem"
      className="relative py-28 sm:py-36 bg-[#030712] text-white overflow-hidden border-t border-white/5"
      aria-label="South African Energy Intelligence Context"
    >
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/3 right-1/4 w-[750px] h-[500px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none -z-10"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 left-10 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-xs font-mono mb-5 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <Globe2 className="h-3.5 w-3.5 text-cyan-400" />
            <span className="tracking-wide">STAGE 14 // SOUTH AFRICAN ENERGY CONTEXT</span>
          </div>

          <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight enera-text-gradient leading-tight">
            NATIVE TO SOUTH AFRICA&rsquo;S GRID.
            <br />
            ENGINEERED TO GLOBAL STANDARDS.
          </h2>

          <p className="mt-5 text-base sm:text-lg text-slate-400 font-light leading-relaxed">
            South Africa&rsquo;s power economics are uniquely demanding. ENERA speaks fluent
            Eskom, Megaflex, and Municipal billing — pairing localized regulatory depth with
            institutional Silicon Valley financial algorithms.
          </p>

          {/* Independence & International Positioning Badge */}
          <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>INDEPENDENT PRIVATE INTELLIGENCE PLATFORM · ZERO STATE OR UTILITY AFFILIATION</span>
          </div>
        </div>

        {/* 4 Pillars of South African Energy Financial Intelligence */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {/* Pillar 1: Eskom & Megaflex */}
          <div className="rounded-3xl p-6 sm:p-7 bg-[#0d1117] border border-white/10 hover:border-cyan-500/40 transition-all group flex flex-col justify-between shadow-xl">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-transform">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                BULK TRANSMISSION TARIFFS
              </span>
              <h3 className="text-lg font-bold text-white font-mono mt-1">
                Eskom &amp; Megaflex
              </h3>
              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                Full-spectrum modeling of high-voltage transmission supply: High/Low season TOU multipliers,
                voltage classifications (&gt;66kV to &lt;500V), transmission loss factors, and Notified Maximum Demand (NMD) rules.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>NERSA Schedule 2</span>
              <span className="text-cyan-400 font-semibold">Auto-Versioned</span>
            </div>
          </div>

          {/* Pillar 2: Municipal Billing */}
          <div className="rounded-3xl p-6 sm:p-7 bg-[#0d1117] border border-white/10 hover:border-emerald-500/40 transition-all group flex flex-col justify-between shadow-xl">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                MULTI-METRO INTEGRATION
              </span>
              <h3 className="text-lg font-bold text-white font-mono mt-1">
                Municipal Billing
              </h3>
              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                Seamless reconciliation across City Power (JHB), eThekwini, City of Cape Town, Ekurhuleni,
                and Tshwane. Manages municipal wheeling credits and the pro-rata split between Eskom&rsquo;s April 1 and Municipal July 1 fiscal tariff cycles.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Dual Fiscal Calendars</span>
              <span className="text-emerald-400 font-semibold">April &amp; July Sync</span>
            </div>
          </div>

          {/* Pillar 3: AMR Telemetry */}
          <div className="rounded-3xl p-6 sm:p-7 bg-[#0d1117] border border-white/10 hover:border-cyan-500/40 transition-all group flex flex-col justify-between shadow-xl">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-transform">
                <Activity className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                INTERVAL TELEMETRY
              </span>
              <h3 className="text-lg font-bold text-white font-mono mt-1">
                AMR Ground Truth
              </h3>
              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                Automated Meter Reading (AMR) streaming at 30-minute intervals (48 readings/day, 1,488/month).
                Correlates Class 0.2S optical and GSM data-logger pulses with CT/VT multiplier verification.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>SANS 474 / NRS 057</span>
              <span className="text-cyan-400 font-semibold">30-Min Resolution</span>
            </div>
          </div>

          {/* Pillar 4: Vector Units: kWh · kVA · kVArh */}
          <div className="rounded-3xl p-6 sm:p-7 bg-[#0d1117] border border-white/10 hover:border-amber-500/40 transition-all group flex flex-col justify-between shadow-xl">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition-transform">
                <Cpu className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                TRILATERAL DETERMINANTS
              </span>
              <h3 className="text-lg font-bold text-white font-mono mt-1">
                kWh · kVA · kVArh
              </h3>
              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                Vector disaggregation of active energy (<strong className="text-white">kWh</strong>),
                maximum demand (<strong className="text-white">kVA</strong>), and reactive power
                (<strong className="text-white">kVArh</strong>) under the 0.96 lagging power factor threshold during Peak &amp; Standard periods.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Vector Math PF = kW/kVA</span>
              <span className="text-amber-400 font-semibold">Decimal.js Exact</span>
            </div>
          </div>
        </div>

        {/* Interactive TOU (Time-of-Use) Matrix Engine Console */}
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-b from-[#0d1117] to-[#070b12] border border-cyan-500/30 p-6 sm:p-10 shadow-[0_0_80px_-20px_rgba(6,182,212,0.2)]">
          {/* Header of the Console */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white font-mono flex items-center gap-2">
                  <span>TIME-OF-USE (TOU) DETERMINANT ENGINE</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                    SAST (UTC+2)
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Inspect how active kWh and reactive kVArh map across Peak, Standard, and Off-Peak temporal buckets.
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
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all focus-ring-enera ${
                  activeSeason === "high"
                    ? "bg-amber-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                    : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                }`}
              >
                HIGH SEASON (WINTER)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={activeSeason === "low"}
                onClick={() => setActiveSeason("low")}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all focus-ring-enera ${
                  activeSeason === "low"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                    : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                }`}
              >
                LOW SEASON (SUMMER)
              </button>
            </div>
          </div>

          {/* Secondary Controls: Day Type and Public Holiday Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-white/5 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="radiogroup" aria-label="Day Profile">
              <span className="text-slate-400">DAY PROFILE:</span>
              <button
                type="button"
                role="radio"
                aria-checked={activeDay === "weekday" && !isPublicHoliday}
                onClick={() => {
                  setActiveDay("weekday");
                  setIsPublicHoliday(false);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all focus-ring-enera ${
                  activeDay === "weekday" && !isPublicHoliday
                    ? "bg-white/15 text-white font-bold border border-white/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Monday – Friday
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={activeDay === "saturday" && !isPublicHoliday}
                onClick={() => {
                  setActiveDay("saturday");
                  setIsPublicHoliday(false);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all focus-ring-enera ${
                  activeDay === "saturday" && !isPublicHoliday
                    ? "bg-white/15 text-white font-bold border border-white/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Saturday
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={activeDay === "sunday" && !isPublicHoliday}
                onClick={() => {
                  setActiveDay("sunday");
                  setIsPublicHoliday(false);
                }}
                className={`px-2.5 py-1 rounded-lg transition-all focus-ring-enera ${
                  activeDay === "sunday" && !isPublicHoliday
                    ? "bg-white/15 text-white font-bold border border-white/20"
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all focus-ring-enera ${
                isPublicHoliday
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)] font-semibold"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>PUBLIC HOLIDAY ACT 36 RULE ({isPublicHoliday ? "ACTIVE: 100% OFF-PEAK" : "DISABLED"})</span>
            </button>
          </div>

          {/* 24-Hour Timeline Block Visualizer */}
          <div
            role="region"
            aria-label="24-hour Time-of-Use schedule visualizer"
            aria-live="polite"
            className="mt-8 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>24-HOUR TIME-OF-USE ALLOCATION (SAST)</span>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" aria-hidden="true" />
                  <span className="text-white font-bold">Peak ({peakHours}h)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]" aria-hidden="true" />
                  <span className="text-white font-bold">Standard ({standardHours}h)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-slate-600" aria-hidden="true" />
                  <span className="text-slate-300">Off-Peak ({offPeakHours}h)</span>
                </span>
              </div>
            </div>

            {/* 24 Grid Columns representing hours 00:00 - 23:00 */}
            <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] min-w-[640px] gap-1 p-2 rounded-2xl bg-black/60 border border-white/10">
                {schedule.map((block) => {
                  const isPeak = block.period === "Peak";
                  const isStandard = block.period === "Standard";

                let bgClass = "bg-slate-800 text-slate-400 hover:bg-slate-700";
                if (isPeak) {
                  bgClass =
                    "bg-gradient-to-t from-rose-600 to-rose-400 text-slate-950 font-black shadow-[0_0_12px_rgba(244,63,94,0.5)]";
                } else if (isStandard) {
                  bgClass =
                    "bg-gradient-to-t from-cyan-600 to-cyan-400 text-slate-950 font-black shadow-[0_0_12px_rgba(6,182,212,0.4)]";
                }

                return (
                  <div
                    key={block.hour}
                    className={`h-14 rounded-lg flex flex-col items-center justify-between p-1 transition-all ${bgClass}`}
                    title={`${String(block.hour).padStart(2, "0")}:00 – ${block.period}`}
                    aria-label={`${String(block.hour).padStart(2, "0")}:00 to ${String((block.hour + 1) % 24).padStart(2, "0")}:00: ${block.period}`}
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
            <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1" aria-hidden="true">
              <span>00:00 (Midnight)</span>
              <span>06:00 (Morning)</span>
              <span>12:00 (Noon)</span>
              <span>18:00 (Evening)</span>
              <span>23:00 (Night)</span>
            </div>
          </div>

          {/* Real South African Billing Discrepancy Case Studies */}
          <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <span className="text-rose-400 font-bold text-[10px] block uppercase">
                CRITICAL RECONCILIATION RISK
              </span>
              <div className="text-white font-bold">Public Holiday Peak Misbilling</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                When Human Rights Day or Youth Day falls on a weekday, Eskom billing systems occasionally apply weekday Peak rates instead of mandatory Sunday Off-Peak tariffs.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <span className="text-cyan-400 font-bold text-[10px] block uppercase">
                DEMAND METRIC ACCURACY
              </span>
              <div className="text-white font-bold">kVA Maximum Demand Ratchets</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                30-minute AMR interval telemetry validates whether registered peak kVA was an unnotified transmission spike or a legitimate operational peak under Megaflex rules.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
              <span className="text-emerald-400 font-bold text-[10px] block uppercase">
                REACTIVE PENALTY COMPENSATION
              </span>
              <div className="text-white font-bold">kVArh Vector Auditing</div>
              <p className="text-slate-400 text-[11px] font-sans leading-relaxed">
                Lagging power factor surcharges are restricted exclusively to Peak &amp; Standard periods during High Season. Off-Peak reactive energy is non-billable by law.
              </p>
            </div>
          </div>

          {/* Action Gateway */}
          <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-400 font-sans">
              Compatible with all 2024/2025 NERSA gazetted rate schedules for Eskom Direct &amp; Municipal Distributors.
            </div>

            <Link
              to="/reconciliation"
              className="py-2.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all group focus-ring-enera"
            >
              <span>EXPLORE LIVE RECONCILIATION COCKPIT</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
