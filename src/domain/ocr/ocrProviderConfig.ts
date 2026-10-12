/**
 * ENERA PRODUCTION OCR ENGINE — PROVIDER CONFIGURATION
 * ========================================================
 * Server-side only. Reads OCR provider settings from environment variables.
 *
 * SECURITY CONTRACT:
 * ─────────────────────────────────────────────────────────────────────────────
 * This module MUST only be imported from server-side code paths:
 *   - src/domain/ocr/*
 *   - src/domain/intelligence/*
 *   - src/server.ts
 *   - API route handlers
 *
 * It must NEVER be imported into:
 *   - React components
 *   - Client-side hooks
 *   - Anything in src/components/, src/features/, src/hooks/, src/routes/
 *
 * Variables without the VITE_ prefix are excluded from the Vite client bundle
 * by the build system. Do NOT add VITE_ to any variable in this module.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Configuration follows the existing project convention established in
 * src/lib/supabase.ts: check import.meta.env first (SSR), then process.env,
 * then fall back to a safe default.
 *
 * ENVIRONMENT VARIABLES (all server-side, no VITE_ prefix):
 *
 *   OCR_PROVIDER          — Provider identifier. Default: "TESSERACT_LOCAL"
 *                           Options: TESSERACT_LOCAL | CLOUD_GOOGLE_VISION |
 *                                    CLOUD_AZURE_DOCUMENT_INTELLIGENCE | CLOUD_AWS_TEXTRACT
 *
 *   OCR_API_KEY           — API key for cloud providers. Never set for local.
 *   OCR_ENDPOINT          — Custom endpoint URL. Cloud providers may require this.
 *   OCR_LANGUAGE          — BCP-47 language code. Default: "eng"
 *   OCR_TIMEOUT_MS        — Per-page recognition timeout (ms). Default: 8000
 *   OCR_MAX_FILE_SIZE_MB  — Maximum PDF file size in MB. Default: 50
 *   OCR_MAX_PAGES         — Maximum pages to process per document. Default: 100
 *   OCR_MAX_WORKERS       — Concurrent Tesseract workers (local only). Default: 2
 */

import type { OcrProviderType } from "./ocrEngineInterface";

// ─── Helpers (matching supabase.ts convention) ────────────────────────────────

function readEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  return undefined;
}

function readEnvNumber(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ─── Provider config ──────────────────────────────────────────────────────────

function resolveProviderType(): OcrProviderType {
  const raw = readEnv("OCR_PROVIDER")?.toUpperCase();
  const supported: OcrProviderType[] = [
    "TESSERACT_LOCAL",
    "CLOUD_GOOGLE_VISION",
    "CLOUD_AZURE_DOCUMENT_INTELLIGENCE",
    "CLOUD_AWS_TEXTRACT",
  ];
  if (raw && supported.includes(raw as OcrProviderType)) {
    return raw as OcrProviderType;
  }
  return "TESSERACT_LOCAL";
}

// ─── Exported config object ───────────────────────────────────────────────────

export interface OcrProviderConfig {
  /** Active OCR provider. Governs which engine is selected by the registry. */
  provider: OcrProviderType;
  /** API credential for cloud providers. Undefined for local Tesseract. */
  apiKey: string | undefined;
  /** Override endpoint URL for cloud providers or self-hosted OCR services. */
  endpoint: string | undefined;
  /** BCP-47 OCR language code. Passed to every engine recognise call. */
  language: string;
  /** Per-page recognition timeout in milliseconds. */
  timeoutMs: number;
  /** Maximum PDF file size in megabytes the pipeline will accept. */
  maxFileSizeMb: number;
  /** Maximum number of pages to OCR per document. */
  maxPages: number;
  /** Maximum concurrent Tesseract workers (local provider only). */
  maxWorkers: number;
}

/**
 * Resolves OCR provider configuration from server-side environment variables.
 *
 * Called once at pipeline initialisation — not on every page request.
 * The result is immutable at runtime; configuration changes require a restart.
 */
export function resolveOcrProviderConfig(): OcrProviderConfig {
  return {
    provider: resolveProviderType(),
    apiKey: readEnv("OCR_API_KEY"),
    endpoint: readEnv("OCR_ENDPOINT"),
    language: readEnv("OCR_LANGUAGE") ?? "eng",
    timeoutMs: readEnvNumber("OCR_TIMEOUT_MS", 8_000),
    maxFileSizeMb: readEnvNumber("OCR_MAX_FILE_SIZE_MB", 50),
    maxPages: readEnvNumber("OCR_MAX_PAGES", 100),
    maxWorkers: readEnvNumber("OCR_MAX_WORKERS", 2),
  };
}

/**
 * Singleton config — resolved once on first access, then cached.
 * Use this in the pipeline and providers rather than calling
 * `resolveOcrProviderConfig()` repeatedly.
 */
let _cachedConfig: OcrProviderConfig | null = null;

export function getOcrProviderConfig(): OcrProviderConfig {
  if (!_cachedConfig) {
    _cachedConfig = resolveOcrProviderConfig();
  }
  return _cachedConfig;
}

/**
 * Clears the config cache. Useful in tests that set `process.env` directly.
 */
export function resetOcrProviderConfigCache(): void {
  _cachedConfig = null;
}

/**
 * Returns true only if the configured provider is a cloud provider that
 * requires an API key. Used to gate provider availability checks.
 */
export function isCloudOcrProvider(config: OcrProviderConfig): boolean {
  return config.provider !== "TESSERACT_LOCAL" && config.provider !== "NULL_PROVIDER";
}
