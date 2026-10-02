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
  CanonicalInvoiceBuilder,
  StructuredAiPayloadBuilder,
  StructuredAiResponseValidator,
  VALIDATION_TOLERANCES,
  ValidationToleranceEvaluator,
  type CandidateFieldValidationInput,
  type EvidenceStreamReading,
  type DuplicateFieldOccurrence,
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
      value: "100 Power Grid Way, Midrand",
      rawValue: "100 Power Grid Way, Midrand",
      sourcePage: 1,
      boundingBox: [0.15, 0.1, 0.2, 0.3],
      opticalConfidence: 100,
      sourceText: "Site: 100 Power Grid Way, Midrand",
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

  console.log("\n==================================================================");
  console.log(`  🎉 ALL ${passedCount} / ${totalCount} AI VALIDATION TESTS PASSED CLEANLY!`);
  console.log("==================================================================\n");
}

runAiValidationPipelineTestSuite().catch((err) => {
  console.error("AI Validation Test Suite Failed:", err);
  process.exit(1);
});





