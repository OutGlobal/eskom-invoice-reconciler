/**
 * Layout Analysis Engine
 * ========================================================
 * Stage 7 of Document Intelligence Architecture:
 * Performs layout analysis on extracted pages and lines:
 * - Segregates pages into structural blocks (HEADER, FOOTER, TABLES, KEY-VALUES, PARAGRAPHS)
 * - Identifies tabular matrices (columns, rows, headers, cells, bounding boxes)
 * - Associates key-value pairs (e.g., "Account Number" -> "7854321098") with exact spatial coordinates
 */

import type {
  BoundingBox,
  DetectedTable,
  ExtractedPage,
  ExtractedTextLine,
  KeyValueProperty,
  LayoutBlock,
  LayoutBlockType,
  PageLayoutAnalysis,
  TableCell,
  TableColumn,
  TableRow,
} from "./types";

export class LayoutAnalysisEngine {
  /**
   * Analyze spatial layout across all pages
   */
  public static analyzeLayout(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[]
  ): PageLayoutAnalysis[] {
    return pages.map((page) => {
      const pageLines = lines.filter((l) => l.pageNumber === page.pageNumber);
      const blocks = this.identifyLayoutBlocks(page, pageLines);
      const tables = this.detectTables(page, pageLines);
      const keyValues = this.extractKeyValueProperties(page, pageLines);

      return {
        pageNumber: page.pageNumber,
        blocks,
        tables,
        keyValues,
      };
    });
  }

  /**
   * Identify structural blocks on a page
   */
  private static identifyLayoutBlocks(
    page: ExtractedPage,
    lines: ExtractedTextLine[]
  ): LayoutBlock[] {
    const blocks: LayoutBlock[] = [];
    const pageHeight = page.dimensions.height;
    const headerThreshold = Math.min(130, pageHeight * 0.15);
    const footerThreshold = pageHeight - Math.min(100, pageHeight * 0.12);

    let blockCounter = 1;

    for (const line of lines) {
      const y = line.bbox[1];
      let type: LayoutBlockType = "PARAGRAPH";
      let confidence = 0.85;

      if (y <= headerThreshold) {
        type = "HEADER";
        confidence = 0.92;
      } else if (y >= footerThreshold) {
        type = "FOOTER";
        confidence = 0.90;
      } else if (this.isKeyValueCandidate(line.text)) {
        type = "KEY_VALUE_GROUP";
        confidence = 0.94;
      } else if (this.isTabularLineCandidate(line.text)) {
        type = "TABLE";
        confidence = 0.91;
      }

      blocks.push({
        blockId: `block_p${page.pageNumber}_${blockCounter++}`,
        pageNumber: page.pageNumber,
        type,
        bbox: [...line.bbox],
        text: line.text,
        confidence,
      });
    }

    return blocks;
  }

  /**
   * Detect tabular structures (e.g., invoice line items, meter reading schedules)
   */
  private static detectTables(
    page: ExtractedPage,
    lines: ExtractedTextLine[]
  ): DetectedTable[] {
    const tables: DetectedTable[] = [];

    // Header keywords typically found in utility bill tables
    const tableHeaderRegex =
      /description|charge|rate|consumption|quantity|kwh|kva|amount|total|tariff|meter\s*no|reading|subtotal/i;

    // Numerical row line item indicator: has at least one monetary amount or measurement number
    const numericRowRegex =
      /(?:R\s*)?\d{1,3}(?:[ ,]\d{3})*(?:\.\d{2})|(?:\d+(?:\.\d+)?\s*(?:c\/kwh|r\/kva|kwh|kva|kvarh))/i;

    let inTable = false;
    let currentTableLines: ExtractedTextLine[] = [];
    let tableIndex = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isHeader = tableHeaderRegex.test(line.text);
      const isNumeric = numericRowRegex.test(line.text);

      if (isHeader && !inTable) {
        inTable = true;
        currentTableLines = [line];
      } else if (inTable) {
        if (isNumeric || isHeader || line.text.includes("Subtotal") || line.text.includes("Total")) {
          currentTableLines.push(line);
        } else {
          // Check if table ended
          if (currentTableLines.length >= 2) {
            tables.push(this.buildTableStructure(page.pageNumber, tableIndex++, currentTableLines));
          }
          inTable = false;
          currentTableLines = [];
        }
      }
    }

    if (inTable && currentTableLines.length >= 2) {
      tables.push(this.buildTableStructure(page.pageNumber, tableIndex++, currentTableLines));
    }

