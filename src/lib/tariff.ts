export type TouPeriod = "peak" | "standard" | "offPeak";
export type Season = "high" | "low";

/** Helper to convert any Date object to South Africa Standard Time (UTC+2) components */
export function getSastComponents(d: Date): {
  year: number;
  month: number;
  day: number;
  dow: number;
  hours: number;
} {
  const sastMs = d.getTime() + 2 * 60 * 60 * 1000;
  const sastDate = new Date(sastMs);
  return {
    year: sastDate.getUTCFullYear(),
    month: sastDate.getUTCMonth() + 1,
    day: sastDate.getUTCDate(),
    dow: sastDate.getUTCDay(),
    hours: sastDate.getUTCHours(),
  };
}

export function getSeason(d: Date): Season {
  const { month } = getSastComponents(d);
  return month >= 6 && month <= 8 ? "high" : "low";
}

function getEffectiveDayOfWeek(d: Date): number {
  return getSastComponents(d).dow;
}

/**
 * Classifies intervals for display. Reconciliation uses the uploaded versioned tariff schedule.
 */
export function classifyTou(d: Date): TouPeriod {
  // Meter timestamps mark the end of each 30-minute block.
  const block = new Date(d.getTime() - 1);
  const season = getSeason(block);
  const dow = getEffectiveDayOfWeek(block);
  const { hours: h } = getSastComponents(block);
  const inRange = (start: number, end: number) => h >= start && h < end;

  // Sundays: 18:00–20:00 is Standard in 2025/26 clock; off-peak otherwise
  if (dow === 0) {
    if (inRange(18, 20)) return "standard";
    return "offPeak";
  }

  if (season === "high") {
    if (dow >= 1 && dow <= 5) {
      if (inRange(6, 9) || inRange(17, 19)) return "peak";
      if (inRange(9, 17) || inRange(19, 22)) return "standard";
      return "offPeak";
    }
    // Saturday High Season
    if (inRange(7, 12) || inRange(18, 20)) return "standard";
    return "offPeak";
  }

  // Low Season (Published 2025/26 Eskom Clock - Schedule §3.2, p.8)
  if (dow >= 1 && dow <= 5) {
    if (inRange(6, 8) || inRange(17, 20)) return "peak";
    if (inRange(8, 17) || inRange(20, 22)) return "standard";
    return "offPeak";
  }

  // Saturday Low Season
  if (inRange(7, 12) || inRange(18, 20)) return "standard";
  return "offPeak";
}

export const TOU_LABEL: Record<TouPeriod, string> = {
  peak: "Peak",
  standard: "Standard",
  offPeak: "Off-Peak",
};

export const TOU_COLOR: Record<TouPeriod, string> = {
  peak: "#ef4444",
  standard: "#f59e0b",
  offPeak: "#10b981",
};
