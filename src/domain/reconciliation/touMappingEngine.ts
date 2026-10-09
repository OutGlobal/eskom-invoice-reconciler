/**
 * ENERA RECONCILIATION ENGINE: TIME-OF-USE MAPPING (REQUIREMENT 15)
 * =================================================================
 * Data-Driven Dynamic Time-of-Use (TOU) Engine.
 *
 * Core Principles:
 *   1. Maps interval timestamps to:
 *      - PEAK
 *      - STANDARD
 *      - OFF-PEAK
 *   2. ZERO HARD-CODED TARIFF PERIODS in this engine.
 *      Tariff periods, hours, seasons, and holiday rules are pure DATA provided
 *      by the Tariff Engine via `tariff_period_definition`.
 *   3. Dynamic consumption of `tariff_period_definition`:
 *      Consumes the calendar definition provided and applies it deterministically to intervals.
 *   4. Explicit timezone handling via TimezoneNormalizationEngine (e.g. Africa/Johannesburg).
 *   5. Full interval-level audit trail and aggregate period analytics with PowerFactorEngine integration.
 */

import Decimal from "decimal.js-light";
import { TimezoneNormalizationEngine } from "./timezoneNormalizationEngine";
import { PowerFactorEngine, PowerFactorAuditRecord } from "./powerFactorEngine";
import type { TariffVersionDefinition, TouPeriodType } from "../tariff/types";

export type TouPeriod = "PEAK" | "STANDARD" | "OFF-PEAK";

export type DayType = "weekday" | "saturday" | "sunday" | "public_holiday";

export interface TouWindowDefinition {
  hour_start: number; // 0..23
  hour_end: number; // 0..24
  minute_start?: number; // 0..59 (optional sub-hour precision)
  minute_end?: number; // 0..59
  period: TouPeriod | TouPeriodType | string;
  label?: string;
}

export interface DayTypeScheduleDefinition {
  day_type: DayType;
  windows: TouWindowDefinition[];
}

export interface SeasonDefinition {
  season_name: string; // e.g. "high" | "low" | "summer" | "winter" | "shoulder"
  months?: number[]; // 1-indexed months (e.g. [6, 7, 8] for June, July, August)
  date_ranges?: Array<{
    start_month: number;
    start_day: number;
    end_month: number;
    end_day: number;
  }>;
  schedules: DayTypeScheduleDefinition[];
}

export interface PublicHolidayDefinition {
  date: string; // "YYYY-MM-DD"
  name: string;
  tou_treatment: "sunday_schedule" | "saturday_schedule" | "off_peak" | "weekday";
  substitute_observed_mondays?: boolean; // When true, Sunday holiday observed on Monday
}

/**
 * Requirement 15 Contract: tariff_period_definition
 * Dynamic calendar provided by the Tariff Engine with zero hardcoded periods.
 */
export interface TariffPeriodDefinition {
  calendar_id: string;
  tariff_code: string;
  tariff_version?: string;
  utility?: string;
  timezone: string; // e.g. "Africa/Johannesburg"
  seasons: SeasonDefinition[];
  public_holidays: PublicHolidayDefinition[];
  default_period?: TouPeriod; // default "OFF-PEAK"
  interval_alignment?: "START_OF_INTERVAL" | "END_OF_INTERVAL"; // default "START_OF_INTERVAL"
}

export interface TouMappingAudit {
  timestamp_utc: string;
  timestamp_local: string;
  timezone: string;
  period: TouPeriod;
  season: string;
  day_type: DayType;
  is_public_holiday: boolean;
  holiday_name?: string;
  matched_window?: {
    hour_start: number;
    hour_end: number;
    minute_start?: number;
    minute_end?: number;
    label?: string;
  };
  rule_applied: string;
  calendar_id: string;
}

export interface MappedTouIntervalRecord {
  timestampUtc: string;
  timestampLocal: string;
  period: TouPeriod;
  season: string;
  dayType: DayType;
  kWh: Decimal;
  kVAh?: Decimal;
  kW: Decimal;
  kVA: Decimal;
  kVArh: Decimal;
  powerFactorAudit?: PowerFactorAuditRecord;
  mappingAudit: TouMappingAudit;
}

