/**
 * ENERA PRODUCTION OCR ENGINE — CLOUD OCR PROVIDER STUB
 * ========================================================
 * Implements `IOcrEngine` for cloud-based OCR services.
 *
 * Currently a structured stub. Wire a real HTTP client here when a
 * cloud OCR contract is established. The interface ensures the pipeline
 * needs zero changes when this provider becomes active.
 *
 * Supported providers (configured via OCR_PROVIDER env var):
 *   - CLOUD_GOOGLE_VISION
 *   - CLOUD_AZURE_DOCUMENT_INTELLIGENCE
 *   - CLOUD_AWS_TEXTRACT
 *
 * Security:
 *   - API key and endpoint are injected from OcrProviderConfig (server-side only)
 *   - Never accepts credentials from the request object or caller
 *   - Never logs or surfaces credentials in responses
 */

import type {
  IOcrEngine,
  OcrEngineRequest,
  OcrEngineResult,
  OcrProviderType,
} from "../ocrEngineInterface";
import type { OcrProviderConfig } from "../ocrProviderConfig";

export class CloudOcrProvider implements IOcrEngine {
  public readonly providerType: OcrProviderType;

  constructor(private readonly config: OcrProviderConfig) {
    this.providerType = config.provider;
  }

  async recognizePage(request: OcrEngineRequest): Promise<OcrEngineResult> {
    // TODO: Implement cloud provider HTTP call.
    //
    // Pattern to follow when implementing:
    //   1. Convert imageData to base64 or multipart form data
    //   2. POST to this.config.endpoint with Authorization: this.config.apiKey
    //   3. Map provider response to OcrEngineResult (words, lines, confidence)
    //   4. Normalize bounding boxes to 0..1 relative coordinates
    //
    // Example for Google Vision:
    //   POST https://vision.googleapis.com/v1/images:annotate
    //   Authorization: Bearer <OCR_API_KEY>
    //
    // Until implemented, this provider returns a zero-confidence result
    // rather than throwing, so the pipeline can degrade gracefully.

    console.warn(
      `[CloudOcrProvider] ${this.config.provider} is configured but not yet implemented. ` +
        `Returning zero-confidence result for page ${request.pageNumber}. ` +
        `Implement the HTTP client in src/domain/ocr/providers/cloudOcrProvider.ts.`,
    );

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
    // A cloud provider is available only if both endpoint and API key are configured.
    return Boolean(this.config.apiKey) && Boolean(this.config.endpoint ?? this.config.apiKey);
  }
}
