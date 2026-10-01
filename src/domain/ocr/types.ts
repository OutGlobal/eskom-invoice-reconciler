/**
 * ENERA PRODUCTION OCR ENGINE — TYPES & CONTRACTS
 * ========================================================
 * Authoritative type definitions for the production OCR subsystem:
 *
 *   PDF / Image
 *        ↓
 *   PAGE IMAGES
 *        ↓
 *       OCR
 *        ↓
 *      TEXT
 *        ↓
 *     WORDS
 *        ↓
 *     LINES
 *        ↓
 *   TABLE / LAYOUT STRUCTURE
 *        ↓
 *   CONFIDENCE
 *        ↓
 *    EVIDENCE
 *        ↓
 *    DATABASE
 *
 * Designed for:
 *  - Invoices (Megaflex, Miniflex, Nightsave, Municipal)
 *  - Statements
 *  - Credit Notes
 *  - Adjustment Documents
 *  - Tariff Documents
 *  - Meter Reading Documents
 *  - Scanned Documents & Mobile Photos
 *  - Multi-Page PDFs & Mixed Digital/Scanned PDFs
 *
 * Mandatory rule: Never fabricate missing information.
 */

/**
 * 2D normalized coordinate box: [minX, minY, width, height]
 * Expressed as percentages 0..100 or normalized 0..1 relative to page bounds.
 */
export type OcrBoundingBox = [number, number, number, number];

export type OcrDocumentCategory =
  | "INVOICE"
  | "STATEMENT"
  | "CREDIT_NOTE"
  | "ADJUSTMENT"
  | "TARIFF_DOCUMENT"
  | "METER_DOCUMENT"
  | "UNKNOWN";

