import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import { DeterministicEngine } from "../../domain/tariff/deterministicEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";
import {
  TariffUnitNormalisationEngine,
  IncompatibleUnitComparisonError,
} from "../../domain/tariff/tariffUnitNormalisationEngine";
import {
  RoundingPolicyEngine,
  STANDARD_NERSA_ROUNDING_POLICY,
  BANKERS_ROUNDING_POLICY,
} from "../../domain/tariff/roundingPolicyEngine";
import { TariffMatchingEngine } from "../../domain/tariff/tariffMatchingEngine";
import { TariffAssignmentEngine } from "../../domain/tariff/tariffAssignmentEngine";
import type {
  TariffVersionDefinition,
  DeterministicCalculationInput,
  RoundingPolicyConfig,
  TariffTaxRule,
} from "../../domain/tariff/types";

describe("Tax Treatment Audit & Review Flagging (Follow-up to Requirement 16)", () => {
  const baseInput: DeterministicCalculationInput = {
    billing_start: "2025-07-01",
    billing_end: "2025-07-31",
    active_energy_kwh: new Decimal("50000"),
    peak_kwh: new Decimal("15000"),
    standard_kwh: new Decimal("25000"),
    off_peak_kwh: new Decimal("10000"),
    maximum_demand_kva: new Decimal("300"),
    notified_maximum_demand_kva: new Decimal("350"),
    utilised_capacity_kva: new Decimal("300"),
    reactive_energy_kvarh: new Decimal("1000"),
    power_factor: new Decimal("0.98"),
  };

  it("records all required tax audit fields: rule ID, effective period, taxable base, rate, rounding, calculated tax, source reference", () => {
    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      components: [
        {
          component_code: "ENERGY_CHARGE",
          component_name: "Active Energy Charge",
          component_type: "ACTIVE_ENERGY",
          unit_of_measure: "R/kWh",
          rate_value: new Decimal("2.50"),
        },
      ],
    };

    // 50,000 kWh * R 2.50 = R 125,000.00
    // Taxable base = R 125,000.00
    // VAT (15%) = R 18,750.00
    const result = DeterministicEngine.calculateTariff(baseInput, tariff);
    expect(result.tax_breakdown).toBeDefined();
    const tax = result.tax_breakdown!;

    expect(tax.tax_rule_id).toBe("VAT_ZA_CURRENT_15");
    expect(tax.effective_period.from).toBe("2018-04-01");
    expect(tax.taxable_base.toNumber()).toBe(125000);
    expect(tax.applicable_rate.toString()).toBe("0.15");
    expect(tax.rounding_method).toBe("ROUND_HALF_UP_2_DECIMALS");
    expect(tax.calculated_tax.toNumber()).toBe(18750);
    expect(tax.source_reference).toContain("Value-Added Tax Act");
  });

  it("flags REVIEW_REQUIRED when tax treatment cannot be established instead of guessing", () => {
    // Custom tax rules that DO NOT cover the invoice billing period (only valid for 2020)
    const customRules: TariffTaxRule[] = [
      {
        rule_id: "VAT_EXPIRED_2020",
        jurisdiction: "ZA",
        tax_name: "Expired VAT",
        rate: new Decimal("0.15"),
        effective_from: "2020-01-01",
        effective_to: "2020-12-31",
      },
    ];

    const inputOutOfPeriod: DeterministicCalculationInput = {
      ...baseInput,
      billing_start: "2025-07-01",
      billing_end: "2025-07-31",
      tax_rules_override: customRules,
    };

    const tariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      tax_rules: customRules,
      components: [
        {
          component_code: "ENERGY_CHARGE",
          component_name: "Active Energy Charge",
          component_type: "ACTIVE_ENERGY",
          unit_of_measure: "R/kWh",
          rate_value: new Decimal("2.50"),
        },
      ],
    };

    const result = DeterministicEngine.calculateTariff(inputOutOfPeriod, tariff);
    expect(result.unresolved_items).toBeDefined();
    const taxUnresolved = result.unresolved_items?.find((u) => u.component_code === "TAX_VAT");
    expect(taxUnresolved).toBeDefined();
    expect(taxUnresolved?.reason).toContain("REVIEW_REQUIRED");
    expect(taxUnresolved?.reason).toContain("No configured tax rule matches the effective period");
    expect(taxUnresolved?.missing_data).toContain("applicable_tax_rule");
  });
});

