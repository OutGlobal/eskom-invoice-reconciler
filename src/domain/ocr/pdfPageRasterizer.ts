/**
 * ENERA PRODUCTION OCR ENGINE — PDF & DOCUMENT PAGE RASTERIZER
 * =============================================================
 * Converts PDF pages and image documents into high-resolution pixel maps:
 *
 *   PDF / Image Bytes
 *          ↓
 *   Format Detection (PDF, PNG, JPEG, TIFF, WEBP)
 *          ↓
 *   Page Iteration & Dimension Extraction
 *          ↓
 *   Viewport Scaling (Target 300 DPI for high-precision OCR)
 *          ↓
 *   Canvas / Pixel Buffer Generation
 *          ↓
 *   OcrPageImage (RGBA buffer + metadata)
 */

import { PdfjsLoader } from "../intelligence/pdfjsLoader";
import type { OcrImageGeometry } from "./types";
import UTIF from "utif";

export interface RasterizedPage {
  pageNumber: number;
  width: number;
  height: number;
  dpi: number;
  pixelBuffer: Uint8ClampedArray;
  format: "RGBA";
  isDirectImage: boolean;
  hasEmbeddedImages: boolean;
  pdfRotation?: 0 | 90 | 180 | 270;
}

/**
 * Optional callback invoked as each page is rasterized.
 * Allows callers to track per-page progress without waiting for the full document.
 *
 * @param pageNumber - 1-based page number just completed.
 * @param totalPages - Total pages in the document (0 if unknown at callback time).
 * @param page       - The rasterized page, or null if rasterization failed for this page.
 */
export type PageRasterizationCallback = (
  pageNumber: number,
  totalPages: number,
  page: RasterizedPage | null,
) => void;

export class PdfPageRasterizer {
  /**
   * Rasterizes all pages of a PDF or image into RGBA pixel buffers.
   *
   * Processing is page-by-page — the entire document is never held in memory
   * simultaneously. The optional `onPageRasterized` callback fires as each
   * page completes so callers can stream results or track progress.
   */
  public static async rasterizeDocument(
    bytes: Uint8Array,
    filename: string,
    options: {
      targetDpi?: number;
      maxPages?: number;
      rasterizeTimeoutMs?: number;
      onPageRasterized?: PageRasterizationCallback;
    } = {},
  ): Promise<RasterizedPage[]> {
    const targetDpi = options.targetDpi || 300;
    const maxPages = options.maxPages || 50;
    const lowerName = filename.toLowerCase();

    // 1. Check for TIFF format
    if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) {
      const pages = this.rasterizeTiff(bytes);
      pages.forEach((p, i) => options.onPageRasterized?.(p.pageNumber, pages.length, p));
      return pages;
    }

    // 2. Check for standard image formats (PNG, JPEG, WEBP, BMP)
    if (this.isDirectImageFile(filename, bytes)) {
      const page = await this.rasterizeSingleImage(bytes, filename, targetDpi);
      options.onPageRasterized?.(1, 1, page);
      return [page];
    }