export interface TouPeriodAggregation {
  period: TouPeriod;
  total_kwh: Decimal;
  total_kvah: Decimal;
  total_kvarh: Decimal;
  max_demand_kw: Decimal;
  max_demand_kva: Decimal;
  interval_count: number;
  percentage_of_total_kwh: Decimal;
  power_factor_audit: PowerFactorAuditRecord;
}

export interface TouConsumptionSummary {
  calendar_id: string;
  tariff_code: string;
  timezone: string;
  total_active_kwh: Decimal;
  total_apparent_kvah: Decimal;
  total_reactive_kvarh: Decimal;
  system_peak_demand_kw: Decimal;
  system_peak_demand_kva: Decimal;
  overall_power_factor_audit: PowerFactorAuditRecord;
  by_period: {
    PEAK: TouPeriodAggregation;
    STANDARD: TouPeriodAggregation;
    "OFF-PEAK": TouPeriodAggregation;
  };
  total_intervals: number;
  mapped_intervals: MappedTouIntervalRecord[];
}

export class TouMappingEngine {
  public static readonly DEFAULT_TIMEZONE = "Africa/Johannesburg";
  public static readonly DEFAULT_FALLBACK_PERIOD: TouPeriod = "OFF-PEAK";

  /**
   * Normalizes any casing or format variant of TOU periods to canonical ("PEAK" | "STANDARD" | "OFF-PEAK")
   */
  public static normalizePeriod(period: string): TouPeriod {
    const clean = String(period).trim().toUpperCase().replace(/_/g, "-");
    if (clean === "PEAK") return "PEAK";
    if (clean === "STANDARD" || clean === "STD") return "STANDARD";
    if (clean === "OFF-PEAK" || clean === "OFFPEAK" || clean === "OFF_PEAK") return "OFF-PEAK";
    return "OFF-PEAK";
  }

  /**
   * Adapter: Constructs a data-driven TariffPeriodDefinition from the Tariff Engine's TariffVersionDefinition.
   * This bridges the Tariff Engine domain types into the reconciliation TOU mapping contract without hardcoding.
   */
  public static fromTariffVersionDefinition(
    tariffDef: TariffVersionDefinition,
    options: {
      highSeasonMonths?: number[];
      lowSeasonMonths?: number[];
      calendarId?: string;
      timezone?: string;
      intervalAlignment?: "START_OF_INTERVAL" | "END_OF_INTERVAL";
    } = {}
  ): TariffPeriodDefinition {
    const highMonths = options.highSeasonMonths ?? [6, 7, 8]; // Gazetted NERSA winter months (Jun, Jul, Aug)
    const lowMonths =
      options.lowSeasonMonths ?? [1, 2, 3, 4, 5, 9, 10, 11, 12]; // Gazetted NERSA summer months

    const seasons: SeasonDefinition[] = tariffDef.tou_schedule.map((seasonSchedule) => {
      const isHigh = seasonSchedule.season.toLowerCase() === "high";
      const months = isHigh ? highMonths : lowMonths;

      const schedules: DayTypeScheduleDefinition[] = seasonSchedule.schedules.map((dayConfig) => ({
        day_type: dayConfig.day_type,
        windows: dayConfig.windows.map((win) => ({
          hour_start: win.hour_start,
          hour_end: win.hour_end,
          period: this.normalizePeriod(win.period),
          label: `${win.period.toUpperCase()} (${win.hour_start}:00 - ${win.hour_end}:00)`,
        })),
      }));

      return {
        season_name: seasonSchedule.season,
        months,
        schedules,
      };
    });

    const holidays: PublicHolidayDefinition[] = (tariffDef.public_holidays || []).map((h) => ({
      date: h.date,
      name: h.name,
      tou_treatment: h.tou_treatment === "sunday_schedule" ? "sunday_schedule" : "off_peak",
      substitute_observed_mondays: true,
    }));

    return {
      calendar_id:
        options.calendarId ??
        `${tariffDef.header.tariff_code}_${tariffDef.header.version}_TOU_CALENDAR`,
      tariff_code: tariffDef.header.tariff_code,
      tariff_version: tariffDef.header.version,
      utility: tariffDef.header.utility,
      timezone: options.timezone ?? this.DEFAULT_TIMEZONE,
      seasons,
      public_holidays: holidays,
      default_period: "OFF-PEAK",
      interval_alignment: options.intervalAlignment ?? "START_OF_INTERVAL",
    };
  }

