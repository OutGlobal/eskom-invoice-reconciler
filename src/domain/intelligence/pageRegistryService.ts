/**
 * Persistent Page Registry Service
 * ========================================================
 * Stage 4 of Document Intelligence Architecture:
 * Manages persistent page-level extraction records traceable back to
 * parent documents.
 *
 * Implements strict provenance tracking to answer:
 * "Where did this value come from?"
 *
 * Captures where technically possible:
 * - document ID
 * - page number
 * - page dimensions (width, height, aspect ratio, rotation, unit)
 * - extracted text
 * - extraction method
 * - OCR required
 * - OCR status
 * - processing timestamp
 * - layout information (structural blocks, detected tables, key-values)
 * - extraction confidence
 */

import { supabase } from "@/integrations/supabase/client";
import { LocalWorkspaceStore } from "@/lib/localWorkspaceStore";
import type {
  BoundingBox,
  ExtractionMethodType,
  OcrStatus,
  PageDimensions,
  PageLayoutAnalysis,
  PageRegistryRecord,
  PageValueOrigin,
} from "./types";

export class PageRegistryService {
  // In-memory cache keyed by documentId -> (pageNumber -> PageRegistryRecord)
  private static memoryStore: Map<string, Map<number, PageRegistryRecord>> = new Map();

  /**
   * Register or upsert a single page record
   */
  public static async registerPage(page: PageRegistryRecord): Promise<PageRegistryRecord> {
    const now = new Date().toISOString();
    const cleanPage: PageRegistryRecord = {
      ...page,
      id: page.id || crypto.randomUUID(),
      processingTimestamp: page.processingTimestamp || now,
      createdAt: page.createdAt || now,
      updatedAt: now,
      characterCount: page.characterCount ?? page.extractedText.length,
      hasText: page.hasText ?? page.extractedText.trim().length > 30,
      hasImages: page.hasImages ?? false,
      imageCount: page.imageCount ?? 0,
      isScanned: page.isScanned ?? !page.hasText,
      extractionConfidence: Number(page.extractionConfidence ?? 1.0),
    };

    // 1. Update in-memory store
    if (!this.memoryStore.has(cleanPage.documentId)) {
      this.memoryStore.set(cleanPage.documentId, new Map());
    }
    this.memoryStore.get(cleanPage.documentId)!.set(cleanPage.pageNumber, cleanPage);

    // 2. Persist to LocalWorkspaceStore (offline resilience)
    await LocalWorkspaceStore.savePageRecord(cleanPage).catch(() => undefined);

    // 3. Persist to database (public.document_pages or canonical view public.page_registry)
    try {
      const dbPayload = this.mapRecordToDbPayload(cleanPage);
      const dbPromise = supabase
        .from("document_pages" as any)
        .upsert(dbPayload, { onConflict: "document_id,page_number" })
        .select()
        .single();
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase timeout")), 400),
      );

      const { data, error } = (await Promise.race([dbPromise, timeoutPromise])) as any;

      if (!error && data) {
        const persisted = this.mapDbRowToRecord(data);
        this.memoryStore.get(cleanPage.documentId)!.set(cleanPage.pageNumber, persisted);
        return persisted;
      }
    } catch {
      // In offline / unit-test environments without active Supabase connection
    }

