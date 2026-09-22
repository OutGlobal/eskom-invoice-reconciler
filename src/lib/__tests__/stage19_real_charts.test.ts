/**
 * STAGE 19 — CHARTS VERIFICATION TEST SUITE
 *
 * Requirements:
 * 1. All charts must use real database data.
 * 2. Charts should update when new data is processed.
 * 3. Required chart examples:
 *    - Monthly consumption
 *    - Monthly cost
 *    - Peak / standard / off-peak
 *    - Demand
 *    - Variance
 *    - Site comparison
 *    - Billing trend
 *    - Anomaly trend
 * 4. Do not embed static chart arrays.
 * 5. If there is insufficient data: show an appropriate empty state.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ChartDataService } from "@/domain/charts/chartDataService";
import type { ChartQueryStoreData } from "@/domain/charts/types";

// Mock Supabase
vi.mock("@/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "invoice_records") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            then: vi.fn((resolve) =>
              resolve({
                data: [
                  {
                    id: "rec-001",
                    account_number: "ACC-9901",
                    invoice_number: "ESK-2026-01",
                    site_id: "site-sandton-01",
                    site_name: "Sandton Primary Data Centre",
                    billing_period_name: "January 2026",
                    billing_start: "2026-01-01",
                    billing_end: "2026-01-31",
                    total_kwh: 450000,
                    peak_kwh: 90000,
                    standard_kwh: 220000,
                    off_peak_kwh: 140000,
                    max_demand_kva: 1100,
                    invoiced_total: 850000,
                    reconciled_total: 820000,
                    variance_amount: 30000,
                    status: "reconciled",
                    created_at: "2026-02-01T10:00:00Z",
                  },
                  {
                    id: "rec-002",
                    account_number: "ACC-9901",
                    invoice_number: "ESK-2026-02",
                    site_id: "site-sandton-01",
                    site_name: "Sandton Primary Data Centre",
                    billing_period_name: "February 2026",
                    billing_start: "2026-02-01",
                    billing_end: "2026-02-28",
                    total_kwh: 480000,
                    peak_kwh: 95000,
                    standard_kwh: 235000,
                    off_peak_kwh: 150000,
                    max_demand_kva: 1150,
                    invoiced_total: 910000,
                    reconciled_total: 875000,
                    variance_amount: 35000,
                    status: "reconciled",
                    created_at: "2026-03-01T10:00:00Z",
                  },
                  {
                    id: "rec-003",
                    account_number: "ACC-9902",
                    invoice_number: "ESK-2026-03-CPT",
                    site_id: "site-cpt-01",
                    site_name: "Cape Town Regional Plant",
                    billing_period_name: "February 2026",
                    billing_start: "2026-02-01",
                    billing_end: "2026-02-28",
                    total_kwh: 320000,
                    peak_kwh: 60000,
                    standard_kwh: 160000,
                    off_peak_kwh: 100000,
                    max_demand_kva: 850,
                    invoiced_total: 610000,
                    reconciled_total: 612000,
                    variance_amount: -2000,
                    status: "reconciled",
                    created_at: "2026-03-02T10:00:00Z",
                  },
                ],
                error: null,
              }),
            ),
          };
        }

        if (table === "invoices") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve) => resolve({ data: [], error: null })),
          };
        }

        if (table === "sites") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve) =>
              resolve({
                data: [
                  {
                    id: "site-sandton-01",
                    site_code: "JHB-SDN-01",
                    site_name: "Sandton Primary Data Centre",
                  },
                  {
                    id: "site-cpt-01",
                    site_code: "CPT-PLT-01",
                    site_name: "Cape Town Regional Plant",
                  },
                ],
                error: null,
              }),
            ),
          };
        }

        if (table === "discrepancy_events") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve) =>
              resolve({
                data: [
                  {
                    id: "disc-01",
                    severity: "critical",
                    variance_amount: 30000,
                    created_at: "2026-01-15T08:00:00Z",
                  },
                  {
                    id: "disc-02",
                    severity: "major",
                    variance_amount: 25000,
                    created_at: "2026-02-10T09:00:00Z",
                  },
                  {
                    id: "disc-03",
                    severity: "minor",
                    variance_amount: 10000,
                    created_at: "2026-02-12T10:00:00Z",
                  },
                ],
                error: null,
              }),
            ),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: vi.fn((resolve) => resolve({ data: [], error: null })),
        };
      }),
    },
  };
});

describe("STAGE 19 — CHARTS: Real Database Visualizations & Aggregations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Requirement 1 & 3: Real Database Data for All 8 Chart Examples", () => {
    it("1. Monthly Consumption: calculates exact real kWh from database invoices", async () => {
      const allData = await ChartDataService.getAllChartsData({ source: "database" });
      const mc = allData.monthlyConsumption;

      expect(mc.hasData).toBe(true);
      expect(mc.recordCount).toBe(3);
      expect(mc.data[0]).toEqual({
        period: "January 2026",
        invoiceNumber: "ESK-2026-01",
        accountNumber: "ACC-9901",
        totalKwh: 450000,
        peakKwh: 90000,
        standardKwh: 220000,
        offPeakKwh: 140000,
        billingStart: "2026-01-01",
        billingEnd: "2026-01-31",
      });
      expect(mc.data[1].totalKwh).toBe(480000);
      expect(mc.data[2].totalKwh).toBe(320000);
    });

    it("2. Monthly Cost: extracts real Billed vs Calculated amounts and variance", async () => {
      const allData = await ChartDataService.getAllChartsData({ source: "database" });
      const cost = allData.monthlyCost;

      expect(cost.hasData).toBe(true);
      expect(cost.recordCount).toBe(3);
      expect(cost.data[0]).toEqual({
        period: "January 2026",
        invoiceNumber: "ESK-2026-01",
        accountNumber: "ACC-9901",
        billedZar: 850000,
        calculatedZar: 820000,
        varianceZar: 30000,
        status: "RECONCILED",
      });
      // Month 3 had an underbilling of -2000
      expect(cost.data[2].billedZar).toBe(610000);
      expect(cost.data[2].calculatedZar).toBe(612000);
      expect(cost.data[2].varianceZar).toBe(-2000);
    });

    it("3. Peak / Standard / Off-Peak TOU: calculates real TOU distribution and percentages", async () => {
      const allData = await ChartDataService.getAllChartsData({ source: "database" });
      const tou = allData.touBreakdown;

      expect(tou.hasData).toBe(true);
      expect(tou.recordCount).toBe(3);

      // Verify period TOU percentages
      const jan = tou.data[0];
      expect(jan.totalKwh).toBe(450000);
      expect(jan.peakKwh).toBe(90000);
      expect(jan.peakPct).toBe(20.0); // 90,000 / 450,000 = 20%
      expect(jan.standardPct).toBe(48.9); // 220,000 / 450,000 = 48.9%
      expect(jan.offPeakPct).toBe(31.1); // 140,000 / 450,000 = 31.1%

      // Verify aggregate distribution donut slices
      expect(tou.distribution).toHaveLength(3);
      const totalPeak = 90000 + 95000 + 60000; // 245,000
      const totalStd = 220000 + 235000 + 160000; // 615,000
      const totalOff = 140000 + 150000 + 100000; // 390,000
      const totalKwh = totalPeak + totalStd + totalOff; // 1,250,000

      expect(tou.distribution[0].name).toBe("Peak Energy");
      expect(tou.distribution[0].value).toBe(totalPeak);
      expect(tou.distribution[0].percentage).toBe(
        Number(((totalPeak / totalKwh) * 100).toFixed(1)),
      );
    });

    it("4. Demand Profile: tracks real max demand against contracted NMD threshold", async () => {
      const storeData: ChartQueryStoreData = {
        customer: { nmd: 1000 },
      };
      const allData = await ChartDataService.getAllChartsData({ source: "database" }, storeData);
      const demand = allData.demandProfile;

      expect(demand.hasData).toBe(true);
      expect(demand.recordCount).toBe(3);

      // Month 1: 1100 kVA vs 1000 NMD -> Exceeded by 100 kVA
      expect(demand.data[0].demandKva).toBe(1100);
      expect(demand.data[0].nmdKva).toBe(1000);
      expect(demand.data[0].isExceeded).toBe(true);
      expect(demand.data[0].exceedanceMarginKva).toBe(100);

      // Month 3: 850 kVA vs 1000 NMD -> Compliant
      expect(demand.data[2].demandKva).toBe(850);
      expect(demand.data[2].isExceeded).toBe(false);
      expect(demand.data[2].exceedanceMarginKva).toBe(0);
    });

    it("5. Variance Trend: distinguishes overbilling claims from underbilling exposure", async () => {
      const allData = await ChartDataService.getAllChartsData({ source: "database" });
      const variance = allData.varianceTrend;

      expect(variance.hasData).toBe(true);
      expect(variance.recordCount).toBe(3);

      // Period 1: Overbilling of R 30,000
      expect(variance.data[0].varianceZar).toBe(30000);
      expect(variance.data[0].overbillingZar).toBe(30000);
      expect(variance.data[0].underbillingZar).toBe(0);

      // Period 3: Underbilling of R 2,000
      expect(variance.data[2].varianceZar).toBe(-2000);
      expect(variance.data[2].overbillingZar).toBe(0);
      expect(variance.data[2].underbillingZar).toBe(2000);
    });

    it("6. Site Comparison: aggregates multi-site consumption and costs accurately", async () => {
      const allData = await ChartDataService.getAllChartsData({ source: "database" });
      const sites = allData.siteComparison;

      expect(sites.hasData).toBe(true);
      // Two sites: Sandton (2 invoices) and Cape Town (1 invoice)
      expect(sites.data).toHaveLength(2);

      const sandton = sites.data.find((s) => s.siteId === "site-sandton-01");
      expect(sandton).toBeDefined();
      expect(sandton?.siteName).toBe("Sandton Primary Data Centre");
      expect(sandton?.invoiceCount).toBe(2);
      expect(sandton?.totalKwh).toBe(450000 + 480000); // 930,000
      expect(sandton?.billedZar).toBe(850000 + 910000); // 1,760,000
      expect(sandton?.varianceZar).toBe(30000 + 35000); // 65,000

      const cpt = sites.data.find((s) => s.siteId === "site-cpt-01");
      expect(cpt).toBeDefined();
      expect(cpt?.invoiceCount).toBe(1);
      expect(cpt?.totalKwh).toBe(320000);
      expect(cpt?.varianceZar).toBe(-2000);
    });

    it("7. Billing Trend: calculates effective blended rates and audit trajectory", async () => {
      const allData = await ChartDataService.getAllChartsData({ source: "database" });
      const trend = allData.billingTrend;

      expect(trend.hasData).toBe(true);
      expect(trend.recordCount).toBe(3);

      // Month 1: 850,000 ZAR / 450,000 kWh = 1.8889 R/kWh
      expect(trend.data[0].billedZar).toBe(850000);
      expect(trend.data[0].effectiveRateZarPerKwh).toBeCloseTo(1.8889, 3);

      // Month 3: 610,000 ZAR / 320,000 kWh = 1.9063 R/kWh
      expect(trend.data[2].billedZar).toBe(610000);
      expect(trend.data[2].effectiveRateZarPerKwh).toBeCloseTo(1.9063, 3);
    });

    it("8. Anomaly Trend: aggregates discrepancy volume and financial impact by period", async () => {
      const allData = await ChartDataService.getAllChartsData({ source: "database" });
      const anomaly = allData.anomalyTrend;

      expect(anomaly.hasData).toBe(true);
      expect(anomaly.recordCount).toBe(2); // 2026-01 (1 event) and 2026-02 (2 events)

      const jan = anomaly.data.find((a) => a.period === "2026-01");
      expect(jan?.criticalCount).toBe(1);
      expect(jan?.majorCount).toBe(0);
      expect(jan?.financialImpactZar).toBe(30000);

      const feb = anomaly.data.find((a) => a.period === "2026-02");
      expect(feb?.criticalCount).toBe(0);
      expect(feb?.majorCount).toBe(1);
      expect(feb?.minorCount).toBe(1);
      expect(feb?.financialImpactZar).toBe(35000); // 25,000 + 10,000
    });
  });

  describe("Requirement 2: Charts Update Automatically When New Data Is Processed", () => {
    it("dynamically recalculates chart datasets when a new batch invoice is processed into store", async () => {
      const initialData = await ChartDataService.getAllChartsData(
        { source: "store" },
        { batchInvoices: [] },
      );
      expect(initialData.monthlyConsumption.hasData).toBe(false);

      // Simulate ingesting new invoice
      const newInvoice = {
        id: "new-inv-100",
        invoiceNo: "ESK-NEW-100",
        accountMonth: "March 2026",
        totalKWh: 520000,
        peakKWh: 105000,
        standardKWh: 255000,
        offPeakKWh: 160000,
        invoiceTotal: 980000,
        reconciledTotal: 950000,
        maxDemandKVA: 1200,
      };

      const updatedData = await ChartDataService.getAllChartsData(
        { source: "store" },
        { batchInvoices: [newInvoice] },
      );

      expect(updatedData.monthlyConsumption.hasData).toBe(true);
      expect(updatedData.monthlyConsumption.recordCount).toBe(1);
      expect(updatedData.monthlyConsumption.data[0].totalKwh).toBe(520000);
      expect(updatedData.monthlyCost.data[0].billedZar).toBe(980000);
      expect(updatedData.monthlyCost.data[0].calculatedZar).toBe(950000);
      expect(updatedData.varianceTrend.data[0].varianceZar).toBe(30000);
    });
  });

  describe("Requirement 4: Zero Static Chart Arrays in Codebase", () => {
    it("verifies EnterpriseReconciliationCharts.tsx contains NO hardcoded monthlyData or Math.sin loops", () => {
      const filePath = path.resolve(
        __dirname,
        "../../components/reconciliation/EnterpriseReconciliationCharts.tsx",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).not.toContain("Math.sin(i)");
      expect(content).not.toContain('name: "Jan 2026", Billed: 425000');
      expect(content).not.toContain('name: "Peak Energy TOU", value: 12450');
      expect(content).not.toContain("Array.from({ length: 31 }");
    });

    it("verifies trends.tsx contains NO arbitrary multiplication factors", () => {
      const filePath = path.resolve(__dirname, "../../routes/trends.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).not.toContain("inv.peak_kwh * 0.95");
      expect(content).not.toContain("inv.standard_kwh * 0.65");
      expect(content).not.toContain("inv.off_peak_kwh * 0.45");
      expect(content).not.toContain("inv.max_demand_kva * 24.17");
    });

    it("verifies energy.tsx contains NO hardcoded fallback constants", () => {
      const filePath = path.resolve(__dirname, "../../routes/energy.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).not.toContain("6401924.4");
      expect(content).not.toContain("19432557.6");
      expect(content).not.toContain("23429967.6");
    });
  });

  describe("Requirement 5: Empty State Compliance on Insufficient Data", () => {
    it("returns hasData: false and descriptive emptyReason when no records exist", async () => {
      const emptyData = await ChartDataService.getAllChartsData(
        { source: "store" },
        { batchInvoices: [], rows: [] },
      );

      expect(emptyData.monthlyConsumption.hasData).toBe(false);
      expect(emptyData.monthlyConsumption.data).toHaveLength(0);
      expect(emptyData.monthlyConsumption.emptyReason).toContain(
        "No monthly consumption records found",
      );

      expect(emptyData.monthlyCost.hasData).toBe(false);
      expect(emptyData.monthlyCost.emptyReason).toContain("No billing cost records available");

      expect(emptyData.touBreakdown.hasData).toBe(false);
      expect(emptyData.touBreakdown.distribution).toHaveLength(0);

      expect(emptyData.demandProfile.hasData).toBe(false);
      expect(emptyData.varianceTrend.hasData).toBe(false);
      expect(emptyData.siteComparison.hasData).toBe(false);
      expect(emptyData.billingTrend.hasData).toBe(false);
      expect(emptyData.anomalyTrend.hasData).toBe(false);
    });
  });
});
