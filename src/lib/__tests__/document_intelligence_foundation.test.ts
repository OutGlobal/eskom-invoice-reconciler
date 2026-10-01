/**
 * Document Intelligence Foundation Test Suite
 * ========================================================
 * Tests the complete 10-Stage Architecture:
 * 1. UPLOAD
 * 2. STORAGE
 * 3. DOCUMENT REGISTRY
 * 4. PDF INSPECTION
 * 5. PAGE EXTRACTION
 * 6. TEXT EXTRACTION
 * 7. LAYOUT ANALYSIS
 * 8. DOCUMENT CLASSIFICATION
 * 9. EXTRACTION EVIDENCE
 * 10. OCR/AI HANDOFF (Stops before OCR/AI execution)
 */

import { describe, expect, it } from "vitest";
import {
  DocumentIntelligencePipeline,
  PdfInspectionEngine,
  PageExtractionEngine,
  TextExtractionEngine,
  LayoutAnalysisEngine,
  DocumentClassifier,
  EvidenceRegistryEngine,
  DocumentLifecycleManager,
  DocumentLifecycleTransitionError,
} from "../../domain/intelligence";

describe("Document Intelligence Foundation — 10-Stage Architecture Suite", () => {
  const TEST_ORG_ID = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c";

  // Synthesize realistic representative Eskom Megaflex PDF document bytes
  const createMockPdfBytes = (content: string, version = "1.7", encrypted = false): Uint8Array => {
    let pdfStr = `%PDF-${version}\n`;
    if (encrypted) {
      pdfStr += "1 0 obj\n<< /Filter /Standard /V 2 /R 3 /Length 128 >>\nendobj\n";
    }

    const streamCommands = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l, i) => `1 0 0 1 72 ${780 - i * 16} Tm (${l.replace(/[()\\]/g, "\\$&")}) Tj`)
      .join("\n");

    pdfStr += `
2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
3 0 obj
<< /Type /Pages /Kids [4 0 R 5 0 R] /Count 2 >>
endobj
8 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
4 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 8 0 R >> >> /Contents 6 0 R >>
endobj
5 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 8 0 R >> >> /Contents 7 0 R >>
endobj
6 0 obj
<< /Length ${streamCommands.length + 50} >>
stream
BT
/F1 12 Tf
${streamCommands}
ET
endstream
endobj
7 0 obj
<< /Length 200 >>
stream
BT
/F1 10 Tf
1 0 0 1 72 750 Tm (Annexure Remittance Advice and Terms of Electricity Supply) Tj
ET
endstream
endobj
trailer
<< /Root 2 0 R /Info << /Title (Eskom Monthly Electricity Account) /Producer (Eskom Billing Systems v9.2) >> ${encrypted ? "/Encrypt 1 0 R" : ""} >>
%%EOF`;
    return new TextEncoder().encode(pdfStr);
  };

  const sampleMegaflexContent = `
Eskom Holdings SOC Ltd
TAX INVOICE
Account Number: 7854321098
Tax Invoice Number: INV-2026-004521
Customer Name: APEX HEAVY INDUSTRIES (PTY) LTD
VAT Registration: 4740101508
Invoice Date: 2026-02-05
Billing Period: 2026-01-01 to 2026-01-31
Supply Location: SITE-CPT-01 Western Cape
Tariff Name: Megaflex High Voltage Transmission
Meter Number: MTR-778899

Description Consumption / Demand Rate Amount (R)
Peak Energy Consumption 245000 kWh 184.25 c/kWh R 451,412.50
Standard Energy Consumption 480000 kWh 118.50 c/kWh R 568,800.00
Off-Peak Energy Consumption 610000 kWh 76.20 c/kWh R 464,820.00
Total Active Energy 1335000 kWh
Maximum Demand 3450 kVA 95.50 R/kVA R 329,475.00
Excess Reactive Energy 12500 kvarh 15.20 c/kvarh R 1,900.00
Network Capacity Charge 3450 kVA 45.20 R/kVA R 155,940.00
Subtotal Charges R 1,972,347.50
Value Added Tax (15%) R 295,852.13
Total Amount Due R 2,268,199.63
`;

  it("Stage 4: PDF Inspection validates version, header, trailer, and encryption checks", () => {
    const validBytes = createMockPdfBytes(sampleMegaflexContent, "1.7", false);
    const inspection = PdfInspectionEngine.inspectPdf(validBytes);

    expect(inspection.integrityValid).toBe(true);
    expect(inspection.pdfVersion).toBe("1.7");
    expect(inspection.isEncrypted).toBe(false);
    expect(inspection.pageCount).toBe(2);
    expect(inspection.hasEmbeddedText).toBe(true);
    expect(inspection.isScannedLikely).toBe(false);
    expect(inspection.metadata.producer).toBe("Eskom Billing Systems v9.2");

    // Test Encrypted Document Detection
    const encryptedBytes = createMockPdfBytes(sampleMegaflexContent, "1.4", true);
    const encryptedInspection = PdfInspectionEngine.inspectPdf(encryptedBytes);
    expect(encryptedInspection.isEncrypted).toBe(true);
  });

  it("Stage 5: Page Extraction determines geometry, aspect ratio, and digital status", async () => {
    const bytes = createMockPdfBytes(sampleMegaflexContent);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);

    expect(pages.length).toBeGreaterThanOrEqual(1);
    const p1 = pages[0];
    expect(p1.pageNumber).toBe(1);
    expect(p1.dimensions.width).toBe(595);
    expect(p1.dimensions.height).toBe(842);
    expect(p1.dimensions.aspectRatio).toBeCloseTo(0.707, 2);
    expect(p1.hasText).toBe(true);
    expect(p1.isScanned).toBe(false);
  });

  it("Stage 6: Text Extraction extracts positional tokens and performs baseline line clustering", async () => {
    const bytes = createMockPdfBytes(sampleMegaflexContent);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const lines = await TextExtractionEngine.extractTextLines(bytes, pages);

    expect(lines.length).toBeGreaterThan(5);
    const hasAccountLine = lines.some((l) => l.text.includes("Account Number") || l.text.includes("7854321098"));
    expect(hasAccountLine).toBe(true);

    // Verify bounding box structure [x, y, w, h]
    for (const line of lines) {
      expect(line.bbox).toHaveLength(4);
      expect(line.bbox[0]).toBeGreaterThanOrEqual(0);
      expect(line.bbox[1]).toBeGreaterThanOrEqual(0);
      expect(line.bbox[2]).toBeGreaterThan(0);
      expect(line.bbox[3]).toBeGreaterThan(0);
    }
  });

  it("Stage 7: Layout Analysis detects structural blocks, tables, and key-values", async () => {
    const bytes = createMockPdfBytes(sampleMegaflexContent);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const lines = await TextExtractionEngine.extractTextLines(bytes, pages);
    const layouts = LayoutAnalysisEngine.analyzeLayout(pages, lines);

    expect(layouts.length).toBeGreaterThanOrEqual(1);
    const l1 = layouts[0];
    expect(l1.blocks.length).toBeGreaterThan(0);

    // Verify Key-Value properties were identified
    const accProp = l1.keyValues.find((kv) => kv.propertyKey === "account_number");
    expect(accProp).toBeDefined();
    expect(accProp?.rawValue).toBe("7854321098");
    expect(accProp?.valueBbox).toHaveLength(4);

    // Verify Tabular structures were detected
    expect(l1.tables.length).toBeGreaterThanOrEqual(1);
    const mainTable = l1.tables[0];
    expect(mainTable.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("Stage 8: Document Classification identifies Eskom Megaflex and categorizes sections", async () => {
    const bytes = createMockPdfBytes(sampleMegaflexContent);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const lines = await TextExtractionEngine.extractTextLines(bytes, pages);
    const classification = DocumentClassifier.classifyDocument(pages, lines);

    expect(["UTILITY_INVOICE", "ESKOM_MEGAFLEX_INVOICE"]).toContain(classification.category);
    expect(classification.tariffName).toBe("Megaflex");
    expect(classification.confidence).toBeGreaterThanOrEqual(0.85);
    expect(classification.pageClassifications.length).toBe(pages.length);

    // Page 1 should be categorized as Tax Invoice Header or Line Items
    const p1Class = classification.pageClassifications[0];
    expect([
      "PAGE_TAX_INVOICE_HEADER",
      "PAGE_LINE_ITEM_BREAKDOWN",
    ]).toContain(p1Class.classification);
  });

  it("Stage 9: Extraction Evidence produces grounded determinants with coordinate bounding boxes", async () => {
    const bytes = createMockPdfBytes(sampleMegaflexContent);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const lines = await TextExtractionEngine.extractTextLines(bytes, pages);
    const layouts = LayoutAnalysisEngine.analyzeLayout(pages, lines);
    const evidence = EvidenceRegistryEngine.compileEvidence(pages, lines, layouts);

    expect(evidence.length).toBeGreaterThan(5);

    const peakEvidence = evidence.find((e) => e.fieldKey === "peak_kwh");
    expect(peakEvidence).toBeDefined();
    expect(peakEvidence?.normalizedValue).toBe(245000);
    expect(peakEvidence?.unit).toBe("kWh");
    expect(peakEvidence?.bbox).toHaveLength(4);
    expect(peakEvidence?.contextSnippet.length).toBeGreaterThan(0);

    const totalDueEvidence = evidence.find((e) => e.fieldKey === "total_invoice_zar" || e.fieldKey === "total_due");
    expect(totalDueEvidence).toBeDefined();
    expect(totalDueEvidence?.normalizedValue).toBe(2268199.63);
  });

  it("Stage 10 & Full Pipeline: Executes all 10 stages end-to-end and preps OCR/AI handoff plan", async () => {
    const bytes = createMockPdfBytes(sampleMegaflexContent);
    const progressTrack: string[] = [];

    const pkg = await DocumentIntelligencePipeline.processDocument(
      bytes,
      "eskom_jan_2026_megaflex.pdf",
      TEST_ORG_ID,
      {
        skipStorageUpload: true,
        onProgress: (stage) => progressTrack.push(stage),
      }
    );

    // Verify all 10 stages fired in sequential order
    expect(progressTrack).toEqual([
      "UPLOAD",
      "STORAGE",
      "DOCUMENT_REGISTRY",
      "PDF_INSPECTION",
      "PAGE_EXTRACTION",
      "TEXT_EXTRACTION",
      "LAYOUT_ANALYSIS",
      "DOCUMENT_CLASSIFICATION",
      "EXTRACTION_EVIDENCE",
      "OCR_AI_HANDOFF",
    ]);

    // Verify package contents and lifecycle state
    expect(pkg.lifecycleState).toBe("READY_FOR_VALIDATION");
    expect(pkg.document.status).toBe("READY_FOR_VALIDATION");
    expect(pkg.document.state).toBe("READY_FOR_VALIDATION");
    expect(pkg.document.fileHashSha256).toMatch(/^[a-f0-9]{64}$|^sha256_/);
    expect(pkg.inspection.hasEmbeddedText).toBe(true);
    expect(["UTILITY_INVOICE", "ESKOM_MEGAFLEX_INVOICE"]).toContain(pkg.classification.category);

    // Verify persisted state transitions
    expect(pkg.stateTransitions.length).toBeGreaterThanOrEqual(6);
    const transitionStates = pkg.stateTransitions.map((t) => t.toState);
    expect(transitionStates).toEqual([
      "UPLOADED",
      "STORED",
      "INSPECTING",
      "EXTRACTING",
      "CLASSIFYING",
      "READY_FOR_VALIDATION",
    ]);

    // Verify transition metadata and audit fields
    for (const transition of pkg.stateTransitions) {
      expect(transition.transitionId).toBeDefined();
      expect(transition.documentId).toBe(pkg.document.documentId);
      expect(transition.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(transition.triggeredBy.length).toBeGreaterThan(0);
    }

    // Verify OCR Handoff Plan
    expect(pkg.handoff.ocrPlan.needsOcr).toBe(false); // Digital document does not need visual OCR
    expect(pkg.handoff.ocrPlan.recommendedEngine).toBe("NATIVE_PDF_TEXT_PASSTHROUGH");

    // Verify AI Validation Payload (Prepared without making AI calls)
    expect(pkg.handoff.aiValidationPayload.readyForValidation).toBe(true);
    expect(pkg.handoff.aiValidationPayload.determinants.accountNumber).toBe("7854321098");
    expect(pkg.handoff.aiValidationPayload.determinants.peakKwh).toBe(245000);
    expect(pkg.handoff.aiValidationPayload.determinants.totalInvoiceAmountZar).toBe(2268199.63);
    expect(pkg.processingDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("OCR Handoff Strategy flags scanned/raster PDFs for downstream Tesseract processing", async () => {
    // Generate minimal non-textual PDF (simulates raster image/scanned PDF)
    const scannedPdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Img1 4 0 R >> >> >>\nendobj\n4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1000 /Height 1400 /ColorSpace /DeviceRGB /BitsPerComponent 8 >>\nstream\n[RAW_IMAGE_BYTES]\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
    const scannedBytes = new TextEncoder().encode(scannedPdf);

    const pkg = await DocumentIntelligencePipeline.processDocument(
      scannedBytes,
      "scanned_eskom_scan.pdf",
      TEST_ORG_ID,
      { skipStorageUpload: true }
    );

    // Scanned document must be flagged for OCR handoff and enter REVIEW_REQUIRED
    expect(pkg.handoff.ocrPlan.needsOcr).toBe(true);
    expect(pkg.handoff.ocrPlan.recommendedEngine).toBe("TESSERACT_OCR");
    expect(pkg.handoff.ocrPlan.scannedPageIndices).toContain(1);
    expect(pkg.lifecycleState).toBe("REVIEW_REQUIRED");
    expect(pkg.document.state).toBe("REVIEW_REQUIRED");
  });

  describe("Stage 1: Document Lifecycle State Machine & Persistence Suite", () => {
    it("Enforces valid transition paths and rejects illegal state jumps", async () => {
      const testDocId = crypto.randomUUID();

      // INITIAL -> UPLOADED is valid
      expect(DocumentLifecycleManager.canTransition(null, "UPLOADED")).toBe(true);
      await DocumentLifecycleManager.transition({
        documentId: testDocId,
        toState: "UPLOADED",
        triggeredBy: "TEST",
        reason: "Test initial upload",
      });
      expect(DocumentLifecycleManager.getCurrentState(testDocId)).toBe("UPLOADED");

      // UPLOADED -> STORED is valid
      expect(DocumentLifecycleManager.canTransition("UPLOADED", "STORED")).toBe(true);
      await DocumentLifecycleManager.transition({
        documentId: testDocId,
        toState: "STORED",
        triggeredBy: "TEST",
      });
      expect(DocumentLifecycleManager.getCurrentState(testDocId)).toBe("STORED");

      // STORED -> READY_FOR_VALIDATION is ILLEGAL (cannot skip inspecting, extracting, classifying)
      expect(DocumentLifecycleManager.canTransition("STORED", "READY_FOR_VALIDATION")).toBe(false);
      await expect(
        DocumentLifecycleManager.transition({
          documentId: testDocId,
          toState: "READY_FOR_VALIDATION",
          triggeredBy: "TEST_ILLEGAL",
        })
      ).rejects.toThrow(DocumentLifecycleTransitionError);

      // Transition history must still only contain UPLOADED and STORED
      const history = DocumentLifecycleManager.getTransitionHistory(testDocId);
      expect(history).toHaveLength(2);
      expect(history.map((h) => h.toState)).toEqual(["UPLOADED", "STORED"]);
    });

    it("Persists transition metadata, reasons, and stage associations immutably", async () => {
      const docId = crypto.randomUUID();

      await DocumentLifecycleManager.transition({
        documentId: docId,
        organisationId: TEST_ORG_ID,
        toState: "UPLOADED",
        triggeredBy: "UNIT_TEST",
        stage: "UPLOAD",
        reason: "File received with valid SHA-256",
        metadata: { byteLength: 1048576, checksum: "sha256_abcdef123456" },
      });

      await DocumentLifecycleManager.transition({
        documentId: docId,
        organisationId: TEST_ORG_ID,
        toState: "STORED",
        triggeredBy: "UNIT_TEST",
        stage: "STORAGE",
        reason: "Saved to tenant bucket",
      });

      await DocumentLifecycleManager.transition({
        documentId: docId,
        organisationId: TEST_ORG_ID,
        toState: "INSPECTING",
        triggeredBy: "UNIT_TEST",
        stage: "PDF_INSPECTION",
        reason: "Inspecting PDF headers and version",
      });

      const history = DocumentLifecycleManager.getTransitionHistory(docId);
      expect(history).toHaveLength(3);

      expect(history[0].fromState).toBeNull();
      expect(history[0].toState).toBe("UPLOADED");
      expect(history[0].stage).toBe("UPLOAD");
      expect(history[0].metadata?.byteLength).toBe(1048576);

      expect(history[1].fromState).toBe("UPLOADED");
      expect(history[1].toState).toBe("STORED");

      expect(history[2].fromState).toBe("STORED");
      expect(history[2].toState).toBe("INSPECTING");
    });

    it("Transitions corrupted files to FAILED with explicit error details", async () => {
      const corruptBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);

      await expect(
        DocumentIntelligencePipeline.processDocument(
          corruptBytes,
          "corrupted_document.pdf",
          TEST_ORG_ID,
          { skipStorageUpload: true }
        )
      ).rejects.toThrow(/PDF inspection failed/);
    });

    it("Transitions non-utility documents honestly to UNSUPPORTED without pretending success", async () => {
      const nonUtilityContent = `
        Recipe Book 2026
        Ingredients:
        - 2 cups of flour
        - 1 cup of sugar
        - 3 eggs
        Bake at 180 degrees Celsius for 45 minutes.
      `;
      const nonUtilityBytes = createMockPdfBytes(nonUtilityContent);

      const pkg = await DocumentIntelligencePipeline.processDocument(
        nonUtilityBytes,
        "chocolate_cake_recipe.pdf",
        TEST_ORG_ID,
        { skipStorageUpload: true }
      );

      // The frontend / pipeline must NEVER pretend that processing succeeded for an unsupported file!
      expect(pkg.lifecycleState).toBe("UNSUPPORTED");
      expect(pkg.document.state).toBe("UNSUPPORTED");
      expect(pkg.document.unsupportedReason).toContain("not a recognized Eskom or municipal utility invoice");

      const finalTransition = pkg.stateTransitions[pkg.stateTransitions.length - 1];
      expect(finalTransition.toState).toBe("UNSUPPORTED");
      expect(finalTransition.reason).toContain("not a recognized");
    });

    it("Provides human-readable labels and color tokens for transparent frontend status display", () => {
      expect(DocumentLifecycleManager.getStateLabel("UPLOADED")).toBe("Uploaded");
      expect(DocumentLifecycleManager.getStateLabel("STORED")).toBe("Stored");
      expect(DocumentLifecycleManager.getStateLabel("INSPECTING")).toBe("Inspecting PDF");
      expect(DocumentLifecycleManager.getStateLabel("EXTRACTING")).toBe("Extracting Content");
      expect(DocumentLifecycleManager.getStateLabel("CLASSIFYING")).toBe("Classifying Document");
      expect(DocumentLifecycleManager.getStateLabel("READY_FOR_VALIDATION")).toBe("Ready for Validation");
      expect(DocumentLifecycleManager.getStateLabel("REVIEW_REQUIRED")).toBe("Review Required");
      expect(DocumentLifecycleManager.getStateLabel("UNSUPPORTED")).toBe("Unsupported Format");
      expect(DocumentLifecycleManager.getStateLabel("FAILED")).toBe("Processing Failed");

      // Verify color tokens prevent green success badges on attention/failure states
      expect(DocumentLifecycleManager.getStateColor("REVIEW_REQUIRED").badgeClass).toContain("text-amber-400");
      expect(DocumentLifecycleManager.getStateColor("UNSUPPORTED").badgeClass).toContain("text-zinc-300");
      expect(DocumentLifecycleManager.getStateColor("FAILED").badgeClass).toContain("text-rose-400");
      expect(DocumentLifecycleManager.getStateColor("READY_FOR_VALIDATION").badgeClass).toContain("text-emerald-400");
    });
  });
});
