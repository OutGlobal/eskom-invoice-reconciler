/**
 * Stage 17 — Large Dataset Ingestion, Query & Aggregation Test Suite
 * Eskom Bill Balancer Platform
 *
 * Verifies:
 * 1. Small Invoice: Standard single-meter monthly invoice
 * 2. Medium CSV: 1 month of 30-min intervals (1,488 rows)
 * 3. Large CSV: Multi-month intervals (10,000+ rows) via memory-bounded batching
 * 4. Large Interval Dataset: Full year of 15-min intervals (35,040 rows)
 * 5. Large Excel Workbook: Multi-sheet .xlsx OpenXML workbook (3,000 rows)
 * 6. Server-Side Pagination & Cursor Keyset Navigation (preventing browser memory crash)
 * 7. Server-Side Filtering (dates, meter IDs, TOU, quality states)
 * 8. Dashboard Chart Aggregation (<= 300 points, < 50 KB payload for 35,040 intervals)
 * 9. Tenant Isolation & Level 3 Public Disclosure Zero-Exposure Compliance
 */

import { describe, it, expect, beforeEach } from "vitest";
import { LargeDatasetFixtures } from "../../domain/telemetry/largeDatasetFixtures";
import { LargeDatasetQueryEngine } from "../../domain/telemetry/largeDatasetQueryEngine";
import { AmrIntervalIngestionEngine } from "../../domain/telemetry/amrIntervalIngestionEngine";
import { DashboardService } from "../../domain/dashboard/dashboardService";
import { TenantIsolationViolationError } from "../../domain/security/tenantContextService";
import type { UserSecurityContext } from "../../domain/security/types";

