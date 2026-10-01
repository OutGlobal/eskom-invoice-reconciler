/**
 * PDF Inspection Engine
 * ========================================================
 * Stage 3 of Document Intelligence Architecture:
 * Performs comprehensive inspection of PDF documents:
 * - Number of pages
 * - Whether text is embedded (digital text stream)
 * - Whether pages contain images (XObjects, inline images)
 * - Whether pages appear scanned (raster heuristics)
 * - Whether text extraction is possible (native text stream)
 * - Whether OCR is likely required ("Do not unnecessarily OCR a high-quality text PDF")
 * - Document metadata where available (Title, Author, Subject, Creator, Producer, Dates, Version)
 * - Page dimensions (width, height, aspect ratio, units)
 * - Orientation (PORTRAIT vs LANDSCAPE, rotation: 0, 90, 180, 270)
 * - Detected tables where possible (headers, row counts, confidence)
 *
 * Architectural Workflow Classification:
 * 1. TEXT PDF:
 *    PDF ──► Native text extraction ──► Layout analysis
 *    (OCR is bypassed: isOcrLikelyRequired = false)
 *
 * 2. SCANNED PDF:
 *    PDF ──► Page rendering ──► OCR ──► Text + layout reconstruction
 *    (OCR is queued: isOcrLikelyRequired = true)
 */

import { PdfjsLoader } from "./pdfjsLoader";
import type {
  BoundingBox,
  DocumentProcessingRoute,
  PageDimensions,
  PageInspectionDetail,
  PageOrientation,
  PdfInspectionResult,
  PdfMetadata,
  PdfTypeClassification,
  TableInspectionCandidate,
} from "./types";

