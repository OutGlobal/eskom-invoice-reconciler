/**
 * STAGE 18 — TEST WITH REAL DOCUMENTS
 * ========================================================
 * Verifies document intelligence processing across at least:
 *  1. Native text PDF
 *  2. Scanned PDF (raster image XObject, zero text stream)
 *  3. Multi-page PDF (3+ distinct pages with boundary & page marker preservation)
 *  4. Invoice containing tables (tabular billing schedule with column alignment)
 *  5. Invoice containing TOU energy data (Peak/Standard/Off-Peak kWh and R charges)
 *  6. Poor-quality PDF (degraded OCR artifacts, missing core determinants)
 *  7. Corrupted PDF (corrupt magic header / truncated binary)
 *  8. Password-protected PDF (encrypted stream with /Encrypt dictionary)
 *  9. Duplicate PDF (cryptographically identical payload for idempotency)
 *  10. Large PDF (1+ MB payload to test throughput & memory boundaries)
 *
 * For each document type, tests all 8 lifecycle stages:
 *  Upload → Store → Register → Inspect → Extract → Classify → Persist → Display
 *
 * All test data strictly isolated under /fixtures and /tests. Zero prototype fallbacks in production paths.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PersistentDocumentIntelligenceService,
  type PersistedDocumentIntelligenceRecord,
} from "../../domain/intelligence/persistentDocumentIntelligenceService";
import { useApp } from "../../lib/store";
import { LocalWorkspaceStore } from "../../lib/localWorkspaceStore";
import {
  createNativeTextPdfBytes,
  createScannedPdfBytes,
  createMultiPagePdfBytes,
  createTableInvoicePdfBytes,
  createTouInvoicePdfBytes,
  createPoorQualityPdfBytes,
  createCorruptedPdfBytes,
  createPasswordProtectedPdfBytes,
  createDuplicatePdfBytes,
  createLargePdfBytes,
} from "../../fixtures/realDocumentFixtures";

function createUploadFile(
  name: string,
  bytes: Uint8Array,
): {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  return {
    name,
    size: bytes.length,
    type: "application/pdf",
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  };
}

describe("STAGE 18 — TEST WITH REAL DOCUMENTS", () => {
  const TEST_ORG = "org-eskom-reconciler-enterprise-01";
  const TEST_USER = "user-auditor-stage18";

  beforeEach(() => {
    // Reset Zustand store state before each test
    const store = useApp.getState();
    store.setInvoice(null);
    store.setCustomer({ name: "", meter: "", accountNumber: "", address: "", nmd: 0 });
    store.setRows([]);
    PersistentDocumentIntelligenceService.clearRuntimeCache();
    LocalWorkspaceStore.clearMemoryStore();
  });

  // =========================================================================
  // 1. Native Text PDF
  // =========================================================================
  describe("1. Native text PDF", () => {
    it("should process native text PDF through all 8 lifecycle stages", async () => {
      const bytes = createNativeTextPdfBytes();

      // 1. Upload
      const file = createUploadFile("eskom_native_tax_invoice.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);
      expect(file.name).toBe("eskom_native_tax_invoice.pdf");

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain(`documents/${TEST_ORG}/`);
      expect(record.storagePath).toContain("eskom_native_tax_invoice.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);
      expect(record.checksum).toBeDefined();
      expect(record.checksum.length).toBeGreaterThan(16);

      // 4. Inspect
      expect(record.inspection).toBeDefined();
      expect(record.inspection?.integrityValid).toBe(true);
      expect(record.inspection?.isEncrypted).toBe(false);
      expect(record.inspection?.appearsScanned).toBe(false);

      // 5. Extract
      expect(record.financialDeterminants).toBeDefined();
      expect(record.financialDeterminants?.accountNumber).toBe("1234567890");
      expect(record.financialDeterminants?.invoiceNumber).toBe("INV-2024-001");
      expect(record.financialDeterminants?.totalAmountDue).toBe(187450.25);
      expect(record.financialDeterminants?.activeEnergyKwh).toBe(45820);
      expect(record.pages.length).toBe(1);
      expect(record.pages[0].hasNativeText).toBe(true);

      // 6. Classify
      expect(record.classification?.category).toBe("UTILITY_INVOICE");
      expect(record.financialDeterminants?.tariffCode).toBe("MEGAFLEX_RURAL");
      expect(record.processingStatus).toBe("PROCESSED");
      expect(record.validationStatus).toBe("VALID");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted).toBeDefined();
      expect(persisted?.processingStatus).toBe("PROCESSED");
      expect((persisted?.metadata as any)?.financialDeterminants?.totalAmountDue).toBe(187450.25);

      // 8. Display
      const store = useApp.getState();
      expect(store.invoice?.accountNumber).toBe("1234567890");
      expect(store.invoice?.amountDue).toBe(187450.25);
      expect(store.invoice?.totalKwh).toBe(45820);
      expect(store.invoice?.tariffType).toBe("MEGAFLEX_RURAL");
    });
  });

  // =========================================================================
  // 2. Scanned PDF
  // =========================================================================
  describe("2. Scanned PDF (raster image XObject, zero text stream)", () => {
    it("should process scanned raster PDF and dispatch OCR handoff across all 8 stages", async () => {
      const bytes = createScannedPdfBytes();

      // 1. Upload
      const file = createUploadFile("eskom_scanned_meter_sheet.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_scanned_meter_sheet.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(record.inspection?.appearsScanned).toBe(true);
      expect(record.inspection?.isOcrLikelyRequired).toBe(true);
      expect(record.inspection?.pdfType).toBe("SCANNED_PDF");

      // 5. Extract
      expect(record.truthfulStage).toBe("OCR_DISPATCHED");
      expect(record.financialDeterminants).toBeUndefined(); // Zero hallucinated values

      // 6. Classify
      expect(record.processingStatus).toBe("REVIEW_REQUIRED");
      expect(record.validationStatus).toBe("REVIEW_REQUIRED");
      expect(record.reviewReason).toContain("OCR handoff required");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted?.processingStatus).toBe("REVIEW_REQUIRED");
      expect((persisted?.metadata as any)?.inspection?.appearsScanned).toBe(true);

      // 8. Display
      // UI alerted that OCR reconstruction is required; zero false data displayed
      expect(record.financialDeterminants).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Multi-page PDF
  // =========================================================================
  describe("3. Multi-page PDF (3+ distinct pages with boundary preservation)", () => {
    it("should extract and sequence all pages across all 8 lifecycle stages", async () => {
      const bytes = createMultiPagePdfBytes(3);

      // 1. Upload
      const file = createUploadFile("eskom_multipage_schedule.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_multipage_schedule.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(record.inspection?.integrityValid).toBe(true);
      expect(record.totalPages).toBe(3);

      // 5. Extract
      expect(record.pages.length).toBe(3);
      expect(record.pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
      expect(record.pages[0].rawText).toContain("ACCOUNT NUMBER");
      expect(record.pages[1].rawText).toContain("METER NUMBER");
      expect(record.pages[2].rawText).toContain("TARIFF: MEGAFLEX");

      // 6. Classify
      expect(record.classification?.category).toBe("UTILITY_INVOICE");
      expect(record.processingStatus).toBe("PROCESSED");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted?.pageCount).toBe(3);
      expect((persisted?.metadata as any)?.pages?.length).toBe(3);

      // 8. Display
      const store = useApp.getState();
      expect(store.invoice?.accountNumber).toBe("1234567890");
      expect(store.invoice?.amountDue).toBe(187450.25);
    });
  });

  // =========================================================================
  // 4. Invoice Containing Tables
  // =========================================================================
  describe("4. Invoice containing tables (tabular billing schedule)", () => {
    it("should detect tabular billing schedule and calculate line item totals across all 8 stages", async () => {
      const bytes = createTableInvoicePdfBytes();

      // 1. Upload
      const file = createUploadFile("eskom_table_invoice.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_table_invoice.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(record.inspection?.detectedTableCount).toBeGreaterThanOrEqual(1);

      // 5. Extract
      const tableField = record.extractedFields.find(
        (f) => f.fieldKey === "billing_schedule_table",
      );
      expect(tableField).toBeDefined();
      expect(tableField?.extractionMethod).toBe("Table Column Layout Analysis");
      expect(record.financialDeterminants?.totalAmountDue).toBe(191319.21);

      // 6. Classify
      expect(record.classification?.category).toBe("UTILITY_INVOICE");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted).toBeDefined();
      expect(
        (persisted?.metadata as any)?.extractedFields?.some(
          (f: any) => f.fieldKey === "billing_schedule_table",
        ),
      ).toBe(true);

      // 8. Display
      const store = useApp.getState();
      expect(store.invoice?.amountDue).toBe(191319.21);
    });
  });

  // =========================================================================
  // 5. Invoice Containing TOU Energy Data
  // =========================================================================
  describe("5. Invoice containing TOU energy data (Peak/Standard/Off-Peak breakdown)", () => {
    it("should extract Time-Of-Use determinants and R-charges across all 8 stages", async () => {
      const bytes = createTouInvoicePdfBytes();

      // 1. Upload
      const file = createUploadFile("eskom_tou_energy_invoice.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_tou_energy_invoice.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(record.inspection?.integrityValid).toBe(true);

      // 5. Extract
      const det = record.financialDeterminants;
      expect(det?.peakKwh).toBe(12500);
      expect(det?.standardKwh).toBe(22100);
      expect(det?.offPeakKwh).toBe(11220);
      expect(det?.peakCharge).toBe(83365.0);
      expect(det?.standardCharge).toBe(47603.4);
      expect(det?.offPeakCharge).toBe(12471.03);

      // 6. Classify
      expect(record.classification?.category).toBe("UTILITY_INVOICE");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect((persisted?.metadata as any)?.financialDeterminants?.peakKwh).toBe(12500);
      expect((persisted?.metadata as any)?.financialDeterminants?.standardKwh).toBe(22100);
      expect((persisted?.metadata as any)?.financialDeterminants?.offPeakKwh).toBe(11220);

      // 8. Display
      const store = useApp.getState();
      expect(store.invoice?.peakKwh).toBe(12500);
      expect(store.invoice?.standardKwh).toBe(22100);
      expect(store.invoice?.offPeakKwh).toBe(11220);
    });
  });

  // =========================================================================
  // 6. Poor-Quality PDF
  // =========================================================================
  describe("6. Poor-quality PDF (degraded OCR artifacts, missing core determinants)", () => {
    it("should flag poor quality document and require human review across all 8 stages", async () => {
      const bytes = createPoorQualityPdfBytes();

      // 1. Upload
      const file = createUploadFile("eskom_poor_quality_smudged.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_poor_quality_smudged.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(record.inspection?.integrityValid).toBe(true);

      // 5. Extract
      expect(record.financialDeterminants).toBeUndefined(); // Zero hallucinated figures

      // 6. Classify
      expect(record.processingStatus).toBe("REVIEW_REQUIRED");
      expect(record.truthfulStage).toBe("HUMAN_REVIEW");
      expect(record.reviewReason).toContain("Poor document quality");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted?.processingStatus).toBe("REVIEW_REQUIRED");
      expect((persisted?.metadata as any)?.truthfulStage).toBe("HUMAN_REVIEW");

      // 8. Display
      // Zero fake numbers displayed on dashboard
      expect(record.financialDeterminants).toBeUndefined();
    });
  });

  // =========================================================================
  // 7. Corrupted PDF
  // =========================================================================
  describe("7. Corrupted PDF (corrupt magic header / truncated binary)", () => {
    it("should fail gracefully with informative error across all 8 stages", async () => {
      const bytes = createCorruptedPdfBytes();

      // 1. Upload
      const file = createUploadFile("eskom_corrupted_stream.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_corrupted_stream.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(record.inspection?.integrityValid).toBe(false);

      // 5. Extract
      expect(record.pages.length).toBe(0);
      expect(record.financialDeterminants).toBeUndefined();

      // 6. Classify
      expect(record.processingStatus).toBe("FAILED");
      expect(record.validationStatus).toBe("INVALID");
      expect(record.truthfulStage).toBe("FAILED");
      expect(record.errorMessage).toContain("Corrupted PDF stream");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted?.processingStatus).toBe("FAILED");

      // 8. Display
      expect(record.errorMessage).toBeDefined();
    });
  });

  // =========================================================================
  // 8. Password-Protected PDF
  // =========================================================================
  describe("8. Password-protected PDF (encrypted stream with /Encrypt dictionary)", () => {
    it("should detect encryption and prevent unauthenticated extraction across all 8 stages", async () => {
      const bytes = createPasswordProtectedPdfBytes();

      // 1. Upload
      const file = createUploadFile("eskom_encrypted_locked.pdf", bytes);
      expect(file.size).toBeGreaterThan(0);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_encrypted_locked.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(record.inspection?.isEncrypted).toBe(true);

      // 5. Extract
      expect(record.pages.length).toBe(0);

      // 6. Classify
      expect(record.processingStatus).toBe("FAILED");
      expect(record.errorMessage).toContain("Password-protected PDF");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted?.processingStatus).toBe("FAILED");
      expect((persisted?.metadata as any)?.inspection?.isEncrypted).toBe(true);

      // 8. Display
      expect(record.errorMessage).toContain("Decryption required");
    });
  });

  // =========================================================================
  // 9. Duplicate PDF
  // =========================================================================
  describe("9. Duplicate PDF (cryptographically identical payload for idempotency)", () => {
    it("should detect duplicate document and maintain cryptographic idempotency across all 8 stages", async () => {
      // Step A: Ingest canonical document first
      const canonicalBytes = createNativeTextPdfBytes();
      const canonicalFile = createUploadFile("eskom_original_invoice.pdf", canonicalBytes);
      const canonicalRecord = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: canonicalFile,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 1. Upload duplicate
      const duplicateBytes = createDuplicatePdfBytes();
      const duplicateFile = createUploadFile("eskom_duplicate_upload.pdf", duplicateBytes);

      // Execution
      const duplicateRecord = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: duplicateFile,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(duplicateRecord.storagePath).toContain(TEST_ORG);

      // 3. Register
      expect(duplicateRecord.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);

      // 4. Inspect
      expect(duplicateRecord.checksum).toBe(canonicalRecord.checksum);

      // 5. Extract
      expect(duplicateRecord.financialDeterminants?.totalAmountDue).toBe(187450.25);

      // 6. Classify
      expect(duplicateRecord.isDuplicate).toBe(true);
      expect(duplicateRecord.truthfulStage).toBe("DUPLICATE_IDENTIFIED");
      expect(duplicateRecord.duplicateOfDocumentId).toBe(canonicalRecord.documentId);

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === duplicateRecord.documentId);
      expect(persisted).toBeDefined();

      // 8. Display
      expect(duplicateRecord.truthfulStage).toBe("DUPLICATE_IDENTIFIED");
    });
  });

  // =========================================================================
  // 10. Large PDF
  // =========================================================================
  describe("10. Large PDF (1+ MB payload to test throughput & memory boundaries)", () => {
    it("should ingest and parse 1+ MB PDF payload without exhaustion across all 8 stages", async () => {
      const bytes = createLargePdfBytes(1024);
      expect(bytes.byteLength).toBeGreaterThanOrEqual(1024 * 1024);

      // 1. Upload
      const file = createUploadFile("eskom_large_megabyte_invoice.pdf", bytes);
      expect(file.size).toBeGreaterThanOrEqual(1024 * 1024);

      // Execution
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file,
        organisationId: TEST_ORG,
        userId: TEST_USER,
      });

      // 2. Store
      expect(record.storagePath).toContain("eskom_large_megabyte_invoice.pdf");

      // 3. Register
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);
      expect(record.fileSizeBytes).toBeGreaterThanOrEqual(1024 * 1024);

      // 4. Inspect
      expect(record.inspection?.integrityValid).toBe(true);

      // 5. Extract
      expect(record.financialDeterminants?.totalAmountDue).toBe(187450.25);
      expect(record.financialDeterminants?.accountNumber).toBe("1234567890");

      // 6. Classify
      expect(record.classification?.category).toBe("UTILITY_INVOICE");

      // 7. Persist
      const uploads = await LocalWorkspaceStore.listUploads();
      const persisted = uploads.find((u) => u.id === record.documentId);
      expect(persisted?.fileSizeBytes).toBeGreaterThanOrEqual(1024 * 1024);

      // 8. Display
      const store = useApp.getState();
      expect(store.invoice?.amountDue).toBe(187450.25);
      expect(store.invoice?.accountNumber).toBe("1234567890");
    });
  });
});
