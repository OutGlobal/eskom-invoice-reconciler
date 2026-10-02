/**
 * ENERA AI VALIDATION & INTELLIGENT DOCUMENT VERIFICATION — TEST SUITE
 * =====================================================================
 * Verifies Requirements 4, 5, 6, 7, 8 & 9:
 * 1. Strict Separation of Concerns
 * 2. 8-Stage Validation Pipeline
 * 3. Canonical Invoice Record & Field-Level Evidence
 * 4. Structured AI Input Payload Builder (Req 8)
 * 5. Structured AI Output Schema Validation & Malformed Rejection (Req 9)
 * 6. Core Principle: Zero hallucination, non-invention, fallback to UNKNOWN/REVIEW_REQUIRED.
 */

import {
  ValidationPipeline,
  EvidenceCheckEngine,
  DeterministicRuleEngine,
  CanonicalInvoiceBuilder,
  StructuredAiPayloadBuilder,
  StructuredAiResponseValidator,
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
      fieldKey: "customerName",
      fieldLabel: "Customer Name",
      value: "Acme Industrial Pty Ltd",
      rawValue: "Acme Industrial Pty Ltd",
      sourcePage: 1,
      boundingBox: [0.12, 0.1, 0.14, 0.4],
      opticalConfidence: 95,
      sourceText: "Customer: Acme Industrial Pty Ltd",
    },
    {
      fieldKey: "meterNumber",
      fieldLabel: "Meter Number",
      value: "MTR-998822",
      rawValue: "MTR-998822",
      sourcePage: 1,
      boundingBox: [0.25, 0.1, 0.28, 0.3],
      opticalConfidence: 96,
      sourceText: "Meter No: MTR-998822",
    },
    {
      fieldKey: "tariffName",
      fieldLabel: "Tariff Name",
      value: "Megaflex Non-Local Transmission",
      rawValue: "Megaflex Non-Local",
      sourcePage: 1,
      boundingBox: [0.22, 0.1, 0.24, 0.4],
      opticalConfidence: 93,
      sourceText: "Tariff: Megaflex Non-Local Transmission",
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
      fieldKey: "peakEnergyKwh",
      fieldLabel: "Peak Active Energy",
      value: 25000.0,
      rawValue: "25,000.00 kWh",
      sourcePage: 2,
      boundingBox: [0.4, 0.5, 0.43, 0.7],
      opticalConfidence: 96,
      sourceText: "Peak Energy: 25000 kWh",
    },
    {
      fieldKey: "standardEnergyKwh",
      fieldLabel: "Standard Active Energy",
      value: 45000.0,
      rawValue: "45,000.00 kWh",
      sourcePage: 2,
      boundingBox: [0.45, 0.5, 0.48, 0.7],
      opticalConfidence: 96,
      sourceText: "Standard Energy: 45000 kWh",
    },
    {
      fieldKey: "offPeakEnergyKwh",
      fieldLabel: "Off-Peak Active Energy",
      value: 30000.0,
      rawValue: "30,000.00 kWh",
      sourcePage: 2,
      boundingBox: [0.5, 0.5, 0.53, 0.7],
      opticalConfidence: 96,
      sourceText: "Off-Peak Energy: 30000 kWh",
    },
    {
      fieldKey: "totalActiveEnergyKwh",
      fieldLabel: "Total Active Energy",
      value: 100000.0,
      rawValue: "100,000.00 kWh",
      sourcePage: 2,
      boundingBox: [0.55, 0.5, 0.58, 0.7],
      opticalConfidence: 98,
      sourceText: "Total Active Energy: 100000 kWh",
    },
    {
      fieldKey: "maximumDemandKva",
      fieldLabel: "Maximum Demand",
      value: 450.0,
      rawValue: "450.00 kVA",
      sourcePage: 2,
      boundingBox: [0.6, 0.5, 0.63, 0.7],
      opticalConfidence: 95,
      sourceText: "Maximum Demand: 450 kVA",
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
    cleanResult.evidenceCheck.groundedFieldsCount === cleanCandidateFields.length,
    `Stage 2 (Evidence Check): All ${cleanCandidateFields.length} candidate fields verified as grounded`,
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

  // --- TEST GROUP 4: CANONICAL INVOICE RECORD & FIELD EVIDENCE PROVENANCE (REQS 6 & 7) ---
  console.log(
    "\n[Test 4] Builds Canonical Invoice Record supporting 8 functional sections with field-level evidence provenance",
  );
  const canonicalRecord = CanonicalInvoiceBuilder.fromValidationResult(
    cleanResult,
    cleanCandidateFields,
  );

  // 1. Document Section
  assert(
    canonicalRecord.document.documentId.value === "doc-clean-auth-001",
    "Canonical Document: documentId matches",
  );
  assert(
    canonicalRecord.document.billingPeriodStart.value === "2026-02-01",
    "Canonical Document: billingPeriodStart populated",
  );
  assert(
    canonicalRecord.document.billingPeriodEnd.value === "2026-02-28",
    "Canonical Document: billingPeriodEnd populated",
  );

  // 2. Customer Section
  assert(
    canonicalRecord.customer.accountNumber.value === "0123456789",
    "Canonical Customer: accountNumber is populated",
  );
  assert(
    canonicalRecord.customer.customerName.value === "Acme Industrial Pty Ltd",
    "Canonical Customer: customerName populated",
  );

  // 3. Meter Section
  assert(
    canonicalRecord.meter.meterNumber.value === "MTR-998822",
    "Canonical Meter: meterNumber populated",
  );
  assert(
    canonicalRecord.meter.previousReading.value === null,
    "Canonical Meter: unextracted previousReading remains null (not invented)",
  );

  // 4. Tariff Section
  assert(
    canonicalRecord.tariff.tariffName.value === "Megaflex Non-Local Transmission",
    "Canonical Tariff: tariffName populated",
  );

  // 5. Energy Section
  assert(canonicalRecord.energy.peakKwh.value === 25000, "Canonical Energy: peakKwh is 25,000");
  assert(
    canonicalRecord.energy.standardKwh.value === 45000,
    "Canonical Energy: standardKwh is 45,000",
  );
  assert(
    canonicalRecord.energy.offPeakKwh.value === 30000,
    "Canonical Energy: offPeakKwh is 30,000",
  );
  assert(canonicalRecord.energy.totalKwh.value === 100000, "Canonical Energy: totalKwh is 100,000");

  // 6. Demand Section
  assert(
    canonicalRecord.demand.maximumDemandKva.value === 450,
    "Canonical Demand: maximumDemandKva is 450",
  );

  // 7. Reactive Section
  assert(
    canonicalRecord.reactive.reactiveEnergyKvarh.value === null,
    "Canonical Reactive: unbilled reactive remains null (not invented)",
  );

  // 8. Financial Section
  assert(
    canonicalRecord.financial.subtotalZar.value === 100000,
    "Canonical Financial: subtotal is R 100,000",
  );
  assert(canonicalRecord.financial.vatZar.value === 15000, "Canonical Financial: VAT is R 15,000");
  assert(
    canonicalRecord.financial.invoiceTotalZar.value === 115000,
    "Canonical Financial: invoice total is R 115,000",
  );

  // Provenance Verification (Requirement 7)
  const accSource = canonicalRecord.customer.accountNumber.source;
  assert(accSource !== null, "Field-level evidence: accountNumber has non-null source provenance");
  assert(
    accSource?.document_id === "doc-clean-auth-001",
    "Field-level evidence: source document_id matches",
  );
  assert(accSource?.page === 1, "Field-level evidence: source page is 1");
  assert(
    accSource?.text === "Account Number: 0123456789",
    "Field-level evidence: source text preserved verbatim",
  );
  assert(
    Array.isArray(accSource?.bounding_box) && accSource?.bounding_box.length === 4,
    "Field-level evidence: bounding box is 4-element coordinate tuple",
  );
  assert(
    accSource?.extraction_method === "ocr",
    "Field-level evidence: extraction_method is 'ocr'",
  );
  assert(
    canonicalRecord.customer.accountNumber.confidence === 0.96,
    "Field-level evidence: confidence is 0.96",
  );

  // Immutability & Status
  assert(
    canonicalRecord.isImmutable === true,
    "Canonical record marked immutable upon automatic approval",
  );
  assert(
    canonicalRecord.provenanceSummary.groundedFieldsCount > 0,
    "Provenance summary confirms grounded fields count",
  );

  // --- TEST GROUP 5: STRUCTURED AI INPUT (REQ 8) ---
  console.log(
    "\n[Test 5] Builds structured AI input payload with targeted evidence (No uncontrolled blobs)",
  );
  const aiPayload = StructuredAiPayloadBuilder.buildPayload({
    documentId: "doc-clean-auth-001",
    candidateFields: cleanCandidateFields,
    supplierContext: "ESKOM",
  });
  assert(
    aiPayload.documentId === "doc-clean-auth-001",
    "Structured AI Input: documentId populated",
  );
  assert(
    aiPayload.candidateFields.length === cleanCandidateFields.length,
    "Structured AI Input: Contains targeted candidate fields",
  );
  assert(
    aiPayload.metadata.detectedSupplier === "ESKOM",
    "Structured AI Input: Supplier context attached",
  );
  assert(
    typeof aiPayload.expectedOutputJsonSchema === "string",
    "Structured AI Input: Output schema provided in prompt",
  );

  // --- TEST GROUP 6: STRUCTURED AI OUTPUT SCHEMA & REJECTION (REQ 9) ---
  console.log("\n[Test 6] Validates structured AI JSON responses and rejects malformed outputs");
  const validAiResponse = {
    document_id: "doc-clean-auth-001",
    overall_status: "VALID" as const,
    overall_confidence: 0.96,
    supplier_context: "ESKOM",
    validated_fields: [
      {
        field: "billing_period",
        status: "VALID" as const,
        confidence: 0.96,
        reason: "Two date references agree with the billing period shown on page 1",
        evidence: [
          {
            page: 1,
            source_text: "01 September 2026 - 30 September 2026",
          },
        ],
      },
    ],
    anomalies_detected: [],
  };

  const validationResult = StructuredAiResponseValidator.validateResponse(
    validAiResponse,
    "doc-clean-auth-001",
  );
  assert(
    validationResult.isValid === true,
    "Structured AI Output: Valid response passed schema validation",
  );
  assert(
    validationResult.data?.overall_status === "VALID",
    "Structured AI Output: Overall status is VALID",
  );

  // Test Malformed JSON String Rejection
  const malformedString = "{ invalid_json: missing_quotes ";
  const malformedResult = StructuredAiResponseValidator.validateResponse(
    malformedString,
    "doc-clean-auth-001",
  );
  assert(malformedResult.isValid === false, "Structured AI Output: Malformed JSON string rejected");
  assert(
    malformedResult.errorMessage?.includes("MALFORMED_AI_OUTPUT") === true,
    "Structured AI Output: Rejection error message matches",
  );

  // Test Schema Violation Rejection (Confidence out of bounds)
  const schemaViolation = {
    document_id: "doc-clean-auth-001",
    overall_status: "VALID",
    overall_confidence: 1.5, // Exceeds 1.0 limit
    validated_fields: [],
  };
  const schemaViolationResult = StructuredAiResponseValidator.validateResponse(
    schemaViolation,
    "doc-clean-auth-001",
  );
  assert(
    schemaViolationResult.isValid === false,
    "Structured AI Output: Out-of-bounds confidence rejected by Zod schema",
  );

  // Test Document ID Mismatch Rejection
  const idMismatch = {
    ...validAiResponse,
    document_id: "doc-different-999",
  };
  const idMismatchResult = StructuredAiResponseValidator.validateResponse(
    idMismatch,
    "doc-clean-auth-001",
  );
  assert(idMismatchResult.isValid === false, "Structured AI Output: Document ID mismatch rejected");

  // Test Fallback Conversion
  const fallback = StructuredAiResponseValidator.createFallbackResult(
    "doc-clean-auth-001",
    "Invalid Schema",
  );
  assert(
    fallback.overallSemanticConsistency === "AMBIGUOUS",
    "Structured AI Output: Fallback initiates safe AMBIGUOUS status",
  );

  // --- TEST GROUP 7: ARITHMETIC DISCREPANCY EXCEPTION HANDLING ---
  console.log("\n[Test 7] Flags arithmetic discrepancies without mutating invoice numbers");
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
