/**
 * Time-of-Use (TOU) & Calendar Schedule Engine
 * Evaluates season, day type, public holiday substitution rules, and TOU clock periods
 */

import type { DayType, SeasonType, TouPeriodType, TariffVersionDefinition } from "./types";

export class TouScheduleEngine {
  /**
   * Determine High Season (Jun-Aug) or Low Season (Sep-May) for a given date
   */
  public static getSeason(date: Date): SeasonType {
    const month = date.getMonth() + 1; // 1-indexed (1..12)
    return month >= 6 && month <= 8 ? "high" : "low";
  }

  /**
   * Formats date to YYYY-MM-DD string
   */
  public static formatDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * Evaluates if a given date is a gazetted public holiday or an observed Monday holiday
   */
  public static isPublicHoliday(
    date: Date,
    holidayList: TariffVersionDefinition["public_holidays"],
  ): boolean {
    const dateStr = this.formatDateStr(date);

    // Direct holiday match
    if (holidayList.some((h) => h.date === dateStr)) {
      return true;
    }

    // Check Sunday-to-Monday substitution rule:
    // If yesterday was a Sunday and yesterday was a public holiday, today (Monday) is an observed public holiday
    const dow = date.getDay(); // 1 = Monday
    if (dow === 1) {
      const yesterday = new Date(date.getTime() - 86400000);
      if (yesterday.getDay() === 0) {
        // Sunday
        const yesterdayStr = this.formatDateStr(yesterday);
        if (holidayList.some((h) => h.date === yesterdayStr)) {
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
  ): DayType {
    if (this.isPublicHoliday(date, holidayList)) {
      return "public_holiday";
    }

    const dow = date.getDay(); // 0 = Sun, 6 = Sat
    if (dow === 0) return "sunday";
    if (dow === 6) return "saturday";
    return "weekday";
  }

  /**
   * Resolves the TOU Period (Peak, Standard, Off-Peak) for a given date and hour
   */
  public static resolveTouPeriod(date: Date, tariffDef: TariffVersionDefinition): TouPeriodType {
    // Subtract 1ms so interval-end timestamps (e.g. 06:00) evaluate the ending block (05:30-06:00)
    const block = new Date(date.getTime() - 1);
    const season = this.getSeason(block);
    const dayType = this.getDayType(block, tariffDef.public_holidays);
    const hour = block.getHours(); // 0..23

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
