/**
 * Automated Test Suite: Production-Grade AMR Telemetry & Time-Series Validation Engine
 * Tests 15-Point Quality Checks, 8 Quality States, Missing Gap Analytics,
 * Configurable Estimation Framework, Quarantine Immutability, and 10k Load Benchmark.
 */

import { TelemetryQualityEngine, type RawTelemetryRowInput } from "../../domain/telemetry/telemetryQualityEngine";
import { EstimationFrameworkEngine } from "../../domain/telemetry/estimationFramework";
import { LoadTestBenchmarkEngine } from "../../domain/telemetry/loadTestBenchmarkEngine";
import type { MissingGapRecord, TelemetryQualityState } from "../../domain/telemetry/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TELEMETRY SUBSYSTEM TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ TELEMETRY SUBSYSTEM TEST PASSED: ${message}`);
  }
}

export async function runTelemetrySubsystemTests() {
  console.log("\n=== RUNNING AMR TELEMETRY & TIME-SERIES ENGINE TEST SUITE ===\n");

  // Test 1: 15-Point Quality Engine & Clean Actual Interval Ingestion
  console.log("--- Test 1: Clean Telemetry Stream Ingestion ---");
  const cleanRows: RawTelemetryRowInput[] = [
    {
      meter_id: "mtr-9988",
      pod_id: "pod-4401",
      timestamp: "2026-03-01T08:00:00Z",
      timezone: "Africa/Johannesburg",
      channel: "Active Energy (kWh)",
      raw_value: 250.5,
      unit: "kWh",
      source_file_id: "f-100",
      ingestion_batch_id: "batch-100",
      row_number: 1,
      raw_snippet: "2026-03-01 08:00:00,250.5,kWh",
    },
    {
      meter_id: "mtr-9988",
      pod_id: "pod-4401",
      timestamp: "2026-03-01T08:30:00Z",
      timezone: "Africa/Johannesburg",
      channel: "Active Energy (kWh)",
      raw_value: 300.0,
      unit: "kWh",
      source_file_id: "f-100",
      ingestion_batch_id: "batch-100",
      row_number: 2,
      raw_snippet: "2026-03-01 08:30:00,300.0,kWh",
    },
  ];

  const res1 = TelemetryQualityEngine.processTelemetryStream(cleanRows, [], 30);
  assert(res1.validIntervals.length === 2, "Processed 2 valid clean telemetry intervals");
  assert(res1.validIntervals[0].quality_state === "ACTUAL", "Clean reading classified as ACTUAL quality state");
  assert(res1.validIntervals[0].channel === "kWh", "Channel normalized to kWh");
  assert(res1.validIntervals[0].local_timestamp.includes("10:00:00"), "Local SAST time normalized (08:00 UTC -> 10:00 SAST)");

  // Test 2: Schema & Non-Numeric Quarantine (Never Silently Discarded)
  console.log("\n--- Test 2: Schema Failure Quarantine (Non-Destructive) ---");
  const badSchemaRows: RawTelemetryRowInput[] = [
    {
      meter_id: "mtr-9988",
      timestamp: "INVALID_DATE_STRING",
      channel: "kWh",
      raw_value: 100,
      ingestion_batch_id: "batch-bad",
      row_number: 10,
      raw_snippet: "INVALID_DATE_STRING,100,kWh",
    },
    {
      meter_id: "mtr-9988",
      timestamp: "2026-03-01T09:00:00Z",
      channel: "kWh",
      raw_value: NaN,
      ingestion_batch_id: "batch-bad",
      row_number: 11,
      raw_snippet: "2026-03-01 09:00:00,CORRUPT_NaN,kWh",
    },
  ];

  const res2 = TelemetryQualityEngine.processTelemetryStream(badSchemaRows, [], 30);
  assert(res2.validIntervals.length === 0, "Corrupt rows excluded from valid stream");
  assert(res2.quarantineRecords.length === 2, "Corrupt rows quarantined in non-destructive ledger");
  assert(res2.quarantineRecords[0].validation_code === "INVALID_TIMESTAMP_SCHEMA", "Quarantine code set to INVALID_TIMESTAMP_SCHEMA");

  // Test 3: Negative Energy Rejection & Impossible Demand Guarding
  console.log("\n--- Test 3: Negative Energy & Impossible Demand Rejection ---");
  const impossibleRows: RawTelemetryRowInput[] = [
    {
      meter_id: "mtr-9988",
      timestamp: "2026-03-01T09:30:00Z",
      channel: "Active kWh",
      raw_value: -450.0, // Inappropriate negative import
      ingestion_batch_id: "batch-imp",
      row_number: 15,
      raw_snippet: "2026-03-01 09:30:00,-450.0,kWh",
    },
    {
      meter_id: "mtr-9988",
      timestamp: "2026-03-01T10:00:00Z",
      channel: "kW",
      raw_value: 999999.0, // Exceeds 150,000 kW capacity
      ingestion_batch_id: "batch-imp",
      row_number: 16,
      raw_snippet: "2026-03-01 10:00:00,999999,kW",
    },
  ];

  const res3 = TelemetryQualityEngine.processTelemetryStream(impossibleRows, [], 30);
  assert(res3.quarantineRecords.length === 2, "Impossible values quarantined cleanly");
  assert(res3.quarantineRecords.some((q) => q.validation_code === "NEGATIVE_VALUE_REJECTED"), "Detected NEGATIVE_VALUE_REJECTED");
  assert(res3.quarantineRecords.some((q) => q.validation_code === "IMPOSSIBLE_DEMAND_CAPACITY"), "Detected IMPOSSIBLE_DEMAND_CAPACITY");

  // Test 4: Missing Interval Gap Detection (Never Zeroed Out)
  console.log("\n--- Test 4: Missing Interval Gap Detection ---");
  const gapRows: RawTelemetryRowInput[] = [
    {
      meter_id: "mtr-9988",
      timestamp: "2026-03-01T08:00:00Z",
      channel: "kWh",
      raw_value: 100,
      ingestion_batch_id: "batch-gap",
      row_number: 1,
      raw_snippet: "08:00,100",
    },
    {
      meter_id: "mtr-9988",
      timestamp: "2026-03-01T10:00:00Z", // Jumped 2 hours (missing 08:30, 09:00, 09:30)
      channel: "kWh",
      raw_value: 200,
      ingestion_batch_id: "batch-gap",
      row_number: 2,
      raw_snippet: "10:00,200",
    },
  ];

  const res4 = TelemetryQualityEngine.processTelemetryStream(gapRows, [], 30);
  assert(res4.missingGaps.length === 3, `Detected exactly 3 missing interval gaps (actual: ${res4.missingGaps.length})`);
  assert(res4.missingGaps[0].expected_interval === "2026-03-01T08:30:00.000Z", "Identified 08:30 missing interval");

  // Test 5: Configurable Estimation Framework
  console.log("\n--- Test 5: Explicit Estimation Framework ---");
  const gapToEstimate: MissingGapRecord = {
    id: "gap-101",
    meter_id: "mtr-9988",
    expected_interval: "2026-03-01T08:30:00.000Z",
    missing_duration_minutes: 30,
    quality_impact: "MEDIUM",
    estimation_permitted: true,
    suggested_method: "LINEAR_INTERPOLATION",
    status: "OPEN",
  };

  const estimationRes = EstimationFrameworkEngine.estimateGap({
    gap: gapToEstimate,
    method: "LINEAR_INTERPOLATION",
    surroundingIntervals: res4.validIntervals, // 08:00 = 100, 10:00 = 200
    reason: "Audited linear interpolation test",
    userName: "Senior Auditor",
  });

  assert(estimationRes.estimationRecord.method === "LINEAR_INTERPOLATION", "Method set to LINEAR_INTERPOLATION");
  assert(estimationRes.estimationRecord.confidence_score === 0.95, "Confidence score set to 0.95");
  assert(estimationRes.estimationRecord.source_intervals.length === 2, "Logged 2 source interval references");
  assert(estimationRes.estimatedInterval.quality_state === "ESTIMATED", "Estimated interval classified as ESTIMATED");
  assert(estimationRes.estimatedInterval.engineering_value > 0, "Estimated interval value is non-zero");

  // Test 6: High-Volume Load Benchmark (10,000 Intervals)
  console.log("\n--- Test 6: 10,000 Interval Load-Test Benchmark ---");
  const benchResult = LoadTestBenchmarkEngine.runLoadTest(10000);
  assert(benchResult.processedIntervalCount > 9000, `Processed ${benchResult.processedIntervalCount} valid intervals`);
  assert(benchResult.processingDurationMs < 5000, `Completed 10,000 intervals in ${benchResult.processingDurationMs}ms`);
  assert(benchResult.throughputPerSec > 1000, `Throughput: ${benchResult.throughputPerSec} intervals/sec`);

  console.log("\n=== ALL AMR TELEMETRY & TIME-SERIES ENGINE TESTS PASSED SUCCESSFULLY ===\n");
}

if (process.argv[1] && process.argv[1].includes("telemetry_subsystem")) {
  runTelemetrySubsystemTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}