describe("Requirement 17: Unit Normalisation", () => {
  it("normalises energy, power, and currency rate units to canonical forms", () => {
    // Active Energy: MWh to kWh
    const normEnergy = TariffUnitNormalisationEngine.normalize(2.5, "MWh");
    expect(normEnergy.normalised_value.toNumber()).toBe(2500);
    expect(normEnergy.normalised_unit).toBe("kWh");
    expect(normEnergy.dimension).toBe("ACTIVE_ENERGY");

    // Active Power: MW to kW
    const normPower = TariffUnitNormalisationEngine.normalize(1.2, "MW");
    expect(normPower.normalised_value.toNumber()).toBe(1200);
    expect(normPower.normalised_unit).toBe("kW");
    expect(normPower.dimension).toBe("ACTIVE_POWER");

    // Apparent Power: MVA to kVA
    const normKva = TariffUnitNormalisationEngine.normalize(0.85, "MVA");
    expect(normKva.normalised_value.toNumber()).toBe(850);
    expect(normKva.normalised_unit).toBe("kVA");

    // Reactive Energy: MVArh to kVArh
    const normKvarh = TariffUnitNormalisationEngine.normalize(0.3, "MVArh");
    expect(normKvarh.normalised_value.toNumber()).toBe(300);
    expect(normKvarh.normalised_unit).toBe("kVArh");

    // Currency rate: c/kWh to R/kWh
    const normRate = TariffUnitNormalisationEngine.normalize(145.5, "c/kWh");
    expect(normRate.normalised_value.toNumber()).toBe(1.455);
    expect(normRate.normalised_unit).toBe("R/kWh");
    expect(normRate.dimension).toBe("CURRENCY_PER_ACTIVE_ENERGY");

    // Daily service charge: c/day to R/day
    const normDaily = TariffUnitNormalisationEngine.normalize(8550, "c/day");
    expect(normDaily.normalised_value.toNumber()).toBe(85.5);
    expect(normDaily.normalised_unit).toBe("R/day");
  });

  it("preserves complete conversion audit lineage (original value, unit, converted value, rule, version)", () => {
    const result = TariffUnitNormalisationEngine.normalize(250.75, "c/kWh");
    const rec = result.conversion_record;

    expect(rec.audit_id).toBeDefined();
    expect(rec.original_value.toString()).toBe("250.75");
    expect(rec.original_unit).toBe("c/kWh");
    expect(rec.normalised_value.toString()).toBe("2.5075");
    expect(rec.normalised_unit).toBe("R/kWh");
    expect(rec.conversion_rule).toContain("Divide cents by 100");
    expect(rec.calculation_version).toBe("ENERA-TARIFF-UNIT-NORM-V1.0");
    expect(rec.conversion_factor.toString()).toBe("0.01");
    expect(rec.timestamp_utc).toBeDefined();
  });

  it("strictly prohibits comparing or converting incompatible units", () => {
    // Comparing active energy (kWh) with active power (kW)
    expect(() => {
      TariffUnitNormalisationEngine.compareQuantities(
        { value: 100, unit: "kWh" },
        { value: 100, unit: "kW" },
      );
    }).toThrow(IncompatibleUnitComparisonError);

    // Comparing apparent power (kVA) with energy tariff rate (c/kWh)
    expect(() => {
      TariffUnitNormalisationEngine.compareQuantities(
        { value: 50, unit: "kVA" },
        { value: 50, unit: "c/kWh" },
      );
    }).toThrow(/INCOMPATIBLE_UNIT_COMPARISON/);
  });

  it("does not apply conversion simply because two quantities appear numerically similar", () => {
    // 500 kW demand and 500 kWh consumption have identical numerical values but incompatible units
    expect(() => {
      TariffUnitNormalisationEngine.compareQuantities(
        { value: 500, unit: "kW" },
        { value: 500, unit: "kWh" },
      );
    }).toThrow(/Cross-dimensional operations are strictly prohibited/);
  });
});

