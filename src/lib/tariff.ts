// Eskom Megaflex Non-local Authority 2025/2026 tariff (VAT-exclusive)
// Voltage: >=500V & <66kV  |  Transmission Zone: <=300km
// Source: Eskom Tariffs and Charges Booklet 2025/2026, p.13

export const TARIFF = {
  name: "Megaflex (Non-local Authority)",
  voltage: ">=500V & <66kV",
  zone: "<=300km",
  powerFactor: 0.96,

  // R/kVA/month  (applied to NMD or chargeable demand)
  networkCapacity: 35.98, // Distribution network capacity charge
  networkDemand: 24.17, // Distribution network demand charge (per max demand)
  generationCapacity: 8.09, // Generation capacity charge (per NMD)
  transmissionNetwork: 10.25, // Transmission network charge (per NMD)

  // c/kWh (converted to R/kWh in code)
  legacy: 22.2,
  ancillary: 0.39,
  electrification: 4.94,
  affordability: 4.69,

  // Active energy c/kWh
  energy: {
    high: { peak: 666.92, standard: 166.73, offPeak: 111.15 }, // Jun-Aug
    low: { peak: 276.78, standard: 155.62, offPeak: 111.15 }, // Sep-May
  },
} as const;

export type TouPeriod = "peak" | "standard" | "offPeak";
export type Season = "high" | "low";

export function getSeason(d: Date): Season {
  const m = d.getMonth() + 1; // 1-12
  return m >= 6 && m <= 8 ? "high" : "low";
}

// SA public holidays 2025-2026 (fixed + observed)
const HOLIDAYS = new Set<string>([
  "2025-01-01",
  "2025-03-21",
  "2025-04-18",
  "2025-04-21",
  "2025-04-28",
  "2025-05-01",
  "2025-06-16",
  "2025-08-09",
  "2025-09-24",
  "2025-12-16",
  "2025-12-25",
  "2025-12-26",
  "2026-01-01",
  "2026-03-21",
  "2026-03-23",
  "2026-04-03",
  "2026-04-06",
  "2026-04-27",
  "2026-05-01",
  "2026-06-16",
  "2026-08-10",
  "2026-09-24",
  "2026-12-16",
  "2026-12-25",
  "2026-12-28",
]);

function isHoliday(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return HOLIDAYS.has(`${y}-${m}-${day}`);
}

// Megaflex TOU (Eskom Appendix A) — half-hour block index 0..47 (block ending)
// Returns period for the 30-min interval ending at (hour, minute).
export function classifyTou(d: Date): TouPeriod {
  const season = getSeason(d);
  const dow = d.getDay(); // 0 Sun .. 6 Sat
  const holiday = isHoliday(d);
  const h = d.getHours();
  const inRange = (start: number, end: number) => h >= start && h < end;

  // Sundays and public holidays: all off-peak
  if (dow === 0 || holiday) return "offPeak";

  if (season === "high") {
    if (dow >= 1 && dow <= 5) {
      if (inRange(6, 9) || inRange(17, 19)) return "peak";
      if (inRange(9, 17) || inRange(19, 22)) return "standard";
      return "offPeak";
    }
    // Saturday
    if (inRange(7, 12) || inRange(18, 20)) return "standard";
    return "offPeak";
  }
  // Low season
  if (dow >= 1 && dow <= 5) {
    if (inRange(7, 10) || inRange(18, 20)) return "peak";
    if (inRange(6, 7) || inRange(10, 18) || inRange(20, 22)) return "standard";
    return "offPeak";
  }
  // Saturday low
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