export class PdfInspectionEngine {
  /**
   * Synchronously inspect raw PDF bytes and derive comprehensive structural characteristics
   */
  public static inspectPdf(bytes: Uint8Array): PdfInspectionResult {
    const inspectionNotes: string[] = [];
    const fileSizeBytes = bytes.byteLength;

    if (fileSizeBytes < 16) {
      const defaultDim: PageDimensions = {
        width: 0,
        height: 0,
        aspectRatio: 0,
        rotation: 0,
        unit: "pt",
      };
      return {
        pageCount: 0,
        hasEmbeddedText: false,
        hasImages: false,
        imageCount: 0,
        appearsScanned: false,
        isTextExtractionPossible: false,
        isOcrLikelyRequired: false,
        metadata: { pdfVersion: "UNKNOWN" },
        pageDimensions: defaultDim,
        orientation: "PORTRAIT",
        rotation: 0,
        detectedTables: [],
        tableCount: 0,
        pdfType: "SCANNED_PDF",
        processingRoute: "PAGE_RENDER_OCR_RECONSTRUCTION",
        workflowSteps: ["PDF", "Page rendering", "OCR", "Text + layout reconstruction"],
        pages: [],
        isScannedLikely: false,
        textExtractionPossible: false,
        ocrLikelyRequired: false,
        pdfVersion: "UNKNOWN",
        isEncrypted: false,
        fileSizeBytes,
        totalCharacterCount: 0,
        estimatedTextDensity: 0,
        integrityValid: false,
        inspectionNotes: ["File too small to be a valid PDF document"],
      };
    }

    // 1. Verify Magic Header
    const headerSlice = bytes.slice(0, Math.min(1024, bytes.byteLength));
    const headerText = new TextDecoder("latin1").decode(headerSlice);
    const magicMatch = headerText.match(/%PDF-(\d+\.\d+)/);

    let pdfVersion = "UNKNOWN";
    let integrityValid = true;

    if (magicMatch) {
      pdfVersion = magicMatch[1];
      inspectionNotes.push(`Valid PDF header confirmed: version ${pdfVersion}`);
    } else {
      integrityValid = false;
      inspectionNotes.push("Warning: Missing or malformed %PDF- magic header");
    }

    // 2. Verify Trailer %%EOF
    const trailerStart = Math.max(0, bytes.byteLength - 4096);
    const trailerSlice = bytes.slice(trailerStart);
    const trailerText = new TextDecoder("latin1").decode(trailerSlice);
    const hasEof = trailerText.includes("%%EOF");

    if (hasEof) {
      inspectionNotes.push("Valid %%EOF terminal trailer confirmed");
    } else {
      inspectionNotes.push("Notice: %%EOF trailer marker absent from terminal 4KB");
    }

    // 3. Inspect for Encryption
    const fullAscii = new TextDecoder("latin1").decode(bytes);
    const isEncrypted = /\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\b/i.test(fullAscii);
    if (isEncrypted) {
      inspectionNotes.push("Document has encrypted stream (/Encrypt dictionary detected)");
    }

    // 4. Resolve Metadata
    const metadata = this.extractPdfMetadata(fullAscii, pdfVersion);

    // 5. Resolve Page Count and Page Object Boundaries
    const pageCount = this.estimatePageCount(fullAscii);
    inspectionNotes.push(`Identified ${pageCount} structural page(s)`);

    // 6. Deep Image Stream & XObject Inspection
    const globalImageMatches = fullAscii.match(
      /\/Subtype\s*\/Image|\/Type\s*\/XObject\s*\/Subtype\s*\/Image/g,
    );
    const inlineImageMatches = fullAscii.match(/\bBI\b[\s\S]*?\bID\b[\s\S]*?\bEI\b/g);
    const totalImageCount = (globalImageMatches?.length || 0) + (inlineImageMatches?.length || 0);
    const hasImages = totalImageCount > 0;

    // 7. Parse Per-Page Inspection Details
    const pages = this.inspectIndividualPages(fullAscii, pageCount, bytes);

    // 8. Overall Character & Density Metrics
    const totalCharacterCount = pages.reduce((sum, p) => sum + p.characterCount, 0);
    const estimatedTextDensity = pageCount > 0 ? Math.round(totalCharacterCount / pageCount) : 0;
    const hasEmbeddedText = totalCharacterCount > 50 || pages.some((p) => p.hasEmbeddedText);

    // 9. Classify Scanned Likelihood and OCR Requirement
    // Heuristic:
    // - Scanned: High image presence with zero or near-zero embedded digital text
    // - High-Quality Text: Rich embedded text layer, clean glyph streams
    const scannedPagesCount = pages.filter((p) => p.appearsScanned).length;
    const isScannedLikely =
      (hasImages && totalCharacterCount < 100) ||
      (!hasEmbeddedText && fileSizeBytes > 15000) ||
      (pageCount > 0 && scannedPagesCount === pageCount);

    const appearsScanned = isScannedLikely;
    const isTextExtractionPossible = hasEmbeddedText && totalCharacterCount >= 30;

    // Strict Rule: "Do not unnecessarily OCR a high-quality text PDF."
    const isOcrLikelyRequired = appearsScanned && !isTextExtractionPossible;

    // 10. Classify PDF Type & Architectural Processing Route
    let pdfType: PdfTypeClassification = "TEXT_PDF";
    let processingRoute: DocumentProcessingRoute = "NATIVE_TEXT_LAYOUT";
    let workflowSteps = ["PDF", "Native text extraction", "Layout analysis"];

    if (appearsScanned || (!hasEmbeddedText && hasImages)) {
      pdfType = "SCANNED_PDF";
      processingRoute = "PAGE_RENDER_OCR_RECONSTRUCTION";
      workflowSteps = ["PDF", "Page rendering", "OCR", "Text + layout reconstruction"];
      inspectionNotes.push(
        "Classified as SCANNED PDF: Raster images detected without embedded text layer. OCR handoff route selected.",
      );
    } else if (scannedPagesCount > 0 && scannedPagesCount < pageCount) {
      pdfType = "HYBRID_PDF";
      processingRoute = "PAGE_RENDER_OCR_RECONSTRUCTION";
      workflowSteps = ["PDF", "Page rendering", "OCR", "Text + layout reconstruction"];
      inspectionNotes.push(
        `Classified as HYBRID PDF: ${scannedPagesCount} of ${pageCount} pages require OCR reconstruction.`,
      );
    } else {
      pdfType = "TEXT_PDF";
      processingRoute = "NATIVE_TEXT_LAYOUT";
      workflowSteps = ["PDF", "Native text extraction", "Layout analysis"];
      inspectionNotes.push(
        `Classified as high-quality TEXT PDF: ${totalCharacterCount} embedded text characters detected. OCR bypassed.`,
      );
    }

    // 11. Primary Page Dimensions & Orientation
    const primaryPage = pages[0] || {
      dimensions: { width: 595, height: 842, aspectRatio: 0.707, rotation: 0, unit: "pt" as const },
      orientation: "PORTRAIT" as const,
      rotation: 0 as const,
    };
    const pageDimensions = primaryPage.dimensions;
    const orientation = primaryPage.orientation;
    const rotation = primaryPage.rotation;

    // 12. Aggregate Detected Tables
    const detectedTables = pages.flatMap((p) => p.detectedTables);
    const tableCount = detectedTables.length;
    if (tableCount > 0) {
      inspectionNotes.push(
        `Detected ${tableCount} candidate tabular structure(s) across ${pageCount} page(s)`,
      );
    }

    return {
      // Mandated Stage 3 Properties
      pageCount,
      hasEmbeddedText,
      hasImages,
      imageCount: totalImageCount,
      appearsScanned,
      isTextExtractionPossible,
      isOcrLikelyRequired,
      metadata,
      pageDimensions,
      orientation,
      rotation,
      detectedTables,
      tableCount,

      // Workflow Classification
      pdfType,
      processingRoute,
      workflowSteps,

      // Per-Page Breakdown
      pages,

      // Backwards Compatibility Aliases & Diagnostics
      isScannedLikely,
      textExtractionPossible: isTextExtractionPossible,
      ocrLikelyRequired: isOcrLikelyRequired,
      pdfVersion,
      isEncrypted,
      fileSizeBytes,
      totalCharacterCount,
      estimatedTextDensity,
      integrityValid: integrityValid && (hasEof || pageCount > 0),
      inspectionNotes,
    };
  }

