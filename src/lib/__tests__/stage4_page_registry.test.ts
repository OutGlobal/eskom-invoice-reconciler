/**
 * STAGE 4 — PAGE REGISTRY TEST SUITE
 * ========================================================
 * Validates persistent page-level information:
 *
 * 1. Traceability to Parent Document:
 *    - Each page is linked via document_id to parent document (uploads.id)
 *    - Sequential page indexing (1-based)
 *    - Multi-tenant boundary isolation
 *
 * 2. Capture of all 10 Mandated Attributes:
 *    - document ID
 *    - page number
 *    - page dimensions (width, height, aspect ratio, rotation, unit)
 *    - extracted text
 *    - extraction method (PDF_TEXT_STREAM, TESSERACT_OCR, LAYOUT_TABLE_CELL, etc.)
 *    - OCR required
 *    - OCR status
 *    - processing timestamp
 *    - layout information (layout blocks, detected tables, key-values)
 *    - extraction confidence
 *
 * 3. Answering ENERA Validation:
 *    "Where did this value come from?"
 *    - Exact page number
 *    - Coordinate bounding box (BBox)
 *    - Context snippet & field key
 *    - Extraction method and confidence
 *
 * 4. End-to-End Intelligence Pipeline Integration
 * 5. Database Schema & Migration Verification
 */

import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PageRegistryService,
  DocumentIntelligencePipeline,
  type PageRegistryRecord,
} from "../../domain/intelligence";
import { LocalWorkspaceStore } from "../localWorkspaceStore";

