/**
 * High-Volume Telemetry Synthetic Stream Generator & Load-Test Benchmark Suite
 * Benchmarks 10,000, 100,000, and 1,000,000 interval stream ingestion & validation throughput.
 */

import { TelemetryQualityEngine, type RawTelemetryRowInput } from "./telemetryQualityEngine";
import type { TelemetryQualitySummary } from "./types";
import { TelemetryStorageService } from "./telemetryStorageService";

export interface LoadTestResult {
  targetIntervalCount: number;
  processedIntervalCount: number;
  quarantinedCount: number;
  missingGapsCount: number;
  processingDurationMs: number;
  throughputPerSec: number;
  qualitySummary: TelemetryQualitySummary;
}

export class LoadTestBenchmarkEngine {
  /**
   * Synthesize a high-volume telemetry row stream with realistic load profiles,
   * artificial gaps (0.1%), outliers (0.05%), and negative values (0.02%).
   */
  public static generateSyntheticStream(
    count: number,
    meterId: string = "mtr-megaflex-9988",
    batchId: string = `batch-loadtest-${Date.now()}`,
  ): RawTelemetryRowInput[] {
    const rows: RawTelemetryRowInput[] = new Array(count);
    const startMs = new Date("2026-01-01T00:00:00Z").getTime();
    const intervalMs = 30 * 60 * 1000; // 30-minute intervals

    for (let i = 0; i < count; i++) {
      let timestampMs = startMs + i * intervalMs;

      // Introduce occasional artificial gap (skip timestamp)
      if (i > 0 && i % 1000 === 0) {
        timestampMs += intervalMs * 2; // Jump 1 hour to create missing interval
      }

      let rawVal = 100 + Math.sin(i / 10) * 40 + Math.random() * 10;

      // Introduce artificial outlier
      if (i % 2000 === 0) {
        rawVal = 999999;
      }

      // Introduce artificial negative value
      if (i % 5000 === 0) {
        rawVal = -50;
      }

      rows[i] = {
        meter_id: meterId,
        pod_id: "pod-coj-main-4401",
        timestamp: new Date(timestampMs).toISOString(),
        timezone: "Africa/Johannesburg",
        channel: i % 3 === 0 ? "kWh" : i % 3 === 1 ? "kVARh" : "kVA",
        raw_value: Number(rawVal.toFixed(2)),
        unit: "kWh",
        source_file_id: "src-loadtest-sim",
        ingestion_batch_id: batchId,
        row_number: i + 1,
        raw_snippet: `ROW-${i + 1}: ${new Date(timestampMs).toISOString()},${rawVal.toFixed(2)},kWh`,
      };
    }

    return rows;
  }

  /**
   * Run benchmark suite for target interval volume (10k, 100k, or 1M)
   */
  public static runLoadTest(count: number): LoadTestResult {
    const batchId = `batch-benchmark-${count}-${Date.now()}`;
    const syntheticStream = this.generateSyntheticStream(count, "mtr-megaflex-9988", batchId);

    const startTime = performance.now();

    // Process through 15-Point Telemetry Quality Engine
    const { validIntervals, quarantineRecords, missingGaps } =
      TelemetryQualityEngine.processTelemetryStream(syntheticStream, [], 30);

    const endTime = performance.now();
    const durationMs = Math.max(1, Math.round(endTime - startTime));
    const throughputPerSec = Math.round((count / durationMs) * 1000);

    const summary = TelemetryStorageService.computeSummary(
      validIntervals,
      quarantineRecords,
      missingGaps,
    );

    return {
      targetIntervalCount: count,
      processedIntervalCount: validIntervals.length,
      quarantinedCount: quarantineRecords.length,
      missingGapsCount: missingGaps.length,
      processingDurationMs: durationMs,
      throughputPerSec,
      qualitySummary: summary,
    };
  }
}
