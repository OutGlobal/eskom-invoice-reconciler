/**
 * Stage 3 — PDF Inspection Architecture & Verification Suite
 * ========================================================
 * Validates all Stage 3 PDF Inspection requirements:
 * 1. Automatic inspection upon upload
 * 2. Determination of:
 *    - Number of pages
 *    - Whether text is embedded
 *    - Whether pages contain images
 *    - Whether pages appear scanned
 *    - Whether text extraction is possible
 *    - Whether OCR is likely required
 *    - Document metadata where available
 *    - Page dimensions
 *    - Orientation & rotation
 *    - Detected tables where possible
 * 3. Workflow Routing distinction:
 *    - TEXT PDF: PDF -> Native text extraction -> Layout analysis
 *    - SCANNED PDF: PDF -> Page rendering -> OCR -> Text + layout reconstruction
 * 4. Critical Invariant:
 *    - "Do not unnecessarily OCR a high-quality text PDF."
 */

import { describe, expect, it } from "vitest";
import {
  DocumentIntelligencePipeline,
  PdfInspectionEngine,
  type PdfInspectionResult,
} from "@/domain/intelligence";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";

// Helper to construct a mock PDF binary with custom structure
function createMockPdf(options: {
  pageCount?: number;
  pdfVersion?: string;
  hasEmbeddedText?: boolean;
  hasImages?: boolean;
  isEncrypted?: boolean;
  orientation?: "PORTRAIT" | "LANDSCAPE";
  rotation?: 0 | 90 | 180 | 270;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
  };
  customText?: string;
}): Uint8Array {
  const version = options.pdfVersion || "1.7";
  const numPages = options.pageCount || 2;
  const isLandscape = options.orientation === "LANDSCAPE";
  const mediaBox = isLandscape ? "[0 0 842 595]" : "[0 0 595 842]";
  const rotation = options.rotation || 0;

  const title = options.metadata?.title || "Eskom Monthly Electricity Account";
  const author = options.metadata?.author || "Eskom Finance Department";
  const producer = options.metadata?.producer || "Eskom Billing Engine v9.4";
  const creator = options.metadata?.creator || "Megaflex Invoicing Subsystem";
  const creationDate = options.metadata?.creationDate || "D:20260201083000Z";

  const defaultText = `
Eskom Holdings SOC Ltd
TAX INVOICE
Account Number: 7854321098
Tax Invoice Number: INV-2026-004521
Customer Name: APEX HEAVY INDUSTRIES (PTY) LTD
VAT Registration: 4740101508
Billing Period: 2026-01-01 to 2026-01-31
Tariff: Megaflex Non-Local TOU
Supply Voltage: 132 kV Transmission
Meter Number: MS-883920-E

Description | Consumption / Quantity | Rate | Amount (R)
Active Energy Peak | 185,420 kWh | 215.45 c/kWh | R 399,487.39
Active Energy Standard | 412,650 kWh | 128.30 c/kWh | R 529,429.95
Active Energy Off-Peak | 589,110 kWh | 78.60 c/kWh | R 463,040.46
Maximum Demand | 3,450 kVA | 95.50 R/kVA | R 329,475.00
Excess Reactive Energy | 12,500 kvarh | 15.20 c/kvarh | R 1,900.00
Network Capacity Charge | 3,450 kVA | 45.20 R/kVA | R 155,940.00
Subtotal Charges | | | R 1,879,272.80
Value Added Tax (15%) | | | R 281,890.92
Total Amount Due | | | R 2,161,163.72
`;

  const textToUse = options.hasEmbeddedText === false ? "" : options.customText || defaultText;

  let objectsStr = "";
  const pageObjectIds: number[] = [];

  // Generate page objects
  for (let p = 1; p <= numPages; p++) {
    const pageObjId = 10 + p * 2;
    const contentObjId = pageObjId + 1;
    pageObjectIds.push(pageObjId);

    const streamText =
      p === 1 ? textToUse : "Annexure Remittance Advice Terms and Conditions of Electricity Supply";
    const textCommands = streamText
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line, idx) => `1 0 0 1 50 ${750 - idx * 18} Tm (${line.replace(/[()\\]/g, "")}) Tj`)
      .join("\n");

    const imageXObjectDef = options.hasImages ? "/XObject << /Im1 99 0 R >>" : "";
    const imageStream = options.hasImages ? "/Im1 Do" : "";

    objectsStr += `
${pageObjId} 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox ${mediaBox} /Rotate ${rotation} /Resources << /Font << /F1 8 0 R >> ${imageXObjectDef} >> /Contents ${contentObjId} 0 R >>
endobj
${contentObjId} 0 obj
<< /Length 2000 >>
stream
BT
/F1 12 Tf
${textCommands}
ET
${imageStream}
endstream
endobj`;
  }

  // If mock images requested, add image XObject
  let imageObjStr = "";
  if (options.hasImages) {
    imageObjStr = `
99 0 obj
<< /Type /XObject /Subtype /Image /Width 800 /Height 600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 12000 >>
stream
${"X".repeat(12000)}
endstream
endobj`;
  }

  const pdfStr = `%PDF-${version}
%âãÏÓ
1 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
2 0 obj
<< /Title (${title}) /Author (${author}) /Producer (${producer}) /Creator (${creator}) /CreationDate (${creationDate}) >>
endobj
3 0 obj
<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${numPages} >>
endobj
8 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
${objectsStr}
${imageObjStr}
trailer
<< /Root 1 0 R /Info 2 0 R ${options.isEncrypted ? "/Encrypt 90 0 R" : ""} >>
%%EOF`;

  return new TextEncoder().encode(pdfStr);
}

