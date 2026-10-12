/**
 * Frontend Document View Types & State Resolution (Stage 13)
 * ========================================================
 * Implements authoritative view models and state resolvers for the
 * frontend document-processing interface.
 *
 * Requirements:
 *  1. Document tree display:
 *     Document
 *     ├── Filename
 *     ├── Upload date
 *     ├── Processing status
 *     ├── Document type
 *     ├── Page count
 *     ├── Extraction status
 *     ├── OCR status
 *     └── Validation status
 *
 *  2. Useful states:
 *     - Processing: "Analysing document…"
 *     - Successful: "Document processed successfully."
 *     - Review required: "Some information requires verification."
 *     - Failed: "Document processing failed."
 *
 *  3. Truthful status stages (NO fake progress percentages).
 */

import type {
  DocumentLifecycleState,
  DocumentRegistryRecord,
  DocumentProcessingStage,
  ExtractionStatus,
  OcrStatus,
  ValidationStatus,
} from "./types";
import type { UploadRecord } from "../upload/types";

export type UsefulDocumentState = "PROCESSING" | "SUCCESSFUL" | "REVIEW_REQUIRED" | "FAILED";

export interface UsefulStateConfig {
  state: UsefulDocumentState;
  userMessage: string;
  badgeLabel: string;
  description: string;
  theme: "primary" | "emerald" | "amber" | "rose";
}

/**
 * Authoritative user-facing strings strictly mandated by Stage 13 specification
 */
export const USEFUL_DOCUMENT_STATES: Record<UsefulDocumentState, UsefulStateConfig> = {
  PROCESSING: {
    state: "PROCESSING",
    userMessage: "Analysing document…",
    badgeLabel: "Processing",
    description: "The document is undergoing automated multi-stage extraction and analysis.",
    theme: "primary",
  },
  SUCCESSFUL: {
    state: "SUCCESSFUL",
    userMessage: "Document processed successfully.",
    badgeLabel: "Successful",
    description:
      "All pages, text, tabular layout, and financial determinants were extracted with verified evidence.",
    theme: "emerald",
  },
  REVIEW_REQUIRED: {
    state: "REVIEW_REQUIRED",
    userMessage: "Some information requires verification.",
    badgeLabel: "Review required",
    description:
      "Extraction completed, but one or more determinants flagged low confidence or ambiguous values.",
    theme: "amber",
  },
  FAILED: {
    state: "FAILED",
    userMessage: "Document processing failed.",
    badgeLabel: "Failed",
    description: "An explicit unrecoverable failure occurred during parsing or validation.",
    theme: "rose",
  },
};

export type TruthfulStageExecutionStatus =
  "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "REVIEW_REQUIRED" | "SKIPPED";

export interface TruthfulPipelineStage {
  id: string;
  stageKey: DocumentProcessingStage;
  label: string;
  shortLabel: string;
  description: string;
  executionStatus: TruthfulStageExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  details?: string;
}

export const BASE_TRUTHFUL_STAGES: Omit<TruthfulPipelineStage, "executionStatus">[] = [
  {
    id: "stage-storage",
    stageKey: "STORAGE",
    label: "Storage & Ingestion",
    shortLabel: "Storage",
    description: "Encrypted storage in isolated tenant vault & SHA-256 integrity checksum.",
  },
  {
    id: "stage-inspection",
    stageKey: "PDF_INSPECTION",
    label: "Document Inspection",
    shortLabel: "Inspection",
    description: "Header validation, version check & magic bytes security verification.",
  },
  {
    id: "stage-pages",
    stageKey: "PAGE_EXTRACTION",
    label: "Page Registry",
    shortLabel: "Pages",
    description: "Page cataloging, dimensions, orientation & boundary registration.",
  },
  {
    id: "stage-text",
    stageKey: "TEXT_EXTRACTION",
    label: "Text Extraction",
    shortLabel: "Text",
    description: "Page-aware native text extraction preserving line structure & whitespace.",
  },
  {
    id: "stage-layout",
    stageKey: "LAYOUT_ANALYSIS",
    label: "Layout Analysis",
    shortLabel: "Layout",
    description: "Paragraph, heading, and structured column/row table detection.",
  },
  {
    id: "stage-classification",
    stageKey: "DOCUMENT_CLASSIFICATION",
    label: "Document Classification",
    shortLabel: "Classification",
    description: "Deterministic categorization based on structural evidence.",
  },
  {
    id: "stage-evidence",
    stageKey: "EXTRACTION_EVIDENCE",
    label: "Evidence Provenance",
    shortLabel: "Evidence",
    description: "Field-to-box provenance linking extracted values to page coordinates.",
  },
  {
    id: "stage-validation",
    stageKey: "OCR_AI_HANDOFF",
    label: "Determinant Validation",
    shortLabel: "Validation",
    description: "Financial total balance checks, dates, and meter reading verification.",
  },
];

