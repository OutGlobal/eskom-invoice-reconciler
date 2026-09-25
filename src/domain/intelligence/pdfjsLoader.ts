/**
 * PDF.js Runtime Loader & Environment Polyfill
 * ========================================================
 * Ensures reliable execution across Browser, Node.js, SSR, and Vitest:
 * - Polyfills Promise.try (required by pdfjs-dist v6+)
 * - Polyfills DOMMatrix (required for coordinate transforms)
 * - Manages GlobalWorkerOptions
 * - Provides fail-safe timeout protection
 */

// 1. Ensure Promise.try polyfill is installed globally immediately
if (typeof (Promise as any).try !== "function") {
  (Promise as any).try = function (fn: () => any) {
    return new Promise((resolve) => resolve(fn()));
  };
}

// 2. Ensure DOMMatrix polyfill is installed globally
if (typeof globalThis !== "undefined" && typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: any) {
      if (Array.isArray(init)) {
        this.a = init[0] ?? 1; this.b = init[1] ?? 0;
        this.c = init[2] ?? 0; this.d = init[3] ?? 1;
        this.e = init[4] ?? 0; this.f = init[5] ?? 0;
      }
    }
  };
}

export class PdfjsLoader {
  private static isInitialized = false;

  /**
   * Initialize PDF.js with environment-appropriate worker options
   */
  public static async getPdfjs(): Promise<any> {
    const pdfjs = await import("pdfjs-dist");

    if (!this.isInitialized) {
      try {
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          try {
            const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as {
              default: string;
            };
            pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
          } catch {
            pdfjs.GlobalWorkerOptions.workerSrc =
              `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.1.200"}/build/pdf.worker.min.mjs`;
          }
        }
      } catch {
        // Fallback worker configuration
      }
      this.isInitialized = true;
    }

    return pdfjs;
  }

  /**
   * Load PDF document with strict timeout (default 3000ms) to prevent worker deadlocks
   */
  public static async loadDocumentWithTimeout(bytes: Uint8Array, timeoutMs = 3000): Promise<any> {
    const pdfjs = await this.getPdfjs();

    const loadPromise = pdfjs.getDocument({
      data: bytes.slice(),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("PDF.js document loading timed out")), timeoutMs)
    );

    return Promise.race([loadPromise, timeoutPromise]);
  }
}
