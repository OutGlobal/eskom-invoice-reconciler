/**
 * STAGE 25 — FRONTEND / BACKEND CONTRACT & DATA LINEAGE TEST SUITE
 * ================================================================
 *
 * Verifies that:
 * 1. Every dashboard component and displayed value has an explicit data contract.
 * 2. Every displayed value identifies:
 *    - SOURCE
 *    - TABLE
 *    - COLUMN
 *    - QUERY
 *    - TRANSFORMATION
 * 3. If a source cannot be identified, the metric is flagged immediately.
 * 4. Zero ungrounded metrics exist in production dashboards.
 * 5. Complete internal data lineage map is enforced:
 *    Dashboard Total Cost ← aggregation query ← invoice/reconciliation results ← invoice records ← uploaded invoice
 * 6. Level 3 Zero-Exposure compliance: internal schemas and raw SQL queries are isolated in domain logic.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ContractDataLineageMap } from "../../domain/lineage/contractDataLineageMap";
import { DashboardService } from "../../domain/dashboard/dashboardService";

describe("Stage 25 — Frontend / Backend Contract & Internal Data Lineage Map", () => {
  beforeEach(() => {
    ContractDataLineageMap.resetCatalog();
  });

  it("Requirement 1: Every dashboard component has its metrics registered in the authoritative contract", () => {
    const allMetrics = ContractDataLineageMap.getAllMetrics();
    expect(allMetrics.length).toBeGreaterThanOrEqual(20);

    const components = new Set(allMetrics.map((m) => m.component));
    expect(components.has("CommandCentreDashboard")).toBe(true);
    expect(components.has("AnomalyDashboard")).toBe(true);
    expect(components.has("TelemetryPage")).toBe(true);
  });

  it("Requirement 2: Every single metric strictly identifies SOURCE, TABLE, COLUMN, QUERY, and TRANSFORMATION", () => {
    const allMetrics = ContractDataLineageMap.getAllMetrics();

    for (const metric of allMetrics) {
      // 1. Metric ID & Display Name
      expect(metric.metricId).toBeDefined();
      expect(metric.metricId.trim().length).toBeGreaterThan(0);
      expect(metric.displayName).toBeDefined();
      expect(metric.displayName.trim().length).toBeGreaterThan(0);

      // 2. SOURCE
      expect(metric.source).toBeDefined();
      expect(metric.source.trim().length).toBeGreaterThan(3);

      // 3. TABLE
      expect(metric.table).toBeDefined();
      expect(metric.table.trim().length).toBeGreaterThan(2);

      // 4. COLUMN
      expect(metric.column).toBeDefined();
      expect(metric.column.trim().length).toBeGreaterThan(1);

      // 5. QUERY
      expect(metric.query).toBeDefined();
      expect(metric.query.trim().length).toBeGreaterThan(3);

      // 6. TRANSFORMATION
      expect(metric.transformation).toBeDefined();
      expect(metric.transformation.trim().length).toBeGreaterThan(5);

      // 7. LINEAGE CHAIN
      expect(Array.isArray(metric.lineageChain)).toBe(true);
      expect(metric.lineageChain.length).toBeGreaterThanOrEqual(3);

      // 8. STATUS
      expect(metric.status).toBe("VERIFIED");
    }
  });

  it("Requirement 3: Verifies exact user-requested lineage chain format for Dashboard Total Cost", () => {
    // Exact user requirement example:
    // Dashboard Total Cost
    // ← aggregation query
    // ← invoice/reconciliation results
    // ← invoice records
    // ← uploaded invoice

    const formattedChain =
      ContractDataLineageMap.getFormattedLineageChain("cmd_total_billed_amount");
    expect(formattedChain).toBeDefined();

    // Check that every stage of the user's example is represented in the chain
    expect(formattedChain).toContain("Dashboard Total Cost");
    expect(formattedChain).toContain("aggregation query");
    expect(formattedChain).toContain("invoice/reconciliation results");
    expect(formattedChain).toContain("invoice_records");
    expect(formattedChain).toContain("Uploaded Utility Invoice File");

    // Check that arrow direction matches '←' notation
    expect(formattedChain.split(" ← ").length).toBeGreaterThanOrEqual(5);
  });

  it("Requirement 4: Flagging mechanism immediately identifies ungrounded / missing data sources", () => {
    // Register an ungrounded metric with no valid source
    ContractDataLineageMap.flagMetric(
      "unattributed_mystery_kpi",
      "No database table, column, or query exists for this widget.",
    );

    const flagged = ContractDataLineageMap.getFlaggedMetrics();
    expect(flagged.length).toBe(1);
    expect(flagged[0].metricId).toBe("unattributed_mystery_kpi");
    expect(flagged[0].status).toBe("FLAGGED_NO_SOURCE");
    expect(flagged[0].flagReason).toContain("No database table");

    // Audit summary reports unhealthy state
    const audit = ContractDataLineageMap.auditAllMetrics();
    expect(audit.isHealthy).toBe(false);
    expect(audit.flaggedMetrics).toBe(1);
    expect(audit.flaggedDetails[0].metricId).toBe("unattributed_mystery_kpi");
  });

  it("Requirement 5: Production catalog has ZERO ungrounded metrics and 100% verified data sources", () => {
    // Reset to clean production baseline
    ContractDataLineageMap.resetCatalog();

    const audit = DashboardService.auditContractLineage();
    expect(audit.totalMetrics).toBeGreaterThanOrEqual(20);
    expect(audit.flaggedMetrics).toBe(0);
    expect(audit.verifiedMetrics).toBe(audit.totalMetrics);
    expect(audit.isHealthy).toBe(true);
    expect(audit.flaggedDetails.length).toBe(0);
  });

  it("Requirement 6: Verification of Financial, Energy, Demand, and Health Subsystems", () => {
    const portfolioMetrics = ContractDataLineageMap.getMetricsByCategory("PORTFOLIO");
    const financialMetrics = ContractDataLineageMap.getMetricsByCategory("FINANCIAL");
    const energyMetrics = ContractDataLineageMap.getMetricsByCategory("ENERGY_OVERVIEW");
    const healthMetrics = ContractDataLineageMap.getMetricsByCategory("RECONCILIATION_HEALTH");

    expect(portfolioMetrics.length).toBeGreaterThanOrEqual(4);
    expect(financialMetrics.length).toBeGreaterThanOrEqual(5);
    expect(energyMetrics.length).toBeGreaterThanOrEqual(6);
    expect(healthMetrics.length).toBeGreaterThanOrEqual(4);

    // Verify key financial metrics have exact table attribution
    const billedMetric = ContractDataLineageMap.getMetric("cmd_total_billed_amount");
    expect(billedMetric?.table).toContain("invoice_records");
    expect(billedMetric?.column).toContain("invoiced_total");

    const calculatedMetric = ContractDataLineageMap.getMetric("cmd_total_calculated_amount");
    expect(calculatedMetric?.table).toContain("invoice_records");
    expect(calculatedMetric?.column).toContain("reconciled_total");

    const varianceMetric = ContractDataLineageMap.getMetric("cmd_net_variance");
    expect(varianceMetric?.transformation).toContain("totalBilled.minus(totalCalculated)");

    // Verify energy determinant attribution
    const peakMetric = ContractDataLineageMap.getMetric("cmd_peak_energy");
    expect(peakMetric?.column).toBe("peak_kwh");

    const maxDemandMetric = ContractDataLineageMap.getMetric("cmd_max_demand");
    expect(maxDemandMetric?.column).toBe("max_demand_kva");
  });

  it("Requirement 7: Level 3 Zero-Exposure Compliance (Public Display Names contain no raw database schemas)", () => {
    const allMetrics = ContractDataLineageMap.getAllMetrics();

    const forbiddenPublicPatterns = [
      /public\./i,
      /postgres:\/\//i,
      /service_role/i,
      /SELECT\s+\*\s+FROM/i,
    ];

    for (const metric of allMetrics) {
      for (const pattern of forbiddenPublicPatterns) {
        // Display names must be user-facing and clean
        expect(pattern.test(metric.displayName)).toBe(false);
      }
    }
  });
});
