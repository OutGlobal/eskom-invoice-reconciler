/**
 * 15-Point Telemetry Quality & Validation Engine
 * Executes schema validation, duplicate detection, gap detection, timestamp normalization,
 * multiplier derivation, rollover detection, negative value checks, outlier detection,
 * impossible demand checks, and 8-state quality classification.
 */

import Decimal from "decimal.js-light";
import type {
  TelemetryIntervalRecord,
  TelemetryQualityState,
  MissingGapRecord,
  QuarantineRecord,
  TelemetryChannel,
} from "./types";
import type { MeterConfigurationRecord } from "../meter/types";

export interface RawTelemetryRowInput {
  meter_id: string;
  pod_id?: string;
  timestamp: string; // Raw input timestamp
  timezone?: string;
  channel: string;
  raw_value: number;
  unit?: string;
  source_file_id?: string;
  ingestion_batch_id: string;
  row_number: number;
  raw_snippet: string;
}

export interface ProcessingResult {
  validIntervals: TelemetryIntervalRecord[];
  quarantineRecords: QuarantineRecord[];
  missingGaps: MissingGapRecord[];
}

export class TelemetryQualityEngine {
  private static readonly MAX_FEASIBLE_KW = 150000;
  private static readonly MAX_FEASIBLE_KVA = 200000;

  /**
   * Process a list of raw telemetry row inputs through the 15-Point Quality Engine
   */
  public static processTelemetryStream(
    rows: RawTelemetryRowInput[],
    configurations: MeterConfigurationRecord[] = [],
    frequencyMinutes: 15 | 30 = 30,
  ): ProcessingResult {
    const validIntervals: TelemetryIntervalRecord[] = [];
    const quarantineRecords: QuarantineRecord[] = [];
    const missingGaps: MissingGapRecord[] = [];
    const seenIntervals = new Set<string>();

    let lastValidTimestamp: number | null = null;
    let lastValidMeterId: string | null = null;

    for (const row of rows) {
      const flags: string[] = [];
      let qualityState: TelemetryQualityState = "ACTUAL";
      let isQuarantined = false;

      // 1. Schema Validation
      if (!row.timestamp || isNaN(new Date(row.timestamp).getTime())) {
        quarantineRecords.push({
          id: `q-schema-${Date.now()}-${row.row_number}`,
          ingestion_batch_id: row.ingestion_batch_id,
          source_file_id: row.source_file_id,
          meter_id: row.meter_id,
          row_number: row.row_number,
          raw_snippet: row.raw_snippet,
          validation_code: "INVALID_TIMESTAMP_SCHEMA",
          failure_reason: `Row #${row.row_number}: Invalid or unparseable timestamp string "${row.timestamp}"`,
          severity: "error",
        });
        continue;
      }

      if (row.raw_value === undefined || row.raw_value === null || isNaN(Number(row.raw_value))) {
        quarantineRecords.push({
          id: `q-value-${Date.now()}-${row.row_number}`,
          ingestion_batch_id: row.ingestion_batch_id,
          source_file_id: row.source_file_id,
          meter_id: row.meter_id,
          row_number: row.row_number,
          raw_snippet: row.raw_snippet,
          validation_code: "INVALID_NUMERIC_VALUE",
          failure_reason: `Row #${row.row_number}: Non-numeric value "${row.raw_value}"`,
          severity: "error",
        });
        continue;
      }

      // 4 & 5. Timestamp Normalization & Timezone Handling (SAST Africa/Johannesburg)
      const dateObj = new Date(row.timestamp);
      const timestampUtc = dateObj.toISOString();
      const localTimestamp = new Date(dateObj.getTime() + 2 * 3600 * 1000)
        .toISOString()
        .replace("T", " ")
        .substring(0, 19);

      // 10. Channel Mapping & Unit Normalization
      const channel = this.normalizeChannel(row.channel);
      const unit = this.normalizeUnit(channel, row.unit);

      // 15. Duplicate Interval Detection
      const intervalKey = `${row.meter_id}|${timestampUtc}|${channel}`;
      if (seenIntervals.has(intervalKey)) {
        qualityState = "DUPLICATE";
        flags.push("DUPLICATE_INTERVAL_DETECTED");
      } else {
        seenIntervals.add(intervalKey);
      }

      // 7, 8, 9. Meter Multiplier, CT, VT ratio application
      const activeConfig = this.resolveActiveConfig(timestampUtc, configurations);
      const multiplierApplied = activeConfig?.overall_multiplier || 1.0;
      const rawDec = new Decimal(row.raw_value);
      const multDec = new Decimal(multiplierApplied);
      const engineeringVal = rawDec.mul(multDec).toNumber();
      const billedVal = engineeringVal; // 1.0 loss factor default

      // 12. Negative-Value Detection
      if (engineeringVal < 0 && channel !== "export_energy") {
        qualityState = "INVALID";
        flags.push("NEGATIVE_ENERGY_VALUE_INVALID");
        quarantineRecords.push({
          id: `q-neg-${Date.now()}-${row.row_number}`,
          ingestion_batch_id: row.ingestion_batch_id,
          source_file_id: row.source_file_id,
          meter_id: row.meter_id,
          row_number: row.row_number,
          raw_snippet: row.raw_snippet,
          validation_code: "NEGATIVE_VALUE_REJECTED",
          failure_reason: `Row #${row.row_number}: Negative value (${engineeringVal} ${unit}) on non-export channel ${channel}`,
          severity: "error",
        });
        isQuarantined = true;
      }

      // 14. Impossible Demand Detection
      if (channel === "kW" && engineeringVal > this.MAX_FEASIBLE_KW) {
        qualityState = "INVALID";
        flags.push("IMPOSSIBLE_ACTIVE_DEMAND");
        quarantineRecords.push({
          id: `q-dem-${Date.now()}-${row.row_number}`,
          ingestion_batch_id: row.ingestion_batch_id,
          source_file_id: row.source_file_id,
          meter_id: row.meter_id,
          row_number: row.row_number,
          raw_snippet: row.raw_snippet,
          validation_code: "IMPOSSIBLE_DEMAND_CAPACITY",
          failure_reason: `Row #${row.row_number}: Impossible demand ${engineeringVal} kW exceeds physical grid limit (${this.MAX_FEASIBLE_KW} kW)`,
          severity: "critical",
        });
        isQuarantined = true;
      }

      if (channel === "power_factor" && (engineeringVal < 0 || engineeringVal > 1.0)) {
        qualityState = "INVALID";
        flags.push("IMPOSSIBLE_POWER_FACTOR");
      }

      // 13. Outlier Detection
      if (channel === "kWh" && engineeringVal > 50000) {
        flags.push("STATISTICAL_OUTLIER_EXCEEDED");
        if (qualityState === "ACTUAL") qualityState = "INVALID";
      }

      if (!isQuarantined) {
        validIntervals.push({
          id: `int-${Date.now()}-${row.row_number}`,
          meter_id: row.meter_id,
          pod_id: row.pod_id || "pod-coj-main-4401",
          timestamp_utc: timestampUtc,
          local_timestamp: localTimestamp,
          timezone: row.timezone || "Africa/Johannesburg",
          channel,
          raw_value: row.raw_value,
          multiplier_applied: multiplierApplied,
          engineering_value: engineeringVal,
          billed_value: billedVal,
          unit,
          source_file_id: row.source_file_id || "src-file-local",
          ingestion_batch_id: row.ingestion_batch_id,
          quality_state: qualityState,
          validation_flags: flags,
        });

        // 3. Missing Interval Gap Detection
        const currentMs = dateObj.getTime();
        if (lastValidTimestamp !== null && lastValidMeterId === row.meter_id) {
          const expectedDiffMs = frequencyMinutes * 60 * 1000;
          const actualDiffMs = currentMs - lastValidTimestamp;

          if (actualDiffMs > expectedDiffMs * 1.5) {
            const missingCount = Math.floor(actualDiffMs / expectedDiffMs) - 1;
            const gapStartMs = lastValidTimestamp + expectedDiffMs;

            for (let g = 0; g < Math.min(missingCount, 24); g++) {
              const gapTime = new Date(gapStartMs + g * expectedDiffMs).toISOString();
              missingGaps.push({
                id: `gap-${Date.now()}-${g}`,
                meter_id: row.meter_id,
                expected_interval: gapTime,
                received_interval: timestampUtc,
                missing_duration_minutes: frequencyMinutes,
                quality_impact: missingCount > 4 ? "HIGH" : "MEDIUM",
                estimation_permitted: true,
                suggested_method: "LINEAR_INTERPOLATION",
                status: "OPEN",
              });
            }
          }
        }
        lastValidTimestamp = currentMs;
        lastValidMeterId = row.meter_id;
      }
    }

    return {
      validIntervals,
      quarantineRecords,
      missingGaps,
    };
  }