  /**
   * Determine season from a given local month and day based on data-driven SeasonDefinition rules.
   * Zero hardcoding: evaluates directly against definition rules.
   */
  public static determineSeason(
    month: number,
    day: number,
    seasons: SeasonDefinition[]
  ): SeasonDefinition | null {
    if (!seasons || seasons.length === 0) return null;

    // Check specific month list matching
    for (const season of seasons) {
      if (season.months && season.months.includes(month)) {
        return season;
      }
    }

    // Check date range matching
    for (const season of seasons) {
      if (season.date_ranges && season.date_ranges.length > 0) {
        for (const range of season.date_ranges) {
          const currentCode = month * 100 + day;
          const startCode = range.start_month * 100 + range.start_day;
          const endCode = range.end_month * 100 + range.end_day;

          if (startCode <= endCode) {
            if (currentCode >= startCode && currentCode <= endCode) {
              return season;
            }
          } else {
            // Wraps around year-end (e.g. Nov to Feb)
            if (currentCode >= startCode || currentCode <= endCode) {
              return season;
            }
          }
        }
      }
    }

    // Fallback to first defined season if no specific match
    return seasons[0];
  }

  /**
   * Check if date matches a public holiday in the calendar definition.
   * Also accounts for Sunday-to-Monday substitution if configured.
   */
  public static matchPublicHoliday(
    localDate: string,
    dayOfWeek: number,
    epochMs: number,
    timezone: string,
    holidayList: PublicHolidayDefinition[]
  ): { isHoliday: boolean; holidayRule?: PublicHolidayDefinition } {
    if (!holidayList || holidayList.length === 0) {
      return { isHoliday: false };
    }

    // Direct calendar match
    const directMatch = holidayList.find((h) => h.date === localDate);
    if (directMatch) {
      return { isHoliday: true, holidayRule: directMatch };
    }

    // Sunday-to-Monday substitution (Public Holidays Act):
    // If today is Monday (dayOfWeek === 1), check if yesterday (Sunday) was a holiday
    if (dayOfWeek === 1) {
      const yesterdayMs = epochMs - 86400000;
      const yesterdayNorm = TimezoneNormalizationEngine.normalizeTimestamp(yesterdayMs, timezone);
      if (yesterdayNorm.dayOfWeek === 0) {
        const yesterdayHoliday = holidayList.find(
          (h) => h.date === yesterdayNorm.localDate && h.substitute_observed_mondays !== false
        );
        if (yesterdayHoliday) {
          return {
            isHoliday: true,
            holidayRule: {
              ...yesterdayHoliday,
              name: `${yesterdayHoliday.name} (Observed)`,
            },
          };
        }
      }
    }

    return { isHoliday: false };
  }

