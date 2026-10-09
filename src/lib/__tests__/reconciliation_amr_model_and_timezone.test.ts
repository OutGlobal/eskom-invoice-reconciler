/**
 * RECONCILIATION ENGINE — REQUIREMENTS 10 & 11 TEST SUITE
 * ======================================================
 * Requirement 10: AMR DATA MODEL
 *   - Interval Data: timestamp, kWh, kW, kVA, kVArh, kVAr, power_factor
 *   - Cumulative Meter Readings: timestamp, meter_reading
 *   - Identification of which type is being processed
 *   - Strict Non-Conflation Principle: Do not treat cumulative readings as interval consumption
 *
 * Requirement 11: TIMEZONE
 *   - Explicit time handling
 *   - Support for Africa/Johannesburg (SAST, UTC+02:00, no DST)
 *   - Consistent UTC canonical timestamp storage
 *   - Never compare naive timestamps against timezone-aware timestamps without normalisation
 *   - Correct TOU window mapping (Peak, Standard, Off-Peak)
 *   - Robust daylight-saving assumptions for future international use
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
import { TouScheduleEngine } from "../../domain/tariff/touScheduleEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";

describe("Requirement 10: AMR DATA MODEL", () => {
  describe("Interval Data: timestamp, kWh, kW, kVA, kVArh, kVAr, power_factor", () => {
    it("should accept and validate discrete Interval Data with exact canonical field casing", () => {
      const records: IntervalDataRecord[] = [
        {
          timestamp: "2026-09-01T06:30:00Z",
          kWh: 150.25,
          kW: 300.5,
          kVA: 320.0,
          kVArh: 55.4,
          kVAr: 110.8,
          power_factor: 0.939,
        },
        {
          timestamp: "2026-09-01T07:00:00Z",
          kWh: 175.8,
          kW: 351.6,
          kVA: 375.0,
          kVArh: 62.1,
          kVAr: 124.2,
          power_factor: 0.938,
        },
      ];

      const identification = AmrDataModelEngine.identifyDataModel(records);
      expect(identification.detectedModel).toBe("INTERVAL_DATA");
      expect(identification.confidence).toBeGreaterThanOrEqual(0.9);
      expect(identification.fieldSignatures.hasKwh).toBe(true);
      expect(identification.fieldSignatures.hasKw).toBe(true);
      expect(identification.fieldSignatures.hasKva).toBe(true);
      expect(identification.fieldSignatures.hasKvarh).toBe(true);
      expect(identification.fieldSignatures.hasKvar).toBe(true);
      expect(identification.fieldSignatures.hasPowerFactor).toBe(true);
      expect(identification.isCumulativeMonotonic).toBe(false);

      const normalized = AmrDataModelEngine.normalizeIntervalData(records);
      expect(normalized).toHaveLength(2);
      expect(normalized[0].kWh.toNumber()).toBe(150.25);
      expect(normalized[0].kW.toNumber()).toBe(300.5);
      expect(normalized[0].kVA.toNumber()).toBe(320.0);
      expect(normalized[0].kVArh.toNumber()).toBe(55.4);
      expect(normalized[0].kVAr.toNumber()).toBe(110.8);
      expect(normalized[0].power_factor.toNumber()).toBe(0.939);
    });

    it("should correctly identify Interval Data with case-tolerant aliases (kwh, kw, kva, etc.)", () => {
      const records: IntervalDataRecord[] = [
        {
          timestamp: "2026-09-01T00:30:00Z",
          kwh: 120.5,
          kw: 241.0,
          kva: 260.0,
          kvarh: 45.0,
          kvar: 90.0,
          power_factor: 0.927,
        },
      ];

      const identification = AmrDataModelEngine.identifyDataModel(records);
      expect(identification.detectedModel).toBe("INTERVAL_DATA");
      expect(identification.fieldSignatures.hasKwh).toBe(true);
      expect(identification.fieldSignatures.hasKw).toBe(true);
    });
  });

  describe("Cumulative Meter Readings: timestamp, meter_reading", () => {
    it("should accept and identify continuous Cumulative Meter Readings with exact canonical field", () => {
      const records: CumulativeReadingRecord[] = [
        { timestamp: "2026-09-01T00:00:00Z", meter_reading: 105400.5 },
        { timestamp: "2026-09-01T00:30:00Z", meter_reading: 105425.0 },
        { timestamp: "2026-09-01T01:00:00Z", meter_reading: 105452.2 },
        { timestamp: "2026-09-01T01:30:00Z", meter_reading: 105480.0 },
      ];

      const identification = AmrDataModelEngine.identifyDataModel(records);
      expect(identification.detectedModel).toBe("CUMULATIVE_METER_READINGS");
      expect(identification.fieldSignatures.hasMeterReading).toBe(true);
      expect(identification.fieldSignatures.hasKw).toBe(false);
      expect(identification.isCumulativeMonotonic).toBe(true);
      expect(identification.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it("should detect monotonically non-decreasing dial counters even with large baseline magnitudes", () => {
      const highDialRecords = [
        { timestamp: "2026-09-01 00:00", meter_reading: "542310.0" },
        { timestamp: "2026-09-01 00:30", meter_reading: "542335.5" },
        { timestamp: "2026-09-01 01:00", meter_reading: "542360.2" },
      ];

      const identification = AmrDataModelEngine.identifyDataModel(highDialRecords);
      expect(identification.detectedModel).toBe("CUMULATIVE_METER_READINGS");
      expect(identification.isCumulativeMonotonic).toBe(true);
    });
  });

  describe("Non-Conflation Principle: Do not treat cumulative readings as interval consumption", () => {
    it("should throw an explicit error if cumulative readings are passed to assertNotCumulativeConflation", () => {
      const cumulativeRecords: CumulativeReadingRecord[] = [
        { timestamp: "2026-09-01T00:00:00Z", meter_reading: 50000.0 },
        { timestamp: "2026-09-01T00:30:00Z", meter_reading: 50015.0 },
      ];

      expect(() => {
        AmrDataModelEngine.assertNotCumulativeConflation(cumulativeRecords, "billingSummation");
      }).toThrow(/Non-Conflation Violation/i);
    });

    it("should NEVER sum cumulative meter readings directly as interval consumption", () => {
      const cumulativeRecords: CumulativeReadingRecord[] = [
        { timestamp: "2026-09-01T00:00:00Z", meter_reading: 50000.0, multiplier: 10 },
        { timestamp: "2026-09-01T00:30:00Z", meter_reading: 50015.0, multiplier: 10 }, // delta = 15 * 10 = 150 kWh
        { timestamp: "2026-09-01T01:00:00Z", meter_reading: 50035.0, multiplier: 10 }, // delta = 20 * 10 = 200 kWh
      ];

      // Direct erroneous summation would be: 50000 + 50015 + 50035 = 150,050 kWh
      // Correct delta consumption is: (50035 - 50000) * 10 = 350 kWh
      const result = AmrDataModelEngine.deriveIntervalsFromCumulativeReadings(cumulativeRecords, 10);

      expect(result.netBilledConsumptionKwh.toNumber()).toBe(350);
      expect(result.derivedIntervalCount).toBe(2);
      expect(result.derivedIntervals[0].intervalKwh.toNumber()).toBe(150);
      expect(result.derivedIntervals[1].intervalKwh.toNumber()).toBe(200);
      expect(result.netBilledConsumptionKwh.toNumber()).not.toBe(150050);
    });

    it("should safely handle cumulative register rollover wrap-around (e.g. 999980 -> 10)", () => {
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

    it("should safely process full dataset via processDataset() enforcing non-conflation", () => {
      const cumulativeRecords: CumulativeReadingRecord[] = [
        { timestamp: "2026-09-01T00:00:00Z", meter_reading: 10000 },
        { timestamp: "2026-09-01T00:30:00Z", meter_reading: 10025 },
        { timestamp: "2026-09-01T01:00:00Z", meter_reading: 10055 },
      ];

      const processed = AmrDataModelEngine.processDataset(cumulativeRecords, { defaultMultiplier: 1.0 });

      expect(processed.dataModel).toBe("CUMULATIVE_METER_READINGS");
      expect(processed.isCumulativeConflationPrevented).toBe(true);
      expect(processed.summary.totalActiveKwh.toNumber()).toBe(55); // (10055 - 10000) = 55 kWh
      expect(processed.intervals).toHaveLength(2);
      expect(processed.intervals[0].kWh.toNumber()).toBe(25);
      expect(processed.intervals[1].kWh.toNumber()).toBe(30);
    });
  });
});

describe("Requirement 11: TIMEZONE", () => {
  describe("Explicit time handling & Africa/Johannesburg (SAST)", () => {
    it("should support Africa/Johannesburg with UTC+02:00 fixed offset and zero DST drift", () => {
      const summerDate = "2026-01-15T12:00:00Z"; // January (Southern Hemisphere Summer)
      const winterDate = "2026-07-15T12:00:00Z"; // July (Southern Hemisphere Winter)

      const normSummer = TimezoneNormalizationEngine.normalizeTimestamp(summerDate, "Africa/Johannesburg");
      const normWinter = TimezoneNormalizationEngine.normalizeTimestamp(winterDate, "Africa/Johannesburg");

      expect(normSummer.timezone).toBe("Africa/Johannesburg");
      expect(normSummer.utcOffsetMinutes).toBe(120);
      expect(normSummer.utcOffsetString).toBe("+02:00");
      expect(normSummer.isDaylightSavingActive).toBe(false);
      expect(normSummer.observesDaylightSaving).toBe(false);

      expect(normWinter.timezone).toBe("Africa/Johannesburg");
      expect(normWinter.utcOffsetMinutes).toBe(120);
      expect(normWinter.utcOffsetString).toBe("+02:00");
      expect(normWinter.isDaylightSavingActive).toBe(false);
      expect(normWinter.observesDaylightSaving).toBe(false);
    });

    it("should store timestamps consistently in ISO 8601 UTC with Z suffix", () => {
      const inputs = [
        "2026-09-01 08:30:00",
        "2026-09-01T08:30:00+02:00",
        "2026-09-01T06:30:00.000Z",
      ];

      for (const input of inputs) {
        const norm = TimezoneNormalizationEngine.normalizeTimestamp(input, "Africa/Johannesburg");
        expect(norm.timestampUtc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(norm.timestampUtc).toBe("2026-09-01T06:30:00.000Z");
        expect(norm.epochMs).toBe(new Date("2026-09-01T06:30:00.000Z").getTime());
      }
    });
  });

  describe("Never compare naive timestamps against timezone-aware timestamps without normalisation", () => {
    it("should correctly identify naive vs aware timestamps", () => {
      expect(TimezoneNormalizationEngine.isNaiveTimestamp("2026-09-01 08:00:00")).toBe(true);
      expect(TimezoneNormalizationEngine.isNaiveTimestamp("2026-09-01T08:00:00")).toBe(true);
      expect(TimezoneNormalizationEngine.isNaiveTimestamp("01/09/2026 08:00")).toBe(true);

      expect(TimezoneNormalizationEngine.isNaiveTimestamp("2026-09-01T08:00:00Z")).toBe(false);
      expect(TimezoneNormalizationEngine.isNaiveTimestamp("2026-09-01T08:00:00+02:00")).toBe(false);
      expect(TimezoneNormalizationEngine.isNaiveTimestamp("2026-09-01T06:00:00.000Z")).toBe(false);
    });

    it("should normalize naive timestamps before comparison to prevent false equality", () => {
      // Local wall-clock in SAST (UTC+2) is 10:00
      const naiveLocal = "2026-09-01 10:00:00";
      // 10:00 in SAST equals 08:00:00 UTC
      const awareMatchingUtc = "2026-09-01T08:00:00.000Z";
      // 10:00:00 UTC would be 12:00:00 SAST (DIFFERENT instant)
      const awareDifferentUtc = "2026-09-01T10:00:00.000Z";

      // With explicit normalisation:
      expect(TimezoneNormalizationEngine.areEqualInstants(naiveLocal, awareMatchingUtc)).toBe(true);
      expect(TimezoneNormalizationEngine.areEqualInstants(naiveLocal, awareDifferentUtc)).toBe(false);

      expect(TimezoneNormalizationEngine.compareTimestamps(naiveLocal, awareMatchingUtc)).toBe(0);
      expect(TimezoneNormalizationEngine.compareTimestamps(naiveLocal, awareDifferentUtc)).toBeLessThan(0);
    });
  });

  describe("Time-Of-Use (TOU) Period Mapping: Peak, Standard, Off-Peak", () => {
    it("should map UTC timestamps accurately into SAST Low Season Weekday Peak windows (07:00-10:00 & 18:00-20:00)", () => {
      // 05:30 UTC = 07:30 SAST (Morning Peak)
      const morningPeakUtc = "2026-09-01T05:30:00.000Z";
      const morningClassification = TimezoneNormalizationEngine.classifySastTouPeriod(morningPeakUtc, "low", "weekday");
      expect(morningClassification.localTime).toBe("07:30:00");
      expect(morningClassification.touPeriod).toBe("peak");

      // 16:30 UTC = 18:30 SAST (Evening Peak)
      const eveningPeakUtc = "2026-09-01T16:30:00.000Z";
      const eveningClassification = TimezoneNormalizationEngine.classifySastTouPeriod(eveningPeakUtc, "low", "weekday");
      expect(eveningClassification.localTime).toBe("18:30:00");
      expect(eveningClassification.touPeriod).toBe("peak");
    });

    it("should map UTC timestamps accurately into SAST Low Season Weekday Standard windows", () => {
      // 10:00 UTC = 12:00 SAST (Standard period: 10:00-18:00)
      const standardUtc = "2026-09-01T10:00:00.000Z";
      const classification = TimezoneNormalizationEngine.classifySastTouPeriod(standardUtc, "low", "weekday");
      expect(classification.localTime).toBe("12:00:00");
      expect(classification.touPeriod).toBe("standard");
    });

    it("should map UTC timestamps accurately into SAST Off-Peak windows (22:00-06:00 and all Sunday)", () => {
      // 23:30 UTC on Tuesday = 01:30 SAST on Wednesday (Off-Peak)
      const offPeakUtc = "2026-09-01T23:30:00.000Z";
      const weekdayOffPeak = TimezoneNormalizationEngine.classifySastTouPeriod(offPeakUtc, "low", "weekday");
      expect(weekdayOffPeak.localTime).toBe("01:30:00");
      expect(weekdayOffPeak.touPeriod).toBe("off_peak");

      // Sunday 12:00 SAST (10:00 UTC) -> 100% Off-Peak
      const sundayUtc = "2026-09-06T10:00:00.000Z";
      const sundayClassification = TimezoneNormalizationEngine.classifySastTouPeriod(sundayUtc, "low", "sunday");
      expect(sundayClassification.touPeriod).toBe("off_peak");
    });

    it("should map High Season Weekday Peak windows (06:00-09:00 & 17:00-19:00 SAST)", () => {
      // 04:30 UTC in July = 06:30 SAST (High Season Morning Peak)
      const highMorningPeak = "2026-07-15T04:30:00.000Z";
      const classification = TimezoneNormalizationEngine.classifySastTouPeriod(highMorningPeak, "high", "weekday");
      expect(classification.localTime).toBe("06:30:00");
      expect(classification.touPeriod).toBe("peak");
    });

    it("should classify TOU periods deterministically via TouScheduleEngine without host-machine timezone dependency", () => {
      // 05:30 UTC on 1 Sep 2026 (Low Season Weekday) = 07:30 SAST -> Peak
      const dateUtc = new Date("2026-09-01T05:30:00.000Z");
      const touPeriod = TouScheduleEngine.resolveTouPeriod(dateUtc, ESKOM_MEGAFLEX_2025_2026);
      expect(touPeriod).toBe("peak");

      // 10:00 UTC on 1 Sep 2026 = 12:00 SAST -> Standard
      const dateStdUtc = new Date("2026-09-01T10:00:00.000Z");
      const touPeriodStd = TouScheduleEngine.resolveTouPeriod(dateStdUtc, ESKOM_MEGAFLEX_2025_2026);
      expect(touPeriodStd).toBe("standard");
    });
  });

  describe("Daylight-saving assumptions in future international use", () => {
    it("should ensure Africa/Johannesburg NEVER assumes daylight saving time", () => {
      expect(TimezoneNormalizationEngine.observesDaylightSaving("Africa/Johannesburg")).toBe(false);
      expect(TimezoneNormalizationEngine.observesDaylightSaving("SAST")).toBe(false);
    });

    it("should correctly detect daylight saving in international timezones without leaking to South Africa", () => {
      // Europe/London observes British Summer Time (BST, UTC+1) in summer and GMT (UTC+0) in winter
      expect(TimezoneNormalizationEngine.observesDaylightSaving("Europe/London")).toBe(true);

      const londonSummer = new Date("2026-07-15T12:00:00Z");
      const londonWinter = new Date("2026-01-15T12:00:00Z");

      expect(TimezoneNormalizationEngine.isDaylightSavingActive(londonSummer, "Europe/London")).toBe(true);
      expect(TimezoneNormalizationEngine.isDaylightSavingActive(londonWinter, "Europe/London")).toBe(false);

      expect(TimezoneNormalizationEngine.getTimezoneOffsetMinutes(londonSummer, "Europe/London")).toBe(60);
      expect(TimezoneNormalizationEngine.getTimezoneOffsetMinutes(londonWinter, "Europe/London")).toBe(0);

      // Meanwhile, Africa/Johannesburg remains strictly UTC+120 with NO daylight saving on both dates
      expect(TimezoneNormalizationEngine.getTimezoneOffsetMinutes(londonSummer, "Africa/Johannesburg")).toBe(120);
      expect(TimezoneNormalizationEngine.getTimezoneOffsetMinutes(londonWinter, "Africa/Johannesburg")).toBe(120);
      expect(TimezoneNormalizationEngine.isDaylightSavingActive(londonSummer, "Africa/Johannesburg")).toBe(false);
      expect(TimezoneNormalizationEngine.isDaylightSavingActive(londonWinter, "Africa/Johannesburg")).toBe(false);
    });

    it("should correctly handle US Eastern Time DST transitions", () => {
      expect(TimezoneNormalizationEngine.observesDaylightSaving("America/New_York")).toBe(true);

      const nySummer = new Date("2026-07-15T12:00:00Z");
      const nyWinter = new Date("2026-01-15T12:00:00Z");

      expect(TimezoneNormalizationEngine.isDaylightSavingActive(nySummer, "America/New_York")).toBe(true);
      expect(TimezoneNormalizationEngine.isDaylightSavingActive(nyWinter, "America/New_York")).toBe(false);

      expect(TimezoneNormalizationEngine.getTimezoneOffsetMinutes(nySummer, "America/New_York")).toBe(-240); // EDT UTC-4
      expect(TimezoneNormalizationEngine.getTimezoneOffsetMinutes(nyWinter, "America/New_York")).toBe(-300); // EST UTC-5
    });
  });
});
