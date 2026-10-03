/**
 * RECONCILIATION ENGINE — REQUIREMENTS 8 & 9 TEST SUITE
 * ====================================================
 * Requirement 8: Data Coverage & Dynamic Interval Resolution
 * Requirement 9: AMR Data Validation & Non-Destructive Flagging
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import {
  DataCoverageEngine,
  AmrDataValidationEngine,
  RawTelemetryInterval,
} from "../../domain/reconciliation";

describe("Requirement 8: Data Coverage & Dynamic Interval Resolution", () => {
  it("should dynamically detect 30-minute interval resolution (48 intervals/day) and compute coverage", () => {
    const intervals: RawTelemetryInterval[] = [];
    const baseTime = new Date("2026-09-01T00:00:00Z").getTime();

    // Generate 30 days of 30-minute data = 1440 intervals
    for (let day = 0; day < 30; day++) {
      for (let slot = 0; slot < 48; slot++) {
        const ts = new Date(baseTime + (day * 48 + slot) * 30 * 60 * 1000).toISOString();
        intervals.push({
          timestampUtc: ts,
          kwh: 12.5,
          kva: 25.0,
        });
      }
    }

    const resolution = DataCoverageEngine.determineIntervalResolution(intervals);
    expect(resolution.intervalMinutes).toBe(30);
    expect(resolution.intervalsPerDay).toBe(48);

    const coverage = DataCoverageEngine.calculateCoverage({
      invoiceStartDate: "2026-09-01",
      invoiceEndDate: "2026-09-30",
      intervals,
    });

    expect(coverage.isComplete).toBe(true);
    expect(coverage.status).toBe("COMPLETE_COVERAGE");
    expect(coverage.metrics.expectedIntervals).toBe(1440);
    expect(coverage.metrics.actualIntervals).toBe(1440);
    expect(coverage.metrics.missingIntervals).toBe(0);
    expect(coverage.metrics.duplicateIntervals).toBe(0);
    expect(coverage.metrics.coveragePercentage.toNumber()).toBe(100);
  });

  it("should dynamically detect 15-minute interval resolution (96 intervals/day) without hard-coding", () => {
    const intervals: RawTelemetryInterval[] = [];
    const baseTime = new Date("2026-09-01T00:00:00Z").getTime();

    // Generate 30 days of 15-minute data = 2880 intervals
    for (let day = 0; day < 30; day++) {
      for (let slot = 0; slot < 96; slot++) {
        const ts = new Date(baseTime + (day * 96 + slot) * 15 * 60 * 1000).toISOString();
        intervals.push({
          timestampUtc: ts,
          kwh: 6.25,
          kva: 25.0,
        });
      }
    }

    const resolution = DataCoverageEngine.determineIntervalResolution(intervals);
    expect(resolution.intervalMinutes).toBe(15);
    expect(resolution.intervalsPerDay).toBe(96);

    const coverage = DataCoverageEngine.calculateCoverage({
      invoiceStartDate: "2026-09-01",
      invoiceEndDate: "2026-09-30",
      intervals,
    });

    expect(coverage.isComplete).toBe(true);
    expect(coverage.metrics.expectedIntervals).toBe(2880);
    expect(coverage.metrics.actualIntervals).toBe(2880);
    expect(coverage.metrics.missingIntervals).toBe(0);
    expect(coverage.metrics.coveragePercentage.toNumber()).toBe(100);
  });

  it("should dynamically detect 5-minute interval resolution (288 intervals/day)", () => {
    const intervals: RawTelemetryInterval[] = [];
    const baseTime = new Date("2026-09-01T00:00:00Z").getTime();

    // 1 day of 5-minute intervals = 288
    for (let slot = 0; slot < 288; slot++) {
      const ts = new Date(baseTime + slot * 5 * 60 * 1000).toISOString();
      intervals.push({
        timestampUtc: ts,
        kwh: 2.1,
      });
    }

    const resolution = DataCoverageEngine.determineIntervalResolution(intervals);
    expect(resolution.intervalMinutes).toBe(5);
    expect(resolution.intervalsPerDay).toBe(288);
  });

  it("should accurately compute missing intervals, duplicate intervals, and exact coverage percentage on partial data", () => {
    const intervals: RawTelemetryInterval[] = [];
    const baseTime = new Date("2026-09-01T00:00:00Z").getTime();

    // Generate only 27 days of 30-min data (missing 3 days: 28, 29, 30 Sep = 144 intervals missing)
    for (let day = 0; day < 27; day++) {
      for (let slot = 0; slot < 48; slot++) {
        const ts = new Date(baseTime + (day * 48 + slot) * 30 * 60 * 1000).toISOString();
        intervals.push({
          timestampUtc: ts,
          kwh: 10,
        });
      }
    }

    // Add 5 duplicate intervals
    for (let d = 0; d < 5; d++) {
      intervals.push(intervals[d]);
    }

    const coverage = DataCoverageEngine.calculateCoverage({
      invoiceStartDate: "2026-09-01",
      invoiceEndDate: "2026-09-30",
      intervals,
    });

    expect(coverage.isComplete).toBe(false);
    expect(coverage.status).toBe("INCOMPLETE_METER_DATA");
    expect(coverage.metrics.expectedIntervals).toBe(1440);
    expect(coverage.metrics.actualIntervals).toBe(1296); // 27 * 48
    expect(coverage.metrics.duplicateIntervals).toBe(5);
    expect(coverage.metrics.missingIntervals).toBe(144);
    expect(coverage.metrics.coveragePercentage.toNumber()).toBe(90.0);
    expect(coverage.gapAnalysis.hasBoundaryOverflow).toBe(true);
  });
});

describe("Requirement 9: AMR Data Validation & Non-Destructive Flagging", () => {
  it("should validate clean interval data and calculate aggregate energy and peak demand", () => {
    const intervals: RawTelemetryInterval[] = [
      { timestampUtc: "2026-09-01T00:30:00Z", kwh: 100, kva: 200, kvarh: 50 },
      { timestampUtc: "2026-09-01T01:00:00Z", kwh: 150, kva: 300, kvarh: 75 },
      { timestampUtc: "2026-09-01T01:30:00Z", kwh: 120, kva: 240, kvarh: 60 },
    ];

    const report = AmrDataValidationEngine.validateAndNormalizeAmrData(intervals, {
      meterSerialNumber: "MTR-2026-001",
    });

    expect(report.isValidForReconciliation).toBe(true);
    expect(report.criticalIssuesCount).toBe(0);
    expect(report.warningsCount).toBe(0);
    expect(report.summary.totalKwh.toNumber()).toBe(370);
    expect(report.summary.peakDemandKva.toNumber()).toBe(300);
    expect(report.summary.totalReactiveKvarh.toNumber()).toBe(185);
  });

  it("should flag inappropriate negative values on active import meter without discarding data", () => {
    const intervals: RawTelemetryInterval[] = [
      { timestampUtc: "2026-09-01T00:30:00Z", kwh: 100, kva: 200 },
      { timestampUtc: "2026-09-01T01:00:00Z", kwh: -45.5, kva: 100 }, // Inappropriate negative import
    ];

    const report = AmrDataValidationEngine.validateAndNormalizeAmrData(intervals, {
      isBiDirectionalSolar: false,
    });

    expect(report.isValidForReconciliation).toBe(false);
    expect(report.criticalIssuesCount).toBe(1);
    expect(report.anomalies[0].code).toBe("NEGATIVE_IMPORT_ENERGY");
    expect(report.normalizedIntervals.length).toBe(2); // Preserves interval data, non-destructive
  });

  it("should flag impossible demand/energy spikes exceeding physical rating", () => {
    const intervals: RawTelemetryInterval[] = [
      { timestampUtc: "2026-09-01T00:30:00Z", kwh: 50, kva: 100 },
      { timestampUtc: "2026-09-01T01:00:00Z", kwh: 50000, kva: 120000 }, // Impossible spike for 500 kVA transformer
    ];

    const report = AmrDataValidationEngine.validateAndNormalizeAmrData(intervals, {
      transformerCapacityKva: 500,
    });

    expect(report.isValidForReconciliation).toBe(false);
    const spikeCodes = report.anomalies.map((a) => a.code);
    expect(spikeCodes).toContain("IMPOSSIBLE_ENERGY_SPIKE");
    expect(spikeCodes).toContain("IMPOSSIBLE_DEMAND_SPIKE");
  });

  it("should detect cumulative register rollover and compute wrap-around delta", () => {
    const cumulativeIntervals: RawTelemetryInterval[] = [
      { timestampUtc: "2026-09-01T00:00:00Z", kwh: 999980 },
      { timestampUtc: "2026-09-01T00:30:00Z", kwh: 999995 }, // +15 kWh
      { timestampUtc: "2026-09-01T01:00:00Z", kwh: 10 }, // Rollover wrap past 1,000,000 -> +15 kWh
      { timestampUtc: "2026-09-01T01:30:00Z", kwh: 25 }, // +15 kWh
    ];

    const report = AmrDataValidationEngine.validateAndNormalizeAmrData(cumulativeIntervals);

    expect(report.readingFormat).toBe("CUMULATIVE_REGISTERS");
    expect(report.rolloverEventCount).toBe(1);
    expect(report.anomalies.some((a) => a.code === "METER_ROLLOVER_DETECTED")).toBe(true);

    // Verify delta on interval 2 (1:00) is 15 kWh
    const rolloverInterval = report.normalizedIntervals.find(
      (i) => i.timestampUtc === "2026-09-01T01:00:00.000Z",
    );
    expect(rolloverInterval?.kwh.toNumber()).toBe(15);
    expect(rolloverInterval?.isRolloverAdjusted).toBe(true);
  });

  it("should flag estimated/interpolated readings with non-destructive status annotations", () => {
    const intervals: RawTelemetryInterval[] = [
      { timestampUtc: "2026-09-01T00:30:00Z", kwh: 50, status: "ACTUAL" },
      { timestampUtc: "2026-09-01T01:00:00Z", kwh: 52, status: "ESTIMATED" },
      { timestampUtc: "2026-09-01T01:30:00Z", kwh: 51, status: "INTERPOLATED" },
    ];

    const report = AmrDataValidationEngine.validateAndNormalizeAmrData(intervals);

    expect(report.estimatedIntervalCount).toBe(2);
    expect(report.warningsCount).toBe(2);
    expect(report.anomalies.every((a) => a.severity === "WARNING")).toBe(true);
    expect(report.isValidForReconciliation).toBe(true); // Warnings do not hard-fail reconciliation, they flag for audit
  });

  it("should detect meter serial number change mid-dataset", () => {
    const intervals: RawTelemetryInterval[] = [
      { timestampUtc: "2026-09-01T00:30:00Z", kwh: 50, meterSerialNumber: "MTR-A-100" },
      { timestampUtc: "2026-09-01T01:00:00Z", kwh: 55, meterSerialNumber: "MTR-A-100" },
      { timestampUtc: "2026-09-01T01:30:00Z", kwh: 60, meterSerialNumber: "MTR-B-200" }, // Meter swapped
    ];

    const report = AmrDataValidationEngine.validateAndNormalizeAmrData(intervals);

    expect(report.meterChangeDetected).toBe(true);
    expect(report.anomalies.some((a) => a.code === "METER_SERIAL_CHANGED")).toBe(true);
  });
});
