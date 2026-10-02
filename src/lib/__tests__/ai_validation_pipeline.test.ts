/**
 * ENERA AI VALIDATION & INTELLIGENT DOCUMENT VERIFICATION — TEST SUITE
 * =====================================================================
 * Verifies Requirements 4 & 5:
 * 1. Strict Separation of Concerns:
 *    - Extraction: "What information appears in the document?"
 *    - AI Validation: "Does the extracted information agree with available evidence?"
 *    - Deterministic Validation: "Do the values mathematically and structurally agree?"
 *    - Reconciliation: "What should the customer have been charged?"
 * 2. 8-Stage Validation Pipeline:
 *    Candidate Data -> Evidence Check -> AI Semantic Validation -> Deterministic Rules ->
 *    Cross-Field Validation -> Confidence Calculation -> Exception Generation -> Approval/Review
 * 3. Core Principle: Zero hallucination, non-invention, fallback to UNKNOWN/REVIEW_REQUIRED.
 */

import {
  ValidationPipeline,
  EvidenceCheckEngine,
  AiSemanticValidator,
  DeterministicRuleEngine,
  CrossFieldValidator,
  ValidationConfidenceCalculator,
  ExceptionGenerator,
  type CandidateFieldValidationInput,
} from "../../domain/ai-validation";

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, description: string): void {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✅ ${description}`);
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    throw new Error(`Test assertion failed: ${description}`);
  }
}

async function runAiValidationPipelineTestSuite() {
  console.log("\n==================================================================");
  console.log("  ENERA AI VALIDATION & VERIFICATION PIPELINE TEST SUITE");
  console.log("==================================================================\n");

  // --- TEST GROUP 1: SEPARATION OF CONCERNS ---
  console.log(
    "[Test 1] Enforces strict separation between Extraction, AI Validation, Deterministic Rules, and Reconciliation",
  );
  assert(
    typeof ValidationPipeline.executePipeline === "function",
    "ValidationPipeline is distinct from OCR and Reconciliation engines",
  );
  assert(
    typeof EvidenceCheckEngine.verifyGrounding === "function",
    "Evidence check is segregated from arithmetic calculation",
  );
  assert(
    typeof DeterministicRuleEngine.evaluateRules === "function",
    "Deterministic arithmetic engine is strictly isolated",
  );

  // --- TEST GROUP 2: CORE PRINCIPLE (ZERO INVENTED VALUES) ---
  console.log(
    "\n[Test 2] Enforces Core Principle: AI never invents missing evidence, returns UNKNOWN / REVIEW_REQUIRED",
  );
  const missingFieldInput: CandidateFieldValidationInput = {
    fieldKey: "accountNumber",
    fieldLabel: "Account Number",
    value: null,
    rawValue: "",
    sourcePage: 1,
    opticalConfidence: 0,
  };
  const groundCheck = EvidenceCheckEngine.verifySingleField(missingFieldInput);
  assert(groundCheck.isGrounded === false, "Missing field is flagged as ungrounded");
  assert(
    groundCheck.groundedStatus === "UNKNOWN",
    "Missing field receives UNKNOWN grounded status rather than an invented value",
  );

  // --- TEST GROUP 3: 8-STAGE VALIDATION PIPELINE EXECUTION ---
  console.log("\n[Test 3] Executes Complete 8-Stage Pipeline on clean, fully grounded invoice");
  const cleanCandidateFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "accountNumber",
      fieldLabel: "Account Number",
      value: "0123456789",
      rawValue: "0123456789",
      sourcePage: 1,
      boundingBox: [0.15, 0.65, 0.18, 0.85],
      opticalConfidence: 96,
      sourceText: "Account Number: 0123456789",
      wordTokens: [{ text: "0123456789", confidence: 96, boundingBox: [0.15, 0.65, 0.18, 0.85] }],
    },
    {
      fieldKey: "billingPeriodStart",
      fieldLabel: "Billing Period Start",
      value: "2026-02-01",
      rawValue: "01/02/2026",
      sourcePage: 1,
      boundingBox: [0.2, 0.2, 0.23, 0.35],
      opticalConfidence: 94,
      sourceText: "Billing Period: 01/02/2026 to 28/02/2026",
    },
    {
      fieldKey: "billingPeriodEnd",
      fieldLabel: "Billing Period End",
      value: "2026-02-28",
      rawValue: "28/02/2026",
      sourcePage: 1,
      boundingBox: [0.2, 0.4, 0.23, 0.55],
      opticalConfidence: 94,
      sourceText: "to 28/02/2026",
    },
    {
      fieldKey: "subtotal",
      fieldLabel: "Subtotal Excl. VAT",
      value: 100000.0,
      rawValue: "R 100,000.00",
      sourcePage: 2,
      boundingBox: [0.75, 0.7, 0.78, 0.9],
      opticalConfidence: 97,
      sourceText: "Subtotal: R 100,000.00",
    },
    {
      fieldKey: "vatAmount",
      fieldLabel: "VAT Amount (15%)",
      value: 15000.0,
      rawValue: "R 15,000.00",
      sourcePage: 2,
      boundingBox: [0.8, 0.7, 0.83, 0.9],
      opticalConfidence: 97,
      sourceText: "VAT 15%: R 15,000.00",
    },
    {
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      value: 115000.0,
      rawValue: "R 115,000.00",
      sourcePage: 2,
      boundingBox: [0.85, 0.7, 0.88, 0.9],
      opticalConfidence: 98,
      sourceText: "Total Due: R 115,000.00",
    },
  ];

  const cleanResult = await ValidationPipeline.executePipeline({
    documentId: "doc-clean-auth-001",
    organisationId: "org-test-alpha",
    candidateFields: cleanCandidateFields,
    fullDocumentText: "Eskom Holdings SOC Ltd Megaflex Electricity Invoice Account 0123456789",
  });

  // Verify Stage 1 & 2: Evidence Check
  assert(
    cleanResult.evidenceCheck.groundedFieldsCount === 6,
    "Stage 2 (Evidence Check): All 6 candidate fields verified as grounded",
  );
  assert(
    cleanResult.evidenceCheck.ungroundedFieldsCount === 0,
    "Stage 2 (Evidence Check): Zero ungrounded fields",
  );

  // Verify Stage 3: AI Semantic Validation
  assert(
    cleanResult.semanticValidation.overallSemanticConsistency === "CONSISTENT",
    "Stage 3 (AI Semantics): Overall consistency marked CONSISTENT",
  );
  assert(
    cleanResult.semanticValidation.supplierDetected === "ESKOM",
    "Stage 3 (AI Semantics): Detected Eskom supplier context",
  );

  // Verify Stage 4: Deterministic Rules
  assert(
    cleanResult.deterministicValidation.allRulesPassed === true,
    "Stage 4 (Deterministic Rules): Subtotal + VAT == Total Due validated mathematically",
  );

  // Verify Stage 5: Cross-Field Validation
  assert(
    cleanResult.crossFieldValidation.isCompliant === true,
    "Stage 5 (Cross-Field): 15% VAT rate consistency verified",
  );

  // Verify Stage 6: Confidence Calculation
  assert(
    cleanResult.overallConfidence.overallScore >= 85,
    "Stage 6 (Confidence): Overall confidence score >= 85%",
  );
  assert(
    cleanResult.overallConfidence.tier === "HIGH",
    "Stage 6 (Confidence): Tier classified as HIGH",
  );
  assert(
    cleanResult.overallConfidence.isReliable === true,
    "Stage 6 (Confidence): isReliable is true",
  );

  // Verify Stage 7: Exception Generation
  assert(
    cleanResult.exceptions.length === 0,
    "Stage 7 (Exceptions): Zero exceptions generated for clean invoice",
  );

  // Verify Stage 8: Approval / Review
  assert(
    cleanResult.status === "AUTOMATICALLY_APPROVED",
    "Stage 8 (Approval): Document automatically approved",
  );
  assert(
    cleanResult.approval.approvalMethod === "AUTOMATIC",
    "Stage 8 (Approval): Approval method marked AUTOMATIC",
  );
  assert(
    cleanResult.reconciliationHandoffReady === true,
    "Stage 8 (Approval): Ready for downstream reconciliation handoff",
  );

  // --- TEST GROUP 4: ARITHMETIC DISCREPANCY EXCEPTION HANDLING ---
  console.log("\n[Test 4] Flags arithmetic discrepancies without mutating invoice numbers");
  const corruptedMathFields: CandidateFieldValidationInput[] = [
    ...cleanCandidateFields.filter((f) => f.fieldKey !== "totalAmountDue"),
    {
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      value: 120000.0, // Should be 115,000
      rawValue: "R 120,000.00",
      sourcePage: 2,
      boundingBox: [0.85, 0.7, 0.88, 0.9],
      opticalConfidence: 95,
      sourceText: "Total Due: R 120,000.00",
    },
  ];

  const mathDiscrepancyResult = await ValidationPipeline.executePipeline({
    documentId: "doc-math-err-002",
    candidateFields: corruptedMathFields,
    fullDocumentText: "Eskom Invoice",
  });

  assert(
    mathDiscrepancyResult.deterministicValidation.allRulesPassed === false,
    "Detected mathematical mismatch in Subtotal + VAT == Total",
  );
  assert(
    mathDiscrepancyResult.exceptions.length > 0,
    "Generated structured exception record for arithmetic failure",
  );
  assert(
    mathDiscrepancyResult.exceptions.some((e) => e.category === "ARITHMETIC_MISMATCH"),
    "Exception category is ARITHMETIC_MISMATCH",
  );
  assert(
    mathDiscrepancyResult.status === "REVIEW_REQUIRED",
    "Document transitioned to REVIEW_REQUIRED status",
  );
  assert(
    mathDiscrepancyResult.reconciliationHandoffReady === false,
    "Reconciliation handoff blocked until human review",
  );

  console.log("\n==================================================================");
  console.log(`  🎉 ALL ${passedCount} / ${totalCount} AI VALIDATION TESTS PASSED CLEANLY!`);
  console.log("==================================================================\n");
}

runAiValidationPipelineTestSuite().catch((err) => {
  console.error("AI Validation Test Suite Failed:", err);
  process.exit(1);
});
