/**
 * ENERA PRODUCTION OCR ENGINE — TABLE RECONSTRUCTION ENGINE
 * ==========================================================
 * Requirement 18: TABLE RECONSTRUCTION
 *
 * Preserves the authoritative hierarchical relationships:
 *
 *   TABLE
 *     ↓
 *    ROW
 *     ↓
 *   COLUMN
 *     ↓
 *    CELL
 *
 * Detects:
 *   - rows (Header, Data, Total, Subheader)
 *   - columns (Headers, Inferred types: TEXT, NUMERIC, CURRENCY, UNIT, DATE)
 *   - headers (Single and multi-line)
 *   - merged cells (rowSpan, colSpan, spanning subheadings)
 *   - totals (Summary rows, column sum verification, arithmetic discrepancy check)
 *   - repeated headers (Section breaks, page continuations)
 *   - page continuation (Cross-page table stitching, multi-page link tracking)
 *
 * STRICT RULE:
 * Do not simply concatenate table text into a paragraph.
 */

import type {
  CoordinateSystem,
  OcrBoundingBox,
  OcrColumnDataType,
  OcrConfidenceTier,
  OcrLineBlock,
  OcrMergedCell,
  OcrTableCell,
  OcrTableColumn,
  OcrTableRow,
  OcrTableRowType,
  OcrTableStructure,
  OcrTableTotalSummary,
  OcrWordToken,
} from "./types";
import { NumericProtectionEngine } from "./numericProtectionEngine";

export interface TableReconstructionOptions {
  tableId?: string;
  tableType?:
    | "BILLING_SCHEDULE"
    | "METER_READINGS"
    | "TARIFF_RATES"
    | "FINANCIAL_SUMMARY"
    | "GENERIC";
  knownHeaders?: string[];
  coordinateSystem?: CoordinateSystem;
}

