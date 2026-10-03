/**
 * ENERA AMR DATA MODEL ENGINE (REQUIREMENT 10)
 * ============================================
 * Formal dual-model architecture supporting:
 *   1. Interval Data (Discrete period consumption: kWh, kW, kVA, kVArh, kVAr, power_factor)
 *   2. Cumulative Meter Readings (Continuous meter dials: timestamp, meter_reading)
 *
 * NON-CONFLATION PRINCIPLE:
 *   The engine explicitly identifies which type is being processed and NEVER treats
 *   cumulative readings as interval consumption (which would cause massive inflated sums).
 */

import Decimal from "decimal.js-light";
import { TimezoneNormalizationEngine, NormalizedTimestamp } from "./timezoneNormalizationEngine";

export type AmrDataModelType =
  | "INTERVAL_DATA"
  | "CUMULATIVE_METER_READINGS"
  | "HYBRID_MIXED_STREAM";

export type CumulativeRegisterType =
  | "TOTAL_ACTIVE_IMPORT_KWH"
  | "PEAK_KWH"
  | "STANDARD_KWH"
  | "OFF_PEAK_KWH"
  | "REACTIVE_IMPORT_KVARH"
  | "MAXIMUM_DEMAND_KVA"
  | "TOTAL_EXPORT_KWH";

export interface IntervalDataRecord {
  timestamp: string; // ISO 8601 UTC or SAST
  kwh: number | Decimal;
  kw?: number | Decimal;
  kva?: number | Decimal;
  kvarh?: number | Decimal;
  kvar?: number | Decimal;
  power_factor?: number | Decimal;
  meter_id?: string;
  status?: string;
}

export interface CumulativeReadingRecord {
  timestamp: string; // ISO 8601 UTC or SAST
  meter_reading: number | Decimal;
  register_type?: CumulativeRegisterType;
  meter_serial?: string;
  multiplier?: number;
  dial_digits?: number; // e.g. 6 or 7 digits (for rollover calculation: 999999 -> 0)
}

export interface DerivedIntervalConsumption {
  timestampUtc: string;
  intervalStartUtc: string;
  intervalEndUtc: string;
  intervalDurationMinutes: number;
  intervalKwh: Decimal;
  startCumulativeReading: Decimal;
  endCumulativeReading: Decimal;
  isRolloverAdjusted: boolean;
  meterSerial: string;
}

export interface AmrModelClassificationResult {
  detectedModel: AmrDataModelType;
  recordCount: number;
  isCumulativeMonotonic: boolean;
  sampleAverageKwhPerRecord: Decimal;
  diagnostic: string;
}

export interface CumulativeSeriesSummary {
  startReading: Decimal;
  endReading: Decimal;
  startTimestampUtc: string;
  endTimestampUtc: string;
  netBilledConsumptionKwh: Decimal;
  rolloverEventsDetected: number;
  derivedIntervalCount: number;
  derivedIntervals: DerivedIntervalConsumption[];
}

export class AmrDataModelEngine {
  /**
   * Identify whether an incoming telemetry array represents Interval Data or Cumulative Readings.
   */
  public static identifyDataModel(records: any[]): AmrModelClassificationResult {
    if (!Array.isArray(records) || records.length === 0) {
      return {
        detectedModel: "INTERVAL_DATA",
        recordCount: 0,
        isCumulativeMonotonic: false,
        sampleAverageKwhPerRecord: new Decimal(0),
        diagnostic: "Empty dataset, defaulting to interval model schema.",
      };
    }

    let hasExplicitCumulativeFlag = false;
    let hasExplicitIntervalFields = false;
    let validNumericValues: Decimal[] = [];

    for (let i = 0; i < Math.min(records.length, 50); i++) {
      const rec = records[i];
      if (rec.meter_reading !== undefined || rec.cumulative_kwh !== undefined || rec.isCumulative) {
        hasExplicitCumulativeFlag = true;
      }
      if (
        rec.kva !== undefined ||
        rec.kvar !== undefined ||
        rec.kvarh !== undefined ||
        rec.power_factor !== undefined
      ) {
        hasExplicitIntervalFields = true;
      }

      const val = rec.meter_reading ?? rec.kwh ?? rec.active_energy;
      if (val !== undefined && val !== null) {
        validNumericValues.push(new Decimal(String(val)));
      }
    }

    if (hasExplicitCumulativeFlag && !hasExplicitIntervalFields) {
      return {
        detectedModel: "CUMULATIVE_METER_READINGS",
        recordCount: records.length,
        isCumulativeMonotonic: true,
        sampleAverageKwhPerRecord:
          validNumericValues.length > 0 ? validNumericValues[0] : new Decimal(0),
        diagnostic: "Explicit cumulative meter_reading field detected.",
      };
    }

    if (validNumericValues.length < 3) {
      return {
        detectedModel: "INTERVAL_DATA",
        recordCount: records.length,
        isCumulativeMonotonic: false,
        sampleAverageKwhPerRecord:
          validNumericValues.length > 0 ? validNumericValues[0] : new Decimal(0),
        diagnostic: "Small sample size, standard interval model assumed.",
      };
    }

    // Monotonicity analysis
    let nonDecreasingSteps = 0;
    for (let i = 0; i < validNumericValues.length - 1; i++) {
      if (validNumericValues[i + 1].gte(validNumericValues[i])) {
        nonDecreasingSteps++;
      }
    }

    const nonDecreasingRatio = nonDecreasingSteps / (validNumericValues.length - 1);
    const firstVal = validNumericValues[0];
    const isHighRegisterValue = firstVal.gt(new Decimal(5000));

    if (nonDecreasingRatio >= 0.85 && isHighRegisterValue) {
      return {
        detectedModel: "CUMULATIVE_METER_READINGS",
        recordCount: records.length,
        isCumulativeMonotonic: true,
        sampleAverageKwhPerRecord: firstVal,
        diagnostic: `Monotonically non-decreasing high-register values (${nonDecreasingRatio * 100}% non-decreasing, base: ${firstVal.toFixed(
          0,
        )}). Classifying as CUMULATIVE_METER_READINGS.`,
      };
    }

    return {
      detectedModel: "INTERVAL_DATA",
      recordCount: records.length,
      isCumulativeMonotonic: false,
      sampleAverageKwhPerRecord: validNumericValues[0],
      diagnostic: "Classified as discrete INTERVAL_DATA.",
    };
  }

