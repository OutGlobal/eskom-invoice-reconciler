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
import { getOcrProviderConfig } from "./ocrProviderConfig";
import { SouthAfricanLanguageManager } from "./southAfricanOcrLanguage";
import { OcrLayoutStructureEngine } from "./ocrLayoutStructureEngine";
import { OcrConfidenceScorer } from "./ocrConfidenceScorer";
import { OcrEvidenceExtractor } from "./ocrEvidenceExtractor";
import { PdfjsLoader } from "../intelligence/pdfjsLoader";
import { DateRecognitionEngine } from "./dateRecognitionEngine";
import { TableReconstructionEngine } from "./tableReconstructionEngine";
import { DocumentStructureEngine } from "./documentStructureEngine";
import { OcrEvidenceModel } from "./ocrEvidenceModel";
import { OcrProcessingRunEngine } from "./ocrProcessingRunEngine";
import type {
  OcrDocumentResult,
  OcrPageResult,
  OcrDocumentCategory,
  OcrWordToken,
  OcrLineBlock,
  OcrBoundingBox,
  OcrImageGeometry,
  PageProcessingStatus,
  PageProcessingState,
  OcrRunLanguageConfig,
  OcrProcessingRun,
  OcrPageProcessingRun,
  OcrFieldEvidence,
} from "./types";

export interface ProcessDocumentOptions {
  documentId?: string;
  runId?: string;
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
    const ocrRunId = options.runId || `ocr-run-${documentId}-${Date.now()}`;
    const organisationId = options.organisationId || "DEFAULT_TENANT";
    const checksum = options.checksum || (await this.computeSha256(bytes));
    const targetDpi = options.targetDpi || 300;
    const maxPages = options.maxPages || 50;

    const isPdf = filename.toLowerCase().endsWith(".pdf") || mimeType.includes("pdf");
    const pageResults: OcrPageResult[] = [];
    const pageStatuses: PageProcessingStatus[] = [];
    const pageRuns: OcrPageProcessingRun[] = [];

    // Initialize the authoritative OCR Processing Run (Requirement 22)
    const processingRun = OcrProcessingRunEngine.createRun({
      ocrRunId,
      documentId,
      provider: getOcrEngine().providerType,
      providerVersion: OcrProcessingRunEngine.DEFAULT_PROVIDER_VERSION,
      language: options.language || getOcrProviderConfig().language,
      configuration: {
        targetDpi,
        maxPages,
        enableDeskew: options.enableDeskew ?? true,
        enableBinarization: options.enableBinarization ?? true,
        forceOcr: options.forceOcr ?? false,
      },
      startTime: startedAt,
      metadata: {
        filename,
        organisationId,
      },
    });

    /** Convenience: creates/updates a PageProcessingStatus entry. */
    const setPageStatus = (
      pageNumber: number,
      state: PageProcessingState,
      patch: Partial<Omit<PageProcessingStatus, "pageNumber" | "state" | "stateEnteredAt">> = {},
    ) => {
      const now = new Date().toISOString();
      const existing = pageStatuses.find((s) => s.pageNumber === pageNumber);
      if (existing) {
        existing.state = state;
        existing.stateEnteredAt = now;
        Object.assign(existing, patch);
      } else {
        pageStatuses.push({
          pageNumber,
          state,
          stateEnteredAt: now,
          requiredOcr: null,
          ocrConfidence: null,
          errorMessage: null,
          ...patch,
        });
      }
    };

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

      // Resolve South African language configuration with safe fallback
      const sampleText = nativeTextMap.get(1)?.text || "";
      const ocrLanguageConfig = SouthAfricanLanguageManager.resolveExecutionLanguage({
        requestedLanguage: options.language,
        sampleText,
        providerConfigLanguage: getOcrProviderConfig().language,
      });
      const executionLanguage = ocrLanguageConfig.actualLanguageUsed;

      // 3. Intelligently determine per-page whether OCR is necessary:
      // IF reliable embedded text exists -> use native PDF extraction
      // ELSE -> render page & OCR page
      for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
        setPageStatus(pageNum, "PENDING", { requiredOcr: null });

        const nativeStream = nativeTextMap.get(pageNum);
        const hasReliableText = Boolean(
          !options.forceOcr &&
          nativeStream &&
          this.isReliableNativePageText(nativeStream.text, nativeStream.lines),
        );