describe("Stage 4 — Persistent Page Registry Architecture Suite", () => {
  const TEST_DOC_A = "11111111-1111-4111-8111-111111111111";
  const TEST_DOC_B = "22222222-2222-4222-8222-222222222222";
  const TEST_ORG_A = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c";
  const TEST_ORG_B = "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d";

  beforeEach(() => {
    PageRegistryService.resetMemoryStore();
  });

  // Synthesize realistic Eskom Megaflex PDF document bytes
  const createMockPdfBytes = (content: string): Uint8Array => {
    const streamCommands = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l, i) => `1 0 0 1 72 ${780 - i * 18} Tm (${l.replace(/[()\\]/g, "\\$&")}) Tj`)
      .join("\n");

    const pdfStr = `%PDF-1.7
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
/F1 12 Tf
1 0 0 1 72 750 Tm (Eskom Electricity Tax Invoice Page 2 Breakdown) Tj
1 0 0 1 72 720 Tm (Total Active Energy Consumption: 1,452,300 kWh) Tj
ET
endstream
endobj
xref
0 9
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000179 00000 n 
0000000295 00000 n 
0000000411 00000 n 
0000000600 00000 n 
0000000850 00000 n 
trailer
<< /Size 9 /Root 2 0 R >>
startxref
1000
%%EOF`;

    return new TextEncoder().encode(pdfStr);
  };

  // =========================================================================
  // 1. Traceability to Parent Document
  // =========================================================================
  describe("1. Traceability to Parent Document", () => {
    it("strictly associates each page record with its parent document ID", async () => {
      const page1: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        organisationId: TEST_ORG_A,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "ESKOM HOLDINGS SOC LTD\nTAX INVOICE\nAccount Number: 0123456789",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 0.99,
      };

      const page2: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        organisationId: TEST_ORG_A,
        pageNumber: 2,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "Energy consumption breakdown: Peak 45,000 kWh",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 0.98,
      };

      await PageRegistryService.registerPage(page1);
      await PageRegistryService.registerPage(page2);

      const retrievedPages = await PageRegistryService.listPagesForDocument(TEST_DOC_A);
      expect(retrievedPages).toHaveLength(2);
      expect(retrievedPages[0].documentId).toBe(TEST_DOC_A);
      expect(retrievedPages[0].pageNumber).toBe(1);
      expect(retrievedPages[1].documentId).toBe(TEST_DOC_A);
      expect(retrievedPages[1].pageNumber).toBe(2);
    });

    it("maintains strict partition between different parent documents", async () => {
      const pageDocA: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        organisationId: TEST_ORG_A,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "Document A Page 1",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 1.0,
      };

      const pageDocB: PageRegistryRecord = {
        documentId: TEST_DOC_B,
        organisationId: TEST_ORG_B,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "Document B Page 1",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 1.0,
      };

      await PageRegistryService.registerPage(pageDocA);
      await PageRegistryService.registerPage(pageDocB);

      const pagesA = await PageRegistryService.listPagesForDocument(TEST_DOC_A);
      const pagesB = await PageRegistryService.listPagesForDocument(TEST_DOC_B);

      expect(pagesA).toHaveLength(1);
      expect(pagesA[0].extractedText).toBe("Document A Page 1");
      expect(pagesB).toHaveLength(1);
      expect(pagesB[0].extractedText).toBe("Document B Page 1");
    });

    it("enforces multi-tenant isolation when filtering by organisation ID", async () => {
      const pageOrgA: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        organisationId: TEST_ORG_A,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "Tenant A Confidential Data",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 1.0,
      };

      await PageRegistryService.registerPage(pageOrgA);

      // Querying with matching tenant returns the page
      const matching = await PageRegistryService.listPagesForDocument(TEST_DOC_A, TEST_ORG_A);
      expect(matching).toHaveLength(1);

      // Querying with foreign tenant returns empty array
      const nonMatching = await PageRegistryService.listPagesForDocument(TEST_DOC_A, TEST_ORG_B);
      expect(nonMatching).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. Capture of All 10 Stage 4 Mandated Attributes
  // =========================================================================
  describe("2. Capture of All 10 Stage 4 Mandated Attributes", () => {
    it("captures every one of the 10 mandated page attributes with high fidelity", async () => {
      const now = new Date().toISOString();
      const mockRecord: PageRegistryRecord = {
        // 1. document ID
        documentId: TEST_DOC_A,
        // 2. page number
        pageNumber: 1,
        // 3. page dimensions
        dimensions: {
          width: 595.28,
          height: 841.89,
          aspectRatio: 0.7071,
          rotation: 0,
          unit: "pt",
        },
        // 4. extracted text
        extractedText: "Eskom Holdings SOC Ltd\nMegaflex Electricity Invoice\nAccount: 0712345678",
        // 5. extraction method
        extractionMethod: "PDF_TEXT_STREAM",
        // 6. OCR required
        ocrRequired: false,
        // 7. OCR status
        ocrStatus: "NOT_REQUIRED",
        // 8. processing timestamp
        processingTimestamp: now,
        // 9. layout information
        layoutInformation: {
          pageNumber: 1,
          blocks: [
            {
              blockId: "blk_1",
              pageNumber: 1,
              type: "HEADER",
              bbox: [50, 50, 400, 80],
              text: "Eskom Holdings SOC Ltd",
              confidence: 0.98,
            },
          ],
          tables: [],
          keyValues: [
            {
              propertyKey: "account_number",
              rawLabel: "Account",
              rawValue: "0712345678",
              confidence: 0.99,
              pageNumber: 1,
              labelBbox: [50, 100, 120, 115],
              valueBbox: [130, 100, 240, 115],
            },
          ],
        },
        // 10. extraction confidence
        extractionConfidence: 0.985,

        // Additional provenance properties
        characterCount: 65,
        tokenCount: 8,
        hasText: true,
        hasImages: false,
        imageCount: 0,
        isScanned: false,
        orientation: "PORTRAIT",
      };

      const registered = await PageRegistryService.registerPage(mockRecord);

      // Verify all 10 fields are present and valid
      expect(registered.documentId).toBe(TEST_DOC_A);
      expect(registered.pageNumber).toBe(1);
      expect(registered.dimensions.width).toBeCloseTo(595.28, 1);
      expect(registered.dimensions.height).toBeCloseTo(841.89, 1);
      expect(registered.dimensions.aspectRatio).toBeCloseTo(0.7071, 3);
      expect(registered.dimensions.unit).toBe("pt");
      expect(registered.extractedText).toContain("Megaflex Electricity Invoice");
      expect(registered.extractionMethod).toBe("PDF_TEXT_STREAM");
      expect(registered.ocrRequired).toBe(false);
      expect(registered.ocrStatus).toBe("NOT_REQUIRED");
      expect(registered.processingTimestamp).toBe(now);
      expect(registered.layoutInformation).toBeDefined();
      expect(registered.extractionConfidence).toBe(0.985);
    });

    it("correctly models scanned pages requiring OCR handoff", async () => {
      const scannedRecord: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        pageNumber: 3,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "",
        extractionMethod: "TESSERACT_OCR",
        ocrRequired: true,
        ocrStatus: "QUEUED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: { blocks: [], tables: [], keyValues: [] },
        extractionConfidence: 0.65,
        isScanned: true,
        hasText: false,
        characterCount: 0,
      };

      const registered = await PageRegistryService.registerPage(scannedRecord);
      expect(registered.ocrRequired).toBe(true);
      expect(registered.ocrStatus).toBe("QUEUED");
      expect(registered.extractionMethod).toBe("TESSERACT_OCR");
      expect(registered.isScanned).toBe(true);
      expect(registered.hasText).toBe(false);
    });
  });

  // =========================================================================
  // 3. Answering ENERA Validation: "Where did this value come from?"
  // =========================================================================
  describe("3. Provenance Resolution: 'Where did this value come from?'", () => {
    beforeEach(async () => {
      // Setup a realistic 2-page document with rich layout, tables, and key-values
      const page1: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        organisationId: TEST_ORG_A,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText:
          "ESKOM HOLDINGS SOC LTD\nTAX INVOICE\nAccount Number: 0123456789\nInvoice Number: INV-987654\nTotal Amount Due: R 1,842,910.45",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        extractionConfidence: 0.99,
        keyValues: [
          {
            propertyKey: "account_number",
            rawLabel: "Account Number",
            rawValue: "0123456789",
            confidence: 0.99,
            pageNumber: 1,
            labelBbox: [50, 100, 150, 115],
            valueBbox: [160, 100, 260, 115],
          },
          {
            propertyKey: "invoice_number",
            rawLabel: "Invoice Number",
            rawValue: "INV-987654",
            confidence: 0.99,
            pageNumber: 1,
            labelBbox: [50, 120, 150, 135],
            valueBbox: [160, 120, 260, 135],
          },
          {
            propertyKey: "total_due",
            rawLabel: "Total Amount Due",
            rawValue: "R 1,842,910.45",
            confidence: 0.98,
            pageNumber: 1,
            labelBbox: [300, 700, 420, 720],
            valueBbox: [430, 700, 550, 720],
          },
        ],
        layoutBlocks: [
          {
            blockId: "hdr_1",
            pageNumber: 1,
            type: "HEADER",
            bbox: [50, 40, 300, 70],
            text: "ESKOM HOLDINGS SOC LTD",
            confidence: 0.99,
          },
        ],
      };

      const page2: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        organisationId: TEST_ORG_A,
        pageNumber: 2,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "DETAILED CONSUMPTION BREAKDOWN\nPeak Energy kWh: 452,300",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        extractionConfidence: 0.98,
        detectedTables: [
          {
            tableId: "tbl_consumption_1",
            pageNumber: 2,
            bbox: [50, 150, 545, 400],
            title: "Energy Consumption Breakdown",
            confidence: 0.97,
            rows: [
              {
                rowIndex: 0,
                isHeader: true,
                cells: [
                  {
                    rowIndex: 0,
                    colIndex: 0,
                    text: "Period",
                    bbox: [50, 150, 150, 170],
                    confidence: 0.99,
                  },
                  {
                    rowIndex: 0,
                    colIndex: 1,
                    text: "Consumption (kWh)",
                    bbox: [160, 150, 300, 170],
                    confidence: 0.99,
                  },
                  {
                    rowIndex: 0,
                    colIndex: 2,
                    text: "Rate (c/kWh)",
                    bbox: [310, 150, 420, 170],
                    confidence: 0.99,
                  },
                  {
                    rowIndex: 0,
                    colIndex: 3,
                    text: "Total (R)",
                    bbox: [430, 150, 545, 170],
                    confidence: 0.99,
                  },
                ],
              },
              {
                rowIndex: 1,
                isHeader: false,
                cells: [
                  {
                    rowIndex: 1,
                    colIndex: 0,
                    text: "Peak",
                    bbox: [50, 175, 150, 195],
                    confidence: 0.98,
                  },
                  {
                    rowIndex: 1,
                    colIndex: 1,
                    text: "452,300",
                    bbox: [160, 175, 300, 195],
                    confidence: 0.99,
                  },
                  {
                    rowIndex: 1,
                    colIndex: 2,
                    text: "354.21",
                    bbox: [310, 175, 420, 195],
                    confidence: 0.97,
                  },
                  {
                    rowIndex: 1,
                    colIndex: 3,
                    text: "1,602,091.83",
                    bbox: [430, 175, 545, 195],
                    confidence: 0.98,
                  },
                ],
              },
            ],
          },
        ],
      };

      await PageRegistryService.registerPage(page1);
      await PageRegistryService.registerPage(page2);
    });

    it("pinpoints exact page number, bounding box, and field key for key-value pairs", async () => {
      // Query: Where did account number 0123456789 come from?
      const origin = await PageRegistryService.findValueOrigin(TEST_DOC_A, "0123456789");

      expect(origin).toHaveLength(1);
      const match = origin[0];
      expect(match.documentId).toBe(TEST_DOC_A);
      expect(match.pageNumber).toBe(1); // Page 1
      expect(match.fieldKey).toBe("account_number");
      expect(match.extractionMethod).toBe("KEY_VALUE_PAIR");
      expect(match.confidence).toBe(0.99);
      expect(match.bbox).toEqual([160, 100, 260, 115]); // Exact coordinates
      expect(match.contextSnippet).toContain("Account Number: 0123456789");
    });

    it("pinpoints exact page number, table ID, row, col, and bounding box for tabular values", async () => {
      // Query: Where did peak consumption 452,300 kWh come from?
      const origin = await PageRegistryService.findValueOrigin(TEST_DOC_A, "452,300");

      expect(origin).toHaveLength(1);
      const match = origin[0];
      expect(match.documentId).toBe(TEST_DOC_A);
      expect(match.pageNumber).toBe(2); // Page 2
      expect(match.fieldKey).toContain("tbl_consumption_1");
      expect(match.extractionMethod).toBe("LAYOUT_TABLE_CELL");
      expect(match.bbox).toEqual([160, 175, 300, 195]);
      expect(match.contextSnippet).toContain("Table 'Energy Consumption Breakdown' Row 2: 452,300");
    });

    it("pinpoints layout blocks when searching for header titles", async () => {
      // Query: Where did the header text come from?
      const origin = await PageRegistryService.findValueOrigin(TEST_DOC_A, "ESKOM HOLDINGS");

      expect(origin.length).toBeGreaterThan(0);
      const headerMatch = origin.find((o) => o.fieldKey === "block_header");
      expect(headerMatch).toBeDefined();
      expect(headerMatch!.pageNumber).toBe(1);
      expect(headerMatch!.bbox).toEqual([50, 40, 300, 70]);
    });

    it("returns empty array gracefully for non-existent values without throwing", async () => {
      const origin = await PageRegistryService.findValueOrigin(
        TEST_DOC_A,
        "NON_EXISTENT_VALUE_9999",
      );
      expect(origin).toEqual([]);
    });
  });

  // =========================================================================
  // 4. Lifecycle & Layout Mutations
  // =========================================================================
  describe("4. Lifecycle & Layout Mutations", () => {
    it("updates page layout information and propagates structural blocks", async () => {
      const initial: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "Raw Initial Text",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 0.9,
      };

      await PageRegistryService.registerPage(initial);

      const updated = await PageRegistryService.updatePageLayout(
        TEST_DOC_A,
        1,
        {
          pageNumber: 1,
          blocks: [
            {
              blockId: "blk_updated",
              pageNumber: 1,
              type: "METRIC_CARD",
              bbox: [20, 20, 100, 100],
              text: "R 50,000",
              confidence: 0.95,
            },
          ],
          tables: [],
          keyValues: [],
        },
        0.96,
      );

      expect(updated.extractionConfidence).toBe(0.96);
      expect(updated.layoutBlocks).toHaveLength(1);
      expect(updated.layoutBlocks![0].blockId).toBe("blk_updated");
    });

    it("updates OCR status and sets extraction method to TESSERACT_OCR upon completion", async () => {
      const scanned: PageRegistryRecord = {
        documentId: TEST_DOC_A,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "",
        extractionMethod: "TESSERACT_OCR",
        ocrRequired: true,
        ocrStatus: "PROCESSING",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 0.5,
      };

      await PageRegistryService.registerPage(scanned);

      const completed = await PageRegistryService.updatePageOcr(
        TEST_DOC_A,
        1,
        "COMPLETED",
        "Eskom Megaflex OCR Recovered Text\nAccount Number: 9988776655",
      );

      expect(completed.ocrStatus).toBe("COMPLETED");
      expect(completed.ocrRequired).toBe(false);
      expect(completed.extractionMethod).toBe("TESSERACT_OCR");
      expect(completed.extractedText).toContain("Account Number: 9988776655");
      expect(completed.hasText).toBe(true);
    });

    it("throws error when updating layout or OCR for non-existent page", async () => {
      await expect(
        PageRegistryService.updatePageLayout(TEST_DOC_A, 999, {
          pageNumber: 999,
          blocks: [],
          tables: [],
          keyValues: [],
        }),
      ).rejects.toThrow(
        "Page 999 of document '11111111-1111-4111-8111-111111111111' not registered",
      );
    });
  });

  // =========================================================================
  // 5. LocalWorkspaceStore Offline Resilience
  // =========================================================================
  describe("5. LocalWorkspaceStore Offline Persistence", () => {
    it("handles savePageRecord and listPageRecordsForDocument safely in browser/node environment", async () => {
      const pageRecord: PageRegistryRecord = {
        id: "offline_page_1",
        documentId: TEST_DOC_A,
        pageNumber: 1,
        dimensions: { width: 595, height: 842, aspectRatio: 0.7071, rotation: 0, unit: "pt" },
        extractedText: "Offline Stored Page Text",
        extractionMethod: "PDF_TEXT_STREAM",
        ocrRequired: false,
        ocrStatus: "NOT_REQUIRED",
        processingTimestamp: new Date().toISOString(),
        layoutInformation: {},
        extractionConfidence: 1.0,
      };

      // In Node environment where indexedDB may not be present, operations resolve safely without uncaught exceptions
      await expect(LocalWorkspaceStore.savePageRecord(pageRecord)).resolves.not.toThrow();
      await expect(LocalWorkspaceStore.getPageRecord(TEST_DOC_A, 1)).resolves.not.toThrow();
      await expect(
        LocalWorkspaceStore.listPageRecordsForDocument(TEST_DOC_A),
      ).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // 6. End-to-End Pipeline Integration
  // =========================================================================
  describe("6. End-to-End Pipeline Integration", () => {
    it("automatically creates and persists page registry entries when running the 10-stage pipeline", async () => {
      const pdfBytes = createMockPdfBytes(`
        ESKOM HOLDINGS SOC LTD
        TAX INVOICE
        Megaflex Electricity Invoice
        Account Number: 0123456789
        Invoice Number: INV-2026-001
        Invoice Date: 2026-01-15
        Total Due: R 854,230.12
      `);

      const result = await DocumentIntelligencePipeline.processDocument(
        pdfBytes,
        "Megaflex_Jan2026.pdf",
        TEST_ORG_A,
      );

      // Verify that pageRegistry is attached to the returned DocumentIntelligencePackage
      expect(result.pageRegistry).toBeDefined();
      expect(Array.isArray(result.pageRegistry)).toBe(true);
      expect(result.pageRegistry!.length).toBeGreaterThanOrEqual(1);

      // Verify page 1 properties
      const page1 = result.pageRegistry![0];
      expect(page1.documentId).toBe(result.document.documentId);
      expect(page1.pageNumber).toBe(1);
      expect(page1.dimensions.width).toBeGreaterThan(0);
      expect(page1.dimensions.height).toBeGreaterThan(0);
      expect(page1.extractionMethod).toBe("PDF_TEXT_STREAM");
      expect(page1.ocrRequired).toBe(false);
      expect(page1.ocrStatus).toBe("NOT_REQUIRED");
      expect(page1.processingTimestamp).toBeDefined();
      expect(page1.layoutInformation).toBeDefined();
      expect(page1.extractionConfidence).toBeGreaterThanOrEqual(0.9);

      // Verify provenance question can be answered for the processed document
      const origins = await PageRegistryService.findValueOrigin(
        result.document.documentId,
        "0123456789",
      );
      expect(origins.length).toBeGreaterThan(0);
      expect(origins[0].pageNumber).toBe(1);
      expect(origins[0].matchedText).toContain("0123456789");
    });
  });

  // =========================================================================
  // 7. Database Migration & Schema Alignment
  // =========================================================================
  describe("7. Database Migration & Schema Alignment", () => {
    it("verifies the SQL migration defines all mandated columns and constraints", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20260926010000_stage4_persistent_page_registry.sql",
      );

      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, "utf-8");

      // Table existence
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.document_pages");

      // Foreign key to uploads(id) ON DELETE CASCADE
      expect(sql).toContain(
        "document_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE",
      );

      // Unique constraint on (document_id, page_number)
      expect(sql).toContain(
        "CONSTRAINT uq_document_pages_doc_page UNIQUE (document_id, page_number)",
      );

      // All 10 mandated columns
      expect(sql).toContain("document_id UUID NOT NULL");
      expect(sql).toContain("page_number INTEGER NOT NULL");
      expect(sql).toContain("width NUMERIC(10,2)");
      expect(sql).toContain("height NUMERIC(10,2)");
      expect(sql).toContain("extracted_text TEXT");
      expect(sql).toContain("extraction_method VARCHAR(50)");
      expect(sql).toContain("ocr_required BOOLEAN");
      expect(sql).toContain("ocr_status VARCHAR(50)");
      expect(sql).toContain("processing_timestamp TIMESTAMPTZ");
      expect(sql).toContain("layout_information JSONB");
      expect(sql).toContain("extraction_confidence NUMERIC(6,4)");

      // Canonical view & triggers
      expect(sql).toContain("CREATE OR REPLACE VIEW public.page_registry");
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.fn_page_registry_insert()");
      expect(sql).toContain("CREATE TRIGGER trg_page_registry_insert");

      // Multi-tenant RLS
      expect(sql).toContain("ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY");
      expect(sql).toContain('CREATE POLICY "Tenant isolation policy for document_pages"');
    });
  });
});
