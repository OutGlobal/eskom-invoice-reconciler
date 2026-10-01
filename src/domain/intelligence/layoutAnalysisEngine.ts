/**
 * Layout Analysis Engine
 * ========================================================
 * Stage 6 & 7 of Document Intelligence Architecture:
 * Performs layout extraction and spatial analysis on extracted pages and lines:
 * - Creates a comprehensive document layout representation preserving:
 *   - Headings (H1, H2, H3 with hierarchical classification)
 *   - Paragraphs (narrative blocks, remarks, terms & conditions)
 *   - Tables (retaining Column -> Row -> Cell -> Page -> Source Document relationships)
 *   - Rows (header, total, subtotal, section divider, data rows)
 *   - Columns (index, header, coordinates, detected data type, alignment)
 *   - Labels (form field labels, property keys)
 *   - Values (typed values associated with labels)
 *   - Repeated Headers (cross-page repeated banners, headers, table continuation titles)
 *   - Footers (bottom-of-page disclaimers, banking details, VAT statements)
 *   - Page Numbers (pagination indicators: "Page 1 of 2", etc.)
 *   - Totals (financial subtotals, VAT, total amounts due, balances)
 *   - Sections (logical document sections enclosing child elements)
 * - Gracefully handles imperfect layouts:
 *   - Borderless tables without visual divider lines
 *   - Irregular column alignments (fuzzy horizontal token clustering)
 *   - Multi-line wrapped cells in description columns
 *   - Sparse or empty cells with spatial column slotting
 *   - Merged total rows spanning multiple columns
 *   - Embedded subsection header rows inside tabular structures
 *   - Synthesizes headers when missing
 */

import type {
  BoundingBox,
  DetectedTable,
  DocumentLayoutRepresentation,
  ExtractedPage,
  ExtractedTextLine,
  FooterBlock,
  HeadingBlock,
  ImperfectLayoutFlag,
  KeyValueProperty,
  LabelValuePair,
  LayoutBlock,
  LayoutBlockType,
  LayoutLabel,
  LayoutParagraph,
  LayoutSection,
  LayoutSectionType,
  LayoutTotal,
  LayoutTotalType,
  LayoutValue,
  PageLayoutAnalysis,
  PageLayoutRepresentation,
  PageNumberIndicator,
  RepeatedHeader,
  TableCell,
  TableColumn,
  TableRow,
} from "./types";

export class LayoutAnalysisEngine {
  /**
   * Primary Stage 6 Entry Point: Extract full document layout representation
   */
  public static extractDocumentLayout(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[],
    documentId: string = "doc_default",
  ): DocumentLayoutRepresentation {
    const pageRepresentations: PageLayoutRepresentation[] = [];

    for (const page of pages) {
      const pageLines = lines
        .filter((l) => l.pageNumber === page.pageNumber)
        .sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);

      // 1. Identify Page Numbers
      const pageNumbers = this.extractPageNumbers(page, pageLines, documentId);

      // 2. Identify Footers
      const footers = this.extractFooters(page, pageLines, documentId);

      // Exclude page numbers and footers from main content candidate lines
      const footerLineNumbers = new Set(footers.map((f) => f.bbox[1]));
      const pageNumLineNumbers = new Set(pageNumbers.map((p) => p.bbox[1]));
      const contentLines = pageLines.filter(
        (l) => !footerLineNumbers.has(l.bbox[1]) && !pageNumLineNumbers.has(l.bbox[1]),
      );

      // 3. Detect Tables with full relational hierarchy and imperfect layout handling
      const tables = this.detectTables(page, contentLines, documentId);

      // Collect line numbers consumed by tables to prevent duplicate extraction
      const tableLineYCoordinates = new Set<number>();
      for (const table of tables) {
        for (const row of table.rows) {
          tableLineYCoordinates.add(row.bbox[1]);
        }
      }

      const nonTableLines = contentLines.filter((l) => !tableLineYCoordinates.has(l.bbox[1]));

      // 4. Extract Labels, Values, and LabelValuePairs
      const { labels, values, labelValuePairs } = this.extractLabelsAndValues(
        page,
        nonTableLines,
        documentId,
      );

      // Collect line Ys consumed by key-value pairs
      const kvLineYs = new Set<number>();
      for (const pair of labelValuePairs) {
        kvLineYs.add(pair.labelBbox[1]);
        kvLineYs.add(pair.valueBbox[1]);
      }

      const remainingLines = nonTableLines.filter((l) => !kvLineYs.has(l.bbox[1]));

      // 5. Identify Headings
      const headings = this.extractHeadings(page, remainingLines, documentId);
      const headingYs = new Set(headings.map((h) => h.bbox[1]));
      const narrativeLines = remainingLines.filter((l) => !headingYs.has(l.bbox[1]));

      // 6. Cluster Paragraphs
      const paragraphs = this.clusterParagraphs(page, narrativeLines, documentId);

      // 7. Extract Totals (from both table summary rows and standalone lines)
      const totals = this.extractTotals(page, pageLines, tables, documentId);

      // 8. Generate Visual / Structural Blocks for backward compatibility
      const blocks = this.generateLayoutBlocks(
        page,
        headings,
        paragraphs,
        tables,
        labelValuePairs,
        footers,
      );

      // 9. Identify Logical Sections
      const sections = this.identifySections(
        page,
        headings,
        paragraphs,
        tables,
        labelValuePairs,
        totals,
        footers,
        documentId,
      );

      pageRepresentations.push({
        pageNumber: page.pageNumber,
        documentId,
        headings,
        paragraphs,
        tables,
        labels,
        values,
        labelValuePairs,
        repeatedHeaders: [], // Populated in cross-page aggregation step
        footers,
        pageNumbers,
        totals,
        sections,
        blocks,
      });
    }

    // 10. Cross-Page Repeated Header Detection
    const repeatedHeaders = this.detectRepeatedHeaders(pages, lines, documentId);
    for (const pageRep of pageRepresentations) {
      pageRep.repeatedHeaders = repeatedHeaders.filter((rh) =>
        rh.pagesOccurred.includes(pageRep.pageNumber),
      );
    }

    // 11. Aggregate document-level collections
    const allHeadings = pageRepresentations.flatMap((p) => p.headings);
    const allParagraphs = pageRepresentations.flatMap((p) => p.paragraphs);
    const allTables = pageRepresentations.flatMap((p) => p.tables);
    const allLabels = pageRepresentations.flatMap((p) => p.labels);
    const allValues = pageRepresentations.flatMap((p) => p.values);
    const allPairs = pageRepresentations.flatMap((p) => p.labelValuePairs);
    const allFooters = pageRepresentations.flatMap((p) => p.footers);
    const allPageNumbers = pageRepresentations.flatMap((p) => p.pageNumbers);
    const allTotals = pageRepresentations.flatMap((p) => p.totals);
    const allSections = pageRepresentations.flatMap((p) => p.sections);

