/**
 * STAGE 15 — OCR & AI PIPELINE HANDOFF SERVICE
 * ========================================================
 * Provides clean, verified inputs from the Document Intelligence layer to:
 *   1. OCR
 *   2. Structured Extraction
 *   3. AI Validation
 *   4. Deterministic Validation
 *   5. Human Review
 *   6. Approved Data
 *   7. Reconciliation
 *
 * Mandate:
 *  - Do not fully implement the AI validation layer in this branch.
 *  - Provide clean, deterministic, sanitised inputs to OCR and AI.
 */

import type {
  PipelineStage,
  PipelineStageStatus,
  CleanOcrHandoffPackage,
  CleanOcrPageInput,
  CleanPageGeometry,
  CleanPageTextStream,
  CleanAiValidationHandoffPackage,
  ExtractedDeterminantCandidate,
  ExtractedTableData,
  PipelineStepExecutionRecord,
} from "./ocrHandoffTypes";
import { PIPELINE_STAGE_SEQUENCE } from "./ocrHandoffTypes";

/**
 * Validates whether a requested pipeline stage transition is valid in the sequence:
 * Document Intelligence -> OCR -> Structured Extraction -> AI Validation ->
 * Deterministic Validation -> Human Review -> Approved Data -> Reconciliation.
 */
export function validatePipelineStageTransition(
  fromStage: PipelineStage | null,
  toStage: PipelineStage,
): { isValid: boolean; reason?: string } {
  if (!fromStage) {
    if (toStage === "DOCUMENT_INTELLIGENCE") {
      return { isValid: true };
    }
    return {
      isValid: false,
      reason: `Initial stage must be 'DOCUMENT_INTELLIGENCE', received '${toStage}'.`,
    };
  }

  const fromIndex = PIPELINE_STAGE_SEQUENCE.indexOf(fromStage);
  const toIndex = PIPELINE_STAGE_SEQUENCE.indexOf(toStage);

  if (fromIndex === -1 || toIndex === -1) {
    return { isValid: false, reason: `Unknown stage in transition: ${fromStage} -> ${toStage}` };
  }

  // Normal forward step: strictly the next index
  if (toIndex === fromIndex + 1) {
    return { isValid: true };
  }

  // Permitted exception: Human Review can route back to OCR or Structured Extraction for reprocessing
  if (fromStage === "HUMAN_REVIEW" && (toStage === "OCR" || toStage === "STRUCTURED_EXTRACTION")) {
    return { isValid: true };
  }

  // Permitted exception: Deterministic Validation flags Human Review
  if (fromStage === "DETERMINISTIC_VALIDATION" && toStage === "HUMAN_REVIEW") {
    return { isValid: true };
  }

  return {
    isValid: false,
    reason: `Invalid pipeline transition: cannot transition from '${fromStage}' to '${toStage}'. Strict sequence must be observed.`,
  };
}

/**
 * Sanitises raw extracted text for downstream OCR & AI layers:
 * - Strips unprintable binary control characters
 * - Normalises CR/LF to standard \n
 * - Calculates character density
 */
export function sanitizePageText(rawText: string, pageNumber: number = 1): CleanPageTextStream {
  if (!rawText || typeof rawText !== "string") {
    return {
      pageNumber,
      rawText: "",
      sanitizedText: "",
      lineCount: 0,
      characterCount: 0,
      hasNativePdfText: false,
      textDensity: "EMPTY",
      encoding: "utf-8",
    };
  }

  // Strip unprintable control characters while preserving standard \n, \r, \t
  // eslint-disable-next-line no-control-regex
  const sanitized = rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\r\n/g, "\n");
  const trimmed = sanitized.trim();
  const lines = trimmed === "" ? [] : trimmed.split("\n");
  const characterCount = trimmed.length;

  let textDensity: CleanPageTextStream["textDensity"] = "EMPTY";
  if (characterCount === 0) {
    textDensity = "EMPTY";
  } else if (characterCount < 150) {
    textDensity = "SPARSE";
  } else if (characterCount < 1500) {
    textDensity = "NORMAL";
  } else {
    textDensity = "DENSE";
  }

  return {
    pageNumber,
    rawText,
    sanitizedText: sanitized,
    lineCount: lines.length,
    characterCount,
    hasNativePdfText: characterCount > 0,
    textDensity,
    encoding: "utf-8",
  };
}

