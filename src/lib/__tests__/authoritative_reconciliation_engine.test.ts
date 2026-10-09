import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import {
  DeterministicReconciliationEngine,
  DEFAULT_TOLERANCE_CONFIG,
} from "@/domain/reconciliation/reconciliationEngine";
import {
  MEGAFLEX_JULY_2025_FIXTURE,
  MINIFLEX_OCT_2025_FIXTURE,
} from "@/domain/reconciliation/regressionFixtures";

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

    const payload = DeterministicReconciliationEngine.reconcile(
      inputWithDiscrepancy,
      DEFAULT_TOLERANCE_CONFIG,
    );

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

  it("should execute full 15-stage reconciliation lifecycle with strict 5-level source hierarchy", async () => {
    const { ReconciliationLifecycleManager, RECONCILIATION_LIFECYCLE_STAGES } = await import(
      "@/domain/reconciliation/reconciliationLifecycleManager"
    );

    const mockValidatedInvoicePackage = {
      documentMetadata: {
        documentId: "DOC-MILLENNIUM-001",
        filename: "Millennium_33kV_Eskom_Apr_2026.pdf",
        checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        organisationId: "ORG-TEST-001",
      },
      approvedValues: {
        validationRunId: "VAL-RUN-MILLENNIUM-01",
        accountNumber: "7856504676",
        invoiceNumber: "785101497007",
        customerName: "Millennium 33kV",
        billingPeriodStart: "2026-04-01",
        billingPeriodEnd: "2026-04-30",
        tariffName: "Megaflex High Voltage 33 kV",
        meterNumber: "MTR-982341",
        totalKwh: 745500,
        peakKwh: 120500,
        standardKwh: 245000,
        offPeakKwh: 380000,
        maximumDemandKva: 4850,
        reactiveEnergyKvarh: 85200,
        subtotal: 1294750,
        vatAmount: 194212.5,
        invoiceTotal: 1488962.5,
      },
    };

    const mockAmrData = {
      telemetryBatchId: "BATCH-AMR-APR2026",
      meterSerialNumber: "MTR-982341",
      siteId: "SITE-MILLENNIUM",
      ctRatio: 1,
      vtRatio: 1,
      multiplier: 1,
      intervalCount: 1440,
      measuredPeakKwh: 120500,
      measuredStandardKwh: 245000,
      measuredOffPeakKwh: 380000,
      measuredDemandKva: 4850,
      measuredReactiveKvarh: 85200,
    };

    const result = await ReconciliationLifecycleManager.executeLifecycle({
      validatedInvoicePackage: mockValidatedInvoicePackage,
      amrData: mockAmrData,
    });

    expect(result.lifecycleLog.length).toBe(15);
    expect(result.lifecycleLog.map((l) => l.stage)).toEqual([...RECONCILIATION_LIFECYCLE_STAGES]);

    // Source Data Hierarchy Verification (Requirement 5)
    expect(result.sourceHierarchy.source1_originalDocument.isImmutable).toBe(true);
    expect(result.sourceHierarchy.source1_originalDocument.documentId).toBe("DOC-MILLENNIUM-001");

    expect(result.sourceHierarchy.source2_validatedInvoiceData.isImmutable).toBe(true);
    expect(result.sourceHierarchy.source2_validatedInvoiceData.accountNumber).toBe("7856504676");

    expect(result.sourceHierarchy.source3_meterAmrData.isImmutable).toBe(true);
    expect(result.sourceHierarchy.source3_meterAmrData.meterSerialNumber).toBe("MTR-982341");

    expect(result.sourceHierarchy.source4_tariffConfiguration.isImmutable).toBe(true);
    expect(result.sourceHierarchy.source4_tariffConfiguration.tariffCode).toBe("MEGAFLEX_33KV");

    expect(result.sourceHierarchy.source5_eneraCalculations.calculationVersion).toBe(
      ReconciliationLifecycleManager.CALCULATION_VERSION,
    );

    // Assert that source values are not mutated by calculation
    expect(result.sourceHierarchy.source2_validatedInvoiceData.billedTotalAmountZar.toNumber()).toBe(1488962.5);
    expect(result.reproducibilityChecksum).toBeDefined();
  });
});
