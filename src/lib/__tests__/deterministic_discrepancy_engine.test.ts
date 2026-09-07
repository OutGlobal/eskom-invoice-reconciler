import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import { DeterministicDiagnosticsEngine } from "@/domain/discrepancy/deterministicDiagnosticsEngine";
import { DeterministicReconciliationEngine, DEFAULT_TOLERANCE_CONFIG } from "@/domain/reconciliation/reconciliationEngine";
import { MEGAFLEX_JULY_2025_FIXTURE } from "@/domain/reconciliation/regressionFixtures";

describe("Deterministic Discrepancy & Root-Cause Analysis Engine", () => {
  it("should generate deterministic discrepancy records for all 12 system codes", () => {
    const records = DeterministicDiagnosticsEngine.generateAllCodesSample();
    expect(records.length).toBe(12);

    const expectedCodes = [
      "TAR-001",
      "DEM-001",
      "MUL-001",
      "TOU-001",
      "EST-001",
      "TEL-001",
      "TEL-002",
      "REA-001",
      "NET-001",
      "CHG-001",
      "VAT-001",
      "INV-001",
    ];

    for (const code of expectedCodes) {
      const match = records.find((r) => r.code === code);
      expect(match).toBeDefined();
      expect(match?.evidence).toContain("System rule evaluation");
      expect(match?.financial_impact_zar.toNumber()).toBeGreaterThan(0);
    }
  });

  it("should construct 4-step root-cause propagation chain for detected discrepancies", () => {
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

      billed_peak_kwh: inv.peak_kwh.plus(5000), // Peak kWh discrepancy
      billed_standard_kwh: inv.standard_kwh,
      billed_off_peak_kwh: inv.off_peak_kwh,
      billed_total_kwh: inv.total_kwh.plus(5000),
      billed_maximum_demand_kva: inv.maximum_demand_kva,
      billed_ratcheted_demand_kva: inv.ratcheted_demand_kva,
      billed_reactive_energy_kvarh: inv.reactive_energy_kvarh,
      billed_energy_charges_zar: inv.energy_charges_zar.plus(33346),
      billed_demand_charges_zar: inv.demand_charges_zar,
      billed_network_charges_zar: inv.network_charges_zar,
      billed_service_charges_zar: inv.service_charges_zar,
      billed_ancillary_charges_zar: inv.ancillary_charges_zar,
      billed_vat_zar: inv.vat_zar,
      billed_total_invoice_zar: inv.total_invoice_zar.plus(38347.90),
    };

    const payload = DeterministicReconciliationEngine.reconcile(inputWithDiscrepancy, DEFAULT_TOLERANCE_CONFIG);
    const records = DeterministicDiagnosticsEngine.scan(payload);

    expect(records.length).toBeGreaterThan(0);

    const touDiscrepancy = records.find((r) => r.code === "TOU-001");
    expect(touDiscrepancy).toBeDefined();
    expect(touDiscrepancy?.root_cause_chain.length).toBe(4);
    expect(touDiscrepancy?.root_cause_chain[0].node_type).toBe("ROOT_CAUSE");
    expect(touDiscrepancy?.root_cause_chain[1].node_type).toBe("TOU_RATE");
    expect(touDiscrepancy?.root_cause_chain[2].node_type).toBe("LINE_ITEM_CHARGE");
    expect(touDiscrepancy?.root_cause_chain[3].node_type).toBe("INVOICE_VARIANCE");
  });

  it("should construct complete 6-level drill-down traceability paths for every discrepancy", () => {
    const records = DeterministicDiagnosticsEngine.generateAllCodesSample();

    for (const record of records) {
      const path = record.drill_down_path;
      expect(path).toBeDefined();
      expect(path.discrepancy_code).toBe(record.code);
      expect(path.invoice_id).toBeDefined();
      expect(path.determinant_code).toBeDefined();
      expect(path.calculation_summary).toBeDefined();
      expect(path.telemetry_summary).toBeDefined();
      expect(path.tariff_rule_id).toBeDefined();
      expect(path.source_file_name).toBeDefined();
    }
  });

  it("should enforce strict status lifecycle states", () => {
    const validStatuses = ["OPEN", "UNDER_REVIEW", "CONFIRMED", "DISPUTED", "RESOLVED", "REJECTED"];
    const records = DeterministicDiagnosticsEngine.generateAllCodesSample();

    for (const r of records) {
      expect(validStatuses).toContain(r.status);
    }
  });
});