/**
 * Validates and constructs clean page geometry
 */
export function buildCleanPageGeometry(params: {
  pageNumber: number;
  width?: number;
  height?: number;
  dpi?: number;
  rotation?: number;
}): CleanPageGeometry {
  const width = params.width && params.width > 0 ? params.width : 595.28; // Default A4 width in pt
  const height = params.height && params.height > 0 ? params.height : 841.89; // Default A4 height in pt
  const dpi = params.dpi && params.dpi > 0 ? params.dpi : 300;

  let rotation: CleanPageGeometry["rotation"] = 0;
  if (params.rotation === 90 || params.rotation === 180 || params.rotation === 270) {
    rotation = params.rotation;
  }

  return {
    pageNumber: Math.max(1, params.pageNumber),
    width,
    height,
    dpi,
    rotation,
    aspectRatio: Number((width / height).toFixed(4)),
  };
}

/**
 * Builds a Clean OCR Handoff Package from Document Intelligence inputs.
 * Guarantees zero malformed or ungrounded data is sent to downstream OCR engines.
 */
export function buildCleanOcrHandoffPackage(params: {
  documentId: string;
  organisationId: string;
  checksum: string;
  documentType?: string;
  pages: {
    pageNumber: number;
    rawText?: string;
    width?: number;
    height?: number;
    dpi?: number;
    rotation?: number;
    imageArtifactUrl?: string;
  }[];
  ocrEngineTarget?: CleanOcrHandoffPackage["ocrEngineTarget"];
}): CleanOcrHandoffPackage {
  if (!params.documentId || params.documentId.trim() === "") {
    throw new Error("Cannot build OCR handoff package: documentId is required.");
  }
  if (!params.organisationId || params.organisationId.trim() === "") {
    throw new Error("Cannot build OCR handoff package: organisationId is required.");
  }
  if (!params.checksum || params.checksum.trim() === "") {
    throw new Error("Cannot build OCR handoff package: checksum is required for idempotency.");
  }
  if (!params.pages || params.pages.length === 0) {
    throw new Error("Cannot build OCR handoff package: at least 1 page must be provided.");
  }

  const cleanPages: CleanOcrPageInput[] = params.pages.map((p) => {
    const geometry = buildCleanPageGeometry({
      pageNumber: p.pageNumber,
      width: p.width,
      height: p.height,
      dpi: p.dpi,
      rotation: p.rotation,
    });

    const nativeText = p.rawText !== undefined ? sanitizePageText(p.rawText, p.pageNumber) : undefined;

    return {
      pageNumber: p.pageNumber,
      geometry,
      nativeText,
      imageArtifactUrl: p.imageArtifactUrl,
      preprocessingInstructions: {
        deskew: geometry.rotation !== 0,
        binarize: true,
        contrastEnhance: true,
        dpiUpscaleNeeded: geometry.dpi < 300,
      },
    };
  });

  return {
    packageId: `ocr-pkg-${params.documentId}-${Date.now()}`,
    documentId: params.documentId,
    organisationId: params.organisationId,
    checksum: params.checksum,
    documentType: params.documentType || "ESKOM_TARIFF_INVOICE",
    totalPages: cleanPages.length,
    generatedAt: new Date().toISOString(),
    status: "READY_FOR_OCR",
    pages: cleanPages,
    ocrEngineTarget: params.ocrEngineTarget || "TESSERACT",
    options: {
      detectOrientation: true,
      tableDetection: true,
      preserveLayout: true,
      confidenceThreshold: 0.85,
    },
  };
}

/**
 * Builds a Clean AI Validation Handoff Package.
 * Packages extracted candidates with strict evidence provenance so that future
 * AI validation runs over grounded data rather than hallucinating.
 *
 * NOTE: The AI validation layer is NOT executed here, preserving stage boundary.
 */