export class TableReconstructionEngine {
  /**
   * Reconstructs an authoritative structured table from lines of OCR text,
   * preserving TABLE → ROW → COLUMN → CELL relationships.
   */
  public static reconstructTable(
    lines: OcrLineBlock[],
    pageNumber: number,
    options: TableReconstructionOptions = {},
  ): OcrTableStructure {
    const tableId = options.tableId || `table-p${pageNumber}-${Date.now()}`;
    const tableType = options.tableType || this.inferTableType(lines);
    const coordinateSystem = options.coordinateSystem || lines[0]?.coordinateSystem || "NORMALIZED_0_1";

    if (!lines || lines.length === 0) {
      return this.createEmptyTable(tableId, pageNumber, tableType, coordinateSystem);
    }

    // 1. Identify header line and column boundaries
    const headerLine = lines[0];
    const headerTokens = this.extractHeaderTokens(headerLine, options.knownHeaders);
    const colCount = Math.max(2, headerTokens.length);

    // Approximate column boundary X intervals
    const columnIntervals = this.calculateColumnIntervals(lines, colCount);

    const tableRows: OcrTableRow[] = [];
    const allCells: OcrTableCell[] = [];
    const rawMatrix: string[][] = [];
    const repeatedHeaderIndices: number[] = [];
    const mergedCells: OcrMergedCell[] = [];

    // 2. Process Header Row (Row 0)
    const headerCells: OcrTableCell[] = [];
    headerTokens.forEach((headerText, cIdx) => {
      const cellBox = this.calculateCellBox(headerLine, cIdx, colCount, columnIntervals);
      const cell: OcrTableCell = {
        cellId: `cell-${tableId}-r0-c${cIdx}`,
        rowIndex: 0,
        columnIndex: cIdx,
        rowSpan: 1,
        colSpan: 1,
        text: headerText.trim(),
        rawValue: headerText.trim(),
        numericValue: null,
        boundingBox: cellBox,
        x: cellBox[0],
        y: cellBox[1],
        width: cellBox[2],
        height: cellBox[3],
        coordinateSystem,
        detailedBoundingBox: {
          pageNumber,
          x: cellBox[0],
          y: cellBox[1],
          width: cellBox[2],
          height: cellBox[3],
          coordinateSystem,
          confidence: Number(((headerLine.confidence || 90) / 100).toFixed(4)),
        },
        confidence: headerLine.confidence || 90,
        confidenceNormalized: Number(((headerLine.confidence || 90) / 100).toFixed(4)),
        confidenceTier: (headerLine.confidence || 90) >= 85 ? "HIGH" : "MEDIUM",
      };
      headerCells.push(cell);
      allCells.push(cell);
    });

    const headerRow: OcrTableRow = {
      rowId: `row-${tableId}-0`,
      rowIndex: 0,
      rowType: "HEADER",
      cells: headerCells,
      rawText: headerLine.text,
      boundingBox: headerLine.boundingBox,
      confidence: headerLine.confidence || 90,
      confidenceTier: (headerLine.confidence || 90) >= 85 ? "HIGH" : "MEDIUM",
      isHeaderRow: true,
      isTotalRow: false,
    };
    tableRows.push(headerRow);

    // 3. Process Subsequent Lines as Rows (Data, Total, Repeated Header, Subheader)
    const dataLines = lines.slice(1);
    for (let rIdx = 0; rIdx < dataLines.length; rIdx++) {
      const line = dataLines[rIdx];
      const lineUpper = line.text.toUpperCase();
      const currentAbsoluteRowIndex = rIdx + 1;

      // Check if this row is a repeated header
      const isRepeatedHeader = this.isRepeatedHeader(lineUpper, headerTokens);
      if (isRepeatedHeader) {
        repeatedHeaderIndices.push(currentAbsoluteRowIndex);
      }

      // Check if this row is a total/summary row
      const isTotal = this.isTotalRowText(lineUpper);

      // Check for merged cell (e.g. single spanning category header)
      const isSpanningMerged = this.isSpanningSubheader(line.text, colCount);

      const rowCells: OcrTableCell[] = [];
      const rowTokens = this.alignTokensToColumns(line, headerLine, headerTokens, colCount);
      const rowStrings: string[] = [];

      if (isSpanningMerged) {
        // Create a single merged cell spanning all columns
        const cellBox = line.boundingBox;
        const mergedCell: OcrTableCell = {
          cellId: `cell-${tableId}-r${currentAbsoluteRowIndex}-c0-span`,
          rowIndex: currentAbsoluteRowIndex,
          columnIndex: 0,
          rowSpan: 1,
          colSpan: colCount,
          text: line.text.trim(),
          rawValue: line.text.trim(),
          numericValue: null,
          boundingBox: cellBox,
          x: cellBox[0],
          y: cellBox[1],
          width: cellBox[2],
          height: cellBox[3],
          coordinateSystem,
          confidence: line.confidence,
          confidenceNormalized: Number(((line.confidence || 90) / 100).toFixed(4)),
        };
        rowCells.push(mergedCell);
        allCells.push(mergedCell);
        rowStrings.push(line.text.trim());

        mergedCells.push({
          cellId: mergedCell.cellId,
          startRowIndex: currentAbsoluteRowIndex,
          endRowIndex: currentAbsoluteRowIndex,
          startColumnIndex: 0,
          endColumnIndex: colCount - 1,
          rowSpan: 1,
          colSpan: colCount,
          text: line.text.trim(),
          mergedDirection: "HORIZONTAL",
        });
      } else {
        for (let cIdx = 0; cIdx < colCount; cIdx++) {
          const val = rowTokens[cIdx] ? rowTokens[cIdx].trim() : "";
          rowStrings.push(val);

          const cellBox = this.calculateCellBox(line, cIdx, colCount, columnIntervals);
          const parsedNum = this.extractNumericValueFromCell(val);

          const cell: OcrTableCell = {
            cellId: `cell-${tableId}-r${currentAbsoluteRowIndex}-c${cIdx}`,
            rowIndex: currentAbsoluteRowIndex,
            columnIndex: cIdx,
            rowSpan: 1,
            colSpan: 1,
            text: val,
            rawValue: val,
            numericValue: parsedNum,
            boundingBox: cellBox,
            x: cellBox[0],
            y: cellBox[1],
            width: cellBox[2],
            height: cellBox[3],
            coordinateSystem,
            detailedBoundingBox: {
              pageNumber,
              x: cellBox[0],
              y: cellBox[1],
              width: cellBox[2],
              height: cellBox[3],
              coordinateSystem,
              confidence: Number(((line.confidence || 90) / 100).toFixed(4)),
            },
            confidence: line.confidence || 90,
            confidenceNormalized: Number(((line.confidence || 90) / 100).toFixed(4)),
            confidenceTier: (line.confidence || 90) >= 85 ? "HIGH" : "MEDIUM",
          };
          rowCells.push(cell);
          allCells.push(cell);
        }
      }

      let rowType: OcrTableRowType = "DATA";
      if (isRepeatedHeader) {
        rowType = "HEADER";
      } else if (isTotal) {
        rowType = "TOTAL";
      } else if (isSpanningMerged) {
        rowType = "SUBHEADER";
      }

      const rowObj: OcrTableRow = {
        rowId: `row-${tableId}-${currentAbsoluteRowIndex}`,
        rowIndex: currentAbsoluteRowIndex,
        rowType,
        cells: rowCells,
        rawText: line.text,
        boundingBox: line.boundingBox,
        confidence: line.confidence || 90,
        confidenceTier: (line.confidence || 90) >= 85 ? "HIGH" : "MEDIUM",
        isHeaderRow: isRepeatedHeader,
        isTotalRow: isTotal,
      };

      tableRows.push(rowObj);
      rawMatrix.push(rowStrings);
    }

    // 4. Construct Columns and Infer Data Types
    const tableColumns = this.constructColumns(headerTokens, tableRows, colCount);

    // 5. Partition Rows
    const headerRows = tableRows.filter((r) => r.isHeaderRow);
    const totalRows = tableRows.filter((r) => r.isTotalRow);
    const dataRows = tableRows.filter((r) => !r.isHeaderRow && !r.isTotalRow && r.rowType !== "SUBHEADER");

    // 6. Detect Totals and Arithmetic Verification
    const detectedTotals = this.detectAndVerifyTotals(tableRows, colCount);

    // 7. Calculate overall Table Bounding Box
    const tableBoundingBox = this.computeBoundingBox(lines);

    const overallConfidence =
      lines.reduce((acc, l) => acc + (l.confidence || 90), 0) / lines.length;
    const confidenceNormalized = Number((overallConfidence / 100).toFixed(4));
    const confidenceTier: OcrConfidenceTier =
      overallConfidence >= 85 ? "HIGH" : overallConfidence >= 70 ? "MEDIUM" : "LOW";

    return {
      tableId,
      pageNumber,
      tableType,
      headers: headerTokens,
      rows: rawMatrix,
      cells: allCells,
      rowCount: rawMatrix.length,
      columnCount: colCount,
      boundingBox: tableBoundingBox,
      x: tableBoundingBox[0],
      y: tableBoundingBox[1],
      width: tableBoundingBox[2],
      height: tableBoundingBox[3],
      coordinateSystem,
      detailedBoundingBox: {
        pageNumber,
        x: tableBoundingBox[0],
        y: tableBoundingBox[1],
        width: tableBoundingBox[2],
        height: tableBoundingBox[3],
        coordinateSystem,
        confidence: confidenceNormalized,
      },
      confidence: overallConfidence,
      confidenceNormalized,
      confidenceTier,

      // Enhanced Hierarchy (Requirement 18)
      tableRows,
      tableColumns,
      headerRows,
      dataRows,
      totalRows,
      hasMergedCells: mergedCells.length > 0,
      mergedCells,
      hasRepeatedHeaders: repeatedHeaderIndices.length > 0,
      repeatedHeaderRowIndices: repeatedHeaderIndices,
      isContinuation: false,
      detectedTotals,
    };
  }

