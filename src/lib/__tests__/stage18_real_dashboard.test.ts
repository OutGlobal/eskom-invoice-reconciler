import { describe, expect, it } from "vitest";
import { supabase } from "@/lib/supabase";
import { DashboardService } from "../../domain/dashboard/dashboardService";

describe("Stage 18 — Real Database-Driven Dashboard Command Centre", () => {
  it("Scenario 1: Live Database Sourcing — All Core Metrics Originate from Authoritative Persistent Tables", async () => {
    // Query authoritative database
    const liveData = await DashboardService.getAggregatedDashboardData({ source: "database" });

    expect(liveData.hasData).toBe(true);
    expect(liveData.isLiveDatabase).toBe(true);

    // 1. Total Invoices & Processed Invoices
    expect(liveData.portfolioSummary.totalInvoices).toBeGreaterThanOrEqual(1);
    expect(liveData.portfolioSummary.invoicesProcessed).toBeGreaterThanOrEqual(1);

    // 2. Sites & Accounts (real counts, no '|| 1' fallback)
    const { count: realSitesCount } = await supabase
      .from("sites")
      .select("id", { count: "exact", head: true });
    expect(liveData.portfolioSummary.totalSites).toBe(realSitesCount ?? 0);
    expect(liveData.portfolioSummary.totalAccounts).toBeGreaterThanOrEqual(1);

    // 3. Total Cost (Billed & Calculated)
    expect(liveData.portfolioSummary.totalBilledAmountZar).toBeGreaterThan(0);
    expect(liveData.portfolioSummary.totalCalculatedAmountZar).toBeGreaterThan(0);

    // 4. Variance
    expect(liveData.portfolioSummary.totalVarianceZar).toBe(
      liveData.portfolioSummary.totalBilledAmountZar -
        liveData.portfolioSummary.totalCalculatedAmountZar,
    );

    // 5. Total Energy & TOU Breakdown (kWh)
    expect(liveData.energyOverview.totalKWh).toBeGreaterThan(0);
    expect(liveData.energyOverview.peakKWh).toBeGreaterThan(0);
    expect(liveData.energyOverview.standardKWh).toBeGreaterThan(0);
    expect(liveData.energyOverview.offPeakKWh).toBeGreaterThan(0);

    // 6. Max Demand (kVA)
    expect(liveData.energyOverview.maxDemandKVA).toBeGreaterThan(0);

    // 7. Monthly Consumption (Chronological billing periods from database invoices)
    expect(liveData.monthlyConsumption.length).toBeGreaterThanOrEqual(1);
    const firstCycle = liveData.monthlyConsumption[0];
    expect(firstCycle.invoiceNumber).toBeDefined();
    expect(firstCycle.totalKWh).toBeGreaterThan(0);
    expect(firstCycle.invoicedTotalZar).toBeGreaterThan(0);
    expect(firstCycle.status).toBeDefined();

    // Verify chronological order
    for (let i = 1; i < liveData.monthlyConsumption.length; i++) {
      const prev = liveData.monthlyConsumption[i - 1].billingStart;
      const curr = liveData.monthlyConsumption[i].billingStart;
      if (prev && curr) {
        expect(new Date(prev).getTime()).toBeLessThanOrEqual(new Date(curr).getTime());
      }
    }
  });

  it("Scenario 2: Absence of Data — True Empty State With Zero Fake Zeroes", async () => {
    // Non-existent account query produces explicit empty state
    const emptyData = await DashboardService.getAggregatedDashboardData({
      source: "database",
      accountNumber: "NON_EXISTENT_TEST_ACCOUNT_99999",
    });

    expect(emptyData.hasData).toBe(false);
    expect(emptyData.portfolioSummary.hasData).toBe(false);
    expect(emptyData.energyOverview.hasData).toBe(false);
    expect(emptyData.reconciliationHealth.hasData).toBe(false);
    expect(emptyData.financialRecovery.hasData).toBe(false);

    // Monthly consumption is empty array, not fake sample rows
    expect(emptyData.monthlyConsumption).toEqual([]);
    expect(emptyData.criticalAlerts).toEqual([]);

    // Optional / unmeasured values are null (not fake zeroes)
    expect(emptyData.energyOverview.averagePowerFactor).toBeNull();
    expect(emptyData.energyOverview.maxDemandKVA).toBeNull();
    expect(emptyData.energyOverview.reactiveEnergyKVARh).toBeNull();
  });

  it("Scenario 3: Zero-Fake Policy — Elimination of Hardcoded Sample Values & Constants", async () => {
    // Query database data
    const liveData = await DashboardService.getAggregatedDashboardData({ source: "database" });

    // 1. Average audit processing time must NOT be fake 145 ms if no run execution logs exist
    const { data: runs } = await supabase.from("reconciliation_runs").select("id");
    if (!runs || runs.length === 0) {
      expect(liveData.reconciliationHealth.averageProcessingTimeMs).toBeNull();
      expect(liveData.reconciliationHealth.reconciliationSuccessRatePct).toBeNull();
    }

    // 2. Power factor must NOT be fake 0.96 if no reactive energy determinants exist
    if (!liveData.energyOverview.reactiveEnergyKVARh) {
      expect(liveData.energyOverview.averagePowerFactor).toBeNull();
    }
  });

  it("Scenario 4: Calculated Power Factor Precision When Physical Active/Reactive Determinants Exist", async () => {
    // Synthetic store test with known active/reactive power:
    // Active = 800,000 kWh, Reactive = 600,000 kVARh
    // Apparent = sqrt(800000^2 + 600000^2) = 1,000,000 kVAh
    // Power factor = 800000 / 1000000 = 0.80
    const activeKwh = 800000;
    const reactiveKvarh = 600000;

    const data = await DashboardService.getAggregatedDashboardData(
      { severity: "all", status: "all" },
      {
        invoice: {
          invoiceNumber: "INV-PF-TEST",
          accountNumber: "ACC-TEST",
          totalKWh: activeKwh,
          peakKWh: 200000,
          standardKWh: 400000,
          offPeakKWh: 200000,
          invoiceTotal: 1500000,
        },
        totals: {
          totalKWh: activeKwh,
          peakKWh: 200000,
          standardKWh: 400000,
          offPeakKWh: 200000,
          reactiveEnergyKVARh: reactiveKvarh,
          maxDemandKVA: 1500,
        },
        charges: [{ label: "Total Charges", group: "energy", amount: 1500000 }],
        calculatedTotal: 1500000,
        invoiceTotal: 1500000,
        customer: { name: "Power Factor Test Facility", meter: "M-001", nmd: 2000 },
        rows: [],
        batchInvoices: [],
      },
    );

    expect(data.hasData).toBe(true);
    expect(data.energyOverview.averagePowerFactor).toBe(0.8);
    expect(data.energyOverview.reactiveEnergyKVARh).toBe(reactiveKvarh);
    expect(data.energyOverview.maxDemandKVA).toBe(1500);
  });

  it("Scenario 5: Public Disclosure Governance (Level 3 Zero-Exposure)", async () => {
    const liveData = await DashboardService.getAggregatedDashboardData({ source: "database" });
    const serialized = JSON.stringify(liveData);

    // Private schemas must not leak into dashboard DTOs
    expect(serialized).not.toContain("public.invoices");
    expect(serialized).not.toContain("public.meter_readings");
    expect(serialized).not.toContain("public.telemetry_intervals");
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("bramhseicmakyihvnvpo.supabase.co");
  });
});
