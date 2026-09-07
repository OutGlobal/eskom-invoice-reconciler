import { InvoiceLifecycleService } from "../../domain/invoice/invoiceLifecycleService";
import { InvoiceCorrectionService } from "../../domain/invoice/invoiceCorrectionService";
import type { ExtractedInvoiceDocument, InvoiceLifecycleState } from "../../domain/invoice/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ TEST PASSED: ${message}`);
  }
}

console.log("\n=== RUNNING INVOICE SUBSYSTEM FAST UNIT TESTS ===\n");

// 1. 10-State Lifecycle
assert(InvoiceLifecycleService.LIFECYCLE_STATES.length === 10, "10 Lifecycle States configured");

let state: InvoiceLifecycleState = "UPLOADED";
state = InvoiceLifecycleService.transitionState(state, "EXTRACTED");
assert(state === "EXTRACTED", "Transition UPLOADED -> EXTRACTED");

state = InvoiceLifecycleService.transitionState(state, "VALIDATED");
assert(state === "VALIDATED", "Transition EXTRACTED -> VALIDATED");

state = InvoiceLifecycleService.transitionState(state, "APPROVED");
assert(state === "APPROVED", "Transition VALIDATED -> APPROVED");

state = InvoiceLifecycleService.transitionState(state, "READY_FOR_RECONCILIATION");
assert(state === "READY_FOR_RECONCILIATION", "Transition APPROVED -> READY_FOR_RECONCILIATION");

state = InvoiceLifecycleService.transitionState(state, "RECONCILING");
assert(state === "RECONCILING", "Transition READY_FOR_RECONCILIATION -> RECONCILING");

state = InvoiceLifecycleService.transitionState(state, "RECONCILING");
state = InvoiceLifecycleService.transitionState(state, "RECONCILED");
assert(state === "RECONCILED", "Transition RECONCILING -> RECONCILED");

state = InvoiceLifecycleService.transitionState(state, "CLOSED");
assert(state === "CLOSED", "Transition RECONCILED -> CLOSED");

// 2. Illegal State Transition
let caught = false;
try {
  InvoiceLifecycleService.transitionState("UPLOADED", "CLOSED");
} catch (e: any) {
  caught = true;
  assert(e.message.includes("Illegal invoice state transition"), "Caught illegal transition exception");
}
assert(caught, "Guarded illegal transition");

// 3. Duplicate Check
const existing = [{ sha256_hash: "hash-123", invoice_number: "INV-100", account_number: "ACC-100" }];
const dupHash = InvoiceLifecycleService.isDuplicate({ sha256Hash: "hash-123", invoiceNumber: "INV-999", accountNumber: "ACC-999" }, existing);
assert(dupHash.isDuplicate, "Detected duplicate SHA-256");

const dupNum = InvoiceLifecycleService.isDuplicate({ sha256Hash: "hash-456", invoiceNumber: "INV-100", accountNumber: "ACC-100" }, existing);
assert(dupNum.isDuplicate, "Detected duplicate Invoice & Account number");

// 4. Audit Correction Register
const mockDoc: any = {
  id: "doc-1",
  account_number: { field_name: "account_number", value: "ACC-OLD", confidence_score: 0.7, source_text_reference: "ACC-OLD", source_page: 1 },
  metadata: { low_confidence_fields: ["account_number"], needs_human_review: true },
};

const corrected = InvoiceCorrectionService.applyCorrection(mockDoc, {
  invoiceRecordId: "doc-1",
  fieldName: "account_number",
  originalValue: "ACC-OLD",
  correctedValue: "ACC-NEW",
  reason: "Corrected digit",
  userName: "Auditor",
});

assert(corrected.account_number.value === "ACC-NEW", "Corrected field updated");
assert(corrected.account_number.confidence_score === 1.0, "Confidence set to 1.0");
assert(corrected.corrections_log?.length === 1, "Correction entry added to audit register");
assert(corrected.corrections_log![0].original_value === "ACC-OLD", "Original value preserved in audit log");

console.log("\n=== ALL INVOICE SUBSYSTEM FAST UNIT TESTS PASSED ===\n");