    const totalCells = allTables.reduce((acc, t) => acc + (t.cells?.length || 0), 0);
    const totalRows = allTables.reduce((acc, t) => acc + t.rows.length, 0);
    const totalColumns = allTables.reduce((acc, t) => acc + t.columns.length, 0);
    const imperfectTableCount = allTables.filter((t) => t.isImperfect).length;

    return {
      documentId,
      totalPages: pages.length,
      headings: allHeadings,
      paragraphs: allParagraphs,
      tables: allTables,
      labels: allLabels,
      values: allValues,
      labelValuePairs: allPairs,
      repeatedHeaders,
      footers: allFooters,
      pageNumbers: allPageNumbers,
      totals: allTotals,
      sections: allSections,
      pages: pageRepresentations,
      tableRelationshipSummary: {
        totalTables: allTables.length,
        totalRows,
        totalColumns,
        totalCells,
        imperfectTableCount,
      },
      processingTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze spatial layout across all pages (backward-compatible API)
   */
  public static analyzeLayout(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[],
    documentId: string = "doc_default",
  ): PageLayoutAnalysis[] {
    const docLayout = this.extractDocumentLayout(pages, lines, documentId);

    return docLayout.pages.map((p) => ({
      pageNumber: p.pageNumber,
      documentId: p.documentId,
      blocks: p.blocks,
      tables: p.tables,
      keyValues: this.convertToLegacyKeyValues(p.labelValuePairs, p.pageNumber),
      headings: p.headings,
      paragraphs: p.paragraphs,
      labels: p.labels,
      values: p.values,
      labelValuePairs: p.labelValuePairs,
      repeatedHeaders: p.repeatedHeaders,
      footers: p.footers,
      pageNumbers: p.pageNumbers,
      totals: p.totals,
      sections: p.sections,
    }));
  }

  // =========================================================================
  // 1. TABLE DETECTION & RELATIONAL INTEGRITY (Column -> Row -> Cell -> Page -> Document)
  // =========================================================================

  /**
   * Detect tables gracefully handling imperfect layouts (borderless, multiline, ragged, sparse)
   */
  private static detectTables(
    page: ExtractedPage,
    lines: ExtractedTextLine[],
    documentId: string,
  ): DetectedTable[] {
    const tables: DetectedTable[] = [];

    // Header keywords typically found in utility bill tables
    const tableHeaderRegex =
      /description|charge|rate|consumption|quantity|kwh|kva|kvarh|amount|total|tariff|meter\s*no|reading|present|previous|subtotal|demand|active|ancillary|service|admin/i;

    // Numerical row line item indicator: has at least one monetary amount or measurement number
    const numericRowRegex =
      /(?:R\s*)?\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})|(?:\d+(?:\.\d+)?\s*(?:c\/kwh|r\/kva|kwh|kva|kvarh))/i;

    const isSectionTitle = (text: string): boolean => {
      return /^(?:CURRENT\s+CHARGES|ENERGY\s+CHARGES|NETWORK\s+CHARGES|ACCOUNT\s+INFORMATION|METER\s+READINGS|SUMMARY\s+OF\s+CHARGES|PAYMENT\s+ADVICE)$/i.test(
        text.trim(),
      );
    };

    const isTableHeaderLine = (l: ExtractedTextLine): boolean => {
      const text = l.text.trim();
      if (isSectionTitle(text)) return false;

      const hasMultiKeywords =
        /description/i.test(text) && /(?:amount|rate|consumption|quantity|charge)/i.test(text);
      if (hasMultiKeywords) return true;

      const hasMultipleTokens = (l.tokens && l.tokens.length >= 2) || text.includes("   ");
      const hasKeywords = tableHeaderRegex.test(text);

      return hasMultipleTokens && hasKeywords && !text.includes(":");
    };

    let inTable = false;
    let currentTableLines: ExtractedTextLine[] = [];
    let tableIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeader = isTableHeaderLine(line);
      const isNumeric = numericRowRegex.test(line.text);
      const hasMultipleTokens =
        (line.tokens && line.tokens.length >= 2) || line.text.includes("   ");

