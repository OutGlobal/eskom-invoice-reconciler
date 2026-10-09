/**
 * ENERA DATA COVERAGE ENGINE (REQUIREMENT 8)
 * ==========================================
 * Calculates exact interval coverage metrics for AMR telemetry streams
 * across arbitrary billing cycles.
 *
 * DYNAMIC RESOLUTION:
 *   Supports 30-minute (48/day), 15-minute (96/day), 5-minute (288/day),
 *   60-minute (24/day), and arbitrary custom resolutions determined
 *   directly from dataset analysis or source specification.
 *
 * METRICS:
 *   - expected_intervals
 *   - actual_intervals
 *   - missing_intervals
 *   - duplicate_intervals
 *   - coverage_percentage (Zero floating-point drift with Decimal.js)
 */

import Decimal from "decimal.js-light";

export type ResolutionDetectionMethod =
  | "SPECIFIED_IN_SOURCE"
  | "INFERRED_FROM_DATASET_MODAL"
  | "FALLBACK_DEFAULT_30MIN";

export interface IntervalResolutionConfig {
  intervalMinutes: number;
  intervalsPerDay: number;
  intervalDurationMs: number;
  detectionMethod: ResolutionDetectionMethod;
  confidence: number;
}

export interface RawTelemetryInterval {
  timestampUtc: string; // ISO 8601 UTC or SAST
  kwh?: number | Decimal | string;
  kva?: number | Decimal | string;
  kvarh?: number | Decimal | string;
  kw?: number | Decimal | string;
  status?: string; // 'ACTUAL' | 'ESTIMATED' | 'INTERPOLATED'
  meterSerialNumber?: string;
  isCumulative?: boolean;
  [key: string]: any;
}

export interface MissingIntervalGap {
  gapStartTimestamp: string;
  gapEndTimestamp: string;
  gapStartDate: string;
  gapEndDate: string;
  missingIntervalCount: number;
  gapDurationHours: number;
}

export interface DataCoverageResult {
  isComplete: boolean;
  status: "COMPLETE_COVERAGE" | "INCOMPLETE_METER_DATA" | "EMPTY_DATASET";
  resolution: IntervalResolutionConfig;
  billingPeriod: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    durationDays: number;
  };
  metrics: {
    expectedIntervals: number;
    actualIntervals: number; // Unique valid intervals within window
    missingIntervals: number;
    duplicateIntervals: number;
    outOfRangeIntervals: number;
    coveragePercentage: Decimal;
  };
  telemetrySpan: {
    firstRecordedTimestamp: string | null;
    lastRecordedTimestamp: string | null;
    firstRecordedDate: string | null;
    lastRecordedDate: string | null;
  };
  gapAnalysis: {
    hasBoundaryUnderflow: boolean; // AMR starts after billing start
    hasBoundaryOverflow: boolean; // AMR ends before billing end
    hasInternalGaps: boolean; // Gaps inside recorded span
    gaps: MissingIntervalGap[];
  };
  diagnosticMessage: string;
}

export class DataCoverageEngine {
  public static readonly DEFAULT_INTERVAL_MINUTES = 30;

  /**
   * Dynamically determine interval resolution from source spec or dataset cadence.
   */
  public static determineIntervalResolution(
    intervals: RawTelemetryInterval[],
    specifiedResolutionMinutes?: number,
  ): IntervalResolutionConfig {
    if (
      specifiedResolutionMinutes &&
      Number.isInteger(specifiedResolutionMinutes) &&
      specifiedResolutionMinutes > 0 &&
      1440 % specifiedResolutionMinutes === 0
    ) {
      return {
        intervalMinutes: specifiedResolutionMinutes,
        intervalsPerDay: Math.round(1440 / specifiedResolutionMinutes),
        intervalDurationMs: specifiedResolutionMinutes * 60 * 1000,
        detectionMethod: "SPECIFIED_IN_SOURCE",
        confidence: 1.0,
      };
    }

    if (!intervals || intervals.length < 2) {
      return {
        intervalMinutes: this.DEFAULT_INTERVAL_MINUTES,
        intervalsPerDay: 48,
        intervalDurationMs: 30 * 60 * 1000,
        detectionMethod: "FALLBACK_DEFAULT_30MIN",
        confidence: 0.5,
      };
    }

    // Sort a sample to calculate delta distributions
    const validTimestamps = intervals
      .map((i) => new Date(i.timestampUtc).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);

    if (validTimestamps.length < 2) {
      return {
        intervalMinutes: this.DEFAULT_INTERVAL_MINUTES,
        intervalsPerDay: 48,
        intervalDurationMs: 30 * 60 * 1000,
        detectionMethod: "FALLBACK_DEFAULT_30MIN",
        confidence: 0.5,
      };
    }

    const deltaCounts = new Map<number, number>();
    const sampleLimit = Math.min(validTimestamps.length - 1, 500);

    for (let i = 0; i < sampleLimit; i++) {
      const deltaMs = validTimestamps[i + 1] - validTimestamps[i];
      if (deltaMs > 0) {
        const deltaMinutes = Math.round(deltaMs / (60 * 1000));
        if (deltaMinutes > 0 && deltaMinutes <= 1440) {
          deltaCounts.set(deltaMinutes, (deltaCounts.get(deltaMinutes) || 0) + 1);
        }
      }
    }

    // Find modal interval length
    let modalMinutes = this.DEFAULT_INTERVAL_MINUTES;
    let maxCount = 0;
    let totalDeltas = 0;

    for (const [minutes, count] of deltaCounts.entries()) {
      totalDeltas += count;
      if (count > maxCount) {
        maxCount = count;
        modalMinutes = minutes;
      }
    }

    // Normalise to common utility standard intervals (5m, 10m, 15m, 30m, 60m) if close
    const standardIntervals = [5, 10, 15, 30, 60];
    const closestStandard = standardIntervals.find((std) => Math.abs(std - modalMinutes) <= 1);
    const resolvedMinutes = closestStandard || modalMinutes;

    const intervalsPerDay = Math.max(1, Math.round(1440 / resolvedMinutes));
    const confidence = totalDeltas > 0 ? Number((maxCount / totalDeltas).toFixed(2)) : 0.8;

    return {
      intervalMinutes: resolvedMinutes,
      intervalsPerDay,
      intervalDurationMs: resolvedMinutes * 60 * 1000,
      detectionMethod: "INFERRED_FROM_DATASET_MODAL",
      confidence,
    };
  }

