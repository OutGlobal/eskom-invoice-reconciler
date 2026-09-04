/**
 * Enterprise Telemetry Normalization Types
 * Eskom Management Platform — Canonical AMR Telemetry Domain Model
 */

export type TelemetryQualityStatus =
  | "measured"
  | "estimated"
  | "interpolated"
  | "suspect"
  | "duplicate"
  | "rollover";

export interface ParsedRawInterval {
  rowNumber: number;
  timestampStr: string;
  kw?: number;
  kvarh?: number;
  kva?: number;
  kwh?: number;
  cumulativeKwh?: number;
  powerFactor?: number;
  touPeriod?: "peak" | "standard" | "off_peak";
  rawLine: string;
  rawPayload: Record<string, any>;
}

export interface CanonicalTelemetryRecord {
  meter_id: string;
  timestamp_utc: string; // ISO 8601 UTC
  local_timestamp: string; // SAST YYYY-MM-DD HH:mm:ss
  timezone: string; // e.g. "Africa/Johannesburg"
  interval_minutes: 15 | 30;
  active_energy_kwh: number;
  reactive_energy_kvarh: number;
  apparent_power_kva: number;
  active_power_kw: number;
  quality_status: TelemetryQualityStatus;
  source_file_id: string;
  source_row_number: number;
  parser_version: string;
  raw_payload: Record<string, any>; // Original raw telemetry preserved untouched!
}

export interface TelemetryQualityMetrics {
  totalExpectedIntervals: number;
  totalParsedIntervals: number;
  validMeasuredCount: number;
  duplicateCount: number;
  estimatedCount: number;
  suspectCount: number;
  clockInconsistencyCount: number;
  completenessPercent: number; // 0-100%
  validityPercent: number; // 0-100%
  duplicatePercent: number; // 0-100%
  estimatedPercent: number; // 0-100%
  clockConsistencyPercent: number; // 0-100%
  overallQualityScore: number; // 0-100%
}

export interface TelemetryGapEvent {
  meterId: string;
  gapStartUtc: string;
  gapEndUtc: string;
  missingIntervals: number;
  estimationPermitted: boolean;
  resolutionStatus: "open" | "estimated" | "interpolated" | "accepted_loss";
}

export interface ParserOptions {
  meterId?: string;
  sourceFileId?: string;
  defaultTimezone?: string;
}

export interface ITelemetryParser {
  readonly parserName: string;
  readonly parserVersion: string;
  canParse(filename: string, headerOrContent: string): boolean;
  parseContent(content: string, options?: ParserOptions): ParsedRawInterval[];
}