  /**
   * Map an interval timestamp to PEAK, STANDARD, or OFF-PEAK using the supplied tariff_period_definition.
   *
   * Requirement 15:
   *   - Prepare the engine to map interval timestamps to: PEAK, STANDARD, OFF-PEAK.
   *   - Do not hard-code tariff periods in this branch.
   *   - The Tariff Engine will provide the applicable TOU calendar.
   *   - The reconciliation engine should consume: tariff_period_definition and apply it to the intervals.
   */
  public static mapTimestamp(
    timestamp: string | number | Date,
    tariffPeriodDef: TariffPeriodDefinition
  ): TouMappingAudit {
    const tz = tariffPeriodDef.timezone || this.DEFAULT_TIMEZONE;
    const defaultPeriod = tariffPeriodDef.default_period || this.DEFAULT_FALLBACK_PERIOD;

    let targetTimeMs: number;
    if (timestamp instanceof Date) {
      targetTimeMs = timestamp.getTime();
    } else if (typeof timestamp === "number") {
      targetTimeMs = timestamp;
    } else {
      targetTimeMs = new Date(timestamp).getTime();
    }

    if (isNaN(targetTimeMs)) {
      throw new Error(`TouMappingEngine: Invalid timestamp provided: ${timestamp}`);
    }

    // Alignment adjustment: If interval timestamp represents END_OF_INTERVAL (e.g. 06:00 is end of 05:30-06:00 block),
    // subtract 1ms to evaluate the wall-clock window of the consumption block.
    const evaluationMs =
      tariffPeriodDef.interval_alignment === "END_OF_INTERVAL"
        ? targetTimeMs - 1
        : targetTimeMs;

    const norm = TimezoneNormalizationEngine.normalizeTimestamp(evaluationMs, tz);
    const month = norm.localMonth;
    const dayOfMonth = norm.localDay;
    const dayOfWeek = norm.dayOfWeek; // 0=Sunday, 1=Monday..6=Saturday
    const hour = norm.localHour; // 0..23
    const minute = norm.localMinute; // 0..59

    // 1. Determine Season from tariff_period_definition
    const seasonConfig = this.determineSeason(month, dayOfMonth, tariffPeriodDef.seasons);
    const seasonName = seasonConfig ? seasonConfig.season_name : "default";

    // 2. Determine Day Type and Holiday Treatment
    const holidayCheck = this.matchPublicHoliday(
      norm.localDate,
      dayOfWeek,
      evaluationMs,
      tz,
      tariffPeriodDef.public_holidays
    );

    let effectiveDayType: DayType;
    let holidayTreatment = "";

    if (holidayCheck.isHoliday && holidayCheck.holidayRule) {
      effectiveDayType = "public_holiday";
      holidayTreatment = holidayCheck.holidayRule.tou_treatment;
    } else if (dayOfWeek === 0) {
      effectiveDayType = "sunday";
    } else if (dayOfWeek === 6) {
      effectiveDayType = "saturday";
    } else {
      effectiveDayType = "weekday";
    }

    if (!seasonConfig) {
      return {
        timestamp_utc: norm.timestampUtc,
        timestamp_local: norm.localDateTimeString,
        timezone: tz,
        period: defaultPeriod,
        season: "unspecified",
        day_type: effectiveDayType,
        is_public_holiday: holidayCheck.isHoliday,
        holiday_name: holidayCheck.holidayRule?.name,
        rule_applied: "FALLBACK_NO_SEASON_DEFINED",
        calendar_id: tariffPeriodDef.calendar_id,
      };
    }

    // 3. Resolve Schedules for Day Type
    // If it's a public holiday, check holiday treatment rule from definition:
    let targetDayType: DayType = effectiveDayType;
    if (effectiveDayType === "public_holiday") {
      if (holidayTreatment === "sunday_schedule") {
        targetDayType = "sunday";
      } else if (holidayTreatment === "saturday_schedule") {
        targetDayType = "saturday";
      } else if (holidayTreatment === "weekday") {
        targetDayType = "weekday";
      } else if (holidayTreatment === "off_peak") {
        return {
          timestamp_utc: norm.timestampUtc,
          timestamp_local: norm.localDateTimeString,
          timezone: tz,
          period: "OFF-PEAK",
          season: seasonName,
          day_type: effectiveDayType,
          is_public_holiday: true,
          holiday_name: holidayCheck.holidayRule?.name,
          matched_window: { hour_start: 0, hour_end: 24, label: "Public Holiday Off-Peak" },
          rule_applied: `HOLIDAY_OFF_PEAK_TREATMENT (${holidayCheck.holidayRule?.name})`,
          calendar_id: tariffPeriodDef.calendar_id,
        };
      }
    }

    // Lookup day schedule in season definition
    let daySchedule = seasonConfig.schedules.find((s) => s.day_type === targetDayType);
    if (!daySchedule && targetDayType === "public_holiday") {
      // If public_holiday schedule is not explicitly declared, fallback to Sunday schedule
      daySchedule = seasonConfig.schedules.find((s) => s.day_type === "sunday");
    }

    if (!daySchedule || !daySchedule.windows || daySchedule.windows.length === 0) {
      return {
        timestamp_utc: norm.timestampUtc,
        timestamp_local: norm.localDateTimeString,
        timezone: tz,
        period: defaultPeriod,
        season: seasonName,
        day_type: effectiveDayType,
        is_public_holiday: holidayCheck.isHoliday,
        holiday_name: holidayCheck.holidayRule?.name,
        rule_applied: `FALLBACK_NO_DAY_SCHEDULE (${targetDayType})`,
        calendar_id: tariffPeriodDef.calendar_id,
      };
    }

    // 4. Match Time Window (supporting sub-hour minutes if defined)
    const currentMinuteOfDay = hour * 60 + minute;

    for (const win of daySchedule.windows) {
      const winStartMinute = win.hour_start * 60 + (win.minute_start ?? 0);
      const winEndMinute = win.hour_end * 60 + (win.minute_end ?? 0);

      if (currentMinuteOfDay >= winStartMinute && currentMinuteOfDay < winEndMinute) {
        const normalizedPeriod = this.normalizePeriod(win.period);
        return {
          timestamp_utc: norm.timestampUtc,
          timestamp_local: norm.localDateTimeString,
          timezone: tz,
          period: normalizedPeriod,
          season: seasonName,
          day_type: effectiveDayType,
          is_public_holiday: holidayCheck.isHoliday,
          holiday_name: holidayCheck.holidayRule?.name,
          matched_window: {
            hour_start: win.hour_start,
            hour_end: win.hour_end,
            minute_start: win.minute_start,
            minute_end: win.minute_end,
            label: win.label,
          },
          rule_applied: `CALENDAR_${tariffPeriodDef.calendar_id}:${seasonName.toUpperCase()}_${targetDayType.toUpperCase()}[${win.hour_start}:00-${win.hour_end}:00]`,
          calendar_id: tariffPeriodDef.calendar_id,
        };
      }
    }

    // Fallback if no specific window caught the minute
    return {
      timestamp_utc: norm.timestampUtc,
      timestamp_local: norm.localDateTimeString,
      timezone: tz,
      period: defaultPeriod,
      season: seasonName,
      day_type: effectiveDayType,
      is_public_holiday: holidayCheck.isHoliday,
      holiday_name: holidayCheck.holidayRule?.name,
      rule_applied: "FALLBACK_DEFAULT_PERIOD",
      calendar_id: tariffPeriodDef.calendar_id,
    };
  }

