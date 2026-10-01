/**
 * ENERA PRODUCTION OCR ENGINE — PROCESSING RUN ENGINE (Requirement 22)
 * ====================================================================
 * Creates, tracks, completes, and records reproducible & auditable OCR runs:
 *
 *   Stores:
 *   - OCR run ID
 *   - document ID
 *   - page ID (and per-page run details)
 *   - provider
 *   - provider version
 *   - configuration
 *   - language
 *   - preprocessing version
 *   - start time
 *   - end time
 *   - processing duration
 *   - status
 *   - error
 *   - output version
 */

import type {
  OcrProcessingRun,
  OcrPageProcessingRun,
  OcrProcessingRunStatus,
  OcrConfidenceTier,
} from "./types";
import { getOcrProviderConfig } from "./ocrProviderConfig";

export interface CreateRunOptions {
  ocrRunId?: string;
  documentId: string;
  pageId?: string;
  provider?: string;
  providerVersion?: string;
  configuration?: Record<string, any>;
  language?: string;
  preprocessingVersion?: string;
  outputVersion?: string;
  startTime?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  maxRetries?: number;
  chunkSize?: number;
}

export interface CreatePageRunOptions {
  ocrRunId: string;
  documentId: string;
  pageNumber: number;
  pageId?: string;
  provider?: string;
  providerVersion?: string;
  configuration?: Record<string, any>;
  language?: string;
  preprocessingVersion?: string;
  outputVersion?: string;
  startTime?: string;
}

export class OcrProcessingRunEngine {
  public static readonly CURRENT_OUTPUT_VERSION = "1.0.0";
  public static readonly CURRENT_PREPROCESSING_VERSION = "2.1.0";
  public static readonly DEFAULT_PROVIDER_VERSION = "5.3.0";

  /** In-memory audit registry of processing runs for reproducible lookup */
  private static runStore = new Map<string, OcrProcessingRun>();