describe("Stage 17 — Large Datasets Engine", () => {
  const TENANT_A = "11111111-1111-1111-1111-111111111111";
  const TENANT_B = "22222222-2222-2222-2222-222222222222";

  const USER_A: UserSecurityContext = {
    userId: "usr-a",
    email: "manager@tenant-a.com",
    organisationId: TENANT_A,
    role: "ENERGY_MANAGER",
    permissions: ["PERM_VIEW_DATA", "PERM_RUN_RECONCILIATION"],
  };

  beforeEach(() => {
    LargeDatasetQueryEngine.clearDatasetCache();
  });

  describe("1. Small Invoice Processing", () => {
    it("should generate and parse a realistic Eskom Megaflex monthly invoice", () => {
      const invoice = LargeDatasetFixtures.generateSmallInvoice();

      expect(invoice.filename).toBe("Eskom_Invoice_Jan2025.pdf");
      expect(invoice.pdfBytes.length).toBeGreaterThan(100);
      expect(invoice.accountNumber).toBe("7856504676");
      expect(invoice.meterNumber).toBe("MTR-ESKOM-001");
      expect(invoice.peakKwh).toBe(45000);
      expect(invoice.standardKwh).toBe(65000);
      expect(invoice.offPeakKwh).toBe(90000);
      expect(invoice.totalKwh).toBe(200000);
      expect(invoice.billedMaximumDemandKva).toBe(450);
      expect(invoice.totalInvoiceZar).toBe(3542000.0);

      // Verify that the PDF contains valid PDF signature
      const rawText = new TextDecoder().decode(invoice.pdfBytes);
      expect(rawText).toContain("%PDF-1.5");
      expect(rawText).toContain("Account Number: 7856504676");
      expect(rawText).toContain("%%EOF");
    });
  });

  describe("2. Medium CSV Ingestion (1 Month, 1,488 Rows)", () => {
    it("should ingest 1 month of 30-minute intervals through the AMR ingestion engine", async () => {
      const mediumCsv = LargeDatasetFixtures.generateMediumCsv(1488, "MTR-ESKOM-001");

      expect(mediumCsv.recordsCount).toBe(1488);
      expect(mediumCsv.bytes.length).toBeGreaterThan(50000); // > 50 KB

      const result = await AmrIntervalIngestionEngine.processIntervalFile({
        fileBuffer: mediumCsv.bytes,
        filename: mediumCsv.filename,
        meterIdOverride: "MTR-ESKOM-001",
      });

      expect(result.success).toBe(true);
      expect(result.intervals.length).toBe(1488);
      expect(result.summary.detectedDurationMinutes).toBe(30);
      expect(result.summary.intervals.totalParsed).toBe(1488);
      expect(result.errors.length).toBe(0);
    });
  });

  describe("3. Large CSV Ingestion (10,000 Rows) via Streaming Batch Chunker", () => {
    it("should process 10,000 records using memory-bounded batching without thread starvation", async () => {
      const largeCsv = LargeDatasetFixtures.generateLargeCsv(10000, "MTR-ESKOM-001");
      expect(largeCsv.recordsCount).toBe(10000);

      // Split raw CSV lines
      const rawLines = largeCsv.csvContent.trim().split("\n");
      const header = rawLines[0];
      const dataRows = rawLines.slice(1);

      expect(dataRows.length).toBe(10000);

      const progressSnapshots: number[] = [];

      // Memory-bounded streaming batch processor with chunk size = 2000
      const batchResult = await LargeDatasetQueryEngine.streamBatchProcessor(
        dataRows,
        async (batch, batchIndex) => {
          // Parse batch deterministically
          return batch.map((row) => {
            const [timestamp, meter_id, kwh, kvarh, kva, pf] = row.split(",");
            return {
              timestamp,
              meter_id,
              kwh: parseFloat(kwh),
              kvarh: parseFloat(kvarh),
              kva: parseFloat(kva),
              pf: parseFloat(pf),
            };
          });
        },
        {
          batchSize: 2000,
          onProgress: (processed, total, pct) => {
            progressSnapshots.push(pct);
          },
        },
      );

      expect(batchResult.totalProcessed).toBe(10000);
      expect(batchResult.batchesCount).toBe(5); // 10000 / 2000 = 5 batches
      expect(batchResult.results.length).toBe(10000);
      expect(progressSnapshots).toEqual([20, 40, 60, 80, 100]);
      expect(batchResult.throughputRowsPerSec).toBeGreaterThan(1000);
    });
  });

  describe("4. Large Interval Dataset (Full Year, 35,040 Rows)", () => {
    it("should generate and register 35,040 15-min intervals covering an entire year", () => {
      const dataset = LargeDatasetFixtures.generateLargeIntervalDataset(35040, "MTR-ESKOM-001", TENANT_A);

      expect(dataset.recordsCount).toBe(35040);
      expect(dataset.records.length).toBe(35040);
      expect(dataset.startDate).toBe("2025-01-01T00:00:00.000Z");

      // Verify that TOU periods are assigned
      const sample = dataset.records[100];
      expect(sample.unit).toBe("kWh");
      expect(sample.tou_period).toBeDefined();
      expect(sample.power_factor).toBe(0.96);
    });
  });

  describe("5. Large Excel Workbook Ingestion (3,000 Rows, Multi-Sheet .xlsx)", () => {
    it("should parse an OpenXML workbook with intervals and metadata sheets", async () => {
      const excel = LargeDatasetFixtures.generateLargeExcelWorkbook(3000, "MTR-ESKOM-001");

      expect(excel.rowsCount).toBe(3000);
      expect(excel.bytes.length).toBeGreaterThan(10000);

      const result = await AmrIntervalIngestionEngine.processIntervalFile({
        fileBuffer: excel.bytes,
        filename: excel.filename,
        meterIdOverride: "MTR-ESKOM-001",
      });

      expect(result.success).toBe(true);
      expect(result.intervals.length).toBe(3000);
      expect(result.summary.fileStructure?.sheetNames).toContain("Telemetry_Intervals");
      expect(result.summary.fileStructure?.sheetNames).toContain("Metadata");
      expect(result.summary.intervals.totalParsed).toBe(3000);
    });
  });

  describe("6. Server-Side Pagination & Keyset Navigation", () => {
    let dataset: ReturnType<typeof LargeDatasetFixtures.generateLargeIntervalDataset>;

    beforeEach(() => {
      dataset = LargeDatasetFixtures.generateLargeIntervalDataset(35040, "MTR-ESKOM-001", TENANT_A);
      LargeDatasetQueryEngine.registerDataset("ANNUAL_2025", dataset.records);
    });

    it("should slice 35,040 records into bounded pages without loading entire dataset to client", async () => {
      // Page 1 (first 50 items)
      const page1 = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001", sourceFileId: "ANNUAL_2025" },
        { page: 1, pageSize: 50 },
        dataset.records,
        USER_A,
      );

      expect(page1.items.length).toBe(50);
      expect(page1.totalCount).toBe(35040);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(50);
      expect(page1.totalPages).toBe(701); // ceil(35040 / 50) = 701
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPrevPage).toBe(false);
      expect(page1.nextCursor).toBeDefined();

      // Page 2 using page index
      const page2 = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001", sourceFileId: "ANNUAL_2025" },
        { page: 2, pageSize: 50 },
        dataset.records,
        USER_A,
      );

      expect(page2.items.length).toBe(50);
      expect(page2.items[0].id).toBe("INT-51");
      expect(page2.page).toBe(2);
      expect(page2.hasPrevPage).toBe(true);
      expect(page2.hasNextPage).toBe(true);

      // Keyset navigation using nextCursor from page 1
      const pageViaCursor = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001", sourceFileId: "ANNUAL_2025" },
        { cursor: page1.nextCursor, pageSize: 50 },
        dataset.records,
        USER_A,
      );

      expect(pageViaCursor.page).toBe(2);
      expect(pageViaCursor.items[0].id).toBe("INT-51");
    });

    it("should enforce maximum page size cap (<= 1000) to protect server memory", async () => {
      const response = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001" },
        { page: 1, pageSize: 5000 }, // User requests 5000
        dataset.records,
        USER_A,
      );

      // Clamped to 1000
      expect(response.pageSize).toBe(1000);
      expect(response.items.length).toBe(1000);
    });
  });

  describe("7. Server-Side Filtering", () => {
    let dataset: ReturnType<typeof LargeDatasetFixtures.generateLargeIntervalDataset>;

    beforeEach(() => {
      dataset = LargeDatasetFixtures.generateLargeIntervalDataset(35040, "MTR-ESKOM-001", TENANT_A);
    });

    it("should filter by exact date range server-side", async () => {
      // 1 full day = 96 15-minute intervals
      const result = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        {
          organisationId: TENANT_A,
          meterId: "MTR-ESKOM-001",
          startDate: "2025-01-01T00:00:00.000Z",
          endDate: "2025-01-01T23:59:59.999Z",
        },
        { page: 1, pageSize: 200 },
        dataset.records,
        USER_A,
      );

      expect(result.totalCount).toBe(96);
      expect(result.items.length).toBe(96);
    });

    it("should filter by TOU period server-side", async () => {
      const peakOnly = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        {
          organisationId: TENANT_A,
          meterId: "MTR-ESKOM-001",
          touPeriods: ["PEAK"],
        },
        { page: 1, pageSize: 500 },
        dataset.records,
        USER_A,
      );

      expect(peakOnly.totalCount).toBeGreaterThan(0);
      expect(
        peakOnly.items.every(
          (item) => String(item.tou_period).toUpperCase().replace(/_/g, "") === "PEAK",
        ),
      ).toBe(true);
    });

    it("should filter by active energy kWh threshold boundaries", async () => {
      const highConsumption = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        {
          organisationId: TENANT_A,
          meterId: "MTR-ESKOM-001",
          minKwh: 60,
        },
        { page: 1, pageSize: 500 },
        dataset.records,
        USER_A,
      );

      expect(highConsumption.items.every((item) => (item.kwh ?? 0) >= 60)).toBe(true);
    });
  });

  describe("8. Dashboard Chart Aggregation (Memory Protection & Downsampling)", () => {
    let dataset: ReturnType<typeof LargeDatasetFixtures.generateLargeIntervalDataset>;

    beforeEach(() => {
      dataset = LargeDatasetFixtures.generateLargeIntervalDataset(35040, "MTR-ESKOM-001", TENANT_A);
    });

    it("should aggregate 35,040 raw intervals into daily buckets bounded to <= 300 points and < 50 KB payload", async () => {
      const chartResponse = await LargeDatasetQueryEngine.aggregateIntervalsForCharts(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001" },
        "day",
        300, // max 300 points
        dataset.records,
        USER_A,
      );

      expect(chartResponse.cadence).toBe("day");
      expect(chartResponse.totalRawRecordsSampled).toBe(35040);
      expect(chartResponse.bucketCount).toBeLessThanOrEqual(300);
      expect(chartResponse.downsampled).toBe(true); // 365 daily buckets downsampled to <= 300

      // Verify exact active energy sum
      const expectedTotalKwh = dataset.records.reduce((sum, r) => sum + (r.kwh || 0), 0);
      expect(Math.abs(chartResponse.summary.totalActiveKwh - expectedTotalKwh)).toBeLessThan(1.0);

      // Verify Recharts plottable points
      expect(chartResponse.chartFormattedSeries.length).toBe(chartResponse.bucketCount);
      const firstPoint = chartResponse.chartFormattedSeries[0];
      expect(firstPoint.label).toBeDefined();
      expect(firstPoint.timestamp).toBeGreaterThan(0);
      expect(firstPoint.kW).toBeGreaterThan(0);
      expect(firstPoint.kVA).toBeGreaterThan(0);
      expect(firstPoint.kwh).toBeGreaterThan(0);
      expect(firstPoint.pf).toBeGreaterThan(0.9);
      expect(firstPoint.tou).toBeDefined();

      // CRITICAL: Verify JSON serialized payload size is strictly < 50 KB
      const jsonPayload = JSON.stringify(chartResponse);
      const payloadSizeBytes = new TextEncoder().encode(jsonPayload).length;
      const payloadSizeKb = payloadSizeBytes / 1024;

      expect(payloadSizeKb).toBeLessThan(50); // < 50 KB
    });

    it("should integrate with DashboardService.getAggregatedChartSeries", async () => {
      LargeDatasetQueryEngine.registerDataset("MTR-ESKOM-001", dataset.records);

      const chartData = await DashboardService.getAggregatedChartSeries(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001" },
        "month",
        12,
        USER_A,
      );

      expect(chartData.bucketCount).toBe(12); // 12 monthly buckets for 1 year
      expect(chartData.cadence).toBe("month");
      expect(chartData.summary.totalActiveKwh).toBeGreaterThan(1000000);
      expect(chartData.chartFormattedSeries.length).toBe(12);
    });
  });

  describe("9. Strict Tenant Isolation & Level 3 Zero-Exposure Verification", () => {
    it("should reject cross-tenant telemetry access with TenantIsolationViolationError", async () => {
      const dataset = LargeDatasetFixtures.generateLargeIntervalDataset(100, "MTR-ESKOM-001", TENANT_A);

      // User from Tenant A tries to access Tenant B
      await expect(
        LargeDatasetQueryEngine.queryPaginatedIntervals(
          { organisationId: TENANT_B, meterId: "MTR-ESKOM-001" },
          { page: 1, pageSize: 50 },
          dataset.records,
          USER_A,
        ),
      ).rejects.toThrow(TenantIsolationViolationError);
    });

    it("should never expose Level 3 private schemas or secrets in responses", async () => {
      const dataset = LargeDatasetFixtures.generateLargeIntervalDataset(100, "MTR-ESKOM-001", TENANT_A);

      const paginated = await LargeDatasetQueryEngine.queryPaginatedIntervals(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001" },
        { page: 1, pageSize: 50 },
        dataset.records,
        USER_A,
      );

      const aggregated = await LargeDatasetQueryEngine.aggregateIntervalsForCharts(
        { organisationId: TENANT_A, meterId: "MTR-ESKOM-001" },
        "day",
        300,
        dataset.records,
        USER_A,
      );

      const serializedPaginated = JSON.stringify(paginated);
      const serializedAggregated = JSON.stringify(aggregated);

      // Embargoed Stage 18 Level 3 strings
      const forbiddenStrings = [
        "public.invoices",
        "public.telemetry_intervals",
        "public.meter_readings",
        "SUPABASE_SERVICE_ROLE_KEY",
        "postgres://",
        "SELECT * FROM",
      ];

      for (const forbidden of forbiddenStrings) {
        expect(serializedPaginated).not.toContain(forbidden);
        expect(serializedAggregated).not.toContain(forbidden);
      }
    });
  });
});
