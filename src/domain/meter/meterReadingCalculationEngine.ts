/**
 * ENERA METER READING CALCULATION ENGINE (REQUIREMENT 12)
 * ======================================================
 * Deterministic cumulative meter reading consumption engine.
 *
 * CORE FORMULA:
 *   Consumption = Current Reading - Previous Reading
 *
 * CRITICAL SAFEGUARDS ("Do not blindly subtract readings"):
 *   1. Rollover: Register dial wrap-around (e.g. 999980 -> 10 past 1,000,000)
 *   2. Meter Replacement: Physical meter swap with distinct serial numbers
 *   3. Reset: Register or demand reset event to 0 or baseline
 *   4. Correction: Utility billing adjustment or reading correction
 *   5. Estimated Readings: Provisional estimates with true-up reconciliation
 */

import Decimal from "decimal.js-light";
import { TimezoneNormalizationEngine } from "../reconciliation/timezoneNormalizationEngine";

export type ReadingCalculationMethod =
  | "STANDARD_DIFFERENCE"
  | "ROLLOVER_ADJUSTED"
  | "METER_REPLACEMENT"
  | "REGISTER_RESET"
  | "READING_CORRECTION"
  | "ESTIMATED_TRUE_UP";

export interface CumulativeMeterReadingInput {
  timestamp: string | number | Date;
  reading: number | Decimal | string;
  meterSerial?: string;
  isEstimated?: boolean;
  quality?: "ACTUAL" | "ESTIMATED" | "CORRECTED" | "RESET";
  isReset?: boolean;
  resetType?: "REGISTER_RESET" | "DEMAND_RESET" | "MAINTENANCE_RESET";
  preResetReading?: number | Decimal | string;
  resetToReading?: number | Decimal | string;
  isReplacement?: boolean;
  replacedMeterSerial?: string;
  removalReadingOldMeter?: number | Decimal | string;
  commissioningReadingNewMeter?: number | Decimal | string;
  isCorrected?: boolean;
  originalUncorrectedReading?: number | Decimal | string;
  correctionFactor?: number | Decimal | string;
  correctionReason?: string;
  multiplier?: number | Decimal;
  dialDigits?: number; // e.g. 6 digits (ceiling 1,000,000) or 7 digits (ceiling 10,000,000)
}

export interface ConsumptionCalculationStep {
  stepIndex: number;
  intervalStartUtc: string;
  intervalEndUtc: string;
  durationMinutes: number;
  previousReading: Decimal;
  currentReading: Decimal;
  rawDelta: Decimal;
  multiplierApplied: Decimal;
  consumptionKwh: Decimal;
  calculationMethod: ReadingCalculationMethod;
  isRollover: boolean;
  isMeterReplacement: boolean;
  isReset: boolean;
  isCorrected: boolean;
  isEstimated: boolean;
  isEstimatedTrueUp: boolean;
  meterSerial: string;
  auditExplanation: string;
}

export interface CumulativeConsumptionResult {
  totalConsumptionKwh: Decimal;
  startReading: Decimal;
  endReading: Decimal;
  stepCount: number;
  rolloverCount: number;
  meterReplacementCount: number;
  resetCount: number;
  correctionCount: number;
  estimatedCount: number;
  steps: ConsumptionCalculationStep[];
  auditSummary: string;
}

export class MeterReadingCalculationEngine {
  public static readonly DEFAULT_DIAL_DIGITS = 6;
  public static readonly DEFAULT_MULTIPLIER = 1.0;

