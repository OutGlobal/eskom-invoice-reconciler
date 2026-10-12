import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { DeterministicEngine } from "../../domain/tariff/deterministicEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";
import type {
  TariffVersionDefinition,
  DeterministicCalculationInput,
  TariffComponentRule,
  TariffTaxRule,
} from "../../domain/tariff/types";

describe("Requirement 15: Reactive Energy and Power Factor", () => {
  const baseInput: DeterministicCalculationInput = {
    billing_start: "2025-07-01",
    billing_end: "2025-07-31",
    active_energy_kwh: new Decimal("100000"),
    peak_kwh: new Decimal("30000"),
    standard_kwh: new Decimal("50000"),
    off_peak_kwh: new Decimal("20000"),
    maximum_demand_kva: new Decimal("450"),
    notified_maximum_demand_kva: new Decimal("500"),
    utilised_capacity_kva: new Decimal("450"),
    reactive_energy_kvarh: new Decimal("40000"),
    power_factor: new Decimal("0.92"),
  };

  const createReactiveTariff = (
    components: TariffComponentRule[],
    pfThreshold = new Decimal("0.95")
  ): TariffVersionDefinition => ({
    ...ESKOM_MEGAFLEX_2025_2026,
    pf_threshold: pfThreshold,
    components,
  });

  it("calculates excess kVArh above PF threshold (0.95) using allowable quota tan(phi)", () => {
    // PF threshold 0.95 -> arccos(0.95) ≈ 0.31756 rad, tan(0.31756) ≈ 0.328684
    // Allowable kVArh = 100,000 kWh * 0.328684 ≈ 32,868.40 kVArh
    // Applicable kVArh = 40,000 kVArh
    // Excess kVArh = 40,000 - 32,868.40 = 7,131.60 kVArh
    // Rate = R 0.1450 / kVArh
    // Expected amount = 7,131.60 * 0.1450 = R 1,034.08
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_EXCESS_KVARH",
        component_name: "Excess Reactive Energy Charge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.1450"),
        rule_id: "RULE_REACTIVE_01",
        formula_template: "excess_kvarh * rate",
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.95"),
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.1450"),
        },
      },
    ]);

    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.component_code).toBe("REACTIVE_EXCESS_KVARH");
    expect(item.quantity.toNumber()).toBeCloseTo(7131.6, 1);
    expect(item.amount_zar.toNumber()).toBeCloseTo(1034.08, 1);
    expect(item.audit_step.formula_used).toBe("amount = (applicable_kvarh - (kwh * tan_phi)) * rate");
  });

  it("uses explicit allowance_tan_phi if defined in tariff config", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_EXCESS_KVARH",
        component_name: "Excess Reactive Energy Charge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.20"),
        rule_id: "RULE_REACTIVE_TAN_PHI",
        formula_template: "excess_kvarh * rate",
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.96"),
          allowance_tan_phi: new Decimal("0.3000"), // Quota = 30% of kWh
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.20"),
        },
      },
    ]);

    // Allowable kVArh = 100,000 * 0.3 = 30,000 kVArh
    // Applicable = 40,000 kVArh -> Excess = 10,000 kVArh * R 0.20 = R 2,000.00
    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.quantity.toString()).toBe("10000");
    expect(item.amount_zar.toNumber()).toBe(2000);
  });

  it("restricts applicable kVArh to peak and standard TOU periods when configured", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_TOU_EXCESS",
        component_name: "Peak & Standard Reactive Energy Charge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.15"),
        rule_id: "RULE_REACTIVE_TOU",
        formula_template: "excess_kvarh * rate",
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.95"),
          applicable_tou_period: "peak_and_standard",
          allowance_tan_phi: new Decimal("0.3287"),
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.15"),
        },
      },
    ]);

    const touReactiveInput: DeterministicCalculationInput = {
      ...baseInput,
      reactive_energy_peak_kvarh: new Decimal("15000"),
      reactive_energy_standard_kvarh: new Decimal("20000"),
      reactive_energy_off_peak_kvarh: new Decimal("10000"), // Should be excluded
      reactive_energy_kvarh: new Decimal("45000"),
    };

    // Applicable kVArh = 15,000 + 20,000 = 35,000 kVArh (off-peak 10,000 excluded)
    // Allowable = 100,000 * 0.3287 = 32,870 kVArh
    // Excess = 35,000 - 32,870 = 2,130 kVArh
    // 2,130 * R 0.15 = R 319.50
    const result = DeterministicEngine.calculateTariff(touReactiveInput, tariff);
    expect(result.items.length).toBe(1);
    expect(result.items[0].quantity.toString()).toBe("2130");
    expect(result.items[0].amount_zar.toNumber()).toBe(319.5);
  });

  it("does not bill reactive penalty when power factor is at or above threshold", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_EXCESS_KVARH",
        component_name: "Excess Reactive Energy Charge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.1450"),
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.95"),
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.1450"),
        },
      },
    ]);

    const compliantInput: DeterministicCalculationInput = {
      ...baseInput,
      power_factor: new Decimal("0.97"), // Compliant >= 0.95
    };

    const result = DeterministicEngine.calculateTariff(compliantInput, tariff);
    expect(result.items.length).toBe(0);
    expect(result.subtotal_ex_vat.toNumber()).toBe(0);
  });

  it("applies seasonal exemption when reactive tariff applies only in high season", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_HIGH_SEASON_ONLY",
        component_name: "High Season Reactive Charge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.15"),
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.95"),
          applicable_season: "high", // High demand season only
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.15"),
        },
      },
    ]);

    // October is low demand season in Eskom calendar
    const lowSeasonInput: DeterministicCalculationInput = {
      ...baseInput,
      billing_start: "2025-10-01",
      billing_end: "2025-10-31",
      power_factor: new Decimal("0.88"),
    };

    const result = DeterministicEngine.calculateTariff(lowSeasonInput, tariff);
    expect(result.items.length).toBe(0);
    expect(result.subtotal_ex_vat.toNumber()).toBe(0);
  });

  it("supports DIRECT_KVARH_RATE calculation method", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "DIRECT_KVARH_PENALTY",
        component_name: "Direct Reactive Energy Charge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.12"),
        reactive_config: {
          calculation_method: "DIRECT_KVARH_RATE",
          pf_threshold: new Decimal("0.95"),
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.12"),
        },
      },
    ]);

    // 40,000 kVArh * R 0.12 = R 4,800.00
    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    expect(result.items[0].quantity.toString()).toBe("40000");
    expect(result.items[0].amount_zar.toNumber()).toBe(4800);
  });

  it("supports POWER_FACTOR_SURCHARGE_PERCENTAGE method", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "PF_SURCHARGE_PCT",
        component_name: "Power Factor Penalty Surcharge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "%",
        rate_value: new Decimal("1.0"),
        reactive_config: {
          calculation_method: "POWER_FACTOR_SURCHARGE_PERCENTAGE",
          pf_threshold: new Decimal("0.95"),
          unit_of_measure: "%",
          rate_value: new Decimal("1.0"),
        },
      },
    ]);

    // Surcharge % = (0.95 - 0.92) / 0.95 * 100 = 3.16%
    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    expect(result.items[0].rate.toString()).toBe("3.16");
    expect(result.items[0].unit).toBe("%");
  });

  it("supports EXCESS_QUOTA_PERCENTAGE method", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "EXCESS_QUOTA_30PCT",
        component_name: "Reactive Energy Above 30% Active Energy Quota",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.10"),
        reactive_config: {
          calculation_method: "EXCESS_QUOTA_PERCENTAGE",
          pf_threshold: new Decimal("0.95"),
          free_quota_percentage: new Decimal("30"), // 30% of 100,000 kWh = 30,000 kVArh free
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.10"),
        },
      },
    ]);

    // 40,000 - 30,000 = 10,000 excess * R 0.10 = R 1,000.00
    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    expect(result.items[0].quantity.toString()).toBe("10000");
    expect(result.items[0].amount_zar.toNumber()).toBe(1000);
  });

  it("derives power factor from kWh and kVAh when direct PF register is missing", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_DERIVED_PF",
        component_name: "Reactive Energy Derived PF",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.15"),
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.95"),
          allowance_tan_phi: new Decimal("0.3287"),
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.15"),
        },
      },
    ]);

    // Active kWh = 80,000, Apparent kVAh = 100,000 -> PF = 0.8000 (< 0.95)
    const derivedInput: DeterministicCalculationInput = {
      ...baseInput,
      power_factor: new Decimal(0), // Direct register missing
      active_energy_kwh: new Decimal("80000"),
      apparent_energy_kvah: new Decimal("100000"),
      reactive_energy_kvarh: new Decimal("60000"),
    };

    const result = DeterministicEngine.calculateTariff(derivedInput, tariff);
    expect(result.items.length).toBe(1);
    // Allowable = 80,000 * 0.3287 = 26,296 kVArh
    // Excess = 60,000 - 26,296 = 33,704 kVArh
    expect(result.items[0].quantity.toString()).toBe("33704");
  });

  it("derives power factor from vector triangle (kWh and kVArh) when PF and kVAh are missing", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_TRIANGLE_PF",
        component_name: "Reactive Energy Triangle PF",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.15"),
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.95"),
          allowance_tan_phi: new Decimal("0.3287"),
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.15"),
        },
      },
    ]);

    // Active kWh = 30,000, Reactive kVArh = 40,000 -> kVAh = sqrt(30k^2 + 40k^2) = 50,000 -> PF = 30k/50k = 0.60
    const triangleInput: DeterministicCalculationInput = {
      ...baseInput,
      power_factor: new Decimal(0),
      apparent_energy_kvah: undefined,
      active_energy_kwh: new Decimal("30000"),
      reactive_energy_kvarh: new Decimal("40000"),
    };

    const result = DeterministicEngine.calculateTariff(triangleInput, tariff);
    expect(result.items.length).toBe(1);
    // Allowable = 30,000 * 0.3287 = 9,861 kVArh
    // Excess = 40,000 - 9,861 = 30,139 kVArh
    expect(result.items[0].quantity.toString()).toBe("30139");
  });

  it("returns INSUFFICIENT_DATA when all reactive telemetry is missing", () => {
    const tariff = createReactiveTariff([
      {
        component_code: "REACTIVE_CHARGE",
        component_name: "Reactive Energy Charge",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.15"),
      },
    ]);

    const missingTelemetryInput: DeterministicCalculationInput = {
      ...baseInput,
      power_factor: new Decimal(0),
      reactive_energy_kvarh: new Decimal(0),
      apparent_energy_kvah: undefined,
    };

    const result = DeterministicEngine.calculateTariff(missingTelemetryInput, tariff);
    expect(result.items.length).toBe(0);
    expect(result.unresolved_items).toBeDefined();
    const unresolved = result.unresolved_items?.find((u) => u.component_code === "REACTIVE_CHARGE");
    expect(unresolved).toBeDefined();
    expect(unresolved?.reason).toContain("INSUFFICIENT_DATA");
    expect(unresolved?.missing_data).toContain("reactive_energy_kvarh");
  });

  it("returns REVIEW_REQUIRED when an unsupported power factor threshold is configured", () => {
    const unsupportedTariff = createReactiveTariff([
      {
        component_code: "REACTIVE_BAD_THRESHOLD",
        component_name: "Reactive Energy Invalid Threshold",
        component_type: "REACTIVE_ENERGY",
        unit_of_measure: "R/kVARh",
        rate_value: new Decimal("0.15"),
        reactive_config: {
          calculation_method: "EXCESS_KVARH_ABOVE_PF_THRESHOLD",
          pf_threshold: new Decimal("0.65"), // Unsupported threshold below 0.80
          unit_of_measure: "R/kVARh",
          rate_value: new Decimal("0.15"),
        },
      },
    ]);

    const result = DeterministicEngine.calculateTariff(baseInput, unsupportedTariff);
    expect(result.items.length).toBe(0);
    const unresolved = result.unresolved_items?.find((u) => u.component_code === "REACTIVE_BAD_THRESHOLD");
    expect(unresolved).toBeDefined();
    expect(unresolved?.reason).toContain("REVIEW_REQUIRED: Unsupported power factor threshold (0.65)");
    expect(unresolved?.missing_data).toContain("valid_pf_threshold");
  });
});

