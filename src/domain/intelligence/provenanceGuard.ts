/**
 * Provenance Guard & Document Evidence Model Engine
 * =========================================================================
 * Stage 8 of Document Intelligence Architecture:
 * Ensures every extracted field is strictly traceable through the canonical chain:
 *
 * Document
 *   ↓
 * Page
 *   ↓
 * Region / Text
 *   ↓
 * Extraction Method
 *   ↓
 * Extracted Value
 *   ↓
 * Confidence
 *
 * ANTI-HALLUCINATION ENFORCEMENT:
 * Strictly prevents the AI or extraction layer from returning bare key-value pairs
 * like:
 *   { "account_number": "123456789" }
 * without complete, grounded provenance evidence.
 */

import type {
  BoundingBox,
  ClassificationConfidenceLevel,
  CoordinateSystem,
  DetailedElementBoundingBox,
  FieldProvenanceRef,
  ProvenanceConfidenceTier,
  ProvenanceEnforcementResult,
  ProvenanceExtractionMethod,
  ProvenancedField,
  ProvenanceTraceSummary,
  ProvenanceValidationResult,
} from "./types";

export class UnprovenancedExtractionError extends Error {
  public readonly rejectedFields: Array<{ fieldKey: string; reason: string }>;

  constructor(message: string, rejectedFields: Array<{ fieldKey: string; reason: string }>) {
    super(message);
    this.name = "UnprovenancedExtractionError";
    this.rejectedFields = rejectedFields;
  }
}

export class ProvenanceGuard {
  /**
   * Factory to create an immutable, strictly validated ProvenancedField
   * Throws UnprovenancedExtractionError if any provenance link is missing.
   */
  public static createProvenancedField<T = string | number | null>(params: {
    fieldKey: string;
    fieldLabel: string;
    value: T;
    rawValue?: string;
    unit?: string;
    documentId: string;
    pageNumber: number;
    region: BoundingBox;
    regionText: string;
    contextSnippet?: string;
    extractionMethod?: ProvenanceExtractionMethod;
    extractionMethodLabel?: string;
    confidenceScore?: number;
    confidenceLevel?: ProvenanceConfidenceTier;
    isVerified?: boolean;
    coordinateSystem?: CoordinateSystem;
    detailedBoundingBox?: DetailedElementBoundingBox;
  }): ProvenancedField<T> {
    if (
      params.confidenceScore !== undefined &&
      (params.confidenceScore < 0 || params.confidenceScore > 1)
    ) {
      throw new UnprovenancedExtractionError(
        `Failed to create provenanced field '${params.fieldKey}': Confidence link broken: confidenceScore must be a number between 0 and 1`,
        [
          {
            fieldKey: params.fieldKey,
            reason: "Confidence link broken: confidenceScore must be a number between 0 and 1",
          },
        ],
      );
    }

    const rawVal = params.rawValue ?? String(params.value ?? "");
    const score = params.confidenceScore ?? 0.95;
    const tier: ProvenanceConfidenceTier =
      params.confidenceLevel ?? this.calculateConfidenceTier(score);

    const method: ProvenanceExtractionMethod = params.extractionMethod ?? "Native PDF text";
    let methodLabel = params.extractionMethodLabel;
    if (!methodLabel) {
      const methodStr = String(method);
      if (
        methodStr === "NATIVE_PDF_TEXT" ||
        methodStr === "PDF_TEXT_STREAM" ||
        methodStr === "PDFJS_VIEWPORT"
      ) {
        methodLabel = "Native PDF text";
      } else if (methodStr === "KEY_VALUE_INSPECTION" || methodStr === "KEY_VALUE_PAIR") {
        methodLabel = "Key-value pair";
      } else if (methodStr === "TABLE_CELL_EXTRACTION" || methodStr === "LAYOUT_TABLE_CELL") {
        methodLabel = "Table cell extraction";
      } else if (methodStr === "OCR_RECONSTRUCTED" || methodStr === "TESSERACT_OCR") {
        methodLabel = "OCR reconstructed text";
      } else {
        methodLabel = methodStr;
      }
    }

    const provenance: FieldProvenanceRef = {
      documentId: params.documentId,
      pageNumber: params.pageNumber,
      region: params.region,
      regionText: params.regionText,
      contextSnippet: params.contextSnippet,
      extractionMethod: method,
      extractionMethodLabel: methodLabel,
      confidenceScore: score,
      confidenceLevel: tier,
      extractedAt: new Date().toISOString(),
      coordinateSystem: params.coordinateSystem,
      detailedBoundingBox:
        params.detailedBoundingBox ||
        (params.region
          ? {
              pageNumber: params.pageNumber,
              x: params.region[0],
              y: params.region[1],
              width: params.region[2],
              height: params.region[3],
              coordinateSystem: params.coordinateSystem || "PIXEL_SPACE",
              confidence: score,
            }
          : undefined),
    };

    const field: ProvenancedField<T> = {
      fieldKey: params.fieldKey,
      fieldLabel: params.fieldLabel,
      value: params.value,
      rawValue: rawVal,
      unit: params.unit,
      document: params.documentId,
      page: params.pageNumber,
      extraction: methodLabel,
      confidence: tier,
      provenance,
      isVerified: params.isVerified ?? false,
    };

    const validation = this.validateField(field);
    if (!validation.isValid) {
      throw new UnprovenancedExtractionError(
        `Failed to create provenanced field '${params.fieldKey}': ${validation.errors.join("; ")}`,
        validation.errors.map((err) => ({ fieldKey: params.fieldKey, reason: err })),
      );
    }

    return field;
  }

