/**
 * Database Performance Profiler & Large Dataset Query Benchmarker
 * Eskom Bill Balancer Platform — Stage 37
 *
 * Implements formal query performance measurement and verification
 * for all high-volume access patterns:
 * 1. Billing-Period Queries
 * 2. Timestamp Queries
 * 3. Account Queries
 * 4. Meter Queries
 * 5. Organisation Filters
 * 6. Reconciliation Queries
 */

import {
  DatabaseAccessPattern,
  QueryPerformanceMeasurement,
  DatabasePerformanceAuditReport,
} from "./types";

export interface QueryRunnerOptions<T = unknown> {
  name: string;
  pattern: DatabaseAccessPattern;
  indexTarget: string;
  slaThresholdMs: number;
  queryFn: () => Promise<T[] | { count?: number; data?: T[] }>;
}

export class DatabasePerformanceProfiler {
  /**
   * Executes a query under high-resolution timing to capture performance metrics.
   */
  public static async measureQuery<T = unknown>(
    options: QueryRunnerOptions<T>
  ): Promise<{
    result: T[] | { count?: number; data?: T[] };
    measurement: QueryPerformanceMeasurement;
  }> {
    const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const result = await options.queryFn();
    const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
    const durationMs = Math.round((endTime - startTime) * 100) / 100;

    let rowCount = 0;
    if (Array.isArray(result)) {
      rowCount = result.length;
    } else if (result && typeof result === "object") {
      if (typeof result.count === "number") {
        rowCount = result.count;
      } else if (Array.isArray(result.data)) {
        rowCount = result.data.length;
      }
    }

    const throughput = durationMs > 0 ? Math.round((rowCount / (durationMs / 1000)) * 10) / 10 : 0;
    const slaPassed = durationMs <= options.slaThresholdMs;

    const measurement: QueryPerformanceMeasurement = {
      queryName: options.name,
      accessPattern: options.pattern,
      executionDurationMs: durationMs,
      rowCount,
      throughputRowsPerSec: throughput,
      slaThresholdMs: options.slaThresholdMs,
      slaPassed,
      indexTarget: options.indexTarget,
      notes: slaPassed
        ? `Within SLA threshold (${durationMs}ms <= ${options.slaThresholdMs}ms)`
        : `EXCEEDED SLA threshold (${durationMs}ms > ${options.slaThresholdMs}ms). Verify index coverage: ${options.indexTarget}`,
    };

    return { result, measurement };
  }

  /**
   * Generates a comprehensive audit report from an array of query measurements.
   */
  public static buildAuditReport(
    measurements: QueryPerformanceMeasurement[]
  ): DatabasePerformanceAuditReport {
    const total = measurements.length;
    if (total === 0) {
      return {
        timestamp: new Date().toISOString(),
        totalQueriesMeasured: 0,
        slaPassedCount: 0,
        slaFailedCount: 0,
        overallCompliancePct: 100,
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        maxLatencyMs: 0,
        measurements: [],
        recommendations: ["No queries were evaluated during this benchmark cycle."],
      };
    }

    const passed = measurements.filter((m) => m.slaPassed).length;
    const failed = total - passed;
    const compliancePct = Math.round((passed / total) * 1000) / 10;

    const latencies = measurements.map((m) => m.executionDurationMs).sort((a, b) => a - b);
    const avgLatency = Math.round((latencies.reduce((sum, val) => sum + val, 0) / total) * 100) / 100;
    const p95Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
    const p95Latency = latencies[p95Index];
    const maxLatency = latencies[latencies.length - 1];

    const recommendations: string[] = [];
    if (compliancePct < 100) {
      const slowQueries = measurements.filter((m) => !m.slaPassed);
      slowQueries.forEach((q) => {
        recommendations.push(
          `Optimize query [${q.queryName}] on pattern [${q.accessPattern}]. Current latency: ${q.executionDurationMs}ms (SLA: ${q.slaThresholdMs}ms). Target index: ${q.indexTarget || "None"}.`
        );
      });
    } else {
      recommendations.push("All query access patterns pass strict latency SLAs with optimal index utilization.");
    }

    return {
      timestamp: new Date().toISOString(),
      totalQueriesMeasured: total,
      slaPassedCount: passed,
      slaFailedCount: failed,
      overallCompliancePct: compliancePct,
      averageLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      maxLatencyMs: maxLatency,
      measurements,
      recommendations,
    };
  }

  /**
   * Validates access pattern checklist to ensure no indexes are added blindly.
   */
  public static validateAccessPatternIndex(
    pattern: DatabaseAccessPattern,
    indexColumns: string[],
    volumeCardinality: "HIGH" | "MEDIUM" | "LOW"
  ): { isValid: boolean; reason: string } {
    if (indexColumns.length === 0) {
      return { isValid: false, reason: "Index columns cannot be empty." };
    }

    if (volumeCardinality === "LOW" && indexColumns.length === 1) {
      return {
        isValid: false,
        reason: "Avoid blind single-column indexes on low-cardinality columns. Use composite indexes with high selectivity leading columns.",
      };
    }

    switch (pattern) {
      case "BILLING_PERIOD":
        if (!indexColumns.some((col) => col.includes("billing_") || col.includes("period"))) {
          return { isValid: false, reason: "Billing-period pattern index must include temporal bounds." };
        }
        break;
      case "TIMESTAMP":
        if (!indexColumns.some((col) => col.includes("timestamp") || col.includes("created_at"))) {
          return { isValid: false, reason: "Timestamp pattern index must include timestamp order." };
        }
        break;
      case "ORGANISATION_FILTER":
        if (indexColumns[0] !== "organisation_id") {
          return { isValid: false, reason: "Organisation filter index must have organisation_id as leading column for multi-tenant RLS." };
        }
        break;
      case "ACCOUNT":
        if (!indexColumns.some((col) => col.includes("account") || col.includes("customer"))) {
          return { isValid: false, reason: "Account pattern index must include account reference." };
        }
        break;
      case "METER":
        if (!indexColumns.some((col) => col.includes("meter"))) {
          return { isValid: false, reason: "Meter pattern index must include meter identifier." };
        }
        break;
      case "RECONCILIATION":
        if (!indexColumns.some((col) => col.includes("reconciliation") || col.includes("invoice"))) {
          return { isValid: false, reason: "Reconciliation pattern index must include reconciliation or invoice reference." };
        }
        break;
    }

    return { isValid: true, reason: "Index configuration adheres to access pattern selectivity standards." };
  }
}