    return tables;
  }

  /**
   * Construct table model from clustered table lines
   */
  private static buildTableStructure(
    pageNumber: number,
    tableIndex: number,
    tableLines: ExtractedTextLine[]
  ): DetectedTable {
    const minX = Math.min(...tableLines.map((l) => l.bbox[0]));
    const minY = Math.min(...tableLines.map((l) => l.bbox[1]));
    const maxX = Math.max(...tableLines.map((l) => l.bbox[0] + l.bbox[2]));
    const maxY = Math.max(...tableLines.map((l) => l.bbox[1] + l.bbox[3]));

    const headerLine = tableLines[0];
    const columns: TableColumn[] = [];
    const rows: TableRow[] = [];

    // Derive approximate column positions from header line tokens
    if (headerLine.tokens && headerLine.tokens.length > 0) {
      headerLine.tokens.forEach((t, idx) => {
        columns.push({
          colIndex: idx,
          headerText: t.text,
          minX: t.bbox[0],
          maxX: t.bbox[0] + t.bbox[2] + 40,
        });
      });
    } else {
      // Default 4-column fallback
      columns.push(
        { colIndex: 0, headerText: "Description", minX: minX, maxX: minX + 200 },
        { colIndex: 1, headerText: "Consumption/Demand", minX: minX + 201, maxX: minX + 320 },
        { colIndex: 2, headerText: "Rate", minX: minX + 321, maxX: minX + 420 },
        { colIndex: 3, headerText: "Amount (R)", minX: minX + 421, maxX: maxX }
      );
    }

    // Build row and cell matrices
    tableLines.forEach((line, rowIdx) => {
      const isHeaderRow = rowIdx === 0;
      const cells: TableCell[] = [];

      if (line.tokens && line.tokens.length > 0) {
        line.tokens.forEach((token, colIdx) => {
          cells.push({
            rowIndex: rowIdx,
            colIndex: colIdx,
            text: token.text,
            bbox: [...token.bbox],
            isHeader: isHeaderRow,
            confidence: token.confidence,
          });
        });
      } else {
        cells.push({
          rowIndex: rowIdx,
          colIndex: 0,
          text: line.text,
          bbox: [...line.bbox],
          isHeader: isHeaderRow,
          confidence: line.confidence,
        });
      }

      rows.push({
        rowIndex: rowIdx,
        cells,
        bbox: [...line.bbox],
        isHeaderRow,
      });
    });

    return {
      tableId: `tbl_p${pageNumber}_${tableIndex}`,
      pageNumber,
      title: headerLine.text.slice(0, 60),
      bbox: [minX, minY, Math.max(50, maxX - minX), Math.max(20, maxY - minY)],
      columns,
      rows,
      confidence: 0.92,
    };
  }

  /**
   * Extract Key-Value property pairs with positional coordinates
   */
  private static extractKeyValueProperties(
    page: ExtractedPage,
    lines: ExtractedTextLine[]
  ): KeyValueProperty[] {
    const properties: KeyValueProperty[] = [];

    const labelPatterns = [
      { key: "account_number", regex: /(?:account\s*(?:no|number)|acc\s*no)[\s:]*([A-Za-z0-9_-]{7,15})/i },
      { key: "tax_invoice_number", regex: /(?:tax\s*invoice\s*(?:no|number)|invoice\s*no)[\s:]*([A-Za-z0-9_-]{5,20})/i },
      { key: "vat_registration", regex: /(?:vat\s*(?:reg|registration|no)?)[\s:]*([0-9]{10})/i },
      { key: "customer_name", regex: /(?:customer\s*name|client\s*name|billed\s*to)[\s:]*([A-Z0-9 &.,'-]{3,50})/i },
      { key: "invoice_date", regex: /(?:invoice\s*date|tax\s*invoice\s*date|date)[\s:]*(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4})/i },
      { key: "billing_period", regex: /(?:billing\s*period|period)[\s:]*([0-9A-Za-z -/.]+)/i },
      { key: "supply_location", regex: /(?:supply\s*(?:point|location)|premise\s*id)[\s:]*([A-Za-z0-9 _-]{3,40})/i },
      { key: "tariff_name", regex: /(?:tariff(?:\s*name)?|rate\s*category)[\s:]*([A-Za-z0-9_-]{4,25})/i },
      { key: "meter_number", regex: /(?:meter\s*(?:no|number))[\s:]*([A-Za-z0-9_-]{5,20})/i },
      { key: "total_due", regex: /(?:total\s*(?:amount\s*)?due|amount\s*payable|total\s*including\s*vat)[\s:]*R?\s*([0-9 ,.]+\.\d{2})/i },
    ];

    for (const line of lines) {
      for (const pattern of labelPatterns) {
        const match = line.text.match(pattern.regex);
        if (match) {
          const rawValue = match[1].trim();
          const rawLabel = match[0].split(match[1])[0].replace(/[:\s]+$/, "");

          // Calculate approximate bounding boxes
          const lineX = line.bbox[0];
          const lineY = line.bbox[1];
          const lineW = line.bbox[2];
          const lineH = line.bbox[3];

          const keyBbox: BoundingBox = [lineX, lineY, Math.round(lineW * 0.4), lineH];
          const valBbox: BoundingBox = [lineX + Math.round(lineW * 0.4), lineY, Math.round(lineW * 0.6), lineH];

          properties.push({
            propertyKey: pattern.key,
            rawLabel: rawLabel || pattern.key,
            rawValue,
            pageNumber: page.pageNumber,
            keyBbox,
            valueBbox: valBbox,
            confidence: 0.95,
          });
        }
      }
    }

    return properties;
  }

  private static isKeyValueCandidate(text: string): boolean {
    return /^[A-Za-z\s]{3,25}\s*:\s*[A-Za-z0-9]/i.test(text);
  }

  private static isTabularLineCandidate(text: string): boolean {
    return /(?:c\/kwh|r\/kva|\b\d{1,3}(?:[ ,]\d{3})*\.\d{2}\b)/i.test(text);
  }
}
