/**
 * ENERA PRODUCTION OCR ENGINE — FIELD EVIDENCE MODEL (Requirement 21)
 * ====================================================================
 * Guarantees that every extracted field is strictly traceable to OCR evidence:
 *
 *   Field:          Account Number
 *   Value:          123456789
 *   Document:       document-001
 *   Page:           1
 *   OCR:            true
 *   Source Text:    123456789
 *   Bounding Box:   x/y/w/h ([x, y, width, height])
 *   Confidence:     98%
 *   Processing Run: ocr-run-001
 *
 * Provides bidirectional translation between OCR determinant fields,
 * authoritative OcrFieldEvidence records, and Document Intelligence ProvenancedFields.
 */

import type {
  OcrFieldEvidence,
  OcrDeterminantField,
  OcrBoundingBox,
  CoordinateSystem,
  OcrElementBoundingBox,
  OcrConfidenceTier,
  OcrExtractedInvoiceDeterminants,
  OcrExtractedStatementDeterminants,
  OcrExtractedCreditNoteDeterminants,
  OcrExtractedAdjustmentDeterminants,
  OcrExtractedTariffDeterminants,
  OcrExtractedMeterDeterminants,
} from "./types";
import { ProvenanceGuard } from "../intelligence/provenanceGuard";
import type { ProvenancedField, BoundingBox } from "../intelligence/types";

export interface CreateFieldEvidenceParams<T = string | number | null> {
  field: string;
  fieldKey?: string;
  fieldLabel?: string;
  value: T;
  rawValue?: string;
  document: string;
  page: number;
  ocr: boolean;
  sourceText: string;
  boundingBox: OcrBoundingBox;
  confidence: number;
  confidenceTier?: OcrConfidenceTier;
  processingRun: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  coordinateSystem?: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;
  extractionMethod?: string;
}

