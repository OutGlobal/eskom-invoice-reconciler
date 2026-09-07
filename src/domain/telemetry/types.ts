/**
 * Domain Types: Production-Grade Time-Series Ingestion & Quality Validation Engine
 * Eskom Bill Balancer Platform
 */

export type IntervalFrequency = "15_MIN" | "30_MIN";

export type TelemetryFileFormat = "CSV" | "XLS" | "XLSX" | "XML";

export type TelemetryChannel =
  | "kWh"
  | "kW"
  | "kVA"
  | "kVAR"
  | "kVARh"
  | "voltage"
  | "current"
  | "power_factor"
  | "import_energy"
  | "export_energy";

export type TelemetryQualityState =
  | "ACTUAL"
  | "ESTIMATED"
  | "INTERPOLATED"
  | "MISSING"
  | "INVALID"
  | "DUPLICATE"
  | "CORRECTED"
  | "MANUAL_OVERRIDE";

export interface TelemetryIntervalRecord {
  id: string;
  meter_id: string;
  pod_id: string;
  timestamp_utc: string; // ISO-8601 UTC
  local_timestamp: string; // SAST Local Time (YYYY-MM-DD HH:mm:ss)
  timezone: string; // 'Africa/Johannesburg'
  channel: TelemetryChannel;
  raw_value: number;
  multiplier_applied: number;
  engineering_value: number;
  billed_value: number;
  unit: string;
  source_file_id: string;
  ingestion_batch_id: string;
  quality_state: TelemetryQualityState;
  validation_flags: string[];
}

export interface MissingGapRecord {
  id: string;
  meter_id: string;
  expected_interval: string;
  received_interval?: string;
  missing_duration_minutes: number;
  quality_impact: "HIGH" | "MEDIUM" | "LOW";
  estimation_permitted: boolean;
  suggested_method: "LINEAR_INTERPOLATION" | "SAME_DAY_PRIOR_WEEK" | "HISTORICAL_MEDIAN";
  status: "OPEN" | "ESTIMATED" | "IGNORED";
  created_at?: string;
}

export type EstimationMethod =
  | "LINEAR_INTERPOLATION"
  | "SAME_DAY_PRIOR_WEEK"
  | "HISTORICAL_MEDIAN";

export interface EstimationRecord {
  id: string;
  gap_id?: string;
  meter_id: string;
  interval_timestamp: string;
  estimated_kwh: number;
  method: EstimationMethod;
  source_intervals: string[];
  reason: string;
  confidence_score: number; // 0.00 to 1.00
  engine_version: string;
  created_by?: string;
  created_at?: string;
}

export interface QuarantineRecord {
  id: string;
  ingestion_batch_id: string;
  source_file_id?: string;
  meter_id?: string;
  row_number: number;
  raw_snippet: string;
  validation_code: string;
  failure_reason: string;
  severity: "error" | "warning" | "critical";
  created_at?: string;
}

export interface TelemetryQualitySummary {
  totalRecords: number;
  healthScorePct: number; // 0.0 to 100.0
  countsByState: Record<TelemetryQualityState, number>;
  quarantinedCount: number;
  missingGapsCount: number;
  estimationsCount: number;
}
