/**
 * TEST SUITE: REQUIREMENTS 18 & 19
 * ================================
 * Requirement 18: REACTIVE ENERGY
 *   - Where available: compare
 *     - Invoice kVArh vs AMR kVArh
 *     - Invoice power factor vs AMR-derived power factor
 *   - Flag significant differences.
 *   - Do not calculate reactive penalties in this branch unless the applicable
 *     tariff rule is supplied by the Tariff Engine.
 *
 * Requirement 19: INVOICE CHARGE RECONCILIATION
 *   - Billed Quantity × Applicable Rate = Expected Charge
 *   - Tariff rates must come from: feature/tariff-engine
 *   - Do NOT hard-code tariff rates here.
 *   - Clean interface pipeline:
 *     Tariff Engine → Applicable Rates → Reconciliation Engine → Expected Charges
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import {
  ReactiveEnergyReconciliationEngine,
  ReactiveEnergyReconciliationInput,
} from "../../domain/reconciliation/reactiveEnergyReconciliationEngine";
import {
  InvoiceChargeReconciliationEngine,
  ApplicableRateSchedule,
  InvoiceChargeReconciliationInput,
} from "../../domain/reconciliation/invoiceChargeReconciliationEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";

describe("Requirement 18: REACTIVE ENERGY RECONCILIATION", () => {
  describe("kVArh and Power Factor Comparisons (Where Available)", () => {
    it("should compare invoice kVArh vs AMR kVArh and calculate variances", () => {
      const input: ReactiveEnergyReconciliationInput = {
        invoice_kvarh: "45000.00",
        amr_kvarh: "42000.00",
      };

      const result = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy(input);

      expect(result.kvarh_comparison.kvarh_data_available).toBe(true);
      // 45,000 - 42,000 = +3,000 kVArh (+7.1429%)
      expect(result.kvarh_comparison.absolute_variance?.toString()).toBe("3000");
      expect(result.kvarh_comparison.percentage_variance?.toDecimalPlaces(4).toString()).toBe("7.1429");
      expect(result.kvarh_comparison.variance_direction).toBe("OVERBILLED");
      expect(result.kvarh_comparison.is_significant_difference).toBe(true);
      expect(result.has_significant_discrepancy).toBe(true);
      expect(result.flagged_reasons.length).toBeGreaterThan(0);
    });

    it("should compare invoice power factor vs AMR-derived power factor and flag significant differences", () => {
      const input: ReactiveEnergyReconciliationInput = {
        invoice_power_factor: "0.96",
        amr_kwh: "100000.00",
        amr_kvah: "115000.00", // AMR PF = 100,000 / 115,000 = 0.8696
      };

      const result = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy(input);

      expect(result.power_factor_comparison.pf_data_available).toBe(true);
      expect(result.power_factor_comparison.invoice_pf?.toString()).toBe("0.96");
      expect(result.power_factor_comparison.amr_pf?.toString()).toBe("0.8696");

      // Difference = 0.96 - 0.8696 = +0.0904 (exceeds default 0.02 threshold)
      expect(result.power_factor_comparison.is_significant_difference).toBe(true);
      expect(result.has_significant_discrepancy).toBe(true);
      expect(result.flagged_reasons.some((r) => r.includes("Significant power factor difference"))).toBe(true);
    });

    it("should flag quadrant / direction mismatch when invoice claims lagging but AMR shows leading", () => {
      const input: ReactiveEnergyReconciliationInput = {
        invoice_power_factor: "0.92",
        invoice_pf_direction: "lagging",
        amr_power_factor: "0.92",
        amr_pf_direction: "leading", // Solar inverters over-correcting
      };

      const result = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy(input);

      expect(result.power_factor_comparison.has_direction_mismatch).toBe(true);
      expect(result.has_significant_discrepancy).toBe(true);
      expect(result.flagged_reasons.some((r) => r.includes("Power factor direction mismatch"))).toBe(true);
    });

    it("should gracefully handle when reactive energy data is unavailable without throwing", () => {
      const input: ReactiveEnergyReconciliationInput = {
        // No invoice or AMR reactive data supplied
      };

      const result = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy(input);
      expect(result.kvarh_comparison.kvarh_data_available).toBe(false);
      expect(result.power_factor_comparison.pf_data_available).toBe(false);
      expect(result.has_significant_discrepancy).toBe(false);
    });
  });

  describe("Strict Reactive Penalty Gating (Tariff Engine Rule Required)", () => {
    it("should NOT calculate reactive penalties when no tariff rule is supplied by Tariff Engine", () => {
      // Even with a poor power factor (0.85 < 0.95), penalties must not be synthesized arbitrarily
      const input: ReactiveEnergyReconciliationInput = {
        invoice_power_factor: "0.85",
        amr_power_factor: "0.85",
        amr_kwh: "100000.0",
        amr_kvarh: "62000.0",
        // NO tariff_reactive_rule provided!
      };

      const result = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy(input);

      expect(result.reactive_penalty.status).toBe("SKIPPED_NO_TARIFF_RULE");
      expect(result.reactive_penalty.calculated_penalty_zar).toBeUndefined();
      expect(result.reactive_penalty.explanation).toContain("No applicable reactive tariff rule was supplied by the Tariff Engine");
    });

    it("should calculate reactive penalties ONLY when the applicable tariff rule is supplied by the Tariff Engine", () => {
      const input: ReactiveEnergyReconciliationInput = {
        amr_kwh: "100000.0",
        amr_kvarh: "50000.0", // High reactive energy
        amr_power_factor: "0.8944",
        tariff_reactive_rule: {
          rule_id: "MEGAFLEX_REACTIVE_2025",
          tariff_code: "MEGAFLEX",
          pf_threshold: "0.95",
          reactive_penalty_rate_zar_per_kvarh: "0.25", // R 0.25 / kVArh
          allowance_tan_phi: "0.328684", // ~32,868.4 kVArh allowance
        },
      };

      const result = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy(input);

      expect(result.reactive_penalty.status).toBe("CALCULATED_FROM_TARIFF_RULE");
      expect(result.reactive_penalty.rule_id).toBe("MEGAFLEX_REACTIVE_2025");
      // Allowance = 100,000 * 0.328684 = 32,868.40 kVArh
      // Excess = 50,000 - 32,868.40 = 17,131.60 kVArh
      expect(result.reactive_penalty.excess_kvarh?.toString()).toBe("17131.6");
      // Penalty = 17,131.60 * R 0.25 = R 4,282.90
      expect(result.reactive_penalty.calculated_penalty_zar?.toString()).toBe("4282.9");
      expect(result.reactive_penalty.explanation).toContain("per tariff rule MEGAFLEX_REACTIVE_2025");
    });

    it("should return zero penalty when power factor is compliant with supplied tariff rule (>= 0.95)", () => {
      const input: ReactiveEnergyReconciliationInput = {
        amr_kwh: "100000.0",
        amr_kvarh: "20000.0",
        amr_power_factor: "0.98",
        tariff_reactive_rule: {
          rule_id: "MEGAFLEX_REACTIVE_2025",
          tariff_code: "MEGAFLEX",
          pf_threshold: "0.95",
          reactive_penalty_rate_zar_per_kvarh: "0.25",
        },
      };

      const result = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy(input);

      expect(result.reactive_penalty.status).toBe("NOT_APPLICABLE_PF_COMPLIANT");
      expect(result.reactive_penalty.calculated_penalty_zar?.toString()).toBe("0");
    });
  });
});

describe("Requirement 19: INVOICE CHARGE RECONCILIATION", () => {
  describe("Clean Interface Pipeline: Tariff Engine → Applicable Rates → Expected Charges", () => {
    it("should extract applicable rates from TariffVersionDefinition without hardcoding any numbers", () => {
      const rateSchedule = InvoiceChargeReconciliationEngine.extractApplicableRates(
        ESKOM_MEGAFLEX_2025_2026,
        { season: "high" }
      );

      expect(rateSchedule.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(rateSchedule.season).toBe("high");
      expect(rateSchedule.rates.length).toBeGreaterThan(0);

      // Verify components are extracted from the tariff fixture data
      const peakRate = InvoiceChargeReconciliationEngine.findApplicableRate(rateSchedule.rates, "ACTIVE_ENERGY_PEAK");
      expect(peakRate).toBeDefined();
      expect(peakRate?.unit_of_measure).toBe("c/kWh");
      expect(peakRate?.rate_value.toNumber()).toBeGreaterThan(0);
    });

    it("should calculate Expected Charge = Billed Quantity × Applicable Rate with exact unit handling", () => {
      const rateSchedule = InvoiceChargeReconciliationEngine.extractApplicableRates(
        ESKOM_MEGAFLEX_2025_2026,
        { season: "high" }
      );

      // Determinant inputs (Billed Quantities)
      const input: InvoiceChargeReconciliationInput = {
        applicable_rates: rateSchedule,
        determinants: [
          // 100,000 kWh Peak Energy (666.92 c/kWh -> R 666,920.00)
          {
            component_code: "ACTIVE_ENERGY_PEAK",
            billed_quantity: "100000.00",
            quantity_unit: "kWh",
            billed_amount_zar: "666920.00",
          },
          // 200,000 kWh Standard Energy (198.84 c/kWh -> R 397,680.00)
          {
            component_code: "ACTIVE_ENERGY_STANDARD",
            billed_quantity: "200000.00",
            quantity_unit: "kWh",
            billed_amount_zar: "397680.00",
          },
          // 1,000 kVA Network Demand (R 42.85 / kVA -> R 42,850.00)
          {
            component_code: "NETWORK_DEMAND",
            billed_quantity: "1000.00",
            quantity_unit: "kVA",
            billed_amount_zar: "42850.00",
          },
        ],
        billed_subtotal_zar: "1107450.00",
        billed_vat_zar: "166117.50", // 15% VAT
        billed_total_zar: "1273567.50",
      };

      const summary = InvoiceChargeReconciliationEngine.reconcileCharges(input);

      expect(summary.items.length).toBe(3);

      // Check Peak Energy calculation
      const peakItem = summary.items.find((i) => i.component_code === "ACTIVE_ENERGY_PEAK");
      expect(peakItem).toBeDefined();
      expect(peakItem?.expected_charge_zar.toString()).toBe("666920");
      expect(peakItem?.charge_variance_zar?.toString()).toBe("0");
      expect(peakItem?.discrepancy_classification).toBe("EXACT_MATCH");
      expect(peakItem?.rate_lineage.rule_id).toBe("RULE-MEGA-01");

      // Check Totals
      expect(summary.expected_subtotal_zar.toString()).toBe("1107450");
      expect(summary.expected_vat_zar.toString()).toBe("166117.5");
      expect(summary.expected_total_zar.toString()).toBe("1273567.5");
      expect(summary.all_items_within_tolerance).toBe(true);
      expect(summary.has_material_discrepancy).toBe(false);
    });

    it("should detect overbilling discrepancy when invoice charges exceed expected rates", () => {
      const rateSchedule = InvoiceChargeReconciliationEngine.extractApplicableRates(
        ESKOM_MEGAFLEX_2025_2026,
        { season: "high" }
      );

      const input: InvoiceChargeReconciliationInput = {
        applicable_rates: rateSchedule,
        determinants: [
          {
            component_code: "ACTIVE_ENERGY_PEAK",
            billed_quantity: "100000.00",
            // Utility erroneously billed R 700,000.00 instead of R 666,920.00 (Overbilled by R 33,080.00)
            billed_amount_zar: "700000.00",
          },
        ],
      };

      const summary = InvoiceChargeReconciliationEngine.reconcileCharges(input);
      const item = summary.items[0];

      expect(item.expected_charge_zar.toString()).toBe("666920");
      expect(item.billed_charge_zar?.toString()).toBe("700000");
      expect(item.charge_variance_zar?.toString()).toBe("33080");
      expect(item.discrepancy_classification).toBe("MATERIAL_DISCREPANCY");
      expect(summary.has_material_discrepancy).toBe(true);
    });

    it("should throw descriptive error when tariff schedule is missing a requested rate rather than guessing", () => {
      const mockSchedule: ApplicableRateSchedule = {
        tariff_code: "INCOMPLETE_TARIFF",
        tariff_version: "1.0",
        season: "high",
        utility: "Test Utility",
        rates: [], // Empty rates
        created_at: new Date().toISOString(),
      };

      expect(() => {
        InvoiceChargeReconciliationEngine.reconcileCharges({
          applicable_rates: mockSchedule,
          determinants: [{ component_code: "UNKNOWN_COMPONENT", billed_quantity: "100" }],
        });
      }).toThrowError(/No applicable rate supplied by the Tariff Engine for component 'UNKNOWN_COMPONENT'/);
    });
  });
});
