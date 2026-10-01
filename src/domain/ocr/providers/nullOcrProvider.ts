/**
 * ENERA PRODUCTION OCR ENGINE — NULL PROVIDER
 * ========================================================
 * Safe, explicit no-op OCR provider.
 *
 * Returns a zero-confidence, empty result without invoking any OCR engine.
 * Used as the ultimate fallback when no provider is available or when
 * OCR is deliberately disabled for a deployment.
 *
 * The pipeline treats zero-confidence results as "no text extracted" and
 * marks the page as requiring human review rather than failing entirely.
 */

import type { IOcrEngine, OcrEngineRequest, OcrEngineResult } from "../ocrEngineInterface";

export class NullOcrProvider implements IOcrEngine {
  public readonly providerType = "NULL_PROVIDER" as const;

  async recognizePage(request: OcrEngineRequest): Promise<OcrEngineResult> {
    return {
      fullText: "",
      words: [],
      lines: [],
      averageConfidence: 0,
      engineUsed: "HEURISTIC_OCR_EMULATOR",
      durationMs: 0,
      providerUsed: this.providerType,
    };
  }

  isAvailable(): boolean {
    return true;
  }
}
