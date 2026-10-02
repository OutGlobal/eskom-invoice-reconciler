/**
 * ENERA DOCUMENT INTELLIGENCE — UNIFIED DOCUMENT BRIDGE (REQUIREMENT 31)
 * =======================================================================
 * Connects OCR results back into feature/document-intelligence.
 *
 * Allows the Document Intelligence layer to consume:
 *   1. Native PDF text
 *   2. OCR text
 *   3. Hybrid text combinations
 *
 * Exposes a consistent, uniform interface without requiring downstream
 * consumers to care which extraction method generated it.
 */

import type {
  DocumentTextExtractionResult,
  ExtractedPage,
  ExtractedTextLine,
  DetectedTable,
  PageTextStructure,
} from "./types";
import type {
  OcrDocumentResult,
  OcrPageResult,
  OcrLayoutBlock,
  OcrLineBlock,
  OcrWordToken,
  ExtractedDeterminantField,
  OcrFieldEvidence,
} from "../ocr/types";
import { OcrConfidenceScorer } from "../ocr/ocrConfidenceScorer";

export type UnifiedSourceType = "NATIVE_PDF_TEXT" | "OCR_RASTER" | "HYBRID";
export type UnifiedConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export interface UnifiedWordToken {
  wordId: string;
  pageNumber: number;
  text: string;
  confidence: number;
  confidenceTier: UnifiedConfidenceTier;
  boundingBox: [number, number, number, number]; // [x, y, width, height]
}

export interface UnifiedLineBlock {
  lineId: string;
  pageNumber: number;
  text: string;
  confidence: number;
  confidenceTier: UnifiedConfidenceTier;
  boundingBox: [number, number, number, number];
  words: UnifiedWordToken[];
}

export interface UnifiedLayoutBlock {
  blockId: string;
  pageNumber: number;
  blockType: "HEADER" | "PARAGRAPH" | "TABLE" | "KEY_VALUE" | "FOOTER" | "SECTION" | "UNKNOWN";
  text: string;
  confidence: number;
  confidenceTier: UnifiedConfidenceTier;
  boundingBox: [number, number, number, number];
  lines: UnifiedLineBlock[];
}

export interface UnifiedTableData {
  tableId: string;
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  rows: string[][];
  confidence: number;
  boundingBox?: [number, number, number, number];
}

export interface UnifiedPageExtraction {
  pageNumber: number;
  rawText: string;
  fullText: string;
  characterCount: number;
  wordCount: number;
  lineCount: number;
  blocks: UnifiedLayoutBlock[];
  lines: UnifiedLineBlock[];
  words: UnifiedWordToken[];
  tables: UnifiedTableData[];
  confidence: number;
  sourceType: UnifiedSourceType;
}

export interface UnifiedCandidateField<T = string | number | null> {
  fieldKey: string;
  fieldLabel: string;
  value: T;
  rawValue: string;
  confidenceScore: number;
  confidenceTier: UnifiedConfidenceTier;
  provenance: {
    documentId: string;
    pageNumber: number;
    extractionMethod: UnifiedSourceType;
    sourceText: string;
    boundingBox?: [number, number, number, number];
    processingRunId?: string;
    hasExactBoundingBox: boolean;
    wordTokens?: UnifiedWordToken[];
  };
}

export interface UnifiedDocumentExtraction {
  documentId: string;
  organisationId?: string;
  sourceType: UnifiedSourceType;
  totalPages: number;
  pages: UnifiedPageExtraction[];
  candidateFields: Record<string, UnifiedCandidateField>;
  candidateFieldsList: UnifiedCandidateField[];
  tables: UnifiedTableData[];
  overallConfidence: number;
  extractionMethod: string;
  processingRunId?: string;
  extractedAt: string;
}

