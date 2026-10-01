/**
 * STAGE 16 — DATABASE INTEGRATION TEST RUNNER
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

import {
  PersistentDocumentIntelligenceService,
  type PersistedDocumentIntelligenceRecord,
} from "../../domain/intelligence/persistentDocumentIntelligenceService";
import { useApp } from "../../lib/store";
import { LocalWorkspaceStore } from "../../lib/localWorkspaceStore";
import { createFixtureInvoicePdfBytes } from "../../fixtures/documentIntelligenceFixtures";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`STAGE 16 TEST FAILED: ${message}`);
  }
}

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

async function runStage16TestSuite() {
  console.log("=========================================================");
  console.log("  STAGE 16 — DATABASE INTEGRATION VERIFICATION SUITE");
  console.log("=========================================================\n");

  const TEST_ORG_A = "11111111-1111-1111-1111-111111111111";
  const TEST_ORG_B = "22222222-2222-2222-2222-222222222222";
  const TEST_USER = "user-auth-123";

  let passed = 0;

  // -------------------------------------------------------------------------
  // Test 1: Architectural 6-Stage Flow
  // -------------------------------------------------------------------------
  console.log("--- Test 1: Mandatory 6-Stage Flow Execution ---");
  const mockPdf = createMockPdf("Eskom_Megaflex_March_2024.pdf");

  const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
    file: mockPdf,
    organisationId: TEST_ORG_A,
    userId: TEST_USER,
  });

  // Stage 1 & 2: Supabase Storage path
  assert(
    record.storagePath.includes(`documents/${TEST_ORG_A}/`) && record.storagePath.includes(mockPdf.name),
    "Supabase Storage path contains organisationId and filename",
  );

  // Stage 3: Document Registry ID & SHA-256 checksum
  assert(/^DOC-[A-F0-9]{12}$/.test(record.documentId), "Authoritative Document Registry ID format (DOC-XXXXXXXXXXXX)");
  assert(typeof record.checksum === "string" && record.checksum.length >= 16, "Cryptographic checksum generated");

  // Stage 4: Processing Deterministic Extraction
  assert(record.processingStatus === "PROCESSED", "Processing status reached PROCESSED");
  assert(record.validationStatus === "VALID", "Validation status reached VALID");
  assert(record.totalPages >= 1, "Page count extracted");
  assert(record.pages.length >= 1, "Pages array populated");
  assert(record.extractedFields.length > 0, "Extracted determinant fields populated");

  // Stage 5: Database Persistence
  assert(record.financialDeterminants !== undefined, "Financial determinants payload created");
  assert(record.financialDeterminants?.accountNumber === "1234567890", "Account number extracted");
  assert(record.financialDeterminants?.totalAmountDue === 187450.25, "Total amount due extracted");
  assert(record.financialDeterminants?.activeEnergyKwh === 45820, "Total energy consumption extracted");
  assert(record.financialDeterminants?.tariffCode === "MEGAFLEX_RURAL", "Tariff code extracted");

  // Stage 6: Dashboard Hydration
  const store = useApp.getState();
  assert(store.invoice?.accountNumber === "1234567890", "Store invoice accountNumber hydrated");
  assert(store.invoice?.amountDue === 187450.25, "Store invoice amountDue hydrated");
  assert(store.invoice?.totalKwh === 45820, "Store invoice totalKwh hydrated");
  assert(store.invoice?.tariffType === "MEGAFLEX_RURAL", "Store invoice tariffType hydrated");
  assert(store.customer.accountNumber === "1234567890", "Customer summary hydrated");

  console.log("✅ TEST 1 PASSED: Complete 6-Stage Flow executed successfully\n");
  passed++;

  // -------------------------------------------------------------------------
  // Test 2: Durable Persistence (Not only in React state)
  // -------------------------------------------------------------------------
  console.log("--- Test 2: Durable Persistence (Not only in React state) ---");
  const mockPdf2 = createMockPdf("Eskom_Invoice_Q1.pdf");

  const record2 = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
    file: mockPdf2,
    organisationId: TEST_ORG_A,
    userId: TEST_USER,
  });

  const uploads = await LocalWorkspaceStore.listUploads();
  const persistedRecord = uploads.find((u) => u.id === record2.documentId);

  assert(persistedRecord !== undefined, "Record found in durable workspace store");
  assert(persistedRecord?.id === record2.documentId, "Persisted record ID matches document ID");
  assert(persistedRecord?.filename === "Eskom_Invoice_Q1.pdf", "Persisted filename matches");
  assert(persistedRecord?.processingStatus === "PROCESSED", "Persisted status is PROCESSED");
  assert(
    (persistedRecord?.metadata as any)?.financialDeterminants?.totalAmountDue === 187450.25,
    "Financial determinants persisted into metadata payload",
  );

  console.log("✅ TEST 2 PASSED: Processing results persisted to durable store\n");
  passed++;

  // -------------------------------------------------------------------------
  // Test 3: Browser Refresh State Preservation (F5)
  // -------------------------------------------------------------------------
  console.log("--- Test 3: Browser Refresh State Preservation (F5) ---");
  const mockPdfRefresh = createMockPdf("Eskom_Refresh_Test.pdf");

  const refreshRecord = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
    file: mockPdfRefresh,
    organisationId: TEST_ORG_A,
    userId: TEST_USER,
  });

  assert(useApp.getState().invoice?.accountNumber === "1234567890", "Store initialised before refresh");

  // SIMULATE BROWSER REFRESH (F5):
  // All volatile React memory state and runtime cache are wiped
  useApp.getState().setInvoice(null);
  useApp.getState().setCustomer({ name: "", meter: "", accountNumber: "", address: "", nmd: 0 });
  useApp.getState().setRows([]);
  PersistentDocumentIntelligenceService.clearRuntimeCache();
  assert(useApp.getState().invoice === null, "React store cleared to simulate refresh");

  // Rehydrate on page load / refresh
  const rehydrated = await PersistentDocumentIntelligenceService.rehydrateOnSessionStart(TEST_ORG_A);
  assert(rehydrated === true, "rehydrateOnSessionStart returned true");

  const refreshedStore = useApp.getState();
  assert(refreshedStore.invoice?.accountNumber === "1234567890", "Restored accountNumber after refresh");
  assert(refreshedStore.invoice?.amountDue === 187450.25, "Restored amountDue after refresh");
  assert(refreshedStore.invoice?.totalKwh === 45820, "Restored totalKwh after refresh");
  assert(refreshedStore.invoice?.tariffType === "MEGAFLEX_RURAL", "Restored tariffType after refresh");
  assert(refreshedStore.customer.accountNumber === "1234567890", "Restored customer after refresh");

  const directLoaded = await PersistentDocumentIntelligenceService.loadPersistedDocumentState(
    refreshRecord.documentId,
    TEST_ORG_A,
  );
  assert(directLoaded !== null, "Direct document loader succeeded");
  assert(directLoaded?.processingStatus === "PROCESSED", "Direct document status is PROCESSED");
  assert(directLoaded?.pages.length > 0, "Direct document pages restored");
  assert(directLoaded?.extractedFields.length > 0, "Direct document extracted fields restored");

  console.log("✅ TEST 3 PASSED: Browser refresh does not destroy processing state\n");
  passed++;

  // -------------------------------------------------------------------------
  // Test 4: Logout and Login Session State Preservation
  // -------------------------------------------------------------------------
  console.log("--- Test 4: Logout and Login Session State Preservation ---");
  const mockPdfSession = createMockPdf("Eskom_Session_Persistence.pdf");

  const sessionRecord = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
    file: mockPdfSession,
    organisationId: TEST_ORG_A,
    userId: "user-alpha",
  });

  assert(sessionRecord.processingStatus === "PROCESSED", "Document processed in user session");

  // SIMULATE LOGOUT:
  // User signs out -> session cleared, React store wiped, runtime cache cleared
  useApp.getState().setInvoice(null);
  useApp.getState().setCustomer({ name: "", meter: "", accountNumber: "", address: "", nmd: 0 });
  PersistentDocumentIntelligenceService.clearRuntimeCache();
  assert(useApp.getState().invoice === null, "React store wiped on logout");

  // SIMULATE LOGIN:
  // User logs back in -> rehydration on session start for Org A
  const sessionRehydrated = await PersistentDocumentIntelligenceService.rehydrateOnSessionStart(TEST_ORG_A);
  assert(sessionRehydrated === true, "Session rehydration succeeded on login");

  const loggedInStore = useApp.getState();
  assert(loggedInStore.invoice?.accountNumber === "1234567890", "Processing state intact after login");
  assert(loggedInStore.invoice?.amountDue === 187450.25, "Financial amount due intact after login");
  assert(loggedInStore.invoice?.tariffType === "MEGAFLEX_RURAL", "Tariff code intact after login");

  console.log("✅ TEST 4 PASSED: Logging out and in does not destroy processing state\n");
  passed++;

  // -------------------------------------------------------------------------
  // Test 5: Multi-Tenant Isolation
  // -------------------------------------------------------------------------
  console.log("--- Test 5: Multi-Tenant Isolation ---");
  const mockPdfTenant = createMockPdf("Eskom_Tenant_Isolated.pdf");

  const tenantRecord = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
    file: mockPdfTenant,
    organisationId: TEST_ORG_A,
    userId: "user-alpha",
  });

  // Tenant B attempts to load Tenant A's document
  const unauthorizedAccess = await PersistentDocumentIntelligenceService.loadPersistedDocumentState(
    tenantRecord.documentId,
    TEST_ORG_B, // Wrong organisation ID!
  );

  assert(unauthorizedAccess === null, "Cross-tenant access blocked (returns null)");

  console.log("✅ TEST 5 PASSED: Tenant isolation strictly enforced\n");
  passed++;

  // -------------------------------------------------------------------------
  // Test 6: Extracted Determinants & Provenance Completeness
  // -------------------------------------------------------------------------
  console.log("--- Test 6: Extracted Determinants & Provenance Completeness ---");
  const mockPdfProv = createMockPdf("Eskom_Provenance.pdf");

  const provRecord = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
    file: mockPdfProv,
    organisationId: TEST_ORG_A,
    userId: TEST_USER,
  });

  assert(provRecord.extractedFields.length > 0, "Extracted fields exist");

  const accountField = provRecord.extractedFields.find((f) => f.fieldKey === "account_number");
  assert(accountField !== undefined, "Account number field exists");
  assert(accountField?.value === "1234567890", "Account number value matches");
  assert(accountField?.confidenceScore >= 0.95, "Account number confidence is high");
  assert(accountField?.hasExactBoundingBox === true, "Bounding box flag set");
  assert(Array.isArray(accountField?.boundingBox) && accountField?.boundingBox.length === 4, "Bounding box coordinates valid");

  const totalField = provRecord.extractedFields.find((f) => f.fieldKey === "total_amount_due");
  assert(totalField !== undefined, "Total amount field exists");
  assert(totalField?.value === 187450.25, "Total amount matches 187450.25");
  assert(totalField?.unit === "ZAR", "Unit is ZAR");

  const periodField = provRecord.extractedFields.find((f) => f.fieldKey === "billing_period");
  assert(periodField !== undefined, "Billing period field exists");
  assert(periodField?.hasExactBoundingBox === false, "Truthful bounding box flag when pending OCR");

  console.log("✅ TEST 6 PASSED: Determinants, bounding boxes, and confidence verified\n");
  passed++;

  console.log("=========================================================");
  console.log(`  ALL ${passed}/6 STAGE 16 DATABASE INTEGRATION TESTS PASSED!`);
  console.log("=========================================================");
}

runStage16TestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL ERROR IN STAGE 16 TEST SUITE:", err);
    process.exit(1);
  });
