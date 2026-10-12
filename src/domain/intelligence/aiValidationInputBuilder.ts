/**
 * ENERA DOCUMENT INTELLIGENCE — AI VALIDATION INPUT BUILDER (REQUIREMENT 32)
 * ===========================================================================
 * Prepares the structured evidence output for the next branch:
 *   feature/ai-validation
 *
 * Ensures AI receives structured evidence rather than raw uncontrolled PDF blobs:
 *
 *   Document
 *       ↓
 *     Pages
 *       ↓
 *   OCR Blocks
 *       ↓
 *     Lines
 *       ↓
 *     Words
 *       ↓
 * Candidate Fields
 *       ↓
 *   AI Validation
 *
 * Guarantees that AI models can explicitly reference:
 * - Source page number
 * - OCR bounding box coordinates
 * - Verifiable OCR evidence source text
 * - Processing run ID & token confidence scores
 */

import type {
  UnifiedDocumentExtraction,
  UnifiedPageExtraction,
  UnifiedCandidateField,
  UnifiedTableData,
} from "./unifiedDocumentBridge";
import type { OcrDocumentResult } from "../ocr/types";
import { UnifiedDocumentBridge } from "./unifiedDocumentBridge";

export interface AiValidationWordEvidence {
  text: string;
  confidence: number;
  boundingBox: [number, number, number, number];
}

export interface AiValidationLineEvidence {
  lineId: string;
  text: string;
  confidence: number;
  boundingBox: [number, number, number, number];
  words: AiValidationWordEvidence[];
}

export interface AiValidationBlockEvidence {
  blockId: string;
  blockType: string;
  confidence: number;
  boundingBox: [number, number, number, number];
  lines: AiValidationLineEvidence[];
}

export interface AiValidationPageEvidence {
  pageNumber: number;
  confidence: number;
  ocrBlocks: AiValidationBlockEvidence[];
}

export interface AiValidationFieldEvidence {
  fieldKey: string;
  fieldLabel: string;
  value: string | number | null;
  rawValue: string;
  confidence: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  sourcePage: number;
  ocrEvidence: {
    pageNumber: number;
    sourceText: string;
    boundingBox?: [number, number, number, number];
    processingRunId?: string;
    confidence: number;
    wordTokens?: AiValidationWordEvidence[];
  };
}

export interface AiStructuredEvidenceHierarchy {
  document: {
    documentId: string;
    organisationId?: string;
    totalPages: number;
    extractionMethod: string;
    processingRunId?: string;
    overallConfidence: number;
  };
  pages: AiValidationPageEvidence[];
  candidateFields: AiValidationFieldEvidence[];
  tables: Array<{
    tableId: string;
    pageNumber: number;
    headers: string[];
    rows: string[][];
    rowCount: number;
    columnCount: number;
    boundingBox?: [number, number, number, number];
    confidence: number;
  }>;
}

export interface AiValidationConstraint {
  fieldKey: string;
  constraintType:
    | "REQUIRED"
    | "NUMERIC_RANGE"
    | "DATE_FORMAT"
    | "TOTAL_SUM_CHECK"
    | "METER_CONSUMPTION_MATH"
    | "CUSTOM";
  description: string;
}

export interface AiValidationStructuredPackage {
  packageId: string;
  documentId: string;
  organisationId?: string;
  targetBranch: "feature/ai-validation";
  createdAt: string;
  hierarchy: AiStructuredEvidenceHierarchy;
  validationConstraints: AiValidationConstraint[];
  promptContextSummary: string;
}