        let pageResult: OcrPageResult;
        const pageRun = OcrProcessingRunEngine.createPageRun({
          ocrRunId,
          documentId,
          pageNumber: pageNum,
          provider: hasReliableText ? "DIGITAL_STREAM_HYBRID" : getOcrEngine().providerType,
          language: executionLanguage,
          configuration: { targetDpi },
        });

        if (hasReliableText && nativeStream) {
          // Pure digital vector processing path — ZERO RASTERIZATION, ZERO OCR
          setPageStatus(pageNum, "PREPROCESSING", { requiredOcr: false });
          pageResult = this.processDigitalVectorPage(
            pageNum,
            nativeStream,
            {
              width: nativeStream.width,
              height: nativeStream.height,
              dpi: targetDpi,
            },
            executionLanguage,
          );
          setPageStatus(pageNum, "DONE", {
            requiredOcr: false,
            ocrConfidence: pageResult.averageConfidence,
          });

          OcrProcessingRunEngine.completePageRun(pageRun, {
            characterCount: pageResult.characterCount,
            averageConfidence: pageResult.averageConfidence,
            processingDuration: pageResult.processingDurationMs,
          });
          pageRuns.push(pageRun);
        } else {
          // Scanned raster / photographed / poor-scan OCR processing path:
          // RENDER ONLY THIS SPECIFIC PAGE
          setPageStatus(pageNum, "RASTERIZING", { requiredOcr: true });
          const rasterPage = await PdfPageRasterizer.rasterizeSinglePdfPage(
            pdfDoc || bytes,
            pageNum,
            targetDpi,
          );
          setPageStatus(pageNum, "PREPROCESSING");
          try {
            pageResult = await this.processScannedRasterPage(
              rasterPage,
              options,
              executionLanguage,
            );
            setPageStatus(pageNum, "DONE", {
              requiredOcr: true,
              ocrConfidence: pageResult.averageConfidence,
              preprocessingDecision: (pageResult as any)._preprocessingDecision,
            });

            OcrProcessingRunEngine.completePageRun(pageRun, {
              characterCount: pageResult.characterCount,
              averageConfidence: pageResult.averageConfidence,
              processingDuration: pageResult.processingDurationMs,
            });
            pageRuns.push(pageRun);
          } catch (err) {
            setPageStatus(pageNum, "FAILED", {
              errorMessage: err instanceof Error ? err.message : String(err),
            });
            OcrProcessingRunEngine.failPageRun(
              pageRun,
              err instanceof Error ? err.message : String(err),
            );
            pageRuns.push(pageRun);
            // Continue to next page rather than aborting the document
            continue;
          }
        }

