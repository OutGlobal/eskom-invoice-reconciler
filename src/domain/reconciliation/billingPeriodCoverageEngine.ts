/**
 * ENERA BILLING PERIOD MATCHING & DATA COVERAGE ENGINE (REQUIREMENT 7)
 * ===================================================================
 * Verifies whether AMR telemetry datasets accurately and completely cover
 * the target invoice billing period.
 *
 * ZERO-PRETENSE POLICY:
 *   If AMR data covers 01/09/2026 -> 27/09/2026 while the invoice is
 *   01/09/2026 -> 30/09/2026, the engine NEVER pretends the dataset is complete.
 *   It produces an explicit INCOMPLETE_METER_DATA evaluation with exact gap ranges.
 */

import Decimal from "decimal.js-light";

export type BillingCoverageStatus =
  | "COMPLETE_COVERAGE"
  | "INCOMPLETE_METER_DATA"
  | "DATA_GAP_DETECTED"
  | "DATE_ALIGNMENT_MISMATCH"
  | "EMPTY_TELEMETRY_DATASET";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface TelemetryIntervalTimestamp {
  timestampUtc: string; // ISO 8601
  kwh?: number | Decimal;
  kva?: number | Decimal;
  kvarh?: number | Decimal;
}

export interface MissingIntervalRange {
  gapStartDate: string;
  gapEndDate: string;
  missingIntervalCount: number;
  gapDurationHours: number;
}

export interface BillingPeriodCoverageResult {
  status: BillingCoverageStatus;
  isComplete: boolean;
  coveragePercentage: Decimal;
  invoicePeriod: {
    startDate: string;
    endDate: string;
    durationDays: number;
    expectedIntervalCount: number; // 48 intervals per day for 30-min profiles
  };
  amrCoverage: {
    firstRecordedTimestamp: string | null;
    lastRecordedTimestamp: string | null;
    firstRecordedDate: string | null;
    lastRecordedDate: string | null;
    actualIntervalCount: number;
    missingIntervalCount: number;
    duplicateIntervalCount: number;
  };
  gapAnalysis: {
    hasBoundaryUnderflow: boolean; // AMR starts after invoice start
    hasBoundaryOverflow: boolean; // AMR ends before invoice end
    hasInternalGaps: boolean; // Gaps within the active interval stream
    missingRanges: MissingIntervalRange[];
  };
  diagnosticMessage: string;
}

export class BillingPeriodCoverageEngine {
  public static readonly INTERVALS_PER_DAY = 48; // Standard 30-minute intervals per 24 hours
  public static readonly INTERVAL_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds

