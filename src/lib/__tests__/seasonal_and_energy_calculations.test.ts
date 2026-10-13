import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { TouScheduleEngine } from "../../domain/tariff/touScheduleEngine";
import { DeterministicEngine } from "../../domain/tariff/deterministicEngine";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";
import type {
  TariffVersionDefinition,
  DeterministicCalculationInput,
  TariffComponentRule,
} from "../../domain/tariff/types";

describe("Requirement 11: Seasonal Tariff Rules", () => {
  it("classifies Eskom tariffs using approved NERSA Gazetted Seasonal Calendar (Jun-Aug High, Sep-May Low)", () => {
    const eskomTariff = ESKOM_MEGAFLEX_2025_2026;

    const winterDate = new Date("2025-07-15T12:00:00+02:00");
    const summerDate = new Date("2025-11-15T12:00:00+02:00");

    const winterClassification = TouScheduleEngine.classifySeason(winterDate, eskomTariff);
    expect(winterClassification.season).toBe("high");
    expect(winterClassification.rule_id).toBe("RULE_NERSA_ESKOM_SEASONAL_CALENDAR");
    expect(winterClassification.source_evidence).toContain("NERSA Gazetted Electricity Tariff Schedule");
    expect(winterClassification.is_inferred).toBe(false);

    const summerClassification = TouScheduleEngine.classifySeason(summerDate, eskomTariff);
    expect(summerClassification.season).toBe("low");
    expect(summerClassification.rule_id).toBe("RULE_NERSA_ESKOM_SEASONAL_CALENDAR");
    expect(summerClassification.is_inferred).toBe(false);
  });

  it("supports configurable municipal seasonal definitions with utility-specific month calendar", () => {
    // City of Cape Town where winter/high season is May, June, July, August (months 5, 6, 7, 8)
    const capeTownTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "CPT_COMMERCIAL_TOU",
        tariff_name: "City of Cape Town Commercial TOU",
        utility: "City of Cape Town",
        tariff_family: "municipal",
        version: "2025.1",
        effective_date: "2025-07-01",
        expiry_date: "2026-06-30",
        season: "high",
        voltage_level: "medium",
        customer_class: "commercial",
        status: "active",
        vat_treatment: "standard_15",
        source_document: "City of Cape Town Tariff Schedule 2025/2026 Annexure 2",
        source_hash: "hash123",
      },
      season_definitions: [
        {
          season_name: "high",
          months: [5, 6, 7, 8], // May to August!
          rule_id: "RULE_CPT_WINTER_CALENDAR",
          source_evidence: "City of Cape Town Electricity By-law Tariff Schedule 2025/2026",
          description: "Cape Town Winter High Demand Season (May to August)",
        },
        {
          season_name: "low",
          months: [1, 2, 3, 4, 9, 10, 11, 12],
          rule_id: "RULE_CPT_SUMMER_CALENDAR",
          source_evidence: "City of Cape Town Electricity By-law Tariff Schedule 2025/2026",
          description: "Cape Town Summer Low Demand Season (September to April)",
        },
      ],
      tou_schedule: [],
      components: [],
      public_holidays: [],
      reactive_penalty_rate: new Decimal("0.20"),
      pf_threshold: new Decimal("0.96"),
      nmd_ratchet_multiplier: new Decimal("2.0"),
      minimum_nmd_kva: new Decimal("50"),
    };

    // 15 May: Under Eskom rules this would be Low, but under Cape Town rules this is High (Winter)!
    const mayDate = new Date("2025-05-15T10:00:00+02:00");
    const classification = TouScheduleEngine.classifySeason(mayDate, capeTownTariff);

    expect(classification.season).toBe("high");
    expect(classification.rule_id).toBe("RULE_CPT_WINTER_CALENDAR");
    expect(classification.source_evidence).toContain("City of Cape Town Electricity By-law");
    expect(classification.is_inferred).toBe(false);
  });

  it("supports configurable seasonal date-range definitions including ranges crossing year boundaries", () => {
    // Utility defining High Demand Season from 1 November to 28 February
    const customTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "SUMMER_PEAK_TARIFF",
        tariff_name: "Summer Agricultural High Season",
        utility: "Irrigation Board",
        tariff_family: "custom",
        version: "2025.1",
        effective_date: "2025-01-01",
        season: "high",
        voltage_level: "low",
        customer_class: "commercial",
        status: "active",
        vat_treatment: "standard_15",
        source_document: "Water & Power Gazette 2025",
        source_hash: "hash_agr",
      },
      season_definitions: [
        {
          season_name: "high",
          date_ranges: [
            {
              start_date: "11-01",
              end_date: "02-28",
            },
          ],
          rule_id: "RULE_AGR_SUMMER_PEAK",
          source_evidence: "Agricultural Pumping Schedule 2025 Clause 4",
        },
        {
          season_name: "low",
          date_ranges: [
            {
              start_date: "03-01",
              end_date: "10-31",
            },
          ],
          rule_id: "RULE_AGR_WINTER_OFFPEAK",
          source_evidence: "Agricultural Pumping Schedule 2025 Clause 4",
        },
      ],
      tou_schedule: [],
      components: [],
      public_holidays: [],
      reactive_penalty_rate: new Decimal("0.20"),
      pf_threshold: new Decimal("0.95"),
      nmd_ratchet_multiplier: new Decimal("1.5"),
      minimum_nmd_kva: new Decimal("20"),
    };

    const decDate = new Date("2025-12-15T10:00:00+02:00");
    const janDate = new Date("2026-01-10T10:00:00+02:00");
    const aprDate = new Date("2025-04-10T10:00:00+02:00");

    expect(TouScheduleEngine.classifySeason(decDate, customTariff).season).toBe("high");
    expect(TouScheduleEngine.classifySeason(janDate, customTariff).season).toBe("high");
    expect(TouScheduleEngine.classifySeason(aprDate, customTariff).season).toBe("low");
  });

  it("does not infer high/low season for non-seasonal tariffs without season rules", () => {
    const flatTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "FLAT_BUSINESS",
        tariff_name: "Flat Commercial Tariff",
        utility: "Local Municipality",
        tariff_family: "municipal",
        version: "2025.1",
        effective_date: "2025-07-01",
        season: "high",
        voltage_level: "low",
        customer_class: "commercial",
        status: "active",
        vat_treatment: "standard_15",
        source_document: "Municipal Schedule 2025",
        source_hash: "hash_flat",
      },
      tou_schedule: [],
      components: [],
      public_holidays: [],
      reactive_penalty_rate: new Decimal("0.20"),
      pf_threshold: new Decimal("0.95"),
      nmd_ratchet_multiplier: new Decimal("2.0"),
      minimum_nmd_kva: new Decimal("20"),
    };

    const anyDate = new Date("2025-07-15T12:00:00+02:00");
    const classif = TouScheduleEngine.classifySeason(anyDate, flatTariff);

    // Single-season header is respected, or evaluated without universal high/low assumption
    expect(classif.is_inferred).toBe(false);
    expect(classif.source_evidence).toBeDefined();
  });
});

