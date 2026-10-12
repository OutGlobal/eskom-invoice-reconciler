/**
 * ENERA PIPELINE LAYER BOUNDARIES & SEPARATION OF CONCERNS (REQUIREMENT 33)
 * =========================================================================
 * Formally defines and guards the distinct architectural responsibilities:
 *
 * 1. OCR:
 *    "What characters appear on the page?"
 *    - Spatial character/token recognition, bounding boxes, line baseline clustering,
 *      raw optical confidence.
 *    - Never hallucinates or infers missing data based on assumptions.
 *
 * 2. Document Intelligence:
 *    "What is the structure of the document?"
 *    - Layout blocks (headings, paragraphs, tables, footers, sections), key-value pairs,
 *      column grid alignment, document classification.
 *    - Organizes raw character tokens into structural document representations.
 *
 * 3. AI Validation:
 *    "Does the extracted information make sense and agree with the available evidence?"
 *    - Semantic consistency, anomaly detection, Tariff/NERSA compliance cross-referencing
 *      against grounded OCR evidence.
 *    - Never replaces the OCR engine or invents ungrounded tokens.
 *
 * 4. Reconciliation:
 *    "What does the validated information mean financially?"
 *    - Financial variance calculation, overbilling/underbilling dispute quantification,
 *      tariff rate schedule math, general ledger settlement.
 *
 * MANDATE: Do NOT collapse these layers into one AI function.
 */

export type PipelineLayerType =
  "OCR" | "DOCUMENT_INTELLIGENCE" | "AI_VALIDATION" | "RECONCILIATION";

export interface LayerResponsibilityDefinition {
  layer: PipelineLayerType;
  primaryQuestion: string;
  coreResponsibilities: string[];
  strictProhibitions: string[];
  inputContract: string;
  outputContract: string;
}

export const PIPELINE_LAYER_DEFINITIONS: Record<PipelineLayerType, LayerResponsibilityDefinition> =
  {
    OCR: {
      layer: "OCR",
      primaryQuestion: "What characters appear on the page?",
      coreResponsibilities: [
        "Image preprocessing (grayscale, contrast, Otsu binarization, deskew)",
        "Character and token recognition via Leptonica/Tesseract worker pool",
        "Exact spatial bounding box coordinate extraction [x, y, w, h]",
        "Token, line, block, and page level confidence calculation",
        "Non-destructive preservation of original raw evidence tokens",
      ],
      strictProhibitions: [
        "Never fabricate missing or unobserved fields",
        "Never execute semantic business logic or financial calculations",
        "Never perform LLM hallucination in place of optical recognition",
      ],
      inputContract: "Raw image pixel buffers (PNG/JPEG/TIFF) or 300 DPI rasterized PDF pages",
      outputContract:
        "OcrDocumentResult with spatial word/line bounding boxes and confidence scores",
    },

    DOCUMENT_INTELLIGENCE: {
      layer: "DOCUMENT_INTELLIGENCE",
      primaryQuestion: "What is the structure of the document?",
      coreResponsibilities: [
        "Hierarchical layout analysis (Headings, Paragraphs, Tables, Footers, Sections)",
        "Key-value pair spatial clustering (horizontal and vertical alignment)",
        "Tabular grid and cell matrix reconstruction",
        "Document category classification (Megaflex, Miniflex, Statement, Credit Note, Tariff, Meter)",
        "Grounded evidence registration and provenance tracking",
      ],
      strictProhibitions: [
        "Never alter or mutate raw OCR character tokens",
        "Never compute financial variances or dispute ledger reconciliations",
        "Never bypass spatial geometry during table reconstruction",
      ],
      inputContract: "UnifiedDocumentExtraction (Native PDF tokens OR OCR raster tokens)",
      outputContract:
        "DocumentIntelligencePackage with layout blocks, detected tables, and grounded candidates",
    },

    AI_VALIDATION: {
      layer: "AI_VALIDATION",
      primaryQuestion:
        "Does the extracted information make sense and agree with the available evidence?",
      coreResponsibilities: [
        "Semantic validation of extracted candidate values against document context",
        "Anomaly detection and preliminary discrepancy identification",
        "Tariff code and rate schedule verification against grounded OCR tokens",
        "Verification of human review adjustments against immutable audit evidence",
      ],
      strictProhibitions: [
        "Must NOT become the OCR engine (no raw token guessing without optical grounding)",
        "Never overwrite original OCR evidence snapshots",
        "Never process ungrounded claims lacking source page and bounding box references",
      ],
      inputContract:
        "AiValidationStructuredPackage with 5-tier evidence hierarchy and deterministic constraints",
      outputContract: "ValidatedEvidencePackage with anomaly flags and compliance scores",
    },

    RECONCILIATION: {
      layer: "RECONCILIATION",
      primaryQuestion: "What does the validated information mean financially?",
      coreResponsibilities: [
        "Deterministic calculation of active energy charges, demand charges, and reactive energy levies",
        "Financial variance calculation between billed invoice amounts and calculated tariff amounts",
        "Overbilling / underbilling dispute quantification down to R 0.01 precision",
        "Generation of formal audit-compliant dispute packs and billing ledger entries",
      ],
      strictProhibitions: [
        "Never alter OCR evidence or candidate extraction fields",
        "Never perform probabilistic token guessing during financial calculations",
      ],
      inputContract:
        "Validated invoices, meter interval telemetry, and authoritative NERSA tariff schedules",
      outputContract:
        "ReconciliationResult with financial variances, dispute packs, and ledger records",
    },
  };

export class PipelineLayerGuard {
  /**
   * Validates that a processing operation respects the strict separation of concerns.
   */
  public static validateLayerSeparation(
    currentLayer: PipelineLayerType,
    operationType: string,
  ): { isCompliant: boolean; reason?: string } {
    const def = PIPELINE_LAYER_DEFINITIONS[currentLayer];
    if (!def) {
      return { isCompliant: false, reason: `Unknown pipeline layer: ${currentLayer}` };
    }

    // Guard against collapsing AI Validation into OCR
    if (currentLayer === "OCR" && operationType.includes("AI_SEMANTIC_GUESSING")) {
      return {
        isCompliant: false,
        reason: "Violation of Rule 33: OCR layer must not perform AI semantic guessing.",
      };
    }

    if (currentLayer === "AI_VALIDATION" && operationType.includes("RAW_CHARACTER_RECOGNITION")) {
      return {
        isCompliant: false,
        reason: "Violation of Rule 33: AI Validation layer must NOT become the OCR engine.",
      };
    }

    if (currentLayer === "RECONCILIATION" && operationType.includes("MUTATE_RAW_OCR_EVIDENCE")) {
      return {
        isCompliant: false,
        reason: "Violation of Rule 33: Reconciliation layer must not mutate raw OCR evidence.",
      };
    }

    return { isCompliant: true };
  }

  /**
   * Retrieves the formal contract for a specific layer.
   */
  public static getLayerContract(layer: PipelineLayerType): LayerResponsibilityDefinition {
    return PIPELINE_LAYER_DEFINITIONS[layer];
  }
}
