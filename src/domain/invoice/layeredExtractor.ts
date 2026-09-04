/**
 * Layered Invoice Extraction Engine
 * Layered multi-stage extraction pipeline for Eskom & Municipal electricity invoices
 */

import type {
  ExtractedField,
  ExtractedInvoiceDocument,
  ExtractedInvoiceLineItem,
  ExtractedInvoiceDeterminant,
  InvoiceExtractionMetadata,
} from './types';
import { PageClassifier } from './pageClassifier';
import { InvoiceValidator } from './invoiceValidator';

const PARSER_VERSION = 'eskom-invoice-pipeline-v1.0';
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

export interface RawInputDocument {
  filename: string;
  pageTexts: string[];
  sha256Hash: string;
  isScanned?: boolean;
  ocrConfidence?: number;
}

export class LayeredExtractor {
  /**
   * Main entry point: Process a multi-page raw invoice document through the 8-stage pipeline
   */
  public static async extractDocument(input: RawInputDocument): Promise<ExtractedInvoiceDocument> {
    const startTime = new Date().toISOString();

    // Stage 5: Page Classification
    const classifiedPages = PageClassifier.classifyPages(input.pageTexts);

    // Document Text Assembly
    const fullText = input.pageTexts.join('\n');
    const pageCount = input.pageTexts.length;

    // Helper to create empty missing field (Zero Fabrication Policy)
    const createMissingField = <T>(fieldName: string, unit = 'text'): ExtractedField<T> => ({
      field_name: fieldName,
      value: '' as unknown as T,
      unit,
      source_page: 1,
      source_text_reference: '',
      confidence_score: 0.0,
      parser_version: PARSER_VERSION,
    });

    // Helper to extract regex field with confidence calculation
    const extractRegexField = <T extends string | number>(
      fieldName: string,
      patterns: RegExp[],
      unit: string,
      type: 'string' | 'number' = 'string',
      defaultValue?: T
    ): ExtractedField<T> => {
      for (let pageIdx = 0; pageIdx < input.pageTexts.length; pageIdx++) {
        const pageText = input.pageTexts[pageIdx];
        const pageNum = pageIdx + 1;

        for (const pattern of patterns) {
          const match = pageText.match(pattern);
          if (match && match[1]) {
            const rawVal = match[1].trim();
            let parsedVal: string | number = rawVal;

            if (type === 'number') {
              const cleaned = rawVal.replace(/\s+/g, '').replace(/,/g, '');
              const num = parseFloat(cleaned);
              if (!isNaN(num)) {
                parsedVal = num;
              } else {
                continue;
              }
            }

            // Confidence scoring based on source document type and pattern strength
            let confidence = input.isScanned ? (input.ocrConfidence || 0.75) : 0.95;
            if (pattern.source.includes('account|acc') || pattern.source.includes('invoice\\s*no')) {
              confidence = Math.min(1.0, confidence + 0.03);
            }

            return {
              field_name: fieldName,
              value: parsedVal as T,
              unit,
              source_page: pageNum,
              source_text_reference: match[0].substring(0, 100),
              confidence_score: Number(confidence.toFixed(2)),
              parser_version: PARSER_VERSION,
            };
          }
        }
      }

      if (defaultValue !== undefined) {
        return {
          field_name: fieldName,
          value: defaultValue,
          unit,
          source_page: 1,
          source_text_reference: 'default fallback',
          confidence_score: 0.50,
          parser_version: PARSER_VERSION,
        };
      }

      return createMissingField<T>(fieldName, unit);
    };

    // Stage 3 & 4: Pattern & Label/Value Matching for Header Fields
    const account_number = extractRegexField<string>(
      'account_number',
      [
        /(?:account|acc)\s*(?:no|num|number)?[\s:]*([A-Z0-9\/-]{8,20})/i,
        /contract\s*account[\s:]*([0-9]{8,12})/i,
      ],
      'text'
    );

    const customer_name = extractRegexField<string>(
      'customer_name',
      [
        /(?:customer|client|consumer|name)[\s:]+([A-Z0-9\s.,&( Pty Ltd Inc)]+?)(?=\n|account|vat)/i,
        /bill\s*to[\s:]+([A-Z0-9\s.,&]+?)(?=\n|account)/i,
      ],
      'text'
    );

    const premise_id = extractRegexField<string>(
      'premise_id',
      [
        /(?:premise|location|site)\s*(?:id|code|no)?[\s:]*([A-Z0-9-]{4,15})/i,
        /supply\s*point[\s:]*([A-Z0-9-]{4,15})/i,
      ],
      'text'
    );

    const meter_number = extractRegexField<string>(
      'meter_number',
      [
        /(?:meter)\s*(?:no|num|number|serial)?[\s:]*([A-Z0-9-]{5,20})/i,
        /dial\s*reading\s*meter[\s:]*([A-Z0-9-]{5,20})/i,
      ],
      'text'
    );

    const invoice_number = extractRegexField<string>(
      'invoice_number',
      [
        /(?:tax\s*invoice|invoice)\s*(?:no|num|number)?[\s:]*([A-Z0-9\/-]{5,20})/i,
        /bill\s*number[\s:]*([A-Z0-9\/-]{5,20})/i,
      ],
      'text'
    );

    const billing_period_start = extractRegexField<string>(
      'billing_period_start',
      [
        /(?:billing\s*period|period|from)[\s:]*([0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
        /reading\s*from[\s:]*([0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2})/i,
      ],
      'date'
    );

    const billing_period_end = extractRegexField<string>(
      'billing_period_end',
      [
        /(?:to|until|billing\s*end)[\s:]*([0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
        /reading\s*to[\s:]*([0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2})/i,
      ],
      'date'
    );

    const invoice_date = extractRegexField<string>(
      'invoice_date',
      [
        /(?:invoice\s*date|tax\s*invoice\s*date|date)[\s:]*([0-9]{4}[-\/][0-9]{2}[-\/][0-9]{2}|[0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i,
      ],
      'date'
    );

    const tariff_name = extractRegexField<string>(
      'tariff_name',
      [
        /(?:tariff\s*name|supply\s*type|rate\s*category)[\s:]*([A-Za-z0-9\s-]+?)(?=\r?\n|tariff\s*code|nmd|voltage)/i,
        /(eskom\s*megaflex|eskom\s*miniflex|nightsave|business\s*rate|bulk\s*electricity)/i,
      ],
      'text',
      'string',
      'Eskom Megaflex'
    );

    const tariff_code = extractRegexField<string>(
      'tariff_code',
      [
        /(?:tariff\s*code|code)[\s:]*([A-Z0-9-]{3,10})/i,
      ],
      'text'
    );

    // Demand & Capacity Determinants
    const notified_maximum_demand = extractRegexField<number>(
      'notified_maximum_demand',
      [
        /(?:notified\s*max(?:imum)?\s*demand|nmd)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(?:kva|kw)?/i,
      ],
      'kVA',
      'number'
    );

    const utilised_capacity = extractRegexField<number>(
      'utilised_capacity',
      [
        /(?:utilised\s*capacity|capacity\s*utilised)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(?:kva|kw|%)?/i,
      ],
      'kVA',
      'number'
    );

    const maximum_demand = extractRegexField<number>(
      'maximum_demand',
      [
        /(?:^|\n)\s*(?:actual\s*)?(?:max(?:imum)?\s*demand|peak\s*demand|kva\s*recorded)[\s:]*([0-9]+(?:\.[0-9]+)?)\s*(?:kva|kw)?/i,
      ],
      'kVA',
      'number'
    );

    // Energy Determinants
    const active_energy = extractRegexField<number>(
      'active_energy',
      [
        /(?:active\s*energy|total\s*active\s*kwh|kwh\s*total)[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'kWh',
      'number'
    );

    const peak_kwh = extractRegexField<number>(
      'peak_kwh',
      [
        /(?:peak\s*(?:energy|kwh)|high\s*season\s*peak)[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'kWh',
      'number'
    );

    const standard_kwh = extractRegexField<number>(
      'standard_kwh',
      [
        /(?:standard\s*(?:energy|kwh)|high\s*season\s*standard)[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'kWh',
      'number'
    );

    const off_peak_kwh = extractRegexField<number>(
      'off_peak_kwh',
      [
        /(?:off\s*[- ]?\s*peak\s*(?:energy|kwh))[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'kWh',
      'number'
    );

    const total_kwh = extractRegexField<number>(
      'total_kwh',
      [
        /(?:total\s*(?:energy|kwh)|kwh\s*consumed)[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'kWh',
      'number'
    );

    const reactive_energy_kvarh = extractRegexField<number>(
      'reactive_energy_kvarh',
      [
        /(?:reactive\s*energy|kvarh\s*total|kvarh)[\s:]*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'kVARh',
      'number'
    );

    const power_factor = extractRegexField<number>(
      'power_factor',
      [
        /(?:power\s*factor|pf)[\s:]*([0-1]\.[0-9]+)/i,
      ],
      'ratio',
      'number'
    );

    // Charge Summaries
    const demand_charges = extractRegexField<number>(
      'demand_charges',
      [
        /(?:demand\s*charge|network\s*demand\s*charge)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const network_charges = extractRegexField<number>(
      'network_charges',
      [
        /(?:network\s*charge|transmission\s*network)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const capacity_charges = extractRegexField<number>(
      'capacity_charges',
      [
        /(?:capacity\s*charge|generator\s*capacity)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const service_charges = extractRegexField<number>(
      'service_charges',
      [
        /(?:service\s*charge|admin\s*charge)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const reliability_services = extractRegexField<number>(
      'reliability_services',
      [
        /(?:reliability\s*service|ancillary\s*service)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const levies = extractRegexField<number>(
      'levies',
      [
        /(?:electrification\s*subsidy|environmental\s*levy|subsidy)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const adjustments = extractRegexField<number>(
      'adjustments',
      [
        /(?:adjustments|billing\s*adjustment)[\s:]*R?\s*([-+]?[0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    // Financial Totals
    const subtotal_amount = extractRegexField<number>(
      'subtotal_amount',
      [
        /(?:subtotal|total\s*charges|total\s*excl\s*vat)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const vat_amount = extractRegexField<number>(
      'vat_amount',
      [
        /(?:vat\s*(?:15%|amount)?|value\s*added\s*tax)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const total_invoice_amount = extractRegexField<number>(
      'total_invoice_amount',
      [
        /(?:total\s*(?:invoice\s*)?(?:amount|due|payable|incl\s*vat)|amount\s*due)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const opening_balance = extractRegexField<number>(
      'opening_balance',
      [
        /(?:opening\s*balance|balance\s*brought\s*forward)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const closing_balance = extractRegexField<number>(
      'closing_balance',
      [
        /(?:closing\s*balance|new\s*balance)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const payments = extractRegexField<number>(
      'payments',
      [
        /(?:payments\s*received|last\s*payment)[\s:]*R?\s*([-+]?[0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const credits = extractRegexField<number>(
      'credits',
      [
        /(?:credits|credit\s*adjustment)[\s:]*R?\s*([-+]?[0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    const other_charges = extractRegexField<number>(
      'other_charges',
      [
        /(?:other\s*charges|sundry\s*charges)[\s:]*R?\s*([0-9]+(?:\.[0-9]+)?)/i,
      ],
      'ZAR',
      'number'
    );

    // Stage 2: Table Detection Engine for Line Items & Determinants
    const line_items: ExtractedInvoiceLineItem[] = [];
    const determinants: ExtractedInvoiceDeterminant[] = [];

    // Parse tabular lines from text
    const lines = fullText.split('\n');
    let itemIdx = 1;

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l].trim();
      
      // Match line item format: Description ... Rate ... Qty ... Amount
      const lineItemMatch = line.match(/^([A-Za-z0-9\s\/-]{5,40})\s+([0-9]+\.[0-9]+)\s+([0-9]+\.[0-9]+)\s+([0-9]+\.[0-9]+)$/);
      if (lineItemMatch) {
        const label = lineItemMatch[1].trim();
        const rateVal = parseFloat(lineItemMatch[2]);
        const qtyVal = parseFloat(lineItemMatch[3]);
        const amtVal = parseFloat(lineItemMatch[4]);

        line_items.push({
          line_item_number: itemIdx++,
          charge_label: label,
          rate: {
            field_name: `rate_${itemIdx}`,
            value: rateVal,
            unit: 'c/kWh',
            source_page: 1,
            source_text_reference: line,
            confidence_score: 0.90,
            parser_version: PARSER_VERSION,
          },
          quantity: {
            field_name: `quantity_${itemIdx}`,
            value: qtyVal,
            unit: 'units',
            source_page: 1,
            source_text_reference: line,
            confidence_score: 0.90,
            parser_version: PARSER_VERSION,
          },
          unit_of_measure: 'units',
          invoiced_amount: {
            field_name: `amount_${itemIdx}`,
            value: amtVal,
            unit: 'ZAR',
            source_page: 1,
            source_text_reference: line,
            confidence_score: 0.92,
            parser_version: PARSER_VERSION,
          },
          source_page: 1,
          source_text_reference: line,
          confidence_score: 0.91,
        });
      }
    }

    // Stage 7: Confidence Scoring & Review Flagging
    const allFields: ExtractedField<any>[] = [
      account_number,
      customer_name,
      premise_id,
      meter_number,
      invoice_number,
      billing_period_start,
      billing_period_end,
      invoice_date,
      tariff_name,
      total_kwh,
      total_invoice_amount,
    ];

    const lowConfidenceFields: string[] = [];
    let confidenceSum = 0;

    for (const f of allFields) {
      confidenceSum += f.confidence_score;
      if (f.confidence_score < HIGH_CONFIDENCE_THRESHOLD) {
        lowConfidenceFields.push(f.field_name);
      }
    }

    const overallConfidence = Number((confidenceSum / allFields.length).toFixed(2));
    const needsHumanReview = overallConfidence < HIGH_CONFIDENCE_THRESHOLD || lowConfidenceFields.length > 0;

    const metadata: InvoiceExtractionMetadata = {
      sha256_hash: input.sha256Hash,
      source_filename: input.filename,
      file_size_bytes: fullText.length,
      page_count: pageCount,
      document_type: input.isScanned ? 'scanned-pdf' : 'embedded-text',
      overall_confidence: overallConfidence,
      needs_human_review: needsHumanReview,
      low_confidence_fields: lowConfidenceFields,
      extracted_at: startTime,
      parser_version: PARSER_VERSION,
    };

    const doc: ExtractedInvoiceDocument = {
      account_number,
      customer_name,
      premise_id,
      meter_number,
      invoice_number,
      billing_period_start,
      billing_period_end,
      invoice_date,
      tariff_name,
      tariff_code,
      notified_maximum_demand,
      utilised_capacity,
      maximum_demand,
      active_energy,
      peak_kwh,
      standard_kwh,
      off_peak_kwh,
      total_kwh,
      reactive_energy_kvarh,
      power_factor,
      demand_charges,
      network_charges,
      capacity_charges,
      service_charges,
      reliability_services,
      levies,
      adjustments,
      subtotal_amount,
      vat_amount,
      total_invoice_amount,
      opening_balance,
      closing_balance,
      payments,
      credits,
      other_charges,
      line_items,
      determinants,
      metadata,
      validation_summary: {
        status: 'valid',
        energy_reconciled: true,
        financial_reconciled: true,
        discrepancies: [],
      },
    };

    // Stage 8: Mathematical & Billing Validation Layer
    doc.validation_summary = InvoiceValidator.validateInvoice(doc);

    return doc;
  }
}