  /**
   * Asynchronously inspect PDF bytes, leveraging PDF.js when available for precise
   * font, visual layout, and glyph inspection, with automatic graceful fallback.
   */
  public static async inspectPdfAsync(bytes: Uint8Array): Promise<PdfInspectionResult> {
    // 1. Compute foundational binary inspection first
    const baseInspection = this.inspectPdf(bytes);

    if (!baseInspection.integrityValid || bytes.byteLength < 16) {
      return baseInspection;
    }

    // 2. Attempt high-fidelity enhancement via PDF.js with timeout protection
    try {
      const doc = await PdfjsLoader.loadDocumentWithTimeout(bytes, 2500);
      const numPages = doc.numPages;
      const enhancedPages: PageInspectionDetail[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();

        const items = (textContent.items || []) as Array<{ str?: string }>;
        const pageText = items.map((it) => it.str || "").join(" ");
        const charCount = pageText.replace(/\s+/g, "").length;
        const pageHasText = charCount > 30;

        const w = Math.round(viewport.width);
        const h = Math.round(viewport.height);
        const rot = (viewport.rotation % 360) as 0 | 90 | 180 | 270;
        const effectiveW = rot === 90 || rot === 270 ? h : w;
        const effectiveH = rot === 90 || rot === 270 ? w : h;
        const pageOrientation: PageOrientation = effectiveW > effectiveH ? "LANDSCAPE" : "PORTRAIT";

        // Check base page detail for image presence
        const fallbackPage = baseInspection.pages[i - 1];
        const pageHasImages = fallbackPage ? fallbackPage.hasImages : false;
        const pageImageCount = fallbackPage ? fallbackPage.imageCount : 0;
        const pageAppearsScanned = !pageHasText && (pageHasImages || bytes.byteLength > 20000);

        // Detect candidate tables from text items
        const pageTables = this.detectTablesInText(i, pageText);

        enhancedPages.push({
          pageNumber: i,
          dimensions: {
            width: effectiveW,
            height: effectiveH,
            aspectRatio: effectiveH > 0 ? Number((effectiveW / effectiveH).toFixed(3)) : 1.0,
            rotation: rot,
            unit: "pt",
          },
          orientation: pageOrientation,
          rotation: rot,
          hasEmbeddedText: pageHasText,
          characterCount: charCount,
          hasImages: pageHasImages,
          imageCount: pageImageCount,
          appearsScanned: pageAppearsScanned,
          isTextExtractionPossible: pageHasText,
          isOcrLikelyRequired: pageAppearsScanned && !pageHasText,
          detectedTables: pageTables,
        });
      }

      if (enhancedPages.length > 0) {
        const totalChars = enhancedPages.reduce((sum, p) => sum + p.characterCount, 0);
        const hasText = totalChars > 50;
        const scannedCount = enhancedPages.filter((p) => p.appearsScanned).length;
        const isScanned =
          scannedCount === enhancedPages.length || (!hasText && baseInspection.hasImages);

        const pdfType: PdfTypeClassification = isScanned
          ? "SCANNED_PDF"
          : scannedCount > 0
            ? "HYBRID_PDF"
            : "TEXT_PDF";

        const isOcrLikelyRequired = isScanned;
        const processingRoute: DocumentProcessingRoute =
          pdfType === "TEXT_PDF" ? "NATIVE_TEXT_LAYOUT" : "PAGE_RENDER_OCR_RECONSTRUCTION";

        const workflowSteps =
          pdfType === "TEXT_PDF"
            ? ["PDF", "Native text extraction", "Layout analysis"]
            : ["PDF", "Page rendering", "OCR", "Text + layout reconstruction"];

        const allTables = enhancedPages.flatMap((p) => p.detectedTables);
        const primary = enhancedPages[0];

        // Retrieve PDF.js document metadata if available
        let metadata = baseInspection.metadata;
        try {
          const pdfjsMeta = await doc.getMetadata();
          if (pdfjsMeta?.info) {
            const info = pdfjsMeta.info as Record<string, any>;
            metadata = {
              ...metadata,
              title: info.Title || metadata.title,
              author: info.Author || metadata.author,
              subject: info.Subject || metadata.subject,
              creator: info.Creator || metadata.creator,
              producer: info.Producer || metadata.producer,
              creationDate: info.CreationDate || metadata.creationDate,
              modificationDate: info.ModDate || metadata.modificationDate,
            };
          }
        } catch {
          // Keep base metadata
        }

        return {
          ...baseInspection,
          pageCount: numPages,
          hasEmbeddedText: hasText,
          appearsScanned: isScanned,
          isScannedLikely: isScanned,
          isTextExtractionPossible: hasText,
          textExtractionPossible: hasText,
          isOcrLikelyRequired,
          ocrLikelyRequired: isOcrLikelyRequired,
          metadata,
          pageDimensions: primary.dimensions,
          orientation: primary.orientation,
          rotation: primary.rotation,
          detectedTables: allTables,
          tableCount: allTables.length,
          pdfType,
          processingRoute,
          workflowSteps,
          pages: enhancedPages,
          totalCharacterCount: totalChars,
          estimatedTextDensity: numPages > 0 ? Math.round(totalChars / numPages) : 0,
        };
      }
    } catch {
      // PDF.js unavailable or errored; gracefully return binary inspection
    }

    return baseInspection;
  }

