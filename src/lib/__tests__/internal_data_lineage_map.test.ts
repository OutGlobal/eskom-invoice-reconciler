/**
 * INTERNAL DATA LINEAGE MAP TEST SUITE
 * =====================================
 *
 * Verifies that for every number shown in ENERA, the engineering team
 * can deterministically answer:
 * "Where did this number come from?"
 *
 * Specifically verifies:
 *
 * 1. Total Energy Cost:
 *    Dashboard
 *       ↓
 *    Total Energy Cost
 *       ↓
 *    Reconciliation Results
 *       ↓
 *    Invoice Charges
 *       ↓
 *    Invoice Record
 *       ↓
 *    Uploaded PDF
 *
 * 2. Actual kWh:
 *    Dashboard
 *       ↓
 *    Actual kWh
 *       ↓
 *    Monthly Energy Aggregation
 *       ↓
 *    Validated Interval Data
 *       ↓
 *    AMR CSV
 *       ↓
 *    Original Uploaded File
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContractDataLineageMap } from "@/domain/lineage/contractDataLineageMap";

describe("Internal Data Lineage Map — Provenance Hierarchy Verification", () => {
  beforeEach(() => {
    ContractDataLineageMap.resetCatalog();
  });

  // Requirement 1: Total Energy Cost exact downward provenance
  it("traces exact downward hierarchy for 'Total Energy Cost'", () => {
    const expectedChain = [
      "Dashboard",
      "Total Energy Cost",
      "Reconciliation Results",
      "Invoice Charges",
      "Invoice Record",
      "Uploaded PDF",
    ];

    const actualChain = ContractDataLineageMap.traceDownwardProvenance("Total Energy Cost");
    expect(actualChain).toEqual(expectedChain);

    const formatted = ContractDataLineageMap.traceNumberOrigin("Total Energy Cost");
    expect(formatted).toBe(expectedChain.join("\n   ↓\n"));
    expect(formatted).toContain("Dashboard\n   ↓\nTotal Energy Cost");
    expect(formatted).toContain("Invoice Record\n   ↓\nUploaded PDF");
  });

  // Requirement 2: Actual kWh exact downward provenance
  it("traces exact downward hierarchy for 'Actual kWh'", () => {
    const expectedChain = [
      "Dashboard",
      "Actual kWh",
      "Monthly Energy Aggregation",
      "Validated Interval Data",
      "AMR CSV",
      "Original Uploaded File",
    ];

    const actualChain = ContractDataLineageMap.traceDownwardProvenance("Actual kWh");
    expect(actualChain).toEqual(expectedChain);

    const formatted = ContractDataLineageMap.traceNumberOrigin("Actual kWh");
    expect(formatted).toBe(expectedChain.join("\n   ↓\n"));
    expect(formatted).toContain("Dashboard\n   ↓\nActual kWh");
    expect(formatted).toContain("AMR CSV\n   ↓\nOriginal Uploaded File");
  });

  // Requirement 3: Resolution by metricId, Display Name, and Natural Language Aliases
  it("resolves metric provenance interchangeably by ID, Display Name, or Alias", () => {
    const byId = ContractDataLineageMap.traceDownwardProvenance("cmd_total_billed_amount");
    const byName = ContractDataLineageMap.traceDownwardProvenance("Total Billed Amount");
    const byAlias = ContractDataLineageMap.traceDownwardProvenance("Total Energy Cost");
    const bySnake = ContractDataLineageMap.traceDownwardProvenance("total_energy_cost");

    expect(byId).toEqual(byName);
    expect(byName).toEqual(byAlias);
    expect(byAlias).toEqual(bySnake);

    const kwhById = ContractDataLineageMap.traceDownwardProvenance("cmd_total_energy");
    const kwhByName = ContractDataLineageMap.traceDownwardProvenance("Total Energy");
    const kwhByAlias = ContractDataLineageMap.traceDownwardProvenance("Actual kWh");
    const kwhBySnake = ContractDataLineageMap.traceDownwardProvenance("actual_kwh");

    expect(kwhById).toEqual(kwhByName);
    expect(kwhByName).toEqual(kwhByAlias);
    expect(kwhByAlias).toEqual(kwhBySnake);
  });

  // Requirement 4: Every registered metric has a valid, non-empty provenance chain
  it("guarantees every registered metric in ENERA has a verified provenance trace", () => {
    const allMetrics = ContractDataLineageMap.getAllMetrics();
    expect(allMetrics.length).toBeGreaterThanOrEqual(20);

    for (const metric of allMetrics) {
      const trace = ContractDataLineageMap.traceDownwardProvenance(metric.metricId);
      expect(trace.length).toBeGreaterThanOrEqual(3);
      expect(trace[0]).toBe("Dashboard");

      // Verify physical data storage is documented
      expect(metric.table).toBeDefined();
      expect(metric.column).toBeDefined();
      expect(metric.source).toBeDefined();
      expect(metric.query).toBeDefined();
      expect(metric.transformation).toBeDefined();
      expect(metric.status).toBe("VERIFIED");
    }
  });

  // Requirement 5: Audit reports 100% health across all dashboard components
  it("passes full audit with zero ungrounded or orphaned metrics", () => {
    const audit = ContractDataLineageMap.auditAllMetrics();
    expect(audit.isHealthy).toBe(true);
    expect(audit.flaggedMetrics).toBe(0);
    expect(audit.verifiedMetrics).toBe(audit.totalMetrics);
    expect(audit.componentsAudited).toContain("CommandCentreDashboard");
  });
});
