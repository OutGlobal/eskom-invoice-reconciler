/**
 * ENERA AI VALIDATION & INTELLIGENT DOCUMENT VERIFICATION — TYPES
 * ================================================================
 * Core type definitions for the 8-stage validation pipeline:
 *
 *   Candidate Data
 *         ↓
 *   Evidence Check
 *         ↓
 *   AI Semantic Validation
 *         ↓
 *   Deterministic Rules
 *         ↓
 *   Cross-Field Validation
 *         ↓
 *   Confidence Calculation
 *         ↓
 *   Exception Generation
 *         ↓
 *   Approval / Review
 *
 * MANDATE & CORE PRINCIPLES:
 * 1. Support 6 AI Validation States: VALID, INVALID, UNCERTAIN, MISSING, CONFLICT, REVIEW_REQUIRED.
 * 2. Field-level validation confidence scores (not statistical Bayesian calibrated probabilities).
 * 3. AI may interpret evidence. AI may NOT invent evidence.
 * 4. Never manufacture missing values, silently change financial numbers, or invent accounts.
 * 5. If evidence is insufficient, return UNKNOWN / MISSING / REVIEW_REQUIRED.
 */

import type {
  AiValidationFieldEvidence,
  AiValidationStructuredPackage,
  AiValidationWordEvidence,
} from "../intelligence/aiValidationInputBuilder";

// --- 1. SEPARATION OF CONCERNS CONTRACTS ---

export type ValidationPipelineLayer =
  "EXTRACTION" | "AI_VALIDATION" | "DETERMINISTIC_VALIDATION" | "RECONCILIATION";

export interface LayerContract {
  layer: ValidationPipelineLayer;
  coreQuestion: string;
  allowedActions: string[];
  prohibitions: string[];
}

// --- 2. AI VALIDATION STATES (REQUIREMENT 10) ---

export type AiFieldValidationState =
  "VALID" | "INVALID" | "UNCERTAIN" | "MISSING" | "CONFLICT" | "REVIEW_REQUIRED";

// --- 3. FIELD-LEVEL CONFIDENCE (REQUIREMENT 11) ---

export interface FieldValidationConfidenceScore {
  fieldKey: string;
  fieldLabel: string;
  score: number; // 0 to 100 validation confidence score
  status: AiFieldValidationState;
  scoreType: "VALIDATION_CONFIDENCE_SCORE"; // Explicitly designated as validation score, not calibrated Bayesian probability
  breakdown: {
    opticalClarity: number; // 0..100
    spatialBounding: number; // 0..100
    semanticAgreement: number; // 0..100
    deterministicAgreement: number; // 0..100
  };
  reasoning: string;
}

// --- 4. CANDIDATE DATA & EVIDENCE CHECK ---

export type GroundedStatus = "FULLY_GROUNDED" | "PARTIALLY_GROUNDED" | "UNGROUNDED" | "UNKNOWN";

// --- 4a. MULTI-SOURCE EVIDENCE STREAM TYPES (REQUIREMENT 19) ---

export type EvidenceSourceType =
  | "OCR_RESULT"
  | "NATIVE_PDF_TEXT"
  | "TABLE_EXTRACTION"
  | "DOCUMENT_CONTEXT";

