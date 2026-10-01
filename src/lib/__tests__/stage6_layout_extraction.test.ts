/**
 * Stage 6 — Document Layout Extraction Verification Suite
 * ========================================================
 * Tests the layout representation engine:
 * 1. Document & Page Layout Representations
 * 2. Headings Identification (Levels 1, 2, 3)
 * 3. Paragraphs Clustering (Narrative blocks, notes)
 * 4. Tables with Unbroken Relational Integrity:
 *    Column -> Row -> Cell -> Page -> Source Document
 * 5. Graceful Handling of Imperfect Layouts:
 *    - Borderless tables
 *    - Multi-line wrapped cells
 *    - Sparse / empty cells
 *    - Merged total rows
 *    - Embedded subsection headers
 * 6. Labels, Values & LabelValuePairs
 * 7. Repeated Headers (Cross-Page detection)
 * 8. Footers & Bottom-of-Page blocks
 * 9. Page Number Indicators
 * 10. Financial Totals (Subtotal, VAT, Total Due)
 * 11. Logical Sections Classification & Element Enclosure
 * 12. Full Pipeline Integration
 */

import { describe, expect, it } from "vitest";
import { DocumentIntelligencePipeline } from "../../domain/intelligence/documentIntelligencePipeline";
import { LayoutAnalysisEngine } from "../../domain/intelligence/layoutAnalysisEngine";
import { PageExtractionEngine } from "../../domain/intelligence/pageExtractionEngine";
import { TextExtractionEngine } from "../../domain/intelligence/textExtractionEngine";
import type { ExtractedPage, ExtractedTextLine } from "../../domain/intelligence/types";