describe("Requirement 16: VAT and Tax Treatment", () => {
  const baseInput: DeterministicCalculationInput = {
    billing_start: "2025-07-01",
    billing_end: "2025-07-31",
    active_energy_kwh: new Decimal("10000"),
    peak_kwh: new Decimal("3000"),
    standard_kwh: new Decimal("5000"),
    off_peak_kwh: new Decimal("2000"),
    maximum_demand_kva: new Decimal("100"),
    notified_maximum_demand_kva: new Decimal("120"),
    utilised_capacity_kva: new Decimal("100"),
    reactive_energy_kvarh: new Decimal("1000"),
    power_factor: new Decimal("0.98"),
  };

  const simpleTariff: TariffVersionDefinition = {
    ...ESKOM_MEGAFLEX_2025_2026,
    components: [
      {
        component_code: "BASIC_ENERGY_CHARGE",
        component_name: "Active Energy Charge",
        component_type: "ACTIVE_ENERGY",
        unit_of_measure: "R/kWh",
        rate_value: new Decimal("2.00"),
        rule_id: "RULE_ENERGY_01",
        formula_template: "kwh * rate",
      },
    ],
  };

  it("applies current South African VAT rate (15%) for post-2018 invoices", () => {
    // 10,000 kWh * R 2.00 = R 20,000.00 ex VAT
    // VAT (15%) = R 3,000.00
    // Total inc VAT = R 23,000.00
    const result = DeterministicEngine.calculateTariff(baseInput, simpleTariff);
    expect(result.subtotal_ex_vat.toNumber()).toBe(20000);
    expect(result.vat_amount.toNumber()).toBe(3000);
    expect(result.total_inc_vat.toNumber()).toBe(23000);

    expect(result.tax_breakdown).toBeDefined();
    expect(result.tax_breakdown?.tax_rule_id).toBe("VAT_ZA_CURRENT_15");
    expect(result.tax_breakdown?.vat_rate.toString()).toBe("0.15");
    expect(result.tax_breakdown?.is_historical_rate).toBe(false);
    expect(result.tax_breakdown?.subtotal_taxable_ex_vat.toNumber()).toBe(20000);
  });

  it("applies historical South African VAT rate (14%) for pre-2018 invoices without hardcoding 15%", () => {
    // Historical invoice dated March 2018 (prior to 1 April 2018 VAT hike)
    const historicalInput: DeterministicCalculationInput = {
      ...baseInput,
      billing_start: "2018-03-01",
      billing_end: "2018-03-31",
    };

    // 10,000 kWh * R 2.00 = R 20,000.00 ex VAT
    // Historical VAT (14%) = R 2,800.00
    // Total inc VAT = R 22,800.00
    const result = DeterministicEngine.calculateTariff(historicalInput, simpleTariff);
    expect(result.subtotal_ex_vat.toNumber()).toBe(20000);
    expect(result.vat_amount.toNumber()).toBe(2800);
    expect(result.total_inc_vat.toNumber()).toBe(22800);

    expect(result.tax_breakdown).toBeDefined();
    expect(result.tax_breakdown?.tax_rule_id).toBe("VAT_ZA_HISTORICAL_14");
    expect(result.tax_breakdown?.vat_rate.toString()).toBe("0.14");
    expect(result.tax_breakdown?.is_historical_rate).toBe(true);
    expect(result.tax_breakdown?.subtotal_taxable_ex_vat.toNumber()).toBe(20000);
  });

  it("supports configurable tax rules override with custom jurisdiction/rate", () => {
    const customTaxRules: TariffTaxRule[] = [
      {
        rule_id: "VAT_CUSTOM_18",
        jurisdiction: "CUSTOM",
        tax_name: "Custom Energy Tax 18%",
        rate: new Decimal("0.18"),
        effective_from: "2020-01-01",
      },
    ];

    const customInput: DeterministicCalculationInput = {
      ...baseInput,
      tax_rules_override: customTaxRules,
    };

    // R 20,000.00 * 0.18 = R 3,600.00
    const result = DeterministicEngine.calculateTariff(customInput, simpleTariff);
    expect(result.vat_amount.toNumber()).toBe(3600);
    expect(result.total_inc_vat.toNumber()).toBe(23600);
    expect(result.tax_breakdown?.tax_rule_id).toBe("VAT_CUSTOM_18");
    expect(result.tax_breakdown?.vat_rate.toString()).toBe("0.18");
  });

  it("handles zero-rated tariff header correctly (0% VAT)", () => {
    const zeroRatedTariff: TariffVersionDefinition = {
      ...simpleTariff,
      header: {
        ...simpleTariff.header,
        vat_treatment: "zero_rated",
      },
    };

    const result = DeterministicEngine.calculateTariff(baseInput, zeroRatedTariff);
    expect(result.subtotal_ex_vat.toNumber()).toBe(20000);
    expect(result.vat_amount.toNumber()).toBe(0);
    expect(result.total_inc_vat.toNumber()).toBe(20000);
    expect(result.tax_breakdown?.subtotal_zero_rated_ex_vat.toNumber()).toBe(20000);
    expect(result.tax_breakdown?.subtotal_taxable_ex_vat.toNumber()).toBe(0);
  });

  it("handles exempt tariff header correctly (0% VAT)", () => {
    const exemptTariff: TariffVersionDefinition = {
      ...simpleTariff,
      header: {
        ...simpleTariff.header,
        vat_treatment: "exempt",
      },
    };

    const result = DeterministicEngine.calculateTariff(baseInput, exemptTariff);
    expect(result.subtotal_ex_vat.toNumber()).toBe(20000);
    expect(result.vat_amount.toNumber()).toBe(0);
    expect(result.total_inc_vat.toNumber()).toBe(20000);
    expect(result.tax_breakdown?.subtotal_exempt_ex_vat.toNumber()).toBe(20000);
    expect(result.tax_breakdown?.subtotal_taxable_ex_vat.toNumber()).toBe(0);
  });

  it("separates taxable, zero-rated, and exempt components in a mixed tariff", () => {
    const mixedTariff: TariffVersionDefinition = {
      ...simpleTariff,
      components: [
        {
          component_code: "TAXABLE_ENERGY",
          component_name: "Standard Taxable Energy",
          component_type: "ACTIVE_ENERGY",
          unit_of_measure: "R/kWh",
          rate_value: new Decimal("1.50"),
          tax_status: "TAXABLE",
        },
        {
          component_code: "EXEMPT_LEVY",
          component_name: "Statutory Exempt Government Levy",
          component_type: "TAX_OR_LEVY",
          unit_of_measure: "R/kWh",
          rate_value: new Decimal("0.20"),
          tax_status: "EXEMPT",
        },
        {
          component_code: "ZERO_RATED_SUBSIDY",
          component_name: "Zero Rated Cross Subsidy",
          component_type: "AFFORDABILITY_SUBSIDY",
          unit_of_measure: "R/kWh",
          rate_value: new Decimal("0.30"),
          tax_status: "ZERO_RATED",
        },
      ],
    };

    // 10,000 kWh:
    // Taxable: 10,000 * 1.50 = R 15,000.00
    // Exempt: 10,000 * 0.20 = R 2,000.00
    // Zero rated: 10,000 * 0.30 = R 3,000.00
    // Subtotal ex VAT = R 20,000.00
    // VAT applies ONLY to taxable: R 15,000.00 * 15% = R 2,250.00
    // Total inc VAT = R 22,250.00
    const result = DeterministicEngine.calculateTariff(baseInput, mixedTariff);
    expect(result.subtotal_ex_vat.toNumber()).toBe(20000);
    expect(result.tax_breakdown?.subtotal_taxable_ex_vat.toNumber()).toBe(15000);
    expect(result.tax_breakdown?.subtotal_exempt_ex_vat.toNumber()).toBe(2000);
    expect(result.tax_breakdown?.subtotal_zero_rated_ex_vat.toNumber()).toBe(3000);
    expect(result.vat_amount.toNumber()).toBe(2250);
    expect(result.total_inc_vat.toNumber()).toBe(22250);
  });

  it("keeps tax calculation strictly separate from energy quantities", () => {
    const result = DeterministicEngine.calculateTariff(baseInput, simpleTariff);
    // Quantities must remain unchanged
    const energyItem = result.items.find((i) => i.component_code === "BASIC_ENERGY_CHARGE");
    expect(energyItem?.quantity.toString()).toBe("10000");
    expect(energyItem?.amount_zar.toNumber()).toBe(20000);
    // Tax applies only to monetary totals
    expect(result.vat_amount.toNumber()).toBe(3000);
  });
});
