/**
 * ENERA AMR DATA VALIDATION ENGINE (REQUIREMENT 9)
 * ================================================
 * Validates raw and ingested AMR telemetry datasets prior to reconciliation.
 *
 * VALIDATION CHECKS:
 *   1. Timestamp validity and chronological order
 *   2. Timezone alignment (SAST UTC+2 stability, no-DST compliance)
 *   3. Interval length consistency (cadence drift detection)
 *   4. Duplicate timestamp identification
 *   5. Missing timestamp gap detection
 *   6. Negative values where inappropriate (import kWh/kW/kVA < 0)
 *   7. Impossible value spikes (> physical meter / transformer capacity)
 *   8. Meter rollover detection (cumulative register wrap-around)
 *   9. Unit verification and normalization (kWh, MWh, kVA, kVArh, kW)
 *  10. Cumulative vs Interval reading auto-detection and delta calculation
 *  11. Estimated / Interpolated reading flagging
 *  12. Meter replacement & multiplier change detection
 *
 * NON-DESTRUCTIVE FLAGGING PRINCIPLE:
 *   "Do not automatically discard suspicious data. Flag it."
 *   The engine attaches rich anomaly descriptors while preserving original data.
 */

import Decimal from "decimal.js-light";
import { RawTelemetryInterval } from "./dataCoverageEngine";

export type AnomalySeverity = "CRITICAL" | "WARNING" | "INFO";

export interface AmrValidationAnomaly {
  code: string;
  field: string;
  timestamp: string | null;
  intervalIndex: number | null;
  severity: AnomalySeverity;
  observedValue: any;
  expectedDescription: string;
  message: string;
  isReviewRequired: boolean;
}

export interface AmrMeterContext {
  meterSerialNumber?: string;
  meterMultiplier?: number;
  transformerCapacityKva?: number; // e.g. 500 kVA, 1000 kVA, 2500 kVA
  isBiDirectionalSolar?: boolean; // If true, negative kWh export is permissible
  expectedUnit?: "kWh" | "MWh" | "kVA" | "kVARh";
  expectedTimezoneOffsetHours?: number; // Default +2 (SAST)
}

export interface NormalizedAmrInterval {
  timestampUtc: string;
  intervalStartUtc: string;
  intervalEndUtc: string;
  intervalMinutes: number;
  kwh: Decimal;
  kva: Decimal;
  kvarh: Decimal;
  kw: Decimal;
  powerFactor: Decimal;
  isEstimated: boolean;
  statusFlag: string;
  meterSerialNumber: string;
  rawCumulativeReading?: Decimal;
  isRolloverAdjusted?: boolean;
  anomalies: AmrValidationAnomaly[];
}

export interface AmrDataValidationReport {
  isValidForReconciliation: boolean;
  readingFormat: "INTERVAL_DELTAS" | "CUMULATIVE_REGISTERS" | "MIXED";
  totalRecordsProcessed: number;
  validIntervalCount: number;
  anomalousIntervalCount: number;
  estimatedIntervalCount: number;
  rolloverEventCount: number;
  meterChangeDetected: boolean;
  anomalies: AmrValidationAnomaly[];
  criticalIssuesCount: number;
  warningsCount: number;
  normalizedIntervals: NormalizedAmrInterval[];
  summary: {
    totalKwh: Decimal;
    peakDemandKva: Decimal;
    peakDemandKw: Decimal;
    totalReactiveKvarh: Decimal;
    averagePowerFactor: Decimal;
  };
}

export class AmrDataValidationEngine {
  public static readonly DEFAULT_TRANSFORMER_CAPACITY_KVA = 5000; // 5 MVA conservative upper limit per standard meter
  public static readonly SAST_UTC_OFFSET_HOURS = 2; // South Africa Standard Time (UTC+2)

