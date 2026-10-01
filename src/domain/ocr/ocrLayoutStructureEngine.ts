/**
 * ENERA PRODUCTION OCR ENGINE — LAYOUT & TABLE STRUCTURE ENGINE
 * ==============================================================
 * Reconstructs spatial semantic structure from raw OCR tokens:
 *
 *   WORDS & LINES
 *         ↓
 *   READING ORDER & MULTI-COLUMN GROUPING
 *         ↓
 *   KEY-VALUE PAIR IDENTIFICATION (Horizontal & Vertical)
 *         ↓
 *   TABLE & GRID BOUNDARY DETECTION
 *         ↓
 *   CELL MATRIX & BILLING SCHEDULE SEGMENTATION
 */

import type {
  OcrWordToken,
  OcrLineBlock,
  OcrLayoutBlock,
  OcrTableStructure,
  OcrTableCell,
  OcrKeyValuePair,
  OcrBoundingBox,
} from "./types";

export class OcrLayoutStructureEngine {
  /**
   * Reconstructs full page structure: reading order, blocks, tables, and key-values
   */
  public static analyzePageLayout(
    lines: OcrLineBlock[],
    pageNumber: number = 1,
  ): {
    sortedLines: OcrLineBlock[];
    blocks: OcrLayoutBlock[];
    tables: OcrTableStructure[];
    keyValuePairs: OcrKeyValuePair[];
  } {
    // 1. Sort lines into natural top-to-bottom reading order
    const sortedLines = this.sortLinesReadingOrder(lines);

    // 2. Identify Key-Value Pairs
    const keyValuePairs = this.extractKeyValuePairs(sortedLines, pageNumber);

    // 3. Detect and reconstruct tabular structures
    const tables = this.detectTables(sortedLines, pageNumber);

    // 4. Group lines into semantic layout blocks
    const blocks = this.groupIntoBlocks(sortedLines, tables, pageNumber);

    return {
      sortedLines,
      blocks,
      tables,
      keyValuePairs,
    };
  }

  /**
   * Sorts lines into top-to-bottom reading order, accounting for multi-column layouts
   */
  public static sortLinesReadingOrder(lines: OcrLineBlock[]): OcrLineBlock[] {
    return [...lines].sort((a, b) => {
      const yDiff = a.boundingBox[1] - b.boundingBox[1];
      // If on the same horizontal line band (within 1.5% height), sort by X
      if (Math.abs(yDiff) < 0.015) {
        return a.boundingBox[0] - b.boundingBox[0];
      }
      return yDiff;
    });
  }