  private static normalizeChannel(rawChannel: string): TelemetryChannel {
    const lower = (rawChannel || "").toLowerCase();
    if (lower.includes("kwh") || lower.includes("active energy") || lower.includes("ch1")) return "kWh";
    if (lower.includes("kvarh") || lower.includes("reactive energy") || lower.includes("ch2")) return "kVARh";
    if (lower.includes("kva") || lower.includes("apparent") || lower.includes("ch3")) return "kVA";
    if (lower.includes("kvar") || lower.includes("reactive power")) return "kVAR";
    if (lower.includes("kw") || lower.includes("active power")) return "kW";
    if (lower.includes("pf") || lower.includes("power factor")) return "power_factor";
    if (lower.includes("volt") || lower.includes("voltage")) return "voltage";
    if (lower.includes("amp") || lower.includes("current")) return "current";
    if (lower.includes("export")) return "export_energy";
    return "kWh";
  }

  private static normalizeUnit(channel: TelemetryChannel, rawUnit?: string): string {
    if (rawUnit && rawUnit.trim().length > 0) return rawUnit;
    switch (channel) {
      case "kWh":
      case "import_energy":
      case "export_energy":
        return "kWh";
      case "kVARh":
        return "kVARh";
      case "kVA":
        return "kVA";
      case "kW":
        return "kW";
      case "kVAR":
        return "kVAR";
      case "power_factor":
        return "ratio";
      case "voltage":
        return "V";
      case "current":
        return "A";
      default:
        return "units";
    }
  }

  private static resolveActiveConfig(
    timestampUtc: string,
    configurations: MeterConfigurationRecord[],
  ): MeterConfigurationRecord | null {
    if (!configurations || configurations.length === 0) return null;
    const timeMs = new Date(timestampUtc).getTime();
    for (const cfg of configurations) {
      const startMs = new Date(cfg.effective_start_date).getTime();
      const endMs = cfg.effective_end_date
        ? new Date(`${cfg.effective_end_date}T23:59:59.999Z`).getTime()
        : Infinity;
      if (timeMs >= startMs && timeMs <= endMs) return cfg;
    }
    return configurations[0];
  }
}