  /**
   * Safe calculation between two consecutive cumulative readings.
   * Does NOT blindly subtract readings; detects and resolves rollovers,
   * replacements, resets, corrections, and estimated readings.
   */
  public static calculateStepConsumption(
    prev: CumulativeMeterReadingInput,
    curr: CumulativeMeterReadingInput,
    options: {
      defaultMultiplier?: number | Decimal;
      dialDigits?: number;
      timezone?: string;
    } = {},
  ): ConsumptionCalculationStep {
    const tz = options.timezone || TimezoneNormalizationEngine.DEFAULT_TIMEZONE;
    const normPrev = TimezoneNormalizationEngine.normalizeTimestamp(prev.timestamp, tz);
    const normCurr = TimezoneNormalizationEngine.normalizeTimestamp(curr.timestamp, tz);

    const dialDigits = curr.dialDigits ?? prev.dialDigits ?? options.dialDigits ?? this.DEFAULT_DIAL_DIGITS;
    const rolloverCeiling = new Decimal(10).pow(dialDigits);

    const mult = new Decimal(
      String(curr.multiplier ?? prev.multiplier ?? options.defaultMultiplier ?? this.DEFAULT_MULTIPLIER),
    );

    let rPrev = new Decimal(String(prev.reading));
    let rCurr = new Decimal(String(curr.reading));

    const prevSerial = prev.meterSerial || "METER_UNKNOWN";
    const currSerial = curr.meterSerial || prevSerial;

    let isRollover = false;
    let isReplacement = Boolean(curr.isReplacement === true || (prev.meterSerial && curr.meterSerial && prev.meterSerial !== curr.meterSerial));
    let isReset = curr.isReset === true;
    let isCorrected = curr.isCorrected === true || prev.isCorrected === true;
    let isEstimated = curr.isEstimated === true || curr.quality === "ESTIMATED" || prev.isEstimated === true;
    let isEstimatedTrueUp = false;

    let delta = new Decimal(0);
    let calculationMethod: ReadingCalculationMethod = "STANDARD_DIFFERENCE";
    let auditExplanation = "";

    // 1. METER REPLACEMENT: Physical meter changed mid-period
    if (isReplacement) {
      calculationMethod = "METER_REPLACEMENT";
      const oldRemoval = prev.removalReadingOldMeter ? new Decimal(String(prev.removalReadingOldMeter)) : rPrev;
      const newCommissioning = curr.commissioningReadingNewMeter
        ? new Decimal(String(curr.commissioningReadingNewMeter))
        : new Decimal(0);

      const deltaOld = oldRemoval.sub(rPrev);
      const deltaNew = rCurr.sub(newCommissioning);
      delta = deltaOld.add(deltaNew);

      auditExplanation = `Meter Replacement: swapped ${prevSerial} for ${currSerial}. Old meter consumption: ${deltaOld.toString()}, New meter consumption: ${deltaNew.toString()} (total delta: ${delta.toString()}).`;
    }
    // 2. REGISTER RESET: Deliberate hardware/register zeroing
    else if (isReset) {
      calculationMethod = "REGISTER_RESET";
      const preReset = curr.preResetReading ? new Decimal(String(curr.preResetReading)) : rPrev;
      const resetTo = curr.resetToReading ? new Decimal(String(curr.resetToReading)) : new Decimal(0);

      const deltaBeforeReset = preReset.sub(rPrev);
      const deltaAfterReset = rCurr.sub(resetTo);
      delta = deltaBeforeReset.add(deltaAfterReset);

      auditExplanation = `Register Reset (${curr.resetType || "REGISTER_RESET"}): Consumption before reset (${deltaBeforeReset.toString()}) + after reset (${deltaAfterReset.toString()}) = ${delta.toString()}.`;
    }
    // 3. READING CORRECTION: Amended / corrected reading used
    else if (isCorrected) {
      calculationMethod = "READING_CORRECTION";
      delta = rCurr.sub(rPrev);
      const orig = curr.originalUncorrectedReading !== undefined ? new Decimal(String(curr.originalUncorrectedReading)) : null;
      auditExplanation = orig
        ? `Correction Applied: amended reading from uncorrected ${orig.toString()} to ${rCurr.toString()}. Reason: ${
            curr.correctionReason || "Utility dial transcription correction"
          }. Corrected delta: ${delta.toString()}.`
        : `Correction Applied: ${curr.correctionReason || "Utility dial reading corrected"}. Corrected delta: ${delta.toString()}.`;
    }
    // 4. ROLLOVER / ESTIMATED TRUE-UP: Reading decreased (rCurr < rPrev)
    else if (rCurr.lt(rPrev)) {
      if (prev.isEstimated && !curr.isEstimated) {
        // Previous was estimated and overshot the actual current reading
        isEstimatedTrueUp = true;
        calculationMethod = "ESTIMATED_TRUE_UP";
        // True-up: do not produce negative consumption; adjust delta to zero or true net
        delta = new Decimal(0);
        auditExplanation = `Estimated True-Up: Previous estimated reading (${rPrev.toString()}) exceeded subsequent actual reading (${rCurr.toString()}). Delta clamped to 0 to prevent negative billing.`;
      } else {
        // Physical dial rollover wrap-around
        isRollover = true;
        calculationMethod = "ROLLOVER_ADJUSTED";
        delta = rolloverCeiling.sub(rPrev).add(rCurr);
        auditExplanation = `Dial Rollover (${dialDigits}-digit ceiling ${rolloverCeiling.toString()}): wrapped from ${rPrev.toString()} past 0 to ${rCurr.toString()}. True delta = ${delta.toString()}.`;
      }
    }
    // 5. STANDARD DIFFERENCE
    else {
      delta = rCurr.sub(rPrev);
      if (isEstimated) {
        calculationMethod = "STANDARD_DIFFERENCE";
        auditExplanation = `Estimated Step: Standard difference (${rCurr.toString()} - ${rPrev.toString()} = ${delta.toString()}) marked as estimated.`;
      } else {
        calculationMethod = "STANDARD_DIFFERENCE";
        auditExplanation = `Standard Difference: ${rCurr.toString()} - ${rPrev.toString()} = ${delta.toString()}.`;
      }
    }

    const consumptionKwh = delta.mul(mult).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
    const durationMinutes = Math.max(
      1,
      Math.round((normCurr.epochMs - normPrev.epochMs) / (60 * 1000)),
    );

    return {
      stepIndex: 0,
      intervalStartUtc: normPrev.timestampUtc,
      intervalEndUtc: normCurr.timestampUtc,
      durationMinutes,
      previousReading: rPrev,
      currentReading: rCurr,
      rawDelta: delta,
      multiplierApplied: mult,
      consumptionKwh,
      calculationMethod,
      isRollover,
      isMeterReplacement: isReplacement,
      isReset,
      isCorrected,
      isEstimated,
      isEstimatedTrueUp,
      meterSerial: currSerial,
      auditExplanation,
    };
  }