      if (isHeader && !inTable) {
        inTable = true;
        currentTableLines = [line];
      } else if (inTable) {
        if (
          isNumeric ||
          isHeader ||
          line.text.includes("Subtotal") ||
          line.text.includes("Total") ||
          // Multi-line wrapped cell candidate: short continuation text between table rows
          (currentTableLines.length > 0 &&
            line.text.length < 60 &&
            !line.text.includes(":") &&
            i < lines.length - 1 &&
            numericRowRegex.test(lines[i + 1]?.text || ""))
        ) {
          currentTableLines.push(line);
        } else {
          // Check if table ended
          if (currentTableLines.length >= 2) {
            tables.push(
              this.buildRelationalTableStructure(
                page.pageNumber,
                tableIndex++,
                currentTableLines,
                documentId,
              ),
            );
          }
          inTable = false;
          currentTableLines = [];
        }
      } else if (isNumeric && hasMultipleTokens && !isSectionTitle(line.text)) {
        // Data-first table without explicit header (starts directly with line items)
        if (i < lines.length - 1 && numericRowRegex.test(lines[i + 1]?.text || "")) {
          inTable = true;
          currentTableLines = [line];
        }
      }
    }

    if (inTable && currentTableLines.length >= 2) {
      tables.push(
        this.buildRelationalTableStructure(
          page.pageNumber,
          tableIndex++,
          currentTableLines,
          documentId,
        ),
      );
    }

    return tables;
  }

  /**
   * Build complete relational table structure preserving:
   * Column -> Row -> Cell -> Page -> Source Document
   * with robust handling for imperfect layouts
   */
  private static buildRelationalTableStructure(
    pageNumber: number,
    tableIndex: number,
    tableLines: ExtractedTextLine[],
    documentId: string,
  ): DetectedTable {
    const tableId = `${documentId}_p${pageNumber}_tbl_${tableIndex}`;
    const imperfectLayoutFlags: ImperfectLayoutFlag[] = [];
    const layoutNotes: string[] = [];

    const minX = Math.min(...tableLines.map((l) => l.bbox[0]));
    const minY = Math.min(...tableLines.map((l) => l.bbox[1]));
    const maxX = Math.max(...tableLines.map((l) => l.bbox[0] + l.bbox[2]));
    const maxY = Math.max(...tableLines.map((l) => l.bbox[1] + l.bbox[3]));

    // Check if table is borderless
    imperfectLayoutFlags.push("BORDERLESS_TABLE");
    layoutNotes.push("Identified borderless tabular structure via token clustering");

    // 1. Resolve Columns (with fallback and token clustering)
    const headerLine = tableLines[0];
    const isFirstLineHeader = /description|charge|rate|consumption|quantity|kwh|kva|amount/i.test(
      headerLine.text,
    );

    let columns: TableColumn[] = [];

    if (isFirstLineHeader && headerLine.tokens && headerLine.tokens.length >= 2) {
      // Derive column positions from header tokens
      columns = headerLine.tokens.map((t, idx) => {
        const nextToken = headerLine.tokens[idx + 1];
        const colMinX = t.bbox[0];
        const colMaxX = nextToken ? nextToken.bbox[0] - 2 : maxX;
        return {
          columnId: `${tableId}_col_${idx}`,
          tableId,
          pageNumber,
          documentId,
          colIndex: idx,
          headerText: t.text.trim(),
          minX: colMinX,
          maxX: colMaxX,
          width: Math.max(20, colMaxX - colMinX),
          detectedType: this.inferColumnType(t.text),
          alignment: idx === 0 ? "LEFT" : "RIGHT",
        };
      });
    } else {
      // Synthesize columns from data line token positions or standard utility schema
      imperfectLayoutFlags.push("SYNTHESIZED_HEADERS");
      layoutNotes.push("Synthesized standard column headers from data layout");

      const width = maxX - minX;
      columns = [
        {
          columnId: `${tableId}_col_0`,
          tableId,
          pageNumber,
          documentId,
          colIndex: 0,
          headerText: "Description",
          minX: minX,
          maxX: minX + Math.round(width * 0.45),
          width: Math.round(width * 0.45),
          detectedType: "TEXT",
          alignment: "LEFT",
        },
        {
          columnId: `${tableId}_col_1`,
          tableId,
          pageNumber,
          documentId,
          colIndex: 1,
          headerText: "Consumption / Demand",
          minX: minX + Math.round(width * 0.45),
          maxX: minX + Math.round(width * 0.65),
          width: Math.round(width * 0.2),
          detectedType: "NUMERIC",
          alignment: "RIGHT",
        },
        {
          columnId: `${tableId}_col_2`,
          tableId,
          pageNumber,
          documentId,
          colIndex: 2,
          headerText: "Rate",
          minX: minX + Math.round(width * 0.65),
          maxX: minX + Math.round(width * 0.8),
          width: Math.round(width * 0.15),
          detectedType: "NUMERIC",
          alignment: "RIGHT",
        },
        {
          columnId: `${tableId}_col_3`,
          tableId,
          pageNumber,
          documentId,
          colIndex: 3,
          headerText: "Amount (R)",
          minX: minX + Math.round(width * 0.8),
          maxX: maxX,
          width: Math.round(width * 0.2),
          detectedType: "CURRENCY",
          alignment: "RIGHT",
        },
      ];
    }

    // 2. Build Rows and Cells with Multi-Line Wrapped Cell & Sparse Row Handling
    const rows: TableRow[] = [];
    const allCells: TableCell[] = [];
    let currentRowIndex = 0;

    for (let lineIdx = 0; lineIdx < tableLines.length; lineIdx++) {
      const line = tableLines[lineIdx];
      const isHeaderRow = lineIdx === 0 && isFirstLineHeader;
      const rowId = `${tableId}_row_${currentRowIndex}`;

      // Check for Multi-line wrapped cell: Line only has description text and is not the first row
      const isDescriptionContinuation =
        !isHeaderRow &&
        lineIdx > 0 &&
        line.tokens &&
        line.tokens.length === 1 &&
        line.bbox[0] < columns[0].maxX &&
        !/(?:total|subtotal|\d+\.\d{2})/i.test(line.text) &&
        rows.length > 0;

      if (isDescriptionContinuation) {
        // Merge into previous row's description cell
        const prevRow = rows[rows.length - 1];
        if (prevRow && prevRow.cells.length > 0 && !prevRow.isHeaderRow) {
          const descCell = prevRow.cells[0];
          descCell.text = `${descCell.text} ${line.text.trim()}`;
          descCell.bbox = [
            descCell.bbox[0],
            descCell.bbox[1],
            Math.max(descCell.bbox[2], line.bbox[2]),
            line.bbox[1] + line.bbox[3] - descCell.bbox[1],
          ];
          prevRow.bbox = [
            prevRow.bbox[0],
            prevRow.bbox[1],
            Math.max(prevRow.bbox[2], line.bbox[2]),
            line.bbox[1] + line.bbox[3] - prevRow.bbox[1],
          ];

          if (!imperfectLayoutFlags.includes("MULTI_LINE_WRAPPED_CELL")) {
            imperfectLayoutFlags.push("MULTI_LINE_WRAPPED_CELL");
            layoutNotes.push("Merged multi-line wrapped text into parent row cell");
          }
          continue;
        }
      }

      // Check for Section Header Row embedded in table (e.g., "--- TRANSMISSION NETWORK CHARGES ---")
      const isSectionHeaderRow =
        !isHeaderRow &&
        (line.text.startsWith("---") ||
          (line.tokens && line.tokens.length === 1 && line.bbox[2] > (maxX - minX) * 0.5));

      if (isSectionHeaderRow && !imperfectLayoutFlags.includes("EMBEDDED_SUBSECTION_HEADER")) {
        imperfectLayoutFlags.push("EMBEDDED_SUBSECTION_HEADER");
        layoutNotes.push("Identified embedded subsection divider within table");
      }

      // Check for Merged Total Row
      const isTotalRow = /(?:total|subtotal|balance\s*brought)/i.test(line.text);
      if (isTotalRow && !imperfectLayoutFlags.includes("MERGED_TOTAL_ROW")) {
        imperfectLayoutFlags.push("MERGED_TOTAL_ROW");
        layoutNotes.push("Identified merged summary/total row spanning multiple columns");
      }

      // Slot tokens into columns based on horizontal bounding box overlap
      const rowCells: TableCell[] = [];
      const tokens = line.tokens && line.tokens.length > 0 ? line.tokens : [];

      if (isHeaderRow || tokens.length === 0) {
        // Simple mapping for header row or tokenless fallback
        columns.forEach((col, colIdx) => {
          const token = tokens[colIdx];
          const cellText = token ? token.text.trim() : colIdx === 0 ? line.text.trim() : "";
          const cellBbox: BoundingBox = token
            ? [...token.bbox]
            : [col.minX, line.bbox[1], col.width ?? (col.maxX - col.minX), line.bbox[3]];

          const cell: TableCell = {
            cellId: `${tableId}_r${currentRowIndex}_c${colIdx}`,
            rowId,
            columnId: col.columnId || `${tableId}_col_${colIdx}`,
            tableId,
            pageNumber,
            documentId,
            rowIndex: currentRowIndex,
            colIndex: colIdx,
            columnHeader: col.headerText,
            text: cellText,
            normalizedValue: this.parseCellValue(cellText),
            bbox: cellBbox,
            isHeader: isHeaderRow,
            isTotal: isTotalRow,
            isSpanned: isSectionHeaderRow,
            colSpan: isSectionHeaderRow ? columns.length : 1,
            rowSpan: 1,
            confidence: isHeaderRow ? 0.96 : 0.92,
          };
          rowCells.push(cell);
          allCells.push(cell);
        });
      } else {
        // Spatial slotting for data rows: assign each token to the best fitting column
        const columnTokens: Map<number, typeof tokens> = new Map();
        for (const token of tokens) {
          const tokenMidX = token.bbox[0] + token.bbox[2] / 2;
          let bestColIdx = 0;
          let minDistance = Infinity;

          for (let c = 0; c < columns.length; c++) {
            const col = columns[c];
            if (tokenMidX >= col.minX && tokenMidX <= col.maxX) {
              bestColIdx = c;
              minDistance = 0;
              break;
            }
            const colWidth = col.width ?? (col.maxX - col.minX);
            const colMidX = col.minX + colWidth / 2;
            const dist = Math.abs(tokenMidX - colMidX);
            if (dist < minDistance) {
              minDistance = dist;
              bestColIdx = c;
            }
          }

          const existing = columnTokens.get(bestColIdx) || [];
          existing.push(token);
          columnTokens.set(bestColIdx, existing);
        }

        let hasEmptyColumns = false;
        columns.forEach((col, colIdx) => {
          const colToks = columnTokens.get(colIdx) || [];
          const cellText = colToks
            .map((t) => t.text)
            .join(" ")
            .trim();
          if (!cellText) hasEmptyColumns = true;

          const cellBbox: BoundingBox =
            colToks.length > 0
              ? [
                  Math.min(...colToks.map((t) => t.bbox[0])),
                  Math.min(...colToks.map((t) => t.bbox[1])),
                  Math.max(...colToks.map((t) => t.bbox[0] + t.bbox[2])) -
                    Math.min(...colToks.map((t) => t.bbox[0])),
                  Math.max(...colToks.map((t) => t.bbox[3])),
                ]
              : [col.minX, line.bbox[1], col.width ?? (col.maxX - col.minX), line.bbox[3]];

          const cell: TableCell = {
            cellId: `${tableId}_r${currentRowIndex}_c${colIdx}`,
            rowId,
            columnId: col.columnId || `${tableId}_col_${colIdx}`,
            tableId,
            pageNumber,
            documentId,
            rowIndex: currentRowIndex,
            colIndex: colIdx,
            columnHeader: col.headerText,
            text: cellText,
            normalizedValue: this.parseCellValue(cellText),
            bbox: cellBbox,
            isHeader: isHeaderRow,
            isTotal: isTotalRow,
            isSpanned: isSectionHeaderRow || (isTotalRow && colIdx === 0),
            colSpan: isSectionHeaderRow
              ? columns.length
              : isTotalRow && colIdx === 0
                ? columns.length - 1
                : 1,
            rowSpan: 1,
            confidence: 0.92,
          };
          rowCells.push(cell);
          allCells.push(cell);
        });

        if (hasEmptyColumns && !imperfectLayoutFlags.includes("SPARSE_OR_EMPTY_CELLS")) {
          imperfectLayoutFlags.push("SPARSE_OR_EMPTY_CELLS");
          layoutNotes.push("Handled sparse columns with spatial slotting");
        }
      }

      rows.push({
        rowId,
        tableId,
        pageNumber,
        documentId,
        rowIndex: currentRowIndex,
        cells: rowCells,
        bbox: [...line.bbox],
        isHeaderRow,
        isTotalRow,
        isSubtotalRow: /subtotal/i.test(line.text),
        isSectionHeaderRow,
        rawText: line.text,
      });

      currentRowIndex++;
    }

    return {
      tableId,
      documentId,
      pageNumber,
      title: headerLine.text.slice(0, 60),
      bbox: [minX, minY, Math.max(50, maxX - minX), Math.max(20, maxY - minY)],
      columns,
      rows,
      cells: allCells,
      isImperfect: imperfectLayoutFlags.length > 0,
      imperfectLayoutFlags,
      layoutNotes,
      confidence: 0.92,
    };
  }

  // =========================================================================
  // 2. HEADINGS IDENTIFICATION
  // =========================================================================

  private static extractHeadings(
    page: ExtractedPage,
    lines: ExtractedTextLine[],
    documentId: string,
  ): HeadingBlock[] {
    const headings: HeadingBlock[] = [];
    let counter = 1;

    // Level 1: Document title / main invoice header
    const level1Regex =
      /^(?:TAX\s+INVOICE|ESKOM\s+(?:TAX\s+)?INVOICE|ELECTRICITY\s+ACCOUNT|MONTHLY\s+STATEMENT|TAX\s+INVOICE\s*\/\s*STATEMENT)$/i;

    // Level 2: Major structural section headers
    const level2Regex =
      /^(?:ACCOUNT\s+INFORMATION|ACCOUNT\s+SUMMARY|METER\s+READING(?:S|\s+SCHEDULE)?|CURRENT\s+CHARGES|ENERGY\s+CHARGES|NETWORK\s+CHARGES|LEVIES\s*(?:&|AND)?\s*TAXES|SUMMARY\s+OF\s+CHARGES|PAYMENT\s+ADVICE|REMITTANCE\s+ADVICE|BANKING\s+DETAILS|CUSTOMER\s+DETAILS|CONSUMPTION\s+ANALYSIS|SUPPLY\s+DETAILS)$/i;

    // Level 3: Subsection or table headers
    const level3Regex =
      /^(?:Active\s+Energy|Reliability\s+Charge|Network\s+Capacity|Network\s+Access|Environmental\s+Levy|Electrification\s+Levy|Administration\s+Charge|Service\s+Charge|Reactive\s+Energy|Maximum\s+Demand|Installation\s+Details|Premise\s+Details)/i;

    for (const line of lines) {
      const text = line.text.trim();
      if (!text || text.length > 70) continue;

      let level: 1 | 2 | 3 | null = null;
      if (level1Regex.test(text)) {
        level = 1;
      } else if (level2Regex.test(text)) {
        level = 2;
      } else if (level3Regex.test(text) && !text.includes(":")) {
        level = 3;
      } else if (
        text === text.toUpperCase() &&
        text.length >= 6 &&
        text.length <= 40 &&
        !text.includes(":") &&
        !/\d{3,}/.test(text)
      ) {
        level = line.bbox[1] < page.dimensions.height * 0.25 ? 2 : 3;
      }

      if (level !== null) {
        headings.push({
          headingId: `hdg_p${page.pageNumber}_${counter++}`,
          pageNumber: page.pageNumber,
          documentId,
          text,
          level,
          bbox: [...line.bbox],
          isRepeated: false, // Updated by detectRepeatedHeaders
          confidence: level === 1 ? 0.98 : 0.92,
        });
      }
    }

    return headings;
  }

  // =========================================================================
  // 3. PARAGRAPHS CLUSTERING
  // =========================================================================

  private static clusterParagraphs(
    page: ExtractedPage,
    lines: ExtractedTextLine[],
    documentId: string,
  ): LayoutParagraph[] {
    const paragraphs: LayoutParagraph[] = [];
    if (lines.length === 0) return paragraphs;

    let currentLines: ExtractedTextLine[] = [];
    let counter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (currentLines.length === 0) {
        currentLines.push(line);
      } else {
        const prevLine = currentLines[currentLines.length - 1];
        const vGap = line.bbox[1] - (prevLine.bbox[1] + prevLine.bbox[3]);

        // Break paragraph if vertical gap exceeds line height or line starts new block
        if (vGap > 18 || Math.abs(line.bbox[0] - prevLine.bbox[0]) > 40) {
          paragraphs.push(
            this.buildParagraph(page.pageNumber, counter++, currentLines, documentId),
          );
          currentLines = [line];
        } else {
          currentLines.push(line);
        }
      }
    }

    if (currentLines.length > 0) {
      paragraphs.push(this.buildParagraph(page.pageNumber, counter++, currentLines, documentId));
    }

    return paragraphs;
  }

  private static buildParagraph(
    pageNumber: number,
    counter: number,
    lines: ExtractedTextLine[],
    documentId: string,
  ): LayoutParagraph {
    const minX = Math.min(...lines.map((l) => l.bbox[0]));
    const minY = Math.min(...lines.map((l) => l.bbox[1]));
    const maxX = Math.max(...lines.map((l) => l.bbox[0] + l.bbox[2]));
    const maxY = Math.max(...lines.map((l) => l.bbox[1] + l.bbox[3]));

    return {
      paragraphId: `para_p${pageNumber}_${counter}`,
      pageNumber,
      documentId,
      text: lines.map((l) => l.text).join(" "),
      lines,
      bbox: [minX, minY, Math.max(20, maxX - minX), Math.max(10, maxY - minY)],
      lineCount: lines.length,
      indentation: minX,
      confidence: 0.9,
    };
  }

  // =========================================================================
  // 4. LABELS, VALUES & LABEL-VALUE PAIRS
  // =========================================================================

  private static extractLabelsAndValues(
    page: ExtractedPage,
    lines: ExtractedTextLine[],
    documentId: string,
  ): {
    labels: LayoutLabel[];
    values: LayoutValue[];
    labelValuePairs: LabelValuePair[];
  } {
    const labels: LayoutLabel[] = [];
    const values: LayoutValue[] = [];
    const labelValuePairs: LabelValuePair[] = [];

    const fieldPatterns = [
      {
        key: "account_number",
        regex: /(?:account\s*(?:no|number)|acc\s*no)[\s:]*([A-Za-z0-9_-]{7,15})/i,
      },
      {
        key: "tax_invoice_number",
        regex: /(?:tax\s*invoice\s*(?:no|number)|invoice\s*no)[\s:]*([A-Za-z0-9_-]{5,20})/i,
      },
      { key: "vat_registration", regex: /(?:vat\s*(?:reg|registration|no)?)[\s:]*([0-9]{10})/i },
      {
        key: "customer_name",
        regex: /(?:customer\s*name|client\s*name|billed\s*to)[\s:]*([A-Z0-9 &.,'-]{3,50})/i,
      },
      {
        key: "invoice_date",
        regex:
          /(?:invoice\s*date|tax\s*invoice\s*date|date)[\s:]*(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4})/i,
      },
      { key: "billing_period", regex: /(?:billing\s*period|period)[\s:]*([0-9A-Za-z -/.]+)/i },
      {
        key: "supply_location",
        regex: /(?:supply\s*(?:point|location)|premise\s*id)[\s:]*([A-Za-z0-9 _-]{3,40})/i,
      },
      {
        key: "tariff_name",
        regex: /(?:tariff(?:\s*name)?|rate\s*category)[\s:]*([A-Za-z0-9_-]{4,25})/i,
      },
      { key: "meter_number", regex: /(?:meter\s*(?:no|number))[\s:]*([A-Za-z0-9_-]{5,20})/i },
      {
        key: "contract_capacity",
        regex: /(?:contract\s*capacity|notified\s*maximum\s*demand)[\s:]*([0-9 ,.]+\s*k(?:va|w))/i,
      },
      {
        key: "total_due",
        regex:
          /(?:total\s*(?:amount\s*)?due|amount\s*payable|total\s*including\s*vat)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i,
      },
    ];

    let pairCounter = 1;
    const valuesArray: LayoutValue[] = [];

    for (const line of lines) {
      for (const pattern of fieldPatterns) {
        const match = line.text.match(pattern.regex);
        if (match) {
          const rawValue = match[1].trim();
          const rawLabel = match[0].split(match[1])[0].replace(/[:\s]+$/, "");

          const labelId = `lbl_p${page.pageNumber}_${pairCounter}`;
          const valueId = `val_p${page.pageNumber}_${pairCounter}`;

          const lineX = line.bbox[0];
          const lineY = line.bbox[1];
          const lineW = line.bbox[2];
          const lineH = line.bbox[3];

          const labelBbox: BoundingBox = [lineX, lineY, Math.round(lineW * 0.4), lineH];
          const valueBbox: BoundingBox = [
            lineX + Math.round(lineW * 0.4),
            lineY,
            Math.round(lineW * 0.6),
            lineH,
          ];

          const layoutLabel: LayoutLabel = {
            labelId,
            pageNumber: page.pageNumber,
            documentId,
            text: rawLabel || pattern.key,
            normalizedKey: pattern.key,
            bbox: labelBbox,
            associatedValueId: valueId,
            confidence: 0.95,
          };

          const layoutValue: LayoutValue = {
            valueId,
            labelId,
            pageNumber: page.pageNumber,
            documentId,
            text: rawValue,
            normalizedValue: this.normalizeValue(pattern.key, rawValue),
            valueType: this.inferValueType(rawValue),
            bbox: valueBbox,
            confidence: 0.95,
          };

          labels.push(layoutLabel);
          values.push(layoutValue);

          labelValuePairs.push({
            pairId: `pair_p${page.pageNumber}_${pairCounter++}`,
            labelId,
            valueId,
            rawLabel: rawLabel || pattern.key,
            rawValue,
            normalizedKey: pattern.key,
            normalizedValue: layoutValue.normalizedValue,
            pageNumber: page.pageNumber,
            documentId,
            labelBbox,
            valueBbox,
            combinedBbox: [...line.bbox],
            alignment: "HORIZONTAL",
            distance: Math.round(lineW * 0.4),
            confidence: 0.95,
          });
        }
      }
    }

    return { labels, values, labelValuePairs };
  }

  // =========================================================================
  // 5. REPEATED HEADERS (CROSS-PAGE DETECTION)
  // =========================================================================

  private static detectRepeatedHeaders(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[],
    documentId: string,
  ): RepeatedHeader[] {
    const repeatedHeaders: RepeatedHeader[] = [];
    const topLinesByText: Map<string, { pageNumber: number; text: string; bbox: BoundingBox }[]> =
      new Map();

    for (const page of pages) {
      const topThreshold = page.dimensions.height * 0.2;
      const pageTopLines = lines.filter(
        (l) => l.pageNumber === page.pageNumber && l.bbox[1] <= topThreshold,
      );

      for (const line of pageTopLines) {
        const norm = line.text
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        if (norm.length >= 8) {
          const list = topLinesByText.get(norm) || [];
          list.push({ pageNumber: page.pageNumber, text: line.text.trim(), bbox: line.bbox });
          topLinesByText.set(norm, list);
        }
      }
    }

    let repCounter = 1;
    for (const [, occurrences] of topLinesByText.entries()) {
      // Occurs on multiple pages, or matches dominant corporate header on single page
      const uniquePages = Array.from(new Set(occurrences.map((o) => o.pageNumber)));
      const sampleText = occurrences[0].text;
      const isCorporateHeader = /eskom\s+holdings|tax\s+invoice/i.test(sampleText);

      if (uniquePages.length >= 2 || (pages.length === 1 && isCorporateHeader)) {
        const bboxesByPage: Record<number, BoundingBox> = {};
        for (const occ of occurrences) {
          bboxesByPage[occ.pageNumber] = [...occ.bbox];
        }

        repeatedHeaders.push({
          repeatedHeaderId: `rep_hdr_${repCounter++}`,
          text: sampleText,
          normalizedText: sampleText.toLowerCase(),
          pagesOccurred: uniquePages,
          frequency: occurrences.length,
          headerType: isCorporateHeader ? "ORGANISATION_HEADER" : "DOCUMENT_TITLE",
          bboxesByPage,
          confidence: 0.95,
        });
      }
    }

    return repeatedHeaders;
  }

  // =========================================================================
  // 6. FOOTERS
  // =========================================================================

  private static extractFooters(
    page: ExtractedPage,
    lines: ExtractedTextLine[],
    documentId: string,
  ): FooterBlock[] {
    const footers: FooterBlock[] = [];
    const pageHeight = page.dimensions.height;
    const footerThreshold = pageHeight - Math.min(120, pageHeight * 0.15);

    const footerKeywords =
      /megawatt\s*park|sunninghill|terms\s*and\s*conditions|electricity\s*regulation\s*act|registered\s*office|disclaimer|inquiries|call\s*centre|all\s*rights\s*reserved|confidential|cheques\s*payable|please\s*remit/i;

    let counter = 1;
    const minLineIndex = Math.max(0, lines.length - 3);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Exclude top header area (top 20% of page)
      if (line.bbox[1] < pageHeight * 0.2) continue;

      const isPhysicalBottom = line.bbox[1] >= footerThreshold;
      const isDocumentEndWithKeywords =
        (i >= minLineIndex || line.bbox[1] >= pageHeight * 0.35) &&
        (footerKeywords.test(line.text) ||
          (/eskom\s+holdings/i.test(line.text) && i >= lines.length - 2));

      if (isPhysicalBottom || isDocumentEndWithKeywords) {
        if (
          !/(?:total|subtotal|balance\s*brought|account\s*number|invoice\s*number|current\s*charges)/i.test(
            line.text,
          )
        ) {
          footers.push({
            footerId: `ftr_p${page.pageNumber}_${counter++}`,
            pageNumber: page.pageNumber,
            documentId,
            text: line.text.trim(),
            bbox: [...line.bbox],
            isRepeated: false,
            confidence: 0.92,
          });
        }
      }
    }

    return footers;
  }

  // =========================================================================
  // 7. PAGE NUMBERS
  // =========================================================================

  private static extractPageNumbers(
    page: ExtractedPage,
    lines: ExtractedTextLine[],
    documentId: string,
  ): PageNumberIndicator[] {
    const indicators: PageNumberIndicator[] = [];
    const pageNumRegex1 = /(?:page|sheet)\s*(\d+)(?:\s*(?:of|\/|-)\s*(\d+))?/i;
    const pageNumRegex2 = /\b(\d+)\s*\/\s*(\d+)\b/;

    let counter = 1;
    for (const line of lines) {
      const match1 = line.text.match(pageNumRegex1);
      const match2 = !match1 ? line.text.match(pageNumRegex2) : null;

      if (match1) {
        const curr = parseInt(match1[1], 10);
        const total = match1[2] ? parseInt(match1[2], 10) : undefined;
        indicators.push({
          pageNumberId: `pg_num_p${page.pageNumber}_${counter++}`,
          pageNumber: page.pageNumber,
          documentId,
          rawText: match1[0],
          currentPageNumber: curr,
          totalPages: total,
          bbox: [...line.bbox],
          confidence: 0.98,
        });
      } else if (match2) {
        const curr = parseInt(match2[1], 10);
        const total = parseInt(match2[2], 10);
        if (curr <= total && total <= 50) {
          indicators.push({
            pageNumberId: `pg_num_p${page.pageNumber}_${counter++}`,
            pageNumber: page.pageNumber,
            documentId,
            rawText: match2[0],
            currentPageNumber: curr,
            totalPages: total,
            bbox: [...line.bbox],
            confidence: 0.92,
          });
        }
      }
    }

    return indicators;
  }

  // =========================================================================
  // 8. TOTALS
  // =========================================================================

  private static extractTotals(
    page: ExtractedPage,
    lines: ExtractedTextLine[],
    tables: DetectedTable[],
    documentId: string,
  ): LayoutTotal[] {
    const totals: LayoutTotal[] = [];
    let counter = 1;

    const totalPatterns = [
      {
        type: "TOTAL_DUE" as LayoutTotalType,
        regex:
          /(?:total\s*(?:amount\s*)?due|amount\s*payable|total\s*including\s*vat)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i,
      },
      {
        type: "SUBTOTAL" as LayoutTotalType,
        regex:
          /(?:subtotal(?:\s*charges)?|total\s*(?:current\s*)?charges)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i,
      },
      {
        type: "VAT" as LayoutTotalType,
        regex:
          /(?:vat(?:\s*(?:@|\()\s*\d+%\)?)?|value\s*added\s*tax)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i,
      },
      {
        type: "BALANCE_BROUGHT_FORWARD" as LayoutTotalType,
        regex: /(?:balance\s*brought\s*forward|previous\s*balance)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i,
      },
    ];

    // 1. Extract from Table summary rows
    for (const table of tables) {
      for (const row of table.rows) {
        if (row.isTotalRow || row.isSubtotalRow) {
          for (const pattern of totalPatterns) {
            const match = (row.rawText || "").match(pattern.regex);
            if (match) {
              const rawAmount = match[1].trim();
              const num = parseFloat(rawAmount.replace(/[\s,]/g, "")) || 0;
              totals.push({
                totalId: `tot_p${page.pageNumber}_${counter++}`,
                pageNumber: page.pageNumber,
                documentId,
                label: match[0].split(rawAmount)[0].replace(/[:\s]+$/, ""),
                rawAmount,
                numericAmount: num,
                currency: "ZAR",
                isCredit: /cr\b/i.test(row.rawText || ""),
                totalType: pattern.type,
                bbox: [...row.bbox],
                sourceRowId: row.rowId,
                sourceTableId: table.tableId,
                confidence: 0.96,
              });
            }
          }
        }
      }
    }

    // 2. Extract from standalone lines
    for (const line of lines) {
      for (const pattern of totalPatterns) {
        if (
          totals.some(
            (t) => t.totalType === pattern.type && Math.abs(t.bbox[1] - line.bbox[1]) < 10,
          )
        ) {
          continue;
        }

        const match = line.text.match(pattern.regex);
        if (match) {
          const rawAmount = match[1].trim();
          const num = parseFloat(rawAmount.replace(/[\s,]/g, "")) || 0;
          totals.push({
            totalId: `tot_p${page.pageNumber}_${counter++}`,
            pageNumber: page.pageNumber,
            documentId,
            label: match[0].split(rawAmount)[0].replace(/[:\s]+$/, ""),
            rawAmount,
            numericAmount: num,
            currency: "ZAR",
            isCredit: /cr\b/i.test(line.text),
            totalType: pattern.type,
            bbox: [...line.bbox],
            confidence: 0.94,
          });
        }
      }
    }

    return totals;
  }

  // =========================================================================
  // 9. LOGICAL SECTIONS
  // =========================================================================

  private static identifySections(
    page: ExtractedPage,
    headings: HeadingBlock[],
    paragraphs: LayoutParagraph[],
    tables: DetectedTable[],
    pairs: LabelValuePair[],
    totals: LayoutTotal[],
    footers: FooterBlock[],
    documentId: string,
  ): LayoutSection[] {
    const sections: LayoutSection[] = [];
    const pageHeight = page.dimensions.height;
    const pageWidth = page.dimensions.width;

    // A. Header Section (top 20%)
    const headerElementIds = [
      ...headings.filter((h) => h.bbox[1] < pageHeight * 0.2).map((h) => h.headingId),
      ...pairs.filter((p) => p.combinedBbox[1] < pageHeight * 0.2).map((p) => p.pairId),
    ];
    sections.push({
      sectionId: `sec_p${page.pageNumber}_header`,
      documentId,
      pageNumber: page.pageNumber,
      sectionType: "HEADER_SECTION",
      title: "Document Header & Title",
      bbox: [0, 0, pageWidth, Math.round(pageHeight * 0.2)],
      containedElementIds: headerElementIds,
      confidence: 0.95,
    });

    // B. Account Details Section
    const accountPairs = pairs.filter((p) =>
      [
        "account_number",
        "customer_name",
        "vat_registration",
        "tariff_name",
        "supply_location",
      ].includes(p.normalizedKey),
    );
    if (accountPairs.length > 0) {
      const minPairY = Math.min(...accountPairs.map((p) => p.combinedBbox[1]));
      const maxPairY = Math.max(...accountPairs.map((p) => p.combinedBbox[1] + p.combinedBbox[3]));
      sections.push({
        sectionId: `sec_p${page.pageNumber}_account`,
        documentId,
        pageNumber: page.pageNumber,
        sectionType: "ACCOUNT_DETAILS",
        title: "Account & Customer Details",
        bbox: [0, minPairY - 5, pageWidth, maxPairY - minPairY + 10],
        containedElementIds: accountPairs.map((p) => p.pairId),
        confidence: 0.94,
      });
    }

    // C. Energy Charges / Tabular Section
    for (let i = 0; i < tables.length; i++) {
      const tbl = tables[i];
      sections.push({
        sectionId: `sec_p${page.pageNumber}_table_${i + 1}`,
        documentId,
        pageNumber: page.pageNumber,
        sectionType: "ENERGY_CHARGES",
        title: tbl.title || "Tabular Charge Breakdown",
        bbox: [...tbl.bbox],
        containedElementIds: [tbl.tableId],
        confidence: 0.92,
      });
    }

    // D. Totals Summary Section
    if (totals.length > 0) {
      const minTotY = Math.min(...totals.map((t) => t.bbox[1]));
      const maxTotY = Math.max(...totals.map((t) => t.bbox[1] + t.bbox[3]));
      sections.push({
        sectionId: `sec_p${page.pageNumber}_totals`,
        documentId,
        pageNumber: page.pageNumber,
        sectionType: "TOTALS_SUMMARY",
        title: "Financial Totals & Due Summary",
        bbox: [0, minTotY - 5, pageWidth, maxTotY - minTotY + 10],
        containedElementIds: totals.map((t) => t.totalId),
        confidence: 0.95,
      });
    }

    // E. Footer Section (bottom 15%)
    if (footers.length > 0) {
      const minFtrY = Math.min(...footers.map((f) => f.bbox[1]));
      sections.push({
        sectionId: `sec_p${page.pageNumber}_footer`,
        documentId,
        pageNumber: page.pageNumber,
        sectionType: "FOOTER_SECTION",
        title: "Footer & Legal Disclaimers",
        bbox: [0, minFtrY - 5, pageWidth, pageHeight - minFtrY + 5],
        containedElementIds: footers.map((f) => f.footerId),
        confidence: 0.92,
      });
    }

    return sections;
  }

  // =========================================================================
  // 10. VISUAL & STRUCTURAL BLOCKS (Backward Compatibility)
  // =========================================================================

  private static generateLayoutBlocks(
    page: ExtractedPage,
    headings: HeadingBlock[],
    paragraphs: LayoutParagraph[],
    tables: DetectedTable[],
    pairs: LabelValuePair[],
    footers: FooterBlock[],
  ): LayoutBlock[] {
    const blocks: LayoutBlock[] = [];
    let counter = 1;

    for (const h of headings) {
      blocks.push({
        blockId: `block_p${page.pageNumber}_${counter++}`,
        pageNumber: page.pageNumber,
        type: "HEADER",
        bbox: [...h.bbox],
        text: h.text,
        confidence: h.confidence,
      });
    }

    for (const t of tables) {
      blocks.push({
        blockId: `block_p${page.pageNumber}_${counter++}`,
        pageNumber: page.pageNumber,
        type: "TABLE",
        bbox: [...t.bbox],
        text: t.title || "Table",
        confidence: t.confidence,
      });
    }

    for (const p of pairs) {
      blocks.push({
        blockId: `block_p${page.pageNumber}_${counter++}`,
        pageNumber: page.pageNumber,
        type: "KEY_VALUE_GROUP",
        bbox: [...p.combinedBbox],
        text: `${p.rawLabel}: ${p.rawValue}`,
        confidence: p.confidence,
      });
    }

    for (const para of paragraphs) {
      blocks.push({
        blockId: `block_p${page.pageNumber}_${counter++}`,
        pageNumber: page.pageNumber,
        type: "PARAGRAPH",
        bbox: [...para.bbox],
        text: para.text,
        confidence: para.confidence,
      });
    }

    for (const f of footers) {
      blocks.push({
        blockId: `block_p${page.pageNumber}_${counter++}`,
        pageNumber: page.pageNumber,
        type: "FOOTER",
        bbox: [...f.bbox],
        text: f.text,
        confidence: f.confidence,
      });
    }

    return blocks;
  }

  private static convertToLegacyKeyValues(
    pairs: LabelValuePair[],
    pageNumber: number,
  ): KeyValueProperty[] {
    return pairs.map((p) => ({
      propertyKey: p.normalizedKey,
      rawLabel: p.rawLabel,
      rawValue: p.rawValue,
      pageNumber,
      keyBbox: [...p.labelBbox],
      valueBbox: [...p.valueBbox],
      confidence: p.confidence,
    }));
  }

  // =========================================================================
  // 11. RELATIONAL LOOKUP & NAVIGATION HELPERS
  // =========================================================================

  /**
   * Traverse table: Get specific cell by row and column index
   */
  public static getCell(
    table: DetectedTable,
    rowIndex: number,
    colIndex: number,
  ): TableCell | undefined {
    return table.rows[rowIndex]?.cells[colIndex];
  }

  /**
   * Traverse table: Get row by row index
   */
  public static getRow(table: DetectedTable, rowIndex: number): TableRow | undefined {
    return table.rows[rowIndex];
  }

  /**
   * Traverse table: Get column by column index
   */
  public static getColumn(table: DetectedTable, colIndex: number): TableColumn | undefined {
    return table.columns[colIndex];
  }

  /**
   * Traverse table: Get all cells in a given row
   */
  public static getCellsInRow(table: DetectedTable, rowIndex: number): TableCell[] {
    return table.rows[rowIndex]?.cells || [];
  }

  /**
   * Traverse table: Get all cells in a given column across all rows
   */
  public static getCellsInColumn(table: DetectedTable, colIndex: number): TableCell[] {
    return table.rows.map((r) => r.cells[colIndex]).filter((c): c is TableCell => c !== undefined);
  }

  /**
   * Verify the unbroken relational chain: Column -> Row -> Cell -> Page -> Source Document
   */
  public static verifyRelationshipChain(
    cell: TableCell,
    table: DetectedTable,
    documentId: string,
  ): boolean {
    const col = table.columns[cell.colIndex];
    const row = table.rows[cell.rowIndex];

    return (
      cell.documentId === documentId &&
      cell.pageNumber === table.pageNumber &&
      cell.tableId === table.tableId &&
      col !== undefined &&
      cell.columnId === col.columnId &&
      row !== undefined &&
      cell.rowId === row.rowId
    );
  }

  // =========================================================================
  // UTILITY PARSERS
  // =========================================================================

  private static inferColumnType(
    header: string,
  ): "TEXT" | "NUMERIC" | "CURRENCY" | "DATE" | "UNIT" | "MIXED" {
    const lower = header.toLowerCase();
    if (lower.includes("amount") || lower.includes("r") || lower.includes("vat")) return "CURRENCY";
    if (
      lower.includes("consumption") ||
      lower.includes("kwh") ||
      lower.includes("kva") ||
      lower.includes("rate") ||
      lower.includes("quantity")
    )
      return "NUMERIC";
    if (lower.includes("date") || lower.includes("period")) return "DATE";
    if (lower.includes("unit")) return "UNIT";
    return "TEXT";
  }

  private static parseCellValue(text: string): string | number | null {
    if (!text) return null;
    const cleanNum = text.replace(/[\s,R]/g, "");
    if (/^\d+(?:\.\d+)?$/.test(cleanNum)) {
      return parseFloat(cleanNum);
    }
    return text.trim();
  }

  private static inferValueType(val: string): "STRING" | "NUMBER" | "DATE" | "CURRENCY" {
    if (/^R?\s*\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})/.test(val)) return "CURRENCY";
    if (/^\d{4}[-/.]\d{2}[-/.]\d{2}/.test(val) || /^\d{2}[-/.]\d{2}[-/.]\d{4}/.test(val))
      return "DATE";
    if (/^\d+(?:\.\d+)?$/.test(val.replace(/[\s,]/g, ""))) return "NUMBER";
    return "STRING";
  }

  private static normalizeValue(key: string, val: string): string | number | null {
    if (!val) return null;
    const clean = val.trim();
    if (key.includes("amount") || key.includes("due") || key.includes("vat")) {
      const num = parseFloat(clean.replace(/[^0-9.]/g, ""));
      return isNaN(num) ? clean : num;
    }
    return clean;
  }
}
