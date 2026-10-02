/**
 * ENERA PRODUCTION OCR ENGINE — TESSERACT LOCAL PROVIDER
 * ========================================================
 * Implements `IOcrEngine` using the existing `TesseractWorkerPool`.
 *
 * This is the default provider. It runs entirely in-process with no external
 * network calls, API keys, or cloud dependencies.
 *
 * Concurrency is managed by `TesseractWorkerPool` (configurable max workers).
 * Provider falls back to the heuristic emulator if the WASM worker is
 * unavailable (headless test environments, non-WASM runtimes).
 */

import { TesseractWorkerPool } from "../tesseractWorkerPool";
import type { IOcrEngine, OcrEngineRequest, OcrEngineResult } from "../ocrEngineInterface";
import type { OcrProviderConfig } from "../ocrProviderConfig";

export class TesseractOcrProvider implements IOcrEngine {
  public readonly providerType = "TESSERACT_LOCAL" as const;

  constructor(private readonly config: OcrProviderConfig) {
    // Wire the pool's worker cap from the provider config
    TesseractWorkerPool.setMaxWorkers(config.maxWorkers);
  }

  async recognizePage(request: OcrEngineRequest): Promise<OcrEngineResult> {
    const raw = await TesseractWorkerPool.recognizeImage(
      request.imageData,
      request.width,
      request.height,
      request.pageNumber,
      {
        language: request.language ?? this.config.language,
        timeoutMs: request.timeoutMs ?? this.config.timeoutMs,
      },
    );

    return {
      ...raw,
      providerUsed: this.providerType,
    };
  }

  isAvailable(): boolean {
    // Tesseract.js is always available — worst case it uses the heuristic fallback
    return true;
  }
}