  /**
   * Calculate total consumption over a series of cumulative readings.
   * Correctly sequences and handles rollovers, replacements, resets, corrections,
   * and estimated true-ups.
   */
  public static calculateSeriesConsumption(
    readings: CumulativeMeterReadingInput[],
    options: {
      defaultMultiplier?: number | Decimal;
      dialDigits?: number;
      timezone?: string;
    } = {},
  ): CumulativeConsumptionResult {
    if (!readings || readings.length === 0) {
      return {
        totalConsumptionKwh: new Decimal(0),
        startReading: new Decimal(0),
        endReading: new Decimal(0),
        stepCount: 0,
        rolloverCount: 0,
        meterReplacementCount: 0,
        resetCount: 0,
        correctionCount: 0,
        estimatedCount: 0,
        steps: [],
        auditSummary: "Empty cumulative reading dataset provided.",
      };
    }

    // Sort chronologically using TimezoneNormalizationEngine
    const sorted = [...readings].sort((a, b) =>
      TimezoneNormalizationEngine.compareTimestamps(a.timestamp, b.timestamp),
    );

    if (sorted.length === 1) {
      const single = new Decimal(String(sorted[0].reading));
      return {
        totalConsumptionKwh: new Decimal(0),
        startReading: single,
        endReading: single,
        stepCount: 0,
        rolloverCount: 0,
        meterReplacementCount: 0,
        resetCount: 0,
        correctionCount: 0,
        estimatedCount: 0,
        steps: [],
        auditSummary: "Single baseline reading provided. Net consumption = 0 kWh.",
      };
    }

    const steps: ConsumptionCalculationStep[] = [];
    let totalKwh = new Decimal(0);
    let rolloverCount = 0;
    let replacementCount = 0;
    let resetCount = 0;
    let correctionCount = 0;
    let estimatedCount = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
      const step = this.calculateStepConsumption(sorted[i], sorted[i + 1], options);
      step.stepIndex = i + 1;

      if (step.isRollover) rolloverCount++;
      if (step.isMeterReplacement) replacementCount++;
      if (step.isReset) resetCount++;
      if (step.isCorrected) correctionCount++;
      if (step.isEstimated) estimatedCount++;

      totalKwh = totalKwh.add(step.consumptionKwh);
      steps.push(step);
    }

    const startReading = new Decimal(String(sorted[0].reading));
    const endReading = new Decimal(String(sorted[sorted.length - 1].reading));

    const auditSummary =
      `Processed ${steps.length} cumulative intervals: Net Consumption = ${totalKwh.toFixed(2)} kWh. ` +
      `Special Events: Rollovers: ${rolloverCount}, Replacements: ${replacementCount}, ` +
      `Resets: ${resetCount}, Corrections: ${correctionCount}, Estimates: ${estimatedCount}.`;

    return {
      totalConsumptionKwh: totalKwh.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      startReading,
      endReading,
      stepCount: steps.length,
      rolloverCount,
      meterReplacementCount: replacementCount,
      resetCount,
      correctionCount,
      estimatedCount,
      steps,
      auditSummary,
    };
  }
}