  /**
   * Extracts Key-Value pairs based on spatial proximity
   */
  public static extractKeyValuePairs(lines: OcrLineBlock[], pageNumber: number): OcrKeyValuePair[] {
    const pairs: OcrKeyValuePair[] = [];

    const labelKeywords = [
      "ACCOUNT NO",
      "ACCOUNT NUMBER",
      "TAX INVOICE",
      "INVOICE NO",
      "INVOICE NUMBER",
      "VAT NO",
      "VAT REGISTRATION",
      "VAT NUMBER",
      "BILLING PERIOD",
      "INVOICE DATE",
      "DATE OF INVOICE",
      "PAYMENT DUE DATE",
      "DUE DATE",
      "TARIFF",
      "TARIFF CODE",
      "TARIFF TYPE",
      "METER NO",
      "METER NUMBER",
      "SERIAL NUMBER",
      "TOTAL AMOUNT DUE",
      "TOTAL DUE",
      "AMOUNT PAYABLE",
      "CLOSING BALANCE",
      "OPENING BALANCE",
      "NOTIFIED MAXIMUM DEMAND",
      "MAXIMUM DEMAND",
      "NMD",
      "ACTIVE ENERGY",
      "PEAK ENERGY",
      "STANDARD ENERGY",
      "OFF-PEAK ENERGY",
      "REACTIVE ENERGY",
      "POWER FACTOR",
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLineText = line.text.toUpperCase();

      for (const label of labelKeywords) {
        const idx = upperLineText.indexOf(label);
        if (idx !== -1) {
          const afterText = line.text
            .slice(idx + label.length)
            .replace(/^[:\-\s]+/, "")
            .trim();

          // 1. Horizontal value (on the same line after delimiter)
          if (afterText.length > 0) {
            const keyBox: OcrBoundingBox = [
              line.boundingBox[0],
              line.boundingBox[1],
              line.boundingBox[2] * 0.4,
              line.boundingBox[3],
            ];
            const valBox: OcrBoundingBox = [
              line.boundingBox[0] + line.boundingBox[2] * 0.4,
              line.boundingBox[1],
              line.boundingBox[2] * 0.6,
              line.boundingBox[3],
            ];

            pairs.push({
              pairId: `kv-p${pageNumber}-${pairs.length}`,
              pageNumber,
              keyText: label,
              keyNormalized: this.normalizeKey(label),
              keyBoundingBox: keyBox,
              valueText: afterText,
              valueNormalized: this.parseValue(afterText),
              valueBoundingBox: valBox,
              confidence: line.confidence,
              orientation: "HORIZONTAL_RIGHT",
            });
            break;
          }

          // 2. Vertical value (on the line immediately below within 2% margin)
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            const verticalDist =
              nextLine.boundingBox[1] - (line.boundingBox[1] + line.boundingBox[3]);

            if (verticalDist >= 0 && verticalDist < 0.03) {
              const valText = nextLine.text.trim();
              if (
                valText.length > 0 &&
                !labelKeywords.some((k) => valText.toUpperCase().includes(k))
              ) {
                pairs.push({
                  pairId: `kv-p${pageNumber}-${pairs.length}`,
                  pageNumber,
                  keyText: label,
                  keyNormalized: this.normalizeKey(label),
                  keyBoundingBox: line.boundingBox,
                  valueText: valText,
                  valueNormalized: this.parseValue(valText),
                  valueBoundingBox: nextLine.boundingBox,
                  confidence: Math.round((line.confidence + nextLine.confidence) / 2),
                  orientation: "VERTICAL_BELOW",
                });
                break;
              }
            }
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Detects tabular structures (e.g. utility billing schedules, meter readings, rate tables)
   */
  public static detectTables(lines: OcrLineBlock[], pageNumber: number): OcrTableStructure[] {
    const tables: OcrTableStructure[] = [];

    // Header keywords identifying billing schedules or meter tables
    const tableHeaderMarkers = [
      ["DESCRIPTION", "CHARGE", "AMOUNT"],
      ["TARIFF", "CONSUMPTION", "RATE", "TOTAL"],
      ["PEAK", "STANDARD", "OFF-PEAK"],
      ["METER", "PREVIOUS", "CURRENT", "UNITS"],
      ["ENERGY", "DEMAND", "NETWORK", "LEVY"],
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperText = line.text.toUpperCase();

      const matchedMarker = tableHeaderMarkers.find((markerGroup) => {
        let matches = 0;
        for (const kw of markerGroup) {
          if (upperText.includes(kw)) matches++;
        }
        return matches >= 2;
      });

      if (matchedMarker) {
        // We found a table header row! Collect subsequent lines that align as table rows
        const headerWords =
          line.words.length > 0 ? line.words.map((w) => w.text) : line.text.split(/\s{2,}|\t/);
        const tableLines: OcrLineBlock[] = [line];
        let lastY = line.boundingBox[1] + line.boundingBox[3];

        for (let j = i + 1; j < lines.length; j++) {
          const candidateLine = lines[j];
          const dist = candidateLine.boundingBox[1] - lastY;

          // Stop if gap is too large (end of table) or if a summary/signature block appears
          if (dist > 0.05 || candidateLine.text.toUpperCase().includes("TERMS AND CONDITIONS")) {
            break;
          }

          // If line contains multiple tokens or currency amounts, it's a row
          if (candidateLine.words.length >= 2 || /[0-9]+\.[0-9]{2}/.test(candidateLine.text)) {
            tableLines.push(candidateLine);
            lastY = candidateLine.boundingBox[1] + candidateLine.boundingBox[3];
          } else {
            break;
          }
        }

        if (tableLines.length >= 2) {
          // Reconstruct table grid cells
          const reconstructed = this.buildTableFromLines(tableLines, pageNumber, tables.length + 1);
          tables.push(reconstructed);
          i += tableLines.length - 1; // Skip lines consumed by this table
        }
      }
    }

    return tables;
  }

  /**
   * Builds an OcrTableStructure from consecutive aligned lines
   */
  private static buildTableFromLines(
    lines: OcrLineBlock[],
    pageNumber: number,
    tableIndex: number,
  ): OcrTableStructure {
    const headerLine = lines[0];
    const dataLines = lines.slice(1);

    // Approximate column boundaries from word X-positions across all lines
    const colSplitRegex = /\s{2,}|\t|(?<=[0-9A-Za-z])\s+(?=[R\d])/;
    const headerCols = headerLine.text.split(colSplitRegex).filter((h) => h.trim().length > 0);
    const colCount = Math.max(2, headerCols.length);

    const cells: OcrTableCell[] = [];
    const rows: string[][] = [];

    // 1. Add header cells
    headerCols.forEach((hText, cIdx) => {
      cells.push({
        cellId: `cell-p${pageNumber}-t${tableIndex}-r0-c${cIdx}`,
        rowIndex: 0,
        columnIndex: cIdx,
        rowSpan: 1,
        colSpan: 1,
        text: hText.trim(),
        rawValue: hText.trim(),
        numericValue: null,
        boundingBox: headerLine.boundingBox,
        confidence: headerLine.confidence,
      });
    });

    // 2. Add data rows
    dataLines.forEach((rowLine, rIdx) => {
      const rawCols = rowLine.text.split(colSplitRegex).filter((c) => c.trim().length > 0);
      const rowStrings: string[] = [];

      for (let cIdx = 0; cIdx < colCount; cIdx++) {
        const val = rawCols[cIdx] ? rawCols[cIdx].trim() : "";
        rowStrings.push(val);

        const cleanNum = val.replace(/[R\s,]/g, "");
        const numVal = !isNaN(Number(cleanNum)) && cleanNum.length > 0 ? Number(cleanNum) : null;

        cells.push({
          cellId: `cell-p${pageNumber}-t${tableIndex}-r${rIdx + 1}-c${cIdx}`,
          rowIndex: rIdx + 1,
          columnIndex: cIdx,
          rowSpan: 1,
          colSpan: 1,
          text: val,
          rawValue: val,
          numericValue: numVal,
          boundingBox: rowLine.boundingBox,
          confidence: rowLine.confidence,
        });
      }
      rows.push(rowStrings);
    });

    // Compute enclosing bounding box
    const minX = Math.min(...lines.map((l) => l.boundingBox[0]));
    const minY = lines[0].boundingBox[1];
    const maxX = Math.max(...lines.map((l) => l.boundingBox[0] + l.boundingBox[2]));
    const maxY = lines[lines.length - 1].boundingBox[1] + lines[lines.length - 1].boundingBox[3];

    let tableType: OcrTableStructure["tableType"] = "GENERIC";
    const headerCombined = headerCols.join(" ").toUpperCase();
    const rowsCombined = lines.map((l) => l.text.toUpperCase()).join(" ");

    if (
      headerCombined.includes("METER") ||
      headerCombined.includes("READING") ||
      headerCombined.includes("DIAL")
    ) {
      tableType = "METER_READINGS";
    } else if (
      headerCombined.includes("TARIFF") ||
      headerCombined.includes("CHARGE") ||
      headerCombined.includes("AMOUNT") ||
      headerCombined.includes("RATE") ||
      rowsCombined.includes("ENERGY") ||
      rowsCombined.includes("DEMAND") ||
      rowsCombined.includes("CHARGE")
    ) {
      tableType = "BILLING_SCHEDULE";
    }

    return {
      tableId: `table-p${pageNumber}-${tableIndex}`,
      pageNumber,
      tableType,
      headers: headerCols,
      rows,
      cells,
      rowCount: rows.length,
      columnCount: colCount,
      boundingBox: [minX, minY, maxX - minX, maxY - minY],
      confidence: Math.round(lines.reduce((acc, l) => acc + l.confidence, 0) / lines.length),
    };
  }

  /**
   * Groups lines into semantic layout blocks
   */
  public static groupIntoBlocks(
    lines: OcrLineBlock[],
    tables: OcrTableStructure[],
    pageNumber: number,
  ): OcrLayoutBlock[] {
    const blocks: OcrLayoutBlock[] = [];
    const tableLineIds = new Set<string>();

    // Mark lines that are part of detected tables
    for (const tbl of tables) {
      blocks.push({
        blockId: `block-table-${tbl.tableId}`,
        pageNumber,
        type: "TABLE",
        boundingBox: tbl.boundingBox,
        text: tbl.rows.map((r) => r.join(" | ")).join("\n"),
        lines: [],
        confidence: tbl.confidence,
      });
    }

    // Process remaining lines into paragraph and heading blocks
    let currentLines: OcrLineBlock[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (tableLineIds.has(line.lineId)) continue;

      if (currentLines.length === 0) {
        currentLines.push(line);
        continue;
      }

      const prevLine = currentLines[currentLines.length - 1];
      const gapY = line.boundingBox[1] - (prevLine.boundingBox[1] + prevLine.boundingBox[3]);

      if (gapY < 0.02) {
        currentLines.push(line);
      } else {
        // Finalize block
        blocks.push(this.createBlockFromLines(currentLines, pageNumber, blocks.length + 1));
        currentLines = [line];
      }
    }

    if (currentLines.length > 0) {
      blocks.push(this.createBlockFromLines(currentLines, pageNumber, blocks.length + 1));
    }

    return blocks;
  }

  private static createBlockFromLines(
    lines: OcrLineBlock[],
    pageNumber: number,
    blockIdx: number,
  ): OcrLayoutBlock {
    const minX = Math.min(...lines.map((l) => l.boundingBox[0]));
    const minY = lines[0].boundingBox[1];
    const maxX = Math.max(...lines.map((l) => l.boundingBox[0] + l.boundingBox[2]));
    const maxY = lines[lines.length - 1].boundingBox[1] + lines[lines.length - 1].boundingBox[3];

    const text = lines.map((l) => l.text).join("\n");
    const isHeading = lines.length === 1 && lines[0].boundingBox[3] > 0.03;

    return {
      blockId: `block-p${pageNumber}-${blockIdx}`,
      pageNumber,
      type: isHeading ? "HEADING" : "PARAGRAPH",
      boundingBox: [minX, minY, maxX - minX, maxY - minY],
      text,
      lines,
      confidence: Math.round(lines.reduce((acc, l) => acc + l.confidence, 0) / lines.length),
    };
  }

  private static normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  private static parseValue(val: string): string | number | null {
    const trimmed = val.trim();
    if (!trimmed) return null;

    // Check for currency or numeric value
    const cleanNum = trimmed.replace(/^[RZAR\$\s]+/, "").replace(/,/g, "");
    if (/^[0-9]+(\.[0-9]+)?$/.test(cleanNum)) {
      return parseFloat(cleanNum);
    }

    return trimmed;
  }
}