  /**
   * Safely process Cumulative Readings into derived Interval Consumption without summing counters.
   */
  public static deriveIntervalsFromCumulativeReadings(
    readings: CumulativeReadingRecord[],
    defaultMultiplier: number = 1.0,
    dialDigits: number = 6,
  ): CumulativeSeriesSummary {
    if (!readings || readings.length === 0) {
      return {
        startReading: new Decimal(0),
        endReading: new Decimal(0),
        startTimestampUtc: "",
        endTimestampUtc: "",
        netBilledConsumptionKwh: new Decimal(0),
        rolloverEventsDetected: 0,
        derivedIntervalCount: 0,
        derivedIntervals: [],
      };
    }

    // Sort chronologically using TimezoneNormalizationEngine
    const sorted = [...readings].sort(
      (a, b) =>
        TimezoneNormalizationEngine.compareTimestamps(a.timestamp, b.timestamp),
    );

    const rolloverCeiling = new Decimal(10).pow(dialDigits); // e.g. 1,000,000 for 6 digits
    const derivedList: DerivedIntervalConsumption[] = [];
    let rolloverEventsCount = 0;
    let netConsumptionKwh = new Decimal(0);

    for (let i = 0; i < sorted.length - 1; i++) {
      const prev = sorted[i];
      const curr = sorted[i + 1];

      const normPrev = TimezoneNormalizationEngine.normalizeTimestamp(prev.timestamp);
      const normCurr = TimezoneNormalizationEngine.normalizeTimestamp(curr.timestamp);

      const rPrev = new Decimal(String(prev.meter_reading));
      const rCurr = new Decimal(String(curr.meter_reading));
      const mult = new Decimal(curr.multiplier ?? prev.multiplier ?? defaultMultiplier);

      let delta = rCurr.sub(rPrev);
      let isRollover = false;

      if (delta.lt(0)) {
        // Meter rollover detected (e.g. 999990 -> 10)
        rolloverEventsCount++;
        isRollover = true;
        delta = rolloverCeiling.sub(rPrev).add(rCurr);
      }

      const intervalKwh = delta.mul(mult).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
      netConsumptionKwh = netConsumptionKwh.add(intervalKwh);

      const durationMinutes = Math.max(
        1,
        Math.round((normCurr.epochMs - normPrev.epochMs) / (60 * 1000)),
      );

      derivedList.push({
        timestampUtc: normCurr.timestampUtc,
        intervalStartUtc: normPrev.timestampUtc,
        intervalEndUtc: normCurr.timestampUtc,
        intervalDurationMinutes: durationMinutes,
        intervalKwh,
        startCumulativeReading: rPrev,
        endCumulativeReading: rCurr,
        isRolloverAdjusted: isRollover,
        meterSerial: curr.meter_serial || prev.meter_serial || "UNKNOWN",
      });
    }

    const startReading = new Decimal(String(sorted[0].meter_reading));
    const endReading = new Decimal(String(sorted[sorted.length - 1].meter_reading));
    const startTs = TimezoneNormalizationEngine.normalizeTimestamp(sorted[0].timestamp).timestampUtc;
    const endTs = TimezoneNormalizationEngine.normalizeTimestamp(
      sorted[sorted.length - 1].timestamp,
    ).timestampUtc;

    return {
      startReading,
      endReading,
      startTimestampUtc: startTs,
      endTimestampUtc: endTs,
      netBilledConsumptionKwh: netConsumptionKwh.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      rolloverEventsDetected: rolloverEventsCount,
      derivedIntervalCount: derivedList.length,
      derivedIntervals: derivedList,
    };
  }
}
