/**
 * TEST SUITE: REQUIREMENTS 16 & 17
 * ================================
 * Requirement 16: ENERGY RECONCILIATION
 *   - Compare invoice energy against AMR-derived energy:
 *     - Invoice Peak kWh vs AMR Peak kWh
 *     - Invoice Standard kWh vs AMR Standard kWh
 *     - Invoice Off-Peak kWh vs AMR Off-Peak kWh
 *     - Invoice Total kWh vs AMR Total kWh
 *   - Calculate:
 *     - absolute_variance
 *     - percentage_variance
 *   - Do not hide small variances.
 *   - Record the configured tolerance separately.
 *
 * Requirement 17: DEMAND RECONCILIATION
 *   - Where interval demand data exists: calculate applicable demand values.
 *   - Compare: Invoice Demand vs AMR-derived Demand.
 *   - Support:
 *     - maximum demand
 *     - TOU demand
 *     - notified demand
 *     - utilised demand
 *   - Do not assume that invoice demand is always simply the maximum raw interval kW.
 *   - The applicable demand methodology must be supplied by configuration/tariff rules.
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import {
  EnergyReconciliationEngine,
  EnergyReconciliationInput,
} from "../../domain/reconciliation/energyReconciliationEngine";
import {
  DemandReconciliationEngine,
  DemandReconciliationInput,
  DemandMethodologyConfig,
} from "../../domain/reconciliation/demandReconciliationEngine";
import { TouMappingEngine } from "../../domain/reconciliation/touMappingEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";

describe("Requirement 16: ENERGY RECONCILIATION", () => {
  describe("Component Comparison: Peak, Standard, Off-Peak, and Total kWh", () => {
    it("should compare invoice energy against AMR energy and calculate absolute and percentage variance", () => {
      const input: EnergyReconciliationInput = {
        invoice_peak_kwh: "125000.00",
        invoice_standard_kwh: "245000.00",
        invoice_off_peak_kwh: "180000.00",
        invoice_total_kwh: "550000.00",

        amr_peak_kwh: "120000.00",
        amr_standard_kwh: "245000.00",
        amr_off_peak_kwh: "182000.00",
        amr_total_kwh: "547000.00",
      };

      const summary = EnergyReconciliationEngine.reconcileEnergy(input);

      // Peak: 125,000 - 120,000 = +5,000 kWh (+4.1667%)
      expect(summary.peak_comparison.absolute_variance.toString()).toBe("5000");
      expect(summary.peak_comparison.percentage_variance.toDecimalPlaces(4).toString()).toBe("4.1667");
      expect(summary.peak_comparison.variance_direction).toBe("OVERBILLED");
      expect(summary.peak_comparison.discrepancy_classification).toBe("MATERIAL_DISCREPANCY");

      // Standard: 245,000 - 245,000 = 0 kWh (0.0000%)
      expect(summary.standard_comparison.absolute_variance.toString()).toBe("0");
      expect(summary.standard_comparison.percentage_variance.toString()).toBe("0");
      expect(summary.standard_comparison.variance_direction).toBe("EXACT_MATCH");
      expect(summary.standard_comparison.discrepancy_classification).toBe("EXACT_MATCH");

      // Off-Peak: 180,000 - 182,000 = -2,000 kWh (-1.0989%)
      expect(summary.off_peak_comparison.absolute_variance.toString()).toBe("-2000");
      expect(summary.off_peak_comparison.percentage_variance.toDecimalPlaces(4).toString()).toBe("-1.0989");
      expect(summary.off_peak_comparison.variance_direction).toBe("UNDERBILLED");

      // Total: 550,000 - 547,000 = +3,000 kWh
      expect(summary.total_comparison.absolute_variance.toString()).toBe("3000");
      expect(summary.has_material_discrepancy).toBe(true);
    });
  });

  describe("Do Not Hide Small Variances & Record Configured Tolerance Separately", () => {
    it("should never hide or zero-out micro-variances (e.g. 0.05 kWh or 0.00002%)", () => {
      const input: EnergyReconciliationInput = {
        invoice_total_kwh: "250000.05",
        amr_total_kwh: "250000.00",
      };

      const summary = EnergyReconciliationEngine.reconcileEnergy(input);
      const totalComp = summary.total_comparison;

      // Small variance of 0.05 kWh MUST NOT be hidden or rounded to 0
      expect(totalComp.absolute_variance.toString()).toBe("0.05");
      expect(totalComp.percentage_variance.toDecimalPlaces(6).toString()).toBe("0.00002");
      expect(totalComp.variance_direction).toBe("OVERBILLED");

      // Tolerance is recorded SEPARATELY (e.g. default absolute = 200 kWh, percentage = 0.1%)
      expect(totalComp.configured_tolerance.absolute_tolerance.toString()).toBe("200");
      expect(totalComp.configured_tolerance.percentage_tolerance.toString()).toBe("0.001");
      expect(totalComp.configured_tolerance.tolerance_rule_source).toBe("DEFAULT_UTILITY_POLICY");

      // Because 0.05 kWh <= 200 kWh, it is WITHIN_TOLERANCE, but the raw variance remains visible
      expect(totalComp.is_within_tolerance).toBe(true);
      expect(totalComp.discrepancy_classification).toBe("WITHIN_TOLERANCE");
      expect(totalComp.explanation).toContain("Variance of 0.05 kWh");
    });
  });

  describe("Integration with AMR Intervals & Tariff TOU Calendar", () => {
    it("should dynamically aggregate intervals via TouMappingEngine and reconcile against invoice", () => {
      const tariffDef = TouMappingEngine.fromTariffVersionDefinition(ESKOM_MEGAFLEX_2025_2026);

      const intervals = [
        // Off-peak (04:00 SAST)
        { timestamp: "2026-07-15T02:00:00Z", kWh: "150.0" },
        // Peak (07:00 SAST)
        { timestamp: "2026-07-15T05:00:00Z", kWh: "500.0" },
        // Standard (11:00 SAST)
        { timestamp: "2026-07-15T09:00:00Z", kWh: "350.0" },
      ];

      const input: EnergyReconciliationInput = {
        invoice_peak_kwh: "500.0",
        invoice_standard_kwh: "350.0",
        invoice_off_peak_kwh: "150.0",
        invoice_total_kwh: "1000.0",
        intervals,
        tariff_period_definition: tariffDef,
      };

      const summary = EnergyReconciliationEngine.reconcileEnergy(input);

      expect(summary.total_amr_kwh.toString()).toBe("1000");
      expect(summary.peak_comparison.discrepancy_classification).toBe("EXACT_MATCH");
      expect(summary.standard_comparison.discrepancy_classification).toBe("EXACT_MATCH");
      expect(summary.off_peak_comparison.discrepancy_classification).toBe("EXACT_MATCH");
      expect(summary.all_components_within_tolerance).toBe(true);
      expect(summary.has_material_discrepancy).toBe(false);
    });
  });

  describe("Summation Integrity Cross-Check", () => {
    it("should detect when invoice internal components do not sum to stated total", () => {
      const input: EnergyReconciliationInput = {
        invoice_peak_kwh: "100.0",
        invoice_standard_kwh: "200.0",
        invoice_off_peak_kwh: "300.0",
        invoice_total_kwh: "650.0", // 100 + 200 + 300 = 600, but stated total is 650!
      };

      const summary = EnergyReconciliationEngine.reconcileEnergy(input);
      expect(summary.summation_integrity.invoice_sum_matches_total).toBe(false);
      expect(summary.summation_integrity.invoice_components_sum.toString()).toBe("600");
      expect(summary.summation_integrity.invoice_stated_total.toString()).toBe("650");
    });
  });
});

describe("Requirement 17: DEMAND RECONCILIATION", () => {
  describe("Do Not Assume Invoice Demand is Simply Raw Interval kW", () => {
    it("should reconcile demand in kVA (not kW) per tariff rules where power factor makes kVA > kW", () => {
      // In this scenario:
      // Peak active demand is 850 kW, but at PF 0.85, apparent demand is 1,000 kVA.
      // Eskom Megaflex bills in kVA. An engine blindly comparing against raw 850 kW would be incorrect!
      const input: DemandReconciliationInput = {
        invoice_demand_value: "1000.0",
        amr_tou_peak_kw: "850.0",
        amr_tou_peak_kva: "1000.0",
        amr_tou_standard_kw: "700.0",
        amr_tou_standard_kva: "820.0",
        amr_tou_off_peak_kw: "900.0",
        amr_tou_off_peak_kva: "1050.0", // Off-peak surge
        demand_methodology: DemandReconciliationEngine.ESKOM_MEGAFLEX_DEMAND_RULE,
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      // Verify measurement unit is kVA
      expect(result.invoice_unit).toBe("kVA");
      expect(result.raw_maximum_interval_kw.toString()).toBe("900");
      expect(result.applicable_measured_demand.toString()).toBe("1000"); // Peak & Standard kVA max
      expect(result.utilised_billing_demand.toString()).toBe("1000");

      // Exact match against 1,000 kVA billed
      expect(result.absolute_variance.toString()).toBe("0");
      expect(result.is_within_tolerance).toBe(true);
      expect(result.discrepancy_classification).toBe("EXACT_MATCH");
      expect(result.methodology_record.is_assumed_raw_kw).toBe(false);
    });

    it("should exclude Off-Peak demand surges when tariff scope is PEAK_AND_STANDARD_ONLY", () => {
      // Off-peak compressor test: 1,500 kVA on Sunday night (Off-Peak)
      // Peak/Standard maximum demand: 1,000 kVA
      // Megaflex rules state Off-Peak demand is NOT chargeable for maximum demand.
      const input: DemandReconciliationInput = {
        invoice_demand_value: "1000.0", // Utility correctly billed 1,000 kVA
        amr_tou_peak_kva: "1000.0",
        amr_tou_standard_kva: "900.0",
        amr_tou_off_peak_kva: "1500.0", // Off-peak surge
        demand_methodology: DemandReconciliationEngine.ESKOM_MEGAFLEX_DEMAND_RULE,
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      // The applicable measured demand is 1,000 kVA, NOT the 1,500 kVA raw maximum!
      expect(result.raw_amr_maximum_demand.toString()).toBe("1500");
      expect(result.applicable_measured_demand.toString()).toBe("1000");
      expect(result.absolute_variance.toString()).toBe("0");
      expect(result.discrepancy_classification).toBe("EXACT_MATCH");
    });
  });

  describe("Support Notified Maximum Demand (NMD) & Exceedance", () => {
    it("should detect when applicable demand exceeds NMD and calculate exceedance quantity", () => {
      const megaflexWithNmd: DemandMethodologyConfig = {
        ...DemandReconciliationEngine.ESKOM_MEGAFLEX_DEMAND_RULE,
        nmd_kva: "800.0", // Contracted NMD is 800 kVA
      };

      const input: DemandReconciliationInput = {
        invoice_demand_value: "950.0",
        amr_tou_peak_kva: "950.0",
        amr_tou_standard_kva: "850.0",
        demand_methodology: megaflexWithNmd,
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      expect(result.has_nmd_exceedance).toBe(true);
      // Exceedance = 950 - 800 = 150 kVA excess demand
      expect(result.nmd_exceedance_amount.toString()).toBe("150");
      expect(result.notified_maximum_demand?.toString()).toBe("800");
    });
  });

  describe("Support Utilised Demand (NMD Ratchet Rules)", () => {
    it("should apply 70% NMD ratchet rule when actual measured demand is low", () => {
      // Contracted NMD is 1,000 kVA.
      // 70% ratchet floor = 700 kVA.
      // Factory was on low production; actual measured demand was only 400 kVA.
      // Invoice legitimately bills 700 kVA per tariff ratchet rule.
      const megaflexWithRatchet: DemandMethodologyConfig = {
        ...DemandReconciliationEngine.ESKOM_MEGAFLEX_DEMAND_RULE,
        nmd_kva: "1000.0",
        nmd_ratchet_percentage: "70.0",
      };

      const input: DemandReconciliationInput = {
        invoice_demand_value: "700.0",
        amr_tou_peak_kva: "400.0",
        amr_tou_standard_kva: "350.0",
        demand_methodology: megaflexWithRatchet,
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      // Applicable measured demand is 400 kVA
      expect(result.applicable_measured_demand.toString()).toBe("400");
      // But utilised billing demand is ratcheted up to 700 kVA
      expect(result.utilised_billing_demand.toString()).toBe("700");
      expect(result.methodology_record.ratchet_applied).toBe(true);
      expect(result.methodology_record.ratchet_explanation).toContain("70% NMD ratchet floor");

      // Exact match with invoice billing 700 kVA!
      expect(result.absolute_variance.toString()).toBe("0");
      expect(result.discrepancy_classification).toBe("EXACT_MATCH");
    });
  });

  describe("Do Not Hide Small Variances & Record Configured Tolerance Separately", () => {
    it("should record small demand variance (0.15 kVA) without suppressing it, noting tolerance separately", () => {
      const input: DemandReconciliationInput = {
        invoice_demand_value: "500.15",
        amr_tou_peak_kva: "500.00",
        demand_methodology: DemandReconciliationEngine.ESKOM_MEGAFLEX_DEMAND_RULE,
        tolerance: {
          absolute_tolerance: "5.0",
          percentage_tolerance: "0.005",
        },
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      // Small variance of 0.15 kVA is NOT hidden or rounded away
      expect(result.absolute_variance.toString()).toBe("0.15");
      expect(result.percentage_variance.toDecimalPlaces(4).toString()).toBe("0.03");
      expect(result.variance_direction).toBe("OVERBILLED");

      // Tolerance recorded separately
      expect(result.configured_tolerance.absolute_tolerance.toString()).toBe("5");
      expect(result.configured_tolerance.percentage_tolerance.toString()).toBe("0.005");

      // Within tolerance classification
      expect(result.is_within_tolerance).toBe(true);
      expect(result.discrepancy_classification).toBe("WITHIN_TOLERANCE");
    });
  });

  describe("Additional Demand Tariff Methodologies & Interval Stream Integration", () => {
    it("should reconcile municipal flat active kW demand across all hours using MUNICIPAL_ALL_HOURS_KW_RULE", () => {
      const input: DemandReconciliationInput = {
        invoice_demand_value: "450.0",
        invoice_demand_unit: "kW",
        amr_raw_max_kw: "450.0",
        amr_raw_max_kva: "520.0",
        amr_tou_peak_kw: "420.0",
        amr_tou_standard_kw: "450.0", // Standard period had the highest active demand
        amr_tou_off_peak_kw: "380.0",
        demand_methodology: DemandReconciliationEngine.MUNICIPAL_ALL_HOURS_KW_RULE,
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      expect(result.invoice_unit).toBe("kW");
      expect(result.applicable_measured_demand.toString()).toBe("450");
      expect(result.utilised_billing_demand.toString()).toBe("450");
      expect(result.absolute_variance.toString()).toBe("0");
      expect(result.discrepancy_classification).toBe("EXACT_MATCH");
      expect(result.methodology_record.tou_window_scope).toBe("ALL_HOURS");
    });

    it("should enforce minimum billing demand floor when actual demand is very low", () => {
      const ruleWithMinFloor: DemandMethodologyConfig = {
        rule_id: "CUSTOM_MIN_FLOOR",
        methodology_name: "Tariff Minimum 50 kVA Billing Floor",
        measurement_unit: "kVA",
        tou_window_scope: "ALL_HOURS",
        minimum_billing_demand: "50.0",
        description: "Billed demand floored at 50 kVA minimum.",
      };

      const input: DemandReconciliationInput = {
        invoice_demand_value: "50.0", // Invoice legitimately billed 50 kVA floor
        amr_raw_max_kva: "22.5", // Circuit barely drew 22.5 kVA
        demand_methodology: ruleWithMinFloor,
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      expect(result.applicable_measured_demand.toString()).toBe("22.5");
      expect(result.utilised_billing_demand.toString()).toBe("50");
      expect(result.methodology_record.ratchet_applied).toBe(true);
      expect(result.methodology_record.ratchet_explanation).toContain("tariff minimum billing threshold of 50 kVA");
      expect(result.absolute_variance.toString()).toBe("0");
      expect(result.discrepancy_classification).toBe("EXACT_MATCH");
    });

    it("should derive demand dynamically from raw AMR interval records and TOU calendar", () => {
      const tariffDef = TouMappingEngine.fromTariffVersionDefinition(ESKOM_MEGAFLEX_2025_2026);

      const intervals = [
        // Off-peak interval (04:00 SAST) with high demand
        { timestamp: "2026-07-15T02:00:00Z", kW: "800.0", kVA: "950.0" },
        // Peak interval (07:00 SAST)
        { timestamp: "2026-07-15T05:00:00Z", kW: "750.0", kVA: "850.0" },
        // Standard interval (11:00 SAST) with highest chargeable demand
        { timestamp: "2026-07-15T09:00:00Z", kW: "780.0", kVA: "890.0" },
      ];

      const input: DemandReconciliationInput = {
        invoice_demand_value: "890.0",
        intervals,
        tariff_period_definition: tariffDef,
        demand_methodology: DemandReconciliationEngine.ESKOM_MEGAFLEX_DEMAND_RULE,
      };

      const result = DemandReconciliationEngine.reconcileDemand(input);

      // Raw maximum was 950 kVA (during Off-Peak)
      expect(result.raw_maximum_interval_kva.toString()).toBe("950");
      // But applicable demand for Megaflex is Peak & Standard only -> 890 kVA!
      expect(result.applicable_measured_demand.toString()).toBe("890");
      expect(result.utilised_billing_demand.toString()).toBe("890");
      expect(result.absolute_variance.toString()).toBe("0");
      expect(result.discrepancy_classification).toBe("EXACT_MATCH");
    });
  });
});