  // ---------------------------------------------------------------------------
  // Page Continuation Detection & Table Stitching (Requirement 18)
  // ---------------------------------------------------------------------------

  /**
   * Evaluates whether table2 on page N+1 is a logical continuation of table1 on page N.
   */
  public static isContinuation(
    table1: OcrTableStructure,
    table2: OcrTableStructure,
  ): boolean {
    // Must be on subsequent pages or same document
    if (table2.pageNumber <= table1.pageNumber) {
      return false;
    }

    // Check if column counts match
    const colCountMatch = table1.columnCount === table2.columnCount;

    // Check if headers match or if table2 starts directly with data rows or repeated header
    const headersMatch =
      table1.headers.length > 0 &&
      table2.headers.length > 0 &&
      table1.headers.every((h, idx) =>
        h.toUpperCase() === (table2.headers[idx] || "").toUpperCase(),
      );

    // Check if table1 lacks a total row while table2 concludes with a total row
    const table1HasNoTotal = !table1.totalRows || table1.totalRows.length === 0;
    const table2HasTotal = table2.totalRows && table2.totalRows.length > 0;

    // Continuation confidence heuristics
    if (colCountMatch && (headersMatch || (table1HasNoTotal && table2HasTotal))) {
      return true;
    }

    return false;
  }

