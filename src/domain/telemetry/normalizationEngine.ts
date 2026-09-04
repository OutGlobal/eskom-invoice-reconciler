/**
 * Enterprise Telemetry Normalization Engine
 * Eskom Management Platform — Canonical Transformation, Cumulative Deltas, Rollovers & Gap Analysis
 */

import type {
  CanonicalTelemetryRecord,
  ParsedRawInterval,
  ParserOptions,
  TelemetryGapEvent,
  TelemetryQualityStatus,
} from "./types";
import { ParserRegistry } from "./parserRegistry";

export interface NormalizationResult {
  records: CanonicalTelemetryRecord[];
  gapEvents: TelemetryGapEvent[];
  totalRawRows: number;
  duplicateCount: number;
  estimatedCount: number;
  suspectCount: number;
  rolloverCount: number;
  intervalMinutes: 15 | 30;
}

export class TelemetryNormalizationEngine {
  /**
   * Normalizes raw file content using parser adapter architecture and applies data-quality controls
   */
  public static normalizeTelemetry(
    filename: string,
    content: string,
    options?: ParserOptions,
  ): NormalizationResult {
    const meterId = options?.meterId || "7856504226";
    const sourceFileId = options?.sourceFileId || `src-file-${Date.now()}`;

    // Step 1: Select parser adapter
    const parser = ParserRegistry.selectParser(filename, content);
    const rawIntervals = parser.parseContent(content, options);

    const records: CanonicalTelemetryRecord[] = [];
    const gapEvents: TelemetryGapEvent[] = [];
    const timestampMap = new Map<string, CanonicalTelemetryRecord>();

    let duplicateCount = 0;
    let estimatedCount = 0;
    let suspectCount = 0;
    let rolloverCount = 0;

    // Detect cumulative vs interval-based readings
    const hasCumulativeData = rawIntervals.some((r) => r.cumulativeKwh !== undefined);
    let prevCumulativeKwh: number | null = null;
    const MAX_REGISTER_CAP = 1000000; // 1,000,000 kWh dial reset ceiling

    // Detect interval minutes (15 vs 30 min)
    let detectedIntervalMinutes: 15 | 30 = 30;
    const validTimestamps: Date[] = [];

    for (const r of rawIntervals) {
      const parsedDate = new Date(r.timestampStr.replace(/\//g, "-"));
      if (!isNaN(parsedDate.getTime())) {
        validTimestamps.push(parsedDate);
      }
    }

    if (validTimestamps.length >= 2) {
      const diffMs = Math.abs(validTimestamps[1].getTime() - validTimestamps[0].getTime());
      if (diffMs <= 18 * 60 * 1000) {
        detectedIntervalMinutes = 15;
      }
    }

    // Process & Normalize Interval Records
    for (let i = 0; i < rawIntervals.length; i++) {
      const raw = rawIntervals[i];
      const parsedDate = new Date(raw.timestampStr.replace(/\//g, "-"));

      if (isNaN(parsedDate.getTime())) {
        suspectCount++;
        continue;
      }

      const isoUtc = parsedDate.toISOString();
      const localTs = parsedDate.toISOString().replace("T", " ").substring(0, 19);

      let activeEnergyKwh = 0;
      let activePowerKw = 0;
      let qualityStatus: TelemetryQualityStatus = "measured";

      // Cumulative Register Delta & Rollover Logic
      if (hasCumulativeData && raw.cumulativeKwh !== undefined) {
        if (prevCumulativeKwh !== null) {
          if (raw.cumulativeKwh < prevCumulativeKwh) {
            // Rollover / Reset Detected!
            rolloverCount++;
            qualityStatus = "rollover";
            const delta = MAX_REGISTER_CAP - prevCumulativeKwh + raw.cumulativeKwh;
            activeEnergyKwh = Math.max(0, delta);
            activePowerKw = activeEnergyKwh * (60 / detectedIntervalMinutes);
          } else {
            const delta = raw.cumulativeKwh - prevCumulativeKwh;
            activeEnergyKwh = Math.max(0, delta);
            activePowerKw = activeEnergyKwh * (60 / detectedIntervalMinutes);
          }
        } else {
          // Initial baseline reading
          activeEnergyKwh = 0;
          activePowerKw = raw.kw || 0;
        }
        prevCumulativeKwh = raw.cumulativeKwh;
      } else {
        // Direct interval kW / kWh
        activePowerKw = raw.kw || 0;
        activeEnergyKwh =
          raw.kwh !== undefined ? raw.kwh : activePowerKw * (detectedIntervalMinutes / 60);
      }

      // Check Negative Energy Anomaly
      if (activePowerKw < 0 || activeEnergyKwh < 0) {
        suspectCount++;
        qualityStatus = "suspect";
        activePowerKw = Math.max(0, activePowerKw);
        activeEnergyKwh = Math.max(0, activeEnergyKwh);
      }

      const record: CanonicalTelemetryRecord = {
        meter_id: meterId,
        timestamp_utc: isoUtc,
        local_timestamp: localTs,
        timezone: options?.defaultTimezone || "Africa/Johannesburg",
        interval_minutes: detectedIntervalMinutes,
        active_energy_kwh: Number(activeEnergyKwh.toFixed(6)),
        reactive_energy_kvarh: Number((raw.kvarh || 0).toFixed(6)),
        apparent_power_kva: Number((raw.kva || activePowerKw * 1.04).toFixed(6)),
        active_power_kw: Number(activePowerKw.toFixed(6)),
        quality_status: qualityStatus,
        source_file_id: sourceFileId,
        source_row_number: raw.rowNumber,
        parser_version: parser.parserVersion,
        raw_payload: raw.rawPayload,
      };

      // Check Duplicate Timestamps
      if (timestampMap.has(isoUtc)) {
        duplicateCount++;
        record.quality_status = "duplicate";
      } else {
        timestampMap.set(isoUtc, record);
      }

      records.push(record);
    }

    // Step 2: Gap Detection & Explicit Flagged Estimation
    records.sort(
      (a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime(),
    );

    const normalizedRecords: CanonicalTelemetryRecord[] = [];
    const intervalMs = detectedIntervalMinutes * 60 * 1000;

    for (let i = 0; i < records.length; i++) {
      normalizedRecords.push(records[i]);

      if (i < records.length - 1) {
        const currTime = new Date(records[i].timestamp_utc).getTime();
        const nextTime = new Date(records[i + 1].timestamp_utc).getTime();
        const diffMs = nextTime - currTime;

        if (diffMs > intervalMs + 1000) {
          // Gap Detected!
          const missingIntervals = Math.floor(diffMs / intervalMs) - 1;
          const gapStart = new Date(currTime + intervalMs).toISOString();
          const gapEnd = new Date(nextTime - intervalMs).toISOString();

          // Estimation permitted if gap length <= 2 hours (<= 4 x 30m intervals or <= 8 x 15m intervals)
          const maxAllowedMissing = 120 / detectedIntervalMinutes;
          const estimationPermitted = missingIntervals <= maxAllowedMissing;

          gapEvents.push({
            meterId,
            gapStartUtc: gapStart,
            gapEndUtc: gapEnd,
            missingIntervals,
            estimationPermitted,
            resolutionStatus: estimationPermitted ? "estimated" : "open",
          });

          // Create Explicitly Flagged Estimated Records if Permitted
          if (estimationPermitted) {
            const startKw = records[i].active_power_kw;
            const endKw = records[i + 1].active_power_kw;

            for (let step = 1; step <= missingIntervals; step++) {
              estimatedCount++;
              const estTimeMs = currTime + step * intervalMs;
              const estDate = new Date(estTimeMs);
              const fraction = step / (missingIntervals + 1);
              const estKw = startKw + (endKw - startKw) * fraction;
              const estKwh = estKw * (detectedIntervalMinutes / 60);

              normalizedRecords.push({
                meter_id: meterId,
                timestamp_utc: estDate.toISOString(),
                local_timestamp: estDate.toISOString().replace("T", " ").substring(0, 19),
                timezone: options?.defaultTimezone || "Africa/Johannesburg",
                interval_minutes: detectedIntervalMinutes,
                active_energy_kwh: Number(estKwh.toFixed(6)),
                reactive_energy_kvarh: Number(records[i].reactive_energy_kvarh.toFixed(6)),
                apparent_power_kva: Number((estKw * 1.04).toFixed(6)),
                active_power_kw: Number(estKw.toFixed(6)),
                quality_status: "estimated", // EXPLICITLY FLAGGED ESTIMATED RECORD
                source_file_id: sourceFileId,
                source_row_number: -1,
                parser_version: parser.parserVersion,
                raw_payload: { isEstimatedGapFill: true, gapStartIndex: i, step },
              });
            }
          }
        }
      }
    }

    // Re-sort normalized records
    normalizedRecords.sort(
      (a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime(),
    );

    return {
      records: normalizedRecords,
      gapEvents,
      totalRawRows: rawIntervals.length,
      duplicateCount,
      estimatedCount,
      suspectCount,
      rolloverCount,
      intervalMinutes: detectedIntervalMinutes,
    };
  }
}
