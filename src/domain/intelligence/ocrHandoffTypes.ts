/**
 * STAGE 15 — OCR & AI PIPELINE HANDOFF TYPES
 * ========================================================
 * Prepares the clean interface and type contracts for the multi-stage pipeline:
 *
 *   Document Intelligence
 *           ↓
 *          OCR
 *           ↓
 *   Structured Extraction
 *           ↓
 *      AI Validation
 *           ↓
 *   Deterministic Validation
 *           ↓
 *      Human Review
 *           ↓
 *     Approved Data
 *           ↓
 *     Reconciliation
 *
 * Rules:
 *  1. Do not fully implement the AI validation layer in this branch.
 *  2. The document intelligence layer must provide clean inputs to OCR and AI.
 *  3. Every step retains immutable audit provenance.
 */

export type PipelineStage =
  | "DOCUMENT_INTELLIGENCE"
  | "OCR"
  | "STRUCTURED_EXTRACTION"
  | "AI_VALIDATION"
  | "DETERMINISTIC_VALIDATION"
  | "HUMAN_REVIEW"
  | "APPROVED_DATA"
  | "RECONCILIATION";

export const PIPELINE_STAGE_SEQUENCE: readonly PipelineStage[] = [
  "DOCUMENT_INTELLIGENCE",
  "OCR",
  "STRUCTURED_EXTRACTION",
  "AI_VALIDATION",
  "DETERMINISTIC_VALIDATION",
  "HUMAN_REVIEW",
  "APPROVED_DATA",
  "RECONCILIATION",
] as const;

export type PipelineStageStatus =
  "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED" | "REQUIRES_REVIEW";

/**
 * 2D normalized coordinate box: [minX, minY, width, height]
 * Expressed as percentages 0..100 or normalized 0..1 relative to page bounds.
 */
export type BoundingBox = [number, number, number, number];

export interface CleanPageGeometry {
  pageNumber: number;
  width: number;
  height: number;
  dpi: number;
  rotation: 0 | 90 | 180 | 270;
  aspectRatio: number;
}

export interface CleanPageTextStream {
  pageNumber: number;
  rawText: string;
  sanitizedText: string;
  lineCount: number;
  characterCount: number;
  hasNativePdfText: boolean;
  textDensity: "EMPTY" | "SPARSE" | "NORMAL" | "DENSE";
  encoding: "utf-8" | "ascii";
}

/**
 * Clean OCR Page Input prepared by the Document Intelligence Layer
 */
export interface CleanOcrPageInput {
  pageNumber: number;
  geometry: CleanPageGeometry;
  nativeText?: CleanPageTextStream;
  imageArtifactUrl?: string;
  imageMimeType?: "image/png" | "image/jpeg" | "image/webp" | "image/tiff";
  preprocessingInstructions?: {
    deskew: boolean;
    binarize: boolean;
    contrastEnhance: boolean;
    dpiUpscaleNeeded: boolean;
  };
}

/**
 * Full Clean OCR Handoff Package produced by Document Intelligence
 */
export interface CleanOcrHandoffPackage {
  packageId: string;
  documentId: string;
  organisationId: string;
  checksum: string;
  documentType: string;
  totalPages: number;
  generatedAt: string;
  status: "READY_FOR_OCR" | "PROCESSING" | "COMPLETED" | "ERROR";
  pages: CleanOcrPageInput[];
  ocrEngineTarget?: "TESSERACT" | "GOOGLE_VISION" | "AWS_TEXTRACT" | "AZURE_DOC_INTEL";
  options: {
    detectOrientation: boolean;
    tableDetection: boolean;
    preserveLayout: boolean;
    confidenceThreshold: number;
  };
}

/**
 * Intermediate OCR Output structure expected from the OCR stage
 */
export interface OcrWordToken {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface OcrLineBlock {
  lineIndex: number;
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  words: OcrWordToken[];
}

export interface OcrPageResult {
  pageNumber: number;
  confidenceAverage: number;
  lines: OcrLineBlock[];
  fullText: string;
  executionDurationMs: number;
}

export interface OcrHandoffResult {
  packageId: string;
  documentId: string;
  engineUsed: string;
  completedAt: string;
  pageResults: OcrPageResult[];
  overallConfidence: number;
}

/**
 * Structured Extraction Table Candidate
 */
export interface ExtractedTableData {
  tableId: string;
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  rows: string[][];
  confidence: number;
  boundingBox?: BoundingBox;
}

/**
 * Structured Extraction Determinant Candidate
 */
export interface ExtractedDeterminantCandidate<T = string | number | null> {
  fieldKey: string;
  fieldLabel: string;
  value: T;
  rawValue: string;
  confidenceScore: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  provenance: {
    documentId: string;
    pageNumber: number;
    extractionMethod: string;
    boundingBox?: BoundingBox;
    hasExactBoundingBox: boolean;
    contextSnippet?: string;
  };
  validationRulesExpected?: string[];
}

/**
 * Full Clean AI Validation Handoff Package
 * Prepared by Document Intelligence & Structured Extraction for the upcoming AI Validation stage.
 */
export interface CleanAiValidationHandoffPackage {
  packageId: string;
  documentId: string;
  organisationId: string;
  checksum: string;
  documentClassification: string;
  generatedAt: string;
  determinantCandidates: ExtractedDeterminantCandidate[];
  tables: ExtractedTableData[];
  rawTextContext: {
    pageNumber: number;
    snippet: string;
  }[];
  validationChecklist: {
    checkKey: string;
    description: string;
    mandatory: boolean;
    expectedDataType: "string" | "number" | "date" | "currency";
  }[];
  state: "READY_FOR_AI_VALIDATION" | "AI_VALIDATION_IN_PROGRESS" | "COMPLETED";
}

/**
 * Pipeline Audit Step Record
 */
export interface PipelineStepExecutionRecord {
  stepId: string;
  documentId: string;
  organisationId: string;
  stage: PipelineStage;
  previousStage?: PipelineStage;
  nextStage?: PipelineStage;
  status: PipelineStageStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  inputPackageHash?: string;
  outputArtifactHash?: string;
  errorDetails?: {
    errorCode: string;
    errorMessage: string;
  } | null;
}
