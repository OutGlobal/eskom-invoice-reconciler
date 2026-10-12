/**
 * ENERA PRODUCTION OCR ENGINE — LARGE DOCUMENT CHUNKING ENGINE (Requirement 24)
 * ============================================================================
 * Safe chunked processing for large utility documents (e.g. 50, 100, 200 pages):
 *
 *   Document (e.g. 200 Pages)
 *              ↓
 *   Chunk Planner (e.g. 10 Pages per Chunk)
 *              ↓
 *   Track Granular State:
 *     Pages 1–10:   COMPLETE
 *     Pages 11–20:  PROCESSING
 *     Pages 21–30:  PENDING
 *     ...
 *              ↓
 *   Real-Time Progress (NEVER Fake Progress)
 *              ↓
 *   Cross-Chunk Multi-Page Table & Section Stitching
 *              ↓
 *   Authoritative Auditable Document Result
 */

import type {
  OcrPageChunk,
  OcrChunkStatus,
  OcrDocumentProgress,
  OcrPageResult,
  PageProcessingState,
} from "./types";

export interface ChunkPlanningOptions {
  chunkSize?: number;
  startPage?: number;
  maxPages?: number;
}

export class OcrLargeDocumentChunkEngine {
  public static readonly DEFAULT_CHUNK_SIZE = 10;
  public static readonly LARGE_DOCUMENT_THRESHOLD = 15;

