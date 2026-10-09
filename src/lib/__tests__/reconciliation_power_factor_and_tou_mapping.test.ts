/**
 * TEST SUITE: REQUIREMENTS 14 & 15
 * ================================
 * Requirement 14: POWER FACTOR
 *   - Where relevant: PF = kWh / kVAh or applicable documented relationship.
 *   - Do not assume a formula where the source data uses a different measurement basis.
 *   - Record the methodology used.
 *
 * Requirement 15: TIME-OF-USE MAPPING
 *   - Prepare the engine to map interval timestamps to:
 *     PEAK, STANDARD, OFF-PEAK
 *   - Do not hard-code tariff periods in this branch.
 *   - The Tariff Engine will provide the applicable TOU calendar.
 *   - The reconciliation engine should consume: tariff_period_definition and apply it to intervals.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import {
  PowerFactorEngine,
  PowerFactorCalculationInput,
} from "../../domain/reconciliation/powerFactorEngine";
import {
  TouMappingEngine,
  TariffPeriodDefinition,
  TouPeriod,
} from "../../domain/reconciliation/touMappingEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";

describe("Requirement 14: POWER FACTOR ENGINE", () => {
  describe("Primary Integrated Energy Relationship: PF = kWh / kVAh", () => {
    it("should calculate PF = kWh / kVAh accurately with Decimal precision and record methodology", () => {
      const input: PowerFactorCalculationInput = {
        kWh: "850.50",
        kVAh: "1000.00",
        kVArh: "526.31",
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);

      expect(audit.calculated_pf.toString()).toBe("0.8505");
      expect(audit.methodology).toBe("RATIO_KWH_TO_KVAH");
      expect(audit.measurement_basis).toBe("INTEGRATED_ENERGY");
      expect(audit.formula_expression).toBe("PF = kWh / kVAh");
      expect(audit.lag_lead_direction).toBe("lagging");
      expect(audit.is_valid_range).toBe(true);
      expect(audit.penalty_applicable).toBe(true); // 0.8505 < 0.95
      expect(audit.penalty_threshold.toString()).toBe("0.95");
      expect(audit.input_values.kWh).toBe("850.5");
      expect(audit.input_values.kVAh).toBe("1000");
    });

    it("should mark penalty_applicable as false when PF is above threshold (>= 0.95)", () => {
      const input: PowerFactorCalculationInput = {
        kWh: "965.00",
        kVAh: "1000.00",
        kVArh: "100.00",
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);
      expect(audit.calculated_pf.toString()).toBe("0.965");
      expect(audit.penalty_applicable).toBe(false);
      expect(audit.methodology).toBe("RATIO_KWH_TO_KVAH");
    });
  });

  describe("Applicable Documented Relationships", () => {
    it("should calculate PF = kW / kVA on demand power basis when kVAh is not present", () => {
      const input: PowerFactorCalculationInput = {
        kW: "450.0",
        kVA: "500.0",
        kVAr: "217.9",
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);
      expect(audit.calculated_pf.toString()).toBe("0.9");
      expect(audit.methodology).toBe("RATIO_KW_TO_KVA");
      expect(audit.measurement_basis).toBe("DEMAND_POWER");
      expect(audit.formula_expression).toBe("PF = kW / kVA");
      expect(audit.lag_lead_direction).toBe("lagging");
    });

    it("should calculate vector triangle relationship PF = kWh / sqrt(kWh^2 + kVArh^2) when kVAh is not measured", () => {
      // 3-4-5 Pythagorean triangle: kWh = 300, kVArh = 400 -> kVAh = 500 -> PF = 0.6000
      const input: PowerFactorCalculationInput = {
        kWh: "300.00",
        kVArh: "400.00",
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);
      expect(audit.calculated_pf.toString()).toBe("0.6");
      expect(audit.methodology).toBe("VECTOR_TRIANGLE_ACTIVE_REACTIVE");
      expect(audit.measurement_basis).toBe("ACTIVE_REACTIVE_VECTOR");
      expect(audit.formula_expression).toBe("PF = kWh / sqrt(kWh^2 + kVArh^2)");
    });

    it("should calculate vector triangle relationship on demand registers: PF = kW / sqrt(kW^2 + kVAr^2)", () => {
      // kW = 600, kVAr = 800 -> kVA = 1000 -> PF = 0.6000
      const input: PowerFactorCalculationInput = {
        kW: "600.0",
        kVAr: "800.0",
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);
      expect(audit.calculated_pf.toString()).toBe("0.6");
      expect(audit.methodology).toBe("VECTOR_TRIANGLE_ACTIVE_REACTIVE_POWER");
      expect(audit.measurement_basis).toBe("ACTIVE_REACTIVE_VECTOR");
      expect(audit.formula_expression).toBe("PF = kW / sqrt(kW^2 + kVAr^2)");
    });

    it("should preserve direct source meter hardware register without overwriting with an assumed formula", () => {
      const input: PowerFactorCalculationInput = {
        source_power_factor: "0.9320",
        kWh: "500", // even if kWh is present
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);
      expect(audit.calculated_pf.toString()).toBe("0.932");
      expect(audit.methodology).toBe("SOURCE_REPORTED_METER_VALUE");
      expect(audit.measurement_basis).toBe("DIRECT_TELEMETRY_REGISTER");
      expect(audit.formula_expression).toBe("PF = source_reported_meter_register");
    });
  });

  describe("Do Not Assume a Formula When Source Uses a Different Measurement Basis", () => {
    it("should reject and throw when source specifies INTEGRATED_ENERGY basis but kVAh is missing", () => {
      expect(() => {
        PowerFactorEngine.calculatePowerFactor({
          preferred_basis: "INTEGRATED_ENERGY",
          kW: "100",
          kVA: "120", // has kW/kVA, but user/source specified INTEGRATED_ENERGY (requires kWh/kVAh)
        });
      }).toThrowError(
        /Documented measurement basis INTEGRATED_ENERGY requires both kWh and kVAh registers/
      );
    });

    it("should reject and throw when source specifies DIRECT_TELEMETRY_REGISTER but no source register is present", () => {
      expect(() => {
        PowerFactorEngine.calculatePowerFactor({
          preferred_basis: "DIRECT_TELEMETRY_REGISTER",
          kWh: "100",
          kVAh: "110",
        });
      }).toThrowError(/no source_power_factor register was provided/);
    });

    it("should throw when registers are insufficient rather than silently guessing", () => {
      expect(() => {
        PowerFactorEngine.calculatePowerFactor({
          kWh: "100", // only kWh, no kVAh, no kVArh, no kW/kVA
        });
      }).toThrowError(/Insufficient telemetry registers to compute power factor/);
    });
  });

  describe("Zero-Demand and Direction Handling", () => {
    it("should handle zero-demand inactive circuit with unity default (1.0000) and no division by zero", () => {
      const input: PowerFactorCalculationInput = {
        kWh: "0",
        kVAh: "0",
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);
      expect(audit.calculated_pf.toString()).toBe("1");
      expect(audit.methodology).toBe("ZERO_CONSUMPTION_UNITY_DEFAULT");
      expect(audit.measurement_basis).toBe("ZERO_DEMAND_INACTIVE");
      expect(audit.lag_lead_direction).toBe("unity");
      expect(audit.penalty_applicable).toBe(false);
    });

    it("should detect leading power factor when reactive energy is negative (capacitive)", () => {
      const input: PowerFactorCalculationInput = {
        kWh: "100.0",
        kVAh: "105.0",
        kVArh: "-32.0",
      };

      const audit = PowerFactorEngine.calculatePowerFactor(input);
      expect(audit.lag_lead_direction).toBe("leading");
    });
  });

  describe("Billing Period Aggregate Power Factor", () => {
    it("should calculate aggregate billing period power factor across multiple interval records", () => {
      const intervals = [
        { kWh: "100", kVAh: "110", kW: "200", kVA: "220", kVArh: "45" },
        { kWh: "150", kVAh: "160", kW: "300", kVA: "320", kVArh: "55" },
        { kWh: "200", kVAh: "210", kW: "400", kVA: "420", kVArh: "65" },
      ];

      const summary = PowerFactorEngine.calculateBillingPeriodPowerFactor(intervals);

      // Total kWh = 450, Total kVAh = 480 -> PF = 450 / 480 = 0.9375
      expect(summary.total_kwh.toString()).toBe("450");
      expect(summary.total_kvah.toString()).toBe("480");
      expect(summary.billing_period_pf.toString()).toBe("0.9375");
      expect(summary.methodology).toBe("RATIO_KWH_TO_KVAH");
      expect(summary.penalty_applicable).toBe(true); // 0.9375 < 0.95
      expect(summary.peak_demand_kw.toString()).toBe("400");
      expect(summary.peak_demand_kva.toString()).toBe("420");
    });
  });
});

describe("Requirement 15: TIME-OF-USE MAPPING ENGINE", () => {
  // Define a pure DATA tariff_period_definition without any hardcoding in the engine
  const CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF: TariffPeriodDefinition = {
    calendar_id: "JOBURG_CITY_POWER_LPU_2026",
    tariff_code: "CP_LPU_TOU",
    timezone: "Africa/Johannesburg",
    seasons: [
      {
        season_name: "high", // Winter (June, July, August)
        months: [6, 7, 8],
        schedules: [
          {
            day_type: "weekday",
            windows: [
              { hour_start: 0, hour_end: 6, period: "OFF-PEAK" },
              { hour_start: 6, hour_end: 9, period: "PEAK" },
              { hour_start: 9, hour_end: 17, period: "STANDARD" },
              { hour_start: 17, hour_end: 19, period: "PEAK" },
              { hour_start: 19, hour_end: 22, period: "STANDARD" },
              { hour_start: 22, hour_end: 24, period: "OFF-PEAK" },
            ],
          },
          {
            day_type: "saturday",
            windows: [
              { hour_start: 0, hour_end: 7, period: "OFF-PEAK" },
              { hour_start: 7, hour_end: 12, period: "STANDARD" },
              { hour_start: 12, hour_end: 18, period: "OFF-PEAK" },
              { hour_start: 18, hour_end: 20, period: "STANDARD" },
              { hour_start: 20, hour_end: 24, period: "OFF-PEAK" },
            ],
          },
          {
            day_type: "sunday",
            windows: [{ hour_start: 0, hour_end: 24, period: "OFF-PEAK" }],
          },
        ],
      },
      {
        season_name: "low", // Summer (Sep - May)
        months: [1, 2, 3, 4, 5, 9, 10, 11, 12],
        schedules: [
          {
            day_type: "weekday",
            windows: [
              { hour_start: 0, hour_end: 6, period: "OFF-PEAK" },
              { hour_start: 6, hour_end: 7, period: "STANDARD" },
              { hour_start: 7, hour_end: 10, period: "PEAK" },
              { hour_start: 10, hour_end: 18, period: "STANDARD" },
              { hour_start: 18, hour_end: 20, period: "PEAK" },
              { hour_start: 20, hour_end: 22, period: "STANDARD" },
              { hour_start: 22, hour_end: 24, period: "OFF-PEAK" },
            ],
          },
          {
            day_type: "saturday",
            windows: [
              { hour_start: 0, hour_end: 7, period: "OFF-PEAK" },
              { hour_start: 7, hour_end: 12, period: "STANDARD" },
              { hour_start: 12, hour_end: 18, period: "OFF-PEAK" },
              { hour_start: 18, hour_end: 20, period: "STANDARD" },
              { hour_start: 20, hour_end: 24, period: "OFF-PEAK" },
            ],
          },
          {
            day_type: "sunday",
            windows: [{ hour_start: 0, hour_end: 24, period: "OFF-PEAK" }],
          },
        ],
      },
    ],
    public_holidays: [
      {
        date: "2026-06-16",
        name: "Youth Day",
        tou_treatment: "sunday_schedule", // Maps to Sunday schedule -> OFF-PEAK
      },
      {
        date: "2026-08-09",
        name: "National Women's Day", // Falls on Sunday -> Monday Aug 10 observed
        tou_treatment: "sunday_schedule",
        substitute_observed_mondays: true,
      },
    ],
    default_period: "OFF-PEAK",
  };

  describe("Dynamic TOU Mapping - Zero Hardcoded Periods", () => {
    it("should map high season weekday interval timestamps to PEAK, STANDARD, and OFF-PEAK", () => {
      // 2026-07-15 is a Wednesday (High Season)
      // 07:00 SAST is 05:00 UTC -> in window 06:00-09:00 -> PEAK
      const peakTs = "2026-07-15T05:00:00Z"; // 07:00 SAST
      const peakMapping = TouMappingEngine.mapTimestamp(peakTs, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(peakMapping.period).toBe("PEAK");
      expect(peakMapping.season).toBe("high");
      expect(peakMapping.day_type).toBe("weekday");

      // 11:00 SAST is 09:00 UTC -> in window 09:00-17:00 -> STANDARD
      const stdTs = "2026-07-15T09:00:00Z"; // 11:00 SAST
      const stdMapping = TouMappingEngine.mapTimestamp(stdTs, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(stdMapping.period).toBe("STANDARD");

      // 18:00 SAST is 16:00 UTC -> in window 17:00-19:00 -> PEAK
      const eveningPeakTs = "2026-07-15T16:00:00Z"; // 18:00 SAST
      const eveningPeakMapping = TouMappingEngine.mapTimestamp(eveningPeakTs, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(eveningPeakMapping.period).toBe("PEAK");

      // 23:00 SAST is 21:00 UTC -> in window 22:00-24:00 -> OFF-PEAK
      const offPeakTs = "2026-07-15T21:00:00Z"; // 23:00 SAST
      const offPeakMapping = TouMappingEngine.mapTimestamp(offPeakTs, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(offPeakMapping.period).toBe("OFF-PEAK");
    });

    it("should map low season weekday interval timestamps reflecting summer schedule differences", () => {
      // 2026-10-14 is a Wednesday (Low Season)
      // In Low Season definition:
      // 06:00-07:00 is STANDARD (unlike High Season which is PEAK)
      const morningStdTs = "2026-10-14T04:30:00Z"; // 06:30 SAST
      const mapping = TouMappingEngine.mapTimestamp(morningStdTs, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(mapping.period).toBe("STANDARD");
      expect(mapping.season).toBe("low");

      // 07:00-10:00 is PEAK in Low Season
      const morningPeakTs = "2026-10-14T06:00:00Z"; // 08:00 SAST
      const peakMapping = TouMappingEngine.mapTimestamp(morningPeakTs, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(peakMapping.period).toBe("PEAK");
    });

    it("should map Saturday intervals according to the Saturday schedule", () => {
      // 2026-07-18 is a Saturday (High Season)
      // 09:00 SAST (07:00 UTC) -> in 07:00-12:00 -> STANDARD
      const satMorning = "2026-07-18T07:00:00Z";
      const mapping = TouMappingEngine.mapTimestamp(satMorning, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(mapping.period).toBe("STANDARD");
      expect(mapping.day_type).toBe("saturday");

      // 14:00 SAST (12:00 UTC) -> in 12:00-18:00 -> OFF-PEAK
      const satAfternoon = "2026-07-18T12:00:00Z";
      const offPeak = TouMappingEngine.mapTimestamp(satAfternoon, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(offPeak.period).toBe("OFF-PEAK");
    });

    it("should map Sunday intervals to OFF-PEAK for all 24 hours", () => {
      // 2026-07-19 is a Sunday
      const sunNoon = "2026-07-19T10:00:00Z"; // 12:00 SAST
      const mapping = TouMappingEngine.mapTimestamp(sunNoon, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(mapping.period).toBe("OFF-PEAK");
      expect(mapping.day_type).toBe("sunday");
    });
  });

  describe("Public Holiday and Observed Monday Evaluation", () => {
    it("should map gazetted public holidays occurring on weekdays to Sunday schedule (OFF-PEAK)", () => {
      // 2026-06-16 is Youth Day (Tuesday)
      // Even during normal peak hours (07:30 SAST), holiday treatment maps it to OFF-PEAK
      const holidayPeakHour = "2026-06-16T05:30:00Z"; // 07:30 SAST
      const mapping = TouMappingEngine.mapTimestamp(holidayPeakHour, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(mapping.period).toBe("OFF-PEAK");
      expect(mapping.is_public_holiday).toBe(true);
      expect(mapping.holiday_name).toBe("Youth Day");
    });

    it("should observe Sunday public holidays on the following Monday (Public Holidays Act)", () => {
      // 2026-08-09 is National Women's Day (Sunday)
      // Monday 2026-08-10 is the observed public holiday
      const observedMondayMorning = "2026-08-10T05:30:00Z"; // 07:30 SAST
      const mapping = TouMappingEngine.mapTimestamp(observedMondayMorning, CUSTOM_MUNICIPAL_TARIFF_PERIOD_DEF);
      expect(mapping.is_public_holiday).toBe(true);
      expect(mapping.holiday_name).toContain("National Women's Day (Observed)");
      expect(mapping.period).toBe("OFF-PEAK");
    });
  });

  describe("Tariff Engine Adapter (fromTariffVersionDefinition)", () => {
    it("should dynamically consume Eskom Megaflex from Tariff Engine and map intervals", () => {
      const tariffDef = TouMappingEngine.fromTariffVersionDefinition(ESKOM_MEGAFLEX_2025_2026);

      expect(tariffDef.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(tariffDef.seasons.length).toBe(2);

      // Test winter weekday morning peak
      const peakTs = "2026-07-15T05:30:00Z"; // 07:30 SAST
      const peakResult = TouMappingEngine.mapTimestamp(peakTs, tariffDef);
      expect(peakResult.period).toBe("PEAK");

      // Test winter weekday standard period
      const stdTs = "2026-07-15T09:30:00Z"; // 11:30 SAST
      const stdResult = TouMappingEngine.mapTimestamp(stdTs, tariffDef);
      expect(stdResult.period).toBe("STANDARD");
    });
  });

  describe("Dataset Mapping and Interval Aggregation by TOU Period", () => {
    it("should aggregate intervals into PEAK, STANDARD, and OFF-PEAK summaries with power factor verification", () => {
      const tariffDef = TouMappingEngine.fromTariffVersionDefinition(ESKOM_MEGAFLEX_2025_2026);

      // Create synthetic intervals for 2026-07-15 (Winter Weekday)
      const intervals = [
        // 04:00 SAST (02:00 UTC) -> OFF-PEAK
        { timestamp: "2026-07-15T02:00:00Z", kWh: "100", kVAh: "110", kW: "200", kVA: "220", kVArh: "45" },
        // 07:00 SAST (05:00 UTC) -> PEAK
        { timestamp: "2026-07-15T05:00:00Z", kWh: "500", kVAh: "525", kW: "1000", kVA: "1050", kVArh: "160" },
        // 08:00 SAST (06:00 UTC) -> PEAK
        { timestamp: "2026-07-15T06:00:00Z", kWh: "600", kVAh: "630", kW: "1200", kVA: "1260", kVArh: "190" },
        // 11:00 SAST (09:00 UTC) -> STANDARD
        { timestamp: "2026-07-15T09:00:00Z", kWh: "400", kVAh: "420", kW: "800", kVA: "840", kVArh: "128" },
        // 14:00 SAST (12:00 UTC) -> STANDARD
        { timestamp: "2026-07-15T12:00:00Z", kWh: "350", kVAh: "370", kW: "700", kVA: "740", kVArh: "120" },
      ];

      const agg = TouMappingEngine.aggregateIntervalsByTou(intervals, tariffDef);

      expect(agg.total_intervals).toBe(5);
      // Total kWh = 100 + 500 + 600 + 400 + 350 = 1950
      expect(agg.total_active_kwh.toString()).toBe("1950");
      // Peak kWh = 500 + 600 = 1100
      expect(agg.by_period.PEAK.total_kwh.toString()).toBe("1100");
      expect(agg.by_period.PEAK.interval_count).toBe(2);
      expect(agg.by_period.PEAK.max_demand_kw.toString()).toBe("1200");
      expect(agg.by_period.PEAK.max_demand_kva.toString()).toBe("1260");

      // Standard kWh = 400 + 350 = 750
      expect(agg.by_period.STANDARD.total_kwh.toString()).toBe("750");
      expect(agg.by_period.STANDARD.interval_count).toBe(2);

      // Off-Peak kWh = 100
      expect(agg.by_period["OFF-PEAK"].total_kwh.toString()).toBe("100");
      expect(agg.by_period["OFF-PEAK"].interval_count).toBe(1);

      // System Peak Demand across all periods
      expect(agg.system_peak_demand_kw.toString()).toBe("1200");
      expect(agg.system_peak_demand_kva.toString()).toBe("1260");

      // Period Power Factors evaluated via PowerFactorEngine
      expect(agg.by_period.PEAK.power_factor_audit.calculated_pf.toNumber()).toBeGreaterThan(0.95);
      expect(agg.overall_power_factor_audit.calculated_pf.toNumber()).toBeGreaterThan(0.94);
    });
  });
});