  /**
   * Map an array of interval records and calculate individual power factors and TOU periods.
   */
  public static mapIntervals(
    intervals: any[],
    tariffPeriodDef: TariffPeriodDefinition
  ): MappedTouIntervalRecord[] {
    return intervals.map((rec) => {
      const ts = rec.timestamp ?? rec.timestampUtc ?? rec.timestampLocal;
      const audit = this.mapTimestamp(ts, tariffPeriodDef);

      const kwh = rec.kWh ? new Decimal(String(rec.kWh)) : new Decimal(0);
      const kvah = rec.kVAh ? new Decimal(String(rec.kVAh)) : undefined;
      const kw = rec.kW ? new Decimal(String(rec.kW)) : new Decimal(0);
      const kva = rec.kVA ? new Decimal(String(rec.kVA)) : new Decimal(0);
      const kvarh = rec.kVArh ? new Decimal(String(rec.kVArh)) : new Decimal(0);

      let pfAudit: PowerFactorAuditRecord | undefined;
      try {
        pfAudit = PowerFactorEngine.calculatePowerFactor({
          kWh: kwh,
          kVAh: kvah,
          kW: kw,
          kVA: kva,
          kVArh: kvarh,
          source_power_factor: rec.power_factor ?? rec.pf,
        });
      } catch {
        // Leave undefined if registers are unavailable
      }

      return {
        timestampUtc: audit.timestamp_utc,
        timestampLocal: audit.timestamp_local,
        period: audit.period,
        season: audit.season,
        dayType: audit.day_type,
        kWh: kwh,
        kVAh: kvah,
        kW: kw,
        kVA: kva,
        kVArh: kvarh,
        powerFactorAudit: pfAudit,
        mappingAudit: audit,
      };
    });
  }