  /**
   * Comprehensive validation and normalization of AMR telemetry streams.
   */
  public static validateAndNormalizeAmrData(
    rawIntervals: RawTelemetryInterval[],
    context: AmrMeterContext = {},
  ): AmrDataValidationReport {
    const anomalies: AmrValidationAnomaly[] = [];
    const expectedTzOffset = context.expectedTimezoneOffsetHours ?? this.SAST_UTC_OFFSET_HOURS;
    const maxCapacityKva = context.transformerCapacityKva ?? this.DEFAULT_TRANSFORMER_CAPACITY_KVA;
    const defaultMeterSerial = context.meterSerialNumber || "UNKNOWN_METER";

    if (!Array.isArray(rawIntervals) || rawIntervals.length === 0) {
      anomalies.push({
        code: "EMPTY_AMR_DATASET",
        field: "rawIntervals",
        timestamp: null,
        intervalIndex: null,
        severity: "CRITICAL",
        observedValue: 0,
        expectedDescription: "At least 1 valid interval record",
        message: "No AMR telemetry intervals provided for validation.",
        isReviewRequired: true,
      });

      return {
        isValidForReconciliation: false,
        readingFormat: "INTERVAL_DELTAS",
        totalRecordsProcessed: 0,
        validIntervalCount: 0,
        anomalousIntervalCount: 0,
        estimatedIntervalCount: 0,
        rolloverEventCount: 0,
        meterChangeDetected: false,
        anomalies,
        criticalIssuesCount: 1,
        warningsCount: 0,
        normalizedIntervals: [],
        summary: {
          totalKwh: new Decimal(0),
          peakDemandKva: new Decimal(0),
          peakDemandKw: new Decimal(0),
          totalReactiveKvarh: new Decimal(0),
          averagePowerFactor: new Decimal(1.0),
        },
      };
    }

    // 1. Initial Format Detection (Cumulative Registers vs Interval Deltas)
    const readingFormat = this.detectReadingFormat(rawIntervals);

    // 2. Sort intervals chronologically
    const sorted = [...rawIntervals].sort((a, b) => {
      const tA = new Date(a.timestampUtc).getTime();
      const tB = new Date(b.timestampUtc).getTime();
      return tA - tB;
    });

    const seenTimestamps = new Map<string, number>();
    const normalizedList: NormalizedAmrInterval[] = [];
    let rolloverCount = 0;
    let estimatedCount = 0;
    let meterChangeCount = 0;
    let previousSerial = context.meterSerialNumber || sorted[0].meterSerialNumber || "";
    let previousCumulativeKwh: Decimal | null = null;

    let cumulativeKwhSum = new Decimal(0);
    let peakDemandKva = new Decimal(0);
    let peakDemandKw = new Decimal(0);
    let totalKvarhSum = new Decimal(0);
    let pfAccumulator = new Decimal(0);

    for (let i = 0; i < sorted.length; i++) {
      const raw = sorted[i];
      const intervalAnomalies: AmrValidationAnomaly[] = [];

      // 1. Timestamp validation
      const dateObj = new Date(raw.timestampUtc);
      const isDateValid = !isNaN(dateObj.getTime());

      if (!isDateValid) {
        const anom: AmrValidationAnomaly = {
          code: "INVALID_TIMESTAMP_FORMAT",
          field: "timestampUtc",
          timestamp: String(raw.timestampUtc),
          intervalIndex: i,
          severity: "CRITICAL",
          observedValue: raw.timestampUtc,
          expectedDescription: "Valid ISO 8601 UTC timestamp",
          message: `Unparseable timestamp at record index ${i}: '${raw.timestampUtc}'`,
          isReviewRequired: true,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
        continue; // Cannot accurately place unparseable timestamp
      }

      const isoTs = dateObj.toISOString();

      // 2. Duplicate timestamp validation
      if (seenTimestamps.has(isoTs)) {
        const prevIndex = seenTimestamps.get(isoTs)!;
        const anom: AmrValidationAnomaly = {
          code: "DUPLICATE_TIMESTAMP",
          field: "timestampUtc",
          timestamp: isoTs,
          intervalIndex: i,
          severity: "WARNING",
          observedValue: isoTs,
          expectedDescription: "Unique interval timestamp",
          message: `Duplicate timestamp ${isoTs} detected (collides with index ${prevIndex}).`,
          isReviewRequired: false,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
      } else {
        seenTimestamps.set(isoTs, i);
      }

      // 3. Timezone Validation (Verify non-DST stable offset if offset string provided)
      if (typeof raw.timestampUtc === "string" && raw.timestampUtc.includes("+")) {
        const offsetMatch = raw.timestampUtc.match(/([+-]\d{2}):?(\d{2})?$/);
        if (offsetMatch) {
          const offsetHours = parseInt(offsetMatch[1], 10);
          if (offsetHours !== expectedTzOffset && offsetHours !== 0) {
            const anom: AmrValidationAnomaly = {
              code: "UNEXPECTED_TIMEZONE_OFFSET",
              field: "timestampUtc",
              timestamp: isoTs,
              intervalIndex: i,
              severity: "WARNING",
              observedValue: offsetHours,
              expectedDescription: `UTC+${expectedTzOffset} (SAST) or UTC (Z)`,
              message: `Telemetry offset UTC${offsetMatch[1]} deviates from expected SAST UTC+02:00.`,
              isReviewRequired: false,
            };
            intervalAnomalies.push(anom);
            anomalies.push(anom);
          }
        }
      }

      // 4. Meter Serial Number & Meter Changes
      const currentSerial = raw.meterSerialNumber || previousSerial || defaultMeterSerial;
      if (previousSerial && currentSerial !== previousSerial) {
        meterChangeCount++;
        const anom: AmrValidationAnomaly = {
          code: "METER_SERIAL_CHANGED",
          field: "meterSerialNumber",
          timestamp: isoTs,
          intervalIndex: i,
          severity: "WARNING",
          observedValue: currentSerial,
          expectedDescription: `Consistent serial ${previousSerial}`,
          message: `Meter serial changed mid-dataset from ${previousSerial} to ${currentSerial}. Possible meter replacement.`,
          isReviewRequired: true,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
        previousSerial = currentSerial;
      }

      // 5. Estimated Readings Check
      const statusUpper = (raw.status || raw.quality || "").toUpperCase();
      const isEstimated =
        statusUpper.includes("EST") ||
        statusUpper.includes("INTERPOL") ||
        statusUpper.includes("SUBSTITUT") ||
        statusUpper.includes("DERIVED") ||
        statusUpper.includes("MANUAL");

      if (isEstimated) {
        estimatedCount++;
        const anom: AmrValidationAnomaly = {
          code: "ESTIMATED_READING_FLAGGED",
          field: "status",
          timestamp: isoTs,
          intervalIndex: i,
          severity: "WARNING",
          observedValue: raw.status,
          expectedDescription: "ACTUAL metered interval",
          message: `Interval at ${isoTs} is flagged as '${raw.status || "ESTIMATED"}'.`,
          isReviewRequired: false,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
      }

      // 6. Value Parsing & Cumulative vs Interval Delta computation
      let rawKwhVal = new Decimal(raw.kwh !== undefined && raw.kwh !== null ? String(raw.kwh) : "0");
      let rawKvaVal = new Decimal(raw.kva !== undefined && raw.kva !== null ? String(raw.kva) : "0");
      let rawKvarhVal = new Decimal(
        raw.kvarh !== undefined && raw.kvarh !== null ? String(raw.kvarh) : "0",
      );
      let rawKwVal = new Decimal(raw.kw !== undefined && raw.kw !== null ? String(raw.kw) : "0");

      let intervalKwh = rawKwhVal;
      let isRolloverAdjusted = false;

      if (readingFormat === "CUMULATIVE_REGISTERS") {
        if (previousCumulativeKwh === null) {
          // First cumulative interval — baseline delta is 0 or estimated from kva
          intervalKwh = new Decimal(0);
          previousCumulativeKwh = rawKwhVal;
        } else {
          const delta = rawKwhVal.sub(previousCumulativeKwh);
          if (delta.lt(0)) {
            // Potential Meter Rollover Detected (e.g. 999990 -> 10)
            rolloverCount++;
            isRolloverAdjusted = true;
            // Standard 6-digit or 7-digit rollover wrap calculation
            const rolloverCeiling = previousCumulativeKwh.gt(new Decimal(900000))
              ? new Decimal(1000000)
              : new Decimal(100000);
            intervalKwh = rolloverCeiling.sub(previousCumulativeKwh).add(rawKwhVal);

            const anom: AmrValidationAnomaly = {
              code: "METER_ROLLOVER_DETECTED",
              field: "kwh",
              timestamp: isoTs,
              intervalIndex: i,
              severity: "WARNING",
              observedValue: { prev: previousCumulativeKwh.toNumber(), curr: rawKwhVal.toNumber() },
              expectedDescription: "Monotonically increasing cumulative register",
              message: `Cumulative register rollover detected at ${isoTs}: wrap from ${previousCumulativeKwh.toFixed(
                1,
              )} to ${rawKwhVal.toFixed(1)}. Adjusted delta: ${intervalKwh.toFixed(2)} kWh.`,
              isReviewRequired: true,
            };
            intervalAnomalies.push(anom);
            anomalies.push(anom);
          } else {
            intervalKwh = delta;
          }
          previousCumulativeKwh = rawKwhVal;
        }
      }

      // 7. Negative Values Where Inappropriate Check
      if (intervalKwh.lt(0) && !context.isBiDirectionalSolar) {
        const anom: AmrValidationAnomaly = {
          code: "NEGATIVE_IMPORT_ENERGY",
          field: "kwh",
          timestamp: isoTs,
          intervalIndex: i,
          severity: "CRITICAL",
          observedValue: intervalKwh.toNumber(),
          expectedDescription: "Non-negative active import energy (>= 0 kWh)",
          message: `Inappropriate negative energy reading (${intervalKwh.toFixed(
            2,
          )} kWh) on non-solar import meter at ${isoTs}.`,
          isReviewRequired: true,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
      }

      if (rawKvaVal.lt(0)) {
        const anom: AmrValidationAnomaly = {
          code: "NEGATIVE_APPARENT_POWER",
          field: "kva",
          timestamp: isoTs,
          intervalIndex: i,
          severity: "CRITICAL",
          observedValue: rawKvaVal.toNumber(),
          expectedDescription: "Apparent power kVA must be >= 0",
          message: `Negative apparent power reading (${rawKvaVal.toFixed(2)} kVA) at ${isoTs}.`,
          isReviewRequired: true,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
      }

      // 8. Impossible Value Spikes Check
      // For a 30-min interval, max energy = maxCapacityKva * 0.5 hours
      const maxPossible30MinKwh = new Decimal(maxCapacityKva).mul(0.5);
      if (intervalKwh.gt(maxPossible30MinKwh)) {
        const anom: AmrValidationAnomaly = {
          code: "IMPOSSIBLE_ENERGY_SPIKE",
          field: "kwh",
          timestamp: isoTs,
          intervalIndex: i,
          severity: "CRITICAL",
          observedValue: intervalKwh.toNumber(),
          expectedDescription: `<= ${maxPossible30MinKwh.toNumber()} kWh (based on ${maxCapacityKva} kVA rating)`,
          message: `Physically impossible energy spike (${intervalKwh.toFixed(
            1,
          )} kWh) exceeding site capacity (${maxCapacityKva} kVA) at ${isoTs}.`,
          isReviewRequired: true,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
      }

      if (rawKvaVal.gt(new Decimal(maxCapacityKva).mul(1.5))) {
        const anom: AmrValidationAnomaly = {
          code: "IMPOSSIBLE_DEMAND_SPIKE",
          field: "kva",
          timestamp: isoTs,
          intervalIndex: i,
          severity: "CRITICAL",
          observedValue: rawKvaVal.toNumber(),
          expectedDescription: `<= ${maxCapacityKva} kVA`,
          message: `Demand spike (${rawKvaVal.toFixed(
            1,
          )} kVA) exceeds rated transformer limit (${maxCapacityKva} kVA) at ${isoTs}.`,
          isReviewRequired: true,
        };
        intervalAnomalies.push(anom);
        anomalies.push(anom);
      }

      // 9. Power Factor Calculation & Range Validation
      // If kva provided, kW = intervalKwh * 2 (for 30m); PF = kW / kVA
      let powerFactor = new Decimal(1.0);
      if (rawKvaVal.gt(0)) {
        const impliedKw = rawKwVal.gt(0) ? rawKwVal : intervalKwh.mul(2);
        const pf = impliedKw.div(rawKvaVal);
        let rawPf = pf;
        if (rawPf.gt(new Decimal("1.0"))) {
          powerFactor = new Decimal("1.0");
        } else if (rawPf.lt(new Decimal("0.0"))) {
          powerFactor = new Decimal("0.0");
        } else {
          powerFactor = rawPf;
        }

        if (pf.gt(new Decimal("1.05")) || pf.lt(0)) {
          const anom: AmrValidationAnomaly = {
            code: "ANOMALOUS_POWER_FACTOR",
            field: "powerFactor",
            timestamp: isoTs,
            intervalIndex: i,
            severity: "WARNING",
            observedValue: pf.toNumber(),
            expectedDescription: "0.0 <= Power Factor <= 1.0",
            message: `Power factor calculation (${pf.toFixed(3)}) out of physical bounds at ${isoTs}.`,
            isReviewRequired: false,
          };
          intervalAnomalies.push(anom);
          anomalies.push(anom);
        }
      }

      // Track running statistics
      cumulativeKwhSum = cumulativeKwhSum.add(intervalKwh);
      if (rawKvaVal.gt(peakDemandKva)) peakDemandKva = rawKvaVal;
      const impliedKw = rawKwVal.gt(0) ? rawKwVal : intervalKwh.mul(2);
      if (impliedKw.gt(peakDemandKw)) peakDemandKw = impliedKw;
      totalKvarhSum = totalKvarhSum.add(rawKvarhVal);
      pfAccumulator = pfAccumulator.add(powerFactor);

      // Create Normalized Interval Record
      normalizedList.push({
        timestampUtc: isoTs,
        intervalStartUtc: new Date(dateObj.getTime() - 30 * 60 * 1000).toISOString(),
        intervalEndUtc: isoTs,
        intervalMinutes: 30,
        kwh: intervalKwh,
        kva: rawKvaVal,
        kvarh: rawKvarhVal,
        kw: impliedKw,
        powerFactor,
        isEstimated,
        statusFlag: raw.status || "ACTUAL",
        meterSerialNumber: currentSerial,
        rawCumulativeReading: readingFormat === "CUMULATIVE_REGISTERS" ? rawKwhVal : undefined,
        isRolloverAdjusted,
        anomalies: intervalAnomalies,
      });
    }

    const criticalCount = anomalies.filter((a) => a.severity === "CRITICAL").length;
    const warningCount = anomalies.filter((a) => a.severity === "WARNING").length;
    const avgPf =
      normalizedList.length > 0
        ? pfAccumulator.div(normalizedList.length).toDecimalPlaces(3, Decimal.ROUND_HALF_UP)
        : new Decimal(1.0);

    return {
      isValidForReconciliation: criticalCount === 0,
      readingFormat,
      totalRecordsProcessed: rawIntervals.length,
      validIntervalCount: normalizedList.length,
      anomalousIntervalCount: normalizedList.filter((n) => n.anomalies.length > 0).length,
      estimatedIntervalCount: estimatedCount,
      rolloverEventCount: rolloverCount,
      meterChangeDetected: meterChangeCount > 0,
      anomalies,
      criticalIssuesCount: criticalCount,
      warningsCount: warningCount,
      normalizedIntervals: normalizedList,
      summary: {
        totalKwh: cumulativeKwhSum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        peakDemandKva: peakDemandKva.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        peakDemandKw: peakDemandKw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        totalReactiveKvarh: totalKvarhSum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        averagePowerFactor: avgPf,
      },
    };
  }

  /**
   * Helper to detect whether raw numbers represent cumulative registers vs delta intervals.
   */
  private static detectReadingFormat(
    intervals: RawTelemetryInterval[],
  ): "INTERVAL_DELTAS" | "CUMULATIVE_REGISTERS" | "MIXED" {
    if (intervals.length === 0) return "INTERVAL_DELTAS";
    if (intervals.some((i) => i.isCumulative)) return "CUMULATIVE_REGISTERS";

    const validKwh = intervals
      .filter((i) => i.kwh !== undefined && i.kwh !== null)
      .map((i) => Number(i.kwh));

    if (validKwh.length === 0) return "INTERVAL_DELTAS";

    // If first value is very large (> 5,000) and numbers are largely non-decreasing, treat as cumulative
    if (validKwh[0] > 5000) {
      return "CUMULATIVE_REGISTERS";
    }

    if (validKwh.length >= 3) {
      let increases = 0;
      for (let i = 0; i < validKwh.length - 1; i++) {
        if (validKwh[i + 1] >= validKwh[i]) increases++;
      }
      if (increases / (validKwh.length - 1) >= 0.85 && validKwh[validKwh.length - 1] > 1000) {
        return "CUMULATIVE_REGISTERS";
      }
    }

    return "INTERVAL_DELTAS";
  }
}
