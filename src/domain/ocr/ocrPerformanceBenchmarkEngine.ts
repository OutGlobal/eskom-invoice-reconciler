/**
 * ENERA PRODUCTION OCR PERFORMANCE BENCHMARK ENGINE (REQUIREMENT 37)
 * =================================================================
 * Systematically measures and profiles OCR subsystem performance across all 7 dimensions:
 *
 * 1. Upload-to-OCR latency (time from file drop/upload completion to first raster/worker step)
 * 2. Average page processing time (per-page execution duration across text/scanned documents)
 * 3. Large document performance (chunked throughput and memory stability on 50+ page documents)
 * 4. Concurrent document processing (parallel batch throughput under worker pool constraints)
 * 5. Database write performance (persistence latency for runs, page tokens, and determinants)
 * 6. OCR provider latency (isolated optical character recognition duration vs pipeline overhead)
 * 7. Retry behaviour (exponential backoff timing, attempt tracking, and recovery overhead)
 *
 * MANDATE: Do not optimize prematurely. Measure first.
 */

import { OcrProcessingRunEngine } from "./ocrProcessingRunEngine";
import { OcrRetryEngine } from "./ocrRetryEngine";
import { OcrPersistenceService } from "./ocrPersistenceService";
import type { OcrDocumentResult, OcrProcessingRun } from "./types";

export interface OcrPerformanceBenchmarkReport {
  timestamp: string;
  uploadToOcrLatencyMs: number;
  averagePageProcessingTimeMs: number;
  largeDocumentThroughputPagesPerSec: number;
  concurrentDocumentThroughputDocsPerSec: number;
  databaseWriteLatencyMs: number;
  ocrProviderLatencyMs: number;
  retryBackoffLatencyMs: number;
  rawMetrics: {
    largeDocPages: number;
    largeDocDurationMs: number;
    concurrentBatchSize: number;
    concurrentBatchDurationMs: number;
    retryAttempts: number;
    retryTotalDurationMs: number;
  };
}

export class OcrPerformanceBenchmarkEngine {
  /**
   * 1. Measures Upload-to-OCR Latency:
   * Time elapsed between upload registration and initial OCR worker dispatch.
   */
  public static measureUploadToOcrLatency(
    uploadTimestampMs: number,
    ocrWorkerStartTimestampMs: number,
  ): number {
    return Math.max(0, ocrWorkerStartTimestampMs - uploadTimestampMs);
  }

  /**
   * 2. Measures Average Page Processing Time:
   * Calculates mean duration per page across single or multi-page documents.
   */
  public static calculateAveragePageProcessingTime(
    totalDurationMs: number,
    pageCount: number,
  ): number {
    if (pageCount <= 0) return 0;
    return Math.round((totalDurationMs / pageCount) * 100) / 100;
  }

  /**
   * 3. Benchmarks Large Document Performance:
   * Evaluates chunked throughput (pages per second) for multi-page documents.
   */
  public static benchmarkLargeDocument(
    pageCount: number,
    totalDurationMs: number,
  ): { pagesPerSecond: number; avgTimePerPageMs: number; durationMs: number } {
    const safeDuration = Math.max(1, totalDurationMs);
    const pagesPerSecond = Math.round((pageCount / (safeDuration / 1000)) * 100) / 100;
    const avgTimePerPageMs = Math.round((safeDuration / Math.max(1, pageCount)) * 100) / 100;

    return {
      pagesPerSecond,
      avgTimePerPageMs,
      durationMs: totalDurationMs,
    };
  }

  /**
   * 4. Benchmarks Concurrent Document Processing:
   * Measures total batch duration and documents-per-second throughput across parallel workloads.
   */
  public static benchmarkConcurrentDocuments(
    documentCount: number,
    batchDurationMs: number,
  ): { docsPerSecond: number; totalDurationMs: number } {
    const safeDuration = Math.max(1, batchDurationMs);
    const docsPerSecond = Math.round((documentCount / (safeDuration / 1000)) * 100) / 100;

    return {
      docsPerSecond,
      totalDurationMs: batchDurationMs,
    };
  }

