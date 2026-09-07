import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { DeterministicReconciliationEngine, DEFAULT_TOLERANCE_CONFIG } from "@/domain/reconciliation/reconciliationEngine";
import { MEGAFLEX_JULY_2025_FIXTURE, MINIFLEX_OCT_2025_FIXTURE } from "@/domain/reconciliation/regressionFixtures";

describe("Authoritative Deterministic Reconciliation Engine", () => {
  it("should reconcile all 14 billing determinants deterministically for Megaflex July 2025 fixture", () => {
    const fixture = MEGAFLEX_JULY_2025_FIXTURE;
    const inv = fixture.invoice_inputs;

    const input = {
      tenant_id: "TENANT_ZA_001",
      invoice_id: inv.invoice_number,
      invoice_number: inv.invoice_number,
      account_number: inv.account_number,
      telemetry_batch_id: "BATCH_2025_07",
      billing_start: fixture.billing_start,
      billing_end: fixture.billing_end,
      tariff_version: fixture.tariff_version,
      calendar_version_id: "2025.1",

      billed_peak_kwh: inv.peak_kwh,
      billed_standard_kwh: inv.standard_kwh,
      billed_off_peak_kwh: inv.off_peak_kwh,
      billed_total_kwh: inv.total_kwh,
      billed_maximum_demand_kva: inv.maximum_demand_kva,
      billed_ratcheted_demand_kva: inv.ratcheted_demand_kva,
      billed_reactive_energy_kvarh: inv.reactive_energy_kvarh,
      billed_energy_charges_zar: inv.energy_charges_zar,
      billed_demand_charges_zar: inv.demand_charges_zar,
      billed_network_charges_zar: inv.network_charges_zar,
      billed_service_charges_zar: inv.service_charges_zar,
      billed_ancillary_charges_zar: inv.ancillary_charges_zar,
      billed_vat_zar: inv.vat_zar,
      billed_total_invoice_zar: inv.total_invoice_zar,
    };

    const payload = DeterministicReconciliationEngine.reconcile(input, DEFAULT_TOLERANCE_CONFIG);

    expect(payload.determinant_comparisons.length).toBe(14);
    expect(payload.classification).toBe("PASS");
    expect(payload.status).toBe("COMPLETED");
    expect(payload.result_checksum).toContain("SHA256:");
    expect(payload.variance_total_zar.toNumber()).toBe(0);
  });

  it("should enforce idempotency — running twice with identical inputs yields identical result checksum", () => {
    const fixture = MEGAFLEX_JULY_2025_FIXTURE;
    const inv = fixture.invoice_inputs;

    const input = {
      tenant_id: "TENANT_ZA_001",
      invoice_id: inv.invoice_number,
      invoice_number: inv.invoice_number,
      account_number: inv.account_number,
      telemetry_batch_id: "BATCH_2025_07",
      billing_start: fixture.billing_start,
      billing_end: fixture.billing_end,
      tariff_version: fixture.tariff_version,
      calendar_version_id: "2025.1",

      billed_peak_kwh: inv.peak_kwh,
      billed_standard_kwh: inv.standard_kwh,
      billed_off_peak_kwh: inv.off_peak_kwh,
      billed_total_kwh: inv.total_kwh,
      billed_maximum_demand_kva: inv.maximum_demand_kva,
      billed_ratcheted_demand_kva: inv.ratcheted_demand_kva,
      billed_reactive_energy_kvarh: inv.reactive_energy_kvarh,
      billed_energy_charges_zar: inv.energy_charges_zar,
      billed_demand_charges_zar: inv.demand_charges_zar,
      billed_network_charges_zar: inv.network_charges_zar,
      billed_service_charges_zar: inv.service_charges_zar,
      billed_ancillary_charges_zar: inv.ancillary_charges_zar,
      billed_vat_zar: inv.vat_zar,
      billed_total_invoice_zar: inv.total_invoice_zar,
    };

    const run1 = DeterministicReconciliationEngine.reconcile(input, DEFAULT_TOLERANCE_CONFIG);
    const run2 = DeterministicReconciliationEngine.reconcile(input, DEFAULT_TOLERANCE_CONFIG);

    expect(run1.result_checksum).toBe(run2.result_checksum);
    expect(run1.billed_total_zar.toString()).toBe(run2.billed_total_zar.toString());
    expect(run1.calculated_total_zar.toString()).toBe(run2.calculated_total_zar.toString());
  });

  it("should classify discrepancies and set status to REVIEW_REQUIRED when overbilled", () => {
    const fixture = MEGAFLEX_JULY_2025_FIXTURE;
    const inv = fixture.invoice_inputs;

    const inputWithDiscrepancy = {
      tenant_id: "TENANT_ZA_001",
      invoice_id: inv.invoice_number,
      invoice_number: inv.invoice_number,
      account_number: inv.account_number,
      telemetry_batch_id: "BATCH_2025_07",
      billing_start: fixture.billing_start,
      billing_end: fixture.billing_end,
      tariff_version: fixture.tariff_version,
      calendar_version_id: "2025.1",

      billed_peak_kwh: inv.peak_kwh,
      billed_standard_kwh: inv.standard_kwh,
      billed_off_peak_kwh: inv.off_peak_kwh,
      billed_total_kwh: inv.total_kwh,
      billed_maximum_demand_kva: inv.maximum_demand_kva,
      billed_ratcheted_demand_kva: inv.ratcheted_demand_kva,
      billed_reactive_energy_kvarh: inv.reactive_energy_kvarh,
      // Billed energy charge artificially inflated by R 50,000
      billed_energy_charges_zar: inv.energy_charges_zar.plus(50000),
      billed_demand_charges_zar: inv.demand_charges_zar,
      billed_network_charges_zar: inv.network_charges_zar,
      billed_service_charges_zar: inv.service_charges_zar,
      billed_ancillary_charges_zar: inv.ancillary_charges_zar,
      billed_vat_zar: inv.vat_zar,
      billed_total_invoice_zar: inv.total_invoice_zar.plus(57500),
    };

    const payload = DeterministicReconciliationEngine.reconcile(inputWithDiscrepancy, DEFAULT_TOLERANCE_CONFIG);

    expect(payload.classification).toBe("CRITICAL");
    expect(payload.status).toBe("REVIEW_REQUIRED");
    expect(payload.variance_total_zar.toNumber()).toBeLessThan(0);
  });

  it("should record calculation explanation lineage for every determinant item", () => {
    const fixture = MEGAFLEX_JULY_2025_FIXTURE;
    const inv = fixture.invoice_inputs;

    const input = {
      tenant_id: "TENANT_ZA_001",
      invoice_id: inv.invoice_number,
      invoice_number: inv.invoice_number,
      account_number: inv.account_number,
      telemetry_batch_id: "BATCH_2025_07",
      billing_start: fixture.billing_start,
      billing_end: fixture.billing_end,
      tariff_version: fixture.tariff_version,

      billed_peak_kwh: inv.peak_kwh,
      billed_standard_kwh: inv.standard_kwh,
      billed_off_peak_kwh: inv.off_peak_kwh,
      billed_total_kwh: inv.total_kwh,
      billed_maximum_demand_kva: inv.maximum_demand_kva,
      billed_ratcheted_demand_kva: inv.ratcheted_demand_kva,
      billed_reactive_energy_kvarh: inv.reactive_energy_kvarh,
      billed_energy_charges_zar: inv.energy_charges_zar,
      billed_demand_charges_zar: inv.demand_charges_zar,
      billed_network_charges_zar: inv.network_charges_zar,
      billed_service_charges_zar: inv.service_charges_zar,
      billed_ancillary_charges_zar: inv.ancillary_charges_zar,
      billed_vat_zar: inv.vat_zar,
      billed_total_invoice_zar: inv.total_invoice_zar,
    };

    const payload = DeterministicReconciliationEngine.reconcile(input, DEFAULT_TOLERANCE_CONFIG);

    for (const comp of payload.determinant_comparisons) {
      expect(comp.explanation).toBeDefined();
      expect(comp.explanation.formula_used).toBeDefined();
      expect(comp.explanation.precision).toContain("Decimal.js-light");
      expect(comp.explanation.rounding_method).toBe("Decimal.ROUND_HALF_UP");
    }
  });

  it("should pass Miniflex October 2025 low season regression fixture", () => {
    const fixture = MINIFLEX_OCT_2025_FIXTURE;
    const inv = fixture.invoice_inputs;

    const input = {
      tenant_id: "TENANT_ZA_002",
      invoice_id: inv.invoice_number,
      invoice_number: inv.invoice_number,
      account_number: inv.account_number,
      billing_start: fixture.billing_start,
      billing_end: fixture.billing_end,
      tariff_version: fixture.tariff_version,

      billed_peak_kwh: inv.peak_kwh,
      billed_standard_kwh: inv.standard_kwh,
      billed_off_peak_kwh: inv.off_peak_kwh,
      billed_total_kwh: inv.total_kwh,
      billed_maximum_demand_kva: inv.maximum_demand_kva,
      billed_ratcheted_demand_kva: inv.ratcheted_demand_kva,
      billed_reactive_energy_kvarh: inv.reactive_energy_kvarh,
      billed_energy_charges_zar: inv.energy_charges_zar,
      billed_demand_charges_zar: inv.demand_charges_zar,
      billed_network_charges_zar: inv.network_charges_zar,
      billed_service_charges_zar: inv.service_charges_zar,
      billed_ancillary_charges_zar: inv.ancillary_charges_zar,
      billed_vat_zar: inv.vat_zar,
      billed_total_invoice_zar: inv.total_invoice_zar,
    };

    const payload = DeterministicReconciliationEngine.reconcile(input, DEFAULT_TOLERANCE_CONFIG);
    expect(payload.classification).toBe("PASS");
  });
});
