/**
 * ENERA AI VALIDATION — STRUCTURED AI PAYLOAD BUILDER (REQUIREMENT 8)
 * ====================================================================
 * Prepares targeted, token-efficient, privacy-focused evidence for AI models.
 *
 * ADVANTAGES OF TARGETED STRUCTURED EVIDENCE:
 * 1. Cost Efficiency: Limits token usage to relevant invoice bounding regions.
 * 2. Hallucination Reduction: Grounded strictly in OCR tokens and layout blocks.
 * 3. Latency Optimization: Eliminates processing of irrelevant background pages.
 * 4. Data Privacy: Prevents uncontrolled raw PDF blob leakage to AI providers.
 */

import type { CandidateFieldValidationInput } from "./types";
import type { UnifiedDocumentExtraction } from "../intelligence/unifiedDocumentBridge";

export interface TargetedPageEvidence {
  pageNumber: number;
  relevantBlocks: Array<{
    blockId: string;
    blockType: string;
    text: string;
    confidence: number;
    boundingBox?: [number, number, number, number];
  }>;
}

export interface StructuredAiInputPayload {
  documentId: string;
  organisationId?: string;
  metadata: {
    totalPages: number;
    extractionMethod: string;
    overallOcrConfidence: number;
    detectedSupplier?: string;
  };
  candidateFields: Array<{
    field: string;
    label: string;
    extractedValue: string | number | null;
    rawText: string;
    page: number;
    boundingBox?: [number, number, number, number];
    opticalConfidence: number;
    sourceSnippet?: string;
  }>;
  relevantTables: Array<{
    pageNumber: number;
    headers: string[];
    rowCount: number;
    sampleRows: string[][];
  }>;
  targetedPages: TargetedPageEvidence[];
  systemInstructions: string;
  expectedOutputJsonSchema: string;
}

export class StructuredAiPayloadBuilder {
  /**
   * Constructs the targeted structured AI input payload.
   */
  public static buildPayload(params: {
    documentId: string;
    organisationId?: string;
    candidateFields: CandidateFieldValidationInput[];
    unifiedDocument?: UnifiedDocumentExtraction;
    supplierContext?: string;
  }): StructuredAiInputPayload {
    const { documentId, organisationId, candidateFields, unifiedDocument, supplierContext } =
      params;

    // 1. Filter and normalize candidate fields
    const candidates = candidateFields.map((f) => ({
      field: f.fieldKey,
      label: f.fieldLabel,
      extractedValue: f.value,
      rawText: f.rawValue,
      page: f.sourcePage || 1,
      boundingBox: f.boundingBox,
      opticalConfidence: f.opticalConfidence,
      sourceSnippet: f.sourceText,
    }));

    // 2. Identify relevant pages containing candidate fields
    const relevantPageNumbers = new Set<number>(candidates.map((c) => c.page));

    // 3. Extract targeted page blocks
    const targetedPages: TargetedPageEvidence[] = [];
    if (unifiedDocument?.pages) {
      for (const p of unifiedDocument.pages) {
        if (relevantPageNumbers.has(p.pageNumber) || p.pageNumber <= 2) {
          const relevantBlocks = p.blocks
            .filter(
              (b) =>
                b.blockType === "KEY_VALUE" || b.blockType === "HEADER" || b.blockType === "TABLE",
            )
            .slice(0, 10) // Limit to top 10 relevant blocks per page for token efficiency
            .map((b) => ({
              blockId: b.blockId,
              blockType: b.blockType,
              text: b.text.slice(0, 300), // Truncate individual block length
              confidence: b.confidence,
              boundingBox: b.boundingBox,
            }));

          targetedPages.push({
            pageNumber: p.pageNumber,
            relevantBlocks,
          });
        }
      }
    }

    // 4. Extract structured tables
    const relevantTables = (unifiedDocument?.tables || []).map((t) => ({
      pageNumber: t.pageNumber,
      headers: t.headers,
      rowCount: t.rowCount,
      sampleRows: t.rows.slice(0, 5), // Include first 5 rows for sample context
    }));

    const systemInstructions =
      "You are the ENERA Intelligent Invoice Verification Engine. " +
      "Analyze the provided structured optical evidence to determine whether candidate values are semantically consistent. " +
      "CORE PRINCIPLE: You may interpret evidence; you must NEVER invent missing evidence or modify financial numbers. " +
      "If evidence is insufficient, mark status as 'UNKNOWN' or 'AMBIGUOUS'. " +
      "You MUST respond ONLY in valid JSON conforming to the specified schema.";

    const expectedOutputJsonSchema = JSON.stringify(
      {
        document_id: "string",
        overall_status: "VALID | REVIEW_REQUIRED | REJECTED",
        overall_confidence: "number (0.0 - 1.0)",
        supplier_context: "string",
        validated_fields: [
          {
            field: "string",
            status: "VALID | AMBIGUOUS | INVALID | UNKNOWN",
            confidence: "number (0.0 - 1.0)",
            reason: "string",
            evidence: [
              {
                page: "number",
                source_text: "string",
                bounding_box: "[ymin, xmin, ymax, xmax]",
              },
            ],
          },
        ],
        anomalies_detected: ["string"],
      },
      null,
      2,
    );

    return {
      documentId,
      organisationId,
      metadata: {
        totalPages: unifiedDocument?.totalPages || 1,
        extractionMethod: unifiedDocument?.extractionMethod || "HYBRID_OCR",
        overallOcrConfidence: unifiedDocument?.overallConfidence || 95,
        detectedSupplier: supplierContext || "ESKOM",
      },
      candidateFields: candidates,
      relevantTables,
      targetedPages,
      systemInstructions,
      expectedOutputJsonSchema,
    };
  }
}
