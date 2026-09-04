// Eskom Megaflex Non-local Authority 2025/2026 tariff (VAT-exclusive)
// Voltage: >=500V & <66kV (33kV supply)  |  Transmission Zone: <=300km
// Source: Eskom Schedule of Standard Prices 2025/2026, NERSA-approved, Table 3, p.16

export const TARIFF = {
  name: "Megaflex (Non-local Authority)",
  voltage: ">=500V & <66kV",
  zone: "<=300km",
  powerFactor: 0.96,

  // R/kVA/month  (applied to NMD or annual utilised capacity)
  networkCapacity: 35.98, // Distribution network capacity charge (Table 3, p.16)
  networkDemand: 24.17, // Distribution network demand charge (Table 3, p.16)
  generationCapacity: 8.09, // Generation capacity charge (Table 3, p.16)
  transmissionNetwork: 10.25, // Transmission network charge (Table 3, p.16)

  // c/kWh (converted to R/kWh in code)
  legacy: 22.2, // c/kWh (Table 3, p.16)
  ancillary: 0.39, // c/kWh (Table 3, p.16)
  electrification: 4.94, // 4.94 c/kWh in 2025/26 (Table 3, p.16)
  affordability: 4.69, // c/kWh (Table 3, p.16)

  // Active energy c/kWh (Table 3, p.16)
  energy: {
    high: { peak: 666.92, standard: 166.73, offPeak: 111.15 }, // Jun-Aug
    low: { peak: 276.78, standard: 155.62, offPeak: 111.15 }, // Sep-May
  },
  // Eskom 2026/27 rates effective 1 April 2026. April bills are day/interval weighted (13d vs 16d).
  next: {
    effectiveFrom: "2026-04-01",
    networkCapacity: 39.13,
    networkDemand: 26.29,
    generationCapacity: 12.27,
    transmissionNetwork: 11.15,
    legacy: 24.14,
    ancillary: 0.42,
    electrification: 5.37, // 5.37 c/kWh in 2026/27
    affordability: 5.1,
    administrationDaily: 21.07,
    serviceDaily: 1216.44,
    energy: {
      high: { peak: 720.27, standard: 180.07, offPeak: 120.03 },
      low: { peak: 298.89, standard: 168.05, offPeak: 120.03 },
    },
  },
  administrationDaily: 19.37,
  serviceDaily: 1118.46,
  connectionMonthly: 351887.21, // Total connection charges ex VAT (R 174 681 + R 130 684 + R 34 861.21 + R 11 661)
} as const;

export type TouPeriod = "peak" | "standard" | "offPeak";
export type Season = "high" | "low";

/** Helper to convert any Date object to South Africa Standard Time (UTC+2) components */
export function getSastComponents(d: Date): { year: number; month: number; day: number; dow: number; hours: number } {
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

// Eskom Public Holidays Specification (§10, p.11 of Schedule)
// Only 5 public holidays are treated as a Sunday: New Year's Day, Good Friday, Family Day, Christmas Day, Day of Goodwill.
// All other public holidays are treated as a Saturday.
const SUNDAY_HOLIDAYS = new Set<string>([
  "2025-01-01", "2025-04-18", "2025-04-21", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-12-25", "2026-12-26",
]);

const SATURDAY_HOLIDAYS = new Set<string>([
  "2025-03-21", "2025-04-28", "2025-05-01", "2025-06-16", "2025-08-09", "2025-09-24", "2025-12-16",
  "2026-03-21", "2026-04-27", "2026-05-01", "2026-06-16", "2026-08-10", "2026-09-24", "2026-12-16",
]);

function getEffectiveDayOfWeek(d: Date): number {
  const { year, month, day, dow } = getSastComponents(d);
  const mStr = String(month).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  const dateStr = `${year}-${mStr}-${dStr}`;

  if (dow === 0) return 0; // Sundays remain Sunday
  if (SUNDAY_HOLIDAYS.has(dateStr)) return 0; // Billed as Sunday
  if (SATURDAY_HOLIDAYS.has(dateStr)) return 6; // Billed as Saturday
  return dow;
}

/**
 * Classifies a 30-minute interval into Peak, Standard, or Off-Peak according to the
 * NERSA-published Eskom 2025/26 Time-Of-Use Clock (Schedule §3.2, p.8).
 *
 * Low Season Published Clock:
 * - Weekday Peak: 06:00–08:00 & 17:00–20:00
 * - Weekday Standard: 08:00–17:00 & 20:00–22:00
 * - Weekday Off-Peak: 22:00–06:00
 * - Saturday Standard: 07:00–12:00 & 18:00–20:00
 * - Sunday Standard: 18:00–20:00 (new 2025/26 Sunday standard window)
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