  /**
   * Aggregate intervals by TOU Period (PEAK, STANDARD, OFF-PEAK) with power factor verification.
   * Consumes tariff_period_definition and applies it to produce comprehensive energy and demand totals.
   */
  public static aggregateIntervalsByTou(
    intervals: any[],
    tariffPeriodDef: TariffPeriodDefinition
  ): TouConsumptionSummary {
    const mapped = this.mapIntervals(intervals, tariffPeriodDef);

    const aggregates: Record<
      TouPeriod,
      {
        kwh: Decimal;
        kvah: Decimal;
        kvarh: Decimal;
        maxKw: Decimal;
        maxKva: Decimal;
        count: number;
        intervals: any[];
      }
    > = {
      PEAK: {
        kwh: new Decimal(0),
        kvah: new Decimal(0),
        kvarh: new Decimal(0),
        maxKw: new Decimal(0),
        maxKva: new Decimal(0),
        count: 0,
        intervals: [],
      },
      STANDARD: {
        kwh: new Decimal(0),
        kvah: new Decimal(0),
        kvarh: new Decimal(0),
        maxKw: new Decimal(0),
        maxKva: new Decimal(0),
        count: 0,
        intervals: [],
      },
      "OFF-PEAK": {
        kwh: new Decimal(0),
        kvah: new Decimal(0),
        kvarh: new Decimal(0),
        maxKw: new Decimal(0),
        maxKva: new Decimal(0),
        count: 0,
        intervals: [],
      },
    };

    let totalKwh = new Decimal(0);
    let totalKvah = new Decimal(0);
    let totalKvarh = new Decimal(0);
    let systemPeakKw = new Decimal(0);
    let systemPeakKva = new Decimal(0);

    for (const m of mapped) {
      const agg = aggregates[m.period];
      agg.kwh = agg.kwh.plus(m.kWh);
      if (m.kVAh) agg.kvah = agg.kvah.plus(m.kVAh);
      agg.kvarh = agg.kvarh.plus(m.kVArh);
      if (m.kW.greaterThan(agg.maxKw)) agg.maxKw = m.kW;
      if (m.kVA.greaterThan(agg.maxKva)) agg.maxKva = m.kVA;
      agg.count += 1;
      agg.intervals.push(m);

      totalKwh = totalKwh.plus(m.kWh);
      if (m.kVAh) totalKvah = totalKvah.plus(m.kVAh);
      totalKvarh = totalKvarh.plus(m.kVArh);
      if (m.kW.greaterThan(systemPeakKw)) systemPeakKw = m.kW;
      if (m.kVA.greaterThan(systemPeakKva)) systemPeakKva = m.kVA;
    }

    // Build period summaries
    const buildPeriodSummary = (p: TouPeriod): TouPeriodAggregation => {
      const data = aggregates[p];
      const pct = totalKwh.isZero()
        ? new Decimal(0)
        : data.kwh.dividedBy(totalKwh).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Period power factor audit
      const pfAudit = PowerFactorEngine.calculatePowerFactor({
        kWh: data.kwh,
        kVAh: data.kvah.greaterThan(0) ? data.kvah : null,
        kW: data.maxKw,
        kVA: data.maxKva,
        kVArh: data.kvarh,
      });

      return {
        period: p,
        total_kwh: data.kwh,
        total_kvah: data.kvah,
        total_kvarh: data.kvarh,
        max_demand_kw: data.maxKw,
        max_demand_kva: data.maxKva,
        interval_count: data.count,
        percentage_of_total_kwh: pct,
        power_factor_audit: pfAudit,
      };
    };

    const overallPf = PowerFactorEngine.calculatePowerFactor({
      kWh: totalKwh,
      kVAh: totalKvah.greaterThan(0) ? totalKvah : null,
      kW: systemPeakKw,
      kVA: systemPeakKva,
      kVArh: totalKvarh,
    });

    return {
      calendar_id: tariffPeriodDef.calendar_id,
      tariff_code: tariffPeriodDef.tariff_code,
      timezone: tariffPeriodDef.timezone,
      total_active_kwh: totalKwh,
      total_apparent_kvah: totalKvah,
      total_reactive_kvarh: totalKvarh,
      system_peak_demand_kw: systemPeakKw,
      system_peak_demand_kva: systemPeakKva,
      overall_power_factor_audit: overallPf,
      by_period: {
        PEAK: buildPeriodSummary("PEAK"),
        STANDARD: buildPeriodSummary("STANDARD"),
        "OFF-PEAK": buildPeriodSummary("OFF-PEAK"),
      },
      total_intervals: mapped.length,
      mapped_intervals: mapped,
    };
  }
}
