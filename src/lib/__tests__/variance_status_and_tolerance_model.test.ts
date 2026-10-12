/**
 * RECONCILIATION ENGINE: VARIANCE STATUS & TOLERANCE MODEL TEST SUITE
 * ====================================================================
 * Verifies Requirements 22 & 23:
 *
 * 22. VARIANCE STATUS:
 *     - Transparent statuses: MATCH, WITHIN_TOLERANCE, OUTSIDE_TOLERANCE, INSUFFICIENT_DATA, UNRESOLVED
 *     - Do not use arbitrary visual statuses without defined business meaning
 *
 * 23. TOLERANCE MODEL:
 *     - Configurable across dimensions:
 *       energy_quantity, demand, reactive_energy, financial_amount, financial_percentage
 *     - Centrally stored configuration (no scattered numbers in code)
 *     - Record the tolerance used for every reconciliation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js-light";

import {
  VarianceStatus,
  VARIANCE_STATUS_REGISTRY,
  getVarianceStatusDefinition,
  resolveVarianceStatus,
} from "../../domain/reconciliation/varianceStatus";

import {
  CentralToleranceRegistry,
  DEFAULT_TOLERANCE_MODEL_CONFIG,
  STRICT_AUDIT_TOLERANCE_CONFIG,
  RELAXED_ESTIMATE_TOLERANCE_CONFIG,
  ToleranceDimension,
  type RecordedTolerance,
  type ToleranceModelConfig,
} from "../../domain/reconciliation/toleranceModel";

import {
  EnergyReconciliationEngine,
  DemandReconciliationEngine,
  ReactiveEnergyReconciliationEngine,
  InvoiceChargeReconciliationEngine,
  ExpectedVsBilledModel,
  VarianceEngine,
  type ApplicableRateSchedule,
} from "../../domain/reconciliation";

describe("Requirement 22: Variance Status Governance", () => {
  it("defines all 5 authoritative variance statuses with strict business meaning", () => {
    const requiredStatuses: VarianceStatus[] = [
      "MATCH",
      "WITHIN_TOLERANCE",
      "OUTSIDE_TOLERANCE",
      "INSUFFICIENT_DATA",
      "UNRESOLVED",
    ];

    for (const status of requiredStatuses) {
      assert.ok(VARIANCE_STATUS_REGISTRY[status], `Registry must define status: ${status}`);
      const def = getVarianceStatusDefinition(status);
      assert.equal(def.status, status);
      assert.ok(def.label.length > 0, `${status} must have non-empty human label`);
      assert.ok(def.business_meaning.length > 0, `${status} must have defined business meaning`);
      assert.ok(typeof def.requires_action === "boolean");
      assert.ok(typeof def.is_discrepancy === "boolean");
      assert.ok(["INFO", "LOW", "HIGH", "CRITICAL"].includes(def.audit_severity));
    }
  });

  it("resolves EXACT MATCH when variance is zero and data is sufficient", () => {
    const status = resolveVarianceStatus({
      hasSufficientData: true,
      isExactMatch: true,
      isWithinTolerance: true,
    });
    assert.equal(status, "MATCH");
  });

  it("resolves WITHIN_TOLERANCE when non-zero variance is within threshold", () => {
    const status = resolveVarianceStatus({
      hasSufficientData: true,
      isExactMatch: false,
      isWithinTolerance: true,
    });
    assert.equal(status, "WITHIN_TOLERANCE");
  });

  it("resolves OUTSIDE_TOLERANCE when variance breaches threshold", () => {
    const status = resolveVarianceStatus({
      hasSufficientData: true,
      isExactMatch: false,
      isWithinTolerance: false,
    });
    assert.equal(status, "OUTSIDE_TOLERANCE");
  });

  it("resolves INSUFFICIENT_DATA when meter or invoice telemetry is missing", () => {
    const status = resolveVarianceStatus({
      hasSufficientData: false,
      isExactMatch: false,
      isWithinTolerance: false,
    });
    assert.equal(status, "INSUFFICIENT_DATA");
  });

  it("resolves UNRESOLVED when investigation reason or unresolved flag is present", () => {
    const status = resolveVarianceStatus({
      hasSufficientData: true,
      isExactMatch: false,
      isWithinTolerance: true,
      isUnresolved: true,
      unresolvedReason: "Meter register rollover suspected",
    });
    assert.equal(status, "UNRESOLVED");
  });
});

describe("Requirement 23: Centralized Tolerance Model & Multi-Dimensional Configuration", () => {
  it("provides centrally stored default, strict audit, and relaxed estimate configurations", () => {
    const defaultConfig = CentralToleranceRegistry.getProfile("DEFAULT");
    assert.equal(defaultConfig.config_id, "ENERA_CENTRAL_TOLERANCE_DEFAULT");
    assert.equal(defaultConfig.dimensions.energy_quantity.absolute_kwh.toFixed(2), "100.00");
    assert.equal(defaultConfig.dimensions.energy_quantity.percentage.toFixed(2), "0.50");
    assert.equal(defaultConfig.dimensions.financial_amount.absolute_zar.toFixed(2), "50.00");

    const strictConfig = CentralToleranceRegistry.getProfile("STRICT_AUDIT");
    assert.equal(strictConfig.config_id, "ENERA_STRICT_AUDIT_PROFILE");
    assert.equal(strictConfig.dimensions.energy_quantity.absolute_kwh.toFixed(2), "10.00");
    assert.equal(strictConfig.dimensions.financial_amount.absolute_zar.toFixed(2), "5.00");

    const relaxedConfig = CentralToleranceRegistry.getProfile("RELAXED_ESTIMATE");
    assert.equal(relaxedConfig.config_id, "ENERA_RELAXED_ESTIMATE_PROFILE");
    assert.equal(relaxedConfig.dimensions.energy_quantity.absolute_kwh.toFixed(2), "500.00");
    assert.equal(relaxedConfig.dimensions.financial_amount.absolute_zar.toFixed(2), "250.00");
  });

  it("supports configurable tolerance across all 5 dimensions", () => {
    const dimensions: ToleranceDimension[] = [
      "energy_quantity",
      "demand",
      "reactive_energy",
      "financial_amount",
      "financial_percentage",
    ];

    for (const dim of dimensions) {
      const recorded = CentralToleranceRegistry.recordTolerance(dim);
      assert.equal(recorded.dimension, dim);
      assert.ok(recorded.config_id.length > 0);
      assert.ok(recorded.version.length > 0);
      assert.ok(recorded.applied_rule.length > 0);
      assert.ok(recorded.recorded_at.length > 0);
    }
  });

  it("evaluates energy_quantity dimension and stamps RecordedTolerance", () => {
    // 100,000 billed vs 99,950 expected = 50 kWh difference (default tol is 100 kWh / 0.5%)
    const evalResult = CentralToleranceRegistry.evaluateDimension(
      "energy_quantity",
      100000,
      99950
    );

    assert.equal(evalResult.status, "WITHIN_TOLERANCE");
    assert.equal(evalResult.is_within_tolerance, true);
    assert.equal(evalResult.recorded_tolerance.dimension, "energy_quantity");
    assert.equal(evalResult.recorded_tolerance.unit_of_measure, "kWh");
    assert.ok(evalResult.recorded_tolerance.absolute_threshold !== null);
    assert.ok(evalResult.recorded_tolerance.percentage_threshold !== null);
  });

  it("evaluates financial_amount dimension and detects breach", () => {
    // Billed R 12,000 vs Expected R 11,800 = R 200 variance (default tol is R 50.00)
    const evalResult = CentralToleranceRegistry.evaluateDimension(
      "financial_amount",
      12000,
      11800
    );

    assert.equal(evalResult.status, "OUTSIDE_TOLERANCE");
    assert.equal(evalResult.is_within_tolerance, false);
    assert.equal(evalResult.recorded_tolerance.dimension, "financial_amount");
    assert.equal(evalResult.recorded_tolerance.unit_of_measure, "ZAR");
    assert.equal(evalResult.recorded_tolerance.absolute_threshold?.toFixed(2), "50.00");
  });

  it("allows registering and activating custom contract tolerance profiles", () => {
    const customProfile: ToleranceModelConfig = {
      config_id: "MINE_SITE_ALPHA_CONTRACT_2026",
      version: "1.0",
      name: "Mine Site Alpha Special Contract",
      description: "Custom contract tolerances per bilateral PPA",
      source: "CONTRACT_OVERRIDE",
      dimensions: {
        energy_quantity: {
          absolute_kwh: new Decimal("25.00"),
          percentage: new Decimal("0.20"),
        },
        demand: {
          absolute_kva: new Decimal("2.00"),
          absolute_kw: new Decimal("2.00"),
          percentage: new Decimal("0.20"),
        },
        reactive_energy: {
          absolute_kvarh: new Decimal("20.00"),
          power_factor_absolute: new Decimal("0.01"),
          percentage: new Decimal("0.50"),
        },
        financial_amount: {
          absolute_zar: new Decimal("15.00"),
        },
        financial_percentage: {
          percentage: new Decimal("0.20"),
        },
      },
    };

    CentralToleranceRegistry.registerProfile(customProfile);
    CentralToleranceRegistry.setActiveProfile("MINE_SITE_ALPHA_CONTRACT_2026");

    const rec = CentralToleranceRegistry.recordTolerance("energy_quantity");
    assert.equal(rec.config_id, "MINE_SITE_ALPHA_CONTRACT_2026");
    assert.equal(rec.absolute_threshold?.toFixed(2), "25.00");
    assert.equal(rec.percentage_threshold?.toFixed(2), "0.20");

    // Reset back to default
    CentralToleranceRegistry.resetToDefaults();
    assert.equal(CentralToleranceRegistry.getProfile().config_id, "ENERA_CENTRAL_TOLERANCE_DEFAULT");
  });
});

describe("Reconciliation Engines Record Tolerance Snapshots on Every Reconciliation", () => {
  it("records tolerance snapshot on EnergyReconciliationEngine components and summary", () => {
    const res = EnergyReconciliationEngine.reconcileEnergy({
      invoice_peak_kwh: 10500,
      amr_peak_kwh: 10480, // 20 kWh diff (within 100 kWh tol)
      invoice_standard_kwh: 20000,
      amr_standard_kwh: 20000, // exact match
      invoice_off_peak_kwh: 15000,
      amr_off_peak_kwh: 15000, // exact match
      invoice_total_kwh: 45500,
      amr_total_kwh: 45480,
    });

    assert.equal(res.peak_comparison.variance_status, "WITHIN_TOLERANCE");
    assert.ok(res.peak_comparison.recorded_tolerance, "Peak component must record tolerance");
    assert.equal(res.peak_comparison.recorded_tolerance.dimension, "energy_quantity");

    assert.equal(res.standard_comparison.variance_status, "MATCH");
    assert.ok(res.standard_comparison.recorded_tolerance, "Standard component must record tolerance");

    assert.equal(res.overall_variance_status, "WITHIN_TOLERANCE");
    assert.ok(res.recorded_tolerances.length >= 4, "Summary must record all component tolerances");
  });

  it("records tolerance snapshot on DemandReconciliationEngine results", () => {
    const res = DemandReconciliationEngine.reconcileDemand({
      invoice_demand_value: "150.00",
      amr_tou_peak_kva: "148.50", // 1.5 kVA variance (within 5 kVA default)
      amr_tou_standard_kva: "140.00",
      demand_methodology: DemandMethodologyConfigBuilder(),
    });

    assert.equal(res.variance_status, "WITHIN_TOLERANCE");
    assert.ok(res.recorded_tolerance, "Demand reconciliation must record tolerance snapshot");
    assert.equal(res.recorded_tolerance.dimension, "demand");
    assert.equal(res.recorded_tolerance.unit_of_measure, "kVA");
  });

  it("records tolerance snapshot on ReactiveEnergyReconciliationEngine results", () => {
    const res = ReactiveEnergyReconciliationEngine.reconcileReactiveEnergy({
      invoice_kvarh: 1200,
      amr_kvarh: 1200, // exact match
      invoice_power_factor: "0.94",
      amr_power_factor: "0.93", // 0.01 PF diff (within 0.02 tol)
    });

    assert.equal(res.kvarh_comparison.variance_status, "MATCH");
    assert.ok(res.kvarh_comparison.recorded_tolerance, "kVArh must record tolerance");
    assert.equal(res.power_factor_comparison.variance_status, "WITHIN_TOLERANCE");
    assert.ok(res.power_factor_comparison.recorded_tolerance, "PF must record tolerance");
    assert.equal(res.overall_variance_status, "WITHIN_TOLERANCE");
    assert.equal(res.recorded_tolerances.length, 2);
  });

  it("records tolerance snapshot on InvoiceChargeReconciliationEngine results", () => {
    const sampleRates: ApplicableRateSchedule = {
      tariff_code: "MEGAFLEX",
      tariff_version: "2026.1",
      utility: "ESKOM",
      rates: [
        {
          component_code: "ACTIVE_ENERGY_PEAK",
          component_name: "Peak Active Energy Charge",
          rate_value: new Decimal("250.00"), // 250 c/kWh = R 2.50/kWh
          unit_of_measure: "c/kWh",
          rule_id: "MEGAFLEX_PEAK_RATE_2026",
          tariff_code: "MEGAFLEX",
          tariff_version: "2026.1",
        },
      ],
      created_at: new Date().toISOString(),
    };

    const res = InvoiceChargeReconciliationEngine.reconcileCharges({
      determinants: [
        {
          component_code: "ACTIVE_ENERGY_PEAK",
          billed_quantity: 1000,
          billed_amount_zar: 2500, // 1000 * 2.50 = 2500 -> exact match
        },
      ],
      applicable_rates: sampleRates,
    });

    assert.equal(res.items[0].variance_status, "MATCH");
    assert.ok(res.items[0].recorded_tolerance, "Item must record tolerance snapshot");
    assert.equal(res.items[0].recorded_tolerance.dimension, "financial_amount");
    assert.equal(res.overall_variance_status, "MATCH");
    assert.equal(res.recorded_tolerances.length, 1);
  });

  it("records tolerance snapshot on ExpectedVsBilledModel rows", () => {
    const row = ExpectedVsBilledModel.buildRow({
      component_code: "DEMAND_NETWORK",
      description: "Network Demand Charge",
      billed_quantity: 100,
      expected_quantity: 100,
      billed_rate: "50.00",
      expected_rate: "50.00",
      billed_amount: "5000.00",
      expected_amount: "5000.00",
      unit_of_measure: "kVA",
      billed_evidence: {
        invoice_document_id: "INV-2026-001",
        invoice_line_ref: "LINE-04",
      },
      expected_evidence: {
        quantity_source: "AMR_DEMAND_PEAK",
        rate_rule_id: "RULE_NETWORK_DEMAND_2026",
      },
    });

    assert.equal(row.status, "MATCH");
    assert.equal(row.variance_status, "MATCH");
    assert.ok(row.recorded_tolerance, "Row must record tolerance snapshot");
    assert.equal(row.recorded_tolerance.dimension, "financial_amount");
    assert.ok(row.evidence.recorded_tolerance, "Evidence bundle must contain recorded tolerance");
  });
});

function DemandMethodologyConfigBuilder() {
  return {
    rule_id: "TEST_MEGAFLEX_DEMAND",
    methodology_name: "Test Megaflex Rule",
    measurement_unit: "kVA" as const,
    tou_window_scope: "PEAK_AND_STANDARD_ONLY" as const,
    description: "Test rule description",
  };
}
