/**
 * ENERA PRODUCTION OCR ENGINE — EVIDENCE & DETERMINANT EXTRACTOR
 * ===============================================================
 * Extracts authoritative billing determinants with cryptographic provenance:
 *
 *   OCR Words & Table Cells
 *              ↓
 *   Document Category Classification (Invoice, Statement, Credit Note, etc.)
 *              ↓
 *   Targeted Semantic Determinant Extractors
 *              ↓
 *   Spatial Bounding Box Mapping & Context Linking
 *              ↓
 *   Strict Non-Fabrication: Missing fields preserved as explicit null
 */

import type {
  OcrDocumentCategory,
  OcrPageResult,
  OcrFieldProvenance,
  OcrDeterminantField,
  OcrExtractedInvoiceDeterminants,
  OcrExtractedStatementDeterminants,
  OcrExtractedCreditNoteDeterminants,
  OcrExtractedAdjustmentDeterminants,
  OcrExtractedTariffDeterminants,
  OcrExtractedMeterDeterminants,
  OcrBoundingBox,
  CoordinateSystem,
  OcrElementBoundingBox,
  OcrEvidenceLocationReport,
  NumericFieldCategory,
  OcrFieldEvidence,
} from "./types";
import { OcrConfidenceScorer } from "./ocrConfidenceScorer";
import { NumericProtectionEngine } from "./numericProtectionEngine";
import { OcrEvidenceModel } from "./ocrEvidenceModel";
import { ProvenanceGuard } from "../intelligence/provenanceGuard";
import type { ProvenancedField, BoundingBox } from "../intelligence/types";

export class OcrEvidenceExtractor {
  /**
   * Classifies the overall document category based on OCR text content
   */
  public static classifyCategory(fullText: string): OcrDocumentCategory {
    const upper = fullText.toUpperCase();

    if (upper.includes("CREDIT NOTE") || upper.includes("CREDIT ADJUSTMENT")) {
      return "CREDIT_NOTE";
    }
    if (
      upper.includes("ADJUSTMENT ADVICE") ||
      upper.includes("DEBIT ADJUSTMENT") ||
      upper.includes("BILLING ADJUSTMENT")
    ) {
      return "ADJUSTMENT";
    }
    if (
      upper.includes("STATEMENT OF ACCOUNT") ||
      upper.includes("REMITTANCE ADVICE") ||
      (upper.includes("STATEMENT") && !upper.includes("TAX INVOICE"))
    ) {
      return "STATEMENT";
    }
    if (
      upper.includes("TARIFF SCHEDULE") ||
      upper.includes("RATE SCHEDULE") ||
      upper.includes("NERSA TARIFF") ||
      upper.includes("MEGAFLEX TARIFF STRUCTURE")
    ) {
      return "TARIFF_DOCUMENT";
    }
    if (
      upper.includes("METER READING SHEET") ||
      upper.includes("METER LOG") ||
      upper.includes("INTERVAL REPORT") ||
      upper.includes("AMR DATA")
    ) {
      return "METER_DOCUMENT";
    }
    if (
      upper.includes("TAX INVOICE") ||
      upper.includes("INVOICE") ||
      upper.includes("ESKOM") ||
      upper.includes("ELECTRICITY ACCOUNT")
    ) {
      return "INVOICE";
    }

    return "UNKNOWN";
  }

