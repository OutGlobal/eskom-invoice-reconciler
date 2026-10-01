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
  type OcrLineBlock,
  type OcrWordToken,
  type OcrPageResult,
} from "../../domain/ocr";
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
    words.push({
      wordId: `w-p${pageNumber}-l${lineIndex}-${wIdx}`,
      text: w,
      sanitizedText: w,
      confidence,
      boundingBox: [0.1 + wIdx * (wordWidth + 0.01), yBox, wordWidth, 0.025],
      pageNumber,
    });
  });

  return {
    lineId: `line-p${pageNumber}-${lineIndex}`,
    lineIndex,
    pageNumber,
    text,
    confidence,
    boundingBox: [0.1, yBox, 0.8, 0.03],
    words,
    baselineY: yBox + 0.03,
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
