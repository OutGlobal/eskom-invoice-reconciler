import Decimal from "decimal.js-light";
import type { DayType, SeasonType, TouPeriodType, TariffVersionDefinition } from "./types";
import { TimezoneNormalizationEngine } from "../reconciliation/timezoneNormalizationEngine";

export type IntervalBoundaryRule = "START_INCLUSIVE" | "END_INCLUSIVE" | "PRO_RATA_SPLIT";

export interface TouIntervalClassification {
  period: TouPeriodType;
  season: SeasonType;
  dayType: DayType;
  crossesBoundary: boolean;
  boundarySplit?: {
    portion1: { period: TouPeriodType; durationMinutes: number; kwh?: Decimal };
    portion2: { period: TouPeriodType; durationMinutes: number; kwh?: Decimal };
  };
  flaggedLimitation?: string;
}

export interface ClassifyIntervalOptions {
  timezone?: string;
  boundaryRule?: IntervalBoundaryRule;
  allowProRataSplit?: boolean;
  totalKwh?: Decimal | number;
}

export class TouScheduleEngine {
  public static readonly DEFAULT_TIMEZONE = "Africa/Johannesburg";

  /**
   * Determine High Season or Low Season for a given date.
   * Respects tariff-specific seasonal rules or gazetted South African default (Jun-Aug).
   * Explicitly evaluates in Africa/Johannesburg timezone (UTC+2) with zero DST contamination.
   */
  public static getSeason(
    date: Date,
    tariffDef?: TariffVersionDefinition,
    timezone: string = this.DEFAULT_TIMEZONE,
  ): SeasonType {
    const norm = TimezoneNormalizationEngine.normalizeTimestamp(date, timezone);

    // If tariff specifies a single season, respect it
    if (tariffDef?.header.season && tariffDef.tou_schedule.length === 1) {
      return tariffDef.tou_schedule[0].season;
    }

    // Standard South African Gazetted Seasons: High = June, July, August (months 6, 7, 8)
    return norm.localMonth >= 6 && norm.localMonth <= 8 ? "high" : "low";
  }

  /**
   * Formats date to YYYY-MM-DD string in Africa/Johannesburg timezone
   */
  public static formatDateStr(date: Date, timezone: string = this.DEFAULT_TIMEZONE): string {
    const norm = TimezoneNormalizationEngine.normalizeTimestamp(date, timezone);
    return norm.localDate;
  }

