/**
 * STAGE 5 — TEXT EXTRACTION TEST SUITE
 * ========================================================
 * Validates reliable native PDF text extraction preserving:
 *
 * 1. Page boundaries (strict per-page structure, no flattening into one blob)
 * 2. Line structure (vertical baseline clustering, reading order, line bounding boxes)
 * 3. Paragraphs (reconstructed from inter-line spacing, headings, and indentation)
 * 4. Whitespace where meaningful (column gaps, tabular spacing, indentation)
 * 5. Tables where detectable (rows, columns, headers, cells, bounding boxes)
 * 6. Numeric values (integers, decimals, comma/space-separated numbers)
 * 7. Dates (ISO, South African standard, textual, billing periods)
 * 8. Account numbers (Eskom 10-digit, municipal accounts)
 * 9. Meter numbers (physical & AMR meter serials)
 * 10. Invoice numbers (tax invoice numbers)
 * 11. Tariff names (Megaflex, Miniflex, Nightsave Urban, Ruraflex, etc.)
 * 12. Financial values (South African Rand amounts, credits, debits)
 * 13. Units (kWh, kVA, c/kWh, R/kVA, kVArh, %, etc.)
 * 14. Page-aware evidence lookups and pipeline integration
 */

import { describe, expect, it } from "vitest";
import {
  TextExtractionEngine,
  PageExtractionEngine,
  DocumentIntelligencePipeline,
  type ExtractedPage,
} from "../../domain/intelligence";