describe("Requirement 12: Energy Charge Calculations", () => {
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
    reactive_energy_kvarh: new Decimal("10000"),
    power_factor: new Decimal("0.97"),
  };

  it("calculates TOU energy charges (Peak, Standard, Off-Peak) deterministically", () => {
    const result = DeterministicEngine.calculateTariff(baseInput, ESKOM_MEGAFLEX_2025_2026);

    // Verify Peak Energy Item
    const peakItem = result.items.find((i) => i.component_code === "PEAK_ENERGY_HIGH");
    expect(peakItem).toBeDefined();
    expect(peakItem!.quantity.toString()).toBe("30000");
    // 30,000 kWh * 666.92 c/kWh / 100 = R 200,076.00
    expect(peakItem!.amount_zar.toNumber()).toBe(200076);
    expect(peakItem!.audit_step.formula_used).toBe("amount = (qty_kwh * rate_cents) / 100");

    // Verify Standard Energy Item
    const stdItem = result.items.find((i) => i.component_code === "STANDARD_ENERGY_HIGH");
    expect(stdItem).toBeDefined();
    expect(stdItem!.quantity.toString()).toBe("50000");
    // 50,000 kWh * 198.84 c/kWh / 100 = R 99,420.00
    expect(stdItem!.amount_zar.toNumber()).toBe(99420);

    // Verify Off-Peak Energy Item
    const offPeakItem = result.items.find((i) => i.component_code === "OFF_PEAK_ENERGY_HIGH");
    expect(offPeakItem).toBeDefined();
    expect(offPeakItem!.quantity.toString()).toBe("20000");
    // 20,000 kWh * 111.15 c/kWh / 100 = R 22,230.00
    expect(offPeakItem!.amount_zar.toNumber()).toBe(22230);
  });

  it("calculates flat energy charge when tariff uses flat rate structure", () => {
    const flatTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "FLAT_COMMERCIAL",
        tariff_name: "Flat Commercial Electricity",
        utility: "Ekurhuleni",
        tariff_family: "municipal",
        version: "2025.1",
        effective_date: "2025-07-01",
        season: "high",
        voltage_level: "low",
        customer_class: "commercial",
        status: "active",
        vat_treatment: "standard_15",
        source_document: "Ekurhuleni Tariff Schedule 2025/26",
        source_hash: "hash_eku",
      },
      tou_schedule: [],
      components: [
        {
          component_code: "FLAT_ENERGY",
          component_name: "Flat Active Energy Charge",
          component_type: "ACTIVE_ENERGY",
          unit_of_measure: "c/kWh",
          rate_value: new Decimal("285.50"),
          rule_id: "RULE_FLAT_ENERGY",
          formula_template: "qty * rate / 100",
        },
      ],
      public_holidays: [],
      reactive_penalty_rate: new Decimal("0.20"),
      pf_threshold: new Decimal("0.95"),
      nmd_ratchet_multiplier: new Decimal("2.0"),
      minimum_nmd_kva: new Decimal("20"),
    };

    const input: DeterministicCalculationInput = {
      ...baseInput,
      active_energy_kwh: new Decimal("12500"),
    };

    const result = DeterministicEngine.calculateTariff(input, flatTariff);
    const item = result.items.find((i) => i.component_code === "FLAT_ENERGY");
    expect(item).toBeDefined();
    expect(item!.quantity.toString()).toBe("12500");
    // 12,500 * 285.50 / 100 = R 35,687.50
    expect(item!.amount_zar.toNumber()).toBe(35687.50);
  });

  it("calculates progressive block tariff correctly by slicing consumption into brackets", () => {
    // Progressive Tiered Tariff (e.g. Incline Block Tariff):
    // Tier 1: 0 - 350 kWh @ 210.00 c/kWh
    // Tier 2: 350 - 600 kWh @ 280.00 c/kWh
    // Tier 3: > 600 kWh @ 340.00 c/kWh
    const tieredTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "IBT_RESIDENTIAL",
        tariff_name: "Domestic Incline Block Tariff",
        utility: "City Power",
        tariff_family: "municipal",
        version: "2025.1",
        effective_date: "2025-07-01",
        season: "high",
        voltage_level: "low",
        customer_class: "residential",
        status: "active",
        vat_treatment: "standard_15",
        source_document: "City Power Tariffs 2025/26",
        source_hash: "cp_hash",
      },
      tou_schedule: [],
      components: [
        {
          component_code: "IBT_ENERGY",
          component_name: "Domestic Active Energy",
          component_type: "ACTIVE_ENERGY",
          unit_of_measure: "c/kWh",
          rate_value: new Decimal("0"), // tiered
          rule_id: "RULE_IBT_ENERGY",
          formula_template: "sum(slice * tier_rate)",
          tier_config: {
            calculation_method: "PROGRESSIVE_BLOCK",
            tiers: [
              {
                tier_number: 1,
                min_kwh: new Decimal(0),
                max_kwh: new Decimal(350),
                rate_value: new Decimal("210.00"),
                rule_id: "RULE_IBT_T1",
              },
              {
                tier_number: 2,
                min_kwh: new Decimal(350),
                max_kwh: new Decimal(600),
                rate_value: new Decimal("280.00"),
                rule_id: "RULE_IBT_T2",
              },
              {
                tier_number: 3,
                min_kwh: new Decimal(600),
                rate_value: new Decimal("340.00"),
                rule_id: "RULE_IBT_T3",
              },
            ],
          },
        },
      ],
      public_holidays: [],
      reactive_penalty_rate: new Decimal("0"),
      pf_threshold: new Decimal("0.95"),
      nmd_ratchet_multiplier: new Decimal("1.0"),
      minimum_nmd_kva: new Decimal("0"),
    };

    // Customer consumed 750 kWh:
    // Block 1 (0-350): 350 kWh @ 210 c/kWh = R 735.00
    // Block 2 (350-600): 250 kWh @ 280 c/kWh = R 700.00
    // Block 3 (>600): 150 kWh @ 340 c/kWh = R 510.00
    // Total = R 1,945.00
    const input: DeterministicCalculationInput = {
      ...baseInput,
      active_energy_kwh: new Decimal(750),
      peak_kwh: new Decimal(0),
      standard_kwh: new Decimal(0),
      off_peak_kwh: new Decimal(0),
    };

    const result = DeterministicEngine.calculateTariff(input, tieredTariff);

    const t1Item = result.items.find((i) => i.component_code === "IBT_ENERGY_T1");
    const t2Item = result.items.find((i) => i.component_code === "IBT_ENERGY_T2");
    const t3Item = result.items.find((i) => i.component_code === "IBT_ENERGY_T3");

    expect(t1Item).toBeDefined();
    expect(t1Item!.quantity.toNumber()).toBe(350);
    expect(t1Item!.amount_zar.toNumber()).toBe(735.00);

    expect(t2Item).toBeDefined();
    expect(t2Item!.quantity.toNumber()).toBe(250);
    expect(t2Item!.amount_zar.toNumber()).toBe(700.00);

    expect(t3Item).toBeDefined();
    expect(t3Item!.quantity.toNumber()).toBe(150);
    expect(t3Item!.amount_zar.toNumber()).toBe(510.00);

    const totalEnergy = t1Item!.amount_zar.add(t2Item!.amount_zar).add(t3Item!.amount_zar);
    expect(totalEnergy.toNumber()).toBe(1945.00);
  });

  it("calculates entire consumption band rate by applying matching band to entire volume", () => {
    // Commercial Banded Tariff:
    // Band 1: 0 - 1000 kWh @ 250.00 c/kWh
    // Band 2: 1001 - 5000 kWh @ 220.00 c/kWh
    // Band 3: > 5000 kWh @ 190.00 c/kWh
    const bandedTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "BANDED_COMMERCIAL",
        tariff_name: "Volume Banded Commercial Tariff",
        utility: "City of Tshwane",
        tariff_family: "municipal",
        version: "2025.1",
        effective_date: "2025-07-01",
        season: "high",
        voltage_level: "low",
        customer_class: "commercial",
        status: "active",
        vat_treatment: "standard_15",
        source_document: "Tshwane Tariffs 2025/26",
        source_hash: "tsh_hash",
      },
      tou_schedule: [],
      components: [
        {
          component_code: "BAND_ENERGY",
          component_name: "Commercial Energy Volume Band",
          component_type: "ACTIVE_ENERGY",
          unit_of_measure: "c/kWh",
          rate_value: new Decimal("0"),
          rule_id: "RULE_BAND_ENERGY",
          formula_template: "total_qty * matching_band_rate",
          tier_config: {
            calculation_method: "ENTIRE_CONSUMPTION_BAND",
            tiers: [
              {
                tier_number: 1,
                min_kwh: new Decimal(0),
                max_kwh: new Decimal(1000),
                rate_value: new Decimal("250.00"),
                rule_id: "RULE_BAND_1",
              },
              {
                tier_number: 2,
                min_kwh: new Decimal(1001),
                max_kwh: new Decimal(5000),
                rate_value: new Decimal("220.00"),
                rule_id: "RULE_BAND_2",
              },
              {
                tier_number: 3,
                min_kwh: new Decimal(5001),
                rate_value: new Decimal("190.00"),
                rule_id: "RULE_BAND_3",
              },
            ],
          },
        },
      ],
      public_holidays: [],
      reactive_penalty_rate: new Decimal("0"),
      pf_threshold: new Decimal("0.95"),
      nmd_ratchet_multiplier: new Decimal("1.0"),
      minimum_nmd_kva: new Decimal("0"),
    };

    // Customer consumed 1,200 kWh:
    // Falls into Band 2 (1001-5000 kWh).
    // The ENTIRE 1,200 kWh is multiplied by Band 2 rate (220 c/kWh):
    // 1,200 * 220 / 100 = R 2,640.00
    const input: DeterministicCalculationInput = {
      ...baseInput,
      active_energy_kwh: new Decimal(1200),
      peak_kwh: new Decimal(0),
      standard_kwh: new Decimal(0),
      off_peak_kwh: new Decimal(0),
    };

    const result = DeterministicEngine.calculateTariff(input, bandedTariff);
    const bandItem = result.items.find((i) => i.component_code === "BAND_ENERGY_BAND_2");

    expect(bandItem).toBeDefined();
    expect(bandItem!.quantity.toNumber()).toBe(1200); // ENTIRE volume
    expect(bandItem!.rate.toNumber()).toBe(220.00);
    expect(bandItem!.amount_zar.toNumber()).toBe(2640.00);

    // Verify it did NOT slice into progressive block 1
    const band1Item = result.items.find((i) => i.component_code.includes("BAND_1"));
    expect(band1Item).toBeUndefined();
  });

  it("validates quantities and units and rejects invalid or negative values safely", () => {
    const tariff = ESKOM_MEGAFLEX_2025_2026;

    // 1. Negative active energy
    const invalidInput: DeterministicCalculationInput = {
      ...baseInput,
      active_energy_kwh: new Decimal(-500),
    };

    expect(() => DeterministicEngine.calculateTariff(invalidInput, tariff)).toThrowError(
      "Invalid quantity: active_energy_kwh cannot be negative",
    );

    // 2. Missing/NaN demand quantity
    const nanInput: any = {
      ...baseInput,
      maximum_demand_kva: undefined,
    };

    expect(() => DeterministicEngine.calculateTariff(nanInput, tariff)).toThrowError(
      "Invalid quantity: maximum_demand_kva must be a valid numeric Decimal value",
    );

    // 3. Component missing unit of measure
    const brokenTariff = JSON.parse(JSON.stringify(tariff), (k, v) => {
      if (typeof v === "string" && !isNaN(Number(v)) && (k === "rate_value" || k.endsWith("_rate") || k.endsWith("_threshold") || k.endsWith("_multiplier") || k.endsWith("_kva"))) {
        return new Decimal(v);
      }
      return v;
    });
    brokenTariff.components[0].unit_of_measure = "";

    expect(() => DeterministicEngine.calculateTariff(baseInput, brokenTariff)).toThrowError(
      "is missing a unit of measure",
    );
  });
});
