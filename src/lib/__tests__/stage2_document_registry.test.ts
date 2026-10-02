/**
 * STAGE 2 — DOCUMENT REGISTRY TEST SUITE
 * ========================================================
 * Validates the persistent document registry architecture:
 *
 * 1. Capture of all 21 Minimum Required Fields:
 *    - document ID
 *    - organisation/tenant ID
 *    - uploaded by
 *    - original filename
 *    - storage path
 *    - file size
 *    - MIME type
 *    - detected file type
 *    - upload timestamp
 *    - processing status
 *    - processing started timestamp
 *    - processing completed timestamp
 *    - page count
 *    - document classification
 *    - extraction status
 *    - OCR status
 *    - validation status
 *    - error status
 *    - checksum/hash
 *    - created timestamp
 *    - updated timestamp
 *
 * 2. Deduplication and Table Reuse:
 *    - Adapts authoritative public.uploads and provides public.document_registry canonical view
 *    - Bi-directional interoperability between UploadRecord and DocumentRegistryRecord
 *
 * 3. Tenant Isolation & Security:
 *    - RLS tenant partitioning & Super Admin override
 *
 * 4. End-to-End Pipeline Integration:
 *    - DocumentIntelligencePipeline integration with persistent DocumentRegistryService
 */

import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DocumentRegistryService,
  type CreateDocumentRegistryInput,
} from "../../domain/intelligence/documentRegistryService";
import {
  DocumentLifecycleManager,
  DocumentIntelligencePipeline,
  type DocumentRegistryRecord,
} from "../../domain/intelligence";
import { TenantIsolationViolationError } from "../../domain/security/tenantContextService";
import type { UserSecurityContext } from "../../domain/security/types";
import { UploadStorageService } from "../../domain/upload/uploadStorageService";

