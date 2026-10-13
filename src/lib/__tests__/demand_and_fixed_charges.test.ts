import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { DeterministicEngine } from "../../domain/tariff/deterministicEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";
import type {
  TariffVersionDefinition,
  DeterministicCalculationInput,
  TariffComponentRule,
} from "../../domain/tariff/types";

describe("Requirement 13: Demand and Capacity Charges", () => {
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
    reactive_energy_kvarh: new Decimal("5000"),
    power_factor: new Decimal("0.98"),
  };

  it("calculates documented network demand charges using recorded maximum demand kVA", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "DEMAND_NETWORK_KVA",
          component_name: "Network Demand Charge",
          component_type: "NETWORK_DEMAND",
          unit_of_measure: "R/kVA/month",
          rate_value: new Decimal("85.50"),
          rule_id: "RULE_DEMAND_01",
          formula_template: "demand_kva * rate",
          demand_config: {
            demand_unit: "kVA",
            demand_basis: "MAXIMUM_DEMAND",
            measurement_window_minutes: 30,
          },
        },
      ],
    };

    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.component_code).toBe("DEMAND_NETWORK_KVA");
    expect(item.quantity.toString()).toBe("450");
    // 450 kVA * R 85.50 = R 38,475.00
    expect(item.amount_zar.toNumber()).toBe(38475);
    expect(item.audit_step.formula_used).toBe("amount = demand_kva * rate_zar");
  });

  it("calculates demand charge in kW with explicit measurement window", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "DEMAND_KW_CHARGE",
          component_name: "Active Power Demand Charge",
          component_type: "DEMAND_CHARGE",
          unit_of_measure: "R/kW/month",
          rate_value: new Decimal("72.25"),
          rule_id: "RULE_DEMAND_KW",
          formula_template: "demand_kw * rate",
          demand_config: {
            demand_unit: "kW",
            demand_basis: "MAXIMUM_DEMAND",
            measurement_window_minutes: 15,
          },
        },
      ],
    };

    const inputWithKw: DeterministicCalculationInput = {
      ...baseInput,
      maximum_demand_kw: new Decimal("420"),
    };

    const result = DeterministicEngine.calculateTariff(inputWithKw, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.quantity.toString()).toBe("420");
    // 420 kW * R 72.25 = R 30,345.00
    expect(item.amount_zar.toNumber()).toBe(30345);
  });

  it("calculates TOU-specific peak demand when peak demand is supplied", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "PEAK_DEMAND_CHARGE",
          component_name: "Peak Period Demand Charge",
          component_type: "DEMAND_CHARGE",
          unit_of_measure: "R/kVA/month",
          rate_value: new Decimal("110.00"),
          rule_id: "RULE_PEAK_DEMAND",
          formula_template: "peak_demand_kva * rate",
          demand_config: {
            demand_unit: "kVA",
            demand_basis: "PEAK_DEMAND",
            measurement_period: "peak",
          },
        },
      ],
    };

    const inputWithPeakDemand: DeterministicCalculationInput = {
      ...baseInput,
      peak_demand_kva: new Decimal("380"),
    };

    const result = DeterministicEngine.calculateTariff(inputWithPeakDemand, tariff);
    expect(result.items.length).toBe(1);
    expect(result.items[0].quantity.toString()).toBe("380");
    // 380 kVA * R 110.00 = R 41,800.00
    expect(result.items[0].amount_zar.toNumber()).toBe(41800);
  });

  it("returns unresolved result when required demand methodology data is missing (does not fabricate)", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "PEAK_PERIOD_DEMAND",
          component_name: "Peak TOU Demand",
          component_type: "DEMAND_CHARGE",
          unit_of_measure: "R/kW/month",
          rate_value: new Decimal("95.00"),
          rule_id: "RULE_MISSING_DEMAND",
          formula_template: "peak_demand_kw * rate",
          demand_config: {
            demand_unit: "kW",
            demand_basis: "PEAK_DEMAND",
            measurement_period: "peak",
          },
        },
      ],
    };

    // Input lacks peak_demand_kw
    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(0);
    expect(result.unresolved_items).toBeDefined();
    expect(result.unresolved_items!.length).toBe(1);
    expect(result.unresolved_items![0].component_code).toBe("PEAK_PERIOD_DEMAND");
    expect(result.unresolved_items![0].missing_data).toContain("peak_demand_kw");
    expect(result.unresolved_items![0].reason).toContain("missing from calculation input");
  });

  it("applies minimum demand rules based on percentage of NMD (e.g. 70% threshold)", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "NETWORK_DEMAND_MIN_70",
          component_name: "Network Demand with 70% NMD Floor",
          component_type: "NETWORK_DEMAND",
          unit_of_measure: "R/kVA/month",
          rate_value: new Decimal("50.00"),
          rule_id: "RULE_MIN_DEMAND",
          formula_template: "chargeable_demand_kva * rate",
          demand_config: {
            demand_unit: "kVA",
            demand_basis: "MAXIMUM_DEMAND",
            minimum_chargeable_demand_percentage: new Decimal("70"), // 70% of 500 kVA = 350 kVA
          },
        },
      ],
    };

    // Recorded demand is only 200 kVA (less than 70% of 500 = 350 kVA)
    const lowDemandInput: DeterministicCalculationInput = {
      ...baseInput,
      maximum_demand_kva: new Decimal("200"),
      notified_maximum_demand_kva: new Decimal("500"),
    };

    const result = DeterministicEngine.calculateTariff(lowDemandInput, tariff);
    expect(result.items.length).toBe(1);
    // Adjusted to minimum allowable demand of 350 kVA
    expect(result.items[0].quantity.toString()).toBe("350");
    // 350 kVA * R 50.00 = R 17,500.00
    expect(result.items[0].amount_zar.toNumber()).toBe(17500);
    expect(result.items[0].audit_step.rule_applied).toContain("min 70% of NMD");
  });

  it("calculates excess-demand ratchet penalty when actual demand exceeds NMD", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      nmd_ratchet_multiplier: new Decimal("2.0"),
      components: [
        {
          component_code: "NMD_EXCESS_PENALTY",
          component_name: "NMD Ratchet Penalty",
          component_type: "NMD_RATCHET_PENALTY",
          unit_of_measure: "R/kVA/month",
          rate_value: new Decimal("60.00"),
          rule_id: "RULE_NMD_RATCHET",
          formula_template: "excess_demand * (rate * multiplier)",
          demand_config: {
            demand_unit: "kVA",
            demand_basis: "EXCESS_NMD_DEMAND",
            excess_nmd_multiplier: new Decimal("2.0"),
          },
        },
      ],
    };

    // Maximum demand is 550 kVA, NMD is 500 kVA -> Excess = 50 kVA
    const excessInput: DeterministicCalculationInput = {
      ...baseInput,
      maximum_demand_kva: new Decimal("550"),
      notified_maximum_demand_kva: new Decimal("500"),
    };

    const result = DeterministicEngine.calculateTariff(excessInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.quantity.toString()).toBe("50");
    // Penalty rate = R 60.00 * 2.0x = R 120.00
    // Amount = 50 kVA * R 120.00 = R 6,000.00
    expect(item.rate.toNumber()).toBe(120);
    expect(item.amount_zar.toNumber()).toBe(6000);
  });

  it("calculates tiered capacity bands correctly with boundary testing", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "DEMAND_BANDED",
          component_name: "Tiered Capacity Demand Charge",
          component_type: "CAPACITY_CHARGE",
          unit_of_measure: "R/kVA/month",
          rate_value: new Decimal("0"), // Defined by bands
          rule_id: "RULE_BANDED_DEMAND",
          formula_template: "slice * band_rate",
          demand_config: {
            demand_unit: "kVA",
            demand_basis: "MAXIMUM_DEMAND",
            calculation_method: "PROGRESSIVE_BAND",
            demand_bands: [
              {
                band_number: 1,
                min_demand: new Decimal("0"),
                max_demand: new Decimal("100"),
                rate_value: new Decimal("50.00"),
                unit_of_measure: "R/kVA/month",
              },
              {
                band_number: 2,
                min_demand: new Decimal("100"),
                max_demand: new Decimal("300"),
                rate_value: new Decimal("40.00"),
                unit_of_measure: "R/kVA/month",
              },
              {
                band_number: 3,
                min_demand: new Decimal("300"),
                rate_value: new Decimal("30.00"),
                unit_of_measure: "R/kVA/month",
              },
            ],
          },
        },
      ],
    };

    // Demand = 350 kVA:
    // Band 1: 0-100 kVA (100 kVA @ R 50.00) = R 5,000.00
    // Band 2: 100-300 kVA (200 kVA @ R 40.00) = R 8,000.00
    // Band 3: >300 kVA (50 kVA @ R 30.00) = R 1,500.00
    // Total = R 14,500.00
    const tieredInput: DeterministicCalculationInput = {
      ...baseInput,
      maximum_demand_kva: new Decimal("350"),
    };

    const result = DeterministicEngine.calculateTariff(tieredInput, tariff);
    expect(result.items.length).toBe(3);

    const b1 = result.items.find((i) => i.component_code === "DEMAND_BANDED_BAND_1")!;
    expect(b1.quantity.toString()).toBe("100");
    expect(b1.amount_zar.toNumber()).toBe(5000);

    const b2 = result.items.find((i) => i.component_code === "DEMAND_BANDED_BAND_2")!;
    expect(b2.quantity.toString()).toBe("200");
    expect(b2.amount_zar.toNumber()).toBe(8000);

    const b3 = result.items.find((i) => i.component_code === "DEMAND_BANDED_BAND_3")!;
    expect(b3.quantity.toString()).toBe("50");
    expect(b3.amount_zar.toNumber()).toBe(1500);

    expect(result.subtotal_ex_vat.toNumber()).toBe(14500);
  });

  it("applies demand rounding rules correctly (INTEGER rounding)", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "DEMAND_ROUNDED",
          component_name: "Rounded Demand Charge",
          component_type: "DEMAND_CHARGE",
          unit_of_measure: "R/kVA/month",
          rate_value: new Decimal("100.00"),
          rule_id: "RULE_ROUNDED_DEMAND",
          formula_template: "round(demand) * rate",
          demand_config: {
            demand_unit: "kVA",
            demand_basis: "MAXIMUM_DEMAND",
            rounding_rule: "INTEGER",
          },
        },
      ],
    };

    const fractionalInput: DeterministicCalculationInput = {
      ...baseInput,
      maximum_demand_kva: new Decimal("450.64"),
    };

    const result = DeterministicEngine.calculateTariff(fractionalInput, tariff);
    expect(result.items.length).toBe(1);
    // 450.64 rounded to integer = 451 kVA
    expect(result.items[0].quantity.toString()).toBe("451");
    // 451 * R 100.00 = R 45,100.00
    expect(result.items[0].amount_zar.toNumber()).toBe(45100);
  });
});

