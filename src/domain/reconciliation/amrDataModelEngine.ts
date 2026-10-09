/**
 * ENERA AMR DATA MODEL ENGINE (REQUIREMENT 10)
 * ============================================
 * Formal dual-model architecture supporting:
 *   1. Interval Data (Discrete period consumption: timestamp, kWh, kW, kVA, kVArh, kVAr, power_factor)
 *   2. Cumulative Meter Readings (Continuous meter dials: timestamp, meter_reading)
 *
 * NON-CONFLATION PRINCIPLE:
 *   The engine explicitly identifies which type is being processed and NEVER treats
 *   cumulative readings as interval consumption (which would cause massive inflated sums).
 */

import Decimal from "decimal.js-light";
import { TimezoneNormalizationEngine, NormalizedTimestamp } from "./timezoneNormalizationEngine";
import {
  MeterReadingCalculationEngine,
  CumulativeMeterReadingInput,
} from "../meter/meterReadingCalculationEngine";
import {
  UnitNormalisationEngine,
  SupportedUnit,
  UnitConversionRecord,
} from "../meter/unitNormalisationEngine";

export {
  MeterReadingCalculationEngine,
  UnitNormalisationEngine,
};
export type {
  CumulativeMeterReadingInput,
  SupportedUnit,
  UnitConversionRecord,
};

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

/**
 * Requirement 10: Interval Data Contract
 * Explicitly supports timestamp, kWh, kW, kVA, kVArh, kVAr, and power_factor.
 */
export interface IntervalDataRecord {
  timestamp: string | number | Date; // ISO 8601 UTC or SAST
  // Primary canonical casing (as defined in Requirement 10):
  kWh?: number | Decimal | string;
  kW?: number | Decimal | string;
  kVA?: number | Decimal | string;
  kVArh?: number | Decimal | string;
  kVAr?: number | Decimal | string;
  power_factor?: number | Decimal | string;
  // Case-tolerant aliases for maximum system interoperability:
  kwh?: number | Decimal | string;
  kw?: number | Decimal | string;
  kva?: number | Decimal | string;
  kvarh?: number | Decimal | string;
  kvar?: number | Decimal | string;
  powerFactor?: number | Decimal | string;
  pf?: number | Decimal | string;
  meter_id?: string;
  meter_serial?: string;
  status?: string;
}

/**
 * Requirement 10: Cumulative Meter Readings Contract
 * Explicitly supports timestamp and meter_reading.
 */
export interface CumulativeReadingRecord {
  timestamp: string | number | Date; // ISO 8601 UTC or SAST
  // Primary canonical field (as defined in Requirement 10):
  meter_reading: number | Decimal | string;
  // Case-tolerant aliases:
  meterReading?: number | Decimal | string;
  reading?: number | Decimal | string;
  cumulative_kwh?: number | Decimal | string;
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

export interface NormalizedIntervalRecord {
  timestampUtc: string;
  timestampLocal: string;
  timezone: string;
  kWh: Decimal;
  kW: Decimal;
  kVA: Decimal;
  kVArh: Decimal;
  kVAr: Decimal;
  power_factor: Decimal;
  meter_id?: string;
  status?: string;
  isEstimated: boolean;
}

export interface AmrModelClassificationResult {
  detectedModel: AmrDataModelType;
  recordCount: number;
  confidence: number; // 0.0 to 1.0
  reasons: string[];
  fieldSignatures: {
    hasTimestamp: boolean;
    hasKwh: boolean;
    hasKw: boolean;
    hasKva: boolean;
    hasKvarh: boolean;
    hasKvar: boolean;
    hasPowerFactor: boolean;
    hasMeterReading: boolean;
  };
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

export interface ProcessedAmrDataset {
  dataModel: AmrDataModelType;
  recordCount: number;
  isCumulativeConflationPrevented: boolean;
  summary: {
    totalActiveKwh: Decimal;
    peakDemandKva: Decimal;
    peakDemandKw: Decimal;
    totalReactiveKvarh: Decimal;
    averagePowerFactor: Decimal;
    startTimestampUtc: string;
    endTimestampUtc: string;
  };
  intervals: NormalizedIntervalRecord[];
  cumulativeSeries?: CumulativeSeriesSummary;
  diagnostics: string[];
}

export class AmrDataModelEngine {
  /**
   * Helper to safely extract a numeric decimal value from an object checking multiple property name variants.
   */
  private static extractDecimal(obj: any, keys: string[]): Decimal | null {
    if (!obj || typeof obj !== "object") return null;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
        try {
          return new Decimal(String(obj[k]));
        } catch {
          // ignore parsing error and continue
        }
      }
    }
    return null;
  }