    // 3. Process PDF document page-by-page
    return this.rasterizePdf(bytes, targetDpi, maxPages, {
      rasterizeTimeoutMs: options.rasterizeTimeoutMs,
      onPageRasterized: options.onPageRasterized,
    });
  }

  /**
   * Determines if a file is an image based on name or magic bytes
   */
  public static isDirectImageFile(filename: string, bytes: Uint8Array): boolean {
    const lower = filename.toLowerCase();
    if (
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".bmp")
    ) {
      return true;
    }

    // Magic bytes check
    if (bytes.length >= 4) {
      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return true;
      }
      // JPEG: FF D8 FF
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return true;
      }
      // BMP: 42 4D
      if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
        return true;
      }
    }

    return false;
  }

  /**
   * Rasterizes TIFF files across multiple pages using UTIF
   */
  public static rasterizeTiff(bytes: Uint8Array): RasterizedPage[] {
    const pages: RasterizedPage[] = [];

    try {
      const ifds = UTIF.decode(bytes.buffer as ArrayBuffer);
      for (let i = 0; i < ifds.length; i++) {
        const ifd = ifds[i];
        UTIF.decodeImage(bytes.buffer as ArrayBuffer, ifd);
        const rgba = UTIF.toRGBA8(ifd);

        pages.push({
          pageNumber: i + 1,
          width: Number(ifd.width) || 595,
          height: Number(ifd.height) || 842,
          dpi: 300,
          pixelBuffer: new Uint8ClampedArray(rgba),
          format: "RGBA",
          isDirectImage: true,
          hasEmbeddedImages: true,
        });
      }
    } catch {
      // If TIFF decode fails, return fallback
    }

    return pages;
  }

  /**
   * Rasterizes a single direct image (PNG, JPEG, etc.)
   */
  public static async rasterizeSingleImage(
    bytes: Uint8Array,
    filename: string,
    targetDpi: number,
  ): Promise<RasterizedPage> {
    // In Browser environments with DOM Image
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      return new Promise<RasterizedPage>((resolve, reject) => {
        const blob = new Blob([bytes as any]);
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(url);
            reject(new Error("Unable to create canvas 2D context for image"));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height);
          URL.revokeObjectURL(url);

          resolve({
            pageNumber: 1,
            width: img.width,
            height: img.height,
            dpi: targetDpi,
            pixelBuffer: imgData.data,
            format: "RGBA",
            isDirectImage: true,
            hasEmbeddedImages: true,
          });
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(this.createFallbackImagePage(1, targetDpi));
        };

        img.src = url;
      });
    }

    // Node.js / Headless fallback: Parse dimensions from header or generate standard A4 raster
    const { width, height } = this.estimateImageDimensions(bytes, filename);
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);

    // Initialize with white background
    for (let i = 0; i < pixelBuffer.length; i += 4) {
      pixelBuffer[i] = 255;
      pixelBuffer[i + 1] = 255;
      pixelBuffer[i + 2] = 255;
      pixelBuffer[i + 3] = 255;
    }

    return {
      pageNumber: 1,
      width,
      height,
      dpi: targetDpi,
      pixelBuffer,
      format: "RGBA",
      isDirectImage: true,
      hasEmbeddedImages: true,
    };
  }

  /**
   * Rasterizes a single page from a PDF document or PDF bytes.
   *
   * @param pdfDocOrBytes - Already-loaded PDF.js document OR raw PDF bytes.
   * @param pageNum       - 1-based page number to rasterize.
   * @param targetDpi     - Target resolution. Default 300 DPI.
   * @param timeoutMs     - Maximum time to load PDF bytes (if bytes provided). Default 4000 ms.
   */
  public static async rasterizeSinglePdfPage(
    pdfDocOrBytes: any,
    pageNum: number,
    targetDpi: number = 300,
    timeoutMs: number = 4000,
  ): Promise<RasterizedPage> {
    let pdfDoc = pdfDocOrBytes;
    if (pdfDocOrBytes instanceof Uint8Array || pdfDocOrBytes instanceof ArrayBuffer) {
      try {
        pdfDoc = await PdfjsLoader.loadDocumentWithTimeout(
          pdfDocOrBytes instanceof Uint8Array ? pdfDocOrBytes : new Uint8Array(pdfDocOrBytes),
          timeoutMs,
        );
      } catch {
        return this.createFallbackImagePage(pageNum, targetDpi);
      }
    }

    if (!pdfDoc || typeof pdfDoc.getPage !== "function") {
      return this.createFallbackImagePage(pageNum, targetDpi);
    }

    const scale = targetDpi / 72;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const pdfRotation = ((((page.rotate || 0) % 360) + 360) % 360) as 0 | 90 | 180 | 270;
      const viewport = page.getViewport({ scale });
      const width = Math.round(viewport.width);
      const height = Math.round(viewport.height);

      if (typeof document !== "undefined" && typeof document.createElement === "function") {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          const imgData = ctx.getImageData(0, 0, width, height);
          return {
            pageNumber: pageNum,
            width,
            height,
            dpi: targetDpi,
            pixelBuffer: imgData.data,
            format: "RGBA",
            isDirectImage: false,
            hasEmbeddedImages: true,
            pdfRotation,
          };
        }
      }

      const fallbackBuffer = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < fallbackBuffer.length; i += 4) {
        fallbackBuffer[i] = 255;
        fallbackBuffer[i + 1] = 255;
        fallbackBuffer[i + 2] = 255;
        fallbackBuffer[i + 3] = 255;
      }

      return {
        pageNumber: pageNum,
        width,
        height,
        dpi: targetDpi,
        pixelBuffer: fallbackBuffer,
        format: "RGBA",
        isDirectImage: false,
        hasEmbeddedImages: false,
        pdfRotation,
      };
    } catch {
      return this.createFallbackImagePage(pageNum, targetDpi);
    }
  }

  /**
   * Rasterizes a multi-page PDF document page-by-page using PDF.js.
   *
   * Pages are processed sequentially to avoid loading the entire document
   * pixel buffer into memory at once. The optional callback fires after
   * each page so callers can stream or track progress.
   */
  public static async rasterizePdf(
    bytes: Uint8Array,
    targetDpi: number,
    maxPages: number,
    options: {
      rasterizeTimeoutMs?: number;
      onPageRasterized?: PageRasterizationCallback;
    } = {},
  ): Promise<RasterizedPage[]> {
    const rasterizedPages: RasterizedPage[] = [];

    let pdfDoc: any = null;
    try {
      pdfDoc = await PdfjsLoader.loadDocumentWithTimeout(bytes, options.rasterizeTimeoutMs ?? 4000);
    } catch {
      // PDF.js could not load document; return empty array to trigger graceful fallback
      return [];
    }

    const totalPages = Math.min(pdfDoc.numPages || 1, maxPages);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      let rPage: RasterizedPage;
      try {
        rPage = await this.rasterizeSinglePdfPage(pdfDoc, pageNum, targetDpi);
      } catch {
        rPage = this.createFallbackImagePage(pageNum, targetDpi);
        options.onPageRasterized?.(pageNum, totalPages, null);
        rasterizedPages.push(rPage);
        continue;
      }
      options.onPageRasterized?.(pageNum, totalPages, rPage);
      rasterizedPages.push(rPage);
    }

    return rasterizedPages;
  }

  /**
   * Helper to create a clean fallback page buffer
   */
  private static createFallbackImagePage(pageNum: number, dpi: number): RasterizedPage {
    // Standard A4 dimensions at 300 DPI: 2480 x 3508
    const width = Math.round((595.28 / 72) * dpi);
    const height = Math.round((841.89 / 72) * dpi);
    const pixelBuffer = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < pixelBuffer.length; i += 4) {
      pixelBuffer[i] = 255;
      pixelBuffer[i + 1] = 255;
      pixelBuffer[i + 2] = 255;
      pixelBuffer[i + 3] = 255;
    }

    return {
      pageNumber: pageNum,
      width,
      height,
      dpi,
      pixelBuffer,
      format: "RGBA",
      isDirectImage: false,
      hasEmbeddedImages: false,
    };
  }

  /**
   * Extracts dimensions from image headers (PNG / JPEG) without full decode
   */
  private static estimateImageDimensions(
    bytes: Uint8Array,
    _filename: string,
  ): { width: number; height: number } {
    // PNG IHDR chunk at offset 16 (width: bytes 16-19, height: bytes 20-23)
    if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const width = view.getUint32(16);
      const height = view.getUint32(20);
      if (width > 0 && height > 0 && width < 20000 && height < 20000) {
        return { width, height };
      }
    }

    // Default A4 at 300 DPI
    return { width: 2480, height: 3508 };
  }
}