export class OcrEvidenceModel {
  /**
   * Creates an authoritative OcrFieldEvidence record conforming strictly to Requirement 21.
   */
  public static createFieldEvidence<T = string | number | null>(
    params: CreateFieldEvidenceParams<T>,
  ): OcrFieldEvidence<T> {
    const rawValue =
      params.rawValue !== undefined
        ? params.rawValue
        : params.value !== null && params.value !== undefined
          ? String(params.value)
          : "";

    const x = params.x ?? params.boundingBox[0] ?? 0;
    const y = params.y ?? params.boundingBox[1] ?? 0;
    const width = params.width ?? params.boundingBox[2] ?? 0;
    const height = params.height ?? params.boundingBox[3] ?? 0;
    const coordinateSystem: CoordinateSystem = params.coordinateSystem || "NORMALIZED_0_1";

    const detailedBoundingBox: OcrElementBoundingBox = params.detailedBoundingBox || {
      pageNumber: params.page,
      x,
      y,
      width,
      height,
      coordinateSystem,
      confidence: params.confidence > 1 ? Number((params.confidence / 100).toFixed(4)) : params.confidence,
    };

    const confidenceTier: OcrConfidenceTier =
      params.confidenceTier ||
      (params.confidence >= 85 ? "HIGH" : params.confidence >= 70 ? "MEDIUM" : "LOW");

    const fieldKey =
      params.fieldKey ||
      OcrEvidenceModel.toCamelCase(params.field);

    return {
      field: params.field,
      fieldKey,
      fieldLabel: params.fieldLabel || params.field,
      value: params.value,
      rawValue,
      document: params.document,
      documentId: params.document,
      page: Math.max(1, params.page),
      pageNumber: Math.max(1, params.page),
      ocr: params.ocr,
      isOcr: params.ocr,
      sourceText: params.sourceText || rawValue,
      boundingBox: [
        Number(params.boundingBox[0].toFixed(4)),
        Number(params.boundingBox[1].toFixed(4)),
        Number(params.boundingBox[2].toFixed(4)),
        Number(params.boundingBox[3].toFixed(4)),
      ],
      x,
      y,
      width,
      height,
      coordinateSystem,
      detailedBoundingBox,
      confidence: params.confidence,
      confidenceScore: params.confidence,
      confidenceTier,
      processingRun: params.processingRun,
      ocrRunId: params.processingRun,
      extractionMethod: params.extractionMethod || (params.ocr ? "OCR_TESSERACT" : "DIGITAL_STREAM_HYBRID"),
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Converts an OcrDeterminantField into an authoritative OcrFieldEvidence record.
   */
  public static fromDeterminantField<T = string | number | null>(
    field: OcrDeterminantField<T>,
    documentId: string,
    processingRunId: string = "ocr-run-default",
    defaultIsOcr: boolean = true,
  ): OcrFieldEvidence<T> {
    const prov = field.provenance;
    const doc = prov.documentId || documentId;
    const pageNum = Math.max(1, prov.pageNumber || 1);
    const runId = prov.processingRun || prov.ocrRunId || processingRunId;
    const isOcr =
      prov.ocr !== undefined
        ? prov.ocr
        : prov.isOcr !== undefined
          ? prov.isOcr
          : prov.extractionMethod !== "DIGITAL_STREAM_HYBRID"
            ? defaultIsOcr
            : false;

    const bbox: OcrBoundingBox = prov.boundingBox || [0, 0, 0, 0];
    const sourceText = prov.sourceText || prov.contextSnippet || field.rawValue || String(field.value ?? "");

    return this.createFieldEvidence<T>({
      field: field.fieldLabel || field.fieldKey,
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      value: field.value,
      rawValue: field.rawValue,
      document: doc,
      page: pageNum,
      ocr: isOcr,
      sourceText,
      boundingBox: bbox,
      x: prov.x,
      y: prov.y,
      width: prov.width,
      height: prov.height,
      coordinateSystem: prov.coordinateSystem,
      detailedBoundingBox: prov.detailedBoundingBox,
      confidence: prov.confidenceScore,
      confidenceTier: prov.confidenceTier,
      processingRun: runId,
      extractionMethod: prov.extractionMethod,
    });
  }

  /**
   * Compiles an entire dictionary of authoritative OcrFieldEvidence records
   * from any determinant object (Invoice, Statement, Credit Note, etc.).
   */
  public static compileEvidencePackage(
    determinants:
      | OcrExtractedInvoiceDeterminants
      | OcrExtractedStatementDeterminants
      | OcrExtractedCreditNoteDeterminants
      | OcrExtractedAdjustmentDeterminants
      | OcrExtractedTariffDeterminants
      | OcrExtractedMeterDeterminants
      | Record<string, any>,
    documentId: string,
    processingRunId: string = "ocr-run-default",
    defaultIsOcr: boolean = true,
  ): Record<string, OcrFieldEvidence> {
    const evidenceMap: Record<string, OcrFieldEvidence> = {};
    if (!determinants) return evidenceMap;

    for (const [key, prop] of Object.entries(determinants)) {
      if (key === "lineItems" || key === "statementItems" || key === "rates") {
        // Line items with individual provenance
        if (Array.isArray(prop)) {
          prop.forEach((item: any, idx: number) => {
            if (item && item.provenance) {
              const itemKey = `${key}[${idx}]`;
              const itemLabel = item.lineDescription || item.description || item.chargeCategory || `${key} Item ${idx + 1}`;
              const val = item.amount !== undefined ? item.amount : item.balance !== undefined ? item.balance : item.rateCentsPerKwh;
              const sourceText = item.provenance.sourceText || item.provenance.contextSnippet || item.lineDescription || String(val ?? "");
              evidenceMap[itemKey] = this.createFieldEvidence({
                field: itemLabel,
                fieldKey: itemKey,
                fieldLabel: itemLabel,
                value: val,
                rawValue: String(val ?? ""),
                document: item.provenance.documentId || documentId,
                page: Math.max(1, item.provenance.pageNumber || 1),
                ocr: item.provenance.ocr ?? defaultIsOcr,
                sourceText,
                boundingBox: item.provenance.boundingBox || [0, 0, 0, 0],
                x: item.provenance.x,
                y: item.provenance.y,
                width: item.provenance.width,
                height: item.provenance.height,
                coordinateSystem: item.provenance.coordinateSystem,
                detailedBoundingBox: item.provenance.detailedBoundingBox,
                confidence: item.provenance.confidenceScore || 90,
                confidenceTier: item.provenance.confidenceTier,
                processingRun: item.provenance.processingRun || item.provenance.ocrRunId || processingRunId,
                extractionMethod: item.provenance.extractionMethod,
              });
            }
          });
        }
        continue;
      }

      if (
        prop &&
        typeof prop === "object" &&
        "provenance" in prop &&
        "fieldKey" in prop
      ) {
        const detField = prop as OcrDeterminantField<any>;
        if (detField.value !== null && detField.value !== undefined && detField.provenance.hasExactBoundingBox) {
          evidenceMap[detField.fieldKey] = this.fromDeterminantField(
            detField,
            documentId,
            processingRunId,
            defaultIsOcr,
          );
        }
      }
    }

    return evidenceMap;
  }

  /**
   * Validates whether an OcrFieldEvidence record satisfies all strict Requirement 21 constraints.
   */
  public static validateFieldEvidence(evidence: OcrFieldEvidence<any>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!evidence.field || evidence.field.trim() === "") {
      errors.push("Missing required field name");
    }
    if (!evidence.document || evidence.document.trim() === "") {
      errors.push("Missing required document identifier");
    }
    if (typeof evidence.page !== "number" || evidence.page < 1) {
      errors.push(`Invalid page number: ${evidence.page}`);
    }
    if (typeof evidence.ocr !== "boolean") {
      errors.push("Missing or invalid OCR boolean flag");
    }
    if (!evidence.sourceText || evidence.sourceText.trim() === "") {
      warnings.push("Source text is empty or whitespace-only");
    }
    if (
      !evidence.boundingBox ||
      !Array.isArray(evidence.boundingBox) ||
      evidence.boundingBox.length !== 4
    ) {
      errors.push("Bounding box must be a 4-element array [x, y, width, height]");
    }
    if (typeof evidence.confidence !== "number" || evidence.confidence < 0 || evidence.confidence > 100) {
      errors.push(`Confidence score out of bounds (0-100): ${evidence.confidence}`);
    }
    if (!evidence.processingRun || evidence.processingRun.trim() === "") {
      errors.push("Missing mandatory processingRun ID");
    }

    return {
      valid: errors.length === 0,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Converts an OcrFieldEvidence record to a canonical Document Intelligence ProvenancedField.
   */
  public static toProvenancedField<T = string | number | null>(
    evidence: OcrFieldEvidence<T>,
  ): ProvenancedField<T> {
    const region: BoundingBox = evidence.boundingBox
      ? [evidence.boundingBox[0], evidence.boundingBox[1], evidence.boundingBox[2], evidence.boundingBox[3]]
      : [0, 0, 0, 0];

    const confScore =
      evidence.confidence > 1
        ? Number((evidence.confidence / 100).toFixed(4))
        : evidence.confidence;

    return ProvenanceGuard.createProvenancedField({
      fieldKey: evidence.fieldKey || evidence.field,
      fieldLabel: evidence.fieldLabel || evidence.field,
      value: evidence.value,
      rawValue: evidence.rawValue || String(evidence.value ?? ""),
      documentId: evidence.document,
      pageNumber: Math.max(1, evidence.page),
      region,
      regionText: evidence.sourceText || evidence.rawValue || String(evidence.value ?? ""),
      contextSnippet: evidence.sourceText,
      extractionMethod: evidence.ocr ? "TESSERACT_OCR" : "PDF_TEXT_STREAM",
      confidenceScore: Math.min(1.0, Math.max(0.0, confScore)),
      confidenceLevel: evidence.confidenceTier || (evidence.confidence >= 85 ? "HIGH" : evidence.confidence >= 70 ? "MEDIUM" : "LOW"),
      coordinateSystem: evidence.coordinateSystem,
      detailedBoundingBox: evidence.detailedBoundingBox
        ? {
            pageNumber: evidence.detailedBoundingBox.pageNumber,
            x: evidence.detailedBoundingBox.x,
            y: evidence.detailedBoundingBox.y,
            width: evidence.detailedBoundingBox.width,
            height: evidence.detailedBoundingBox.height,
            coordinateSystem: evidence.detailedBoundingBox.coordinateSystem,
            confidence: evidence.detailedBoundingBox.confidence,
          }
        : undefined,
      runId: evidence.processingRun,
    });
  }

  /**
   * Converts a canonical Document Intelligence ProvenancedField back into an authoritative OcrFieldEvidence record.
   */
  public static fromProvenancedField<T = string | number | null>(
    field: ProvenancedField<T>,
    fallbackFieldLabel?: string,
  ): OcrFieldEvidence<T> {
    const prov = field.provenance;
    const isOcr =
      prov?.extractionMethod === "OCR_RECONSTRUCTED" ||
      prov?.extractionMethod === "OCR_LAYOUT_TABLE" ||
      prov?.extractionMethod === "OCR_KEY_VALUE" ||
      field.extraction?.includes("OCR") ||
      true;

    const rawConfidence =
      prov?.confidenceScore !== undefined
        ? prov.confidenceScore <= 1.0
          ? Math.round(prov.confidenceScore * 100)
          : prov.confidenceScore
        : 85;

    const bbox: OcrBoundingBox = prov?.region
      ? [prov.region[0], prov.region[1], prov.region[2], prov.region[3]]
      : [0, 0, 0, 0];

    return this.createFieldEvidence<T>({
      field: field.fieldLabel || fallbackFieldLabel || field.fieldKey,
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel || fallbackFieldLabel || field.fieldKey,
      value: field.value,
      rawValue: field.rawValue,
      document: prov?.documentId || field.document || "unknown-document",
      page: prov?.pageNumber || field.page || 1,
      ocr: isOcr,
      sourceText: prov?.contextSnippet || prov?.regionText || field.rawValue || String(field.value ?? ""),
      boundingBox: bbox,
      confidence: rawConfidence,
      confidenceTier: (field.confidence as OcrConfidenceTier) || "HIGH",
      processingRun: field.runId || prov?.runId || "ocr-run-default",
      extractionMethod: prov?.extractionMethod || field.extraction || "OCR_TESSERACT",
    });
  }

  /**
   * Helper to convert human-readable labels to camelCase fieldKeys.
   */
  public static toCamelCase(str: string): string {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, (chr) => chr.toLowerCase())
      .trim();
  }

  /**
   * Human-readable and structured diagnostic trace of evidence grounding.
   */
  public static traceEvidence(evidence: OcrFieldEvidence<any>): {
    question: string;
    found: boolean;
    isGrounded: boolean;
    field: string;
    fieldKey: string;
    fieldLabel: string;
    value: any;
    document: string;
    page: number;
    ocr: boolean;
    sourceText: string;
    boundingBox: OcrBoundingBox;
    confidence: number;
    confidenceTier: OcrConfidenceTier;
    processingRun: string;
    explanation: string;
    evidenceChain: string;
    toString: () => string;
  } {
    const bb = evidence.boundingBox;
    const isGrounded =
      evidence.page > 0 &&
      evidence.document.length > 0 &&
      evidence.confidence > 0 &&
      bb.length === 4;

    const coordStr = `[x=${bb[0]}, y=${bb[1]}, w=${bb[2]}, h=${bb[3]}]`;
    const evidenceChain = isGrounded
      ? `Document ${evidence.document} -> Page ${evidence.page} -> BoundingBox ${coordStr} -> SourceText '${evidence.sourceText}' -> Run ${evidence.processingRun} -> Confidence ${evidence.confidence}% (${evidence.confidenceTier})`
      : `Document ${evidence.document} -> Unobserved / Not Grounded`;

    const explanation = isGrounded
      ? `Field '${evidence.field}' (${evidence.value}) was extracted from document '${evidence.document}', page ${evidence.page} at bounding box ${coordStr} with ${evidence.confidence}% confidence via processing run '${evidence.processingRun}'. Source text: '${evidence.sourceText}'.`
      : `Field '${evidence.field}' was not grounded or observed in document '${evidence.document}'.`;

    return {
      question: "Where exactly did this extracted field come from?",
      found: isGrounded,
      isGrounded,
      field: evidence.field,
      fieldKey: evidence.fieldKey,
      fieldLabel: evidence.fieldLabel,
      value: evidence.value,
      document: evidence.document,
      page: evidence.page,
      ocr: evidence.ocr,
      sourceText: evidence.sourceText,
      boundingBox: bb,
      confidence: evidence.confidence,
      confidenceTier: evidence.confidenceTier,
      processingRun: evidence.processingRun,
      explanation,
      evidenceChain,
      toString: () => explanation,
    };
  }
}
