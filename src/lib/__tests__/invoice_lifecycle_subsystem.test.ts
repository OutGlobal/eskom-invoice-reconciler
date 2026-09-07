/**
 * Automated Test Suite: Authoritative Invoice Subsystem
 * Tests 10-State Lifecycle Transitions, Duplicate Ingestion Checks,
 * Non-Destructive Validation Flagging, and Immutable Human Review Audit Corrections.
 */

import { InvoiceLifecycleService } from "../../domain/invoice/invoiceLifecycleService";
import { InvoiceCorrectionService } from "../../domain/invoice/invoiceCorrectionService";
import { LayeredExtractor } from "../../domain/invoice/layeredExtractor";
import { InvoiceValidator } from "../../domain/invoice/invoiceValidator";
import type { ExtractedInvoiceDocument, InvoiceLifecycleState } from "../../domain/invoice/types";

const SAMPLE_PDF_TEXT = `
TAX INVOICE / STATEMENT
ESKOM HOLDINGS SOC LTD
ACCOUNT NUMBER: ACC-99887766
INVOICE NUMBER: INV-TEST-1001
INVOICE DATE: 2026-03-01
BILLING PERIOD: 2026-02-01 to 2026-02-28
CUSTOMER NAME: TEST UTILITY CLIENT
PREMISE ID: PRM-1001
METER NUMBER: MTR-1001

TARIFF NAME: Eskom Megaflex
NOTIFIED MAXIMUM DEMAND: 2000 kVA
UTILISED CAPACITY: 1800 kVA
MAXIMUM DEMAND: 1950 kVA
POWER FACTOR: 0.98

ACTIVE ENERGY: 500000 kWh
PEAK KWH: 100000 kWh
STANDARD KWH: 250000 kWh
OFF PEAK KWH: 150000 kWh
TOTAL KWH: 500000 kWh

SUBTOTAL: R 400000.00
VAT 15%: R 60000.00
TOTAL INVOICE AMOUNT: R 460000.00
`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ TEST PASSED: ${message}`);
  }
}

export async function runInvoiceSubsystemTests() {
  console.log("\n=== RUNNING AUTHORITATIVE INVOICE SUBSYSTEM TEST SUITE ===\n");

  // Test 1: 10-State Lifecycle Legal Transitions
  console.log("--- Test 1: 10-State Lifecycle State Transitions ---");
  assert(InvoiceLifecycleService.LIFECYCLE_STATES.length === 10, "Subsystem supports exactly 10 lifecycle states");
  
  // Test legal transition sequence
  let state: InvoiceLifecycleState = "UPLOADED";
  state = InvoiceLifecycleService.transitionState(state, "EXTRACTED");
  assert(state === "EXTRACTED", "Transitioned UPLOADED -> EXTRACTED");

  state = InvoiceLifecycleService.transitionState(state, "VALIDATED");
  assert(state === "VALIDATED", "Transitioned EXTRACTED -> VALIDATED");

  state = InvoiceLifecycleService.transitionState(state, "APPROVED");
  assert(state === "APPROVED", "Transitioned VALIDATED -> APPROVED");

  state = InvoiceLifecycleService.transitionState(state, "READY_FOR_RECONCILIATION");
  assert(state === "READY_FOR_RECONCILIATION", "Transitioned APPROVED -> READY_FOR_RECONCILIATION");

  state = InvoiceLifecycleService.transitionState(state, "RECONCILING");
  assert(state === "RECONCILING", "Transitioned READY_FOR_RECONCILIATION -> RECONCILING");

  state = InvoiceLifecycleService.transitionState(state, "RECONCILED");
  assert(state === "RECONCILED", "Transitioned RECONCILING -> RECONCILED");

  state = InvoiceLifecycleService.transitionState(state, "CLOSED");
  assert(state === "CLOSED", "Transitioned RECONCILED -> CLOSED");

  // Test 2: Illegal State Transitions Rejection
  console.log("\n--- Test 2: Illegal State Transition Guarding ---");
  let caughtError = false;
  try {
    InvoiceLifecycleService.transitionState("UPLOADED", "CLOSED");
  } catch (err: any) {
    caughtError = true;
    assert(err.message.includes("Illegal invoice state transition"), "Rejection message matches expected format");
  }
  assert(caughtError, "Illegal state transition (UPLOADED -> CLOSED) correctly rejected");

  // Test 3: Duplicate Detection Engine
  console.log("\n--- Test 3: Duplicate Detection Logic ---");
  const existingInvoices = [
    { sha256_hash: "hash-abc-123", invoice_number: "INV-EXISTING-01", account_number: "ACC-100" },
  ];

  const hashDup = InvoiceLifecycleService.isDuplicate(
    { sha256Hash: "hash-abc-123", invoiceNumber: "INV-NEW-999", accountNumber: "ACC-999" },
    existingInvoices,
  );
  assert(hashDup.isDuplicate === true, "Detected duplicate SHA-256 file hash");

  const numberDup = InvoiceLifecycleService.isDuplicate(
    { sha256Hash: "hash-different-456", invoiceNumber: "INV-EXISTING-01", accountNumber: "ACC-100" },
    existingInvoices,
  );
  assert(numberDup.isDuplicate === true, "Detected duplicate invoice number & account combination");

  const cleanCheck = InvoiceLifecycleService.isDuplicate(
    { sha256Hash: "hash-unique-789", invoiceNumber: "INV-UNIQUE-02", accountNumber: "ACC-200" },
    existingInvoices,
  );
  assert(cleanCheck.isDuplicate === false, "Unique invoice allowed cleanly");

  // Test 4: Document Extraction & Initial State Determination
  console.log("\n--- Test 4: Extraction & Initial State Determination ---");
  const doc = await LayeredExtractor.extractDocument({
    filename: "Test_Invoice.pdf",
    pageTexts: [SAMPLE_PDF_TEXT],
    sha256Hash: "hash-test-subsystem-100",
    isScanned: false,
  });

  const initialState = InvoiceLifecycleService.determineInitialState(doc, doc.validation_summary);
  assert(initialState === "VALIDATED", `Clean document initialized to state (${initialState})`);

  // Test 5: Non-Destructive Validation Flagging
  console.log("\n--- Test 5: Non-Destructive Validation & Discrepancy Flagging ---");
  const brokenDoc = JSON.parse(JSON.stringify(doc)) as ExtractedInvoiceDocument;
  brokenDoc.total_kwh.value = 999999; // Artificially mismatch energy total

  const validationRes = InvoiceValidator.validateInvoice(brokenDoc);
  const brokenState = InvoiceLifecycleService.determineInitialState(brokenDoc, validationRes);
  assert(brokenState === "REVIEW_REQUIRED", "Document with validation discrepancy initialized to REVIEW_REQUIRED");
  assert(brokenDoc.total_kwh.value === 999999, "Original extracted value remains untouched for audit integrity");

  // Test 6: Immutable Human Review Audit Correction Registration
  console.log("\n--- Test 6: Immutable Audit Corrections Register ---");
  const correctedDoc = InvoiceCorrectionService.applyCorrection(doc, {
    invoiceRecordId: "inv-record-test-100",
    fieldName: "account_number",
    originalValue: doc.account_number.value,
    correctedValue: "ACC-CORRECTED-9999",
    reason: "Corrected leading digit OCR misread from source PDF page 1",
    userName: "Senior Utility Auditor",
    approvedBy: "Lead Supervisor",
  });

  assert(correctedDoc.account_number.value === "ACC-CORRECTED-9999", "Updated field reflects corrected value");
  assert(correctedDoc.account_number.confidence_score === 1.0, "Human corrected field set to 1.0 confidence score");
  assert(correctedDoc.corrections_log !== undefined && correctedDoc.corrections_log.length === 1, "Correction entry recorded in corrections_log array");

  const entry = correctedDoc.corrections_log![0];
  assert(entry.original_value === "ACC-99887766", `Original value preserved in audit entry (${entry.original_value})`);
  assert(entry.corrected_value === "ACC-CORRECTED-9999", `Corrected value recorded (${entry.corrected_value})`);
  assert(entry.reason.includes("OCR misread"), `Audit reason logged cleanly ("${entry.reason}")`);
  assert(entry.user_name === "Senior Utility Auditor", "Auditor identity recorded");

  console.log("\n=== ALL AUTHORITATIVE INVOICE SUBSYSTEM TESTS PASSED SUCCESSFULLY ===\n");
}

if (process.argv[1] && process.argv[1].includes("invoice_lifecycle")) {
  runInvoiceSubsystemTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}
