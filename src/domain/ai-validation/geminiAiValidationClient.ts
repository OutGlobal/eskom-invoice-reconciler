/**
 * ENERA AI VALIDATION — LIVE GEMINI AI VALIDATION CLIENT (REQUIREMENT 34)
 * =========================================================================
 * Production AI caller executing real inference via Google Gemini API:
 *
 * ZERO-FAKE-AI INVARIANT (REQUIREMENT 34):
 * 1. Never returns hard-coded mock decisions in production paths.
 * 2. If API key is available, calls Gemini model with strict JSON schema payload.
 * 3. Validates response strictly via StructuredAiResponseValidator.
 * 4. If API key is missing or model fails (Timeout/RateLimit/Unavailable),
 *    invokes real AiFailureHandler with non-destructive fallback,
 *    retaining 100% of OCR/evidence and flagging REVIEW_REQUIRED.
 */

import { StructuredAiPayloadBuilder } from "./structuredAiPayloadBuilder";
import { StructuredAiResponseValidator } from "./structuredAiResponseValidator";
import { AiFailureHandler } from "./aiFailureHandler";
import type {
  CandidateFieldValidationInput,
  AiSemanticValidationResult,
  AiFailureReason,
} from "./types";

export class GeminiAiValidationClient {
  private static readonly MODEL_NAME = "gemini-2.5-flash";
  private static readonly API_ENDPOINT_BASE =
    "https://generativelanguage.googleapis.com/v1beta/models";

  /**
   * Retrieves the Gemini API key from environment variables.
   */
  public static getApiKey(): string | undefined {
    if (typeof process !== "undefined" && process.env) {
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
      if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
    }
    // Browser Vite environment check
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      if ((import.meta as any).env.VITE_GEMINI_API_KEY) {
        return (import.meta as any).env.VITE_GEMINI_API_KEY;
      }
    }
    return undefined;
  }

  /**
   * Executes real semantic validation via Gemini.
   */
  public static async executeLiveValidation(
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
    fullDocumentText: string = "",
  ): Promise<AiSemanticValidationResult> {
    const apiKey = this.getApiKey();

    // If no API key configured, classify as real UNAVAILABLE error (zero fake AI output)
    if (!apiKey || apiKey.startsWith("mock") || apiKey === "undefined" || apiKey.trim() === "") {
      const failureRecord = AiFailureHandler.createAiFailureRecord({
        documentId,
        candidateFields,
        fullDocumentText,
        error: new Error("AI service unavailable: GEMINI_API_KEY is not configured in production environment."),
      });

      return AiFailureHandler.createSafeFallbackSemanticResult({
        documentId,
        candidateFields,
        failureRecord,
      });
    }

    // Build structured payload adhering to schema
    const structuredPayload = StructuredAiPayloadBuilder.buildPayload({
      documentId,
      candidateFields,
    });

    const endpoint = `${this.API_ENDPOINT_BASE}/${this.MODEL_NAME}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const promptText = `${structuredPayload.systemInstructions}\n\nExpected Output Schema:\n${structuredPayload.expectedOutputJsonSchema}\n\nCandidate Fields:\n${JSON.stringify(
      structuredPayload.candidateFields,
      null,
      2,
    )}`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: promptText,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1, // High determinism for factual validation
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const failureRecord = AiFailureHandler.createAiFailureRecord({
          documentId,
          candidateFields,
          fullDocumentText,
          error: new Error(`Gemini HTTP Error ${response.status}: ${errorBody.slice(0, 300)}`),
        });

        return AiFailureHandler.createSafeFallbackSemanticResult({
          documentId,
          candidateFields,
          failureRecord,
        });
      }

      const jsonResponse: any = await response.json();
      const rawText =
        jsonResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Validate structured response
      const validation = StructuredAiResponseValidator.validateResponse(
        rawText,
        documentId,
      );

      if (!validation.isValid || !validation.data) {
        const failureRecord = AiFailureHandler.createAiFailureRecord({
          documentId,
          candidateFields,
          fullDocumentText,
          error: new Error(validation.errorMessage || "AI output did not match structured schema."),
        });

        return AiFailureHandler.createSafeFallbackSemanticResult({
          documentId,
          candidateFields,
          failureRecord,
        });
      }

      // Convert validated structured output into AiSemanticValidationResult
      return StructuredAiResponseValidator.toSemanticValidationResult(
        validation.data,
      );
    } catch (err: any) {
      clearTimeout(timeoutId);
      const failureRecord = AiFailureHandler.createAiFailureRecord({
        documentId,
        candidateFields,
        fullDocumentText,
        error: err,
      });

      return AiFailureHandler.createSafeFallbackSemanticResult({
        documentId,
        candidateFields,
        failureRecord,
      });
    }
  }
}