  /**
   * Identify whether an incoming telemetry array represents Interval Data or Cumulative Readings.
   * Examines field presence, structural flags, and value monotonicity.
   */
  public static identifyDataModel(records: any[]): AmrModelClassificationResult {
    const reasons: string[] = [];
    const fieldSignatures = {
      hasTimestamp: false,
      hasKwh: false,
      hasKw: false,
      hasKva: false,
      hasKvarh: false,
      hasKvar: false,
      hasPowerFactor: false,
      hasMeterReading: false,
    };

    if (!Array.isArray(records) || records.length === 0) {
      return {
        detectedModel: "INTERVAL_DATA",
        recordCount: 0,
        confidence: 0.5,
        reasons: ["Empty dataset provided, defaulting to interval model schema."],
        fieldSignatures,
        isCumulativeMonotonic: false,
        sampleAverageKwhPerRecord: new Decimal(0),
        diagnostic: "Empty dataset, defaulting to interval model schema.",
      };
    }

    let cumulativeIndicatorCount = 0;
    let intervalFieldOccurrenceCount = 0;
    const sampleValues: Decimal[] = [];

    const sampleLimit = Math.min(records.length, 100);
    for (let i = 0; i < sampleLimit; i++) {
      const rec = records[i];
      if (!rec || typeof rec !== "object") continue;

      if (rec.timestamp !== undefined || rec.time !== undefined || rec.date !== undefined) {
        fieldSignatures.hasTimestamp = true;
      }

      // Check cumulative fields
      if (
        rec.meter_reading !== undefined ||
        rec.meterReading !== undefined ||
        rec.reading !== undefined ||
        rec.cumulative_kwh !== undefined ||
        rec.cumulativeReading !== undefined ||
        rec.isCumulative === true
      ) {
        fieldSignatures.hasMeterReading = true;
        cumulativeIndicatorCount++;
      }

      // Check interval fields (with exact and case-tolerant naming)
      if (rec.kWh !== undefined || rec.kwh !== undefined || rec.active_energy !== undefined) {
        fieldSignatures.hasKwh = true;
      }
      if (rec.kW !== undefined || rec.kw !== undefined || rec.active_power !== undefined) {
        fieldSignatures.hasKw = true;
        intervalFieldOccurrenceCount++;
      }
      if (rec.kVA !== undefined || rec.kva !== undefined || rec.apparent_power !== undefined) {
        fieldSignatures.hasKva = true;
        intervalFieldOccurrenceCount++;
      }
      if (rec.kVArh !== undefined || rec.kvarh !== undefined || rec.reactive_energy !== undefined) {
        fieldSignatures.hasKvarh = true;
        intervalFieldOccurrenceCount++;
      }
      if (rec.kVAr !== undefined || rec.kvar !== undefined || rec.reactive_power !== undefined) {
        fieldSignatures.hasKvar = true;
        intervalFieldOccurrenceCount++;
      }
      if (
        rec.power_factor !== undefined ||
        rec.powerFactor !== undefined ||
        rec.pf !== undefined
      ) {
        fieldSignatures.hasPowerFactor = true;
        intervalFieldOccurrenceCount++;
      }

      const val =
        this.extractDecimal(rec, ["meter_reading", "meterReading", "reading", "cumulative_kwh"]) ??
        this.extractDecimal(rec, ["kWh", "kwh", "active_energy"]);

      if (val !== null) {
        sampleValues.push(val);
      }
    }

    // Explicit Cumulative field detected with NO interval-specific parameters (kW/kVA/kVAr/power_factor)
    if (fieldSignatures.hasMeterReading && intervalFieldOccurrenceCount === 0) {
      reasons.push("Explicit cumulative 'meter_reading' field detected across dataset.");
      return {
        detectedModel: "CUMULATIVE_METER_READINGS",
        recordCount: records.length,
        confidence: 0.99,
        reasons,
        fieldSignatures,
        isCumulativeMonotonic: true,
        sampleAverageKwhPerRecord: sampleValues[0] ?? new Decimal(0),
        diagnostic: "Explicit cumulative meter_reading field detected. Must NOT be treated as interval consumption.",
      };
    }

    // Explicit Interval multi-parameter presence
    if (intervalFieldOccurrenceCount > 0) {
      reasons.push(
        `Discrete electrical interval parameters detected (kW: ${fieldSignatures.hasKw}, kVA: ${fieldSignatures.hasKva}, kVArh: ${fieldSignatures.hasKvarh}, kVAr: ${fieldSignatures.hasKvar}, power_factor: ${fieldSignatures.hasPowerFactor}).`,
      );
      return {
        detectedModel: "INTERVAL_DATA",
        recordCount: records.length,
        confidence: 0.98,
        reasons,
        fieldSignatures,
        isCumulativeMonotonic: false,
        sampleAverageKwhPerRecord: sampleValues[0] ?? new Decimal(0),
        diagnostic: "Discrete electrical interval parameters (kW, kVA, kVArh, kVAr, power_factor) present.",
      };
    }

    // Monotonicity analysis on single values
    if (sampleValues.length >= 3) {
      let nonDecreasingSteps = 0;
      for (let i = 0; i < sampleValues.length - 1; i++) {
        if (sampleValues[i + 1].gte(sampleValues[i])) {
          nonDecreasingSteps++;
        }
      }

      const nonDecreasingRatio = nonDecreasingSteps / (sampleValues.length - 1);
      const firstVal = sampleValues[0];
      const isHighRegisterValue = firstVal.gt(new Decimal(5000));

      if (nonDecreasingRatio >= 0.85 && isHighRegisterValue) {
        reasons.push(
          `Values are ${Math.round(nonDecreasingRatio * 100)}% non-decreasing with large base magnitude (${firstVal.toFixed(0)}), indicating cumulative register dial counters.`,
        );
        return {
          detectedModel: "CUMULATIVE_METER_READINGS",
          recordCount: records.length,
          confidence: 0.92,
          reasons,
          fieldSignatures,
          isCumulativeMonotonic: true,
          sampleAverageKwhPerRecord: firstVal,
          diagnostic: `Monotonically non-decreasing high-register values (${Math.round(
            nonDecreasingRatio * 100,
          )}% non-decreasing, base: ${firstVal.toFixed(0)}). Classifying as CUMULATIVE_METER_READINGS.`,
        };
      }
    }

    reasons.push("Values and fields align with standard discrete period consumption intervals.");
    return {
      detectedModel: "INTERVAL_DATA",
      recordCount: records.length,
      confidence: 0.90,
      reasons,
      fieldSignatures,
      isCumulativeMonotonic: false,
      sampleAverageKwhPerRecord: sampleValues[0] ?? new Decimal(0),
      diagnostic: "Classified as discrete INTERVAL_DATA.",
    };
  }