  /**
   * Merges two continuation tables across page boundaries into a single unified table.
   * Links both tables and preserves original page provenance.
   */
  public static mergeContinuationTables(
    table1: OcrTableStructure,
    table2: OcrTableStructure,
  ): OcrTableStructure {
    // Mark continuation pointers
    table1.continuesToTableId = table2.tableId;
    table1.continuedOnPage = table2.pageNumber;

    table2.isContinuation = true;
    table2.continuedFromTableId = table1.tableId;
    table2.continuedFromPage = table1.pageNumber;

    const mergedId = `unified-${table1.tableId}-${table2.tableId}`;
    const combinedRows: OcrTableRow[] = [];
    const combinedCells: OcrTableCell[] = [...table1.cells];
    const combinedMatrix: string[][] = [...table1.rows];

    // Add table1 rows
    if (table1.tableRows) {
      combinedRows.push(...table1.tableRows);
    }

    // Add table2 data rows (skip repeated headers if identical to table1 headers)
    if (table2.tableRows) {
      const startRowIdx = combinedRows.length;
      table2.tableRows.forEach((row, offset) => {
        if (row.isHeaderRow && offset === 0) {
          // Repeated header at start of page 2; preserve but flag
          row.isHeaderRow = true;
        }
        const updatedRow: OcrTableRow = {
          ...row,
          rowIndex: startRowIdx + offset,
          rowId: `row-${mergedId}-${startRowIdx + offset}`,
        };
        combinedRows.push(updatedRow);
      });
    }

    // Append cells with updated row index
    if (table2.cells) {
      const rowOffset = table1.rowCount;
      table2.cells.forEach((c) => {
        combinedCells.push({
          ...c,
          cellId: `cell-${mergedId}-r${c.rowIndex + rowOffset}-c${c.columnIndex}`,
          rowIndex: c.rowIndex + rowOffset,
        });
      });
    }

    // Append matrix rows
    if (table2.rows) {
      // If table 2 row 0 is repeated header, skip in data matrix or keep
      const sliceRows = table2.hasRepeatedHeaders ? table2.rows.slice(1) : table2.rows.slice(1);
      combinedMatrix.push(...sliceRows);
    }

    const headerRows = combinedRows.filter((r) => r.isHeaderRow);
    const totalRows = combinedRows.filter((r) => r.isTotalRow);
    const dataRows = combinedRows.filter((r) => !r.isHeaderRow && !r.isTotalRow && r.rowType !== "SUBHEADER");

    // Unified columns
    const tableColumns = this.constructColumns(table1.headers, combinedRows, table1.columnCount);
    const detectedTotals = this.detectAndVerifyTotals(combinedRows, table1.columnCount);

    return {
      tableId: mergedId,
      pageNumber: table1.pageNumber,
      tableType: table1.tableType,
      headers: table1.headers,
      rows: combinedMatrix,
      cells: combinedCells,
      rowCount: combinedRows.length,
      columnCount: table1.columnCount,
      boundingBox: table1.boundingBox,
      x: table1.x,
      y: table1.y,
      width: table1.width,
      height: table1.height,
      coordinateSystem: table1.coordinateSystem,
      confidence: Math.round((table1.confidence + table2.confidence) / 2),
      confidenceNormalized: Number((((table1.confidence + table2.confidence) / 2) / 100).toFixed(4)),
      confidenceTier: table1.confidenceTier,

      tableRows: combinedRows,
      tableColumns,
      headerRows,
      dataRows,
      totalRows,
      hasMergedCells: Boolean(table1.hasMergedCells || table2.hasMergedCells),
      mergedCells: [...(table1.mergedCells || []), ...(table2.mergedCells || [])],
      hasRepeatedHeaders: true,
      repeatedHeaderRowIndices: [0, table1.rowCount],
      isContinuation: false,
      continuedOnPage: table2.pageNumber,
      continuesToTableId: table2.tableId,
      detectedTotals,
    };
  }

  // ---------------------------------------------------------------------------
  // Totals & Column Arithmetic Verification (Requirement 18)
  // ---------------------------------------------------------------------------