describe("Stage 3 — PDF Inspection Architecture & Verification Suite", () => {
  const sampleOrgId = "11111111-2222-3333-4444-555555555555";

  // =========================================================================
  // 1. Minimum Required Property Inspections
  // =========================================================================
  describe("1. Automatic Inspection & Core Property Derivation", () => {
    it("determines page count, embedded text, dimensions, and orientation accurately", () => {
      const bytes = createMockPdf({
        pageCount: 3,
        orientation: "PORTRAIT",
        rotation: 0,
      });

      const inspection: PdfInspectionResult = PdfInspectionEngine.inspectPdf(bytes);

      // Number of pages
      expect(inspection.pageCount).toBe(3);

      // Embedded text check
      expect(inspection.hasEmbeddedText).toBe(true);
      expect(inspection.totalCharacterCount).toBeGreaterThan(100);

      // Text extraction possibility
      expect(inspection.isTextExtractionPossible).toBe(true);
      expect(inspection.textExtractionPossible).toBe(true);

      // Page dimensions
      expect(inspection.pageDimensions.width).toBe(595);
      expect(inspection.pageDimensions.height).toBe(842);
      expect(inspection.pageDimensions.aspectRatio).toBeCloseTo(0.707, 2);

      // Orientation & rotation
      expect(inspection.orientation).toBe("PORTRAIT");
      expect(inspection.rotation).toBe(0);

      // Document metadata
      expect(inspection.metadata.title).toBe("Eskom Monthly Electricity Account");
      expect(inspection.metadata.author).toBe("Eskom Finance Department");
      expect(inspection.metadata.producer).toBe("Eskom Billing Engine v9.4");
      expect(inspection.metadata.creator).toBe("Megaflex Invoicing Subsystem");
      expect(inspection.metadata.pdfVersion).toBe("1.7");
    });

    it("correctly identifies landscape orientation and page rotation", () => {
      // 1. Native landscape MediaBox [0 0 842 595] with rotation 0
      const nativeLandscapeBytes = createMockPdf({
        pageCount: 1,
        orientation: "LANDSCAPE",
        rotation: 0,
      });

      const inspectionNative = PdfInspectionEngine.inspectPdf(nativeLandscapeBytes);
      expect(inspectionNative.pageCount).toBe(1);
      expect(inspectionNative.rotation).toBe(0);
      expect(inspectionNative.orientation).toBe("LANDSCAPE");
      expect(inspectionNative.pages[0].orientation).toBe("LANDSCAPE");
      expect(inspectionNative.pageDimensions.width).toBe(842);
      expect(inspectionNative.pageDimensions.height).toBe(595);

      // 2. Rotated MediaBox [0 0 595 842] with /Rotate 90 (displays landscape)
      const rotatedLandscapeBytes = createMockPdf({
        pageCount: 1,
        orientation: "PORTRAIT",
        rotation: 90,
      });

      const inspectionRotated = PdfInspectionEngine.inspectPdf(rotatedLandscapeBytes);
      expect(inspectionRotated.rotation).toBe(90);
      expect(inspectionRotated.orientation).toBe("LANDSCAPE");
      expect(inspectionRotated.pages[0].orientation).toBe("LANDSCAPE");
      expect(inspectionRotated.pageDimensions.width).toBe(842);
      expect(inspectionRotated.pageDimensions.height).toBe(595);
    });

    it("detects candidate tables with header keywords, row counts, and confidence", () => {
      const bytes = createMockPdf({ pageCount: 2 });
      const inspection = PdfInspectionEngine.inspectPdf(bytes);

      expect(inspection.tableCount).toBeGreaterThanOrEqual(1);
      expect(inspection.detectedTables.length).toBeGreaterThanOrEqual(1);

      const table = inspection.detectedTables[0];
      expect(table.pageNumber).toBe(1);
      expect(table.headerKeywords).toContain("description");
      expect(table.headerKeywords).toContain("consumption");
      expect(table.headerKeywords).toContain("rate");
      expect(table.headerKeywords).toContain("amount");
      expect(table.estimatedRowCount).toBeGreaterThanOrEqual(5);
      expect(table.confidence).toBeGreaterThanOrEqual(0.85);
    });
  });

  // =========================================================================
  // 2. High-Quality TEXT PDF vs Scanned PDF Distinction
  // =========================================================================
  describe("2. TEXT PDF vs SCANNED PDF Workflow Classification", () => {
    it("classifies high-quality text PDF as TEXT_PDF and strictly bypasses OCR", () => {
      const textPdfBytes = createMockPdf({
        pageCount: 2,
        hasEmbeddedText: true,
        hasImages: false,
      });

      const inspection = PdfInspectionEngine.inspectPdf(textPdfBytes);

      // PDF Classification
      expect(inspection.pdfType).toBe("TEXT_PDF");
      expect(inspection.processingRoute).toBe("NATIVE_TEXT_LAYOUT");
      expect(inspection.workflowSteps).toEqual([
        "PDF",
        "Native text extraction",
        "Layout analysis",
      ]);

      // CRITICAL INVARIANT: "Do not unnecessarily OCR a high-quality text PDF."
      expect(inspection.isOcrLikelyRequired).toBe(false);
      expect(inspection.ocrLikelyRequired).toBe(false);
      expect(inspection.appearsScanned).toBe(false);
      expect(inspection.isScannedLikely).toBe(false);
      expect(inspection.isTextExtractionPossible).toBe(true);

      // Helper check
      expect(PdfInspectionEngine.isTextPdf(inspection)).toBe(true);
      expect(PdfInspectionEngine.isScannedPdf(inspection)).toBe(false);

      const workflow = PdfInspectionEngine.getRecommendedWorkflow(inspection);
      expect(workflow.route).toBe("NATIVE_TEXT_LAYOUT");
      expect(workflow.steps).toEqual(["PDF", "Native text extraction", "Layout analysis"]);
    });

    it("classifies raster image document as SCANNED_PDF and routes to Page Rendering -> OCR -> Reconstruction", () => {
      const scannedPdfBytes = createMockPdf({
        pageCount: 1,
        hasEmbeddedText: false, // No embedded text layer
        hasImages: true, // Contains large raster image XObject
      });

      const inspection = PdfInspectionEngine.inspectPdf(scannedPdfBytes);

      // Image presence
      expect(inspection.hasImages).toBe(true);
      expect(inspection.imageCount).toBeGreaterThanOrEqual(1);

      // Text absence & scanned detection
      expect(inspection.hasEmbeddedText).toBe(false);
      expect(inspection.appearsScanned).toBe(true);
      expect(inspection.isScannedLikely).toBe(true);
      expect(inspection.isTextExtractionPossible).toBe(false);

      // OCR requirement
      expect(inspection.isOcrLikelyRequired).toBe(true);
      expect(inspection.ocrLikelyRequired).toBe(true);

      // Architectural classification
      expect(inspection.pdfType).toBe("SCANNED_PDF");
      expect(inspection.processingRoute).toBe("PAGE_RENDER_OCR_RECONSTRUCTION");
      expect(inspection.workflowSteps).toEqual([
        "PDF",
        "Page rendering",
        "OCR",
        "Text + layout reconstruction",
      ]);

      // Helper check
      expect(PdfInspectionEngine.isTextPdf(inspection)).toBe(false);
      expect(PdfInspectionEngine.isScannedPdf(inspection)).toBe(true);

      const workflow = PdfInspectionEngine.getRecommendedWorkflow(inspection);
      expect(workflow.route).toBe("PAGE_RENDER_OCR_RECONSTRUCTION");
      expect(workflow.steps).toEqual([
        "PDF",
        "Page rendering",
        "OCR",
        "Text + layout reconstruction",
      ]);
    });
  });

  // =========================================================================
  // 3. Integration with Ingestion Gateway & Document Intelligence Pipeline
  // =========================================================================
  describe("3. Pipeline & Ingestion Gateway Automatic Inspection", () => {
    it("automatically inspects PDF upon upload via SecureIngestionGateway", async () => {
      const textPdfBytes = createMockPdf({ pageCount: 2 });
      const filename = "Megaflex_Jan2026_TaxInvoice.pdf";

      const result = await SecureIngestionGateway.processUpload(
        textPdfBytes,
        filename,
        sampleOrgId,
        "user-auditor-101",
      );

      expect(result.success).toBe(true);
      expect(result.pdfInspection).toBeDefined();

      const insp = result.pdfInspection!;
      expect(insp.pageCount).toBe(2);
      expect(insp.pdfType).toBe("TEXT_PDF");
      expect(insp.hasEmbeddedText).toBe(true);
      expect(insp.isOcrLikelyRequired).toBe(false);
      expect(insp.workflowSteps).toEqual(["PDF", "Native text extraction", "Layout analysis"]);

      // Confirm uploadRecord captured the inspection attributes
      expect(result.uploadRecord?.pageCount).toBe(2);
      expect(result.uploadRecord?.detectedFileType).toBe("TEXT_PDF");
      expect(result.uploadRecord?.ocrStatus).toBe("NOT_REQUIRED");
    });

    it("executes DocumentIntelligencePipeline with Stage 3 inspection and verifies OCR bypass on TEXT PDF", async () => {
      const textPdfBytes = createMockPdf({ pageCount: 2 });
      const filename = "Eskom_Invoice_Digital_HighQuality.pdf";

      const pkg = await DocumentIntelligencePipeline.processDocument(
        textPdfBytes,
        filename,
        sampleOrgId,
        { skipStorageUpload: true },
      );

      // Verify Stage 3 PDF Inspection output in package
      expect(pkg.inspection).toBeDefined();
      expect(pkg.inspection.pageCount).toBe(2);
      expect(pkg.inspection.pdfType).toBe("TEXT_PDF");
      expect(pkg.inspection.isOcrLikelyRequired).toBe(false);

      // Verify Stage 10 OCR Handoff Plan strictly bypasses OCR
      expect(pkg.handoff.ocrPlan.needsOcr).toBe(false);
      expect(pkg.handoff.ocrPlan.recommendedEngine).toBe("NATIVE_PDF_TEXT_PASSTHROUGH");
      expect(pkg.handoff.ocrPlan.reason).toContain("OCR bypassed");

      // Verify document registry record reflects digital path
      expect(pkg.document.ocrStatus).toBe("NOT_REQUIRED");
      expect(pkg.document.detectedFileType).toBe("PDF_DIGITAL");
    });

    it("flags scanned document for OCR in DocumentIntelligencePipeline without crashing", async () => {
      const scannedBytes = createMockPdf({
        pageCount: 1,
        hasEmbeddedText: false,
        hasImages: true,
      });
      const filename = "Eskom_Paper_Scan_2026.pdf";

      const pkg = await DocumentIntelligencePipeline.processDocument(
        scannedBytes,
        filename,
        sampleOrgId,
        { skipStorageUpload: true },
      );

      expect(pkg.inspection.pdfType).toBe("SCANNED_PDF");
      expect(pkg.inspection.isOcrLikelyRequired).toBe(true);

      // OCR plan requires OCR
      expect(pkg.handoff.ocrPlan.needsOcr).toBe(true);
      expect(pkg.handoff.ocrPlan.recommendedEngine).toBe("TESSERACT_OCR");

      // Document registry record queues OCR and requires review
      expect(pkg.document.ocrStatus).toBe("QUEUED");
      expect(pkg.document.detectedFileType).toBe("PDF_SCANNED");
      expect(pkg.document.processingStatus).toBe("REVIEW_REQUIRED");
    });
  });

  // =========================================================================
  // 4. Robustness & Boundary Conditions
  // =========================================================================
  describe("4. Edge Cases & Integrity Handling", () => {
    it("handles tiny or malformed files safely by flagging corrupted integrity", () => {
      const badBytes = new Uint8Array([0x01, 0x02, 0x03]);
      const inspection = PdfInspectionEngine.inspectPdf(badBytes);

      expect(inspection.integrityValid).toBe(false);
      expect(inspection.pageCount).toBe(0);
      expect(inspection.inspectionNotes[0]).toContain("File too small");
    });

    it("detects encrypted PDF streams and logs encryption flag", () => {
      const encryptedBytes = createMockPdf({
        pageCount: 1,
        isEncrypted: true,
      });

      const inspection = PdfInspectionEngine.inspectPdf(encryptedBytes);
      expect(inspection.isEncrypted).toBe(true);
      expect(inspection.inspectionNotes.some((n) => n.includes("encrypted"))).toBe(true);
    });
  });
});