describe("Stage 5 — Reliable Native Text Extraction Architecture Suite", () => {
  const TEST_ORG_ID = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c";

  // Synthesize realistic Eskom Megaflex PDF document bytes with multi-page structure,
  // multi-column tables, key-value headers, tariffs, meters, and financial figures
  const createMockPdfBytes = (): Uint8Array => {
    const page1Commands = [
      "1 0 0 1 72 790 Tm (ESKOM HOLDINGS SOC LTD) Tj",
      "1 0 0 1 72 770 Tm (TAX INVOICE) Tj",
      "1 0 0 1 72 740 Tm (Account Number: 0123456789) Tj",
      "1 0 0 1 72 722 Tm (Tax Invoice Number: INV-2026-001) Tj",
      "1 0 0 1 72 704 Tm (Invoice Date: 2026/01/15) Tj",
      "1 0 0 1 72 686 Tm (Billing Period: 2026/01/01 to 2026/01/31) Tj",
      "1 0 0 1 72 650 Tm (Tariff Name: Megaflex Non-Local Authority) Tj",
      "1 0 0 1 72 632 Tm (Physical Meter Number: M123456) Tj",
      "1 0 0 1 72 590 Tm (ACCOUNT SUMMARY AND CURRENT CHARGES) Tj",
      "1 0 0 1 72 570 Tm (This tax invoice reflects the electricity consumption charges for January 2026.) Tj",
      "1 0 0 1 72 554 Tm (All charges are levied in accordance with NERSA approved Megaflex tariff structures.) Tj",
      "1 0 0 1 72 510 Tm (Total Amount Due: R 1,842,910.45) Tj",
    ].join("\n");

    const page2Commands = [
      "1 0 0 1 72 790 Tm (DETAILED BILLING DETERMINANTS AND CONSUMPTION BREAKDOWN) Tj",
      "1 0 0 1 72 760 Tm (Period   Consumption \\(kWh\\)   Rate \\(c/kWh\\)   Total Amount \\(R\\)) Tj",
      "1 0 0 1 72 740 Tm (Peak   452,300   354.21   1,602,091.83) Tj",
      "1 0 0 1 72 720 Tm (Standard   620,150   182.45   1,131,463.68) Tj",
      "1 0 0 1 72 700 Tm (Off-Peak   379,850   94.12   357,514.82) Tj",
      "1 0 0 1 72 660 Tm (Maximum Demand Recorded: 2,450 kVA at 45.50 R/kVA) Tj",
      "1 0 0 1 72 640 Tm (Reactive Energy: 184,200 kVArh) Tj",
      "1 0 0 1 72 600 Tm (Subtotal Energy Charges: R 3,091,070.33) Tj",
      "1 0 0 1 72 580 Tm (Value Added Tax 15%: R 463,660.55) Tj",
      "1 0 0 1 72 540 Tm (Net Payable: R 3,554,730.88) Tj",
    ].join("\n");

    const pdfStr = `%PDF-1.7
2 0 obj
<< /Type /Catalog /Pages 3 0 R >>
endobj
3 0 obj
<< /Type /Pages /Kids [4 0 R 5 0 R] /Count 2 >>
endobj
8 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
4 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 8 0 R >> >> /Contents 6 0 R >>
endobj
5 0 obj
<< /Type /Page /Parent 3 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 8 0 R >> >> /Contents 7 0 R >>
endobj
6 0 obj
<< /Length ${page1Commands.length + 50} >>
stream
BT
/F1 12 Tf
${page1Commands}
ET
endstream
endobj
7 0 obj
<< /Length ${page2Commands.length + 50} >>
stream
BT
/F1 12 Tf
${page2Commands}
ET
endstream
endobj
xref
0 9
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000179 00000 n 
0000000295 00000 n 
0000000411 00000 n 
0000000600 00000 n 
0000000850 00000 n 
trailer
<< /Size 9 /Root 2 0 R >>
startxref
1000
%%EOF`;

    return new TextEncoder().encode(pdfStr);
  };

  // =========================================================================
  // 1. Page Boundary Preservation (No Blob Flattening)
  // =========================================================================
  describe("1. Page Boundary Preservation", () => {
    it("preserves strict page boundaries and does not flatten into one uncontrolled blob", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);

      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      // Verify page separation
      expect(structuredResult.totalPageCount).toBe(2);
      expect(structuredResult.pages).toHaveLength(2);

      const page1 = structuredResult.pages[0];
      const page2 = structuredResult.pages[1];

      expect(page1.pageNumber).toBe(1);
      expect(page2.pageNumber).toBe(2);

      // Page 1 contains Invoice Header & Summary, Page 2 contains Determinants breakdown
      expect(page1.rawText).toContain("TAX INVOICE");
      expect(page1.rawText).toContain("Account Number: 0123456789");
      expect(page1.rawText).not.toContain("DETAILED BILLING DETERMINANTS");

      expect(page2.rawText).toContain("DETAILED BILLING DETERMINANTS");
      expect(page2.rawText).toContain("452,300");
      expect(page2.rawText).not.toContain("ACCOUNT SUMMARY AND CURRENT CHARGES");

      // Verify each page has independent stats
      expect(page1.characterCount).toBeGreaterThan(50);
      expect(page2.characterCount).toBeGreaterThan(50);
      expect(page1.lines.length).toBeGreaterThan(0);
      expect(page2.lines.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. Line Structure & Baseline Alignment
  // =========================================================================
  describe("2. Line Structure & Baseline Alignment", () => {
    it("preserves lines with sequential numbering, baseline clustering, and bounding boxes", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      expect(structuredResult.allLines.length).toBeGreaterThanOrEqual(15);

      for (const line of structuredResult.allLines) {
        expect(line.lineNumber).toBeGreaterThan(0);
        expect(line.pageNumber).toBeGreaterThanOrEqual(1);
        expect(line.text.trim().length).toBeGreaterThan(0);
        expect(line.bbox).toHaveLength(4);
        expect(line.bbox[0]).toBeGreaterThanOrEqual(0); // X
        expect(line.bbox[1]).toBeGreaterThanOrEqual(0); // Y
        expect(line.bbox[2]).toBeGreaterThan(0); // Width
        expect(line.bbox[3]).toBeGreaterThan(0); // Height
        expect(line.confidence).toBeGreaterThanOrEqual(0.85);
      }
    });
  });

  // =========================================================================
  // 3. Paragraph Reconstruction
  // =========================================================================
  describe("3. Paragraph Reconstruction", () => {
    it("groups consecutive lines into semantic paragraphs separated by headings and large vertical gaps", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      expect(structuredResult.allParagraphs.length).toBeGreaterThan(0);

      const page1Paragraphs = structuredResult.allParagraphs.filter((p) => p.pageNumber === 1);
      expect(page1Paragraphs.length).toBeGreaterThanOrEqual(2);

      // Verify paragraph properties
      for (const para of page1Paragraphs) {
        expect(para.paragraphId).toMatch(/^p\d+_para\d+$/);
        expect(para.text.length).toBeGreaterThan(0);
        expect(para.lines.length).toBeGreaterThanOrEqual(1);
        expect(para.bbox).toHaveLength(4);
        expect(para.indentation).toBeGreaterThanOrEqual(0);
      }

      // Check multi-line narrative paragraph grouping
      const narrativePara = page1Paragraphs.find(
        (p) =>
          p.text.includes("electricity consumption charges") &&
          p.text.includes("NERSA approved Megaflex"),
      );
      expect(narrativePara).toBeDefined();
      expect(narrativePara!.lineCount).toBe(2);
    });
  });

  // =========================================================================
  // 4. Meaningful Whitespace Preservation
  // =========================================================================
  describe("4. Meaningful Whitespace Preservation", () => {
    it("preserves multi-space column separation in tabular and key-value sections", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const page2 = structuredResult.pages.find((p) => p.pageNumber === 2);
      expect(page2).toBeDefined();

      // Find the tabular row line for Peak consumption
      const peakLine = page2!.lines.find(
        (l) => l.text.includes("Peak") && l.text.includes("452,300"),
      );
      expect(peakLine).toBeDefined();

      // The line must contain significant column spacing (2 or more spaces between columns)
      // and NOT collapse columns into "Peak 452,300 354.21 1,602,091.83" with single space
      expect(peakLine!.text).toMatch(/Peak\s{2,}452,300/);
      expect(peakLine!.text).toMatch(/452,300\s{2,}354\.21/);
    });
  });

  // =========================================================================
  // 5. Table Detection Where Detectable
  // =========================================================================
  describe("5. Table Detection Where Detectable", () => {
    it("detects structured tables, columns, rows, and cells with bounding boxes", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const page2Tables = structuredResult.allTables.filter((t) => t.pageNumber === 2);
      expect(page2Tables.length).toBeGreaterThanOrEqual(1);

      const table = page2Tables[0];
      expect(table.tableId).toBeDefined();
      expect(table.rows.length).toBeGreaterThanOrEqual(3); // Header + Peak + Standard + Off-Peak
      expect(table.columns.length).toBeGreaterThanOrEqual(3);

      // Check header row
      const headerRow = table.rows[0];
      expect(headerRow.isHeaderRow).toBe(true);
      expect(headerRow.cells.some((c) => /consumption/i.test(c.text))).toBe(true);

      // Check data cells
      const peakRow = table.rows.find((r) => r.cells.some((c) => c.text === "Peak"));
      expect(peakRow).toBeDefined();
      const consumptionCell = peakRow!.cells.find((c) => c.text === "452,300");
      expect(consumptionCell).toBeDefined();
      expect(consumptionCell!.bbox).toHaveLength(4);
    });
  });

  // =========================================================================
  // 6. Entity Extraction (Page-Aware Evidence)
  // =========================================================================
  describe("6. Entity Extraction (Page-Aware Evidence)", () => {
    it("extracts and normalizes numeric values with exact coordinates", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const numEntities = structuredResult.entitiesByType.NUMERIC_VALUE;
      expect(numEntities.length).toBeGreaterThan(0);

      const peakKwh = numEntities.find((e) => e.rawValue === "452,300");
      expect(peakKwh).toBeDefined();
      expect(peakKwh!.normalizedValue).toBe(452300);
      expect(peakKwh!.pageNumber).toBe(2);
      expect(peakKwh!.contextSnippet).toContain("Peak");
    });

    it("extracts and normalizes dates (ISO and slash formats)", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const dateEntities = structuredResult.entitiesByType.DATE;
      expect(dateEntities.length).toBeGreaterThanOrEqual(1);

      const invoiceDate = dateEntities.find((e) => e.rawValue.includes("2026/01/15"));
      expect(invoiceDate).toBeDefined();
      expect(invoiceDate!.normalizedValue).toBe("2026-01-15");
      expect(invoiceDate!.pageNumber).toBe(1);
    });

    it("extracts and normalizes Eskom 10-digit account numbers", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const accEntities = structuredResult.entitiesByType.ACCOUNT_NUMBER;
      expect(accEntities.length).toBeGreaterThanOrEqual(1);

      const acc = accEntities.find((e) => e.rawValue === "0123456789");
      expect(acc).toBeDefined();
      expect(acc!.normalizedValue).toBe("0123456789");
      expect(acc!.pageNumber).toBe(1);
    });

    it("extracts and normalizes physical and AMR meter numbers", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const meterEntities = structuredResult.entitiesByType.METER_NUMBER;
      expect(meterEntities.length).toBeGreaterThanOrEqual(1);

      const meter = meterEntities.find((e) => e.rawValue === "M123456");
      expect(meter).toBeDefined();
      expect(meter!.normalizedValue).toBe("M123456");
      expect(meter!.pageNumber).toBe(1);
    });

    it("extracts and normalizes tax invoice numbers", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const invEntities = structuredResult.entitiesByType.INVOICE_NUMBER;
      expect(invEntities.length).toBeGreaterThanOrEqual(1);

      const inv = invEntities.find((e) => e.rawValue === "INV-2026-001");
      expect(inv).toBeDefined();
      expect(inv!.normalizedValue).toBe("INV-2026-001");
      expect(inv!.pageNumber).toBe(1);
    });

    it("extracts and normalizes Eskom tariff schedule names", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const tariffEntities = structuredResult.entitiesByType.TARIFF_NAME;
      expect(tariffEntities.length).toBeGreaterThanOrEqual(1);

      const tariff = tariffEntities.find((e) => /megaflex/i.test(e.rawValue));
      expect(tariff).toBeDefined();
      expect(tariff!.normalizedValue).toContain("MEGAFLEX");
      expect(tariff!.pageNumber).toBe(1);
    });

    it("extracts and normalizes South African Rand financial values", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const finEntities = structuredResult.entitiesByType.FINANCIAL_VALUE;
      expect(finEntities.length).toBeGreaterThanOrEqual(2);

      const totalDue = finEntities.find((e) => e.rawValue.includes("1,842,910.45"));
      expect(totalDue).toBeDefined();
      expect(totalDue!.normalizedValue).toBe(1842910.45);
      expect(totalDue!.pageNumber).toBe(1);

      const vatAmount = finEntities.find((e) => e.rawValue.includes("463,660.55"));
      expect(vatAmount).toBeDefined();
      expect(vatAmount!.normalizedValue).toBe(463660.55);
      expect(vatAmount!.pageNumber).toBe(2);
    });

    it("extracts and normalizes electrical and utility measurement units", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const unitEntities = structuredResult.entitiesByType.UNIT;
      expect(unitEntities.length).toBeGreaterThan(0);

      const kwhUnit = unitEntities.find((e) => e.rawValue === "kWh");
      expect(kwhUnit).toBeDefined();
      expect(kwhUnit!.pageNumber).toBe(2);

      const kvaUnit = unitEntities.find((e) => e.rawValue === "kVA");
      expect(kvaUnit).toBeDefined();

      const rateUnit = unitEntities.find((e) => e.rawValue === "c/kWh");
      expect(rateUnit).toBeDefined();

      const kvarhUnit = unitEntities.find((e) => e.rawValue === "kVArh");
      expect(kvarhUnit).toBeDefined();

      const pctUnit = unitEntities.find((e) => e.rawValue === "%");
      expect(pctUnit).toBeDefined();
    });
  });

  // =========================================================================
  // 7. Page-Aware Evidence Lookups
  // =========================================================================
  describe("7. Page-Aware Evidence Lookups", () => {
    it("locates specific entities by keyword query with exact page and bounding box", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const found = TextExtractionEngine.findEntities(structuredResult, "0123456789");
      expect(found).toHaveLength(1);
      expect(found[0].entityType).toBe("ACCOUNT_NUMBER");
      expect(found[0].pageNumber).toBe(1);
      expect(found[0].bbox).toBeDefined();
      expect(found[0].contextSnippet).toContain("Account Number");
    });

    it("filters entities by type and page number", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const page1Fin = TextExtractionEngine.findEntitiesByType(
        structuredResult,
        "FINANCIAL_VALUE",
        1,
      );
      const page2Fin = TextExtractionEngine.findEntitiesByType(
        structuredResult,
        "FINANCIAL_VALUE",
        2,
      );

      expect(page1Fin.length).toBeGreaterThan(0);
      expect(page2Fin.length).toBeGreaterThan(0);

      for (const f of page1Fin) expect(f.pageNumber).toBe(1);
      for (const f of page2Fin) expect(f.pageNumber).toBe(2);
    });

    it("retrieves page structure for an individual page", async () => {
      const pdfBytes = createMockPdfBytes();
      const pages = await PageExtractionEngine.extractPages(pdfBytes, 2);
      const structuredResult = await TextExtractionEngine.extractStructuredText(pdfBytes, pages);

      const p1 = TextExtractionEngine.getPageStructure(structuredResult, 1);
      expect(p1).toBeDefined();
      expect(p1!.pageNumber).toBe(1);
      expect(p1!.lines.length).toBeGreaterThan(0);

      const nonExistent = TextExtractionEngine.getPageStructure(structuredResult, 999);
      expect(nonExistent).toBeNull();
    });
  });

  // =========================================================================
  // 8. End-to-End Pipeline Integration
  // =========================================================================
  describe("8. End-to-End Pipeline Integration", () => {
    it("populates structuredText in the returned package during 10-stage pipeline execution", async () => {
      const pdfBytes = createMockPdfBytes();

      const pkg = await DocumentIntelligencePipeline.processDocument(
        pdfBytes,
        "Megaflex_Invoice_Jan2026.pdf",
        TEST_ORG_ID,
      );

      // Verify structuredText is attached to the returned DocumentIntelligencePackage
      expect(pkg.structuredText).toBeDefined();
      expect(pkg.structuredText!.totalPageCount).toBe(2);
      expect(pkg.structuredText!.pages).toHaveLength(2);
      expect(pkg.structuredText!.allLines.length).toBeGreaterThanOrEqual(15);
      expect(pkg.structuredText!.allParagraphs.length).toBeGreaterThan(0);
      expect(pkg.structuredText!.allEntities.length).toBeGreaterThan(0);

      // Verify that determinants were reliably extracted from structured text
      expect(pkg.handoff.aiValidationPayload.determinants.accountNumber).toBe("0123456789");
      expect(pkg.handoff.aiValidationPayload.determinants.tariffName).toContain("Megaflex");
    });
  });
});
