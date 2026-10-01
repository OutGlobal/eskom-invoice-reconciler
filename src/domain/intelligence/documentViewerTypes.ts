/**
 * Document Viewer Domain Types (Stage 14)
 * ========================================================
 * Data models for the split Document Viewer interface:
 *
 *  ┌──────────────────────┬─────────────────────────┐
 *  │                      │                         │
 *  │      PDF VIEWER      │   EXTRACTED DATA       │
 *  │                      │                         │
 *  │      PAGE 1          │   FIELD                │
 *  │                      │   VALUE                │
 *  │                      │   CONFIDENCE           │
 *  │                      │   SOURCE               │
 *  │                      │                         │
 *  └──────────────────────┴─────────────────────────┘
 *
 * Requirements:
 *  1. Support clicking an extracted field and identifying its source page/region.
 *  2. If exact bounding-box highlighting is not yet available, establish the data
 *     model for it rather than creating a fake implementation.
 */

import type { BoundingBox, ProvenanceConfidenceTier, ProvenancedField } from "./types";
export type { BoundingBox } from "./types";

export interface FieldSourceProvenance {
  documentId: string;
  pageNumber: number;
  extractionMethod: string;
  contextSnippet?: string;
  sourceDescription: string;

  /**
   * Exact bounding-box availability flag.
   * True only if verified non-zero spatial coordinates exist.
   * Never faked or fabricated.
   */
  hasExactBoundingBox: boolean;

  /**
   * Spatial bounding box coordinates: [minX, minY, width, height]
   * Defined if and only if hasExactBoundingBox is true.
   */
  boundingBox?: BoundingBox;

  /** Text extracted within the bounded region */
  regionText?: string;
}

export interface ViewerExtractedField<T = string | number | null> {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  value: T;
  rawValue: string;
  unit?: string;
  confidence: ProvenanceConfidenceTier;
  confidenceScore?: number;
  source: FieldSourceProvenance;
  category?: "IDENTIFIER" | "FINANCIAL" | "DATE" | "METER" | "ENERGY" | "TARIFF" | "OTHER";
  isVerified?: boolean;
}

export interface ViewerPageRegion {
  regionId: string;
  fieldKey: string;
  fieldLabel: string;
  boundingBox: BoundingBox;
  confidence: ProvenanceConfidenceTier;
  snippet?: string;
}

export interface ViewerDocumentPage {
  pageNumber: number;
  dimensions: {
    width: number;
    height: number;
    aspectRatio: number;
    rotation: number;
  };
  hasText: boolean;
  textSnippet?: string;
  fullText?: string;
  regions: ViewerPageRegion[];
  pageImageUrl?: string;
}

export interface DocumentViewerState {
  documentId: string;
  documentTitle: string;
  filename: string;
  currentPage: number;
  totalPages: number;
  selectedFieldId: string | null;
  selectedFieldKey: string | null;
  highlightedRegion: BoundingBox | null;
  zoomLevel: number;
  searchFilter: string;
  fields: ViewerExtractedField[];
  pages: ViewerDocumentPage[];
}

/**
 * Checks whether a bounding box contains verified non-zero spatial coordinates.
 * Prevents fake [0,0,0,0] or inverted dimensions from being treated as real highlighting.
 */
export function hasValidBoundingBox(bbox?: BoundingBox | null): bbox is BoundingBox {
  if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) {
    return false;
  }
  const [x, y, w, h] = bbox;
  return (
    typeof x === "number" &&
    typeof y === "number" &&
    typeof w === "number" &&
    typeof h === "number" &&
    !isNaN(x) &&
    !isNaN(y) &&
    !isNaN(w) &&
    !isNaN(h) &&
    w > 0 &&
    h > 0
  );
}

/**
 * Transforms an array or map of ProvenancedFields into canonical ViewerExtractedFields.
 * Strictly respects truthfulness: if a field lacks exact bounding box coordinates,
 * hasExactBoundingBox is set to false without inventing numbers.
 */
export function buildViewerExtractedFields(
  fields: Record<string, ProvenancedField> | ProvenancedField[],
): ViewerExtractedField[] {
  const list = Array.isArray(fields) ? fields : Object.values(fields);

  return list.map((field) => {
    const rawBbox = field.provenance?.region;
    const isValidBox = hasValidBoundingBox(rawBbox);

    const extractionMethod =
      field.extraction || field.provenance?.extractionMethodLabel || "Native PDF text";
    const pageNum = field.page || field.provenance?.pageNumber || 1;
    const docId = field.document || field.provenance?.documentId || "DOC-001";

    const sourceDescription = `Page ${pageNum} • ${extractionMethod}`;

    const source: FieldSourceProvenance = {
      documentId: docId,
      pageNumber: pageNum,
      extractionMethod,
      contextSnippet: field.provenance?.contextSnippet,
      sourceDescription,
      hasExactBoundingBox: isValidBox,
      boundingBox: isValidBox ? rawBbox : undefined,
      regionText: field.provenance?.regionText,
    };

    // Classify field category
    let category: ViewerExtractedField["category"] = "OTHER";
    const k = field.fieldKey.toLowerCase();
    if (
      k.includes("account") ||
      k.includes("invoice") ||
      k.includes("serial") ||
      k.includes("meter")
    ) {
      category = "IDENTIFIER";
    } else if (
      k.includes("total") ||
      k.includes("charge") ||
      k.includes("amount") ||
      k.includes("vat")
    ) {
      category = "FINANCIAL";
    } else if (k.includes("date") || k.includes("period")) {
      category = "DATE";
    } else if (
      k.includes("kwh") ||
      k.includes("kva") ||
      k.includes("demand") ||
      k.includes("energy")
    ) {
      category = "ENERGY";
    } else if (k.includes("tariff")) {
      category = "TARIFF";
    }

    return {
      id: `field-${field.fieldKey}`,
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel || field.fieldKey,
      value: field.value,
      rawValue: field.rawValue || String(field.value ?? ""),
      unit: field.unit,
      confidence: field.confidence || "HIGH",
      confidenceScore: field.provenance?.confidenceScore,
      source,
      category,
      isVerified: field.isVerified,
    };
  });
}
