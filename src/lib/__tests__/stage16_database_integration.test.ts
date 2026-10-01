/**
 * STAGE 16 — DATABASE INTEGRATION TEST SUITE
 * ========================================================
 * Verifies that all document intelligence results are persistent in the database:
 *
 *   PDF uploaded
 *         ↓
 *  Supabase Storage
 *         ↓
 *  Document Registry
 *         ↓
 *     Processing
 *         ↓
 *      Database
 *         ↓
 *     Dashboard
 *
 * Requirements:
 *  1. All document intelligence results must be persistent.
 *  2. Do not store important processing results only in React state.
 *  3. Refreshing the browser must not destroy processing state.
 *  4. Logging out and back in must not destroy processing state.
 *  5. Tenant isolation must be strictly preserved.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PersistentDocumentIntelligenceService,
  type PersistedDocumentIntelligenceRecord,
} from "../../domain/intelligence/persistentDocumentIntelligenceService";
import { useApp } from "../../lib/store";
import { LocalWorkspaceStore } from "../../lib/localWorkspaceStore";
import { createFixtureInvoicePdfBytes } from "../../fixtures/documentIntelligenceFixtures";

// Mock synthetic PDF file for testing
function createMockPdf(name = "test_eskom_invoice.pdf"): {
  name: string;
  size: number;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
} {
  const bytes = createFixtureInvoicePdfBytes();
  return {
    name,
    size: bytes.length,
    type: "application/pdf",
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  };
}

describe("STAGE 16 — DATABASE INTEGRATION", () => {
  const TEST_ORG_A = "11111111-1111-1111-1111-111111111111";
  const TEST_ORG_B = "22222222-2222-2222-2222-222222222222";
  const TEST_USER = "user-auth-123";

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
  // 1. END-TO-END 6-STAGE FLOW VERIFICATION
  // =========================================================================
  describe("1. Architectural 6-Stage Flow", () => {
    it("should execute the mandatory 6-stage flow from PDF upload to Dashboard hydration", async () => {
      const mockPdf = createMockPdf("Eskom_Megaflex_March_2024.pdf");

      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: mockPdf,
        organisationId: TEST_ORG_A,
        userId: TEST_USER,
      });

      // Flow Stage 1 & 2: Supabase Storage path generated
      expect(record.storagePath).toContain(`documents/${TEST_ORG_A}/`);
      expect(record.storagePath).toContain(mockPdf.name);

      // Flow Stage 3: Document Registry ID & SHA-256 checksum
      expect(record.documentId).toMatch(/^DOC-[A-F0-9]{12}$/);
      expect(record.checksum).toBeDefined();
      expect(record.checksum.length).toBeGreaterThan(10);

      // Flow Stage 4: Processing Deterministic Extraction
      expect(record.processingStatus).toBe("PROCESSED");
      expect(record.validationStatus).toBe("VALID");
      expect(record.totalPages).toBeGreaterThanOrEqual(1);
      expect(record.pages.length).toBeGreaterThanOrEqual(1);
      expect(record.extractedFields.length).toBeGreaterThan(0);

      // Flow Stage 5: Database Persistence
      expect(record.financialDeterminants).toBeDefined();
      expect(record.financialDeterminants?.accountNumber).toBe("1234567890");
      expect(record.financialDeterminants?.totalAmountDue).toBe(187450.25);
      expect(record.financialDeterminants?.activeEnergyKwh).toBe(45820);
      expect(record.financialDeterminants?.tariffCode).toBe("MEGAFLEX_RURAL");

      // Flow Stage 6: Dashboard Hydration
      const store = useApp.getState();
      expect(store.invoice.accountNumber).toBe("1234567890");
      expect(store.invoice.amountDue).toBe(187450.25);
      expect(store.invoice.totalKwh).toBe(45820);
      expect(store.invoice.tariffType).toBe("MEGAFLEX_RURAL");
      expect(store.customer.accountNumber).toBe("1234567890");
    });
  });

  // =========================================================================
  // 2. PERSISTENCE NOT IN REACT STATE ONLY
  // =========================================================================
  describe("2. Durable Persistence (Not only in React state)", () => {
    it("should persist document intelligence records to durable storage and database", async () => {
      const mockPdf = createMockPdf("Eskom_Invoice_Q1.pdf");

      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: mockPdf,
        organisationId: TEST_ORG_A,
        userId: TEST_USER,
      });

      // Query durable workspace storage (L2 IndexedDB / Storage layer)
      const uploads = await LocalWorkspaceStore.listUploads();
      const persistedRecord = uploads.find((u) => u.id === record.documentId);

      expect(persistedRecord).toBeDefined();
      expect(persistedRecord?.id).toBe(record.documentId);
      expect(persistedRecord?.filename).toBe("Eskom_Invoice_Q1.pdf");
      expect(persistedRecord?.processingStatus).toBe("PROCESSED");
      expect((persistedRecord?.metadata as any)?.financialDeterminants?.totalAmountDue).toBe(187450.25);
    });
  });

  // =========================================================================
  // 3. BROWSER REFRESH SIMULATION (F5)
  // =========================================================================
  describe("3. Browser Refresh State Preservation", () => {
    it("must not destroy processing state when the browser is refreshed", async () => {
      const mockPdf = createMockPdf("Eskom_Refresh_Test.pdf");

      // Step 1: Initial upload and processing
      const originalRecord = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: mockPdf,
        organisationId: TEST_ORG_A,
        userId: TEST_USER,
      });

      // Verify initial store state
      expect(useApp.getState().invoice?.accountNumber).toBe("1234567890");

      // Step 2: SIMULATE BROWSER REFRESH (F5)
      // Wiping out all volatile React state & memory cache:
      const store = useApp.getState();
      store.setInvoice(null);
      store.setCustomer({ name: "", meter: "", accountNumber: "", address: "", nmd: 0 });
      store.setRows([]);
      PersistentDocumentIntelligenceService.clearRuntimeCache();
      expect(useApp.getState().invoice).toBeNull();

      // Step 3: Trigger Rehydration as executed on page mount / refresh
      const rehydrated = await PersistentDocumentIntelligenceService.rehydrateOnSessionStart(TEST_ORG_A);
      expect(rehydrated).toBe(true);

      // Step 4: Verify complete processing state restored from persistent database
      const refreshedStore = useApp.getState();
      expect(refreshedStore.invoice?.accountNumber).toBe("1234567890");
      expect(refreshedStore.invoice?.amountDue).toBe(187450.25);
      expect(refreshedStore.invoice?.totalKwh).toBe(45820);
      expect(refreshedStore.invoice?.tariffType).toBe("MEGAFLEX_RURAL");
      expect(refreshedStore.customer.accountNumber).toBe("1234567890");

      // Also verify direct document state loader returns full details
      const directLoaded = await PersistentDocumentIntelligenceService.loadPersistedDocumentState(
        originalRecord.documentId,
        TEST_ORG_A,
      );
      expect(directLoaded).not.toBeNull();
      expect(directLoaded?.processingStatus).toBe("PROCESSED");
      expect(directLoaded?.pages.length).toBeGreaterThan(0);
      expect(directLoaded?.extractedFields.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. LOGOUT & LOGIN SIMULATION
  // =========================================================================
  describe("4. Logout and Login Session State Preservation", () => {
    it("must preserve processing state across user logout and re-authentication", async () => {
      const mockPdf = createMockPdf("Eskom_Session_Persistence.pdf");

      // Step 1: Process document while logged in as User A in Org A
      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: mockPdf,
        organisationId: TEST_ORG_A,
        userId: "user-alpha",
      });

      expect(record.processingStatus).toBe("PROCESSED");

      // Step 2: SIMULATE LOGOUT
      // User logs out -> session terminated, React store wiped, runtime cache cleared
      useApp.getState().setInvoice(null);
      useApp.getState().setCustomer({ name: "", meter: "", accountNumber: "", address: "", nmd: 0 });
      PersistentDocumentIntelligenceService.clearRuntimeCache();
      expect(useApp.getState().invoice).toBeNull();

      // Step 3: SIMULATE LOGIN
      // User logs back in to Org A -> rehydration on session start
      const success = await PersistentDocumentIntelligenceService.rehydrateOnSessionStart(TEST_ORG_A);
      expect(success).toBe(true);

      // Step 4: Verify processing state is fully intact
      const store = useApp.getState();
      expect(store.invoice?.accountNumber).toBe("1234567890");
      expect(store.invoice?.amountDue).toBe(187450.25);
      expect(store.invoice?.tariffType).toBe("MEGAFLEX_RURAL");
    });
  });

  // =========================================================================
  // 5. TENANT ISOLATION
  // =========================================================================
  describe("5. Multi-Tenant Isolation", () => {
    it("must not allow another organisation to load persisted document intelligence", async () => {
      const mockPdf = createMockPdf("Eskom_Tenant_Isolated.pdf");

      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: mockPdf,
        organisationId: TEST_ORG_A,
        userId: "user-alpha",
      });

      // Tenant B attempts to load Tenant A's document
      const unauthorizedAccess = await PersistentDocumentIntelligenceService.loadPersistedDocumentState(
        record.documentId,
        TEST_ORG_B, // Wrong organisation ID!
      );

      expect(unauthorizedAccess).toBeNull();
    });
  });

  // =========================================================================
  // 6. SPATIAL PROVENANCE & DETERMINANT COMPLETENESS
  // =========================================================================
  describe("6. Extracted Determinants & Provenance Completeness", () => {
    it("should preserve bounding box spatial models and extraction confidence", async () => {
      const mockPdf = createMockPdf("Eskom_Provenance.pdf");

      const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
        file: mockPdf,
        organisationId: TEST_ORG_A,
        userId: TEST_USER,
      });

      expect(record.extractedFields.length).toBeGreaterThan(0);

      // Check account number field
      const accountField = record.extractedFields.find((f) => f.fieldKey === "account_number");
      expect(accountField).toBeDefined();
      expect(accountField?.value).toBe("1234567890");
      expect(accountField?.confidenceScore).toBeGreaterThanOrEqual(0.95);
      expect(accountField?.hasExactBoundingBox).toBe(true);
      expect(accountField?.boundingBox).toEqual([15, 20, 35, 5]);

      // Check total amount due field
      const totalField = record.extractedFields.find((f) => f.fieldKey === "total_amount_due");
      expect(totalField).toBeDefined();
      expect(totalField?.value).toBe(187450.25);
      expect(totalField?.unit).toBe("ZAR");
      expect(totalField?.confidenceScore).toBeGreaterThanOrEqual(0.95);

      // Check billing period field
      const periodField = record.extractedFields.find((f) => f.fieldKey === "billing_period");
      expect(periodField).toBeDefined();
      expect(periodField?.hasExactBoundingBox).toBe(false); // Truthful: bounding box pending OCR
    });
  });
});
