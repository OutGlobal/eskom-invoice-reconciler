/**
 * Text Extraction Engine
 * ========================================================
 * Stage 5 of Document Intelligence Architecture:
 * Performs reliable native PDF text extraction first:
 * - Preserves page boundaries with strict per-page data structures
 * - Preserves line structure with vertical baseline clustering and line bounding boxes
 * - Preserves semantic paragraphs based on inter-line spacing and structural shifts
 * - Preserves meaningful horizontal whitespace and tabular column separation
 * - Detects table structures (rows, columns, headers, cells) where detectable
 * - Extracts and normalizes page-aware evidence entities:
 *   * numeric values
 *   * dates
 *   * account numbers
 *   * meter numbers
 *   * invoice numbers
 *   * tariff names
 *   * financial values (ZAR / R amounts)
 *   * utility units (kWh, kVA, c/kWh, R/kVA, etc.)
 *
 * Never flattens the PDF into one uncontrolled text blob.
 */

import { PdfjsLoader } from "./pdfjsLoader";
import type {
  BoundingBox,
  DetectedTable,
  DocumentTextExtractionResult,
  ExtractedPage,
  ExtractedParagraph,
  ExtractedTextLine,
  ExtractedTextToken,
  PageDimensions,
  PageEvidenceEntity,
  PageEvidenceEntityType,
  PageTextStructure,
  TableCell,
  TableColumn,
  TableRow,
} from "./types";

export class TextExtractionEngine {
  private static readonly VERTICAL_LINE_EPSILON = 5.5; // points tolerance for line alignment
  private static readonly PARAGRAPH_GAP_MULTIPLIER = 1.6; // multiplier for paragraph separation
  private static readonly COLUMN_GAP_THRESHOLD = 18; // points gap indicating table column

  /**
   * Primary entry point: Extracts full structured text across all pages preserving
   * page boundaries, lines, paragraphs, tables, meaningful whitespace, and entities.
   */
  public static async extractStructuredText(
    bytes: Uint8Array,
    pages: ExtractedPage[],
  ): Promise<DocumentTextExtractionResult> {
    const allLines = await this.extractTextLines(bytes, pages);
    const pageStructures: PageTextStructure[] = [];
    const allParagraphs: ExtractedParagraph[] = [];
    const allTables: DetectedTable[] = [];
    const allEntities: PageEvidenceEntity[] = [];

    const entitiesByType: Record<PageEvidenceEntityType, PageEvidenceEntity[]> = {
      NUMERIC_VALUE: [],
      DATE: [],
      ACCOUNT_NUMBER: [],
      METER_NUMBER: [],
      INVOICE_NUMBER: [],
      TARIFF_NAME: [],
      FINANCIAL_VALUE: [],
      UNIT: [],
    };

    const totalPages = Math.max(1, pages.length);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageModel = pages.find((p) => p.pageNumber === pageNum) || {
        pageNumber: pageNum,
        dimensions: {
          width: 595,
          height: 842,
          aspectRatio: 0.7071,
          rotation: 0,
          unit: "pt" as const,
        },
        hasText: false,
        isScanned: false,
        characterCount: 0,
        tokenCount: 0,
        rawText: "",
      };

      const pageLines = allLines.filter((l) => l.pageNumber === pageNum);
      const pageParagraphs = this.clusterParagraphs(pageNum, pageLines);
      const pageTables = this.detectPageTables(pageNum, pageLines);
      const pageEntities = this.extractPageEntities(pageNum, pageLines, pageParagraphs);

      // Reconstruct formatted page text preserving paragraphs and meaningful whitespace
      const fullText = pageParagraphs.map((p) => p.text).join("\n\n");
      const characterCount = fullText.replace(/\s+/g, "").length;
      const wordCount = fullText.trim().length > 0 ? fullText.trim().split(/\s+/).length : 0;
      const tokenCount = pageLines.reduce((acc, l) => acc + l.tokens.length, 0);

      const structure: PageTextStructure = {
        pageNumber: pageNum,
        dimensions: pageModel.dimensions,
        lines: pageLines,
        paragraphs: pageParagraphs,
        tables: pageTables,
        entities: pageEntities,
        rawText: fullText,
        characterCount,
        wordCount,
        tokenCount,
        isScanned: characterCount < 25,
        hasText: characterCount >= 25,
      };

      pageStructures.push(structure);
      allParagraphs.push(...pageParagraphs);
      allTables.push(...pageTables);
      allEntities.push(...pageEntities);

      for (const ent of pageEntities) {
        entitiesByType[ent.entityType].push(ent);
      }
    }