export type OcrConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export interface OcrImageGeometry {
  width: number;
  height: number;
  dpi: number;
  aspectRatio: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface OcrPreprocessedImage {
  pageNumber: number;
  originalGeometry: OcrImageGeometry;
  preprocessedGeometry: OcrImageGeometry;
  deskewAngleDegrees: number;
  isInverted: boolean;
  contrastRatio: number;
  isBinarized: boolean;
  imageData?: Uint8ClampedArray;
  dataUrl?: string;
  sourceType: "EMBEDDED_RASTER" | "RENDERED_PAGE" | "DIRECT_IMAGE";
}

export interface OcrWordToken {
  wordId: string;
  text: string;
  sanitizedText: string;
  confidence: number; // 0..100
  boundingBox: OcrBoundingBox;
  pageNumber: number;
  fontAttributes?: {
    isBold?: boolean;
    isItalic?: boolean;
    estimatedPointSize?: number;
  };
}

export interface OcrLineBlock {
  lineId: string;
  lineIndex: number;
  pageNumber: number;
  text: string;
  confidence: number; // 0..100
  boundingBox: OcrBoundingBox;
  words: OcrWordToken[];
  baselineY: number;
}

export interface OcrLayoutBlock {
  blockId: string;
  pageNumber: number;
  type: "PARAGRAPH" | "HEADING" | "TABLE" | "KEY_VALUE" | "LINE_ITEM_ROW" | "FOOTER";
  boundingBox: OcrBoundingBox;
  text: string;
  lines: OcrLineBlock[];
  confidence: number;
}

export interface OcrTableCell {
  cellId: string;
  rowIndex: number;
  columnIndex: number;
  rowSpan: number;
  colSpan: number;
  text: string;
  rawValue: string;
  numericValue: number | null;
  boundingBox: OcrBoundingBox;
  confidence: number;
}

export interface OcrTableStructure {
  tableId: string;
  pageNumber: number;
  tableType:
    "BILLING_SCHEDULE" | "METER_READINGS" | "TARIFF_RATES" | "FINANCIAL_SUMMARY" | "GENERIC";
  headers: string[];
  rows: string[][];
  cells: OcrTableCell[];
  rowCount: number;
  columnCount: number;
  boundingBox: OcrBoundingBox;
  confidence: number;
}

export interface OcrKeyValuePair {
  pairId: string;
  pageNumber: number;
  keyText: string;
  keyNormalized: string;
  keyBoundingBox: OcrBoundingBox;
  valueText: string;
  valueNormalized: string | number | null;
  valueBoundingBox: OcrBoundingBox;
  confidence: number;
  orientation: "HORIZONTAL_RIGHT" | "VERTICAL_BELOW";
}

export interface OcrPageResult {
  pageNumber: number;
  fullText: string;
  geometry: OcrImageGeometry;
  words: OcrWordToken[];
  lines: OcrLineBlock[];
  blocks: OcrLayoutBlock[];
  tables: OcrTableStructure[];
  keyValuePairs: OcrKeyValuePair[];
  averageConfidence: number;
  minConfidence: number;
  characterCount: number;
  isNativeDigital: boolean;
  isScannedRaster: boolean;
  processingDurationMs: number;
}

/**
 * Standardized field provenance tracking for every extracted billing determinant
 */
export interface OcrFieldProvenance {
  documentId: string;
  pageNumber: number;
  extractionMethod:
    "OCR_TESSERACT" | "OCR_LAYOUT_TABLE" | "OCR_KEY_VALUE" | "DIGITAL_STREAM_HYBRID";
  boundingBox?: OcrBoundingBox;
  hasExactBoundingBox: boolean;
  contextSnippet?: string;
  confidenceScore: number;
  confidenceTier: OcrConfidenceTier;
}

export interface OcrDeterminantField<T = string | number | null> {
  fieldKey: string;
  fieldLabel: string;
  value: T;
  rawValue: string;
  provenance: OcrFieldProvenance;
}

// ---------------------------------------------------------------------------
// Document-Specific Extracted Models
// ---------------------------------------------------------------------------

export interface OcrExtractedInvoiceDeterminants {
  accountNumber: OcrDeterminantField<string | null>;
  invoiceNumber: OcrDeterminantField<string | null>;
  taxInvoiceNumber?: OcrDeterminantField<string | null>;
  customerName: OcrDeterminantField<string | null>;
  customerAddress?: OcrDeterminantField<string | null>;
  vatRegistrationNumber?: OcrDeterminantField<string | null>;
  billingPeriodStart: OcrDeterminantField<string | null>;
  billingPeriodEnd: OcrDeterminantField<string | null>;
  invoiceDate: OcrDeterminantField<string | null>;
  paymentDueDate: OcrDeterminantField<string | null>;
  tariffCode: OcrDeterminantField<string | null>;
  tariffName?: OcrDeterminantField<string | null>;
  meterNumber: OcrDeterminantField<string | null>;
  notifiedMaximumDemandKva: OcrDeterminantField<number | null>;
  maximumDemandKva: OcrDeterminantField<number | null>;
  activeEnergyTotalKwh: OcrDeterminantField<number | null>;
  activeEnergyPeakKwh: OcrDeterminantField<number | null>;
  activeEnergyStandardKwh: OcrDeterminantField<number | null>;
  activeEnergyOffPeakKwh: OcrDeterminantField<number | null>;
  reactiveEnergyKvarh: OcrDeterminantField<number | null>;
  powerFactor?: OcrDeterminantField<number | null>;
  subtotalAmount: OcrDeterminantField<number | null>;
  vatAmount: OcrDeterminantField<number | null>;
  totalAmountDue: OcrDeterminantField<number | null>;
  lineItems: {
    lineDescription: string;
    rate: number | null;
    quantity: number | null;
    amount: number | null;
    chargeCategory?: "NETWORK" | "GENERATION" | "TRANSMISSION" | "ENVIRONMENTAL" | "TAX" | "OTHER";
    provenance: OcrFieldProvenance;
  }[];
}

export interface OcrExtractedStatementDeterminants {
  accountNumber: OcrDeterminantField<string | null>;
  statementNumber?: OcrDeterminantField<string | null>;
  statementDate: OcrDeterminantField<string | null>;
  customerName: OcrDeterminantField<string | null>;
  openingBalance: OcrDeterminantField<number | null>;
  paymentsReceived: OcrDeterminantField<number | null>;
  adjustmentsAmount: OcrDeterminantField<number | null>;
  currentCharges: OcrDeterminantField<number | null>;
  closingBalanceDue: OcrDeterminantField<number | null>;
  paymentDueDate?: OcrDeterminantField<string | null>;
  statementItems: {
    transactionDate: string;
    reference: string;
    description: string;
    debitAmount: number | null;
    creditAmount: number | null;
    balance: number | null;
    provenance: OcrFieldProvenance;
  }[];
}

export interface OcrExtractedCreditNoteDeterminants {
  creditNoteNumber: OcrDeterminantField<string | null>;
  originalInvoiceReference: OcrDeterminantField<string | null>;
  creditDate: OcrDeterminantField<string | null>;
  accountNumber: OcrDeterminantField<string | null>;
  customerName: OcrDeterminantField<string | null>;
  creditReason: OcrDeterminantField<string | null>;
  creditSubtotal: OcrDeterminantField<number | null>;
  creditVat: OcrDeterminantField<number | null>;
  totalCreditAmount: OcrDeterminantField<number | null>;
}

export interface OcrExtractedAdjustmentDeterminants {
  adjustmentNumber: OcrDeterminantField<string | null>;
  referencedInvoiceOrPeriod: OcrDeterminantField<string | null>;
  adjustmentDate: OcrDeterminantField<string | null>;
  accountNumber: OcrDeterminantField<string | null>;
  meterNumber?: OcrDeterminantField<string | null>;
  reason: OcrDeterminantField<string | null>;
  recalculatedEnergyKwh?: OcrDeterminantField<number | null>;
  recalculatedDemandKva?: OcrDeterminantField<number | null>;
  financialVarianceAmount: OcrDeterminantField<number | null>;
  isCreditToCustomer: boolean;
}

export interface OcrExtractedTariffDeterminants {
  tariffCode: OcrDeterminantField<string | null>;
  tariffName: OcrDeterminantField<string | null>;
  effectiveStartDate: OcrDeterminantField<string | null>;
  effectiveEndDate?: OcrDeterminantField<string | null>;
  regulatoryAuthority: OcrDeterminantField<string | null>; // e.g. NERSA / Eskom / Municipal
  voltageLevel?: OcrDeterminantField<string | null>;
  rates: {
    season: "HIGH" | "LOW" | "ALL_YEAR";
    timeOfUseSlot: "PEAK" | "STANDARD" | "OFF_PEAK" | "FLAT";
    rateCentsPerKwh: number | null;
    demandRateRPerKva?: number | null;
    networkRateRPerKva?: number | null;
    provenance: OcrFieldProvenance;
  }[];
}

export interface OcrExtractedMeterDeterminants {
  meterSerialNumber: OcrDeterminantField<string | null>;
  installationDate?: OcrDeterminantField<string | null>;
  readingDate: OcrDeterminantField<string | null>;
  previousReading: OcrDeterminantField<number | null>;
  currentReading: OcrDeterminantField<number | null>;
  dialDifference: OcrDeterminantField<number | null>;
  multiplyingFactor: OcrDeterminantField<number | null>;
  totalConsumptionKwh: OcrDeterminantField<number | null>;
  maximumDemandKva?: OcrDeterminantField<number | null>;
  reactiveEnergyKvarh?: OcrDeterminantField<number | null>;
}

/**
 * Master Result Structure for an OCR Extraction Execution
 */
export interface OcrDocumentResult {
  ocrRunId: string;
  documentId: string;
  organisationId: string;
  checksum: string;
  filename: string;
  documentCategory: OcrDocumentCategory;
  totalPages: number;
  pages: OcrPageResult[];
  overallConfidence: number; // 0..100
  confidenceTier: OcrConfidenceTier;
  reviewRequired: boolean;
  reviewReasons: string[];
  tables: OcrTableStructure[];
  rawFullText: string;

  // Extracted domain determinants based on category
  invoiceDeterminants?: OcrExtractedInvoiceDeterminants;
  statementDeterminants?: OcrExtractedStatementDeterminants;
  creditNoteDeterminants?: OcrExtractedCreditNoteDeterminants;
  adjustmentDeterminants?: OcrExtractedAdjustmentDeterminants;
  tariffDeterminants?: OcrExtractedTariffDeterminants;
  meterDeterminants?: OcrExtractedMeterDeterminants;

  // Execution timing and audit
  executionEngine: "TESSERACT_HYBRID" | "TESSERACT_PURE" | "DIGITAL_FALLBACK";
  startedAt: string;
  completedAt: string;
  durationMs: number;
}
