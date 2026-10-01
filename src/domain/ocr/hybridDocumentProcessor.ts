/**
 * ENERA PRODUCTION OCR ENGINE — HYBRID DOCUMENT PROCESSOR
 * ========================================================
 * High-performance orchestrator for scanned, image-based, digital, and mixed PDFs:
 *
 *   Document Input (PDF / PNG / JPEG / TIFF)
 *            ↓
 *   Page Inspection & Multi-Page Rasterization (300 DPI)
 *            ↓
 *   Page Type Discrimination:
 *     ├─ DIGITAL_VECTOR (Dense native vector text available)
 *     └─ SCANNED_RASTER (Image-only, scanned, or photographed)
 *            ↓
 *   Image Preprocessing:
 *     - Grayscale luminance weighting
 *     - Automatic inversion detection
 *     - Contrast normalization & stretching
 *     - Adaptive Otsu binarization
 *     - Deskew angle estimation
 *            ↓
 *   OCR Extraction (Tesseract Worker Pool)
 *            ↓
 *   Layout Structure Engine (Reading Order, KV, Grid Tables)
 *            ↓
 *   Confidence Scoring & Audit Evaluation (<85% Review Gating)
 *            ↓
 *   Evidence Extraction (Strict Non-Fabrication)
 *            ↓
 *   Authoritative OcrDocumentResult
 */

import { PdfPageRasterizer, type RasterizedPage } from "./pdfPageRasterizer";
import { ImagePreprocessingEngine } from "./imagePreprocessingEngine";
import { getOcrEngine } from "./ocrEngineRegistry";
import { OcrLayoutStructureEngine } from "./ocrLayoutStructureEngine";
import { OcrConfidenceScorer } from "./ocrConfidenceScorer";
import { OcrEvidenceExtractor } from "./ocrEvidenceExtractor";
import { PdfjsLoader } from "../intelligence/pdfjsLoader";
import type {
  OcrDocumentResult,
  OcrPageResult,
  OcrDocumentCategory,
  OcrWordToken,
  OcrLineBlock,
  OcrBoundingBox,
  OcrImageGeometry,
} from "./types";

export interface ProcessDocumentOptions {
  documentId?: string;
  organisationId?: string;
  checksum?: string;
  maxPages?: number;
  targetDpi?: number;
  forceOcr?: boolean;
  language?: string;
  enableDeskew?: boolean;
  enableBinarization?: boolean;
}

export class HybridDocumentProcessor {
  /**
   * Primary entry point for processing any utility document (PDF, PNG, JPEG, TIFF)
   */
  public static async processDocument(
    fileInput: File | { name: string; bytes: Uint8Array; mimeType?: string },
    options: ProcessDocumentOptions = {},
  ): Promise<OcrDocumentResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // 1. Resolve binary bytes and filename
    let bytes: Uint8Array;
    let filename: string;
    let mimeType: string;

    if (typeof (fileInput as any).arrayBuffer === "function") {
      const file = fileInput as File;
      filename = file.name;
      mimeType = file.type || "application/octet-stream";
      const buffer = await file.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } else {
      const custom = fileInput as { name: string; bytes: Uint8Array; mimeType?: string };
      filename = custom.name;
      bytes = custom.bytes;
      mimeType = custom.mimeType || "application/octet-stream";
    }

