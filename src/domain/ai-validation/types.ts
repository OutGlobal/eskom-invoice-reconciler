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
  | "LOW_CONFIDENCE";

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

// --- 10. APPROVAL & REVIEW WORKFLOW ---

export type ValidationLifecycleStatus =
  | "PENDING"
  | "VALIDATING"
  | "AUTOMATICALLY_APPROVED"
  | "REVIEW_REQUIRED"
  | "MANUALLY_APPROVED"
  | "REJECTED";

export interface ValidationApprovalRecord {
  status: ValidationLifecycleStatus;
  approvedBy?: string;
  approvedAt?: string;
  approvalMethod: "AUTOMATIC" | "MANUAL" | "NONE";
  reviewNotes?: string;
  blockingExceptionCount: number;
}

// --- 11. FULL VALIDATION PIPELINE RESULT ---

export interface CompleteValidationResult {
  validationRunId: string;
  documentId: string;
  organisationId?: string;
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
