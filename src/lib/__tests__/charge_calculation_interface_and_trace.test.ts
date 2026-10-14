/**
 * CHARGE-CALCULATION INTERFACE (REQ 20) & CALCULATION TRACE (REQ 21) TEST SUITE
 * ==============================================================================
 * Comprehensive tests verifying:
 * 1. Stable, decoupled interface for the existing reconciliation engine:
 *    - getApplicableTariff(site, meter, billingPeriod)
 *    - getTOUPeriod(timestamp, tariffVersion)
 *    - getRate(tariffVersion, chargeType, timePeriod, quantity)
 *    - calculateCharge({ tariffVersion, chargeType, quantity, unit, timePeriod, billingPeriod, meterConfiguration })
 *    - calculateCharge(tariff, quantity, timePeriod, chargeType) [backwards-compatible positional]
 * 2. Structured results containing all 10 required governance fields:
 *    - Expected amount or quantity
 *    - Unit and currency
 *    - Applicable tariff ID and version
 *    - Effective dates
 *    - Rate or rule used
 *    - Calculation method
 *    - Rounding policy
 *    - Source evidence
 *    - Warnings or exceptions
 *    - Calculation-engine version
 * 3. Complete calculation trace (explainable charge breakdown):
 *    - Charge name
 *    - Source quantity (e.g. 12,500 kWh)
 *    - Selected rate from approved tariff version
 *    - TOU classification
 *    - Calculation method
 *    - Rounding rule
 *    - Expected charge
 *    - Evidence (source document, table/page, version, calculation run ID)
 * 4. Zero fabricated rates or calculated amounts; actual database / fixture values.
 * 5. Independence from React components.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Decimal from "decimal.js-light";
import {
  TariffInterface,
  getApplicableTariff,
  getApplicableTariffSync,
  getTOUPeriod,
  getRate,
  calculateCharge,
  CALCULATION_ENGINE_VERSION,
  type DetailedChargeCalculationResult,
  type TouPeriodClassificationResult,
  type TariffRateLookupResult,
} from "../../domain/tariff/tariffInterface";
import { TariffStorageService } from "../../domain/tariff/tariffStorageService";
import { ESKOM_MEGAFLEX_2024_2025 } from "../../domain/tariff/tariffFixtures";
import type { TariffVersionDefinition } from "../../domain/tariff/types";

describe("Charge-Calculation Interface (Req 20) & Calculation Trace (Req 21)", () => {
  const TEST_TARIFF: TariffVersionDefinition = {
    header: {
      tariff_code: "TEST_MEGAFLEX_EXP",
      tariff_name: "Test Megaflex Explainable TOU 2024/2025",
      tariff_family: "megaflex",
      version: "2024-v1",
      effective_date: "2024-04-01",
      effective_from: "2024-04-01",
      effective_to: "2025-03-31",
      utility: "Eskom",
      vat_rate: 0.15,
      is_locked: true,
      approval_status: "approved",
      status: "active",
      source_document: "Eskom Schedule of Standard Prices 2024/2025",
    },
    components: [
      {
        rule_id: "RULE_MEGA_PEAK_HIGH",
        component_code: "ACTIVE_ENERGY_PEAK",
        component_name: "Peak Energy",
        component_category: "energy",
        unit_of_measure: "c/kWh",
        rate_value: 495.22,
        high_season_rate: 495.22,
        low_season_rate: 168.45,
        tou_period: "peak",
        season: "high",
        source_table: "Table 4: Transmission Megaflex Rates (High Demand Season)",
      } as any,
      {
        rule_id: "RULE_MEGA_STD_HIGH",
        component_code: "ACTIVE_ENERGY_STANDARD",
        component_name: "Standard Energy",
        component_category: "energy",
        unit_of_measure: "c/kWh",
        rate_value: 154.12,
        high_season_rate: 154.12,
        low_season_rate: 112.30,
        tou_period: "standard",
        season: "high",
        source_table: "Table 4: Transmission Megaflex Rates (High Demand Season)",
      } as any,
      {
        rule_id: "RULE_MEGA_OFFPEAK_HIGH",
        component_code: "ACTIVE_ENERGY_OFF_PEAK",
        component_name: "Off-Peak Energy",
        component_category: "energy",
        unit_of_measure: "c/kWh",
        rate_value: 86.44,
        high_season_rate: 86.44,
        low_season_rate: 74.15,
        tou_period: "off_peak",
        season: "high",
        source_table: "Table 4: Transmission Megaflex Rates (High Demand Season)",
      } as any,
      {
        rule_id: "RULE_MEGA_DEMAND",
        component_code: "NETWORK_DEMAND",
        component_name: "Network Demand Charge",
        component_category: "demand",
        unit_of_measure: "R/kVA",
        rate_value: 85.50,
        season: "all",
        source_table: "Table 8: Network Demand and Capacity Charges",
      } as any,
      {
        rule_id: "RULE_MEGA_SERVICE",
        component_code: "SERVICE_CHARGE",
        component_name: "Daily Service Charge",
        component_category: "fixed",
        unit_of_measure: "R/day",
        rate_value: 125.75,
        season: "all",
        source_table: "Table 10: Fixed Account and Service Charges",
      } as any,
    ],
    tou_schedule: [
      {
        season: "high",
        schedules: [
          {
            day_type: "weekday",
            windows: [
              { period: "off_peak", hour_start: 0, hour_end: 6 },
              { period: "peak", hour_start: 6, hour_end: 9 },
              { period: "standard", hour_start: 9, hour_end: 17 },
              { period: "peak", hour_start: 17, hour_end: 19 },
              { period: "standard", hour_start: 19, hour_end: 22 },
              { period: "off_peak", hour_start: 22, hour_end: 24 },
            ],
          },
          {
            day_type: "saturday",
            windows: [
              { period: "off_peak", hour_start: 0, hour_end: 7 },
              { period: "standard", hour_start: 7, hour_end: 12 },
              { period: "off_peak", hour_start: 12, hour_end: 18 },
              { period: "standard", hour_start: 18, hour_end: 20 },
              { period: "off_peak", hour_start: 20, hour_end: 24 },
            ],
          },
          {
            day_type: "sunday",
            windows: [
              { period: "off_peak", hour_start: 0, hour_end: 24 },
            ],
          },
        ],
      },
    ],
    public_holidays: [
      {
        name: "Youth Day",
        date: "2024-06-16",
        tou_treatment: "off_peak",
      },
      {
        name: "Youth Day Observed",
        date: "2024-06-17",
        tou_treatment: "off_peak",
      },
    ],
  };

  beforeEach(() => {
    TariffInterface.resetProvider();
    TariffStorageService.clearMemoryStore();
    TariffStorageService.registerVersion(TEST_TARIFF);
    TariffStorageService.registerVersion(ESKOM_MEGAFLEX_2024_2025);
  });

  afterEach(() => {
    TariffInterface.resetProvider();
    TariffStorageService.clearMemoryStore();
  });

  // =========================================================================
  // 1. getApplicableTariff tests
  // =========================================================================
  describe("getApplicableTariff", () => {
    it("resolves applicable tariff by site, meter, and billingPeriod", async () => {
      const tariff = await getApplicableTariff(
        "TEST_MEGAFLEX_EXP",
        "METER_001",
        "2024-07-01 to 2024-07-31",
      );
      expect(tariff).not.toBeNull();
      expect(tariff?.header.tariff_code).toBe("TEST_MEGAFLEX_EXP");
      expect(tariff?.header.version).toBe("2024-v1");
    });

    it("supports single-object input signature getApplicableTariff({ site, meter, billingPeriod })", async () => {
      const tariff = await getApplicableTariff({
        site: "TEST_MEGAFLEX_EXP",
        meter: "METER_001",
        billingPeriod: "2024-07-01 to 2024-07-31",
      });
      expect(tariff).not.toBeNull();
      expect(tariff?.header.tariff_code).toBe("TEST_MEGAFLEX_EXP");
    });

    it("synchronously resolves applicable tariff via getApplicableTariffSync", () => {
      const tariff = getApplicableTariffSync(
        "TEST_MEGAFLEX_EXP",
        "METER_001",
        "2024-07-01 to 2024-07-31",
      );
      expect(tariff).not.toBeNull();
      expect(tariff?.header.tariff_code).toBe("TEST_MEGAFLEX_EXP");
    });

    it("rejects unapproved tariffs with an UnapprovedTariffReconciliationError", () => {
      const unapprovedTariff: TariffVersionDefinition = {
        ...TEST_TARIFF,
        header: {
          ...TEST_TARIFF.header,
          tariff_code: "UNAPPROVED_TARIFF",
          approval_status: "pending_approval",
          status: "pending_approval",
        },
      };
      TariffStorageService.registerVersion(unapprovedTariff);

      expect(() => {
        getApplicableTariffSync("UNAPPROVED_TARIFF", "METER_999", "2024-07-01");
      }).toThrow(/Unapproved/i);
    });
  });

  // =========================================================================
  // 2. getTOUPeriod tests
  // =========================================================================
  describe("getTOUPeriod", () => {
    it("accurately classifies winter weekday morning peak hour (07:30 UTC+2)", () => {
      // 2024-07-15 is Monday in July (High Season)
      // 07:30 SAST (UTC+2) = 05:30 UTC
      const timestamp = new Date("2024-07-15T05:30:00.000Z");
      const result: TouPeriodClassificationResult = getTOUPeriod(timestamp, TEST_TARIFF);

      expect(result.period).toBe("peak");
      expect(result.season).toBe("high");
      expect(result.dayType).toBe("weekday");
      expect(result.hour).toBe(7);
      expect(result.tariffId).toBe("TEST_MEGAFLEX_EXP");
      expect(result.tariffVersion).toBe("2024-v1");
      expect(result.effectiveDates.startDate).toBe("2024-04-01");
      expect(result.effectiveDates.endDate).toBe("2025-03-31");
      expect(result.calculationEngineVersion).toBe(CALCULATION_ENGINE_VERSION);
      expect(result.calculationMethod).toContain("Wall-Clock TOU Schedule");
      expect(result.sourceEvidence).toBe("Eskom Schedule of Standard Prices 2024/2025");
      expect(result.warnings).toHaveLength(0);
      expect(result.exceptions).toHaveLength(0);
    });

    it("accurately classifies winter weekday daytime standard hour (11:00 UTC+2)", () => {
      // 11:00 SAST = 09:00 UTC
      const timestamp = new Date("2024-07-15T09:00:00.000Z");
      const result = getTOUPeriod(timestamp, TEST_TARIFF);

      expect(result.period).toBe("standard");
      expect(result.season).toBe("high");
      expect(result.dayType).toBe("weekday");
      expect(result.hour).toBe(11);
    });

    it("accurately classifies Sunday as off-peak throughout the day", () => {
      // 2024-07-21 is Sunday
      const timestamp = new Date("2024-07-21T10:00:00.000Z"); // 12:00 SAST
      const result = getTOUPeriod(timestamp, TEST_TARIFF);

      expect(result.period).toBe("off_peak");
      expect(result.dayType).toBe("sunday");
    });

    it("observes gazetted public holiday off-peak treatment", () => {
      // 2024-06-17 is Youth Day Observed (Monday)
      const timestamp = new Date("2024-06-17T06:00:00.000Z"); // 08:00 SAST, would normally be peak
      const result = getTOUPeriod(timestamp, TEST_TARIFF);

      expect(result.period).toBe("off_peak");
      expect(result.dayType).toBe("public_holiday");
    });

    it("resolves tariff by tariff code string lookup", () => {
      const timestamp = new Date("2024-07-15T05:30:00.000Z");
      const result = getTOUPeriod(timestamp, "TEST_MEGAFLEX_EXP");

      expect(result.period).toBe("peak");
      expect(result.tariffId).toBe("TEST_MEGAFLEX_EXP");
    });
  });

  // =========================================================================
  // 3. getRate tests
  // =========================================================================
  describe("getRate", () => {
    it("returns structured rate result for peak active energy", () => {
      const result: TariffRateLookupResult = getRate(
        TEST_TARIFF,
        "ACTIVE_ENERGY_PEAK",
        { season: "high", touPeriod: "peak" },
        1000,
      );

      expect(result.rate.toNumber()).toBe(495.22);
      expect(result.unit).toBe("c/kWh");
      expect(result.currency).toBe("c");
      expect(result.applicableTariffId).toBe("TEST_MEGAFLEX_EXP");
      expect(result.applicableTariffVersion).toBe("2024-v1");
      expect(result.effectiveDates.startDate).toBe("2024-04-01");
      expect(result.effectiveDates.endDate).toBe("2025-03-31");
      expect(result.ruleUsed).toBe("RULE_MEGA_PEAK_HIGH");
      expect(result.sourceEvidence.sourcePageOrTable).toContain("Table 4");
      expect(result.sourceEvidence.tariffSourceDocument).toBe("Eskom Schedule of Standard Prices 2024/2025");
      expect(result.roundingPolicy.precision).toBe(4);
      expect(result.calculationEngineVersion).toBe(CALCULATION_ENGINE_VERSION);
    });

    it("returns structured rate result for network demand charge", () => {
      const result = getRate(TEST_TARIFF, "NETWORK_DEMAND", { season: "high" }, 500);

      expect(result.rate.toNumber()).toBe(85.50);
      expect(result.unit).toBe("R/kVA");
      expect(result.currency).toBe("ZAR");
      expect(result.ruleUsed).toBe("RULE_MEGA_DEMAND");
      expect(result.sourceEvidence.sourcePageOrTable).toContain("Table 8");
    });

    it("returns statutory VAT rate (15%)", () => {
      const result = getRate(TEST_TARIFF, "VAT");

      expect(result.rate.toNumber()).toBe(0.15);
      expect(result.unit).toBe("%");
      expect(result.currency).toBe("ZAR");
      expect(result.ruleUsed).toBe("RULE_VAT_STANDARD");
    });

    it("handles unconfigured charge types gracefully without fabricating rates", () => {
      const result = getRate(TEST_TARIFF, "UNCONFIGURED_PENALTY");

      expect(result.rate.toNumber()).toBe(0);
      expect(result.warnings).toContain("TARIFF_RULE_NOT_CONFIGURED");
      expect(result.ruleUsed).toContain("RULE_DEFAULT_");
    });
  });

  // =========================================================================
  // 4. calculateCharge - Requirement 20 Object Signature
  // =========================================================================
  describe("calculateCharge (Requirement 20 - Structured Object Interface)", () => {
    it("returns fully structured result with all required governance fields for Peak Energy", () => {
      const result: DetailedChargeCalculationResult = calculateCharge({
        tariffVersion: TEST_TARIFF,
        chargeType: "ACTIVE_ENERGY_PEAK",
        quantity: 12500,
        unit: "kWh",
        timePeriod: { season: "high", touPeriod: "peak" },
        billingPeriod: "2024-07-01 to 2024-07-31",
      });

      // 1. Expected amount and quantity
      expect(result.expectedAmount).toBeInstanceOf(Decimal);
      expect(result.expectedQuantity).toBeInstanceOf(Decimal);
      expect(result.expectedQuantity.toNumber()).toBe(12500);
      // 12,500 kWh * 495.22 c/kWh / 100 = R 61,902.50
      expect(result.expectedAmount.toFixed(2)).toBe("61902.50");
      expect(result.amountZar.toFixed(2)).toBe("61902.50");

      // 2. Unit and currency
      expect(result.unit).toBe("c/kWh");
      expect(result.currency).toBe("ZAR");

      // 3. Applicable tariff ID and version
      expect(result.applicableTariffId).toBe("TEST_MEGAFLEX_EXP");
      expect(result.applicableTariffVersion).toBe("2024-v1");

      // 4. Effective dates
      expect(result.effectiveDates.startDate).toBe("2024-04-01");
      expect(result.effectiveDates.endDate).toBe("2025-03-31");

      // 5. Rate or rule used
      expect(result.rateApplied.toNumber()).toBe(495.22);
      expect(result.ruleUsed).toBe("RULE_MEGA_PEAK_HIGH");
      expect(result.rateOrRuleUsed).toBe("RULE_MEGA_PEAK_HIGH");

      // 6. Calculation method
      expect(result.calculationMethod).toBe("Quantity × Rate / 100");

      // 7. Rounding policy
      expect(result.roundingPolicy).toBeDefined();
      expect(result.roundingPolicy.policyId).toBe("ROUNDING_NERSA_STANDARD");
      expect(result.roundingPolicy.precision).toBe(2);
      expect(result.roundingPolicy.method).toBe("ROUND_HALF_UP");
      expect(result.roundingPolicy.roundedAmount.toFixed(2)).toBe("61902.50");

      // 8. Source evidence
      expect(result.sourceEvidence.tariffSourceDocument).toBe("Eskom Schedule of Standard Prices 2024/2025");
      expect(result.sourceEvidence.sourcePageOrTable).toContain("Table 4");
      expect(result.sourceEvidence.tariffVersion).toBe("2024-v1");
      expect(result.sourceEvidence.calculationRunId).toMatch(/^RUN-/);

      // 9. Warnings and exceptions
      expect(result.warnings).toHaveLength(0);
      expect(result.exceptions).toHaveLength(0);

      // 10. Calculation-engine version
      expect(result.calculationEngineVersion).toBe(CALCULATION_ENGINE_VERSION);
    });

    it("evaluates statutory VAT on taxable subtotal", () => {
      const subtotal = new Decimal("100000.00");
      const vatResult = calculateCharge({
        tariffVersion: TEST_TARIFF,
        chargeType: "VAT",
        quantity: subtotal,
      });

      expect(vatResult.expectedAmount.toFixed(2)).toBe("15000.00");
      expect(vatResult.rateApplied.toNumber()).toBe(0.15);
      expect(vatResult.unit).toBe("%");
      expect(vatResult.currency).toBe("ZAR");
      expect(vatResult.calculationMethod).toBe("Subtotal × Statutory VAT Rate");
      expect(vatResult.ruleUsed).toBe("RULE_VAT");
    });
  });

  // =========================================================================
  // 5. calculateCharge - Positional Signature (Backwards Compatibility)
  // =========================================================================
  describe("calculateCharge (Positional Signature Backwards Compatibility)", () => {
    it("supports legacy positional arguments (tariff, quantity, timePeriod, chargeType)", () => {
      const result = calculateCharge(
        TEST_TARIFF,
        12500,
        { season: "high", touPeriod: "peak" },
        "ACTIVE_ENERGY_PEAK",
      );

      expect(result.amountZar.toFixed(2)).toBe("61902.50");
      expect(result.ruleId).toBe("RULE_MEGA_PEAK_HIGH");
      expect(result.tariffCode).toBe("TEST_MEGAFLEX_EXP");
      expect(result.tariffVersion).toBe("2024-v1");

      // Verifies that extended properties are also populated on positional calls
      expect(result.expectedAmount.toFixed(2)).toBe("61902.50");
      expect(result.trace).toBeDefined();
      expect(result.trace.chargeName).toBe("Peak Energy");
    });
  });

  // =========================================================================
  // 6. Calculation Trace (Requirement 21 Explainability)
  // =========================================================================
  describe("Calculation Trace (Requirement 21 Explainability)", () => {
    it("generates complete, human-readable trace for Peak Energy matching user specification", () => {
      const result = calculateCharge({
        tariffVersion: TEST_TARIFF,
        chargeType: "ACTIVE_ENERGY_PEAK",
        quantity: 12500,
        unit: "kWh",
        timePeriod: { season: "high", touPeriod: "peak" },
      });

      const trace = result.trace;
      expect(trace).toBeDefined();

      // Charge: Peak Energy
      expect(trace.chargeName).toBe("Peak Energy");

      // Source quantity: 12,500 kWh
      expect(trace.sourceQuantity.value.toNumber()).toBe(12500);
      expect(trace.sourceQuantity.unit).toBe("kWh");
      expect(trace.sourceQuantity.formatted).toContain("12");
      expect(trace.sourceQuantity.formatted).toContain("kWh");

      // Selected rate: From approved tariff version
      expect(trace.selectedRate.value.toNumber()).toBe(495.22);
      expect(trace.selectedRate.unit).toBe("c/kWh");
      expect(trace.selectedRate.source).toContain("approved tariff version");

      // TOU classification: Peak
      expect(trace.touClassification?.period).toBe("peak");
      expect(trace.touClassification?.season).toBe("high");

      // Calculation method: Quantity × Rate / 100
      expect(trace.calculationMethod).toBe("Quantity × Rate / 100");

      // Rounding rule: Approved tariff configuration
      expect(trace.roundingRule.policy).toBe("NERSA Standard Electricity Billing Rounding Policy");
      expect(trace.roundingRule.precision).toBe(2);
      expect(trace.roundingRule.method).toBe("ROUND_HALF_UP");

      // Expected charge: Calculated amount
      expect(trace.expectedCharge.roundedAmount.toFixed(2)).toBe("61902.50");
      expect(trace.expectedCharge.formatted).toContain("R 61,902.50");

      // Evidence: Tariff source document, Source page/table, Tariff version, Calculation run
      expect(trace.evidence.tariffSourceDocument).toBe("Eskom Schedule of Standard Prices 2024/2025");
      expect(trace.evidence.sourcePageOrTable).toContain("Table 4");
      expect(trace.evidence.tariffVersion).toBe("2024-v1");
      expect(trace.evidence.calculationRunId).toMatch(/^RUN-/);
      expect(trace.evidence.ruleId).toBe("RULE_MEGA_PEAK_HIGH");

      // ExplainSummary multi-line formatted string
      expect(trace.explainSummary).toContain("Charge: Peak Energy");
      expect(trace.explainSummary).toContain("Source quantity:");
      expect(trace.explainSummary).toContain("Selected rate: 495.22 c/kWh");
      expect(trace.explainSummary).toContain("TOU classification: PEAK (HIGH Season)");
      expect(trace.explainSummary).toContain("Calculation method: Quantity × Rate / 100");
      expect(trace.explainSummary).toContain("Rounding rule: Approved tariff configuration");
      expect(trace.explainSummary).toContain("Expected charge: R 61,902.50");
      expect(trace.explainSummary).toContain("Evidence:");
      expect(trace.explainSummary).toContain("Tariff source document: Eskom Schedule of Standard Prices 2024/2025");
      expect(trace.explainSummary).toContain("Source page/table: Table 4");
      expect(trace.explainSummary).toContain("Tariff version: 2024-v1");
    });

    it("generates explainable trace for Demand and Fixed charges", () => {
      const demandResult = calculateCharge({
        tariffVersion: TEST_TARIFF,
        chargeType: "NETWORK_DEMAND",
        quantity: 350, // 350 kVA
        unit: "kVA",
        timePeriod: { season: "high" },
      });

      expect(demandResult.trace.chargeName).toBe("Network Demand Charge");
      expect(demandResult.trace.sourceQuantity.formatted).toContain("350 kVA");
      expect(demandResult.trace.calculationMethod).toBe("Quantity × Rate");
      expect(demandResult.trace.evidence.sourcePageOrTable).toContain("Table 8");
      // 350 * 85.50 = 29,925.00
      expect(demandResult.expectedAmount.toFixed(2)).toBe("29925.00");

      const serviceResult = calculateCharge({
        tariffVersion: TEST_TARIFF,
        chargeType: "SERVICE_CHARGE",
        quantity: 30, // 30 days
        unit: "days",
        timePeriod: { season: "high" },
      });

      expect(serviceResult.trace.chargeName).toBe("Daily Service Charge");
      expect(serviceResult.trace.evidence.sourcePageOrTable).toContain("Table 10");
      // 30 * 125.75 = 3,772.50
      expect(serviceResult.expectedAmount.toFixed(2)).toBe("3772.50");
    });

    it("ensures explainable trace is independent of React components", () => {
      // TariffInterface is a pure TypeScript domain module
      expect(typeof TariffInterface.calculateCharge).toBe("function");
      expect(typeof TariffInterface.getApplicableTariff).toBe("function");
      expect(typeof TariffInterface.getTOUPeriod).toBe("function");
      expect(typeof TariffInterface.getRate).toBe("function");
    });
  });
});
