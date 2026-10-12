/**
 * Stage 8 — Document Evidence Model & Provenance Architecture Suite
 * =========================================================================
 * Authoritative verification suite for Document Evidence & Field Provenance.
 *
 * Requirements Tested:
 * 1. Complete 6-Link Provenance Chain:
 *    Document
 *    ↓
 *    Page
 *    ↓
 *    Region / Text
 *    ↓
 *    Extraction Method
 *    ↓
 *    Extracted Value
 *    ↓
 *    Confidence
 *
 * 2. Canonical Format Conformance:
 *    Field: Account Number
 *    Value: 123456789
 *    Document: INV-001
 *    Page: 1
 *    Extraction: Native PDF text
 *    Confidence: HIGH
 *
 * 3. Strict Anti-Hallucination & Anti-Unprovenanced Extraction Rule:
 *    - Strictly prohibits AI / extraction layers from returning unprovenanced
 *      primitives like: { "account_number": "123456789" } without grounded evidence.
 *    - ProvenanceGuard.enforceProvenancePayload() rejects unprovenanced claims.
 *
 * 4. Broken Link & Corrupted Provenance Detection:
 *    - Missing document reference
 *    - Invalid page index (<= 0 or non-integer)
 *    - Missing region bounding box or text snippet
 *    - Missing extraction method
 *    - Invalid confidence score or tier
 *
 * 5. DocumentEvidenceService Persistence & Traceability:
 *    - Registration, retrieval, batch registration
 *    - Traceability verification
 *    - Multi-line audit chain formatting
 *
 * 6. Pipeline Integration:
 *    - DocumentIntelligencePipeline produces DocumentEvidencePackage & provenancedFields
 *    - Every extracted field is auditable from document down to bounding box and line text
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ProvenanceGuard,
  UnprovenancedExtractionError,
  DocumentEvidenceService,
  EvidenceRegistryEngine,
  DocumentIntelligencePipeline,
} from "../../domain/intelligence";
import type {
  ExtractedPage,
  ExtractedTextLine,
  PageLayoutAnalysis,
  ProvenancedField,
} from "../../domain/intelligence/types";

describe("Stage 8 — Document Evidence Model & Provenance Architecture", () => {
  beforeEach(async () => {
    // Clear in-memory evidence store between tests
    await DocumentEvidenceService.clearEvidence();
  });

  describe("1. Canonical 6-Link Provenance Chain", () => {
    it("should successfully construct and validate a compliant 6-link provenanced field", () => {
      const field = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "123456789",
        documentId: "INV-001",
        pageNumber: 1,
        region: [120, 140, 240, 155],
        regionText: "123456789",
        contextSnippet: "Account Number: 123456789",
        extractionMethod: "NATIVE_PDF_TEXT",
        confidenceScore: 0.96,
      });

      // Verify the canonical representation properties
      expect(field.fieldKey).toBe("account_number");
      expect(field.fieldLabel).toBe("Account Number");
      expect(field.value).toBe("123456789");
      expect(field.document).toBe("INV-001");
      expect(field.page).toBe(1);
      expect(field.extraction).toBe("Native PDF text");
      expect(field.confidence).toBe("HIGH");

      // Verify detailed provenance reference
      expect(field.provenance.documentId).toBe("INV-001");
      expect(field.provenance.pageNumber).toBe(1);
      expect(field.provenance.region).toEqual([120, 140, 240, 155]);
      expect(field.provenance.regionText).toBe("123456789");
      expect(field.provenance.contextSnippet).toBe("Account Number: 123456789");
      expect(field.provenance.extractionMethod).toBe("NATIVE_PDF_TEXT");
      expect(field.provenance.confidenceScore).toBe(0.96);
      expect(field.provenance.confidenceLevel).toBe("HIGH");

      // Verify validation passes with zero errors
      const validation = ProvenanceGuard.validateField(field);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should format the provenance chain with the exact canonical structure", () => {
      const field = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "123456789",
        documentId: "INV-001",
        pageNumber: 1,
        region: [120, 140, 240, 155],
        regionText: "123456789",
        extractionMethod: "NATIVE_PDF_TEXT",
        confidenceScore: 0.95,
      });

      const summary = ProvenanceGuard.toTraceSummary(field);
      expect(summary).toEqual({
        field: "Account Number",
        value: "123456789",
        document: "INV-001",
        page: 1,
        extraction: "Native PDF text",
        confidence: "HIGH",
        region: [120, 140, 240, 155],
        text: "123456789",
      });

      // Verify multi-line arrow-delimited trace format
      const formattedChain = ProvenanceGuard.formatProvenanceChain(field);
      expect(formattedChain).toContain("Field: Account Number");
      expect(formattedChain).toContain("Value: 123456789");
      expect(formattedChain).toContain("Document: INV-001");
      expect(formattedChain).toContain("Page: 1");
      expect(formattedChain).toContain("Extraction: Native PDF text");
      expect(formattedChain).toContain("Confidence: HIGH");
      expect(formattedChain).toContain("↓");
    });
  });

  describe("2. Strict Anti-Hallucination Guard: Rejecting Unprovenanced Primitives", () => {
    it("must strictly reject raw unprovenanced JSON payloads lacking evidence", () => {
      // Simulating a future AI layer returning raw JSON without evidence
      const rawAiPayload = {
        account_number: "123456789",
        invoice_number: "INV-2026-9901",
        total_due: 45678.9,
      };

      const enforcement = ProvenanceGuard.enforceProvenancePayload(rawAiPayload, "INV-001");

      // Must be marked completely invalid
      expect(enforcement.isValid).toBe(false);
      expect(enforcement.provenancedCount).toBe(0);
      expect(enforcement.rejectedCount).toBe(3);

      // Verify each field was rejected with unprovenanced error
      const accountRejection = enforcement.rejectedClaims.find(
        (r) => r.fieldKey === "account_number",
      );
      expect(accountRejection).toBeDefined();
      expect(accountRejection?.reason).toBe("REJECTED_UNPROVENANCED_PRIMITIVE");
      expect(accountRejection?.details).toContain("Raw primitive value without evidence");
      expect(accountRejection?.details).toContain(
        "Missing Page, Region/Text, Extraction Method, and Confidence grounding",
      );

      const totalRejection = enforcement.rejectedClaims.find((r) => r.fieldKey === "total_due");
      expect(totalRejection).toBeDefined();
      expect(totalRejection?.reason).toBe("REJECTED_UNPROVENANCED_PRIMITIVE");
    });

    it("should accept valid provenanced fields while isolating and rejecting unprovenanced claims in mixed payloads", () => {
      const validField = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "123456789",
        documentId: "INV-001",
        pageNumber: 1,
        region: [100, 100, 200, 120],
        regionText: "123456789",
        extractionMethod: "NATIVE_PDF_TEXT",
        confidenceScore: 0.95,
      });

      const mixedPayload = {
        account_number: validField, // Valid provenanced field
        hallucinated_tariff: "Megaflex Non-Local", // Raw hallucinated string
        fake_total: 99999.0, // Raw hallucinated number
      };

      const enforcement = ProvenanceGuard.enforceProvenancePayload(mixedPayload, "INV-001");

      expect(enforcement.isValid).toBe(false);
      expect(enforcement.provenancedCount).toBe(1);
      expect(enforcement.rejectedCount).toBe(2);
      expect(enforcement.provenancedFields["account_number"]).toBeDefined();
      expect(enforcement.rejectedClaims.map((r) => r.fieldKey)).toEqual([
        "hallucinated_tariff",
        "fake_total",
      ]);
    });
  });

  describe("3. Broken Provenance Link Detection & Verification", () => {
    it("should throw UnprovenancedExtractionError when document reference is missing", () => {
      expect(() => {
        ProvenanceGuard.createProvenancedField({
          fieldKey: "account_number",
          fieldLabel: "Account Number",
          value: "123456789",
          documentId: "", // Broken document link
          pageNumber: 1,
          region: [10, 10, 100, 30],
          regionText: "123456789",
          extractionMethod: "NATIVE_PDF_TEXT",
          confidenceScore: 0.9,
        });
      }).toThrow(UnprovenancedExtractionError);
    });

    it("should throw UnprovenancedExtractionError when page number is invalid", () => {
      expect(() => {
        ProvenanceGuard.createProvenancedField({
          fieldKey: "account_number",
          fieldLabel: "Account Number",
          value: "123456789",
          documentId: "INV-001",
          pageNumber: 0, // Invalid page number (must be >= 1)
          region: [10, 10, 100, 30],
          regionText: "123456789",
          extractionMethod: "NATIVE_PDF_TEXT",
          confidenceScore: 0.9,
        });
      }).toThrow("Page link broken: page number must be an integer >= 1");
    });

    it("should throw UnprovenancedExtractionError when region bounding box or text is missing", () => {
      expect(() => {
        ProvenanceGuard.createProvenancedField({
          fieldKey: "account_number",
          fieldLabel: "Account Number",
          value: "123456789",
          documentId: "INV-001",
          pageNumber: 1,
          region: [0, 0, 0, 0] as any, // Degenerate region with zero area
          regionText: "", // Missing text snippet
          extractionMethod: "NATIVE_PDF_TEXT",
          confidenceScore: 0.9,
        });
      }).toThrow("Region/Text link broken");
    });

    it("should detect invalid confidence score values", () => {
      expect(() => {
        ProvenanceGuard.createProvenancedField({
          fieldKey: "account_number",
          fieldLabel: "Account Number",
          value: "123456789",
          documentId: "INV-001",
          pageNumber: 1,
          region: [10, 10, 100, 30],
          regionText: "123456789",
          extractionMethod: "NATIVE_PDF_TEXT",
          confidenceScore: 1.5, // Invalid score > 1
        });
      }).toThrow("Confidence link broken: confidenceScore must be a number between 0 and 1");
    });

    it("should accurately assign confidence tiers across boundary scores", () => {
      expect(ProvenanceGuard.calculateConfidenceTier(0.95)).toBe("HIGH");
      expect(ProvenanceGuard.calculateConfidenceTier(0.85)).toBe("HIGH");
      expect(ProvenanceGuard.calculateConfidenceTier(0.84)).toBe("MEDIUM");
      expect(ProvenanceGuard.calculateConfidenceTier(0.6)).toBe("MEDIUM");
      expect(ProvenanceGuard.calculateConfidenceTier(0.59)).toBe("LOW");
      expect(ProvenanceGuard.calculateConfidenceTier(0.25)).toBe("LOW");
      expect(ProvenanceGuard.calculateConfidenceTier(0.24)).toBe("UNKNOWN");
      expect(ProvenanceGuard.calculateConfidenceTier(0.0)).toBe("UNKNOWN");
    });
  });

  describe("4. DocumentEvidenceService: Persistence, Traceability & Chain Audit", () => {
    it("should register and retrieve provenanced fields with complete auditability", async () => {
      const field = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "123456789",
        documentId: "INV-001",
        pageNumber: 1,
        region: [120, 140, 240, 155],
        regionText: "123456789",
        contextSnippet: "Account Number: 123456789",
        extractionMethod: "NATIVE_PDF_TEXT",
        confidenceScore: 0.95,
      });

      await DocumentEvidenceService.registerField(field);

      const retrieved = await DocumentEvidenceService.getFieldEvidence("INV-001", "account_number");
      expect(retrieved).toBeDefined();
      expect(retrieved?.value).toBe("123456789");
      expect(retrieved?.provenance.documentId).toBe("INV-001");
      expect(retrieved?.provenance.pageNumber).toBe(1);

      // Verify chain traceability
      const traceability = await DocumentEvidenceService.verifyFieldTraceability(
        "INV-001",
        "account_number",
      );
      expect(traceability.isTraceable).toBe(true);
      expect(traceability.missingLinks).toHaveLength(0);
      expect(traceability.chainSummary?.document).toBe("INV-001");
      expect(traceability.chainSummary?.page).toBe(1);
      expect(traceability.chainSummary?.extraction).toBe("Native PDF text");
      expect(traceability.chainSummary?.confidence).toBe("HIGH");
    });

    it("should report missing links when querying non-existent fields", async () => {
      const traceability = await DocumentEvidenceService.verifyFieldTraceability(
        "INV-001",
        "non_existent_field",
      );
      expect(traceability.isTraceable).toBe(false);
      expect(traceability.missingLinks).toContain("Field record not found in evidence store");
    });

    it("should refuse to register unprovenanced or corrupted fields", async () => {
      const corruptField: any = {
        fieldKey: "corrupt_field",
        fieldLabel: "Corrupt Field",
        value: "bad",
        document: "", // missing
        page: 0, // invalid
        provenance: null, // missing
      };

      await expect(DocumentEvidenceService.registerField(corruptField)).rejects.toThrow(
        /Cannot register unprovenanced field/,
      );
    });

    it("should support batch registration and retrieval of all fields for a document", async () => {
      const field1 = ProvenanceGuard.createProvenancedField({
        fieldKey: "account_number",
        fieldLabel: "Account Number",
        value: "123456789",
        documentId: "INV-002",
        pageNumber: 1,
        region: [100, 100, 200, 120],
        regionText: "123456789",
        extractionMethod: "NATIVE_PDF_TEXT",
        confidenceScore: 0.95,
      });

      const field2 = ProvenanceGuard.createProvenancedField({
        fieldKey: "invoice_number",
        fieldLabel: "Invoice Number",
        value: "INV-9988",
        documentId: "INV-002",
        pageNumber: 1,
        region: [300, 100, 450, 120],
        regionText: "INV-9988",
        extractionMethod: "KEY_VALUE_INSPECTION",
        confidenceScore: 0.9,
      });

      await DocumentEvidenceService.registerFieldsBatch("INV-002", [field1, field2]);

      const allFields = await DocumentEvidenceService.getAllFieldEvidence("INV-002");
      expect(allFields).toHaveLength(2);
      expect(allFields.map((f) => f.fieldKey).sort()).toEqual(["account_number", "invoice_number"]);
    });
  });

  describe("5. Pipeline Grounding & Evidence Package Integration", () => {
    it("should construct grounded provenanced fields from layout analysis and text lines", () => {
      const mockPages: ExtractedPage[] = [
        {
          documentId: "DOC-GROUNDED-001",
          pageNumber: 1,
          dimensions: { width: 595, height: 842, aspectRatio: 0.707, rotation: 0 },
          hasText: true,
          isScanned: false,
          characterCount: 200,
          tokenCount: 40,
          rawText: "Eskom Tax Invoice\nAccount No: 9876543210\nTotal Due: R 45,678.90",
        },
      ];

      const mockLines: ExtractedTextLine[] = [
        {
          lineNumber: 1,
          pageNumber: 1,
          text: "Eskom Tax Invoice",
          bbox: [50, 50, 250, 70],
          tokens: [],
          wordCount: 3,
          characterCount: 17,
          isHeadingCandidate: true,
          isBoldCandidate: true,
        },
        {
          lineNumber: 2,
          pageNumber: 1,
          text: "Account No: 9876543210",
          bbox: [50, 90, 250, 110],
          tokens: [],
          wordCount: 3,
          characterCount: 22,
          isHeadingCandidate: false,
          isBoldCandidate: false,
        },
        {
          lineNumber: 3,
          pageNumber: 1,
          text: "Total Due: R 45,678.90",
          bbox: [50, 130, 250, 150],
          tokens: [],
          wordCount: 4,
          characterCount: 22,
          isHeadingCandidate: false,
          isBoldCandidate: false,
        },
      ];

      const mockLayouts: PageLayoutAnalysis[] = [
        {
          pageNumber: 1,
          dimensions: { width: 595, height: 842, aspectRatio: 0.707, rotation: 0 },
          blocks: [],
          tables: [],
          keyValues: [
            {
              propertyKey: "account_number",
              keyLabel: "Account No",
              rawValue: "9876543210",
              pageNumber: 1,
              keyBbox: [50, 90, 140, 110],
              valueBbox: [150, 90, 250, 110],
              confidence: 0.94,
              method: "KEY_VALUE_INSPECTION",
            },
            {
              propertyKey: "total_due",
              keyLabel: "Total Due",
              rawValue: "R 45,678.90",
              pageNumber: 1,
              keyBbox: [50, 130, 130, 150],
              valueBbox: [140, 130, 250, 150],
              confidence: 0.92,
              method: "KEY_VALUE_INSPECTION",
            },
          ],
          readingOrderBlockIds: [],
          isStructuredInvoiceLayout: true,
          structureConfidence: 0.93,
        },
      ];

      const evidencePackage = EvidenceRegistryEngine.buildEvidencePackage(
        mockPages,
        mockLines,
        mockLayouts,
        "DOC-GROUNDED-001",
      );

      expect(evidencePackage.documentId).toBe("DOC-GROUNDED-001");
      expect(evidencePackage.totalFieldsCount).toBeGreaterThanOrEqual(2);
      expect(evidencePackage.provenanceIntegrity).toBe("PROVENANCED");
      expect(evidencePackage.unprovenancedClaims).toHaveLength(0);

      const accountField = evidencePackage.provenancedFields["account_number"];
      expect(accountField).toBeDefined();
      expect(accountField.document).toBe("DOC-GROUNDED-001");
      expect(accountField.page).toBe(1);
      expect(accountField.value).toBe("9876543210");
      expect(accountField.confidence).toBe("HIGH");
      expect(accountField.provenance.region).toEqual([150, 90, 250, 110]);
      expect(accountField.provenance.contextSnippet).toContain("Account No: 9876543210");

      const totalField = evidencePackage.provenancedFields["total_due"];
      expect(totalField).toBeDefined();
      expect(totalField.value).toBe(45678.9);
      expect(totalField.unit).toBe("ZAR");
      expect(totalField.provenance.region).toEqual([140, 130, 250, 150]);
    });

    it("should integrate with DocumentIntelligencePipeline to produce complete provenanced package", async () => {
      // Build a minimal valid PDF-like byte array to run through the full pipeline
      const samplePdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 12 Tf
72 712 Td (ESKOM TAX INVOICE) Tj
0 -24 Td (Account Number: 123456789) Tj
0 -24 Td (Total Amount Due: R 12,345.67) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000210 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
382
%%EOF`;

      const bytes = new TextEncoder().encode(samplePdfContent);

      const result = await DocumentIntelligencePipeline.processDocument(
        bytes,
        "eskom_invoice_stage8.pdf",
        "00000000-0000-0000-0000-000000000001",
        { skipStorageUpload: true },
      );

      expect(result).toBeDefined();
      expect(result.document).toBeDefined();

      // Verify Stage 8 Document Evidence and Provenance Package properties
      expect(result.evidencePackage).toBeDefined();
      expect(result.evidencePackage?.documentId).toBe(result.document.documentId);
      expect(result.provenancedFields).toBeDefined();

      // Verify that registered fields can be queried from DocumentEvidenceService
      const storedFields = await DocumentEvidenceService.getAllFieldEvidence(
        result.document.documentId,
      );
      expect(Array.isArray(storedFields)).toBe(true);
    });
  });
});