  /**
   * Extracts invoice determinants with provenance from OCR pages
   */
  public static extractInvoiceDeterminants(
    pages: OcrPageResult[],
    documentId: string,
    ocrRunId?: string,
  ): OcrExtractedInvoiceDeterminants {
    const fullText = pages.map((p) => p.fullText).join("\n");

    // 1. Account Number
    const accountField = this.findFieldByPattern(
      pages,
      documentId,
      "accountNumber",
      "Account Number",
      [
        /\b(?:ACCOUNT\s*NO|ACCOUNT\s*NUMBER|ACC\s*NO)[:\s]+([0-9]{10,12})\b/i,
        /\b(?:ACCOUNT\s*NO|ACCOUNT\s*NUMBER)[:\s]+([A-Z0-9\-_]{6,16})\b/i,
      ],
      (val) => val.replace(/\s+/g, ""),
      ocrRunId,
    );

    // 2. Invoice Number
    const invoiceNumberField = this.findFieldByPattern(
      pages,
      documentId,
      "invoiceNumber",
      "Invoice Number",
      [
        /\b(?:TAX\s*INVOICE\s*NO|INVOICE\s*NO|INVOICE\s*NUMBER|INV\s*NO)[:\s]+([A-Z0-9\-_]{5,20})\b/i,
        /\b(?:TAX\s*INVOICE)[:\s]+([A-Z0-9\-_]{5,20})\b/i,
      ],
      undefined,
      ocrRunId,
    );

    // 3. Customer Name
    const customerNameField = this.findFieldByPattern(
      pages,
      documentId,
      "customerName",
      "Customer Name",
      [
        /\b(?:NAME|CUSTOMER|CONSUMER|CLIENT)[:\s]+([A-Z0-9\s.,&'()-]{4,40})/i,
        /(?:TO|DEBTOR)[:\s]+([A-Z0-9\s.,&'()-]{4,40})/i,
      ],
      (val) => val.trim(),
      ocrRunId,
    );

    // 4. VAT Registration
    const vatField = this.findFieldByPattern(
      pages,
      documentId,
      "vatRegistrationNumber",
      "VAT Registration Number",
      [/\b(?:VAT\s*REG(?:\s*NO)?|VAT\s*NO|TAX\s*REG)[:\s]+([0-9]{10})\b/i],
      undefined,
      ocrRunId,
    );

    // 5. Billing Period Start & End
    let billingStart: string | null = null;
    let billingEnd: string | null = null;
    let periodProv: OcrFieldProvenance = this.createEmptyProvenance(
      documentId,
      1,
      "billingPeriod",
      ocrRunId,
    );

    for (const page of pages) {
      const match = page.fullText.match(
        /\b(?:BILLING\s*PERIOD|PERIOD)[:\s]+(\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*(?:TO|-)\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2})/i,
      );
      if (match) {
        billingStart = match[1].replace(/\//g, "-");
        billingEnd = match[2].replace(/\//g, "-");
        periodProv = {
          documentId,
          pageNumber: page.pageNumber,
          extractionMethod: "OCR_KEY_VALUE",
          hasExactBoundingBox: false,
          contextSnippet: match[0],
          confidenceScore: 92,
          confidenceTier: "HIGH",
        };
        break;
      }
    }

    // 6. Invoice Date & Due Date
    const invoiceDateField = this.findFieldByPattern(
      pages,
      documentId,
      "invoiceDate",
      "Invoice Date",
      [
        /\b(?:INVOICE\s*DATE|DATE\s*OF\s*INVOICE|DATE)[:\s]+(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i,
        /\b(?:INVOICE\s*DATE|DATE)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/i,
      ],
      undefined,
      ocrRunId,
    );

    const dueDateField = this.findFieldByPattern(
      pages,
      documentId,
      "paymentDueDate",
      "Payment Due Date",
      [
        /\b(?:PAYMENT\s*DUE\s*DATE|DUE\s*DATE|PAY\s*BY)[:\s]+(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i,
        /\b(?:PAYMENT\s*DUE\s*DATE|DUE\s*DATE)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/i,
      ],
      undefined,
      ocrRunId,
    );

    // 7. Tariff Code
    const tariffCodeField = this.findFieldByPattern(
      pages,
      documentId,
      "tariffCode",
      "Tariff Code",
      [
        /\b(MEGAFLEX[A-Z0-9_\-]*|MINIFLEX[A-Z0-9_\-]*|NIGHTSAVE[A-Z0-9_\-]*|RURAFLEX[A-Z0-9_\-]*)\b/i,
        /\b(?:TARIFF(?:\s*TYPE|\s*CODE)?)[:\s]+([A-Z0-9_\-]{4,20})\b/i,
      ],
      (val) => val.toUpperCase(),
      ocrRunId,
    );

    // 8. Meter Number
    const meterField = this.findFieldByPattern(
      pages,
      documentId,
      "meterNumber",
      "Meter Number",
      [/\b(?:METER\s*(?:NO|NUMBER|#)|MTR)[:\s]+([A-Z0-9\-_]{5,20})/i],
      undefined,
      ocrRunId,
    );

    // 9. Financial Amounts: Total Due, VAT, Subtotal
    const totalDueField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "totalAmountDue",
      "Total Amount Due",
      [
        /\b(?:TOTAL\s*DUE|AMOUNT\s*DUE|TOTAL\s*PAYABLE|TOTAL\s*AMOUNT\s*DUE)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i,
        /\b(?:BALANCE\s*DUE)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i,
      ],
      ocrRunId,
    );

    const vatAmountField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "vatAmount",
      "VAT (15%)",
      [/VAT\s*(?:\([0-9]+%\)|[0-9]+%)?[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i],
      ocrRunId,
    );

    const subtotalField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "subtotalAmount",
      "Subtotal Amount",
      [/\b(?:SUB-?TOTAL|TOTAL\s*EXCL(?:UDING)?\s*VAT)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i],
      ocrRunId,
    );

    // 10. Energy Determinants: Active Energy (Total, Peak, Standard, Off-Peak), Demand, Reactive
    const totalKwhField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "activeEnergyTotalKwh",
      "Total Active Energy (kWh)",
      [
        /\b(?:TOTAL\s*ACTIVE\s*ENERGY|TOTAL\s*ENERGY|TOTAL\s*KWH)[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:KWH)?/i,
      ],
      ocrRunId,
    );

    const peakKwhField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "activeEnergyPeakKwh",
      "Peak Active Energy (kWh)",
      [/PEAK(?:[A-Z\s]*ENERGY)?[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:KWH)/i],
      ocrRunId,
    );

    const standardKwhField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "activeEnergyStandardKwh",
      "Standard Active Energy (kWh)",
      [/STANDARD(?:[A-Z\s]*ENERGY)?[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:KWH)/i],
      ocrRunId,
    );

    const offPeakKwhField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "activeEnergyOffPeakKwh",
      "Off-Peak Active Energy (kWh)",
      [/OFF-?PEAK(?:[A-Z\s]*ENERGY)?[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:KWH)/i],
      ocrRunId,
    );

    const maxDemandField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "maximumDemandKva",
      "Maximum Demand (kVA)",
      [/\b(?:MAXIMUM\s*DEMAND|MAX\s*DEMAND|DEMAND)[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:KVA)/i],
      ocrRunId,
    );

    const nmdField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "notifiedMaximumDemandKva",
      "Notified Maximum Demand (NMD)",
      [/\b(?:NOTIFIED\s*MAXIMUM\s*DEMAND|NMD)[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:KVA)?/i],
      ocrRunId,
    );

    const reactiveField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "reactiveEnergyKvarh",
      "Reactive Energy (kVArh)",
      [/\b(?:REACTIVE\s*ENERGY|KVARH)[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:KVARH)?/i],
      ocrRunId,
    );

    const powerFactorField = this.findNumericFieldByPattern(
      pages,
      documentId,
      "powerFactor",
      "Power Factor",
      [/\b(?:POWER\s*FACTOR|PF)[:\s]+([0-1](?:\.[0-9]+)?)/i],
      ocrRunId,
    );

    // 11. Extract line items from detected tables
    const lineItems: OcrExtractedInvoiceDeterminants["lineItems"] = [];
    for (const page of pages) {
      for (const table of page.tables) {
        if (table.tableType === "BILLING_SCHEDULE" || table.tableType === "GENERIC") {
          for (const row of table.rows) {
            if (row.length >= 2) {
              const desc = row[0] || "";
              const lastVal = row[row.length - 1];
              const cleanNum = lastVal ? lastVal.replace(/[R\s,]/g, "") : "";
              const amount =
                !isNaN(Number(cleanNum)) && cleanNum.length > 0 ? Number(cleanNum) : null;

              if (desc.trim().length > 0 && amount !== null) {
                lineItems.push({
                  lineDescription: desc.trim(),
                  rate: null,
                  quantity: null,
                  amount,
                  chargeCategory: this.categorizeChargeDescription(desc),
                  provenance: {
                    documentId,
                    pageNumber: page.pageNumber,
                    extractionMethod: "OCR_LAYOUT_TABLE",
                    hasExactBoundingBox: true,
                    boundingBox: table.boundingBox,
                    confidenceScore: table.confidence,
                    confidenceTier: table.confidence >= 85 ? "HIGH" : "MEDIUM",
                    x: table.x,
                    y: table.y,
                    width: table.width,
                    height: table.height,
                    coordinateSystem: table.coordinateSystem,
                    detailedBoundingBox: table.detailedBoundingBox,
                    ocrRunId,
                    processingRun: ocrRunId,
                    ocr: !page.isNativeDigital,
                    isOcr: !page.isNativeDigital,
                    sourceText: desc.trim(),
                  },
                });
              }
            }
          }
        }
      }
    }

    return {
      accountNumber: accountField,
      invoiceNumber: invoiceNumberField,
      customerName: customerNameField,
      vatRegistrationNumber: vatField,
      billingPeriodStart: {
        fieldKey: "billingPeriodStart",
        fieldLabel: "Billing Period Start",
        value: billingStart,
        rawValue: billingStart || "",
        provenance: periodProv,
      },
      billingPeriodEnd: {
        fieldKey: "billingPeriodEnd",
        fieldLabel: "Billing Period End",
        value: billingEnd,
        rawValue: billingEnd || "",
        provenance: periodProv,
      },
      invoiceDate: invoiceDateField,
      paymentDueDate: dueDateField,
      tariffCode: tariffCodeField,
      meterNumber: meterField,
      notifiedMaximumDemandKva: nmdField,
      maximumDemandKva: maxDemandField,
      activeEnergyTotalKwh: totalKwhField,
      activeEnergyPeakKwh: peakKwhField,
      activeEnergyStandardKwh: standardKwhField,
      activeEnergyOffPeakKwh: offPeakKwhField,
      reactiveEnergyKvarh: reactiveField,
      powerFactor: powerFactorField,
      subtotalAmount: subtotalField,
      vatAmount: vatAmountField,
      totalAmountDue: totalDueField,
      lineItems,
    };
  }

  /**
   * Extracts Statement determinants
   */
  public static extractStatementDeterminants(
    pages: OcrPageResult[],
    documentId: string,
    ocrRunId?: string,
  ): OcrExtractedStatementDeterminants {
    const accField = this.findFieldByPattern(
      pages,
      documentId,
      "accountNumber",
      "Account Number",
      [/\b(?:ACCOUNT\s*NO|ACCOUNT\s*NUMBER)[:\s]+([0-9]{10,12})\b/i],
      undefined,
      ocrRunId,
    );

    const stmtDateField = this.findFieldByPattern(
      pages,
      documentId,
      "statementDate",
      "Statement Date",
      [/\b(?:STATEMENT\s*DATE|DATE)[:\s]+(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i],
      undefined,
      ocrRunId,
    );

    const openingBalance = this.findNumericFieldByPattern(
      pages,
      documentId,
      "openingBalance",
      "Opening Balance",
      [
        /\b(?:OPENING\s*BALANCE|BALANCE\s*BROUGHT\s*FORWARD)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i,
      ],
      ocrRunId,
    );

    const closingBalance = this.findNumericFieldByPattern(
      pages,
      documentId,
      "closingBalanceDue",
      "Closing Balance Due",
      [
        /\b(?:CLOSING\s*BALANCE(?:\s*DUE)?|TOTAL\s*(?:AMOUNT\s*)?DUE|AMOUNT\s*PAYABLE)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i,
      ],
      ocrRunId,
    );

    const paymentsReceived = this.findNumericFieldByPattern(
      pages,
      documentId,
      "paymentsReceived",
      "Payments Received",
      [/\b(?:PAYMENTS\s*RECEIVED|LESS\s*PAYMENTS)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i],
      ocrRunId,
    );

    const currentCharges = this.findNumericFieldByPattern(
      pages,
      documentId,
      "currentCharges",
      "Current Charges",
      [/\b(?:CURRENT\s*CHARGES|NEW\s*CHARGES)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i],
      ocrRunId,
    );

    const adjustmentsAmount = this.findNumericFieldByPattern(
      pages,
      documentId,
      "adjustmentsAmount",
      "Adjustments",
      [/\b(?:ADJUSTMENTS)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i],
      ocrRunId,
    );

    return {
      accountNumber: accField,
      statementDate: stmtDateField,
      customerName: this.findFieldByPattern(
        pages,
        documentId,
        "customerName",
        "Customer Name",
        [/\b(?:CUSTOMER|NAME)[:\s]+([A-Z0-9\s.,&'()-]{4,40})/i],
        undefined,
        ocrRunId,
      ),
      openingBalance,
      paymentsReceived,
      adjustmentsAmount,
      currentCharges,
      closingBalanceDue: closingBalance,
      statementItems: [],
    };
  }

  /**
   * Extracts Credit Note determinants
   */
  public static extractCreditNoteDeterminants(
    pages: OcrPageResult[],
    documentId: string,
    ocrRunId?: string,
  ): OcrExtractedCreditNoteDeterminants {
    const cnNumber = this.findFieldByPattern(
      pages,
      documentId,
      "creditNoteNumber",
      "Credit Note Number",
      [
        /\b(?:CREDIT\s*NOTE\s*(?:NO\.?|NUMBER|#|REF)|CN\s*(?:NO\.?|NUMBER|#)?)\b[:\s]*([A-Z0-9\-_]{4,25})\b/i,
        /\b(?:CREDIT\s*NOTE)[:#]\s*([A-Z0-9\-_]{4,25})\b/i,
      ],
      undefined,
      ocrRunId,
    );

    const origInv = this.findFieldByPattern(
      pages,
      documentId,
      "originalInvoiceReference",
      "Original Invoice Reference",
      [
        /\b(?:ORIGINAL\s*(?:TAX\s*)?INVOICE\s*(?:NO\.?|NUMBER|REF)|RE:\s*INVOICE|REF\s*INVOICE)\b[:\s]*([A-Z0-9\-_]{4,25})\b/i,
        /\b(?:ORIGINAL\s*(?:TAX\s*)?INVOICE)[:#]\s*([A-Z0-9\-_]{4,25})\b/i,
      ],
      undefined,
      ocrRunId,
    );

    const creditDate = this.findFieldByPattern(
      pages,
      documentId,
      "creditDate",
      "Credit Date",
      [/\b(?:CREDIT\s*DATE|DATE)[:\s]+(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i],
      undefined,
      ocrRunId,
    );

    const totalCredit = this.findNumericFieldByPattern(
      pages,
      documentId,
      "totalCreditAmount",
      "Total Credit Amount",
      [
        /\b(?:TOTAL\s*CREDIT|CREDIT\s*AMOUNT|TOTAL\s*AMOUNT)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i,
      ],
      ocrRunId,
    );

    return {
      creditNoteNumber: cnNumber,
      originalInvoiceReference: origInv,
      creditDate,
      accountNumber: this.findFieldByPattern(
        pages,
        documentId,
        "accountNumber",
        "Account Number",
        [/\b(?:ACCOUNT(?:\s*NO|\s*NUMBER)?|ACC)[:\s]+([0-9]{10,12})\b/i],
        undefined,
        ocrRunId,
      ),
      customerName: this.findFieldByPattern(
        pages,
        documentId,
        "customerName",
        "Customer Name",
        [/\b(?:CUSTOMER\s*NAME|CLIENT\s*NAME|CUSTOMER|NAME)[:\s]+([A-Z0-9\s.,&'()-]{4,40})/i],
        undefined,
        ocrRunId,
      ),
      creditReason: this.findFieldByPattern(
        pages,
        documentId,
        "creditReason",
        "Credit Reason",
        [/\b(?:CREDIT\s*REASON|REASON(?:\s*FOR\s*CREDIT)?)[:\s]+([A-Z0-9\s.,&'()-]{4,60})/i],
        undefined,
        ocrRunId,
      ),
      creditSubtotal: this.findNumericFieldByPattern(
        pages,
        documentId,
        "creditSubtotal",
        "Credit Subtotal",
        [/\b(?:CREDIT\s*SUB-?TOTAL|SUB-?TOTAL)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i],
        ocrRunId,
      ),
      creditVat: this.findNumericFieldByPattern(
        pages,
        documentId,
        "creditVat",
        "Credit VAT",
        [/\b(?:CREDIT\s*VAT|VAT)[:\s]+(?:R|ZAR)?\s*([0-9,]+\.[0-9]{2})/i],
        ocrRunId,
      ),
      totalCreditAmount: totalCredit,
    };
  }

  /**
   * Extracts Meter Reading document determinants
   */
  public static extractMeterDeterminants(
    pages: OcrPageResult[],
    documentId: string,
    ocrRunId?: string,
  ): OcrExtractedMeterDeterminants {
    const meterNo = this.findFieldByPattern(
      pages,
      documentId,
      "meterSerialNumber",
      "Meter Serial Number",
      [/\b(?:METER\s*(?:NO|SERIAL|NUMBER)|MTR)[:\s]+([A-Z0-9\-_]{5,20})/i],
      undefined,
      ocrRunId,
    );

    const readingDate = this.findFieldByPattern(
      pages,
      documentId,
      "readingDate",
      "Reading Date",
      [/\b(?:READING\s*DATE|DATE)[:\s]+(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/i],
      undefined,
      ocrRunId,
    );

    const prevReading = this.findNumericFieldByPattern(
      pages,
      documentId,
      "previousReading",
      "Previous Reading",
      [
        /\b(?:PREVIOUS\s*(?:READING|DIAL|INDEX)|PREV\s*(?:RDG|READING|DIAL))[:\s]+([0-9,]+(?:\.[0-9]+)?)/i,
      ],
      ocrRunId,
    );

    const currReading = this.findNumericFieldByPattern(
      pages,
      documentId,
      "currentReading",
      "Current Reading",
      [
        /\b(?:CURRENT\s*(?:READING|DIAL|INDEX)|CURR\s*(?:RDG|READING|DIAL)|PRESENT\s*(?:READING|DIAL))[:\s]+([0-9,]+(?:\.[0-9]+)?)/i,
      ],
      ocrRunId,
    );

    const multiplier = this.findNumericFieldByPattern(
      pages,
      documentId,
      "multiplyingFactor",
      "Multiplying Factor",
      [/\b(?:MULTIPLYING\s*FACTOR|MULTIPLIER|MF)[:\s]+([0-9]+(?:\.[0-9]+)?)/i],
      ocrRunId,
    );

    const consumption = this.findNumericFieldByPattern(
      pages,
      documentId,
      "totalConsumptionKwh",
      "Total Consumption (kWh)",
      [
        /\b(?:TOTAL\s*CONSUMPTION|UNITS\s*CONSUMED|TOTAL\s*KWH|CONSUMPTION)[:\s]+([0-9,]+(?:\.[0-9]+)?)/i,
      ],
      ocrRunId,
    );

    return {
      meterSerialNumber: meterNo,
      readingDate,
      previousReading: prevReading,
      currentReading: currReading,
      dialDifference: this.findNumericFieldByPattern(
        pages,
        documentId,
        "dialDifference",
        "Dial Difference",
        [/\b(?:DIAL\s*DIFFERENCE|DIFFERENCE)[:\s]+([0-9,]+(?:\.[0-9]+)?)/i],
        ocrRunId,
      ),
      multiplyingFactor: multiplier,
      totalConsumptionKwh: consumption,
    };
  }

  /**
   * Extracts adjustment document determinants (financial variances, reasons, references)
   */
  public static extractAdjustmentDeterminants(
    pages: OcrPageResult[],
    documentId: string,
    ocrRunId?: string,
  ): OcrExtractedAdjustmentDeterminants {
    const rawFullText = pages.map((p) => p.fullText).join("\n");
    const isCredit =
      rawFullText.toUpperCase().includes("CREDIT TO CUSTOMER") ||
      rawFullText.toUpperCase().includes("REFUND") ||
      rawFullText.toUpperCase().includes("CREDIT ADJUSTMENT");

    return {
      adjustmentNumber: this.findFieldByPattern(
        pages,
        documentId,
        "adjustmentNumber",
        "Adjustment Number",
        [/\b(?:ADJUSTMENT\s*(?:NO|NUMBER)|ADJ\s*NO)[:\s]+([A-Z0-9\-_]+)/i],
        undefined,
        ocrRunId,
      ),
      referencedInvoiceOrPeriod: this.findFieldByPattern(
        pages,
        documentId,
        "referencedInvoiceOrPeriod",
        "Referenced Invoice / Period",
        [/\b(?:REFERENCED?\s*(?:INVOICE|PERIOD)|INVOICE\s*REF)[:\s]+([A-Z0-9\-_/\s]+)/i],
        undefined,
        ocrRunId,
      ),
      adjustmentDate: this.findFieldByPattern(
        pages,
        documentId,
        "adjustmentDate",
        "Adjustment Date",
        [/\b(?:ADJUSTMENT\s*DATE|DATE)[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})/i],
        undefined,
        ocrRunId,
      ),
      accountNumber: this.findFieldByPattern(
        pages,
        documentId,
        "accountNumber",
        "Account Number",
        [/\b(?:ACCOUNT(?:\s*NO)?|ACC)[:\s]+(\d{10,12}|\b785\d{7,9}\b)/i],
        undefined,
        ocrRunId,
      ),
      meterNumber: this.findFieldByPattern(
        pages,
        documentId,
        "meterNumber",
        "Meter Number",
        [/\b(?:METER(?:\s*NO)?|SERIAL)[:\s]+([A-Z0-9\-_]+)/i],
        undefined,
        ocrRunId,
      ),
      reason: this.findFieldByPattern(
        pages,
        documentId,
        "reason",
        "Adjustment Reason",
        [/\b(?:REASON|DESCRIPTION|CAUSE)[:\s]+([^\n\r]+)/i],
        undefined,
        ocrRunId,
      ),
      financialVarianceAmount: this.findNumericFieldByPattern(
        pages,
        documentId,
        "financialVarianceAmount",
        "Financial Variance",
        [
          /\b(?:FINANCIAL\s*VARIANCE|VARIANCE|ADJUSTMENT\s*AMOUNT|AMOUNT)[:\s]+(?:R\s*)?([0-9,]+(?:\.[0-9]+)?)/i,
        ],
        ocrRunId,
      ),
      isCreditToCustomer: isCredit,
    };
  }

  /**
   * Extracts tariff schedule determinants (TOU slots, seasonal rates, regulatory approval)
   */
  public static extractTariffDeterminants(
    pages: OcrPageResult[],
    documentId: string,
    ocrRunId?: string,
  ): OcrExtractedTariffDeterminants {
    const rates: OcrExtractedTariffDeterminants["rates"] = [];

    for (const page of pages) {
      for (const line of page.lines) {
        const text = line.text;
        const peakMatch = text.match(
          /\bPEAK(?:\s*RATE)?[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:c|cents|\/kWh)?/i,
        );
        if (peakMatch) {
          rates.push({
            season: "ALL_YEAR",
            timeOfUseSlot: "PEAK",
            rateCentsPerKwh: parseFloat(peakMatch[1].replace(/,/g, "")),
            provenance: {
              documentId,
              pageNumber: page.pageNumber,
              extractionMethod: "OCR_TESSERACT",
              boundingBox: line.boundingBox,
              hasExactBoundingBox: true,
              contextSnippet: line.text,
              confidenceScore: line.confidence,
              confidenceTier: line.confidence >= 85 ? "HIGH" : "MEDIUM",
              x: line.x,
              y: line.y,
              width: line.width,
              height: line.height,
              coordinateSystem: line.coordinateSystem,
              detailedBoundingBox: line.detailedBoundingBox,
              ocrRunId,
              processingRun: ocrRunId,
              ocr: !page.isNativeDigital,
              isOcr: !page.isNativeDigital,
              sourceText: line.text,
            },
          });
        }
        const stdMatch = text.match(
          /\bSTANDARD(?:\s*RATE)?[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:c|cents|\/kWh)?/i,
        );
        if (stdMatch) {
          rates.push({
            season: "ALL_YEAR",
            timeOfUseSlot: "STANDARD",
            rateCentsPerKwh: parseFloat(stdMatch[1].replace(/,/g, "")),
            provenance: {
              documentId,
              pageNumber: page.pageNumber,
              extractionMethod: "OCR_TESSERACT",
              boundingBox: line.boundingBox,
              hasExactBoundingBox: true,
              contextSnippet: line.text,
              confidenceScore: line.confidence,
              confidenceTier: line.confidence >= 85 ? "HIGH" : "MEDIUM",
              x: line.x,
              y: line.y,
              width: line.width,
              height: line.height,
              coordinateSystem: line.coordinateSystem,
              detailedBoundingBox: line.detailedBoundingBox,
              ocrRunId,
              processingRun: ocrRunId,
              ocr: !page.isNativeDigital,
              isOcr: !page.isNativeDigital,
              sourceText: line.text,
            },
          });
        }
        const offPeakMatch = text.match(
          /\bOFF-?PEAK(?:\s*RATE)?[:\s]+([0-9,]+(?:\.[0-9]+)?)\s*(?:c|cents|\/kWh)?/i,
        );
        if (offPeakMatch) {
          rates.push({
            season: "ALL_YEAR",
            timeOfUseSlot: "OFF_PEAK",
            rateCentsPerKwh: parseFloat(offPeakMatch[1].replace(/,/g, "")),
            provenance: {
              documentId,
              pageNumber: page.pageNumber,
              extractionMethod: "OCR_TESSERACT",
              boundingBox: line.boundingBox,
              hasExactBoundingBox: true,
              contextSnippet: line.text,
              confidenceScore: line.confidence,
              confidenceTier: line.confidence >= 85 ? "HIGH" : "MEDIUM",
              x: line.x,
              y: line.y,
              width: line.width,
              height: line.height,
              coordinateSystem: line.coordinateSystem,
              detailedBoundingBox: line.detailedBoundingBox,
              ocrRunId,
              processingRun: ocrRunId,
              ocr: !page.isNativeDigital,
              isOcr: !page.isNativeDigital,
              sourceText: line.text,
            },
          });
        }
      }
    }

    return {
      tariffCode: this.findFieldByPattern(
        pages,
        documentId,
        "tariffCode",
        "Tariff Code",
        [
          /\b(?:TARIFF\s*CODE|CODE)[:\s]+([A-Z0-9\-_]+)/i,
          /\b(MEGAFLEX|MINIFLEX|NIGHTSAVE|MEGEX)\b/i,
        ],
        undefined,
        ocrRunId,
      ),
      tariffName: this.findFieldByPattern(
        pages,
        documentId,
        "tariffName",
        "Tariff Name",
        [/\b(?:TARIFF\s*NAME|TARIFF)[:\s]+([^\n\r]+)/i],
        undefined,
        ocrRunId,
      ),
      effectiveStartDate: this.findFieldByPattern(
        pages,
        documentId,
        "effectiveStartDate",
        "Effective Date",
        [/\b(?:EFFECTIVE(?:\s*START)?\s*DATE|FROM)[:\s]+(\d{4}[-/]\d{2}[-/]\d{2})/i],
        undefined,
        ocrRunId,
      ),
      regulatoryAuthority: this.findFieldByPattern(
        pages,
        documentId,
        "regulatoryAuthority",
        "Regulatory Authority",
        [/\b(NERSA|ESKOM|MUNICIPALITY)\b/i],
        undefined,
        ocrRunId,
      ),
      rates,
    };
  }

  // ---------------------------------------------------------------------------
  // Helper Matchers
  // ---------------------------------------------------------------------------

  private static findFieldByPattern(
    pages: OcrPageResult[],
    documentId: string,
    fieldKey: string,
    fieldLabel: string,
    patterns: RegExp[],
    transformer?: (val: string) => string,
    ocrRunId?: string,
  ): OcrDeterminantField<string | null> {
    for (const page of pages) {
      // First check structured Key-Value pairs
      const matchedKv = page.keyValuePairs.find((kv) =>
        patterns.some((p) => p.test(`${kv.keyText}: ${kv.valueText}`)),
      );
      if (matchedKv && matchedKv.valueText) {
        const raw = matchedKv.valueText;
        const val = transformer ? transformer(raw) : raw;
        return {
          fieldKey,
          fieldLabel,
          value: val,
          rawValue: raw,
          provenance: {
            documentId,
            pageNumber: page.pageNumber,
            extractionMethod: "OCR_KEY_VALUE",
            boundingBox: matchedKv.valueBoundingBox,
            hasExactBoundingBox: true,
            contextSnippet: `${matchedKv.keyText}: ${matchedKv.valueText}`,
            confidenceScore: matchedKv.confidence,
            confidenceTier: matchedKv.confidence >= 85 ? "HIGH" : "MEDIUM",
            x: matchedKv.x,
            y: matchedKv.y,
            width: matchedKv.width,
            height: matchedKv.height,
            coordinateSystem: matchedKv.coordinateSystem,
            detailedBoundingBox: matchedKv.detailedBoundingBox,
            ocrRunId,
            processingRun: ocrRunId,
            ocr: !page.isNativeDigital,
            isOcr: !page.isNativeDigital,
            sourceText: raw,
          },
        };
      }

      // Fallback: check full line text
      for (const line of page.lines) {
        for (const pattern of patterns) {
          const match = line.text.match(pattern);
          if (match && match[1]) {
            const raw = match[1].trim();
            const val = transformer ? transformer(raw) : raw;
            return {
              fieldKey,
              fieldLabel,
              value: val,
              rawValue: raw,
              provenance: {
                documentId,
                pageNumber: page.pageNumber,
                extractionMethod: "OCR_TESSERACT",
                boundingBox: line.boundingBox,
                hasExactBoundingBox: true,
                contextSnippet: line.text,
                confidenceScore: line.confidence,
                confidenceTier: line.confidence >= 85 ? "HIGH" : "MEDIUM",
                x: line.x,
                y: line.y,
                width: line.width,
                height: line.height,
                coordinateSystem: line.coordinateSystem,
                detailedBoundingBox: line.detailedBoundingBox,
                ocrRunId,
                processingRun: ocrRunId,
                ocr: !page.isNativeDigital,
                isOcr: !page.isNativeDigital,
                sourceText: raw,
              },
            };
          }
        }
      }
    }

    // Never fabricate missing value — return explicit null
    return {
      fieldKey,
      fieldLabel,
      value: null,
      rawValue: "",
      provenance: this.createEmptyProvenance(documentId, 1, fieldKey, ocrRunId),
    };
  }

  private static mapFieldKeyToCategory(fieldKey: string): NumericFieldCategory {
    const lower = fieldKey.toLowerCase();
    if (lower.includes("account")) return "ACCOUNT_NUMBER";
    if (lower.includes("meter")) return "METER_NUMBER";
    if (lower.includes("invoice")) return "INVOICE_NUMBER";
    if (lower.includes("date")) return "DATE";
    if (lower.includes("kwh") || lower.includes("consumption") || lower.includes("activeenergy"))
      return "KWH";
    if (lower.includes("kva") && !lower.includes("kvah") && !lower.includes("kvarh")) return "KVA";
    if (lower.includes("kvah")) return "KVAH";
    if (lower.includes("kvarh") || lower.includes("reactive")) return "KVARH";
    if (lower.includes("demand")) return "DEMAND";
    if (lower.includes("powerfactor") || lower.includes("pf")) return "POWER_FACTOR";
    if (lower.includes("vat")) return "VAT";
    if (lower.includes("total") || lower.includes("balance")) return "TOTAL";
    if (lower.includes("tariff")) return "TARIFF";
    if (lower.includes("rate")) return "RATE";
    return "AMOUNT";
  }

  private static findNumericFieldByPattern(
    pages: OcrPageResult[],
    documentId: string,
    fieldKey: string,
    fieldLabel: string,
    patterns: RegExp[],
    ocrRunId?: string,
  ): OcrDeterminantField<number | null> {
    const category = this.mapFieldKeyToCategory(fieldKey);

    for (const page of pages) {
      for (const line of page.lines) {
        for (const pattern of patterns) {
          const match = line.text.match(pattern);
          if (match && match[1]) {
            const raw = match[1];
            const protectedField = NumericProtectionEngine.parseAndProtectNumeric(raw, category, {
              pageNumber: page.pageNumber,
              baseConfidence: line.confidence,
            });

            if (protectedField.numericValue !== null) {
              return {
                fieldKey,
                fieldLabel,
                value: protectedField.numericValue,
                rawValue: raw, // Preserved strictly without silent mutation!
                provenance: {
                  documentId,
                  pageNumber: page.pageNumber,
                  extractionMethod: "OCR_TESSERACT",
                  boundingBox: line.boundingBox,
                  hasExactBoundingBox: true,
                  contextSnippet: line.text,
                  confidenceScore: protectedField.confidenceScore,
                  confidenceTier: protectedField.confidenceTier,
                  x: line.x,
                  y: line.y,
                  width: line.width,
                  height: line.height,
                  coordinateSystem: line.coordinateSystem,
                  detailedBoundingBox: line.detailedBoundingBox,
                  ocrRunId,
                  processingRun: ocrRunId,
                  ocr: !page.isNativeDigital,
                  isOcr: !page.isNativeDigital,
                  sourceText: raw,
                },
              };
            }
          }
        }
      }
    }

    return {
      fieldKey,
      fieldLabel,
      value: null,
      rawValue: "",
      provenance: this.createEmptyProvenance(documentId, 1, fieldKey, ocrRunId),
    };
  }

  private static categorizeChargeDescription(
    desc: string,
  ): "NETWORK" | "GENERATION" | "TRANSMISSION" | "ENVIRONMENTAL" | "TAX" | "OTHER" {
    const upper = desc.toUpperCase();
    if (upper.includes("NETWORK") || upper.includes("DISTRIBUTION") || upper.includes("ACCESS")) {
      return "NETWORK";
    }
    if (
      upper.includes("GENERATION") ||
      upper.includes("ENERGY") ||
      upper.includes("PEAK") ||
      upper.includes("OFF-PEAK")
    ) {
      return "GENERATION";
    }
    if (upper.includes("TRANSMISSION")) {
      return "TRANSMISSION";
    }
    if (upper.includes("ENVIRONMENTAL") || upper.includes("LEVY") || upper.includes("CARBON")) {
      return "ENVIRONMENTAL";
    }
    if (upper.includes("VAT") || upper.includes("TAX")) {
      return "TAX";
    }
    return "OTHER";
  }

  private static createEmptyProvenance(
    documentId: string,
    pageNumber: number,
    fieldKey: string,
    ocrRunId?: string,
  ): OcrFieldProvenance {
    return {
      documentId,
      pageNumber,
      extractionMethod: "OCR_TESSERACT",
      hasExactBoundingBox: false,
      contextSnippet: `Field '${fieldKey}' was not present in document.`,
      confidenceScore: 0,
      confidenceTier: "LOW",
      ocrRunId,
      processingRun: ocrRunId,
      ocr: false,
      isOcr: false,
      sourceText: "",
    };
  }

  /**
   * Answers the authoritative audit question:
   * "Where exactly on the invoice did this value come from?"
   *
   * Traces the complete provenance chain down to the exact page, spatial coordinates,
   * coordinate system, extraction method, surrounding context snippet, and confidence.
   * Integrates seamlessly with the Document Intelligence evidence model.
   */
  public static answerEvidenceLocation(field: OcrDeterminantField<any>): OcrEvidenceLocationReport {
    const prov = field.provenance;
    const isGrounded =
      prov.hasExactBoundingBox &&
      prov.pageNumber > 0 &&
      field.value !== null &&
      field.value !== undefined;

    const coords =
      isGrounded && prov.x !== undefined && prov.y !== undefined
        ? {
            x: prov.x,
            y: prov.y,
            width: prov.width ?? 0,
            height: prov.height ?? 0,
            coordinateSystem: prov.coordinateSystem || "NORMALIZED_0_1",
          }
        : prov.boundingBox
          ? {
              x: prov.boundingBox[0],
              y: prov.boundingBox[1],
              width: prov.boundingBox[2],
              height: prov.boundingBox[3],
              coordinateSystem: prov.coordinateSystem || "NORMALIZED_0_1",
            }
          : null;

    const coordStr = coords
      ? `[x=${coords.x}, y=${coords.y}, w=${coords.width}, h=${coords.height} (${coords.coordinateSystem})]`
      : "[unmapped]";

    const evidenceChain = isGrounded
      ? `Document ${prov.documentId} -> Page ${prov.pageNumber} -> Region ${coordStr} -> Snippet '${prov.contextSnippet || field.rawValue}' -> Method ${prov.extractionMethod} -> Confidence ${prov.confidenceScore}% (${prov.confidenceTier})`
      : `Document ${prov.documentId} -> Unobserved / Not Grounded`;

    const found = isGrounded && coords !== null;
    const groundingText = prov.contextSnippet || field.rawValue || "";
    const explanation = found
      ? `Field '${field.fieldLabel || field.fieldKey}' (${field.value}) was located on page ${prov.pageNumber} at coordinates (x: ${coords.x}, y: ${coords.y}, w: ${coords.width}, h: ${coords.height}) using ${coords.coordinateSystem} with ${prov.confidenceScore}% confidence. Original snippet: '${groundingText}'.`
      : `Field '${field.fieldLabel || field.fieldKey}' was not located or unobserved in document ${prov.documentId}.`;

    return {
      question: "Where exactly on the invoice did this value come from?",
      found,
      isGrounded,
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      value: field.value,
      documentId: prov.documentId,
      pageNumber: prov.pageNumber,
      boundingBox: prov.boundingBox || null,
      x: coords?.x ?? null,
      y: coords?.y ?? null,
      width: coords?.width ?? null,
      height: coords?.height ?? null,
      coordinateSystem: coords?.coordinateSystem ?? null,
      coordinates: coords,
      groundingText,
      contextSnippet: prov.contextSnippet || "",
      extractionMethod: prov.extractionMethod,
      confidence: prov.confidenceScore,
      confidenceTier: prov.confidenceTier,
      explanation,
      evidenceChain,
    };
  }

  /**
   * Converts an OCR determinant field into a canonical Document Intelligence ProvenancedField,
   * guaranteeing complete compatibility with DocumentEvidenceService and the 12-node evidence ledger.
   */
  public static toProvenancedField<T = string | number | null>(
    field: OcrDeterminantField<T>,
    documentId: string,
  ): ProvenancedField<T> {
    const prov = field.provenance;
    const region: BoundingBox = prov.boundingBox
      ? [prov.boundingBox[0], prov.boundingBox[1], prov.boundingBox[2], prov.boundingBox[3]]
      : [0, 0, 0, 0];

    const confScore =
      prov.confidenceScore > 1
        ? Number((prov.confidenceScore / 100).toFixed(4))
        : prov.confidenceScore;

    return ProvenanceGuard.createProvenancedField({
      fieldKey: field.fieldKey,
      fieldLabel: field.fieldLabel,
      value: field.value,
      rawValue: field.rawValue,
      documentId: prov.documentId || documentId,
      pageNumber: Math.max(1, prov.pageNumber),
      region,
      regionText: field.rawValue || String(field.value ?? ""),
      contextSnippet: prov.contextSnippet,
      extractionMethod:
        prov.extractionMethod === "OCR_KEY_VALUE"
          ? "KEY_VALUE_PAIR"
          : prov.extractionMethod === "OCR_LAYOUT_TABLE"
            ? "LAYOUT_TABLE_CELL"
            : "TESSERACT_OCR",
      confidenceScore: Math.min(1.0, Math.max(0.0, confScore)),
      confidenceLevel:
        prov.confidenceTier === "HIGH"
          ? "HIGH"
          : prov.confidenceTier === "MEDIUM"
            ? "MEDIUM"
            : "LOW",
      coordinateSystem: prov.coordinateSystem,
      detailedBoundingBox: prov.detailedBoundingBox
        ? {
            pageNumber: prov.detailedBoundingBox.pageNumber,
            x: prov.detailedBoundingBox.x,
            y: prov.detailedBoundingBox.y,
            width: prov.detailedBoundingBox.width,
            height: prov.detailedBoundingBox.height,
            coordinateSystem: prov.detailedBoundingBox.coordinateSystem,
            confidence: prov.detailedBoundingBox.confidence,
          }
        : undefined,
      runId: prov.processingRun || prov.ocrRunId,
    });
  }

  /**
   * Converts an OCR determinant field to an authoritative OcrFieldEvidence record (Requirement 21).
   */
  public static toFieldEvidence<T = string | number | null>(
    field: OcrDeterminantField<T>,
    documentId: string,
    processingRunId?: string,
    isOcr: boolean = true,
  ): OcrFieldEvidence<T> {
    return OcrEvidenceModel.fromDeterminantField(field, documentId, processingRunId, isOcr);
  }

  /**
   * Compiles an entire dictionary of OcrFieldEvidence records from extracted determinants (Requirement 21).
   */
  public static compileFieldEvidenceRecords(
    determinants: any,
    documentId: string,
    processingRunId: string = "ocr-run-default",
    defaultIsOcr: boolean = true,
  ): Record<string, OcrFieldEvidence> {
    return OcrEvidenceModel.compileEvidencePackage(
      determinants,
      documentId,
      processingRunId,
      defaultIsOcr,
    );
  }

  /**
   * Compiles all grounded invoice determinants into a dictionary of ProvenancedField records
   * ready for DocumentEvidenceService registration.
   */
  public static compileDocumentEvidence(
    determinants: OcrExtractedInvoiceDeterminants,
    documentId: string,
  ): Record<string, ProvenancedField> {
    const evidence: Record<string, ProvenancedField> = {};

    const candidateFields: Array<OcrDeterminantField<any> | undefined> = [
      determinants.accountNumber,
      determinants.invoiceNumber,
      determinants.taxInvoiceNumber,
      determinants.customerName,
      determinants.customerAddress,
      determinants.vatRegistrationNumber,
      determinants.billingPeriodStart,
      determinants.billingPeriodEnd,
      determinants.invoiceDate,
      determinants.paymentDueDate,
      determinants.tariffCode,
      determinants.tariffName,
      determinants.meterNumber,
      determinants.notifiedMaximumDemandKva,
      determinants.maximumDemandKva,
      determinants.activeEnergyTotalKwh,
      determinants.activeEnergyPeakKwh,
      determinants.activeEnergyStandardKwh,
      determinants.activeEnergyOffPeakKwh,
      determinants.reactiveEnergyKvarh,
      determinants.powerFactor,
      determinants.subtotalAmount,
      determinants.vatAmount,
      determinants.totalAmountDue,
    ];

    for (const f of candidateFields) {
      if (f && f.value !== null && f.value !== undefined && f.provenance.hasExactBoundingBox) {
        try {
          evidence[f.fieldKey] = this.toProvenancedField(f, documentId);
        } catch {
          // Skip non-grounded / unprovenanced entries
        }
      }
    }

    return evidence;
  }
}
