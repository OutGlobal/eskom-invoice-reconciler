/**
 * RECONCILIATION ENGINE — REQUIREMENTS 10 & 11 TEST SUITE
 * ======================================================
 * Requirement 10: AMR Data Model (Interval vs Cumulative non-conflation)
 * Requirement 11: Timezone Normalization & Africa/Johannesburg handling
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import {
  AmrDataModelEngine,
  TimezoneNormalizationEngine,
  IntervalDataRecord,
  CumulativeReadingRecord,
} from "../../domain/reconciliation";
import { DeterministicCalendarEngine } from "../../domain/calendar/calendarEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";

describe("Requirement 10: AMR Data Model Support & Non-Conflation Principle", () => {
  it("should identify discrete Interval Data records with full electrical parameters", () => {
    const intervalRecords: IntervalDataRecord[] = [
      {
        timestamp: "2026-09-01T00:30:00Z",
        kwh: 120.5,
        kw: 241.0,
        kva: 260.0,
        kvarh: 45.0,
        kvar: 90.0,
        power_factor: 0.927,
      },
      {
        timestamp: "2026-09-01T01:00:00Z",
        kwh: 135.0,
        kw: 270.0,
        kva: 290.0,
        kvarh: 52.0,
        kvar: 104.0,
        power_factor: 0.931,
      },
    ];

    const classification = AmrDataModelEngine.identifyDataModel(intervalRecords);
    expect(classification.detectedModel).toBe("INTERVAL_DATA");
    expect(classification.isCumulativeMonotonic).toBe(false);
  });

  it("should identify Cumulative Meter Reading records and distinguish from interval streams", () => {
    const cumulativeRecords: CumulativeReadingRecord[] = [
      { timestamp: "2026-09-01T00:00:00Z", meter_reading: 105400.5, register_type: "TOTAL_ACTIVE_IMPORT_KWH" },
      { timestamp: "2026-09-01T00:30:00Z", meter_reading: 105425.0, register_type: "TOTAL_ACTIVE_IMPORT_KWH" },
      { timestamp: "2026-09-01T01:00:00Z", meter_reading: 105452.2, register_type: "TOTAL_ACTIVE_IMPORT_KWH" },
      { timestamp: "2026-09-01T01:30:00Z", meter_reading: 105480.0, register_type: "TOTAL_ACTIVE_IMPORT_KWH" },
    ];

    const classification = AmrDataModelEngine.identifyDataModel(cumulativeRecords);
    expect(classification.detectedModel).toBe("CUMULATIVE_METER_READINGS");
    expect(classification.isCumulativeMonotonic).toBe(true);
  });

  it("should NEVER sum cumulative meter readings directly as interval consumption", () => {
    const cumulativeRecords: CumulativeReadingRecord[] = [
      { timestamp: "2026-09-01T00:00:00Z", meter_reading: 50000.0, multiplier: 10 },
      { timestamp: "2026-09-01T00:30:00Z", meter_reading: 50015.0, multiplier: 10 }, // delta = 15 * 10 = 150 kWh
      { timestamp: "2026-09-01T01:00:00Z", meter_reading: 50035.0, multiplier: 10 }, // delta = 20 * 10 = 200 kWh
    ];

    // If incorrectly summed: 50000 + 50015 + 50035 = 150,050 (ERRONEOUS)
    // Correct derived consumption: (50035 - 50000) * 10 = 350 kWh
    const result = AmrDataModelEngine.deriveIntervalsFromCumulativeReadings(cumulativeRecords, 10);

    expect(result.netBilledConsumptionKwh.toNumber()).toBe(350);
    expect(result.derivedIntervalCount).toBe(2);
    expect(result.derivedIntervals[0].intervalKwh.toNumber()).toBe(150);
    expect(result.derivedIntervals[1].intervalKwh.toNumber()).toBe(200);
  });

  it("should handle cumulative meter register rollover safely when deriving interval consumption", () => {
    const rolloverRecords: CumulativeReadingRecord[] = [
      { timestamp: "2026-09-01T00:00:00Z", meter_reading: 999980.0, dial_digits: 6 },
      { timestamp: "2026-09-01T00:30:00Z", meter_reading: 999995.0, dial_digits: 6 }, // +15 kWh
      { timestamp: "2026-09-01T01:00:00Z", meter_reading: 10.0, dial_digits: 6 }, // Rollover wrap past 1,000,000 -> +15 kWh
    ];

    const result = AmrDataModelEngine.deriveIntervalsFromCumulativeReadings(rolloverRecords, 1, 6);

    expect(result.rolloverEventsDetected).toBe(1);
    expect(result.netBilledConsumptionKwh.toNumber()).toBe(30);
    expect(result.derivedIntervals[1].intervalKwh.toNumber()).toBe(15);
    expect(result.derivedIntervals[1].isRolloverAdjusted).toBe(true);
  });
});

describe("Requirement 11: Explicit Timezone Normalization & Africa/Johannesburg (SAST)", () => {
  it("should normalize naive timestamps to Africa/Johannesburg (UTC+02:00) without daylight savings drift", () => {
    // Naive local string: 08:00 on 1 September 2026
    const naiveStr = "2026-09-01 08:00:00";
    const norm = TimezoneNormalizationEngine.normalizeTimestamp(naiveStr);

    expect(norm.wasNaiveInput).toBe(true);
    expect(norm.timezone).toBe("Africa/Johannesburg");
    expect(norm.utcOffsetString).toBe("+02:00");
    expect(norm.localDate).toBe("2026-09-01");
    expect(norm.localTime).toBe("08:00:00");
    expect(norm.localHour).toBe(8);

    // In UTC, 08:00 SAST is 06:00:00.000Z
    expect(norm.timestampUtc).toBe("2026-09-01T06:00:00.000Z");
  });

  it("should correctly compare naive and timezone-aware timestamps with zero ambiguity", () => {
    const naiveLocal = "2026-09-01 10:00:00"; // 10:00 SAST = 08:00 UTC
    const awareUtc = "2026-09-01T08:00:00.000Z"; // 08:00 UTC
    const awareSast = "2026-09-01T10:00:00+02:00"; // 10:00 SAST

    expect(TimezoneNormalizationEngine.areEqualInstants(naiveLocal, awareUtc)).toBe(true);
    expect(TimezoneNormalizationEngine.areEqualInstants(naiveLocal, awareSast)).toBe(true);
    expect(TimezoneNormalizationEngine.areEqualInstants(awareUtc, awareSast)).toBe(true);
  });

  it("should map UTC timestamps accurately into SAST Peak TOU windows", () => {
    // Eskom Low Season Weekday Morning Peak is 07:00 to 10:00 SAST
    // UTC 05:30:00Z -> SAST 07:30:00 (Morning Peak)
    const peakUtc = "2026-09-01T05:30:00.000Z";
    const norm = TimezoneNormalizationEngine.normalizeTimestamp(peakUtc);
    expect(norm.localHour).toBe(7);
    expect(norm.localMinute).toBe(30);

    const classification = DeterministicCalendarEngine.classifyInterval(
      peakUtc,
      new Decimal(100),
      ESKOM_MEGAFLEX_2025_2026,
    );

    expect(classification.timezone).toBe("Africa/Johannesburg");
    expect(classification.season).toBe("low");
    expect(classification.day_type).toBe("weekday");
    expect(classification.tou_period).toBe("peak");
  });

  it("should map UTC timestamps accurately into SAST Off-Peak TOU windows", () => {
    // 23:30 UTC on Tuesday 1 Sep = 01:30 SAST on Wednesday 2 Sep (Off-Peak)
    const offPeakUtc = "2026-09-01T23:30:00.000Z";
    const classification = DeterministicCalendarEngine.classifyInterval(
      offPeakUtc,
      new Decimal(100),
      ESKOM_MEGAFLEX_2025_2026,
    );

    expect(classification.local_time).toBe("01:30:00");
    expect(classification.tou_period).toBe("off_peak");
  });
});