describe("Stage 2 — Document Registry Architecture & Persistence Suite", () => {
  const TEST_ORG_A = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c";
  const TEST_ORG_B = "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d";
  const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

  const userContextA: UserSecurityContext = {
    userId: TEST_USER_ID,
    organisationId: TEST_ORG_A,
    role: "ENERGY_MANAGER",
    permissions: ["INVOICES_READ", "INVOICES_WRITE"],
  };

  const userContextB: UserSecurityContext = {
    userId: "00000000-0000-0000-0000-000000000002",
    organisationId: TEST_ORG_B,
    role: "ENERGY_MANAGER",
    permissions: ["INVOICES_READ", "INVOICES_WRITE"],
  };

  const superAdminContext: UserSecurityContext = {
    userId: "00000000-0000-0000-0000-000000000000",
    organisationId: TEST_ORG_A,
    role: "SUPER_ADMIN",
    permissions: ["*"],
  };

  beforeEach(() => {
    DocumentRegistryService.clearCache();
    DocumentLifecycleManager.clear();
    UploadStorageService.clearCache();
  });

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

  // 1. MINIMUM 21 CAPTURED FIELDS VALIDATION
  describe("1. Minimum 21 Foundational Fields Validation", () => {
    it("captures all 21 minimum required fields with strict type safety", async () => {
      const docId = crypto.randomUUID();
      const testSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const now = new Date().toISOString();

      const input: CreateDocumentRegistryInput = {
        documentId: docId,
        organisationId: TEST_ORG_A,
        uploadedBy: TEST_USER_ID,
        originalFilename: "eskom_invoice_january_2026.pdf",
        storagePath: `tenants/${TEST_ORG_A}/documents/${docId}/eskom_invoice_january_2026.pdf`,
        fileSize: 524288,
        mimeType: "application/pdf",
        detectedFileType: "PDF_DIGITAL",
        uploadTimestamp: now,
        processingStatus: "UPLOADED",
        processingStartedTimestamp: now,
        processingCompletedTimestamp: null,
        pageCount: 2,
        documentClassification: "ESKOM_MEGAFLEX_INVOICE",
        extractionStatus: "PENDING",
        ocrStatus: "NOT_REQUIRED",
        validationStatus: "PENDING",
        errorStatus: "NONE",
        checksum: testSha256,
      };

      const doc: DocumentRegistryRecord = await DocumentRegistryService.registerDocument(input);

      // Verify all 21 minimum fields individually
      // 1. document ID
      expect(doc.documentId).toBe(docId);
      // 2. organisation/tenant ID
      expect(doc.organisationId).toBe(TEST_ORG_A);
      // 3. uploaded by
      expect(doc.uploadedBy).toBe(TEST_USER_ID);
      // 4. original filename
      expect(doc.originalFilename).toBe("eskom_invoice_january_2026.pdf");
      // 5. storage path
      expect(doc.storagePath).toBe(
        `tenants/${TEST_ORG_A}/documents/${docId}/eskom_invoice_january_2026.pdf`,
      );
      // 6. file size
      expect(doc.fileSize).toBe(524288);
      // 7. MIME type
      expect(doc.mimeType).toBe("application/pdf");
      // 8. detected file type
      expect(doc.detectedFileType).toBe("PDF_DIGITAL");
      // 9. upload timestamp
      expect(doc.uploadTimestamp).toBe(now);
      // 10. processing status
      expect(doc.processingStatus).toBe("UPLOADED");
      // 11. processing started timestamp
      expect(doc.processingStartedTimestamp).toBe(now);
      // 12. processing completed timestamp
      expect(doc.processingCompletedTimestamp).toBeNull();
      // 13. page count
      expect(doc.pageCount).toBe(2);
      // 14. document classification
      expect(doc.documentClassification).toBe("ESKOM_MEGAFLEX_INVOICE");
      // 15. extraction status
      expect(doc.extractionStatus).toBe("PENDING");
      // 16. OCR status
      expect(doc.ocrStatus).toBe("NOT_REQUIRED");
      // 17. validation status
      expect(doc.validationStatus).toBe("PENDING");
      // 18. error status
      expect(doc.errorStatus).toBe("NONE");
      // 19. checksum/hash
      expect(doc.checksum).toBe(testSha256);
      // 20. created timestamp
      expect(doc.createdTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // 21. updated timestamp
      expect(doc.updatedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("updates lifecycle statuses, timestamps, page count, and classification accurately", async () => {
      const docId = crypto.randomUUID();
      const initial = await DocumentRegistryService.registerDocument({
        documentId: docId,
        organisationId: TEST_ORG_A,
        originalFilename: "tariff_doc.pdf",
        storagePath: `tenants/${TEST_ORG_A}/documents/${docId}/tariff_doc.pdf`,
        fileSize: 1048576,
        checksum: "abc123sha256",
      });

      expect(initial.processingStatus).toBe("UPLOADED");
      expect(initial.pageCount).toBe(0);

      const completionTime = new Date().toISOString();
      const updated = await DocumentRegistryService.updateDocument(docId, {
        processingStatus: "READY_FOR_VALIDATION",
        pageCount: 5,
        documentClassification: "ESKOM_MINIFLEX_INVOICE",
        extractionStatus: "COMPLETED",
        ocrStatus: "NOT_REQUIRED",
        validationStatus: "VALID",
        errorStatus: "NONE",
        processingCompletedTimestamp: completionTime,
      });

      expect(updated.processingStatus).toBe("READY_FOR_VALIDATION");
      expect(updated.pageCount).toBe(5);
      expect(updated.documentClassification).toBe("ESKOM_MINIFLEX_INVOICE");
      expect(updated.extractionStatus).toBe("COMPLETED");
      expect(updated.validationStatus).toBe("VALID");
      expect(updated.processingCompletedTimestamp).toBe(completionTime);
      expect(new Date(updated.updatedTimestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(initial.createdTimestamp).getTime(),
      );
    });
  });

  // 2. TENANT ISOLATION & ACCESS CONTROL
  describe("2. Tenant Isolation & Access Control", () => {
    it("restricts document retrieval to the authenticated tenant organisation", async () => {
      const docId = crypto.randomUUID();
      await DocumentRegistryService.registerDocument({
        documentId: docId,
        organisationId: TEST_ORG_A,
        originalFilename: "org_a_invoice.pdf",
        storagePath: `tenants/${TEST_ORG_A}/documents/${docId}/org_a_invoice.pdf`,
        fileSize: 1000,
        checksum: "hash_org_a",
      });

      // Tenant A can retrieve their own document
      const docA = await DocumentRegistryService.getDocumentById(docId, userContextA);
      expect(docA).not.toBeNull();
      expect(docA?.documentId).toBe(docId);

      // Tenant B is strictly forbidden from accessing Tenant A's document
      await expect(DocumentRegistryService.getDocumentById(docId, userContextB)).rejects.toThrow(
        TenantIsolationViolationError,
      );

      // Super Admin can retrieve documents across any tenant
      const docSuper = await DocumentRegistryService.getDocumentById(docId, superAdminContext);
      expect(docSuper).not.toBeNull();
      expect(docSuper?.documentId).toBe(docId);
    });

    it("filters document listings strictly by tenant organisation", async () => {
      const docA1 = crypto.randomUUID();
      const docA2 = crypto.randomUUID();
      const docB1 = crypto.randomUUID();

      await DocumentRegistryService.registerDocument({
        documentId: docA1,
        organisationId: TEST_ORG_A,
        originalFilename: "a1.pdf",
        storagePath: `path/a1`,
        fileSize: 100,
        checksum: "hash_a1",
      });

      await DocumentRegistryService.registerDocument({
        documentId: docA2,
        organisationId: TEST_ORG_A,
        originalFilename: "a2.pdf",
        storagePath: `path/a2`,
        fileSize: 200,
        checksum: "hash_a2",
      });

      await DocumentRegistryService.registerDocument({
        documentId: docB1,
        organisationId: TEST_ORG_B,
        originalFilename: "b1.pdf",
        storagePath: `path/b1`,
        fileSize: 300,
        checksum: "hash_b1",
      });

      // Tenant A list
      const listA = await DocumentRegistryService.listDocuments({}, userContextA);
      expect(listA.map((d) => d.documentId)).toContain(docA1);
      expect(listA.map((d) => d.documentId)).toContain(docA2);
      expect(listA.map((d) => d.documentId)).not.toContain(docB1);

      // Tenant B list
      const listB = await DocumentRegistryService.listDocuments({}, userContextB);
      expect(listB.map((d) => d.documentId)).toContain(docB1);
      expect(listB.map((d) => d.documentId)).not.toContain(docA1);
      expect(listB.map((d) => d.documentId)).not.toContain(docA2);
    });
  });

  // 3. TABLE DEDUPLICATION & COMPATIBILITY
  describe("3. Table Deduplication & Bidirectional Interoperability", () => {
    it("bridges UploadRecord and DocumentRegistryRecord seamlessly without duplicating storage tables", () => {
      const uploadId = crypto.randomUUID();
      const now = new Date().toISOString();

      const uploadRecord = {
        id: uploadId,
        organisationId: TEST_ORG_A,
        userId: TEST_USER_ID,
        uploadedBy: TEST_USER_ID,
        filename: "meter_readings_jan.csv",
        originalFilename: "meter_readings_jan.csv",
        fileType: "CSV_INTERVAL_DATA" as const,
        detectedFileType: "CSV_INTERVAL_DATA",
        fileSizeBytes: 204800,
        fileSize: 204800,
        mimeType: "text/csv",
        fileHashSha256: "sha256_csv_sample",
        checksum: "sha256_csv_sample",
        storageLocation: `tenants/${TEST_ORG_A}/uploads/${uploadId}/meter_readings_jan.csv`,
        storagePath: `tenants/${TEST_ORG_A}/uploads/${uploadId}/meter_readings_jan.csv`,
        processingStatus: "PROCESSED" as const,
        processingStart: now,
        processingStartedTimestamp: now,
        processingCompletion: now,
        processingCompletedTimestamp: now,
        rowCount: 2976,
        recordCount: 2976,
        pageCount: 0,
        documentClassification: "AMR_INTERVAL_REPORT",
        extractionStatus: "COMPLETED",
        ocrStatus: "NOT_REQUIRED",
        validationStatus: "VALID" as const,
        errorStatus: "NONE" as const,
        errorMessage: null,
        metadata: {},
        uploadTimestamp: now,
        createdTimestamp: now,
        updatedTimestamp: now,
        createdAt: now,
        updatedAt: now,
      };

      // Convert UploadRecord -> DocumentRegistryRecord
      const docRecord = DocumentRegistryService.syncFromUploadRecord(uploadRecord);
      expect(docRecord.documentId).toBe(uploadId);
      expect(docRecord.originalFilename).toBe("meter_readings_jan.csv");
      expect(docRecord.storagePath).toBe(uploadRecord.storageLocation);
      expect(docRecord.fileSize).toBe(204800);
      expect(docRecord.checksum).toBe("sha256_csv_sample");
      expect(docRecord.validationStatus).toBe("VALID");

      // Convert DocumentRegistryRecord -> UploadRecord
      const syncedBack = DocumentRegistryService.syncToUploadRecord(docRecord);
      expect(syncedBack.id).toBe(uploadId);
      expect(syncedBack.filename).toBe("meter_readings_jan.csv");
      expect(syncedBack.fileSizeBytes).toBe(204800);
      expect(syncedBack.fileHashSha256).toBe("sha256_csv_sample");
      expect(syncedBack.storageLocation).toBe(uploadRecord.storageLocation);
    });

    it("confirms database migration adapts public.uploads without creating redundant duplicate tables", () => {
      const rootDir = process.cwd();
      const migrationFile = path.resolve(
        rootDir,
        "supabase/migrations/20260926000000_stage2_persistent_document_registry.sql",
      );

      expect(fs.existsSync(migrationFile)).toBe(true);
      const sqlContent = fs.readFileSync(migrationFile, "utf-8");

      // Verify adaptation of public.uploads
      expect(sqlContent).toMatch(/ALTER TABLE IF EXISTS public\.uploads/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS uploaded_by UUID/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS original_filename TEXT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS storage_path TEXT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS file_size BIGINT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS mime_type TEXT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS detected_file_type TEXT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS upload_timestamp TIMESTAMPTZ/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS page_count INT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS document_classification TEXT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS extraction_status TEXT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS ocr_status TEXT/i);
      expect(sqlContent).toMatch(/ADD COLUMN IF NOT EXISTS checksum TEXT/i);

      // Verify canonical VIEW with transparent INSTEAD OF triggers
      expect(sqlContent).toMatch(/CREATE OR REPLACE VIEW public\.document_registry/i);
      expect(sqlContent).toMatch(/INSTEAD OF INSERT ON public\.document_registry/i);
      expect(sqlContent).toMatch(/INSTEAD OF UPDATE ON public\.document_registry/i);
      expect(sqlContent).toMatch(/INSTEAD OF DELETE ON public\.document_registry/i);

      // Ensure no duplicate physical table is created
      expect(sqlContent).not.toMatch(/CREATE TABLE IF NOT EXISTS public\.document_registry\s*\(/i);
    });
  });

  // 4. END-TO-END PIPELINE INTEGRATION
  describe("4. End-to-End Intelligence Pipeline Integration", () => {
    it("automatically populates all 21 document registry fields when processing a PDF invoice", async () => {
      const bytes = createMockPdfBytes(sampleMegaflexContent);

      const pkg = await DocumentIntelligencePipeline.processDocument(
        bytes,
        "apex_industries_megaflex_jan2026.pdf",
        TEST_ORG_A,
        {
          userId: TEST_USER_ID,
          skipStorageUpload: true,
        },
      );

      const doc = pkg.document;

      // 1. document ID
      expect(doc.documentId).toBeDefined();
      expect(doc.documentId.length).toBeGreaterThan(10);

      // 2. organisation/tenant ID
      expect(doc.organisationId).toBe(TEST_ORG_A);

      // 3. uploaded by
      expect(doc.uploadedBy).toBe(TEST_USER_ID);

      // 4. original filename
      expect(doc.originalFilename).toBe("apex_industries_megaflex_jan2026.pdf");

      // 5. storage path
      expect(doc.storagePath).toContain(`tenants/${TEST_ORG_A}/documents/`);
      expect(doc.storagePath).toContain("apex_industries_megaflex_jan2026.pdf");

      // 6. file size
      expect(doc.fileSize).toBe(bytes.byteLength);
      expect(doc.fileSize).toBeGreaterThan(500);

      // 7. MIME type
      expect(doc.mimeType).toBe("application/pdf");

      // 8. detected file type
      expect(doc.detectedFileType).toBe("PDF_DIGITAL");

      // 9. upload timestamp
      expect(doc.uploadTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // 10. processing status
      expect(doc.processingStatus).toBe("READY_FOR_VALIDATION");

      // 11. processing started timestamp
      expect(doc.processingStartedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // 12. processing completed timestamp
      expect(doc.processingCompletedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // 13. page count
      expect(doc.pageCount).toBe(2);

      // 14. document classification
      expect(["UTILITY_INVOICE", "ESKOM_MEGAFLEX_INVOICE"]).toContain(doc.documentClassification);

      // 15. extraction status
      expect(doc.extractionStatus).toBe("COMPLETED");

      // 16. OCR status
      expect(doc.ocrStatus).toBe("NOT_REQUIRED");

      // 17. validation status
      expect(doc.validationStatus).toBe("VALID");

      // 18. error status
      expect(doc.errorStatus).toBe("NONE");

      // 19. checksum/hash
      expect(doc.checksum).toMatch(/^[a-f0-9]{64}$|^sha256_/);

      // 20. created timestamp
      expect(doc.createdTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // 21. updated timestamp
      expect(doc.updatedTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Verify record is retrievable via DocumentRegistryService
      const retrieved = await DocumentRegistryService.getDocumentById(doc.documentId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.documentId).toBe(doc.documentId);
      expect(retrieved?.processingStatus).toBe("READY_FOR_VALIDATION");
      expect(retrieved?.pageCount).toBe(2);
      expect(["UTILITY_INVOICE", "ESKOM_MEGAFLEX_INVOICE"]).toContain(
        retrieved?.documentClassification,
      );
    });

    it("registers scanned PDF requiring OCR with ocrStatus=QUEUED and processingStatus=REVIEW_REQUIRED", async () => {
      const scannedPdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Img1 4 0 R >> >> >>\nendobj\n4 0 obj\n<< /Type /XObject /Subtype /Image /Width 1000 /Height 1400 /ColorSpace /DeviceRGB /BitsPerComponent 8 >>\nstream\n[RAW_IMAGE_BYTES]\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`;
      const scannedBytes = new TextEncoder().encode(scannedPdf);

      const pkg = await DocumentIntelligencePipeline.processDocument(
        scannedBytes,
        "scanned_eskom_invoice.pdf",
        TEST_ORG_A,
        {
          userId: TEST_USER_ID,
          skipStorageUpload: true,
        },
      );

      const doc = pkg.document;
      expect(doc.detectedFileType).toBe("PDF_SCANNED");
      expect(doc.ocrStatus).toBe("QUEUED");
      expect(doc.processingStatus).toBe("REVIEW_REQUIRED");
      expect(doc.validationStatus).toBe("REVIEW_REQUIRED");
      expect(doc.errorStatus).toBe("WARNING");
    });
  });
});