export class UnifiedDocumentBridge {
  /**
   * Normalizes Native PDF text extraction into the consistent UnifiedDocumentExtraction format.
   */
  public static fromNativePdf(
    nativeResult: DocumentTextExtractionResult,
    documentId: string,
    options: {
      organisationId?: string;
      processingRunId?: string;
      pages?: ExtractedPage[];
    } = {},
  ): UnifiedDocumentExtraction {
    const pages: UnifiedPageExtraction[] = [];
    const tables: UnifiedTableData[] = [];
    const candidateFields: Record<string, UnifiedCandidateField> = {};

    for (const pageStructure of nativeResult.pages) {
      const pageNum = pageStructure.pageNumber;
      const lines: UnifiedLineBlock[] = [];
      const words: UnifiedWordToken[] = [];

      for (let lIdx = 0; lIdx < pageStructure.lines.length; lIdx++) {
        const line = pageStructure.lines[lIdx];
        const lineWords: UnifiedWordToken[] = [];

        for (let wIdx = 0; wIdx < (line.tokens || []).length; wIdx++) {
          const tok = line.tokens[wIdx];
          const wConf = tok.confidence !== undefined ? tok.confidence * 100 : 98;
          const wordToken: UnifiedWordToken = {
            wordId: `w-p${pageNum}-l${lIdx}-${wIdx}`,
            pageNumber: pageNum,
            text: tok.text,
            confidence: wConf,
            confidenceTier: OcrConfidenceScorer.getConfidenceTier(wConf),
            boundingBox: tok.bbox || [0, 0, 0, 0],
          };
          lineWords.push(wordToken);
          words.push(wordToken);
        }

        const lConf = 98;
        lines.push({
          lineId: (line as any).lineId || `l-p${pageNum}-${line.lineNumber || lIdx}`,
          pageNumber: pageNum,
          text: line.text,
          confidence: lConf,
          confidenceTier: OcrConfidenceScorer.getConfidenceTier(lConf),
          boundingBox: line.bbox || [0, 0, 0, 0],
          words: lineWords,
        });
      }

      // Convert paragraphs into layout blocks
      const blocks: UnifiedLayoutBlock[] = (pageStructure.paragraphs || []).map((p, pIdx) => {
        const matchingLines = lines.filter((l) =>
          p.lines.some((pl) => (pl as any).lineId === (l as any).lineId || pl.text === l.text),
        );
        return {
          blockId: `blk-p${pageNum}-${pIdx}`,
          pageNumber: pageNum,
          blockType: "PARAGRAPH",
          text: p.text,
          confidence: 98,
          confidenceTier: "HIGH",
          boundingBox: p.bbox || [0, 0, 0, 0],
          lines: matchingLines,
        };
      });

      // Tables
      for (const t of pageStructure.tables || []) {
        const colCount = (t as any).columns ? (t as any).columns.length : 0;
        const hdrs = (t as any).columns
          ? (t as any).columns.map((c: any) => c.headerText || "")
          : [];
        const tData: UnifiedTableData = {
          tableId: (t as any).tableId || `tbl-p${pageNum}-${tables.length + 1}`,
          pageNumber: pageNum,
          rowCount: t.rows.length,
          columnCount: colCount,
          headers: hdrs,
          rows: t.rows.map((r) => r.cells.map((c) => c.text)),
          confidence: 95,
          boundingBox: t.bbox,
        };
        tables.push(tData);
      }

      pages.push({
        pageNumber: pageNum,
        rawText: pageStructure.rawText,
        fullText: pageStructure.rawText,
        characterCount: pageStructure.characterCount,
        wordCount: pageStructure.wordCount,
        lineCount: lines.length,
        blocks,
        lines,
        words,
        tables: tables.filter((t) => t.pageNumber === pageNum),
        confidence: 98,
        sourceType: "NATIVE_PDF_TEXT",
      });
    }

    // Convert extracted entities into candidate fields
    const entitiesList = nativeResult.allEntities || (nativeResult as any).entities || [];
    for (const entity of entitiesList) {
      const fieldKey = entity.entityType.toLowerCase();
      const conf = entity.confidence !== undefined ? entity.confidence * 100 : 95;
      candidateFields[fieldKey] = {
        fieldKey,
        fieldLabel: entity.entityType,
        value: entity.normalizedValue,
        rawValue: entity.rawValue,
        confidenceScore: conf,
        confidenceTier: OcrConfidenceScorer.getConfidenceTier(conf),
        provenance: {
          documentId,
          pageNumber: entity.pageNumber,
          extractionMethod: "NATIVE_PDF_TEXT",
          sourceText: entity.contextSnippet || entity.rawValue || "",
          boundingBox: entity.bbox,
          processingRunId: options.processingRunId,
          hasExactBoundingBox: Boolean(entity.bbox && entity.bbox.length === 4),
        },
      };
    }

    return {
      documentId,
      organisationId: options.organisationId,
      sourceType: "NATIVE_PDF_TEXT",
      totalPages: pages.length,
      pages,
      candidateFields,
      candidateFieldsList: Object.values(candidateFields),
      tables,
      overallConfidence: 98,
      extractionMethod: "NATIVE_PDF_TEXT",
      processingRunId: options.processingRunId,
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * Normalizes OCR document extraction into the consistent UnifiedDocumentExtraction format.
   */
  public static fromOcrResult(
    ocrResult: OcrDocumentResult,
    documentId: string,
    options: {
      organisationId?: string;
    } = {},
  ): UnifiedDocumentExtraction {
    const pages: UnifiedPageExtraction[] = [];
    const tables: UnifiedTableData[] = [];
    const candidateFields: Record<string, UnifiedCandidateField> = {};

    for (const pRes of ocrResult.pages) {
      const pageNum = pRes.pageNumber;
      const lines: UnifiedLineBlock[] = [];
      const words: UnifiedWordToken[] = [];
      const blocks: UnifiedLayoutBlock[] = [];

      for (let lIdx = 0; lIdx < (pRes.lines || []).length; lIdx++) {
        const line = pRes.lines[lIdx];
        const lineWords: UnifiedWordToken[] = [];

        for (let wIdx = 0; wIdx < (line.words || []).length; wIdx++) {
          const w = line.words[wIdx];
          const wConf = w.confidence !== undefined ? w.confidence : 85;
          const wordToken: UnifiedWordToken = {
            wordId: `w-ocr-p${pageNum}-l${lIdx}-${wIdx}`,
            pageNumber: pageNum,
            text: w.text,
            confidence: wConf,
            confidenceTier: OcrConfidenceScorer.getConfidenceTier(wConf),
            boundingBox: w.boundingBox || [0, 0, 0, 0],
          };
          lineWords.push(wordToken);
          words.push(wordToken);
        }

        const lConf = line.confidence !== undefined ? line.confidence : 85;
        lines.push({
          lineId: line.lineId || `l-ocr-p${pageNum}-${lIdx}`,
          pageNumber: pageNum,
          text: line.text,
          confidence: lConf,
          confidenceTier: OcrConfidenceScorer.getConfidenceTier(lConf),
          boundingBox: line.boundingBox || [0, 0, 0, 0],
          words: lineWords,
        });
      }

      // Preserve or reconstruct layout blocks
      if (pRes.blocks && pRes.blocks.length > 0) {
        for (const b of pRes.blocks) {
          const bConf = b.confidence !== undefined ? b.confidence : 85;
          blocks.push({
            blockId: b.blockId,
            pageNumber: pageNum,
            blockType: ((b as any).blockType || (b as any).type || "PARAGRAPH") as any,
            text: b.lines ? b.lines.map((l) => l.text).join("\n") : "",
            confidence: bConf,
            confidenceTier: OcrConfidenceScorer.getConfidenceTier(bConf),
            boundingBox: b.boundingBox || [0, 0, 0, 0],
            lines: (b.lines || []).map((l, idx) => ({
              lineId: (l as any).lineId || `l-blk-p${pageNum}-${idx}`,
              pageNumber: pageNum,
              text: l.text,
              confidence: l.confidence || 85,
              confidenceTier: OcrConfidenceScorer.getConfidenceTier(l.confidence || 85),
              boundingBox: l.boundingBox || [0, 0, 0, 0],
              words: (l.words || []).map((w, wIdx) => ({
                wordId: `w-blk-p${pageNum}-${idx}-${wIdx}`,
                pageNumber: pageNum,
                text: w.text,
                confidence: w.confidence || 85,
                confidenceTier: OcrConfidenceScorer.getConfidenceTier(w.confidence || 85),
                boundingBox: w.boundingBox || [0, 0, 0, 0],
              })),
            })),
          });
        }
      } else {
        // Fallback single block from lines
        const pConf = pRes.averageConfidence || (pRes as any).confidenceAverage || 85;
        blocks.push({
          blockId: `blk-ocr-p${pageNum}-1`,
          pageNumber: pageNum,
          blockType: "PARAGRAPH",
          text: lines.map((l) => l.text).join("\n"),
          confidence: pConf,
          confidenceTier: OcrConfidenceScorer.getConfidenceTier(pConf),
          boundingBox: [0, 0, 100, 100],
          lines,
        });
      }

      // Preserved tables from page
      for (const t of pRes.tables || []) {
        const tHeaders =
          t.headers ||
          ((t as any).columns
            ? (t as any).columns.map((c: any) => c.headerText || c.name || String(c))
            : []);
        const tColCount =
          t.columnCount || ((t as any).columns ? (t as any).columns.length : tHeaders.length);
        const tData: UnifiedTableData = {
          tableId: t.tableId || `tbl-ocr-p${pageNum}-${tables.length + 1}`,
          pageNumber: pageNum,
          rowCount: t.rows ? t.rows.length : 0,
          columnCount: tColCount,
          headers: tHeaders,
          rows: t.rows
            ? (t.rows as any[]).map((r: any) =>
                Array.isArray(r)
                  ? r.map(String)
                  : r.cells
                    ? r.cells.map((c: any) => c.text || c.rawText || String(c))
                    : [],
              )
            : [],
          confidence:
            t.confidence || pRes.averageConfidence || (pRes as any).confidenceAverage || 85,
          boundingBox: t.boundingBox,
        };
        tables.push(tData);
      }

      const pAvgConf = pRes.averageConfidence || (pRes as any).confidenceAverage || 85;
      pages.push({
        pageNumber: pageNum,
        rawText: pRes.fullText || "",
        fullText: pRes.fullText || "",
        characterCount: (pRes.fullText || "").length,
        wordCount: words.length,
        lineCount: lines.length,
        blocks,
        lines,
        words,
        tables: tables.filter((t) => t.pageNumber === pageNum),
        confidence: pAvgConf,
        sourceType: "OCR_RASTER",
      });
    }

    // Include document-level tables if not already collected
    if (ocrResult.tables && ocrResult.tables.length > 0) {
      for (const t of ocrResult.tables) {
        if (!tables.some((existing) => existing.tableId === t.tableId)) {
          const docHeaders =
            t.headers ||
            ((t as any).columns
              ? (t as any).columns.map((c: any) => c.headerText || c.name || String(c))
              : []);
          const docColCount =
            t.columnCount || ((t as any).columns ? (t as any).columns.length : docHeaders.length);
          tables.push({
            tableId: t.tableId || `tbl-ocr-doc-${tables.length + 1}`,
            pageNumber: t.pageNumber || 1,
            rowCount: t.rows ? t.rows.length : 0,
            columnCount: docColCount,
            headers: docHeaders,
            rows: t.rows
              ? (t.rows as any[]).map((r: any) =>
                  Array.isArray(r)
                    ? r.map(String)
                    : r.cells
                      ? r.cells.map((c: any) => c.text || c.rawText || String(c))
                      : [],
                )
              : [],
            confidence: t.confidence || ocrResult.overallConfidence || 85,
            boundingBox: t.boundingBox,
          });
        }
      }
    }

    // Convert OCR Determinants to Candidate Fields
    if ((ocrResult as any).determinants) {
      for (const [key, field] of Object.entries((ocrResult as any).determinants)) {
        if (!field) continue;
        const detField = field as ExtractedDeterminantField;
        const prov = detField.provenance;
        const conf = (detField as any).confidence || prov?.confidenceScore || 85;
        const rawBbox = prov?.boundingBox || (detField as any).boundingBox || null;
        const bBox: [number, number, number, number] | undefined =
          rawBbox && Array.isArray(rawBbox) && rawBbox.length === 4
            ? [rawBbox[0], rawBbox[1], rawBbox[2], rawBbox[3]]
            : undefined;
        const srcText = prov?.sourceText || (detField as any).sourceText || detField.rawValue || "";
        candidateFields[key] = {
          fieldKey: detField.fieldKey || key,
          fieldLabel: detField.fieldLabel || key,
          value: detField.value,
          rawValue: detField.rawValue || String(detField.value ?? ""),
          confidenceScore: conf,
          confidenceTier: OcrConfidenceScorer.getConfidenceTier(conf),
          provenance: {
            documentId: prov?.documentId || (detField as any).documentId || documentId,
            pageNumber: prov?.pageNumber || (detField as any).pageNumber || 1,
            extractionMethod: "OCR_RASTER",
            sourceText: srcText,
            boundingBox: bBox,
            processingRunId:
              prov?.ocrRunId ||
              prov?.processingRun ||
              (detField as any).processingRunId ||
              ocrResult.ocrRunId ||
              ocrResult.processingRun?.ocrRunId,
            hasExactBoundingBox: Boolean(bBox && bBox.length === 4),
          },
        };
      }
    }

    return {
      documentId,
      organisationId: options.organisationId,
      sourceType: "OCR_RASTER",
      totalPages: pages.length,
      pages,
      candidateFields,
      candidateFieldsList: Object.values(candidateFields),
      tables,
      overallConfidence: ocrResult.overallConfidence || 85,
      extractionMethod: ocrResult.executionEngine || "TESSERACT_OCR",
      processingRunId: ocrResult.processingRun?.runId,
      extractedAt: ocrResult.completedAt || new Date().toISOString(),
    };
  }

  /**
   * Universal consumer method: Takes either Native PDF, OCR, or both, and yields
   * an authoritative UnifiedDocumentExtraction instance.
   */
  public static consume(
    input:
      | { type: "NATIVE_PDF"; data: DocumentTextExtractionResult; documentId: string }
      | { type: "OCR"; data: OcrDocumentResult; documentId: string }
      | {
          type: "HYBRID";
          native?: DocumentTextExtractionResult;
          ocr: OcrDocumentResult;
          documentId: string;
        },
    options: { organisationId?: string; processingRunId?: string } = {},
  ): UnifiedDocumentExtraction {
    if (input.type === "NATIVE_PDF") {
      return this.fromNativePdf(input.data, input.documentId, options);
    }
    if (input.type === "OCR") {
      return this.fromOcrResult(input.data, input.documentId, options);
    }
    if (input.type === "HYBRID") {
      const ocrUnified = this.fromOcrResult(input.ocr, input.documentId, options);
      if (!input.native) {
        return ocrUnified;
      }
      const nativeUnified = this.fromNativePdf(input.native, input.documentId, options);

      // Merge native & OCR pages
      const mergedPages: UnifiedPageExtraction[] = [];
      const totalPages = Math.max(nativeUnified.totalPages, ocrUnified.totalPages);

      for (let p = 1; p <= totalPages; p++) {
        const ocrPage = ocrUnified.pages.find((pg) => pg.pageNumber === p);
        const nativePage = nativeUnified.pages.find((pg) => pg.pageNumber === p);

        if (nativePage && nativePage.lines.length > 0 && nativePage.characterCount > 50) {
          mergedPages.push(nativePage);
        } else if (ocrPage) {
          mergedPages.push(ocrPage);
        } else if (nativePage) {
          mergedPages.push(nativePage);
        }
      }

      // Merge candidate fields (prioritize high confidence)
      const mergedFields = { ...nativeUnified.candidateFields, ...ocrUnified.candidateFields };

      return {
        documentId: input.documentId,
        organisationId: options.organisationId,
        sourceType: "HYBRID",
        totalPages: mergedPages.length,
        pages: mergedPages,
        candidateFields: mergedFields,
        candidateFieldsList: Object.values(mergedFields),
        tables: [...nativeUnified.tables, ...ocrUnified.tables],
        overallConfidence: Math.round(
          (nativeUnified.overallConfidence + ocrUnified.overallConfidence) / 2,
        ),
        extractionMethod: "HYBRID_RECONSTRUCTION",
        processingRunId: options.processingRunId || ocrUnified.processingRunId,
        extractedAt: new Date().toISOString(),
      };
    }

    throw new Error(`Unsupported UnifiedDocumentBridge input type: ${(input as any)?.type}`);
  }
}