  /**
   * Non-conflation guard: Verifies that cumulative readings are NEVER treated as interval consumption.
   * Throws an explicit error if a dataset is identified as cumulative readings when interval data is expected.
   */
  public static assertNotCumulativeConflation(
    records: any[],
    callingMethodName: string = "intervalAggregation",
  ): void {
    const classification = this.identifyDataModel(records);
    if (classification.detectedModel === "CUMULATIVE_METER_READINGS") {
      throw new Error(
        `[AmrDataModelEngine] Non-Conflation Violation in ${callingMethodName}: ` +
          `Detected CUMULATIVE_METER_READINGS stream. Cumulative dial readings cannot be summed directly as interval consumption. ` +
          `Use deriveIntervalsFromCumulativeReadings() or processAmrDataset() to compute delta consumption. ` +
          `Details: ${classification.diagnostic}`,
      );
    }
  }

  /**
   * Normalize an array of discrete Interval Data records.
   * Extracts and validates: timestamp, kWh, kW, kVA, kVArh, kVAr, power_factor.
   */
  public static normalizeIntervalData(
    records: IntervalDataRecord[] | any[],
    timezone: string = TimezoneNormalizationEngine.DEFAULT_TIMEZONE,
  ): NormalizedIntervalRecord[] {
    const normalized: NormalizedIntervalRecord[] = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || typeof rec !== "object") continue;

      const normTs = TimezoneNormalizationEngine.normalizeTimestamp(rec.timestamp, timezone);

      // Extract electrical values
      const kwh = this.extractDecimal(rec, ["kWh", "kwh", "active_energy"]) ?? new Decimal(0);
      let kw = this.extractDecimal(rec, ["kW", "kw", "active_power"]);
      let kva = this.extractDecimal(rec, ["kVA", "kva", "apparent_power"]);
      const kvarh = this.extractDecimal(rec, ["kVArh", "kvarh", "reactive_energy"]) ?? new Decimal(0);
      let kvar = this.extractDecimal(rec, ["kVAr", "kvar", "reactive_power"]);
      let pf = this.extractDecimal(rec, ["power_factor", "powerFactor", "pf"]);

