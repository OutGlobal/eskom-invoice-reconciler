/**
 * ENERA TIMEZONE NORMALIZATION ENGINE (REQUIREMENT 11)
 * ===================================================
 * Explicit, deterministic timezone normalization and timestamp handling.
 *
 * TIMEZONE POLICY:
 *   - Primary utility timezone: "Africa/Johannesburg" (SAST, UTC+02:00, no DST).
 *   - Universal canonical storage: ISO 8601 UTC ("YYYY-MM-DDTHH:mm:ss.sssZ").
 *   - Local projection: Explicit wall-clock components for TOU and billing cycles.
 *   - Naive Guard: Never compares naive timestamps against timezone-aware timestamps
 *     without explicit normalisation.
 *   - Daylight-Saving Guard: Explicitly handles daylight-saving assumptions for future
 *     international use, guaranteeing zero DST contamination for South African utility data.
 */

export type TouPeriodCategory = "peak" | "standard" | "off_peak";

export interface NormalizedTimestamp {
  timestampUtc: string; // Canonical ISO 8601 UTC (e.g. "2026-09-01T04:00:00.000Z")
  epochMs: number;
  timezone: string; // e.g. "Africa/Johannesburg"
  localDate: string; // "YYYY-MM-DD" in local timezone
  localTime: string; // "HH:mm:ss" in local timezone
  localDateTimeString: string; // "YYYY-MM-DD HH:mm:ss"
  localYear: number;
  localMonth: number; // 1..12
  localDay: number; // 1..31
  localHour: number; // 0..23
  localMinute: number; // 0..59
  localSecond: number; // 0..59
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  utcOffsetMinutes: number; // +120 for SAST
  utcOffsetString: string; // "+02:00"
  wasNaiveInput: boolean;
  isDaylightSavingActive: boolean; // false for Africa/Johannesburg (no DST)
  observesDaylightSaving: boolean; // false for Africa/Johannesburg
}

export interface TouClassificationSummary {
  timestampUtc: string;
  localTime: string;
  localDate: string;
  season: "high" | "low";
  dayType: "weekday" | "saturday" | "sunday" | "public_holiday";
  touPeriod: TouPeriodCategory;
  timezone: string;
  isDaylightSavingActive: boolean;
  explanation: string;
}

export class TimezoneNormalizationEngine {
  public static readonly DEFAULT_TIMEZONE = "Africa/Johannesburg";
  public static readonly SAST_OFFSET_MINUTES = 120; // +02:00 (Fixed year-round)

  /**
   * Determine whether a timestamp input lacks timezone offset information (naive).
   */
  public static isNaiveTimestamp(input: string | number | Date): boolean {
    if (typeof input !== "string") return false;
    const trimmed = input.trim();
    const hasUtcZ = trimmed.endsWith("Z") || trimmed.endsWith("z");
    const hasOffset = /([+-]\d{2}:?\d{2})$/.test(trimmed);
    return !hasUtcZ && !hasOffset;
  }

  /**
   * Check if a timezone observes Daylight Saving Time (DST).
   * For Africa/Johannesburg (and SAST), this is ALWAYS false.
   */
  public static observesDaylightSaving(timezone: string = this.DEFAULT_TIMEZONE): boolean {
    const tzLower = timezone.toLowerCase();
    if (tzLower === "africa/johannesburg" || tzLower === "sast" || tzLower === "etc/gmt-2") {
      return false;
    }
    try {
      // Compare Jan 15 vs Jul 15 UTC offsets
      const janDate = new Date("2026-01-15T12:00:00Z");
      const julDate = new Date("2026-07-15T12:00:00Z");
      const offsetJan = this.getTimezoneOffsetMinutes(janDate, timezone);
      const offsetJul = this.getTimezoneOffsetMinutes(julDate, timezone);
      return offsetJan !== offsetJul;
    } catch {
      return false;
    }
  }

