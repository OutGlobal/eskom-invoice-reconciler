/**
 * Stage 7 — Document Classification Architecture & Verification Suite
 * =========================================================================
 * Authoritative verification suite for deterministic document classification.
 *
 * Requirements Tested:
 * 1. Initial 9 Standard Categories:
 *    - UTILITY_INVOICE
 *    - UTILITY_STATEMENT
 *    - METER_DATA
 *    - TARIFF_DOCUMENT
 *    - CREDIT_NOTE
 *    - ADJUSTMENT
 *    - PAYMENT_DOCUMENT
 *    - OTHER
 *    - UNKNOWN
 * 2. 4 Authoritative Confidence Levels:
 *    - HIGH_CONFIDENCE (score >= 0.85)
 *    - MEDIUM_CONFIDENCE (0.60 <= score < 0.85)
 *    - LOW_CONFIDENCE (0.25 <= score < 0.60)
 *    - UNKNOWN (score < 0.25)
 * 3. Deterministic Indicators First:
 *    - Strictly evaluates structural, lexical, and entity markers
 *    - Preserves deterministicIndicators array and audit rationale
 * 4. Strict Anti-Hallucination & Insufficient Evidence Guard:
 *    - Refuses to invent document types when evidence is insufficient
 *    - Short text (<25 chars), blank pages, and noise strictly yield UNKNOWN
 * 5. Page-Level Section Classification:
 *    - Tax invoice header, line items, meter schedule, account summary, remittance
 * 6. Pipeline Integration:
 *    - Classification output attached to DocumentIntelligencePackage
 *    - Persisted in DocumentRegistryRecord
 */

import { describe, it, expect } from "vitest";
import { DocumentClassifier } from "../../domain/intelligence/documentClassifier";
import { DocumentIntelligencePipeline } from "../../domain/intelligence/documentIntelligencePipeline";
import type {
  ExtractedPage,
  ExtractedTextLine,
  StandardDocumentCategory,
  ClassificationConfidenceLevel,
} from "../../domain/intelligence/types";

// Helper to construct simulated extracted pages and lines
function createMockExtraction(
  textByPage: string[],
  docId = "mock-doc-001",
): { pages: ExtractedPage[]; lines: ExtractedTextLine[] } {
  const pages: ExtractedPage[] = textByPage.map((text, idx) => ({
    documentId: docId,
    pageNumber: idx + 1,
    dimensions: { width: 595, height: 842, aspectRatio: 0.707, isStandardA4: true },
    rotation: 0,
    hasText: text.trim().length > 0,
    characterCount: text.length,
    tokenCount: text.split(/\s+/).filter(Boolean).length,
    isScanned: false,
    rawText: text,
  }));

  const lines: ExtractedTextLine[] = [];
  let lineId = 1;

  textByPage.forEach((pageText, pIdx) => {
    const rawLines = pageText.split("\n").filter((l) => l.trim().length > 0);
    rawLines.forEach((lineText, lIdx) => {
      lines.push({
        id: `line-${lineId++}`,
        documentId: docId,
        pageNumber: pIdx + 1,
        lineNumber: lIdx + 1,
        text: lineText.trim(),
        bbox: [50, 100 + lIdx * 20, 500, 115 + lIdx * 20],
        confidence: 0.99,
        isHeader: lIdx === 0,
        isFooter: false,
      });
    });
  });

  return { pages, lines };
}