      // Implied conversions if individual parameters are omitted
      if (kw === null) {
        // Assume standard 30-min interval: kW = kWh * 2
        kw = kwh.mul(2);
      }
      if (kvar === null) {
        // Assume standard 30-min interval: kVAr = kVArh * 2
        kvar = kvarh.mul(2);
      }
      if (kva === null) {
        // Derived apparent power: kVA = sqrt(kW^2 + kVAr^2)
        const kwSq = kw.mul(kw);
        const kvarSq = kvar.mul(kvar);
        const kvaVal = Math.sqrt(kwSq.add(kvarSq).toNumber());
        kva = new Decimal(isNaN(kvaVal) ? 0 : kvaVal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
      if (pf === null) {
        if (kva.gt(0)) {
          const calculatedPf = kw.div(kva).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
          pf = calculatedPf.gt(1.0) ? new Decimal(1.0) : calculatedPf;
        } else {
          pf = new Decimal(1.0);
        }
      }

      const statusUpper = String(rec.status || "").toUpperCase();
      const isEstimated =
        statusUpper.includes("EST") ||
        statusUpper.includes("INTERPOL") ||
        statusUpper.includes("SUBSTITUT") ||
        statusUpper.includes("DERIVED");

      normalized.push({
        timestampUtc: normTs.timestampUtc,
        timestampLocal: normTs.localDateTimeString,
        timezone: normTs.timezone,
        kWh: kwh.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        kW: kw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        kVA: kva.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        kVArh: kvarh.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
        kVAr: kvar.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        power_factor: pf.toDecimalPlaces(3, Decimal.ROUND_HALF_UP),
        meter_id: rec.meter_id || rec.meter_serial,
        status: rec.status || "ACTUAL",
        isEstimated,
      });
    }

    return normalized;
  }

  /**
   * Safely process Cumulative Readings into derived Interval Consumption without summing counters.
   * Handles meter rollovers (e.g. 999990 -> 10) and applies multipliers.
   */
  public static deriveIntervalsFromCumulativeReadings(
    readings: CumulativeReadingRecord[] | any[],
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

    // Map raw/cumulative objects to CumulativeMeterReadingInput
    const mappedInputs: CumulativeMeterReadingInput[] = readings.map((r) => ({
      timestamp: r.timestamp,
      reading:
        this.extractDecimal(r, ["meter_reading", "meterReading", "reading", "cumulative_kwh"]) ??
        new Decimal(0),
      meterSerial: r.meter_serial || r.meterSerial,
      isEstimated: r.isEstimated,
      quality: r.quality,
      isReset: r.isReset,
      resetType: r.resetType,
      preResetReading: r.preResetReading,
      resetToReading: r.resetToReading,
      isReplacement: r.isReplacement,
      replacedMeterSerial: r.replacedMeterSerial,
      removalReadingOldMeter: r.removalReadingOldMeter,
      commissioningReadingNewMeter: r.commissioningReadingNewMeter,
      isCorrected: r.isCorrected,
      originalUncorrectedReading: r.originalUncorrectedReading,
      correctionFactor: r.correctionFactor,
      correctionReason: r.correctionReason,
      multiplier: r.multiplier ?? defaultMultiplier,
      dialDigits: r.dial_digits ?? r.dialDigits ?? dialDigits,
    }));

    const result = MeterReadingCalculationEngine.calculateSeriesConsumption(mappedInputs, {
      defaultMultiplier,
      dialDigits,
    });

    const derivedList: DerivedIntervalConsumption[] = result.steps.map((s) => ({
      timestampUtc: s.intervalEndUtc,
      intervalStartUtc: s.intervalStartUtc,
      intervalEndUtc: s.intervalEndUtc,
      intervalDurationMinutes: s.durationMinutes,
      intervalKwh: s.consumptionKwh,
      startCumulativeReading: s.previousReading,
      endCumulativeReading: s.currentReading,
      isRolloverAdjusted: s.isRollover,
      meterSerial: s.meterSerial,
    }));

    const startTs = result.steps.length > 0 ? result.steps[0].intervalStartUtc : "";
    const endTs =
      result.steps.length > 0 ? result.steps[result.steps.length - 1].intervalEndUtc : "";

    return {
      startReading: result.startReading,
      endReading: result.endReading,
      startTimestampUtc: startTs,
      endTimestampUtc: endTs,
      netBilledConsumptionKwh: result.totalConsumptionKwh,
      rolloverEventsDetected: result.rolloverCount,
      derivedIntervalCount: derivedList.length,
      derivedIntervals: derivedList,
    };
  }