export class AiValidationInputBuilder {
  /**
   * Builds the complete, validated structured evidence package for feature/ai-validation.
   */
  public static buildStructuredPackage(
    input: UnifiedDocumentExtraction | OcrDocumentResult,
    options: {
      documentId?: string;
      organisationId?: string;
      targetBranch?: "feature/ai-validation";
      additionalConstraints?: AiValidationConstraint[];
    } = {},
  ): AiValidationStructuredPackage {
    const unified: UnifiedDocumentExtraction =
      "totalPages" in input && "candidateFields" in input
        ? (input as UnifiedDocumentExtraction)
        : UnifiedDocumentBridge.fromOcrResult(
            input as OcrDocumentResult,
            options.documentId || (input as OcrDocumentResult).documentId || "doc-unknown",
            { organisationId: options.organisationId },
          );

    const docId = unified.documentId;
    const orgId = options.organisationId || unified.organisationId;

    // 1. Build Document -> Pages -> Blocks -> Lines -> Words Hierarchy
    const pages: AiValidationPageEvidence[] = unified.pages.map((p) => {
      const ocrBlocks: AiValidationBlockEvidence[] = p.blocks.map((b) => ({
        blockId: b.blockId,
        blockType: b.blockType,
        confidence: b.confidence,
        boundingBox: b.boundingBox,
        lines: b.lines.map((l) => ({
          lineId: l.lineId,
          text: l.text,
          confidence: l.confidence,
          boundingBox: l.boundingBox,
          words: l.words.map((w) => ({
            text: w.text,
            confidence: w.confidence,
            boundingBox: w.boundingBox,
          })),
        })),
      }));

      return {
        pageNumber: p.pageNumber,
        confidence: p.confidence,
        ocrBlocks,
      };
    });

    // 2. Build Candidate Fields with Source Page & OCR Evidence
    const candidateFields: AiValidationFieldEvidence[] = unified.candidateFieldsList.map((f) => ({
      fieldKey: f.fieldKey,
      fieldLabel: f.fieldLabel,
      value: f.value,
      rawValue: f.rawValue,
      confidence: f.confidenceScore,
      confidenceTier: f.confidenceTier,
      sourcePage: f.provenance.pageNumber,
      ocrEvidence: {
        pageNumber: f.provenance.pageNumber,
        sourceText: f.provenance.sourceText,
        boundingBox: f.provenance.boundingBox,
        processingRunId: f.provenance.processingRunId || unified.processingRunId,
        confidence: f.confidenceScore,
        wordTokens: f.provenance.wordTokens?.map((w) => ({
          text: w.text,
          confidence: w.confidence,
          boundingBox: w.boundingBox,
        })),
      },
    }));

    // 3. Structured Tables
    const tables = unified.tables.map((t) => ({
      tableId: t.tableId,
      pageNumber: t.pageNumber,
      headers: t.headers,
      rows: t.rows,
      rowCount: t.rowCount,
      columnCount: t.columnCount,
      boundingBox: t.boundingBox,
      confidence: t.confidence,
    }));

    // 4. Standard deterministic validation constraints for Eskom / Municipal bills
    const defaultConstraints: AiValidationConstraint[] = [
      {
        fieldKey: "accountNumber",
        constraintType: "REQUIRED",
        description: "Account number must be present and traceable to source OCR page evidence.",
      },
      {
        fieldKey: "totalAmountDue",
        constraintType: "TOTAL_SUM_CHECK",
        description:
          "Total amount due must equal subtotal + VAT within R 0.02 mathematical tolerance.",
      },
      {
        fieldKey: "billingPeriodStart",
        constraintType: "DATE_FORMAT",
        description: "Billing period start date must precede billing period end date.",
      },
      {
        fieldKey: "totalActiveEnergyKwh",
        constraintType: "METER_CONSUMPTION_MATH",
        description:
          "Total active energy must match sum of Time-of-Use components (Peak, Standard, Off-Peak) or meter difference.",
      },
    ];

    const validationConstraints = [...defaultConstraints, ...(options.additionalConstraints || [])];

    // 5. Generate concise, token-efficient prompt context summary for AI models
    const promptContextSummary = this.generatePromptContextSummary(unified, candidateFields);

    const hierarchy: AiStructuredEvidenceHierarchy = {
      document: {
        documentId: docId,
        organisationId: orgId,
        totalPages: unified.totalPages,
        extractionMethod: unified.extractionMethod,
        processingRunId: unified.processingRunId,
        overallConfidence: unified.overallConfidence,
      },
      pages,
      candidateFields,
      tables,
    };

    return {
      packageId: `ai-val-input-${docId}-${Date.now()}`,
      documentId: docId,
      organisationId: orgId,
      targetBranch: "feature/ai-validation",
      createdAt: new Date().toISOString(),
      hierarchy,
      validationConstraints,
      promptContextSummary,
    };
  }

  /**
   * Generates a token-efficient, grounded summary for LLM context prompts.
   */
  public static generatePromptContextSummary(
    unified: UnifiedDocumentExtraction,
    candidateFields: AiValidationFieldEvidence[],
  ): string {
    const lines: string[] = [];
    lines.push(`# STRUCTURED EVIDENCE FOR AI VALIDATION`);
    lines.push(`- **Document ID**: ${unified.documentId}`);
    lines.push(`- **Total Pages**: ${unified.totalPages}`);
    lines.push(`- **Extraction Method**: ${unified.extractionMethod}`);
    lines.push(`- **Overall OCR Confidence**: ${unified.overallConfidence}%`);
    if (unified.processingRunId) {
      lines.push(`- **OCR Processing Run ID**: ${unified.processingRunId}`);
    }
    lines.push(`\n## EXTRACTED CANDIDATE FIELDS WITH EVIDENCE`);

    for (const f of candidateFields) {
      const bboxStr = f.ocrEvidence.boundingBox
        ? `[${f.ocrEvidence.boundingBox.join(", ")}]`
        : "N/A";
      lines.push(
        `- **${f.fieldLabel}** (\`${f.fieldKey}\`): ${JSON.stringify(f.value)} ` +
          `| Source Page: ${f.sourcePage} | Confidence: ${f.confidence}% (${f.confidenceTier}) ` +
          `| Box: ${bboxStr} | Source Text: "${f.ocrEvidence.sourceText}"`,
      );
    }

    if (unified.tables.length > 0) {
      lines.push(`\n## DETECTED TABLES`);
      for (const t of unified.tables) {
        lines.push(
          `- Table on Page ${t.pageNumber} (${t.rowCount} rows, ${t.columnCount} cols): Headers [${t.headers.join(", ")}]`,
        );
      }
    }

    return lines.join("\n");
  }
}