  /**
   * Evaluates if a given date is a gazetted public holiday or an observed Monday holiday
   */
  public static isPublicHoliday(
    date: Date,
    holidayList: TariffVersionDefinition["public_holidays"] = [],
    timezone: string = this.DEFAULT_TIMEZONE,
  ): boolean {
    const norm = TimezoneNormalizationEngine.normalizeTimestamp(date, timezone);
    const dateStr = norm.localDate;

    // Direct holiday match
    if (holidayList.some((h) => h.date === dateStr)) {
      return true;
    }

    // Check Sunday-to-Monday substitution rule:
    // If today is Monday (dow = 1), check if yesterday was Sunday and a holiday
    if (norm.dayOfWeek === 1) {
      const yesterdayMs = norm.epochMs - 86400000;
      const yesterdayNorm = TimezoneNormalizationEngine.normalizeTimestamp(yesterdayMs, timezone);
      if (yesterdayNorm.dayOfWeek === 0) {
        if (holidayList.some((h) => h.date === yesterdayNorm.localDate)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Resolves the effective DayType for a given timestamp
   */
  public static getDayType(
    date: Date,
    holidayList: TariffVersionDefinition["public_holidays"] = [],
    timezone: string = this.DEFAULT_TIMEZONE,
  ): DayType {
    if (this.isPublicHoliday(date, holidayList, timezone)) {
      return "public_holiday";
    }

    const norm = TimezoneNormalizationEngine.normalizeTimestamp(date, timezone);
    if (norm.dayOfWeek === 0) return "sunday";
    if (norm.dayOfWeek === 6) return "saturday";
    return "weekday";
  }

  /**
   * Resolves the TOU Period (Peak, Standard, Off-Peak) for a given date and hour.
   * Explicitly evaluates wall-clock hours in Africa/Johannesburg (UTC+2) with zero DST contamination.
   */
  public static resolveTouPeriod(
    date: Date,
    tariffDef: TariffVersionDefinition,
    timezone: string = this.DEFAULT_TIMEZONE,
  ): TouPeriodType {
    // Subtract 1ms so interval-end timestamps (e.g. 06:00) evaluate the ending block (05:30-06:00)
    const blockMs = date.getTime() - 1;
    const norm = TimezoneNormalizationEngine.normalizeTimestamp(blockMs, timezone);

    const blockDate = new Date(blockMs);
    const season = this.getSeason(blockDate, tariffDef, timezone);
    const dayType = this.getDayType(blockDate, tariffDef?.public_holidays || [], timezone);
    const hour = norm.localHour; // 0..23 in explicit timezone (e.g. Africa/Johannesburg)

    // Check holiday treatment if applicable
    if (dayType === "public_holiday" && tariffDef?.public_holidays && tariffDef.public_holidays.length > 0) {
      const dateStr = norm.localDate;
      const holiday = tariffDef.public_holidays.find((h) => h.date === dateStr);
      if (holiday?.tou_treatment === "off_peak") {
        return "off_peak";
      }
    }

    if (!tariffDef?.tou_schedule) return "off_peak";
    const seasonConfig = tariffDef.tou_schedule.find((s) => s.season === season);
    if (!seasonConfig) return "off_peak";

    // When public holiday behaves like sunday
    const targetDayType = dayType === "public_holiday" ? "sunday" : dayType;
    const dayTypeConfig =
      seasonConfig.schedules.find((d) => d.day_type === dayType) ||
      seasonConfig.schedules.find((d) => d.day_type === targetDayType);

    if (!dayTypeConfig) return "off_peak";

    // Match hour window
    for (const win of dayTypeConfig.windows) {
      if (hour >= win.hour_start && hour < win.hour_end) {
        return win.period;
      }
    }

    return "off_peak";
  }

  /**
   * Evaluates and classifies a discrete telemetry interval (e.g. 30-min AMR interval).
   * Defines boundary rules precisely and determines whether splitting is defensible.
   */
  public static classifyInterval(
    interval: {
      startTime: Date | string;
      endTime: Date | string;
      totalKwh?: Decimal | number;
    },
    tariffDef: TariffVersionDefinition,
    options: ClassifyIntervalOptions = {},
  ): TouIntervalClassification {
    const tz = options.timezone || this.DEFAULT_TIMEZONE;
    const startObj = interval.startTime instanceof Date ? interval.startTime : new Date(interval.startTime);
    const endObj = interval.endTime instanceof Date ? interval.endTime : new Date(interval.endTime);

    const season = this.getSeason(startObj, tariffDef, tz);
    const dayType = this.getDayType(startObj, tariffDef?.public_holidays || [], tz);

    // Evaluate start period (at start + 1ms) and end period (at end - 1ms)
    const periodAtStart = this.resolveTouPeriod(new Date(startObj.getTime() + 1), tariffDef, tz);
    const periodAtEnd = this.resolveTouPeriod(new Date(endObj.getTime() - 1), tariffDef, tz);

    if (periodAtStart === periodAtEnd) {
      return {
        period: periodAtStart,
        season,
        dayType,
        crossesBoundary: false,
      };
    }

    // Interval crosses a TOU window boundary
    // If pro-rata split is explicitly allowed and interval energy is provided
    if (options.allowProRataSplit && interval.totalKwh !== undefined) {
      let portion1Minutes = 0;
      let portion2Minutes = 0;
      const startMs = startObj.getTime();
      const endMs = endObj.getTime();
      const stepMs = 60000; // 1-minute steps

      for (let t = startMs; t < endMs; t += stepMs) {
        const curPeriod = this.resolveTouPeriod(new Date(t + 1000), tariffDef, tz);
        if (curPeriod === periodAtStart) {
          portion1Minutes++;
        } else {
          portion2Minutes++;
        }
      }

      const totalMinutes = Math.max(1, portion1Minutes + portion2Minutes);
      const kwhDec = new Decimal(interval.totalKwh);
      const ratio1 = new Decimal(portion1Minutes).div(totalMinutes);
      const kwh1 = kwhDec.mul(ratio1).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const kwh2 = kwhDec.sub(kwh1);

      return {
        period: periodAtStart,
        season,
        dayType,
        crossesBoundary: true,
        boundarySplit: {
          portion1: {
            period: periodAtStart,
            durationMinutes: portion1Minutes,
            kwh: kwh1,
          },
          portion2: {
            period: periodAtEnd,
            durationMinutes: portion2Minutes,
            kwh: kwh2,
          },
        },
      };
    }

    // Default boundary rule: Start-inclusive (or END_INCLUSIVE) with audit limitation flag
    const selectedPeriod = options.boundaryRule === "END_INCLUSIVE" ? periodAtEnd : periodAtStart;
    return {
      period: selectedPeriod,
      season,
      dayType,
      crossesBoundary: true,
      flaggedLimitation:
        "Interval spans across TOU transition boundary; underlying data lacks sub-interval resolution for defensible split.",
    };
  }
}

