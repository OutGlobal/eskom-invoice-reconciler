/**
 * Deterministic Configurable Calendar & TOU Engine
 * Pure functional, zero-side-effect calendar engine for Eskom & Municipal Utility tariffs.
 * Explicitly enforces SAST (UTC+2) timezone determinism across all environments.
 */

import Decimal from "decimal.js-light";
import type { TariffVersionDefinition, TouPeriodType, SeasonType } from "@/domain/tariff/types";
import type {
  ExtendedDayType,
  CalendarHolidayConfig,
  SeasonBoundaryConfig,
  SastTimeComponents,
  IntervalClassificationResult,
  IntervalClassificationExplanation,
  TouIntervalAggregation,
} from "./types";

export const DEFAULT_SA_HOLIDAYS: CalendarHolidayConfig[] = [
  // 2024
  { holiday_date: "2024-01-01", holiday_name: "New Year's Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-03-21", holiday_name: "Human Rights Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-03-29", holiday_name: "Good Friday", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-04-01", holiday_name: "Family Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-04-27", holiday_name: "Freedom Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-05-01", holiday_name: "Workers' Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-05-29", holiday_name: "National General Election Day", country_code: "ZA", holiday_type: "special", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-06-16", holiday_name: "Youth Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-06-17", holiday_name: "Youth Day (Observed)", country_code: "ZA", holiday_type: "observed", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-08-09", holiday_name: "National Women's Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-09-24", holiday_name: "Heritage Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-12-16", holiday_name: "Day of Reconciliation", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-12-25", holiday_name: "Christmas Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2024-12-26", holiday_name: "Day of Goodwill", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },

  // 2025
  { holiday_date: "2025-01-01", holiday_name: "New Year's Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-03-21", holiday_name: "Human Rights Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-04-18", holiday_name: "Good Friday", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-04-21", holiday_name: "Family Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-04-27", holiday_name: "Freedom Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-04-28", holiday_name: "Freedom Day (Observed)", country_code: "ZA", holiday_type: "observed", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-05-01", holiday_name: "Workers' Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-06-16", holiday_name: "Youth Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-08-09", holiday_name: "National Women's Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-09-24", holiday_name: "Heritage Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-12-16", holiday_name: "Day of Reconciliation", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-12-25", holiday_name: "Christmas Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2025-12-26", holiday_name: "Day of Goodwill", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },

  // 2026
  { holiday_date: "2026-01-01", holiday_name: "New Year's Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-03-21", holiday_name: "Human Rights Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-04-03", holiday_name: "Good Friday", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-04-06", holiday_name: "Family Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-04-27", holiday_name: "Freedom Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-05-01", holiday_name: "Workers' Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-06-16", holiday_name: "Youth Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-08-09", holiday_name: "National Women's Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-08-10", holiday_name: "National Women's Day (Observed)", country_code: "ZA", holiday_type: "observed", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-09-24", holiday_name: "Heritage Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-12-16", holiday_name: "Day of Reconciliation", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-12-25", holiday_name: "Christmas Day", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
  { holiday_date: "2026-12-26", holiday_name: "Day of Goodwill", country_code: "ZA", holiday_type: "public", tou_treatment: "sunday_schedule", is_active: true },
];

export class DeterministicCalendarEngine {
  /**
   * Convert any UTC ISO timestamp or Date object to SAST (UTC+2) components.
   * If the input timestamp represents an exact hour interval boundary (e.g. 06:00:00.000),
   * subtract 1ms so interval-end timestamps evaluate the ending 30-min block (05:30-06:00).
   */
  public static getSastComponents(timestampUtc: string | Date): SastTimeComponents {
    const rawDate = typeof timestampUtc === "string" ? new Date(timestampUtc) : new Date(timestampUtc.getTime());

    // Adjust 1ms back if exact top-of-hour to evaluate ending block
    const isExactTopOfHour = rawDate.getUTCMinutes() === 0 && rawDate.getUTCSeconds() === 0 && rawDate.getUTCMilliseconds() === 0;
    const evalDate = isExactTopOfHour ? new Date(rawDate.getTime() - 1) : rawDate;

    // SAST is UTC + 2 hours (2 * 3600 * 1000 ms)
    const sastMs = evalDate.getTime() + 2 * 60 * 60 * 1000;
    const sastDate = new Date(sastMs);

    const year = sastDate.getUTCFullYear();
    const month = sastDate.getUTCMonth() + 1; // 1..12
    const day = sastDate.getUTCDate();
    const dow = sastDate.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const hour = sastDate.getUTCHours();
    const minute = sastDate.getUTCMinutes();
    const second = sastDate.getUTCSeconds();

    const local_date_str = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const local_time_str = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;

    return {
      year,
      month,
      day,
      day_of_week: dow,
      hour,
      minute,
      second,
      local_date_str,
      local_time_str,
    };
  }

  /**
   * Determine High Season (Jun-Aug) or Low Season (Sep-May)
   */
  public static resolveSeason(sast: SastTimeComponents, config?: SeasonBoundaryConfig): SeasonType {
    const startM = config?.high_season_start_month ?? 6;
    const endM = config?.high_season_end_month ?? 8;
    return sast.month >= startM && sast.month <= endM ? "high" : "low";
  }

  /**
   * Resolve Extended Day Type (weekday, saturday, sunday, public_holiday, special_holiday)
   */
  public static resolveDayType(
    sast: SastTimeComponents,
    holidayList: CalendarHolidayConfig[] = DEFAULT_SA_HOLIDAYS
  ): { dayType: ExtendedDayType; matchedHoliday?: CalendarHolidayConfig } {
    // 1. Check direct match in holiday list
    const matched = holidayList.find((h) => h.is_active && h.holiday_date === sast.local_date_str);
    if (matched) {
      const type: ExtendedDayType = matched.holiday_type === "special" ? "special_holiday" : "public_holiday";
      return { dayType: type, matchedHoliday: matched };
    }

    // 2. Check Sunday-to-Monday substitution rule:
    // If today is Monday (dow = 1), check if yesterday (Sunday) was a public holiday
    if (sast.day_of_week === 1) {
      const yesterdaySastDate = new Date(Date.UTC(sast.year, sast.month - 1, sast.day - 1));
      const yYear = yesterdaySastDate.getUTCFullYear();
      const yMonth = String(yesterdaySastDate.getUTCMonth() + 1).padStart(2, "0");
      const yDay = String(yesterdaySastDate.getUTCDate()).padStart(2, "0");
      const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

      const sundayHoliday = holidayList.find(
        (h) => h.is_active && h.holiday_date === yesterdayStr && h.holiday_type === "public"
      );

      if (sundayHoliday) {
        return {
          dayType: "public_holiday",
          matchedHoliday: {
            holiday_date: sast.local_date_str,
            holiday_name: `${sundayHoliday.holiday_name} (Observed)`,
            country_code: "ZA",
            holiday_type: "observed",
            tou_treatment: sundayHoliday.tou_treatment,
            is_active: true,
          },
        };
      }
    }

    // 3. Fallback to standard days
    if (sast.day_of_week === 0) return { dayType: "sunday" };
    if (sast.day_of_week === 6) return { dayType: "saturday" };
    return { dayType: "weekday" };
  }

  /**
   * Classify a single telemetry interval
   */
  public static classifyInterval(
    timestampUtc: string | Date,
    kwhValue: Decimal = new Decimal(0),
    tariffVersion: TariffVersionDefinition,
    holidayList: CalendarHolidayConfig[] = DEFAULT_SA_HOLIDAYS
  ): IntervalClassificationResult {
    const sast = this.getSastComponents(timestampUtc);
    const season = this.resolveSeason(sast);
    const { dayType, matchedHoliday } = this.resolveDayType(sast, holidayList);

    // Determine target TOU day_type for schedule lookup
    let targetTouDayType: "weekday" | "saturday" | "sunday" | "public_holiday" = "weekday";
    if (dayType === "public_holiday" || dayType === "special_holiday") {
      targetTouDayType = matchedHoliday?.tou_treatment === "saturday_schedule" ? "saturday" : "public_holiday";
    } else if (dayType === "sunday") {
      targetTouDayType = "sunday";
    } else if (dayType === "saturday") {
      targetTouDayType = "saturday";
    }

    // Find TOU clock schedule for active season
    let touPeriod: TouPeriodType = "off_peak";
    let matchedWindow = { hour_start: 0, hour_end: 24, period: "off_peak" as TouPeriodType };

    const seasonSchedule = tariffVersion.tou_schedule.find((s) => s.season === season);
    if (seasonSchedule) {
      const daySchedule = seasonSchedule.schedules.find((d) => d.day_type === targetTouDayType);
      if (daySchedule) {
        for (const win of daySchedule.windows) {
          if (sast.hour >= win.hour_start && sast.hour < win.hour_end) {
            touPeriod = win.period;
            matchedWindow = win;
            break;
          }
        }
      }
    }

    // Match rate rule in tariff definition
    const matchedRule = tariffVersion.components.find(
      (c) =>
        c.component_type === "ACTIVE_ENERGY" &&
        (c.season === season || c.season === "all" || !c.season) &&
        (c.tou_period === touPeriod || c.tou_period === "all" || !c.tou_period)
    ) || tariffVersion.components[0];

    const rate = matchedRule ? matchedRule.rate_value : new Decimal(0);
    // Formula: active energy c/kWh / 100 * kWh
    const amountZar = kwhValue.times(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const timestampUtcStr = typeof timestampUtc === "string" ? timestampUtc : timestampUtc.toISOString();

    return {
      timestamp_utc: timestampUtcStr,
      timezone: "Africa/Johannesburg",
      local_date: sast.local_date_str,
      local_time: sast.local_time_str,
      season,
      day_type: dayType,
      tariff_code: tariffVersion.header.tariff_code,
      tariff_version: tariffVersion.header.version,
      tou_period: touPeriod,
      applicable_rate: rate,
      unit_of_measure: matchedRule ? matchedRule.unit_of_measure : "c/kWh",
      rule_id: matchedRule ? matchedRule.rule_id : "RULE_DEFAULT",
      kwh_value: kwhValue,
      amount_zar: amountZar,
    };
  }

  /**
   * Explanation Capability: "Why was this interval classified as Peak?"
   */
  public static explainIntervalClassification(
    timestampUtc: string | Date,
    tariffVersion: TariffVersionDefinition,
    holidayList: CalendarHolidayConfig[] = DEFAULT_SA_HOLIDAYS
  ): IntervalClassificationExplanation {
    const classification = this.classifyInterval(timestampUtc, new Decimal(0), tariffVersion, holidayList);
    const sast = this.getSastComponents(timestampUtc);
    const { matchedHoliday } = this.resolveDayType(sast, holidayList);

    const rateStr = `${classification.applicable_rate.toFixed(4)} ${classification.unit_of_measure}`;
    
    let explanationText = `Interval at ${classification.local_date} ${classification.local_time} (SAST) was classified as ${classification.tou_period.toUpperCase()} under ${classification.tariff_code} v${classification.tariff_version}. `;

    if (matchedHoliday) {
      explanationText += `Reason: Date is recognized as ${matchedHoliday.holiday_name} (${matchedHoliday.holiday_type.toUpperCase()}). Holiday TOU rule applied: ${matchedHoliday.tou_treatment.toUpperCase()}. `;
    } else {
      explanationText += `Reason: Evaluated as ${classification.day_type.toUpperCase()} during ${classification.season.toUpperCase()} season. Hour block ${sast.hour}:00 matched TOU window ${classification.tou_period.toUpperCase()}. `;
    }

    explanationText += `Applicable energy rate: ${rateStr} (Rule ID: ${classification.rule_id}).`;

    return {
      timestamp_utc: classification.timestamp_utc,
      timezone: classification.timezone,
      local_date: classification.local_date,
      local_time: classification.local_time,
      day_type: classification.day_type,
      season: classification.season,
      tariff_code: classification.tariff_code,
      tariff_version: classification.tariff_version,
      tou_period: classification.tou_period,
      rule_id: classification.rule_id,
      applicable_rate: classification.applicable_rate.toFixed(4),
      unit_of_measure: classification.unit_of_measure,
      explanation_text: explanationText,
      matched_window: {
        hour_start: sast.hour,
        hour_end: sast.hour + 1,
        period: classification.tou_period,
      },
      holiday_info: matchedHoliday
        ? {
            name: matchedHoliday.holiday_name,
            type: matchedHoliday.holiday_type,
            treatment: matchedHoliday.tou_treatment,
          }
        : undefined,
    };
  }

  /**
   * Aggregate telemetry intervals into Peak, Standard, Off-Peak, and Total kWh + ZAR cost
   */
  public static aggregateIntervals(
    intervals: Array<{ timestamp: string; kwh: Decimal }>,
    tariffVersion: TariffVersionDefinition,
    holidayList: CalendarHolidayConfig[] = DEFAULT_SA_HOLIDAYS
  ): TouIntervalAggregation {
    let peakKwh = new Decimal(0);
    let standardKwh = new Decimal(0);
    let offPeakKwh = new Decimal(0);
    let totalKwh = new Decimal(0);

    let peakCost = new Decimal(0);
    let standardCost = new Decimal(0);
    let offPeakCost = new Decimal(0);
    let totalCost = new Decimal(0);

    for (const item of intervals) {
      const classRes = this.classifyInterval(item.timestamp, item.kwh, tariffVersion, holidayList);
      const kwh = item.kwh;
      const cost = classRes.amount_zar || new Decimal(0);

      totalKwh = totalKwh.plus(kwh);
      totalCost = totalCost.plus(cost);

      if (classRes.tou_period === "peak") {
        peakKwh = peakKwh.plus(kwh);
        peakCost = peakCost.plus(cost);
      } else if (classRes.tou_period === "standard") {
        standardKwh = standardKwh.plus(kwh);
        standardCost = standardCost.plus(cost);
      } else {
        offPeakKwh = offPeakKwh.plus(kwh);
        offPeakCost = offPeakCost.plus(cost);
      }
    }

    return {
      interval_count: intervals.length,
      peak_kwh: peakKwh,
      standard_kwh: standardKwh,
      off_peak_kwh: offPeakKwh,
      total_kwh: totalKwh,
      peak_cost_zar: peakCost,
      standard_cost_zar: standardCost,
      off_peak_cost_zar: offPeakCost,
      total_cost_zar: totalCost,
    };
  }
}