describe("Stage 7 — Document Classification Architecture Suite", () => {
  // =========================================================================
  // 1. ALL 9 STANDARD DOCUMENT CATEGORIES
  // =========================================================================
  describe("1. All 9 Standard Categories Classification", () => {
    it("classifies Eskom Megaflex Tax Invoice into UTILITY_INVOICE with HIGH_CONFIDENCE", () => {
      const text = [
        `ESKOM HOLDINGS SOC LTD
         TAX INVOICE
         Account Number: 9876543210
         Tax Invoice Number: 1102938475
         Tax Invoice Date: 2026-01-31
         Tariff: Megaflex High Voltage Transmission
         Active Energy Charge - Peak: 345,000 kWh @ 345.12 c/kWh = R 1,190,664.00
         Active Energy Charge - Standard: 520,000 kWh @ 180.45 c/kWh = R 938,340.00
         Active Energy Charge - Off-Peak: 410,000 kWh @ 95.20 c/kWh = R 390,320.00
         Maximum Demand Charge: 2,500 kVA @ 92.50 R/kVA = R 231,250.00
         Subtotal Charges: R 2,750,574.00
         VAT @ 15%: R 412,586.10
         Total Amount Due: R 3,163,160.10`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("UTILITY_INVOICE");
      expect(res.category).toBe("UTILITY_INVOICE");
      expect(res.subCategory).toBe("ESKOM_MEGAFLEX_INVOICE");
      expect(res.tariffName).toBe("Megaflex");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.isDeterministic).toBe(true);
      expect(res.deterministicIndicators).toContain("eskom_corporate_identity");
      expect(res.deterministicIndicators).toContain("tax_invoice_header");
      expect(res.deterministicIndicators).toContain("energy_consumption_determinants");
    });

    it("classifies Municipal Commercial Electricity Invoice into UTILITY_INVOICE with HIGH_CONFIDENCE", () => {
      const text = [
        `CITY POWER JOHANNESBURG (SOC) LTD
         TAX INVOICE / STATEMENT
         Account No: 5544332211
         Tax Invoice No: CP-2026-9812
         Electricity Supply: Commercial 3-Phase
         Meter No: MTR-998877
         Active Energy: 85,000 kWh @ 245.50 c/kWh
         Network Demand: 180 kVA @ 110.00 R/kVA
         Subtotal: R 228,475.00
         VAT @ 15%: R 34,271.25
         Total Amount Due: R 262,746.25`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("UTILITY_INVOICE");
      expect(res.category).toBe("UTILITY_INVOICE");
      expect(res.subCategory).toBe("MUNICIPAL_ELECTRICITY_INVOICE");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("municipal_corporate_identity");
      expect(res.deterministicIndicators).toContain("tax_invoice_header");
    });

    it("classifies Utility Statement of Account into UTILITY_STATEMENT with HIGH_CONFIDENCE", () => {
      const text = [
        `ESKOM DISTRIBUTION
         STATEMENT OF ACCOUNT
         Customer Account Number: 1234567890
         Statement Date: 2026-01-31
         Opening Balance: R 1,450,200.00
         Payments Received: -R 1,450,200.00
         Current Invoices: R 1,890,400.00
         Closing Balance: R 1,890,400.00
         Aging Analysis:
         Current: R 1,890,400.00 | 30 Days: R 0.00 | 60 Days: R 0.00 | 90 Days: R 0.00 | 120 Days: R 0.00`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("UTILITY_STATEMENT");
      expect(res.category).toBe("UTILITY_STATEMENT");
      expect(res.subCategory).toBe("ESKOM_STATEMENT");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("statement_of_account_title");
      expect(res.deterministicIndicators).toContain("ledger_balance_columns");
      expect(res.deterministicIndicators).toContain("aging_analysis_buckets");
    });

    it("classifies Telemetry Interval Load Profile into METER_DATA with HIGH_CONFIDENCE", () => {
      const text = [
        `AMR INTERVAL DATA REPORT — LOAD PROFILE
         Meter Serial Number: EDMI-Mk10-887612
         Measurement Interval: 30 Minute Readings
         Date / Time | Channel 1 kW_Import | Channel 2 kVArh_Import | Pulse Count
         2026-01-01 00:30 | 1,420.5 | 310.2 | 14205
         2026-01-01 01:00 | 1,390.8 | 295.4 | 13908
         2026-01-01 01:30 | 1,350.1 | 280.0 | 13501
         2026-01-01 02:00 | 1,310.4 | 275.6 | 13104`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("METER_DATA");
      expect(res.category).toBe("METER_DATA");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("telemetry_or_interval_keywords");
      expect(res.deterministicIndicators).toContain("interval_reading_columns");
    });

    it("classifies Published NERSA Rate Card into TARIFF_DOCUMENT with HIGH_CONFIDENCE", () => {
      const text = [
        `ESKOM SCHEDULE OF STANDARD PRICES 2025/2026
         NERSA APPROVED TARIFF BOOK & RATE TABLES
         Structure and Rates for Eskom Non-Local Authority Tariffs
         Comparative Tariff Matrix:
         Tariff Code | Megaflex | Miniflex | Ruraflex | Nightsave Urban
         High Demand Peak (c/kWh): 450.12 | 475.20 | 485.60 | 320.10
         High Demand Standard (c/kWh): 185.40 | 192.10 | 199.50 | 185.40
         High Demand Off-Peak (c/kWh): 98.70 | 102.40 | 108.90 | 98.70`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("TARIFF_DOCUMENT");
      expect(res.category).toBe("TARIFF_DOCUMENT");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("tariff_publication_title");
      expect(res.deterministicIndicators).toContain("multi_tariff_matrix");
    });

    it("classifies Formal Credit Note into CREDIT_NOTE with HIGH_CONFIDENCE", () => {
      const text = [
        `ESKOM HOLDINGS SOC LTD
         TAX CREDIT NOTE
         Credit Note Number: CN-2026-00451
         Original Invoice Number: INV-2025-998811
         Reason: Correction of faulty reactive energy billing for Substation 4
         Credited Amount: -R 184,500.00 CR
         Total Credit: R 184,500.00 CR
         VAT Reversed @ 15%: R 27,675.00 CR`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("CREDIT_NOTE");
      expect(res.category).toBe("CREDIT_NOTE");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("credit_note_title");
      expect(res.deterministicIndicators).toContain("credit_amount_indicator");
      expect(res.deterministicIndicators).toContain("original_invoice_reference");
    });

    it("classifies Billing Adjustment Note into ADJUSTMENT with HIGH_CONFIDENCE", () => {
      const text = [
        `ESKOM DISTRIBUTION
         BILLING ADJUSTMENT NOTE / JOURNAL VOUCHER
         Adjustment Reference: ADJ-2026-782
         Adjustment Period: 2025-06 to 2025-11
         Adjustment Reason: Retrospective recalculation of transformer loss factor
         Variance Amount: R 78,450.00 Under-billed
         Re-calculated Charges applied to Account 987654321`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("ADJUSTMENT");
      expect(res.category).toBe("ADJUSTMENT");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("adjustment_title_or_keyword");
      expect(res.deterministicIndicators).toContain("adjustment_variance_or_reason");
    });

    it("classifies Proof of Payment into PAYMENT_DOCUMENT with HIGH_CONFIDENCE", () => {
      const text = [
        `STANDARD BANK SOUTH AFRICA
         PROOF OF PAYMENT / ELECTRONIC FUNDS TRANSFER
         Beneficiary: Eskom Holdings SOC Ltd
         Beneficiary Account: 001234567
         Bank Reference: ACC-987654321-JAN26
         Payment Date: 2026-02-14
         Transaction Reference: EFT-ZA-20260214-99881
         Payment Method: Real-Time Gross Settlement (RTGS)
         Amount Paid: R 3,163,160.10`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("PAYMENT_DOCUMENT");
      expect(res.category).toBe("PAYMENT_DOCUMENT");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("payment_document_title");
      expect(res.deterministicIndicators).toContain("banking_transaction_reference");
    });

    it("classifies Non-Utility Commercial Agreement into OTHER with HIGH_CONFIDENCE", () => {
      const text = [
        `COMMERCIAL PROPERTY LEASE AGREEMENT
         Between Apex Properties (Pty) Ltd and Quantum Mining Services
         Term: 36 Months commencing 1 March 2026
         Monthly Rental: R 145,000.00 excluding VAT
         Deposit: R 290,000.00 held in interest-bearing account
         Premises: Unit 4B, Sandton Industrial Commerce Park
         Both parties have signed this Agreement of Lease.`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("OTHER");
      expect(res.category).toBe("OTHER");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("non_utility_legal_document");
    });

    it("classifies Generic Commercial Software Invoice into OTHER with HIGH_CONFIDENCE", () => {
      const text = [
        `ACME SAAS CLOUD SERVICES
         TAX INVOICE
         Invoice Number: INV-CLOUD-9981
         Description: Enterprise Cloud Services & Software Subscription
         Seats: 50 Developer Licenses
         Total Amount: USD 5,000.00
         Payment Terms: Net 30 days`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("OTHER");
      expect(res.category).toBe("OTHER");
      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
      expect(res.deterministicIndicators).toContain("non_utility_commercial_invoice");
    });

    it("strictly classifies unidentifiable noise into UNKNOWN with confidence UNKNOWN", () => {
      const text = [
        `@@@@ #### $$$$ %%%% ^^^^ &&&&
         zxcvbnm qwertyuiop asdfghjkl
         999999 111111 888888 222222
         q1w2e3r4t5y6u7i8o9p0`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("UNKNOWN");
      expect(res.category).toBe("UNKNOWN");
      expect(res.confidenceLevel).toBe("UNKNOWN");
      expect(res.confidence).toBeLessThan(0.25);
    });
  });

  // =========================================================================
  // 2. ALL 4 CONFIDENCE LEVELS
  // =========================================================================
  describe("2. All 4 Authoritative Confidence Levels", () => {
    it("evaluates mapScoreToConfidenceLevel correctly across all 4 tiers", () => {
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.98)).toBe("HIGH_CONFIDENCE");
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.85)).toBe("HIGH_CONFIDENCE");
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.84)).toBe("MEDIUM_CONFIDENCE");
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.6)).toBe("MEDIUM_CONFIDENCE");
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.59)).toBe("LOW_CONFIDENCE");
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.25)).toBe("LOW_CONFIDENCE");
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.24)).toBe("UNKNOWN");
      expect(DocumentClassifier.mapScoreToConfidenceLevel(0.0)).toBe("UNKNOWN");
    });

    it("produces HIGH_CONFIDENCE when complete statutory and tariff determinants are present", () => {
      const text = [
        `ESKOM HOLDINGS SOC LTD - TAX INVOICE
         Account No: 1234567890 | Tax Invoice No: 987654321
         Tariff: Megaflex
         Active Energy: 100,000 kWh | Maximum Demand: 500 kVA
         VAT @ 15%: R 15,000.00 | Total Amount Due: R 115,000.00`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("produces MEDIUM_CONFIDENCE when document has primary title but secondary tokens are incomplete", () => {
      const text = [
        `TAX INVOICE
         Active Energy consumption for factory unit: 45,000 kWh @ 210 c/kWh
         Total amount calculated for electricity usage.`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("UTILITY_INVOICE");
      expect(res.confidenceLevel).toBe("MEDIUM_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.6);
      expect(res.confidence).toBeLessThan(0.85);
    });

    it("produces LOW_CONFIDENCE when only an isolated weak indicator is present", () => {
      const text = [
        `TAX INVOICE
         Please find attached our billing calculation for the month.`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("UTILITY_INVOICE");
      expect(res.confidenceLevel).toBe("LOW_CONFIDENCE");
      expect(res.confidence).toBeGreaterThanOrEqual(0.25);
      expect(res.confidence).toBeLessThan(0.6);
    });

    it("produces UNKNOWN when score is below 0.25 due to insufficient evidence", () => {
      const text = [`Random text sample without markers`];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.standardCategory).toBe("UNKNOWN");
      expect(res.confidenceLevel).toBe("UNKNOWN");
      expect(res.confidence).toBeLessThan(0.25);
    });
  });

  // =========================================================================
  // 3. STRICT ANTI-HALLUCINATION & INSUFFICIENT EVIDENCE PROTECTION
  // =========================================================================
  describe("3. Strict Anti-Hallucination & Insufficient Evidence Guarantees", () => {
    it("strictly returns UNKNOWN with 0.0 confidence when text is empty or blank", () => {
      const { pages, lines } = createMockExtraction([""]);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.category).toBe("UNKNOWN");
      expect(res.standardCategory).toBe("UNKNOWN");
      expect(res.confidenceLevel).toBe("UNKNOWN");
      expect(res.confidence).toBe(0.0);
      expect(res.rationale).toContain(
        "Insufficient textual evidence to determine document classification",
      );
      expect(res.deterministicIndicators).toHaveLength(0);
    });

    it("strictly returns UNKNOWN with 0.0 confidence when text length is under 25 characters", () => {
      const { pages, lines } = createMockExtraction(["Short text"]);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.category).toBe("UNKNOWN");
      expect(res.standardCategory).toBe("UNKNOWN");
      expect(res.confidenceLevel).toBe("UNKNOWN");
      expect(res.confidence).toBe(0.0);
    });

    it("never invents or guesses a category for random OCR garbage or corrupted files", () => {
      const garbageSamples = [
        "1234567890 0987654321 !@#$%^&*()",
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        "The quick brown fox jumps over the lazy dog repeatedly.",
      ];

      garbageSamples.forEach((sample) => {
        const { pages, lines } = createMockExtraction([sample]);
        const res = DocumentClassifier.classifyDocument(pages, lines);

        expect(res.standardCategory).toBe("UNKNOWN");
        expect(res.confidenceLevel).toBe("UNKNOWN");
        expect(res.confidence).toBeLessThan(0.25);
      });
    });

    it("handles empty page and line arrays gracefully without throwing", () => {
      expect(() => DocumentClassifier.classifyDocument([], [])).not.toThrow();
      const res = DocumentClassifier.classifyDocument([], []);
      expect(res.standardCategory).toBe("UNKNOWN");
      expect(res.confidenceLevel).toBe("UNKNOWN");
      expect(res.confidence).toBe(0.0);
    });
  });

  // =========================================================================
  // 4. DETERMINISTIC INDICATORS & AUDIT RATIONALE TRACKING
  // =========================================================================
  describe("4. Deterministic Indicators & Audit Rationale", () => {
    it("flags isDeterministic as true and records human-auditable rationale", () => {
      const text = [
        `ESKOM HOLDINGS SOC LTD
         TAX INVOICE
         Account No: 123456789
         Invoice No: 987654321
         Tariff: Megaflex
         Active Energy: 50,000 kWh @ 300 c/kWh
         Total Amount Due: R 150,000.00`,
      ];
      const { pages, lines } = createMockExtraction(text);
      const res = DocumentClassifier.classifyDocument(pages, lines);

      expect(res.isDeterministic).toBe(true);
      expect(res.deterministicIndicators.length).toBeGreaterThan(2);
      expect(res.rationale.length).toBeGreaterThan(0);
      expect(res.rationale.some((r) => r.toLowerCase().includes("eskom"))).toBe(true);
      expect(res.rationale.some((r) => r.toLowerCase().includes("megaflex"))).toBe(true);
    });

    it("correctly identifies specific Eskom TOU tariffs in subCategory and rationale", () => {
      const tariffs = [
        { name: "Miniflex", keyword: "Miniflex", subCat: "ESKOM_MINIFLEX_INVOICE" },
        { name: "Nightsave", keyword: "Nightsave", subCat: "ESKOM_NIGHTSAVE_INVOICE" },
        { name: "Ruraflex", keyword: "Ruraflex", subCat: "ESKOM_RURAFLEX_INVOICE" },
      ];

      tariffs.forEach((t) => {
        const text = [
          `ESKOM HOLDINGS SOC LTD - TAX INVOICE
           Account: 998877 | Invoice: 112233
           Tariff: ${t.keyword}
           Active Energy: 10,000 kWh @ 200 c/kWh
           Total Amount Due: R 20,000.00`,
        ];
        const { pages, lines } = createMockExtraction(text);
        const res = DocumentClassifier.classifyDocument(pages, lines);

        expect(res.standardCategory).toBe("UTILITY_INVOICE");
        expect(res.subCategory).toBe(t.subCat);
        expect(res.tariffName).toBe(t.name);
      });
    });
  });

  // =========================================================================
  // 5. PAGE-LEVEL SECTION CLASSIFICATION
  // =========================================================================
  describe("5. Page-Level Section Classification", () => {
    it("accurately classifies different pages into expected section types", () => {
      const p1Text = `ESKOM HOLDINGS SOC LTD - TAX INVOICE\nTax Invoice Date: 2026-01-31\nVAT Reg: 4740101508`;
      const p2Text = `CHARGE CODE | TARIFF DESCRIPTION | RATE (c/kWh) | AMOUNT (ZAR)\nPeak Energy Charge: 100,000 kWh @ 345.12 c/kWh\nStandard Energy Charge: 150,000 kWh @ 180.45 c/kWh`;
      const p3Text = `METER READING SCHEDULE\nMeter Number: MTR-998811\nDial Reading Previous: 120450\nDial Reading Present: 145450\nConsumption: 25,000 kWh`;
      const p4Text = `ACCOUNT SUMMARY\nPrevious Balance: R 1,500,000.00\nPayments Received: -R 1,500,000.00\nTotal Due: R 1,750,000.00`;
      const p5Text = `REMITTANCE ADVICE\nBank Details: Standard Bank\nPayment Method: Electronic Transfer (EFT)\nPlease quote Account Number as reference`;

      const { pages, lines } = createMockExtraction([p1Text, p2Text, p3Text, p4Text, p5Text]);
      const pageClasses = DocumentClassifier.classifyPages(pages, lines);

      expect(pageClasses).toHaveLength(5);
      expect(pageClasses[0].classification).toBe("PAGE_TAX_INVOICE_HEADER");
      expect(pageClasses[1].classification).toBe("PAGE_LINE_ITEM_BREAKDOWN");
      expect(pageClasses[2].classification).toBe("PAGE_METER_READING_SCHEDULE");
      expect(pageClasses[3].classification).toBe("PAGE_ACCOUNT_SUMMARY");
      expect(pageClasses[4].classification).toBe("PAGE_ANNEXURE_REMITTANCE");
    });
  });

  // =========================================================================
  // 6. PIPELINE INTEGRATION
  // =========================================================================
  describe("6. Document Intelligence Pipeline Integration", () => {
    it("integrates classification into DocumentIntelligencePipeline.processDocument", async () => {
      const samplePdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length 280 >>
stream
BT
/F1 12 Tf
50 750 Td
(ESKOM HOLDINGS SOC LTD - TAX INVOICE) Tj
0 -20 Td
(Account Number: 9876543210 Tax Invoice No: INV-998877) Tj
0 -20 Td
(Tariff: Megaflex High Voltage) Tj
0 -20 Td
(Active Energy Peak: 245000 kWh @ 345.12 c/kWh) Tj
0 -20 Td
(Total Amount Due: R 2268199.63 VAT @ 15%) Tj
ET
endstream
endobj
xref
0 5
trailer << /Root 1 0 R /Size 5 >>
%%EOF`;

      const bytes = new TextEncoder().encode(samplePdf);
      const pkg = await DocumentIntelligencePipeline.processDocument(
        bytes,
        "eskom_megaflex_2026.pdf",
        "00000000-0000-0000-0000-000000000001",
        { skipStorageUpload: true },
      );

      expect(pkg.classification).toBeDefined();
      expect(pkg.classification.standardCategory).toBe("UTILITY_INVOICE");
      expect(pkg.classification.category).toBe("UTILITY_INVOICE");
      expect(pkg.classification.subCategory).toBe("ESKOM_MEGAFLEX_INVOICE");
      expect(pkg.classification.tariffName).toBe("Megaflex");
      expect(pkg.classification.confidenceLevel).toBe("HIGH_CONFIDENCE");
      expect(pkg.classification.isDeterministic).toBe(true);
      expect(pkg.classification.deterministicIndicators).toContain("eskom_corporate_identity");
      expect(pkg.document.documentClassification).toBe("UTILITY_INVOICE");
    });
  });
});
