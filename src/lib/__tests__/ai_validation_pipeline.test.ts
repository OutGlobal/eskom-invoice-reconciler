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
  CrossFieldValidator,
  OcrErrorDetector,
  MultiEvidenceReconciler,
  DuplicateFieldDetector,
  MissingDataGuard,
  AiFailureHandler,
  IdempotencyManager,
  ValidationRunStore,
  EneraAuditChainEngine,
  HumanReviewWorkflowEngine,
  ApprovalStateManager,
  ReconciliationGate,
  ReconciliationGateError,
  ExceptionManager,
  FrontendValidationDataLoader,
  CanonicalInvoiceBuilder,
  StructuredAiPayloadBuilder,
  StructuredAiResponseValidator,
  VALIDATION_TOLERANCES,
  ValidationToleranceEvaluator,
  type CandidateFieldValidationInput,
  type EvidenceStreamReading,
  type DuplicateFieldOccurrence,
} from "../../domain/ai-validation";
import { InvoiceStorageService } from "../../domain/invoice/invoiceStorageService";

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
    "Canonical Reactive: non-billed reactive remains null (not invented)",
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

  // --- TEST GROUP 8: 6 AI VALIDATION STATES (REQ 10) ---
  console.log(
    "\n[Test 8] Evaluates 6 distinct AI validation states (VALID, INVALID, UNCERTAIN, MISSING, CONFLICT, REVIEW_REQUIRED)",
  );

  // 1. VALID state
  const accFieldScore = cleanResult.overallConfidence.fieldScores["accountNumber"];
  assert(
    accFieldScore.status === "VALID",
    "State VALID: Clean grounded account number marked VALID",
  );
  assert(
    accFieldScore.score >= 90,
    `Field Score: Account Number validation score is ${accFieldScore.score}%`,
  );

  // 2. MISSING state
  const missingValResult = await ValidationPipeline.executePipeline({
    documentId: "doc-missing-test",
    candidateFields: [
      {
        fieldKey: "reactiveEnergyKvarh",
        fieldLabel: "Reactive Energy",
        value: null,
        rawValue: "",
        sourcePage: 1,
        opticalConfidence: 0,
      },
    ],
  });
  const reactiveScore = missingValResult.overallConfidence.fieldScores["reactiveEnergyKvarh"];
  assert(
    reactiveScore.status === "MISSING",
    "State MISSING: Unextracted field marked MISSING without invention",
  );
  assert(reactiveScore.score === 0, "State MISSING: Validation confidence score is strictly 0%");

  // 3. INVALID state
  const invalidFieldScore = mathDiscrepancyResult.overallConfidence.fieldScores["totalAmountDue"];
  assert(
    invalidFieldScore.status === "INVALID",
    "State INVALID: Field failing arithmetic equality marked INVALID",
  );

  // 4. UNCERTAIN state
  const uncertainValResult = await ValidationPipeline.executePipeline({
    documentId: "doc-uncertain-test",
    candidateFields: [
      {
        fieldKey: "meterNumber",
        fieldLabel: "Meter Number",
        value: "MTR-O8822", // Optical O vs 0 ambiguity
        rawValue: "MTR-O8822",
        sourcePage: 1,
        boundingBox: [0.25, 0.1, 0.28, 0.3],
        opticalConfidence: 68, // Low optical clarity
        sourceText: "Meter No: MTR-O8822",
      },
    ],
  });
  const uncertainScore = uncertainValResult.overallConfidence.fieldScores["meterNumber"];
  assert(
    uncertainScore.status === "UNCERTAIN",
    "State UNCERTAIN: Ambiguous / low optical score field marked UNCERTAIN",
  );

  // --- TEST GROUP 9: FIELD-LEVEL VALIDATION CONFIDENCE SCORES (REQ 11) ---
  console.log("\n[Test 9] Verifies field-level validation confidence score breakdowns");
  assert(
    accFieldScore.scoreType === "VALIDATION_CONFIDENCE_SCORE",
    "Score Designation: Explicitly labeled VALIDATION_CONFIDENCE_SCORE (Not Bayesian probability)",
  );
  assert(
    typeof accFieldScore.breakdown.opticalClarity === "number",
    "Score Breakdown: Includes optical clarity component",
  );
  assert(
    typeof accFieldScore.breakdown.spatialBounding === "number",
    "Score Breakdown: Includes spatial bounding component",
  );
  assert(
    typeof accFieldScore.breakdown.semanticAgreement === "number",
    "Score Breakdown: Includes semantic agreement component",
  );
  assert(
    typeof accFieldScore.breakdown.deterministicAgreement === "number",
    "Score Breakdown: Includes deterministic agreement component",
  );

  // --- TEST GROUP 10: CONFIDENCE CATEGORIES & CONFIGURABLE POLICY (REQ 12) ---
  console.log("\n[Test 10] Evaluates confidence categories (HIGH, MEDIUM, LOW) and configurable policy thresholds");

  // Clean high-confidence run
  assert(
    cleanResult.overallConfidence.tier === "HIGH",
    "Category HIGH: Clean document classified as HIGH confidence tier",
  );
  assert(
    cleanResult.overallConfidence.policyAction === "ELIGIBLE_FOR_AUTOMATIC_PROGRESSION",
    "Policy Action: HIGH tier maps to ELIGIBLE_FOR_AUTOMATIC_PROGRESSION",
  );

  // Medium confidence run (e.g. moderate optical quality without arithmetic invalidity)
  const mediumDocResult = await ValidationPipeline.executePipeline({
    documentId: "doc-medium-test",
    candidateFields: [
      {
        fieldKey: "accountNumber",
        fieldLabel: "Account Number",
        value: "0123456789",
        rawValue: "0123456789",
        sourcePage: 1,
        boundingBox: [0.1, 0.1, 0.15, 0.3],
        opticalConfidence: 75,
        sourceText: "Account: 0123456789",
      },
      {
        fieldKey: "totalAmountDue",
        fieldLabel: "Total Amount Due",
        value: 10000,
        rawValue: "R 10,000.00",
        sourcePage: 1,
        boundingBox: [0.8, 0.1, 0.85, 0.3],
        opticalConfidence: 78,
        sourceText: "Total: R 10,000.00",
      },
    ],
  });
  assert(
    mediumDocResult.overallConfidence.tier === "MEDIUM" || mediumDocResult.overallConfidence.tier === "HIGH",
    "Category MEDIUM: Moderately clear document assigned expected tier",
  );
  assert(
    mediumDocResult.overallConfidence.policyAction === "ADDITIONAL_DETERMINISTIC_CHECKS" ||
      mediumDocResult.overallConfidence.policyAction === "ELIGIBLE_FOR_AUTOMATIC_PROGRESSION",
    "Policy Action: MEDIUM tier triggers additional deterministic checks or automatic progression",
  );

  // Low confidence run (arithmetic contradiction)
  assert(
    mathDiscrepancyResult.overallConfidence.tier === "LOW",
    "Category LOW: Document with arithmetic failure classified as LOW",
  );
  assert(
    mathDiscrepancyResult.overallConfidence.policyAction === "REVIEW_REQUIRED",
    "Policy Action: LOW tier requires human review",
  );

  // Configurable thresholds check
  const strictThresholdResult = await ValidationPipeline.executePipeline(
    {
      documentId: "doc-clean-strict",
      candidateFields: cleanCandidateFields,
    },
    {
      thresholds: {
        highThreshold: 99, // Unusually strict threshold
      },
    },
  );
  assert(
    strictThresholdResult.overallConfidence.qualitySummary.configuredThresholds.highThreshold === 99,
    "Configurable Thresholds: Custom highThreshold (99) properly registered",
  );

  // --- TEST GROUP 11: DOCUMENT-LEVEL QUALITY & ANTI-MASKING PROTECTION (REQ 13) ---
  console.log("\n[Test 11] Validates document-level confidence status and anti-masking protection for critical fields");

  // 1. Clean invoice -> DOCUMENT_VERIFIED
  assert(
    cleanResult.overallConfidence.documentStatus === "DOCUMENT_VERIFIED",
    "Document Status: Clean document evaluated as DOCUMENT_VERIFIED",
  );
  assert(
    cleanResult.overallConfidence.qualitySummary.hasFailingCriticalField === false,
    "Document Status: Clean document has zero critical field failures",
  );

  // 2. Arithmetic mismatch -> DOCUMENT_INVALID
  assert(
    mathDiscrepancyResult.overallConfidence.documentStatus === "DOCUMENT_INVALID",
    "Document Status: Math mismatch evaluated as DOCUMENT_INVALID",
  );

  // 3. ANTI-MASKING TEST:
  // 10 non-critical fields with 100% confidence, but 1 critical financial field (subtotal) with low confidence
  const antiMaskingCandidateFields: CandidateFieldValidationInput[] = [
    // Non-critical auxiliary fields (all 100% perfect confidence)
    {
      fieldKey: "customerName",
      fieldLabel: "Customer Name",
      value: "Acme Industrial Pty Ltd",
      rawValue: "Acme Industrial Pty Ltd",
      sourcePage: 1,
      boundingBox: [0.1, 0.1, 0.15, 0.3],
      opticalConfidence: 100,
      sourceText: "Customer: Acme Industrial Pty Ltd",
    },
    {
      fieldKey: "premiseAddress",
      fieldLabel: "Premise Address",
      value: "100 Power Grid Way, Johannesburg",
      rawValue: "100 Power Grid Way, Johannesburg",
      sourcePage: 1,
      boundingBox: [0.15, 0.1, 0.2, 0.3],
      opticalConfidence: 100,
      sourceText: "Site: 100 Power Grid Way, Johannesburg",
    },
    {
      fieldKey: "meterType",
      fieldLabel: "Meter Type",
      value: "Bulk 4-Quadrant Electronic",
      rawValue: "Bulk 4-Quadrant Electronic",
      sourcePage: 1,
      boundingBox: [0.2, 0.1, 0.25, 0.3],
      opticalConfidence: 100,
      sourceText: "Meter Type: Bulk 4-Quadrant Electronic",
    },
    // Critical financial field with low confidence / optical blur
    {
      fieldKey: "subtotal",
      fieldLabel: "Subtotal",
      value: 100000,
      rawValue: "R 100,000.00",
      sourcePage: 1,
      boundingBox: [0.75, 0.1, 0.8, 0.3],
      opticalConfidence: 45, // Critical field is blurry/uncertain
      sourceText: "Subtotal: R 100,000.00",
    },
    {
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      value: 115000,
      rawValue: "R 115,000.00",
      sourcePage: 1,
      boundingBox: [0.85, 0.1, 0.9, 0.3],
      opticalConfidence: 100,
      sourceText: "Total: R 115,000.00",
    },
  ];

  const antiMaskingResult = await ValidationPipeline.executePipeline({
    documentId: "doc-anti-masking-test",
    candidateFields: antiMaskingCandidateFields,
  });

  assert(
    antiMaskingResult.overallConfidence.documentStatus !== "DOCUMENT_VERIFIED",
    "Anti-Masking: High non-critical scores CANNOT mask critical financial field uncertainty",
  );
  assert(
    antiMaskingResult.overallConfidence.qualitySummary.hasFailingCriticalField === true,
    "Anti-Masking: Critical field failure correctly flagged",
  );
  assert(
    antiMaskingResult.overallConfidence.qualitySummary.criticalFieldFailures.length > 0,
    "Anti-Masking: Critical field failure reasons listed explicitly",
  );
  assert(
    antiMaskingResult.reconciliationHandoffReady === false,
    "Anti-Masking: Reconciliation handoff strictly blocked when critical fields have validation uncertainty",
  );

  // --- TEST GROUP 12: CRITICAL FIELDS ROSTER & UNRESOLVED FIELD POLICY (REQ 14) ---
  console.log("\n[Test 12] Enforces Critical Fields identification and mandatory REVIEW_REQUIRED on unresolved critical fields");

  // Incomplete document missing critical financial fields
  const missingCriticalDocResult = await ValidationPipeline.executePipeline({
    documentId: "doc-missing-critical",
    candidateFields: [
      {
        fieldKey: "accountNumber",
        fieldLabel: "Account Number",
        value: "0123456789",
        rawValue: "0123456789",
        sourcePage: 1,
        boundingBox: [0.1, 0.1, 0.15, 0.3],
        opticalConfidence: 95,
        sourceText: "Account: 0123456789",
      },
      // Note: invoiceTotal and subtotal are MISSING (unresolved)
    ],
  });

  assert(
    missingCriticalDocResult.status === "REVIEW_REQUIRED",
    "Critical Fields: Unresolved critical financial fields transition document to REVIEW_REQUIRED",
  );
  assert(
    missingCriticalDocResult.reconciliationHandoffReady === false,
    "Critical Fields: Reconciliation handoff strictly disabled when critical fields are unresolved",
  );

  // --- TEST GROUP 13: COMPREHENSIVE DETERMINISTIC VALIDATION RULES (REQ 15) ---
  console.log("\n[Test 13] Verifies authoritative deterministic validation rules (TOU balance, Date Chronology, Demand, Power Factor)");

  // 1. TOU Energy Balance
  const touCandidateFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "peakKwh",
      fieldLabel: "Peak Active Energy",
      value: 10000,
      rawValue: "10,000 kWh",
      sourcePage: 1,
      boundingBox: [0.2, 0.1, 0.25, 0.3],
      opticalConfidence: 95,
      sourceText: "Peak: 10,000 kWh",
    },
    {
      fieldKey: "standardKwh",
      fieldLabel: "Standard Active Energy",
      value: 20000,
      rawValue: "20,000 kWh",
      sourcePage: 1,
      boundingBox: [0.25, 0.1, 0.3, 0.3],
      opticalConfidence: 95,
      sourceText: "Standard: 20,000 kWh",
    },
    {
      fieldKey: "offPeakKwh",
      fieldLabel: "Off-Peak Active Energy",
      value: 30000,
      rawValue: "30,000 kWh",
      sourcePage: 1,
      boundingBox: [0.3, 0.1, 0.35, 0.3],
      opticalConfidence: 95,
      sourceText: "Off-Peak: 30,000 kWh",
    },
    {
      fieldKey: "totalKwh",
      fieldLabel: "Total Active Energy",
      value: 60000, // 10k + 20k + 30k == 60k
      rawValue: "60,000 kWh",
      sourcePage: 1,
      boundingBox: [0.35, 0.1, 0.4, 0.3],
      opticalConfidence: 95,
      sourceText: "Total Active: 60,000 kWh",
    },
  ];

  const touResult = await ValidationPipeline.executePipeline({
    documentId: "doc-tou-test",
    candidateFields: touCandidateFields,
  });

  const touEval = touResult.deterministicValidation.evaluations.find((e) => e.ruleType === "TOU_ENERGY_SUM");
  assert(touEval !== undefined && touEval.isPassed === true, "Deterministic TOU: Exact sum Peak + Standard + Off-Peak == Total matches");

  // 2. Date Chronology (Start < End)
  const invalidDateFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "billingPeriodStart",
      fieldLabel: "Billing Period Start",
      value: "2026-03-31",
      rawValue: "31 March 2026",
      sourcePage: 1,
      boundingBox: [0.1, 0.1, 0.15, 0.3],
      opticalConfidence: 95,
      sourceText: "Start Date: 31 March 2026",
    },
    {
      fieldKey: "billingPeriodEnd",
      fieldLabel: "Billing Period End",
      value: "2026-03-01", // Start > End is chronologically invalid
      rawValue: "01 March 2026",
      sourcePage: 1,
      boundingBox: [0.15, 0.1, 0.2, 0.3],
      opticalConfidence: 95,
      sourceText: "End Date: 01 March 2026",
    },
  ];

  const invalidDateResult = await ValidationPipeline.executePipeline({
    documentId: "doc-invalid-date-test",
    candidateFields: invalidDateFields,
  });

  const dateEval = invalidDateResult.deterministicValidation.evaluations.find((e) => e.ruleType === "DATE_CHRONOLOGY");
  assert(dateEval !== undefined && dateEval.isPassed === false, "Deterministic Dates: Start Date >= End Date flagged as chronological error");

  // 3. Power Factor Meaningful Bounds (0.00 <= PF <= 1.00)
  const validPfFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "powerFactor",
      fieldLabel: "Power Factor",
      value: 0.92,
      rawValue: "0.92",
      sourcePage: 1,
      boundingBox: [0.5, 0.1, 0.55, 0.3],
      opticalConfidence: 95,
      sourceText: "Power Factor: 0.92",
    },
  ];

  const validPfResult = await ValidationPipeline.executePipeline({
    documentId: "doc-valid-pf",
    candidateFields: validPfFields,
  });
  const pfEval = validPfResult.deterministicValidation.evaluations.find((e) => e.ruleType === "POWER_FACTOR_BOUNDS");
  assert(pfEval !== undefined && pfEval.isPassed === true, "Deterministic PF: Valid PF (0.92) is within [0.00, 1.00] bounds");

  const invalidPfFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "powerFactor",
      fieldLabel: "Power Factor",
      value: 1.85, // Impossible PF > 1.0
      rawValue: "1.85",
      sourcePage: 1,
      boundingBox: [0.5, 0.1, 0.55, 0.3],
      opticalConfidence: 95,
      sourceText: "Power Factor: 1.85",
    },
  ];

  const invalidPfResult = await ValidationPipeline.executePipeline({
    documentId: "doc-invalid-pf",
    candidateFields: invalidPfFields,
  });
  const invalidPfEval = invalidPfResult.deterministicValidation.evaluations.find((e) => e.ruleType === "POWER_FACTOR_BOUNDS");
  assert(invalidPfEval !== undefined && invalidPfEval.isPassed === false, "Deterministic PF: Impossible PF (1.85) flagged as out of bounds");

  // 4. Deterministic Precedence over AI
  // Deterministic failure forces field status to INVALID even if AI considered it valid
  const failingField = invalidPfResult.overallConfidence.fieldScores["powerFactor"];
  assert(failingField.status === "INVALID", "Deterministic Precedence: Deterministic rule failure forces field state to INVALID");
  assert(invalidPfResult.status === "REVIEW_REQUIRED", "Deterministic Precedence: AI cannot override deterministic failure");

  // --- TEST GROUP 14: CENTRALIZED TOLERANCES & DOMAIN RATIONALE (REQ 16) ---
  console.log("\n[Test 14] Evaluates centralized tolerances and explicit rounding evaluations");

  // 1. Verify tolerance definitions exist and have documented rationales
  assert(VALIDATION_TOLERANCES.FINANCIAL_CENT.value === 0.02, "Tolerances: Financial cent tolerance is 2 cents");
  assert(typeof VALIDATION_TOLERANCES.FINANCIAL_CENT.rationale === "string", "Tolerances: Financial cent rationale documented");
  assert(VALIDATION_TOLERANCES.ENERGY_KWH.value === 1.0, "Tolerances: Energy kWh tolerance is 1.0 kWh");
  assert(typeof VALIDATION_TOLERANCES.ENERGY_KWH.rationale === "string", "Tolerances: Energy kWh rationale documented");
  assert(VALIDATION_TOLERANCES.METER_CONSUMPTION_DELTA.value === 2.0, "Tolerances: Meter reading delta tolerance is 2.0 kWh");

  // 2. Tolerance Evaluator - within tolerance
  const evalWithin = ValidationToleranceEvaluator.evaluateNumericTolerance({
    expected: 100.0,
    actual: 100.015,
    toleranceDef: VALIDATION_TOLERANCES.FINANCIAL_CENT,
  });
  assert(evalWithin.isPassed === true, "Tolerance Evaluator: R 0.015 diff passes within R 0.02 tolerance");
  assert(evalWithin.difference === 0.015, "Tolerance Evaluator: Difference recorded accurately");

  // 3. Tolerance Evaluator - exceeds tolerance
  const evalExceeds = ValidationToleranceEvaluator.evaluateNumericTolerance({
    expected: 100.0,
    actual: 100.05,
    toleranceDef: VALIDATION_TOLERANCES.FINANCIAL_CENT,
  });
  assert(evalExceeds.isPassed === false, "Tolerance Evaluator: R 0.05 diff correctly fails R 0.02 tolerance");
  assert(typeof evalExceeds.message === "string", "Tolerance Evaluator: Clear error message generated on exceedance");

  // --- TEST GROUP 15: COMPREHENSIVE CROSS-FIELD VALIDATION (REQ 17) ---
  console.log("\n[Test 15] Evaluates all 7 relational cross-field validation rules");

  // Test full candidate invoice with all 7 cross-field relations
  const fullCrossCandidateFields: CandidateFieldValidationInput[] = [
    // 1. Account & Customer & Site
    {
      fieldKey: "accountNumber",
      fieldLabel: "Account Number",
      value: "0123456789",
      rawValue: "0123456789",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Account: 0123456789",
    },
    {
      fieldKey: "customerName",
      fieldLabel: "Customer Name",
      value: "Mega Industrial Plant Pty Ltd",
      rawValue: "Mega Industrial Plant Pty Ltd",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Customer: Mega Industrial Plant Pty Ltd",
    },
    {
      fieldKey: "premiseAddress",
      fieldLabel: "Premise Address",
      value: "Portion 5, Farm Industrial Park, Rustenburg",
      rawValue: "Portion 5, Farm Industrial Park, Rustenburg",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Premise: Portion 5, Farm Industrial Park, Rustenburg",
    },
    // 2. Meter Number
    {
      fieldKey: "meterNumber",
      fieldLabel: "Meter Number",
      value: "MTR-883311-ZA",
      rawValue: "MTR-883311-ZA",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Meter No: MTR-883311-ZA",
    },
    // 3. Billing Period & Invoice Dates
    {
      fieldKey: "billingPeriodStart",
      fieldLabel: "Billing Period Start",
      value: "2026-04-01",
      rawValue: "01 April 2026",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Billing Period: 01/04/2026",
    },
    {
      fieldKey: "billingPeriodEnd",
      fieldLabel: "Billing Period End",
      value: "2026-04-30",
      rawValue: "30 April 2026",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "to 30/04/2026",
    },
    {
      fieldKey: "issueDate",
      fieldLabel: "Invoice Issue Date",
      value: "2026-05-02",
      rawValue: "02 May 2026",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Date of Issue: 02 May 2026",
    },
    // 4. Tariff Category
    {
      fieldKey: "tariffName",
      fieldLabel: "Tariff Name",
      value: "Megaflex Non-Local High Voltage",
      rawValue: "Megaflex Non-Local High Voltage",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Tariff: Megaflex Non-Local High Voltage",
    },
    // 5. TOU Active Energy Balance
    {
      fieldKey: "peakEnergyKwh",
      fieldLabel: "Peak Active Energy",
      value: 50000,
      rawValue: "50,000 kWh",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Peak: 50,000 kWh",
    },
    {
      fieldKey: "standardEnergyKwh",
      fieldLabel: "Standard Active Energy",
      value: 100000,
      rawValue: "100,000 kWh",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Standard: 100,000 kWh",
    },
    {
      fieldKey: "offPeakEnergyKwh",
      fieldLabel: "Off-Peak Active Energy",
      value: 50000,
      rawValue: "50,000 kWh",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Off-Peak: 50,000 kWh",
    },
    {
      fieldKey: "totalActiveEnergyKwh",
      fieldLabel: "Total Active Energy",
      value: 200000, // 50k + 100k + 50k == 200k
      rawValue: "200,000 kWh",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Total kWh: 200,000 kWh",
    },
    // 6. Subtotal + VAT (15%) == Invoice Total
    {
      fieldKey: "subtotal",
      fieldLabel: "Subtotal",
      value: 500000,
      rawValue: "R 500,000.00",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Subtotal Excl VAT: R 500,000.00",
    },
    {
      fieldKey: "vatAmount",
      fieldLabel: "VAT Amount",
      value: 75000, // 15% of 500,000 == 75,000
      rawValue: "R 75,000.00",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "VAT 15%: R 75,000.00",
    },
    {
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      value: 575000, // 500k + 75k == 575k
      rawValue: "R 575,000.00",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Total Due: R 575,000.00",
    },
    // 7. Meter Readings Delta: (Curr - Prev) * Multiplier == Billed Total
    {
      fieldKey: "previousReading",
      fieldLabel: "Previous Meter Index",
      value: 12000,
      rawValue: "12,000",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Previous Reading: 12,000",
    },
    {
      fieldKey: "currentReading",
      fieldLabel: "Current Meter Index",
      value: 14000,
      rawValue: "14,000",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Current Reading: 14,000",
    },
    {
      fieldKey: "meterMultiplier",
      fieldLabel: "Meter Multiplier",
      value: 100, // (14,000 - 12,000) * 100 == 200,000 kWh
      rawValue: "100",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "CT/VT Multiplier: 100",
    },
  ];

  const crossResult = CrossFieldValidator.validateCrossFields(fullCrossCandidateFields);

  assert(crossResult.isCompliant === true, "Cross-Field: All 7 cross-field relational checks passed");
  assert(crossResult.findings.length === 7, "Cross-Field: Exactly 7 cross-field findings generated");

  const accFinding = crossResult.findings.find((f) => f.ruleCode === "ACCOUNT_CUSTOMER_SITE_LINK");
  assert(accFinding !== undefined && accFinding.isConsistent === true, "Cross-Field 1: Account ↔ Customer/Site confirmed");

  const meterFinding = crossResult.findings.find((f) => f.ruleCode === "METER_SITE_LINK");
  assert(meterFinding !== undefined && meterFinding.isConsistent === true, "Cross-Field 2: Meter ↔ Site confirmed");

  const datesFinding = crossResult.findings.find((f) => f.ruleCode === "BILLING_PERIOD_INVOICE_DATES");
  assert(datesFinding !== undefined && datesFinding.isConsistent === true, "Cross-Field 3: Billing period ↔ Invoice dates confirmed");

  const tariffFinding = crossResult.findings.find((f) => f.ruleCode === "TARIFF_DOCUMENT_CATEGORY");
  assert(tariffFinding !== undefined && tariffFinding.isConsistent === true, "Cross-Field 4: Tariff ↔ Category confirmed");

  const touFinding = crossResult.findings.find((f) => f.ruleCode === "TOU_TOTAL_ENERGY_BALANCE");
  assert(touFinding !== undefined && touFinding.isConsistent === true, "Cross-Field 5: TOU Active Energy ↔ Total Active Energy confirmed");

  const finFinding = crossResult.findings.find((f) => f.ruleCode === "SUBTOTAL_VAT_TOTAL_RELATION");
  assert(finFinding !== undefined && finFinding.isConsistent === true, "Cross-Field 6: Subtotal + VAT ↔ Invoice Total (15% rate) confirmed");

  const deltaFinding = crossResult.findings.find((f) => f.ruleCode === "CONSUMPTION_METER_READINGS_DELTA");
  assert(deltaFinding !== undefined && deltaFinding.isConsistent === true, "Cross-Field 7: Consumption ↔ (Current - Previous) * Multiplier confirmed");

  // ==================================================================
  // TEST GROUP 18: OCR ERROR DETECTION (REQUIREMENT 18)
  // ==================================================================
  console.log("\n[Test Group 18] OCR Error Detection — Character Confusions, Decimal Anomalies, and Non-Destructive Workflow");

  // 18.1: Account Number Character Confusions (O->0, S->5, B->8, I->1)
  const ocrCorruptedAccountInput: CandidateFieldValidationInput[] = [
    {
      fieldKey: "accountNumber",
      fieldLabel: "Account Number",
      value: "O1234S678B",
      rawValue: "O1234S678B",
      sourcePage: 1,
      opticalConfidence: 75,
      sourceText: "Account No: O1234S678B",
    },
  ];

  const ocrAccountResult = OcrErrorDetector.detectErrors("DOC-OCR-01", ocrCorruptedAccountInput);
  assert(ocrAccountResult.hasSuspectedOcrErrors === true, "OCR Detector: Flags suspected OCR error in account number");
  assert(ocrAccountResult.findings.length === 1, "OCR Detector: Exactly 1 OCR error finding generated");

  const accOcrFinding = ocrAccountResult.findings[0];
  assert(accOcrFinding.errorType === "INCORRECT_ACCOUNT_NUMBER", "OCR Detector: Error type is INCORRECT_ACCOUNT_NUMBER");
  assert(accOcrFinding.suspicionStatus === "POSSIBLE_OCR_ERROR", "OCR Detector: Status is explicitly POSSIBLE_OCR_ERROR");
  assert(accOcrFinding.workflowStage === "EVIDENCE_REVIEW", "OCR Detector: Workflow stage is EVIDENCE_REVIEW");
  assert(accOcrFinding.rawObserved === "O1234S678B", "OCR Detector: Non-destructive raw observed value is strictly preserved");
  assert(accOcrFinding.candidateAlternative === "0123456788", "OCR Detector: Suggests clean candidate alternative '0123456788'");
  assert(accOcrFinding.confusionPairs.length === 3, "OCR Detector: Identifies exactly 3 character confusion pairs (O, S, B)");
  assert(accOcrFinding.requiresUserConfirmation === true, "OCR Detector: Requires user confirmation before accepting candidate");

  // 18.2: Monetary Character Confusion & Decimal Shifts
  const ocrFinancialFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "subtotal",
      fieldLabel: "Subtotal",
      value: 500,
      rawValue: "R S00.00", // 'S' in place of '5'
      sourcePage: 1,
      opticalConfidence: 80,
    },
    {
      fieldKey: "vatAmount",
      fieldLabel: "VAT Amount",
      value: 12345.67,
      rawValue: "12.345.67", // multiple decimal points
      sourcePage: 1,
      opticalConfidence: 70,
    },
    {
      fieldKey: "totalAmountDue",
      fieldLabel: "Total Amount Due",
      value: 142500, // missing decimal (142500 cents vs R 1425.00)
      rawValue: "142500",
      sourcePage: 1,
      opticalConfidence: 85,
    },
  ];

  const ocrFinResult = OcrErrorDetector.detectErrors("DOC-OCR-02", ocrFinancialFields);
  assert(ocrFinResult.hasSuspectedOcrErrors === true, "OCR Detector: Flags financial character confusion and decimal shifts");

  const sSubtotalFinding = ocrFinResult.findings.find((f) => f.fieldKey === "subtotal");
  assert(sSubtotalFinding !== undefined, "OCR Detector: Found subtotal 'S' confusion finding");
  assert(sSubtotalFinding?.errorType === "CHARACTER_CONFUSION", "OCR Detector: Subtotal error type is CHARACTER_CONFUSION");

  const decShiftFinding = ocrFinResult.findings.find((f) => f.fieldKey === "vatAmount");
  assert(decShiftFinding !== undefined, "OCR Detector: Found VAT amount multiple decimal points");
  assert(decShiftFinding?.errorType === "DECIMAL_SHIFT", "OCR Detector: VAT amount error type is DECIMAL_SHIFT");

  const missingDecFinding = ocrFinResult.findings.find((f) => f.fieldKey === "totalAmountDue");
  assert(missingDecFinding !== undefined, "OCR Detector: Found totalAmountDue missing decimal point");
  assert(missingDecFinding?.errorType === "MISSING_DECIMAL", "OCR Detector: Total amount error type is MISSING_DECIMAL");
  assert(missingDecFinding?.candidateAlternative === 1425, "OCR Detector: Candidate alternative is R 1,425.00");

  // 18.3: Impossible Calendar Dates & Year Corruptions
  const ocrDateFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "billingPeriodStart",
      fieldLabel: "Billing Period Start",
      value: "2026-02-31", // February 31st (impossible)
      rawValue: "31/02/2026",
      sourcePage: 1,
      opticalConfidence: 75,
    },
    {
      fieldKey: "billingPeriodEnd",
      fieldLabel: "Billing Period End",
      value: "202S-09-30", // Year '202S' instead of '2025'
      rawValue: "202S-09-30",
      sourcePage: 1,
      opticalConfidence: 78,
    },
  ];

  const ocrDateResult = OcrErrorDetector.detectErrors("DOC-OCR-03", ocrDateFields);
  assert(ocrDateResult.hasSuspectedOcrErrors === true, "OCR Detector: Flags impossible date and year digit corruption");

  const febFinding = ocrDateResult.findings.find((f) => f.fieldKey === "billingPeriodStart");
  assert(febFinding !== undefined, "OCR Detector: Identified impossible February 31 date");
  assert(febFinding?.errorType === "INCORRECT_DATE", "OCR Detector: Error type is INCORRECT_DATE");

  const yearFinding = ocrDateResult.findings.find((f) => f.fieldKey === "billingPeriodEnd");
  assert(yearFinding !== undefined, "OCR Detector: Identified corrupted year 202S");
  assert(yearFinding?.candidateAlternative === "2025-09-30", "OCR Detector: Candidate alternative is 2025-09-30");

  // 18.4: Word Token OCR Confusion (e.g. ESK0M, 1NVOICE)
  const ocrTokenFields: CandidateFieldValidationInput[] = [
    {
      fieldKey: "supplierName",
      fieldLabel: "Supplier Name",
      value: "ESKOM",
      rawValue: "ESK0M",
      sourcePage: 1,
      opticalConfidence: 85,
      wordTokens: [{ text: "ESK0M", confidence: 85, boundingBox: [0.05, 0.05, 0.08, 0.15] }],
    },
  ];
  const ocrTokenResult = OcrErrorDetector.detectErrors("DOC-OCR-04", ocrTokenFields);
  assert(ocrTokenResult.hasSuspectedOcrErrors === true, "OCR Detector: Flags digit 0 in 'ESK0M'");
  assert(ocrTokenResult.findings[0].candidateAlternative === "ESKOM", "OCR Detector: Correct candidate word is 'ESKOM'");

  // ==================================================================
  // TEST GROUP 19: MULTIPLE EVIDENCE SOURCES RECONCILIATION (REQUIREMENT 19)
  // ==================================================================
  console.log("\n[Test Group 19] Multiple Evidence Sources — Cross-Stream Agreement Boosting & Conflict Enforcement");

  // 19.1: Multi-Source Agreement Boost (OCR + Native PDF + Table Extraction agree)
  const agreeingMultiSourceField: CandidateFieldValidationInput = {
    fieldKey: "invoiceTotal",
    fieldLabel: "Invoice Total",
    value: 575000,
    rawValue: "R 575,000.00",
    sourcePage: 1,
    opticalConfidence: 88,
    multiSourceReadings: [
      {
        source: "NATIVE_PDF_TEXT",
        value: 575000,
        rawValue: "R 575,000.00",
        confidence: 99,
      },
      {
        source: "TABLE_EXTRACTION",
        value: 575000,
        rawValue: "575000.00",
        confidence: 95,
      },
      {
        source: "DOCUMENT_CONTEXT",
        value: 575000,
        rawValue: "Total Due: R 575,000.00",
        confidence: 90,
      },
    ],
  };

  const multiAgreedResult = MultiEvidenceReconciler.reconcileSources("DOC-MULTI-01", [agreeingMultiSourceField]);
  assert(multiAgreedResult.isFullyAgreed === true, "Multi-Source: All 4 evidence streams agree on invoice total");
  assert(multiAgreedResult.hasConflicts === false, "Multi-Source: Zero conflicts detected");
  assert(multiAgreedResult.comparisons.length === 1, "Multi-Source: 1 field comparison generated");

  const totalComparison = multiAgreedResult.comparisons[0];
  assert(totalComparison.status === "AGREED", "Multi-Source: Comparison status is AGREED");
  assert(totalComparison.agreementCount === 4, "Multi-Source: Exactly 4 participating streams agree");
  assert(totalComparison.hasAgreementBoost === true, "Multi-Source: Agreement boost is activated");
  assert(totalComparison.confidenceAdjustment > 0, "Multi-Source: Positive confidence adjustment applied (+15%)");

  // 19.2: Multi-Source Conflict Enforcement (Zero Arbitrary Selection)
  const conflictingMultiSourceField: CandidateFieldValidationInput = {
    fieldKey: "totalDue",
    fieldLabel: "Total Due",
    value: 12845.00, // OCR optical read
    rawValue: "R 12 845.00",
    sourcePage: 1,
    opticalConfidence: 82,
    multiSourceReadings: [
      {
        source: "NATIVE_PDF_TEXT",
        value: 12345.00, // Native PDF stream read (conflicts with OCR!)
        rawValue: "R 12,345.00",
        confidence: 99,
      },
      {
        source: "TABLE_EXTRACTION",
        value: 12345.00, // Table extractor read
        rawValue: "12345.00",
        confidence: 95,
      },
    ],
  };

  const multiConflictResult = MultiEvidenceReconciler.reconcileSources("DOC-MULTI-02", [conflictingMultiSourceField]);
  assert(multiConflictResult.isFullyAgreed === false, "Multi-Source: Disagreement detected between OCR and Native PDF");
  assert(multiConflictResult.hasConflicts === true, "Multi-Source: hasConflicts is true");
  assert(multiConflictResult.conflictedFieldsCount === 1, "Multi-Source: Exactly 1 conflicting field found");

  const conflictComp = multiConflictResult.conflictList[0];
  assert(conflictComp.status === "CONFLICT", "Multi-Source: Field comparison status is CONFLICT");
  assert(conflictComp.arbitrarySelectionPrevented === true, "Multi-Source: Strict rule enforced — system refuses arbitrary value selection");
  assert(conflictComp.conflictingCandidates !== undefined && conflictComp.conflictingCandidates.length === 3, "Multi-Source: Preserves all 3 competing candidates");
  assert(conflictComp.confidenceAdjustment < 0, "Multi-Source: Negative confidence adjustment applied (-30%)");

  // 19.3: Full Pipeline Integration with Multi-Source Conflict
  const pipelineConflictInput = [
    {
      fieldKey: "accountNumber",
      fieldLabel: "Account Number",
      value: "0123456789",
      rawValue: "0123456789",
      sourcePage: 1,
      boundingBox: [0.1, 0.6, 0.15, 0.8] as [number, number, number, number],
      opticalConfidence: 95,
      sourceText: "0123456789",
    },
    conflictingMultiSourceField,
  ];

  const pipelineConflictResult = await ValidationPipeline.executePipeline({
    documentId: "DOC-MULTI-PIPE",
    candidateFields: pipelineConflictInput,
  });

  assert(pipelineConflictResult.multiSourceReconciliation !== undefined, "Pipeline: multiSourceReconciliation is populated in result");
  assert(pipelineConflictResult.multiSourceReconciliation.hasConflicts === true, "Pipeline: Detects multi-source conflict in execution");
  assert(pipelineConflictResult.validatedFields["totalDue"].status === "CONFLICT", "Pipeline: Validated field 'totalDue' state is CONFLICT");
  assert(pipelineConflictResult.status === "REVIEW_REQUIRED", "Pipeline: Status is demoted to REVIEW_REQUIRED due to evidence conflict");
  assert(pipelineConflictResult.reconciliationHandoffReady === false, "Pipeline: Reconciliation handoff is BLOCKED");

  const conflictException = pipelineConflictResult.exceptions.find((e) => e.category === "MULTI_SOURCE_CONFLICT");
  assert(conflictException !== undefined, "Pipeline: Generates MULTI_SOURCE_CONFLICT exception");
  assert(conflictException?.severity === "CRITICAL", "Pipeline: MULTI_SOURCE_CONFLICT exception severity is CRITICAL");

  // ==================================================================
  // TEST GROUP 20: DUPLICATE FIELD DETECTION (REQUIREMENT 20)
  // ==================================================================
  console.log("\n[Test Group 20] Duplicate Field Detection — Multi-Page Agreement vs Conflict & Zero Arbitrary Selection");

  // 20.1: Cross-Page Duplicate Agreement (e.g. Page 1: R 125,430.20, Page 5: R 125,430.20)
  const duplicateAgreedField: CandidateFieldValidationInput = {
    fieldKey: "invoiceTotal",
    fieldLabel: "Invoice Total",
    value: 125430.20,
    rawValue: "R 125,430.20",
    sourcePage: 1,
    opticalConfidence: 94,
    duplicateOccurrences: [
      {
        occurrenceId: "inv-tot-p1",
        fieldKey: "invoiceTotal",
        pageNumber: 1,
        locationLabel: "Page 1 - Summary Box",
        value: 125430.20,
        rawValue: "R 125,430.20",
        opticalConfidence: 95,
      },
      {
        occurrenceId: "inv-tot-p5",
        fieldKey: "invoiceTotal",
        pageNumber: 5,
        locationLabel: "Page 5 - Remittance Advice",
        value: 125430.20,
        rawValue: "R 125,430.20",
        opticalConfidence: 93,
      },
    ],
  };

  const dupAgreedResult = DuplicateFieldDetector.detectDuplicates("DOC-DUP-01", [duplicateAgreedField]);
  assert(dupAgreedResult.hasDuplicates === true, "Duplicate Detector: Detects multi-page duplicate occurrences");
  assert(dupAgreedResult.hasConflicts === false, "Duplicate Detector: Zero conflicts when occurrences agree");
  assert(dupAgreedResult.agreedDuplicatesCount === 1, "Duplicate Detector: Exactly 1 agreed duplicate field");

  const dupAgreedComp = dupAgreedResult.comparisons[0];
  assert(dupAgreedComp.status === "AGREED", "Duplicate Detector: Comparison status is AGREED");
  assert(dupAgreedComp.occurrencesCount === 3, "Duplicate Detector: 3 matching occurrences recorded across pages");
  assert(dupAgreedComp.evidenceStrengthBonus > 0, "Duplicate Detector: Evidence strength bonus activated (+15%)");
  assert(dupAgreedComp.isAgreed === true, "Duplicate Detector: isAgreed is true");

  // 20.2: Cross-Page Duplicate Disagreement / Conflict (e.g. Page 1: R 125,430.20 vs Page 5: R 120,000.00)
  const duplicateConflictField: CandidateFieldValidationInput = {
    fieldKey: "invoiceTotal",
    fieldLabel: "Invoice Total",
    value: 125430.20,
    rawValue: "R 125,430.20",
    sourcePage: 1,
    opticalConfidence: 94,
    duplicateOccurrences: [
      {
        occurrenceId: "inv-tot-p1",
        fieldKey: "invoiceTotal",
        pageNumber: 1,
        locationLabel: "Page 1 - Summary Box",
        value: 125430.20,
        rawValue: "R 125,430.20",
        opticalConfidence: 95,
      },
      {
        occurrenceId: "inv-tot-p5",
        fieldKey: "invoiceTotal",
        pageNumber: 5,
        locationLabel: "Page 5 - Remittance Advice",
        value: 120000.00, // Disagrees with Page 1!
        rawValue: "R 120,000.00",
        opticalConfidence: 93,
      },
    ],
  };

  const dupConflictResult = DuplicateFieldDetector.detectDuplicates("DOC-DUP-02", [duplicateConflictField]);
  assert(dupConflictResult.hasConflicts === true, "Duplicate Detector: Detects cross-page discrepancy between Page 1 and Page 5");
  assert(dupConflictResult.conflictedDuplicatesCount === 1, "Duplicate Detector: Exactly 1 conflicting duplicate field");

  const dupConflictComp = dupConflictResult.conflictList[0];
  assert(dupConflictComp.status === "CONFLICT", "Duplicate Detector: Status is explicitly CONFLICT");
  assert(dupConflictComp.arbitrarySelectionPrevented === true, "Duplicate Detector: Strict rule enforced — system refuses arbitrary page selection");
  assert(dupConflictComp.distinctValuesCount === 2, "Duplicate Detector: Identifies 2 conflicting distinct values");

  // 20.3: Pipeline Execution with Duplicate Conflict
  const pipelineDupResult = await ValidationPipeline.executePipeline({
    documentId: "DOC-DUP-PIPE",
    candidateFields: [duplicateConflictField],
  });
  assert(pipelineDupResult.duplicateFieldDetection !== undefined, "Pipeline: duplicateFieldDetection is populated in result");
  assert(pipelineDupResult.duplicateFieldDetection.hasConflicts === true, "Pipeline: Flags cross-page duplicate conflict in pipeline");
  assert(pipelineDupResult.validatedFields["invoiceTotal"].status === "CONFLICT", "Pipeline: Validated field 'invoiceTotal' status is CONFLICT");
  assert(pipelineDupResult.status === "REVIEW_REQUIRED", "Pipeline: Status is demoted to REVIEW_REQUIRED due to duplicate conflict");

  const dupException = pipelineDupResult.exceptions.find((e) => e.category === "DUPLICATE_FIELD_CONFLICT");
  assert(dupException !== undefined, "Pipeline: Generates DUPLICATE_FIELD_CONFLICT exception");
  assert(dupException?.severity === "CRITICAL", "Pipeline: DUPLICATE_FIELD_CONFLICT severity is CRITICAL");

  // ==================================================================
  // TEST GROUP 21: MISSING DATA INTEGRITY & ANTI-DEFAULT GUARD (REQUIREMENT 21)
  // ==================================================================
  console.log("\n[Test Group 21] Missing Data Integrity — Missing Must Remain Missing & Rejection of Industry Defaults");

  // 21.1: Legitimate Missing Field Remains Missing (Power Factor: NOT FOUND -> null)
  const legitimateMissingInputs: CandidateFieldValidationInput[] = [
    {
      fieldKey: "powerFactor",
      fieldLabel: "Power Factor",
      value: null,
      rawValue: "NOT FOUND",
      sourcePage: 1,
      opticalConfidence: 0,
    },
    {
      fieldKey: "reactiveEnergyKvarh",
      fieldLabel: "Reactive Energy",
      value: null,
      rawValue: "",
      sourcePage: 1,
      opticalConfidence: 0,
    },
  ];

  const evidenceCheckMissing = EvidenceCheckEngine.verifyGrounding(legitimateMissingInputs);
  const { guardedFields: legitGuarded, auditResult: legitAudit } =
    MissingDataGuard.auditAndGuardMissingData("DOC-MISSING-01", legitimateMissingInputs, evidenceCheckMissing.results);

  assert(legitAudit.isIntegrityPreserved === true, "Missing Guard: Preserves missing data integrity");
  assert(legitAudit.totalMissingCount === 2, "Missing Guard: Identifies exactly 2 missing fields");
  assert(legitAudit.syntheticDefaultsPreventedCount === 0, "Missing Guard: Zero synthetic defaults in clean missing fields");
  assert(legitGuarded[0].value === null, "Missing Guard: Power Factor remains strictly null (NOT FOUND)");
  assert(legitGuarded[1].value === null, "Missing Guard: Reactive Energy remains strictly null");

  // 21.2: Synthetic Default Rejection (AI / Heuristic attempts to inject Power Factor: 0.96 without grounding)
  const syntheticInjectedInputs: CandidateFieldValidationInput[] = [
    {
      fieldKey: "powerFactor",
      fieldLabel: "Power Factor",
      value: 0.96, // Assumed standard industry default (0.96)!
      rawValue: "0.96",
      sourcePage: 1,
      opticalConfidence: 0, // Ungrounded, no tokens!
    },
    {
      fieldKey: "meterMultiplier",
      fieldLabel: "Meter Multiplier",
      value: 100, // Assumed multiplier (100) without token grounding!
      rawValue: "100",
      sourcePage: 1,
      opticalConfidence: 0,
    },
    {
      fieldKey: "accountNumber",
      fieldLabel: "Account Number",
      value: "0123456789",
      rawValue: "0123456789",
      sourcePage: 1,
      boundingBox: [0.1, 0.6, 0.15, 0.8],
      opticalConfidence: 95,
      sourceText: "0123456789",
      wordTokens: [{ text: "0123456789", confidence: 95, boundingBox: [0.1, 0.6, 0.15, 0.8] }],
    },
  ];

  const evidenceCheckSynth = EvidenceCheckEngine.verifyGrounding(syntheticInjectedInputs);
  const { guardedFields: synthGuarded, auditResult: synthAudit } =
    MissingDataGuard.auditAndGuardMissingData("DOC-SYNTH-01", syntheticInjectedInputs, evidenceCheckSynth.results);

  assert(synthAudit.syntheticDefaultsPreventedCount === 2, "Missing Guard: Successfully intercepts 2 ungrounded synthetic defaults");
  assert(synthGuarded[0].value === null, "Missing Guard: Power Factor 0.96 is REVERTED to null (NOT FOUND)");
  assert(synthGuarded[0].rawValue === "NOT FOUND", "Missing Guard: Power Factor rawValue set to NOT FOUND");
  assert(synthGuarded[1].value === null, "Missing Guard: Multiplier 100 is REVERTED to null (NOT FOUND)");
  assert(synthGuarded[2].value === "0123456789", "Missing Guard: Grounded Account Number remains intact");

  // 21.3: Pipeline Execution Intercepts Synthetic Default and Generates Exceptions
  const pipelineSynthResult = await ValidationPipeline.executePipeline({
    documentId: "DOC-SYNTH-PIPE",
    candidateFields: syntheticInjectedInputs,
  });

  assert(pipelineSynthResult.missingDataAudit !== undefined, "Pipeline: missingDataAudit is populated in result");
  assert(pipelineSynthResult.missingDataAudit.syntheticDefaultsPreventedCount === 2, "Pipeline: Intercepts 2 synthetic defaults in pipeline execution");
  assert(pipelineSynthResult.validatedFields["powerFactor"].value === null, "Pipeline: Validated Power Factor field is strictly null");
  assert(pipelineSynthResult.validatedFields["powerFactor"].status === "MISSING", "Pipeline: Validated Power Factor state is MISSING");
  assert(pipelineSynthResult.validatedFields["powerFactor"].validationScore.score === 0, "Pipeline: Missing Power Factor score is strictly 0%");

  const synthException = pipelineSynthResult.exceptions.find((e) => e.category === "SYNTHETIC_DEFAULT_REJECTED");
  assert(synthException !== undefined, "Pipeline: Generates SYNTHETIC_DEFAULT_REJECTED exception");
  assert(synthException?.severity === "HIGH", "Pipeline: SYNTHETIC_DEFAULT_REJECTED exception severity is HIGH");

  // --- TEST GROUP 24: AI FAILURE HANDLING & CORRUPTION-PROOF RESILIENCE (REQ 24) ---
  console.log("\n[Test Group 24] AI Failure Handling — Classifies All 7 Error Modes, Retains Evidence & Non-Destructive Fallback");

  // 24.1: Error Classification for all 7 standard failure reasons
  const timeoutErr = AiFailureHandler.classifyError(new Error("Request timed out after 15000ms deadline exceeded"));
  assert(timeoutErr.reason === "TIMEOUT", "AI Failure: Correctly classifies TIMEOUT error");
  assert(timeoutErr.isRetryable === true, "AI Failure: TIMEOUT error is flagged as retryable");

  const rateLimitErr = AiFailureHandler.classifyError("429 Too Many Requests: Rate limit exceeded for organization");
  assert(rateLimitErr.reason === "RATE_LIMIT", "AI Failure: Correctly classifies RATE_LIMIT error");
  assert(rateLimitErr.isRetryable === true, "AI Failure: RATE_LIMIT error is flagged as retryable");

  const providerErr = AiFailureHandler.classifyError(new Error("500 Internal Server Error: upstream provider error"));
  assert(providerErr.reason === "PROVIDER_ERROR", "AI Failure: Correctly classifies PROVIDER_ERROR");

  const invalidJsonErr = AiFailureHandler.classifyError(new SyntaxError("Unexpected token < in JSON at position 0"));
  assert(invalidJsonErr.reason === "INVALID_RESPONSE", "AI Failure: Correctly classifies INVALID_RESPONSE (malformed JSON)");

  const schemaErr = AiFailureHandler.classifyError(new Error("Zod validation error: missing required property 'fieldKey'"));
  assert(schemaErr.reason === "SCHEMA_ERROR", "AI Failure: Correctly classifies SCHEMA_ERROR");

  const tokenLimitErr = AiFailureHandler.classifyError(new Error("Model context exceeded maximum token limit (finish_reason length)"));
  assert(tokenLimitErr.reason === "TOKEN_LIMIT", "AI Failure: Correctly classifies TOKEN_LIMIT error");

  const networkErr = AiFailureHandler.classifyError(new Error("503 Service Unavailable: connect ECONNREFUSED 127.0.0.1:443 - offline"));
  assert(networkErr.reason === "UNAVAILABLE", "AI Failure: Correctly classifies UNAVAILABLE error");

  // 24.2: Evidence Preservation Verification
  const originalCandidateInputs: CandidateFieldValidationInput[] = [
    {
      fieldKey: "invoiceTotal",
      fieldLabel: "Invoice Total",
      value: 125430.2,
      rawValue: "R125,430.20",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Total: R125,430.20",
      wordTokens: [{ text: "R125,430.20", confidence: 98, boundingBox: [0.8, 0.6, 0.85, 0.8] }],
    },
    {
      fieldKey: "accountNumber",
      fieldLabel: "Account Number",
      value: "0123456789",
      rawValue: "0123456789",
      sourcePage: 1,
      opticalConfidence: 95,
      sourceText: "Account: 0123456789",
      wordTokens: [{ text: "0123456789", confidence: 95, boundingBox: [0.1, 0.6, 0.15, 0.8] }],
    },
  ];

  const failureRecord = AiFailureHandler.createAiFailureRecord({
    documentId: "DOC-FAIL-01",
    error: new Error("ETIMEDOUT: AI service connection timed out"),
    candidateFields: originalCandidateInputs,
    fullDocumentText: "Invoice sample document",
  });

  assert(failureRecord.reason === "TIMEOUT", "Failure Record: reason is TIMEOUT");
  assert(failureRecord.evidencePreserved === true, "Failure Record: evidencePreserved is true");
  assert(failureRecord.ocrEvidenceSummary.totalTokensPreserved === 2, "Failure Record: All word tokens preserved intact");
  assert(failureRecord.ocrEvidenceSummary.totalCandidateFieldsPreserved === 2, "Failure Record: Candidate fields count preserved");

  const fallbackSemantic = AiFailureHandler.createSafeFallbackSemanticResult({
    documentId: "DOC-FAIL-01",
    candidateFields: originalCandidateInputs,
    failureRecord,
  });

  assert(fallbackSemantic.overallSemanticConsistency === "AMBIGUOUS", "Fallback Semantic: Sets consistency to AMBIGUOUS");
  assert(fallbackSemantic.findings.length === 2, "Fallback Semantic: Preserves all candidate field findings");
  assert(fallbackSemantic.aiFailure !== undefined, "Fallback Semantic: Attaches structured aiFailure record");

  // 24.3: Pipeline Graceful Fallback Execution (AI failure does not crash pipeline or corrupt document)
  const pipelineFailResult = await ValidationPipeline.executePipeline(
    {
      documentId: "DOC-FAIL-PIPE",
      candidateFields: originalCandidateInputs,
    },
    {
      aiSemanticExecutor: async () => {
        throw new Error("429 Too Many Requests: Rate limit exceeded");
      },
    },
  );

  assert(pipelineFailResult.aiFailure !== undefined, "Pipeline: aiFailure record populated on AI error");
  assert(pipelineFailResult.aiFailure?.reason === "RATE_LIMIT", "Pipeline: AI failure reason is RATE_LIMIT");
  assert(pipelineFailResult.status === "REVIEW_REQUIRED", "Pipeline: Document status transitions to REVIEW_REQUIRED");
  assert(pipelineFailResult.reconciliationHandoffReady === false, "Pipeline: Reconciliation handoff blocked on AI failure");
  assert(pipelineFailResult.validatedFields["invoiceTotal"].value === 125430.2, "Pipeline: OCR invoice total value is NOT corrupted or modified");
  assert(pipelineFailResult.validatedFields["accountNumber"].value === "0123456789", "Pipeline: OCR account number is NOT corrupted or modified");

  const aiFailException = pipelineFailResult.exceptions.find((e) => e.category === "AI_FAILURE");
  assert(aiFailException !== undefined, "Pipeline: Generates AI_FAILURE exception");
  assert(aiFailException?.severity === "HIGH", "Pipeline: AI_FAILURE severity is HIGH");
  assert(aiFailException?.suggestedAction.includes("Retry AI validation"), "Pipeline: Suggests retry with backoff");

  // --- TEST GROUP 25: IDEMPOTENCY & VERSION LINEAGE (REQ 25) ---
  console.log("\n[Test Group 25] Idempotency — Composite Key Management, Exact Replay & Clean Version Superseding");

  IdempotencyManager.clearRegistry();

  // 25.1: Composite Idempotency Key Generation
  const key1 = IdempotencyManager.generateIdempotencyKey("DOC-100", "run-abc", 1);
  assert(key1 === "val_DOC-100_run-abc_v1", "Idempotency: Generates correct composite key format");

  const keyDefault = IdempotencyManager.generateIdempotencyKey("DOC-100");
  assert(keyDefault === "val_DOC-100_default-run_v1", "Idempotency: Applies default run and version 1");

  // 25.2: First Execution Creates Fresh Record
  const docInput = {
    documentId: "DOC-IDEM-01",
    processingRunId: "run-001",
    validationVersion: 1,
    candidateFields: originalCandidateInputs,
  };

  const firstRunResult = await ValidationPipeline.executePipeline(docInput, {
    processingRunId: "run-001",
    validationVersion: 1,
  });

  assert(firstRunResult.isIdempotentReplay === false, "Idempotency: First execution is NOT a replay");
  assert(firstRunResult.idempotencyKey === "val_DOC-IDEM-01_run-001_v1", "Idempotency: Attached correct idempotencyKey");

  // 25.3: Exact Match Retry Replays Cached Record (Zero Duplicates Created)
  const retryRunResult = await ValidationPipeline.executePipeline(docInput, {
    processingRunId: "run-001",
    validationVersion: 1,
  });

  assert(retryRunResult.isIdempotentReplay === true, "Idempotency: Exact retry is marked as isIdempotentReplay: true");
  assert(retryRunResult.validationRunId === firstRunResult.validationRunId, "Idempotency: Reuses exact original validationRunId without creating duplicate");

  const recordsForDoc = IdempotencyManager.listRecordsForDocument("DOC-IDEM-01");
  assert(recordsForDoc.length === 1, "Idempotency Store: Exactly 1 record exists for (documentId, runId, v1)");

  // 25.4: Incremented Version (v2) Supersedes v1 with Lineage Pointer
  const v2RunResult = await ValidationPipeline.executePipeline(docInput, {
    processingRunId: "run-001",
    validationVersion: 2,
  });

  assert(v2RunResult.isIdempotentReplay === false, "Idempotency: Version 2 is a fresh execution");
  assert(v2RunResult.validationVersion === 2, "Idempotency: v2 validationVersion is 2");

  const allRecords = IdempotencyManager.listRecordsForDocument("DOC-IDEM-01");
  assert(allRecords.length === 2, "Idempotency Store: 2 records exist (v1 and v2)");

  const v1Record = IdempotencyManager.getRecord("val_DOC-IDEM-01_run-001_v1");
  const v2Record = IdempotencyManager.getRecord("val_DOC-IDEM-01_run-001_v2");

  assert(v1Record?.isCurrent === false, "Idempotency Lineage: v1 is marked as isCurrent: false");
  assert(v1Record?.supersededBy === v2RunResult.validationRunId, "Idempotency Lineage: v1 supersededBy points to v2 run ID");
  assert(v2Record?.isCurrent === true, "Idempotency Lineage: v2 is marked as isCurrent: true");
  assert(v2Record?.previousRunId === firstRunResult.validationRunId, "Idempotency Lineage: v2 previousRunId points to v1 run ID");

  // 25.5: Concurrent In-Flight Deduplication
  let executionCount = 0;
  const concurrentDocInput = {
    documentId: "DOC-CONCURRENT-01",
    processingRunId: "run-concurrent",
    validationVersion: 1,
    candidateFields: originalCandidateInputs,
  };

  const [resA, resB] = await Promise.all([
    ValidationPipeline.executePipeline(concurrentDocInput, {
      processingRunId: "run-concurrent",
      validationVersion: 1,
      aiSemanticExecutor: async (docId, cFields) => {
        executionCount++;
        await new Promise((r) => setTimeout(r, 50));
        return AiSemanticValidator.validateSemantics(docId, cFields);
      },
    }),
    ValidationPipeline.executePipeline(concurrentDocInput, {
      processingRunId: "run-concurrent",
      validationVersion: 1,
      aiSemanticExecutor: async (docId, cFields) => {
        executionCount++;
        await new Promise((r) => setTimeout(r, 50));
        return AiSemanticValidator.validateSemantics(docId, cFields);
      },
    }),
  ]);

  assert(executionCount === 1, "Concurrency: In-flight deduplication ensured AI was only executed once");
  assert(resA.validationRunId === resB.validationRunId, "Concurrency: Both callers received identical validationRunId");

  // --- TEST GROUP 26: PERSISTENT VALIDATION RUNS (REQ 26) ---
  console.log("\n[Test Group 26] Validation Runs — Stores Complete Run Snapshot & Never Overwrites Historical Runs");

  ValidationRunStore.clearStore();

  const startTime1 = new Date(Date.now() - 5000).toISOString();
  const endTime1 = new Date().toISOString();

  // 26.1: Persist initial validation run
  const persistentRun1 = ValidationRunStore.persistRun({
    result: firstRunResult,
    ocrRunId: "ocr-run-alpha",
    modelProvider: "google-gemini-pro",
    promptVersion: "v2.4.0-prompt-contract",
    startTime: startTime1,
    endTime: endTime1,
  });

  assert(persistentRun1.validationRunId === firstRunResult.validationRunId, "Validation Runs: Correct validationRunId stored");
  assert(persistentRun1.documentId === "DOC-IDEM-01", "Validation Runs: Correct documentId stored");
  assert(persistentRun1.ocrRunId === "ocr-run-alpha", "Validation Runs: Correct ocrRunId stored");
  assert(persistentRun1.modelProvider === "google-gemini-pro", "Validation Runs: Correct modelProvider stored");
  assert(persistentRun1.promptVersion === "v2.4.0-prompt-contract", "Validation Runs: Correct promptVersion stored");
  assert(persistentRun1.validationVersion === 1, "Validation Runs: Correct validationVersion stored");
  assert(persistentRun1.startTime === startTime1, "Validation Runs: Correct startTime stored");
  assert(persistentRun1.endTime === endTime1, "Validation Runs: Correct endTime stored");
  assert(persistentRun1.durationMs >= 0, "Validation Runs: durationMs is non-negative");
  assert(persistentRun1.status === firstRunResult.status, "Validation Runs: Correct status stored");
  assert(persistentRun1.findings.totalFindings > 0, "Validation Runs: Aggregated findings stored");
  assert(persistentRun1.confidence.overallScore > 0, "Validation Runs: Confidence breakdown stored");
  assert(Array.isArray(persistentRun1.errors), "Validation Runs: Error exceptions stored");

  // 26.2: Persist second historical run for the same document (Must NOT overwrite historical run 1)
  const startTime2 = new Date(Date.now() - 2000).toISOString();
  const endTime2 = new Date().toISOString();

  const persistentRun2 = ValidationRunStore.persistRun({
    result: v2RunResult,
    ocrRunId: "ocr-run-alpha",
    modelProvider: "google-gemini-pro",
    promptVersion: "v2.4.0-prompt-contract",
    startTime: startTime2,
    endTime: endTime2,
  });

  assert(persistentRun2.validationRunId === v2RunResult.validationRunId, "Validation Runs: Second run has distinct validationRunId");
  assert(persistentRun2.validationVersion === 2, "Validation Runs: Second run has version 2");

  // Verify historical runs immutability
  const docHistory = ValidationRunStore.listRunsForDocument("DOC-IDEM-01");
  assert(docHistory.length === 2, "Validation Runs: Exactly 2 historical runs preserved without overwrite");
  assert(docHistory[0].validationRunId === firstRunResult.validationRunId, "Validation Runs: Run 1 preserved in history");
  assert(docHistory[1].validationRunId === v2RunResult.validationRunId, "Validation Runs: Run 2 appended to history");

  // 26.3: Query by OCR run ID and summary
  const ocrRuns = ValidationRunStore.listRunsForOcrRun("ocr-run-alpha");
  assert(ocrRuns.length === 2, "Validation Runs: Query by ocrRunId returns both runs");

  const summary = ValidationRunStore.getHistoricalRunsSummary("DOC-IDEM-01");
  assert(summary.totalRuns === 2, "Validation Runs: Historical summary totalRuns is 2");
  assert(summary.versions.includes(1) && summary.versions.includes(2), "Validation Runs: Historical summary versions track [1, 2]");

  // --- TEST GROUP 27: ENERA 7-STAGE AUDIT CHAIN (REQ 27) ---
  console.log("\n[Test Group 27] Enera Audit Trail — Complete 7-Stage Verifiable Field Lineage Chain");

  // 27.1: Build full document audit trail
  const docAuditTrail = EneraAuditChainEngine.buildDocumentAuditTrail({
    result: firstRunResult,
    candidateFields: originalCandidateInputs,
    documentMetadata: {
      filename: "Eskom_Invoice_Sep2025.pdf",
      documentHash: "sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      receivedAt: "2025-09-30T10:00:00Z",
    },
  });

  assert(docAuditTrail.totalFieldsTracked === 2, "Audit Trail: Tracks all 2 candidate fields");
  assert(docAuditTrail.auditChainIntegrity === "INTACT", "Audit Trail: Overall chain integrity is INTACT");

  // 27.2: Verify the 7 distinct links for 'invoiceTotal'
  const totalChain = docAuditTrail.fieldChains["invoiceTotal"];
  assert(totalChain !== undefined, "Audit Chain: Chain generated for 'invoiceTotal'");

  // Link 1: DOCUMENT
  assert(totalChain.chain.document.documentId === "DOC-IDEM-01", "Audit Link 1 (DOCUMENT): Correct documentId");
  assert(totalChain.chain.document.filename === "Eskom_Invoice_Sep2025.pdf", "Audit Link 1 (DOCUMENT): Correct filename");
  assert(totalChain.chain.document.documentHash?.startsWith("sha256_") === true, "Audit Link 1 (DOCUMENT): Document hash present");

  // Link 2: OCR RUN
  assert(totalChain.chain.ocrRun.sourcePage === 1, "Audit Link 2 (OCR RUN): Source page is 1");
  assert(totalChain.chain.ocrRun.opticalConfidence === 98, "Audit Link 2 (OCR RUN): Optical confidence is 98%");
  assert(totalChain.chain.ocrRun.rawTokensCount === 1, "Audit Link 2 (OCR RUN): Raw tokens count is 1");

  // Link 3: EXTRACTED VALUE
  assert(totalChain.chain.extractedValue.rawValue === "R125,430.20", "Audit Link 3 (EXTRACTED VALUE): Raw value preserved");
  assert(totalChain.chain.extractedValue.extractedValue === 125430.2, "Audit Link 3 (EXTRACTED VALUE): Extracted value is 125430.2");

  // Link 4: AI VALIDATION
  assert(totalChain.chain.aiValidation.modelProvider === "google-gemini-pro", "Audit Link 4 (AI VALIDATION): Model provider recorded");
  assert(totalChain.chain.aiValidation.validationScore > 0, "Audit Link 4 (AI VALIDATION): Validation score recorded");

  // Link 5: DETERMINISTIC VALIDATION
  assert(typeof totalChain.chain.deterministicValidation.isPassed === "boolean", "Audit Link 5 (DETERMINISTIC VALIDATION): isPassed boolean evaluated");

  // Link 6: USER REVIEW
  assert(totalChain.chain.userReview.reviewStatus !== undefined, "Audit Link 6 (USER REVIEW): reviewStatus is recorded");

  // Link 7: APPROVED VALUE
  assert(totalChain.chain.approvedValue.finalValue === 125430.2, "Audit Link 7 (APPROVED VALUE): Final approved value is 125430.2");
  assert(totalChain.chain.approvedValue.authoritativeSource !== undefined, "Audit Link 7 (APPROVED VALUE): Authoritative source is recorded");

  // 27.3: Cryptographic Chain Verification Hash Integrity
  assert(typeof totalChain.chainVerificationHash === "string" && totalChain.chainVerificationHash.startsWith("chain_"), "Audit Hash: Chain verification hash generated");
  assert(EneraAuditChainEngine.verifyChainIntegrity(totalChain) === true, "Audit Hash: Chain integrity verification succeeds");

  // 27.4: User Review Override Provenance & Tamper-Evident Lineage
  const overriddenChain = EneraAuditChainEngine.applyUserOverride(totalChain, {
    overriddenValue: 125430.0,
    reviewedBy: "senior.auditor@enera.co.za",
    reviewNotes: "Reconciled with bank remittance rounding of 20 cents.",
  });

  assert(overriddenChain.chain.userReview.reviewStatus === "HUMAN_OVERRIDDEN", "Audit Override: Status updated to HUMAN_OVERRIDDEN");
  assert(overriddenChain.chain.userReview.reviewedBy === "senior.auditor@enera.co.za", "Audit Override: Reviewed by recorded");
  assert(overriddenChain.chain.userReview.originalValueBeforeOverride === 125430.2, "Audit Override: Original extracted value preserved in audit trail");
  assert(overriddenChain.chain.approvedValue.finalValue === 125430.0, "Audit Override: Approved value updated to overridden value");
  assert(overriddenChain.chain.approvedValue.authoritativeSource === "OVERRIDE", "Audit Override: Authoritative source set to OVERRIDE");
  assert(overriddenChain.chainVerificationHash !== totalChain.chainVerificationHash, "Audit Hash: Verification hash reflects override mutation");
  assert(EneraAuditChainEngine.verifyChainIntegrity(overriddenChain) === true, "Audit Hash: New override chain integrity is valid");

  assert(overriddenChain.chainVerificationHash !== totalChain.chainVerificationHash, "Audit Hash: Verification hash reflects override mutation");
  assert(EneraAuditChainEngine.verifyChainIntegrity(overriddenChain) === true, "Audit Hash: New override chain integrity is valid");

  // --- TEST GROUP 28: HUMAN REVIEW WORKSPACE & DUAL-PANE VIEW (REQ 28) ---
  console.log("\n[Test Group 28] Human Review Workspace — Dual-Pane Layout, Findings Badges (✓/⚠/✗) & Evidence Inspection");

  HumanReviewWorkflowEngine.clearStore();

  const humanReviewCandidateInputs: CandidateFieldValidationInput[] = [
    {
      fieldKey: "accountNumber",
      fieldLabel: "Account Number",
      value: "0123456789",
      rawValue: "0123456789",
      sourcePage: 1,
      opticalConfidence: 98,
      sourceText: "Account No: 0123456789",
      boundingBox: [0.1, 0.6, 0.15, 0.8],
      wordTokens: [{ text: "0123456789", confidence: 98, boundingBox: [0.1, 0.6, 0.15, 0.8] }],
    },
    {
      fieldKey: "billingPeriod",
      fieldLabel: "Billing Period",
      value: "2025-09-01 to 2025-09-30",
      rawValue: "01/09/2025 - 30/09/2025",
      sourcePage: 1,
      opticalConfidence: 95,
      sourceText: "Billing Period: 01/09/2025 - 30/09/2025",
      boundingBox: [0.15, 0.6, 0.2, 0.8],
    },
    {
      fieldKey: "tariffName",
      fieldLabel: "Tariff",
      value: "MEGAFLEX",
      rawValue: "MEGAFLEX_NON_STANDARD",
      sourcePage: 1,
      opticalConfidence: 70, // Triggers warning ⚠
      sourceText: "Tariff: MEGAFLEX_NON_STANDARD",
      boundingBox: [0.2, 0.6, 0.25, 0.8],
    },
    {
      fieldKey: "totalKwh",
      fieldLabel: "Total kWh",
      value: 100000,
      rawValue: "100,000 kWh",
      sourcePage: 1,
      opticalConfidence: 99,
      sourceText: "Active Energy: 100,000 kWh",
      boundingBox: [0.3, 0.6, 0.35, 0.8],
    },
    {
      fieldKey: "vatAmount",
      fieldLabel: "VAT",
      value: 15000,
      rawValue: "R 15,000.00",
      sourcePage: 1,
      opticalConfidence: 75,
      sourceText: "VAT 15%: R 15,000.00",
      boundingBox: [0.75, 0.6, 0.8, 0.8],
    },
    {
      fieldKey: "invoiceTotal",
      fieldLabel: "Invoice Total",
      value: 115000,
      rawValue: "R 115,000.00",
      sourcePage: 1,
      opticalConfidence: 99,
      sourceText: "Total Amount Due: R 115,000.00",
      boundingBox: [0.85, 0.6, 0.9, 0.8],
    },
  ];

  const reviewPipelineResult = await ValidationPipeline.executePipeline({
    documentId: "DOC-REVIEW-01",
    candidateFields: humanReviewCandidateInputs,
  });

  // 28.1: Initialize Human Review Session
  const reviewSession = HumanReviewWorkflowEngine.createReviewSession({
    documentId: "DOC-REVIEW-01",
    validationResult: reviewPipelineResult,
    candidateFields: humanReviewCandidateInputs,
    reviewer: {
      id: "usr-auditor-99",
      name: "Sipho Khumalo",
      email: "sipho.khumalo@enera.co.za",
      role: "SENIOR_TARIFF_ANALYST",
    },
  });

  assert(reviewSession.sessionId.startsWith("rev-sess-"), "Review Session: Created with unique sessionId");
  assert(reviewSession.status === "IN_REVIEW", "Review Session: Status is IN_REVIEW");
  assert(reviewSession.reviewer.name === "Sipho Khumalo", "Review Session: Reviewer name recorded");

  // 28.2: Generate Dual-Pane Workspace ViewModel (Requirement 28 Layout)
  const workspaceView = HumanReviewWorkflowEngine.generateWorkspaceViewModel({
    session: reviewSession,
    validationResult: reviewPipelineResult,
    candidateFields: humanReviewCandidateInputs,
    activeFieldKey: "tariffName",
  });

  assert(workspaceView.leftPane !== undefined, "Workspace View: Left pane (Original Document) present");
  assert(workspaceView.leftPane.pageNumber === 1, "Workspace View: Left pane shows Page 1");
  assert(workspaceView.leftPane.activeHighlightBoundingBox !== undefined, "Workspace View: Left pane highlights active field bounding box");
  assert(workspaceView.rightPane !== undefined, "Workspace View: Right pane (Validation Findings) present");
  assert(workspaceView.rightPane.fields.length === 6, "Workspace View: Right pane displays all 6 candidate fields");

  // Verify finding badges
  const accFieldView = workspaceView.rightPane.fields.find((f) => f.fieldKey === "accountNumber");
  assert(accFieldView?.badge === "VALID_CHECK", "Workspace Badges: Account Number displays ✓ (VALID_CHECK)");

  const totalKwhView = workspaceView.rightPane.fields.find((f) => f.fieldKey === "totalKwh");
  assert(totalKwhView?.badge === "VALID_CHECK", "Workspace Badges: Total kWh displays ✓ (VALID_CHECK)");

  const invoiceTotalView = workspaceView.rightPane.fields.find((f) => f.fieldKey === "invoiceTotal");
  assert(invoiceTotalView?.badge === "VALID_CHECK", "Workspace Badges: Invoice Total displays ✓ (VALID_CHECK)");

  // 28.3: Inspect Source Evidence
  const inspected = HumanReviewWorkflowEngine.inspectFieldEvidence(
    reviewSession,
    humanReviewCandidateInputs,
    "accountNumber",
  );

  assert(inspected.field.fieldKey === "accountNumber", "Evidence Inspection: Returns target candidate field");
  assert(inspected.evidenceTokens.length > 0, "Evidence Inspection: Returns spatial OCR word tokens");
  assert(inspected.sourceSnippet === "Account No: 0123456789", "Evidence Inspection: Returns verbatim source text snippet");
  assert(reviewSession.fieldReviews["accountNumber"].inspectedEvidence === true, "Evidence Inspection: Marks field as inspected");

  // 28.4: Confirm Field as verified
  HumanReviewWorkflowEngine.confirmField(reviewSession, "accountNumber");
  assert(reviewSession.fieldReviews["accountNumber"].status === "CONFIRMED", "Human Review: Field status transitions to CONFIRMED");

  // --- TEST GROUP 29: CORRECTIONS & DOWNSTREAM RECONCILIATION HANDOFF (REQ 29) ---
  console.log("\n[Test Group 29] Corrections — Non-Destructive Storage, Evidence Preservation & Authoritative Handoff");

  // 29.1: Apply Human Review Correction (Reviewer corrects non-standard tariff name to 'MINIFLEX')
  const { updatedSession, correctionRecord } = HumanReviewWorkflowEngine.applyFieldCorrection({
    session: reviewSession,
    candidateFields: humanReviewCandidateInputs,
    fieldKey: "tariffName",
    correctedValue: "MINIFLEX",
    correctedRawValue: "MINIFLEX",
    correctionReason: "Verified against meter configuration sheet: account is under Miniflex tariff schedule.",
    userNote: "Confirmed with Eskom customer rep ref #EK-88219",
  });

  // Verify Requirement 29 Invariant 1: Original evidence is NEVER overwritten
  const originalTariffCandidate = humanReviewCandidateInputs.find((f) => f.fieldKey === "tariffName");
  assert(originalTariffCandidate?.value === "MEGAFLEX", "Corrections: Original candidate value is NEVER overwritten");
  assert(originalTariffCandidate?.rawValue === "MEGAFLEX_NON_STANDARD", "Corrections: Original rawValue is preserved intact");

  // Verify Requirement 29 Invariant 2: Stored correction record properties
  assert(correctionRecord.originalValue === "MEGAFLEX", "Correction Record: Stores Original Value");
  assert(correctionRecord.correctedValue === "MINIFLEX", "Correction Record: Stores Corrected Value");
  assert(correctionRecord.correctionReason.includes("Miniflex tariff schedule"), "Correction Record: Stores Reason");
  assert(correctionRecord.reviewer.name === "Sipho Khumalo", "Correction Record: Stores Reviewer");
  assert(typeof correctionRecord.timestamp === "string", "Correction Record: Stores Timestamp");
  assert(correctionRecord.evidence.sourcePage === 1, "Correction Record: Stores Evidence sourcePage");
  assert(correctionRecord.evidence.boundingBox !== undefined, "Correction Record: Stores Evidence boundingBox");

  // Verify updated session review state
  assert(updatedSession.fieldReviews["tariffName"].status === "CORRECTED", "Review Session: Field status transitions to CORRECTED");
  assert(updatedSession.fieldReviews["tariffName"].activeValue === "MINIFLEX", "Review Session: Active value updated to corrected value");
  assert(updatedSession.corrections.length === 1, "Review Session: Corrections count is 1");

  // 29.2: Historical corrections list retrieval
  const docCorrectionsList = HumanReviewWorkflowEngine.listCorrectionsForDocument("DOC-REVIEW-01");
  assert(docCorrectionsList.length === 1, "Corrections Store: Successfully lists corrections for document");
  assert(docCorrectionsList[0].fieldKey === "tariffName", "Corrections Store: Corrected fieldKey is tariffName");

  // 29.3: Approve Document & Produce Downstream Reconciliation Payload
  const { updatedSession: finalSession, reconciliationPayload, auditSummary } =
    HumanReviewWorkflowEngine.approveDocument({
      session: updatedSession,
      candidateFields: humanReviewCandidateInputs,
      validationResult: reviewPipelineResult,
      approvalNotes: "All 6 fields verified and reconciled with supply contract.",
    });

  assert(finalSession.status === "APPROVED", "Document Approval: Session status is APPROVED");
  assert(finalSession.reconciliationPayloadReady === true, "Document Approval: reconciliationPayloadReady is true");

  // Verify downstream reconciliation payload has approved values
  assert(reconciliationPayload.approvedValues["tariffName"] === "MINIFLEX", "Downstream Payload: Approved tariffName is MINIFLEX");
  assert(reconciliationPayload.approvedValues["invoiceTotal"] === 115000, "Downstream Payload: Approved invoiceTotal is 115000");
  assert(reconciliationPayload.approvedBy === "Sipho Khumalo", "Downstream Payload: Approved by Sipho Khumalo");
  assert(reconciliationPayload.approvalMethod === "MANUAL_REVIEW", "Downstream Payload: Approval method is MANUAL_REVIEW");
  assert(reconciliationPayload.correctionsAppliedCount === 1, "Downstream Payload: Corrections applied count is 1");
  assert(reconciliationPayload.auditTrailVerificationHash.startsWith("audit_"), "Downstream Payload: Audit verification hash present");

  // Verify 7-stage audit chain summary reflects human override
  const auditTariffChain = auditSummary.fieldChains["tariffName"];
  assert(auditTariffChain.chain.userReview.reviewStatus === "HUMAN_OVERRIDDEN", "Audit Chain: Stage 6 reviewStatus is HUMAN_OVERRIDDEN");
  assert(auditTariffChain.chain.approvedValue.authoritativeSource === "OVERRIDE", "Audit Chain: Stage 7 authoritativeSource is OVERRIDE");
  assert(auditTariffChain.chain.extractedValue.extractedValue === "MEGAFLEX", "Audit Chain: Stage 3 original extracted value is preserved");

  // --- TEST GROUP 30: APPROVAL STATES (REQ 30) ---
  console.log("\n[Test Group 30] Approval States — 7 Formal Lifecycles & Strict Reconciliation Eligibility");

  // 30.1: Validate all 7 approval states
  assert(ApprovalStateManager.APPROVAL_STATES.length === 7, "Approval States: Exactly 7 formal states defined");
  assert(ApprovalStateManager.APPROVAL_STATES.includes("PENDING_VALIDATION"), "Approval States: Includes PENDING_VALIDATION");
  assert(ApprovalStateManager.APPROVAL_STATES.includes("VALIDATING"), "Approval States: Includes VALIDATING");
  assert(ApprovalStateManager.APPROVAL_STATES.includes("VALID"), "Approval States: Includes VALID");
  assert(ApprovalStateManager.APPROVAL_STATES.includes("PARTIALLY_VALID"), "Approval States: Includes PARTIALLY_VALID");
  assert(ApprovalStateManager.APPROVAL_STATES.includes("REVIEW_REQUIRED"), "Approval States: Includes REVIEW_REQUIRED");
  assert(ApprovalStateManager.APPROVAL_STATES.includes("APPROVED"), "Approval States: Includes APPROVED");
  assert(ApprovalStateManager.APPROVAL_STATES.includes("REJECTED"), "Approval States: Includes REJECTED");

  // 30.2: Reconciliation Eligibility Predicate
  assert(ApprovalStateManager.isEligibleForReconciliation("APPROVED") === true, "Eligibility: APPROVED is eligible for reconciliation");
  assert(ApprovalStateManager.isEligibleForReconciliation("VALID") === true, "Eligibility: VALID is eligible for reconciliation");
  assert(ApprovalStateManager.isEligibleForReconciliation("PENDING_VALIDATION") === false, "Eligibility: PENDING_VALIDATION is NOT eligible");
  assert(ApprovalStateManager.isEligibleForReconciliation("VALIDATING") === false, "Eligibility: VALIDATING is NOT eligible");
  assert(ApprovalStateManager.isEligibleForReconciliation("PARTIALLY_VALID") === false, "Eligibility: PARTIALLY_VALID is NOT eligible");
  assert(ApprovalStateManager.isEligibleForReconciliation("REVIEW_REQUIRED") === false, "Eligibility: REVIEW_REQUIRED is NOT eligible");
  assert(ApprovalStateManager.isEligibleForReconciliation("REJECTED") === false, "Eligibility: REJECTED is NOT eligible");

  // 30.3: State Transitions
  const t1 = ApprovalStateManager.transitionState({
    currentState: "PENDING_VALIDATION",
    targetState: "VALIDATING",
    actor: "SYSTEM_ORCHESTRATOR",
    reason: "Document queued and OCR tokens loaded for AI validation pipeline",
  });
  assert(t1.success === true, "Transition: PENDING_VALIDATION -> VALIDATING is allowed");
  assert(t1.newState === "VALIDATING", "Transition: Resulting state is VALIDATING");

  const t2 = ApprovalStateManager.transitionState({
    currentState: "VALIDATING",
    targetState: "REVIEW_REQUIRED",
    actor: "AI_VALIDATOR",
    reason: "Cross-field tariff discrepancy detected",
  });
  assert(t2.success === true, "Transition: VALIDATING -> REVIEW_REQUIRED is allowed");
  assert(t2.newState === "REVIEW_REQUIRED", "Transition: Resulting state is REVIEW_REQUIRED");

  const t3 = ApprovalStateManager.transitionState({
    currentState: "REVIEW_REQUIRED",
    targetState: "APPROVED",
    actor: "Sipho Khumalo",
    reason: "Reviewer corrected tariff and verified schedule",
  });
  assert(t3.success === true, "Transition: REVIEW_REQUIRED -> APPROVED is allowed upon human review");
  assert(t3.newState === "APPROVED", "Transition: Resulting state is APPROVED");

  // Illegal transition attempt: PENDING_VALIDATION -> APPROVED directly
  const illegalTransition = ApprovalStateManager.transitionState({
    currentState: "PENDING_VALIDATION",
    targetState: "APPROVED",
    actor: "MALICIOUS_ACTOR",
    reason: "Attempt to bypass validation",
  });
  assert(illegalTransition.success === false, "Transition: Illegal transition PENDING_VALIDATION -> APPROVED is BLOCKED");
  assert(illegalTransition.newState === "PENDING_VALIDATION", "Transition: State unchanged on illegal transition");

  // --- TEST GROUP 31: RECONCILIATION GATE (REQ 31) ---
  console.log("\n[Test Group 31] Reconciliation Gate — Strict Boundary & Anti-Raw-OCR Enforcement");

  // 31.1: Reject Raw OCR Input (Zero validation controls)
  const rawOcrInput = {
    rawOcrText: "ESKOM INVOICE TOTAL R125,430.20 ACCOUNT 0712345678",
    wordTokens: [{ text: "ESKOM", boundingBox: [0, 0, 10, 10] }],
    ocrPages: [{ pageNumber: 1 }],
  };

  const rawGateEvaluation = ReconciliationGate.evaluateGate(rawOcrInput);
  assert(rawGateEvaluation.isPassed === false, "Reconciliation Gate: Raw OCR object is BLOCKED");
  assert(rawGateEvaluation.gateStatus === "GATE_BLOCKED", "Reconciliation Gate: Status is GATE_BLOCKED");
  assert(
    rawGateEvaluation.violations.some((v) => v.code === "UNVALIDATED_RAW_OCR_DETECTED"),
    "Reconciliation Gate: Violation code is UNVALIDATED_RAW_OCR_DETECTED",
  );

  let rawThrewException = false;
  try {
    ReconciliationGate.enforceGate(rawOcrInput);
  } catch (err: any) {
    rawThrewException = true;
    assert(err instanceof ReconciliationGateError, "Reconciliation Gate: enforceGate throws ReconciliationGateError on raw OCR");
    assert(err.code === "UNVALIDATED_RAW_OCR_DETECTED", "Reconciliation Gate: Error code matches UNVALIDATED_RAW_OCR_DETECTED");
  }
  assert(rawThrewException === true, "Reconciliation Gate: Throws exception when raw OCR attempts to enter reconciliation");

  // 31.2: Reject Unapproved / In-Review Document
  const unapprovedPayload = {
    documentId: "DOC-GATE-01",
    status: "REVIEW_REQUIRED",
    validationRunId: "val-run-01",
    approval: { status: "REVIEW_REQUIRED", blockingExceptionCount: 2 },
    exceptions: [
      { exceptionId: "EX-1", severity: "CRITICAL", title: "Arithmetic mismatch", category: "ARITHMETIC_MISMATCH" },
    ],
    validatedFields: {
      accountNumber: { value: "0712345678" },
      billingPeriodStart: { value: "2025-09-01" },
      billingPeriodEnd: { value: "2025-09-30" },
      tariffName: { value: "MINIFLEX" },
      totalKwh: { value: 100000 },
      invoiceTotal: { value: 115000 },
    },
  };

  const unapprovedEval = ReconciliationGate.evaluateGate(unapprovedPayload);
  assert(unapprovedEval.isPassed === false, "Reconciliation Gate: REVIEW_REQUIRED document is BLOCKED");
  assert(
    unapprovedEval.violations.some((v) => v.code === "INVALID_APPROVAL_STATE"),
    "Reconciliation Gate: Flags INVALID_APPROVAL_STATE for unapproved doc",
  );
  assert(
    unapprovedEval.violations.some((v) => v.code === "UNRESOLVED_BLOCKING_EXCEPTIONS"),
    "Reconciliation Gate: Flags UNRESOLVED_BLOCKING_EXCEPTIONS for unapproved doc",
  );

  // 31.3: Reject Missing Mandatory Critical Fields
  const missingFieldPayload = {
    documentId: "DOC-GATE-02",
    status: "APPROVED",
    validationRunId: "val-run-02",
    approval: { status: "APPROVED", blockingExceptionCount: 0 },
    approvedValues: {
      // Missing accountNumber and invoiceTotal
      billingPeriodStart: "2025-09-01",
      billingPeriodEnd: "2025-09-30",
      tariffName: "MINIFLEX",
      totalKwh: 100000,
    },
  };

  const missingFieldEval = ReconciliationGate.evaluateGate(missingFieldPayload);
  assert(missingFieldEval.isPassed === false, "Reconciliation Gate: Missing mandatory fields is BLOCKED");
  assert(
    missingFieldEval.violations.some((v) => v.fieldKey === "accountNumber"),
    "Reconciliation Gate: Flags missing accountNumber",
  );
  assert(
    missingFieldEval.violations.some((v) => v.fieldKey === "invoiceTotal"),
    "Reconciliation Gate: Flags missing invoiceTotal",
  );

  // 31.4: Accept Validated & Approved Data and Produce Authoritative Input
  const validApprovedPayload = {
    documentId: "DOC-APPROVED-RECON-01",
    organisationId: "ORG-MINING-CORP",
    status: "APPROVED",
    validationRunId: "val-run-approved-01",
    approval: { status: "APPROVED", approvedBy: "Sipho Khumalo", blockingExceptionCount: 0 },
    auditVerificationHash: "audit_sha256_verifiable_hash_proof_0123456789abcdef",
    approvedValues: {
      accountNumber: "0712345678",
      invoiceNumber: "INV-2025-09-001",
      billingPeriodStart: "2025-09-01",
      billingPeriodEnd: "2025-09-30",
      tariffName: "MINIFLEX",
      peakKwh: 35000,
      standardKwh: 45000,
      offPeakKwh: 20000,
      totalKwh: 100000,
      maximumDemandKva: 450,
      ratchetedDemandKva: 450,
      reactiveEnergyKvarh: 12000,
      powerFactor: 0.95,
      subtotal: 100000,
      vat: 15000,
      invoiceTotal: 115000,
    },
  };

  const approvedEval = ReconciliationGate.evaluateGate(validApprovedPayload);
  assert(approvedEval.isPassed === true, "Reconciliation Gate: Approved document PASSES gate cleanly");
  assert(approvedEval.gateStatus === "GATE_PASSED", "Reconciliation Gate: Status is GATE_PASSED");
  assert(approvedEval.authoritativeInputReady === true, "Reconciliation Gate: authoritativeInputReady is true");

  const authoritativeInput = ReconciliationGate.enforceGate(validApprovedPayload, {
    tenantId: "TENANT-ESKOM-01",
    telemetryBatchId: "BATCH-AMR-SEPT-2025",
  });

  assert(authoritativeInput.invoice_id === "DOC-APPROVED-RECON-01", "Authoritative Input: Correct invoice_id");
  assert(authoritativeInput.account_number === "0712345678", "Authoritative Input: Correct account_number");
  assert(authoritativeInput.tariff_version === "MINIFLEX", "Authoritative Input: Correct tariff_version");
  assert(authoritativeInput.billed_total_kwh.toString() === "100000", "Authoritative Input: Exact Decimal total kWh (100000)");
  assert(authoritativeInput.billed_total_zar.toString() === "115000", "Authoritative Input: Exact Decimal total ZAR (115000)");
  assert(authoritativeInput.billed_peak_kwh.toString() === "35000", "Authoritative Input: Exact Decimal peak kWh (35000)");
  assert(authoritativeInput.billed_vat_zar.toString() === "15000", "Authoritative Input: Exact Decimal VAT (15000)");
  assert(authoritativeInput.telemetry_batch_id === "BATCH-AMR-SEPT-2025", "Authoritative Input: Telemetry batch attached");

  // --- TEST GROUP 32: FRONTEND VALIDATION DASHBOARD (REQ 32) ---
  console.log("\n[Test Group 32] Frontend Validation Dashboard — Dynamic Database Data Loading & 4 Structured Sections");

  // Populate test record in InvoiceStorageService and ValidationRunStore
  InvoiceStorageService.recordInvoiceMemory("INV-2026-001", {
    id: "INV-2026-001",
    invoice_number: "INV-2026-001",
    account_number: "0712345678",
    tariff_name: "MEGAFLEX",
    billing_start: "2026-01-01",
    billing_end: "2026-01-31",
    billing_period_name: "January 2026",
    invoiced_subtotal: 100000,
    invoiced_vat: 15000,
    invoiced_total: 115000,
    total_kwh: 56200,
    peak_kwh: 20000,
    standard_kwh: 25000,
    off_peak_kwh: 11200,
    source_file_name: "Eskom_Invoice_Jan2026_Megaflex.pdf",
    validation_status: "VALID",
  });

  const dashboardData = await FrontendValidationDataLoader.loadDashboardData("INV-2026-001");
  assert(dashboardData !== null, "Dashboard Loader: Successfully loaded data for document");
  assert(dashboardData?.loadedFromDatabase === true, "Dashboard Loader: Invariant verified — loadedFromDatabase is true (zero static values)");

  // 32.1: Document Section
  assert(dashboardData?.document.filename === "Eskom_Invoice_Jan2026_Megaflex.pdf", "Dashboard (Document): Filename matches DB record");
  assert(dashboardData?.document.documentType.toLowerCase().includes("megaflex"), "Dashboard (Document): Document type reflects Megaflex tariff");
  assert(dashboardData?.document.invoiceNumber === "INV-2026-001", "Dashboard (Document): Invoice number matches DB");
  assert(dashboardData?.document.billingPeriod === "2026-01-01 to 2026-01-31", "Dashboard (Document): Billing period formatted correctly");

  // 32.2: Validation Section
  assert(dashboardData?.validation.overallStatus === "VALID", "Dashboard (Validation): Overall status is VALID");
  assert(dashboardData?.validation.fieldsValidatedCount > 0, "Dashboard (Validation): Fields validated count > 0");
  assert(typeof dashboardData?.validation.confidenceScore === "number", "Dashboard (Validation): Confidence score present");
  assert(dashboardData?.validation.conflictsCount === 0, "Dashboard (Validation): Conflicts count is 0 for clean invoice");

  // 32.3: Financial Section
  assert(dashboardData?.financial.totalKwh === 56200, "Dashboard (Financial): Total kWh matches DB (56,200 kWh)");
  assert(dashboardData?.financial.subtotalZar === 100000, "Dashboard (Financial): Subtotal matches DB (R 100,000.00)");
  assert(dashboardData?.financial.vatZar === 15000, "Dashboard (Financial): VAT matches DB (R 15,000.00)");
  assert(dashboardData?.financial.invoiceTotalZar === 115000, "Dashboard (Financial): Invoice total matches DB (R 115,000.00)");

  // 32.4: Evidence Section
  assert(dashboardData?.evidence.length > 0, "Dashboard (Evidence): Evidence items populated");
  const totalKwhEvidence = dashboardData?.evidence.find((e) => e.fieldKey === "totalKwh");
  assert(totalKwhEvidence !== undefined, "Dashboard (Evidence): Total kWh evidence item present");
  assert(totalKwhEvidence?.page === 3, "Dashboard (Evidence): Page number is 3");
  assert(totalKwhEvidence?.sourceText.includes("56200") || totalKwhEvidence?.sourceText.includes("56,200"), "Dashboard (Evidence): Source text snippet present");
  assert(totalKwhEvidence?.extractionMethod === "TABLE_EXTRACTION" || totalKwhEvidence?.extractionMethod === "NATIVE_PDF_TEXT", "Dashboard (Evidence): Extraction method present");

  // --- TEST GROUP 33: STRUCTURED EXCEPTION MANAGEMENT (REQ 33) ---
  console.log("\n[Test Group 33] Structured Exception Management — Documented Severity Rules, Comparison Delta & Audit Lifecycle");

  ExceptionManager.clearStore();

  // 33.1: Create Structured TOTAL_KWH_MISMATCH Exception matching exact specification
  const exc1 = ExceptionManager.createException({
    code: "TOTAL_KWH_MISMATCH",
    category: "TOTAL_KWH_MISMATCH",
    documentId: "INV-2026-001",
    fieldKey: "totalKwh",
    title: "Total Active Energy Summation Mismatch",
    description: "Sum of TOU energy blocks (55,700 kWh) does not equal billed Total kWh (56,200 kWh).",
    expectedValue: "55,700 kWh",
    observedValue: "56,200 kWh",
    difference: "500 kWh",
    pageNumber: 3,
    evidenceSourceText: "Total Active Energy: 56,200 kWh | Peak: 20,000 | Std: 24,500 | OffPeak: 11,200",
    extractionMethod: "TABLE_EXTRACTION",
    status: "OPEN",
    suggestedAction: "Check for unmetered load or verify sub-interval meter accumulation.",
  });

  assert(exc1.code === "TOTAL_KWH_MISMATCH", "Exception: Code is TOTAL_KWH_MISMATCH");
  assert(exc1.severity === "HIGH", "Exception: Severity is HIGH based on documented rules");
  assert(exc1.documentId === "INV-2026-001", "Exception: Document is INV-2026-001");
  assert(exc1.expectedValue === "55,700 kWh", "Exception: Expected is 55,700 kWh");
  assert(exc1.observedValue === "56,200 kWh", "Exception: Document observed is 56,200 kWh");
  assert(exc1.difference === "500 kWh", "Exception: Difference is 500 kWh");
  assert(exc1.pageNumber === 3, "Exception: Evidence page is 3");
  assert(exc1.status === "OPEN", "Exception: Status is OPEN");

  // 33.2: Verify Documented Severity Rules for all 5 Severity Levels (CRITICAL, HIGH, MEDIUM, LOW, INFO)
  assert(ExceptionManager.determineSeverity("INVOICE_TOTAL_MISMATCH") === "CRITICAL", "Severity Rule: INVOICE_TOTAL_MISMATCH is CRITICAL");
  assert(ExceptionManager.determineSeverity("MISSING_MANDATORY_FIELD") === "CRITICAL", "Severity Rule: MISSING_MANDATORY_FIELD is CRITICAL");
  assert(ExceptionManager.determineSeverity("ARITHMETIC_MISMATCH", { isFinancial: true, differenceNumber: 150 }) === "CRITICAL", "Severity Rule: Large financial discrepancy is CRITICAL");
  assert(ExceptionManager.determineSeverity("TOTAL_KWH_MISMATCH") === "HIGH", "Severity Rule: TOTAL_KWH_MISMATCH is HIGH");
  assert(ExceptionManager.determineSeverity("TARIFF_NAME_UNGROUNDED") === "HIGH", "Severity Rule: TARIFF_NAME_UNGROUNDED is HIGH");
  assert(ExceptionManager.determineSeverity("MULTI_SOURCE_CONFLICT") === "HIGH", "Severity Rule: MULTI_SOURCE_CONFLICT is HIGH");
  assert(ExceptionManager.determineSeverity("SEMANTIC_INCONSISTENCY") === "MEDIUM", "Severity Rule: SEMANTIC_INCONSISTENCY is MEDIUM");
  assert(ExceptionManager.determineSeverity("CROSS_FIELD_CONFLICT") === "MEDIUM", "Severity Rule: CROSS_FIELD_CONFLICT is MEDIUM");
  assert(ExceptionManager.determineSeverity("ARITHMETIC_MISMATCH", { isFinancial: true, differenceNumber: 1.20 }) === "LOW", "Severity Rule: Minor rounding variance (< R2) is LOW");

  // 33.3: Exception Querying and Resolution Lifecycle
  const docExceptions = ExceptionManager.listExceptionsForDocument("INV-2026-001");
  assert(docExceptions.length === 1, "Exception Store: Exactly 1 exception found for document");

  const resolvedExc = ExceptionManager.resolveException({
    exceptionId: exc1.exceptionId,
    resolvedBy: "Sipho Khumalo",
    reason: "Adjusted for 500 kWh auxiliary transformer unbilled loss after physical inspection",
    correctedValue: "55,700 kWh",
    action: "RESOLVED",
  });

  assert(resolvedExc.status === "RESOLVED", "Exception Resolution: Status transitioned to RESOLVED");
  assert(resolvedExc.resolution?.resolvedBy === "Sipho Khumalo", "Exception Resolution: Reviewer recorded");
  assert(resolvedExc.resolution?.correctedValue === "55,700 kWh", "Exception Resolution: Corrected value recorded");
  assert(resolvedExc.resolution?.reason.includes("auxiliary transformer"), "Exception Resolution: Reason recorded");

  console.log("\n==================================================================");
  console.log(`  🎉 ALL ${passedCount} / ${totalCount} AI VALIDATION TESTS PASSED CLEANLY!`);
  console.log("==================================================================\n");
}

runAiValidationPipelineTestSuite().catch((err) => {
  console.error("AI Validation Test Suite Failed:", err);
  process.exit(1);
});






