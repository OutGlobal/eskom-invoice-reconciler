/**
 * Invoice Page Classifier
 * Categorizes multi-page utility invoice pages into domain section types
 */

import type { ClassifiedPage, PageClassificationType } from './types';

export class PageClassifier {
  /**
   * Classify a list of raw text pages into invoice section types
   */
  public static classifyPages(pageTexts: string[]): ClassifiedPage[] {
    return pageTexts.map((text, index) => {
      const pageNumber = index + 1;
      const lower = text.toLowerCase();

      let classification: PageClassificationType = 'unknown';
      let confidence = 0.5;

      const hasTaxInvoiceHeader = /tax\s*invoice|account\s*number|vat\s*reg|invoice\s*date|amount\0? due/i.test(text);
      const hasLineItems = /charge\s*code|rate\s*\(|tariff\s*description|subtotal|total\s*charges/i.test(text);
      const hasMeterReading = /meter\s*(?:no|number)|dial\s*reading|kwh|kva|kvarh|peak\s*demand/i.test(text);
      const hasAnnexure = /payment\s*methods|terms\s*and\s*conditions|notice|important\s*information/i.test(text);

      if (hasTaxInvoiceHeader && pageNumber === 1) {
        classification = 'tax_invoice_header';
        confidence = 0.95;
      } else if (hasMeterReading && !hasTaxInvoiceHeader) {
        classification = 'meter_reading_schedule';
        confidence = 0.90;
      } else if (hasLineItems) {
        classification = 'line_item_breakdown';
        confidence = 0.88;
      } else if (hasTaxInvoiceHeader) {
        classification = 'tax_invoice_header';
        confidence = 0.82;
      } else if (hasAnnexure) {
        classification = 'annexure_notes';
        confidence = 0.85;
      }

      return {
        page_number: pageNumber,
        classification,
        confidence,
        text_content: text,
      };
    });
  }
}
