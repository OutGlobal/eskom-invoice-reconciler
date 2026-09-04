/**
 * Versioned Tariff Engine
 * Eskom Management Platform — Enterprise Multi-Tariff Billing Service
 * Supports Megaflex, Miniflex, Nightsave, Municipal (Emfuleni), TOU clocks,
 * high/low seasons, voltage tiers, reactive energy (kVARh) rules, and Day-weighted April pro-rata.
 */

import type { TouPeriod, Season, VoltageCategory, TariffFamily } from "../types/canonical";
import { FinancialMath } from "./financialMath";

export interface TariffComponentRate {
  networkCapacityPerKVA: number;
  networkDemandPerKVA: number;
  generationCapacityPerKVA: number;
  transmissionNetworkPerKVA: number;
  legacyCentsPerKWh: number;
  ancillaryCentsPerKWh: number;
  electrificationCentsPerKWh: number;
  affordabilityCentsPerKWh: number;
  administrationDailyRate: number;
  serviceDailyRate: number;
  energyRates: {
    high: { peak: number; standard: number; offPeak: number };
    low: { peak: number; standard: number; offPeak: number };
  };
  reactiveEnergyCentsPerKVARh: number;
}

export interface TariffDefinition {
  family: TariffFamily;
  name: string;
  voltageCategory: VoltageCategory;
  effectiveFrom: string;
  effectiveTo?: string;
  rates: TariffComponentRate;
}

// Published Eskom Holidays treated as Sunday
const SUNDAY_HOLIDAYS = new Set<string>([
  "2025-01-01", "2025-04-18", "2025-04-21", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-12-25", "2026-12-26",
]);

// Published Eskom Holidays treated as Saturday
const SATURDAY_HOLIDAYS = new Set<string>([
  "2025-03-21", "2025-04-28", "2025-05-01", "2025-06-16", "2025-08-09", "2025-09-24", "2025-12-16",
  "2026-03-21", "2026-04-27", "2026-05-01", "2026-06-16", "2026-08-10", "2026-09-24", "2026-12-16",
]);

export class TariffEngine {
  /**
   * Determines High Season (Jun-Aug) or Low Season (Sep-May) per NERSA schedule
   */
  public static getSeason(date: Date): Season {
    const month = date.getMonth() + 1;
    return month >= 6 && month <= 8 ? "high" : "low";
  }

  /**
   * Evaluates effective day of week considering Eskom Holiday Rules
   */
  public static getEffectiveDayOfWeek(d: Date): number {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;
    const actualDow = d.getDay(); // 0 Sun .. 6 Sat

    if (actualDow === 0) return 0;
    if (SUNDAY_HOLIDAYS.has(dateStr)) return 0;
    if (SATURDAY_HOLIDAYS.has(dateStr)) return 6;
    return actualDow;
  }

  /**
   * Classifies a 30-minute interval into Peak, Standard, or Off-Peak
   */
  public static classifyTou(date: Date): TouPeriod {
    const block = new Date(date.getTime() - 1);
    const season = this.getSeason(block);
    const dow = this.getEffectiveDayOfWeek(block);
    const h = block.getHours();

    const inRange = (start: number, end: number) => h >= start && h < end;

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
      if (inRange(7, 12) || inRange(18, 20)) return "standard";
      return "offPeak";
    }

    if (dow >= 1 && dow <= 5) {
      if (inRange(6, 8) || inRange(17, 20)) return "peak";
      if (inRange(8, 17) || inRange(20, 22)) return "standard";
      return "offPeak";
    }

    if (inRange(7, 12) || inRange(18, 20)) return "standard";
    return "offPeak";
  }

  /**
   * Evaluates standard Eskom Megaflex tariff rates for a given date
   */
  public static getMegaflexDefinition(date: Date): TariffDefinition {
    const isNewEra = date >= new Date("2026-04-01T00:00:00Z");

    if (isNewEra) {
      return {
        family: "megaflex",
        name: "Megaflex (Non-Local Authority 2026/27)",
        voltageCategory: ">=500V & <66kV",
        effectiveFrom: "2026-04-01",
        rates: {
          networkCapacityPerKVA: 39.13,
          networkDemandPerKVA: 26.29,
          generationCapacityPerKVA: 12.27,
          transmissionNetworkPerKVA: 11.15,
          legacyCentsPerKWh: 24.14,
          ancillaryCentsPerKWh: 0.42,
          electrificationCentsPerKWh: 5.37,
          affordabilityCentsPerKWh: 5.1,
          administrationDailyRate: 21.07,
          serviceDailyRate: 1216.44,
          energyRates: {
            high: { peak: 720.27, standard: 180.07, offPeak: 120.03 },
            low: { peak: 298.89, standard: 168.05, offPeak: 120.03 },
          },
          reactiveEnergyCentsPerKVARh: 15.42,
        },
      };
    }

    return {
      family: "megaflex",
      name: "Megaflex (Non-Local Authority 2025/26)",
      voltageCategory: ">=500V & <66kV",
      effectiveFrom: "2025-04-01",
      effectiveTo: "2026-03-31",
      rates: {
        networkCapacityPerKVA: 35.98,
        networkDemandPerKVA: 24.17,
        generationCapacityPerKVA: 8.09,
        transmissionNetworkPerKVA: 10.25,
        legacyCentsPerKWh: 22.2,
        ancillaryCentsPerKWh: 0.39,
        electrificationCentsPerKWh: 4.94,
        affordabilityCentsPerKWh: 4.69,
        administrationDailyRate: 19.37,
        serviceDailyRate: 1118.46,
        energyRates: {
          high: { peak: 666.92, standard: 166.73, offPeak: 111.15 },
          low: { peak: 276.78, standard: 155.62, offPeak: 111.15 },
        },
        reactiveEnergyCentsPerKVARh: 14.15,
      },
    };
  }

  /**
   * Calculates Reactive Energy (kVARh) penalty charge per Eskom Schedule §6.2:
   * Reactive energy is billed during Peak and Standard periods for kVARh in excess of 30% of active kWh.
   */
  public static calculateReactivePowerCharge(
    peakPlusStdKWh: number,
    totalPeakPlusStdKVARh: number,
    reactiveRateCents: number
  ): { allowedFreeKVARh: number; chargeableKVARh: number; penaltyAmountR: number } {
    const allowedFreeKVARh = FinancialMath.mul(peakPlusStdKWh, 0.3);
    const chargeableKVARh = Math.max(0, FinancialMath.sub(totalPeakPlusStdKVARh, allowedFreeKVARh));
    const penaltyAmountR = FinancialMath.roundCurrency(FinancialMath.div(FinancialMath.mul(chargeableKVARh, reactiveRateCents), 100));

    return {
      allowedFreeKVARh,
      chargeableKVARh,
      penaltyAmountR,
    };
  }
}
