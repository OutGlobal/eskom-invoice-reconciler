/**
 * Page Extraction Engine
 * ========================================================
 * Stage 5 of Document Intelligence Architecture:
 * Extracts individual page representations from PDF documents:
 * - Resolves page viewport dimensions (width, height, aspect ratio)
 * - Identifies page orientation and rotation angle (0, 90, 180, 270)
 * - Detects presence of searchable embedded text layer per page
 * - Classifies whether a page is digital vs scanned
 * - Implements dual-layer resilience (PDF.js with low-level binary stream fallback)
 */

import { PdfjsLoader } from "./pdfjsLoader";
import type { ExtractedPage, PageDimensions } from "./types";

export class PageExtractionEngine {
  /**
   * Extract page models from PDF bytes
   */
  public static async extractPages(
    bytes: Uint8Array,
    pageCountHint: number = 1
  ): Promise<ExtractedPage[]> {
    // Attempt high-fidelity extraction via PDF.js with timeout protection
    try {
      const pdfjsPages = await this.extractWithPdfjs(bytes);
      // Validate that pages have valid extracted text before accepting
      if (pdfjsPages && pdfjsPages.length > 0 && pdfjsPages[0].hasText) {
        return pdfjsPages;
      }
    } catch {
      // Fall through to low-level structural extraction
    }

    return this.extractFromBinaryStream(bytes, pageCountHint);
  }

  /**
   * High-fidelity extraction using pdfjs-dist
   */
  private static async extractWithPdfjs(bytes: Uint8Array): Promise<ExtractedPage[] | null> {
    const doc = await PdfjsLoader.loadDocumentWithTimeout(bytes, 2500);
    const pages: ExtractedPage[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const items = (textContent.items || []) as Array<{ str?: string }>;
      const rawText = items.map((it) => it.str || "").join(" ");
      const characterCount = rawText.replace(/\s+/g, "").length;
      const tokenCount = items.length;

      const width = Math.round(viewport.width);
      const height = Math.round(viewport.height);
      const rotation = (viewport.rotation % 360) as 0 | 90 | 180 | 270;
      const aspectRatio = height > 0 ? Number((width / height).toFixed(3)) : 1.0;

      const hasText = characterCount > 30;
      const isScanned = !hasText;

      pages.push({
        pageNumber: i,
        dimensions: {
          width,
          height,
          aspectRatio,
          rotation,
        },
        hasText,
        isScanned,
        characterCount,
        tokenCount,
        rawText,
      });
    }

    return pages;
  }

  /**
   * Dual-layer fallback: extract page structures directly from PDF binary stream
   */
  private static extractFromBinaryStream(
    bytes: Uint8Array,
    pageCountHint: number
  ): ExtractedPage[] {
    const rawAscii = new TextDecoder("latin1").decode(bytes);
    const pages: ExtractedPage[] = [];

    // Parse /MediaBox dimensions if present: [0 0 595 842] (Standard A4: 595 x 842 pt)
    let defaultWidth = 595;
    let defaultHeight = 842;

    const mediaBoxMatch = rawAscii.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
    if (mediaBoxMatch) {
      const w = parseFloat(mediaBoxMatch[3]) - parseFloat(mediaBoxMatch[1]);
      const h = parseFloat(mediaBoxMatch[4]) - parseFloat(mediaBoxMatch[2]);
      if (w > 0 && h > 0) {
        defaultWidth = Math.round(w);
        defaultHeight = Math.round(h);
      }
    }

    // Parse page rotation
    let defaultRotation: 0 | 90 | 180 | 270 = 0;
    const rotateMatch = rawAscii.match(/\/Rotate\s+(\d+)/);
    if (rotateMatch) {
      const rot = parseInt(rotateMatch[1], 10) % 360;
      if (rot === 90 || rot === 180 || rot === 270) {
        defaultRotation = rot as 0 | 90 | 180 | 270;
      }
    }

    const defaultDimensions: PageDimensions = {
      width: defaultWidth,
      height: defaultHeight,
      aspectRatio: Number((defaultWidth / defaultHeight).toFixed(3)),
      rotation: defaultRotation,
    };

    // Extract all stream bodies: stream ... endstream
    const streamMatches = Array.from(rawAscii.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g));
    const pageCount = Math.max(1, Math.min(pageCountHint, streamMatches.length > 0 ? streamMatches.length : 1));

    for (let p = 1; p <= pageCount; p++) {
      const streamBody = streamMatches[p - 1]?.[1] || rawAscii;

      // Extract text inside parentheses before Tj/TJ operators
      const textMatches = streamBody.match(/\((?:[^)\\]|\\.)*\)/g) || [];
      const cleanTokens = textMatches.map((t) => t.slice(1, -1).replace(/\\([()\\])/g, "$1"));
      const rawText = cleanTokens.join("\n");
      const characterCount = rawText.replace(/\s+/g, "").length;
      const hasText = characterCount > 30;

      pages.push({
        pageNumber: p,
        dimensions: { ...defaultDimensions },
        hasText,
        isScanned: !hasText,
        characterCount,
        tokenCount: cleanTokens.length,
        rawText,
      });
    }

    return pages;
  }
}