  /**
   * Detects total rows and verifies column arithmetic sums against data rows.
   */
  public static detectAndVerifyTotals(
    rows: OcrTableRow[],
    colCount: number,
  ): OcrTableTotalSummary[] {
    const totalSummaries: OcrTableTotalSummary[] = [];
    const totalRows = rows.filter((r) => r.isTotalRow);
    const dataRows = rows.filter((r) => !r.isHeaderRow && !r.isTotalRow && r.rowType !== "SUBHEADER");

    for (const totRow of totalRows) {
      for (let cIdx = 0; cIdx < colCount; cIdx++) {
        const cell = totRow.cells.find((c) => c.columnIndex === cIdx);
        if (cell && cell.numericValue !== null) {
          const statedTotal = cell.numericValue;

          // Compute sum of data rows for this column
          let calculatedSum = 0;
          let hasNumericData = false;

          for (const dRow of dataRows) {
            const dCell = dRow.cells.find((c) => c.columnIndex === cIdx);
            if (dCell && dCell.numericValue !== null) {
              calculatedSum += dCell.numericValue;
              hasNumericData = true;
            }
          }

          if (hasNumericData) {
            const roundCalc = Number(calculatedSum.toFixed(2));
            const roundStated = Number(statedTotal.toFixed(2));
            const discrepancy = Number(Math.abs(roundCalc - roundStated).toFixed(2));
            const arithmeticMatches = discrepancy < 0.05; // 5 cent tolerance

            totalSummaries.push({
              rowId: totRow.rowId,
              rowIndex: totRow.rowIndex,
              label: totRow.cells[0]?.text || "Total",
              columnIndex: cIdx,
              amount: roundStated,
              calculatedColumnSum: roundCalc,
              arithmeticMatches,
              discrepancy,
            });
          }
        }
      }
    }

    return totalSummaries;
  }

  // ---------------------------------------------------------------------------
  // Column Construction and Type Inference
  // ---------------------------------------------------------------------------

  private static constructColumns(
    headers: string[],
    rows: OcrTableRow[],
    colCount: number,
  ): OcrTableColumn[] {
    const columns: OcrTableColumn[] = [];

    for (let cIdx = 0; cIdx < colCount; cIdx++) {
      const headerText = headers[cIdx] || `Column ${cIdx + 1}`;
      const colCells = rows.flatMap((r) => r.cells.filter((c) => c.columnIndex === cIdx));

      // Infer data type
      const inferredDataType = this.inferColumnType(headerText, colCells);

      columns.push({
        columnIndex: cIdx,
        headerText,
        inferredDataType,
        cells: colCells,
        alignment: inferredDataType === "NUMERIC" || inferredDataType === "CURRENCY" ? "RIGHT" : "LEFT",
        widthApprox: 1.0 / colCount,
      });
    }

    return columns;
  }