  /**
   * Calculate full coverage metrics for an invoice period.
   */
  public static calculateCoverage(params: {
    invoiceStartDate: string; // YYYY-MM-DD
    invoiceEndDate: string; // YYYY-MM-DD
    intervals: RawTelemetryInterval[];
    specifiedResolutionMinutes?: number;
  }): DataCoverageResult {
    const { invoiceStartDate, invoiceEndDate, intervals, specifiedResolutionMinutes } = params;

    const resolution = this.determineIntervalResolution(intervals, specifiedResolutionMinutes);

    // Calculate billing period duration
    const dStart = new Date(invoiceStartDate + "T00:00:00Z");
    const dEnd = new Date(invoiceEndDate + "T23:59:59.999Z");
    const durationDays = Math.max(
      1,
      Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const expectedIntervals = durationDays * resolution.intervalsPerDay;

    if (!intervals || intervals.length === 0) {
      return {
        isComplete: false,
        status: "EMPTY_DATASET",
        resolution,
        billingPeriod: {
          startDate: invoiceStartDate,
          endDate: invoiceEndDate,
          durationDays,
        },
        metrics: {
          expectedIntervals,
          actualIntervals: 0,
          missingIntervals: expectedIntervals,
          duplicateIntervals: 0,
          outOfRangeIntervals: 0,
          coveragePercentage: new Decimal(0),
        },
        telemetrySpan: {
          firstRecordedTimestamp: null,
          lastRecordedTimestamp: null,
          firstRecordedDate: null,
          lastRecordedDate: null,
        },
        gapAnalysis: {
          hasBoundaryUnderflow: true,
          hasBoundaryOverflow: true,
          hasInternalGaps: false,
          gaps: [
            {
              gapStartTimestamp: `${invoiceStartDate}T00:00:00Z`,
              gapEndTimestamp: `${invoiceEndDate}T23:59:59Z`,
              gapStartDate: invoiceStartDate,
              gapEndDate: invoiceEndDate,
              missingIntervalCount: expectedIntervals,
              gapDurationHours: durationDays * 24,
            },
          ],
        },
        diagnosticMessage: `No AMR interval data present for ${invoiceStartDate} -> ${invoiceEndDate}. (0% coverage, expected ${expectedIntervals} intervals at ${resolution.intervalMinutes}m cadence).`,
      };
    }

    // Filter and sort intervals
    const startMs = dStart.getTime();
    const endMs = dEnd.getTime();

    const sorted = [...intervals]
      .filter((i) => i.timestampUtc && !isNaN(new Date(i.timestampUtc).getTime()))
      .sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime());

    if (sorted.length === 0) {
      return this.calculateCoverage({
        invoiceStartDate,
        invoiceEndDate,
        intervals: [],
        specifiedResolutionMinutes,
      });
    }

    const firstRecordedTimestamp = sorted[0].timestampUtc;
    const lastRecordedTimestamp = sorted[sorted.length - 1].timestampUtc;
    const firstRecordedDate = firstRecordedTimestamp.slice(0, 10);
    const lastRecordedDate = lastRecordedTimestamp.slice(0, 10);

    const hasBoundaryUnderflow = firstRecordedDate > invoiceStartDate;
    const hasBoundaryOverflow = lastRecordedDate < invoiceEndDate;

    // Track unique timestamps vs duplicates vs out-of-range
    const seenTimestamps = new Set<string>();
    let duplicateIntervals = 0;
    let outOfRangeIntervals = 0;
    const inRangeUnique: RawTelemetryInterval[] = [];

    for (const item of sorted) {
      const tsMs = new Date(item.timestampUtc).getTime();
      const isWithinBilling = tsMs >= startMs - 3600000 && tsMs <= endMs + 3600000;

      if (!isWithinBilling) {
        outOfRangeIntervals++;
        continue;
      }

      const normKey = new Date(item.timestampUtc).toISOString();
      if (seenTimestamps.has(normKey)) {
        duplicateIntervals++;
      } else {
        seenTimestamps.add(normKey);
        inRangeUnique.push(item);
      }
    }

    // Internal gap analysis
    const gaps: MissingIntervalGap[] = [];
    let missingIntervals = 0;

    // 1. Check underflow gap
    if (hasBoundaryUnderflow) {
      const underflowMs = new Date(firstRecordedTimestamp).getTime() - startMs;
      const underflowIntervals = Math.max(
        1,
        Math.round(underflowMs / resolution.intervalDurationMs),
      );
      missingIntervals += underflowIntervals;
      gaps.push({
        gapStartTimestamp: `${invoiceStartDate}T00:00:00Z`,
        gapEndTimestamp: firstRecordedTimestamp,
        gapStartDate: invoiceStartDate,
        gapEndDate: firstRecordedDate,
        missingIntervalCount: underflowIntervals,
        gapDurationHours: Math.round((underflowMs / (1000 * 60 * 60)) * 10) / 10,
      });
    }

    // 2. Check internal cadence gaps
    for (let i = 0; i < inRangeUnique.length - 1; i++) {
      const currMs = new Date(inRangeUnique[i].timestampUtc).getTime();
      const nextMs = new Date(inRangeUnique[i + 1].timestampUtc).getTime();
      const diffMs = nextMs - currMs;

      if (diffMs > resolution.intervalDurationMs * 1.5) {
        const gapCount = Math.round(diffMs / resolution.intervalDurationMs) - 1;
        if (gapCount > 0) {
          missingIntervals += gapCount;
          gaps.push({
            gapStartTimestamp: inRangeUnique[i].timestampUtc,
            gapEndTimestamp: inRangeUnique[i + 1].timestampUtc,
            gapStartDate: inRangeUnique[i].timestampUtc.slice(0, 10),
            gapEndDate: inRangeUnique[i + 1].timestampUtc.slice(0, 10),
            missingIntervalCount: gapCount,
            gapDurationHours: Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10,
          });
        }
      }
    }

    // 3. Check overflow gap
    if (hasBoundaryOverflow) {
      const overflowMs = endMs - new Date(lastRecordedTimestamp).getTime();
      const overflowIntervals = Math.max(1, Math.round(overflowMs / resolution.intervalDurationMs));
      missingIntervals += overflowIntervals;
      gaps.push({
        gapStartTimestamp: lastRecordedTimestamp,
        gapEndTimestamp: `${invoiceEndDate}T23:59:59Z`,
        gapStartDate: lastRecordedDate,
        gapEndDate: invoiceEndDate,
        missingIntervalCount: overflowIntervals,
        gapDurationHours: Math.round((overflowMs / (1000 * 60 * 60)) * 10) / 10,
      });
    }

    const actualIntervals = inRangeUnique.length;
    const finalMissingIntervals = Math.max(0, expectedIntervals - actualIntervals);

    const coveragePercentage =
      expectedIntervals > 0
        ? new Decimal(actualIntervals)
            .div(expectedIntervals)
            .mul(100)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : new Decimal(0);

    const isComplete =
      !hasBoundaryUnderflow &&
      !hasBoundaryOverflow &&
      gaps.length === 0 &&
      actualIntervals >= expectedIntervals &&
      coveragePercentage.gte(new Decimal("99.9"));

    let status: "COMPLETE_COVERAGE" | "INCOMPLETE_METER_DATA" = isComplete
      ? "COMPLETE_COVERAGE"
      : "INCOMPLETE_METER_DATA";

    let diagnosticMessage = `AMR telemetry completely covers invoice billing cycle ${invoiceStartDate} -> ${invoiceEndDate} (100.0% coverage, ${actualIntervals}/${expectedIntervals} intervals at ${resolution.intervalMinutes}m cadence).`;

    if (!isComplete) {
      diagnosticMessage = `INCOMPLETE_METER_DATA: AMR telemetry achieved ${coveragePercentage.toFixed(
        1,
      )}% coverage (${actualIntervals}/${expectedIntervals} expected intervals at ${
        resolution.intervalMinutes
      }m resolution). Missing ${finalMissingIntervals} intervals.`;
    }

    return {
      isComplete,
      status,
      resolution,
      billingPeriod: {
        startDate: invoiceStartDate,
        endDate: invoiceEndDate,
        durationDays,
      },
      metrics: {
        expectedIntervals,
        actualIntervals,
        missingIntervals: finalMissingIntervals,
        duplicateIntervals,
        outOfRangeIntervals,
        coveragePercentage,
      },
      telemetrySpan: {
        firstRecordedTimestamp,
        lastRecordedTimestamp,
        firstRecordedDate,
        lastRecordedDate,
      },
      gapAnalysis: {
        hasBoundaryUnderflow,
        hasBoundaryOverflow,
        hasInternalGaps: gaps.some((g) => g.gapStartDate !== invoiceStartDate && g.gapEndDate !== invoiceEndDate),
        gaps,
      },
      diagnosticMessage,
    };
  }
}
