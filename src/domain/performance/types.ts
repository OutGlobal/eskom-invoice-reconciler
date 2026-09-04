/**
 * Production Performance & Aggregation Types
 * Eskom Bill Balancer Platform
 */

export interface PerformanceBenchmarkResult {
  scaleMeters: number;
  scaleMonths: number;
  totalIntervalRecords: number;
  uploadTimeMs: number;
  parsingTimeMs: number;
  normalizationTimeMs: number;
  databaseInsertionTimeMs: number;
  tariffCalculationTimeMs: number;
  reconciliationTimeMs: number;
  reportGenerationTimeMs: number;
  dashboardQueryTimeMs: number;
  throughputRowsPerSec: number;
  peakMemoryMb: number;
}

export interface DailyAggregateSummary {
  meterId: string;
  dateStr: string; // YYYY-MM-DD
  totalActiveKwh: number;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  peakKw: number;
  peakKva: number;
  avgPowerFactor: number;
  intervalCount: number;
}

export interface ChunkedBatchConfig {
  batchSize: number; // e.g. 5000
  parallelism: number;
  useBulkInsert: boolean;
}