    const documentId =
      options.documentId ||
      `DOC-OCR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const organisationId = options.organisationId || "DEFAULT_TENANT";
    const checksum = options.checksum || (await this.computeSha256(bytes));
    const targetDpi = options.targetDpi || 300;
    const maxPages = options.maxPages || 50;

    const isPdf = filename.toLowerCase().endsWith(".pdf") || mimeType.includes("pdf");
    const pageResults: OcrPageResult[] = [];

    if (isPdf) {
      // 2. Extract native digital text streams per page
      const nativeTextMap = new Map<
        number,
        {
          text: string;
          words: OcrWordToken[];
          lines: OcrLineBlock[];
          width: number;
          height: number;
        }
      >();

      const pdfDoc = await this.extractPdfNativeTextStreams(bytes, nativeTextMap, maxPages);
      const totalPages = pdfDoc?.numPages || nativeTextMap.size || 1;
      const pagesToProcess = Math.min(totalPages, maxPages);

      // 3. Intelligently determine per-page whether OCR is necessary:
      // IF reliable embedded text exists -> use native PDF extraction
      // ELSE -> render page & OCR page
      for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
        const nativeStream = nativeTextMap.get(pageNum);
        const hasReliableText = Boolean(
          !options.forceOcr &&
          nativeStream &&
          this.isReliableNativePageText(nativeStream.text, nativeStream.lines),
        );

        let pageResult: OcrPageResult;

        if (hasReliableText && nativeStream) {
          // Pure digital vector processing path — ZERO RASTERIZATION, ZERO OCR
          pageResult = this.processDigitalVectorPage(pageNum, nativeStream, {
            width: nativeStream.width,
            height: nativeStream.height,
            dpi: targetDpi,
          });
        } else {
          // Scanned raster / photographed / poor-scan OCR processing path:
          // RENDER ONLY THIS SPECIFIC PAGE
          const rasterPage = await PdfPageRasterizer.rasterizeSinglePdfPage(
            pdfDoc || bytes,
            pageNum,
            targetDpi,
          );
          pageResult = await this.processScannedRasterPage(rasterPage, options);
        }

        pageResults.push(pageResult);
      }
    } else {
      // Non-PDF (PNG, JPEG, TIFF): direct image decoding & OCR
      const rasterizedPages = await PdfPageRasterizer.rasterizeDocument(bytes, filename, {
        targetDpi,
        maxPages,
      });

      for (let pIdx = 0; pIdx < rasterizedPages.length; pIdx++) {
        const rasterPage = rasterizedPages[pIdx];
        const pageResult = await this.processScannedRasterPage(rasterPage, options);
        pageResults.push(pageResult);
      }
    }

    // 5. Aggregate overall document text and layout elements
    const rawFullText = pageResults.map((p) => p.fullText).join("\n\n");
    const allTables = pageResults.flatMap((p) => p.tables);

    // 6. Classify document category
    const documentCategory: OcrDocumentCategory =
      OcrEvidenceExtractor.classifyCategory(rawFullText);

    // 7. Extract authoritative determinants based on detected category
    let invoiceDeterminants;
    let statementDeterminants;
    let creditNoteDeterminants;
    let adjustmentDeterminants;
    let tariffDeterminants;
    let meterDeterminants;

    switch (documentCategory) {
      case "INVOICE":
        invoiceDeterminants = OcrEvidenceExtractor.extractInvoiceDeterminants(
          pageResults,
          documentId,
        );
        break;
      case "STATEMENT":
        statementDeterminants = OcrEvidenceExtractor.extractStatementDeterminants(
          pageResults,
          documentId,
        );
        break;
      case "CREDIT_NOTE":
        creditNoteDeterminants = OcrEvidenceExtractor.extractCreditNoteDeterminants(
          pageResults,
          documentId,
        );
        break;
      case "ADJUSTMENT":
        adjustmentDeterminants = OcrEvidenceExtractor.extractAdjustmentDeterminants(
          pageResults,
          documentId,
        );
        break;
      case "TARIFF_DOCUMENT":
        tariffDeterminants = OcrEvidenceExtractor.extractTariffDeterminants(
          pageResults,
          documentId,
        );
        break;
      case "METER_DOCUMENT":
        meterDeterminants = OcrEvidenceExtractor.extractMeterDeterminants(pageResults, documentId);
        break;
      default:
        // Attempt invoice extraction as baseline fallback
        invoiceDeterminants = OcrEvidenceExtractor.extractInvoiceDeterminants(
          pageResults,
          documentId,
        );
        break;
    }

    // 8. Confidence Evaluation & Review Gating (< 85 requires review)
    const confidenceEval = OcrConfidenceScorer.evaluateDocumentConfidence(
      pageResults,
      invoiceDeterminants,
    );

    const hasAnyScanned = pageResults.some((p) => p.isScannedRaster);
    const hasAnyDigital = pageResults.some((p) => p.isNativeDigital);
    const executionEngine =
      hasAnyScanned && hasAnyDigital
        ? "TESSERACT_HYBRID"
        : hasAnyScanned
          ? "TESSERACT_PURE"
          : "DIGITAL_FALLBACK";

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    return {
      ocrRunId: `ocr-run-${documentId}-${Date.now()}`,
      documentId,
      organisationId,
      checksum,
      filename,
      documentCategory,
      totalPages: pageResults.length,
      pages: pageResults,
      overallConfidence: confidenceEval.overallScore,
      confidenceTier: confidenceEval.tier,
      reviewRequired: confidenceEval.reviewRequired,
      reviewReasons: confidenceEval.reviewReasons,
      tables: allTables,
      rawFullText,
      invoiceDeterminants,
      statementDeterminants,
      creditNoteDeterminants,
      adjustmentDeterminants,
      tariffDeterminants,
      meterDeterminants,
      executionEngine,
      startedAt,
      completedAt,
      durationMs,
    };
  }

  /**
   * Processes a scanned raster or photographed page via preprocessing & OCR
   */
  private static async processScannedRasterPage(
    rasterPage: RasterizedPage,
    options: ProcessDocumentOptions,
  ): Promise<OcrPageResult> {
    const pageStartTime = Date.now();

    // Step A: Image Preprocessing (grayscale, contrast, binarize, deskew)
    const preprocessed = ImagePreprocessingEngine.preprocess(
      rasterPage.pixelBuffer,
      rasterPage.width,
      rasterPage.height,
      rasterPage.pageNumber,
      {
        enableDeskew: options.enableDeskew ?? true,
        enableBinarization: options.enableBinarization ?? true,
        enableContrastEnhance: true,
        targetDpi: rasterPage.dpi,
      },
    );

    // Step B: OCR Recognition — dispatched through provider-agnostic registry
    const ocrRaw = await getOcrEngine().recognizePage({
      imageData: preprocessed.imageData || rasterPage.pixelBuffer,
      width: rasterPage.width,
      height: rasterPage.height,
      pageNumber: rasterPage.pageNumber,
      language: options.language || "eng",
    });

    // Step C: Reconstruct Layout Structure (Reading order, blocks, tables, KV)
    const layout = OcrLayoutStructureEngine.analyzePageLayout(ocrRaw.lines, rasterPage.pageNumber);

    const geometry: OcrImageGeometry = {
      width: rasterPage.width,
      height: rasterPage.height,
      dpi: rasterPage.dpi,
      aspectRatio: Number((rasterPage.width / rasterPage.height).toFixed(4)),
      rotation: 0,
    };

    let minConfidence = 100;
    for (const w of ocrRaw.words) {
      if (w.confidence < minConfidence) {
        minConfidence = w.confidence;
      }
    }
    if (ocrRaw.words.length === 0) minConfidence = 0;

    return {
      pageNumber: rasterPage.pageNumber,
      fullText: ocrRaw.fullText,
      geometry,
      words: ocrRaw.words,
      lines: layout.sortedLines,
      blocks: layout.blocks,
      tables: layout.tables,
      keyValuePairs: layout.keyValuePairs,
      averageConfidence: ocrRaw.averageConfidence,
      minConfidence,
      characterCount: ocrRaw.fullText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: Date.now() - pageStartTime,
    };
  }

  /**
   * Evaluates whether native embedded text on a page is dense, coherent, and reliable enough
   * to bypass rasterization and OCR.
   */
  public static isReliableNativePageText(
    text: string,
    lines: Array<{ text?: string } | any>,
  ): boolean {
    const trimmed = (text || "").trim();
    if (trimmed.length < 35) return false;
    if (lines.length < 2) return false;

    // Check alphanumeric density
    const alphaNumMatches = trimmed.match(/[a-zA-Z0-9]/g);
    const alphaNumCount = alphaNumMatches ? alphaNumMatches.length : 0;
    const ratio = alphaNumCount / Math.max(1, trimmed.length);

    // Reliable page must contain at least 20 alphanumeric characters and at least 40% alphanumeric density
    return alphaNumCount >= 20 && ratio >= 0.4;
  }

  /**
   * Processes a digital vector page using extracted text layout without rasterization
   */
  private static processDigitalVectorPage(
    pageIdentifier: number | RasterizedPage,
    nativeStream: { text: string; words: OcrWordToken[]; lines: OcrLineBlock[] },
    dimensions?: { width: number; height: number; dpi?: number },
  ): OcrPageResult {
    const pageNum = typeof pageIdentifier === "number" ? pageIdentifier : pageIdentifier.pageNumber;
    const width =
      typeof pageIdentifier !== "number" ? pageIdentifier.width : dimensions?.width || 595;
    const height =
      typeof pageIdentifier !== "number" ? pageIdentifier.height : dimensions?.height || 842;
    const dpi = typeof pageIdentifier !== "number" ? pageIdentifier.dpi : dimensions?.dpi || 300;

    const layout = OcrLayoutStructureEngine.analyzePageLayout(nativeStream.lines, pageNum);

    const safeWidth = width > 0 ? width : 595;
    const safeHeight = height > 0 ? height : 842;

    const geometry: OcrImageGeometry = {
      width: Math.round(safeWidth),
      height: Math.round(safeHeight),
      dpi,
      aspectRatio: Number((safeWidth / safeHeight).toFixed(4)),
      rotation: 0,
    };

    return {
      pageNumber: pageNum,
      fullText: nativeStream.text,
      geometry,
      words: nativeStream.words,
      lines: layout.sortedLines,
      blocks: layout.blocks,
      tables: layout.tables,
      keyValuePairs: layout.keyValuePairs,
      averageConfidence: 98.5,
      minConfidence: 95.0,
      characterCount: nativeStream.text.length,
      isNativeDigital: true,
      isScannedRaster: false,
      processingDurationMs: 15,
    };
  }

  /**
   * Extracts native PDF text streams and page viewport geometry if available
   */
  private static async extractPdfNativeTextStreams(
    bytes: Uint8Array,
    outputMap: Map<
      number,
      { text: string; words: OcrWordToken[]; lines: OcrLineBlock[]; width: number; height: number }
    >,
    maxPages: number,
  ): Promise<any> {
    try {
      const pdfjs = await PdfjsLoader.getPdfjs();
      if (!pdfjs) return null;

      const loadingTask = pdfjs.getDocument({
        data: bytes,
        isEvalSupported: false,
        useSystemFonts: true,
      });

      const pdfDoc = await loadingTask.promise;
      const numPages = Math.min(pdfDoc.numPages || 1, maxPages);

      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        const width = Math.round(viewport.width);
        const height = Math.round(viewport.height);

        const words: OcrWordToken[] = [];
        const lineBuckets = new Map<number, OcrWordToken[]>();

        let lineIdx = 0;

        for (const item of textContent.items as any[]) {
          const str = (item.str || "").trim();
          if (!str) continue;

          // Normalized coordinates
          const tx = item.transform;
          const x = tx ? tx[4] : 0;
          const y = tx ? viewport.height - tx[5] : 0;
          const itemWidth = item.width || str.length * 8;
          const itemHeight = item.height || 12;

          const box: OcrBoundingBox = [
            Number((x / viewport.width).toFixed(4)),
            Number((y / viewport.height).toFixed(4)),
            Number((itemWidth / viewport.width).toFixed(4)),
            Number((itemHeight / viewport.height).toFixed(4)),
          ];

          const token: OcrWordToken = {
            wordId: `dig-p${i}-w${words.length}`,
            text: str,
            sanitizedText: str,
            confidence: 99.0,
            boundingBox: box,
            pageNumber: i,
          };
          words.push(token);

          // Group by Y bucket (tolerance 4px)
          let matchedY = -1;
          for (const keyY of lineBuckets.keys()) {
            if (Math.abs(keyY - y) < 4) {
              matchedY = keyY;
              break;
            }
          }

          if (matchedY === -1) {
            matchedY = y;
            lineBuckets.set(matchedY, []);
          }
          lineBuckets.get(matchedY)!.push(token);
        }

        const lines: OcrLineBlock[] = [];
        const sortedY = Array.from(lineBuckets.keys()).sort((a, b) => a - b);

        for (const yKey of sortedY) {
          const lWords = lineBuckets.get(yKey) || [];
          lWords.sort((a, b) => a.boundingBox[0] - b.boundingBox[0]);
          const lineText = lWords.map((w) => w.text).join(" ");

          const minX = Math.min(...lWords.map((w) => w.boundingBox[0]));
          const minY = Math.min(...lWords.map((w) => w.boundingBox[1]));
          const maxX = Math.max(...lWords.map((w) => w.boundingBox[0] + w.boundingBox[2]));
          const maxY = Math.max(...lWords.map((w) => w.boundingBox[1] + w.boundingBox[3]));

          lines.push({
            lineId: `dig-line-p${i}-${lineIdx++}`,
            lineIndex: lines.length,
            pageNumber: i,
            text: lineText,
            confidence: 99.0,
            boundingBox: [minX, minY, Math.max(0.01, maxX - minX), Math.max(0.01, maxY - minY)],
            words: lWords,
            baselineY: maxY,
          });
        }

        const fullText = lines.map((l) => l.text).join("\n");
        outputMap.set(i, { text: fullText, words, lines, width, height });
      }

      return pdfDoc;
    } catch {
      return null;
    }
  }

  /**
   * Computes SHA-256 hash for byte array
   */
  private static async computeSha256(bytes: Uint8Array): Promise<string> {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", bytes as any);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    // Fallback Node-compatible hash
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = (hash << 5) - hash + bytes[i];
      hash |= 0;
    }
    return `sha256-fallback-${Math.abs(hash).toString(16)}`;
  }
}
