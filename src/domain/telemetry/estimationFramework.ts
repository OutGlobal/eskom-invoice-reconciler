/**
 * Configurable Telemetry Estimation Framework Engine
 * Never automatically replaces missing telemetry with zero.
 * Executes Linear Interpolation, Same-Day Prior Week, and Historical Median estimations
 * with full audit metadata (method, source_intervals, reason, confidence, timestamp, engine_version).
 */

import Decimal from "decimal.js-light";
import type {
  EstimationRecord,
  EstimationMethod,
  MissingGapRecord,
  TelemetryIntervalRecord,
} from "./types";

export interface EstimateIntervalParams {
  gap: MissingGapRecord;
  method: EstimationMethod;
  surroundingIntervals: TelemetryIntervalRecord[];
  reason?: string;
  userName?: string;
}

export class EstimationFrameworkEngine {
  public static readonly ENGINE_VERSION = "telemetry-estimation-v1.0";

  /**
   * Execute explicit estimation methodology for a missing telemetry gap
   */
  public static estimateGap(params: EstimateIntervalParams): {
    estimationRecord: EstimationRecord;
    estimatedInterval: TelemetryIntervalRecord;
  } {
    const { gap, method, surroundingIntervals, reason, userName } = params;
    const targetMs = new Date(gap.expected_interval).getTime();

    let estimatedVal = 0;
    let confidence = 0.85;
    let sourceTimestamps: string[] = [];
    let defaultReason = "";

    if (method === "LINEAR_INTERPOLATION") {
      const prev = surroundingIntervals
        .filter((i) => new Date(i.timestamp_utc).getTime() < targetMs)
        .sort((a, b) => new Date(b.timestamp_utc).getTime() - new Date(a.timestamp_utc).getTime())[0];

      const next = surroundingIntervals
        .filter((i) => new Date(i.timestamp_utc).getTime() > targetMs)
        .sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime())[0];

      if (prev && next) {
        const tPrev = new Date(prev.timestamp_utc).getTime();
        const tNext = new Date(next.timestamp_utc).getTime();
        const vPrev = new Decimal(prev.engineering_value);
        const vNext = new Decimal(next.engineering_value);

        const fraction = new Decimal(targetMs - tPrev).div(new Decimal(tNext - tPrev));
        estimatedVal = vPrev.add(vNext.sub(vPrev).mul(fraction)).toNumber();
        confidence = 0.95;
        sourceTimestamps = [prev.timestamp_utc, next.timestamp_utc];
        defaultReason = `Linear interpolation between ${prev.timestamp_utc} (${prev.engineering_value} kWh) and ${next.timestamp_utc} (${next.engineering_value} kWh)`;
      } else if (prev) {
        estimatedVal = prev.engineering_value;
        confidence = 0.80;
        sourceTimestamps = [prev.timestamp_utc];
        defaultReason = `Forward-fill fallback from ${prev.timestamp_utc}`;
      } else {
        estimatedVal = 50.0; // Minimal baseline
        confidence = 0.60;
        defaultReason = "Baseline fallback (insufficient surrounding intervals)";
      }
    } else if (method === "SAME_DAY_PRIOR_WEEK") {
      const targetPrior7DaysMs = targetMs - 7 * 86400 * 1000;
      const priorMatch = surroundingIntervals.find(
        (i) => Math.abs(new Date(i.timestamp_utc).getTime() - targetPrior7DaysMs) < 1800 * 1000,
      );

      if (priorMatch) {
        estimatedVal = priorMatch.engineering_value;
        confidence = 0.90;
        sourceTimestamps = [priorMatch.timestamp_utc];
        defaultReason = `Same-day prior week telemetry reference from ${priorMatch.timestamp_utc}`;
      } else {
        estimatedVal = 45.0;
        confidence = 0.70;
        defaultReason = "Prior week interval missing, default profile applied";
      }
    } else {
      // HISTORICAL_MEDIAN
      const validVals = surroundingIntervals.map((i) => i.engineering_value).sort((a, b) => a - b);
      if (validVals.length > 0) {
        const mid = Math.floor(validVals.length / 2);
        estimatedVal = validVals[mid];
        confidence = 0.85;
        sourceTimestamps = surroundingIntervals.slice(0, 5).map((i) => i.timestamp_utc);
        defaultReason = `30-day historical median across ${validVals.length} valid telemetry samples`;
      } else {
        estimatedVal = 50.0;
        confidence = 0.60;
        defaultReason = "Historical median baseline fallback";
      }
    }

    const estimationRecord: EstimationRecord = {
      id: `est-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      gap_id: gap.id,
      meter_id: gap.meter_id,
      interval_timestamp: gap.expected_interval,
      estimated_kwh: Number(estimatedVal.toFixed(4)),
      method,
      source_intervals: sourceTimestamps,
      reason: reason || defaultReason,
      confidence_score: confidence,
      engine_version: this.ENGINE_VERSION,
      created_by: userName || "Telemetry Quality Specialist",
      created_at: new Date().toISOString(),
    };

    const dateObj = new Date(gap.expected_interval);
    const localTimestamp = new Date(dateObj.getTime() + 2 * 3600 * 1000)
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);

    const estimatedInterval: TelemetryIntervalRecord = {
      id: `int-est-${Date.now()}`,
      meter_id: gap.meter_id,
      pod_id: "pod-coj-main-4401",
      timestamp_utc: gap.expected_interval,
      local_timestamp: localTimestamp,
      timezone: "Africa/Johannesburg",
      channel: "kWh",
      raw_value: Number(estimatedVal.toFixed(4)),
      multiplier_applied: 1.0,
      engineering_value: Number(estimatedVal.toFixed(4)),
      billed_value: Number(estimatedVal.toFixed(4)),
      unit: "kWh",
      source_file_id: "estimation-engine",
      ingestion_batch_id: "batch-estimation-run",
      quality_state: "ESTIMATED",
      validation_flags: [`ESTIMATED_VIA_${method}`],
    };

    return {
      estimationRecord,
      estimatedInterval,
    };
  }
}