  /**
   * Partitions total document pages into ordered, bounded page chunks.
   * e.g. 25 pages with chunkSize 10 -> [1..10], [11..20], [21..25]
   */
  public static planChunks(totalPages: number, options: ChunkPlanningOptions = {}): OcrPageChunk[] {
    const chunkSize = Math.max(1, options.chunkSize || this.DEFAULT_CHUNK_SIZE);
    const startPage = Math.max(1, options.startPage || 1);
    const effectiveTotal = options.maxPages ? Math.min(totalPages, options.maxPages) : totalPages;

    const chunks: OcrPageChunk[] = [];
    let currentStart = startPage;
    let chunkIndex = 0;

    while (currentStart <= effectiveTotal) {
      const currentEnd = Math.min(currentStart + chunkSize - 1, effectiveTotal);
      const pageNumbers: number[] = [];
      const pageStatuses: Record<number, PageProcessingState> = {};

      for (let p = currentStart; p <= currentEnd; p++) {
        pageNumbers.push(p);
        pageStatuses[p] = "PENDING";
      }

      chunks.push({
        chunkIndex,
        startPage: currentStart,
        endPage: currentEnd,
        pageNumbers,
        status: "PENDING",
        progressPercentage: 0,
        pageStatuses,
        startedAt: undefined,
        completedAt: null,
        durationMs: null,
        error: null,
        retryAttempt: 0,
        retryHistory: [],
      });

      currentStart = currentEnd + 1;
      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Initializes the authoritative OcrDocumentProgress object for a document run.
   */
  public static createProgress(
    documentId: string,
    ocrRunId: string,
    totalPages: number,
    chunks: OcrPageChunk[],
  ): OcrDocumentProgress {
    const formattedStatus = this.formatProgressSummary(chunks);
    return {
      documentId,
      ocrRunId,
      totalPages,
      processedPages: 0,
      completedPages: 0,
      failedPages: 0,
      percentage: 0,
      chunks,
      activeChunkIndex: null,
      currentChunkLabel:
        chunks.length > 0
          ? `Pages ${chunks[0].startPage}–${chunks[0].endPage} PENDING`
          : "No pages",
      formattedStatus,
      isComplete: false,
      hasFailures: false,
    };
  }

  /**
   * Transitions a chunk to PROCESSING and updates the document progress.
   */
  public static startChunk(progress: OcrDocumentProgress, chunkIndex: number): OcrDocumentProgress {
    const chunk = progress.chunks[chunkIndex];
    if (!chunk) return progress;

    chunk.status = "PROCESSING";
    chunk.startedAt = new Date().toISOString();
    for (const p of chunk.pageNumbers) {
      chunk.pageStatuses[p] = "OCR";
    }

    progress.activeChunkIndex = chunkIndex;
    progress.currentChunkLabel = `Pages ${chunk.startPage}–${chunk.endPage} PROCESSING`;
    progress.formattedStatus = this.formatProgressSummary(progress.chunks);
    this.recalculateProgress(progress);

    return progress;
  }

  /**
   * Completes a chunk with its page results and recalculates true progress.
   */
  public static completeChunk(
    progress: OcrDocumentProgress,
    chunkIndex: number,
    pageResults: OcrPageResult[],
  ): OcrDocumentProgress {
    const chunk = progress.chunks[chunkIndex];
    if (!chunk) return progress;

    const completedAt = new Date().toISOString();
    const startMs = chunk.startedAt ? new Date(chunk.startedAt).getTime() : Date.now();
    const durationMs = Math.max(0, Date.now() - startMs);

    chunk.status = "COMPLETE";
    chunk.completedAt = completedAt;
    chunk.durationMs = durationMs;
    chunk.progressPercentage = 100;
    chunk.pageResults = pageResults;
    chunk.error = null;

    for (const p of chunk.pageNumbers) {
      chunk.pageStatuses[p] = "DONE";
    }

    progress.completedPages += chunk.pageNumbers.length;
    progress.processedPages += chunk.pageNumbers.length;
    progress.currentChunkLabel = `Pages ${chunk.startPage}–${chunk.endPage} COMPLETE`;
    progress.formattedStatus = this.formatProgressSummary(progress.chunks);
    this.recalculateProgress(progress);

    return progress;
  }

  /**
   * Marks a chunk as failed or in review.
   */
  public static failChunk(
    progress: OcrDocumentProgress,
    chunkIndex: number,
    error: any,
    status: OcrChunkStatus = "FAILED",
  ): OcrDocumentProgress {
    const chunk = progress.chunks[chunkIndex];
    if (!chunk) return progress;

    const completedAt = new Date().toISOString();
    const startMs = chunk.startedAt ? new Date(chunk.startedAt).getTime() : Date.now();
    const durationMs = Math.max(0, Date.now() - startMs);

    chunk.status = status;
    chunk.completedAt = completedAt;
    chunk.durationMs = durationMs;
    chunk.error =
      error instanceof Error
        ? { code: "CHUNK_OCR_FAILED", message: error.message, stack: error.stack }
        : typeof error === "object" && error !== null
          ? error
          : { code: "CHUNK_OCR_FAILED", message: String(error) };

    for (const p of chunk.pageNumbers) {
      chunk.pageStatuses[p] = "FAILED";
    }

    progress.failedPages += chunk.pageNumbers.length;
    progress.processedPages += chunk.pageNumbers.length;
    progress.hasFailures = true;
    progress.currentChunkLabel = `Pages ${chunk.startPage}–${chunk.endPage} ${status}`;
    progress.formattedStatus = this.formatProgressSummary(progress.chunks);
    this.recalculateProgress(progress);

    return progress;
  }

  /**
   * Computes exact, genuine progress strictly from actual completed pages.
   * GUARANTEE: Never computes simulated or fake progress!
   */
  public static recalculateProgress(progress: OcrDocumentProgress): void {
    if (progress.totalPages <= 0) {
      progress.percentage = 100;
      progress.isComplete = true;
      return;
    }

    // Strictly real completion percentage based on actual completed pages
    const truePercentage = Math.round((progress.completedPages / progress.totalPages) * 100);
    progress.percentage = Math.min(100, Math.max(0, truePercentage));

    // Check if all chunks have finished processing (either COMPLETE, FAILED, or REVIEW_REQUIRED)
    const allTerminal = progress.chunks.every(
      (c) => c.status === "COMPLETE" || c.status === "FAILED" || c.status === "REVIEW_REQUIRED",
    );
    progress.isComplete = allTerminal;
    if (allTerminal) {
      progress.activeChunkIndex = null;
    }
  }

  /**
   * Generates human-readable summary matching Requirement 24 format:
   *
   * Pages:
   * 1–10 COMPLETE
   * 11–20 PROCESSING
   * 21–30 PENDING
   */
  public static formatProgressSummary(chunks: OcrPageChunk[]): string {
    if (!chunks || chunks.length === 0) return "No chunks defined";

    return chunks.map((c) => `Pages ${c.startPage}–${c.endPage} ${c.status}`).join("\n");
  }

  /**
   * Helper to format a single chunk status label.
   */
  public static formatChunkLabel(chunk: OcrPageChunk): string {
    return `Pages ${chunk.startPage}–${chunk.endPage} ${chunk.status}`;
  }
}