    return {
      pages: pageStructures,
      totalPageCount: totalPages,
      allLines,
      allParagraphs,
      allTables,
      allEntities,
      entitiesByType,
      extractionMethod: "PDF_TEXT_STREAM",
      processingTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract positioned text lines from pages and PDF bytes (backwards-compatible)
   */
  public static async extractTextLines(
    bytes: Uint8Array,
    pages: ExtractedPage[],
  ): Promise<ExtractedTextLine[]> {
    try {
      const pdfjsLines = await this.extractLinesWithPdfjs(bytes);
      if (pdfjsLines && pdfjsLines.length > 0) {
        return pdfjsLines;
      }
    } catch {
      // Fall through to fallback text reconstruction
    }

    return this.reconstructLinesFromPages(pages);
  }

  /**
   * High-precision positioned text extraction using PDF.js preserving meaningful whitespace
   */
  private static async extractLinesWithPdfjs(
    bytes: Uint8Array,
  ): Promise<ExtractedTextLine[] | null> {
    const doc = await PdfjsLoader.loadDocumentWithTimeout(bytes, 2500);
    const allLines: ExtractedTextLine[] = [];
    let globalLineCounter = 1;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();
      const pageHeight = viewport.height;

      const items = (textContent.items || []) as Array<{
        str?: string;
        transform?: number[];
        width?: number;
        height?: number;
        fontName?: string;
      }>;

      const positionedTokens: Array<ExtractedTextToken & { rawY: number }> = [];

      for (const item of items) {
        if (!item.str || !item.str.trim() || !item.transform || item.transform.length < 6) {
          continue;
        }

        const rawX = item.transform[4];
        const rawY = item.transform[5];
        const itemWidth = item.width || Math.max(8, item.str.length * 6);
        const itemHeight = item.height || Math.abs(item.transform[0]) || 10;

        // Convert PDF coordinate origin (bottom-left) to screen origin (top-left)
        const screenY = Math.max(0, pageHeight - rawY - itemHeight);
        const screenX = Math.max(0, rawX);

        const bbox: BoundingBox = [
          Math.round(screenX),
          Math.round(screenY),
          Math.round(itemWidth),
          Math.round(itemHeight),
        ];

        positionedTokens.push({
          text: item.str,
          bbox,
          fontSize: Math.round(itemHeight),
          fontFamily: item.fontName,
          confidence: 0.95,
          rawY: screenY,
        });
      }

      if (positionedTokens.length === 0) {
        continue;
      }

      // Sort top-to-bottom
      positionedTokens.sort((a, b) => a.rawY - b.rawY);

      // Cluster into lines using baseline tolerance
      const lineClusters: Array<{
        baselineY: number;
        tokens: ExtractedTextToken[];
      }> = [];

      for (const token of positionedTokens) {
        const matchingCluster = lineClusters.find(
          (cluster) => Math.abs(cluster.baselineY - token.rawY) <= this.VERTICAL_LINE_EPSILON,
        );

        if (matchingCluster) {
          matchingCluster.tokens.push(token);
        } else {
          lineClusters.push({
            baselineY: token.rawY,
            tokens: [token],
          });
        }
      }

      // Sort lines top-to-bottom
      lineClusters.sort((a, b) => a.baselineY - b.baselineY);

      for (const cluster of lineClusters) {
        // Sort tokens within line from left-to-right
        cluster.tokens.sort((a, b) => a.bbox[0] - b.bbox[0]);

        // Construct line text while preserving meaningful horizontal whitespace
        let lineText = "";
        for (let i = 0; i < cluster.tokens.length; i++) {
          const t = cluster.tokens[i];
          if (i === 0) {
            lineText = t.text;
          } else {
            const prev = cluster.tokens[i - 1];
            const gap = t.bbox[0] - (prev.bbox[0] + prev.bbox[2]);
            if (gap < 1) {
              lineText += t.text; // kerned
            } else if (gap < 14) {
              lineText += " " + t.text; // normal word space
            } else if (gap < 30) {
              lineText += "   " + t.text; // column or tab gap
            } else {
              const spaces = Math.min(12, Math.max(4, Math.round(gap / 8)));
              lineText += " ".repeat(spaces) + t.text; // wide table column gap
            }
          }
        }

        const trimmed = lineText.trim();
        if (!trimmed) continue;

        const minX = Math.min(...cluster.tokens.map((t) => t.bbox[0]));
        const minY = Math.min(...cluster.tokens.map((t) => t.bbox[1]));
        const maxX = Math.max(...cluster.tokens.map((t) => t.bbox[0] + t.bbox[2]));
        const maxY = Math.max(...cluster.tokens.map((t) => t.bbox[1] + t.bbox[3]));

        const lineBbox: BoundingBox = [
          minX,
          minY,
          Math.max(10, maxX - minX),
          Math.max(10, maxY - minY),
        ];

        allLines.push({
          lineNumber: globalLineCounter++,
          pageNumber: pageNum,
          text: lineText,
          bbox: lineBbox,
          tokens: cluster.tokens,
          confidence: 0.94,
        });
      }
    }

    if (allLines.length === 0) return null;
    return allLines;
  }