  private static inferColumnType(
    header: string,
    cells: OcrTableCell[],
  ): OcrColumnDataType {
    const upperH = header.toUpperCase();
    if (upperH.includes("AMOUNT") || upperH.includes("TOTAL") || upperH.includes("CHARGE") || upperH.includes("COST")) {
      return "CURRENCY";
    }
    if (upperH.includes("RATE") || upperH.includes("TARIFF") || upperH.includes("PRICE")) {
      return "NUMERIC";
    }
    if (upperH.includes("DATE") || upperH.includes("PERIOD")) {
      return "DATE";
    }
    if (upperH.includes("KWH") || upperH.includes("KVA") || upperH.includes("ENERGY") || upperH.includes("UNITS")) {
      return "NUMERIC";
    }

    // Inspect cells
    let numericCount = 0;
    let totalNonEmpty = 0;

    for (const c of cells) {
      if (c.text.trim().length > 0 && c.rowIndex > 0) {
        totalNonEmpty++;
        if (c.numericValue !== null) {
          numericCount++;
        }
      }
    }

    if (totalNonEmpty > 0 && numericCount / totalNonEmpty >= 0.7) {
      return "NUMERIC";
    }

    return "TEXT";
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private static extractHeaderTokens(
    headerLine: OcrLineBlock,
    knownHeaders?: string[],
  ): string[] {
    if (knownHeaders && knownHeaders.length > 0) {
      return knownHeaders;
    }

    const text = headerLine.text;
    const splitRegex = /\s{2,}|\t|(?<=[A-Za-z])\s+(?=[A-Z0-9])/;
    const tokens = text.split(splitRegex).filter((t) => t.trim().length > 0);
    return tokens.length >= 2 ? tokens : ["Column 1", "Column 2"];
  }

  private static splitRowTokens(text: string, expectedCount: number): string[] {
    const splitRegex = /\s{2,}|\t|(?<=[0-9A-Za-z])\s+(?=[R\d\-+(])/;
    const tokens = text.split(splitRegex).filter((t) => t.trim().length > 0);

    // If split produced fewer columns than expected, try single space partition
    if (tokens.length < expectedCount) {
      const spaceTokens = text.split(/\s+/).filter((t) => t.trim().length > 0);
      if (spaceTokens.length >= expectedCount) {
        return spaceTokens;
      }
    }

    return tokens;
  }

  /**
   * Aligns row tokens into their corresponding columns using spatial/textual positions
   * from the header row. Handles omitted intermediate columns (e.g. empty rate in total rows).
   */
  private static alignTokensToColumns(
    line: OcrLineBlock,
    headerLine: OcrLineBlock,
    headerTokens: string[],
    colCount: number,
  ): string[] {
    const rawTokens = this.splitRowTokens(line.text, colCount);
    if (rawTokens.length === colCount) {
      return rawTokens;
    }

    // If row has fewer tokens than columns, compute header character offsets
    const headerText = headerLine.text;
    const headerPositions: number[] = [];
    let lastHeaderPos = 0;
    for (const h of headerTokens) {
      const idx = headerText.indexOf(h, lastHeaderPos);
      if (idx !== -1) {
        headerPositions.push(idx);
        lastHeaderPos = idx + h.length;
      } else {
        headerPositions.push(
          headerPositions.length > 0 ? headerPositions[headerPositions.length - 1] + 15 : 0,
        );
      }
    }

    // Locate start position of each token in line.text
    const lineText = line.text;
    const tokenPositions: Array<{ token: string; start: number }> = [];
    let searchStart = 0;
    for (const t of rawTokens) {
      const idx = lineText.indexOf(t, searchStart);
      if (idx !== -1) {
        tokenPositions.push({ token: t, start: idx });
        searchStart = idx + t.length;
      } else {
        tokenPositions.push({ token: t, start: searchStart });
      }
    }

    // Result initialized with empty strings
    const aligned: string[] = new Array(colCount).fill("");

    // If there is only 1 token and multiple columns:
    if (tokenPositions.length === 1) {
      aligned[0] = tokenPositions[0].token;
      return aligned;
    }

    // Match each token to the closest header column position with monotonic constraint
    let nextAvailableCol = 0;
    for (let tIdx = 0; tIdx < tokenPositions.length; tIdx++) {
      const tp = tokenPositions[tIdx];
      const remainingTokens = tokenPositions.length - 1 - tIdx;
      const maxColForThisToken = colCount - 1 - remainingTokens;

      let bestCol = nextAvailableCol;
      let minDistance = Infinity;

      for (let c = nextAvailableCol; c <= maxColForThisToken; c++) {
        const hPos = headerPositions[c] ?? (c * (headerText.length / colCount));
        const dist = Math.abs(tp.start - hPos);
        if (dist < minDistance) {
          minDistance = dist;
          bestCol = c;
        }
      }

      aligned[bestCol] = tp.token;
      nextAvailableCol = bestCol + 1;
    }

    return aligned;
  }

  private static isRepeatedHeader(lineUpper: string, headerTokens: string[]): boolean {
    let matchCount = 0;
    for (const h of headerTokens) {
      if (lineUpper.includes(h.toUpperCase())) {
        matchCount++;
      }
    }
    return matchCount >= Math.min(3, headerTokens.length);
  }

  private static isTotalRowText(lineUpper: string): boolean {
    return (
      lineUpper.startsWith("TOTAL") ||
      lineUpper.startsWith("SUB-TOTAL") ||
      lineUpper.startsWith("SUBTOTAL") ||
      lineUpper.startsWith("SUM") ||
      lineUpper.startsWith("BALANCE") ||
      lineUpper.includes("TOTAL DUE") ||
      lineUpper.includes("TOTAL CHARGES") ||
      lineUpper.includes("TOTAL PAYABLE")
    );
  }

  private static isSpanningSubheader(text: string, colCount: number): boolean {
    const upper = text.toUpperCase().trim();
    if (this.isTotalRowText(upper)) {
      return false; // Total rows are NEVER subheaders
    }
    // Subheaders do not contain numeric quantities or financial figures
    const hasNumbers = /\d/.test(text);
    if (hasNumbers) {
      return false;
    }
    const words = text.trim().split(/\s+/);
    return words.length >= 2 && text.length > 15 && colCount >= 3;
  }

  private static extractNumericValueFromCell(val: string): number | null {
    if (!val) return null;
    const cleanNum = val.replace(/[R$\s,]/g, "");
    const parsed = parseFloat(cleanNum);
    return !isNaN(parsed) && cleanNum.length > 0 ? parsed : null;
  }

  private static calculateColumnIntervals(
    lines: OcrLineBlock[],
    colCount: number,
  ): Array<{ startX: number; endX: number }> {
    const width = 1.0 / colCount;
    const intervals: Array<{ startX: number; endX: number }> = [];
    for (let c = 0; c < colCount; c++) {
      intervals.push({
        startX: c * width,
        endX: (c + 1) * width,
      });
    }
    return intervals;
  }

  private static calculateCellBox(
    line: OcrLineBlock,
    cIdx: number,
    colCount: number,
    intervals: Array<{ startX: number; endX: number }>,
  ): OcrBoundingBox {
    const lineX = line.boundingBox[0];
    const lineY = line.boundingBox[1];
    const lineW = line.boundingBox[2];
    const lineH = line.boundingBox[3];

    const cellW = lineW / colCount;
    const cellX = lineX + cIdx * cellW;

    return [Number(cellX.toFixed(4)), Number(lineY.toFixed(4)), Number(cellW.toFixed(4)), Number(lineH.toFixed(4))];
  }

  private static computeBoundingBox(lines: OcrLineBlock[]): OcrBoundingBox {
    let minX = 1.0;
    let minY = 1.0;
    let maxX = 0.0;
    let maxY = 0.0;

    for (const l of lines) {
      const box = l.boundingBox;
      minX = Math.min(minX, box[0]);
      minY = Math.min(minY, box[1]);
      maxX = Math.max(maxX, box[0] + box[2]);
      maxY = Math.max(maxY, box[1] + box[3]);
    }

    return [
      Number(minX.toFixed(4)),
      Number(minY.toFixed(4)),
      Number((maxX - minX).toFixed(4)),
      Number((maxY - minY).toFixed(4)),
    ];
  }

  private static inferTableType(
    lines: OcrLineBlock[],
  ): "BILLING_SCHEDULE" | "METER_READINGS" | "TARIFF_RATES" | "FINANCIAL_SUMMARY" | "GENERIC" {
    const fullText = lines.map((l) => l.text).join(" ").toUpperCase();
    if (fullText.includes("METER") && (fullText.includes("DIAL") || fullText.includes("READING"))) {
      return "METER_READINGS";
    }
    if (fullText.includes("PEAK") && fullText.includes("OFF-PEAK")) {
      return "BILLING_SCHEDULE";
    }
    if (fullText.includes("TARIFF") && fullText.includes("RATE")) {
      return "TARIFF_RATES";
    }
    if (fullText.includes("TOTAL") || fullText.includes("AMOUNT")) {
      return "FINANCIAL_SUMMARY";
    }
    return "GENERIC";
  }

  private static createEmptyTable(
    tableId: string,
    pageNumber: number,
    tableType: any,
    coordinateSystem: CoordinateSystem,
  ): OcrTableStructure {
    return {
      tableId,
      pageNumber,
      tableType,
      headers: [],
      rows: [],
      cells: [],
      rowCount: 0,
      columnCount: 0,
      boundingBox: [0, 0, 0, 0],
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      coordinateSystem,
      confidence: 0,
      confidenceNormalized: 0,
      confidenceTier: "LOW",
      tableRows: [],
      tableColumns: [],
      headerRows: [],
      dataRows: [],
      totalRows: [],
      hasMergedCells: false,
      mergedCells: [],
      hasRepeatedHeaders: false,
      repeatedHeaderRowIndices: [],
      isContinuation: false,
      detectedTotals: [],
    };
  }
}