export function buildCleanAiValidationHandoffPackage(params: {
  documentId: string;
  organisationId: string;
  checksum: string;
  documentClassification?: string;
  determinantCandidates: ExtractedDeterminantCandidate[];
  tables?: ExtractedTableData[];
  rawTextContext?: { pageNumber: number; snippet: string }[];
}): CleanAiValidationHandoffPackage {
  if (!params.documentId || params.documentId.trim() === "") {
    throw new Error("Cannot build AI validation handoff package: documentId is required.");
  }
  if (!params.determinantCandidates || params.determinantCandidates.length === 0) {
    throw new Error(
      "Cannot build AI validation handoff package: determinant candidates are required.",
    );
  }

  // Validate that every candidate has provenance evidence attached
  for (const candidate of params.determinantCandidates) {
    if (!candidate.provenance || !candidate.provenance.extractionMethod) {
      throw new Error(
        `Determinant candidate '${candidate.fieldKey}' is missing mandatory provenance evidence.`,
      );
    }
  }

  // Pre-seed the deterministic checklist constraints that the AI validation layer must check
  const validationChecklist: CleanAiValidationHandoffPackage["validationChecklist"] = [
    {
      checkKey: "CHECK_ACCOUNT_NUMBER_FORMAT",
      description: "Verify account number matches expected Eskom/Municipal 10-digit format.",
      mandatory: true,
      expectedDataType: "string",
    },
    {
      checkKey: "CHECK_INVOICE_DATE_CHRONOLOGY",
      description: "Verify invoice date falls within valid billing period boundaries.",
      mandatory: true,
      expectedDataType: "date",
    },
    {
      checkKey: "CHECK_TOTAL_ARITHMETIC_INTEGRITY",
      description: "Verify subtotal + VAT matches total payable within R 0.01 tolerance.",
      mandatory: true,
      expectedDataType: "currency",
    },
    {
      checkKey: "CHECK_METER_CONSUMPTION_INTEGRITY",
      description: "Verify (Current Reading - Previous Reading) * Multiplying Factor matches Total kWh.",
      mandatory: true,
      expectedDataType: "number",
    },
  ];

  return {
    packageId: `ai-val-pkg-${params.documentId}-${Date.now()}`,
    documentId: params.documentId,
    organisationId: params.organisationId,
    checksum: params.checksum,
    documentClassification: params.documentClassification || "ESKOM_MEGAFLEX_INVOICE",
    generatedAt: new Date().toISOString(),
    determinantCandidates: params.determinantCandidates,
    tables: params.tables || [],
    rawTextContext: params.rawTextContext || [],
    validationChecklist,
    state: "READY_FOR_AI_VALIDATION",
  };
}

/**
 * Creates an immutable pipeline execution record for auditability
 */
export function createPipelineStepExecutionRecord(params: {
  documentId: string;
  organisationId: string;
  stage: PipelineStage;
  previousStage?: PipelineStage;
  status: PipelineStageStatus;
  startedAt?: string;
  completedAt?: string;
  inputPackageHash?: string;
  outputArtifactHash?: string;
  errorDetails?: { errorCode: string; errorMessage: string } | null;
}): PipelineStepExecutionRecord {
  const startedAt = params.startedAt || new Date().toISOString();
  let durationMs: number | undefined;

  if (params.completedAt) {
    durationMs = Math.max(0, new Date(params.completedAt).getTime() - new Date(startedAt).getTime());
  }

  const stageIndex = PIPELINE_STAGE_SEQUENCE.indexOf(params.stage);
  const nextStage =
    stageIndex >= 0 && stageIndex < PIPELINE_STAGE_SEQUENCE.length - 1
      ? PIPELINE_STAGE_SEQUENCE[stageIndex + 1]
      : undefined;

  return {
    stepId: `pipe-step-${params.stage.toLowerCase()}-${Date.now()}`,
    documentId: params.documentId,
    organisationId: params.organisationId,
    stage: params.stage,
    previousStage: params.previousStage,
    nextStage,
    status: params.status,
    startedAt,
    completedAt: params.completedAt,
    durationMs,
    inputPackageHash: params.inputPackageHash,
    outputArtifactHash: params.outputArtifactHash,
    errorDetails: params.errorDetails || null,
  };
}
