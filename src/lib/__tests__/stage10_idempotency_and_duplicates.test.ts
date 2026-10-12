/**
 * Stage 10 — Idempotency & Duplicate Protection Architecture Suite
 * =========================================================================
 * Authoritative verification suite for Document Idempotency and Duplicates.
 *
 * Requirements Tested:
 * 1. Prevent accidental duplicate processing.
 * 2. Use document checksum/hash (SHA-256) where appropriate.
 * 3. If the same file is uploaded twice:
 *    - Identify the duplicate accurately.
 *    - Do not blindly create another financial record.
 *    - Allow the system to reference the existing document.
 *    - Preserve audit information immutably.
 * 4. Do not rely only on filename:
 *    - Different filenames with identical binary content ARE detected as duplicates.
 *    - Identical filenames with different binary content are NOT detected as duplicates.
 * 5. Strict tenant isolation: Checksums do not cross organisation boundaries.
 * 6. Reprocessing compatibility: Explicit reprocessing (Stage 9) creates new runs
 *    without being erroneously blocked.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DocumentIntelligencePipeline,
  DocumentRegistryService,
  DocumentExtractionRunManager,
  DocumentEvidenceService,
  DocumentIdempotencyService,
  DocumentLifecycleManager,
} from "../../domain/intelligence";

describe("Stage 10 — Idempotency & Duplicate Protection Architecture", () => {
  const TENANT_A = "00000000-0000-0000-0000-000000000001";
  const TENANT_B = "00000000-0000-0000-0000-000000000002";

  const samplePdf1 = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 130 >> stream
BT
/F1 12 Tf
72 712 Td (ESKOM TAX INVOICE) Tj
0 -24 Td (Account Number: 1122334455) Tj
0 -24 Td (Tax Invoice: INV-2026-001) Tj
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
392
%%EOF`;

  const samplePdf2 = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 130 >> stream
BT
/F1 12 Tf
72 712 Td (ESKOM TAX INVOICE) Tj
0 -24 Td (Account Number: 9988776655) Tj
0 -24 Td (Tax Invoice: INV-2026-002) Tj
0 -24 Td (Total Amount Due: R 99,888.00) Tj
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
392
%%EOF`;

  const bytes1 = new TextEncoder().encode(samplePdf1);
  const bytes2 = new TextEncoder().encode(samplePdf2);

  beforeEach(async () => {
    DocumentRegistryService.clearCache();
    DocumentLifecycleManager.clearState();
    DocumentIdempotencyService.clearCache();
    await DocumentExtractionRunManager.clearRuns();
    await DocumentEvidenceService.clearEvidence();
  });

  describe("1. Identification of Duplicate via Cryptographic Checksum/Hash", () => {
    it("should identify duplicate when the exact same file is uploaded twice", async () => {
      // First Upload
      const pkg1 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "eskom_jan_2026.pdf",
        TENANT_A,
        { userId: "user-1" },
      );

      expect(pkg1.isDuplicate).toBeFalsy();
      expect(pkg1.financialRecordsSuppressed).toBeFalsy();
      expect(pkg1.document.documentId).toBeDefined();

      const originalDocId = pkg1.document.documentId;
      const originalChecksum = pkg1.document.checksum;

      // Second Upload (Exact same binary file)
      const pkg2 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "eskom_jan_2026.pdf",
        TENANT_A,
        { userId: "user-2" },
      );

      // Must be identified as a duplicate
      expect(pkg2.isDuplicate).toBe(true);
      expect(pkg2.duplicateOfDocumentId).toBe(originalDocId);
      expect(pkg2.duplicateEvaluation).toBeDefined();
      expect(pkg2.duplicateEvaluation?.isDuplicate).toBe(true);
      expect(pkg2.duplicateEvaluation?.matchCriteria).toBe("EXACT_CHECKSUM_HASH");
      expect(pkg2.duplicateEvaluation?.checksum).toBe(originalChecksum);
      expect(pkg2.duplicateEvaluation?.matchedOnChecksum).toBe(true);
      expect(pkg2.duplicateEvaluation?.message).toContain("Duplicate processing prevented");
    });
  });

  describe("2. Filename Independence (Do Not Rely Only on Filename)", () => {
    it("should identify duplicate when different filenames share identical content and checksum", async () => {
      // Upload 1: original filename
      const pkg1 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "Original_Eskom_Bill.pdf",
        TENANT_A,
      );

      expect(pkg1.isDuplicate).toBeFalsy();
      const originalId = pkg1.document.documentId;

      // Upload 2: completely different filename, but identical bytes
      const pkg2 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "Scanned_Copy_Final_v2_Renamed.pdf",
        TENANT_A,
      );

      // Must still be identified as duplicate
      expect(pkg2.isDuplicate).toBe(true);
      expect(pkg2.duplicateOfDocumentId).toBe(originalId);
      expect(pkg2.duplicateEvaluation?.matchedOnChecksum).toBe(true);
      expect(pkg2.duplicateEvaluation?.attemptedFilename).toBe("Scanned_Copy_Final_v2_Renamed.pdf");
      expect(pkg2.duplicateEvaluation?.originalFilename).toBe("Original_Eskom_Bill.pdf");
    });

    it("should NOT identify duplicate when same filename has different content and checksum", async () => {
      // Month 1 bill named "bill.pdf"
      const pkg1 = await DocumentIntelligencePipeline.processDocument(bytes1, "bill.pdf", TENANT_A);

      expect(pkg1.isDuplicate).toBeFalsy();
      const doc1Id = pkg1.document.documentId;

      // Month 2 bill also named "bill.pdf", but containing different bytes/checksum
      const pkg2 = await DocumentIntelligencePipeline.processDocument(bytes2, "bill.pdf", TENANT_A);

      // Must NOT be marked as duplicate
      expect(pkg2.isDuplicate).toBeFalsy();
      expect(pkg2.document.documentId).not.toBe(doc1Id);
      expect(pkg2.document.checksum).not.toBe(pkg1.document.checksum);
      expect(pkg2.financialRecordsSuppressed).toBeFalsy();
    });
  });

  describe("3. Financial Record Suppression (Do Not Blindly Create Another Financial Record)", () => {
    it("should suppress financial record determinants and line items when duplicate is detected", async () => {
      // Initial upload
      const pkg1 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "invoice_financial.pdf",
        TENANT_A,
      );

      expect(pkg1.handoff.aiValidationPayload.determinants.totalInvoiceAmountZar).toBe(12345.67);
      expect(pkg1.financialRecordsSuppressed).toBeFalsy();

      // Duplicate upload
      const pkg2 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "invoice_financial_copy.pdf",
        TENANT_A,
      );

      // Financial record creation must be explicitly suppressed
      expect(pkg2.isDuplicate).toBe(true);
      expect(pkg2.financialRecordsSuppressed).toBe(true);
      expect(pkg2.duplicateEvaluation?.suppressFinancialRecordCreation).toBe(true);
      expect(pkg2.handoff.aiValidationPayload.readyForValidation).toBe(false);
      expect(pkg2.handoff.aiValidationPayload.determinants.totalInvoiceAmountZar).toBeUndefined();
      expect(pkg2.handoff.aiValidationPayload.preliminaryAnomalies[0]).toContain(
        "Financial record creation suppressed",
      );
    });
  });

  describe("4. Referencing Existing Document", () => {
    it("should allow the system to reference the existing authoritative document", async () => {
      const pkg1 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "canonical_invoice.pdf",
        TENANT_A,
        { userId: "authoritative-uploader" },
      );

      const originalDocId = pkg1.document.documentId;

      // Duplicate attempt
      const pkg2 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "canonical_invoice_reupload.pdf",
        TENANT_A,
        { userId: "second-user" },
      );

      expect(pkg2.isDuplicate).toBe(true);
      expect(pkg2.referencedExistingDocument).toBeDefined();
      expect(pkg2.referencedExistingDocument?.documentId).toBe(originalDocId);
      expect(pkg2.referencedExistingDocument?.originalFilename).toBe("canonical_invoice.pdf");
      expect(pkg2.referencedExistingDocument?.uploadedBy).toBe("authoritative-uploader");

      // Verify that historical extraction runs from the existing document are referenced
      expect(pkg2.runHistory).toBeDefined();
      expect(pkg2.runHistory?.length).toBeGreaterThanOrEqual(1);
      expect(pkg2.currentRun?.documentId).toBe(originalDocId);
    });
  });

  describe("5. Audit Information Preservation", () => {
    it("should preserve immutable audit records for every duplicate upload attempt", async () => {
      const pkg1 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "audit_test.pdf",
        TENANT_A,
        { userId: "user-alpha" },
      );

      const originalDocId = pkg1.document.documentId;

      // Duplicate attempt 1
      const pkg2 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "audit_test_copy1.pdf",
        TENANT_A,
        { userId: "user-beta" },
      );

      expect(pkg2.duplicateAuditRecord).toBeDefined();
      expect(pkg2.duplicateAuditRecord?.originalDocumentId).toBe(originalDocId);
      expect(pkg2.duplicateAuditRecord?.attemptedFilename).toBe("audit_test_copy1.pdf");
      expect(pkg2.duplicateAuditRecord?.attemptedBy).toBe("user-beta");
      expect(pkg2.duplicateAuditRecord?.actionTaken).toBe("REFERENCED_EXISTING_DOCUMENT");
      expect(pkg2.duplicateAuditRecord?.financialRecordsSuppressed).toBe(true);
      expect(pkg2.duplicateAuditRecord?.attemptedAt).toBeDefined();

      // Duplicate attempt 2
      const pkg3 = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "audit_test_copy2.pdf",
        TENANT_A,
        { userId: "user-gamma" },
      );

      expect(pkg3.duplicateAuditRecord?.attemptedFilename).toBe("audit_test_copy2.pdf");
      expect(pkg3.duplicateAuditRecord?.attemptedBy).toBe("user-gamma");

      // Verify audit history queries
      const auditHistory = await DocumentIdempotencyService.getAuditHistory(
        originalDocId,
        TENANT_A,
      );

      expect(auditHistory).toHaveLength(2);
      expect(auditHistory[0].attemptedFilename).toBe("audit_test_copy2.pdf");
      expect(auditHistory[1].attemptedFilename).toBe("audit_test_copy1.pdf");

      // Verify parent document reflects metrics
      const originalRecord = await DocumentRegistryService.getDocumentById(originalDocId);
      expect(originalRecord?.duplicateAttemptsCount).toBe(2);
      expect(originalRecord?.lastDuplicateAttemptAt).toBeDefined();
    });
  });

  describe("6. Strict Tenant Isolation", () => {
    it("should not match duplicate documents across different organisations", async () => {
      // Tenant A uploads file
      const pkgTenantA = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "tenant_shared.pdf",
        TENANT_A,
      );

      expect(pkgTenantA.isDuplicate).toBeFalsy();
      const docIdA = pkgTenantA.document.documentId;

      // Tenant B uploads the EXACT SAME binary content
      const pkgTenantB = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "tenant_shared.pdf",
        TENANT_B,
      );

      // Must be evaluated as NEW for Tenant B, NOT duplicate of Tenant A!
      expect(pkgTenantB.isDuplicate).toBeFalsy();
      expect(pkgTenantB.document.documentId).not.toBe(docIdA);
      expect(pkgTenantB.document.organisationId).toBe(TENANT_B);
      expect(pkgTenantB.financialRecordsSuppressed).toBeFalsy();
    });
  });

  describe("7. Explicit Reprocessing vs Accidental Duplicate", () => {
    it("should allow reprocessDocument to execute new extraction run without being blocked as duplicate", async () => {
      // 1. Initial processing
      const pkgInitial = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "reprocess_test.pdf",
        TENANT_A,
      );

      const docId = pkgInitial.document.documentId;
      expect(pkgInitial.currentRun?.runId).toBeDefined();
      const firstRunId = pkgInitial.currentRun!.runId;

      // 2. Accidental upload attempt with same bytes -> blocked as duplicate
      const pkgDuplicate = await DocumentIntelligencePipeline.processDocument(
        bytes1,
        "reprocess_test.pdf",
        TENANT_A,
      );
      expect(pkgDuplicate.isDuplicate).toBe(true);

      // 3. Explicit reprocessing with updated extraction version
      const pkgReprocessed = await DocumentIntelligencePipeline.reprocessDocument(
        bytes1,
        "reprocess_test.pdf",
        TENANT_A,
        {
          documentId: docId,
          extractionVersion: "2.0.0",
        },
      );

      // Must NOT be blocked as duplicate
      expect(pkgReprocessed.isDuplicate).toBeFalsy();
      expect(pkgReprocessed.document.documentId).toBe(docId);
      expect(pkgReprocessed.currentRun?.extractionVersion).toBe("2.0.0");
      expect(pkgReprocessed.currentRun?.runId).not.toBe(firstRunId);
      expect(pkgReprocessed.runHistory?.length).toBe(2);
    });
  });
});
