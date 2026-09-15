import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js-light";
import {
  ProductionDataLifecycleEngine,
  PRODUCTION_LIFECYCLE_STAGES,
  type LifecycleStageId,
} from "../productionDataLifecycle";
import type { TariffVersionDefinition } from "../../tariff/types";

// Mock Supabase client to test persistence calls without live cloud DB
vi.mock("@/integrations/supabase/client", () => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const upsertMock = vi.fn().mockResolvedValue({ error: null });
  const selectMock = vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  });

  return {
    supabase: {
      from: vi.fn((table: string) => ({
        insert: insertMock,
        upsert: upsertMock,
        select: selectMock,
      })),
    },
  };
});

describe("Production Data Lifecycle Engine (Stage 1 Specification & Implementation)", () => {
  const expectedSequence: LifecycleStageId[] = [
    "USER",
    "AUTHENTICATION",
    "UPLOAD",
    "FILE_SECURITY_VALIDATION",
    "FILE_STORAGE",
    "INGESTION_RECORD",
    "PARSING",
    "NORMALISATION",
    "VALIDATION",
    "DATABASE",
    "CALCULATIONS",
    "RECONCILIATION",
    "ANOMALY_ANALYSIS",
    "RESULTS_STORAGE",
    "DASHBOARD",
    "REPORTS",
  ];

  it("should define all 16 mandated stages in strictly ordered sequence", () => {
    const stages = ProductionDataLifecycleEngine.getStages();
    expect(stages).toHaveLength(16);

    const actualSequence = stages.map((s) => s.stageId);
    expect(actualSequence).toEqual(expectedSequence);

    stages.forEach((stage, idx) => {
      expect(stage.order).toBe(idx + 1);
      expect(stage.persistentTables.length).toBeGreaterThan(0);
      expect(stage.primaryKeys.length).toBeGreaterThan(0);
      expect(stage.immutableLineageKey).toBeDefined();
    });
  });

  it("should have persistent database table definitions for every single lifecycle stage", () => {
    expectedSequence.forEach((stageId) => {
      const def = PRODUCTION_LIFECYCLE_STAGES[stageId];
      expect(def).toBeDefined();
      expect(def.persistentTables.length).toBeGreaterThan(0);

      // Verify each table has schema prefix
      def.persistentTables.forEach((tableName) => {
        expect(tableName).toMatch(/^(public|auth|storage)\./);
      });
    });
  });

  it("should execute trusted server-side calculations using high-precision Decimal arithmetic (Stage 11)", async () => {
    const mockTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "MEGAFLEX_TEST",
        version: "2026.1",
        effective_from: "2026-04-01",
        provider: "Eskom",
      },
      rates: {
        active_energy_peak: { value: "2.1000", unit: "R/kWh" },
        active_energy_standard: { value: "1.2500", unit: "R/kWh" },
        active_energy_off_peak: { value: "0.8500", unit: "R/kWh" },
        network_demand: { value: "75.00", unit: "R/kVA" },
        network_capacity: { value: "45.00", unit: "R/kVA" },
        service_charge: { value: "250.00", unit: "R/day" },
        admin_charge: { value: "120.00", unit: "R/day" },
        reactive_energy: { value: "0.2000", unit: "R/kVARh" },
        electrification_subsidy: { value: "0.0900", unit: "R/kWh" },
        affordability_subsidy: { value: "0.0500", unit: "R/kWh" },
      },
    };

    const peakKwh = new Decimal(10000);
    const standardKwh = new Decimal(20000);
    const offPeakKwh = new Decimal(30000);
    const maxDemandKva = new Decimal(500);
    // Total kWh = 60,000. 30% threshold is 18,000. Reactive is 25,000, so 7,000 excess
    const reactiveKvarh = new Decimal(25000);

    const result = await ProductionDataLifecycleEngine.executeServerSideCalculations({
      runId: "TEST-RUN-001",
      tenantId: "TENANT-001",
      invoiceId: "INV-001",
      tariffVersion: mockTariff,
      peakKwh,
      standardKwh,
      offPeakKwh,
      maxDemandKva,
      reactiveKvarh,
    });

    expect(result.snapshot).toBeDefined();
    expect(result.snapshot.reconciliation_run_id).toBe("TEST-RUN-001");
    expect(result.calculatedCharges).toBeDefined();

    // 10,000 * 2.10 = 21,000
    expect(result.calculatedCharges.peakEnergyChargeZar.toNumber()).toBe(21000);
    // 20,000 * 1.25 = 25,000
    expect(result.calculatedCharges.standardEnergyChargeZar.toNumber()).toBe(25000);
    // 30,000 * 0.85 = 25,500
    expect(result.calculatedCharges.offPeakEnergyChargeZar.toNumber()).toBe(25500);
    // Total active = 71,500
    expect(result.calculatedCharges.totalActiveEnergyZar.toNumber()).toBe(71500);

    // 500 * 75 = 37,500
    expect(result.calculatedCharges.networkDemandChargeZar.toNumber()).toBe(37500);
    // 500 * 45 = 22,500
    expect(result.calculatedCharges.networkCapacityChargeZar.toNumber()).toBe(22500);

    // Excess reactive: 7,000 * 0.20 = 1,400
    expect(result.calculatedCharges.reactiveEnergyChargeZar.toNumber()).toBe(1400);

    // Subsidies: 60,000 * 0.09 = 5,400, 60,000 * 0.05 = 3,000
    expect(result.calculatedCharges.electrificationSubsidyZar.toNumber()).toBe(5400);
    expect(result.calculatedCharges.affordabilitySubsidyZar.toNumber()).toBe(3000);

    // Fixed: 250 + 120 = 370
    // Subtotal: 71,500 + 37,500 + 22,500 + 1,400 + 370 + 5,400 + 3,000 = 141,670
    expect(result.calculatedCharges.subtotalZar.toNumber()).toBe(141670);

    // 15% VAT = 21,250.50
    expect(result.calculatedCharges.vatZar.toNumber()).toBe(21250.5);

    // Total = 162,920.50
    expect(result.calculatedCharges.totalZar.toNumber()).toBe(162920.5);
  });

  it("should execute authoritative reconciliation pipeline across stages 11 to 14 with persistent records", async () => {
    const mockTariff: TariffVersionDefinition = {
      header: {
        tariff_code: "MEGAFLEX",
        version: "2026.1",
        effective_from: "2026-04-01",
        provider: "Eskom",
      },
      rates: {},
    };

    const input = {
      tenant_id: "TENANT-ALPHA",
      invoice_id: "INV-2026-001",
      invoice_number: "INV-2026-001",
      account_number: "0123456789",
      billing_start: "2026-04-01",
      billing_end: "2026-04-30",
      tariff_version: mockTariff,
      billed_peak_kwh: new Decimal("1250000"),
      billed_standard_kwh: new Decimal("2450000"),
      billed_off_peak_kwh: new Decimal("3800000"),
      billed_total_kwh: new Decimal("7500000"),
      billed_maximum_demand_kva: new Decimal("15400"),
      billed_ratcheted_demand_kva: new Decimal("15400"),
      billed_reactive_energy_kvarh: new Decimal("850000"),
      billed_energy_charges_zar: new Decimal("12500000"),
      billed_demand_charges_zar: new Decimal("1200000"),
      billed_network_charges_zar: new Decimal("850000"),
      billed_service_charges_zar: new Decimal("5000"),
      billed_ancillary_charges_zar: new Decimal("45000"),
      billed_vat_zar: new Decimal("2190000"),
      billed_total_invoice_zar: new Decimal("16790000"),

      calc_peak_kwh: new Decimal("1250000"),
      calc_standard_kwh: new Decimal("2450000"),
      calc_off_peak_kwh: new Decimal("3800000"),
      calc_total_kwh: new Decimal("7500000"),
      calc_maximum_demand_kva: new Decimal("15400"),
    };

    const result = await ProductionDataLifecycleEngine.executeAuthoritativePipeline(
      input,
      "CORR-UNIT-TEST-123"
    );

    expect(result.correlationId).toBe("CORR-UNIT-TEST-123");
    expect(result.runId).toMatch(/^RUN-/);
    expect(result.tenantId).toBe("TENANT-ALPHA");
    expect(result.invoiceId).toBe("INV-2026-001");
    expect(result.calculationSnapshotId).toBeDefined();
    expect(result.billedTotalZar).toBe(16790000);
    expect(result.calculatedTotalZar).toBeGreaterThan(0);
    expect(result.checksum).toBeDefined();
  });
});
