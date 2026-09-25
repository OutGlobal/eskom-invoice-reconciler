/**
 * PDF Inspection Engine
 * ========================================================
 * Stage 4 of Document Intelligence Architecture:
 * Performs low-level inspection of PDF documents:
 * - PDF magic byte and version verification (%PDF-X.Y)
 * - Encryption and password protection detection (/Encrypt)
 * - Document metadata extraction (Title, Author, Producer, CreationDate)
 * - Page catalog count resolution (/Count, /Page objects)
 * - Text vs. Raster image density analysis (Digital vs Scanned likelihood)
 * - Header/Trailer integrity verification (%%EOF)
 */

import type { PdfInspectionResult, PdfMetadata } from "./types";

export class PdfInspectionEngine {
  /**
   * Inspect raw PDF bytes and derive structural characteristics
   */
  public static inspectPdf(bytes: Uint8Array): PdfInspectionResult {
    const inspectionNotes: string[] = [];
    const fileSizeBytes = bytes.byteLength;

    if (fileSizeBytes < 16) {
      return {
        pdfVersion: "UNKNOWN",
        isEncrypted: false,
        pageCount: 0,
        fileSizeBytes,
        hasEmbeddedText: false,
        isScannedLikely: false,
        totalCharacterCount: 0,
        estimatedTextDensity: 0,
        metadata: { pdfVersion: "UNKNOWN" },
        integrityValid: false,
        inspectionNotes: ["File too small to be a valid PDF document"],
      };
    }

    // 1. Verify Magic Header
    // Scan initial 1024 bytes for %PDF-
    const headerSlice = bytes.slice(0, Math.min(1024, bytes.byteLength));
    const headerText = new TextDecoder("latin1").decode(headerSlice);
    const magicMatch = headerText.match(/%PDF-(\d+\.\d+)/);

    let pdfVersion = "UNKNOWN";
    let integrityValid = true;

    if (magicMatch) {
      pdfVersion = magicMatch[1];
      inspectionNotes.push(`Valid PDF header detected: version ${pdfVersion}`);
    } else {
      integrityValid = false;
      inspectionNotes.push("Warning: Missing or malformed %PDF- magic header");
    }

    // 2. Verify Trailer %%EOF
    // Scan final 4096 bytes for %%EOF
    const trailerStart = Math.max(0, bytes.byteLength - 4096);
    const trailerSlice = bytes.slice(trailerStart);
    const trailerText = new TextDecoder("latin1").decode(trailerSlice);
    const hasEof = trailerText.includes("%%EOF");

    if (hasEof) {
      inspectionNotes.push("Valid %%EOF trailer boundary confirmed");
    } else {
      inspectionNotes.push("Notice: %%EOF trailer marker not found in standard terminal boundary");
    }

    // 3. Inspect for Encryption
    // Search for /Encrypt token across document structure
    const fullAscii = new TextDecoder("latin1").decode(bytes);
    const isEncrypted = /\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\b/i.test(fullAscii);
    if (isEncrypted) {
      inspectionNotes.push("Document has encrypted stream (/Encrypt dictionary present)");
    }

    // 4. Resolve Metadata
    const metadata = this.extractPdfMetadata(fullAscii, pdfVersion);

    // 5. Resolve Page Count
    const pageCount = this.estimatePageCount(fullAscii);
    inspectionNotes.push(`Identified ${pageCount} structural page(s)`);

    // 6. Character Density & Text Stream Analysis
    const textTokenCount = this.analyzeCharacterStreamDensity(fullAscii);
    const hasEmbeddedText = textTokenCount > 50;

    // Check for image stream presence
    const imageObjectMatches = fullAscii.match(/\/Subtype\s*\/Image/g);
    const imageCount = imageObjectMatches ? imageObjectMatches.length : 0;

    // Scanned document heuristic: High image ratio with low or zero character stream
    const isScannedLikely = (imageCount > 0 && textTokenCount < 100) || (!hasEmbeddedText && fileSizeBytes > 20000);
    const estimatedTextDensity = pageCount > 0 ? Math.round(textTokenCount / pageCount) : 0;

    if (isScannedLikely) {
      inspectionNotes.push("Classified as likely SCANNED or raster image PDF (OCR pipeline required)");
    } else if (hasEmbeddedText) {
      inspectionNotes.push(`Classified as BORN-DIGITAL PDF with rich embedded text stream (${textTokenCount} tokens)`);
    }

    return {
      pdfVersion,
      isEncrypted,
      pageCount,
      fileSizeBytes,
      hasEmbeddedText,
      isScannedLikely,
      totalCharacterCount: textTokenCount,
      estimatedTextDensity,
      metadata,
      integrityValid: integrityValid && (hasEof || pageCount > 0),
      inspectionNotes,
    };
  }

  /**
   * Extract basic PDF metadata fields from document catalog and info dictionary
   */
  private static extractPdfMetadata(rawText: string, version: string): PdfMetadata {
    const metadata: PdfMetadata = { pdfVersion: version };

    const titleMatch = rawText.match(/\/Title\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (titleMatch) metadata.title = titleMatch[1] || titleMatch[2];

    const authorMatch = rawText.match(/\/Author\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (authorMatch) metadata.author = authorMatch[1] || authorMatch[2];

    const producerMatch = rawText.match(/\/Producer\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (producerMatch) metadata.producer = producerMatch[1] || producerMatch[2];

    const creatorMatch = rawText.match(/\/Creator\s*(?:\(([^)]+)\)|<([0-9A-Fa-f]+)>)/);
    if (creatorMatch) metadata.creator = creatorMatch[1] || creatorMatch[2];

    const creationDateMatch = rawText.match(/\/CreationDate\s*\((D:[^)]+)\)/);
    if (creationDateMatch) metadata.creationDate = creationDateMatch[1];

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

    // Fallback default: at least 1 page if document is valid
    return 1;
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
        count += m.length - 4; // approximate length minus operator
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

    // Match plain words in case PDF was converted or uncompressed
    if (count === 0) {
      const words = rawText.match(/\b[A-Za-z0-9_-]{3,}\b/g);
      if (words && words.length > 20) {
        count = words.reduce((acc, w) => acc + w.length, 0);
      }
    }

    return count;
  }
}
