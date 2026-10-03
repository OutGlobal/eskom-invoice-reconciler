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
 */

export interface NormalizedTimestamp {
  timestampUtc: string; // Canonical ISO 8601 UTC (e.g. "2026-09-01T04:00:00.000Z")
  epochMs: number;
  timezone: string; // e.g. "Africa/Johannesburg"
  localDate: string; // "YYYY-MM-DD" in local timezone
  localTime: string; // "HH:mm:ss" in local timezone
  localDateTimeString: string; // "YYYY-MM-DD HH:mm:ss"
  localHour: number; // 0..23
  localMinute: number; // 0..59
  localSecond: number; // 0..59
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  utcOffsetMinutes: number; // +120 for SAST
  utcOffsetString: string; // "+02:00"
  wasNaiveInput: boolean;
}

export class TimezoneNormalizationEngine {
  public static readonly DEFAULT_TIMEZONE = "Africa/Johannesburg";
  public static readonly SAST_OFFSET_MINUTES = 120; // +02:00

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

      // Check if timestamp is naive (no 'Z' and no '+' or '-' timezone offset at end)
      const hasUtcZ = trimmed.endsWith("Z") || trimmed.endsWith("z");
      const hasOffset = /([+-]\d{2}:?\d{2})$/.test(trimmed);

      if (!hasUtcZ && !hasOffset) {
        wasNaiveInput = true;
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

    // SAST projection (+120 minutes = +7200000 ms)
    const sastMs = epochMs + this.SAST_OFFSET_MINUTES * 60 * 1000;
    const sastDate = new Date(sastMs);

    const year = sastDate.getUTCFullYear();
    const month = sastDate.getUTCMonth() + 1;
    const day = sastDate.getUTCDate();
    const dow = sastDate.getUTCDay();
    const hour = sastDate.getUTCHours();
    const minute = sastDate.getUTCMinutes();
    const second = sastDate.getUTCSeconds();

    const localDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const localTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
    const localDateTimeString = `${localDate} ${localTime}`;

    return {
      timestampUtc: new Date(epochMs).toISOString(),
      epochMs,
      timezone: targetTimezone,
      localDate,
      localTime,
      localDateTimeString,
      localHour: hour,
      localMinute: minute,
      localSecond: second,
      dayOfWeek: dow,
      utcOffsetMinutes: this.SAST_OFFSET_MINUTES,
      utcOffsetString: "+02:00",
      wasNaiveInput,
    };
  }

  /**
   * Safe comparison between two timestamps (handles naive vs aware automatically).
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
   * Internal helper to parse naive string as local wall-clock in SAST (UTC+2).
   */
  private static parseNaiveWallClock(naiveStr: string, timezone: string): number {
    // Normalise separators: 2026/09/01 or 01/09/2026 or 2026-09-01
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
        // Fallback to standard Date.parse
        const fallback = new Date(naiveStr);
        if (isNaN(fallback.getTime())) {
          throw new Error(`Cannot parse naive datetime string: '${naiveStr}'`);
        }
        return fallback.getTime();
      }
    }

    // Convert local wall-clock in SAST (UTC+2) to UTC Epoch
    // UTC Epoch = Date.UTC(year, month - 1, day, hour, minute, second) - 2 hours
    const localUtcEpoch = Date.UTC(year, month - 1, day, hour, minute, second);
    const offsetMs = this.SAST_OFFSET_MINUTES * 60 * 1000;
    return localUtcEpoch - offsetMs;
  }
}