export interface EvidenceStreamReading {
  source: EvidenceSourceType;
  value: string | number | null;
  rawValue: string;
  confidence?: number;
  pageNumber?: number;
  boundingBox?: [number, number, number, number];
  extractedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface DuplicateFieldOccurrence {
  occurrenceId: string;
  fieldKey: string;
  pageNumber: number;
  locationLabel?: string; // e.g. "Page 1 - Summary Box", "Page 5 - Remittance Advice"
  value: string | number | null;
  rawValue: string;
  opticalConfidence: number;
  boundingBox?: [number, number, number, number];
  sourceText?: string;
}

export interface CandidateFieldValidationInput {
  fieldKey: string;
  fieldLabel: string;
  value: string | number | null;
  rawValue: string;
  sourcePage: number;
  boundingBox?: [number, number, number, number];
  opticalConfidence: number;
  wordTokens?: AiValidationWordEvidence[];
  sourceText?: string;
  processingRunId?: string;
  multiSourceReadings?: EvidenceStreamReading[];
  duplicateOccurrences?: DuplicateFieldOccurrence[];
}

export interface GroundedEvidenceCheckResult {
  fieldKey: string;
  isGrounded: boolean;
  groundedStatus: GroundedStatus;
  matchingTokensCount: number;
  spatialBoundingBoxPresent: boolean;
  boundingBox?: [number, number, number, number];
  pageNumber: number;
  reason: string;
}

// --- 5. AI SEMANTIC VALIDATION ---

export type SemanticConsistencyLevel = "CONSISTENT" | "AMBIGUOUS" | "INCONSISTENT" | "UNKNOWN";

export interface SemanticValidationFinding {
  fieldKey: string;
  consistencyLevel: SemanticConsistencyLevel;
  status: AiFieldValidationState;
  semanticConfidence: number;
  interpretationSummary: string;
  anomalyDetected: boolean;
  anomalyDescription?: string;
  evidenceSnippets: string[];
  isInventedValuePrevented: boolean;
}

export interface AiSemanticValidationResult {
  documentId: string;
  overallSemanticConsistency: SemanticConsistencyLevel;
  supplierDetected: string | null;
  documentClassificationMatch: boolean;
  findings: SemanticValidationFinding[];
  summaryNotes: string;
  unresolvedAmbiguities: string[];
  aiFailure?: AiFailureRecord;
}

// --- 5a. AI FAILURE HANDLING (REQUIREMENT 24) ---

export type AiFailureReason =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE"
  | "SCHEMA_ERROR"
  | "TOKEN_LIMIT"
  | "UNAVAILABLE";

export interface AiFailureRecord {
  failureId: string;
  documentId: string;
  processingRunId?: string;
  validationVersion: number;
  reason: AiFailureReason;
  errorMessage: string;
  rawErrorDetails?: unknown;
  timestamp: string;
  isRetryable: boolean;
  retryAfterMs?: number;
  attemptCount: number;
  maxRetries: number;
  evidencePreserved: boolean;
  ocrEvidenceSummary: {
    totalTokensPreserved: number;
    totalCandidateFieldsPreserved: number;
    documentTextPreserved: boolean;
  };
}

// --- 6. DETERMINISTIC RULES & ARITHMETIC ---

export type DeterministicRuleType =
  | "SUBTOTAL_VAT_TOTAL_SUM"
  | "TOU_ENERGY_SUM"
  | "RATE_QUANTITY_PRODUCT"
  | "DATE_CHRONOLOGY"
  | "DEMAND_SANITY_AND_UNITS"
  | "POWER_FACTOR_BOUNDS"
  | "REACTIVE_ENERGY_SANITY"
  | "ACCOUNT_NUMBER_FORMAT"
  | "METER_READING_DELTA"
  | "NON_NEGATIVE_FINANCIALS";

export interface DeterministicRuleEvaluation {
  ruleType: DeterministicRuleType;
  ruleName: string;
  isPassed: boolean;
  expectedValue?: string | number;
  actualValue?: string | number;
  toleranceApplied?: number;
  difference?: number;
  errorMessage?: string;
  evaluatedFields: string[];
}

export interface DeterministicValidationResult {
  documentId: string;
  allRulesPassed: boolean;
  passedCount: number;
  failedCount: number;
  evaluations: DeterministicRuleEvaluation[];
}

// --- 7. CROSS-FIELD VALIDATION ---

export interface CrossFieldValidationFinding {
  ruleCode: string;
  involvedFields: string[];
  isConsistent: boolean;
  details: string;
}

export interface CrossFieldValidationResult {
  isCompliant: boolean;
  findings: CrossFieldValidationFinding[];
}

// --- 8. MULTI-FACTOR CONFIDENCE & DOCUMENT QUALITY (REQUIREMENTS 12 & 13) ---

export type ValidationConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export type ConfidenceTierPolicyAction =
  | "ELIGIBLE_FOR_AUTOMATIC_PROGRESSION"
  | "ADDITIONAL_DETERMINISTIC_CHECKS"
  | "REVIEW_REQUIRED";

export type DocumentValidationStatus =
  | "DOCUMENT_VERIFIED"
  | "DOCUMENT_PARTIALLY_VERIFIED"
  | "DOCUMENT_REQUIRES_REVIEW"
  | "DOCUMENT_INVALID";

export interface ValidationConfidenceThresholds {
  /** Minimum score for HIGH tier (Default: 85) - eligible for automatic progression */
  highThreshold: number;
  /** Minimum score for MEDIUM tier (Default: 65) - triggers additional deterministic checks */
  mediumThreshold: number;
  /** Minimum validation score required on every critical field to allow HIGH tier (Default: 80) */
  criticalFieldFloorScore: number;
  /** Minimum grounding score required on critical fields (Default: 90) */
  criticalFieldGroundedThreshold: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ValidationConfidenceThresholds = {
  highThreshold: 85,
  mediumThreshold: 65,
  criticalFieldFloorScore: 80,
  criticalFieldGroundedThreshold: 90,
};

export const CRITICAL_DOCUMENT_FIELDS: readonly string[] = [
  "accountNumber",
  "invoiceNumber",
  "billingPeriodStart",
  "billingPeriodEnd",
  "meterNumber",
  "tariffName",
  "tariffCode",
  "totalKwh",
  "totalActiveEnergyKwh",
  "totalEnergyKwh",
  "maximumDemandKva",
  "demandKva",
  "subtotal",
  "totalExclVat",
  "vat",
  "vatAmount",
  "invoiceTotal",
  "totalAmountDue",
  "totalDue",
  "peakKwh",
  "peakEnergyKwh",
  "standardKwh",
  "standardEnergyKwh",
  "offPeakKwh",
  "offPeakEnergyKwh",
];

export interface DocumentValidationQualitySummary {
  documentStatus: DocumentValidationStatus;
  overallScore: number;
  tier: ValidationConfidenceTier;
  policyAction: ConfidenceTierPolicyAction;
  criticalFieldsScore: number;
  nonCriticalFieldsScore: number;
  hasFailingCriticalField: boolean;
  criticalFieldFailures: string[];
  isAntiMaskingTriggered: boolean;
  antiMaskingReason?: string;
  configuredThresholds: ValidationConfidenceThresholds;
}

export interface ValidationConfidenceBreakdown {
  opticalScore: number; // 0..100 (from OCR tokens)
  groundingScore: number; // 0..100 (provenance & spatial coordinates)
  semanticScore: number; // 0..100 (AI semantic consistency)
  deterministicScore: number; // 0..100 (exact arithmetic & structural rules)
  crossFieldScore: number; // 0..100 (relational cross-checks)
  overallScore: number; // 0..100 (weighted aggregate validation score)
  tier: ValidationConfidenceTier;
  policyAction: ConfidenceTierPolicyAction;
  documentStatus: DocumentValidationStatus;
  qualitySummary: DocumentValidationQualitySummary;
  isReliable: boolean;
  requiresReview: boolean;
  fieldScores: Record<string, FieldValidationConfidenceScore>;
}

// --- 8a. OCR ERROR DETECTION (REQUIREMENT 18) ---

export type OcrErrorType =
  | "CHARACTER_CONFUSION"
  | "DECIMAL_SHIFT"
  | "MISSING_DECIMAL"
  | "INCORRECT_DATE"
  | "INCORRECT_ACCOUNT_NUMBER"
  | "SUSPICIOUS_TOKEN_PATTERN";

export type OcrWorkflowStage =
  | "POSSIBLE_OCR_ERROR"
  | "EVIDENCE_REVIEW"
  | "VALIDATION"
  | "USER_CONFIRMATION_IF_NECESSARY";

export interface OcrConfusionPair {
  confusedChar: string;
  likelyChar: string;
  position: number;
  patternName: string; // e.g. "O_TO_0", "I_TO_1", "S_TO_5", "B_TO_8", "Z_TO_2", "G_TO_6"
}

export interface OcrErrorDetectionFinding {
  fieldKey: string;
  fieldLabel: string;
  errorType: OcrErrorType;
  suspicionStatus: "POSSIBLE_OCR_ERROR";
  workflowStage: OcrWorkflowStage;
  rawObserved: string;
  candidateAlternative?: string | number;
  confusionPairs: OcrConfusionPair[];
  confidencePenalty: number;
  requiresUserConfirmation: boolean;
  explanation: string;
}

export interface OcrErrorDetectionResult {
  documentId: string;
  hasSuspectedOcrErrors: boolean;
  totalFindingsCount: number;
  findings: OcrErrorDetectionFinding[];
  workflowSummary: string;
}

// --- 8b. MULTIPLE EVIDENCE SOURCES RECONCILIATION (REQUIREMENT 19) ---

export type MultiSourceReconciliationStatus =
  | "AGREED"
  | "CONFLICT"
  | "SINGLE_SOURCE"
  | "NO_EVIDENCE";

export interface MultiSourceFieldComparison {
  fieldKey: string;
  fieldLabel: string;
  status: MultiSourceReconciliationStatus;
  participatingSources: EvidenceSourceType[];
  agreementCount: number;
  conflictCount: number;
  readings: EvidenceStreamReading[];
  hasAgreementBoost: boolean;
  confidenceAdjustment: number; // e.g. +10 for agreement, -30 for conflict
  conflictingCandidates?: EvidenceStreamReading[];
  arbitrarySelectionPrevented: boolean;
  reasoning: string;
}

export interface MultiSourceReconciliationResult {
  documentId: string;
  isFullyAgreed: boolean;
  hasConflicts: boolean;
  totalFieldsEvaluated: number;
  agreedFieldsCount: number;
  conflictedFieldsCount: number;
  comparisons: MultiSourceFieldComparison[];
  conflictList: MultiSourceFieldComparison[];
}

// --- 8c. DUPLICATE FIELD DETECTION (REQUIREMENT 20) ---

export type DuplicateFieldStatus =
  | "SINGLE_OCCURRENCE"
  | "AGREED"
  | "CONFLICT"
  | "NOT_FOUND";

export interface DuplicateFieldComparison {
  fieldKey: string;
  fieldLabel: string;
  status: DuplicateFieldStatus;
  occurrencesCount: number;
  occurrences: DuplicateFieldOccurrence[];
  distinctValuesCount: number;
  isAgreed: boolean;
  evidenceStrengthBonus: number; // e.g. +10..+15 when agreed across multiple pages
  hasConflict: boolean;
  arbitrarySelectionPrevented: boolean;
  reasoning: string;
}

export interface DuplicateFieldDetectionResult {
  documentId: string;
  hasDuplicates: boolean;
  hasConflicts: boolean;
  totalFieldsEvaluated: number;
  agreedDuplicatesCount: number;
  conflictedDuplicatesCount: number;
  comparisons: DuplicateFieldComparison[];
  conflictList: DuplicateFieldComparison[];
  agreedList: DuplicateFieldComparison[];
  summary: string;
}

// --- 8d. MISSING DATA INTEGRITY & ANTI-DEFAULT GUARD (REQUIREMENT 21) ---

export interface MissingDataAuditFinding {
  fieldKey: string;
  fieldLabel: string;
  status: "MISSING" | "UNGROUNDED_SYNTHETIC_REJECTED" | "PRESENT_GROUNDED";
  isMissing: boolean;
  extractedValue: string | number | null;
  wasSyntheticDefaultAttempted: boolean;
  rejectedDefaultValue?: string | number;
  reasoning: string;
  auditRule: "MISSING_DATA_MUST_REMAIN_MISSING_NO_INDUSTRY_DEFAULTS";
}

export interface MissingDataAuditResult {
  documentId: string;
  totalMissingCount: number;
  syntheticDefaultsPreventedCount: number;
  findings: MissingDataAuditFinding[];
  isIntegrityPreserved: boolean;
  summary: string;
}

// --- 9. EXCEPTION GENERATION ---

export type ExceptionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ExceptionCategory =
  | "UNGROUNDED_FIELD"
  | "ARITHMETIC_MISMATCH"
  | "DATE_CHRONOLOGY_ERROR"
  | "DIGIT_AMBIGUITY"
  | "MISSING_MANDATORY_FIELD"
  | "SEMANTIC_INCONSISTENCY"
  | "CROSS_FIELD_CONFLICT"
  | "LOW_CONFIDENCE"
  | "POSSIBLE_OCR_ERROR"
  | "MULTI_SOURCE_CONFLICT"
  | "DUPLICATE_FIELD_CONFLICT"
  | "SYNTHETIC_DEFAULT_REJECTED"
  | "AI_FAILURE";

export interface ValidationExceptionRecord {
  exceptionId: string;
  documentId: string;
  fieldKey?: string;
  category: ExceptionCategory;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  suggestedAction: string;
  pageNumber?: number;
  boundingBox?: [number, number, number, number];
  observedValue?: string | number | null;
  expectedValue?: string | number | null;
  createdAt: string;
}

// --- 10. APPROVAL STATES (REQUIREMENT 30) ---

export type ApprovalState =
  | "PENDING_VALIDATION"
  | "VALIDATING"
  | "VALID"
  | "PARTIALLY_VALID"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "REJECTED";

export interface ApprovalStateTransitionRecord {
  fromState: ApprovalState;
  toState: ApprovalState;
  timestamp: string;
  actor: string;
  reason: string;
  isAllowed: boolean;
}

export type ValidationLifecycleStatus =
  | ApprovalState
  | "PENDING"
  | "AUTOMATICALLY_APPROVED"
  | "MANUALLY_APPROVED";

export interface ValidationApprovalRecord {
  status: ValidationLifecycleStatus;
  approvalState?: ApprovalState;
  approvedBy?: string;
  approvedAt?: string;
  approvalMethod: "AUTOMATIC" | "MANUAL" | "NONE";
  reviewNotes?: string;
  blockingExceptionCount: number;
}

// --- 10a. RECONCILIATION GATE (REQUIREMENT 31) ---

export type ReconciliationGateStatus = "GATE_PASSED" | "GATE_BLOCKED";

export type ReconciliationGateErrorCode =
  | "UNVALIDATED_RAW_OCR_DETECTED"
  | "INVALID_APPROVAL_STATE"
  | "UNRESOLVED_BLOCKING_EXCEPTIONS"
  | "AUDIT_CHAIN_INTEGRITY_FAILURE"
  | "MISSING_MANDATORY_CRITICAL_FIELDS"
  | "UNVERIFIED_FINANCIAL_ARITHMETIC";

export interface ReconciliationGateViolation {
  code: ReconciliationGateErrorCode;
  message: string;
  fieldKey?: string;
  details?: Record<string, unknown>;
}

export interface ReconciliationGateEvaluation {
  isPassed: boolean;
  gateStatus: ReconciliationGateStatus;
  approvalState: ApprovalState;
  documentId: string;
  violations: ReconciliationGateViolation[];
  evaluatedAt: string;
  auditHash?: string;
  authoritativeInputReady: boolean;
}


// --- 11. FULL VALIDATION PIPELINE RESULT ---

export interface CompleteValidationResult {
  validationRunId: string;
  documentId: string;
  organisationId?: string;
  processingRunId?: string;
  validationVersion?: number;
  idempotencyKey?: string;
  isIdempotentReplay?: boolean;
  validatedAt: string;
  status: ValidationLifecycleStatus;
  overallConfidence: ValidationConfidenceBreakdown;
  evidenceCheck: {
    totalFieldsChecked: number;
    groundedFieldsCount: number;
    ungroundedFieldsCount: number;
    results: GroundedEvidenceCheckResult[];
  };
  semanticValidation: AiSemanticValidationResult;
  deterministicValidation: DeterministicValidationResult;
  crossFieldValidation: CrossFieldValidationResult;
  ocrErrorDetection?: OcrErrorDetectionResult;
  multiSourceReconciliation?: MultiSourceReconciliationResult;
  duplicateFieldDetection?: DuplicateFieldDetectionResult;
  missingDataAudit?: MissingDataAuditResult;
  aiFailure?: AiFailureRecord;
  exceptions: ValidationExceptionRecord[];
  approval: ValidationApprovalRecord;
  validatedFields: Record<
    string,
    {
      value: string | number | null;
      rawValue: string;
      confidence: number;
      validationScore: FieldValidationConfidenceScore;
      isGrounded: boolean;
      status: AiFieldValidationState;
      provenance?: {
        pageNumber: number;
        boundingBox?: [number, number, number, number];
        sourceText?: string;
      };
    }
  >;
  reconciliationHandoffReady: boolean;
}

// --- 12. IDEMPOTENCY RECORD & STORE (REQUIREMENT 25) ---

export interface ValidationIdempotencyRecord {
  idempotencyKey: string;
  documentId: string;
  processingRunId: string;
  validationVersion: number;
  payloadHash: string;
  createdAt: string;
  updatedAt: string;
  result: CompleteValidationResult;
  isCurrent: boolean;
  supersededBy?: string;
  previousRunId?: string;
}

export interface IdempotencyValidationOptions {
  documentId: string;
  processingRunId?: string;
  validationVersion?: number;
  forceRerun?: boolean;
}

// --- 13. PERSISTENT VALIDATION RUNS (REQUIREMENT 26) ---

export interface PersistentValidationRun {
  validationRunId: string;
  documentId: string;
  ocrRunId: string;
  modelProvider: string;
  promptVersion: string;
  validationVersion: number;
  startTime: string;
  endTime: string;
  durationMs: number;
  status: ValidationLifecycleStatus;
  findings: {
    semanticCount: number;
    deterministicCount: number;
    crossFieldCount: number;
    ocrErrorsCount: number;
    duplicateConflictsCount: number;
    missingDataCount: number;
    totalFindings: number;
  };
  confidence: ValidationConfidenceBreakdown;
  errors: ValidationExceptionRecord[];
  aiFailure?: AiFailureRecord;
  fullResultSnapshot: CompleteValidationResult;
  createdAt: string;
}

export interface ValidationRunQueryOptions {
  documentId?: string;
  ocrRunId?: string;
  status?: ValidationLifecycleStatus;
  modelProvider?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

// --- 14. ENERA 7-STAGE AUDIT CHAIN (REQUIREMENT 27) ---

export type EneraAuditStage =
  | "DOCUMENT"
  | "OCR_RUN"
  | "EXTRACTED_VALUE"
  | "AI_VALIDATION"
  | "DETERMINISTIC_VALIDATION"
  | "USER_REVIEW"
  | "APPROVED_VALUE";

export interface DocumentAuditLink {
  documentId: string;
  filename?: string;
  documentHash?: string;
  receivedAt: string;
}

export interface OcrRunAuditLink {
  ocrRunId: string;
  sourcePage: number;
  boundingBox?: [number, number, number, number];
  opticalConfidence: number;
  rawTokensCount: number;
}

export interface ExtractedValueAuditLink {
  rawValue: string;
  extractedValue: string | number | null;
  sourceText?: string;
}

export interface AiValidationAuditLink {
  modelProvider: string;
  promptVersion: string;
  validationScore: number;
  semanticConsistency: string;
  status: string;
  reasoning: string;
}

export interface DeterministicValidationAuditLink {
  evaluatedRules: string[];
  isPassed: boolean;
  appliedTolerance?: number;
  deviation?: number;
}

export interface UserReviewAuditLink {
  reviewStatus: "AUTOMATIC_PASS" | "HUMAN_APPROVED" | "HUMAN_OVERRIDDEN" | "PENDING_REVIEW";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  originalValueBeforeOverride?: string | number | null;
}

export interface ApprovedValueAuditLink {
  finalValue: string | number | null;
  approvedAt: string;
  isReadyForReconciliation: boolean;
  authoritativeSource: "SYSTEM_AUTOMATIC" | "HUMAN_CONFIRMED" | "OVERRIDE";
}

export interface FieldAuditLineageChain {
  fieldKey: string;
  fieldLabel: string;
  documentId: string;
  chain: {
    document: DocumentAuditLink;
    ocrRun: OcrRunAuditLink;
    extractedValue: ExtractedValueAuditLink;
    aiValidation: AiValidationAuditLink;
    deterministicValidation: DeterministicValidationAuditLink;
    userReview: UserReviewAuditLink;
    approvedValue: ApprovedValueAuditLink;
  };
  chainVerificationHash: string;
  isChainComplete: boolean;
}

export interface DocumentAuditTrailSummary {
  documentId: string;
  validationRunId: string;
  ocrRunId: string;
  totalFieldsTracked: number;
  fieldChains: Record<string, FieldAuditLineageChain>;
  auditChainIntegrity: "INTACT" | "INCOMPLETE" | "CORRUPTED";
  generatedAt: string;
}

// --- 15. HUMAN REVIEW WORKFLOW & CORRECTIONS (REQUIREMENTS 28 & 29) ---

export type HumanReviewFieldStatus = "PENDING" | "CONFIRMED" | "CORRECTED" | "FLAGGED";

export interface FieldCorrectionRecord {
  correctionId: string;
  documentId: string;
  validationRunId: string;
  fieldKey: string;
  fieldLabel: string;
  originalValue: string | number | null;
  originalRawValue: string;
  correctedValue: string | number | null;
  correctedRawValue?: string;
  correctionReason: string;
  reviewer: {
    id: string;
    name: string;
    email?: string;
    role?: string;
  };
  timestamp: string;
  evidence: {
    sourcePage: number;
    boundingBox?: [number, number, number, number];
    sourceText?: string;
    opticalConfidence?: number;
    tokens?: Array<{
      text: string;
      confidence: number;
      boundingBox?: [number, number, number, number];
    }>;
    userNote?: string;
  };
  reEvaluatedDeterministicResult?: DeterministicValidationResult;
  isAuthoritativeForReconciliation: boolean;
}

export interface HumanReviewFieldViewModel {
  fieldKey: string;
  fieldLabel: string;
  sourcePage: number;
  boundingBox?: [number, number, number, number];
  originalValue: string | number | null;
  originalRawValue: string;
  currentValue: string | number | null;
  status: AiFieldValidationState;
  reviewStatus: HumanReviewFieldStatus;
  validationScore: number;
  badge: "VALID_CHECK" | "WARNING" | "ERROR_CONFLICT";
  hasExceptions: boolean;
  exceptionMessages: string[];
  inspectedEvidence: boolean;
  isCorrected: boolean;
  activeCorrection?: FieldCorrectionRecord;
}

export interface DualPaneWorkspaceViewModel {
  documentId: string;
  validationRunId: string;
  filename: string;
  pageCount: number;
  activePage: number;
  activeFieldKey?: string;
  leftPane: {
    pageNumber: number;
    documentUrl?: string;
    tokens: Array<{
      text: string;
      confidence: number;
      boundingBox: [number, number, number, number];
    }>;
    activeHighlightBoundingBox?: [number, number, number, number];
  };
  rightPane: {
    overallStatus: ValidationLifecycleStatus;
    overallConfidenceScore: number;
    fields: HumanReviewFieldViewModel[];
    summaryBadges: {
      validCount: number;
      warningCount: number;
      conflictCount: number;
      correctedCount: number;
    };
  };
}

export interface HumanReviewSession {
  sessionId: string;
  documentId: string;
  validationRunId: string;
  ocrRunId: string;
  reviewer: {
    id: string;
    name: string;
    email?: string;
  };
  status: "IN_REVIEW" | "APPROVED" | "REJECTED" | "ESCALATED";
  startedAt: string;
  completedAt?: string;
  fieldReviews: Record<
    string,
    {
      fieldKey: string;
      status: HumanReviewFieldStatus;
      inspectedEvidence: boolean;
      activeValue: string | number | null;
      correctionId?: string;
    }
  >;
  corrections: FieldCorrectionRecord[];
  reconciliationPayloadReady: boolean;
  reconciliationApprovedValues: Record<string, string | number | null>;
}

export interface DownstreamReconciliationPayload {
  documentId: string;
  validationRunId: string;
  approvedBy: string;
  approvedAt: string;
  approvalMethod: "AUTOMATIC" | "MANUAL_REVIEW";
  approvedValues: Record<string, string | number | null>;
  correctionsAppliedCount: number;
  auditTrailVerificationHash: string;
}