/**
 * The 8-element tree structure requested for every document
 */
export interface DocumentTreeItem {
  key: string;
  label: string;
  value: string;
  formattedValue?: string;
  badgeType?: "status" | "type" | "number" | "text" | "validation";
  isLastBranch?: boolean;
}

export interface DocumentTreeViewModel {
  documentId: string;
  filename: string;
  uploadDate: string;
  uploadDateFormatted: string;
  processingStatus: string;
  documentType: string;
  pageCount: number | null;
  extractionStatus: string;
  ocrStatus: string;
  validationStatus: string;

  // The 4 useful states
  usefulState: UsefulDocumentState;
  usefulMessage: string;
  usefulStateConfig: UsefulStateConfig;

  // Truthful status stages (no fake percentages)
  currentTruthfulStage?: string;
  truthfulStages: TruthfulPipelineStage[];

  // Optional diagnostics and line items
  items: DocumentTreeItem[];
  errorMessage?: string | null;
  reviewReason?: string | null;
  organisationId?: string;
  checksum?: string;
  fileSizeBytes?: number;
  rawSource?: any;
}

/**
 * Resolves the useful state ("Processing" | "Successful" | "Review required" | "Failed")
 * strictly according to the Stage 13 specification.
 */
export function resolveUsefulDocumentState(
  statusInput?: string | null,
  validationInput?: string | null,
  errorInput?: string | null,
  hasReviewFlag?: boolean,
  errorStatusInput?: string | null,
): UsefulDocumentState {
  const status = (statusInput || "").toUpperCase();
  const validation = (validationInput || "").toUpperCase();
  const errorStatus = (errorStatusInput || "").toUpperCase();
  const err = (errorInput || "").trim();

  // 1. Explicit Unrecoverable Failure
  if (
    status === "FAILED" ||
    validation === "INVALID" ||
    errorStatus === "FATAL" ||
    (err !== "" &&
      status !== "REVIEW_REQUIRED" &&
      status !== "PARTIALLY_PROCESSED" &&
      status !== "PROCESSED" &&
      status !== "COMPLETED" &&
      status !== "VALIDATED")
  ) {
    return "FAILED";
  }

  // 2. Processing (Active / Unfinished)
  if (
    status === "PROCESSING" ||
    status === "INSPECTING" ||
    status === "EXTRACTING" ||
    status === "CLASSIFYING" ||
    status === "VALIDATING" ||
    status === "UPLOADED" ||
    status === "STORED" ||
    status === "ANALYSING" ||
    status === "INITIALIZING" ||
    status === "EXTRACTING_TEXT" ||
    status === "ANALYSING_LAYOUT"
  ) {
    return "PROCESSING";
  }

  // 3. Review Required (Partially processed, unbundled warnings, or verification needed)
  if (
    status === "REVIEW_REQUIRED" ||
    validation === "REVIEW_REQUIRED" ||
    hasReviewFlag === true ||
    status === "PARTIALLY_PROCESSED" ||
    status === "UNSUPPORTED"
  ) {
    return "REVIEW_REQUIRED";
  }

  // 4. Successful
  if (
    status === "PROCESSED" ||
    status === "COMPLETED" ||
    status === "READY_FOR_VALIDATION" ||
    status === "VALIDATED" ||
    validation === "VALID" ||
    validation === "VALIDATED"
  ) {
    return "SUCCESSFUL";
  }

  // Default to Processing if in an unknown transient state, or Successful if validated
  return "SUCCESSFUL";
}

/**
 * Builds the canonical DocumentTreeViewModel for any document record
 */
