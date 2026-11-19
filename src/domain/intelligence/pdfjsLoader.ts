/** PDF.js runtime initialization and bounded document loading. */
export class PdfjsLoader {
  private static initialization?: Promise<typeof import("pdfjs-dist")>;

  public static getPdfjs(): Promise<typeof import("pdfjs-dist")> {
    this.initialization ??= this.initialize();
    return this.initialization;
  }

  private static async initialize(): Promise<typeof import("pdfjs-dist")> {
    if (typeof window === "undefined") {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      // Bundled servers have no worker file adjacent to the PDF.js module.
      Object.assign(globalThis, { pdfjsWorker: worker });
      return pdfjs;
    }

    const pdfjs = await import("pdfjs-dist");
    const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  }

  /**
   * Load PDF document with strict timeout (default 15000ms) to prevent worker deadlocks
   */
  public static async loadDocumentWithTimeout(bytes: Uint8Array, timeoutMs = 15000): Promise<any> {
    const pdfjs = await this.getPdfjs();

    const task = pdfjs.getDocument({ data: bytes.slice() });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        task.promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("PDF.js document loading timed out")), timeoutMs);
        }),
      ]);
    } catch (error) {
      void task.destroy().catch(() => undefined);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