  /**
   * Fallback line reconstruction when PDF.js is unavailable
   */
  private static reconstructLinesFromPages(pages: ExtractedPage[]): ExtractedTextLine[] {
    const lines: ExtractedTextLine[] = [];
    let globalLineNumber = 1;

    for (const page of pages) {
      const rawText = page.rawText || "";
      const textParts = rawText
        .split(/\r?\n/)
        .map((s) => s.trimEnd())
        .filter((s) => s.trim().length > 0);

      const totalLinesOnPage = Math.max(1, textParts.length);
      const lineHeightEstimate = Math.min(
        18,
        Math.floor(page.dimensions.height / (totalLinesOnPage + 2)),
      );

      let currentY = 40; // top margin

      for (const part of textParts) {
        // Detect words and preserve multi-space column gaps
        const tokens: ExtractedTextToken[] = [];
        const wordsWithGaps = part.match(/\S+|\s{2,}/g) || [];
        let currentX = 50;

        for (const item of wordsWithGaps) {
          if (/^\s+$/.test(item)) {
            // Meaningful whitespace gap between columns
            currentX += Math.max(15, item.length * 7);
          } else {
            const wWidth = Math.max(12, item.length * 6);
            tokens.push({
              text: item,
              bbox: [currentX, currentY, wWidth, lineHeightEstimate],
              fontSize: 10,
              confidence: 0.88,
            });
            currentX += wWidth + 4;
          }
        }

        const lineBbox: BoundingBox = [
          50,
          currentY,
          Math.min(page.dimensions.width - 100, Math.max(50, currentX - 50)),
          lineHeightEstimate,
        ];

        lines.push({
          lineNumber: globalLineNumber++,
          pageNumber: page.pageNumber,
          text: part,
          bbox: lineBbox,
          tokens,
          confidence: 0.88,
        });

        currentY += lineHeightEstimate + 4;
      }
    }

    return lines;
  }