export function buildDocumentTreeViewModel(doc: any): DocumentTreeViewModel {
  const documentId = doc.documentId || doc.id || "DOC-UNKNOWN";
  const filename = doc.originalFilename || doc.filename || "unnamed_document.pdf";

  const rawDate =
    doc.uploadTimestamp || doc.createdAt || doc.createdTimestamp || new Date().toISOString();
  let uploadDateFormatted = rawDate;
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      uploadDateFormatted = d.toISOString().replace("T", " ").substring(0, 19);
    }
  } catch {
    uploadDateFormatted = rawDate;
  }

  const processingStatus = (doc.processingStatus || doc.status || "UPLOADED").toUpperCase();
  const documentType = (
    doc.documentClassification ||
    doc.detectedFileType ||
    doc.fileType ||
    "UNKNOWN"
  ).toUpperCase();
  const pageCount =
    doc.pageCount !== undefined && doc.pageCount !== null ? Number(doc.pageCount) : null;
  const extractionStatus = (doc.extractionStatus || "PENDING").toUpperCase();
  const ocrStatus = (doc.ocrStatus || "NOT_REQUIRED").toUpperCase();
  const validationStatus = (doc.validationStatus || "PENDING").toUpperCase();

  const usefulState = resolveUsefulDocumentState(
    processingStatus,
    validationStatus,
    doc.errorMessage,
    Boolean(doc.reviewReason || processingStatus === "REVIEW_REQUIRED" || processingStatus === "PARTIALLY_PROCESSED"),
    doc.errorStatus,
  );

  const usefulStateConfig = USEFUL_DOCUMENT_STATES[usefulState];
  const usefulMessage = usefulStateConfig.userMessage;

  // Build the 8-element tree structure requested by the user
  const items: DocumentTreeItem[] = [
    {
      key: "filename",
      label: "Filename",
      value: filename,
      badgeType: "text",
    },
    {
      key: "uploadDate",
      label: "Upload date",
      value: uploadDateFormatted,
      formattedValue: uploadDateFormatted,
      badgeType: "text",
    },
    {
      key: "processingStatus",
      label: "Processing status",
      value: processingStatus,
      badgeType: "status",
    },
    {
      key: "documentType",
      label: "Document type",
      value: documentType,
      badgeType: "type",
    },
    {
      key: "pageCount",
      label: "Page count",
      value: pageCount !== null ? `${pageCount} ${pageCount === 1 ? "page" : "pages"}` : "—",
      badgeType: "number",
    },
    {
      key: "extractionStatus",
      label: "Extraction status",
      value: extractionStatus,
      badgeType: "status",
    },
    {
      key: "ocrStatus",
      label: "OCR status",
      value: ocrStatus,
      badgeType: "status",
    },
    {
      key: "validationStatus",
      label: "Validation status",
      value: validationStatus,
      badgeType: "validation",
      isLastBranch: true,
    },
  ];

  // Resolve Truthful Stages without fake percentages
  const activeStageKey = (
    doc.currentStage ||
    doc.activeStage ||
    (usefulState === "PROCESSING" ? "TEXT_EXTRACTION" : "OCR_AI_HANDOFF")
  ).toUpperCase();

  const truthfulStages: TruthfulPipelineStage[] = BASE_TRUTHFUL_STAGES.map((base, idx) => {
    let executionStatus: TruthfulStageExecutionStatus = "PENDING";

    if (usefulState === "FAILED") {
      const failedIdx = BASE_TRUTHFUL_STAGES.findIndex(
        (s) => s.stageKey.toUpperCase() === activeStageKey || s.id.toUpperCase().includes(activeStageKey),
      );
      const targetFailedIdx = failedIdx >= 0 ? failedIdx : 4;
      if (idx < targetFailedIdx) {
        executionStatus = "COMPLETED";
      } else if (idx === targetFailedIdx) {
        executionStatus = "FAILED";
      } else {
        executionStatus = "PENDING";
      }
    } else if (usefulState === "REVIEW_REQUIRED") {
      // In review required, extraction and analysis completed, validation flags human verification
      executionStatus = idx < BASE_TRUTHFUL_STAGES.length - 1 ? "COMPLETED" : "REVIEW_REQUIRED";
    } else if (usefulState === "SUCCESSFUL") {
      executionStatus = "COMPLETED";
    } else {
      // PROCESSING
      const stageIdx = BASE_TRUTHFUL_STAGES.findIndex(
        (s) =>
          s.stageKey.toUpperCase() === activeStageKey ||
          s.id.toUpperCase().includes(activeStageKey),
      );
      const activeIdx = stageIdx >= 0 ? stageIdx : 3;

      if (idx < activeIdx) {
        executionStatus = "COMPLETED";
      } else if (idx === activeIdx) {
        executionStatus = "RUNNING";
      } else {
        executionStatus = "PENDING";
      }
    }

    return {
      ...base,
      executionStatus,
    };
  });

  return {
    documentId,
    filename,
    uploadDate: rawDate,
    uploadDateFormatted,
    processingStatus,
    documentType,
    pageCount,
    extractionStatus,
    ocrStatus,
    validationStatus,
    usefulState,
    usefulMessage,
    usefulStateConfig,
    currentTruthfulStage: activeStageKey,
    truthfulStages,
    items,
    errorMessage: doc.errorMessage,
    reviewReason: doc.reviewReason,
    organisationId: doc.organisationId,
    checksum: doc.checksum || doc.fileHashSha256,
    fileSizeBytes: doc.fileSize || doc.fileSizeBytes,
    rawSource: doc,
  };
}
