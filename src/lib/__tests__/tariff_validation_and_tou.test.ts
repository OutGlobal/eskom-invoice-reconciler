import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { TariffValidationEngine } from "../../domain/tariff/tariffValidationEngine";
import { TouScheduleEngine } from "../../domain/tariff/touScheduleEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";
import type { TariffVersionDefinition } from "../../domain/tariff/types";

describe("Requirement 9: Tariff Data Validation", () => {
  const getValidTariff = (): TariffVersionDefinition => {
    return JSON.parse(JSON.stringify(ESKOM_MEGAFLEX_2025_2026), (key, val) => {
      if (typeof val === "string" && !isNaN(Number(val)) && (key === "rate_value" || key.endsWith("_rate") || key.endsWith("_threshold") || key.endsWith("_multiplier") || key.endsWith("_kva"))) {
        return new Decimal(val);
      }
      return val;
    });
  };

  it("validates approved tariff without errors or warnings", () => {
    const valid = getValidTariff();
    const result = TariffValidationEngine.validateVersion(valid);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing tariff code and missing effective date", () => {
    const tariff = getValidTariff();
    tariff.header.tariff_code = "";
    (tariff.header as any).effective_date = "";

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_HEADER_MISSING_CODE")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_HEADER_MISSING_EFFECTIVE_DATE")).toBe(true);
  });

  it("detects incorrect date ranges (expiry before effective date or invalid format)", () => {
    const tariff = getValidTariff();
    tariff.header.effective_date = "2026-07-01";
    tariff.header.expiry_date = "2026-06-30"; // Before effective!

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_HEADER_EXPIRY_BEFORE_EFFECTIVE")).toBe(true);
  });

  it("detects inconsistent currency (must specify ZAR)", () => {
    const tariff = getValidTariff();
    (tariff.header as any).currency = "USD";

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_HEADER_INCONSISTENT_CURRENCY")).toBe(true);
  });

  it("detects unclear VAT treatment", () => {
    const tariff = getValidTariff();
    (tariff.header as any).vat_treatment = "exempt";

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_HEADER_UNCLEAR_VAT")).toBe(true);
  });

  it("detects unclear rounding rules", () => {
    const tariff = getValidTariff();
    (tariff.header as any).rounding_rule = "TRUNCATE_RANDOM";

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_HEADER_UNCLEAR_ROUNDING")).toBe(true);
  });

  it("detects missing source evidence before approval", () => {
    const tariff = getValidTariff();
    tariff.header.source_document = "";

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_MISSING_SOURCE_EVIDENCE")).toBe(true);
  });

  it("detects invalid thresholds (power factor and NMD ratchet multiplier)", () => {
    const tariff = getValidTariff();
    tariff.pf_threshold = new Decimal(1.5); // Greater than 1.0!
    tariff.nmd_ratchet_multiplier = new Decimal(-0.5); // Negative!

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_INVALID_PF_THRESHOLD")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_INVALID_NMD_MULTIPLIER")).toBe(true);
  });

  it("detects invalid contracted demand bands (negative min or min > max)", () => {
    const tariff = getValidTariff();
    tariff.header.applicability = {
      applicable_customer_classes: ["industrial"],
      region_or_municipality: ["National"],
      voltage_levels: ["high"],
      applicable_dates: { effective_from: "2025-06-01" },
      contracted_demand_bands: {
        min_demand_kva: new Decimal(500),
        max_demand_kva: new Decimal(100), // min > max!
      },
    };

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_INVALID_DEMAND_BAND")).toBe(true);
  });

  it("detects contradictory season definitions and overlapping TOU windows", () => {
    const tariff = getValidTariff();
    // Overlapping TOU windows on weekday: 06:00-09:00 peak AND 08:00-11:00 standard
    tariff.tou_schedule = [
      {
        season: "high",
        schedules: [
          {
            day_type: "weekday",
            windows: [
              { hour_start: 6, hour_end: 9, period: "peak" },
              { hour_start: 8, hour_end: 11, period: "standard" },
            ],
          },
        ],
      },
      {
        season: "high", // Duplicate season definition!
        schedules: [],
      },
    ];

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_CONTRADICTORY_SEASONS")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_CONTRADICTORY_TOU_WINDOWS")).toBe(true);
  });

  it("detects unsupported charge types", () => {
    const tariff = getValidTariff();
    tariff.components.push({
      component_code: "UNKNOWN_CHARGE",
      component_name: "Arbitrary Fee",
      component_type: "FEE_ARBITRARY" as any,
      unit_of_measure: "R/month",
      rate_value: new Decimal(100),
      rule_id: "rule_test",
      formula_template: "quantity * rate",
    });

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_UNSUPPORTED_CHARGE_TYPE")).toBe(true);
  });

  it("detects missing units and invalid numeric rates", () => {
    const tariff = getValidTariff();
    tariff.components[0].unit_of_measure = "";
    (tariff.components[1] as any).rate_value = undefined;

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_COMPONENT_MISSING_UNIT")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_COMPONENT_INVALID_RATE")).toBe(true);
  });

  it("distinguishes legitimate negative values (credits/discounts) from actual rate errors", () => {
    const tariff = getValidTariff();

    // 1. Unapproved negative rate on standard active energy component -> MUST ERROR
    tariff.components[0].rate_value = new Decimal(-150);
    let result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_COMPONENT_NEGATIVE_RATE")).toBe(true);

    // 2. Legitimate solar feed-in credit with negative rate -> MUST PASS
    tariff.components[0].rate_value = new Decimal(320); // restore valid rate
    tariff.components.push({
      component_code: "SOLAR_FEEDIN_CREDIT",
      component_name: "Rooftop Solar Export Credit",
      component_type: "DISCOUNT_OR_CREDIT",
      unit_of_measure: "c/kWh",
      rate_value: new Decimal(-95.5), // negative rate is legitimate for solar export
      rule_id: "solar_cred_01",
      formula_template: "quantity * rate / 100",
    });

    result = TariffValidationEngine.validateVersion(tariff);
    expect(result.errors.some((e) => e.code === "ERR_COMPONENT_NEGATIVE_RATE")).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("detects duplicate components and conflicting rates", () => {
    const tariff = getValidTariff();

    // Add conflicting duplicate component (same key, different rate)
    const base = tariff.components[0];
    tariff.components.push({
      ...base,
      rate_value: base.rate_value.add(50),
    });

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_CONFLICTING_RATES")).toBe(true);
  });

  it("detects missing required TOU periods on TOU tariffs", () => {
    const tariff = getValidTariff();
    // Remove peak components
    tariff.components = tariff.components.filter(
      (c) => !(c.component_type === "ACTIVE_ENERGY" && c.tou_period === "peak"),
    );

    const result = TariffValidationEngine.validateVersion(tariff);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_MISSING_TOU_PERIODS")).toBe(true);
  });

  it("detects overlapping effective periods across tariff versions", () => {
    const t1 = getValidTariff();
    t1.header.version = "2025.1";
    t1.header.effective_date = "2025-06-01";
    t1.header.expiry_date = "2026-05-31";

    const t2 = getValidTariff();
    t2.header.version = "2026.1";
    t2.header.effective_date = "2026-05-01"; // Overlaps with t1 by 1 month!
    t2.header.expiry_date = "2027-04-30";

    const overlapResult = TariffValidationEngine.validateNoOverlappingVersions([t1, t2]);
    expect(overlapResult.isValid).toBe(false);
    expect(overlapResult.errors.some((e) => e.code === "ERR_TARIFF_VERSION_OVERLAP")).toBe(true);
  });
});

