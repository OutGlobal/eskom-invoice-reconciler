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
 * 1. AI may interpret evidence. AI may NOT invent evidence.
 * 2. Never manufacture missing values, silently change financial numbers, or invent accounts.
 * 3. If evidence is insufficient, return UNKNOWN or REVIEW_REQUIRED.
 * 4. Separate Extraction vs. AI Validation vs. Deterministic Validation vs. Reconciliation.
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

// --- 2. CANDIDATE DATA & EVIDENCE CHECK ---

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

// --- 3. AI SEMANTIC VALIDATION ---

export type SemanticConsistencyLevel = "CONSISTENT" | "AMBIGUOUS" | "INCONSISTENT" | "UNKNOWN";

export interface SemanticValidationFinding {
  fieldKey: string;
  consistencyLevel: SemanticConsistencyLevel;
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

// --- 4. DETERMINISTIC RULES & ARITHMETIC ---

export type DeterministicRuleType =
  | "SUBTOTAL_VAT_TOTAL_SUM"
  | "TOU_ENERGY_SUM"
  | "RATE_QUANTITY_PRODUCT"
  | "DATE_CHRONOLOGY"
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

// --- 5. CROSS-FIELD VALIDATION ---

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

// --- 6. MULTI-FACTOR CONFIDENCE CALCULATION ---

export type ValidationConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export interface ValidationConfidenceBreakdown {
  opticalScore: number; // 0..100 (from OCR tokens)
  groundingScore: number; // 0..100 (provenance & spatial coordinates)
  semanticScore: number; // 0..100 (AI semantic consistency)
  deterministicScore: number; // 0..100 (exact arithmetic & structural rules)
  crossFieldScore: number; // 0..100 (relational cross-checks)
  overallScore: number; // 0..100 (weighted aggregate)
  tier: ValidationConfidenceTier;
  isReliable: boolean;
  requiresReview: boolean;
}

// --- 7. EXCEPTION GENERATION ---

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

// --- 8. APPROVAL & REVIEW WORKFLOW ---

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

// --- 9. FULL VALIDATION PIPELINE RESULT ---

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
      isGrounded: boolean;
      status: "VALIDATED" | "UNKNOWN" | "REVIEW_REQUIRED";
      provenance?: {
        pageNumber: number;
        boundingBox?: [number, number, number, number];
        sourceText?: string;
      };
    }
  >;
  reconciliationHandoffReady: boolean;
}