  /**
   * Helper to check if document is classified as a high-quality text PDF
   */
  public static isTextPdf(inspection: PdfInspectionResult): boolean {
    return inspection.pdfType === "TEXT_PDF" && !inspection.isOcrLikelyRequired;
  }

  /**
   * Helper to check if document is classified as a scanned PDF requiring OCR
   */
  public static isScannedPdf(inspection: PdfInspectionResult): boolean {
    return inspection.pdfType === "SCANNED_PDF" || inspection.isOcrLikelyRequired;
  }

  /**
   * Helper to retrieve recommended architectural workflow
   */
  public static getRecommendedWorkflow(inspection: PdfInspectionResult): {
    route: DocumentProcessingRoute;
    steps: string[];
    reason: string;
  } {
    if (this.isTextPdf(inspection)) {
      return {
        route: "NATIVE_TEXT_LAYOUT",
        steps: ["PDF", "Native text extraction", "Layout analysis"],
        reason:
          "High-quality digital text layer detected. OCR bypassed to preserve exact coordinates and decimal fidelity.",
      };
    }

    return {
      route: "PAGE_RENDER_OCR_RECONSTRUCTION",
      steps: ["PDF", "Page rendering", "OCR", "Text + layout reconstruction"],
      reason:
        "Scanned or raster document lacking searchable digital text stream. Optical character recognition required.",
    };
  }

