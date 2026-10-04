/**
 * Time-of-Use (TOU) & Calendar Schedule Engine
 * Evaluates season, day type, public holiday substitution rules, and TOU clock periods
 */

import type { DayType, SeasonType, TouPeriodType, TariffVersionDefinition } from "./types";
import { TimezoneNormalizationEngine } from "../reconciliation/timezoneNormalizationEngine";

export class TouScheduleEngine {
  public static readonly DEFAULT_TIMEZONE = "Africa/Johannesburg";

  /**
   * Determine High Season (Jun-Aug) or Low Season (Sep-May) for a given date.
   * Explicitly evaluates in Africa/Johannesburg timezone.
   */
  public static getSeason(date: Date, timezone: string = this.DEFAULT_TIMEZONE): SeasonType {
    const norm = TimezoneNormalizationEngine.normalizeTimestamp(date, timezone);
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
    holidayList: TariffVersionDefinition["public_holidays"],
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
    holidayList: TariffVersionDefinition["public_holidays"],
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
    const season = this.getSeason(blockDate, timezone);
    const dayType = this.getDayType(blockDate, tariffDef.public_holidays, timezone);
    const hour = norm.localHour; // 0..23 in explicit timezone (e.g. Africa/Johannesburg)

    const seasonConfig = tariffDef.tou_schedule.find((s) => s.season === season);
    if (!seasonConfig) return "off_peak";

    const dayTypeConfig = seasonConfig.schedules.find((d) => d.day_type === dayType);
    if (!dayTypeConfig) return "off_peak";

    // Match hour window
    for (const win of dayTypeConfig.windows) {
      if (hour >= win.hour_start && hour < win.hour_end) {
        return win.period;
      }
    }

    return "off_peak";
  }
}