  /**
   * Compute exact UTC offset in minutes for a specific Date in a target timezone.
   */
  public static getTimezoneOffsetMinutes(date: Date, timezone: string = this.DEFAULT_TIMEZONE): number {
    const tzLower = timezone.toLowerCase();
    if (tzLower === "africa/johannesburg" || tzLower === "sast" || tzLower === "etc/gmt-2") {
      return this.SAST_OFFSET_MINUTES; // +120
    }
    if (tzLower === "utc" || tzLower === "etc/utc" || tzLower === "gmt") {
      return 0;
    }

    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(date);
      let year = 1970;
      let month = 1;
      let day = 1;
      let hour = 0;
      let minute = 0;
      let second = 0;

      for (const p of parts) {
        if (p.type === "year") year = parseInt(p.value, 10);
        else if (p.type === "month") month = parseInt(p.value, 10);
        else if (p.type === "day") day = parseInt(p.value, 10);
        else if (p.type === "hour") hour = parseInt(p.value, 10);
        else if (p.type === "minute") minute = parseInt(p.value, 10);
        else if (p.type === "second") second = parseInt(p.value, 10);
      }

      // Handle 24:00 edge case from some ICU formatters
      if (hour === 24) hour = 0;

      const localUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
      return Math.round((localUtcMs - date.getTime()) / 60000);
    } catch {
      // Fallback to SAST if unknown timezone
      return this.SAST_OFFSET_MINUTES;
    }
  }

  /**
   * Check if Daylight Saving Time is active for a given Date and timezone.
   */
  public static isDaylightSavingActive(date: Date, timezone: string = this.DEFAULT_TIMEZONE): boolean {
    if (!this.observesDaylightSaving(timezone)) {
      return false;
    }

    const currentOffset = this.getTimezoneOffsetMinutes(date, timezone);
    // Standard offset is usually the minimum offset (clocks shift forward during DST)
    const janOffset = this.getTimezoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), timezone);
    const julOffset = this.getTimezoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), timezone);
    const standardOffset = Math.min(janOffset, julOffset);

    return currentOffset > standardOffset;
  }

  /**
   * Parse and normalise any timestamp into canonical UTC + local wall-clock projection.
   * If a naive string is supplied (e.g. "2026-09-01 08:00:00" or "01/09/2026 08:00"),
   * it is treated as local wall-clock time in the designated utility timezone (default SAST).
   */
  public static normalizeTimestamp(
    input: string | number | Date,
    targetTimezone: string = this.DEFAULT_TIMEZONE,
  ): NormalizedTimestamp {
    let wasNaiveInput = false;
    let epochMs: number;

    if (typeof input === "number") {
      epochMs = input;
    } else if (input instanceof Date) {
      epochMs = input.getTime();
    } else if (typeof input === "string") {
      const trimmed = input.trim();
      wasNaiveInput = this.isNaiveTimestamp(trimmed);

      if (wasNaiveInput) {
        // Parse naive string as local wall-clock in target timezone (default SAST = UTC+2)
        epochMs = this.parseNaiveWallClock(trimmed, targetTimezone);
      } else {
        const parsed = new Date(trimmed);
        if (isNaN(parsed.getTime())) {
          throw new Error(`Invalid unparseable timestamp: '${input}'`);
        }
        epochMs = parsed.getTime();
      }
    } else {
      throw new Error(`Unsupported timestamp input type: ${typeof input}`);
    }

    if (isNaN(epochMs)) {
      throw new Error(`Invalid resulting epoch timestamp from input: '${input}'`);
    }

    const dateObj = new Date(epochMs);
    const offsetMinutes = this.getTimezoneOffsetMinutes(dateObj, targetTimezone);
    const isDst = this.isDaylightSavingActive(dateObj, targetTimezone);
    const observesDst = this.observesDaylightSaving(targetTimezone);

    // Wall-clock components in target timezone
    const localMs = epochMs + offsetMinutes * 60 * 1000;
    const localDateObj = new Date(localMs);

    const year = localDateObj.getUTCFullYear();
    const month = localDateObj.getUTCMonth() + 1;
    const day = localDateObj.getUTCDate();
    const dow = localDateObj.getUTCDay();
    const hour = localDateObj.getUTCHours();
    const minute = localDateObj.getUTCMinutes();
    const second = localDateObj.getUTCSeconds();

    const localDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const localTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
    const localDateTimeString = `${localDate} ${localTime}`;

    // Offset string format: e.g. "+02:00" or "-05:00"
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = Math.floor(absOffset / 60);
    const offsetMins = absOffset % 60;
    const utcOffsetString = `${sign}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;

    return {
      timestampUtc: dateObj.toISOString(),
      epochMs,
      timezone: targetTimezone,
      localDate,
      localTime,
      localDateTimeString,
      localYear: year,
      localMonth: month,
      localDay: day,
      localHour: hour,
      localMinute: minute,
      localSecond: second,
      dayOfWeek: dow,
      utcOffsetMinutes: offsetMinutes,
      utcOffsetString,
      wasNaiveInput,
      isDaylightSavingActive: isDst,
      observesDaylightSaving: observesDst,
    };
  }

  /**
   * Safe comparison between two timestamps (handles naive vs aware automatically).
   * Never compares naive timestamps against timezone-aware timestamps without normalisation.
   * Returns:
   *   < 0 if a < b
   *   0 if a == b
   *   > 0 if a > b
   */
  public static compareTimestamps(
    a: string | number | Date,
    b: string | number | Date,
    defaultTimezone: string = this.DEFAULT_TIMEZONE,
  ): number {
    const normA = this.normalizeTimestamp(a, defaultTimezone);
    const normB = this.normalizeTimestamp(b, defaultTimezone);
    return normA.epochMs - normB.epochMs;
  }

  /**
   * Verify if two timestamps represent the exact same instant regardless of notation.
   */
  public static areEqualInstants(
    a: string | number | Date,
    b: string | number | Date,
    defaultTimezone: string = this.DEFAULT_TIMEZONE,
  ): boolean {
    return this.compareTimestamps(a, b, defaultTimezone) === 0;
  }

  /**
   * Classify South African Eskom/Municipal Time-Of-Use (TOU) Period explicitly.
   * Correctly projects UTC into Africa/Johannesburg (UTC+2) with zero DST drift.
   */
  public static classifySastTouPeriod(
    timestamp: string | number | Date,
    seasonOverride?: "high" | "low",
    dayTypeOverride?: "weekday" | "saturday" | "sunday" | "public_holiday",
  ): TouClassificationSummary {
    const norm = this.normalizeTimestamp(timestamp, this.DEFAULT_TIMEZONE);

    // Resolve season (High: June, July, August / Low: Sept-May)
    const season = seasonOverride ?? (norm.localMonth >= 6 && norm.localMonth <= 8 ? "high" : "low");

    // Resolve day type
    let dayType: "weekday" | "saturday" | "sunday" | "public_holiday" = "weekday";
    if (dayTypeOverride) {
      dayType = dayTypeOverride;
    } else if (norm.dayOfWeek === 0) {
      dayType = "sunday";
    } else if (norm.dayOfWeek === 6) {
      dayType = "saturday";
    }

    let touPeriod: TouPeriodCategory = "off_peak";
    let explanation = "";

    if (dayType === "sunday") {
      touPeriod = "off_peak";
      explanation = "Sundays are 100% Off-Peak in standard Eskom TOU schedules.";
    } else if (dayType === "saturday") {
      // Standard: 07:00-12:00 and 18:00-20:00 SAST
      if ((norm.localHour >= 7 && norm.localHour < 12) || (norm.localHour >= 18 && norm.localHour < 20)) {
        touPeriod = "standard";
        explanation = `Saturday hour ${norm.localHour}:00 is in the Standard window (07:00-12:00, 18:00-20:00 SAST).`;
      } else {
        touPeriod = "off_peak";
        explanation = `Saturday hour ${norm.localHour}:00 is outside Standard windows -> Off-Peak.`;
      }
    } else {
      // Weekdays
      if (season === "high") {
        // High Season (Jun-Aug):
        // Peak: 06:00-09:00, 17:00-19:00
        // Standard: 09:00-17:00, 19:00-22:00
        // Off-Peak: 22:00-06:00
        if ((norm.localHour >= 6 && norm.localHour < 9) || (norm.localHour >= 17 && norm.localHour < 19)) {
          touPeriod = "peak";
          explanation = `High Season Weekday Peak (06:00-09:00 or 17:00-19:00 SAST, hour ${norm.localHour}:00).`;
        } else if (
          (norm.localHour >= 9 && norm.localHour < 17) ||
          (norm.localHour >= 19 && norm.localHour < 22)
        ) {
          touPeriod = "standard";
          explanation = `High Season Weekday Standard (09:00-17:00 or 19:00-22:00 SAST, hour ${norm.localHour}:00).`;
        } else {
          touPeriod = "off_peak";
          explanation = `High Season Weekday Off-Peak (22:00-06:00 SAST, hour ${norm.localHour}:00).`;
        }
      } else {
        // Low Season (Sep-May):
        // Peak: 07:00-10:00, 18:00-20:00
        // Standard: 06:00-07:00, 10:00-18:00, 20:00-22:00
        // Off-Peak: 22:00-06:00
        if ((norm.localHour >= 7 && norm.localHour < 10) || (norm.localHour >= 18 && norm.localHour < 20)) {
          touPeriod = "peak";
          explanation = `Low Season Weekday Peak (07:00-10:00 or 18:00-20:00 SAST, hour ${norm.localHour}:00).`;
        } else if (
          (norm.localHour >= 6 && norm.localHour < 7) ||
          (norm.localHour >= 10 && norm.localHour < 18) ||
          (norm.localHour >= 20 && norm.localHour < 22)
        ) {
          touPeriod = "standard";
          explanation = `Low Season Weekday Standard (06:00-07:00, 10:00-18:00, or 20:00-22:00 SAST, hour ${norm.localHour}:00).`;
        } else {
          touPeriod = "off_peak";
          explanation = `Low Season Weekday Off-Peak (22:00-06:00 SAST, hour ${norm.localHour}:00).`;
        }
      }
    }

    return {
      timestampUtc: norm.timestampUtc,
      localTime: norm.localTime,
      localDate: norm.localDate,
      season,
      dayType,
      touPeriod,
      timezone: this.DEFAULT_TIMEZONE,
      isDaylightSavingActive: norm.isDaylightSavingActive,
      explanation,
    };
  }

  /**
   * Internal helper to parse naive string as local wall-clock in target timezone.
   */
  private static parseNaiveWallClock(naiveStr: string, timezone: string): number {
    let year = 1970;
    let month = 1;
    let day = 1;
    let hour = 0;
    let minute = 0;
    let second = 0;

    // Pattern 1: ISO-like YYYY-MM-DD or YYYY/MM/DD [T| ]HH:mm:ss
    const isoMatch = naiveStr.match(
      /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
    );
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
      hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
      minute = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
      second = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    } else {
      // Pattern 2: DD/MM/YYYY HH:mm:ss
      const dmyMatch = naiveStr.match(
        /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
      );
      if (dmyMatch) {
        day = parseInt(dmyMatch[1], 10);
        month = parseInt(dmyMatch[2], 10);
        year = parseInt(dmyMatch[3], 10);
        hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
        minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
        second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
      } else {
        // Fallback: parse naive string
        const fallback = new Date(naiveStr);
        if (isNaN(fallback.getTime())) {
          throw new Error(`Cannot parse naive datetime string: '${naiveStr}'`);
        }
        year = fallback.getFullYear();
        month = fallback.getMonth() + 1;
        day = fallback.getDate();
        hour = fallback.getHours();
        minute = fallback.getMinutes();
        second = fallback.getSeconds();
      }
    }

    const localUtcEpoch = Date.UTC(year, month - 1, day, hour, minute, second);

    if (
      timezone.toLowerCase() === "africa/johannesburg" ||
      timezone.toLowerCase() === "sast" ||
      timezone.toLowerCase() === "etc/gmt-2"
    ) {
      // SAST is fixed UTC+2 without DST
      return localUtcEpoch - this.SAST_OFFSET_MINUTES * 60 * 1000;
    }

    // International timezone: determine offset at approximate UTC instant
    const approxDate = new Date(localUtcEpoch);
    const offsetMinutes = this.getTimezoneOffsetMinutes(approxDate, timezone);
    return localUtcEpoch - offsetMinutes * 60 * 1000;
  }
}
