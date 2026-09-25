/**
 * Document Classifier Engine
 * ========================================================
 * Stage 8 of Document Intelligence Architecture:
 * Performs deterministic document and page section classification:
 * - Identifies utility document category (Eskom Megaflex, Miniflex, Nightsave, Municipal)
 * - Identifies tariff family and structure
 * - Categorizes each page into section types (Header, Account, Meter, Line Items, Remittance)
 * - Computes classification confidence and grounded rationale
 */

import type {
  DocumentCategory,
  DocumentClassificationResult,
  ExtractedPage,
  ExtractedTextLine,
  PageClassificationRecord,
  PageSectionClassification,
} from "./types";

export class DocumentClassifier {
  /**
   * Classify document and constituent pages
   */
  public static classifyDocument(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[]
  ): DocumentClassificationResult {
    const fullText = lines.map((l) => l.text).join(" ").toLowerCase();
    const rationale: string[] = [];

    let category: DocumentCategory = "UNKNOWN_UTILITY_DOCUMENT";
    let tariffName = "UNKNOWN";
    let confidence = 0.5;

    // Check for Eskom Corporate Identity
    const isEskom =
      /eskom\s*holdings\s*(?:soc)?\s*ltd|eskom\s*distribution|eskom\s*transmission|\beskom\b/i.test(
        fullText
      );

    if (isEskom) {
      rationale.push("Eskom corporate entity signatures confirmed");
    }

    // Check Tariff Signature
    if (/megaflex/i.test(fullText)) {
      category = "ESKOM_MEGAFLEX_INVOICE";
      tariffName = "Megaflex";
      confidence = isEskom ? 0.98 : 0.88;
      rationale.push("Megaflex TOU tariff keywords identified");
    } else if (/miniflex/i.test(fullText)) {
      category = "ESKOM_MINIFLEX_INVOICE";
      tariffName = "Miniflex";
      confidence = isEskom ? 0.96 : 0.86;
      rationale.push("Miniflex tariff keywords identified");
    } else if (/nightsave/i.test(fullText)) {
      category = "ESKOM_NIGHTSAVE_INVOICE";
      tariffName = "Nightsave";
      confidence = isEskom ? 0.95 : 0.85;
      rationale.push("Nightsave tariff keywords identified");
    } else if (/ruraflex/i.test(fullText)) {
      category = "ESKOM_RURAFLEX_INVOICE";
      tariffName = "Ruraflex";
      confidence = isEskom ? 0.95 : 0.85;
      rationale.push("Ruraflex tariff keywords identified");
    } else if (isEskom && /tax\s*invoice|account\s*number/i.test(fullText)) {
      category = "ESKOM_MEGAFLEX_INVOICE"; // default Eskom commercial large-power tariff
      tariffName = "Megaflex";
      confidence = 0.85;
      rationale.push("Defaulted to Eskom Megaflex due to large-power billing determinant indicators");
    } else if (
      /city\s*power|city\s*of\s*johannesburg|ethekwini|city\s*of\s*cape\s*town|ekurhuleni|tshwane/i.test(
        fullText
      )
    ) {
      category = "MUNICIPAL_ELECTRICITY_INVOICE";
      tariffName = "Municipal Commercial";
      confidence = 0.92;
      rationale.push("Municipal utility distribution authority signatures identified");
    } else if (/interval\s*data|amr|profile\s*data|30\s*min(?:ute)?\s*reading/i.test(fullText)) {
      category = "AMR_INTERVAL_REPORT";
      tariffName = "Telemetry Profile";
      confidence = 0.90;
      rationale.push("AMR interval profile keywords identified");
    }

    // Page-by-page section classification
    const pageClassifications = this.classifyPages(pages, lines);

    return {
      category,
      tariffName,
      confidence,
      rationale,
      pageClassifications,
    };
  }

  /**
   * Classify individual pages into section types
   */
  private static classifyPages(
    pages: ExtractedPage[],
    lines: ExtractedTextLine[]
  ): PageClassificationRecord[] {
    return pages.map((page) => {
      const pageLines = lines.filter((l) => l.pageNumber === page.pageNumber);
      const text = pageLines.map((l) => l.text).join(" ").toLowerCase();
      const matchedSignatures: string[] = [];

      let classification: PageSectionClassification = "PAGE_UNKNOWN";
      let confidence = 0.6;

      const hasTaxInvoice = /tax\s*invoice|vat\s*reg|tax\s*invoice\s*date/i.test(text);
      const hasAccountSummary = /account\s*summary|previous\s*balance|payments\s*received|total\s*due/i.test(text);
      const hasMeterReading = /meter\s*(?:no|number)|dial\s*reading|kwh|kva|kvarh|reading\s*date/i.test(text);
      const hasLineItems = /charge\s*code|rate\s*\(|tariff\s*description|peak\s*energy|standard\s*energy|off\s*peak\s*energy/i.test(text);
      const hasEnvironmental = /affordability\s*subsidy|electrification\s*levy|environmental\s*levy/i.test(text);
      const hasRemittance = /remittance\s*advice|payment\s*method|bank\s*details|cheque|direct\s*debit/i.test(text);

      if (hasTaxInvoice && page.pageNumber === 1) {
        classification = "PAGE_TAX_INVOICE_HEADER";
        confidence = 0.96;
        matchedSignatures.push("tax_invoice_header_page1");
      } else if (hasLineItems) {
        classification = "PAGE_LINE_ITEM_BREAKDOWN";
        confidence = 0.92;
        matchedSignatures.push("unbundled_line_items");
      } else if (hasMeterReading) {
        classification = "PAGE_METER_READING_SCHEDULE";
        confidence = 0.90;
        matchedSignatures.push("meter_reading_schedule");
      } else if (hasAccountSummary) {
        classification = "PAGE_ACCOUNT_SUMMARY";
        confidence = 0.88;
        matchedSignatures.push("account_balance_summary");
      } else if (hasEnvironmental) {
        classification = "PAGE_ENVIRONMENT_RENEWABLE_LEVY";
        confidence = 0.87;
        matchedSignatures.push("environmental_subsidies");
      } else if (hasRemittance) {
        classification = "PAGE_ANNEXURE_REMITTANCE";
        confidence = 0.91;
        matchedSignatures.push("payment_remittance");
      } else if (hasTaxInvoice) {
        classification = "PAGE_TAX_INVOICE_HEADER";
        confidence = 0.80;
        matchedSignatures.push("tax_invoice_secondary");
      }

      return {
        pageNumber: page.pageNumber,
        classification,
        confidence,
        matchedSignatures,
      };
    });
  }
}
