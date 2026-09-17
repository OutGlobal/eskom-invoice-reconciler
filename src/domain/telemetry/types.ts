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
  pod_id?: string;
  site_id?: string;
  organisation_id?: string;
  timestamp_utc: string; // ISO-8601 UTC
  local_timestamp: string; // SAST Local Time (YYYY-MM-DD HH:mm:ss)
  timezone: string; // 'Africa/Johannesburg'
  channel?: TelemetryChannel | string;
  raw_value?: number;
  multiplier_applied?: number;
  engineering_value?: number;
  billed_value?: number;
  unit?: string;
  source_file_id?: string;
  ingestion_batch_id?: string;
  quality_state?: TelemetryQualityState;
  validation_flags?: string[];
  kw?: number;
  kva?: number;
  kwh?: number;
  kvarh?: number;
  power_factor?: number;
  tou_period?: any;
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

export type EstimationMethod = "LINEAR_INTERPOLATION" | "SAME_DAY_PRIOR_WEEK" | "HISTORICAL_MEDIAN";

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

export type TelemetryQualityStatus =
  | "measured"
  | "estimated"
  | "interpolated"
  | "duplicate"
  | "suspect"
  | "rollover"
  | "missing"
  | "validated";

export interface CanonicalTelemetryRecord {
  meter_id: string;
  timestamp_utc: string;
  local_timestamp: string;
  timezone: string;
  source_timezone?: string;
  interval_minutes: 5 | 15 | 30 | 60;
  interval_duration_minutes?: number;
  active_energy_kwh: number;
  reactive_energy_kvarh: number;
  apparent_power_kva: number;
  active_power_kw: number;
  power_factor?: number;
  tou_period?: "PEAK" | "STANDARD" | "OFF_PEAK" | "peak" | "standard" | "off_peak" | "offPeak";
  quality_status: TelemetryQualityStatus;
  source_file_id: string;
  source_row_number: number;
  parser_version: string;
  raw_payload?: Record<string, any>;

  // Stage 10 Canonical Representations & Lineage
  site_id?: string;
  timestamp?: string;
  kwh?: number;
  kvah?: number;
  peak_kwh?: number;
  standard_kwh?: number;
  off_peak_kwh?: number;
  kw?: number;
  kva?: number;
  kvar?: number;
  kvarh?: number;
  source_units?: any;
  normalised_units?: any;
  source_values?: any;
  conversion_multipliers?: Record<string, number>;
  conversion_audit?: any;
}

export interface ParsedRawInterval {
  rowNumber: number;
  timestampStr: string;
  kw?: number;
  kwh?: number;
  kvarh?: number;
  kva?: number;
  cumulativeKwh?: number;
  powerFactor?: number;
  rawLine?: string;
  rawPayload?: Record<string, any>;
}

export interface ParserOptions {
  meterId?: string;
  sourceFileId?: string;
  defaultTimezone?: string;
  multiplier?: number;
  channel?: TelemetryChannel;
}

export interface ITelemetryParser {
  readonly parserName: string;
  readonly parserVersion: string;
  canParse(filename: string, headerOrContent: string): boolean;
  parseContent(content: string, options?: ParserOptions): ParsedRawInterval[];
}

export interface TelemetryGapEvent {
  meterId: string;
  gapStartUtc: string;
  gapEndUtc: string;
  missingIntervals: number;
  estimationPermitted: boolean;
  resolutionStatus: "estimated" | "open" | "resolved";
}

export interface TelemetryQualityMetrics {
  totalExpectedIntervals: number;
  totalParsedIntervals: number;
  validMeasuredCount: number;
  duplicateCount: number;
  estimatedCount: number;
  suspectCount: number;
  clockInconsistencyCount: number;
  completenessPercent: number;
  validityPercent: number;
  duplicatePercent: number;
  estimatedPercent: number;
  clockConsistencyPercent: number;
  overallQualityScore: number;
}

export type DetectedSchemaType =
  | "ESKOM_AMR_30M"
  | "ESKOM_AMR_STANDARD"
  | "MUNICIPAL_15MIN"
  | "CUMULATIVE_REGISTERS"
  | "CUMULATIVE_DIAL"
  | "ENERGY_ONLY_KWH"
  | "KWH_ENERGY_ONLY"
  | "EXCEL_MULTI_SHEET"
  | "GENERIC_INTERVAL";

export interface DetectedFileStructure {
  delimiter: string;
  encoding: string;
  sheetName?: string;
  sheetNames?: string[];
  headerRowIndex: number;
  preambleRowCount?: number;
  totalRows: number;
  dataRows: number;
  preambleLines: string[];
}

export interface DetectedHeaders {
  rawHeaders: string[];
  headerRowIndex?: number;
  timestampColumn?: string;
  dateColumn?: string;
  timeColumn?: string;
  meterColumn?: string;
  activePowerColumn?: string;
  activeEnergyColumn?: string;
  reactiveEnergyColumn?: string;
  apparentPowerColumn?: string;
  powerFactorColumn?: string;
  cumulativeRegisterColumn?: string;
}

export interface IntervalProcessingSummary {
  meterId: string;
  fileStructure: DetectedFileStructure;
  headers: DetectedHeaders;
  detectedDurationMinutes: 5 | 15 | 30 | 60;
  intervals: {
    total?: number;
    totalParsed: number;
    valid?: number;
    validMeasured: number;
    estimated: number;
    duplicates: number;
    suspect: number;
    rollovers: number;
  };
  timeRange: {
    startUtc: string;
    endUtc: string;
    startLocal: string;
    endLocal: string;
    durationDays: number;
  };
  gaps: {
    gapCount: number;
    totalMissingIntervals: number;
    missingIntervalsTotal: number;
    gapEvents: Array<
      TelemetryGapEvent & {
        startLocal?: string;
        endLocal?: string;
        missingCount?: number;
      }
    >;
    missingIntervals: Array<{
      expectedLocalTimestamp: string;
      expectedUtcTimestamp: string;
      meterId: string;
    }>;
  };
  totals: {
    totalActiveEnergyKwh: number;
    totalReactiveEnergyKvarh: number;
    peakDemandKw: number;
    peakDemandKva: number;
    averagePowerFactor: number;
  };
  qualityScore: number;
  dataQualityScore?: number;
  validationStatus: "VALID" | "PARTIALLY_PROCESSED" | "FAILED" | "REVIEW_REQUIRED";
  validationErrors: string[];
  validationWarnings: string[];
  schemaType: DetectedSchemaType;
}

export interface IntervalIngestionOptions {
  meterId?: string;
  sourceFileId?: string;
  organisationId?: string;
  defaultTimezone?: string;
  multiplier?: number;
  allowEstimation?: boolean;
}

export * from "./canonicalEnergyRecord";
export * from "./energyDataNormalizationEngine";