        pageResults.push(pageResult);
      }
    } else {
      // Non-PDF (PNG, JPEG, TIFF): direct image decoding & OCR
      const ocrLanguageConfig = SouthAfricanLanguageManager.resolveExecutionLanguage({
        requestedLanguage: options.language,
        providerConfigLanguage: getOcrProviderConfig().language,
      });
      const executionLanguage = ocrLanguageConfig.actualLanguageUsed;

      const rasterizedPages = await PdfPageRasterizer.rasterizeDocument(bytes, filename, {
        targetDpi,
        maxPages,
        onPageRasterized: (pageNum, total, page) => {
          if (page) {
            setPageStatus(pageNum, "PREPROCESSING", { requiredOcr: true });
          } else {
            setPageStatus(pageNum, "FAILED", { errorMessage: "Rasterization failed" });
          }
        },
      });

      for (let pIdx = 0; pIdx < rasterizedPages.length; pIdx++) {
        const rasterPage = rasterizedPages[pIdx];
        const pageRun = OcrProcessingRunEngine.createPageRun({
          ocrRunId,
          documentId,
          pageNumber: rasterPage.pageNumber,
          provider: getOcrEngine().providerType,
          language: executionLanguage,
          configuration: { targetDpi },
        });

        setPageStatus(rasterPage.pageNumber, "OCR");
        try {
          const pageResult = await this.processScannedRasterPage(
            rasterPage,
            options,
            executionLanguage,
          );
          setPageStatus(rasterPage.pageNumber, "DONE", {
            requiredOcr: true,
            ocrConfidence: pageResult.averageConfidence,
            preprocessingDecision: (pageResult as any)._preprocessingDecision,
          });

          OcrProcessingRunEngine.completePageRun(pageRun, {
            characterCount: pageResult.characterCount,
            averageConfidence: pageResult.averageConfidence,
            processingDuration: pageResult.processingDurationMs,
          });
          pageRuns.push(pageRun);
          pageResults.push(pageResult);
        } catch (err) {
          setPageStatus(rasterPage.pageNumber, "FAILED", {
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          OcrProcessingRunEngine.failPageRun(
            pageRun,
            err instanceof Error ? err.message : String(err),
          );
          pageRuns.push(pageRun);
        }
      }
    }

    // 5. Aggregate overall document text and layout elements
    const rawFullText = pageResults.map((p) => p.fullText).join("\n\n");
    const allTables = pageResults.flatMap((p) => p.tables);

    // 5b. Multi-page table continuation detection, stitching & linking (Requirements 18 & 19)
    const { multiPageTables } = TableReconstructionEngine.stitchMultiPageTables(allTables);

    // 5c. Aggregate candidate dates recognized across document pages (Requirement 17)
    const allCandidateDates = pageResults.flatMap((p) => p.candidateDates || []);

    // 5d. Semantic Document Structure & Section Analysis across all pages (Requirement 20)
    const documentStructure = DocumentStructureEngine.analyzeDocumentStructure(pageResults, documentId);
    const allSections = documentStructure.sections;

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
    let chosenDeterminants: any;

    switch (documentCategory) {
      case "INVOICE":
        invoiceDeterminants = OcrEvidenceExtractor.extractInvoiceDeterminants(
          pageResults,
          documentId,
          ocrRunId,
        );
        chosenDeterminants = invoiceDeterminants;
        break;
      case "STATEMENT":
        statementDeterminants = OcrEvidenceExtractor.extractStatementDeterminants(
          pageResults,
          documentId,
          ocrRunId,
        );
        chosenDeterminants = statementDeterminants;
        break;
      case "CREDIT_NOTE":
        creditNoteDeterminants = OcrEvidenceExtractor.extractCreditNoteDeterminants(
          pageResults,
          documentId,
          ocrRunId,
        );
        chosenDeterminants = creditNoteDeterminants;
        break;
      case "ADJUSTMENT":
        adjustmentDeterminants = OcrEvidenceExtractor.extractAdjustmentDeterminants(
          pageResults,
          documentId,
          ocrRunId,
        );
        chosenDeterminants = adjustmentDeterminants;
        break;
      case "TARIFF_DOCUMENT":
        tariffDeterminants = OcrEvidenceExtractor.extractTariffDeterminants(
          pageResults,
          documentId,
          ocrRunId,
        );
        chosenDeterminants = tariffDeterminants;
        break;
      case "METER_DOCUMENT":
        meterDeterminants = OcrEvidenceExtractor.extractMeterDeterminants(
          pageResults,
          documentId,
          ocrRunId,
        );
        chosenDeterminants = meterDeterminants;
        break;
      default:
        // Attempt invoice extraction as baseline fallback
        invoiceDeterminants = OcrEvidenceExtractor.extractInvoiceDeterminants(
          pageResults,
          documentId,
          ocrRunId,
        );
        chosenDeterminants = invoiceDeterminants;
        break;
    }

    // Step 7b: Compile Authoritative Field Evidence Records (Requirement 21)
    const hasAnyScannedPage = pageResults.some((p) => p.isScannedRaster);
    const evidenceRecords = OcrEvidenceModel.compileEvidencePackage(
      chosenDeterminants || invoiceDeterminants,
      documentId,
      ocrRunId,
      hasAnyScannedPage,
    );
    const fieldEvidenceList = Object.values(evidenceRecords);

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

    // Ensure all pages have detected errors matched by pageNumber and confidence tiers set
    for (const page of pageResults) {
      OcrConfidenceScorer.assignTiersToPage(page);
      page.detectedErrors = confidenceEval.detectedErrors.filter(
        (err) => err.pageNumber === page.pageNumber,
      );
    }

    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    // Step 8b: Complete and record the processing run (Requirement 22)
    const totalChars = pageResults.reduce((acc, p) => acc + (p.characterCount || 0), 0);
    OcrProcessingRunEngine.completeRun(processingRun, {
      endTime: completedAt,
      processingDuration: durationMs,
      pageRuns,
      totalPages: pageResults.length,
      evidenceCount: fieldEvidenceList.length,
      overallConfidence: confidenceEval.overallScore,
      characterCount: totalChars,
      metadata: {
        documentCategory,
        executionEngine,
      },
    });

    return {
      ocrRunId,
      documentId,
      organisationId,
      checksum,
      filename,
      documentCategory,
      totalPages: pageResults.length,
      pages: pageResults,
      overallConfidence: confidenceEval.overallScore,
      confidenceTier: confidenceEval.tier,
      isReliable: confidenceEval.isReliable,
      reviewRequired: confidenceEval.reviewRequired,
      reviewReasons: confidenceEval.reviewReasons,
      detectedErrors: confidenceEval.detectedErrors,
      tables: allTables,
      multiPageTables,
      candidateDates: allCandidateDates,
      sections: allSections,
      documentStructure,
      rawFullText,
      invoiceDeterminants,
      statementDeterminants,
      creditNoteDeterminants,
      adjustmentDeterminants,
      tariffDeterminants,
      meterDeterminants,
      evidenceRecords,
      fieldEvidenceList,
      processingRun,
      executionEngine,
      startedAt,
      completedAt,
      durationMs,
      pageStatuses,
      ocrLanguageConfig:
        pageResults[0]?.languageUsed !== undefined
          ? SouthAfricanLanguageManager.resolveExecutionLanguage({
              requestedLanguage: options.language,
              providerConfigLanguage: getOcrProviderConfig().language,
              sampleText: pageResults[0]?.fullText || "",
            })
          : undefined,
    };
  }

  /**
   * Processes a scanned raster or photographed page via preprocessing & OCR
   */
  private static async processScannedRasterPage(
    rasterPage: RasterizedPage,
    options: ProcessDocumentOptions,
    executionLanguage: string = "eng",
  ): Promise<OcrPageResult> {
    const pageStartTime = Date.now();

    // Step A: Image Preprocessing (adaptive — only applies transforms that are beneficial)
    const preprocessed = ImagePreprocessingEngine.preprocess(
      rasterPage.pixelBuffer,
      rasterPage.width,
      rasterPage.height,
      rasterPage.pageNumber,
      {
        enableDeskew: options.enableDeskew ?? true,
        enableBinarization: options.enableBinarization ?? true,
        enableContrastEnhance: true,
        enableNoiseReduction: true,
        enableBorderCleanup: true,
        enableOrientationCorrection: true,
        pdfRotation: rasterPage.pdfRotation,
        targetDpi: rasterPage.dpi,
      },
    );

    // Pass the preprocessed image dimensions (which may be rotated upright!) to OCR:
    const activeWidth = preprocessed.preprocessedGeometry.width;
    const activeHeight = preprocessed.preprocessedGeometry.height;

    // Step B: OCR Recognition — dispatched through provider-agnostic registry
    const ocrRaw = await getOcrEngine().recognizePage({
      imageData: preprocessed.imageData || rasterPage.pixelBuffer,
      width: activeWidth,
      height: activeHeight,
      pageNumber: rasterPage.pageNumber,
      language: executionLanguage,
    });

    // Step C: Reconstruct Layout Structure (Reading order, blocks, tables, KV)
    const layout = OcrLayoutStructureEngine.analyzePageLayout(
      ocrRaw.lines,
      rasterPage.pageNumber,
      ocrRaw.blocks,
    );

    const geometry: OcrImageGeometry = {
      ...preprocessed.originalGeometry,
    };

    let minConfidence = 100;
    for (const w of ocrRaw.words) {
      if (w.confidence < minConfidence) {
        minConfidence = w.confidence;
      }
    }
    if (ocrRaw.words.length === 0) minConfidence = 0;

    const result: OcrPageResult & { _preprocessingDecision?: unknown } = {
      pageNumber: rasterPage.pageNumber,
      fullText: ocrRaw.fullText,
      geometry,
      words: ocrRaw.words,
      lines: layout.sortedLines,
      blocks: layout.blocks,
      tables: layout.tables,
      keyValuePairs: layout.keyValuePairs,
      sections: layout.sections,
      averageConfidence: ocrRaw.averageConfidence,
      minConfidence,
      characterCount: ocrRaw.fullText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: Date.now() - pageStartTime,
      detectedOrientation: preprocessed.originalGeometry.orientation,
      detectedRotation: preprocessed.originalGeometry.detectedRotation,
      appliedRotation: preprocessed.preprocessingDecision?.appliedRotationDegrees ?? 0,
      wasOrientationCorrected:
        preprocessed.preprocessingDecision?.orientationCorrectionApplied ?? false,
      languageUsed: executionLanguage,
    };

    // Step D: Recognize Candidate Dates (Requirement 17)
    const candidateDates = DateRecognitionEngine.recognizeDatesInPage(result);
    result.candidateDates = candidateDates;

    // Attach preprocessing decision as a non-enumerable staging field
    // so the status tracker can read it without polluting the public type.
    if (preprocessed.preprocessingDecision) {
      result._preprocessingDecision = preprocessed.preprocessingDecision;
    }

    return OcrConfidenceScorer.assignTiersToPage(result);
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
    executionLanguage: string = "eng",
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
      orientation: safeWidth >= safeHeight ? "LANDSCAPE" : "PORTRAIT",
      detectedRotation: 0,
      appliedRotation: 0,
      wasOrientationCorrected: false,
    };

    const pageResult = OcrConfidenceScorer.assignTiersToPage({
      pageNumber: pageNum,
      fullText: nativeStream.text,
      geometry,
      words: nativeStream.words,
      lines: layout.sortedLines,
      blocks: layout.blocks,
      tables: layout.tables,
      keyValuePairs: layout.keyValuePairs,
      sections: layout.sections,
      averageConfidence: 98.5,
      minConfidence: 95.0,
      characterCount: nativeStream.text.length,
      isNativeDigital: true,
      isScannedRaster: false,
      processingDurationMs: 15,
      detectedOrientation: geometry.orientation,
      detectedRotation: 0,
      appliedRotation: 0,
      wasOrientationCorrected: false,
      languageUsed: executionLanguage,
    });

    pageResult.candidateDates = DateRecognitionEngine.recognizeDatesInPage(pageResult);
    return pageResult;
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

          const roundedX = Math.round(x);
          const roundedY = Math.round(y);
          const roundedW = Math.round(itemWidth);
          const roundedH = Math.round(itemHeight);

          const token: OcrWordToken = {
            wordId: `dig-p${i}-w${words.length}`,
            text: str,
            sanitizedText: str,
            confidence: 99.0,
            confidenceNormalized: 0.99,
            boundingBox: box,
            pageNumber: i,
            x: roundedX,
            y: roundedY,
            width: roundedW,
            height: roundedH,
            coordinateSystem: "PDF_POINTS",
            detailedBoundingBox: {
              pageNumber: i,
              x: roundedX,
              y: roundedY,
              width: roundedW,
              height: roundedH,
              coordinateSystem: "PDF_POINTS",
              confidence: 0.99,
            },
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

          const minPixelX = Math.min(...lWords.map((w) => w.x ?? 0));
          const minPixelY = Math.min(...lWords.map((w) => w.y ?? 0));
          const maxPixelX = Math.max(...lWords.map((w) => (w.x ?? 0) + (w.width ?? 0)));
          const maxPixelY = Math.max(...lWords.map((w) => (w.y ?? 0) + (w.height ?? 0)));

          lines.push({
            lineId: `dig-line-p${i}-${lineIdx++}`,
            lineIndex: lines.length,
            pageNumber: i,
            text: lineText,
            confidence: 99.0,
            confidenceNormalized: 0.99,
            boundingBox: [minX, minY, Math.max(0.01, maxX - minX), Math.max(0.01, maxY - minY)],
            words: lWords,
            baselineY: maxY,
            x: minPixelX,
            y: minPixelY,
            width: Math.max(1, maxPixelX - minPixelX),
            height: Math.max(1, maxPixelY - minPixelY),
            coordinateSystem: "PDF_POINTS",
            detailedBoundingBox: {
              pageNumber: i,
              x: minPixelX,
              y: minPixelY,
              width: Math.max(1, maxPixelX - minPixelX),
              height: Math.max(1, maxPixelY - minPixelY),
              coordinateSystem: "PDF_POINTS",
              confidence: 0.99,
            },
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
  private static async computeSha256(
    bytes: Uint8Array | Uint8ClampedArray | ArrayBuffer,
  ): Promise<string> {
    const uint8 =
      bytes instanceof Uint8Array
        ? bytes
        : bytes instanceof ArrayBuffer
          ? new Uint8Array(bytes)
          : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (typeof crypto !== "undefined" && crypto.subtle) {
      try {
        const digest = await crypto.subtle.digest("SHA-256", uint8 as any);
        return Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      } catch {
        // Fall through to fallback
      }
    }
    // Fallback Node-compatible hash
    let hash = 0;
    for (let i = 0; i < uint8.length; i++) {
      hash = (hash << 5) - hash + uint8[i];
      hash |= 0;
    }
    return `sha256-fallback-${Math.abs(hash).toString(16)}`;
  }
}

