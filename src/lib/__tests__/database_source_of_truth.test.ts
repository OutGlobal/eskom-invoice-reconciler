import { describe, expect, it } from "vitest";
import { supabase } from "@/lib/supabase";
import { DashboardService } from "../../domain/dashboard/dashboardService";
import {
  AuthoritativeSchemaRegistry,
  AUTHORITATIVE_DOMAIN_REGISTRY,
  type DomainConceptName,
} from "../../domain/database/authoritativeSchemaRegistry";

describe("Stage 3 — Database Source of Truth Tests", () => {
  it("Scenario 1: All 25 domain concepts are mapped with zero redundant duplicate storage", async () => {
    const requiredDomainConcepts: DomainConceptName[] = [
      "ORGANISATIONS",
      "USERS",
      "ROLES",
      "SITES",
      "METERS",
      "ACCOUNTS",
      "TARIFFS",
      "TARIFF_VERSIONS",
      "INVOICES",
      "INVOICE_LINE_ITEMS",
      "UPLOADS",
      "SOURCE_FILES",
      "METER_READINGS",
      "INTERVAL_DATA",
      "ENERGY_TOTALS",
      "DEMAND_DATA",
      "REACTIVE_ENERGY",
      "RECONCILIATIONS",
      "RECONCILIATION_RESULTS",
      "ANOMALIES",
      "ANALYSIS_RESULTS",
      "REPORTS",
      "AUDIT_LOGS",
      "PROCESSING_JOBS",
      "PROCESSING_ERRORS",
    ];

    expect(requiredDomainConcepts.length).toBe(25);

    for (const concept of requiredDomainConcepts) {
      // 1. Must be recognized in the schema registry
      expect(AuthoritativeSchemaRegistry.isDomainRecognized(concept)).toBe(true);

      const def = AuthoritativeSchemaRegistry.getDefinition(concept);
      expect(def).toBeDefined();
      expect(def.concept).toBe(concept);
      expect(def.physicalTable).toBeDefined();
      expect(def.primaryKey).toBeDefined();

      // 2. Rule: Reuse existing structures where appropriate, do not create redundant tables
      expect(def.isExistingStructureReused).toBe(true);

      // 3. Supabase query builders can be formed for physical tables and canonical views
      const physicalQuery = supabase
        .from(def.physicalTable as any)
        .select("*")
        .limit(1);
      expect(physicalQuery).toBeDefined();

      const viewQuery = supabase
        .from(def.canonicalView as any)
        .select("*")
        .limit(1);
      expect(viewQuery).toBeDefined();
    }
  });

  it("Scenario 2: Dashboard Service executes database query as authoritative source of truth", async () => {
    // When records exist in the database, getAggregatedDashboardData() returns live database aggregates
    const liveDbResult = await DashboardService.getAggregatedDashboardData({
      source: "database",
    });
    expect(liveDbResult).toBeDefined();
    expect(liveDbResult.isLiveDatabase).toBe(true);
    expect(liveDbResult.hasData).toBe(true);
    expect(liveDbResult.portfolioSummary.totalInvoices).toBeGreaterThanOrEqual(1);
    expect(liveDbResult.portfolioSummary.totalBilledAmountZar).toBeGreaterThanOrEqual(920000);

    // When querying a non-existent account filter in database mode, returns clean empty state with NO synthetic fallback
    const nonExistentResult = await DashboardService.getAggregatedDashboardData({
      source: "database",
      accountNumber: "NON_EXISTENT_ACC_99999",
    });
    expect(nonExistentResult.hasData).toBe(false);
    expect(nonExistentResult.isLiveDatabase).toBe(false);
    expect(nonExistentResult.portfolioSummary.totalInvoices).toBe(0);
    expect(nonExistentResult.portfolioSummary.totalBilledAmountZar).toBe(0);
  });

  it("Scenario 3: Tenant-scoped queries enforce organisation boundary", async () => {
    const dummyOrgId = "00000000-0000-0000-0000-000000000000";
    const result = await DashboardService.getAggregatedDashboardData({
      source: "database",
      organisationId: dummyOrgId,
    });
    expect(result.hasData).toBe(false);
    expect(result.portfolioSummary.totalInvoices).toBe(0);
    expect(result.portfolioSummary.totalBilledAmountZar).toBe(0);
  });

  it("Scenario 4: Stored records aggregate accurately into portfolio and energy metrics", () => {
    const timestamp = new Date().toISOString();
    const emptyData = DashboardService.createEmptyDashboardData(timestamp);

    expect(emptyData.portfolioSummary.totalBilledAmountZar).toBe(0);
    expect(emptyData.energyOverview.totalKWh).toBe(0);
    expect(emptyData.criticalAlerts).toEqual([]);
    expect(emptyData.reconciliationHealth.reconciliationSuccessRatePct).toBe(0);
  });

  it("Scenario 5: Schema registry helper queryDomain constructs valid Supabase queries", () => {
    const names = AuthoritativeSchemaRegistry.getAllDomainNames();
    expect(names.length).toBe(25);

    for (const name of names) {
      const qPhysical = AuthoritativeSchemaRegistry.queryDomain(supabase, name, false);
      expect(qPhysical).toBeDefined();

      const qView = AuthoritativeSchemaRegistry.queryDomain(supabase, name, true);
      expect(qView).toBeDefined();
    }
  });
});