  /**
   * 5. Measures Database Write Performance:
   * Benchmarks persistence latency for master runs and page token payload inserts.
   */
  public static async measureDatabaseWriteLatency(
    documentResult: OcrDocumentResult,
  ): Promise<number> {
    const start = Date.now();
    await OcrPersistenceService.saveOcrRun(documentResult);
    return Date.now() - start;
  }

  /**
   * 6. Measures OCR Provider Latency:
   * Isolates raw engine worker execution duration from pre/post-processing overhead.
   */
  public static measureProviderLatencyBreakdown(
    totalPipelineDurationMs: number,
    rawEngineWorkerDurationMs: number,
  ): {
    rawProviderDurationMs: number;
    preprocessingAndLayoutOverheadMs: number;
    providerRatioPercent: number;
  } {
    const overhead = Math.max(0, totalPipelineDurationMs - rawEngineWorkerDurationMs);
    const providerRatio =
      totalPipelineDurationMs > 0
        ? Math.round((rawEngineWorkerDurationMs / totalPipelineDurationMs) * 1000) / 10
        : 100;

    return {
      rawProviderDurationMs: rawEngineWorkerDurationMs,
      preprocessingAndLayoutOverheadMs: overhead,
      providerRatioPercent: providerRatio,
    };
  }

  /**
   * 7. Benchmarks Retry Behaviour:
   * Measures backoff delays and cumulative retry latency across sequential attempts.
   */
  public static benchmarkRetryBehavior(policy: {
    maxRetries: number;
    initialDelayMs: number;
    backoffMultiplier: number;
  }): {
    calculatedDelays: number[];
    cumulativeBackoffMs: number;
  } {
    const delays: number[] = [];
    let cumulative = 0;

    for (let attempt = 1; attempt <= policy.maxRetries; attempt++) {
      const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
      delays.push(delay);
      cumulative += delay;
    }

    return {
      calculatedDelays: delays,
      cumulativeBackoffMs: cumulative,
    };
  }

  /**
   * Generates a comprehensive performance report across all 7 dimensions.
   */
  public static generatePerformanceReport(params: {
    uploadTimestampMs: number;
    ocrWorkerStartTimestampMs: number;
    singleDocPages: number;
    singleDocDurationMs: number;
    largeDocPages: number;
    largeDocDurationMs: number;
    concurrentDocCount: number;
    concurrentDurationMs: number;
    dbWriteLatencyMs: number;
    rawWorkerDurationMs: number;
    retryPolicy: { maxRetries: number; initialDelayMs: number; backoffMultiplier: number };
  }): OcrPerformanceBenchmarkReport {
    const uploadLatency = this.measureUploadToOcrLatency(
      params.uploadTimestampMs,
      params.ocrWorkerStartTimestampMs,
    );
    const avgPageTime = this.calculateAveragePageProcessingTime(
      params.singleDocDurationMs,
      params.singleDocPages,
    );
    const largeDoc = this.benchmarkLargeDocument(params.largeDocPages, params.largeDocDurationMs);
    const concurrent = this.benchmarkConcurrentDocuments(
      params.concurrentDocCount,
      params.concurrentDurationMs,
    );
    const retry = this.benchmarkRetryBehavior(params.retryPolicy);

    return {
      timestamp: new Date().toISOString(),
      uploadToOcrLatencyMs: uploadLatency,
      averagePageProcessingTimeMs: avgPageTime,
      largeDocumentThroughputPagesPerSec: largeDoc.pagesPerSecond,
      concurrentDocumentThroughputDocsPerSec: concurrent.docsPerSecond,
      databaseWriteLatencyMs: params.dbWriteLatencyMs,
      ocrProviderLatencyMs: params.rawWorkerDurationMs,
      retryBackoffLatencyMs: retry.cumulativeBackoffMs,
      rawMetrics: {
        largeDocPages: params.largeDocPages,
        largeDocDurationMs: params.largeDocDurationMs,
        concurrentBatchSize: params.concurrentDocCount,
        concurrentBatchDurationMs: params.concurrentDurationMs,
        retryAttempts: params.retryPolicy.maxRetries,
        retryTotalDurationMs: retry.cumulativeBackoffMs,
      },
    };
  }
}
