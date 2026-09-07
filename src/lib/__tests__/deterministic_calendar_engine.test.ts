import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { DeterministicCalendarEngine, DEFAULT_SA_HOLIDAYS } from "@/domain/calendar/calendarEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "@/domain/tariff/tariffFixtures";

describe("Deterministic Configurable Calendar & TOU Engine", () => {
  it("should classify High Season Weekday Peak, Standard, and Off-Peak hours correctly", () => {
    // July 2, 2025 is a Wednesday (High Season)
    // 07:00 SAST (05:00 UTC) -> High Season Peak (06:00 - 09:00)
    const resPeak = DeterministicCalendarEngine.classifyInterval("2025-07-02T05:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resPeak.season).toBe("high");
    expect(resPeak.day_type).toBe("weekday");
    expect(resPeak.tou_period).toBe("peak");
    expect(resPeak.applicable_rate.toNumber()).toBe(666.92);

    // 11:00 SAST (09:00 UTC) -> High Season Standard (09:00 - 17:00)
    const resStd = DeterministicCalendarEngine.classifyInterval("2025-07-02T09:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resStd.tou_period).toBe("standard");
    expect(resStd.applicable_rate.toNumber()).toBe(198.84);

    // 23:00 SAST (21:00 UTC) -> High Season Off-Peak (22:00 - 06:00)
    const resOff = DeterministicCalendarEngine.classifyInterval("2025-07-02T21:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resOff.tou_period).toBe("off_peak");
    expect(resOff.applicable_rate.toNumber()).toBe(111.15);
  });

  it("should classify Low Season Weekday Peak and Standard hours correctly", () => {
    // October 15, 2025 is a Wednesday (Low Season)
    // 08:00 SAST (06:00 UTC) -> Low Season Peak (07:00 - 10:00)
    const resPeak = DeterministicCalendarEngine.classifyInterval("2025-10-15T06:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resPeak.season).toBe("low");
    expect(resPeak.day_type).toBe("weekday");
    expect(resPeak.tou_period).toBe("peak");
    expect(resPeak.applicable_rate.toNumber()).toBe(214.35);
  });

  it("should classify Saturdays as Saturday schedule (Standard & Off-Peak only, no Peak)", () => {
    // July 5, 2025 is a Saturday
    // 09:00 SAST (07:00 UTC) -> Saturday Standard (07:00 - 12:00)
    const resSatStd = DeterministicCalendarEngine.classifyInterval("2025-07-05T07:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resSatStd.day_type).toBe("saturday");
    expect(resSatStd.tou_period).toBe("standard");

    // 14:00 SAST (12:00 UTC) -> Saturday Off-Peak (12:00 - 18:00)
    const resSatOff = DeterministicCalendarEngine.classifyInterval("2025-07-05T12:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resSatOff.day_type).toBe("saturday");
    expect(resSatOff.tou_period).toBe("off_peak");
  });

  it("should classify Sundays as Off-Peak for all 24 hours", () => {
    // July 6, 2025 is a Sunday
    // 08:00 SAST (06:00 UTC)
    const resSun = DeterministicCalendarEngine.classifyInterval("2025-07-06T06:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resSun.day_type).toBe("sunday");
    expect(resSun.tou_period).toBe("off_peak");
  });

  it("should classify gazetted public holidays as public_holiday with Off-Peak schedule", () => {
    // June 16, 2025 is Youth Day (Monday)
    // 08:00 SAST (06:00 UTC) -> Would be Peak on normal Monday, but is Youth Day Public Holiday -> Off-Peak
    const resYouth = DeterministicCalendarEngine.classifyInterval("2025-06-16T06:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resYouth.day_type).toBe("public_holiday");
    expect(resYouth.tou_period).toBe("off_peak");

    // Heritage Day: September 24, 2025 (Wednesday)
    const resHeritage = DeterministicCalendarEngine.classifyInterval("2025-09-24T06:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resHeritage.day_type).toBe("public_holiday");
    expect(resHeritage.tou_period).toBe("off_peak");
  });

  it("should apply Sunday-to-Monday public holiday substitution rule", () => {
    // June 16, 2024 was Youth Day on a Sunday.
    // June 17, 2024 (Monday) is an observed public holiday.
    const resObserved = DeterministicCalendarEngine.classifyInterval("2024-06-17T06:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resObserved.day_type).toBe("public_holiday");
    expect(resObserved.tou_period).toBe("off_peak");
  });

  it("should classify special holidays (e.g. Election Day May 29 2024) correctly", () => {
    const resSpecial = DeterministicCalendarEngine.classifyInterval("2024-05-29T06:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resSpecial.day_type).toBe("special_holiday");
    expect(resSpecial.tou_period).toBe("off_peak");
  });

  it("should handle season transition boundaries (May 31 -> June 1)", () => {
    // 31 May 2025 23:45 SAST (21:45 UTC) -> Low Season
    const resLowBoundary = DeterministicCalendarEngine.classifyInterval("2025-05-31T21:45:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resLowBoundary.season).toBe("low");

    // 1 June 2025 00:15 SAST (22:15 UTC 31 May) -> High Season
    const resHighBoundary = DeterministicCalendarEngine.classifyInterval("2025-05-31T22:15:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resHighBoundary.season).toBe("high");
  });

  it("should handle leap year dates (29 February 2024)", () => {
    // Feb 29, 2024 was a Thursday
    const resLeap = DeterministicCalendarEngine.classifyInterval("2024-02-29T10:00:00Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resLeap.local_date).toBe("2024-02-29");
    expect(resLeap.day_type).toBe("weekday");
  });

  it("should handle top-of-hour interval boundary subtraction deterministically", () => {
    // 06:00:00.000 SAST represents ending interval 05:30-06:00 (Off-Peak)
    const resBoundary = DeterministicCalendarEngine.classifyInterval("2025-07-02T04:00:00.000Z", new Decimal(100), ESKOM_MEGAFLEX_2025_2026);
    expect(resBoundary.tou_period).toBe("off_peak");
  });

  it("should generate comprehensive audit explanation answering 'Why was this interval classified as Peak?'", () => {
    const exp = DeterministicCalendarEngine.explainIntervalClassification(
      "2025-07-02T05:00:00Z",
      ESKOM_MEGAFLEX_2025_2026
    );

    expect(exp.tou_period).toBe("peak");
    expect(exp.season).toBe("high");
    expect(exp.day_type).toBe("weekday");
    expect(exp.explanation_text).toContain("classified as PEAK");
    expect(exp.explanation_text).toContain("Evaluated as WEEKDAY during HIGH season");
  });

  it("should aggregate multi-interval telemetry batch into Peak, Standard, Off-Peak, and Total kWh", () => {
    const intervals = [
      { timestamp: "2025-07-02T05:00:00Z", kwh: new Decimal(50) }, // Peak (50 kWh)
      { timestamp: "2025-07-02T09:00:00Z", kwh: new Decimal(100) }, // Standard (100 kWh)
      { timestamp: "2025-07-02T21:00:00Z", kwh: new Decimal(200) }, // Off-Peak (200 kWh)
    ];

    const agg = DeterministicCalendarEngine.aggregateIntervals(intervals, ESKOM_MEGAFLEX_2025_2026);

    expect(agg.interval_count).toBe(3);
    expect(agg.peak_kwh.toNumber()).toBe(50);
    expect(agg.standard_kwh.toNumber()).toBe(100);
    expect(agg.off_peak_kwh.toNumber()).toBe(200);
    expect(agg.total_kwh.toNumber()).toBe(350);
    expect(agg.total_cost_zar.toNumber()).toBeGreaterThan(0);
  });
});
