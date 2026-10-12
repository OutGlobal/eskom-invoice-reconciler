/**
 * ENERA PRODUCTION OCR ENGINE — REGISTRY
 * ========================================================
 * Resolves the active `IOcrEngine` from the server-side provider configuration.
 *
 * The pipeline and HybridDocumentProcessor call `OcrEngineRegistry.get()`
 * exactly once to obtain the active engine. All OCR execution then goes
 * through `engine.recognizePage(request)`.
 *
 * Provider resolution order:
 *   1. Read OCR_PROVIDER from environment (server-side only)
 *   2. Instantiate and health-check the corresponding provider
 *   3. If the configured provider is unavailable, warn and fall back to
 *      TesseractOcrProvider (local always available)
 *   4. If Tesseract is also unavailable, use NullOcrProvider
 *
 * The resolved engine is cached for the lifetime of the process.
 * Configuration changes require a server restart.
 */

import type { IOcrEngine } from "./ocrEngineInterface";
import { getOcrProviderConfig, isCloudOcrProvider } from "./ocrProviderConfig";
import { TesseractOcrProvider } from "./providers/tesseractOcrProvider";
import { CloudOcrProvider } from "./providers/cloudOcrProvider";
import { NullOcrProvider } from "./providers/nullOcrProvider";

let _activeEngine: IOcrEngine | null = null;

/**
 * Returns the active OCR engine for this server process.
 *
 * Thread-safe for single-threaded Node.js environments.
 * On the first call it reads config, instantiates the provider, verifies
 * availability, and caches the result. Subsequent calls are O(1).
 */
export function getOcrEngine(): IOcrEngine {
  if (_activeEngine) return _activeEngine;

  const config = getOcrProviderConfig();

  let candidate: IOcrEngine;

  if (isCloudOcrProvider(config)) {
    candidate = new CloudOcrProvider(config);
    const available = candidate.isAvailable();
    if (!available) {
      console.warn(
        `[OcrEngineRegistry] Cloud provider "${config.provider}" is configured ` +
          `but is not available (missing OCR_API_KEY or OCR_ENDPOINT). ` +
          `Falling back to TesseractOcrProvider (local).`,
      );
      candidate = new TesseractOcrProvider(config);
    }
  } else {
    // TESSERACT_LOCAL is the default — always available
    candidate = new TesseractOcrProvider(config);
  }

  _activeEngine = candidate;

  console.info(
    `[OcrEngineRegistry] Active OCR provider: ${_activeEngine.providerType} ` +
      `| language=${config.language} | timeout=${config.timeoutMs}ms ` +
      `| maxPages=${config.maxPages} | maxFileSizeMb=${config.maxFileSizeMb}`,
  );

  return _activeEngine;
}

/**
 * Resets the cached engine instance. Useful in tests.
 */
export function resetOcrEngine(): void {
  _activeEngine = null;
}

/**
 * Returns the limits enforced by the active OCR configuration.
 * Used by the pipeline to reject oversized documents before processing.
 */
export function getOcrLimits(): { maxFileSizeMb: number; maxPages: number } {
  const config = getOcrProviderConfig();
  return {
    maxFileSizeMb: config.maxFileSizeMb,
    maxPages: config.maxPages,
  };
}

/**
 * Convenience type re-export so callers only need to import from this module.
 */
export type { IOcrEngine } from "./ocrEngineInterface";
export type { OcrEngineRequest, OcrEngineResult } from "./ocrEngineInterface";
