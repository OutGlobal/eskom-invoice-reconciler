// @ts-expect-error vitest types imported dynamically
import { describe, expect, it } from "vitest";
import { DashboardService } from "../../domain/dashboard/dashboardService";
import { SAMPLE_MARCH_2026_INVOICE } from "../sampleInvoice";
import { computeTotals, computeCharges } from "../reconciliation";

describe("Utility Reconciliation Command Centre Tests", () => {
  it("Scenario 1: Deterministic Store Aggregation produces valid non-zero portfolio metrics", async () => {
    const dummyRows = [
      {
        ts: new Date("2026-03-04T10:00:00Z"),
        kW: 1000,
        kVAr: 200,
        kVA: 1020,
        pf: 0.98,
        tou: "peak" as const,
      },
    ];
    const totals = computeTotals(dummyRows, 85740);
    const charges = computeCharges(totals, 85740, dummyRows);
    const calculatedTotal = charges.find((c) => c.label === "Total Charges")?.amount || 0;

    const data = await DashboardService.getAggregatedDashboardData(
      { severity: "all", status: "all" },
      {
        invoice: SAMPLE_MARCH_2026_INVOICE,
        totals,
        charges,
        calculatedTotal,
        invoiceTotal: SAMPLE_MARCH_2026_INVOICE.invoiceTotal,
        customer: { name: "Impala Plat", meter: "7856504226", nmd: 85740 },
        rows: dummyRows,
        batchInvoices: [SAMPLE_MARCH_2026_INVOICE],
      },
    );

    expect(data.hasData).toBe(true);
    expect(data.portfolioSummary.totalInvoices).toBeGreaterThan(0);
    expect(data.portfolioSummary.totalBilledAmountZar).toBe(SAMPLE_MARCH_2026_INVOICE.invoiceTotal);
    expect(data.portfolioSummary.totalCalculatedAmountZar).toBeGreaterThan(0);
    expect(data.energyOverview.totalKWh).toBeGreaterThan(0);
  });

  it("Scenario 2: Distinguishes NO DATA from ZERO VALUE", () => {
    const emptyData = DashboardService.createEmptyDashboardData("2026-09-04T20:00:00Z");

    expect(emptyData.hasData).toBe(false);
    expect(emptyData.portfolioSummary.hasData).toBe(false);
    expect(emptyData.portfolioSummary.totalInvoices).toBe(0);
    expect(emptyData.portfolioSummary.totalBilledAmountZar).toBe(0);
    expect(emptyData.criticalAlerts.length).toBe(0);
  });

  it("Scenario 3: Portfolio Variance matches Billed minus Calculated", async () => {
    const data = await DashboardService.getAggregatedDashboardData(
      {},
      {
        invoice: SAMPLE_MARCH_2026_INVOICE,
        totals: {
          peakKWh: 100,
          standardKWh: 200,
          offPeakKWh: 300,
          totalKWh: 600,
          maxDemandKVA: 80000,
        },
        charges: [{ label: "Total Charges", group: "tax", amount: 10000000 }],
        calculatedTotal: 10000000,
        invoiceTotal: 10084000,
        customer: { name: "Test Cust", meter: "123", nmd: 85740 },
        rows: [],
        batchInvoices: [{ ...SAMPLE_MARCH_2026_INVOICE, invoiceTotal: 10084000 }],
      },
    );

    expect(data.portfolioSummary.totalBilledAmountZar).toBe(10084000);
    expect(data.portfolioSummary.totalCalculatedAmountZar).toBe(10000000);
    expect(data.portfolioSummary.totalVarianceZar).toBe(84000);
    expect(data.portfolioSummary.potentialRecoveryZar).toBe(84000);
  });

  it("Scenario 4: Actionable Alerts correctly generated for demand exceedance & overbilling", async () => {
    const data = await DashboardService.getAggregatedDashboardData(
      {},
      {
        invoice: SAMPLE_MARCH_2026_INVOICE,
        totals: {
          peakKWh: 100,
          standardKWh: 200,
          offPeakKWh: 300,
          totalKWh: 600,
          maxDemandKVA: 90000,
        },
        charges: [{ label: "Total Charges", group: "tax", amount: 10000000 }],
        calculatedTotal: 10000000,
        invoiceTotal: 10084000,
        customer: { name: "Test Cust", meter: "123", nmd: 85740 },
        rows: [{ ts: new Date(), kW: 100, kVA: 90000, estimated: true }],
        batchInvoices: [
          { ...SAMPLE_MARCH_2026_INVOICE, invoiceTotal: 10084000, maxDemandKVA: 90000 },
        ],
      },
    );

    const alertTypes = data.criticalAlerts.map((a) => a.type);
    expect(alertTypes).toContain("UNUSUAL_DEMAND");
    expect(alertTypes).toContain("TARIFF_MISMATCH");
    expect(alertTypes).toContain("MISSING_TELEMETRY");
  });

  it("Scenario 5: Multi-Tenant RLS isolation filters empty data when invalid org specified", async () => {
    const data = await DashboardService.getAggregatedDashboardData({
      organisationId: "00000000-0000-0000-0000-000000000000",
    });

    expect(data.hasData).toBe(false);
    expect(data.portfolioSummary.totalInvoices).toBe(0);
  });
});