  /**
   * Evaluate whether the AMR interval dataset completely satisfies the invoice billing period.
   */
  public static evaluateCoverage(params: {
    invoiceStartDate: string; // e.g. "2026-09-01"
    invoiceEndDate: string; // e.g. "2026-09-30"
    intervals: TelemetryIntervalTimestamp[];
  }): BillingPeriodCoverageResult {
    const { invoiceStartDate, invoiceEndDate, intervals } = params;

    const dStart = new Date(invoiceStartDate + "T00:00:00Z");
    const dEnd = new Date(invoiceEndDate + "T23:59:59.999Z");

    const durationDays = Math.max(
      1,
      Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const expectedIntervalCount = durationDays * this.INTERVALS_PER_DAY;

    if (!intervals || intervals.length === 0) {
      return {
        status: "EMPTY_TELEMETRY_DATASET",
        isComplete: false,
        coveragePercentage: new Decimal(0),
        invoicePeriod: {
          startDate: invoiceStartDate,
          endDate: invoiceEndDate,
          durationDays,
          expectedIntervalCount,
        },
        amrCoverage: {
          firstRecordedTimestamp: null,
          lastRecordedTimestamp: null,
          firstRecordedDate: null,
          lastRecordedDate: null,
          actualIntervalCount: 0,
          missingIntervalCount: expectedIntervalCount,
          duplicateIntervalCount: 0,
        },
        gapAnalysis: {
          hasBoundaryUnderflow: true,
          hasBoundaryOverflow: true,
          hasInternalGaps: false,
          missingRanges: [
            {
              gapStartDate: invoiceStartDate,
              gapEndDate: invoiceEndDate,
              missingIntervalCount: expectedIntervalCount,
              gapDurationHours: durationDays * 24,
            },
          ],
        },
        diagnosticMessage: `No AMR interval telemetry recorded for billing cycle ${invoiceStartDate} -> ${invoiceEndDate}. Status: INCOMPLETE_METER_DATA (0% coverage).`,
      };
    }

    // Sort intervals chronologically
    const sorted = [...intervals].sort(
      (a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime(),
    );

    const firstTs = sorted[0].timestampUtc;
    const lastTs = sorted[sorted.length - 1].timestampUtc;
    const firstDate = firstTs.slice(0, 10);
    const lastDate = lastTs.slice(0, 10);

    const hasBoundaryUnderflow = firstDate > invoiceStartDate;
    const hasBoundaryOverflow = lastDate < invoiceEndDate;

    // Detect internal interval gaps (> 30 minutes between consecutive entries) and duplicates
    const missingRanges: MissingIntervalRange[] = [];
    let duplicateCount = 0;
    let internalMissingCount = 0;

    // Check Start Boundary Gap
    if (hasBoundaryUnderflow) {
      const underflowDays = Math.max(
        1,
        Math.round(
          (new Date(firstDate).getTime() - new Date(invoiceStartDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const underflowIntervals = underflowDays * this.INTERVALS_PER_DAY;
      internalMissingCount += underflowIntervals;
      missingRanges.push({
        gapStartDate: invoiceStartDate,
        gapEndDate: firstDate,
        missingIntervalCount: underflowIntervals,
        gapDurationHours: underflowDays * 24,
      });
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentMs = new Date(sorted[i].timestampUtc).getTime();
      const nextMs = new Date(sorted[i + 1].timestampUtc).getTime();
      const diffMs = nextMs - currentMs;

      if (diffMs === 0) {
        duplicateCount++;
      } else if (diffMs > this.INTERVAL_DURATION_MS * 1.5) {
        const gapIntervals = Math.round(diffMs / this.INTERVAL_DURATION_MS) - 1;
        internalMissingCount += gapIntervals;
        missingRanges.push({
          gapStartDate: new Date(currentMs).toISOString().slice(0, 10),
          gapEndDate: new Date(nextMs).toISOString().slice(0, 10),
          missingIntervalCount: gapIntervals,
          gapDurationHours: Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10,
        });
      }
    }

    // Check End Boundary Gap
    if (hasBoundaryOverflow) {
      const overflowDays = Math.max(
        1,
        Math.round(
          (new Date(invoiceEndDate).getTime() - new Date(lastDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const overflowIntervals = overflowDays * this.INTERVALS_PER_DAY;
      internalMissingCount += overflowIntervals;
      missingRanges.push({
        gapStartDate: lastDate,
        gapEndDate: invoiceEndDate,
        missingIntervalCount: overflowIntervals,
        gapDurationHours: overflowDays * 24,
      });
    }

    const uniqueActualCount = sorted.length - duplicateCount;
    const totalMissingIntervals = Math.max(0, expectedIntervalCount - uniqueActualCount);
    const coveragePercentage = new Decimal(uniqueActualCount)
      .div(expectedIntervalCount)
      .mul(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const isComplete =
      !hasBoundaryUnderflow &&
      !hasBoundaryOverflow &&
      missingRanges.length === 0 &&
      coveragePercentage.gte(new Decimal("99.9"));

    let status: BillingCoverageStatus = "COMPLETE_COVERAGE";
    let diagnosticMessage = `AMR telemetry completely covers invoice billing cycle ${invoiceStartDate} -> ${invoiceEndDate} (100% coverage, ${uniqueActualCount}/${expectedIntervalCount} intervals).`;

    if (!isComplete) {
      status = "INCOMPLETE_METER_DATA";
      if (hasBoundaryOverflow && !hasBoundaryUnderflow) {
        diagnosticMessage = `INCOMPLETE_METER_DATA: AMR telemetry covers ${firstDate} -> ${lastDate}, but invoice requires ${invoiceStartDate} -> ${invoiceEndDate}. Missing ${totalMissingIntervals} intervals (${coveragePercentage.toFixed(1)}% coverage).`;
      } else if (hasBoundaryUnderflow && !hasBoundaryOverflow) {
        diagnosticMessage = `INCOMPLETE_METER_DATA: AMR telemetry starts late on ${firstDate} for invoice cycle beginning ${invoiceStartDate}. Missing ${totalMissingIntervals} intervals (${coveragePercentage.toFixed(1)}% coverage).`;
      } else if (missingRanges.length > 0) {
        diagnosticMessage = `INCOMPLETE_METER_DATA: Detected ${missingRanges.length} interval gap(s) within the billing period. Total missing intervals: ${totalMissingIntervals} (${coveragePercentage.toFixed(1)}% coverage).`;
      }
    }

    return {
      status,
      isComplete,
      coveragePercentage,
      invoicePeriod: {
        startDate: invoiceStartDate,
        endDate: invoiceEndDate,
        durationDays,
        expectedIntervalCount,
      },
      amrCoverage: {
        firstRecordedTimestamp: firstTs,
        lastRecordedTimestamp: lastTs,
        firstRecordedDate: firstDate,
        lastRecordedDate: lastDate,
        actualIntervalCount: uniqueActualCount,
        missingIntervalCount: totalMissingIntervals,
        duplicateIntervalCount: duplicateCount,
      },
      gapAnalysis: {
        hasBoundaryUnderflow,
        hasBoundaryOverflow,
        hasInternalGaps: missingRanges.length > 0,
        missingRanges,
      },
      diagnosticMessage,
    };
  }
}
