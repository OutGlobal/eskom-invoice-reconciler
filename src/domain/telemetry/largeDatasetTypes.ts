/**
 * Stage 17 — Large Dataset Query & Aggregation Types
 * Eskom Bill Balancer Platform
 *
 * Defines contracts for:
 * - Server-side pagination and keyset navigation
 * - Server-side filtering across meter IDs, date ranges, and quality states
 * - Time-series aggregation for dashboard charts (preventing millions of raw records in browser)
 * - Memory-bounded batch processing and streaming
 */

import type { TelemetryIntervalRecord, TelemetryQualityState } from "./types";
import type { TouPeriod } from "@/lib/tariff";

export type AggregationCadence =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "tou_period";

export interface TelemetryQueryFilter {
  organisationId: string;
  meterId?: string;
  meterIds?: string[];
  siteId?: string;
  startDate?: string; // ISO 8601 string or YYYY-MM-DD
  endDate?: string;   // ISO 8601 string or YYYY-MM-DD
  qualityStates?: TelemetryQualityState[];
  touPeriods?: TouPeriod[];
  channels?: string[];
  minKwh?: number;
  maxKwh?: number;
  sourceFileId?: string;
}

export interface PaginationOptions {
  page?: number;         // 1-indexed, default 1
  pageSize?: number;     // default 50, max 1000
  cursor?: string;       // Cursor for keyset pagination
  sortField?: "timestamp_utc" | "kwh" | "kva";
  sortDirection?: "ASC" | "DESC";
}

export interface PaginatedTelemetryResult<T = TelemetryIntervalRecord> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor?: string;
  prevCursor?: string;
  executionDurationMs: number;
}

export interface AggregatedTimeSeriesBucket {
  bucketKey: string;           // Formatted date/time label (e.g. "2025-01-01" or "2025-01-01T14:00")
  timestampStart: string;     // ISO UTC
  timestampEnd: string;       // ISO UTC
  totalActiveEnergyKwh: number;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  maxDemandKva: number;
  avgDemandKw: number;
  totalReactiveKvarh: number;
  avgPowerFactor: number;
  readingCount: number;
  estimatedCount: number;
  outageCount: number;
  dominantTou: TouPeriod;
}

export interface ChartPlottablePoint {
  label: string;
  timestamp: number;          // epoch ms for recharts XAxis
  kW: number;
  kVA: number;
  kwh: number;
  kvarh: number;
  pf: number;
  tou: TouPeriod;
  estimated: boolean;
}

export interface AggregatedChartDataResponse {
  meterId: string;
  periodStart: string;
  periodEnd: string;
  cadence: AggregationCadence;
  bucketCount: number;
  totalRawRecordsSampled: number;
  summary: {
    totalActiveKwh: number;
    peakKwh: number;
    standardKwh: number;
    offPeakKwh: number;
    maxDemandKva: number;
    totalReactiveKvarh: number;
    averagePowerFactor: number;
    dataQualityScore: number;
  };
  buckets?: AggregatedTimeSeriesBucket[];
  chartFormattedSeries: ChartPlottablePoint[];
  downsampled: boolean;
  executionDurationMs: number;
}

export interface BatchProcessingOptions {
  batchSize?: number;         // default 2000
  onProgress?: (processed: number, total: number, pct: number) => void;
  yieldTickIntervalMs?: number; // event loop cooperative yield
}

export interface BatchProcessingResult {
  totalProcessed: number;
  batchesCount: number;
  durationMs: number;
  throughputRowsPerSec: number;
}