  /**
   * Unified Processor for any incoming AMR telemetry dataset.
   * Identifies model type, applies non-conflation rules, and returns consistent normalized intervals.
   */
  public static processDataset(
    records: any[],
    options: {
      defaultMultiplier?: number;
      dialDigits?: number;
      timezone?: string;
    } = {},
  ): ProcessedAmrDataset {
    const tz = options.timezone || TimezoneNormalizationEngine.DEFAULT_TIMEZONE;
    const classification = this.identifyDataModel(records);
    const diagnostics: string[] = [classification.diagnostic];

    if (classification.detectedModel === "CUMULATIVE_METER_READINGS") {
      diagnostics.push(
        "NON-CONFLATION ENFORCED: Converted cumulative dial meter readings into derived interval deltas.",
      );
      const cumSeries = this.deriveIntervalsFromCumulativeReadings(
        records,
        options.defaultMultiplier ?? 1.0,
        options.dialDigits ?? 6,
      );

      // Convert derived intervals to normalized interval records
      const intervals: NormalizedIntervalRecord[] = cumSeries.derivedIntervals.map((d) => {
        const norm = TimezoneNormalizationEngine.normalizeTimestamp(d.timestampUtc, tz);
        const impliedKw = d.intervalKwh.mul(60 / d.intervalDurationMinutes);
        return {
          timestampUtc: norm.timestampUtc,
          timestampLocal: norm.localDateTimeString,
          timezone: tz,
          kWh: d.intervalKwh,
          kW: impliedKw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          kVA: impliedKw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
          kVArh: new Decimal(0),
          kVAr: new Decimal(0),
          power_factor: new Decimal(1.0),
          meter_id: d.meterSerial,
          status: d.isRolloverAdjusted ? "ROLLOVER_ADJUSTED" : "DERIVED",
          isEstimated: false,
        };
      });

      let peakDemandKw = new Decimal(0);
      for (const inv of intervals) {
        if (inv.kW.gt(peakDemandKw)) peakDemandKw = inv.kW;
      }

      return {
        dataModel: "CUMULATIVE_METER_READINGS",
        recordCount: records.length,
        isCumulativeConflationPrevented: true,
        summary: {
          totalActiveKwh: cumSeries.netBilledConsumptionKwh,
          peakDemandKva: peakDemandKw,
          peakDemandKw,
          totalReactiveKvarh: new Decimal(0),
          averagePowerFactor: new Decimal(1.0),
          startTimestampUtc: cumSeries.startTimestampUtc,
          endTimestampUtc: cumSeries.endTimestampUtc,
        },
        intervals,
        cumulativeSeries: cumSeries,
        diagnostics,
      };
    }

    // Discrete Interval Data
    const intervals = this.normalizeIntervalData(records, tz);
    let totalKwh = new Decimal(0);
    let peakKva = new Decimal(0);
    let peakKw = new Decimal(0);
    let totalKvarh = new Decimal(0);
    let pfSum = new Decimal(0);

    for (const inv of intervals) {
      totalKwh = totalKwh.add(inv.kWh);
      if (inv.kVA.gt(peakKva)) peakKva = inv.kVA;
      if (inv.kW.gt(peakKw)) peakKw = inv.kW;
      totalKvarh = totalKvarh.add(inv.kVArh);
      pfSum = pfSum.add(inv.power_factor);
    }

    const avgPf =
      intervals.length > 0
        ? pfSum.div(intervals.length).toDecimalPlaces(3, Decimal.ROUND_HALF_UP)
        : new Decimal(1.0);

    const startTs = intervals.length > 0 ? intervals[0].timestampUtc : "";
    const endTs = intervals.length > 0 ? intervals[intervals.length - 1].timestampUtc : "";

    return {
      dataModel: "INTERVAL_DATA",
      recordCount: records.length,
      isCumulativeConflationPrevented: true,
      summary: {
        totalActiveKwh: totalKwh.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        peakDemandKva: peakKva.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        peakDemandKw: peakKw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        totalReactiveKvarh: totalKvarh.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
        averagePowerFactor: avgPf,
        startTimestampUtc: startTs,
        endTimestampUtc: endTs,
      },
      intervals,
      diagnostics,
    };
  }
}