  // =========================================================================
  // Low-Level Parsing Helpers
  // =========================================================================

  /**
   * Extract basic PDF metadata fields from document catalog and info dictionary
   */
  private static extractPdfMetadata(rawText: string, version: string): PdfMetadata {
    const metadata: PdfMetadata = { pdfVersion: version };

    const titleMatch = rawText.match(/\/Title\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (titleMatch) metadata.title = titleMatch[1] || titleMatch[2];

    const authorMatch = rawText.match(/\/Author\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (authorMatch) metadata.author = authorMatch[1] || authorMatch[2];

    const subjectMatch = rawText.match(/\/Subject\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (subjectMatch) metadata.subject = subjectMatch[1] || subjectMatch[2];

    const producerMatch = rawText.match(/\/Producer\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (producerMatch) metadata.producer = producerMatch[1] || producerMatch[2];

    const creatorMatch = rawText.match(/\/Creator\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (creatorMatch) metadata.creator = creatorMatch[1] || creatorMatch[2];

    const creationDateMatch = rawText.match(/\/CreationDate\s*\((D:[^)]+)\)/);
    if (creationDateMatch) metadata.creationDate = creationDateMatch[1];

    const modDateMatch = rawText.match(/\/ModDate\s*\((D:[^)]+)\)/);
    if (modDateMatch) metadata.modificationDate = modDateMatch[1];

    const keywordsMatch = rawText.match(/\/Keywords\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (keywordsMatch) {
      const kwStr = keywordsMatch[1] || keywordsMatch[2];
      metadata.keywords = kwStr.split(/[,;\s]+/).filter(Boolean);
    }

    return metadata;
  }

  /**
   * Estimate the page count from PDF object hierarchy
   */
  private static estimatePageCount(rawText: string): number {
    // 1. Primary: /Type /Pages /Count N
    const countMatch = rawText.match(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/);
    if (countMatch && countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    // 2. Secondary: Count occurrences of /Type /Page (individual page objects)
    const pageObjMatches = rawText.match(/\/Type\s*\/Page\b(?!\s*s)/g);
    if (pageObjMatches && pageObjMatches.length > 0) {
      return pageObjMatches.length;
    }

    return 1;
  }

  /**
   * Inspect individual pages directly from raw PDF streams
   */
  private static inspectIndividualPages(
    rawText: string,
    pageCount: number,
    bytes: Uint8Array,
  ): PageInspectionDetail[] {
    const pages: PageInspectionDetail[] = [];

    // Extract default /MediaBox dimensions if present: [0 0 595 842] (Standard A4: 595 x 842 pt)
    let defaultWidth = 595;
    let defaultHeight = 842;

    const globalMediaBox = rawText.match(
      /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/,
    );
    if (globalMediaBox) {
      const w = Math.abs(parseFloat(globalMediaBox[3]) - parseFloat(globalMediaBox[1]));
      const h = Math.abs(parseFloat(globalMediaBox[4]) - parseFloat(globalMediaBox[2]));
      if (w > 0 && h > 0) {
        defaultWidth = Math.round(w);
        defaultHeight = Math.round(h);
      }
    }

    // Extract page objects or content streams
    const pageObjMatches = Array.from(
      rawText.matchAll(/(\d+\s+\d+\s+obj\b[\s\S]*?\/Type\s*\/Page\b[\s\S]*?endobj)/g),
    );
    const streamMatches = Array.from(rawText.matchAll(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g));

    for (let p = 1; p <= pageCount; p++) {
      let pageText = "";
      let pageWidth = defaultWidth;
      let pageHeight = defaultHeight;
      let pageRotation: 0 | 90 | 180 | 270 = 0;

      // Extract specific page object text if found
      const pageObjStr = pageObjMatches[p - 1]?.[1] || "";
      if (pageObjStr) {
        // Page-specific MediaBox
        const mbMatch = pageObjStr.match(
          /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/,
        );
        if (mbMatch) {
          const w = Math.abs(parseFloat(mbMatch[3]) - parseFloat(mbMatch[1]));
          const h = Math.abs(parseFloat(mbMatch[4]) - parseFloat(mbMatch[2]));
          if (w > 0 && h > 0) {
            pageWidth = Math.round(w);
            pageHeight = Math.round(h);
          }
        }

        // Page-specific rotation
        const rotMatch = pageObjStr.match(/\/Rotate\s+(\d+)/);
        if (rotMatch) {
          const r = parseInt(rotMatch[1], 10) % 360;
          if (r === 90 || r === 180 || r === 270) {
            pageRotation = r as 0 | 90 | 180 | 270;
          }
        }
      }

      // Stream content for this page
      const streamBody = streamMatches[p - 1]?.[1] || (pageCount === 1 ? rawText : "");
      pageText = streamBody;

      // Image detection for this page
      const hasDocumentImages = /\/Subtype\s*\/Image|\/Type\s*\/XObject\s*\/Subtype\s*\/Image/i.test(rawText);
      const hasPageImages =
        /\/Subtype\s*\/Image|\/XObject\b[\s\S]*?\/Image/i.test(pageObjStr || streamBody) ||
        /\/[A-Za-z0-9_]+\s+Do\b/.test(streamBody) ||
        (hasDocumentImages && pageCount === 1) ||
        /\bBI\b[\s\S]*?\bEI\b/.test(streamBody);
      const pageImageMatches = (pageObjStr + streamBody).match(/\/Subtype\s*\/Image/g);
      const pageImageCount = pageImageMatches ? pageImageMatches.length : hasPageImages ? 1 : 0;

      // Embedded text tokens and characters
      const charCount = this.analyzeCharacterStreamDensity(streamBody || rawText);
      const hasEmbeddedText = charCount > 30;

      // Rotation adjustment for dimensions
      const effectiveW = pageRotation === 90 || pageRotation === 270 ? pageHeight : pageWidth;
      const effectiveH = pageRotation === 90 || pageRotation === 270 ? pageWidth : pageHeight;
      const orientation: PageOrientation = effectiveW > effectiveH ? "LANDSCAPE" : "PORTRAIT";
      const aspectRatio = effectiveH > 0 ? Number((effectiveW / effectiveH).toFixed(3)) : 1.0;

      // Scanned heuristic
      const appearsScanned =
        (hasPageImages && charCount < 50) || (!hasEmbeddedText && bytes.byteLength > 20000);
      const isTextExtractionPossible = hasEmbeddedText && charCount >= 20;
      const isOcrLikelyRequired = appearsScanned && !isTextExtractionPossible;

      // Table detection
      const pageTables = this.detectTablesInText(p, streamBody || rawText);

      pages.push({
        pageNumber: p,
        dimensions: {
          width: effectiveW,
          height: effectiveH,
          aspectRatio,
          rotation: pageRotation,
          unit: "pt",
        },
        orientation,
        rotation: pageRotation,
        hasEmbeddedText,
        characterCount: charCount,
        hasImages: hasPageImages,
        imageCount: pageImageCount,
        appearsScanned,
        isTextExtractionPossible,
        isOcrLikelyRequired,
        detectedTables: pageTables,
      });
    }

    return pages;
  }

  /**
   * Approximate embedded character density from text operators:
   * Looks for Tj, TJ, and text strings inside BT ... ET text blocks
   */
  private static analyzeCharacterStreamDensity(rawText: string): number {
    let count = 0;

    // Match string literals inside parentheses before Tj/TJ operators
    const textMatches = rawText.match(/\((?:[^)\\]|\\.)*\)\s*(?:Tj|'|")/g);
    if (textMatches) {
      for (const m of textMatches) {
        count += Math.max(0, m.length - 4);
      }
    }

    // Match array elements in TJ operators: [(str) 10 (str2)] TJ
    const arrayMatches = rawText.match(/\[([\s\S]*?)\]\s*TJ/g);
    if (arrayMatches) {
      for (const arr of arrayMatches) {
        const subStrings = arr.match(/\((?:[^)\\]|\\.)*\)/g);
        if (subStrings) {
          for (const s of subStrings) {
            count += Math.max(0, s.length - 2);
          }
        }
      }
    }

    // Match plain words ONLY for non-PDF raw plain text payloads
    if (count === 0 && !rawText.includes("%PDF") && !rawText.includes("obj") && !rawText.includes("endobj")) {
      const words = rawText.match(/\b[A-Za-z0-9_-]{3,}\b/g);
      if (words && words.length > 20) {
        count = words.reduce((acc, w) => acc + w.length, 0);
      }
    }

    return count;
  }

  /**
   * Detect candidate tabular structures from raw text or page streams
   */
  private static detectTablesInText(pageNumber: number, text: string): TableInspectionCandidate[] {
    const candidates: TableInspectionCandidate[] = [];

    const tableKeywords = [
      "description",
      "charge",
      "rate",
      "consumption",
      "quantity",
      "amount",
      "kwh",
      "kva",
      "kvarh",
      "reading",
      "meter",
      "subtotal",
      "total",
      "tariff",
    ];

    const lower = text.toLowerCase();
    const matchedHeaders = tableKeywords.filter((kw) => lower.includes(kw));

    // Numerical lines with currency or measurements
    const numericLineMatches = text.match(
      /(?:R\s*)?\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})|\d+\s*(?:kwh|kva|kvarh|c\/kwh|r\/kva)/gi,
    );
    const rowCount = numericLineMatches ? numericLineMatches.length : 0;

    if (matchedHeaders.length >= 2 || (matchedHeaders.length >= 1 && rowCount >= 3)) {
      candidates.push({
        tableIndex: 1,
        pageNumber,
        title: matchedHeaders.slice(0, 3).join(" / ").toUpperCase(),
        headerKeywords: matchedHeaders,
        estimatedRowCount: Math.max(2, rowCount),
        estimatedColumnCount: Math.max(2, Math.min(6, matchedHeaders.length + 1)),
        confidence: matchedHeaders.length >= 4 ? 0.95 : 0.85,
        bbox: [50, 200, 500, Math.min(400, Math.max(100, rowCount * 25))] as BoundingBox,
      });
    }

    return candidates;
  }
}
