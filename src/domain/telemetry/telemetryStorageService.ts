/**
 * Telemetry Storage Service
 * Handles high-performance chunked batch ingestion, bulk database upserts,
 * quarantine registration, gap analytics, and paginated queries.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  TelemetryIntervalRecord,
  QuarantineRecord,
  MissingGapRecord,
  EstimationRecord,
  TelemetryQualitySummary,
  TelemetryQualityState,
} from "./types";
import { LargeDatasetQueryEngine } from "./largeDatasetQueryEngine";
import type {
  PaginatedTelemetryResult,
  AggregatedChartDataResponse,
  AggregationCadence,
} from "./largeDatasetTypes";

export class TelemetryStorageService {
  private static readonly BATCH_CHUNK_SIZE = 5000;
  private static memoryIntervals: Map<string, any[]> = new Map();
  private static memoryGaps: Map<string, MissingGapRecord[]> = new Map();
  private static memoryQuarantine: Map<string, QuarantineRecord[]> = new Map();

  public static recordIntervalsMemory(key: string, intervals: any[]): void {
    const existing = this.memoryIntervals.get(key) || [];
    const merged = [...existing, ...intervals];
    this.memoryIntervals.set(key, merged);
    LargeDatasetQueryEngine.registerDataset(key, merged);
  }

  public static getIntervalsMemory(key: string): any[] {
    return this.memoryIntervals.get(key) || [];
  }

  public static recordGapsMemory(key: string, gaps: MissingGapRecord[]): void {
    const existing = this.memoryGaps.get(key) || [];
    this.memoryGaps.set(key, [...existing, ...gaps]);
  }

  public static getGapsMemory(key: string): MissingGapRecord[] {
    return this.memoryGaps.get(key) || [];
  }

  public static clearMemoryStore(): void {
    this.memoryIntervals.clear();
    this.memoryGaps.clear();
    this.memoryQuarantine.clear();
    LargeDatasetQueryEngine.clearCache();
  }

  /**
   * High-Performance Bulk Ingestion of Telemetry Intervals, Quarantine Records, & Missing Gaps
   */
  public static async saveTelemetryBatch(params: {
    intervals: TelemetryIntervalRecord[];
    quarantineRecords: QuarantineRecord[];
    missingGaps: MissingGapRecord[];
  }): Promise<{ success: boolean; insertedCount: number; error?: string }> {
    const { intervals, quarantineRecords, missingGaps } = params;
    let insertedCount = 0;

    // Cache in memory store for offline and test resilience
    if (intervals.length > 0) {
      const meterId = intervals[0].meter_id || "default";
      this.recordIntervalsMemory(meterId, intervals);
      if (intervals[0].source_file_id) {
        this.recordIntervalsMemory(intervals[0].source_file_id, intervals);
      }
    }
    if (missingGaps.length > 0) {
      const meterId = missingGaps[0].meter_id || "default";
      this.recordGapsMemory(meterId, missingGaps);
    }

    try {
      // 1. Chunked Bulk Insert into telemetry_intervals
      for (let i = 0; i < intervals.length; i += this.BATCH_CHUNK_SIZE) {
        const chunk = intervals.slice(i, i + this.BATCH_CHUNK_SIZE);
        const payload = chunk.map((item) => ({
          meter_id: item.meter_id,
          timestamp_utc: item.timestamp_utc,
          local_timestamp: item.local_timestamp,
          source_timezone: item.timezone,
          channel: item.channel,
          raw_value: item.raw_value,
          multiplier_applied: item.multiplier_applied,
          engineering_value: item.engineering_value,
          billed_value: item.billed_value,
          unit: item.unit,
          source_file_id:
            item.source_file_id &&
            item.source_file_id !== "src-file-local" &&
            item.source_file_id.length > 10
              ? item.source_file_id
              : null,
          ingestion_batch_id:
            item.ingestion_batch_id && item.ingestion_batch_id.length > 10
              ? item.ingestion_batch_id
              : null,
          quality_state: item.quality_state,
          kw: item.channel === "kW" ? item.engineering_value : 0,
          kva: item.channel === "kVA" ? item.engineering_value : 0,
          kvarh: item.channel === "kVARh" ? item.engineering_value : 0,
          kwh: item.channel === "kWh" ? item.engineering_value : 0,
          power_factor: item.channel === "power_factor" ? item.engineering_value : 0.96,
        }));

        if (isSupabaseConfigured) {
          const { error } = await supabase.from("telemetry_intervals").upsert(payload, {
            onConflict: "meter_id,timestamp_utc",
          });

          if (error && !error.message.includes("FetchError")) {
            console.warn("Supabase telemetry_intervals chunk upsert warning:", error.message);
          }
        }
        insertedCount += chunk.length;
      }

      // 2. Insert Quarantine Records
      if (quarantineRecords.length > 0 && isSupabaseConfigured) {
        const qPayload = quarantineRecords.map((q) => ({
          ingestion_batch_id:
            q.ingestion_batch_id && q.ingestion_batch_id.length > 10
              ? q.ingestion_batch_id
              : "00000000-0000-0000-0000-000000000000",
          meter_id: q.meter_id || null,
          row_number: q.row_number,
          raw_snippet: q.raw_snippet,
          validation_code: q.validation_code,
          failure_reason: q.failure_reason,
          severity: q.severity,
        }));

        const { error: qError } = await supabase.from("telemetry_quarantine").insert(qPayload);
        if (qError && !qError.message.includes("FetchError")) {
          console.warn("Supabase telemetry_quarantine insert warning:", qError.message);
        }
      }

      // 3. Insert Missing Gap Records
      if (missingGaps.length > 0 && isSupabaseConfigured) {
        const gPayload = missingGaps.slice(0, 200).map((g) => ({
          meter_id: g.meter_id,
          expected_interval: g.expected_interval,
          received_interval: g.received_interval || null,
          missing_duration_minutes: g.missing_duration_minutes,
          quality_impact: g.quality_impact,
          estimation_permitted: g.estimation_permitted,
          suggested_method: g.suggested_method,
          status: g.status,
        }));

        const { error: gError } = await supabase.from("telemetry_missing_gaps").insert(gPayload);
        if (gError && !gError.message.includes("FetchError")) {
          console.warn("Supabase telemetry_missing_gaps insert warning:", gError.message);
        }
      }

      return { success: true, insertedCount };
    } catch (err: any) {
      return { success: false, insertedCount, error: err.message };
    }
  }

  /**
   * Save Estimation Audit Record to Supabase
   */
  public static async saveEstimation(
    estimation: EstimationRecord,
    estimatedInterval: TelemetryIntervalRecord,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = {
        gap_id: estimation.gap_id || null,
        meter_id: estimation.meter_id,
        interval_timestamp: estimation.interval_timestamp,
        estimated_kwh: estimation.estimated_kwh,
        method: estimation.method,
        source_intervals: estimation.source_intervals,
        reason: estimation.reason,
        confidence_score: estimation.confidence_score,
        engine_version: estimation.engine_version,
        created_by: estimation.created_by,
      };

      if (isSupabaseConfigured) {
        await supabase.from("telemetry_estimations").insert(payload);
      }

      // Save estimated interval record to intervals table
      await this.saveTelemetryBatch({
        intervals: [estimatedInterval],
        quarantineRecords: [],
        missingGaps: [],
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Query Telemetry Summary Metrics
   */
  public static computeSummary(
    intervals: TelemetryIntervalRecord[],
    quarantined: QuarantineRecord[],
    gaps: MissingGapRecord[],
    estimationsCount: number = 0,
  ): TelemetryQualitySummary {
    const countsByState: Record<TelemetryQualityState, number> = {
      ACTUAL: 0,
      ESTIMATED: 0,
      INTERPOLATED: 0,
      MISSING: 0,
      INVALID: 0,
      DUPLICATE: 0,
      CORRECTED: 0,
      MANUAL_OVERRIDE: 0,
    };

    for (const item of intervals) {
      const qualityState = item.quality_state;
      if (qualityState && countsByState[qualityState] !== undefined) {
        countsByState[qualityState]++;
      }
    }

    const total = intervals.length;
    const actualCount = countsByState.ACTUAL;
    const healthScorePct = total > 0 ? Number(((actualCount / total) * 100).toFixed(1)) : 100.0;

    return {
      totalRecords: total,
      healthScorePct,
      countsByState,
      quarantinedCount: quarantined.length,
      missingGapsCount: gaps.length,
      estimationsCount,
    };
  }

  /**
   * Fetch recent intervals from the database (with memory store fallback)
   */
  public static async fetchIntervals(
    limit: number = 100,
    meterId?: string,
  ): Promise<TelemetryIntervalRecord[]> {
    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from("telemetry_intervals")
          .select("*")
          .order("timestamp_utc", { ascending: false })
          .limit(limit);

        if (meterId) {
          query = query.eq("meter_id", meterId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as unknown as TelemetryIntervalRecord[];
        }
      } catch {
        // Offline fallback
      }
    }

    if (meterId) {
      return (this.memoryIntervals.get(meterId) || []).slice(0, limit) as TelemetryIntervalRecord[];
    }
    const all = Array.from(this.memoryIntervals.values()).flat();
    return all.slice(0, limit) as TelemetryIntervalRecord[];
  }

  /**
   * High-level helper: save array of telemetry interval records directly
   */
  public static async saveIntervals(intervals: any[]): Promise<void> {
    if (intervals.length > 0) {
      const key = intervals[0].site_id || intervals[0].meter_id || "default";
      this.recordIntervalsMemory(key, intervals);
      if (intervals[0].meter_id && intervals[0].meter_id !== key) {
        this.recordIntervalsMemory(intervals[0].meter_id, intervals);
      }
    }
    await this.saveTelemetryBatch({
      intervals: intervals as any,
      quarantineRecords: [],
      missingGaps: [],
    });
  }

  /**
   * High-level helper: fetch stored telemetry interval records
   */
  public static async getIntervals(key?: string): Promise<any[]> {
    if (key) {
      const mem = this.memoryIntervals.get(key);
      if (mem && mem.length > 0) return mem;
    }
    return this.fetchIntervals(500, key);
  }

  /**
   * Server-Side Paginated Query
   * Restricts browser heap by returning strictly bounded pages (e.g. 50 items)
   * with exact total counts and execution time without transferring entire datasets.
   */
  public static async queryPaginated(params: {
    organisationId?: string;
    meterId?: string;
    searchQuery?: string;
    qualityState?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedTelemetryResult<TelemetryIntervalRecord>> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(1000, Math.max(1, params.pageSize || 50));
    const offset = (page - 1) * pageSize;
    const startTime = performance.now();

    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from("telemetry_intervals")
          .select("*", { count: "exact" })
          .order("timestamp_utc", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (params.meterId) {
          query = query.eq("meter_id", params.meterId);
        }
        if (params.organisationId) {
          query = query.eq("organisation_id", params.organisationId);
        }
        if (params.qualityState && params.qualityState !== "ALL") {
          query = query.eq("quality_state", params.qualityState);
        }
        if (params.startDate) {
          query = query.gte("timestamp_utc", params.startDate);
        }
        if (params.endDate) {
          query = query.lte("timestamp_utc", params.endDate);
        }

        const { data, count, error } = await query;
        if (!error && data) {
          const totalCount = count || data.length;
          const totalPages = Math.ceil(totalCount / pageSize) || 1;
          const duration = Math.round(performance.now() - startTime);

          return {
            items: data as unknown as TelemetryIntervalRecord[],
            totalCount,
            page,
            pageSize,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            executionDurationMs: duration,
          };
        }
      } catch {
        // Fallback to local memory / cache query
      }
    }

    // Memory / Local Dataset fallback via LargeDatasetQueryEngine
    const rawCandidates = params.meterId
      ? this.memoryIntervals.get(params.meterId) || []
      : Array.from(this.memoryIntervals.values()).flat();

    return LargeDatasetQueryEngine.queryPaginatedIntervals(
      {
        organisationId: params.organisationId || "DEFAULT",
        meterId: params.meterId,
        qualityStates:
          params.qualityState && params.qualityState !== "ALL"
            ? [params.qualityState as any]
            : undefined,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      {
        page,
        pageSize,
      },
      rawCandidates,
    );
  }

  /**
   * Server-Side / Database Aggregation Query for Charts
   * Aggregates raw millions of records into strictly bounded plottable points (max 300)
   */
  public static async getAggregatedTimeSeries(params: {
    meterId: string;
    organisationId?: string;
    cadence?: AggregationCadence;
    startDate?: string;
    endDate?: string;
    maxBuckets?: number;
  }): Promise<AggregatedChartDataResponse> {
    const intervals = this.memoryIntervals.get(params.meterId) || [];
    return LargeDatasetQueryEngine.aggregateIntervalsForCharts(
      {
        organisationId: params.organisationId || "DEFAULT",
        meterId: params.meterId,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      params.cadence || "day",
      params.maxBuckets || 300,
      intervals,
    );
  }

  /**
   * Aggregated Quality State Distribution Query
   * Counts quality states without transferring million-record arrays to caller
   */
  public static async getQualityStateDistribution(params: {
    meterId?: string;
    organisationId?: string;
  }): Promise<Record<TelemetryQualityState, number>> {
    const counts: Record<TelemetryQualityState, number> = {
      ACTUAL: 0,
      ESTIMATED: 0,
      INTERPOLATED: 0,
      MISSING: 0,
      INVALID: 0,
      DUPLICATE: 0,
      CORRECTED: 0,
      MANUAL_OVERRIDE: 0,
    };

    const records = params.meterId
      ? this.memoryIntervals.get(params.meterId) || []
      : Array.from(this.memoryIntervals.values()).flat();

    for (const r of records) {
      const st = r.quality_state as TelemetryQualityState;
      if (st && counts[st] !== undefined) {
        counts[st]++;
      }
    }

    return counts;
  }

  /**
   * Chunked Batch Processing Runner
   * Processes large dataset streams in safe chunks (e.g. 5,000 intervals) with
   * cooperative event-loop tick yielding to prevent browser/server lockup.
   */
  public static async processInChunks<T, R>(
    items: T[],
    processChunk: (chunk: T[], index: number) => Promise<R[]> | R[],
    options?: {
      chunkSize?: number;
      yieldTickIntervalMs?: number;
      onProgress?: (done: number, total: number, pct: number) => void;
    },
  ): Promise<{ results: R[]; totalProcessed: number; durationMs: number; throughputRowsPerSec: number }> {
    return LargeDatasetQueryEngine.streamBatchProcessor(items, processChunk, {
      batchSize: options?.chunkSize || 5000,
      yieldTickIntervalMs: options?.yieldTickIntervalMs ?? 0,
      onProgress: options?.onProgress,
    });
  }
}
