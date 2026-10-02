import { describe, it, expect, beforeEach } from "vitest";
import {
  DocumentIntelligencePipeline,
  DocumentErrorService,
  DocumentIntelligenceError,
  PdfCorruptedError,
  PdfPasswordProtectedError,
  UnsupportedFormatError,
  TextExtractionError,
  LayoutExtractionError,
  PageProcessingError,
  DocumentClassificationError,
  DocumentStorageError,
  DocumentDatabaseError,
  DocumentLifecycleManager,
  DocumentRegistryService,
  DocumentExtractionRunManager,
} from "../../domain/intelligence";

const TEST_ORG_A = "00000000-0000-0000-0000-000000000001";
const TEST_ORG_B = "00000000-0000-0000-0000-000000000002";

// Helper: build a synthetic valid mock PDF
function createMockPdfBytes(text: string): Uint8Array {
  const streamContent = `BT\n/F1 12 Tf\n72 712 Td\n(${text}) Tj\nET`;
  const streamLength = streamContent.length;
  const pdfString = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000210 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n320\n%%EOF`;
  return new TextEncoder().encode(pdfString);
}

// Helper: build an encrypted PDF
function createEncryptedPdfBytes(): Uint8Array {
  const pdfString = `%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n5 0 obj\n<< /Filter /Standard /V 2 /R 3 /O (hash) /U (hash) /P -4 >>\nendobj\ntrailer\n<< /Size 6 /Root 1 0 R /Encrypt 5 0 R >>\nstartxref\n320\n%%EOF`;
  return new TextEncoder().encode(pdfString);
}

describe("STAGE 11 — Explicit Error Handling & Failure Audit Subsystem", () => {
  beforeEach(() => {
    DocumentErrorService.clearCache();
    DocumentLifecycleManager.clearCache();
    DocumentRegistryService.clearCache();
    DocumentExtractionRunManager.clearCache();
  });

  describe("1. Explicit Error Classes & Hierarchy", () => {
    it("instantiates strongly-typed explicit error subclasses with standard metadata", () => {
      const err = new PdfCorruptedError("Corrupted byte stream", {
        documentId: "doc-1",
        organisationId: TEST_ORG_A,
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(DocumentIntelligenceError);
      expect(err.errorCode).toBe("PDF_CORRUPTED");
      expect(err.stage).toBe("PDF_INSPECTION");
      expect(err.documentId).toBe("doc-1");
      expect(err.organisationId).toBe(TEST_ORG_A);
      expect(err.isFatal).toBe(true);
      expect(err.userMessage).toContain("corrupted");
      expect(err.timestamp).toBeDefined();
    });

    it("verifies all 9 mandatory explicit error codes and stages", () => {
      const errors = [
        new PdfCorruptedError(),
        new PdfPasswordProtectedError(),
        new UnsupportedFormatError(),
        new TextExtractionError(),
        new LayoutExtractionError(),
        new PageProcessingError(),
        new DocumentClassificationError(),
        new DocumentStorageError(),
        new DocumentDatabaseError(),
      ];

      const expectedCodes = [
        "PDF_CORRUPTED",
        "PDF_PASSWORD_PROTECTED",
        "UNSUPPORTED_FORMAT",
        "TEXT_EXTRACTION_FAILED",
        "LAYOUT_EXTRACTION_FAILED",
        "PAGE_PROCESSING_FAILED",
        "DOCUMENT_CLASSIFICATION_FAILED",
        "STORAGE_ERROR",
        "DATABASE_ERROR",
      ];

      errors.forEach((err, idx) => {
        expect(err.errorCode).toBe(expectedCodes[idx]);
        expect(err.isFatal).toBe(true);
        expect(err.userMessage.length).toBeGreaterThan(10);
      });
    });
  });

  describe("2. No Silent Swallowing of Exceptions", () => {
    it("explicitly fails and throws PdfCorruptedError for corrupted files (<16 bytes or missing %PDF)", async () => {
      const corruptBytes = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
      const documentId = "doc-corrupted-1";

      await expect(
        DocumentIntelligencePipeline.processDocument(
          corruptBytes,
          "broken.pdf",
          TEST_ORG_A,
          { documentId, skipStorageUpload: true },
        ),
      ).rejects.toThrow(PdfCorruptedError);

      // Verify the failure was recorded in DocumentErrorService
      const recorded = await DocumentErrorService.getErrorsForDocument(documentId, TEST_ORG_A);
      expect(recorded.length).toBeGreaterThanOrEqual(1);
      expect(recorded[0].errorCode).toBe("PDF_CORRUPTED");
      expect(recorded[0].isFatal).toBe(true);
      expect(recorded[0].userMessage).toContain("corrupted");
    });

    it("explicitly fails and throws PdfPasswordProtectedError for encrypted documents", async () => {
      const encryptedBytes = createEncryptedPdfBytes();
      const documentId = "doc-encrypted-1";

      await expect(
        DocumentIntelligencePipeline.processDocument(
          encryptedBytes,
          "protected_bill.pdf",
          TEST_ORG_A,
          { documentId, skipStorageUpload: true },
        ),
      ).rejects.toThrow(PdfPasswordProtectedError);

      const recorded = await DocumentErrorService.getErrorsForDocument(documentId, TEST_ORG_A);
      expect(recorded.length).toBeGreaterThanOrEqual(1);
      expect(recorded[0].errorCode).toBe("PDF_PASSWORD_PROTECTED");
      expect(recorded[0].userMessage).toContain("password-protected or encrypted");
    });

    it("explicitly records UNSUPPORTED_FORMAT for non-utility documents", async () => {
      const recipeDoc = createMockPdfBytes("Chocolate Cake Recipe. 2 cups flour, 1 cup sugar.");
      const documentId = "doc-recipe-1";

      const pkg = await DocumentIntelligencePipeline.processDocument(
        recipeDoc,
        "recipe.pdf",
        TEST_ORG_A,
        { documentId, skipStorageUpload: true },
      );

      expect(pkg.lifecycleState).toBe("UNSUPPORTED");
      expect(pkg.document.errorCode).toBe("UNSUPPORTED_FORMAT");
      expect(pkg.document.validationStatus).toBe("INVALID");

      const errors = await DocumentErrorService.getErrorsForDocument(documentId, TEST_ORG_A);
      expect(errors.some((e) => e.errorCode === "UNSUPPORTED_FORMAT")).toBe(true);
    });

    it("throws UnsupportedFormatError when strictValidation option is enabled", async () => {
      const recipeDoc = createMockPdfBytes("Chocolate Cake Recipe. 2 cups flour, 1 cup sugar.");
      const documentId = "doc-recipe-strict";

      await expect(
        DocumentIntelligencePipeline.processDocument(
          recipeDoc,
          "recipe.pdf",
          TEST_ORG_A,
          { documentId, skipStorageUpload: true, strictValidation: true },
        ),
      ).rejects.toThrow(UnsupportedFormatError);

      const errors = await DocumentErrorService.getErrorsForDocument(documentId, TEST_ORG_A);
      expect(errors[0].errorCode).toBe("UNSUPPORTED_FORMAT");
    });
  });

  describe("3. No Fake Success Messages", () => {
    it("returns honest failed package when throwOnError: false without displaying fake success", async () => {
      const corruptBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const documentId = "doc-failed-honest-1";

      const pkg = await DocumentIntelligencePipeline.processDocument(
        corruptBytes,
        "dead.pdf",
        TEST_ORG_A,
        { documentId, skipStorageUpload: true, throwOnError: false },
      );

      // Verify the package explicitly declares failure
      expect(pkg.isFailed).toBe(true);
      expect(pkg.lifecycleState).toBe("FAILED");
      expect(pkg.error).toBeDefined();
      expect(pkg.error?.errorCode).toBe("PDF_CORRUPTED");

      // Verify document statuses reflect failure honestly
      expect(pkg.document.processingStatus).toBe("FAILED");
      expect(pkg.document.validationStatus).toBe("INVALID");
      expect(pkg.document.errorStatus).toBe("FATAL");
      expect(pkg.document.errorCode).toBe("PDF_CORRUPTED");
      expect(pkg.document.userMessage).toContain("corrupted");

      // Verify handoff NEVER fabricates successful validation data
      expect(pkg.handoff.aiValidationPayload.readyForValidation).toBe(false);
      expect(pkg.handoff.aiValidationPayload.determinants).toEqual({});
      expect(pkg.handoff.aiValidationPayload.lineItems).toEqual([]);
      expect(pkg.evidence).toHaveLength(0);
      expect(Object.keys(pkg.provenancedFields)).toHaveLength(0);
    });
  });

  describe("4. Error Persistence and Authorised Visibility", () => {
    it("persists errors and makes them queryable by document ID", async () => {
      const docId = "doc-audit-123";
      await DocumentErrorService.recordError({
        documentId: docId,
        organisationId: TEST_ORG_A,
        stage: "TEXT_EXTRACTION",
        errorCode: "TEXT_EXTRACTION_FAILED",
        errorMessage: "Stream corrupted at byte offset 4096",
        details: { offset: 4096 },
      });

      const errors = await DocumentErrorService.getErrorsForDocument(docId, TEST_ORG_A);
      expect(errors).toHaveLength(1);
      expect(errors[0].errorCode).toBe("TEXT_EXTRACTION_FAILED");
      expect(errors[0].stage).toBe("TEXT_EXTRACTION");
      expect(errors[0].details).toEqual({ offset: 4096 });
      expect(errors[0].isFatal).toBe(true);
    });

    it("enforces tenant isolation so Tenant B cannot see Tenant A errors", async () => {
      const docId = "doc-tenant-secret";
      await DocumentErrorService.recordError({
        documentId: docId,
        organisationId: TEST_ORG_A,
        stage: "STORAGE",
        errorCode: "STORAGE_ERROR",
        errorMessage: "Failed to persist to vault",
      });

      // Tenant A can see their error
      const tenantAErrors = await DocumentErrorService.getErrorsForDocument(docId, TEST_ORG_A);
      expect(tenantAErrors).toHaveLength(1);

      // Tenant B querying for the same document receives empty list
      const tenantBErrors = await DocumentErrorService.getErrorsForDocument(docId, TEST_ORG_B);
      expect(tenantBErrors).toHaveLength(0);

      // List errors by organisation
      const listA = await DocumentErrorService.listErrors(TEST_ORG_A);
      const listB = await DocumentErrorService.listErrors(TEST_ORG_B);
      expect(listA.some((e) => e.documentId === docId)).toBe(true);
      expect(listB.some((e) => e.documentId === docId)).toBe(false);
    });

    it("updates DocumentRegistryRecord with error details for authorised UI visibility", async () => {
      const docId = "doc-registry-error-1";
      await DocumentRegistryService.registerDocument({
        documentId: docId,
        organisationId: TEST_ORG_A,
        originalFilename: "faulty_meter.pdf",
        storagePath: `tenants/${TEST_ORG_A}/documents/${docId}/faulty_meter.pdf`,
        fileSize: 1024,
        checksum: "sha256_mock_hash",
      });

      await DocumentErrorService.recordError({
        documentId: docId,
        organisationId: TEST_ORG_A,
        stage: "LAYOUT_ANALYSIS",
        errorCode: "LAYOUT_EXTRACTION_FAILED",
        errorMessage: "Table column bounds collapsed",
        userMessage: "Layout analysis failed to resolve document structure and tables.",
      });

      const doc = await DocumentRegistryService.getDocumentById(docId);
      expect(doc).not.toBeNull();
      expect(doc?.errorCode).toBe("LAYOUT_EXTRACTION_FAILED");
      expect(doc?.userMessage).toBe("Layout analysis failed to resolve document structure and tables.");
      expect(doc?.errorStatus).toBe("FATAL");
    });
  });

  describe("5. Public Disclosure Model & Safe Error Messaging", () => {
    it("generates user messages adhering to Tier 1/2 without leaking database internals", () => {
      const dbError = new DocumentDatabaseError(
        "FATAL: password authentication failed for user 'postgres' at 192.168.1.100:5432",
        {
          documentId: "doc-db-leak",
          organisationId: TEST_ORG_A,
        },
      );

      // Raw message contains private infrastructure info
      expect(dbError.message).toContain("192.168.1.100:5432");

      // User safe message NEVER leaks raw connection string or internal IP
      expect(dbError.userMessage).not.toContain("192.168.1.100");
      expect(dbError.userMessage).not.toContain("password");
      expect(dbError.userMessage).toContain("Database persistence failed");
    });
  });
});