    return cleanPage;
  }

  /**
   * Batch register multiple pages for a document
   */
  public static async registerPagesBatch(
    pages: PageRegistryRecord[],
  ): Promise<PageRegistryRecord[]> {
    const results: PageRegistryRecord[] = [];
    for (const page of pages) {
      const saved = await this.registerPage(page);
      results.push(saved);
    }
    return results;
  }

  /**
   * Retrieve a specific page by documentId and pageNumber
   */
  public static async getPage(
    documentId: string,
    pageNumber: number,
    organisationId?: string,
  ): Promise<PageRegistryRecord | null> {
    // Check in-memory cache first
    const docPages = this.memoryStore.get(documentId);
    if (docPages && docPages.has(pageNumber)) {
      const memRecord = docPages.get(pageNumber)!;
      if (!organisationId || memRecord.organisationId === organisationId) {
        return memRecord;
      }
    }

    // Try LocalWorkspaceStore
    const localRecord = await LocalWorkspaceStore.getPageRecord(documentId, pageNumber).catch(
      () => null,
    );
    if (localRecord) {
      if (!organisationId || localRecord.organisationId === organisationId) {
        if (!this.memoryStore.has(documentId)) {
          this.memoryStore.set(documentId, new Map());
        }
        this.memoryStore.get(documentId)!.set(pageNumber, localRecord);
        return localRecord;
      }
    }

    // Query Supabase with timeout guard
    try {
      let query = supabase
        .from("document_pages" as any)
        .select("*")
        .eq("document_id", documentId)
        .eq("page_number", pageNumber);

      if (organisationId) {
        query = query.eq("organisation_id", organisationId);
      }

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase timeout")), 400),
      );

      const { data, error } = (await Promise.race([query.maybeSingle(), timeoutPromise])) as any;
      if (!error && data) {
        const record = this.mapDbRowToRecord(data);
        if (!this.memoryStore.has(documentId)) {
          this.memoryStore.set(documentId, new Map());
        }
        this.memoryStore.get(documentId)!.set(pageNumber, record);
        return record;
      }
    } catch {
      // Offline fallback
    }

    return null;
  }

  /**
   * List all pages belonging to a document, ordered chronologically by page_number
   */
  public static async listPagesForDocument(
    documentId: string,
    organisationId?: string,
  ): Promise<PageRegistryRecord[]> {
    // 1. Check in-memory store first (fast tier-1 cache)
    if (this.memoryStore.has(documentId) && this.memoryStore.get(documentId)!.size > 0) {
      let pages = Array.from(this.memoryStore.get(documentId)!.values()).sort(
        (a, b) => a.pageNumber - b.pageNumber,
      );
      if (organisationId) {
        pages = pages.filter((p) => !p.organisationId || p.organisationId === organisationId);
      }
      return pages;
    }

    let pages: PageRegistryRecord[] = [];

    // 2. Try Supabase with timeout guard
    try {
      let query = supabase
        .from("document_pages" as any)
        .select("*")
        .eq("document_id", documentId)
        .order("page_number", { ascending: true });

      if (organisationId) {
        query = query.eq("organisation_id", organisationId);
      }

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase timeout")), 400),
      );

      const { data, error } = (await Promise.race([query, timeoutPromise])) as any;
      if (!error && data && Array.isArray(data) && data.length > 0) {
        pages = data.map((row) => this.mapDbRowToRecord(row));
      }
    } catch {
      // Offline fallback
    }

    // 3. Fall back to LocalWorkspaceStore if database returned no results
    if (pages.length === 0) {
      const localPages = await LocalWorkspaceStore.listPageRecordsForDocument(documentId).catch(
        () => [],
      );
      if (localPages && localPages.length > 0) {
        pages = localPages;
      }
    }

    if (organisationId) {
      pages = pages.filter((p) => !p.organisationId || p.organisationId === organisationId);
    }

    // Update memory store cache
    if (pages.length > 0) {
      if (!this.memoryStore.has(documentId)) {
        this.memoryStore.set(documentId, new Map());
      }
      for (const p of pages) {
        this.memoryStore.get(documentId)!.set(p.pageNumber, p);
      }
    }

    return pages;
  }

  /**
   * Update page layout information and confidence after Stage 7 Layout Analysis
   */
  public static async updatePageLayout(
    documentId: string,
    pageNumber: number,
    layoutInfo: PageLayoutAnalysis,
    confidence?: number,
  ): Promise<PageRegistryRecord> {
    const existing = await this.getPage(documentId, pageNumber);
    if (!existing) {
      throw new Error(
        `Cannot update layout: Page ${pageNumber} of document '${documentId}' not registered`,
      );
    }

    const updated: PageRegistryRecord = {
      ...existing,
      layoutInformation: layoutInfo,
      layoutBlocks: layoutInfo.blocks,
      detectedTables: layoutInfo.tables,
      keyValues: layoutInfo.keyValues,
      extractionConfidence: confidence ?? existing.extractionConfidence,
      updatedAt: new Date().toISOString(),
    };

    return this.registerPage(updated);
  }

  /**
   * Update page OCR status and extracted text after OCR execution
   */
  public static async updatePageOcr(
    documentId: string,
    pageNumber: number,
    ocrStatus: OcrStatus,
    extractedText?: string,
  ): Promise<PageRegistryRecord> {
    const existing = await this.getPage(documentId, pageNumber);
    if (!existing) {
      throw new Error(
        `Cannot update OCR status: Page ${pageNumber} of document '${documentId}' not registered`,
      );
    }

    const updated: PageRegistryRecord = {
      ...existing,
      ocrStatus,
      ocrRequired: ocrStatus === "QUEUED" || ocrStatus === "PROCESSING",
      extractedText: extractedText !== undefined ? extractedText : existing.extractedText,
      characterCount: extractedText !== undefined ? extractedText.length : existing.characterCount,
      hasText: extractedText !== undefined ? extractedText.trim().length > 30 : existing.hasText,
      extractionMethod: ocrStatus === "COMPLETED" ? "TESSERACT_OCR" : existing.extractionMethod,
      updatedAt: new Date().toISOString(),
    };

    return this.registerPage(updated);
  }

  /**
   * Find Value Origin: Answers ENERA Validation Question:
   * "Where did this value come from?"
   *
   * Scans across page text, key-values, tables, and layout blocks to locate
   * the exact page number, bounding box, extraction method, and snippet.
   */
  public static async findValueOrigin(
    documentId: string,
    valueOrKeyword: string,
  ): Promise<PageValueOrigin[]> {
    const pages = await this.listPagesForDocument(documentId);
    const origins: PageValueOrigin[] = [];
    const query = String(valueOrKeyword).trim();
    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    const cleanQuery = query.replace(/[,\s]/g, "");

    for (const page of pages) {
      // 1. Check Key-Values
      if (page.keyValues && page.keyValues.length > 0) {
        for (const kv of page.keyValues) {
          const valClean = kv.rawValue.replace(/[,\s]/g, "");
          if (
            valClean.includes(cleanQuery) ||
            kv.rawValue.toLowerCase().includes(lowerQuery) ||
            kv.propertyKey.toLowerCase().includes(lowerQuery)
          ) {
            origins.push({
              documentId,
              pageNumber: page.pageNumber,
              fieldKey: kv.propertyKey,
              matchedText: `${kv.rawLabel}: ${kv.rawValue}`,
              extractionMethod: "KEY_VALUE_PAIR",
              confidence: kv.confidence,
              bbox: kv.valueBbox,
              contextSnippet: `${kv.rawLabel}: ${kv.rawValue}`,
              dimensions: page.dimensions,
              processingTimestamp: page.processingTimestamp,
            });
          }
        }
      }

      // 2. Check Detected Tables
      if (page.detectedTables && page.detectedTables.length > 0) {
        for (const tbl of page.detectedTables) {
          for (const row of tbl.rows) {
            for (const cell of row.cells) {
              const cellClean = cell.text.replace(/[,\s]/g, "");
              if (cellClean.includes(cleanQuery) || cell.text.toLowerCase().includes(lowerQuery)) {
                origins.push({
                  documentId,
                  pageNumber: page.pageNumber,
                  fieldKey: `table_${tbl.tableId}_row${cell.rowIndex}_col${cell.colIndex}`,
                  matchedText: cell.text,
                  extractionMethod: "LAYOUT_TABLE_CELL",
                  confidence: cell.confidence,
                  bbox: cell.bbox,
                  contextSnippet: `Table '${tbl.title || tbl.tableId}' Row ${cell.rowIndex + 1}: ${cell.text}`,
                  dimensions: page.dimensions,
                  processingTimestamp: page.processingTimestamp,
                });
              }
            }
          }
        }
      }

      // 3. Check Layout Blocks
      if (page.layoutBlocks && page.layoutBlocks.length > 0) {
        for (const block of page.layoutBlocks) {
          if (block.text.toLowerCase().includes(lowerQuery)) {
            // Avoid adding duplicate if already found in KV or Table
            const alreadyFound = origins.some(
              (o) => o.pageNumber === page.pageNumber && o.matchedText === block.text,
            );
            if (!alreadyFound) {
              origins.push({
                documentId,
                pageNumber: page.pageNumber,
                fieldKey: `block_${block.type.toLowerCase()}`,
                matchedText: block.text,
                extractionMethod: page.extractionMethod,
                confidence: block.confidence,
                bbox: block.bbox,
                contextSnippet: block.text.slice(0, 120),
                dimensions: page.dimensions,
                processingTimestamp: page.processingTimestamp,
              });
            }
          }
        }
      }

      // 4. Fallback: Search in raw extracted text lines
      if (origins.length === 0 && page.extractedText.toLowerCase().includes(lowerQuery)) {
        const lines = page.extractedText.split("\n");
        for (let idx = 0; idx < lines.length; idx++) {
          const line = lines[idx];
          if (line.toLowerCase().includes(lowerQuery)) {
            origins.push({
              documentId,
              pageNumber: page.pageNumber,
              fieldKey: "raw_text_stream",
              matchedText: line,
              extractionMethod: page.extractionMethod,
              confidence: page.extractionConfidence,
              contextSnippet: line,
              dimensions: page.dimensions,
              processingTimestamp: page.processingTimestamp,
            });
            break;
          }
        }
      }
    }

    return origins;
  }

  /**
   * Count total registered pages for a document
   */
  public static async countPagesForDocument(documentId: string): Promise<number> {
    const pages = await this.listPagesForDocument(documentId);
    return pages.length;
  }

  /**
   * Reset in-memory store (primarily for unit test isolation)
   */
  public static resetMemoryStore(): void {
    this.memoryStore.clear();
  }

  // =========================================================================
  // Mapping Helpers
  // =========================================================================

  private static mapRecordToDbPayload(record: PageRegistryRecord): Record<string, any> {
    return {
      id: record.id,
      document_id: record.documentId,
      organisation_id: record.organisationId || null,
      page_number: record.pageNumber,
      width: record.dimensions.width,
      height: record.dimensions.height,
      aspect_ratio: record.dimensions.aspectRatio,
      rotation: record.dimensions.rotation || 0,
      unit: record.dimensions.unit || "pt",
      orientation:
        record.orientation ||
        (record.dimensions.width > record.dimensions.height ? "LANDSCAPE" : "PORTRAIT"),
      extracted_text: record.extractedText,
      character_count: record.characterCount ?? record.extractedText.length,
      token_count: record.tokenCount ?? 0,
      has_text: record.hasText ?? record.extractedText.length > 30,
      has_images: record.hasImages ?? false,
      image_count: record.imageCount ?? 0,
      is_scanned: record.isScanned ?? false,
      extraction_method: record.extractionMethod,
      ocr_required: record.ocrRequired,
      ocr_status: record.ocrStatus,
      layout_information: record.layoutInformation || {},
      layout_blocks: record.layoutBlocks || [],
      detected_tables: record.detectedTables || [],
      key_values: record.keyValues || [],
      extraction_confidence: record.extractionConfidence,
      page_hash_sha256: record.pageHashSha256 || null,
      processing_timestamp: record.processingTimestamp,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    };
  }

  private static mapDbRowToRecord(row: Record<string, any>): PageRegistryRecord {
    const dim: PageDimensions = {
      width: Number(row.width || 595),
      height: Number(row.height || 842),
      aspectRatio: Number(row.aspect_ratio || 0.7071),
      rotation: (row.rotation || 0) as 0 | 90 | 180 | 270,
      unit: (row.unit || "pt") as "pt" | "px" | "mm",
    };

    return {
      id: row.id,
      documentId: row.document_id,
      organisationId: row.organisation_id || undefined,
      pageNumber: row.page_number,
      dimensions: dim,
      orientation: row.orientation || (dim.width > dim.height ? "LANDSCAPE" : "PORTRAIT"),
      extractedText: row.extracted_text || "",
      characterCount: row.character_count || (row.extracted_text || "").length,
      tokenCount: row.token_count || 0,
      hasText: Boolean(row.has_text),
      hasImages: Boolean(row.has_images),
      imageCount: row.image_count || 0,
      isScanned: Boolean(row.is_scanned),
      extractionMethod: (row.extraction_method || "PDF_TEXT_STREAM") as ExtractionMethodType,
      ocrRequired: Boolean(row.ocr_required),
      ocrStatus: (row.ocr_status || "NOT_REQUIRED") as OcrStatus,
      processingTimestamp: row.processing_timestamp || new Date().toISOString(),
      layoutInformation: row.layout_information || {},
      layoutBlocks: row.layout_blocks || [],
      detectedTables: row.detected_tables || [],
      keyValues: row.key_values || [],
      extractionConfidence: Number(row.extraction_confidence ?? 1.0),
      pageHashSha256: row.page_hash_sha256 || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