describe("Requirement 18: Rounding and Precision", () => {
  it("supports configurable rounding methods (ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_UP, ROUND_DOWN)", () => {
    const val = new Decimal("12.345");

    // Standard half-up
    expect(RoundingPolicyEngine.applyRounding(val, 2, "ROUND_HALF_UP").toNumber()).toBe(12.35);

    // Half-even (banker's rounding)
    expect(RoundingPolicyEngine.applyRounding(new Decimal("12.345"), 2, "ROUND_HALF_EVEN").toNumber()).toBe(12.34);
    expect(RoundingPolicyEngine.applyRounding(new Decimal("12.355"), 2, "ROUND_HALF_EVEN").toNumber()).toBe(12.36);

    // Round down
    expect(RoundingPolicyEngine.applyRounding(val, 2, "ROUND_DOWN").toNumber()).toBe(12.34);

    // Round up
    expect(RoundingPolicyEngine.applyRounding(val, 2, "ROUND_UP").toNumber()).toBe(12.35);
  });

  it("preserves unrounded full precision for intermediate calculations without premature truncation", () => {
    // 10 days of a 30-day billing month at R 1,234.5678 rate
    const policy = STANDARD_NERSA_ROUNDING_POLICY;
    expect(policy.intermediate_calculations_rule).toBe("UNROUNDED_FULL_PRECISION");

    const days = new Decimal(10);
    const totalDays = new Decimal(30);
    const unroundedRatio = days.div(totalDays); // 0.333333333333...

    const rate = new Decimal("1234.5678");
    const unroundedAmount = unroundedRatio.mul(rate); // 411.5226...

    // Premature truncation to 2 decimal places before multiplication produces error:
    // (0.33) * 1234.5678 = 407.407... (over R 4 discrepancy!)
    const premature = new Decimal("0.33").mul(rate);
    expect(unroundedAmount.sub(premature).abs().toNumber()).toBeGreaterThan(4);

    // Official policy: truncate ONLY at final charge-line precision
    const roundedChargeLine = RoundingPolicyEngine.roundChargeLine(unroundedAmount, policy);
    expect(roundedChargeLine.toNumber()).toBe(411.52);
  });

  it("audits discrepancy between line-item rounding and final-total rounding", () => {
    // Invoices with 3 line items of 10.004 Rand
    const lineItems = [
      { amount_zar: new Decimal("10.004") },
      { amount_zar: new Decimal("10.004") },
      { amount_zar: new Decimal("10.004") },
    ];
    const unroundedSubtotal = new Decimal("30.012");
    const vatRate = new Decimal("0.15");

    const audit = RoundingPolicyEngine.auditCalculationRounding(
      lineItems,
      unroundedSubtotal,
      vatRate,
      STANDARD_NERSA_ROUNDING_POLICY,
    );

    expect(audit.policy_id).toBe("ROUNDING_NERSA_STANDARD");
    expect(audit.is_official_policy).toBe(true);
    expect(audit.rate_precision).toBe(4);
    expect(audit.line_item_sum_zar.toNumber()).toBe(30.0); // 3 * 10.00
    expect(audit.unrounded_sum_zar.toNumber()).toBe(30.012);
  });

  it("exposes assumption warning when using an unapproved rounding policy without official authority", () => {
    const unapprovedPolicy: RoundingPolicyConfig = {
      policy_id: "CUSTOM_AD_HOC",
      policy_name: "Ad-hoc Internal Rounding",
      rate_precision: 2,
      rate_rounding_method: "ROUND_DOWN",
      quantity_precision: 1,
      quantity_rounding_method: "ROUND_DOWN",
      charge_line_precision: 2,
      charge_line_rounding_method: "ROUND_DOWN",
      tax_precision: 2,
      tax_rounding_method: "ROUND_DOWN",
      final_total_precision: 2,
      final_total_rounding_method: "ROUND_DOWN",
      intermediate_calculations_rule: "UNROUNDED_FULL_PRECISION",
      is_approved: false, // Not approved!
    };

    const audit = RoundingPolicyEngine.auditCalculationRounding(
      [{ amount_zar: new Decimal("100.00") }],
      new Decimal("100.00"),
      new Decimal("0.15"),
      unapprovedPolicy,
    );

    expect(audit.is_official_policy).toBe(false);
    expect(audit.assumption_warning).toBeDefined();
    expect(audit.assumption_warning).toContain("UNAPPROVED_ROUNDING_POLICY");
  });
});