  /**
   * Determine confidence tier from numerical score
   */
  public static calculateConfidenceTier(score: number): ProvenanceConfidenceTier {
    if (typeof score !== "number" || isNaN(score) || score < 0.25) return "UNKNOWN";
    if (score >= 0.85) return "HIGH";
    if (score >= 0.6) return "MEDIUM";
    return "LOW";
  }

  /**
   * Validate that a given field contains the complete, unbroken chain of provenance:
   * Document → Page → Region/Text → Method → Value → Confidence
   */
  public static validateField(field: unknown): ProvenanceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!field || typeof field !== "object") {
      return {
        isValid: false,
        fieldKey: "unknown",
        errors: ["Field must be a valid non-null object with provenance metadata"],
        warnings: [],
      };
    }

    const candidate = field as Partial<ProvenancedField>;
    const fieldKey = candidate.fieldKey || "unknown";

    // 1. Document Link
    const documentId = candidate.document || candidate.provenance?.documentId;
    if (!documentId || typeof documentId !== "string" || documentId.trim().length === 0) {
      errors.push("Document link broken: Missing document reference link (Document ID required)");
    }

    // 2. Page Link
    const pageNumber = candidate.page ?? candidate.provenance?.pageNumber;
    if (
      pageNumber === undefined ||
      typeof pageNumber !== "number" ||
      pageNumber < 1 ||
      !Number.isInteger(pageNumber)
    ) {
      errors.push("Page link broken: page number must be an integer >= 1");
    }

    // 3. Region / Text Link
    const region = candidate.provenance?.region;
    if (!region || !Array.isArray(region) || region.length !== 4) {
      errors.push(
        "Region/Text link broken: Missing spatial region reference link (BoundingBox [minX, minY, width, height] required)",
      );
    } else {
      const [minX, minY, width, height] = region;
      if (
        typeof minX !== "number" ||
        typeof minY !== "number" ||
        typeof width !== "number" ||
        typeof height !== "number"
      ) {
        errors.push(
          "Region/Text link broken: Spatial bounding box coordinates must be numeric values",
        );
      }
      if (width <= 0 || height <= 0) {
        warnings.push("Bounding box width and height should be positive non-zero dimensions");
      }
    }

    const regionText = candidate.provenance?.regionText;
    if (!regionText || typeof regionText !== "string" || regionText.trim().length === 0) {
      errors.push(
        "Region/Text link broken: Missing region text evidence link (source text extracted in bounding box required)",
      );
    }

    // 4. Extraction Method Link
    const extractionMethod =
      candidate.extraction ||
      candidate.provenance?.extractionMethodLabel ||
      candidate.provenance?.extractionMethod;
    if (
      !extractionMethod ||
      typeof extractionMethod !== "string" ||
      extractionMethod.trim().length === 0
    ) {
      errors.push(
        "Extraction Method link broken: Missing extraction method link (e.g. 'Native PDF text', 'Tesseract OCR')",
      );
    }

    // 5. Extracted Value Link
    if (candidate.value === undefined && !candidate.rawValue) {
      errors.push(
        "Value link broken: Missing extracted value link (field value or rawValue required)",
      );
    }

    // 6. Confidence Link
    const confidence = candidate.confidence || candidate.provenance?.confidenceLevel;
    if (!confidence) {
      errors.push(
        "Confidence link broken: Missing confidence tier link (HIGH, MEDIUM, LOW, or UNKNOWN required)",
      );
    }
    const score = candidate.provenance?.confidenceScore;
    if (
      score !== undefined &&
      (typeof score !== "number" || isNaN(score) || score < 0 || score > 1)
    ) {
      errors.push("Confidence link broken: confidenceScore must be a number between 0 and 1");
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      fieldKey,
      errors,
      warnings,
      provenanceChain: isValid
        ? {
            document: documentId as string,
            page: pageNumber as number,
            region: region as BoundingBox,
            text: regionText as string,
            extraction: extractionMethod as string,
            value: candidate.value,
            confidence: String(confidence),
          }
        : undefined,
    };
  }

  /**
   * Anti-Hallucination Guard:
   * Intercepts arbitrary payloads and rejects any unprovenanced raw JSON
   * e.g. { "account_number": "123456789" } without evidence.
   */
  public static enforceProvenancePayload(
    payload: unknown,
    options: { strict?: boolean } = {},
  ): ProvenanceEnforcementResult {
    const rejectedFields: Array<{ fieldKey: string; reason: string; details?: string }> = [];
    const verifiedFields: ProvenancedField[] = [];

    if (!payload || typeof payload !== "object") {
      rejectedFields.push({
        fieldKey: "root",
        reason: "REJECTED_INVALID_PAYLOAD",
        details: "Payload is empty or not an object",
      });
      return {
        hasValidProvenance: false,
        isValid: false,
        provenancedFieldsCount: 0,
        provenancedCount: 0,
        rejectedFieldsCount: 1,
        rejectedCount: 1,
        rejectedFields,
        rejectedClaims: rejectedFields,
        verifiedFields,
        provenancedFields: {},
      };
    }

    // Case A: Payload is a Provenance-aware envelope with `fields` or `provenancedFields`
    const record = payload as Record<string, unknown>;
    const targetFields: Record<string, unknown> =
      (record.provenancedFields as Record<string, unknown>) ||
      (record.fields as Record<string, unknown>) ||
      record;

    for (const [key, val] of Object.entries(targetFields)) {
      // Ignore top-level metadata keys if examining an envelope
      if (
        [
          "documentId",
          "organisationId",
          "totalFieldsCount",
          "overallConfidence",
          "compiledAt",
          "status",
        ].includes(key)
      ) {
        continue;
      }

      // Check if value is a primitive (e.g. raw string "123456789") -> IMMEDIATE REJECTION
      if (typeof val !== "object" || val === null) {
        const details = `Raw primitive value without evidence: Field '${key}' submitted as bare ungrounded primitive value (${JSON.stringify(
          val,
        )}) without Document → Page → Region/Text → Extraction Method → Value → Confidence provenance. Missing Page, Region/Text, Extraction Method, and Confidence grounding.`;
        rejectedFields.push({
          fieldKey: key,
          reason: "REJECTED_UNPROVENANCED_PRIMITIVE",
          details,
        });
        continue;
      }

      // Validate the object structure
      const valObj = val as Record<string, unknown>;
      // Check if it lacks provenance property or document reference
      if (!valObj.provenance && !valObj.document) {
        rejectedFields.push({
          fieldKey: key,
          reason: "REJECTED_UNPROVENANCED_PRIMITIVE",
          details: `Missing evidence chain: Field '${key}' object lacks provenance reference object. Bare key-value structures without evidence are prohibited. Missing Page, Region/Text, Extraction Method, and Confidence grounding.`,
        });
        continue;
      }

      const validation = this.validateField(val);
      if (validation.isValid) {
        verifiedFields.push(val as ProvenancedField);
      } else {
        rejectedFields.push({
          fieldKey: key,
          reason: "REJECTED_BROKEN_PROVENANCE_CHAIN",
          details: `Incomplete provenance chain for field '${key}': ${validation.errors.join("; ")}`,
        });
      }
    }

    const hasValidProvenance = rejectedFields.length === 0 && verifiedFields.length > 0;

    if (!hasValidProvenance && options.strict) {
      throw new UnprovenancedExtractionError(
        `Provenance enforcement failed: ${rejectedFields.length} unprovenanced or ungrounded field(s) detected.`,
        rejectedFields,
      );
    }

    const provFieldsRecord: Record<string, ProvenancedField> = {};
    for (const vf of verifiedFields) {
      provFieldsRecord[vf.fieldKey] = vf;
    }

    return {
      hasValidProvenance,
      isValid: hasValidProvenance,
      provenancedFieldsCount: verifiedFields.length,
      provenancedCount: verifiedFields.length,
      rejectedFieldsCount: rejectedFields.length,
      rejectedCount: rejectedFields.length,
      rejectedFields,
      rejectedClaims: rejectedFields,
      verifiedFields,
      provenancedFields: provFieldsRecord,
    };
  }

  /**
   * Format the chain of provenance as an authoritative human-readable trace
   * exactly matching the architectural requirement:
   *
   * Document
   *   ↓
   * Page
   *   ↓
   * Region / Text
   *   ↓
   * Extraction Method
   *   ↓
   * Extracted Value
   *   ↓
   * Confidence
   */
  public static formatProvenanceChain(field: ProvenancedField): string {
    const p = field.provenance;
    const regionStr = p.region ? `[${p.region.join(", ")}]` : "[N/A]";

    return [
      `Field: ${field.fieldLabel || field.fieldKey}`,
      `Value: ${String(field.value ?? field.rawValue)}`,
      `Document: ${field.document || p.documentId}`,
      `  ↓`,
      `Page: ${field.page || p.pageNumber}`,
      `  ↓`,
      `Region: ${regionStr} | Text: "${p.regionText || field.rawValue}"`,
      `Region / Text: ${regionStr} | "${p.regionText || field.rawValue}"`,
      `  ↓`,
      `Extraction: ${field.extraction || p.extractionMethodLabel}`,
      `Extraction Method: ${field.extraction || p.extractionMethodLabel}`,
      `  ↓`,
      `Extracted Value: ${String(field.value ?? field.rawValue)}`,
      `  ↓`,
      `Confidence: ${String(field.confidence || p.confidenceLevel)}`,
    ].join("\n");
  }

  /**
   * Convert ProvenancedField to concise summary format matching user prompt:
   *
   * Field: Account Number
   * Value: 123456789
   * Document: INV-001
   * Page: 1
   * Extraction: Native PDF text
   * Confidence: HIGH
   */
  public static toTraceSummary(field: ProvenancedField): ProvenanceTraceSummary {
    return {
      field: field.fieldLabel || field.fieldKey,
      value: field.value,
      document: field.document,
      page: field.page,
      extraction: field.extraction,
      confidence: String(field.confidence),
      region: field.provenance?.region,
      text: field.provenance?.regionText,
    };
  }
}
