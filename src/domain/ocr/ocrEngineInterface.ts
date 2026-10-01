/**
 * ENERA PRODUCTION OCR ENGINE — PROVIDER INTERFACE
 * ========================================================
 * Provider-agnostic abstraction layer for OCR execution.
 *
 * The Document Intelligence Pipeline and Hybrid Document Processor
 * program against this interface exclusively — never against a concrete
 * provider. Swapping OCR backends requires only a configuration change.
 *
 * Architecture:
 *
 *   DocumentIntelligencePipeline / HybridDocumentProcessor
 *              ↓
 *        IOcrEngine (this interface)
 *              ↓
 *        OcrEngineRegistry.resolve()
 *              ↓
 *   ┌──────────────────────────────────┐
 *   │  TesseractOcrProvider (local)    │  — default, WASM, browser+Node
 *   │  CloudOcrProvider    (cloud)     │  — future: Google Vision, Azure AI
 *   │  NullOcrProvider     (fallback)  │  — safe zero-confidence baseline
 *   └──────────────────────────────────┘
 *
 * Mandatory rule: Providers must NEVER fabricate recognition results.
 * Uncertain text must be returned with low confidence — not omitted or invented.
 */

import type { OcrRawResult } from "./tesseractWorkerPool";

// ─── OCR Request ─────────────────────────────────────────────────────────────

/**
 * Normalised input passed to any OCR engine.
 *
 * Providers may ignore fields they do not support (e.g. a cloud API that
 * only accepts base64 images will ignore `width`/`height` used only for
 * RGBA pixel buffers).
 */
export interface OcrEngineRequest {
  /** Raw RGBA pixel buffer OR encoded image bytes (PNG/JPEG/BMP/TIFF). */
  imageData: Uint8ClampedArray | Uint8Array;
  /** Pixel width of the image — required when imageData is a raw RGBA buffer. */
  width: number;
  /** Pixel height of the image — required when imageData is a raw RGBA buffer. */
  height: number;
  /** 1-based page number within the source document. Used for ID namespacing. */
  pageNumber: number;
  /** BCP-47 language code(s) — e.g. "eng", "afr", "eng+afr". Defaults to "eng". */
  language?: string;
  /** Per-request timeout in milliseconds. Provider may enforce its own cap. */
  timeoutMs?: number;
}

// ─── OCR Response ────────────────────────────────────────────────────────────

/**
 * Normalised output returned by any OCR engine.
 *
 * This is structurally identical to `OcrRawResult` but includes a
 * `providerUsed` field so the pipeline can record which engine was active.
 */
export interface OcrEngineResult extends OcrRawResult {
  /** Identifier of the concrete provider that produced this result. */
  providerUsed: OcrProviderType;
}

// ─── Provider Types ───────────────────────────────────────────────────────────

export type OcrProviderType =
  | "TESSERACT_LOCAL"
  | "CLOUD_GOOGLE_VISION"
  | "CLOUD_AZURE_DOCUMENT_INTELLIGENCE"
  | "CLOUD_AWS_TEXTRACT"
  | "NULL_PROVIDER";

// ─── Engine Interface ─────────────────────────────────────────────────────────

/**
 * Contract that every OCR provider must satisfy.
 *
 * Implementations must be stateless or manage their own internal state.
 * The pipeline may call `recognizePage` concurrently across pages.
 */
export interface IOcrEngine {
  /** Human-readable name for logging and audit. */
  readonly providerType: OcrProviderType;

  /**
   * Recognises text and spatial coordinates from a single page image.
   * Must never throw — on failure, return a zero-confidence `OcrEngineResult`
   * with `providerUsed` set and empty `words`/`lines` arrays.
   */
  recognizePage(request: OcrEngineRequest): Promise<OcrEngineResult>;

  /**
   * Returns true if this engine is available in the current runtime.
   * Used by `OcrEngineRegistry` for health-checking before dispatch.
   */
  isAvailable(): boolean | Promise<boolean>;
}