describe("Requirement 19: Tariff Matching Engine", () => {
  beforeEach(() => {
    TariffMatchingEngine.clearCatalog();
    TariffAssignmentEngine.clearAssignments();
    TariffMatchingEngine.registerTariff(ESKOM_MEGAFLEX_2025_2026);
  });

  it("successfully selects approved tariff based on supply configuration criteria", async () => {
    const result = await TariffMatchingEngine.getApplicableTariff({
      billingPeriod: {
        start: "2025-07-01",
        end: "2025-07-31",
      },
      supplyConfiguration: {
        utility: "Eskom",
        tariff_code: "MEGAFLEX",
        customer_class: "urban_transmission",
        voltage_level: "high",
        demand_kva: 450,
      },
    });

    expect(result.status).toBe("MATCH_FOUND");
    expect(result.selected_tariff).toBeDefined();
    expect(result.selected_tariff?.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
    expect(result.review_required).toBe(false);
    expect(result.selection_reason).toContain("Matched approved tariff");
    expect(result.matched_rules?.length).toBeGreaterThanOrEqual(3);
  });

  it("prioritizes meter and site assignments over generic catalog matching", async () => {
    // Register custom site assignment
    TariffAssignmentEngine.registerAssignment({
      site_id: "SITE-ALPHA-01",
      meter_id: "MTR-SPECIAL-77",
      tariff_code: "ESKOM_MEGAFLEX_HV_2025_2026",
      effective_from: "2025-04-01",
      notified_max_demand_kva: 500,
    });

    const result = await TariffMatchingEngine.getApplicableTariff({
      meter: "MTR-SPECIAL-77",
      billingPeriod: {
        start: "2025-07-01",
        end: "2025-07-31",
      },
    });

    expect(result.status).toBe("MATCH_FOUND");
    expect(result.selected_tariff?.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
    expect(result.selection_reason).toContain("Explicit meter assignment for meter 'MTR-SPECIAL-77'");
  });

  it("returns AMBIGUOUS_MATCH when multiple approved tariffs match with equal score without arbitrary fallback", async () => {
    // Register two competing tariffs with identical score for the same territory and date
    const competingTariffA: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      header: {
        ...ESKOM_MEGAFLEX_2025_2026.header,
        tariff_code: "CITY_POWER_LPU_A",
        tariff_name: "City Power Large Power User Option A",
        utility: "City Power",
        customer_class: "commercial",
        version: "2025.A",
      },
    };

    const competingTariffB: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      header: {
        ...ESKOM_MEGAFLEX_2025_2026.header,
        tariff_code: "CITY_POWER_LPU_B",
        tariff_name: "City Power Large Power User Option B",
        utility: "City Power",
        customer_class: "commercial",
        version: "2025.B",
      },
    };

    TariffMatchingEngine.registerTariff(competingTariffA);
    TariffMatchingEngine.registerTariff(competingTariffB);

    const result = await TariffMatchingEngine.getApplicableTariff({
      billingPeriod: {
        start: "2025-07-01",
        end: "2025-07-31",
      },
      supplyConfiguration: {
        utility: "City Power",
        customer_class: "commercial",
      },
    });

    expect(result.status).toBe("AMBIGUOUS_MATCH");
    expect(result.review_required).toBe(true);
    expect(result.ambiguous_matches?.length).toBe(2);
    expect(result.review_reason).toContain("Arbitrary selection is strictly prohibited");
  });

  it("returns TARIFF_UNAVAILABLE when no approved tariff matches without falling back silently to newest tariff", async () => {
    // Query for a future date (2030) where no approved tariff exists
    const result = await TariffMatchingEngine.getApplicableTariff({
      billingPeriod: {
        start: "2030-01-01",
        end: "2030-01-31",
      },
      supplyConfiguration: {
        utility: "Eskom",
      },
    });

    expect(result.status).toBe("TARIFF_UNAVAILABLE");
    expect(result.review_required).toBe(true);
    expect(result.review_reason).toContain("Silent fallback to newest or adjacent versions is prohibited");
  });

  it("excludes unapproved or draft tariffs from automated matching", async () => {
    const unapprovedTariff: TariffVersionDefinition = {
      ...ESKOM_MEGAFLEX_2025_2026,
      header: {
        ...ESKOM_MEGAFLEX_2025_2026.header,
        tariff_code: "DRAFT_COMMERCIAL_2025",
        status: "draft" as any, // Not approved!
        is_locked: false,
      },
    };

    TariffMatchingEngine.registerTariff(unapprovedTariff);

    const result = await TariffMatchingEngine.getApplicableTariff({
      billingPeriod: {
        start: "2025-07-01",
        end: "2025-07-31",
      },
      supplyConfiguration: {
        tariff_code: "DRAFT_COMMERCIAL_2025",
      },
    });

    // Must NOT select the draft tariff
    expect(result.selected_tariff?.header.tariff_code).not.toBe("DRAFT_COMMERCIAL_2025");
  });
});
