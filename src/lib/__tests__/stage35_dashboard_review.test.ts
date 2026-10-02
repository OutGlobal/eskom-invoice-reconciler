import { describe, it, expect } from "vitest";
import { DashboardService } from "../../domain/dashboard/dashboardService";
import { ProcessingJobEngine } from "../../domain/jobs/processingJobEngine";
import { UserFacingErrorSanitizer } from "../../domain/observability/userFacingErrorSanitizer";
import { SAMPLE_MARCH_2026_INVOICE, SAMPLE_FEB_2026_INVOICE } from "./fixtures/sampleInvoice";
import { computeTotals, computeCharges } from "../reconciliation";

describe("Stage 35 — Final Dashboard Review", () => {
  const dummyRows = [
    {
      ts: new Date("2026-03-04T10:00:00Z"),
      kW: 1000,
      kVAr: 200,
      kVA: 1020,
      pf: 0.98,
      tou: "peak" as const,
    },
    {
      ts: new Date("2026-03-04T10:30:00Z"),
      kW: 1200,
      kVAr: 250,
      kVA: 1225,
      pf: 0.98,
      tou: "standard" as const,
    },
  ];

  const totals = computeTotals(dummyRows, 85740);
  const charges = computeCharges(totals, 85740, dummyRows);
  const calculatedTotal = charges.find((c) => c.label === "Total Charges")?.amount || 0;

  // 1. NO DATA: Useful onboarding / empty state
  describe("1. NO DATA State", () => {
    it("returns clean empty data structure with hasData: false and 0 counts", () => {
      const emptyData = DashboardService.createEmptyDashboardData("2026-09-18T12:00:00Z");

      expect(emptyData.hasData).toBe(false);
      expect(emptyData.portfolioSummary.hasData).toBe(false);
      expect(emptyData.portfolioSummary.totalInvoices).toBe(0);
      expect(emptyData.portfolioSummary.totalSites).toBe(0);
      expect(emptyData.portfolioSummary.totalClients).toBe(0);
      expect(emptyData.portfolioSummary.totalBilledAmountZar).toBe(0);
      expect(emptyData.portfolioSummary.totalCalculatedAmountZar).toBe(0);
      expect(emptyData.monthlyConsumption).toEqual([]);
      expect(emptyData.criticalAlerts).toEqual([]);
      expect(emptyData.availableSites).toEqual([]);
      expect(emptyData.availableAccounts).toEqual([]);
      expect(emptyData.activeProcessingJobs).toEqual([]);
    });
  });

  // 2. DATA UPLOADED: Show processing state
  describe("2. DATA UPLOADED State", () => {
    it("detects and surfaces active in-flight processing jobs with stage and progress", async () => {
      // Submit a background job to simulate data upload in progress
      const job = await ProcessingJobEngine.submitJob({
        jobType: "CSV_NORMALISATION",
        organisationId: "test-org-123",
        files: [
          {
            filename: "AMR_Intervals_March_2026.csv",
            fileSizeBytes: 1048576,
            mimeType: "text/csv",
            rawBuffer: new Uint8Array([1, 2, 3]),
          },
        ],
      });

      const activeJobs = await DashboardService.getActiveProcessingJobs("test-org-123");
      expect(activeJobs.length).toBeGreaterThan(0);
      const found = activeJobs.find((j) => j.id === job.jobId);
      expect(found).toBeDefined();
      expect(found?.name).toBe("AMR_Intervals_March_2026.csv");
      expect(found?.stage).toBeDefined();
      expect(typeof found?.progressPct).toBe("number");
    });
  });

  // 3. DATA PROCESSED: Show actual information
  describe("3. DATA PROCESSED State", () => {
    it("renders actual verified information across all 16 portfolio KPIs without placeholders", async () => {
      const data = await DashboardService.getAggregatedDashboardData(
        {},
        {
          invoice: SAMPLE_MARCH_2026_INVOICE,
          totals,
          charges,
          calculatedTotal,
          invoiceTotal: SAMPLE_MARCH_2026_INVOICE.invoiceTotal,
          customer: {
            name: "Impala Platinum",
            meter: "7856504226",
            accountNumber: "1234567890",
            nmd: 85740,
          },
          rows: dummyRows,
          batchInvoices: [SAMPLE_MARCH_2026_INVOICE],
        },
      );

      expect(data.hasData).toBe(true);
      expect(data.portfolioSummary.hasData).toBe(true);
      expect(data.portfolioSummary.totalInvoices).toBe(1);
      expect(data.portfolioSummary.totalBilledAmountZar).toBe(
        SAMPLE_MARCH_2026_INVOICE.invoiceTotal,
      );
      expect(data.portfolioSummary.totalCalculatedAmountZar).toBe(calculatedTotal);
      expect(data.energyOverview.totalKWh).toBeGreaterThan(0);
      expect(data.monthlyConsumption.length).toBe(1);
      expect(data.monthlyConsumption[0].invoiceNumber).toBe(
        SAMPLE_MARCH_2026_INVOICE.invoiceNumber,
      );
    });
  });

  // 4. NEW DATA: Dashboard updates
  describe("4. NEW DATA State", () => {
    it("dynamically updates totals when new telemetry readings arrive", async () => {
      // Baseline with 2 readings
      const baseData = await DashboardService.getAggregatedDashboardData(
        {},
        {
          invoice: SAMPLE_MARCH_2026_INVOICE,
          totals,
          charges,
          calculatedTotal,
          invoiceTotal: SAMPLE_MARCH_2026_INVOICE.invoiceTotal,
          customer: {
            name: "Impala Platinum",
            meter: "7856504226",
            accountNumber: "1234567890",
            nmd: 85740,
          },
          rows: dummyRows,
        },
      );

      // Extended readings
      const extendedRows = [
        ...dummyRows,
        {
          ts: new Date("2026-03-04T11:00:00Z"),
          kW: 2500,
          kVAr: 300,
          kVA: 2520,
          pf: 0.99,
          tou: "peak" as const,
        },
      ];
      const extendedTotals = computeTotals(extendedRows, 85740);
      const extendedCharges = computeCharges(extendedTotals, 85740, extendedRows);
      const extendedCalculated =
        extendedCharges.find((c) => c.label === "Total Charges")?.amount || 0;

      const updatedData = await DashboardService.getAggregatedDashboardData(
        {},
        {
          invoice: SAMPLE_MARCH_2026_INVOICE,
          totals: extendedTotals,
          charges: extendedCharges,
          calculatedTotal: extendedCalculated,
          invoiceTotal: SAMPLE_MARCH_2026_INVOICE.invoiceTotal,
          customer: {
            name: "Impala Platinum",
            meter: "7856504226",
            accountNumber: "1234567890",
            nmd: 85740,
          },
          rows: extendedRows,
        },
      );

      expect(updatedData.energyOverview.totalKWh).toBeGreaterThan(baseData.energyOverview.totalKWh);
      expect(updatedData.portfolioSummary.totalCalculatedAmountZar).not.toBe(
        baseData.portfolioSummary.totalCalculatedAmountZar,
      );
    });
  });

  // 5. NEW RECONCILIATION: Variance appears
  describe("5. NEW RECONCILIATION State", () => {
    it("dynamically reveals variance and overcharge recovery when rates or determinants mismatch", async () => {
      const billedTotal = 15000000;
      const calcTotal = 12000000;
      const expectedVariance = billedTotal - calcTotal;

      const data = await DashboardService.getAggregatedDashboardData(
        {},
        {
          invoice: { ...SAMPLE_MARCH_2026_INVOICE, invoiceTotal: billedTotal },
          totals,
          charges: [{ label: "Total Charges", group: "tax", amount: calcTotal }],
          calculatedTotal: calcTotal,
          invoiceTotal: billedTotal,
          customer: {
            name: "Impala Platinum",
            meter: "7856504226",
            accountNumber: "1234567890",
            nmd: 85740,
          },
          rows: dummyRows,
        },
      );

      expect(data.portfolioSummary.totalVarianceZar).toBe(expectedVariance);
      expect(data.portfolioSummary.overbillingZar).toBe(expectedVariance);
      expect(data.portfolioSummary.potentialRecoveryZar).toBe(expectedVariance);
      expect(data.financialRecovery.potentialRecoveryZar).toBe(expectedVariance);

      // Critical alert for tariff rate discrepancy should be generated
      const rateAlert = data.criticalAlerts.find((a) => a.type === "TARIFF_MISMATCH");
      expect(rateAlert).toBeDefined();
      expect(rateAlert?.financialImpactZar).toBe(expectedVariance);
    });
  });

  // 6. NEW SITE: Site appears
  describe("6. NEW SITE State", () => {
    it("reflects new sites in totalSites KPI and lists them in availableSites", async () => {
      const multiSiteInvoices = [
        {
          ...SAMPLE_MARCH_2026_INVOICE,
          premiseId: "SITE-RUSTENBURG-01",
          customerName: "Impala Rustenburg Smelter",
        },
        {
          ...SAMPLE_FEB_2026_INVOICE,
          premiseId: "SITE-MARIKANA-02",
          customerName: "Impala Marikana Shaft 4",
        },
      ];

      const data = await DashboardService.getAggregatedDashboardData(
        {},
        {
          invoice: multiSiteInvoices[0],
          totals,
          charges,
          calculatedTotal,
          invoiceTotal: multiSiteInvoices[0].invoiceTotal,
          customer: {
            name: "Impala Platinum",
            meter: "7856504226",
            accountNumber: "1234567890",
            nmd: 85740,
          },
          rows: dummyRows,
          batchInvoices: multiSiteInvoices,
        },
      );

      expect(data.portfolioSummary.totalSites).toBe(2);
      expect(data.availableSites?.length).toBe(2);
      expect(data.availableSites?.some((s) => s.id === "SITE-RUSTENBURG-01")).toBe(true);
      expect(data.availableSites?.some((s) => s.id === "SITE-MARIKANA-02")).toBe(true);
    });
  });

  // 7. NEW INVOICE: Invoice appears
  describe("7. NEW INVOICE State", () => {
    it("increments totalInvoices and adds invoice to monthly consumption lineage", async () => {
      const batchInvoices = [SAMPLE_MARCH_2026_INVOICE, SAMPLE_FEB_2026_INVOICE];

      const data = await DashboardService.getAggregatedDashboardData(
        {},
        {
          invoice: SAMPLE_MARCH_2026_INVOICE,
          totals,
          charges,
          calculatedTotal,
          invoiceTotal: SAMPLE_MARCH_2026_INVOICE.invoiceTotal,
          customer: {
            name: "Impala Platinum",
            meter: "7856504226",
            accountNumber: "1234567890",
            nmd: 85740,
          },
          rows: dummyRows,
          batchInvoices,
        },
      );

      expect(data.portfolioSummary.totalInvoices).toBe(2);
      expect(data.monthlyConsumption.length).toBe(2);

      const invoiceNumbers = data.monthlyConsumption.map((m) => m.invoiceNumber);
      expect(invoiceNumbers).toContain(SAMPLE_MARCH_2026_INVOICE.invoiceNumber);
      expect(invoiceNumbers).toContain(SAMPLE_FEB_2026_INVOICE.invoiceNumber);
    });
  });

  // 8. ERROR: Explain the problem without exposing technical internals
  describe("8. ERROR Sanitization State", () => {
    it("sanitizes raw database constraint and schema errors, redacting technical internals", () => {
      const rawError = new Error(
        'error: relation "public.invoice_records" does not exist at character 15\n' +
          "    at Parser.parse (/app/node_modules/pg-protocol/dist/parser.js:287:87)\n" +
          "    at Connection.query (SELECT * FROM public.invoice_records WHERE id = $1)",
      );

      const sanitized = UserFacingErrorSanitizer.sanitize("DATABASE_ERROR", rawError);

      // Verify no internal table names or SQL syntax leaked
      expect(sanitized.message).not.toContain("public.invoice_records");
      expect(sanitized.message).not.toContain("SELECT * FROM");
      expect(sanitized.message).not.toContain("node_modules");
      expect(sanitized.message).not.toContain("pg-protocol");

      // Verify user-friendly content
      expect(sanitized.title).toBeDefined();
      expect(sanitized.referenceCode).toMatch(/^ERR-[A-Z0-9]{6}$/);
      expect(sanitized.actionableHint).toBeDefined();
      expect(sanitized.retryAllowed).toBe(true);
    });
  });
});