describe("Requirement 14: Fixed, Network, and Service Charges", () => {
  const baseInput: DeterministicCalculationInput = {
    billing_start: "2025-07-01",
    billing_end: "2025-07-15", // 15 billing days (partial month)
    active_energy_kwh: new Decimal("10000"),
    peak_kwh: new Decimal("3000"),
    standard_kwh: new Decimal("5000"),
    off_peak_kwh: new Decimal("2000"),
    maximum_demand_kva: new Decimal("50"),
    notified_maximum_demand_kva: new Decimal("50"),
    utilised_capacity_kva: new Decimal("50"),
    reactive_energy_kvarh: new Decimal("0"),
    power_factor: new Decimal("0.99"),
    account_number: "ACC-100293",
    meter_count: 2,
    connection_count: 1,
  };

  it("calculates fixed daily charge multiplied by billing days", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "FIXED_DAILY_ADMIN",
          component_name: "Daily Administration Charge",
          component_type: "ADMINISTRATION_CHARGE",
          unit_of_measure: "R/day",
          rate_value: new Decimal("12.50"),
          rule_id: "RULE_DAILY_ADMIN",
          formula_template: "days * rate",
          fixed_charge_config: {
            charge_scope: "per_day",
            proration_rule: "DAILY_RATE_MULTIPLIER",
          },
        },
      ],
    };

    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.quantity.toString()).toBe("15"); // 15 days
    // 15 days * R 12.50 = R 187.50
    expect(item.amount_zar.toNumber()).toBe(187.50);
  });

  it("prorates monthly service charge using exact calendar days in month (July has 31 days)", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "MONTHLY_SERVICE_EXACT",
          component_name: "Monthly Service Charge",
          component_type: "SERVICE_CHARGE",
          unit_of_measure: "R/month",
          rate_value: new Decimal("620.00"),
          rule_id: "RULE_MONTHLY_EXACT",
          formula_template: "(days / days_in_month) * rate",
          fixed_charge_config: {
            charge_scope: "per_month",
            proration_rule: "EXACT_DAYS_IN_MONTH",
          },
        },
      ],
    };

    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    // 15 days / 31 days in July = 0.4839 month
    // 620 * (15 / 31) = R 300.00
    expect(item.amount_zar.toNumber()).toBe(300.00);
    expect(item.audit_step.formula_used).toBe("amount = (billing_days / 31) * rate_per_month");
  });

  it("prorates monthly service charge using approved 30-day tariff rule", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "MONTHLY_SERVICE_30DAY",
          component_name: "Monthly Network Charge",
          component_type: "NETWORK_CHARGE",
          unit_of_measure: "R/month",
          rate_value: new Decimal("600.00"),
          rule_id: "RULE_MONTHLY_30DAY",
          formula_template: "(days / 30) * rate",
          fixed_charge_config: {
            charge_scope: "per_month",
            proration_rule: "PRO_RATA_30_DAYS",
          },
        },
      ],
    };

    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    // 15 days / 30 days = 0.50 month
    // 600 * 0.5 = R 300.00
    expect(item.quantity.toNumber()).toBe(0.5);
    expect(item.amount_zar.toNumber()).toBe(300.00);
    expect(item.audit_step.formula_used).toBe("amount = (billing_days / 30) * rate_per_month");
  });

  it("charges full month unconditionally when tariff forbids partial proration", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "MONTHLY_FIXED_NO_PRORATE",
          component_name: "Full Month Connection Fee",
          component_type: "SERVICE_CHARGE",
          unit_of_measure: "R/month",
          rate_value: new Decimal("500.00"),
          rule_id: "RULE_FULL_MONTH",
          formula_template: "1 * rate",
          fixed_charge_config: {
            charge_scope: "per_month",
            proration_rule: "NO_PRORATION_FULL_MONTH",
          },
        },
      ],
    };

    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.quantity.toNumber()).toBe(1);
    expect(item.amount_zar.toNumber()).toBe(500.00);
    expect(item.audit_step.rule_applied).toContain("no proration for partial period");
  });

  it("scales metering charges by meter count (2 meters on account)", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "METERING_CHARGE_PER_METER",
          component_name: "Basic Metering Charge",
          component_type: "METERING_CHARGE",
          unit_of_measure: "R/meter/month",
          rate_value: new Decimal("75.00"),
          rule_id: "RULE_METER_CHARGE",
          formula_template: "meter_count * rate",
          fixed_charge_config: {
            charge_scope: "per_meter",
            proration_rule: "PER_BILLING_PERIOD_FLAT",
          },
        },
      ],
    };

    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.quantity.toNumber()).toBe(2); // 2 meters
    // 2 meters * R 75.00 = R 150.00
    expect(item.amount_zar.toNumber()).toBe(150.00);
  });

  it("prevents accidental duplicate application of per-account fixed charge across multiple meters or segments", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "ACCOUNT_SERVICE_FEE",
          component_name: "Account Administration Fee",
          component_type: "SERVICE_CHARGE",
          unit_of_measure: "R/month",
          rate_value: new Decimal("250.00"),
          rule_id: "RULE_ACC_FEE",
          formula_template: "1 * rate",
          fixed_charge_config: {
            charge_scope: "per_account",
            proration_rule: "NO_PRORATION_FULL_MONTH",
            deduplication_key: "ACC-100293_ACCOUNT_SERVICE_FEE",
          },
        },
      ],
    };

    // First run applies the fee
    const firstResult = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(firstResult.items.length).toBe(1);
    expect(firstResult.items[0].amount_zar.toNumber()).toBe(250.00);

    // Second run with already_applied_fixed_charge_keys flags suppression
    const secondInput: DeterministicCalculationInput = {
      ...baseInput,
      already_applied_fixed_charge_keys: ["ACC-100293_ACCOUNT_SERVICE_FEE"],
    };

    const secondResult = DeterministicEngine.calculateTariff(secondInput, tariff);
    expect(secondResult.items.length).toBe(0);
    // Audit trace records the duplicate suppression cleanly
    const suppressedStep = secondResult.audit_trace.find((s) => s.component_code === "ACCOUNT_SERVICE_FEE");
    expect(suppressedStep).toBeDefined();
    expect(suppressedStep!.formula_used).toBe("amount = 0 (deduplicated)");
    expect(suppressedStep!.formatted_amount_zar).toContain("Suppressed Duplicate");
  });
});
