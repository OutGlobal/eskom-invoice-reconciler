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
  CoordinateSystem,
  OcrElementBoundingBox,
  OcrConfidenceTier,
  OcrDocumentSection,
} from "./types";
import { TableReconstructionEngine } from "./tableReconstructionEngine";
import { DocumentStructureEngine } from "./documentStructureEngine";

export class OcrLayoutStructureEngine {
  /**
   * Reconstructs full page structure: reading order, blocks, tables, and key-values
   */
  public static analyzePageLayout(
    lines: OcrLineBlock[],
    pageNumber: number = 1,
    nativeBlocks?: OcrLayoutBlock[],
  ): {
    sortedLines: OcrLineBlock[];
    blocks: OcrLayoutBlock[];
    tables: OcrTableStructure[];
    keyValuePairs: OcrKeyValuePair[];
    sections: OcrDocumentSection[];
  } {
    // 1. Sort lines into natural top-to-bottom reading order
    const sortedLines = this.sortLinesReadingOrder(lines);

    // 2. Identify Key-Value Pairs
    const keyValuePairs = this.extractKeyValuePairs(sortedLines, pageNumber);

    // 3. Detect and reconstruct tabular structures
    const tables = this.detectTables(sortedLines, pageNumber);

    // 4. Group lines into semantic layout blocks, enriching native provider blocks if provided
    const blocks =
      nativeBlocks && nativeBlocks.length > 0
        ? this.enrichNativeBlocks(nativeBlocks, sortedLines, tables, pageNumber)
        : this.groupIntoBlocks(sortedLines, tables, pageNumber);

    // 5. Ensure confidenceTier is populated on all structural tiers (Requirement 13)
    const tierOf = (score: number): OcrConfidenceTier =>
      score >= 85 ? "HIGH" : score >= 70 ? "MEDIUM" : "LOW";

    sortedLines.forEach((l) => {
      if (!l.confidenceTier) l.confidenceTier = tierOf(l.confidence);
      l.words?.forEach((w) => {
        if (!w.confidenceTier) w.confidenceTier = tierOf(w.confidence);
      });
    });

    blocks.forEach((b) => {
      if (!b.confidenceTier) b.confidenceTier = tierOf(b.confidence);
      b.lines?.forEach((l) => {
        if (!l.confidenceTier) l.confidenceTier = tierOf(l.confidence);
      });
    });

    tables.forEach((t) => {
      if (!t.confidenceTier) t.confidenceTier = tierOf(t.confidence);
      t.cells?.forEach((c) => {
        if (!c.confidenceTier) c.confidenceTier = tierOf(c.confidence);
      });
    });

    keyValuePairs.forEach((kv) => {
      if (!kv.confidenceTier) kv.confidenceTier = tierOf(kv.confidence);
    });

    // 6. Identify Document Sections on this page (Requirement 20)
    const sections = DocumentStructureEngine.identifyPageSections({
      pageNumber,
      fullText: sortedLines.map((l) => l.text).join("\n"),
      geometry: { width: 1000, height: 1414, dpi: 300, aspectRatio: 0.7072, rotation: 0 },
      words: sortedLines.flatMap((l) => l.words || []),
      lines: sortedLines,
      blocks,
      tables,
      keyValuePairs,
      averageConfidence: 90,
      minConfidence: 80,
      characterCount: sortedLines.reduce((acc, l) => acc + l.text.length, 0),
      isNativeDigital: true,
      isScannedRaster: false,
      processingDurationMs: 0,
    });

    return {
      sortedLines,
      blocks,
      tables,
      keyValuePairs,
      sections,
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

            const kvCoordSys = line.coordinateSystem || "NORMALIZED_0_1";
            const valX = valBox[0];
            const valY = valBox[1];
            const valW = valBox[2];
            const valH = valBox[3];
            const kvConf = line.confidence;
            const kvNormConf = Number((kvConf > 1 ? kvConf / 100 : kvConf).toFixed(4));

            pairs.push({
              pairId: `kv-p${pageNumber}-${pairs.length}`,
              pageNumber,
              keyText: label,
              keyNormalized: this.normalizeKey(label),
              keyBoundingBox: keyBox,
              valueText: afterText,
              valueNormalized: this.parseValue(afterText),
              valueBoundingBox: valBox,
              x: valX,
              y: valY,
              width: valW,
              height: valH,
              coordinateSystem: kvCoordSys,
              detailedBoundingBox: {
                pageNumber,
                x: valX,
                y: valY,
                width: valW,
                height: valH,
                coordinateSystem: kvCoordSys,
                confidence: kvNormConf,
              },
              confidence: kvConf,
              confidenceNormalized: kvNormConf,
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
                const vCoordSys = nextLine.coordinateSystem || "NORMALIZED_0_1";
                const vX = nextLine.x ?? nextLine.boundingBox[0];
                const vY = nextLine.y ?? nextLine.boundingBox[1];
                const vW = nextLine.width ?? nextLine.boundingBox[2];
                const vH = nextLine.height ?? nextLine.boundingBox[3];
                const vConf = Math.round((line.confidence + nextLine.confidence) / 2);
                const vNormConf = Number((vConf > 1 ? vConf / 100 : vConf).toFixed(4));

                pairs.push({
                  pairId: `kv-p${pageNumber}-${pairs.length}`,
                  pageNumber,
                  keyText: label,
                  keyNormalized: this.normalizeKey(label),
                  keyBoundingBox: line.boundingBox,
                  valueText: valText,
                  valueNormalized: this.parseValue(valText),
                  valueBoundingBox: nextLine.boundingBox,
                  x: vX,
                  y: vY,
                  width: vW,
                  height: vH,
                  coordinateSystem: vCoordSys,
                  detailedBoundingBox: {
                    pageNumber,
                    x: vX,
                    y: vY,
                    width: vW,
                    height: vH,
                    coordinateSystem: vCoordSys,
                    confidence: vNormConf,
                  },
                  confidence: vConf,
                  confidenceNormalized: vNormConf,
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
      ["TIME", "ENERGY", "RATE", "AMOUNT"],
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
   * Builds an authoritative OcrTableStructure from consecutive aligned lines,
   * preserving TABLE → ROW → COLUMN → CELL relationships via TableReconstructionEngine.
   */
  private static buildTableFromLines(
    lines: OcrLineBlock[],
    pageNumber: number,
    tableIndex: number,
  ): OcrTableStructure {
    return TableReconstructionEngine.reconstructTable(lines, pageNumber, {
      tableId: `table-p${pageNumber}-${tableIndex}`,
      coordinateSystem: lines[0]?.coordinateSystem || "NORMALIZED_0_1",
    });
  }

  /**
   * Enriches native provider layout blocks with detected table structures, ensuring
   * every block has its constituent lines and words linked.
   */
  private static enrichNativeBlocks(
    nativeBlocks: OcrLayoutBlock[],
    lines: OcrLineBlock[],
    tables: OcrTableStructure[],
    pageNumber: number,
  ): OcrLayoutBlock[] {
    const blocks: OcrLayoutBlock[] = [];
    const assignedLineIds = new Set<string>();

    // 1. Incorporate tables as table blocks
    for (const tbl of tables) {
      const tblLines = lines.filter(
        (l) =>
          l.boundingBox[1] >= tbl.boundingBox[1] - 0.01 &&
          l.boundingBox[1] + l.boundingBox[3] <= tbl.boundingBox[1] + tbl.boundingBox[3] + 0.01,
      );
      tblLines.forEach((l) => assignedLineIds.add(l.lineId));

      const tblX = tbl.x !== undefined ? tbl.x : tbl.boundingBox[0];
      const tblY = tbl.y !== undefined ? tbl.y : tbl.boundingBox[1];
      const tblW = tbl.width !== undefined ? tbl.width : tbl.boundingBox[2];
      const tblH = tbl.height !== undefined ? tbl.height : tbl.boundingBox[3];
      const coordSys = tbl.coordinateSystem || "NORMALIZED_0_1";

      blocks.push({
        blockId: `block-table-${tbl.tableId}`,
        pageNumber,
        type: "TABLE",
        boundingBox: tbl.boundingBox,
        x: tblX,
        y: tblY,
        width: tblW,
        height: tblH,
        coordinateSystem: coordSys,
        detailedBoundingBox: {
          pageNumber,
          x: tblX,
          y: tblY,
          width: tblW,
          height: tblH,
          coordinateSystem: coordSys,
          confidence: Number(
            (tbl.confidence > 1 ? tbl.confidence / 100 : tbl.confidence).toFixed(4),
          ),
        },
        text: tbl.rows.map((r) => r.join(" | ")).join("\n"),
        lines: tblLines,
        confidence: tbl.confidence,
        confidenceNormalized: Number(
          (tbl.confidence > 1 ? tbl.confidence / 100 : tbl.confidence).toFixed(4),
        ),
      });
    }

    // 2. Add native blocks with constituent lines attached
    for (const nb of nativeBlocks) {
      const blockLines = lines.filter((l) => {
        if (assignedLineIds.has(l.lineId)) return false;
        const insideX = l.x >= nb.x - 10 && l.x + l.width <= nb.x + nb.width + 10;
        const insideY = l.y >= nb.y - 10 && l.y + l.height <= nb.y + nb.height + 10;
        return insideX && insideY;
      });
      blockLines.forEach((l) => assignedLineIds.add(l.lineId));

      blocks.push({
        ...nb,
        lines: blockLines.length > 0 ? blockLines : nb.lines,
        text: nb.text || blockLines.map((l) => l.text).join("\n"),
      });
    }

    // 3. Group any remaining unassigned lines into semantic blocks
    const leftoverLines = lines.filter((l) => !assignedLineIds.has(l.lineId));
    if (leftoverLines.length > 0) {
      const leftoverBlocks = this.groupIntoBlocks(leftoverLines, [], pageNumber);
      blocks.push(...leftoverBlocks);
    }

    return blocks;
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
      const tblLines = lines.filter(
        (l) =>
          l.boundingBox[1] >= tbl.boundingBox[1] - 0.01 &&
          l.boundingBox[1] + l.boundingBox[3] <= tbl.boundingBox[1] + tbl.boundingBox[3] + 0.01,
      );
      tblLines.forEach((l) => tableLineIds.add(l.lineId));

      const tblX = tbl.x !== undefined ? tbl.x : tbl.boundingBox[0];
      const tblY = tbl.y !== undefined ? tbl.y : tbl.boundingBox[1];
      const tblW = tbl.width !== undefined ? tbl.width : tbl.boundingBox[2];
      const tblH = tbl.height !== undefined ? tbl.height : tbl.boundingBox[3];
      const coordSys = tbl.coordinateSystem || "NORMALIZED_0_1";

      blocks.push({
        blockId: `block-table-${tbl.tableId}`,
        pageNumber,
        type: "TABLE",
        boundingBox: tbl.boundingBox,
        x: tblX,
        y: tblY,
        width: tblW,
        height: tblH,
        coordinateSystem: coordSys,
        detailedBoundingBox: {
          pageNumber,
          x: tblX,
          y: tblY,
          width: tblW,
          height: tblH,
          coordinateSystem: coordSys,
          confidence: Number(
            (tbl.confidence > 1 ? tbl.confidence / 100 : tbl.confidence).toFixed(4),
          ),
        },
        text: tbl.rows.map((r) => r.join(" | ")).join("\n"),
        lines: tblLines,
        confidence: tbl.confidence,
        confidenceNormalized: Number(
          (tbl.confidence > 1 ? tbl.confidence / 100 : tbl.confidence).toFixed(4),
        ),
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
    const bWidth = Math.max(0.01, maxX - minX);
    const bHeight = Math.max(0.01, maxY - minY);

    const text = lines.map((l) => l.text).join("\n");
    const isHeading = lines.length === 1 && lines[0].boundingBox[3] > 0.03;
    const avgConf = Math.round(lines.reduce((acc, l) => acc + l.confidence, 0) / lines.length);
    const coordSys: CoordinateSystem = lines[0]?.coordinateSystem || "NORMALIZED_0_1";

    const x = lines[0]?.x !== undefined ? Math.min(...lines.map((l) => l.x)) : minX;
    const y = lines[0]?.y !== undefined ? lines[0].y : minY;
    const w =
      lines[0]?.width !== undefined ? Math.max(...lines.map((l) => l.x + l.width)) - x : bWidth;
    const h =
      lines[0]?.height !== undefined
        ? lines[lines.length - 1].y + lines[lines.length - 1].height - y
        : bHeight;

    return {
      blockId: `block-p${pageNumber}-${blockIdx}`,
      pageNumber,
      type: isHeading ? "HEADING" : "PARAGRAPH",
      boundingBox: [minX, minY, bWidth, bHeight],
      x,
      y,
      width: w,
      height: h,
      coordinateSystem: coordSys,
      detailedBoundingBox: {
        pageNumber,
        x,
        y,
        width: w,
        height: h,
        coordinateSystem: coordSys,
        confidence: Number((avgConf > 1 ? avgConf / 100 : avgConf).toFixed(4)),
      },
      text,
      lines,
      confidence: avgConf,
      confidenceNormalized: Number((avgConf > 1 ? avgConf / 100 : avgConf).toFixed(4)),
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