describe("Requirement 10: Time-Of-Use (TOU) Engine", () => {
  const tariff = ESKOM_MEGAFLEX_2025_2026;

  it("correctly resolves weekday Peak, Standard, and Off-Peak in High Season", () => {
    // 2025-07-02 is a Wednesday in High Season (July)
    // Megaflex High Season Weekday:
    // Peak: 06:00-09:00 & 17:00-19:00
    // Standard: 09:00-17:00 & 19:00-22:00
    // Off-Peak: 22:00-06:00

    const tPeakMorning = new Date("2025-07-02T07:30:00+02:00");
    const tStdAfternoon = new Date("2025-07-02T12:00:00+02:00");
    const tPeakEvening = new Date("2025-07-02T18:00:00+02:00");
    const tOffPeakNight = new Date("2025-07-02T23:30:00+02:00");

    expect(TouScheduleEngine.resolveTouPeriod(tPeakMorning, tariff)).toBe("peak");
    expect(TouScheduleEngine.resolveTouPeriod(tStdAfternoon, tariff)).toBe("standard");
    expect(TouScheduleEngine.resolveTouPeriod(tPeakEvening, tariff)).toBe("peak");
    expect(TouScheduleEngine.resolveTouPeriod(tOffPeakNight, tariff)).toBe("off_peak");
  });

  it("correctly resolves Saturday periods (Standard & Off-Peak, no Peak)", () => {
    // 2025-07-05 is a Saturday
    // Megaflex Saturday:
    // Standard: 07:00-12:00 & 18:00-20:00
    // Off-Peak: 00:00-07:00, 12:00-18:00, 20:00-24:00

    const tSatMorningStd = new Date("2025-07-05T09:00:00+02:00");
    const tSatAfternoonOff = new Date("2025-07-05T14:00:00+02:00");
    const tSatPeakTimeIsOffOrStd = new Date("2025-07-05T08:00:00+02:00");

    expect(TouScheduleEngine.resolveTouPeriod(tSatMorningStd, tariff)).toBe("standard");
    expect(TouScheduleEngine.resolveTouPeriod(tSatAfternoonOff, tariff)).toBe("off_peak");
    expect(TouScheduleEngine.resolveTouPeriod(tSatPeakTimeIsOffOrStd, tariff)).not.toBe("peak");
  });

  it("correctly resolves Sunday as 100% Off-Peak all day", () => {
    // 2025-07-06 is a Sunday
    const tSunMorning = new Date("2025-07-06T08:00:00+02:00");
    const tSunMidday = new Date("2025-07-06T12:00:00+02:00");
    const tSunEvening = new Date("2025-07-06T18:00:00+02:00");

    expect(TouScheduleEngine.resolveTouPeriod(tSunMorning, tariff)).toBe("off_peak");
    expect(TouScheduleEngine.resolveTouPeriod(tSunMidday, tariff)).toBe("off_peak");
    expect(TouScheduleEngine.resolveTouPeriod(tSunEvening, tariff)).toBe("off_peak");
  });

  it("applies public holiday substitution rule (Sunday holiday observed on Monday)", () => {
    // Suppose a gazetted public holiday falls on Sunday 2025-04-27 (Freedom Day)
    const holidays = [
      {
        date: "2025-04-27",
        name: "Freedom Day",
        tou_treatment: "off_peak" as const,
      },
    ];

    const sundayDate = new Date("2025-04-27T10:00:00+02:00");
    const mondayDate = new Date("2025-04-28T10:00:00+02:00");
    const tuesdayDate = new Date("2025-04-29T10:00:00+02:00");

    expect(TouScheduleEngine.isPublicHoliday(sundayDate, holidays)).toBe(true);
    // Monday observed holiday per Public Holidays Act
    expect(TouScheduleEngine.isPublicHoliday(mondayDate, holidays)).toBe(true);
    // Tuesday is regular weekday
    expect(TouScheduleEngine.isPublicHoliday(tuesdayDate, holidays)).toBe(false);

    expect(TouScheduleEngine.getDayType(mondayDate, holidays)).toBe("public_holiday");
    expect(TouScheduleEngine.getDayType(tuesdayDate, holidays)).toBe("weekday");
  });

  it("uses timezone-aware timestamp processing in Africa/Johannesburg (UTC+2) without DST", () => {
    // 04:00 UTC = 06:00 SAST (Peak starts at 06:00 SAST)
    const utcDateAtPeakTransition = new Date("2025-07-02T04:00:01Z");
    const period = TouScheduleEngine.resolveTouPeriod(utcDateAtPeakTransition, tariff, "Africa/Johannesburg");
    expect(period).toBe("peak");
  });

  it("handles midnight and month-end season transitions cleanly", () => {
    // Season transitions at midnight: 31 May 23:59:59 (Low) -> 01 June 00:00:01 (High)
    const may31Night = new Date("2025-05-31T23:59:59+02:00");
    const jun01Morning = new Date("2025-06-01T00:00:01+02:00");

    expect(TouScheduleEngine.getSeason(may31Night)).toBe("low");
    expect(TouScheduleEngine.getSeason(jun01Morning)).toBe("high");

    // Continuous off-peak across midnight (22:00 to 06:00)
    const beforeMidnight = new Date("2025-07-02T23:59:00+02:00");
    const afterMidnight = new Date("2025-07-03T00:01:00+02:00");
    expect(TouScheduleEngine.resolveTouPeriod(beforeMidnight, tariff)).toBe("off_peak");
    expect(TouScheduleEngine.resolveTouPeriod(afterMidnight, tariff)).toBe("off_peak");
  });

  it("classifies interval wholly contained within a TOU clock window", () => {
    const classification = TouScheduleEngine.classifyInterval(
      {
        startTime: "2025-07-02T07:00:00+02:00",
        endTime: "2025-07-02T07:30:00+02:00",
        totalKwh: 120,
      },
      tariff,
    );

    expect(classification.crossesBoundary).toBe(false);
    expect(classification.period).toBe("peak");
    expect(classification.flaggedLimitation).toBeUndefined();
    expect(classification.boundarySplit).toBeUndefined();
  });

  it("flags limitation when interval crosses boundary without allowed pro-rata split", () => {
    // Interval 05:45 to 06:15 crosses 06:00 off-peak to peak transition
    const classification = TouScheduleEngine.classifyInterval(
      {
        startTime: "2025-07-02T05:45:00+02:00",
        endTime: "2025-07-02T06:15:00+02:00",
        totalKwh: 200,
      },
      tariff,
      { allowProRataSplit: false, boundaryRule: "START_INCLUSIVE" },
    );

    expect(classification.crossesBoundary).toBe(true);
    expect(classification.period).toBe("off_peak");
    expect(classification.flaggedLimitation).toBeDefined();
    expect(classification.flaggedLimitation).toContain("Interval spans across TOU transition boundary");
  });

  it("calculates defensible minute-accurate pro-rata split when allowed", () => {
    // Interval 05:45 to 06:15 (30 mins): 15 mins off-peak, 15 mins peak
    const classification = TouScheduleEngine.classifyInterval(
      {
        startTime: "2025-07-02T05:45:00+02:00",
        endTime: "2025-07-02T06:15:00+02:00",
        totalKwh: 300,
      },
      tariff,
      { allowProRataSplit: true },
    );

    expect(classification.crossesBoundary).toBe(true);
    expect(classification.boundarySplit).toBeDefined();
    expect(classification.boundarySplit?.portion1.period).toBe("off_peak");
    expect(classification.boundarySplit?.portion1.durationMinutes).toBe(15);
    expect(classification.boundarySplit?.portion1.kwh?.toNumber()).toBe(150);

    expect(classification.boundarySplit?.portion2.period).toBe("peak");
    expect(classification.boundarySplit?.portion2.durationMinutes).toBe(15);
    expect(classification.boundarySplit?.portion2.kwh?.toNumber()).toBe(150);
  });

  it("respects END_INCLUSIVE boundary rule when interval crosses boundary", () => {
    const classification = TouScheduleEngine.classifyInterval(
      {
        startTime: "2025-07-02T05:45:00+02:00",
        endTime: "2025-07-02T06:15:00+02:00",
      },
      tariff,
      { boundaryRule: "END_INCLUSIVE" },
    );

    expect(classification.crossesBoundary).toBe(true);
    expect(classification.period).toBe("peak"); // END_INCLUSIVE chose period at end!
  });
});
