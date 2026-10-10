import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import {
  CanonicalTariffEngine,
  TariffVersionSelector,
  TariffStorageService,
  ConflictingTariffVersionError,
  TariffNotApplicableError,
  type CanonicalTariffModel,
  type CanonicalTariffIdentity,
  type CanonicalTariffApplicability,
  type CanonicalTariffVersioning,
  type TariffComponentRule,
} from "../../domain/tariff";

describe("ENERA Requirements 5 & 6 — Canonical Tariff Model & Historical Versioning", () => {
  beforeEach(() => {
    TariffVersionSelector.reset();
  });

  describe("Requirement 5: Canonical Tariff Model", () => {
    it("builds and validates a full canonical tariff with identity, applicability, and versioning", () => {
      const identity: CanonicalTariffIdentity = {
        utility: "City of Johannesburg - City Power",
        tariff_id: "CP_LPU_TOU_HV_2025",
        tariff_name: "Large Power User TOU High Voltage",
        tariff_code: "LPU_TOU_HV",
        tariff_category: "Large Power User",
        tariff_description: "Time-of-use industrial and bulk commercial supply at high voltage (> 6.6 kV)",
        municipality_or_territory: "City of Johannesburg",
        customer_class: "commercial",
        voltage_level: "high",
        supply_type: "three_phase",
        metering_type: "amr_interval",
        currency: "ZAR",
        status: "active",
      };

      const applicability: CanonicalTariffApplicability = {
        applicable_customer_classes: ["commercial", "industrial"],
        region_or_municipality: ["City of Johannesburg"],
        voltage_levels: ["high", "transmission"],
        contracted_demand_bands: {
          min_demand_kva: new Decimal("500"),
          max_demand_kva: new Decimal("10000"),
        },
        meter_types: ["amr_interval"],
        applicable_dates: {
          effective_from: "2025-07-01",
          effective_to: "2026-06-30",
        },
        eligibility_conditions: [
          "Connection at >= 6.6 kV",
          "Automated Meter Reading (AMR) 30-minute interval profile required",
          "Contracted minimum notified maximum demand of 500 kVA",
        ],
      };

      const versioning: CanonicalTariffVersioning = {
        tariff_version_id: "CP_LPU_TOU_HV_v2025.1",
        version_number: "2025.1",
        effective_from_date: "2025-07-01",
        effective_to_date: "2026-06-30",
        source_document_id: "COJ_GAZETTE_2025_SCHEDULE",
        source_document_version: "Gazette No. 342 Annexure A",
        import_timestamp: "2025-06-15T10:00:00Z",
        approval_status: "approved",
        approved_by: "specialist.energy@enera.internal",
        approval_timestamp: "2025-06-16T14:30:00Z",
        calculation_rule_version: "calc-v1.0",
        is_locked: true,
        lock_reason: "Approved from official municipal gazette",
      };

      const components: TariffComponentRule[] = [
        {
          component_code: "CP_SERV_DAILY",
          component_name: "Service Charge",
          component_type: "FIXED_DAILY_CHARGE",
          unit_of_measure: "R/day",
          rate_value: new Decimal("125.50"),
          rule_id: "RULE_CP_SERV",
          formula_template: "days * rate",
        },
        {
          component_code: "CP_ENERGY_PEAK",
          component_name: "Peak Active Energy",
          component_type: "ENERGY_PEAK",
          unit_of_measure: "c/kWh",
          season: "high",
          tou_period: "peak",
          rate_value: new Decimal("385.20"),
          rule_id: "RULE_CP_PEAK",
          formula_template: "(qty * rate) / 100",
        },
        {
          component_code: "CP_ENERGY_STD",
          component_name: "Standard Active Energy",
          component_type: "ENERGY_STANDARD",
          unit_of_measure: "c/kWh",
          season: "high",
          tou_period: "standard",
          rate_value: new Decimal("210.40"),
          rule_id: "RULE_CP_STD",
          formula_template: "(qty * rate) / 100",
        },
        {
          component_code: "CP_DEMAND",
          component_name: "Network Demand Charge",
          component_type: "DEMAND_CHARGE",
          unit_of_measure: "R/kVA/month",
          rate_value: new Decimal("185.00"),
          rule_id: "RULE_CP_DEMAND",
          formula_template: "demand_kva * rate",
        },
      ];

      const canonicalTariff = CanonicalTariffEngine.buildCanonicalTariff({
        identity,
        applicability,
        versioning,
        components,
      });

      const validation = CanonicalTariffEngine.validateCanonicalTariff(canonicalTariff);
      expect(validation.isValid).toBe(true);
      expect(canonicalTariff.header.tariff_code).toBe("LPU_TOU_HV");
      expect(canonicalTariff.header.tariff_name).toBe("Large Power User TOU High Voltage");
      expect(canonicalTariff.header.approval_status).toBe("approved");
    });

    it("verifies customer context applicability constraints against canonical rules", () => {
      const canonicalTariff = CanonicalTariffEngine.buildCanonicalTariff({
        identity: {
          utility: "City Power",
          tariff_id: "CP_IND_HV",
          tariff_name: "Industrial HV",
          tariff_code: "IND_HV",
          tariff_category: "Industrial",
          municipality_or_territory: "City of Johannesburg",
          customer_class: "commercial",
          voltage_level: "high",
          supply_type: "three_phase",
          metering_type: "amr_interval",
          currency: "ZAR",
          status: "active",
        },
        applicability: {
          applicable_customer_classes: ["commercial"],
          region_or_municipality: ["City of Johannesburg"],
          voltage_levels: ["high"],
          contracted_demand_bands: {
            min_demand_kva: new Decimal("500"),
            max_demand_kva: new Decimal("5000"),
          },
          applicable_dates: {
            effective_from: "2025-07-01",
            effective_to: "2026-06-30",
          },
        },
        versioning: {
          tariff_version_id: "v2025.1",
          version_number: "2025.1",
          effective_from_date: "2025-07-01",
          effective_to_date: "2026-06-30",
          import_timestamp: "2025-06-01T00:00:00Z",
          approval_status: "approved",
          calculation_rule_version: "v1",
          is_locked: true,
        },
        components: [
          {
            component_code: "BASIC",
            component_name: "Basic Charge",
            component_type: "FIXED_DAILY_CHARGE",
            unit_of_measure: "R/day",
            rate_value: new Decimal("50"),
            rule_id: "R1",
            formula_template: "days * rate",
          },
        ],
      });

      // Matching customer context
      const match = CanonicalTariffEngine.checkApplicability(canonicalTariff, {
        customerClass: "commercial",
        municipalityOrRegion: "City of Johannesburg",
        voltageLevel: "high",
        notifiedDemandKva: new Decimal("1200"),
        billingDate: "2025-10-15",
      });
      expect(match.isApplicable).toBe(true);

      // Failing demand band constraint (< 500 kVA)
      const lowDemand = CanonicalTariffEngine.checkApplicability(canonicalTariff, {
        customerClass: "commercial",
        municipalityOrRegion: "City of Johannesburg",
        voltageLevel: "high",
        notifiedDemandKva: new Decimal("200"),
        billingDate: "2025-10-15",
      });
      expect(lowDemand.isApplicable).toBe(false);
      expect(lowDemand.unmetConditions[0]).toContain("below minimum required 500 kVA");

      // Assert throws TariffNotApplicableError
      expect(() => {
        CanonicalTariffEngine.assertApplicable(canonicalTariff, {
          customerClass: "residential" as any,
          voltageLevel: "low",
        });
      }).toThrowError(TariffNotApplicableError);
    });

    it("supports flexible component structures without assuming a universal template", () => {
      // Municipal Simple 2-part Commercial Tariff: Only Fixed Daily Service Charge + Flat Active Energy
      // No TOU buckets, no demand charges, no capacity charges
      const simpleMunicipalTariff = CanonicalTariffEngine.buildCanonicalTariff({
        identity: {
          utility: "Stellenbosch Municipality",
          tariff_id: "STELL_COMM_2PART",
          tariff_name: "Commercial Two-Part Supply",
          tariff_code: "STELL_COMM_2PART",
          tariff_category: "Commercial",
          municipality_or_territory: "Stellenbosch",
          customer_class: "commercial",
          voltage_level: "low",
          supply_type: "three_phase",
          metering_type: "credit",
          currency: "ZAR",
          status: "active",
        },
        applicability: {
          applicable_customer_classes: ["commercial"],
          region_or_municipality: ["Stellenbosch"],
          voltage_levels: ["low"],
          applicable_dates: { effective_from: "2025-07-01", effective_to: "2026-06-30" },
        },
        versioning: {
          tariff_version_id: "v2025.1",
          version_number: "2025.1",
          effective_from_date: "2025-07-01",
          effective_to_date: "2026-06-30",
          import_timestamp: "2025-06-01T00:00:00Z",
          approval_status: "approved",
          calculation_rule_version: "v1",
          is_locked: true,
        },
        components: [
          {
            component_code: "STELL_BASIC",
            component_name: "Basic Daily Service Charge",
            component_type: "FIXED_DAILY_CHARGE",
            unit_of_measure: "R/day",
            rate_value: new Decimal("45.00"),
            rule_id: "RULE_BASIC",
            formula_template: "days * rate",
          },
          {
            component_code: "STELL_ENERGY_FLAT",
            component_name: "Flat Active Energy",
            component_type: "ACTIVE_ENERGY",
            unit_of_measure: "c/kWh",
            rate_value: new Decimal("285.50"), // 285.50 c/kWh
            rule_id: "RULE_ENERGY",
            formula_template: "(kwh * rate) / 100",
          },
        ],
      });

      const calcResult = CanonicalTariffEngine.calculateCharges(
        {
          billing_start: "2025-08-01",
          billing_end: "2025-08-31", // 31 days
          notified_maximum_demand_kva: new Decimal(0),
          utilised_capacity_kva: new Decimal(0),
          maximum_demand_kva: new Decimal(0),
          active_energy_kwh: new Decimal("10000"), // 10,000 kWh
          peak_kwh: new Decimal(0),
          standard_kwh: new Decimal(0),
          off_peak_kwh: new Decimal(0),
          reactive_energy_kvarh: new Decimal(0),
          power_factor: new Decimal("1.0"),
        },
        simpleMunicipalTariff,
      );

      // Basic: 31 days * R45 = R 1395.00
      // Energy: 10,000 kWh * 285.50 c/kWh / 100 = R 28,550.00
      // Subtotal: 1395 + 28550 = R 29,945.00
      // VAT (15%): R 4,491.75
      // Total: R 34,436.75
      expect(calcResult.items).toHaveLength(2);
      expect(calcResult.subtotal_ex_vat.toString()).toBe("29945");
      expect(calcResult.vat_amount.toString()).toBe("4491.75");
      expect(calcResult.total_inc_vat.toString()).toBe("34436.75");
    });

    it("supports discounts/credits, minimum charges, and zero-rated VAT treatments", () => {
      const zeroVatSolarTariff = CanonicalTariffEngine.buildCanonicalTariff({
        identity: {
          utility: "Eskom",
          tariff_id: "EXPORT_FEEDIN_ZERO",
          tariff_name: "Solar Reseller Tariff",
          tariff_code: "SOLAR_FEEDIN",
          tariff_category: "Commercial",
          municipality_or_territory: "National",
          customer_class: "commercial",
          voltage_level: "medium",
          supply_type: "three_phase",
          metering_type: "amr_interval",
          currency: "ZAR",
          status: "active",
        },
        applicability: {
          applicable_customer_classes: ["commercial"],
          region_or_municipality: ["National"],
          voltage_levels: ["medium"],
          applicable_dates: { effective_from: "2025-04-01", effective_to: "2026-03-31" },
        },
        versioning: {
          tariff_version_id: "v2025.1",
          version_number: "2025.1",
          effective_from_date: "2025-04-01",
          effective_to_date: "2026-03-31",
          import_timestamp: "2025-03-15T00:00:00Z",
          approval_status: "approved",
          calculation_rule_version: "v1",
          is_locked: true,
        },
        components: [
          {
            component_code: "SERV",
            component_name: "Monthly Service Fee",
            component_type: "FIXED_MONTHLY_CHARGE",
            unit_of_measure: "R/month",
            rate_value: new Decimal("500.00"),
            rule_id: "R_SERV",
            formula_template: "rate",
          },
          {
            component_code: "SOLAR_CREDIT",
            component_name: "Export Generation Solar Credit",
            component_type: "DISCOUNT_OR_CREDIT",
            unit_of_measure: "fixed_zar",
            rate_value: new Decimal("200.00"), // R200 discount credit
            rule_id: "R_CREDIT",
            formula_template: "-credit",
          },
          {
            component_code: "MIN_FLOOR",
            component_name: "Minimum Monthly Charge",
            component_type: "MINIMUM_CHARGE",
            unit_of_measure: "fixed_zar",
            rate_value: new Decimal("400.00"), // Floor of R400
            rule_id: "R_FLOOR",
            formula_template: "floor",
          },
        ],
      });

      // Zero-rate VAT
      zeroVatSolarTariff.header.vat_treatment = "zero_rated";

      const calc = CanonicalTariffEngine.calculateCharges(
        {
          billing_start: "2025-05-01",
          billing_end: "2025-05-31",
          notified_maximum_demand_kva: new Decimal(0),
          utilised_capacity_kva: new Decimal(0),
          maximum_demand_kva: new Decimal(0),
          active_energy_kwh: new Decimal(0),
          peak_kwh: new Decimal(0),
          standard_kwh: new Decimal(0),
          off_peak_kwh: new Decimal(0),
          reactive_energy_kvarh: new Decimal(0),
          power_factor: new Decimal("1.0"),
        },
        zeroVatSolarTariff,
      );

      // Service R500 - Solar Credit R200 = R300
      // Floor is R400, so minimum charge adjustment adds R100
      // Subtotal = R400
      // VAT at 0% = R0
      // Total = R400
      expect(calc.subtotal_ex_vat.toString()).toBe("400");
      expect(calc.vat_amount.toString()).toBe("0");
      expect(calc.total_inc_vat.toString()).toBe("400");
    });
  });

  describe("Requirement 6: Historical Tariff Versioning", () => {
    // Tariff A - Version 1: 01 July 2025 to 30 June 2026
    const tariffAV1: CanonicalTariffModel = CanonicalTariffEngine.buildCanonicalTariff({
      identity: {
        utility: "City of Cape Town",
        tariff_id: "CPT_COMM_v1",
        tariff_name: "Commercial TOU Small",
        tariff_code: "CPT_COMM",
        tariff_category: "Commercial",
        municipality_or_territory: "City of Cape Town",
        customer_class: "commercial",
        voltage_level: "low",
        supply_type: "three_phase",
        metering_type: "tou_smart",
        currency: "ZAR",
        status: "superseded",
      },
      applicability: {
        applicable_customer_classes: ["commercial"],
        region_or_municipality: ["City of Cape Town"],
        voltage_levels: ["low"],
        applicable_dates: { effective_from: "2025-07-01", effective_to: "2026-06-30" },
      },
      versioning: {
        tariff_version_id: "CPT_COMM_v1",
        version_number: "2025.1",
        effective_from_date: "2025-07-01",
        effective_to_date: "2026-06-30",
        source_document_id: "CPT_GAZETTE_2025",
        import_timestamp: "2025-06-10T00:00:00Z",
        approval_status: "approved",
        approved_by: "auditor@enera.internal",
        approval_timestamp: "2025-06-11T00:00:00Z",
        calculation_rule_version: "v1.0",
        is_locked: true,
        lock_reason: "Historical gazetted baseline",
      },
      components: [
        {
          component_code: "CPT_BASIC",
          component_name: "Service Charge",
          component_type: "FIXED_DAILY_CHARGE",
          unit_of_measure: "R/day",
          rate_value: new Decimal("20.00"), // R20.00/day in v1
          rule_id: "RULE_CPT_V1",
          formula_template: "days * rate",
        },
      ],
    });

    // Tariff A - Version 2: 01 July 2026 onwards
    const tariffAV2: CanonicalTariffModel = CanonicalTariffEngine.buildCanonicalTariff({
      identity: {
        utility: "City of Cape Town",
        tariff_id: "CPT_COMM_v2",
        tariff_name: "Commercial TOU Small",
        tariff_code: "CPT_COMM",
        tariff_category: "Commercial",
        municipality_or_territory: "City of Cape Town",
        customer_class: "commercial",
        voltage_level: "low",
        supply_type: "three_phase",
        metering_type: "tou_smart",
        currency: "ZAR",
        status: "active",
      },
      applicability: {
        applicable_customer_classes: ["commercial"],
        region_or_municipality: ["City of Cape Town"],
        voltage_levels: ["low"],
        applicable_dates: { effective_from: "2026-07-01", effective_to: "2027-06-30" },
      },
      versioning: {
        tariff_version_id: "CPT_COMM_v2",
        version_number: "2026.1",
        effective_from_date: "2026-07-01",
        effective_to_date: "2027-06-30",
        source_document_id: "CPT_GAZETTE_2026",
        import_timestamp: "2026-06-10T00:00:00Z",
        approval_status: "approved",
        approved_by: "auditor@enera.internal",
        approval_timestamp: "2026-06-11T00:00:00Z",
        calculation_rule_version: "v1.1",
        is_locked: true,
        lock_reason: "2026/2027 approved municipal rates",
      },
      components: [
        {
          component_code: "CPT_BASIC",
          component_name: "Service Charge",
          component_type: "FIXED_DAILY_CHARGE",
          unit_of_measure: "R/day",
          rate_value: new Decimal("25.00"), // R25.00/day in v2 (increased rate)
          rule_id: "RULE_CPT_V2",
          formula_template: "days * rate",
        },
      ],
    });

    it("selects Version 1 for an invoice in May 2026 and Version 2 for September 2026", () => {
      TariffVersionSelector.registerVersion(tariffAV1);
      TariffVersionSelector.registerVersion(tariffAV2);

      // Invoice for May 2026
      const mayVersion = TariffVersionSelector.selectVersionForDate("CPT_COMM", "2026-05-15");
      expect(mayVersion).not.toBeNull();
      expect(mayVersion!.header.version).toBe("2025.1");
      expect(mayVersion!.components[0].rate_value.toString()).toBe("20");

      // Invoice for September 2026
      const septVersion = TariffVersionSelector.selectVersionForDate("CPT_COMM", "2026-09-15");
      expect(septVersion).not.toBeNull();
      expect(septVersion!.header.version).toBe("2026.1");
      expect(septVersion!.components[0].rate_value.toString()).toBe("25");
    });

    it("prevents conflicting or overlapping approved tariff versions from being selected silently", () => {
      // Create a conflicting version overlapping with Tariff A v1
      const conflictingV1: CanonicalTariffModel = CanonicalTariffEngine.buildCanonicalTariff({
        identity: {
          ...tariffAV1.identity!,
          tariff_id: "CPT_COMM_CONFLICT",
        },
        applicability: { ...tariffAV1.applicability! },
        versioning: {
          ...tariffAV1.versioning!,
          tariff_version_id: "CPT_COMM_CONFLICT_v1",
          version_number: "2025.2_CONFLICT",
          effective_from_date: "2025-07-01",
          effective_to_date: "2026-06-30", // Identical date window!
        },
        components: [
          {
            component_code: "CPT_BASIC",
            component_name: "Service Charge",
            component_type: "FIXED_DAILY_CHARGE",
            unit_of_measure: "R/day",
            rate_value: new Decimal("22.00"),
            rule_id: "R_CONFLICT",
            formula_template: "days * rate",
          },
        ],
      });

      TariffVersionSelector.registerVersion(tariffAV1);
      TariffVersionSelector.registerVersion(conflictingV1);

      // Attempting to select a version for a date covered by both approved conflicting schedules
      expect(() => {
        TariffVersionSelector.selectVersionForDate("CPT_COMM", "2026-01-15");
      }).toThrowError(ConflictingTariffVersionError);
    });

    it("splits cross-boundary billing periods crossing a tariff revision date (June 15 to July 15)", () => {
      TariffVersionSelector.registerVersion(tariffAV1);
      TariffVersionSelector.registerVersion(tariffAV2);

      // Cross boundary: 2026-06-15 to 2026-07-15 crosses 2026-07-01
      const split = TariffVersionSelector.splitBillingPeriod(
        "CPT_COMM",
        "2026-06-15",
        "2026-07-15",
      );

      expect(split).toHaveLength(2);

      // Portion 1: June 15 to June 30 under v2025.1 (16 days)
      expect(split[0].sub_period_start).toBe("2026-06-15");
      expect(split[0].sub_period_end).toBe("2026-06-30");
      expect(split[0].days_count).toBe(16);
      expect(split[0].tariff_version.header.version).toBe("2025.1");

      // Portion 2: July 1 to July 15 under v2026.1 (15 days)
      expect(split[1].sub_period_start).toBe("2026-07-01");
      expect(split[1].sub_period_end).toBe("2026-07-15");
      expect(split[1].days_count).toBe(15);
      expect(split[1].tariff_version.header.version).toBe("2026.1");
    });

    it("evaluates cross-boundary period and flags for review if interval readings are unavailable", () => {
      TariffVersionSelector.registerVersion(tariffAV1);
      TariffVersionSelector.registerVersion(tariffAV2);

      // With interval readings available: clean split, no review needed
      const evaluationWithData = CanonicalTariffEngine.evaluateBillingPeriod(
        "CPT_COMM",
        "2026-06-15",
        "2026-07-15",
        true, // interval readings available
      );
      expect(evaluationWithData.crosses_tariff_boundary).toBe(true);
      expect(evaluationWithData.requires_period_split).toBe(true);
      expect(evaluationWithData.review_required).toBe(false);
      expect(evaluationWithData.versions_involved).toEqual(["2025.1", "2026.1"]);

      // Without interval readings: review required!
      const evaluationWithoutData = CanonicalTariffEngine.evaluateBillingPeriod(
        "CPT_COMM",
        "2026-06-15",
        "2026-07-15",
        false, // interval readings missing
      );
      expect(evaluationWithoutData.crosses_tariff_boundary).toBe(true);
      expect(evaluationWithoutData.review_required).toBe(true);
      expect(evaluationWithoutData.review_reason).toContain(
        "interval readings are unavailable to calculate each portion separately",
      );
    });

    it("guarantees historical invoices are never recalculated with today's rates unless explicitly instructed", () => {
      TariffVersionSelector.registerVersion(tariffAV1); // v2025.1 (R20/day)
      TariffVersionSelector.registerVersion(tariffAV2); // v2026.1 (R25/day)

      const historicalInput = {
        billing_start: "2025-11-01",
        billing_end: "2025-11-30", // 30 days
        notified_maximum_demand_kva: new Decimal(0),
        utilised_capacity_kva: new Decimal(0),
        maximum_demand_kva: new Decimal(0),
        active_energy_kwh: new Decimal(0),
        peak_kwh: new Decimal(0),
        standard_kwh: new Decimal(0),
        off_peak_kwh: new Decimal(0),
        reactive_energy_kvarh: new Decimal(0),
        power_factor: new Decimal("1.0"),
      };

      // Resolve version for historical invoice
      const applicableTariff = TariffVersionSelector.selectVersionForDate(
        "CPT_COMM",
        historicalInput.billing_start,
      );
      expect(applicableTariff!.header.version).toBe("2025.1");

      const result = CanonicalTariffEngine.calculateCharges(historicalInput, applicableTariff!);

      // Evaluated under v2025.1 rates: 30 days * R20 = R 600.00 ex-VAT
      // NOT under today's v2026.1 rate of R25 (which would have yielded R750.00)
      expect(result.subtotal_ex_vat.toString()).toBe("600");
      expect(result.tariff_version).toBe("2025.1");
    });
  });
});
