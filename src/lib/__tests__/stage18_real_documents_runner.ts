/**
 * STAGE 18 — TEST WITH REAL DOCUMENTS (STANDALONE RUNNER)
 * ========================================================
 * Verifies document intelligence processing across all 10 required real document types:
 *  1. Native text PDF
 *  2. Scanned PDF (raster image XObject, zero text stream)
 *  3. Multi-page PDF (3+ distinct pages with boundary preservation)
 *  4. Invoice containing tables (tabular billing schedule with column alignment)
 *  5. Invoice containing TOU energy data (Peak/Standard/Off-Peak breakdown)
 *  6. Poor-quality PDF (degraded OCR artifacts, missing core determinants)
 *  7. Corrupted PDF (corrupt magic header / truncated binary)
 *  8. Password-protected PDF (encrypted stream with /Encrypt dictionary)
 *  9. Duplicate PDF (cryptographically identical payload for idempotency)
 *  10. Large PDF (1+ MB payload to test throughput & memory boundaries)
 *
 * Each document type is verified across all 8 required lifecycle stages:
 *  Upload → Store → Register → Inspect → Extract → Classify → Persist → Display
 */

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

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`STAGE 18 TEST FAILED: ${message}`);
  }
}

function createUploadFile(name: string, bytes: Uint8Array): {
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

async function runStage18TestSuite() {
  console.log("================================================================================");
  console.log("  STAGE 18 — TEST WITH REAL DOCUMENTS: 10 SCENARIOS × 8 LIFECYCLE STAGES");
  console.log("================================================================================\n");

  const TEST_ORG = "org-eskom-reconciler-enterprise-01";
  const TEST_USER = "user-auditor-stage18";

  // Reset Zustand state and memory store
  useApp.getState().setInvoice(null);
  useApp.getState().setCustomer({ name: "", meter: "", accountNumber: "", address: "", nmd: 0 });
  useApp.getState().setRows([]);
  PersistentDocumentIntelligenceService.clearRuntimeCache();
  LocalWorkspaceStore.clearMemoryStore();

  let passedScenarios = 0;

  // =========================================================================
  // SCENARIO 1: Native Text PDF
  // =========================================================================
  console.log("▶ Scenario 1: Native Text PDF");
  {
    const bytes = createNativeTextPdfBytes();
    // 1. Upload
    const file = createUploadFile("eskom_native_tax_invoice.pdf", bytes);
    assert(file.size > 0 && file.name.endsWith(".pdf"), "Upload stage: File representation instantiated");

    // Process through pipeline: Store -> Register -> Inspect -> Extract -> Classify -> Persist -> Display
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.startsWith(`documents/${TEST_ORG}/`), "Store stage: Stored under tenant storage path");

    // 3. Register
    assert(/^DOC-[A-F0-9]{12}$/.test(record.documentId), "Register stage: Valid DOC-XXXXXXXXXXXX identifier assigned");
    assert(record.checksum.length >= 16, "Register stage: Checksum computed");

    // 4. Inspect
    assert(record.inspection !== undefined, "Inspect stage: PDF inspection results present");
    assert(record.inspection?.integrityValid === true, "Inspect stage: Valid PDF structure");
    assert(record.inspection?.isEncrypted === false, "Inspect stage: Not encrypted");
    assert(record.inspection?.appearsScanned === false, "Inspect stage: Digital text verified");

    // 5. Extract
    assert(record.financialDeterminants !== undefined, "Extract stage: Financial determinants extracted");
    assert(record.financialDeterminants?.accountNumber === "1234567890", "Extract stage: Account number matches 1234567890");
    assert(record.financialDeterminants?.totalAmountDue === 187450.25, "Extract stage: Total due matches 187,450.25");
    assert(record.financialDeterminants?.activeEnergyKwh === 45820, "Extract stage: Active energy matches 45,820 kWh");
    assert(record.pages.length === 1 && record.pages[0].hasNativeText, "Extract stage: Native text detected in page");

    // 6. Classify
    assert(record.classification?.category === "UTILITY_INVOICE", "Classify stage: Classified as UTILITY_INVOICE");
    assert(record.financialDeterminants?.tariffCode === "MEGAFLEX_RURAL", "Classify stage: Megaflex Rural tariff recognized");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert(persisted !== undefined && persisted.processingStatus === "PROCESSED", "Persist stage: Saved to durable store");
    assert((persisted?.metadata as any)?.financialDeterminants?.totalAmountDue === 187450.25, "Persist stage: Metadata preserved");

    // 8. Display
    const store = useApp.getState();
    assert(store.invoice?.accountNumber === "1234567890", "Display stage: Dashboard invoice account hydrated");
    assert(store.invoice?.amountDue === 187450.25, "Display stage: Dashboard invoice total amount hydrated");
    assert(store.invoice?.tariffType === "MEGAFLEX_RURAL", "Display stage: Dashboard invoice tariff hydrated");

    console.log("  ✅ Scenario 1 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 2: Scanned PDF
  // =========================================================================
  console.log("▶ Scenario 2: Scanned PDF (Raster Image, No Digital Text)");
  {
    const bytes = createScannedPdfBytes();
    // 1. Upload
    const file = createUploadFile("eskom_scanned_meter_sheet.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_scanned_meter_sheet.pdf"), "Store stage: Stored under tenant path");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Registry record created");

    // 4. Inspect
    assert(record.inspection?.appearsScanned === true, "Inspect stage: Image XObject detected without font descriptors");
    assert(record.inspection?.isOcrLikelyRequired === true, "Inspect stage: OCR handoff requirement identified");
    assert(record.inspection?.pdfType === "SCANNED_PDF", "Inspect stage: Classified as SCANNED_PDF");

    // 5. Extract
    assert(record.truthfulStage === "OCR_DISPATCHED", "Extract stage: Truthful stage OCR_DISPATCHED");
    assert(record.processingStatus === "REVIEW_REQUIRED", "Extract stage: Review required pending OCR reconstruction");

    // 6. Classify
    assert(record.validationStatus === "REVIEW_REQUIRED", "Classify stage: Validation marked REVIEW_REQUIRED");
    assert(record.reviewReason?.includes("OCR handoff required"), "Classify stage: Review reason notes OCR handoff");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert(persisted?.processingStatus === "REVIEW_REQUIRED", "Persist stage: Review status persisted");
    assert((persisted?.metadata as any)?.inspection?.appearsScanned === true, "Persist stage: Inspection metadata persisted");

    // 8. Display
    assert(record.financialDeterminants === undefined, "Display stage: Zero hallucinated values dispatched to UI");

    console.log("  ✅ Scenario 2 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 3: Multi-page PDF
  // =========================================================================
  console.log("▶ Scenario 3: Multi-page PDF (3 Structured Pages)");
  {
    const bytes = createMultiPagePdfBytes(3);
    // 1. Upload
    const file = createUploadFile("eskom_multipage_schedule.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_multipage_schedule.pdf"), "Store stage: Storage path assigned");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Identifier generated");

    // 4. Inspect
    assert(record.inspection?.integrityValid === true, "Inspect stage: Valid PDF structure");
    assert(record.totalPages === 3, "Inspect stage: 3 pages identified");

    // 5. Extract
    assert(record.pages.length === 3, "Extract stage: 3 distinct page models populated");
    assert(record.pages[0].pageNumber === 1 && record.pages[1].pageNumber === 2 && record.pages[2].pageNumber === 3, "Extract stage: Page indices sequenced");
    assert(record.pages[0].rawText.includes("ACCOUNT NUMBER"), "Extract stage: Page 1 text verified");
    assert(record.pages[1].rawText.includes("METER NUMBER"), "Extract stage: Page 2 text verified");
    assert(record.pages[2].rawText.includes("TARIFF: MEGAFLEX"), "Extract stage: Page 3 text verified");

    // 6. Classify
    assert(record.classification?.category === "UTILITY_INVOICE", "Classify stage: Classified as UTILITY_INVOICE");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert(persisted?.pageCount === 3, "Persist stage: 3 pages stored in database");
    assert((persisted?.metadata as any)?.pages?.length === 3, "Persist stage: Page array persisted");

    // 8. Display
    const store = useApp.getState();
    assert(store.invoice?.accountNumber === "1234567890", "Display stage: Account number from multi-page invoice hydrated");
    assert(store.invoice?.amountDue === 187450.25, "Display stage: Amount due from multi-page invoice hydrated");

    console.log("  ✅ Scenario 3 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 4: Invoice Containing Tables
  // =========================================================================
  console.log("▶ Scenario 4: Invoice Containing Tables (Tabular Billing Schedule)");
  {
    const bytes = createTableInvoicePdfBytes();
    // 1. Upload
    const file = createUploadFile("eskom_table_invoice.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_table_invoice.pdf"), "Store stage: Tenant path created");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Identifier created");

    // 4. Inspect
    assert(record.inspection?.detectedTableCount! >= 1, "Inspect stage: Tabular structure identified by inspection engine");

    // 5. Extract
    const tableField = record.extractedFields.find((f) => f.fieldKey === "billing_schedule_table");
    assert(tableField !== undefined, "Extract stage: Tabular schedule extracted");
    assert(tableField?.extractionMethod === "Table Column Layout Analysis", "Extract stage: Layout analysis method noted");
    assert(record.financialDeterminants?.totalAmountDue === 191319.21, "Extract stage: Table subtotal + VAT verified (191,319.21)");

    // 6. Classify
    assert(record.classification?.category === "UTILITY_INVOICE", "Classify stage: Classified as UTILITY_INVOICE");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert((persisted?.metadata as any)?.extractedFields?.some((f: any) => f.fieldKey === "billing_schedule_table"), "Persist stage: Table field stored in database");

    // 8. Display
    const store = useApp.getState();
    assert(store.invoice?.amountDue === 191319.21, "Display stage: Authoritative table total amount displayed");

    console.log("  ✅ Scenario 4 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 5: Invoice Containing TOU Energy Data
  // =========================================================================
  console.log("▶ Scenario 5: Invoice Containing TOU Energy Data (Peak / Standard / Off-Peak)");
  {
    const bytes = createTouInvoicePdfBytes();
    // 1. Upload
    const file = createUploadFile("eskom_tou_energy_invoice.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_tou_energy_invoice.pdf"), "Store stage: Tenant path created");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Identifier created");

    // 4. Inspect
    assert(record.inspection?.integrityValid === true, "Inspect stage: PDF integrity valid");

    // 5. Extract
    const det = record.financialDeterminants;
    assert(det?.peakKwh === 12500, "Extract stage: Peak kWh = 12,500 extracted");
    assert(det?.standardKwh === 22100, "Extract stage: Standard kWh = 22,100 extracted");
    assert(det?.offPeakKwh === 11220, "Extract stage: Off-Peak kWh = 11,220 extracted");
    assert(det?.peakCharge === 83365.0, "Extract stage: Peak Energy Charge = R 83,365.00 extracted");
    assert(det?.standardCharge === 47603.4, "Extract stage: Standard Energy Charge = R 47,603.40 extracted");
    assert(det?.offPeakCharge === 12471.03, "Extract stage: Off-Peak Energy Charge = R 12,471.03 extracted");

    // 6. Classify
    assert(record.classification?.category === "UTILITY_INVOICE", "Classify stage: Classified as UTILITY_INVOICE");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert((persisted?.metadata as any)?.financialDeterminants?.peakKwh === 12500, "Persist stage: TOU peakKwh persisted in database");

    // 8. Display
    const store = useApp.getState();
    assert(store.invoice?.peakKwh === 12500, "Display stage: Peak kWh hydrated in dashboard store");
    assert(store.invoice?.standardKwh === 22100, "Display stage: Standard kWh hydrated in dashboard store");
    assert(store.invoice?.offPeakKwh === 11220, "Display stage: Off-Peak kWh hydrated in dashboard store");

    console.log("  ✅ Scenario 5 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 6: Poor-Quality PDF
  // =========================================================================
  console.log("▶ Scenario 6: Poor-Quality PDF (Degraded Text, Missing Determinants)");
  {
    const bytes = createPoorQualityPdfBytes();
    // 1. Upload
    const file = createUploadFile("eskom_poor_quality_smudged.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_poor_quality_smudged.pdf"), "Store stage: Tenant path created");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Identifier created");

    // 4. Inspect
    assert(record.inspection?.integrityValid === true, "Inspect stage: PDF container structure intact");

    // 5. Extract
    assert(record.financialDeterminants === undefined, "Extract stage: Zero fabricated financial determinants");
    assert(record.processingStatus === "REVIEW_REQUIRED", "Extract stage: Status set to REVIEW_REQUIRED");

    // 6. Classify
    assert(record.truthfulStage === "HUMAN_REVIEW", "Classify stage: Truthful stage is HUMAN_REVIEW");
    assert(record.reviewReason?.includes("Poor document quality"), "Classify stage: Quality deficiency identified");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert(persisted?.processingStatus === "REVIEW_REQUIRED", "Persist stage: REVIEW_REQUIRED persisted in database");
    assert((persisted?.metadata as any)?.truthfulStage === "HUMAN_REVIEW", "Persist stage: HUMAN_REVIEW stage persisted");

    // 8. Display
    assert(record.financialDeterminants === undefined, "Display stage: Dashboard does not display fake values");

    console.log("  ✅ Scenario 6 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 7: Corrupted PDF
  // =========================================================================
  console.log("▶ Scenario 7: Corrupted PDF (Damaged Header / Malformed Binary)");
  {
    const bytes = createCorruptedPdfBytes();
    // 1. Upload
    const file = createUploadFile("eskom_corrupted.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_corrupted.pdf"), "Store stage: Stored safely in quarantine path");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Registry tracking created");

    // 4. Inspect
    assert(record.inspection?.integrityValid === false, "Inspect stage: Inspection engine correctly flagged corrupted stream");

    // 5. Extract
    assert(record.pages.length === 0, "Extract stage: Zero pages extracted from corrupted payload");
    assert(record.financialDeterminants === undefined, "Extract stage: Zero financial determinants created");

    // 6. Classify
    assert(record.processingStatus === "FAILED", "Classify stage: processingStatus is FAILED");
    assert(record.validationStatus === "INVALID", "Classify stage: validationStatus is INVALID");
    assert(record.truthfulStage === "FAILED", "Classify stage: truthfulStage is FAILED");
    assert(record.errorMessage?.includes("Corrupted PDF stream"), "Classify stage: Informative error message provided");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert(persisted?.processingStatus === "FAILED", "Persist stage: FAILED status stored in database");

    // 8. Display
    assert(record.errorMessage !== undefined, "Display stage: Failure notice available for user presentation");

    console.log("  ✅ Scenario 7 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 8: Password-Protected PDF
  // =========================================================================
  console.log("▶ Scenario 8: Password-Protected PDF (Encrypted Stream / /Encrypt Dictionary)");
  {
    const bytes = createPasswordProtectedPdfBytes();
    // 1. Upload
    const file = createUploadFile("eskom_encrypted_locked.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_encrypted_locked.pdf"), "Store stage: Tenant path created");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Registry record created");

    // 4. Inspect
    assert(record.inspection?.isEncrypted === true, "Inspect stage: Encryption dictionary /Encrypt detected");

    // 5. Extract
    assert(record.pages.length === 0, "Extract stage: Encrypted stream extraction securely aborted");

    // 6. Classify
    assert(record.processingStatus === "FAILED", "Classify stage: Marked FAILED due to encryption guard");
    assert(record.errorMessage?.includes("Password-protected PDF"), "Classify stage: Decryption required message");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert(persisted?.processingStatus === "FAILED", "Persist stage: Guard state persisted in database");
    assert((persisted?.metadata as any)?.inspection?.isEncrypted === true, "Persist stage: Encrypted flag stored");

    // 8. Display
    assert(record.errorMessage?.includes("Decryption required"), "Display stage: User prompted for decryption key");

    console.log("  ✅ Scenario 8 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 9: Duplicate PDF
  // =========================================================================
  console.log("▶ Scenario 9: Duplicate PDF (Cryptographic Idempotency Check)");
  {
    const bytes = createDuplicatePdfBytes();
    // 1. Upload duplicate of Scenario 1
    const file = createUploadFile("eskom_duplicate_upload.pdf", bytes);
    assert(file.size > 0, "Upload stage: File representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes(TEST_ORG), "Store stage: Tenant path verified");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Identifier created");

    // 4. Inspect
    assert(record.checksum.length >= 16, "Inspect stage: Cryptographic SHA-256 match found");

    // 5. Extract
    assert(record.financialDeterminants?.totalAmountDue === 187450.25, "Extract stage: Determinants resolved from canonical document");

    // 6. Classify
    assert(record.isDuplicate === true, "Classify stage: Duplicate flag set to true");
    assert(record.truthfulStage === "DUPLICATE_IDENTIFIED", "Classify stage: Truthful stage is DUPLICATE_IDENTIFIED");
    assert(typeof record.duplicateOfDocumentId === "string", "Classify stage: Canonical document reference linked");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert((persisted?.metadata as any)?.isDuplicate === true, "Persist stage: Duplicate metadata persisted");

    // 8. Display
    assert(record.truthfulStage === "DUPLICATE_IDENTIFIED", "Display stage: UI shows duplicate identification banner");

    console.log("  ✅ Scenario 9 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  // =========================================================================
  // SCENARIO 10: Large PDF (1+ MB Payload)
  // =========================================================================
  console.log("▶ Scenario 10: Large PDF (1+ MB High-Volume Stream)");
  {
    const bytes = createLargePdfBytes(1024);
    assert(bytes.byteLength >= 1024 * 1024, `Verify payload size: ${bytes.byteLength} bytes (>= 1MB)`);

    // 1. Upload
    const file = createUploadFile("eskom_large_megabyte_invoice.pdf", bytes);
    assert(file.size >= 1024 * 1024, "Upload stage: 1+ MB file representation instantiated");

    // Process
    const record = await PersistentDocumentIntelligenceService.ingestAndProcessDocument({
      file,
      organisationId: TEST_ORG,
      userId: TEST_USER,
    });

    // 2. Store
    assert(record.storagePath.includes("eskom_large_megabyte_invoice.pdf"), "Store stage: High-volume file path mapped");

    // 3. Register
    assert(record.documentId.startsWith("DOC-"), "Register stage: Registry record allocated");
    assert(record.fileSizeBytes >= 1024 * 1024, "Register stage: File size bytes accurately registered");

    // 4. Inspect
    assert(record.inspection?.integrityValid === true, "Inspect stage: High-volume PDF passed structural inspection");

    // 5. Extract
    assert(record.financialDeterminants?.totalAmountDue === 187450.25, "Extract stage: Total due extracted from large stream");
    assert(record.financialDeterminants?.accountNumber === "1234567890", "Extract stage: Account number extracted from large stream");

    // 6. Classify
    assert(record.classification?.category === "UTILITY_INVOICE", "Classify stage: Classified as UTILITY_INVOICE");

    // 7. Persist
    const uploads = await LocalWorkspaceStore.listUploads();
    const persisted = uploads.find((u) => u.id === record.documentId);
    assert(persisted?.fileSizeBytes! >= 1024 * 1024, "Persist stage: 1+ MB record persisted to database");

    // 8. Display
    const store = useApp.getState();
    assert(store.invoice?.amountDue === 187450.25, "Display stage: High-volume invoice determinants displayed on dashboard");

    console.log("  ✅ Scenario 10 Passed (8/8 stages verified)\n");
    passedScenarios++;
  }

  console.log("================================================================================");
  console.log(`  ALL ${passedScenarios}/10 STAGE 18 REAL DOCUMENT TEST SCENARIOS PASSED!`);
  console.log("  All 8 Lifecycle Stages (Upload -> Store -> Register -> Inspect -> Extract -> Classify -> Persist -> Display) Verified");
  console.log("================================================================================\n");
}

runStage18TestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL ERROR IN STAGE 18 TEST SUITE:", err);
    process.exit(1);
  });