  /**
   * Cluster consecutive lines into semantic paragraphs
   */
  public static clusterParagraphs(
    pageNumber: number,
    lines: ExtractedTextLine[],
  ): ExtractedParagraph[] {
    if (lines.length === 0) return [];

    const paragraphs: ExtractedParagraph[] = [];
    let currentParaLines: ExtractedTextLine[] = [lines[0]];
    let paragraphCounter = 1;

    // Estimate median line height on page
    const lineHeights = lines.map((l) => l.bbox[3]).sort((a, b) => a - b);
    const medianHeight = lineHeights[Math.floor(lineHeights.length / 2)] || 12;

    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1];
      const curr = lines[i];

      const verticalGap = curr.bbox[1] - (prev.bbox[1] + prev.bbox[3]);
      const isPrevHeader =
        /^[A-Z0-9\s:_-]{4,50}$/.test(prev.text.trim()) && prev.tokens.length <= 6;
      const isCurrHeader =
        /^[A-Z0-9\s:_-]{4,50}$/.test(curr.text.trim()) && curr.tokens.length <= 6;
      const isCurrTotal = /^(total|net|subtotal)\b/i.test(curr.text.trim());
      const isLargeVerticalGap =
        verticalGap > Math.max(16, medianHeight * this.PARAGRAPH_GAP_MULTIPLIER);
      const isTableFormat = curr.text.includes("   ") || prev.text.includes("   ");

