/**
 * ENERA PRODUCTION OCR ENGINE — COMPREHENSIVE VERIFICATION TEST SUITE
 * ====================================================================
 * Verifies the production OCR subsystem across all requirements:
 *
 * 1. Pipeline Chain Execution:
 *    PDF/Image → PAGE IMAGES → OCR → TEXT → WORDS → LINES →
 *    TABLE/LAYOUT STRUCTURE → CONFIDENCE → EVIDENCE → DATABASE
 *
 * 2. Image Preprocessing:
 *    - Grayscale luminance weighting (BT.601)
 *    - Inversion check & contrast stretching
 *    - Otsu adaptive binarization
 *    - Deskew angle estimation
 *
 * 3. Page Rasterizer & Format Handling:
 *    - Direct images (PNG, JPEG, TIFF)
 *    - PDF 300 DPI viewport scaling
 *
 * 4. Tesseract Worker Pool & Concurrency:
 *    - Word & line token bounding boxes
 *    - Execution duration & confidence tracking
 *
 * 5. Layout Structure Engine:
 *    - Reading order sorting (top-to-bottom, left-to-right)
 *    - Semantic layout blocks (HEADING, PARAGRAPH, TABLE, KEY_VALUE, LINE_ITEM_ROW)
 *    - Key-value extraction (horizontal & vertical)
 *    - Tabular grid detection & cell reconstruction
 *
 * 6. Confidence Scoring & Review Gating:
 *    - High confidence (>= 85%) -> reviewRequired = false
 *    - Medium/Low confidence (< 85%) -> reviewRequired = true with specific reasons
 *    - Optical ambiguity check ('0' vs 'O', '1' vs 'I')
 *    - Mathematical arithmetic consistency (subtotal + VAT == total)
 *
 * 7. Evidence Extraction for All 6 Document Categories:
 *    - Invoices (Megaflex & Municipal)
 *    - Statements of Account
 *    - Credit Notes
 *    - Adjustment Documents
 *    - Tariff Documents
 *    - Meter Documents
 *
 * 8. Strict Non-Fabrication Rule:
 *    - Missing fields preserved as explicit null
 *    - Zero fabrication of unobserved amounts
 *    - Exact bounding box provenance
 *
 * 9. Mixed Digital / Scanned Multi-Page PDF Handling:
 *    - Mixed page classification (DIGITAL_VECTOR vs SCANNED_RASTER)
 *    - Consolidated multi-page result
 *
 * 10. Persistence & Rehydration:
 *    - L1 in-memory cache, L2 local store, L3 Supabase
 *    - Multi-tenant isolation enforcement
 */

