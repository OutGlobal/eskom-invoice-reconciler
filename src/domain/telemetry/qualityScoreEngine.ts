/**
 * Enterprise Telemetry Quality Score Engine
 * Eskom Management Platform — Precision Quality Audit Metrics
 */

import type { CanonicalTelemetryRecord, TelemetryQualityMetrics } from "./types";

export class TelemetryQualityScoreEngine {
  /**
   * Evaluates canonical interval records and calculates data quality score metrics
   */
  public static calculateQualityMetrics(
    records: CanonicalTelemetryRecord[],
    expectedIntervalCount?: number
  ): TelemetryQualityMetrics {
    const totalRecords = records.length;
    if (totalRecords === 0) {
      return {
        totalExpectedIntervals: 0,
        totalParsedIntervals: 0,
        validMeasuredCount: 0,
        duplicateCount: 0,
        estimatedCount: 0,
        suspectCount: 0,
        clockInconsistencyCount: 0,
        completenessPercent: 0,
        validityPercent: 0,
        duplicatePercent: 0,
        estimatedPercent: 0,
        clockConsistencyPercent: 100,
        overallQualityScore: 0,
      };
    }

    let validMeasuredCount = 0;
    let duplicateCount = 0;
    let estimatedCount = 0;
    let suspectCount = 0;
    let clockInconsistencyCount = 0;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];

      if (rec.quality_status === "measured" || rec.quality_status === "rollover") {
        validMeasuredCount++;
      } else if (rec.quality_status === "duplicate") {
        duplicateCount++;
      } else if (rec.quality_status === "estimated" || rec.quality_status === "interpolated") {
        estimatedCount++;
      } else if (rec.quality_status === "suspect") {
        suspectCount++;
      }

      // Check clock consistency
      if (i > 0) {
        const prevTime = new Date(records[i - 1].timestamp_utc).getTime();
        const currTime = new Date(rec.timestamp_utc).getTime();
        const intervalMs = rec.interval_minutes * 60 * 1000;

        if (currTime <= prevTime || (currTime - prevTime) !== intervalMs) {
          clockInconsistencyCount++;
        }
      }
    }

    const totalExpected = expectedIntervalCount || totalRecords;
    const completenessPercent = Number(
      (Math.min(100, ((validMeasuredCount + estimatedCount) / Math.max(1, totalExpected)) * 100)).toFixed(2)
    );
    const validityPercent = Number(
      (((totalRecords - suspectCount) / Math.max(1, totalRecords)) * 100).toFixed(2)
    );
    const duplicatePercent = Number(
      ((duplicateCount / Math.max(1, totalRecords)) * 100).toFixed(2)
    );
    const estimatedPercent = Number(
      ((estimatedCount / Math.max(1, totalRecords)) * 100).toFixed(2)
    );
    const clockConsistencyPercent = Number(
      (((totalRecords - clockInconsistencyCount) / Math.max(1, totalRecords)) * 100).toFixed(2)
    );

    // Weighted Overall Quality Score (0-100%)
    // Weights: Completeness (35%), Validity (35%), Clock Consistency (20%), Duplicate penalty (5%), Estimated penalty (5%)
    const rawScore =
      completenessPercent * 0.35 +
      validityPercent * 0.35 +
      clockConsistencyPercent * 0.20 +
      Math.max(0, 100 - duplicatePercent * 2) * 0.05 +
      Math.max(0, 100 - estimatedPercent) * 0.05;

    const overallQualityScore = Number(Math.max(0, Math.min(100, rawScore)).toFixed(2));

    return {
      totalExpectedIntervals: totalExpected,
      totalParsedIntervals: totalRecords,
      validMeasuredCount,
      duplicateCount,
      estimatedCount,
      suspectCount,
      clockInconsistencyCount,
      completenessPercent,
      validityPercent,
      duplicatePercent,
      estimatedPercent,
      clockConsistencyPercent,
      overallQualityScore,
    };
  }
}