      if (isLargeVerticalGap || isPrevHeader || isCurrHeader || isCurrTotal || isTableFormat) {
        // Finalize previous paragraph
        paragraphs.push(this.buildParagraph(pageNumber, paragraphCounter++, currentParaLines));
        currentParaLines = [curr];
      } else {
        currentParaLines.push(curr);
      }
    }

    if (currentParaLines.length > 0) {
      paragraphs.push(this.buildParagraph(pageNumber, paragraphCounter++, currentParaLines));
    }

    return paragraphs;
  }

  private static buildParagraph(
    pageNumber: number,
    paragraphIndex: number,
    lines: ExtractedTextLine[],
  ): ExtractedParagraph {
    const minX = Math.min(...lines.map((l) => l.bbox[0]));
    const minY = Math.min(...lines.map((l) => l.bbox[1]));
    const maxX = Math.max(...lines.map((l) => l.bbox[0] + l.bbox[2]));
    const maxY = Math.max(...lines.map((l) => l.bbox[1] + l.bbox[3]));

    const paragraphText = lines.map((l) => l.text).join("\n");
    const avgConfidence = lines.reduce((acc, l) => acc + l.confidence, 0) / lines.length;

    return {
      paragraphId: `p${pageNumber}_para${paragraphIndex}`,
      pageNumber,
      text: paragraphText,
      bbox: [minX, minY, Math.max(20, maxX - minX), Math.max(10, maxY - minY)],
      lines,
      confidence: Number(avgConfidence.toFixed(3)),
      indentation: minX,
      lineCount: lines.length,
    };
  }

  /**
   * Detect tabular data regions from multi-column text lines
   */
  public static detectPageTables(pageNumber: number, lines: ExtractedTextLine[]): DetectedTable[] {
    const tables: DetectedTable[] = [];
    const tableRowClusters: ExtractedTextLine[][] = [];
    let currentTableRows: ExtractedTextLine[] = [];

    // Identify candidate lines that have column delimiters (2+ spaces or tab)
    for (const line of lines) {
      const parts = line.text.split(/\s{2,}|\t/).filter((p) => p.trim().length > 0);
      if (parts.length >= 2) {
        currentTableRows.push(line);
      } else {
        if (currentTableRows.length >= 2) {
          tableRowClusters.push([...currentTableRows]);
        }
        currentTableRows = [];
      }
    }

    if (currentTableRows.length >= 2) {
      tableRowClusters.push([...currentTableRows]);
    }

    let tableCounter = 1;
    for (const cluster of tableRowClusters) {
      const rows: TableRow[] = [];
      const colBounds: { minX: number; maxX: number; header: string }[] = [];

      cluster.forEach((line, rowIndex) => {
        const parts = line.text.split(/\s{3,}|\t/).filter((p) => p.trim().length > 0);
        const isHeader =
          rowIndex === 0 &&
          (/(period|consumption|rate|total|description|charge|amount|kwh|kva)/i.test(line.text) ||
            line.text === line.text.toUpperCase());

        const cells: TableCell[] = [];
        const approxColWidth = line.bbox[2] / Math.max(1, parts.length);

        parts.forEach((text, colIndex) => {
          const cellMinX = line.bbox[0] + colIndex * approxColWidth;
          const cellBbox: BoundingBox = [
            Math.round(cellMinX),
            line.bbox[1],
            Math.round(approxColWidth),
            line.bbox[3],
          ];

          cells.push({
            rowIndex,
            colIndex,
            text: text.trim(),
            bbox: cellBbox,
            isHeader,
            confidence: 0.95,
          });

          if (rowIndex === 0) {
            colBounds.push({
              minX: cellMinX,
              maxX: cellMinX + approxColWidth,
              header: text.trim(),
            });
          }
        });

        rows.push({
          rowIndex,
          cells,
          bbox: line.bbox,
          isHeaderRow: isHeader,
        });
      });

      const columns: TableColumn[] = colBounds.map((c, idx) => ({
        colIndex: idx,
        headerText: c.header,
        minX: c.minX,
        maxX: c.maxX,
      }));

      const minX = Math.min(...rows.map((r) => r.bbox[0]));
      const minY = Math.min(...rows.map((r) => r.bbox[1]));
      const maxX = Math.max(...rows.map((r) => r.bbox[0] + r.bbox[2]));
      const maxY = Math.max(...rows.map((r) => r.bbox[1] + r.bbox[3]));

      const title = rows[0]?.isHeaderRow
        ? `Table on Page ${pageNumber}`
        : `Data Grid on Page ${pageNumber}`;

      tables.push({
        tableId: `p${pageNumber}_tbl${tableCounter++}`,
        pageNumber,
        title,
        bbox: [minX, minY, maxX - minX, maxY - minY],
        columns,
        rows,
        confidence: 0.94,
      });
    }

    return tables;
  }

  /**
   * Extract page-aware evidence entities (dates, numeric values, accounts, meters,
   * invoice numbers, tariffs, financial values, units)
   */
  public static extractPageEntities(
    pageNumber: number,
    lines: ExtractedTextLine[],
    paragraphs: ExtractedParagraph[],
  ): PageEvidenceEntity[] {
    const entities: PageEvidenceEntity[] = [];
    let entityIdCounter = 1;

    for (const line of lines) {
      const text = line.text;

      // 1. DATES
      // Formats: YYYY/MM/DD, YYYY-MM-DD, DD/MM/YYYY, DD MMM YYYY, billing periods
      const dateRegex =
        /\b(?:(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})|(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+20\d{2}))\b/gi;
      let dateMatch: RegExpExecArray | null;
      while ((dateMatch = dateRegex.exec(text)) !== null) {
        const rawDate = dateMatch[0];
        entities.push({
          entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
          entityType: "DATE",
          rawValue: rawDate,
          normalizedValue: this.normalizeDate(rawDate),
          pageNumber,
          lineNumber: line.lineNumber,
          bbox: line.bbox,
          contextSnippet: line.text,
          confidence: 0.98,
        });
      }

      // 2. FINANCIAL VALUES (South African Rand)
      // e.g. R 1,842,910.45, R1842910.45, -R 45,000.00, R -45,000.00, ZAR 1234.56
      const finRegex = /(?:^|\s)(?:(R|ZAR)\s*([-+]?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.\d{2})?))/gi;
      let finMatch: RegExpExecArray | null;
      while ((finMatch = finRegex.exec(text)) !== null) {
        const rawVal = finMatch[0].trim();
        const numericStr = finMatch[2]?.replace(/[ ,]/g, "");
        const numVal = numericStr ? parseFloat(numericStr) : null;

        entities.push({
          entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
          entityType: "FINANCIAL_VALUE",
          rawValue: rawVal,
          normalizedValue: numVal,
          pageNumber,
          lineNumber: line.lineNumber,
          bbox: line.bbox,
          contextSnippet: line.text,
          confidence: 0.99,
          unit: "ZAR",
        });
      }

      // 3. ACCOUNT NUMBERS
      // Eskom 10-digit accounts and alphanumeric account indicators
      const accMatch = text.match(/(?:account(?:\s*no|\s*number)?|acc\s*no)[\s:#]*([0-9]{10})\b/i);
      if (accMatch) {
        entities.push({
          entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
          entityType: "ACCOUNT_NUMBER",
          rawValue: accMatch[1],
          normalizedValue: accMatch[1],
          pageNumber,
          lineNumber: line.lineNumber,
          bbox: line.bbox,
          contextSnippet: line.text,
          confidence: 0.99,
        });
      } else {
        // Fallback: standalone 10-digit number if line has account context
        const standaloneAcc = text.match(/\b([0-9]{10})\b/);
        if (standaloneAcc && /account|eskom|bill/i.test(text)) {
          entities.push({
            entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
            entityType: "ACCOUNT_NUMBER",
            rawValue: standaloneAcc[1],
            normalizedValue: standaloneAcc[1],
            pageNumber,
            lineNumber: line.lineNumber,
            bbox: line.bbox,
            contextSnippet: line.text,
            confidence: 0.92,
          });
        }
      }

      // 4. METER NUMBERS
      const meterMatch = text.match(
        /(?:meter(?:\s*no|\s*number|\s*serial)?|meter\s*id)[\s:#]*([A-Z0-9-]{6,16})/i,
      );
      if (meterMatch) {
        entities.push({
          entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
          entityType: "METER_NUMBER",
          rawValue: meterMatch[1],
          normalizedValue: meterMatch[1].toUpperCase(),
          pageNumber,
          lineNumber: line.lineNumber,
          bbox: line.bbox,
          contextSnippet: line.text,
          confidence: 0.98,
        });
      }

      // 5. INVOICE NUMBERS
      const invMatch = text.match(
        /(?:tax\s*invoice(?:\s*no|\s*number)?|invoice(?:\s*no|\s*number)?|inv\s*no)[\s:#]*([A-Z0-9-]{6,20})/i,
      );
      if (invMatch) {
        entities.push({
          entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
          entityType: "INVOICE_NUMBER",
          rawValue: invMatch[1],
          normalizedValue: invMatch[1],
          pageNumber,
          lineNumber: line.lineNumber,
          bbox: line.bbox,
          contextSnippet: line.text,
          confidence: 0.98,
        });
      }

      // 6. TARIFF NAMES
      const tariffRegex =
        /\b(Megaflex|Miniflex|Nightsave\s*Urban\s*\(Large\)|Nightsave\s*Urban\s*\(Small\)|Nightsave\s*Rural|Ruraflex|Business\s*Rate\s*[1-3]|Homepower\s*[1-4]|Landrate\s*[1-3])\b/gi;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tariffRegex.exec(text)) !== null) {
        entities.push({
          entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
          entityType: "TARIFF_NAME",
          rawValue: tMatch[0],
          normalizedValue: tMatch[0].toUpperCase().replace(/\s+/g, "_"),
          pageNumber,
          lineNumber: line.lineNumber,
          bbox: line.bbox,
          contextSnippet: line.text,
          confidence: 0.99,
        });
      }

      // 7. UNITS
      const unitRegex =
        /(?:\b(kWh|MWh|GWh|kVA|MVA|kW|MW|kVArh|MVArh|kVAr|c\/kWh|c\/kVA|R\/kVA|R\/month|R\/day|c\/kVArh)\b|(?<=\d|\s)(%)(?=\s|$|[.,;:!?-]))/gi;
      let uMatch: RegExpExecArray | null;
      while ((uMatch = unitRegex.exec(text)) !== null) {
        const unitVal = uMatch[1] || uMatch[2] || uMatch[0];
        entities.push({
          entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
          entityType: "UNIT",
          rawValue: unitVal,
          normalizedValue: unitVal,
          pageNumber,
          lineNumber: line.lineNumber,
          bbox: line.bbox,
          contextSnippet: line.text,
          confidence: 0.98,
          unit: unitVal,
        });
      }

      // 8. NUMERIC VALUES (General numbers, quantities, energy readings)
      // Matches integers or decimals with optional commas/spaces
      const numRegex = /\b(?:\d{1,3}(?:[ ,]\d{3})+(?:\.\d+)?|\d+\.\d+|\d{2,9})\b/g;
      let nMatch: RegExpExecArray | null;
      while ((nMatch = numRegex.exec(text)) !== null) {
        const rawNum = nMatch[0];
        // Skip pure 4-digit years like 2025/2026 or 10-digit account numbers already processed
        if (/^(202[0-9])$/.test(rawNum) || rawNum.length === 10) {
          continue;
        }

        const cleanVal = rawNum.replace(/[ ,]/g, "");
        const parsed = parseFloat(cleanVal);
        if (!isNaN(parsed)) {
          entities.push({
            entityId: `ent_p${pageNumber}_${entityIdCounter++}`,
            entityType: "NUMERIC_VALUE",
            rawValue: rawNum,
            normalizedValue: parsed,
            pageNumber,
            lineNumber: line.lineNumber,
            bbox: line.bbox,
            contextSnippet: line.text,
            confidence: 0.96,
          });
        }
      }
    }

    return entities;
  }

  // =========================================================================
  // Query Helpers for Page-Aware Evidence Lookups
  // =========================================================================

  /**
   * Find entities matching a query keyword or value across the structured document
   */
  public static findEntities(
    result: DocumentTextExtractionResult,
    query: string,
    pageNumber?: number,
  ): PageEvidenceEntity[] {
    const qClean = query.trim().toLowerCase().replace(/[,\s]/g, "");
    if (!qClean) return [];

    let pool = result.allEntities;
    if (pageNumber !== undefined) {
      pool = pool.filter((e) => e.pageNumber === pageNumber);
    }

    return pool.filter((e) => {
      const rawClean = e.rawValue.toLowerCase().replace(/[,\s]/g, "");
      const normClean = String(e.normalizedValue ?? "")
        .toLowerCase()
        .replace(/[,\s]/g, "");
      return rawClean.includes(qClean) || normClean.includes(qClean);
    });
  }

  /**
   * Find entities by specific type
   */
  public static findEntitiesByType(
    result: DocumentTextExtractionResult,
    type: PageEvidenceEntityType,
    pageNumber?: number,
  ): PageEvidenceEntity[] {
    const pool = result.entitiesByType[type] || [];
    if (pageNumber !== undefined) {
      return pool.filter((e) => e.pageNumber === pageNumber);
    }
    return pool;
  }

  /**
   * Get the formatted text structure for a single page
   */
  public static getPageStructure(
    result: DocumentTextExtractionResult,
    pageNumber: number,
  ): PageTextStructure | null {
    return result.pages.find((p) => p.pageNumber === pageNumber) || null;
  }

  // =========================================================================
  // Helper Formatters
  // =========================================================================

  private static normalizeDate(rawDate: string): string {
    const clean = rawDate.trim().replace(/\./g, "-").replace(/\//g, "-");

    // YYYY-MM-DD
    const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    }

    // DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
    }

    // DD Month YYYY (e.g. 15 Jan 2026)
    const monthMap: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };

    const textMatch = rawDate.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (textMatch) {
      const monthPrefix = textMatch[2].slice(0, 3).toLowerCase();
      const monthNum = monthMap[monthPrefix] || "01";
      return `${textMatch[3]}-${monthNum}-${textMatch[1].padStart(2, "0")}`;
    }

    return clean;
  }
}