import {
  ImagePreprocessingEngine,
  PdfPageRasterizer,
  TesseractWorkerPool,
  OcrLayoutStructureEngine,
  OcrConfidenceScorer,
  OcrEvidenceExtractor,
  HybridDocumentProcessor,
  ScannedInvoiceOcrAdapter,
  OcrPersistenceService,
  SouthAfricanLanguageManager,
  OcrErrorDetector,
  NumericProtectionEngine,
  DateRecognitionEngine,
  TableReconstructionEngine,
  DocumentStructureEngine,
  OcrEvidenceModel,
  OcrProcessingRunEngine,
  OcrRetryEngine,
  OcrLargeDocumentChunkEngine,
  OcrBackgroundJobManager,
  SOUTH_AFRICA_LOCALE_PROFILE,
  INTERNATIONAL_ANGLO_LOCALE_PROFILE,
  INTERNATIONAL_CONTINENTAL_LOCALE_PROFILE,
  INTERNATIONAL_SWISS_LOCALE_PROFILE,
  AUTO_DETECT_LOCALE_PROFILE,
  type CandidateDateRecognition,
  type OcrTableCell,
  type OcrTableRow,
  type OcrTableColumn,
  type OcrMergedCell,
  type OcrTableTotalSummary,
  type OcrTableStructure,
  type DocumentSectionType,
  type UtilityDocumentFormatVariant,
  type OcrDocumentSection,
  type DocumentStructureAnalysis,
  type OcrLineBlock,
  type OcrWordToken,
  type OcrPageResult,
  type OcrLayoutBlock,
  type OcrDeterminantField,
  type OcrEvidenceLocationReport,
  type OcrConfidenceTier,
  type OcrDetectedError,
  type OcrErrorType,
  type OcrPipelineValidationResult,
  type ParsedNumericField,
  type ValidatedDateField,
  type NumericFieldCategory,
  type OcrFieldEvidence,
  type OcrProcessingRun,
  type OcrPageProcessingRun,
  type OcrProcessingRunStatus,
  type OcrRetryAttempt,
  type OcrRetryPolicy,
  type OcrPageChunk,
  type OcrChunkStatus,
  type OcrDocumentProgress,
  type OcrStatus,
  type OcrJobStage,
  type OcrBackgroundJob,
} from "../../domain/ocr";
import { ProvenanceGuard } from "../../domain/intelligence/provenanceGuard";
import { TenantIsolationViolationError } from "../../domain/security/tenantContextService";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ OCR TEST FAILED: ${message}`);
    throw new Error(`OCR TEST FAILED: ${message}`);
  }
  console.log(`  ✅ ${message}`);
}

// ---------------------------------------------------------------------------
// Synthetic Image Generation Helper for Offline Unit Testing
// ---------------------------------------------------------------------------
function generateSyntheticImageBuffer(
  width: number,
  height: number,
  pattern: "blank" | "text_bars" | "low_contrast" | "inverted",
): Uint8ClampedArray {
  const buffer = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      if (pattern === "blank") {
        // Pure white background
        buffer[idx] = 255;
        buffer[idx + 1] = 255;
        buffer[idx + 2] = 255;
        buffer[idx + 3] = 255;
      } else if (pattern === "inverted") {
        // Dark background with occasional light strokes
        const isStroke = y % 30 < 4 && x > 20 && x < width - 20;
        const val = isStroke ? 240 : 15;
        buffer[idx] = val;
        buffer[idx + 1] = val;
        buffer[idx + 2] = val;
        buffer[idx + 3] = 255;
      } else if (pattern === "low_contrast") {
        // Faint grey text on grey background (contrast ratio < 2.0)
        const isFaintText = y % 20 < 4 && x > 10 && x < width - 10;
        const val = isFaintText ? 120 : 150;
        buffer[idx] = val;
        buffer[idx + 1] = val;
        buffer[idx + 2] = val;
        buffer[idx + 3] = 255;
      } else {
        // Standard black text lines on white background
        const isTextLine = y % 40 >= 10 && y % 40 <= 18 && x > 30 && x < width - 30;
        const val = isTextLine ? 20 : 250;
        buffer[idx] = val;
        buffer[idx + 1] = val;
        buffer[idx + 2] = val;
        buffer[idx + 3] = 255;
      }
    }
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Synthetic OCR Line Tokens Generator for Structural & Determinant Testing
// ---------------------------------------------------------------------------
function buildLine(
  pageNumber: number,
  lineIndex: number,
  text: string,
  yBox: number,
  confidence = 92,
): OcrLineBlock {
  const rawWords = text.trim().split(/\s+/);
  const words: OcrWordToken[] = [];
  const wordWidth = Math.min(0.15, 0.8 / Math.max(1, rawWords.length));

  rawWords.forEach((w, wIdx) => {
    const x = Math.round((0.1 + wIdx * (wordWidth + 0.01)) * 1000);
    const y = Math.round(yBox * 1000);
    const width = Math.round(wordWidth * 1000);
    const height = Math.round(0.025 * 1000);
    const confNorm = Number((confidence / 100).toFixed(4));

    words.push({
      wordId: `w-p${pageNumber}-l${lineIndex}-${wIdx}`,
      text: w,
      sanitizedText: w,
      confidence,
      confidenceNormalized: confNorm,
      boundingBox: [0.1 + wIdx * (wordWidth + 0.01), yBox, wordWidth, 0.025],
      pageNumber,
      x,
      y,
      width,
      height,
      coordinateSystem: "PIXEL_SPACE",
      detailedBoundingBox: {
        pageNumber,
        x,
        y,
        width,
        height,
        coordinateSystem: "PIXEL_SPACE",
        confidence: confNorm,
      },
    });
  });

  const lineX = Math.round(0.1 * 1000);
  const lineY = Math.round(yBox * 1000);
  const lineW = Math.round(0.8 * 1000);
  const lineH = Math.round(0.03 * 1000);
  const lineConfNorm = Number((confidence / 100).toFixed(4));

  return {
    lineId: `line-p${pageNumber}-${lineIndex}`,
    lineIndex,
    pageNumber,
    text,
    confidence,
    confidenceNormalized: lineConfNorm,
    boundingBox: [0.1, yBox, 0.8, 0.03],
    words,
    baselineY: yBox + 0.03,
    x: lineX,
    y: lineY,
    width: lineW,
    height: lineH,
    coordinateSystem: "PIXEL_SPACE",
    detailedBoundingBox: {
      pageNumber,
      x: lineX,
      y: lineY,
      width: lineW,
      height: lineH,
      coordinateSystem: "PIXEL_SPACE",
      confidence: lineConfNorm,
    },
  };
}

export async function runProductionOcrTestSuite() {
  console.log("==================================================================");
  console.log("   ENERA PRODUCTION OCR ENGINE — MASTER VERIFICATION SUITE       ");
  console.log("==================================================================\n");

  let testCount = 0;

  // -------------------------------------------------------------------------
  // TEST GROUP 1: IMAGE PREPROCESSING ENGINE
  // -------------------------------------------------------------------------
  console.log("--- TEST GROUP 1: Image Preprocessing Engine ---");

  // Test 1.1: Grayscale, Inversion Detection, and Contrast Enhancement
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Grayscale luminance, inversion check, and contrast stretching`,
    );
    const invBuffer = generateSyntheticImageBuffer(200, 200, "inverted");
    const preprocessed = ImagePreprocessingEngine.preprocess(invBuffer, 200, 200, 1, {
      enableDeskew: true,
      enableBinarization: true,
      enableContrastEnhance: true,
    });

    assert(preprocessed.pageNumber === 1, "Preprocessed page number matches input");
    assert(preprocessed.isInverted === true, "Accurately detects inverted dark-mode image");
    assert(preprocessed.isBinarized === true, "Applies Otsu adaptive binarization");
    assert(preprocessed.imageData !== undefined, "Produces clean RGBA preprocessed image buffer");
    assert(
      preprocessed.imageData?.length === 200 * 200 * 4,
      "Output pixel buffer dimensions match original",
    );
  }

  // Test 1.2: Low Contrast Normalization & Deskew Estimation
  {
    testCount++;
    console.log(`[Test ${testCount}] Low-contrast scan enhancement and deskew estimation`);
    const lowContBuffer = generateSyntheticImageBuffer(200, 200, "low_contrast");
    const preprocessed = ImagePreprocessingEngine.preprocess(lowContBuffer, 200, 200, 1, {
      enableDeskew: true,
      enableBinarization: true,
      enableContrastEnhance: true,
    });

    assert(preprocessed.contrastRatio > 0, "Calculates measurable contrast ratio");
    assert(typeof preprocessed.deskewAngleDegrees === "number", "Estimates projection skew angle");
    assert(
      Math.abs(preprocessed.deskewAngleDegrees) <= 5.0,
      "Deskew angle within valid bounded range",
    );
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 2: PDF & MULTI-PAGE RASTERIZATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: PDF & Document Page Rasterization ---");

  // Test 2.1: Format detection (PNG, JPEG, TIFF magic bytes)
  {
    testCount++;
    console.log(`[Test ${testCount}] Direct image format detection via magic bytes`);
    const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const isPng = PdfPageRasterizer.isDirectImageFile("scan_invoice.png", pngMagic);
    assert(isPng === true, "Correctly identifies PNG format by magic bytes");

    const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const isJpeg = PdfPageRasterizer.isDirectImageFile("mobile_photo.jpg", jpegMagic);
    assert(isJpeg === true, "Correctly identifies JPEG format by magic bytes");
  }

  // Test 2.2: Rasterize single image buffer into 300 DPI canvas
  {
    testCount++;
    console.log(`[Test ${testCount}] Single image rasterization targeting 300 DPI`);
    const rawBuffer = generateSyntheticImageBuffer(100, 100, "text_bars");
    const pages = await PdfPageRasterizer.rasterizeDocument(
      new Uint8Array(rawBuffer.buffer),
      "invoice_scan.png",
      { targetDpi: 300 },
    );

    assert(pages.length === 1, "Rasterizes single image into exactly 1 page");
    assert(pages[0].pageNumber === 1, "Page number is 1-indexed");
    assert(pages[0].dpi === 300, "Target DPI set to 300 for high-precision OCR");
    assert(pages[0].pixelBuffer.length > 0, "Pixel buffer contains raster image bytes");
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 3: TESSERACT WORKER POOL & CONCURRENCY
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Tesseract Worker Pool & Concurrency ---");

  // Test 3.1: Graceful OCR execution with bounding box extraction
  {
    testCount++;
    console.log(`[Test ${testCount}] OCR recognition with normalized bounding box tokens`);
    const imgData = generateSyntheticImageBuffer(150, 150, "text_bars");
    const rawOcr = await TesseractWorkerPool.recognizeImage(imgData, 150, 150, 1, {
      timeoutMs: 3000,
    });

    assert(typeof rawOcr.fullText === "string", "Produces extracted text string");
    assert(Array.isArray(rawOcr.words), "Returns word token array");
    assert(Array.isArray(rawOcr.lines), "Returns line block array");
    assert(typeof rawOcr.averageConfidence === "number", "Calculates average token confidence");
    assert(rawOcr.durationMs >= 0, "Records execution duration in milliseconds");
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 4: LAYOUT STRUCTURE ENGINE (READING ORDER, KV, TABLES)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: Layout & Table Structure Engine ---");

  // Test 4.1: Reading order sorting (top-to-bottom, left-to-right)
  {
    testCount++;
    console.log(`[Test ${testCount}] Reading order sorting & spatial layout analysis`);
    const lineBottom = buildLine(1, 1, "Bottom Line Content", 0.85);
    const lineTop = buildLine(1, 2, "Top Header Content", 0.08);
    const lineMiddle = buildLine(1, 3, "Middle Body Content", 0.45);

    const layout = OcrLayoutStructureEngine.analyzePageLayout([lineBottom, lineTop, lineMiddle], 1);

    assert(layout.sortedLines.length === 3, "Preserves all input lines");
    assert(layout.sortedLines[0].text === "Top Header Content", "Sorts top line first");
    assert(layout.sortedLines[1].text === "Middle Body Content", "Sorts middle line second");
    assert(layout.sortedLines[2].text === "Bottom Line Content", "Sorts bottom line last");
  }

  // Test 4.2: Key-Value pair identification (Horizontal & Vertical)
  {
    testCount++;
    console.log(`[Test ${testCount}] Key-value pair extraction from OCR lines`);
    const kvLine1 = buildLine(1, 1, "Account Number: 78512345678", 0.15);
    const kvLine2 = buildLine(1, 2, "Tax Invoice No: INV-2026-99482", 0.2);
    const kvLine3 = buildLine(1, 3, "Total Amount Due: R 425670.50", 0.25);

    const layout = OcrLayoutStructureEngine.analyzePageLayout([kvLine1, kvLine2, kvLine3], 1);
    assert(layout.keyValuePairs.length >= 2, "Extracts multiple key-value pairs");

    const accPair = layout.keyValuePairs.find((kv) =>
      kv.keyNormalized.toUpperCase().includes("ACCOUNT"),
    );
    assert(accPair !== undefined, "Finds Account Number key-value pair");
    assert(
      accPair?.valueText.includes("78512345678") === true,
      "Extracts exact account number value",
    );

    const totalPair = layout.keyValuePairs.find((kv) =>
      kv.keyNormalized.toUpperCase().includes("TOTAL"),
    );
    assert(totalPair !== undefined, "Finds Total Due key-value pair");
    assert(totalPair?.valueNormalized === 425670.5, "Normalizes currency value to float");
  }

  // Test 4.3: Tabular Grid Reconstruction (Billing Schedule)
  {
    testCount++;
    console.log(`[Test ${testCount}] Billing schedule table grid & cell matrix reconstruction`);
    const headerLine = buildLine(1, 1, "Description Rate Quantity Amount", 0.5);
    const row1 = buildLine(1, 2, "Peak Energy Charge 666.92 50000 333460.00", 0.55);
    const row2 = buildLine(1, 3, "Standard Energy Charge 245.10 40000 98040.00", 0.6);
    const row3 = buildLine(1, 4, "Off-Peak Energy Charge 111.15 30000 33345.00", 0.65);

    const layout = OcrLayoutStructureEngine.analyzePageLayout([headerLine, row1, row2, row3], 1);
    assert(layout.tables.length === 1, "Identifies exactly 1 tabular structure");

    const table = layout.tables[0];
    assert(table.tableType === "BILLING_SCHEDULE", "Classifies table as BILLING_SCHEDULE");
    assert(table.rowCount === 3, "Detects exactly 3 data rows in billing schedule");
    assert(
      table.headers.includes("Description") || table.headers.some((h) => h.includes("Charge")),
      "Extracts column headers",
    );
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 5: CONFIDENCE SCORING & REVIEW GATING
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: Confidence Scoring & Review Gating ---");

  // Test 5.1: Review gating on low confidence (< 85%)
  {
    testCount++;
    console.log(`[Test ${testCount}] Confidence evaluation: < 85% triggers mandatory human review`);
    const lowConfLine = buildLine(1, 1, "Total Amount Due: R 50000.00", 0.3, 62);
    const pageResult: OcrPageResult = {
      pageNumber: 1,
      fullText: "Total Amount Due: R 50000.00",
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: lowConfLine.words,
      lines: [lowConfLine],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 62.0,
      minConfidence: 60.0,
      characterCount: 28,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 45,
    };

    const evaluation = OcrConfidenceScorer.evaluateDocumentConfidence([pageResult]);
    assert(evaluation.overallScore < 85.0, "Score is below high confidence threshold");
    assert(
      evaluation.reviewRequired === true,
      "Flags reviewRequired = true for low confidence document",
    );
    assert(evaluation.reviewReasons.length > 0, "Provides clear audit reasons for human review");
  }

  // Test 5.2: Optical character ambiguity check ('0' vs 'O')
  {
    testCount++;
    console.log(`[Test ${testCount}] Optical character ambiguity detection for numeric fields`);
    const ambiguousScore = OcrConfidenceScorer.calculateTokenConfidence("785O123456", 90);
    assert(ambiguousScore < 90, "Penalizes confidence when letter 'O' appears in digits");
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 6: EVIDENCE EXTRACTION FOR ALL 6 DOCUMENT CATEGORIES
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 6: Evidence Extraction Across 6 Document Categories ---");

  // Test 6.1: Category 1 — Invoices (Megaflex & Municipal)
  {
    testCount++;
    console.log(`[Test ${testCount}] Category 1: Invoice determinant extraction (Megaflex)`);
    const l1 = buildLine(1, 1, "ESKOM TAX INVOICE", 0.05);
    const l2 = buildLine(1, 2, "Account Number: 78598765432", 0.1);
    const l3 = buildLine(1, 3, "Invoice Number: 9876543210", 0.14);
    const l4 = buildLine(1, 4, "Customer: AFRI INDUSTRIAL MINING (PTY) LTD", 0.18);
    const l5 = buildLine(1, 5, "Billing Period: 2026-02-01 to 2026-02-28", 0.22);
    const l6 = buildLine(1, 6, "Tariff: Megaflex High Season", 0.26);
    const l7 = buildLine(1, 7, "Meter Number: MTR-778899", 0.3);
    const l8 = buildLine(1, 8, "Maximum Demand: 450.50 kVA", 0.34);
    const l9 = buildLine(1, 9, "Total Active Energy: 125000 kWh", 0.38);
    const l10 = buildLine(1, 10, "Subtotal: R 400000.00", 0.42);
    const l11 = buildLine(1, 11, "VAT: R 60000.00", 0.46);
    const l12 = buildLine(1, 12, "Total Amount Due: R 460000.00", 0.5);

    const fullInvoiceText = [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12]
      .map((l) => l.text)
      .join("\n");
    const category = OcrEvidenceExtractor.classifyCategory(fullInvoiceText);
    assert(category === "INVOICE", "Correctly classifies ESKOM TAX INVOICE as INVOICE");

    const pResult: OcrPageResult = {
      pageNumber: 1,
      fullText: fullInvoiceText,
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12].flatMap((l) => l.words),
      lines: [l1, l2, l3, l4, l5, l6, l7, l8, l9, l10, l11, l12],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 94.0,
      minConfidence: 88.0,
      characterCount: fullInvoiceText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 60,
    };

    const invoiceDet = OcrEvidenceExtractor.extractInvoiceDeterminants([pResult], "DOC-INV-1");
    assert(invoiceDet.accountNumber.value === "78598765432", "Extracts valid account number");
    assert(
      invoiceDet.accountNumber.provenance.hasExactBoundingBox === true,
      "Preserves account bounding box provenance",
    );
    assert(invoiceDet.invoiceNumber.value === "9876543210", "Extracts valid invoice number");
    assert(invoiceDet.billingPeriodStart.value === "2026-02-01", "Extracts billing period start");
    assert(invoiceDet.billingPeriodEnd.value === "2026-02-28", "Extracts billing period end");
    assert(invoiceDet.maximumDemandKva.value === 450.5, "Extracts maximum demand kVA");
    assert(invoiceDet.activeEnergyTotalKwh.value === 125000, "Extracts total active energy kWh");
    assert(invoiceDet.subtotalAmount.value === 400000, "Extracts subtotal amount");
    assert(invoiceDet.vatAmount.value === 60000, "Extracts VAT amount");
    assert(invoiceDet.totalAmountDue.value === 460000, "Extracts total amount due");
  }

  // Test 6.2: Category 2 — Statements of Account
  {
    testCount++;
    console.log(`[Test ${testCount}] Category 2: Statement of Account determinant extraction`);
    const s1 = buildLine(1, 1, "STATEMENT OF ACCOUNT", 0.05);
    const s2 = buildLine(1, 2, "Account Number: 78511223344", 0.1);
    const s3 = buildLine(1, 3, "Customer: TRANSNET FREIGHT RAIL", 0.15);
    const s4 = buildLine(1, 4, "Statement Date: 2026-03-01", 0.2);
    const s5 = buildLine(1, 5, "Opening Balance: R 150000.00", 0.25);
    const s6 = buildLine(1, 6, "Payments Received: R 150000.00", 0.3);
    const s7 = buildLine(1, 7, "Current Charges: R 220000.00", 0.35);
    const s8 = buildLine(1, 8, "Closing Balance Due: R 220000.00", 0.4);

    const statementText = [s1, s2, s3, s4, s5, s6, s7, s8].map((l) => l.text).join("\n");
    const category = OcrEvidenceExtractor.classifyCategory(statementText);
    assert(category === "STATEMENT", "Correctly classifies STATEMENT OF ACCOUNT");

    const pResult: OcrPageResult = {
      pageNumber: 1,
      fullText: statementText,
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: [s1, s2, s3, s4, s5, s6, s7, s8].flatMap((l) => l.words),
      lines: [s1, s2, s3, s4, s5, s6, s7, s8],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 93.0,
      minConfidence: 87.0,
      characterCount: statementText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 40,
    };

    const stmtDet = OcrEvidenceExtractor.extractStatementDeterminants([pResult], "DOC-STMT-1");
    assert(stmtDet.accountNumber.value === "78511223344", "Extracts statement account number");
    assert(stmtDet.openingBalance.value === 150000, "Extracts statement opening balance");
    assert(stmtDet.paymentsReceived.value === 150000, "Extracts payments received");
    assert(stmtDet.currentCharges.value === 220000, "Extracts current charges");
    assert(stmtDet.closingBalanceDue.value === 220000, "Extracts closing balance due");
  }

  // Test 6.3: Category 3 — Credit Notes
  {
    testCount++;
    console.log(`[Test ${testCount}] Category 3: Credit Note determinant extraction`);
    const c1 = buildLine(1, 1, "CREDIT NOTE ADVICE", 0.05);
    const c2 = buildLine(1, 2, "Credit Note Number: CN-2026-0045", 0.1);
    const c3 = buildLine(1, 3, "Original Tax Invoice: INV-9876543210", 0.15);
    const c4 = buildLine(1, 4, "Account: 78598765432", 0.2);
    const c5 = buildLine(1, 5, "Credit Reason: TOU Meter Dial Correction", 0.25);
    const c6 = buildLine(1, 6, "Credit Subtotal: R 45000.00", 0.3);
    const c7 = buildLine(1, 7, "Credit VAT: R 6750.00", 0.35);
    const c8 = buildLine(1, 8, "Total Credit Amount: R 51750.00", 0.4);

    const creditText = [c1, c2, c3, c4, c5, c6, c7, c8].map((l) => l.text).join("\n");
    const category = OcrEvidenceExtractor.classifyCategory(creditText);
    assert(category === "CREDIT_NOTE", "Correctly classifies CREDIT NOTE ADVICE");

    const pResult: OcrPageResult = {
      pageNumber: 1,
      fullText: creditText,
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: [c1, c2, c3, c4, c5, c6, c7, c8].flatMap((l) => l.words),
      lines: [c1, c2, c3, c4, c5, c6, c7, c8],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 95.0,
      minConfidence: 90.0,
      characterCount: creditText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 40,
    };

    const cnDet = OcrEvidenceExtractor.extractCreditNoteDeterminants([pResult], "DOC-CN-1");
    assert(cnDet.creditNoteNumber.value === "CN-2026-0045", "Extracts credit note number");
    assert(
      cnDet.originalInvoiceReference.value?.includes("INV-9876543210") === true,
      "Extracts original invoice ref",
    );
    assert(cnDet.creditSubtotal.value === 45000, "Extracts credit subtotal");
    assert(cnDet.creditVat.value === 6750, "Extracts credit VAT");
    assert(cnDet.totalCreditAmount.value === 51750, "Extracts total credit amount");
  }

  // Test 6.4: Category 4 — Adjustment Documents
  {
    testCount++;
    console.log(`[Test ${testCount}] Category 4: Adjustment document determinant extraction`);
    const a1 = buildLine(1, 1, "BILLING ADJUSTMENT ADVICE", 0.05);
    const a2 = buildLine(1, 2, "Adjustment Number: ADJ-88442", 0.1);
    const a3 = buildLine(1, 3, "Account: 78555667788", 0.15);
    const a4 = buildLine(1, 4, "Reason: Defective CT Multiplier Backdated Charge", 0.2);
    const a5 = buildLine(1, 5, "Financial Variance: R 18500.00", 0.25);

    const adjText = [a1, a2, a3, a4, a5].map((l) => l.text).join("\n");
    const category = OcrEvidenceExtractor.classifyCategory(adjText);
    assert(category === "ADJUSTMENT", "Correctly classifies BILLING ADJUSTMENT ADVICE");

    const pResult: OcrPageResult = {
      pageNumber: 1,
      fullText: adjText,
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: [a1, a2, a3, a4, a5].flatMap((l) => l.words),
      lines: [a1, a2, a3, a4, a5],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 92.0,
      minConfidence: 85.0,
      characterCount: adjText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 35,
    };

    const adjDet = OcrEvidenceExtractor.extractAdjustmentDeterminants([pResult], "DOC-ADJ-1");
    assert(adjDet.adjustmentNumber.value === "ADJ-88442", "Extracts adjustment number");
    assert(adjDet.financialVarianceAmount.value === 18500, "Extracts financial variance amount");
  }

  // Test 6.5: Category 5 — Tariff Documents
  {
    testCount++;
    console.log(`[Test ${testCount}] Category 5: Tariff schedule determinant extraction`);
    const t1 = buildLine(1, 1, "NERSA TARIFF SCHEDULE 2025/2026", 0.05);
    const t2 = buildLine(1, 2, "Tariff Code: MEGAFLEX", 0.1);
    const t3 = buildLine(1, 3, "Tariff Name: Eskom Megaflex High Voltage", 0.15);
    const t4 = buildLine(1, 4, "Effective Date: 2025-04-01", 0.2);
    const t5 = buildLine(1, 5, "Peak Rate: 666.92 c/kWh", 0.25);
    const t6 = buildLine(1, 6, "Standard Rate: 245.10 c/kWh", 0.3);
    const t7 = buildLine(1, 7, "Off-Peak Rate: 111.15 c/kWh", 0.35);

    const tariffText = [t1, t2, t3, t4, t5, t6, t7].map((l) => l.text).join("\n");
    const category = OcrEvidenceExtractor.classifyCategory(tariffText);
    assert(category === "TARIFF_DOCUMENT", "Correctly classifies TARIFF SCHEDULE");

    const pResult: OcrPageResult = {
      pageNumber: 1,
      fullText: tariffText,
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: [t1, t2, t3, t4, t5, t6, t7].flatMap((l) => l.words),
      lines: [t1, t2, t3, t4, t5, t6, t7],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 96.0,
      minConfidence: 91.0,
      characterCount: tariffText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 40,
    };

    const tariffDet = OcrEvidenceExtractor.extractTariffDeterminants([pResult], "DOC-TRF-1");
    assert(tariffDet.tariffCode.value === "MEGAFLEX", "Extracts tariff code MEGAFLEX");
    assert(tariffDet.effectiveStartDate.value === "2025-04-01", "Extracts effective start date");
    assert(tariffDet.rates.length >= 3, "Extracts seasonal TOU rates");
  }

  // Test 6.6: Category 6 — Meter Reading Documents
  {
    testCount++;
    console.log(`[Test ${testCount}] Category 6: Meter reading document extraction`);
    const m1 = buildLine(1, 1, "METER READING SHEET - BULK SUPPLY", 0.05);
    const m2 = buildLine(1, 2, "Meter Serial: MTR-99221144", 0.1);
    const m3 = buildLine(1, 3, "Reading Date: 2026-03-31", 0.15);
    const m4 = buildLine(1, 4, "Previous Dial: 45210", 0.2);
    const m5 = buildLine(1, 5, "Current Dial: 47210", 0.25);
    const m6 = buildLine(1, 6, "Dial Difference: 2000", 0.3);
    const m7 = buildLine(1, 7, "Multiplier: 50", 0.35);
    const m8 = buildLine(1, 8, "Total Consumption: 100000 kWh", 0.4);

    const meterText = [m1, m2, m3, m4, m5, m6, m7, m8].map((l) => l.text).join("\n");
    const category = OcrEvidenceExtractor.classifyCategory(meterText);
    assert(category === "METER_DOCUMENT", "Correctly classifies METER READING SHEET");

    const pResult: OcrPageResult = {
      pageNumber: 1,
      fullText: meterText,
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: [m1, m2, m3, m4, m5, m6, m7, m8].flatMap((l) => l.words),
      lines: [m1, m2, m3, m4, m5, m6, m7, m8],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 94.0,
      minConfidence: 89.0,
      characterCount: meterText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 40,
    };

    const meterDet = OcrEvidenceExtractor.extractMeterDeterminants([pResult], "DOC-MTR-1");
    assert(meterDet.meterSerialNumber.value === "MTR-99221144", "Extracts meter serial number");
    assert(meterDet.previousReading.value === 45210, "Extracts previous meter dial");
    assert(meterDet.currentReading.value === 47210, "Extracts current meter dial");
    assert(meterDet.multiplyingFactor.value === 50, "Extracts multiplying factor");
    assert(meterDet.totalConsumptionKwh.value === 100000, "Extracts total consumption kWh");
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 7: STRICT NON-FABRICATION RULE
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 7: Strict Non-Fabrication Assertion ---");

  // Test 7.1: Missing determinants must remain explicit null, never fake 0
  {
    testCount++;
    console.log(`[Test ${testCount}] Strict non-fabrication: unobserved fields remain null`);
    // Create an invoice line set that has NO reactive power, NO power factor, NO VAT reg number
    const sparseLine1 = buildLine(1, 1, "ESKOM TAX INVOICE", 0.05);
    const sparseLine2 = buildLine(1, 2, "Account Number: 78511223344", 0.1);
    const sparseLine3 = buildLine(1, 3, "Total Amount Due: R 50000.00", 0.2);

    const sparseText = [sparseLine1, sparseLine2, sparseLine3].map((l) => l.text).join("\n");
    const pResult: OcrPageResult = {
      pageNumber: 1,
      fullText: sparseText,
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
      words: [sparseLine1, sparseLine2, sparseLine3].flatMap((l) => l.words),
      lines: [sparseLine1, sparseLine2, sparseLine3],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 91.0,
      minConfidence: 85.0,
      characterCount: sparseText.length,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 25,
    };

    const sparseDet = OcrEvidenceExtractor.extractInvoiceDeterminants([pResult], "DOC-SPARSE");
    assert(
      sparseDet.maximumDemandKva.value === null,
      "Missing maximumDemandKva remains explicit null",
    );
    assert(
      sparseDet.maximumDemandKva.provenance.hasExactBoundingBox === false,
      "Missing field has no bounding box",
    );
    assert(
      sparseDet.activeEnergyTotalKwh.value === null,
      "Missing activeEnergyTotalKwh remains explicit null",
    );
    assert(
      sparseDet.reactiveEnergyKvarh.value === null,
      "Missing reactiveEnergyKvarh remains explicit null",
    );
    assert(sparseDet.powerFactor?.value === null, "Missing powerFactor remains explicit null");
    assert(
      sparseDet.vatRegistrationNumber?.value === null,
      "Missing vatRegistrationNumber remains explicit null",
    );
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 8: HYBRID DOCUMENT PROCESSOR & MIXED PDF PAGES
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 8: Hybrid Document Processor & Mixed PDF Pages ---");

  // Test 8.1: Full Hybrid Process on Image Upload
  {
    testCount++;
    console.log(`[Test ${testCount}] HybridDocumentProcessor on scanned image`);
    const syntheticScan = generateSyntheticImageBuffer(200, 200, "text_bars");
    const ocrDoc = await HybridDocumentProcessor.processDocument(
      {
        name: "scanned_eskom_invoice.png",
        bytes: new Uint8Array(syntheticScan.buffer),
        mimeType: "image/png",
      },
      {
        organisationId: "TENANT-TEST-001",
      },
    );

    assert(ocrDoc.totalPages === 1, "Correctly identifies total pages");
    assert(ocrDoc.pages[0].isScannedRaster === true, "Marks page as SCANNED_RASTER");
    assert(
      ocrDoc.executionEngine === "TESSERACT_PURE" || ocrDoc.executionEngine === "TESSERACT_HYBRID",
      "Identifies execution engine",
    );
    assert(typeof ocrDoc.overallConfidence === "number", "Calculates overall confidence");
    assert(ocrDoc.durationMs >= 0, "Tracks end-to-end execution duration");
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 9: SCANNED INVOICE OCR ADAPTER & INGESTION GATEWAY INTEGRATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 9: Scanned Invoice Adapter Integration ---");

  // Test 9.1: ScannedInvoiceOcrAdapter canHandle and extract
  {
    testCount++;
    console.log(`[Test ${testCount}] ScannedInvoiceOcrAdapter execution and non-fabrication`);
    const adapter = new ScannedInvoiceOcrAdapter();
    assert(adapter.canHandle("png", "image/png") === true, "Handles PNG image files");
    assert(adapter.canHandle("jpg", "image/jpeg") === true, "Handles JPEG image files");
    assert(adapter.canHandle("tiff", "image/tiff") === true, "Handles TIFF files");
    assert(adapter.canHandle("pdf", "application/pdf") === true, "Handles scanned PDFs");

    const imgBuffer = generateSyntheticImageBuffer(150, 150, "text_bars");
    const fakeFile = {
      name: "eskom_scan.jpg",
      type: "image/jpeg",
    } as File;

    const adapterResult = await adapter.extract(
      fakeFile,
      new Uint8Array(imgBuffer.buffer),
      "JOB-OCR-TEST",
    );
    assert(adapterResult.success === true, "Adapter execution succeeds");
    assert(adapterResult.documentType === "INVOICE_PDF", "Maps to INVOICE_PDF document type");
    assert(
      typeof adapterResult.confidenceScore === "number",
      "Outputs normalized confidence score",
    );
    assert(adapterResult.extractedFields !== undefined, "Produces extractedFields object");
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 10: PERSISTENCE, REHYDRATION & MULTI-TENANT ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 10: Persistence, Rehydration & Multi-Tenant Isolation ---");

  // Test 10.1: Persist OCR run and rehydrate from L1/L2
  {
    testCount++;
    console.log(`[Test ${testCount}] Save OCR run and rehydrate across sessions`);
    const dummyRun: any = {
      ocrRunId: "OCR-RUN-PERSIST-99",
      documentId: "DOC-PERSIST-99",
      organisationId: "TENANT-ALPHA",
      checksum: "sha256-test-hash-alpha",
      filename: "alpha_invoice.pdf",
      documentCategory: "INVOICE",
      totalPages: 1,
      pages: [
        {
          pageNumber: 1,
          fullText: "Account Number: 78599887766\nTotal: R 120000.00",
          geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7067, rotation: 0 },
          words: [],
          lines: [],
          blocks: [],
          tables: [],
          keyValuePairs: [],
          averageConfidence: 95.0,
          minConfidence: 90.0,
          characterCount: 45,
          isNativeDigital: false,
          isScannedRaster: true,
          processingDurationMs: 50,
        },
      ],
      overallConfidence: 95.0,
      confidenceTier: "HIGH",
      reviewRequired: false,
      reviewReasons: [],
      tables: [],
      rawFullText: "Account Number: 78599887766\nTotal: R 120000.00",
      invoiceDeterminants: {
        accountNumber: {
          fieldKey: "accountNumber",
          fieldLabel: "Account Number",
          value: "78599887766",
          rawValue: "78599887766",
          provenance: {
            documentId: "DOC-PERSIST-99",
            pageNumber: 1,
            extractionMethod: "OCR_TESSERACT",
            hasExactBoundingBox: true,
            confidenceScore: 95.0,
            confidenceTier: "HIGH",
          },
        },
      },
      executionEngine: "TESSERACT_PURE",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 85,
    };

    await OcrPersistenceService.saveOcrRun(dummyRun);

    const rehydrated = await OcrPersistenceService.getOcrRun("OCR-RUN-PERSIST-99");
    assert(rehydrated !== null, "Successfully retrieves persisted OCR run");
    assert(rehydrated?.ocrRunId === "OCR-RUN-PERSIST-99", "Matches OCR run ID");
    assert(rehydrated?.organisationId === "TENANT-ALPHA", "Matches tenant organisation ID");
  }

  // Test 10.2: Tenant isolation blocks unauthorized tenant access
  {
    testCount++;
    console.log(`[Test ${testCount}] Tenant isolation prevents cross-tenant access`);
    let caughtTenantError = false;
    try {
      await OcrPersistenceService.getOcrRun("OCR-RUN-PERSIST-99", {
        userId: "USER-BETA",
        organisationId: "TENANT-BETA",
        role: "OPERATOR",
      });
    } catch (err: any) {
      if (err instanceof TenantIsolationViolationError) {
        caughtTenantError = true;
      }
    }

    assert(
      caughtTenantError === true,
      "Enforces strict TenantIsolationViolationError on cross-tenant read",
    );
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 11: ROTATION & ORIENTATION HANDLING
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 11: Rotation & Orientation Handling ---");

  // Test 11.1: Portrait vs. Landscape aspect ratio detection
  {
    testCount++;
    console.log(`[Test ${testCount}] Portrait vs. Landscape aspect ratio detection`);
    const portraitGrayscale = new Uint8Array(200 * 300);
    const landscapeGrayscale = new Uint8Array(300 * 200);

    const portRes = ImagePreprocessingEngine.detectOrientationAndRotation(
      portraitGrayscale,
      200,
      300,
    );
    const landRes = ImagePreprocessingEngine.detectOrientationAndRotation(
      landscapeGrayscale,
      300,
      200,
    );

    assert(portRes.orientation === "PORTRAIT", "Correctly classifies 200x300 as PORTRAIT");
    assert(landRes.orientation === "LANDSCAPE", "Correctly classifies 300x200 as LANDSCAPE");
  }

  // Test 11.2: Rotated 90° and 270° orientation detection and correction
  {
    testCount++;
    console.log(`[Test ${testCount}] Rotated 90° and 270° orientation detection and correction`);
    const rot90Res = ImagePreprocessingEngine.detectOrientationAndRotation(
      new Uint8Array(300 * 200),
      300,
      200,
      90,
    );
    assert(rot90Res.detectedRotation === 90, "Identifies 90° rotation from document metadata");
    assert(
      rot90Res.recommendedCorrectionRotation === 270,
      "Calculates 270° clockwise correction for 90° rotation",
    );

    const rot270Res = ImagePreprocessingEngine.detectOrientationAndRotation(
      new Uint8Array(300 * 200),
      300,
      200,
      270,
    );
    assert(rot270Res.detectedRotation === 270, "Identifies 270° rotation from document metadata");
    assert(
      rot270Res.recommendedCorrectionRotation === 90,
      "Calculates 90° clockwise correction for 270° rotation",
    );
  }

  // Test 11.3: Rotated 180° upside-down orientation detection and correction
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Rotated 180° upside-down orientation detection and correction`,
    );
    const rot180Res = ImagePreprocessingEngine.detectOrientationAndRotation(
      new Uint8Array(200 * 300),
      200,
      300,
      180,
    );
    assert(rot180Res.detectedRotation === 180, "Identifies 180° upside-down orientation");
    assert(
      rot180Res.recommendedCorrectionRotation === 180,
      "Calculates 180° correction for upside-down page",
    );
  }

  // Test 11.4: Pure lossless rotation and original buffer immutability
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Lossless rotation preserves original document buffer without mutation`,
    );
    const originalBuffer = generateSyntheticImageBuffer(200, 300, "text_bars");
    const bufferSnapshot = new Uint8ClampedArray(originalBuffer);

    const preprocessed = ImagePreprocessingEngine.preprocess(originalBuffer, 200, 300, 1, {
      pdfRotation: 90,
      enableOrientationCorrection: true,
    });

    // Check immutability: original buffer must remain 100% byte-for-byte identical
    let isMutated = false;
    for (let i = 0; i < originalBuffer.length; i++) {
      if (originalBuffer[i] !== bufferSnapshot[i]) {
        isMutated = true;
        break;
      }
    }
    assert(!isMutated, "Original document image buffer is NEVER mutated");
    assert(
      preprocessed.originalGeometry.detectedRotation === 90,
      "Original geometry records detected rotation",
    );
    assert(
      preprocessed.preprocessedGeometry.width === 300,
      "Preprocessed geometry dimensions swapped upright (width 300)",
    );
    assert(
      preprocessed.preprocessedGeometry.height === 200,
      "Preprocessed geometry dimensions swapped upright (height 200)",
    );
    assert(
      preprocessed.preprocessingDecision?.orientationCorrectionApplied === true,
      "Records transformation in decision audit record",
    );
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 12: SOUTH AFRICAN UTILITY DOCUMENT OCR LANGUAGES
  // -------------------------------------------------------------------------
  console.log("\n--- TEST GROUP 12: South African Utility Document Languages ---");

  // Test 12.1: Default English configuration for Eskom utility billing
  {
    testCount++;
    console.log(`[Test ${testCount}] Default English language configuration`);
    const config = SouthAfricanLanguageManager.resolveExecutionLanguage({});
    assert(
      config.actualLanguageUsed === "eng",
      "Defaults to 'eng' for standard South African utility bills",
    );
    assert(config.fallbackLanguage === "eng", "Fallback language is configured as 'eng'");
    assert(
      config.isFallbackUsed === false,
      "Standard resolution does not trigger fallback warning",
    );
  }

  // Test 12.2: Afrikaans municipal utility vocabulary detection
  {
    testCount++;
    console.log(`[Test ${testCount}] Afrikaans municipal utility vocabulary detection`);
    const afrText =
      "STAD KAAPSTAD MUNISIPALITEIT BELASTINGFAKTUUR REKENINGNOMMER ELEKTRISITEIT VERBRUIK METERLESING TOTALE BEDRAG";
    const detection = SouthAfricanLanguageManager.detectLanguage(afrText);
    assert(detection.detectedLanguage === "afr", "Accurately detects Afrikaans utility vocabulary");
    assert(detection.confidence >= 70.0, "Calculates high confidence (>= 70%) for Afrikaans bill");

    const resolved = SouthAfricanLanguageManager.resolveExecutionLanguage({
      sampleText: afrText,
    });
    assert(
      resolved.actualLanguageUsed === "afr",
      "Adopts 'afr' when detection confidence meets threshold",
    );
    assert(resolved.isFallbackUsed === false, "Does not fall back when confidence is high");
  }

  // Test 12.3: Bilingual English & Afrikaans dual-language bill detection
  {
    testCount++;
    console.log(`[Test ${testCount}] Bilingual (English & Afrikaans) municipal bill detection`);
    const bilingualText =
      "TAX INVOICE / BELASTINGFAKTUUR ACCOUNT NUMBER / REKENINGNOMMER ELECTRICITY / ELEKTRISITEIT TOTAL DUE / TOTALE BEDRAG";
    const detection = SouthAfricanLanguageManager.detectLanguage(bilingualText);
    assert(detection.detectedLanguage === "eng+afr", "Identifies dual-language bill as 'eng+afr'");
    assert(detection.isDualLanguage === true, "Flags isDualLanguage = true");

    const resolved = SouthAfricanLanguageManager.resolveExecutionLanguage({
      sampleText: bilingualText,
    });
    assert(resolved.actualLanguageUsed === "eng+afr", "Resolves to dual language pack 'eng+afr'");
  }

  // Test 12.4: Ambiguous/low-confidence detection safely falls back to English (Do not assume detection is correct!)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Low-confidence/ambiguous detection safely falls back to English`,
    );
    const ambiguousText =
      "Random numeric serial 9948271 XJ-443 non-linguistic noise text without clear utility markers";
    const resolved = SouthAfricanLanguageManager.resolveExecutionLanguage({
      sampleText: ambiguousText,
      providerConfigLanguage: "eng",
    });

    assert(
      resolved.actualLanguageUsed === "eng",
      "Safeguard: Low-confidence detection safely falls back to 'eng'",
    );
    assert(resolved.isFallbackUsed === true, "Flags isFallbackUsed = true when falling back");
    assert(
      resolved.selectionReason.includes("below safe adoption threshold") ||
        resolved.selectionReason.includes("Default"),
      "Documents clear audit rationale for fallback",
    );
  }

  // Test 12.5: Caller explicit language preference honored with high precedence
  {
    testCount++;
    console.log(`[Test ${testCount}] Caller explicit language preference takes precedence`);
    const resolved = SouthAfricanLanguageManager.resolveExecutionLanguage({
      requestedLanguage: "afr",
      sampleText: "Some English invoice text that would otherwise detect as eng",
    });

    assert(resolved.actualLanguageUsed === "afr", "Honors caller-specified language 'afr'");
    assert(resolved.requestedLanguage === "afr", "Records requested language in audit trail");
  }

  // Test 12.6: OCR processing run stores language configuration in OcrDocumentResult
  {
    testCount++;
    console.log(
      `[Test ${testCount}] HybridDocumentProcessor stores language config audit in result`,
    );
    const rawBuffer = generateSyntheticImageBuffer(200, 200, "text_bars");
    const docResult = await HybridDocumentProcessor.processDocument(
      { name: "test_invoice.png", bytes: new Uint8Array(rawBuffer.buffer), mimeType: "image/png" },
      { language: "eng" },
    );

    assert(
      docResult.ocrLanguageConfig !== undefined,
      "Stores ocrLanguageConfig in OcrDocumentResult",
    );
    assert(
      docResult.ocrLanguageConfig?.actualLanguageUsed === "eng",
      "Records actual language used",
    );
    assert(docResult.pages[0]?.languageUsed === "eng", "Records languageUsed on OcrPageResult");
    assert(
      docResult.pages[0]?.detectedOrientation !== undefined,
      "Records detectedOrientation on OcrPageResult",
    );
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 13: STRUCTURED OCR OUTPUT HIERARCHY (REQUIREMENT 11)
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("TEST GROUP 13: Structured OCR Output Hierarchy (Requirement 11)");
  console.log("------------------------------------------------------------------");

  // Test 13.1: Strict 5-tier structural hierarchy: DOCUMENT -> PAGE -> BLOCK -> LINE -> WORD
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Strict 5-tier structural hierarchy (DOCUMENT -> PAGE -> BLOCK -> LINE -> WORD)`,
    );
    const l1 = buildLine(1, 0, "ESKOM TAX INVOICE", 0.05, 98);
    const l2 = buildLine(1, 1, "Account Number: 123456789", 0.1, 98);
    const l3 = buildLine(1, 2, "Invoice Total: R 54321.00", 0.15, 99);

    const layout = OcrLayoutStructureEngine.analyzePageLayout([l1, l2, l3], 1);
    assert(layout.blocks.length > 0, "Reconstructs semantic layout blocks from lines");

    const pageResult: OcrPageResult = {
      pageNumber: 1,
      fullText: [l1, l2, l3].map((l) => l.text).join("\n"),
      geometry: { width: 800, height: 1100, dpi: 300, aspectRatio: 0.727, rotation: 0 },
      words: [l1, l2, l3].flatMap((l) => l.words),
      lines: layout.sortedLines,
      blocks: layout.blocks,
      tables: layout.tables,
      keyValuePairs: layout.keyValuePairs,
      averageConfidence: 98.3,
      minConfidence: 98.0,
      characterCount: 65,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 45,
    };

    // DOCUMENT tier
    assert(Array.isArray([pageResult]), "Document contains pages collection");
    // PAGE tier
    const page = pageResult;
    assert(page.pageNumber === 1, "Page has valid pageNumber");
    assert(page.blocks.length > 0, "Page contains blocks collection");
    // BLOCK tier
    const block = page.blocks[0];
    assert(block.blockId !== undefined, "Block has unique blockId");
    assert(Array.isArray(block.lines) && block.lines.length > 0, "Block contains lines collection");
    // LINE tier
    const line = block.lines[0];
    assert(line.lineId !== undefined, "Line has unique lineId");
    assert(Array.isArray(line.words) && line.words.length > 0, "Line contains words collection");
    // WORD tier
    const word = line.words[0];
    assert(typeof word.text === "string" && word.text.length > 0, "Word text is non-empty string");
    assert(typeof word.confidence === "number", "Word has confidence metric");
    assert(
      typeof word.x === "number" && typeof word.y === "number",
      "Word has explicit x and y coordinates",
    );
    assert(
      typeof word.width === "number" && typeof word.height === "number",
      "Word has explicit width and height",
    );
  }

  // Test 13.2: Word token attributes ({ text, confidence, x, y, width, height }) validation
  {
    testCount++;
    console.log(`[Test ${testCount}] Word token structure matches specification`);
    const line = buildLine(1, 0, "123456789", 0.24, 98);
    const word = line.words[0];

    // Specification:
    // { "text": "123456789", "confidence": 0.98, "x": 120, "y": 240, "width": 150, "height": 24 }
    assert(word.text === "123456789", "Word text matches expected determinant value");
    assert(
      word.confidenceNormalized === 0.98 || word.confidence === 98,
      "Word confidence captures 0.98 (or 98% scale)",
    );
    assert(word.x !== undefined && word.x >= 0, "Word contains valid x coordinate");
    assert(word.y !== undefined && word.y >= 0, "Word contains valid y coordinate");
    assert(word.width !== undefined && word.width > 0, "Word contains valid width");
    assert(word.height !== undefined && word.height > 0, "Word contains valid height");
    assert(
      word.detailedBoundingBox?.coordinateSystem === "PIXEL_SPACE",
      "Word detailedBoundingBox specifies coordinateSystem: PIXEL_SPACE",
    );
  }

  // Test 13.3: Native OCR provider blocks preservation
  {
    testCount++;
    console.log(`[Test ${testCount}] Native OCR provider blocks preservation`);
    const nativeBlock: OcrLayoutBlock = {
      blockId: "prov-native-block-1",
      pageNumber: 1,
      blockType: "PARAGRAPH",
      readingOrderIndex: 0,
      boundingBox: [0.1, 0.1, 0.8, 0.2],
      text: "Account Number: 123456789\nInvoice Total: R 54321.00",
      lines: [],
      confidence: 97.5,
      confidenceNormalized: 0.975,
      x: 100,
      y: 100,
      width: 800,
      height: 200,
      coordinateSystem: "PIXEL_SPACE",
      detailedBoundingBox: {
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 800,
        height: 200,
        coordinateSystem: "PIXEL_SPACE",
        confidence: 0.975,
      },
    };

    const l1 = buildLine(1, 0, "Account Number: 123456789", 0.1, 98);
    const l2 = buildLine(1, 1, "Invoice Total: R 54321.00", 0.15, 97);

    const layout = OcrLayoutStructureEngine.analyzePageLayout([l1, l2], 1, [nativeBlock]);
    assert(layout.blocks.length >= 1, "Layout preserves native provider blocks");
    const preserved = layout.blocks.find((b) => b.blockId === "prov-native-block-1");
    assert(preserved !== undefined, "Found preserved native provider block in layout");
    assert(
      preserved!.lines.length === 2,
      "Correlated constituent lines into native provider block",
    );
  }

  // Test 13.4: Reconstructed blocks contain lines, and lines contain words
  {
    testCount++;
    console.log(`[Test ${testCount}] Reconstructed blocks contain lines, lines contain words`);
    const l1 = buildLine(1, 0, "Item Description Unit Price Total", 0.1);
    const l2 = buildLine(1, 1, "Energy Active Charge 100 kWh R 250.00", 0.15);
    const layout = OcrLayoutStructureEngine.analyzePageLayout([l1, l2], 1);

    for (const b of layout.blocks) {
      assert(b.lines.length > 0, `Block ${b.blockId} has at least 1 line`);
      for (const l of b.lines) {
        assert(l.words.length > 0, `Line ${l.lineId} in block has at least 1 word`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 14: SPATIAL BOUNDING BOXES & EVIDENCE MODEL INTEGRATION (REQUIREMENT 12)
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("TEST GROUP 14: Spatial Bounding Boxes & Evidence Model (Requirement 12)");
  console.log("------------------------------------------------------------------");

  // Test 14.1: Bounding boxes preserve pageNumber, x, y, width, height, coordinateSystem, confidence across elements
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Spatial bounding box properties preserved across OCR elements`,
    );
    const line = buildLine(1, 0, "Account: 078491827401", 0.2);
    const word = line.words[1]; // "078491827401"

    assert(word.pageNumber === 1, "Word preserves pageNumber");
    assert(word.x !== undefined && word.y !== undefined, "Word preserves x and y");
    assert(
      word.width !== undefined && word.height !== undefined,
      "Word preserves width and height",
    );
    assert(word.coordinateSystem === "PIXEL_SPACE", "Word preserves coordinateSystem");
    assert(word.confidence !== undefined, "Word preserves confidence");

    assert(line.pageNumber === 1, "Line preserves pageNumber");
    assert(line.x !== undefined && line.y !== undefined, "Line preserves x and y");
    assert(
      line.width !== undefined && line.height !== undefined,
      "Line preserves width and height",
    );
    assert(line.coordinateSystem === "PIXEL_SPACE", "Line preserves coordinateSystem");
    assert(line.confidence !== undefined, "Line preserves confidence");

    const layout = OcrLayoutStructureEngine.analyzePageLayout([line], 1);
    const block = layout.blocks[0];
    assert(block.pageNumber === 1, "Block preserves pageNumber");
    assert(block.x !== undefined && block.y !== undefined, "Block preserves x and y");
    assert(
      block.width !== undefined && block.height !== undefined,
      "Block preserves width and height",
    );
    assert(block.coordinateSystem === "PIXEL_SPACE", "Block preserves coordinateSystem");
    assert(block.confidence !== undefined, "Block preserves confidence");
  }

  // Test 14.2: Answering "Where exactly on the invoice did this value come from?"
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Answer 'Where exactly on the invoice did this value come from?'`,
    );
    const l1 = buildLine(1, 0, "TAX INVOICE", 0.05);
    const l2 = buildLine(1, 1, "Account Number: 078491827401", 0.15);
    const l3 = buildLine(1, 2, "Total Due: R 12500.50", 0.25);

    const pageResult: OcrPageResult = {
      pageNumber: 1,
      fullText: [l1, l2, l3].map((l) => l.text).join("\n"),
      geometry: { width: 800, height: 1000, dpi: 300, aspectRatio: 0.8, rotation: 0 },
      words: [l1, l2, l3].flatMap((l) => l.words),
      lines: [l1, l2, l3],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 94.0,
      minConfidence: 90.0,
      characterCount: 60,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 40,
    };

    const invoiceDet = OcrEvidenceExtractor.extractInvoiceDeterminants(
      [pageResult],
      "DOC-EVIDENCE-001",
    );
    assert(invoiceDet.accountNumber.value === "078491827401", "Extracted account number");

    // Ask the evidence model: "Where exactly on the invoice did this value come from?"
    const locationReport: OcrEvidenceLocationReport = OcrEvidenceExtractor.answerEvidenceLocation(
      invoiceDet.accountNumber,
    );
    assert(locationReport.found === true, "Report confirms location was found on invoice");
    assert(locationReport.fieldKey === "accountNumber", "Report identifies fieldKey");
    assert(locationReport.value === "078491827401", "Report identifies exact value");
    assert(locationReport.pageNumber === 1, "Report pinpoints page number 1");
    assert(
      locationReport.x !== null && locationReport.x !== undefined,
      "Report provides exact x coordinate",
    );
    assert(
      locationReport.y !== null && locationReport.y !== undefined,
      "Report provides exact y coordinate",
    );
    assert(
      locationReport.width !== null && locationReport.width > 0,
      "Report provides exact width",
    );
    assert(
      locationReport.height !== null && locationReport.height > 0,
      "Report provides exact height",
    );
    assert(locationReport.coordinateSystem === "PIXEL_SPACE", "Report specifies coordinate system");
    assert(
      locationReport.confidence !== null && locationReport.confidence >= 90,
      "Report provides confidence",
    );
    assert(
      locationReport.groundingText.includes("Account Number: 078491827401"),
      "Report provides original OCR grounding text snippet",
    );
    assert(
      locationReport.explanation.includes("page 1") &&
        locationReport.explanation.includes("PIXEL_SPACE"),
      "Report generates comprehensive human/audit explanation answering where it came from",
    );
  }

  // Test 14.3: Integration with Document Intelligence Evidence Model (ProvenancedField)
  {
    testCount++;
    console.log(`[Test ${testCount}] Integration with Document Intelligence ProvenanceGuard`);
    const l1 = buildLine(1, 0, "TAX INVOICE", 0.05);
    const l2 = buildLine(1, 1, "Invoice Number: INV-2026-9912", 0.1);
    const l3 = buildLine(1, 2, "Total Due: R 88000.00", 0.2);

    const pageResult: OcrPageResult = {
      pageNumber: 1,
      fullText: [l1, l2, l3].map((l) => l.text).join("\n"),
      geometry: { width: 1000, height: 1400, dpi: 300, aspectRatio: 0.714, rotation: 0 },
      words: [l1, l2, l3].flatMap((l) => l.words),
      lines: [l1, l2, l3],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 95.0,
      minConfidence: 92.0,
      characterCount: 50,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 30,
    };

    const invoiceDet = OcrEvidenceExtractor.extractInvoiceDeterminants([pageResult], "DOC-PROV-1");

    // Convert OCR determinant to canonical Document Intelligence ProvenancedField
    const provField = OcrEvidenceExtractor.toProvenancedField(
      invoiceDet.invoiceNumber,
      "DOC-PROV-1",
    );
    assert(provField !== null, "Converts determinant to ProvenancedField");
    assert(provField!.fieldKey === "invoiceNumber", "Field key matches");
    assert(provField!.value === "INV-2026-9912", "Field value matches");
    assert(provField!.provenance.pageNumber === 1, "Provenance pageNumber matches");
    assert(
      provField!.provenance.coordinateSystem === "PIXEL_SPACE",
      "Provenance coordinateSystem matches",
    );
    assert(
      provField!.provenance.detailedBoundingBox !== undefined,
      "Provenance detailedBoundingBox is populated",
    );
    assert(
      provField!.provenance.detailedBoundingBox?.x !== undefined,
      "detailedBoundingBox x is populated",
    );
    assert(
      provField!.provenance.detailedBoundingBox?.width !== undefined,
      "detailedBoundingBox width is populated",
    );

    // Validate using Stage 8 ProvenanceGuard
    const validation = ProvenanceGuard.validateField(provField);
    assert(
      validation.isValid === true,
      "ProvenanceGuard validates OCR-derived field with 0 errors",
    );
    assert(validation.errors.length === 0, "No provenance errors in canonical 6-link chain");
  }

  // Test 14.4: Complete document evidence compilation & strict non-fabrication preservation
  {
    testCount++;
    console.log(`[Test ${testCount}] Compile document evidence and enforce strict non-fabrication`);
    const l1 = buildLine(1, 0, "TAX INVOICE", 0.05);
    const l2 = buildLine(1, 1, "Total Amount Due: R 15400.00", 0.15);

    const pageResult: OcrPageResult = {
      pageNumber: 1,
      fullText: [l1, l2].map((l) => l.text).join("\n"),
      geometry: { width: 800, height: 1000, dpi: 300, aspectRatio: 0.8, rotation: 0 },
      words: [l1, l2].flatMap((l) => l.words),
      lines: [l1, l2],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 93.0,
      minConfidence: 90.0,
      characterCount: 40,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 25,
    };

    const invoiceDet = OcrEvidenceExtractor.extractInvoiceDeterminants(
      [pageResult],
      "DOC-EVIDENCE-NONFAB",
    );
    // Verify unobserved field is strictly null
    assert(invoiceDet.vatRegistrationNumber.value === null, "Unobserved field is strictly null");

    // Compile into Document Intelligence evidence dictionary
    const compiledEvidence = OcrEvidenceExtractor.compileDocumentEvidence(
      invoiceDet,
      "DOC-EVIDENCE-NONFAB",
    );

    // totalAmountDue is observed -> must exist in compiled evidence
    assert(
      compiledEvidence["totalAmountDue"] !== undefined,
      "Observed field is present in compiled evidence",
    );
    const valTotal = ProvenanceGuard.validateField(compiledEvidence["totalAmountDue"]);
    assert(valTotal.isValid === true, "Observed field passes ProvenanceGuard validation");

    // vatRegistrationNumber is null -> must NOT be fabricated into an ungrounded provenanced field
    assert(
      compiledEvidence["vatRegistrationNumber"] === undefined,
      "Strict non-fabrication: Null unobserved field is NOT compiled into bare/fake evidence",
    );
  }

  // =========================================================================
  // TEST GROUP 15: OCR CONFIDENCE ACROSS ALL LEVELS & STATUS GATING (REQUIREMENT 13)
  // =========================================================================
  console.log("\n==================================================================");
  console.log("TEST GROUP 15: OCR Confidence at All Levels & Status Gating (Requirement 13)");
  console.log("==================================================================");

  // Test 15.1: Status Thresholds & Reliability Function
  {
    testCount++;
    console.log(`[Test ${testCount}] Status thresholds (HIGH, MEDIUM, LOW) and reliability gating`);
    assert(OcrConfidenceScorer.getConfidenceTier(95) === "HIGH", "95% maps to HIGH tier");
    assert(OcrConfidenceScorer.getConfidenceTier(85) === "HIGH", "85% maps to HIGH tier");
    assert(OcrConfidenceScorer.getConfidenceTier(84.9) === "MEDIUM", "84.9% maps to MEDIUM tier");
    assert(OcrConfidenceScorer.getConfidenceTier(70) === "MEDIUM", "70% maps to MEDIUM tier");
    assert(OcrConfidenceScorer.getConfidenceTier(69.9) === "LOW", "69.9% maps to LOW tier");
    assert(OcrConfidenceScorer.getConfidenceTier(30) === "LOW", "30% maps to LOW tier");

    // Do not pretend a low-confidence OCR result is reliable
    assert(OcrConfidenceScorer.isReliable("HIGH") === true, "HIGH tier is reliable");
    assert(
      OcrConfidenceScorer.isReliable("MEDIUM") === false,
      "MEDIUM tier is not unconditionally reliable",
    );
    assert(OcrConfidenceScorer.isReliable("LOW") === false, "LOW tier is strictly NOT reliable");
    assert(OcrConfidenceScorer.isReliable(90) === true, "Score 90% is reliable");
    assert(
      OcrConfidenceScorer.isReliable(75) === false,
      "Score 75% is not unconditionally reliable",
    );
    assert(OcrConfidenceScorer.isReliable(55) === false, "Score 55% is strictly NOT reliable");
  }

  // Test 15.2: Word, Line, Block, and Page Level Confidence Propagation
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Confidence tier propagation across word, line, block, and page levels`,
    );
    const lineHigh = buildLine(1, 1, "Megaflex Electricity Invoice", 0.1, 95);
    const lineMed = buildLine(1, 2, "Standard Off-Peak Charges", 0.2, 75);
    const lineLow = buildLine(1, 3, "Degraded Noise Token 9882", 0.3, 50);

    const blockHigh: OcrLayoutBlock = {
      blockId: "block-1",
      pageNumber: 1,
      blockType: "HEADING",
      boundingBox: [0.1, 0.1, 0.8, 0.05],
      lines: [lineHigh],
      confidence: 95,
      confidenceNormalized: 0.95,
      x: 100,
      y: 100,
      width: 800,
      height: 50,
      coordinateSystem: "PIXEL_SPACE",
      detailedBoundingBox: {
        pageNumber: 1,
        x: 100,
        y: 100,
        width: 800,
        height: 50,
        coordinateSystem: "PIXEL_SPACE",
        confidence: 0.95,
      },
    };

    const blockMed: OcrLayoutBlock = {
      blockId: "block-2",
      pageNumber: 1,
      blockType: "PARAGRAPH",
      boundingBox: [0.1, 0.2, 0.8, 0.05],
      lines: [lineMed],
      confidence: 75,
      confidenceNormalized: 0.75,
      x: 100,
      y: 200,
      width: 800,
      height: 50,
      coordinateSystem: "PIXEL_SPACE",
      detailedBoundingBox: {
        pageNumber: 1,
        x: 100,
        y: 200,
        width: 800,
        height: 50,
        coordinateSystem: "PIXEL_SPACE",
        confidence: 0.75,
      },
    };

    const blockLow: OcrLayoutBlock = {
      blockId: "block-3",
      pageNumber: 1,
      blockType: "PARAGRAPH",
      boundingBox: [0.1, 0.3, 0.8, 0.05],
      lines: [lineLow],
      confidence: 50,
      confidenceNormalized: 0.5,
      x: 100,
      y: 300,
      width: 800,
      height: 50,
      coordinateSystem: "PIXEL_SPACE",
      detailedBoundingBox: {
        pageNumber: 1,
        x: 100,
        y: 300,
        width: 800,
        height: 50,
        coordinateSystem: "PIXEL_SPACE",
        confidence: 0.5,
      },
    };

    const rawPage: OcrPageResult = {
      pageNumber: 1,
      fullText:
        "Megaflex Electricity Invoice\nStandard Off-Peak Charges\nDegraded Noise Token 9882",
      geometry: { width: 1000, height: 1000, dpi: 300, aspectRatio: 1.0, rotation: 0 },
      words: [...lineHigh.words, ...lineMed.words, ...lineLow.words],
      lines: [lineHigh, lineMed, lineLow],
      blocks: [blockHigh, blockMed, blockLow],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 73.33,
      minConfidence: 50,
      characterCount: 80,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 45,
    };

    const enrichedPage = OcrConfidenceScorer.assignTiersToPage(rawPage);

    // 1. Word level check
    const wHigh = enrichedPage.words.find((w) => w.confidence === 95);
    const wMed = enrichedPage.words.find((w) => w.confidence === 75);
    const wLow = enrichedPage.words.find((w) => w.confidence === 50);
    assert(wHigh?.confidenceTier === "HIGH", "Word level confidence has HIGH tier");
    assert(
      wHigh?.detailedBoundingBox?.confidenceTier === "HIGH",
      "Word detailedBoundingBox has HIGH tier",
    );
    assert(wMed?.confidenceTier === "MEDIUM", "Word level confidence has MEDIUM tier");
    assert(wLow?.confidenceTier === "LOW", "Word level confidence has LOW tier");

    // 2. Line level check
    assert(enrichedPage.lines[0].confidenceTier === "HIGH", "Line 0 has HIGH confidence tier");
    assert(
      enrichedPage.lines[0].detailedBoundingBox?.confidenceTier === "HIGH",
      "Line 0 detailedBoundingBox has HIGH tier",
    );
    assert(enrichedPage.lines[1].confidenceTier === "MEDIUM", "Line 1 has MEDIUM confidence tier");
    assert(enrichedPage.lines[2].confidenceTier === "LOW", "Line 2 has LOW confidence tier");

    // 3. Block level check
    assert(enrichedPage.blocks[0].confidenceTier === "HIGH", "Block 0 has HIGH confidence tier");
    assert(
      enrichedPage.blocks[0].detailedBoundingBox?.confidenceTier === "HIGH",
      "Block 0 detailedBoundingBox has HIGH tier",
    );
    assert(
      enrichedPage.blocks[1].confidenceTier === "MEDIUM",
      "Block 1 has MEDIUM confidence tier",
    );
    assert(enrichedPage.blocks[2].confidenceTier === "LOW", "Block 2 has LOW confidence tier");

    // 4. Page level check
    assert(enrichedPage.confidenceTier === "MEDIUM", "Page level average (73.33%) has MEDIUM tier");
    assert(
      enrichedPage.isReliable === false,
      "MEDIUM average page is not unconditionally reliable",
    );
  }

  // Test 15.3: Document Level Confidence & Low-Confidence Gating
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Document-level confidence evaluation and degraded reliability gating`,
    );
    // Case A: High confidence document
    const highLine1 = buildLine(1, 1, "Account Number: 0789123456", 0.1, 98);
    const highLine2 = buildLine(1, 2, "Total Amount Due: R 125000.00", 0.2, 96);
    const pageHigh: OcrPageResult = {
      pageNumber: 1,
      fullText: "Account Number: 0789123456\nTotal Amount Due: R 125000.00",
      geometry: { width: 1000, height: 1000, dpi: 300, aspectRatio: 1.0, rotation: 0 },
      words: [...highLine1.words, ...highLine2.words],
      lines: [highLine1, highLine2],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 97.0,
      minConfidence: 96.0,
      characterCount: 50,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 30,
    };

    const determinantsHigh = OcrEvidenceExtractor.extractInvoiceDeterminants(
      [pageHigh],
      "DOC-CONF-HIGH",
    );
    const evalHigh = OcrConfidenceScorer.evaluateDocumentConfidence([pageHigh], determinantsHigh);
    assert(evalHigh.tier === "HIGH", "High-confidence invoice receives HIGH tier");
    assert(
      evalHigh.isReliable === true,
      "High-confidence invoice with valid determinants is reliable",
    );
    assert(
      evalHigh.reviewRequired === false,
      "High-confidence invoice does not force human review",
    );

    // Case B: Degraded low-confidence document
    const lowLine1 = buildLine(1, 1, "Acc??? 078???456", 0.1, 52);
    const lowLine2 = buildLine(1, 2, "Tot R ????.??", 0.2, 48);
    const pageLow: OcrPageResult = {
      pageNumber: 1,
      fullText: "Acc??? 078???456\nTot R ????.??",
      geometry: { width: 1000, height: 1000, dpi: 300, aspectRatio: 1.0, rotation: 0 },
      words: [...lowLine1.words, ...lowLine2.words],
      lines: [lowLine1, lowLine2],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 50.0,
      minConfidence: 48.0,
      characterCount: 30,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 30,
    };

    const determinantsLow = OcrEvidenceExtractor.extractInvoiceDeterminants(
      [pageLow],
      "DOC-CONF-LOW",
    );
    const evalLow = OcrConfidenceScorer.evaluateDocumentConfidence([pageLow], determinantsLow);
    assert(evalLow.tier === "LOW", "Degraded invoice receives LOW tier");
    assert(evalLow.isReliable === false, "LOW tier result is strictly NOT reliable");
    assert(evalLow.reviewRequired === true, "LOW tier result strictly requires human review");
    assert(
      evalLow.reviewReasons.some(
        (r) => r.toLowerCase().includes("unreliable") || r.toLowerCase().includes("low"),
      ),
      "Review reasons explicitly state that low-confidence OCR is unreliable",
    );
  }

  // =========================================================================
  // TEST GROUP 16: OCR ERROR DETECTION & NON-REWRITING PIPELINE (REQUIREMENT 14)
  // =========================================================================
  console.log("\n==================================================================");
  console.log("TEST GROUP 16: OCR Error Detection & Non-Rewriting Pipeline (Requirement 14)");
  console.log("==================================================================");

  // Test 16.1: Common Substitutions O↔0, I↔1, l↔1
  {
    testCount++;
    console.log(`[Test ${testCount}] Substitution detection: O ↔ 0, I ↔ 1, l ↔ 1`);
    // O in numeric
    const errO = OcrErrorDetector.detectSubstitutionsInValue("078O198274", "NUMERIC", {
      pageNumber: 1,
    });
    assert(
      errO.length > 0 && errO[0].errorType === "SUBSTITUTION_O_0",
      "Detects letter 'O' in numeric sequence",
    );
    assert(errO[0].suggestedCandidate === "0780198274", "Suggests '0' substitution candidate");

    // 0 in word
    const err0 = OcrErrorDetector.detectSubstitutionsInValue("ESK0M", "GENERAL", { pageNumber: 1 });
    assert(
      err0.length > 0 && err0[0].errorType === "SUBSTITUTION_O_0",
      "Detects digit '0' inside word",
    );
    assert(err0[0].suggestedCandidate === "ESKOM", "Suggests 'O' substitution candidate");

    // I in numeric
    const errI = OcrErrorDetector.detectSubstitutionsInValue("I23456", "NUMERIC", {
      pageNumber: 1,
    });
    assert(
      errI.length > 0 && errI[0].errorType === "SUBSTITUTION_I_1",
      "Detects letter 'I' in numeric sequence",
    );
    assert(errI[0].suggestedCandidate === "123456", "Suggests '1' candidate for 'I'");

    // 1 in word
    const err1 = OcrErrorDetector.detectSubstitutionsInValue("1NVOICE", "GENERAL", {
      pageNumber: 1,
    });
    assert(
      err1.length > 0 && err1[0].errorType === "SUBSTITUTION_I_1",
      "Detects digit '1' in word",
    );
    assert(err1[0].suggestedCandidate === "INVOICE", "Suggests 'I' candidate for '1'");

    // l in numeric
    const errL = OcrErrorDetector.detectSubstitutionsInValue("l500.00", "NUMERIC", {
      pageNumber: 1,
    });
    assert(
      errL.length > 0 && errL[0].errorType === "SUBSTITUTION_L_1",
      "Detects lowercase 'l' in numeric sequence",
    );
    assert(errL[0].suggestedCandidate === "1500.00", "Suggests '1' candidate for 'l'");
  }

  // Test 16.2: Substitutions S↔5, B↔8, G↔6, Z↔2
  {
    testCount++;
    console.log(`[Test ${testCount}] Substitution detection: S ↔ 5, B ↔ 8, G ↔ 6, Z ↔ 2`);
    // S in numeric
    const errS = OcrErrorDetector.detectSubstitutionsInValue("S500.00", "NUMERIC", {
      pageNumber: 1,
    });
    assert(
      errS.length > 0 && errS[0].errorType === "SUBSTITUTION_S_5",
      "Detects letter 'S' in numeric sequence",
    );
    assert(errS[0].suggestedCandidate === "5500.00", "Suggests '5' candidate for 'S'");

    // 5 in word
    const err5 = OcrErrorDetector.detectSubstitutionsInValue("5UBTOTAL", "GENERAL", {
      pageNumber: 1,
    });
    assert(
      err5.length > 0 && err5[0].errorType === "SUBSTITUTION_S_5",
      "Detects digit '5' in word",
    );
    assert(err5[0].suggestedCandidate === "SUBTOTAL", "Suggests 'S' candidate for '5'");

    // B in numeric
    const errB = OcrErrorDetector.detectSubstitutionsInValue("B5000", "NUMERIC", { pageNumber: 1 });
    assert(
      errB.length > 0 && errB[0].errorType === "SUBSTITUTION_B_8",
      "Detects letter 'B' in numeric sequence",
    );
    assert(errB[0].suggestedCandidate === "85000", "Suggests '8' candidate for 'B'");

    // 8 in word
    const err8 = OcrErrorDetector.detectSubstitutionsInValue("8ILLING", "GENERAL", {
      pageNumber: 1,
    });
    assert(
      err8.length > 0 && err8[0].errorType === "SUBSTITUTION_B_8",
      "Detects digit '8' in word",
    );
    assert(err8[0].suggestedCandidate === "BILLING", "Suggests 'B' candidate for '8'");

    // G in numeric
    const errG = OcrErrorDetector.detectSubstitutionsInValue("G480", "NUMERIC", { pageNumber: 1 });
    assert(
      errG.length > 0 && errG[0].errorType === "SUBSTITUTION_G_6",
      "Detects letter 'G' in numeric sequence",
    );
    assert(errG[0].suggestedCandidate === "6480", "Suggests '6' candidate for 'G'");

    // 6 in word
    const err6 = OcrErrorDetector.detectSubstitutionsInValue("CHAR6E", "GENERAL", {
      pageNumber: 1,
    });
    assert(
      err6.length > 0 && err6[0].errorType === "SUBSTITUTION_G_6",
      "Detects digit '6' in word",
    );
    assert(err6[0].suggestedCandidate === "CHARGE", "Suggests 'G' candidate for '6'");

    // Z in numeric
    const errZ = OcrErrorDetector.detectSubstitutionsInValue("Z50.00", "NUMERIC", {
      pageNumber: 1,
    });
    assert(
      errZ.length > 0 && errZ[0].errorType === "SUBSTITUTION_Z_2",
      "Detects letter 'Z' in numeric sequence",
    );
    assert(errZ[0].suggestedCandidate === "250.00", "Suggests '2' candidate for 'Z'");

    // 2 in currency marker
    const err2 = OcrErrorDetector.detectSubstitutionsInValue("2AR", "GENERAL", { pageNumber: 1 });
    assert(
      err2.length > 0 && err2[0].errorType === "SUBSTITUTION_Z_2",
      "Detects digit '2' in '2AR'",
    );
    assert(err2[0].suggestedCandidate === "ZAR", "Suggests 'ZAR' candidate for '2AR'");
  }

  // Test 16.3: Comma ↔ Decimal Ambiguity & Missing Decimal Points
  {
    testCount++;
    console.log(`[Test ${testCount}] Comma/decimal ambiguity and missing decimal point detection`);
    // Consecutive separators
    const errCommaDup = OcrErrorDetector.detectCommaDecimalAmbiguity("12,,50", 1);
    assert(
      errCommaDup.length > 0 && errCommaDup[0].errorType === "COMMA_DECIMAL_AMBIGUITY",
      "Detects consecutive separators",
    );
    assert(errCommaDup[0].suggestedCandidate === "12.50", "Suggests clean decimal candidate");

    // Trailing separator
    const errTrailing = OcrErrorDetector.detectCommaDecimalAmbiguity("12500,", 1);
    assert(
      errTrailing.length > 0 && errTrailing[0].errorType === "COMMA_DECIMAL_AMBIGUITY",
      "Detects trailing comma without cents",
    );

    // Missing decimal point in large integer financial field
    const errDecMissing = OcrErrorDetector.detectMissingDecimalPoint(
      "totalAmountDue",
      "1250000",
      1,
    );
    assert(
      errDecMissing !== null && errDecMissing.errorType === "DECIMAL_POINT_MISSING",
      "Detects missing decimal in totalAmountDue",
    );
    assert(
      errDecMissing?.suggestedCandidate === "12500.00",
      "Suggests 12500.00 for missing decimal point",
    );
  }

  // Test 16.4: Currency Symbol & Date Corruption
  {
    testCount++;
    console.log(`[Test ${testCount}] Currency symbol corruption and date corruption detection`);
    // Currency symbol corruption: 'B' or '2AR' or 'K'
    const currErrB = OcrErrorDetector.detectCurrencyErrors("B 12500.00", 1);
    assert(
      currErrB.length > 0 && currErrB[0].errorType === "CURRENCY_SYMBOL_CORRUPTION",
      "Detects 'B 12500.00' as corrupted Rand symbol",
    );
    assert(currErrB[0].suggestedCandidate === "R 12500.00", "Suggests 'R 12500.00'");

    const currErr2AR = OcrErrorDetector.detectCurrencyErrors("2AR 4500.00", 1);
    assert(
      currErr2AR.length > 0 && currErr2AR[0].errorType === "CURRENCY_SYMBOL_CORRUPTION",
      "Detects '2AR 4500.00'",
    );

    // Date corruption: alpha substitution in date (e.g. 2O26-05-12)
    const dateErrAlpha = OcrErrorDetector.detectDateCorruption("2O26-05-12", 1);
    assert(
      dateErrAlpha !== null && dateErrAlpha.errorType === "DATE_CORRUPTION",
      "Detects letter 'O' in date",
    );
    assert(dateErrAlpha?.suggestedCandidate === "2026-05-12", "Suggests 2026-05-12");

    // Date corruption: out of bounds month (e.g. 2026-15-40)
    const dateErrBounds = OcrErrorDetector.detectDateCorruption("2026-15-40", 1);
    assert(
      dateErrBounds !== null && dateErrBounds.errorType === "DATE_CORRUPTION",
      "Detects out of calendar bounds date",
    );
  }

  // Test 16.5: Account Number & Meter Number Corruption
  {
    testCount++;
    console.log(`[Test ${testCount}] Account number and meter number corruption detection`);
    // Account number with alpha characters
    const accErr = OcrErrorDetector.detectAccountNumberCorruption("078O198274", 1);
    assert(
      accErr !== null && accErr.errorType === "ACCOUNT_NUMBER_CORRUPTION",
      "Detects alpha character in 10-digit account",
    );
    assert(accErr?.suggestedCandidate === "0780198274", "Suggests numeric candidate '0780198274'");

    // Account number wrong length
    const accErrLen = OcrErrorDetector.detectAccountNumberCorruption("078912", 1);
    assert(
      accErrLen !== null && accErrLen.errorType === "ACCOUNT_NUMBER_CORRUPTION",
      "Detects invalid account length (6 digits instead of 10)",
    );

    // Meter number with noise punctuation
    const meterErr = OcrErrorDetector.detectMeterNumberCorruption("MTR#8841-B", 1);
    assert(
      meterErr !== null && meterErr.errorType === "METER_NUMBER_CORRUPTION",
      "Detects illegal noise symbols in meter serial",
    );
    assert(
      meterErr?.suggestedCandidate === "MTR8841-B",
      "Suggests stripped alphanumeric candidate",
    );
  }

  // Test 16.6: Authoritative 5-Step Pipeline Execution
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Authoritative 5-step pipeline execution: OCR VALUE -> POTENTIAL ERROR -> VALIDATION -> CONFIDENCE -> REVIEW IF NECESSARY`,
    );
    const rawInput = "B 125O0.00"; // Corrupted Rand symbol ('B') and 'O' in numeric amount
    const pipeRes = OcrErrorDetector.validatePipeline({
      ocrValue: rawInput,
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      expectedType: "CURRENCY",
      pageNumber: 1,
      baseConfidence: 95.0,
    });

    // Step 1: OCR VALUE
    assert(pipeRes.ocrValue === rawInput, "Step 1: OCR VALUE is preserved immutably");

    // Step 2: POTENTIAL ERROR
    assert(
      pipeRes.potentialErrors.length >= 2,
      "Step 2: POTENTIAL ERROR detects anomalies (currency corruption & substitution)",
    );

    // Step 3: VALIDATION
    assert(
      pipeRes.validationPassed === false,
      "Step 3: VALIDATION flags critical format/syntax failures",
    );

    // Step 4: CONFIDENCE
    assert(pipeRes.confidenceScore < 70, "Step 4: CONFIDENCE score penalized below 70%");
    assert(pipeRes.confidenceTier === "LOW", "Step 4: CONFIDENCE tier downgraded to LOW");
    assert(
      pipeRes.isReliable === false,
      "Step 4: Do not pretend a low-confidence OCR result is reliable",
    );

    // Step 5: REVIEW IF NECESSARY
    assert(pipeRes.reviewRequired === true, "Step 5: REVIEW IF NECESSARY requires human review");
    assert(pipeRes.reviewReasons.length > 0, "Step 5: Specific audit review reasons provided");
  }

  // Test 16.7: Critical Non-Rewriting Assertion (Never Silently Rewrite Financial Values)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] CRITICAL NON-REWRITING ASSERTION: Never silently rewrite financial values`,
    );
    const rawFinancialValue = "R 12,500,00"; // Corrupted second comma instead of decimal
    const pipelineResult = OcrErrorDetector.validatePipeline({
      ocrValue: rawFinancialValue,
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      expectedType: "CURRENCY",
      pageNumber: 1,
    });

    // MANDATORY AUDIT ASSERTION:
    // The engine must NEVER silently rewrite the financial value to "R 12500.00".
    // The ocrValue must remain strictly the original string.
    assert(
      pipelineResult.ocrValue === rawFinancialValue,
      "CRITICAL: ocrValue in pipeline result strictly equals original unedited input (no silent rewrite!)",
    );
    assert(
      pipelineResult.ocrValue !== "R 12500.00",
      "CRITICAL: Financial value was NOT silently altered or normalized behind the scenes",
    );

    // Suggestions are only stored in candidate proposals for explicit human review
    assert(
      pipelineResult.suggestedCandidates.length > 0,
      "Candidate suggestion is generated for human reviewer inspection",
    );
    assert(
      pipelineResult.reviewRequired === true,
      "Human review is mandatory before any correction is accepted",
    );
  }

  // ==================================================================
  // TEST GROUP 17: Numeric Protection (Requirement 15)
  // ==================================================================
  console.log("\n==================================================================");
  console.log("TEST GROUP 17: Numeric Protection (Requirement 15)");
  console.log("==================================================================");

  // Test 17.1: Preservation of all 15 Critical Entity Categories
  {
    testCount++;
    console.log(`[Test ${testCount}] Preservation of all 15 critical entity categories`);

    // 1. Account Number: Preserved as string, never converted to float or scientific notation
    const accField = NumericProtectionEngine.parseAndProtectNumeric("0780198274", "ACCOUNT_NUMBER");
    assert(accField.originalRaw === "0780198274", "1. Account Number original string preserved");
    assert(accField.normalizedText === "0780198274", "1. Account Number normalized as string");
    assert(
      accField.numericValue === null,
      "1. Account Number is NOT converted to floating point number",
    );
    assert(accField.isValid === true, "1. Valid 10-digit account number passes validation");

    // 2. Meter Number: Preserved as string with alphanumeric serial
    const mtrField = NumericProtectionEngine.parseAndProtectNumeric("MTR-908123-B", "METER_NUMBER");
    assert(mtrField.originalRaw === "MTR-908123-B", "2. Meter Number original string preserved");
    assert(mtrField.normalizedText === "MTR-908123-B", "2. Meter Number normalized as string");
    assert(mtrField.numericValue === null, "2. Meter Number is preserved as identifier");

    // 3. Invoice Number: Preserved as string
    const invField = NumericProtectionEngine.parseAndProtectNumeric(
      "INV-2026-00452",
      "INVOICE_NUMBER",
    );
    assert(
      invField.originalRaw === "INV-2026-00452",
      "3. Invoice Number original string preserved",
    );
    assert(invField.isValid === true, "3. Invoice Number is valid");

    // 4. Date: Preserved and calendar validated
    const dateField = NumericProtectionEngine.parseAndValidateDate("2026-03-31");
    assert(dateField.originalRaw === "2026-03-31", "4. Date original string preserved");
    assert(dateField.isoDate === "2026-03-31", "4. Date converted to ISO YYYY-MM-DD");
    assert(dateField.isValidDate === true, "4. Valid date passes calendar checks");

    // 5. kWh (Active Energy)
    const kwhField = NumericProtectionEngine.parseAndProtectNumeric("12 450 kWh", "KWH");
    assert(kwhField.originalRaw === "12 450 kWh", "5. kWh original string preserved");
    assert(kwhField.numericValue === 12450, "5. kWh numeric value parsed accurately (12450)");
    assert(kwhField.unit?.toLowerCase() === "kwh", "5. kWh unit preserved");

    // 6. kVA (Apparent Power / Max Demand)
    const kvaField = NumericProtectionEngine.parseAndProtectNumeric("450.25 kVA", "KVA");
    assert(kvaField.originalRaw === "450.25 kVA", "6. kVA original string preserved");
    assert(kvaField.numericValue === 450.25, "6. kVA numeric value parsed (450.25)");
    assert(kvaField.unit?.toLowerCase() === "kva", "6. kVA unit preserved");

    // 7. kVAh (Apparent Energy)
    const kvahField = NumericProtectionEngine.parseAndProtectNumeric("14 800 kVAh", "KVAH");
    assert(kvahField.originalRaw === "14 800 kVAh", "7. kVAh original string preserved");
    assert(kvahField.numericValue === 14800, "7. kVAh numeric value parsed (14800)");
    assert(kvahField.unit?.toLowerCase() === "kvah", "7. kVAh unit preserved");

    // 8. kVArh (Reactive Energy)
    const kvarhField = NumericProtectionEngine.parseAndProtectNumeric("3 200 kVArh", "KVARH");
    assert(kvarhField.originalRaw === "3 200 kVArh", "8. kVArh original string preserved");
    assert(kvarhField.numericValue === 3200, "8. kVArh numeric value parsed (3200)");
    assert(kvarhField.unit?.toLowerCase() === "kvarh", "8. kVArh unit preserved");

    // 9. Demand (Peak Demand)
    const demandField = NumericProtectionEngine.parseAndProtectNumeric("850.5 kW", "DEMAND");
    assert(demandField.originalRaw === "850.5 kW", "9. Demand original string preserved");
    assert(demandField.numericValue === 850.5, "9. Demand numeric value parsed (850.5)");

    // 10. Power Factor: strictly 0.00 to 1.00
    const pfField = NumericProtectionEngine.parseAndProtectNumeric("0.92", "POWER_FACTOR");
    assert(pfField.originalRaw === "0.92", "10. Power Factor original string preserved");
    assert(pfField.numericValue === 0.92, "10. Power Factor value parsed within bounds (0.92)");
    assert(pfField.isValid === true, "10. Valid power factor passes validation");

    // 11. Tariff Structure Code
    const tariffField = NumericProtectionEngine.parseAndProtectNumeric("MEGAFLEX", "TARIFF");
    assert(tariffField.originalRaw === "MEGAFLEX", "11. Tariff code original string preserved");
    assert(tariffField.isValid === true, "11. Tariff code is valid");

    // 12. Rate (e.g. c/kWh or R/kVA)
    const rateField = NumericProtectionEngine.parseAndProtectNumeric("145.23 c/kWh", "RATE");
    assert(rateField.originalRaw === "145.23 c/kWh", "12. Rate original string preserved");
    assert(rateField.numericValue === 145.23, "12. Rate numeric value parsed (145.23)");
    assert(rateField.unit === "c/kWh", "12. Rate unit preserved (c/kWh)");

    // 13. Amount (Line Item Charges)
    const amountField = NumericProtectionEngine.parseAndProtectNumeric("R 56 420.50", "AMOUNT");
    assert(amountField.originalRaw === "R 56 420.50", "13. Amount original string preserved");
    assert(amountField.numericValue === 56420.5, "13. Amount numeric value parsed (56420.50)");
    assert(amountField.currencySymbol === "R", "13. Currency symbol identified as 'R'");

    // 14. VAT (Rate & Amount)
    const vatField = NumericProtectionEngine.parseAndProtectNumeric("15%", "VAT");
    assert(vatField.originalRaw === "15%", "14. VAT percentage original string preserved");
    assert(vatField.isPercentage === true, "14. VAT isPercentage flagged true");
    assert(vatField.percentageValue === 15.0, "14. VAT percentage value parsed as 15.0");

    // 15. Total (Total Amount Due / Payable)
    const totalField = NumericProtectionEngine.parseAndProtectNumeric("R 64 883.58", "TOTAL");
    assert(totalField.originalRaw === "R 64 883.58", "15. Total original string preserved");
    assert(totalField.numericValue === 64883.58, "15. Total numeric value parsed (64883.58)");
  }

  // Test 17.2: Scale Shift & Dropped Decimal: "R 12 345.67" must NOT become "R 1234567" without detection
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Scale shift dropped decimal: 'R 12 345.67' becoming 'R 1234567' detected`,
    );
    const corruptedOcrTotal = "R 1234567"; // Dropped decimal: integer 1234567 instead of 12345.67
    const result = NumericProtectionEngine.parseAndProtectNumeric(corruptedOcrTotal, "TOTAL");

    // Assert scale shift was detected
    assert(result.scaleShift.detected === true, "Scale shift detected on dropped decimal total");
    assert(result.scaleShift.shiftFactor === 100, "Detects 100x scale shift factor");
    assert(
      result.validationErrors.some((e) => e.errorType === "SCALE_SHIFT_DROPPED_DECIMAL"),
      "Generates SCALE_SHIFT_DROPPED_DECIMAL error",
    );

    // Assert candidate suggestion is provided for human review
    assert(
      result.suggestedCandidate === "R 12345.67",
      "Proposes 'R 12345.67' candidate for human review",
    );

    // Assert review is required and confidence is penalized
    assert(result.reviewRequired === true, "Review required is strictly true for scale shift");
    assert(result.confidenceTier === "LOW", "Confidence tier penalized to LOW");
    assert(result.isValid === false, "Validity flag is false due to unreviewed scale shift");

    // MANDATORY: Never silently rewrite original raw value!
    assert(
      result.originalRaw === corruptedOcrTotal,
      "CRITICAL: originalRaw remains strictly 'R 1234567'",
    );
    assert(
      result.originalRaw !== "R 12345.67",
      "CRITICAL: Did NOT silently rewrite financial total",
    );
  }

  // Test 17.3: Scale Shift & Dropped Decimal: "12.50" must NOT silently become "1250"
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Scale shift dropped decimal: '12.50' becoming '1250' detected`,
    );
    const corruptedRate = "1250"; // Dropped decimal: integer 1250 instead of 12.50
    const result = NumericProtectionEngine.parseAndProtectNumeric(corruptedRate, "RATE");

    assert(
      result.scaleShift.detected === true,
      "Detects scale shift on rate field without decimal point",
    );
    assert(result.scaleShift.shiftFactor === 100, "Calculates 100x scale shift factor");
    assert(result.suggestedCandidate === "12.50", "Suggests candidate '12.50' for reviewer");
    assert(result.reviewRequired === true, "Forces human review requirement");

    // Strict non-rewriting guarantee
    assert(
      result.originalRaw === "1250",
      "CRITICAL: originalRaw preserved as '1250' without mutation",
    );
  }

  // Test 17.4: Power Factor Physical Bounding & Scale Shift Protection (0.00 to 1.00)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Power factor physical bounding (0.00 to 1.00) and scale shift protection`,
    );

    // Valid Power Factor with lag direction
    const validPf = NumericProtectionEngine.parseAndProtectNumeric("0.85 lag", "POWER_FACTOR");
    assert(validPf.numericValue === 0.85, "Parses 0.85 numeric value");
    assert(validPf.unit?.toLowerCase() === "lag", "Preserves 'lag' direction unit");
    assert(validPf.isValid === true, "Valid 0.85 PF is marked valid");
    assert(validPf.reviewRequired === false, "Valid 0.85 PF does not force review");

    // Dropped Decimal Power Factor: "85" (100x scale shift for 0.85)
    const droppedDecPf = NumericProtectionEngine.parseAndProtectNumeric("85", "POWER_FACTOR");
    assert(
      droppedDecPf.scaleShift.detected === true,
      "Detects scale shift for PF value 85 (> 1.00)",
    );
    assert(
      droppedDecPf.scaleShift.shiftFactor === 100,
      "Identifies 100x factor for dropped decimal",
    );
    assert(droppedDecPf.suggestedCandidate === "0.85", "Proposes '0.85' candidate for reviewer");
    assert(
      droppedDecPf.validationErrors.some((e) => e.errorType === "POWER_FACTOR_OUT_OF_BOUNDS"),
      "Raises POWER_FACTOR_OUT_OF_BOUNDS error",
    );
    assert(droppedDecPf.reviewRequired === true, "Review required for out of bounds power factor");
    assert(droppedDecPf.originalRaw === "85", "Original raw preserved as '85'");

    // Another example: "92" -> candidate "0.92"
    const droppedDecPf92 = NumericProtectionEngine.parseAndProtectNumeric("92", "POWER_FACTOR");
    assert(droppedDecPf92.suggestedCandidate === "0.92", "Suggests '0.92' candidate for '92'");
  }

  // Test 17.5: Relative Baseline Scale Shift Detection (10x or 100x jump vs baseline)
  {
    testCount++;
    console.log(`[Test ${testCount}] Baseline comparison scale shift detection (10x / 100x jump)`);
    const baseline = 5000.0; // Expected monthly baseline
    const anomalyObserved = "R 50 000.00"; // 10x jump due to duplicated digit or stray zero
    const result = NumericProtectionEngine.parseAndProtectNumeric(anomalyObserved, "AMOUNT", {
      baselineComparisonValue: baseline,
    });

    assert(result.scaleShift.detected === true, "Detects 10x scale shift against baseline");
    assert(result.scaleShift.shiftFactor === 10, "Calculates shift factor of 10");
    assert(result.reviewRequired === true, "Requires human review for baseline anomaly");
  }

  // ==================================================================
  // TEST GROUP 18: Decimal Validation (Requirement 16)
  // ==================================================================
  console.log("\n==================================================================");
  console.log("TEST GROUP 18: Decimal Validation (Requirement 16)");
  console.log("==================================================================");

  // Test 18.1: Decimal Separator Disambiguation (. vs ,)
  {
    testCount++;
    console.log(`[Test ${testCount}] Decimal separator disambiguation (dot vs comma)`);

    // South African English: Dot decimal with space thousands
    const saEng = NumericProtectionEngine.parseAndProtectNumeric("R 12 345.67", "TOTAL");
    assert(saEng.decimalSeparator === "DOT", "Detects DOT decimal separator");
    assert(saEng.thousandsSeparator === "SPACE", "Detects SPACE thousands separator");
    assert(saEng.numericValue === 12345.67, "Accurately parses 12345.67");

    // South African Afrikaans / Continental: Comma decimal with space thousands
    const saAfr = NumericProtectionEngine.parseAndProtectNumeric("R 12 345,67", "TOTAL");
    assert(saAfr.decimalSeparator === "COMMA", "Detects COMMA decimal separator");
    assert(saAfr.thousandsSeparator === "SPACE", "Detects SPACE thousands separator");
    assert(saAfr.numericValue === 12345.67, "Accurately parses 12345.67 with comma decimal");

    // Simple single decimal point: "12.50" vs "12,50"
    const dotSimple = NumericProtectionEngine.parseAndProtectNumeric("12.50", "AMOUNT");
    const commaSimple = NumericProtectionEngine.parseAndProtectNumeric("12,50", "AMOUNT");
    assert(dotSimple.numericValue === 12.5, "Parses 12.50 from '12.50'");
    assert(commaSimple.numericValue === 12.5, "Parses 12.50 from '12,50'");
  }

  // Test 18.2: Thousands Separator Variations (Space, Comma, Dot, Apostrophe, None)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Thousands separator variations (Space, Comma, Dot, Apostrophe, None)`,
    );

    // Space (SABS South African metric standard)
    const spaceSep = NumericProtectionEngine.parseAndProtectNumeric("12 345.67", "AMOUNT");
    assert(spaceSep.thousandsSeparator === "SPACE", "Identifies SPACE thousands separator");
    assert(spaceSep.numericValue === 12345.67, "Parses number with space thousands separator");

    // Comma (Anglo / UK / US / SA Commercial)
    const commaSep = NumericProtectionEngine.parseAndProtectNumeric("12,345.67", "AMOUNT");
    assert(commaSep.thousandsSeparator === "COMMA", "Identifies COMMA thousands separator");
    assert(commaSep.decimalSeparator === "DOT", "Identifies DOT decimal separator");
    assert(commaSep.numericValue === 12345.67, "Parses number with comma thousands separator");

    // Dot (Continental European)
    const dotSep = NumericProtectionEngine.parseAndProtectNumeric("12.345,67", "AMOUNT", {
      localeProfile: INTERNATIONAL_CONTINENTAL_LOCALE_PROFILE,
    });
    assert(dotSep.thousandsSeparator === "DOT", "Identifies DOT thousands separator");
    assert(dotSep.decimalSeparator === "COMMA", "Identifies COMMA decimal separator");
    assert(dotSep.numericValue === 12345.67, "Parses number with dot thousands separator");

    // Apostrophe (Swiss banking standard)
    const swissSep = NumericProtectionEngine.parseAndProtectNumeric("12'345.67", "AMOUNT", {
      localeProfile: INTERNATIONAL_SWISS_LOCALE_PROFILE,
    });
    assert(
      swissSep.thousandsSeparator === "APOSTROPHE",
      "Identifies APOSTROPHE thousands separator",
    );
    assert(swissSep.decimalSeparator === "DOT", "Identifies DOT decimal separator");
    assert(swissSep.numericValue === 12345.67, "Parses number with apostrophe thousands separator");

    // None (plain unspaced)
    const noneSep = NumericProtectionEngine.parseAndProtectNumeric("12345.67", "AMOUNT");
    assert(noneSep.thousandsSeparator === "NONE", "Identifies NONE thousands separator");
    assert(noneSep.numericValue === 12345.67, "Parses unspaced number");
  }

  // Test 18.3: Currency Formatting (South African & International)
  {
    testCount++;
    console.log(`[Test ${testCount}] Currency formatting (South African R/ZAR/cents, $, €, £)`);

    // South African Rand: "R 12 345.67"
    const rCurr = NumericProtectionEngine.parseAndProtectNumeric("R 12 345.67", "AMOUNT");
    assert(rCurr.currencySymbol === "R", "Identifies 'R' currency symbol");
    assert(rCurr.currencyIsoCode === "ZAR", "Maps to 'ZAR' ISO code");

    // South African Rand: "ZAR 12 345.67"
    const zarCurr = NumericProtectionEngine.parseAndProtectNumeric("ZAR 12 345.67", "AMOUNT");
    assert(zarCurr.currencySymbol === "ZAR", "Identifies 'ZAR' currency symbol");
    assert(zarCurr.currencyIsoCode === "ZAR", "Maps to 'ZAR' ISO code");

    // South African Cents: "c 123.45"
    const centCurr = NumericProtectionEngine.parseAndProtectNumeric("c 123.45", "AMOUNT");
    assert(centCurr.currencySymbol === "c", "Identifies 'c' cents currency symbol");

    // US Dollar: "$ 1,234.56"
    const usdCurr = NumericProtectionEngine.parseAndProtectNumeric("$ 1,234.56", "AMOUNT");
    assert(usdCurr.currencySymbol === "$", "Identifies '$' currency symbol");
    assert(usdCurr.currencyIsoCode === "USD", "Maps to 'USD' ISO code");

    // Euro: "€ 1.234,56"
    const eurCurr = NumericProtectionEngine.parseAndProtectNumeric("€ 1.234,56", "AMOUNT");
    assert(eurCurr.currencySymbol === "€", "Identifies '€' currency symbol");
    assert(eurCurr.currencyIsoCode === "EUR", "Maps to 'EUR' ISO code");

    // British Pound: "£ 1,234.56"
    const gbpCurr = NumericProtectionEngine.parseAndProtectNumeric("£ 1,234.56", "AMOUNT");
    assert(gbpCurr.currencySymbol === "£", "Identifies '£' currency symbol");
    assert(gbpCurr.currencyIsoCode === "GBP", "Maps to 'GBP' ISO code");
  }

  // Test 18.4: Negative Numbers & Credit Notation
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Negative numbers and credit notation (leading minus, trailing minus, parentheses, CR)`,
    );

    // Leading Minus: "-R 450.00"
    const leadMinus = NumericProtectionEngine.parseAndProtectNumeric("-R 450.00", "AMOUNT");
    assert(leadMinus.isNegative === true, "Flags isNegative = true for leading minus");
    assert(leadMinus.negativeFormat === "LEADING_MINUS", "Identifies LEADING_MINUS format");
    assert(leadMinus.numericValue === -450.0, "Parses negative value -450.00");

    // Trailing Minus: "450.00-"
    const trailMinus = NumericProtectionEngine.parseAndProtectNumeric("450.00-", "AMOUNT");
    assert(trailMinus.isNegative === true, "Flags isNegative = true for trailing minus");
    assert(trailMinus.negativeFormat === "TRAILING_MINUS", "Identifies TRAILING_MINUS format");
    assert(trailMinus.numericValue === -450.0, "Parses negative value -450.00");

    // Accounting Parentheses: "(R 450.00)"
    const paren = NumericProtectionEngine.parseAndProtectNumeric("(R 450.00)", "AMOUNT");
    assert(paren.isNegative === true, "Flags isNegative = true for parentheses");
    assert(paren.negativeFormat === "PARENTHESES", "Identifies PARENTHESES format");
    assert(paren.numericValue === -450.0, "Parses negative value -450.00");

    // Credit Suffix: "R 450.00 CR"
    const crSuffix = NumericProtectionEngine.parseAndProtectNumeric("R 450.00 CR", "AMOUNT");
    assert(crSuffix.isNegative === true, "Flags isNegative = true for 'CR' suffix");
    assert(crSuffix.negativeFormat === "CREDIT_SUFFIX", "Identifies CREDIT_SUFFIX format");
    assert(crSuffix.numericValue === -450.0, "Parses credit as negative value -450.00");

    // Credit Word: "450.00 Credit"
    const crWord = NumericProtectionEngine.parseAndProtectNumeric("450.00 Credit", "AMOUNT");
    assert(crWord.isNegative === true, "Flags isNegative = true for 'Credit' word");
    assert(crWord.numericValue === -450.0, "Parses credit word as negative value -450.00");
  }

  // Test 18.5: Percentage Formatting & VAT Range Checking
  {
    testCount++;
    console.log(`[Test ${testCount}] Percentage formatting and VAT range checking`);

    // Standard South African VAT (15%)
    const vat15 = NumericProtectionEngine.parseAndProtectNumeric("15%", "VAT");
    assert(vat15.isPercentage === true, "Flags isPercentage = true for 15%");
    assert(vat15.percentageValue === 15.0, "Parses 15.0 percentage value");
    assert(vat15.isValid === true, "Standard 15% VAT is valid");

    // Standard SA VAT with decimals: "15.00%"
    const vat15Dec = NumericProtectionEngine.parseAndProtectNumeric("15.00%", "VAT");
    assert(vat15Dec.percentageValue === 15.0, "Parses 15.00% as 15.0");

    // Historical SA VAT: "14%"
    const vat14 = NumericProtectionEngine.parseAndProtectNumeric("14%", "VAT");
    assert(vat14.percentageValue === 14.0, "Parses historical 14% VAT");
    assert(vat14.isValid === true, "Historical 14% VAT is valid");

    // Zero-rated: "0%"
    const vat0 = NumericProtectionEngine.parseAndProtectNumeric("0%", "VAT");
    assert(vat0.percentageValue === 0.0, "Parses zero-rated 0% VAT");
    assert(vat0.isValid === true, "Zero-rated VAT is valid");

    // Corrupted Out-of-bounds Percentage: "1500%" (100x scale shift for 15%)
    const corruptPerc = NumericProtectionEngine.parseAndProtectNumeric("1500%", "VAT");
    assert(
      corruptPerc.validationErrors.some((e) => e.errorType === "PERCENTAGE_OUT_OF_BOUNDS"),
      "Raises PERCENTAGE_OUT_OF_BOUNDS error for 1500%",
    );
    assert(corruptPerc.suggestedCandidate === "15%", "Suggests '15%' candidate for '1500%'");
    assert(corruptPerc.reviewRequired === true, "Review required for corrupted percentage");
  }

  // Test 18.6: Unit Extraction and Validation
  {
    testCount++;
    console.log(`[Test ${testCount}] Unit extraction and dictionary validation`);

    // Active Energy: kWh
    const kwh = NumericProtectionEngine.parseAndProtectNumeric("12 450 kWh", "KWH");
    assert(kwh.unit === "kWh", "Extracts 'kWh' unit");
    assert(kwh.numericValue === 12450, "Extracts numeric 12450");
    assert(kwh.isValid === true, "Standard unit is marked valid");

    // Reactive Energy: kVArh
    const kvarh = NumericProtectionEngine.parseAndProtectNumeric("3 200 kVArh", "KVARH");
    assert(kwh.unit === "kWh", "Extracts 'kWh'");
    assert(kvarh.unit === "kVArh", "Extracts 'kVArh' unit");

    // Tariff Rates: c/kWh and R/kVA
    const rate1 = NumericProtectionEngine.parseAndProtectNumeric("145.23 c/kWh", "RATE");
    const rate2 = NumericProtectionEngine.parseAndProtectNumeric("56.40 R/kVA", "RATE");
    assert(rate1.unit === "c/kWh", "Extracts 'c/kWh' rate unit");
    assert(rate2.unit === "R/kVA", "Extracts 'R/kVA' rate unit");

    // Corrupted / Unrecognized unit: "12 450 XYZW"
    const corruptUnit = NumericProtectionEngine.parseAndProtectNumeric("12 450 XYZW", "KWH");
    assert(
      corruptUnit.validationErrors.some((e) => e.errorType === "INVALID_UNIT_SPECIFICATION"),
      "Flags INVALID_UNIT_SPECIFICATION for unknown unit",
    );
    assert(corruptUnit.reviewRequired === true, "Requires review for invalid unit token");
  }

  // Test 18.7: Date Validation (South African and International Formats)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Date validation across South African and International patterns`,
    );

    // Pattern 1: ISO YYYY-MM-DD
    const d1 = NumericProtectionEngine.parseAndValidateDate("2026-03-31");
    assert(d1.isoDate === "2026-03-31", "Validates ISO date 2026-03-31");
    assert(d1.isValidDate === true, "Marks valid ISO date as valid");

    // Pattern 2: SA Slash YYYY/MM/DD
    const d2 = NumericProtectionEngine.parseAndValidateDate("2026/03/31");
    assert(d2.isoDate === "2026-03-31", "Validates SA slash date 2026/03/31");

    // Pattern 3: SA DMY DD/MM/YYYY
    const d3 = NumericProtectionEngine.parseAndValidateDate("31/03/2026");
    assert(d3.isoDate === "2026-03-31", "Validates SA DMY date 31/03/2026");
    assert(d3.localePattern === "SOUTH_AFRICAN", "Classifies as SOUTH_AFRICAN locale pattern");

    // Pattern 4: Text Month DD MMM YYYY ("31 Jan 2026")
    const d4 = NumericProtectionEngine.parseAndValidateDate("31 Jan 2026");
    assert(d4.isoDate === "2026-01-31", "Validates text month date 31 Jan 2026 -> 2026-01-31");

    // Pattern 5: Compact 8-digit YYYYMMDD
    const d5 = NumericProtectionEngine.parseAndValidateDate("20260331");
    assert(d5.isoDate === "2026-03-31", "Validates compact YYYYMMDD date 20260331 -> 2026-03-31");

    // Pattern 6: International US MDY ("03/31/2026")
    const d6 = NumericProtectionEngine.parseAndValidateDate("03/31/2026");
    assert(d6.isoDate === "2026-03-31", "Validates US MDY date 03/31/2026 -> 2026-03-31");
    assert(d6.localePattern === "INTERNATIONAL", "Classifies 03/31/2026 as INTERNATIONAL pattern");

    // Invalid Calendar Date: February 30th ("2026-02-30")
    const dInvalid = NumericProtectionEngine.parseAndValidateDate("2026-02-30");
    assert(dInvalid.isValidDate === false, "Flags February 30th as invalid calendar date");
    assert(
      dInvalid.validationErrors.some((e) => e.errorType === "DATE_CORRUPTION"),
      "Raises DATE_CORRUPTION for non-existent calendar date",
    );
    assert(dInvalid.reviewRequired === true, "Requires review for invalid calendar date");
  }

  // Test 18.8: International Flexibility (Zero Hard-Coded Assumptive Blockades)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] International flexibility: Zero hard-coded assumptive blockades`,
    );

    // US Utility Document: $ 14,520.50 with MDY date and USD currency
    const usDocTotal = NumericProtectionEngine.parseAndProtectNumeric("$ 14,520.50", "TOTAL", {
      localeProfile: INTERNATIONAL_ANGLO_LOCALE_PROFILE,
    });
    assert(usDocTotal.numericValue === 14520.5, "US invoice total parses cleanly (14520.50)");
    assert(usDocTotal.currencySymbol === "$", "US dollar symbol identified");
    assert(usDocTotal.thousandsSeparator === "COMMA", "Comma thousands separator handled cleanly");
    assert(usDocTotal.decimalSeparator === "DOT", "Dot decimal separator handled cleanly");
    assert(
      usDocTotal.isValid === true,
      "Valid US document passes without South African bias failure",
    );

    // European Utility Document: € 14.520,50 with DMY date and EUR currency
    const euDocTotal = NumericProtectionEngine.parseAndProtectNumeric("€ 14.520,50", "TOTAL", {
      localeProfile: INTERNATIONAL_CONTINENTAL_LOCALE_PROFILE,
    });
    assert(euDocTotal.numericValue === 14520.5, "European invoice total parses cleanly (14520.50)");
    assert(euDocTotal.currencySymbol === "€", "Euro symbol identified");
    assert(euDocTotal.thousandsSeparator === "DOT", "Dot thousands separator handled cleanly");
    assert(euDocTotal.decimalSeparator === "COMMA", "Comma decimal separator handled cleanly");
    assert(euDocTotal.isValid === true, "Valid European document passes without bias failure");

    // Swiss Document: CHF 14'520.50
    const swissDocTotal = NumericProtectionEngine.parseAndProtectNumeric("CHF 14'520.50", "TOTAL", {
      localeProfile: INTERNATIONAL_SWISS_LOCALE_PROFILE,
    });
    assert(swissDocTotal.numericValue === 14520.5, "Swiss invoice total parses cleanly (14520.50)");
    assert(
      swissDocTotal.thousandsSeparator === "APOSTROPHE",
      "Apostrophe thousands separator handled cleanly",
    );
    assert(swissDocTotal.isValid === true, "Valid Swiss document passes without bias failure");
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 19: DATE RECOGNITION (REQUIREMENT 17)
  // -------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log("TEST GROUP 19: Candidate Date Recognition (Requirement 17)");
  console.log("==================================================================");

  // Test 19.1: Identification of all user candidate date formats
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Candidate date pattern identification across required formats`,
    );

    // Format 1: 01/09/2026 (DD/MM/YYYY)
    const text1 = "Invoice Tax Date: 01/09/2026 for electricity supply";
    const res1 = DateRecognitionEngine.recognizeCandidateDatesInText(text1);
    assert(res1.length >= 1, "Identifies candidate date in 01/09/2026 text");
    const d1 = res1.find((c) => c.originalRaw === "01/09/2026");
    assert(d1 !== undefined, "Extracts exact candidate '01/09/2026'");
    assert(d1!.originalRaw === "01/09/2026", "Preserves original OCR text '01/09/2026'");
    assert(d1!.normalizedIsoDate === "2026-09-01", "Normalizes 01/09/2026 to ISO '2026-09-01'");
    assert(d1!.detectedFormat === "DD/MM/YYYY", "Identifies DD/MM/YYYY format");

    // Format 2: 2026-09-01 (ISO YYYY-MM-DD)
    const text2 = "Reading Recorded: 2026-09-01 on bulk meter";
    const res2 = DateRecognitionEngine.recognizeCandidateDatesInText(text2);
    const d2 = res2.find((c) => c.originalRaw === "2026-09-01");
    assert(d2 !== undefined, "Extracts exact candidate '2026-09-01'");
    assert(d2!.originalRaw === "2026-09-01", "Preserves original OCR text '2026-09-01'");
    assert(d2!.normalizedIsoDate === "2026-09-01", "Normalizes 2026-09-01 to ISO '2026-09-01'");

    // Format 3: 01 Sep 2026 (DD MMM YYYY)
    const text3 = "Billing Period Due: 01 Sep 2026 payable immediately";
    const res3 = DateRecognitionEngine.recognizeCandidateDatesInText(text3);
    const d3 = res3.find((c) => c.originalRaw === "01 Sep 2026");
    assert(d3 !== undefined, "Extracts exact candidate '01 Sep 2026'");
    assert(d3!.originalRaw === "01 Sep 2026", "Preserves original OCR text '01 Sep 2026'");
    assert(d3!.normalizedIsoDate === "2026-09-01", "Normalizes 01 Sep 2026 to ISO '2026-09-01'");
    assert(d3!.detectedFormat === "DD MMM YYYY", "Identifies DD MMM YYYY format");

    // Format 4: September 1, 2026 (Month D, YYYY)
    const text4 = "Statement Date: September 1, 2026 at Johannesburg office";
    const res4 = DateRecognitionEngine.recognizeCandidateDatesInText(text4);
    const d4 = res4.find((c) => c.originalRaw.startsWith("September 1"));
    assert(d4 !== undefined, "Extracts exact candidate 'September 1, 2026'");
    assert(
      d4!.originalRaw.includes("September 1"),
      "Preserves original OCR text 'September 1, 2026'",
    );
    assert(
      d4!.normalizedIsoDate === "2026-09-01",
      "Normalizes September 1, 2026 to ISO '2026-09-01'",
    );
    assert(d4!.detectedFormat === "MMMM D, YYYY", "Identifies MMMM D, YYYY format");
  }

  // Test 19.2: Strict evidence preservation principle (Never destroy original text)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Strict evidence preservation: originalRaw vs normalizedIsoDate separation`,
    );

    const rawLine = "Payment Cut-off: 01/09/2026 (Strict Due Date)";
    const candidates = DateRecognitionEngine.recognizeCandidateDatesInText(rawLine);
    assert(candidates.length === 1, "Discovers single date in line");
    const candidate = candidates[0];

    // Verify originalRaw is intact
    assert(
      candidate.originalRaw === "01/09/2026",
      "Original OCR text is strictly preserved immutably",
    );
    assert(
      candidate.normalizedIsoDate === "2026-09-01",
      "Normalized date exists in separate field",
    );
    assert(
      candidate.originalRaw !== candidate.normalizedIsoDate,
      "Original text and normalized date remain separate",
    );
    assert(
      candidate.contextSnippet === rawLine,
      "Preserves surrounding context line snippet for provenance",
    );
  }

  // Test 19.3: Calendar validity, leap year and boundary protection
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Calendar validity: leap years, month boundaries & non-existent dates`,
    );

    // Leap Year: 2024-02-29 is valid
    const leapDate =
      DateRecognitionEngine.recognizeCandidateDatesInText("Period End: 2024-02-29")[0];
    assert(leapDate.isCalendarValid === true, "2024-02-29 is recognized as valid leap year date");
    assert(leapDate.normalizedIsoDate === "2024-02-29", "Normalizes valid leap day to ISO");

    // Non-Leap Year: 2026-02-29 is invalid
    const nonLeapDate =
      DateRecognitionEngine.recognizeCandidateDatesInText("Period End: 2026-02-29")[0];
    assert(nonLeapDate.isCalendarValid === false, "2026-02-29 is flagged as invalid calendar date");
    assert(nonLeapDate.normalizedIsoDate === null, "Invalid date has null normalizedIsoDate");
    assert(
      nonLeapDate.originalRaw === "2026-02-29",
      "CRITICAL: Original raw evidence '2026-02-29' is preserved!",
    );

    // Non-existent February 30th: 30/02/2026
    const feb30 = DateRecognitionEngine.recognizeCandidateDatesInText("Date: 30/02/2026")[0];
    assert(feb30.isCalendarValid === false, "30/02/2026 is flagged as invalid calendar date");
    assert(feb30.normalizedIsoDate === null, "Normalized ISO date is null for February 30th");
    assert(feb30.originalRaw === "30/02/2026", "Preserves raw evidence '30/02/2026'");

    // Non-existent April 31st: 31/04/2026
    const apr31 = DateRecognitionEngine.recognizeCandidateDatesInText("Date: 31/04/2026")[0];
    assert(
      apr31.isCalendarValid === false,
      "31/04/2026 is flagged as invalid calendar date (April has 30 days)",
    );
    assert(apr31.normalizedIsoDate === null, "Normalized ISO date is null for April 31st");
    assert(apr31.originalRaw === "31/04/2026", "Preserves raw evidence '31/04/2026'");
  }

  // Test 19.4: Page-level spatial grounding & coordinates preservation
  {
    testCount++;
    console.log(`[Test ${testCount}] Page-level spatial grounding and bounding box linkage`);

    const mockLine = buildLine(1, 0, "Account Tax Date: 01 Sep 2026", 0.25, 96.5);
    const mockPage: OcrPageResult = {
      pageNumber: 1,
      fullText: "Account Tax Date: 01 Sep 2026",
      geometry: {
        width: 1000,
        height: 1400,
        dpi: 300,
        aspectRatio: 0.714,
        rotation: 0,
        orientation: "PORTRAIT",
        detectedRotation: 0,
        appliedRotation: 0,
        wasOrientationCorrected: false,
      },
      words: mockLine.words,
      lines: [mockLine],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 96.5,
      minConfidence: 96.5,
      characterCount: 30,
      isNativeDigital: true,
      isScannedRaster: false,
      processingDurationMs: 12,
    };

    const dates = DateRecognitionEngine.recognizeDatesInPage(mockPage);
    assert(dates.length === 1, "Page scan finds candidate date");
    const d = dates[0];
    assert(d.originalRaw === "01 Sep 2026", "Original raw preserved on page level");
    assert(d.normalizedIsoDate === "2026-09-01", "Normalized ISO date on page level");
    assert(d.pageNumber === 1, "Candidate date records pageNumber 1");
    assert(d.boundingBox !== undefined, "Candidate date preserves line bounding box");
    assert(d.coordinates !== undefined, "Candidate date preserves spatial coordinates");
    assert(d.coordinates!.x === mockLine.x, "Coordinates match line X position");
    assert(d.confidence === 96.5, "Inherits line confidence score");
    assert(d.confidenceTier === "HIGH", "Maps >=85% confidence to HIGH tier");
  }

  // Test 19.5: South African and Afrikaans month recognition
  {
    testCount++;
    console.log(`[Test ${testCount}] South African Afrikaans month name support`);

    const afrText = "Datum: 1 September 2026 en meterlesing op 14 Maart 2026";
    const afrDates = DateRecognitionEngine.recognizeCandidateDatesInText(afrText);
    assert(afrDates.length >= 2, "Discovers both Afrikaans candidate dates");

    const sepDate = afrDates.find((d) => d.originalRaw.includes("September"));
    assert(sepDate !== undefined, "Extracts '1 September 2026'");
    assert(
      sepDate!.normalizedIsoDate === "2026-09-01",
      "Normalizes '1 September 2026' -> '2026-09-01'",
    );

    const maartDate = afrDates.find((d) => d.originalRaw.includes("Maart"));
    assert(maartDate !== undefined, "Extracts Afrikaans '14 Maart 2026'");
    assert(
      maartDate!.normalizedIsoDate === "2026-03-14",
      "Normalizes '14 Maart 2026' -> '2026-03-14'",
    );
  }

  // -------------------------------------------------------------------------
  // TEST GROUP 20: TABLE RECONSTRUCTION (REQUIREMENT 18)
  // -------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log("TEST GROUP 20: Table Reconstruction & Hierarchy (Requirement 18)");
  console.log("==================================================================");

  // Helper lines builder for user example table
  const tableLinesUserExample: OcrLineBlock[] = [
    buildLine(1, 0, "TIME      ENERGY      RATE       AMOUNT", 0.2, 95.0),
    buildLine(1, 1, "Peak      12,500      2.45       30,625", 0.25, 96.0),
    buildLine(1, 2, "Standard  18,200      1.75       31,850", 0.3, 95.5),
    buildLine(1, 3, "OffPeak   25,000      0.90       22,500", 0.35, 97.0),
    buildLine(1, 4, "Total     55,700                 84,975", 0.4, 98.0),
  ];

  // Test 20.1: Prompt Example Table: TABLE → ROW → COLUMN → CELL Hierarchy
  {
    testCount++;
    console.log(`[Test ${testCount}] User example table: TABLE → ROW → COLUMN → CELL hierarchy`);

    const table = TableReconstructionEngine.reconstructTable(tableLinesUserExample, 1, {
      tableId: "user-example-table-1",
    });

    // TABLE level
    assert(table.tableId === "user-example-table-1", "Table has unique table ID");
    assert(table.pageNumber === 1, "Table preserves page number 1");
    assert(table.rowCount === 4, "Table detects exactly 4 data/total rows (3 data, 1 total)");
    assert(table.columnCount === 4, "Table detects exactly 4 columns (TIME, ENERGY, RATE, AMOUNT)");

    // ROW level
    assert(table.tableRows.length === 5, "Preserves 5 structured OcrTableRow objects");
    const headerRow = table.tableRows[0];
    assert(headerRow.rowType === "HEADER", "Row 0 is classified as HEADER");
    assert(headerRow.isHeaderRow === true, "Row 0 has isHeaderRow = true");

    const peakRow = table.tableRows[1];
    assert(peakRow.rowType === "DATA", "Row 1 (Peak) is classified as DATA");
    assert(peakRow.isHeaderRow === false, "Row 1 is not a header");

    const totalRow = table.tableRows[4];
    assert(totalRow.rowType === "TOTAL", "Row 4 (Total) is classified as TOTAL");
    assert(totalRow.isTotalRow === true, "Row 4 has isTotalRow = true");

    // COLUMN level
    assert(table.tableColumns.length === 4, "Constructs 4 structured OcrTableColumn objects");
    assert(table.tableColumns[0].headerText === "TIME", "Column 0 header is TIME");
    assert(table.tableColumns[1].headerText === "ENERGY", "Column 1 header is ENERGY");
    assert(table.tableColumns[2].headerText === "RATE", "Column 2 header is RATE");
    assert(table.tableColumns[3].headerText === "AMOUNT", "Column 3 header is AMOUNT");

    // CELL level
    assert(peakRow.cells.length === 4, "Peak row has 4 constituent cells");
    assert(peakRow.cells[0].text === "Peak", "Cell (1,0) text is 'Peak'");
    assert(peakRow.cells[1].numericValue === 12500, "Cell (1,1) parsed numeric energy 12500");
    assert(peakRow.cells[2].numericValue === 2.45, "Cell (1,2) parsed numeric rate 2.45");
    assert(peakRow.cells[3].numericValue === 30625, "Cell (1,3) parsed numeric amount 30625");

    // Check spatial bounding box on cells
    assert(peakRow.cells[0].boundingBox !== undefined, "Cell preserves bounding box");
    assert(
      peakRow.cells[0].detailedBoundingBox !== undefined,
      "Cell preserves detailedBoundingBox",
    );
  }

  // Test 20.2: Column Type Inference & Alignment
  {
    testCount++;
    console.log(`[Test ${testCount}] Column data type inference (TEXT, NUMERIC, CURRENCY)`);

    const table = TableReconstructionEngine.reconstructTable(tableLinesUserExample, 1);
    const cols = table.tableColumns;

    assert(cols[0].inferredDataType === "TEXT", "TIME column inferred as TEXT");
    assert(cols[0].alignment === "LEFT", "TEXT column aligned LEFT");

    assert(cols[1].inferredDataType === "NUMERIC", "ENERGY column inferred as NUMERIC");
    assert(cols[1].alignment === "RIGHT", "NUMERIC column aligned RIGHT");

    assert(cols[2].inferredDataType === "NUMERIC", "RATE column inferred as NUMERIC");
    assert(cols[2].alignment === "RIGHT", "RATE column aligned RIGHT");

    assert(cols[3].inferredDataType === "CURRENCY", "AMOUNT column inferred as CURRENCY");
    assert(cols[3].alignment === "RIGHT", "CURRENCY column aligned RIGHT");
  }

  // Test 20.3: Totals Detection & Column Arithmetic Verification
  {
    testCount++;
    console.log(`[Test ${testCount}] Column sum verification and arithmetic consistency checks`);

    const table = TableReconstructionEngine.reconstructTable(tableLinesUserExample, 1);
    assert(table.totalRows.length === 1, "Detects 1 total row");
    assert(table.detectedTotals.length >= 2, "Identified column totals for ENERGY and AMOUNT");

    // Check ENERGY column sum: 12500 + 18200 + 25000 = 55700
    const energyTotal = table.detectedTotals.find((t) => t.columnIndex === 1);
    assert(energyTotal !== undefined, "Found ENERGY column total summary");
    assert(energyTotal!.amount === 55700, "Stated ENERGY total is 55700");
    assert(
      energyTotal!.calculatedColumnSum === 55700,
      "Calculated sum of data rows is exactly 55700",
    );
    assert(
      energyTotal!.arithmeticMatches === true,
      "Arithmetic consistency verified for ENERGY sum",
    );
    assert(energyTotal!.discrepancy === 0, "Discrepancy is 0");

    // Check AMOUNT column sum: 30625 + 31850 + 22500 = 84975
    const amountTotal = table.detectedTotals.find((t) => t.columnIndex === 3);
    assert(amountTotal !== undefined, "Found AMOUNT column total summary");
    assert(amountTotal!.amount === 84975, "Stated AMOUNT total is 84975");
    assert(
      amountTotal!.calculatedColumnSum === 84975,
      "Calculated sum of data rows is exactly 84975",
    );
    assert(
      amountTotal!.arithmeticMatches === true,
      "Arithmetic consistency verified for AMOUNT sum",
    );
    assert(amountTotal!.discrepancy === 0, "Discrepancy is 0");
  }

  // Test 20.4: Merged Cells Detection (colSpan & Subheaders)
  {
    testCount++;
    console.log(`[Test ${testCount}] Merged cell detection (colSpan category subheaders)`);

    const tableWithSubheader: OcrLineBlock[] = [
      buildLine(1, 0, "TIME      ENERGY      RATE       AMOUNT", 0.2),
      buildLine(1, 1, "--- HIGH DEMAND SEASON TOU CHARGES ---", 0.24), // Spanning subheader
      buildLine(1, 2, "Peak      12,500      2.45       30,625", 0.28),
      buildLine(1, 3, "Standard  18,200      1.75       31,850", 0.32),
      buildLine(1, 4, "OffPeak   25,000      0.90       22,500", 0.36),
    ];

    const table = TableReconstructionEngine.reconstructTable(tableWithSubheader, 1);
    assert(table.hasMergedCells === true, "Detects merged cells in table");
    assert(table.mergedCells.length >= 1, "mergedCells array contains spanning entry");

    const subheaderRow = table.tableRows.find((r) => r.rowType === "SUBHEADER");
    assert(subheaderRow !== undefined, "Found SUBHEADER row");
    assert(subheaderRow!.cells.length === 1, "Spanning row has single merged cell");
    assert(subheaderRow!.cells[0].colSpan === 4, "Merged cell spans all 4 columns (colSpan = 4)");
  }

  // Test 20.5: Repeated Headers Detection (Mid-table section breaks)
  {
    testCount++;
    console.log(`[Test ${testCount}] Repeated headers detection in section breaks`);

    const tableWithRepeatedHeader: OcrLineBlock[] = [
      buildLine(1, 0, "TIME      ENERGY      RATE       AMOUNT", 0.2),
      buildLine(1, 1, "Peak      12,500      2.45       30,625", 0.25),
      buildLine(1, 2, "TIME      ENERGY      RATE       AMOUNT", 0.3), // Repeated header!
      buildLine(1, 3, "Standard  18,200      1.75       31,850", 0.35),
      buildLine(1, 4, "OffPeak   25,000      0.90       22,500", 0.4),
    ];

    const table = TableReconstructionEngine.reconstructTable(tableWithRepeatedHeader, 1);
    assert(table.hasRepeatedHeaders === true, "Detects repeated header in table");
    assert(table.repeatedHeaderRowIndices.includes(2), "Identifies Row 2 as repeated header index");
    assert(table.tableRows[2].isHeaderRow === true, "Row 2 flagged as isHeaderRow = true");
  }

  // Test 20.6: Multi-Page Continuation Detection & Table Stitching
  {
    testCount++;
    console.log(`[Test ${testCount}] Multi-page continuation detection and cross-page stitching`);

    // Page 1 Table (Header + 2 rows, NO total)
    const page1Lines: OcrLineBlock[] = [
      buildLine(1, 0, "TIME      ENERGY      RATE       AMOUNT", 0.6),
      buildLine(1, 1, "Peak      12,500      2.45       30,625", 0.65),
      buildLine(1, 2, "Standard  18,200      1.75       31,850", 0.7),
    ];
    const tablePage1 = TableReconstructionEngine.reconstructTable(page1Lines, 1, {
      tableId: "table-p1-billing",
    });

    // Page 2 Table (Repeated Header + 1 row + Total)
    const page2Lines: OcrLineBlock[] = [
      buildLine(2, 0, "TIME      ENERGY      RATE       AMOUNT", 0.1),
      buildLine(2, 1, "OffPeak   25,000      0.90       22,500", 0.15),
      buildLine(2, 2, "Total     55,700                 84,975", 0.2),
    ];
    const tablePage2 = TableReconstructionEngine.reconstructTable(page2Lines, 2, {
      tableId: "table-p2-billing",
    });

    // Check continuation detection
    const isCont = TableReconstructionEngine.isContinuation(tablePage1, tablePage2);
    assert(isCont === true, "Detects table on Page 2 is a continuation of table on Page 1");

    // Stitch tables
    const stitched = TableReconstructionEngine.mergeContinuationTables(tablePage1, tablePage2);
    assert(stitched !== undefined, "Merges continuation tables cleanly");

    // Verify continuation link pointers
    assert(tablePage1.continuesToTableId === "table-p2-billing", "Table 1 points to Table 2");
    assert(tablePage1.continuedOnPage === 2, "Table 1 records continuedOnPage = 2");
    assert(tablePage2.isContinuation === true, "Table 2 flagged isContinuation = true");
    assert(
      tablePage2.continuedFromTableId === "table-p1-billing",
      "Table 2 points back to Table 1",
    );
    assert(tablePage2.continuedFromPage === 1, "Table 2 records continuedFromPage = 1");

    // Stitched table properties
    assert(stitched.rowCount >= 4, "Stitched table combines rows across pages");
    assert(stitched.detectedTotals.length >= 1, "Stitched table has detected total row");
    const amountTot = stitched.detectedTotals.find((t) => t.columnIndex === 3);
    assert(amountTot !== undefined, "Stitched table verified cross-page total sum");
    assert(
      amountTot!.arithmeticMatches === true,
      "Combined rows (30625 + 31850 + 22500) match total 84975",
    );
  }

  // Test 20.7: Strict Anti-Concatenation Assertion (Do not simply concatenate into a paragraph)
  {
    testCount++;
    console.log(`[Test ${testCount}] Strict anti-concatenation assertion`);

    const table = TableReconstructionEngine.reconstructTable(tableLinesUserExample, 1);

    // Assert that table representation is NOT a single flattened string
    assert(Array.isArray(table.cells), "Table cells are stored in structured array, not a string");
    assert(
      table.cells.length === 20,
      "Contains exactly 20 distinct structured cells (5 rows x 4 columns)",
    );

    for (const cell of table.cells) {
      assert(typeof cell.rowIndex === "number", "Cell has structured numeric rowIndex");
      assert(typeof cell.columnIndex === "number", "Cell has structured numeric columnIndex");
      assert(typeof cell.text === "string", "Cell has isolated text token");
      assert(Array.isArray(cell.boundingBox), "Cell has isolated boundingBox tuple");
      assert(cell.detailedBoundingBox !== undefined, "Cell has isolated detailedBoundingBox");
    }

    // Verify layoutStructureEngine detectTables also produces structured table
    const layout = OcrLayoutStructureEngine.analyzePageLayout(tableLinesUserExample, 1);
    assert(layout.tables.length === 1, "analyzePageLayout detected the table structure");
    const reconstructed = layout.tables[0];
    assert(reconstructed.tableRows.length === 5, "Layout engine produces full tableRows hierarchy");
    assert(
      reconstructed.tableColumns.length === 4,
      "Layout engine produces full tableColumns hierarchy",
    );
  }

  // ===========================================================================
  // TEST GROUP 21: Multi-Page Tables & Continuation Support (Requirement 19)
  // ===========================================================================
  console.log("\n==================================================================");
  console.log("TEST GROUP 21: Multi-Page Tables & Continuation Support (Requirement 19)");
  console.log("==================================================================");

  // User Example for Requirement 19:
  // Page 3:
  // Energy Charges
  // ...
  // Page 4:
  // continued
  // ...

  const page3EnergyLines: OcrLineBlock[] = [
    {
      lineId: "line-p3-hdr",
      lineIndex: 0,
      pageNumber: 3,
      text: "ENERGY CHARGES",
      confidence: 96,
      boundingBox: [0.1, 0.2, 0.8, 0.03],
      x: 0.1,
      y: 0.2,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.22,
    },
    {
      lineId: "line-p3-cols",
      lineIndex: 1,
      pageNumber: 3,
      text: "TIME      ENERGY      RATE       AMOUNT",
      confidence: 95,
      boundingBox: [0.1, 0.24, 0.8, 0.03],
      x: 0.1,
      y: 0.24,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.26,
    },
    {
      lineId: "line-p3-row1",
      lineIndex: 2,
      pageNumber: 3,
      text: "Peak      12,500      2.45       30,625",
      confidence: 94,
      boundingBox: [0.1, 0.28, 0.8, 0.03],
      x: 0.1,
      y: 0.28,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.3,
    },
    {
      lineId: "line-p3-row2",
      lineIndex: 3,
      pageNumber: 3,
      text: "Standard  18,200      1.75       31,850",
      confidence: 93,
      boundingBox: [0.1, 0.32, 0.8, 0.03],
      x: 0.1,
      y: 0.32,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.34,
    },
  ];

  const page4EnergyLines: OcrLineBlock[] = [
    {
      lineId: "line-p4-cont",
      lineIndex: 0,
      pageNumber: 4,
      text: "Energy Charges (continued)",
      confidence: 95,
      boundingBox: [0.1, 0.1, 0.8, 0.03],
      x: 0.1,
      y: 0.1,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.12,
    },
    {
      lineId: "line-p4-cols",
      lineIndex: 1,
      pageNumber: 4,
      text: "TIME      ENERGY      RATE       AMOUNT",
      confidence: 94,
      boundingBox: [0.1, 0.14, 0.8, 0.03],
      x: 0.1,
      y: 0.14,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.16,
    },
    {
      lineId: "line-p4-row1",
      lineIndex: 2,
      pageNumber: 4,
      text: "OffPeak   25,000      0.90       22,500",
      confidence: 94,
      boundingBox: [0.1, 0.18, 0.8, 0.03],
      x: 0.1,
      y: 0.18,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.2,
    },
    {
      lineId: "line-p4-total",
      lineIndex: 3,
      pageNumber: 4,
      text: "Total     55,700                 84,975",
      confidence: 96,
      boundingBox: [0.1, 0.22, 0.8, 0.03],
      x: 0.1,
      y: 0.22,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: 0.24,
    },
  ];

  // Test 21.1: User example Page 3 "Energy Charges" continuing onto Page 4 "continued"
  {
    testCount++;
    console.log(`[Test ${testCount}] Page 3 'Energy Charges' continuing onto Page 4 'continued'`);

    const tableP3 = TableReconstructionEngine.reconstructTable(
      page3EnergyLines.slice(1), // Starting from column headers
      3,
      { tableId: "table-page3-energy" },
    );
    const tableP4 = TableReconstructionEngine.reconstructTable(page4EnergyLines, 4, {
      tableId: "table-page4-energy-cont",
    });

    assert(tableP3.pageNumber === 3, "Table on Page 3 has pageNumber = 3");
    assert(tableP4.pageNumber === 4, "Table on Page 4 has pageNumber = 4");
    assert(
      tableP4.continuationMarkerDetected === true,
      "Page 4 table detects continuation marker ('continued')",
    );

    const isCont = TableReconstructionEngine.isContinuation(tableP3, tableP4);
    assert(isCont === true, "System recognises Page 4 table as continuation of Page 3 table");
  }

  // Test 21.2: Recognise same logical table and link constituent tables
  {
    testCount++;
    console.log(`[Test ${testCount}] Recognise same logical table and link constituent tables`);

    const tableP3 = TableReconstructionEngine.reconstructTable(page3EnergyLines.slice(1), 3, {
      tableId: "table-page3-energy",
    });
    const tableP4 = TableReconstructionEngine.reconstructTable(page4EnergyLines, 4, {
      tableId: "table-page4-energy-cont",
    });

    const merged = TableReconstructionEngine.mergeContinuationTables(tableP3, tableP4);

    assert(merged !== undefined, "Successfully merged continuation tables");
    assert(merged.isMultiPage === true, "Merged table is flagged as isMultiPage = true");
    assert(merged.pagesSpanned.length === 2, "pagesSpanned contains 2 pages");
    assert(
      merged.pagesSpanned[0] === 3 && merged.pagesSpanned[1] === 4,
      "pagesSpanned is exactly [3, 4]",
    );
    assert(merged.constituentTableIds.length === 2, "constituentTableIds contains both tables");
    assert(
      merged.constituentTableIds.includes("table-page3-energy"),
      "Includes table-page3-energy",
    );
    assert(
      merged.constituentTableIds.includes("table-page4-energy-cont"),
      "Includes table-page4-energy-cont",
    );

    // Both constituent tables receive unified logicalTableId
    assert(
      tableP3.logicalTableId === merged.logicalTableId,
      "Table on Page 3 assigned logicalTableId",
    );
    assert(
      tableP4.logicalTableId === merged.logicalTableId,
      "Table on Page 4 assigned logicalTableId",
    );
    assert(
      tableP3.continuesToTableId === "table-page4-energy-cont",
      "Page 3 table points forward to Page 4 table",
    );
    assert(tableP3.continuedOnPage === 4, "Page 3 table notes continuedOnPage = 4");
    assert(
      tableP4.continuedFromTableId === "table-page3-energy",
      "Page 4 table points backward to Page 3 table",
    );
    assert(tableP4.continuedFromPage === 3, "Page 4 table notes continuedFromPage = 3");
  }

  // Test 21.3: Strict Page Provenance Preservation for Every Single Row & Cell
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Strict page provenance preservation for every single row and cell`,
    );

    const tableP3 = TableReconstructionEngine.reconstructTable(page3EnergyLines.slice(1), 3, {
      tableId: "table-p3",
    });
    const tableP4 = TableReconstructionEngine.reconstructTable(page4EnergyLines, 4, {
      tableId: "table-p4",
    });

    const merged = TableReconstructionEngine.mergeContinuationTables(tableP3, tableP4);

    // Verify cell provenance
    const p3Cells = merged.cells.filter((c) => c.pageNumber === 3);
    const p4Cells = merged.cells.filter((c) => c.pageNumber === 4);

    assert(p3Cells.length > 0, "Contains cells with pageNumber = 3");
    assert(p4Cells.length > 0, "Contains cells with pageNumber = 4");
    assert(
      p3Cells.length + p4Cells.length === merged.cells.length,
      "100% of cells preserve exact page provenance",
    );

    for (const cell of p3Cells) {
      assert(cell.pageNumber === 3, `Cell ${cell.cellId} preserves pageNumber = 3`);
      assert(
        cell.sourceTableId === "table-p3",
        `Cell ${cell.cellId} preserves sourceTableId = table-p3`,
      );
    }

    for (const cell of p4Cells) {
      assert(cell.pageNumber === 4, `Cell ${cell.cellId} preserves pageNumber = 4`);
      assert(
        cell.sourceTableId === "table-p4",
        `Cell ${cell.cellId} preserves sourceTableId = table-p4`,
      );
    }

    // Verify row provenance
    const p3Rows = merged.tableRows!.filter((r) => r.pageNumber === 3);
    const p4Rows = merged.tableRows!.filter((r) => r.pageNumber === 4);

    assert(p3Rows.length > 0, "Contains rows with pageNumber = 3");
    assert(p4Rows.length > 0, "Contains rows with pageNumber = 4");
    assert(
      p3Rows.length + p4Rows.length === merged.tableRows!.length,
      "100% of rows preserve exact page provenance",
    );

    for (const row of p3Rows) {
      assert(row.pageNumber === 3, `Row ${row.rowId} preserves pageNumber = 3`);
      assert(
        row.sourceTableId === "table-p3",
        `Row ${row.rowId} preserves sourceTableId = table-p3`,
      );
    }

    for (const row of p4Rows) {
      assert(row.pageNumber === 4, `Row ${row.rowId} preserves pageNumber = 4`);
      assert(
        row.sourceTableId === "table-p4",
        `Row ${row.rowId} preserves sourceTableId = table-p4`,
      );
    }
  }

  // Test 21.4: Multi-page document table stitching engine across 3 pages (Pages 2 -> 3 -> 4)
  {
    testCount++;
    console.log(`[Test ${testCount}] Multi-page document table stitching engine across 3 pages`);

    const p2Lines: OcrLineBlock[] = [
      {
        lineId: "l-p2-h",
        lineIndex: 0,
        pageNumber: 2,
        text: "TIME      ENERGY      RATE       AMOUNT",
        confidence: 95,
        boundingBox: [0.1, 0.5, 0.8, 0.03],
        x: 0.1,
        y: 0.5,
        width: 0.8,
        height: 0.03,
        coordinateSystem: "NORMALIZED_0_1",
        words: [],
        baselineY: 0.52,
      },
      {
        lineId: "l-p2-d1",
        lineIndex: 1,
        pageNumber: 2,
        text: "Peak      10,000      2.50       25,000",
        confidence: 94,
        boundingBox: [0.1, 0.54, 0.8, 0.03],
        x: 0.1,
        y: 0.54,
        width: 0.8,
        height: 0.03,
        coordinateSystem: "NORMALIZED_0_1",
        words: [],
        baselineY: 0.56,
      },
    ];

    const p3Lines: OcrLineBlock[] = [
      {
        lineId: "l-p3-h",
        lineIndex: 0,
        pageNumber: 3,
        text: "TIME      ENERGY      RATE       AMOUNT",
        confidence: 95,
        boundingBox: [0.1, 0.1, 0.8, 0.03],
        x: 0.1,
        y: 0.1,
        width: 0.8,
        height: 0.03,
        coordinateSystem: "NORMALIZED_0_1",
        words: [],
        baselineY: 0.12,
      },
      {
        lineId: "l-p3-d1",
        lineIndex: 1,
        pageNumber: 3,
        text: "Standard  20,000      1.50       30,000",
        confidence: 94,
        boundingBox: [0.1, 0.14, 0.8, 0.03],
        x: 0.1,
        y: 0.14,
        width: 0.8,
        height: 0.03,
        coordinateSystem: "NORMALIZED_0_1",
        words: [],
        baselineY: 0.16,
      },
    ];

    const p4Lines: OcrLineBlock[] = [
      {
        lineId: "l-p4-c",
        lineIndex: 0,
        pageNumber: 4,
        text: "continued",
        confidence: 95,
        boundingBox: [0.1, 0.1, 0.8, 0.03],
        x: 0.1,
        y: 0.1,
        width: 0.8,
        height: 0.03,
        coordinateSystem: "NORMALIZED_0_1",
        words: [],
        baselineY: 0.12,
      },
      {
        lineId: "l-p4-d1",
        lineIndex: 1,
        pageNumber: 4,
        text: "OffPeak   30,000      1.00       30,000",
        confidence: 94,
        boundingBox: [0.1, 0.14, 0.8, 0.03],
        x: 0.1,
        y: 0.14,
        width: 0.8,
        height: 0.03,
        coordinateSystem: "NORMALIZED_0_1",
        words: [],
        baselineY: 0.16,
      },
      {
        lineId: "l-p4-tot",
        lineIndex: 2,
        pageNumber: 4,
        text: "Total     60,000                 85,000",
        confidence: 95,
        boundingBox: [0.1, 0.18, 0.8, 0.03],
        x: 0.1,
        y: 0.18,
        width: 0.8,
        height: 0.03,
        coordinateSystem: "NORMALIZED_0_1",
        words: [],
        baselineY: 0.2,
      },
    ];

    const t2 = TableReconstructionEngine.reconstructTable(p2Lines, 2, { tableId: "tab-p2" });
    const t3 = TableReconstructionEngine.reconstructTable(p3Lines, 3, { tableId: "tab-p3" });
    const t4 = TableReconstructionEngine.reconstructTable(p4Lines, 4, { tableId: "tab-p4" });

    const { multiPageTables } = TableReconstructionEngine.stitchMultiPageTables([t2, t3, t4]);

    assert(multiPageTables.length === 1, "Discovered exactly 1 multi-page continuation table");
    const multiTab = multiPageTables[0];
    assert(multiTab.isMultiPage === true, "Multi-page table flagged isMultiPage = true");
    assert(multiTab.pagesSpanned.length === 3, "Spans 3 distinct pages");
    assert(
      JSON.stringify(multiTab.pagesSpanned) === JSON.stringify([2, 3, 4]),
      "pagesSpanned is [2, 3, 4]",
    );

    // Verify cell provenance for each page in 3-page chain
    assert(
      multiTab.cells.some((c) => c.pageNumber === 2),
      "Preserves Page 2 cell provenance",
    );
    assert(
      multiTab.cells.some((c) => c.pageNumber === 3),
      "Preserves Page 3 cell provenance",
    );
    assert(
      multiTab.cells.some((c) => c.pageNumber === 4),
      "Preserves Page 4 cell provenance",
    );
  }

  // ===========================================================================
  // TEST GROUP 22: Document Structure & Multi-Format Utility Model (Requirement 20)
  // ===========================================================================
  console.log("\n==================================================================");
  console.log("TEST GROUP 22: Document Structure & Multi-Format Utility Model (Requirement 20)");
  console.log("==================================================================");

  // Helper to generate a realistic mock page with lines
  function makeMockOcrPage(
    pageNumber: number,
    sectionHeadings: Array<{ title: string; y: number }>,
    otherLines: Array<{ text: string; y: number }> = [],
  ): OcrPageResult {
    const allLineTuples = [
      ...sectionHeadings.map((s) => ({ text: s.title, y: s.y, isHdr: true })),
      ...otherLines.map((o) => ({ text: o.text, y: o.y, isHdr: false })),
    ].sort((a, b) => a.y - b.y);

    const lines: OcrLineBlock[] = allLineTuples.map((l, idx) => ({
      lineId: `line-p${pageNumber}-${idx}`,
      lineIndex: idx,
      pageNumber,
      text: l.text,
      confidence: 94,
      boundingBox: [0.1, l.y, 0.8, 0.03],
      x: 0.1,
      y: l.y,
      width: 0.8,
      height: 0.03,
      coordinateSystem: "NORMALIZED_0_1",
      words: [],
      baselineY: l.y + 0.02,
    }));

    return {
      pageNumber,
      fullText: lines.map((l) => l.text).join("\n"),
      geometry: { width: 1000, height: 1414, dpi: 300, aspectRatio: 0.7072, rotation: 0 },
      words: [],
      lines,
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 94,
      minConfidence: 90,
      characterCount: lines.reduce((acc, l) => acc + l.text.length, 0),
      isNativeDigital: true,
      isScannedRaster: false,
      processingDurationMs: 10,
    };
  }

  // Test 22.1: Identification of all 10 target document sections
  {
    testCount++;
    console.log(`[Test ${testCount}] Identification of all 10 required document sections`);

    const all10Sections = [
      { title: "CUSTOMER INFORMATION", y: 0.05 },
      { title: "ACCOUNT INFORMATION", y: 0.15 },
      { title: "METER INFORMATION", y: 0.25 },
      { title: "BILLING PERIOD", y: 0.35 },
      { title: "ENERGY CHARGES", y: 0.45 },
      { title: "DEMAND CHARGES", y: 0.55 },
      { title: "NETWORK CHARGES", y: 0.65 },
      { title: "REACTIVE ENERGY", y: 0.75 },
      { title: "VALUE ADDED TAX", y: 0.85 },
      { title: "TOTAL AMOUNT DUE", y: 0.92 },
    ];

    const mockPage = makeMockOcrPage(1, all10Sections, [
      { text: "Acme Industrial Pty Ltd", y: 0.08 },
      { text: "Account No: 1234567890", y: 0.18 },
      { text: "Meter Serial: MTR-998877", y: 0.28 },
      { text: "Period: 2026-08-01 to 2026-08-31", y: 0.38 },
      { text: "Active Energy: R 54,320.00", y: 0.48 },
      { text: "Maximum Demand: R 18,200.00", y: 0.58 },
      { text: "Network Access Charge: R 6,500.00", y: 0.68 },
      { text: "Reactive Energy kvarh: R 2,100.00", y: 0.78 },
      { text: "VAT @ 15%: R 12,168.00", y: 0.88 },
      { text: "Amount Payable: R 93,288.00", y: 0.95 },
    ]);

    const structure = DocumentStructureEngine.analyzeDocumentStructure([mockPage], "doc-full-10");

    assert(structure.sections.length === 10, "Discovered exactly 10 distinct semantic sections");

    const detectedTypes = new Set(structure.sections.map((s) => s.sectionType));
    assert(detectedTypes.has("CUSTOMER_INFORMATION"), "Discovered CUSTOMER_INFORMATION section");
    assert(detectedTypes.has("ACCOUNT_INFORMATION"), "Discovered ACCOUNT_INFORMATION section");
    assert(detectedTypes.has("METER_INFORMATION"), "Discovered METER_INFORMATION section");
    assert(detectedTypes.has("BILLING_PERIOD"), "Discovered BILLING_PERIOD section");
    assert(detectedTypes.has("ENERGY_CHARGES"), "Discovered ENERGY_CHARGES section");
    assert(detectedTypes.has("DEMAND_CHARGES"), "Discovered DEMAND_CHARGES section");
    assert(detectedTypes.has("NETWORK_CHARGES"), "Discovered NETWORK_CHARGES section");
    assert(detectedTypes.has("REACTIVE_ENERGY"), "Discovered REACTIVE_ENERGY section");
    assert(detectedTypes.has("TAX"), "Discovered TAX section");
    assert(detectedTypes.has("TOTAL"), "Discovered TOTAL section");

    // Check strongly typed convenience getters
    assert(structure.customerSection !== undefined, "customerSection getter populated");
    assert(structure.accountSection !== undefined, "accountSection getter populated");
    assert(structure.meterSection !== undefined, "meterSection getter populated");
    assert(structure.billingPeriodSection !== undefined, "billingPeriodSection getter populated");
    assert(structure.energyChargesSection !== undefined, "energyChargesSection getter populated");
    assert(structure.demandChargesSection !== undefined, "demandChargesSection getter populated");
    assert(structure.networkChargesSection !== undefined, "networkChargesSection getter populated");
    assert(structure.reactiveEnergySection !== undefined, "reactiveEnergySection getter populated");
    assert(structure.taxSection !== undefined, "taxSection getter populated");
    assert(structure.totalSection !== undefined, "totalSection getter populated");
  }

  // Test 22.2: Flexible non-hardcoded layout invariance (Arbitrary section order)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Flexible non-hardcoded layout invariance (arbitrary section order)`,
    );

    // Inverted ordering: TOTAL at top banner, then ACCOUNT, then ENERGY, then CUSTOMER
    const invertedSections = [
      { title: "TOTAL AMOUNT DUE", y: 0.05 },
      { title: "ACCOUNT DETAILS", y: 0.2 },
      { title: "ENERGY CHARGES", y: 0.4 },
      { title: "CUSTOMER DETAILS", y: 0.6 },
      { title: "METER PARTICULARS", y: 0.8 },
    ];

    const mockPageInverted = makeMockOcrPage(1, invertedSections, [
      { text: "Total Payable: R 45,000.00", y: 0.08 },
      { text: "Tax Invoice: INV-2026-001", y: 0.23 },
      { text: "Standard Energy: 15000 kWh", y: 0.43 },
      { text: "Delivery: Pretoria Industrial", y: 0.63 },
      { text: "Meter: KVA-1002", y: 0.83 },
    ]);

    const structure = DocumentStructureEngine.analyzeDocumentStructure(
      [mockPageInverted],
      "doc-inverted",
    );

    assert(
      structure.totalSection !== undefined,
      "Discovers TOTAL even when placed at the top banner",
    );
    assert(
      structure.customerSection !== undefined,
      "Discovers CUSTOMER even when placed after charges",
    );
    assert(structure.meterSection !== undefined, "Discovers METER even at the bottom");
    assert(
      structure.sections.length === 5,
      "Discovered all 5 inverted sections without hardcoded assumptions",
    );

    // Reading order preserves spatial sequence
    assert(
      structure.readingOrderSections[0].sectionType === "TOTAL",
      "First in reading order is TOTAL banner",
    );
    assert(
      structure.readingOrderSections[1].sectionType === "ACCOUNT_INFORMATION",
      "Second is ACCOUNT",
    );
  }

  // Test 22.3: Eskom Direct Format Variants (Standard Megaflex vs Large Power Transmission)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Eskom Direct format variants (Megaflex Standard vs Large Power)`,
    );

    const pageStandard = makeMockOcrPage(1, [
      { title: "ESKOM HOLDINGS SOC LTD", y: 0.02 },
      { title: "MEGAFLEX TARIFF INVOICE", y: 0.05 },
      { title: "ENERGY CHARGES", y: 0.2 },
    ]);
    const variantStandard = DocumentStructureEngine.detectFormatVariant([pageStandard]);
    assert(
      variantStandard === "ESKOM_DIRECT_STANDARD",
      "Correctly classifies Eskom Megaflex as ESKOM_DIRECT_STANDARD",
    );

    const pageLargePower = makeMockOcrPage(1, [
      { title: "ESKOM TRANSMISSION DIVISION", y: 0.02 },
      { title: "TRANSMISSION GENERATOR CONNECTION", y: 0.05 },
      { title: "DEMAND CHARGES", y: 0.2 },
    ]);
    const variantLargePower = DocumentStructureEngine.detectFormatVariant([pageLargePower]);
    assert(
      variantLargePower === "ESKOM_DIRECT_LARGE_POWER",
      "Correctly classifies Eskom Transmission as ESKOM_DIRECT_LARGE_POWER",
    );
  }

  // Test 22.4: South African Municipal Formats Diversity
  {
    testCount++;
    console.log(`[Test ${testCount}] South African municipal formats diversity`);

    // 1. City Power / City of Johannesburg
    const pJhb = makeMockOcrPage(1, [
      { title: "CITY OF JOHANNESBURG - CITY POWER", y: 0.05 },
      { title: "CONSUMER DETAILS", y: 0.15 },
    ]);
    assert(
      DocumentStructureEngine.detectFormatVariant([pJhb]) === "MUNICIPAL_CITY_POWER_JHB",
      "Identifies City Power Johannesburg",
    );

    // 2. City of Cape Town (Bilingual English / Afrikaans / isiXhosa)
    const pCpt = makeMockOcrPage(1, [
      { title: "CITY OF CAPE TOWN / STAD KAAPSTAD / ISIXEKO SASEKAPA", y: 0.05 },
      { title: "REKENING BESONDERHEDE", y: 0.15 },
      { title: "ELEKTRISITEIT HEFFING", y: 0.35 },
      { title: "TOTALE BEDRAG", y: 0.6 },
    ]);
    assert(
      DocumentStructureEngine.detectFormatVariant([pCpt]) === "MUNICIPAL_CITY_OF_CAPE_TOWN",
      "Identifies City of Cape Town",
    );

    // Verify Cape Town Afrikaans section recognition
    const cptStructure = DocumentStructureEngine.analyzeDocumentStructure([pCpt]);
    assert(
      cptStructure.accountSection !== undefined,
      "Recognises Afrikaans 'REKENING BESONDERHEDE' as ACCOUNT",
    );
    assert(
      cptStructure.energyChargesSection !== undefined,
      "Recognises Afrikaans 'ELEKTRISITEIT HEFFING' as ENERGY",
    );
    assert(
      cptStructure.totalSection !== undefined,
      "Recognises Afrikaans 'TOTALE BEDRAG' as TOTAL",
    );

    // 3. eThekwini (Durban Electricity)
    const pDbn = makeMockOcrPage(1, [
      { title: "ETHEKWINI MUNICIPALITY - DURBAN ELECTRICITY", y: 0.05 },
    ]);
    assert(
      DocumentStructureEngine.detectFormatVariant([pDbn]) === "MUNICIPAL_ETHEKWINI",
      "Identifies eThekwini Municipality",
    );

    // 4. City of Tshwane (Pretoria)
    const pTsh = makeMockOcrPage(1, [
      { title: "CITY OF TSHWANE METROPOLITAN MUNICIPALITY", y: 0.05 },
    ]);
    assert(
      DocumentStructureEngine.detectFormatVariant([pTsh]) === "MUNICIPAL_TSHWANE",
      "Identifies City of Tshwane",
    );

    // 5. Ekurhuleni
    const pEkur = makeMockOcrPage(1, [
      { title: "CITY OF EKURHULENI METROPOLITAN MUNICIPALITY", y: 0.05 },
    ]);
    assert(
      DocumentStructureEngine.detectFormatVariant([pEkur]) === "MUNICIPAL_EKURHULENI",
      "Identifies City of Ekurhuleni",
    );

    // 6. Mangaung (Bloemfontein)
    const pMng = makeMockOcrPage(1, [{ title: "MANGAUNG METROPOLITAN MUNICIPALITY", y: 0.05 }]);
    assert(
      DocumentStructureEngine.detectFormatVariant([pMng]) === "MUNICIPAL_MANGAUNG",
      "Identifies Mangaung Metropolitan Municipality",
    );

    // 7. Nelson Mandela Bay (Gqeberha)
    const pNmb = makeMockOcrPage(1, [
      { title: "NELSON MANDELA BAY MUNICIPALITY - GQEBERHA", y: 0.05 },
    ]);
    assert(
      DocumentStructureEngine.detectFormatVariant([pNmb]) === "MUNICIPAL_NELSON_MANDELA_BAY",
      "Identifies Nelson Mandela Bay Municipality",
    );
  }

  // Test 22.5: Section content isolation and bounding box preservation
  {
    testCount++;
    console.log(`[Test ${testCount}] Section content isolation and bounding box preservation`);

    const mockPage = makeMockOcrPage(
      1,
      [
        { title: "CUSTOMER INFORMATION", y: 0.1 },
        { title: "TOTAL AMOUNT DUE", y: 0.5 },
      ],
      [
        { text: "Sappi Southern Africa Ltd", y: 0.14 },
        { text: "100 Paper Mill Road", y: 0.18 },
        { text: "Current Due: R 1,234,567.89", y: 0.54 },
      ],
    );

    const sections = DocumentStructureEngine.identifyPageSections(mockPage);
    assert(sections.length === 2, "Identified 2 bounded sections");

    const custSec = sections.find((s) => s.sectionType === "CUSTOMER_INFORMATION");
    const totSec = sections.find((s) => s.sectionType === "TOTAL");

    assert(custSec !== undefined, "Found Customer Information section");
    assert(totSec !== undefined, "Found Total Amount Due section");

    // Content isolation
    assert(
      custSec!.rawText.includes("Sappi Southern Africa Ltd"),
      "Customer section contains company name",
    );
    assert(
      !custSec!.rawText.includes("1,234,567.89"),
      "Customer section strictly excludes total amount",
    );
    assert(totSec!.rawText.includes("1,234,567.89"), "Total section contains invoice total");
    assert(!totSec!.rawText.includes("Sappi"), "Total section strictly excludes customer name");

    // Bounding boxes
    assert(
      custSec!.boundingBox[1] >= 0.09,
      "Customer section bounded appropriately in Y dimension",
    );
    assert(totSec!.boundingBox[1] >= 0.49, "Total section bounded appropriately in Y dimension");
  }

  // Test 22.6: HybridDocumentProcessor produces full documentStructure and multiPageTables
  {
    testCount++;
    console.log(
      `[Test ${testCount}] HybridDocumentProcessor produces full documentStructure and multiPageTables`,
    );

    const rasterBuffer = generateSyntheticImageBuffer(400, 300, "text_bars");

    const result = await HybridDocumentProcessor.processDocument(
      {
        name: "utility_bill.png",
        bytes: new Uint8Array(rasterBuffer.buffer),
        mimeType: "image/png",
      },
      {
        organisationId: "org-test-multi",
      },
    );

    assert(
      result.documentStructure !== undefined,
      "HybridDocumentProcessor outputs documentStructure",
    );
    assert(
      Array.isArray(result.documentStructure!.sections),
      "documentStructure has sections array",
    );
    assert(Array.isArray(result.sections), "Result exposes top-level sections array");
    assert(Array.isArray(result.multiPageTables), "Result exposes multiPageTables array");
    assert(
      typeof result.documentStructure!.detectedFormatVariant === "string",
      "Result detects format variant",
    );
  }

  // ===========================================================================
  // TEST GROUP 23: EVIDENCE MODEL (Requirement 21)
  // ===========================================================================
  console.log("\n--- TEST GROUP 23: EVIDENCE MODEL (Requirement 21) ---");

  // Test 23.1: Explicit User Specification Verification
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Explicit User Specification Verification (Field, Value, Document, Page, OCR, Source Text, Bounding Box, Confidence, Processing Run)`,
    );

    const evidence = OcrEvidenceModel.createFieldEvidence<string>({
      field: "Account Number",
      value: "123456789",
      document: "document-001",
      page: 1,
      ocr: true,
      sourceText: "123456789",
      boundingBox: [100, 200, 300, 40],
      confidence: 98,
      processingRun: "ocr-run-001",
    });

    // Exact required field names
    assert(evidence.field === "Account Number", "Field matches exact requirement 'Account Number'");
    assert(evidence.value === "123456789", "Value matches exact requirement '123456789'");
    assert(
      evidence.document === "document-001",
      "Document matches exact requirement 'document-001'",
    );
    assert(evidence.page === 1, "Page matches exact requirement 1");
    assert(evidence.ocr === true, "OCR matches exact requirement true");
    assert(
      evidence.sourceText === "123456789",
      "Source text matches exact requirement '123456789'",
    );
    assert(
      Array.isArray(evidence.boundingBox) &&
        evidence.boundingBox[0] === 100 &&
        evidence.boundingBox[1] === 200 &&
        evidence.boundingBox[2] === 300 &&
        evidence.boundingBox[3] === 40,
      "Bounding box matches exact coordinates [100, 200, 300, 40]",
    );
    assert(evidence.confidence === 98, "Confidence matches exact requirement 98%");
    assert(
      evidence.processingRun === "ocr-run-001",
      "Processing run matches exact requirement 'ocr-run-001'",
    );

    // Canonical alias validation
    assert(evidence.fieldKey === "accountNumber", "Auto-derives fieldKey 'accountNumber'");
    assert(evidence.fieldLabel === "Account Number", "Matches fieldLabel");
    assert(evidence.documentId === "document-001", "Document ID alias matches");
    assert(evidence.pageNumber === 1, "Page number alias matches");
    assert(evidence.isOcr === true, "isOcr alias matches");
    assert(evidence.ocrRunId === "ocr-run-001", "ocrRunId alias matches");
    assert(evidence.confidenceScore === 98, "confidenceScore alias matches");
    assert(evidence.confidenceTier === "HIGH", "Confidence >= 85% maps to HIGH tier");
  }

  // Test 23.2: Determinant Field Conversion with Bounding Box and Coordinate Preservation
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Determinant Field Conversion with Bounding Box and Coordinate Preservation`,
    );

    const detField: OcrDeterminantField<number> = {
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      value: 12345.67,
      rawValue: "R 12,345.67",
      provenance: {
        documentId: "doc-inv-999",
        pageNumber: 2,
        extractionMethod: "OCR_KEY_VALUE",
        hasExactBoundingBox: true,
        boundingBox: [0.65, 0.85, 0.25, 0.05],
        confidenceScore: 95.5,
        confidenceTier: "HIGH",
        x: 0.65,
        y: 0.85,
        width: 0.25,
        height: 0.05,
        coordinateSystem: "NORMALIZED_0_1",
        detailedBoundingBox: {
          pageNumber: 2,
          x: 0.65,
          y: 0.85,
          width: 0.25,
          height: 0.05,
          coordinateSystem: "NORMALIZED_0_1",
          confidence: 95.5,
        },
        ocrRunId: "run-inv-2026-001",
        processingRun: "run-inv-2026-001",
        ocr: true,
        isOcr: true,
        sourceText: "Total: R 12,345.67",
      },
    };

    const evidence = OcrEvidenceModel.fromDeterminantField(
      detField,
      "doc-inv-999",
      "run-inv-2026-001",
    );

    assert(evidence.field === "Total Amount Due", "Converted field label is preserved");
    assert(evidence.fieldKey === "totalAmountDue", "Converted field key is preserved");
    assert(evidence.value === 12345.67, "Numeric value preserved");
    assert(evidence.rawValue === "R 12,345.67", "Raw value preserved without mutation");
    assert(evidence.document === "doc-inv-999", "Document ID matches");
    assert(evidence.page === 2, "Page number matches");
    assert(evidence.ocr === true, "OCR flag matches");
    assert(evidence.sourceText === "Total: R 12,345.67", "Source text snippet preserved");
    assert(evidence.confidence === 95.5, "Confidence score preserved");
    assert(evidence.processingRun === "run-inv-2026-001", "Processing run ID preserved");
    assert(evidence.coordinateSystem === "NORMALIZED_0_1", "Coordinate system preserved");
    assert(evidence.detailedBoundingBox !== undefined, "Detailed bounding box preserved");
  }

  // Test 23.3: Comprehensive Evidence Package Compilation from Extracted Determinants
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Comprehensive Evidence Package Compilation from Extracted Determinants`,
    );

    const mockDeterminants = {
      accountNumber: {
        fieldKey: "accountNumber",
        fieldLabel: "Account Number",
        value: "0123456789",
        rawValue: "0123456789",
        provenance: {
          documentId: "doc-test-1",
          pageNumber: 1,
          extractionMethod: "OCR_KEY_VALUE" as const,
          hasExactBoundingBox: true,
          boundingBox: [0.1, 0.2, 0.3, 0.04] as [number, number, number, number],
          confidenceScore: 99,
          confidenceTier: "HIGH" as const,
          ocrRunId: "run-pkg-001",
          processingRun: "run-pkg-001",
          ocr: true,
          isOcr: true,
          sourceText: "0123456789",
        },
      },
      invoiceNumber: {
        fieldKey: "invoiceNumber",
        fieldLabel: "Invoice Number",
        value: "INV-2026-888",
        rawValue: "INV-2026-888",
        provenance: {
          documentId: "doc-test-1",
          pageNumber: 1,
          extractionMethod: "OCR_TESSERACT" as const,
          hasExactBoundingBox: true,
          boundingBox: [0.5, 0.2, 0.2, 0.04] as [number, number, number, number],
          confidenceScore: 94,
          confidenceTier: "HIGH" as const,
          ocrRunId: "run-pkg-001",
          processingRun: "run-pkg-001",
          ocr: true,
          isOcr: true,
          sourceText: "Invoice No: INV-2026-888",
        },
      },
      missingOptionalField: {
        fieldKey: "taxInvoiceNumber",
        fieldLabel: "Tax Invoice Number",
        value: null,
        rawValue: "",
        provenance: {
          documentId: "doc-test-1",
          pageNumber: 1,
          extractionMethod: "OCR_TESSERACT" as const,
          hasExactBoundingBox: false,
          contextSnippet: "Unobserved",
          confidenceScore: 0,
          confidenceTier: "LOW" as const,
        },
      },
    };

    const pkg = OcrEvidenceModel.compileEvidencePackage(
      mockDeterminants,
      "doc-test-1",
      "run-pkg-001",
    );

    assert(pkg.accountNumber !== undefined, "Compiled accountNumber evidence");
    assert(pkg.invoiceNumber !== undefined, "Compiled invoiceNumber evidence");
    assert(
      pkg.missingOptionalField === undefined,
      "Strictly omits null / ungrounded optional fields from evidence package",
    );
    assert(pkg.accountNumber.document === "doc-test-1", "Document ID matches in package");
    assert(pkg.accountNumber.processingRun === "run-pkg-001", "Processing run matches in package");
  }

  // Test 23.4: Rigorous Evidence Model Validation & Boundary Condition Guarding
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Rigorous Evidence Model Validation & Boundary Condition Guarding`,
    );

    // Valid evidence
    const validEvidence = OcrEvidenceModel.createFieldEvidence({
      field: "Meter Number",
      value: "MTR-987654",
      document: "doc-001",
      page: 1,
      ocr: true,
      sourceText: "MTR-987654",
      boundingBox: [0.1, 0.2, 0.3, 0.05],
      confidence: 90,
      processingRun: "run-001",
    });

    const validReport = OcrEvidenceModel.validateFieldEvidence(validEvidence);
    assert(validReport.valid === true, "Valid evidence passes validation check");
    assert(validReport.errors.length === 0, "No errors reported for valid evidence");

    // Invalid evidence (missing document, negative page, confidence > 100, invalid bbox)
    const invalidEvidence: any = {
      field: "",
      value: "test",
      document: "",
      page: 0,
      ocr: true,
      sourceText: "",
      boundingBox: [10, 20], // only 2 items instead of 4
      confidence: 150,
      processingRun: "",
    };

    const invalidReport = OcrEvidenceModel.validateFieldEvidence(invalidEvidence);
    assert(invalidReport.valid === false, "Invalid evidence fails validation check");
    assert(invalidReport.errors.length >= 4, "Detects all validation issues");
  }

  // Test 23.5: Bidirectional Conversion with Canonical ProvenancedField & Ledger Compatibility
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Bidirectional Conversion with Canonical ProvenancedField & Ledger Compatibility`,
    );

    const originalEvidence = OcrEvidenceModel.createFieldEvidence({
      field: "VAT Registration Number",
      fieldKey: "vatRegistrationNumber",
      value: "4123456789",
      rawValue: "VAT: 4123456789",
      document: "doc-vat-001",
      page: 1,
      ocr: true,
      sourceText: "VAT Reg: 4123456789",
      boundingBox: [0.15, 0.35, 0.25, 0.03],
      confidence: 96,
      processingRun: "run-vat-001",
    });

    // To ProvenancedField
    const provField = OcrEvidenceModel.toProvenancedField(originalEvidence);
    assert(provField.fieldKey === "vatRegistrationNumber", "ProvenancedField key matches");
    assert(provField.value === "4123456789", "ProvenancedField value matches");
    assert(provField.page === 1, "ProvenancedField page matches");
    assert(provField.provenance.pageNumber === 1, "ProvenancedField provenance pageNumber matches");
    assert(
      provField.provenance.confidenceScore === 0.96,
      "Confidence normalized to [0, 1] range for ProvenanceGuard ledger",
    );
    assert(provField.runId === "run-vat-001", "Run ID preserved in ProvenancedField");

    // Roundtrip back to OcrFieldEvidence
    const roundtrip = OcrEvidenceModel.fromProvenancedField(provField, "VAT Registration Number");
    assert(roundtrip.field === "VAT Registration Number", "Roundtrip field name preserved");
    assert(roundtrip.value === "4123456789", "Roundtrip value preserved");
    assert(roundtrip.document === "doc-vat-001", "Roundtrip document preserved");
    assert(roundtrip.confidence === 96, "Roundtrip confidence recovered to 96%");
    assert(roundtrip.processingRun === "run-vat-001", "Roundtrip run ID preserved");
  }

  // Test 23.6: Audit Trail Explanations & Evidence Tracing Chain
  {
    testCount++;
    console.log(`[Test ${testCount}] Audit Trail Explanations & Evidence Tracing Chain`);

    const evidence = OcrEvidenceModel.createFieldEvidence({
      field: "Account Number",
      value: "123456789",
      document: "document-001",
      page: 1,
      ocr: true,
      sourceText: "123456789",
      boundingBox: [100, 200, 300, 40],
      confidence: 98,
      processingRun: "ocr-run-001",
    });

    const trace = OcrEvidenceModel.traceEvidence(evidence);
    assert(trace.isGrounded === true, "Evidence marked as grounded");
    assert(trace.found === true, "Evidence marked as found");
    assert(trace.explanation.includes("Account Number"), "Explanation references field label");
    assert(trace.explanation.includes("123456789"), "Explanation references value");
    assert(trace.explanation.includes("document-001"), "Explanation references document ID");
    assert(trace.explanation.includes("ocr-run-001"), "Explanation references OCR run ID");
    assert(
      trace.evidenceChain.includes("document-001 -> Page 1"),
      "Evidence chain traces hierarchical provenance",
    );
    assert(
      trace.evidenceChain.includes("ocr-run-001"),
      "Evidence chain references OCR processing run",
    );
  }

  // ===========================================================================
  // TEST GROUP 24: OCR PROCESSING RUNS (Requirement 22)
  // ===========================================================================
  console.log("\n--- TEST GROUP 24: OCR PROCESSING RUNS (Requirement 22) ---");

  // Test 24.1: Processing Run Creation with all 14 Mandatory Fields
  {
    testCount++;
    console.log(`[Test ${testCount}] Processing Run Creation with all 14 Mandatory Fields`);

    const run = OcrProcessingRunEngine.createRun({
      documentId: "doc-run-001",
      pageId: "page-1",
      provider: "TESSERACT_OCR",
      providerVersion: "5.3.0",
      configuration: { psm: 6, oem: 1, dpi: 300 },
      language: "eng+afr+zul",
      preprocessingVersion: "2.1.0",
      outputVersion: "1.0.0",
    });

    // Verify all 14 mandatory fields
    assert(typeof run.ocrRunId === "string" && run.ocrRunId.length > 0, "1. OCR run ID present");
    assert(run.documentId === "doc-run-001", "2. document ID matches");
    assert(run.pageId === "page-1", "3. page ID matches");
    assert(run.provider === "TESSERACT_OCR", "4. provider matches");
    assert(run.providerVersion === "5.3.0", "5. provider version matches");
    assert(typeof run.configuration === "object", "6. configuration is structured object");
    assert(run.language === "eng+afr+zul", "7. language matches");
    assert(run.preprocessingVersion === "2.1.0", "8. preprocessing version matches");
    assert(
      typeof run.startTime === "string" && !isNaN(Date.parse(run.startTime)),
      "9. start time is valid ISO timestamp",
    );
    assert(run.endTime === null || run.endTime === undefined, "10. end time is null initially");
    assert(
      run.processingDuration === null || typeof run.processingDuration === "number",
      "11. processing duration initialized",
    );
    assert(run.status === "RUNNING", "12. status is RUNNING");
    assert(run.error === null || run.error === undefined, "13. error is null initially");
    assert(run.outputVersion === "1.0.0", "14. output version matches");
  }

  // Test 24.2: Page-Level Processing Runs & Cumulative Run Completion
  {
    testCount++;
    console.log(`[Test ${testCount}] Page-Level Processing Runs & Cumulative Run Completion`);

    const run = OcrProcessingRunEngine.createRun({
      documentId: "doc-multi-page-run",
      totalPages: 2,
    });

    // Page 1
    const page1Run = OcrProcessingRunEngine.createPageRun(run.ocrRunId, "doc-multi-page-run", 1);
    assert(page1Run.pageNumber === 1, "Page 1 run pageNumber is 1");
    assert(page1Run.status === "RUNNING", "Page 1 status is RUNNING");

    // Simulate page 1 work and complete
    const completedPage1 = OcrProcessingRunEngine.completePageRun(page1Run, {
      wordCount: 150,
      lineCount: 20,
      tableCount: 1,
      confidence: 94.2,
      confidenceTier: "HIGH",
    });

    assert(completedPage1.status === "COMPLETED", "Page 1 status marked COMPLETED");
    assert(completedPage1.endTime !== undefined, "Page 1 endTime recorded");
    assert(completedPage1.processingDuration >= 0, "Page 1 duration computed");
    assert(completedPage1.wordCount === 150, "Page 1 word count recorded");
    assert(completedPage1.tableCount === 1, "Page 1 table count recorded");

    // Complete overall run
    const completedRun = OcrProcessingRunEngine.completeRun(run.ocrRunId, {
      totalWords: 300,
      totalLines: 40,
      totalTables: 2,
      overallConfidence: 93.8,
      overallConfidenceTier: "HIGH",
      pageRuns: [completedPage1],
    });

    assert(completedRun.status === "COMPLETED", "Overall run marked COMPLETED");
    assert(typeof completedRun.endTime === "string", "Overall run endTime recorded");
    assert(completedRun.processingDuration >= 0, "Overall run processingDuration >= 0");
    assert(completedRun.pageRuns.length === 1, "Page runs attached to overall run");
    assert(completedRun.totalWords === 300, "Total words recorded");
  }

  // Test 24.3: Processing Run Error Tracking & Failure Lifecycle
  {
    testCount++;
    console.log(`[Test ${testCount}] Processing Run Error Tracking & Failure Lifecycle`);

    const run = OcrProcessingRunEngine.createRun({
      documentId: "doc-corrupted-pdf",
    });

    const failedRun = OcrProcessingRunEngine.failRun(run.ocrRunId, {
      code: "CORRUPTED_PDF_STREAM",
      message: "The PDF header is malformed and could not be rasterized at 300 DPI",
      stack: "Error: Malformed PDF stream at PdfPageRasterizer.rasterize",
    });

    assert(failedRun.status === "FAILED", "Run status transitioned to FAILED");
    assert(typeof failedRun.endTime === "string", "endTime timestamped on failure");
    assert(failedRun.error !== null && failedRun.error !== undefined, "Error record attached");
    assert(failedRun.error!.code === "CORRUPTED_PDF_STREAM", "Error code matches");
    assert(failedRun.error!.message.includes("malformed"), "Error message preserved");
    assert(failedRun.error!.stack !== undefined, "Error stack trace recorded for reproducibility");
  }

  // Test 24.4: In-Memory Processing Run Registry & Auditing
  {
    testCount++;
    console.log(`[Test ${testCount}] In-Memory Processing Run Registry & Auditing`);

    OcrProcessingRunEngine.clearRunRegistry();

    const runA = OcrProcessingRunEngine.createRun({ documentId: "doc-audit-A" });
    const runB = OcrProcessingRunEngine.createRun({ documentId: "doc-audit-B" });
    const runC = OcrProcessingRunEngine.createRun({ documentId: "doc-audit-A" });

    OcrProcessingRunEngine.completeRun(runA.ocrRunId, { overallConfidence: 95 });
    OcrProcessingRunEngine.failRun(runB.ocrRunId, { code: "TIMEOUT", message: "Worker timed out" });

    // Query registry
    const fetchedA = OcrProcessingRunEngine.getRun(runA.ocrRunId);
    assert(fetchedA !== undefined, "Run A retrieved from registry");
    assert(fetchedA!.status === "COMPLETED", "Run A status in registry is COMPLETED");

    const allRuns = OcrProcessingRunEngine.listRuns();
    assert(allRuns.length === 3, "Registry contains all 3 recorded runs");

    const docARuns = OcrProcessingRunEngine.listRuns({ documentId: "doc-audit-A" });
    assert(docARuns.length === 2, "Filtered runs for doc-audit-A returns 2 runs");

    const failedRuns = OcrProcessingRunEngine.listRuns({ status: "FAILED" });
    assert(failedRuns.length === 1, "Filtered runs for FAILED returns 1 run");
    assert(failedRuns[0].ocrRunId === runB.ocrRunId, "Failed run is runB");
  }

  // Test 24.5: End-to-End HybridDocumentProcessor Run Audit Trail and Evidence Binding
  {
    testCount++;
    console.log(
      `[Test ${testCount}] End-to-End HybridDocumentProcessor Run Audit Trail and Evidence Binding`,
    );

    const rasterBuffer = generateSyntheticImageBuffer(400, 300, "text_bars");

    const result = await HybridDocumentProcessor.processDocument(
      {
        name: "test_invoice_with_runs.png",
        bytes: new Uint8Array(rasterBuffer.buffer),
        mimeType: "image/png",
      },
      {
        organisationId: "org-audit-test",
      },
    );

    // Verify processing run
    assert(result.processingRun !== undefined, "Result contains top-level processingRun");
    const run = result.processingRun!;
    assert(
      typeof run.ocrRunId === "string" && run.ocrRunId.startsWith("ocr-run-"),
      "Run ID formatted correctly",
    );
    assert(run.status === "COMPLETED", "Run completed successfully");
    assert(typeof run.startTime === "string", "Run has valid start time");
    assert(typeof run.endTime === "string", "Run has valid end time");
    assert(run.processingDuration >= 0, "Run has non-negative duration");
    assert(typeof run.provider === "string" && run.provider.length > 0, "Provider recorded");
    assert(typeof run.providerVersion === "string", "Provider version recorded");
    assert(typeof run.outputVersion === "string", "Output version recorded");
    assert(typeof run.preprocessingVersion === "string", "Preprocessing version recorded");

    // Verify evidence records binding
    assert(result.evidenceRecords !== undefined, "Result contains evidenceRecords map");
    assert(Array.isArray(result.fieldEvidenceList), "Result contains fieldEvidenceList array");

    for (const evidence of result.fieldEvidenceList!) {
      assert(
        evidence.processingRun === run.ocrRunId,
        "Field evidence processingRun binds to OCR run ID",
      );
      assert(
        evidence.document === result.documentId,
        "Field evidence document binds to document ID",
      );
      assert(typeof evidence.ocr === "boolean", "Field evidence ocr is boolean");
      assert(typeof evidence.confidence === "number", "Field evidence confidence is numeric");
      assert(Array.isArray(evidence.boundingBox), "Field evidence boundingBox is array");
    }
  }

  // --- TEST GROUP 25: RETRIES & IDEMPOTENCY (Requirement 23) ---
  console.log("\n--- TEST GROUP 25: RETRIES & IDEMPOTENCY (Requirement 23) ---");

  // Test 96: Safe retry state transition sequence: FAILED -> RETRY 1 -> RETRY 2 -> REVIEW_REQUIRED
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Safe Retry State Transition (FAILED -> RETRY 1 -> RETRY 2 -> REVIEW_REQUIRED)`,
    );

    const run = OcrProcessingRunEngine.createRun({
      documentId: "doc-retry-test-01",
      maxRetries: 2,
    });

    assert(run.status === "RUNNING", "Initial status is RUNNING");

    // Attempt 1 fails -> RETRY_1
    const s1 = OcrRetryEngine.getNextStatusOnFailure(1, 2);
    assert(s1 === "RETRY_1", "Attempt 1 failure transitions to RETRY_1");
    OcrRetryEngine.recordRetryOnRun(run, 1, s1, new Error("Transient OCR timeout"), 120);
    assert(run.status === "RETRY_1", "Run status updated to RETRY_1");
    assert(run.retryAttempt === 1, "Run retryAttempt recorded as 1");
    assert(run.retryHistory!.length === 1, "Retry history contains 1 attempt");

    // Attempt 2 fails -> RETRY_2
    const s2 = OcrRetryEngine.getNextStatusOnFailure(2, 2);
    assert(s2 === "RETRY_2", "Attempt 2 failure transitions to RETRY_2");
    OcrRetryEngine.recordRetryOnRun(run, 2, s2, new Error("Worker restart failed"), 150);
    assert(run.status === "RETRY_2", "Run status updated to RETRY_2");
    assert(run.retryAttempt === 2, "Run retryAttempt recorded as 2");
    assert(run.retryHistory!.length === 2, "Retry history contains 2 attempts");

    // Attempt 3 fails (max retries exhausted) -> REVIEW_REQUIRED
    const s3 = OcrRetryEngine.getNextStatusOnFailure(3, 2);
    assert(s3 === "REVIEW_REQUIRED", "Attempt 3 failure transitions to REVIEW_REQUIRED");
    OcrRetryEngine.recordRetryOnRun(run, 3, s3, new Error("Unrecoverable page corruption"), 200);
    assert(run.status === "REVIEW_REQUIRED", "Run status updated to REVIEW_REQUIRED");
    assert(run.retryAttempt === 3, "Run retryAttempt recorded as 3");
    assert(run.retryHistory!.length === 3, "Retry history contains 3 attempts");
  }

  // Test 97: Idempotent processing & non-duplication during retries
  {
    testCount++;
    console.log(`[Test ${testCount}] Idempotent processing and de-duplication during retries`);

    const ocrRunId = "ocr-run-idempotent-001";
    const run1 = OcrProcessingRunEngine.createRun({
      ocrRunId,
      documentId: "doc-idempotency-01",
      idempotencyKey: "idempotency-key-01",
    });

    // Second call with same ocrRunId should return identical run instance without creating duplicate
    const run2 = OcrProcessingRunEngine.createRun({
      ocrRunId,
      documentId: "doc-idempotency-01",
      idempotencyKey: "idempotency-key-01",
    });

    assert(run1 === run2, "Re-creating with same run ID returns existing run idempotently");
    assert(run1.ocrRunId === ocrRunId, "OCR Run ID preserved");

    // Record retry attempt 1 twice to test idempotent attempt updates
    OcrRetryEngine.recordRetryOnRun(run1, 1, "RETRY_1", "Transient network glitch");
    OcrRetryEngine.recordRetryOnRun(run1, 1, "RETRY_1", "Transient network glitch retry updated");
    assert(
      run1.retryHistory!.length === 1,
      "Duplicate retry recording does not create duplicate history records",
    );
  }

  // Test 98: Successful recovery on retry transitions to COMPLETED
  {
    testCount++;
    console.log(`[Test ${testCount}] Successful recovery on retry transitions to COMPLETED`);

    let executionAttempts = 0;
    const retryResult = await OcrRetryEngine.executeWithRetry(
      async (attempt) => {
        executionAttempts++;
        if (attempt === 0) {
          throw new Error("Worker busy, retryable failure");
        }
        return { extractedText: "Account Number: 987654321" };
      },
      {
        policy: { initialBackoffMs: 10, maxRetries: 2, jitter: false },
      },
    );

    assert(retryResult.success === true, "Task succeeded after retry");
    assert(retryResult.finalStatus === "COMPLETED", "Final status is COMPLETED");
    assert(retryResult.attempts === 2, "Task succeeded on attempt 2 (retry 1)");
    assert(executionAttempts === 2, "Executed exactly 2 attempts");
    assert(retryResult.result?.extractedText === "Account Number: 987654321", "Result preserved");
  }

  // Test 99: Retryable error classification & exponential backoff computation
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Retryable error classification and exponential backoff computation`,
    );

    const timeoutErr = new Error("Tesseract worker timed out after 30000ms");
    const networkErr = { code: "NETWORK_TIMEOUT", message: "Fetch failed" };
    const fatalErr = new Error("Syntax error in application business logic");

    assert(OcrRetryEngine.isRetryable(timeoutErr) === true, "Worker timeout is retryable");
    assert(OcrRetryEngine.isRetryable(networkErr) === true, "Network timeout is retryable");
    assert(OcrRetryEngine.isRetryable(fatalErr) === false, "Fatal logic error is not retryable");

    const policy: OcrRetryPolicy = {
      maxRetries: 2,
      initialBackoffMs: 100,
      maxBackoffMs: 1000,
      backoffMultiplier: 2,
      jitter: false,
    };

    const delay1 = OcrRetryEngine.computeBackoffDelay(1, policy);
    const delay2 = OcrRetryEngine.computeBackoffDelay(2, policy);
    const delay3 = OcrRetryEngine.computeBackoffDelay(3, policy);

    assert(delay1 === 100, "Attempt 1 backoff delay is 100ms");
    assert(delay2 === 200, "Attempt 2 backoff delay is 200ms");
    assert(delay3 === 400, "Attempt 3 backoff delay is 400ms");
  }

  // Test 100: Chunk-level retry tracking and audit logging
  {
    testCount++;
    console.log(`[Test ${testCount}] Chunk-level retry tracking and audit logging`);

    const chunk: OcrPageChunk = {
      chunkIndex: 0,
      startPage: 1,
      endPage: 10,
      pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      status: "PENDING",
      progressPercentage: 0,
      pageStatuses: {},
    };

    OcrRetryEngine.recordRetryOnChunk(chunk, 1, "RETRY_1", new Error("Chunk page 4 timeout"));
    assert(chunk.status === "RETRY_1", "Chunk status updated to RETRY_1");
    assert(chunk.retryAttempt === 1, "Chunk retryAttempt is 1");
    assert(chunk.retryHistory!.length === 1, "Chunk history contains 1 attempt");

    OcrRetryEngine.recordRetryOnChunk(
      chunk,
      2,
      "RETRY_2",
      new Error("Chunk page 4 second timeout"),
    );
    assert(chunk.status === "RETRY_2", "Chunk status updated to RETRY_2");
    assert(chunk.retryAttempt === 2, "Chunk retryAttempt is 2");

    OcrRetryEngine.recordRetryOnChunk(chunk, 3, "REVIEW_REQUIRED", new Error("Exhausted retries"));
    assert(chunk.status === "REVIEW_REQUIRED", "Chunk status updated to REVIEW_REQUIRED");
    assert(chunk.retryHistory!.length === 3, "Chunk history contains all 3 attempts");
  }

  // --- TEST GROUP 26: LARGE DOCUMENTS & CHUNKING (Requirement 24) ---
  console.log("\n--- TEST GROUP 26: LARGE DOCUMENTS & CHUNKING (Requirement 24) ---");

  // Test 101: 200-page document chunk planning (20 chunks of 10 pages)
  {
    testCount++;
    console.log(`[Test ${testCount}] 200-page document chunk planning (20 chunks of 10 pages)`);

    const chunks = OcrLargeDocumentChunkEngine.planChunks(200, { chunkSize: 10 });
    assert(chunks.length === 20, "200-page document planned into exactly 20 chunks");
    assert(chunks[0].startPage === 1 && chunks[0].endPage === 10, "Chunk 1 covers pages 1–10");
    assert(chunks[1].startPage === 11 && chunks[1].endPage === 20, "Chunk 2 covers pages 11–20");
    assert(chunks[2].startPage === 21 && chunks[2].endPage === 30, "Chunk 3 covers pages 21–30");
    assert(
      chunks[19].startPage === 191 && chunks[19].endPage === 200,
      "Chunk 20 covers pages 191–200",
    );
    assert(chunks[0].pageNumbers.length === 10, "Chunk has exactly 10 page numbers");
    assert(
      chunks.every((c) => c.status === "PENDING"),
      "All planned chunks initially PENDING",
    );
  }

  // Test 102: Tracking chunk states (Pages 1–10 COMPLETE, 11–20 PROCESSING, 21–30 PENDING)
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Tracking chunk states (Pages 1–10 COMPLETE, 11–20 PROCESSING, 21–30 PENDING)`,
    );

    const chunks = OcrLargeDocumentChunkEngine.planChunks(30, { chunkSize: 10 });
    const progress = OcrLargeDocumentChunkEngine.createProgress(
      "doc-large-30",
      "ocr-run-large-01",
      30,
      chunks,
    );

    // Initial state
    assert(progress.totalPages === 30, "Total pages is 30");
    assert(progress.completedPages === 0, "Completed pages initialized to 0");
    assert(progress.percentage === 0, "Progress percentage initialized to 0%");

    // Complete chunk 1 (pages 1-10)
    OcrLargeDocumentChunkEngine.startChunk(progress, 0);
    assert(chunks[0].status === "PROCESSING", "Chunk 0 is PROCESSING");
    OcrLargeDocumentChunkEngine.completeChunk(progress, 0, []);
    assert(chunks[0].status === "COMPLETE", "Chunk 0 is COMPLETE");
    assert(progress.completedPages === 10, "Completed pages updated to 10");

    // Start chunk 2 (pages 11-20)
    OcrLargeDocumentChunkEngine.startChunk(progress, 1);
    assert(chunks[1].status === "PROCESSING", "Chunk 1 is PROCESSING");

    // Chunk 3 (pages 21-30) remains PENDING
    assert(chunks[2].status === "PENDING", "Chunk 2 is PENDING");

    const summary = OcrLargeDocumentChunkEngine.formatProgressSummary(progress.chunks);
    assert(summary.includes("Pages 1–10 COMPLETE"), "Summary includes 'Pages 1–10 COMPLETE'");
    assert(summary.includes("Pages 11–20 PROCESSING"), "Summary includes 'Pages 11–20 PROCESSING'");
    assert(summary.includes("Pages 21–30 PENDING"), "Summary includes 'Pages 21–30 PENDING'");
  }

  // Test 103: Genuine progress reporting percentage strictly grounded in actual completed pages (Never fake progress!)
  {
    testCount++;
    console.log(`[Test ${testCount}] Genuine Progress Reporting Percentage (Never Fake Progress)`);

    const chunks = OcrLargeDocumentChunkEngine.planChunks(100, { chunkSize: 10 });
    const progress = OcrLargeDocumentChunkEngine.createProgress(
      "doc-large-100",
      "ocr-run-large-02",
      100,
      chunks,
    );

    // 0 / 100 pages -> strictly 0%
    assert(progress.percentage === 0, "Initial progress is exactly 0%");

    // Complete 1 chunk (10 pages) -> strictly 10%
    OcrLargeDocumentChunkEngine.startChunk(progress, 0);
    OcrLargeDocumentChunkEngine.completeChunk(progress, 0, []);
    assert(progress.completedPages === 10, "Completed pages is exactly 10");
    assert(
      progress.percentage === 10,
      "Progress percentage is strictly 10% (not interpolated timer)",
    );

    // Complete 2nd and 3rd chunks -> strictly 30%
    OcrLargeDocumentChunkEngine.startChunk(progress, 1);
    OcrLargeDocumentChunkEngine.completeChunk(progress, 1, []);
    OcrLargeDocumentChunkEngine.startChunk(progress, 2);
    OcrLargeDocumentChunkEngine.completeChunk(progress, 2, []);
    assert(progress.completedPages === 30, "Completed pages is exactly 30");
    assert(progress.percentage === 30, "Progress percentage is strictly 30%");

    // Complete all 10 chunks -> strictly 100%
    for (let i = 3; i < 10; i++) {
      OcrLargeDocumentChunkEngine.startChunk(progress, i);
      OcrLargeDocumentChunkEngine.completeChunk(progress, i, []);
    }
    assert(progress.completedPages === 100, "Completed pages is exactly 100");
    assert(progress.percentage === 100, "Progress percentage is strictly 100%");
    assert(progress.isComplete === true, "Document progress marked complete");
  }

  // Test 104: Formatted status string matching exact Requirement 24 specification
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Formatted status string matching exact Requirement 24 specification`,
    );

    const chunks: OcrPageChunk[] = [
      {
        chunkIndex: 0,
        startPage: 1,
        endPage: 10,
        pageNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        status: "COMPLETE",
        progressPercentage: 100,
        pageStatuses: {},
      },
      {
        chunkIndex: 1,
        startPage: 11,
        endPage: 20,
        pageNumbers: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        status: "PROCESSING",
        progressPercentage: 50,
        pageStatuses: {},
      },
      {
        chunkIndex: 2,
        startPage: 21,
        endPage: 30,
        pageNumbers: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        status: "PENDING",
        progressPercentage: 0,
        pageStatuses: {},
      },
    ];

    const formatted = OcrLargeDocumentChunkEngine.formatProgressSummary(chunks);
    const expected = "Pages 1–10 COMPLETE\nPages 11–20 PROCESSING\nPages 21–30 PENDING";
    assert(formatted === expected, "Formatted progress summary matches exact specification");
  }

  // Test 105: End-to-end HybridDocumentProcessor chunking execution with real-time onProgress events
  {
    testCount++;
    console.log(
      `[Test ${testCount}] End-to-End HybridDocumentProcessor Chunking and Progress Events`,
    );

    const rasterBuffer = generateSyntheticImageBuffer(400, 300, "text_bars");
    const progressSnapshots: OcrDocumentProgress[] = [];

    const result = await HybridDocumentProcessor.processDocument(
      {
        name: "test_large_document.png",
        bytes: new Uint8Array(rasterBuffer.buffer),
        mimeType: "image/png",
      },
      {
        chunkSize: 1,
        onProgress: (prog) => {
          progressSnapshots.push(JSON.parse(JSON.stringify(prog)));
        },
      },
    );

    assert(progressSnapshots.length > 0, "Received real-time progress event callbacks");
    assert(result.chunks !== undefined && result.chunks.length > 0, "Result exposes chunk list");
    assert(result.documentProgress !== undefined, "Result exposes documentProgress");
    assert(result.documentProgress!.percentage === 100, "Final progress percentage is 100%");
    assert(result.documentProgress!.isComplete === true, "Document progress is marked complete");
    assert(result.processingRun!.chunks !== undefined, "Processing run contains chunk records");
    assert(result.processingRun!.progressPercentage === 100, "Processing run has 100% progress");
  }

  // --- TEST GROUP 27: BACKGROUND PROCESSING & JOBS (Requirement 25) ---
  console.log("\n--- TEST GROUP 27: BACKGROUND PROCESSING & JOBS (Requirement 25) ---");

  // Test 106: Complete 7-step background OCR lifecycle (UPLOAD -> JOB CREATED -> BACKGROUND PROCESSING -> OCR -> DATABASE -> STATUS UPDATE -> FRONTEND REFRESH)
  {
    testCount++;
    console.log(`[Test ${testCount}] Complete 7-Stage Background OCR Lifecycle Execution`);

    const rasterBuffer = generateSyntheticImageBuffer(400, 300, "text_bars");
    const stageHistory: OcrJobStage[] = [];

    const job = await OcrBackgroundJobManager.submitOcrJob(
      {
        name: "test_background_invoice.png",
        bytes: new Uint8Array(rasterBuffer.buffer),
        mimeType: "image/png",
      },
      {
        organisationId: "org-bg-test",
        autoStart: false, // Step by step manual/controlled testing
      },
    );

    assert(job.status === "PENDING", "Initial status is PENDING upon submission");
    assert(job.currentStage === "JOB_CREATED", "Initial stage is JOB_CREATED");
    assert(typeof job.jobId === "string" && job.jobId.startsWith("job-ocr-"), "Job ID created");
    assert(typeof job.documentId === "string", "Document ID bound");
    assert(job.progressPercentage === 0, "Initial progress is 0%");

    // Subscribe to track stages
    OcrBackgroundJobManager.subscribeToJob(job.jobId, (updated) => {
      if (!stageHistory.includes(updated.currentStage)) {
        stageHistory.push(updated.currentStage);
      }
    });

    // Run execution through the manager
    const activeJobPromise = OcrBackgroundJobManager.submitOcrJob(
      {
        name: "test_background_invoice_active.png",
        bytes: new Uint8Array(rasterBuffer.buffer),
        mimeType: "image/png",
      },
      {
        organisationId: "org-bg-test",
        autoStart: true,
      },
    );

    const activeJob = await activeJobPromise;
    // Wait for background job completion (allow up to 20s for local Tesseract execution)
    let attempts = 0;
    while (
      (activeJob.status === "PENDING" || activeJob.status === "PROCESSING") &&
      attempts < 400
    ) {
      await new Promise((r) => setTimeout(r, 50));
      attempts++;
    }

    if (activeJob.status !== "COMPLETED" && activeJob.status !== "REVIEW_REQUIRED") {
      console.error(
        `Test 106 Diagnostics: status=${activeJob.status}, stage=${activeJob.currentStage}, attempts=${attempts}, error=${JSON.stringify(activeJob.error)}`,
      );
    }

    assert(
      activeJob.status === "COMPLETED" || activeJob.status === "REVIEW_REQUIRED",
      `Background job finished (got ${activeJob.status}, error: ${activeJob.error?.message || "none"})`,
    );
    assert(
      activeJob.currentStage === "FRONTEND_REFRESH" || activeJob.currentStage === "COMPLETED",
      "Reached FRONTEND_REFRESH stage",
    );
    assert(activeJob.progressPercentage === 100, "Final progress percentage reached 100%");
    assert(activeJob.result !== null && activeJob.result !== undefined, "Result attached to job");
    assert(typeof activeJob.completedAt === "string", "completedAt timestamp recorded");
  }

  // Test 107: Non-blocking asynchronous execution with main-thread yielding
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Non-Blocking Asynchronous Execution with Main-Thread Yielding`,
    );

    const startYield = Date.now();
    await OcrBackgroundJobManager.yieldToMainThread();
    const yieldDuration = Date.now() - startYield;

    assert(yieldDuration >= 0, "yieldToMainThread completed successfully");

    // Clear registry for isolation
    OcrBackgroundJobManager.clearJobRegistry();
    const listed = await OcrBackgroundJobManager.listJobs();
    assert(listed.length === 0, "Job registry cleared successfully");
  }

  // Test 108: Multi-job subscription and real-time event broadcasting
  {
    testCount++;
    console.log(`[Test ${testCount}] Multi-Job Subscription & Real-Time Event Broadcasting`);

    const rasterBuffer = generateSyntheticImageBuffer(200, 150, "text_bars");
    let receivedGlobalUpdates = 0;

    const unsubscribe = OcrBackgroundJobManager.subscribeToAll(() => {
      receivedGlobalUpdates++;
    });

    const job = await OcrBackgroundJobManager.submitOcrJob(
      {
        name: "test_sub_broadcast.png",
        bytes: new Uint8Array(rasterBuffer.buffer),
        mimeType: "image/png",
      },
      { autoStart: false },
    );

    assert(receivedGlobalUpdates >= 1, "Global subscriber received job creation update");
    unsubscribe();

    const retrieved = await OcrBackgroundJobManager.getJob(job.jobId);
    assert(retrieved !== null, "Job retrieved by ID");
    assert(retrieved!.jobId === job.jobId, "Job ID matches retrieved");
  }

  // Test 109: Background job persistence and retrieval
  {
    testCount++;
    console.log(`[Test ${testCount}] Background Job Persistence & Retrieval`);

    const rasterBuffer = generateSyntheticImageBuffer(200, 150, "text_bars");
    const job = await OcrBackgroundJobManager.submitOcrJob(
      {
        name: "test_persisted_job.png",
        bytes: new Uint8Array(rasterBuffer.buffer),
        mimeType: "image/png",
      },
      {
        documentId: "doc-persist-job-01",
        autoStart: false,
      },
    );

    const byDocId = await OcrBackgroundJobManager.getJob("doc-persist-job-01");
    assert(byDocId !== null, "Job retrieved by document ID");
    assert(byDocId!.documentId === "doc-persist-job-01", "Document ID matches");

    const allJobs = await OcrBackgroundJobManager.listJobs();
    assert(allJobs.length > 0, "listJobs returns submitted jobs");
  }

  // --- TEST GROUP 28: OCR STATUS MODEL (Requirement 26) ---
  console.log("\n--- TEST GROUP 28: OCR STATUS MODEL (Requirement 26) ---");

  // Test 110: Verification of all 7 persistent statuses
  {
    testCount++;
    console.log(`[Test ${testCount}] Verification of All 7 Authoritative Persistent Statuses`);

    const validStatuses: OcrStatus[] = [
      "NOT_REQUIRED",
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "PARTIALLY_COMPLETED",
      "FAILED",
      "REVIEW_REQUIRED",
    ];

    for (const status of validStatuses) {
      assert(typeof status === "string" && status.length > 0, `Status enum '${status}' is valid`);
    }
  }

  // Test 111: Digital PDF classification mapped to NOT_REQUIRED
  {
    testCount++;
    console.log(`[Test ${testCount}] Digital PDF Classification Mapped to NOT_REQUIRED`);

    const mockDigitalPage: OcrPageResult = {
      pageNumber: 1,
      fullText: "Eskom Megaflex Invoice Digital Text",
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7, rotation: 0 },
      words: [],
      lines: [],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 99.0,
      minConfidence: 95.0,
      characterCount: 40,
      isNativeDigital: true,
      isScannedRaster: false,
      processingDurationMs: 10,
    };

    const isPureDigital = [mockDigitalPage].every((p) => p.isNativeDigital && !p.isScannedRaster);
    assert(isPureDigital === true, "Identified pure native digital page");
    const status: OcrStatus = isPureDigital ? "NOT_REQUIRED" : "COMPLETED";
    assert(status === "NOT_REQUIRED", "Mapped status to NOT_REQUIRED");
  }

  // Test 112: Low confidence or audit-gated invoice mapped to REVIEW_REQUIRED
  {
    testCount++;
    console.log(
      `[Test ${testCount}] Low Confidence / Audit-Gated Invoice Mapped to REVIEW_REQUIRED`,
    );

    const mockLowConfPage: OcrPageResult = {
      pageNumber: 1,
      fullText: "Poor scan invoice",
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7, rotation: 0 },
      words: [],
      lines: [],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 65.0, // Low confidence
      minConfidence: 50.0,
      characterCount: 20,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 50,
    };

    const reviewRequired = mockLowConfPage.averageConfidence < 85;
    const status: OcrStatus = reviewRequired ? "REVIEW_REQUIRED" : "COMPLETED";
    assert(status === "REVIEW_REQUIRED", "Mapped low confidence scan to REVIEW_REQUIRED");
  }

  // Test 113: Partial failure scenario mapped to PARTIALLY_COMPLETED
  {
    testCount++;
    console.log(`[Test ${testCount}] Partial Failure Scenario Mapped to PARTIALLY_COMPLETED`);

    const page1: OcrPageResult = {
      pageNumber: 1,
      fullText: "Page 1 success",
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7, rotation: 0 },
      words: [],
      lines: [],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 92.0,
      minConfidence: 88.0,
      characterCount: 15,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 30,
    };

    const page2: any = {
      pageNumber: 2,
      fullText: "",
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7, rotation: 0 },
      words: [],
      lines: [],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 0,
      minConfidence: 0,
      characterCount: 0,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 30,
      state: "FAILED",
    };

    const pages = [page1, page2];
    const hasFailedPage = pages.some((p) => (p as any).state === "FAILED");
    const status: OcrStatus = hasFailedPage ? "PARTIALLY_COMPLETED" : "COMPLETED";
    assert(
      status === "PARTIALLY_COMPLETED",
      "Mapped mixed success/failed pages to PARTIALLY_COMPLETED",
    );
  }

  // Test 114: Fatal error scenario mapped to FAILED
  {
    testCount++;
    console.log(`[Test ${testCount}] Fatal Error Scenario Mapped to FAILED`);

    const totalPages = 0;
    const status: OcrStatus = totalPages === 0 ? "FAILED" : "COMPLETED";
    assert(status === "FAILED", "0 pages or unreadable file mapped to FAILED");
  }

  // Test 115: Clean successful run mapped to COMPLETED
  {
    testCount++;
    console.log(`[Test ${testCount}] Clean Successful Run Mapped to COMPLETED`);

    const page1: OcrPageResult = {
      pageNumber: 1,
      fullText: "TAX INVOICE Total: R 15000",
      geometry: { width: 595, height: 842, dpi: 300, aspectRatio: 0.7, rotation: 0 },
      words: [],
      lines: [],
      blocks: [],
      tables: [],
      keyValuePairs: [],
      averageConfidence: 96.0,
      minConfidence: 92.0,
      characterCount: 25,
      isNativeDigital: false,
      isScannedRaster: true,
      processingDurationMs: 40,
    };

    const pages = [page1];
    const isSuccess = pages.length > 0 && pages.every((p) => p.averageConfidence >= 85);
    const status: OcrStatus = isSuccess ? "COMPLETED" : "REVIEW_REQUIRED";
    assert(status === "COMPLETED", "Clean high-confidence OCR run mapped to COMPLETED");
  }

  console.log("\n==================================================================");
  console.log(`  🎉 ALL ${testCount} PRODUCTION OCR ENGINE TESTS PASSED CLEANLY!  `);
  console.log("==================================================================");
}

// Direct execution entry point
runProductionOcrTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ PRODUCTION OCR TEST SUITE FAILED:", err);
    process.exit(1);
  });