// Helper to construct a multi-page mock PDF with tables, imperfect layouts, and key-values
function createMockLayoutPdfBytes(page1Text: string, page2Text: string): Uint8Array {
  // Simple PDF generator
  const escapePdfText = (str: string) =>
    str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const makeStream = (text: string) => {
    const lines = text.split("\n");
    let y = 750;
    let stream = "BT\n/F1 10 Tf\n";
    for (const line of lines) {
      if (line.trim().length > 0) {
        stream += `50 ${y} Td (${escapePdfText(line)}) Tj\n-50 -${y} Td\n`;
      }
      y -= 15;
    }
    stream += "ET";
    return stream;
  };

  const s1 = makeStream(page1Text);
  const s2 = makeStream(page2Text);

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
4 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>
endobj
5 0 obj
<< /Length ${s1.length} >>
stream
${s1}
endstream
endobj
6 0 obj
<< /Length ${s2.length} >>
stream
${s2}
endstream
endobj
7 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000333 00000 n 
0000000450 00000 n 
0000000570 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
650
%%EOF`;

  return new TextEncoder().encode(pdf);
}

const samplePage1 = `Eskom Holdings SOC Ltd Reg No 2002/015527/30
TAX INVOICE
Page 1 of 2

ACCOUNT INFORMATION
Account Number: 7854321098
Tax Invoice Number: 0456123490
VAT Registration: 4010203040
Customer Name: SASOL SYNTHETIC FUELS PTY LTD
Invoice Date: 2026-09-01
Tariff Name: Megaflex

CURRENT CHARGES
Description   Consumption   Rate   Amount (R)
Active Energy (High Season Peak)   245000 kWh   345.12 c/kWh   845544.00
Active Energy (High Season Off-Peak)   520000 kWh   112.45 c/kWh   584740.00
Network Capacity Charge   12500 kVA   45.20 R/kVA   565000.00
Administration Charge   1 Month   1250.00   1250.00
Total Current Charges   R 1996534.00

This invoice is subject to standard Eskom distribution license conditions.
Please remit payment to the Eskom bank details provided on page 2 within 30 days of invoice date.

Eskom Holdings SOC Ltd - Megawatt Park, Maxwell Drive, Sunninghill`;

const samplePage2 = `Eskom Holdings SOC Ltd Reg No 2002/015527/30
TAX INVOICE
Page 2 of 2

METER READINGS
Meter Number: MTR-987654
Previous Reading: 120500.00
Present Reading: 133000.00

SUMMARY OF CHARGES
Subtotal Charges: R 1996534.00
VAT @ 15%: R 299480.10
Total Amount Due: R 2296014.10

PAYMENT ADVICE
Bank Account: Standard Bank Corporate
Account No: 0012345678
Branch Code: 051001

Terms and conditions apply. Overdue accounts will incur interest in accordance with the Electricity Regulation Act.`;

describe("Stage 6 — Document Layout Extraction Architecture Suite", () => {
  const documentId = "doc_test_stage6_layout";

  it("1. Document Layout Representation: creates complete document & page hierarchy", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    expect(docLayout).toBeDefined();
    expect(docLayout.documentId).toBe(documentId);
    expect(docLayout.totalPages).toBe(2);
    expect(docLayout.pages).toHaveLength(2);

    // Document-level aggregations
    expect(docLayout.headings.length).toBeGreaterThan(0);
    expect(docLayout.paragraphs.length).toBeGreaterThan(0);
    expect(docLayout.tables.length).toBeGreaterThanOrEqual(1);
    expect(docLayout.labels.length).toBeGreaterThan(0);
    expect(docLayout.values.length).toBeGreaterThan(0);
    expect(docLayout.labelValuePairs.length).toBeGreaterThan(0);
    expect(docLayout.footers.length).toBeGreaterThan(0);
    expect(docLayout.pageNumbers.length).toBeGreaterThanOrEqual(1);
    expect(docLayout.totals.length).toBeGreaterThanOrEqual(1);
    expect(docLayout.sections.length).toBeGreaterThan(0);

    // Summary statistics
    expect(docLayout.tableRelationshipSummary.totalTables).toBeGreaterThanOrEqual(1);
    expect(docLayout.tableRelationshipSummary.totalRows).toBeGreaterThanOrEqual(2);
    expect(docLayout.tableRelationshipSummary.totalColumns).toBeGreaterThanOrEqual(2);
    expect(docLayout.tableRelationshipSummary.totalCells).toBeGreaterThanOrEqual(4);
  });

  it("2. Headings: accurately classifies hierarchical levels (H1, H2, H3)", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    // Level 1: Document titles
    const taxInvoiceHdg = docLayout.headings.find(
      (h) => h.level === 1 && h.text.includes("TAX INVOICE"),
    );
    expect(taxInvoiceHdg).toBeDefined();
    expect(taxInvoiceHdg?.pageNumber).toBe(1);

    // Level 2: Major section headers
    const accountHdg = docLayout.headings.find(
      (h) => h.level === 2 && h.text.includes("ACCOUNT INFORMATION"),
    );
    expect(accountHdg).toBeDefined();

    const chargesHdg = docLayout.headings.find(
      (h) => h.level === 2 && h.text.includes("CURRENT CHARGES"),
    );
    expect(chargesHdg).toBeDefined();

    const meterHdg = docLayout.headings.find(
      (h) => h.level === 2 && h.text.includes("METER READINGS"),
    );
    expect(meterHdg).toBeDefined();
  });

  it("3. Paragraphs: clusters narrative blocks with indentation and line counts", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    const termsPara = docLayout.paragraphs.find((p) =>
      p.text.includes("standard Eskom distribution license conditions"),
    );
    expect(termsPara).toBeDefined();
    expect(termsPara?.pageNumber).toBe(1);
    expect(termsPara?.lineCount).toBeGreaterThanOrEqual(1);
    expect(termsPara?.bbox).toHaveLength(4);
    expect(termsPara?.indentation).toBeGreaterThanOrEqual(0);
  });

  it("4. Table Relational Integrity: Column -> Row -> Cell -> Page -> Source Document", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);
    expect(docLayout.tables.length).toBeGreaterThanOrEqual(1);

    const table = docLayout.tables[0];
    expect(table.documentId).toBe(documentId);
    expect(table.pageNumber).toBe(1);
    expect(table.columns.length).toBeGreaterThanOrEqual(4);
    expect(table.rows.length).toBeGreaterThanOrEqual(4);

    // Verify unbroken relational chain for every single cell
    for (const row of table.rows) {
      expect(row.documentId).toBe(documentId);
      expect(row.pageNumber).toBe(table.pageNumber);
      expect(row.tableId).toBe(table.tableId);
      expect(row.rowId).toBe(`${table.tableId}_row_${row.rowIndex}`);

      for (const cell of row.cells) {
        expect(cell.documentId).toBe(documentId);
        expect(cell.pageNumber).toBe(table.pageNumber);
        expect(cell.tableId).toBe(table.tableId);
        expect(cell.rowId).toBe(row.rowId);
        expect(cell.rowIndex).toBe(row.rowIndex);

        const col = table.columns[cell.colIndex];
        expect(col).toBeDefined();
        expect(cell.columnId).toBe(col.columnId);
        expect(cell.columnHeader).toBe(col.headerText);

        // Verify with LayoutAnalysisEngine helper
        const isChainValid = LayoutAnalysisEngine.verifyRelationshipChain(cell, table, documentId);
        expect(isChainValid).toBe(true);
      }
    }

    // Verify relational lookup navigation helpers
    const cell00 = LayoutAnalysisEngine.getCell(table, 0, 0);
    expect(cell00).toBeDefined();
    expect(cell00?.rowIndex).toBe(0);
    expect(cell00?.colIndex).toBe(0);

    const row0 = LayoutAnalysisEngine.getRow(table, 0);
    expect(row0).toBeDefined();
    expect(row0?.rowIndex).toBe(0);

    const col0 = LayoutAnalysisEngine.getColumn(table, 0);
    expect(col0).toBeDefined();
    expect(col0?.colIndex).toBe(0);

    const cellsInRow1 = LayoutAnalysisEngine.getCellsInRow(table, 1);
    expect(cellsInRow1.length).toBe(table.columns.length);

    const cellsInCol0 = LayoutAnalysisEngine.getCellsInColumn(table, 0);
    expect(cellsInCol0.length).toBe(table.rows.length);
  });

  it("5. Imperfect Layouts: handles borderless tables, multiline wrapped cells, and merged totals", () => {
    // Create an imperfect table line sequence
    const mockLines: ExtractedTextLine[] = [
      {
        lineNumber: 1,
        pageNumber: 1,
        text: "Description   Consumption   Rate   Amount (R)",
        bbox: [50, 200, 500, 15],
        tokens: [
          { text: "Description", bbox: [50, 200, 150, 15], confidence: 0.95 },
          { text: "Consumption", bbox: [220, 200, 90, 15], confidence: 0.95 },
          { text: "Rate", bbox: [330, 200, 60, 15], confidence: 0.95 },
          { text: "Amount (R)", bbox: [410, 200, 90, 15], confidence: 0.95 },
        ],
        confidence: 0.95,
      },
      {
        lineNumber: 2,
        pageNumber: 1,
        text: "Active Energy Charge - High Season   245000 kWh   345.12 c/kWh   845544.00",
        bbox: [50, 220, 500, 15],
        tokens: [
          {
            text: "Active Energy Charge - High Season",
            bbox: [50, 220, 160, 15],
            confidence: 0.92,
          },
          { text: "245000 kWh", bbox: [220, 220, 80, 15], confidence: 0.92 },
          { text: "345.12 c/kWh", bbox: [330, 220, 70, 15], confidence: 0.92 },
          { text: "845544.00", bbox: [420, 220, 80, 15], confidence: 0.92 },
        ],
        confidence: 0.92,
      },
      // Wrapped continuation line in description column (no values in other columns)
      {
        lineNumber: 3,
        pageNumber: 1,
        text: "(Peak Rate)",
        bbox: [50, 238, 90, 15],
        tokens: [{ text: "(Peak Rate)", bbox: [50, 238, 90, 15], confidence: 0.9 }],
        confidence: 0.9,
      },
      // Sparse row: Fixed fee has no consumption or rate
      {
        lineNumber: 4,
        pageNumber: 1,
        text: "Fixed Network Charge   1250.00",
        bbox: [50, 256, 500, 15],
        tokens: [
          { text: "Fixed Network Charge", bbox: [50, 256, 140, 15], confidence: 0.92 },
          { text: "1250.00", bbox: [420, 256, 60, 15], confidence: 0.92 },
        ],
        confidence: 0.92,
      },
      // Merged summary row
      {
        lineNumber: 5,
        pageNumber: 1,
        text: "Total Current Charges   846794.00",
        bbox: [50, 275, 500, 15],
        tokens: [
          { text: "Total Current Charges", bbox: [50, 275, 180, 15], confidence: 0.95 },
          { text: "846794.00", bbox: [420, 275, 80, 15], confidence: 0.95 },
        ],
        confidence: 0.95,
      },
    ];

    const mockPage: ExtractedPage = {
      pageNumber: 1,
      dimensions: { width: 595, height: 842, aspectRatio: 595 / 842, rotation: 0 },
      hasText: true,
      isScanned: false,
      characterCount: 400,
      tokenCount: 40,
      rawText: mockLines.map((l) => l.text).join("\n"),
    };

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout([mockPage], mockLines, documentId);
    expect(docLayout.tables).toHaveLength(1);
    const table = docLayout.tables[0];

    // Verify imperfect layout flags were raised
    expect(table.isImperfect).toBe(true);
    expect(table.imperfectLayoutFlags).toContain("BORDERLESS_TABLE");
    expect(table.imperfectLayoutFlags).toContain("MULTI_LINE_WRAPPED_CELL");
    expect(table.imperfectLayoutFlags).toContain("SPARSE_OR_EMPTY_CELLS");
    expect(table.imperfectLayoutFlags).toContain("MERGED_TOTAL_ROW");
    expect(table.layoutNotes && table.layoutNotes.length).toBeGreaterThanOrEqual(3);

    // Verify multi-line wrapped text was merged into row 1's description cell
    const row1DescCell = table.rows[1].cells[0];
    expect(row1DescCell.text).toContain("(Peak Rate)");

    // Verify total row is detected and flagged
    const lastRow = table.rows[table.rows.length - 1];
    expect(lastRow.isTotalRow).toBe(true);
    expect(lastRow.cells[0].isSpanned).toBe(true);
    expect(lastRow.cells[0].colSpan).toBe(3); // Spans cols 0, 1, 2
  });

  it("6. Labels, Values & LabelValuePairs: pairs field keys with spatial coordinates", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    const accPair = docLayout.labelValuePairs.find((p) => p.normalizedKey === "account_number");
    expect(accPair).toBeDefined();
    expect(accPair?.rawValue).toBe("7854321098");
    expect(accPair?.labelBbox).toHaveLength(4);
    expect(accPair?.valueBbox).toHaveLength(4);
    expect(accPair?.alignment).toBe("HORIZONTAL");
    expect(accPair?.distance).toBeGreaterThan(0);

    const vatPair = docLayout.labelValuePairs.find((p) => p.normalizedKey === "vat_registration");
    expect(vatPair).toBeDefined();
    expect(vatPair?.rawValue).toBe("4010203040");
  });

  it("7. Repeated Headers: detects multi-page recurring company headers and banners", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    expect(docLayout.repeatedHeaders.length).toBeGreaterThan(0);
    const corporateHeader = docLayout.repeatedHeaders.find((rh) =>
      rh.text.includes("Eskom Holdings SOC Ltd"),
    );
    expect(corporateHeader).toBeDefined();
    expect(corporateHeader?.pagesOccurred).toContain(1);
    expect(corporateHeader?.pagesOccurred).toContain(2);
    expect(corporateHeader?.frequency).toBeGreaterThanOrEqual(2);
    expect(corporateHeader?.headerType).toBe("ORGANISATION_HEADER");
  });

  it("8. Footers: extracts bottom-of-page contact info and disclaimers", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    const p1Footer = docLayout.footers.find((f) => f.text.includes("Megawatt Park"));
    expect(p1Footer).toBeDefined();
    expect(p1Footer?.pageNumber).toBe(1);
    expect(p1Footer?.bbox[1]).toBeGreaterThan(300);
  });

  it("9. Page Numbers: captures pagination indicators and total page count", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    expect(docLayout.pageNumbers.length).toBeGreaterThanOrEqual(2);
    const p1Indicator = docLayout.pageNumbers.find((p) => p.pageNumber === 1);
    expect(p1Indicator).toBeDefined();
    expect(p1Indicator?.currentPageNumber).toBe(1);
    expect(p1Indicator?.totalPages).toBe(2);

    const p2Indicator = docLayout.pageNumbers.find((p) => p.pageNumber === 2);
    expect(p2Indicator).toBeDefined();
    expect(p2Indicator?.currentPageNumber).toBe(2);
    expect(p2Indicator?.totalPages).toBe(2);
  });

  it("10. Totals: extracts subtotal, VAT, and total invoice amounts with normalization", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    const subtotal = docLayout.totals.find((t) => t.totalType === "SUBTOTAL");
    expect(subtotal).toBeDefined();
    expect(subtotal?.numericAmount).toBe(1996534.0);

    const vat = docLayout.totals.find((t) => t.totalType === "VAT");
    expect(vat).toBeDefined();
    expect(vat?.numericAmount).toBe(299480.1);

    const totalDue = docLayout.totals.find((t) => t.totalType === "TOTAL_DUE");
    expect(totalDue).toBeDefined();
    expect(totalDue?.numericAmount).toBe(2296014.1);
    expect(totalDue?.currency).toBe("ZAR");
  });

  it("11. Logical Sections: creates structured zones enclosing child element IDs", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pages = await PageExtractionEngine.extractPages(bytes, 2);
    const textLines = await TextExtractionEngine.extractTextLines(bytes, pages);

    const docLayout = LayoutAnalysisEngine.extractDocumentLayout(pages, textLines, documentId);

    const sectionTypes = docLayout.sections.map((s) => s.sectionType);
    expect(sectionTypes).toContain("HEADER_SECTION");
    expect(sectionTypes).toContain("ACCOUNT_DETAILS");
    expect(sectionTypes).toContain("ENERGY_CHARGES");
    expect(sectionTypes).toContain("TOTALS_SUMMARY");
    expect(sectionTypes).toContain("FOOTER_SECTION");

    for (const section of docLayout.sections) {
      expect(section.bbox).toHaveLength(4);
      expect(section.containedElementIds.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("12. Pipeline Integration: automatically produces layoutRepresentation in end-to-end run", async () => {
    const bytes = createMockLayoutPdfBytes(samplePage1, samplePage2);
    const pkg = await DocumentIntelligencePipeline.runDocumentIntelligencePipeline(
      bytes,
      "eskom_megaflex_statement.pdf",
      { userId: "test_user" },
    );

    expect(pkg.layoutRepresentation).toBeDefined();
    expect(pkg.layoutRepresentation?.documentId).toBe(pkg.document.id);
    expect(pkg.layoutRepresentation?.tables.length).toBeGreaterThanOrEqual(1);
    expect(pkg.layoutRepresentation?.headings.length).toBeGreaterThan(0);
    expect(pkg.layoutRepresentation?.repeatedHeaders.length).toBeGreaterThan(0);

    // Backward-compatible layouts array still populated
    expect(pkg.layouts.length).toBe(2);
    expect(pkg.layouts[0].blocks.length).toBeGreaterThan(0);
  });
});