  /**
   * Initializes a new OCR processing run for a document execution.
   * If a run with the given ocrRunId already exists, returns it idempotently.
   */
  public static createRun(options: CreateRunOptions): OcrProcessingRun {
    const timestamp = options.startTime || new Date().toISOString();
    const ocrRunId =
      options.ocrRunId ||
      `ocr-run-${options.documentId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Idempotency check: if run already exists in store, return existing
    const existing = this.runStore.get(ocrRunId);
    if (existing) {
      return existing;
    }

    const primaryPageId = options.pageId || `${options.documentId}-p1`;

    const config = getOcrProviderConfig();
    const provider = options.provider || config.provider || "TESSERACT_LOCAL";
    const providerVersion = options.providerVersion || this.DEFAULT_PROVIDER_VERSION;
    const language = options.language || config.language || "eng";
    const preprocessingVersion = options.preprocessingVersion || this.CURRENT_PREPROCESSING_VERSION;
    const outputVersion = options.outputVersion || this.CURRENT_OUTPUT_VERSION;

    const run: OcrProcessingRun = {
      ocrRunId,
      documentId: options.documentId,
      pageId: primaryPageId,
      pageIds: [primaryPageId],
      pageRuns: [],
      provider,
      providerVersion,
      configuration: options.configuration || {
        targetDpi: 300,
        enableDeskew: true,
        enableBinarization: true,
        timeoutMs: config.timeoutMs,
        maxPages: config.maxPages,
      },
      language,
      preprocessingVersion,
      startTime: timestamp,
      startedAt: timestamp,
      endTime: null,
      completedAt: null,
      processingDuration: null,
      processingDurationMs: null,
      status: "RUNNING",
      error: null,
      outputVersion,
      retryAttempt: 0,
      maxRetries: options.maxRetries ?? 2,
      retryHistory: [],
      idempotencyKey: options.idempotencyKey || ocrRunId,
      chunkSize: options.chunkSize,
      metadata: options.metadata || {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.runStore.set(ocrRunId, run);
    return run;
  }

  /**
   * Creates a per-page processing run audit record.
   */
  public static createPageRun(
    optionsOrRunId: CreatePageRunOptions | string,
    documentId?: string,
    pageNumber?: number,
    extraOptions?: Partial<CreatePageRunOptions>,
  ): OcrPageProcessingRun {
    const options: CreatePageRunOptions =
      typeof optionsOrRunId === "string"
        ? {
            ocrRunId: optionsOrRunId,
            documentId: documentId || "unknown-document",
            pageNumber: pageNumber || 1,
            ...extraOptions,
          }
        : optionsOrRunId;

    const timestamp = options.startTime || new Date().toISOString();
    const pageId = options.pageId || `${options.documentId}-p${options.pageNumber}`;
    const pageRunId = `${options.ocrRunId}-page-${options.pageNumber}`;

    const config = getOcrProviderConfig();
    const provider = options.provider || config.provider || "TESSERACT_LOCAL";
    const providerVersion = options.providerVersion || this.DEFAULT_PROVIDER_VERSION;
    const language = options.language || config.language || "eng";
    const preprocessingVersion = options.preprocessingVersion || this.CURRENT_PREPROCESSING_VERSION;
    const outputVersion = options.outputVersion || this.CURRENT_OUTPUT_VERSION;

    return {
      pageRunId,
      ocrRunId: options.ocrRunId,
      documentId: options.documentId,
      pageId,
      pageNumber: options.pageNumber,
      provider,
      providerVersion,
      configuration: options.configuration || {},
      language,
      preprocessingVersion,
      startTime: timestamp,
      endTime: null,
      processingDuration: null,
      status: "RUNNING",
      error: null,
      outputVersion,
    };
  }

  /**
   * Completes a per-page processing run.
   */
  public static completePageRun(
    pageRun: OcrPageProcessingRun,
    updates?: {
      characterCount?: number;
      wordCount?: number;
      lineCount?: number;
      tableCount?: number;
      confidence?: number;
      averageConfidence?: number;
      confidenceTier?: OcrConfidenceTier;
      processingDuration?: number;
      endTime?: string;
    },
  ): OcrPageProcessingRun {
    const end = updates?.endTime || new Date().toISOString();
    const startMs = new Date(pageRun.startTime).getTime();
    const endMs = new Date(end).getTime();
    const duration = updates?.processingDuration ?? Math.max(0, endMs - startMs);

    pageRun.endTime = end;
    pageRun.processingDuration = duration;
    pageRun.status = "COMPLETED";
    pageRun.error = null;
    if (updates?.characterCount !== undefined) pageRun.characterCount = updates.characterCount;
    if (updates?.wordCount !== undefined) pageRun.wordCount = updates.wordCount;
    if (updates?.lineCount !== undefined) pageRun.lineCount = updates.lineCount;
    if (updates?.tableCount !== undefined) pageRun.tableCount = updates.tableCount;
    if (updates?.confidence !== undefined) pageRun.averageConfidence = updates.confidence;
    if (updates?.averageConfidence !== undefined)
      pageRun.averageConfidence = updates.averageConfidence;
    if (updates?.confidenceTier !== undefined) pageRun.confidenceTier = updates.confidenceTier;

    return pageRun;
  }

  /**
   * Marks a per-page processing run as failed.
   */
  public static failPageRun(
    pageRun: OcrPageProcessingRun,
    error: string | Error | { code?: string; message: string; stack?: string },
    endTime?: string,
  ): OcrPageProcessingRun {
    const end = endTime || new Date().toISOString();
    const startMs = new Date(pageRun.startTime).getTime();
    const endMs = new Date(end).getTime();
    const duration = Math.max(0, endMs - startMs);

    pageRun.endTime = end;
    pageRun.processingDuration = duration;
    pageRun.status = "FAILED";
    pageRun.error =
      error instanceof Error
        ? { code: "PAGE_OCR_ERROR", message: error.message, stack: error.stack }
        : typeof error === "object"
          ? error
          : { code: "PAGE_OCR_ERROR", message: String(error) };

    return pageRun;
  }

  /**
   * Transitions run status through retry/review lifecycles (Requirement 23).
   * e.g. RUNNING -> FAILED -> RETRY_1 -> RETRY_2 -> REVIEW_REQUIRED
   */
  public static transitionRunStatus(
    runOrId: OcrProcessingRun | string,
    newStatus: OcrProcessingRunStatus,
    error?: string | Error | { code?: string; message: string; stack?: string } | null,
  ): OcrProcessingRun {
    let run: OcrProcessingRun;
    if (typeof runOrId === "string") {
      const existing = this.runStore.get(runOrId);
      if (existing) {
        run = existing;
      } else {
        run = this.createRun({ ocrRunId: runOrId, documentId: "unknown-doc" });
      }
    } else {
      run = runOrId;
    }

    run.status = newStatus;
    run.updatedAt = new Date().toISOString();
    if (error !== undefined) {
      run.error =
        error instanceof Error
          ? { code: "OCR_ERROR", message: error.message, stack: error.stack }
          : typeof error === "object" && error !== null
            ? error
            : error
              ? { code: "OCR_ERROR", message: String(error) }
              : null;
    }

    this.runStore.set(run.ocrRunId, run);
    return run;
  }

  /**
   * Completes an overall document OCR processing run and stores it in the audit registry.
   */
  public static completeRun(
    runOrId: OcrProcessingRun | string,
    updates?: {
      endTime?: string;
      processingDuration?: number;
      pageRuns?: OcrPageProcessingRun[];
      totalPages?: number;
      evidenceCount?: number;
      overallConfidence?: number;
      overallConfidenceTier?: OcrConfidenceTier;
      characterCount?: number;
      totalWords?: number;
      totalLines?: number;
      totalTables?: number;
      metadata?: Record<string, any>;
      status?: OcrProcessingRunStatus;
      chunks?: any[];
      chunkCount?: number;
      completedChunkCount?: number;
      progressPercentage?: number;
    },
  ): OcrProcessingRun {
    let run: OcrProcessingRun;
    if (typeof runOrId === "string") {
      const existing = this.runStore.get(runOrId);
      if (existing) {
        run = existing;
      } else {
        run = this.createRun({ ocrRunId: runOrId, documentId: "unknown-doc" });
      }
    } else {
      run = runOrId;
    }

    const end = updates?.endTime || new Date().toISOString();
    const startMs = new Date(run.startTime).getTime();
    const endMs = new Date(end).getTime();
    const duration = updates?.processingDuration ?? Math.max(0, endMs - startMs);

    run.endTime = end;
    run.completedAt = end;
    run.processingDuration = duration;
    run.processingDurationMs = duration;
    run.status = updates?.status || "COMPLETED";
    run.error = null;
    run.updatedAt = end;

    if (updates?.pageRuns) {
      run.pageRuns = updates.pageRuns;
      run.pageIds = updates.pageRuns.map((pr) => pr.pageId);
      if (!run.pageId && run.pageIds.length > 0) {
        run.pageId = run.pageIds[0];
      }
    }
    if (updates?.totalPages !== undefined) run.totalPages = updates.totalPages;
    if (updates?.evidenceCount !== undefined) run.evidenceCount = updates.evidenceCount;
    if (updates?.overallConfidence !== undefined) run.overallConfidence = updates.overallConfidence;
    if (updates?.overallConfidenceTier !== undefined)
      run.overallConfidenceTier = updates.overallConfidenceTier;
    if (updates?.characterCount !== undefined) run.characterCount = updates.characterCount;
    if (updates?.totalWords !== undefined) run.totalWords = updates.totalWords;
    if (updates?.totalLines !== undefined) run.totalLines = updates.totalLines;
    if (updates?.totalTables !== undefined) run.totalTables = updates.totalTables;
    if (updates?.chunks) run.chunks = updates.chunks;
    if (updates?.chunkCount !== undefined) run.chunkCount = updates.chunkCount;
    if (updates?.completedChunkCount !== undefined)
      run.completedChunkCount = updates.completedChunkCount;
    if (updates?.progressPercentage !== undefined)
      run.progressPercentage = updates.progressPercentage;
    if (updates?.metadata) {
      run.metadata = { ...run.metadata, ...updates.metadata };
    }

    this.runStore.set(run.ocrRunId, run);
    return run;
  }

  /**
   * Marks an overall document OCR processing run as failed and stores the failure diagnostic.
   */
  public static failRun(
    runOrId: OcrProcessingRun | string,
    error: string | Error | { code?: string; message: string; stack?: string },
    endTime?: string,
    status: OcrProcessingRunStatus = "FAILED",
  ): OcrProcessingRun {
    let run: OcrProcessingRun;
    if (typeof runOrId === "string") {
      const existing = this.runStore.get(runOrId);
      if (existing) {
        run = existing;
      } else {
        run = this.createRun({ ocrRunId: runOrId, documentId: "unknown-doc" });
      }
    } else {
      run = runOrId;
    }

    const end = endTime || new Date().toISOString();
    const startMs = new Date(run.startTime).getTime();
    const endMs = new Date(end).getTime();
    const duration = Math.max(0, endMs - startMs);

    run.endTime = end;
    run.completedAt = end;
    run.processingDuration = duration;
    run.processingDurationMs = duration;
    run.status = status;
    run.error =
      error instanceof Error
        ? { code: "OCR_EXECUTION_FAILURE", message: error.message, stack: error.stack }
        : typeof error === "object"
          ? error
          : { code: "OCR_EXECUTION_FAILURE", message: String(error) };
    run.updatedAt = end;

    this.runStore.set(run.ocrRunId, run);
    return run;
  }

  /**
   * Records or updates a processing run in the audit registry.
   */
  public static recordRun(run: OcrProcessingRun): void {
    this.runStore.set(run.ocrRunId, run);
  }

  /**
   * Retrieves a processing run by its unique OCR run ID.
   */
  public static getRun(ocrRunId: string): OcrProcessingRun | undefined {
    return this.runStore.get(ocrRunId);
  }

  /**
   * Lists all recorded processing runs, optionally filtered by document ID or filter query.
   */
  public static listRuns(
    filter?: string | { documentId?: string; status?: OcrProcessingRunStatus; provider?: string },
  ): OcrProcessingRun[] {
    const all = Array.from(this.runStore.values());
    if (!filter) return all;

    if (typeof filter === "string") {
      return all.filter((r) => r.documentId === filter);
    }

    return all.filter((r) => {
      if (filter.documentId && r.documentId !== filter.documentId) return false;
      if (filter.status && r.status !== filter.status) return false;
      if (filter.provider && r.provider !== filter.provider) return false;
      return true;
    });
  }

  /**
   * Clears the in-memory processing run store (primarily for unit test isolation).
   */
  public static clearRunRegistry(): void {
    this.runStore.clear();
  }
}
