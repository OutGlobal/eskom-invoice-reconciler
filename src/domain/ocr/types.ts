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

/**
 * Coordinate system identifier for spatial bounding boxes:
 * - "PIXEL_SPACE": Absolute pixel coordinates (e.g. raster canvas / scanned page pixels)
 * - "NORMALIZED_0_1": Normalized ratio (0.0 to 1.0) relative to page width and height
 * - "NORMALIZED_PERCENT": Percentage (0.0 to 100.0) relative to page width and height
 * - "PDF_POINTS": Standard 72 DPI PDF coordinate space
 */
export type CoordinateSystem =
  "PIXEL_SPACE" | "NORMALIZED_0_1" | "NORMALIZED_PERCENT" | "PDF_POINTS";

/**
 * Authoritative spatial bounding box metadata for any OCR element.
 * Preserves the 7 required properties for deep provenance tracking:
 * pageNumber, x, y, width, height, coordinateSystem, confidence.
 */
export interface OcrElementBoundingBox {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  confidence: number;
  confidenceTier?: OcrConfidenceTier;
}

export type OcrDocumentCategory =
  | "INVOICE"
  | "STATEMENT"
  | "CREDIT_NOTE"
  | "ADJUSTMENT"
  | "TARIFF_DOCUMENT"
  | "METER_DOCUMENT"
  | "UNKNOWN";

export type OcrConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export type DocumentOrientation = "PORTRAIT" | "LANDSCAPE";

export type RotationDegrees = 0 | 90 | 180 | 270;

export interface OcrImageGeometry {
  width: number;
  height: number;
  dpi: number;
  aspectRatio: number;
  rotation: RotationDegrees;
  orientation?: DocumentOrientation;
  detectedRotation?: RotationDegrees;
  appliedRotation?: RotationDegrees;
  wasOrientationCorrected?: boolean;
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
  /** Audit record of which transforms were applied and why. Populated by ImagePreprocessingEngine. */
  preprocessingDecision?: PreprocessingDecision;
}

export interface OcrWordToken {
  wordId: string;
  text: string;
  sanitizedText: string;
  confidence: number; // 0..100
  confidenceNormalized?: number; // 0.0 .. 1.0
  confidenceTier?: OcrConfidenceTier; // Requirement 13: word-level confidence tier (HIGH | MEDIUM | LOW)
  boundingBox: OcrBoundingBox;
  pageNumber: number;

  // Spatial coordinates & coordinate system (Requirements 11 & 12)
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;

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
  confidenceNormalized?: number;
  confidenceTier?: OcrConfidenceTier; // Requirement 13: line-level confidence tier (HIGH | MEDIUM | LOW)
  boundingBox: OcrBoundingBox;

  // Spatial coordinates & coordinate system (Requirements 11 & 12)
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;

  words: OcrWordToken[];
  baselineY: number;
}

export interface OcrLayoutBlock {
  blockId: string;
  pageNumber: number;
  type: "PARAGRAPH" | "HEADING" | "TABLE" | "KEY_VALUE" | "LINE_ITEM_ROW" | "FOOTER";
  boundingBox: OcrBoundingBox;

  // Spatial coordinates & coordinate system (Requirements 11 & 12)
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;

  text: string;
  lines: OcrLineBlock[];
  confidence: number;
  confidenceNormalized?: number;
  confidenceTier?: OcrConfidenceTier; // Requirement 13: block-level confidence tier (HIGH | MEDIUM | LOW)
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

  // Spatial coordinates & coordinate system (Requirements 11 & 12)
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;

  confidence: number;
  confidenceNormalized?: number;
  confidenceTier?: OcrConfidenceTier;

  // Provenance & Multi-Page Tables (Requirement 19)
  pageNumber?: number;
  sourceTableId?: string;
}

export type OcrTableRowType = "HEADER" | "DATA" | "TOTAL" | "SUBHEADER" | "EMPTY";
export type OcrColumnDataType =
  | "TEXT"
  | "NUMERIC"
  | "CURRENCY"
  | "DATE"
  | "PERCENTAGE"
  | "UNIT"
  | "MIXED";

export interface OcrTableRow {
  rowId: string;
  rowIndex: number;
  rowType: OcrTableRowType;
  cells: OcrTableCell[];
  rawText: string;
  boundingBox: OcrBoundingBox;
  confidence: number;
  confidenceTier?: OcrConfidenceTier;
  isTotalRow: boolean;
  isHeaderRow: boolean;

  // Provenance & Multi-Page Tables (Requirement 19)
  pageNumber?: number;
  sourceTableId?: string;
}

export interface OcrTableColumn {
  columnIndex: number;
  headerText: string;
  inferredDataType: OcrColumnDataType;
  cells: OcrTableCell[];
  alignment: "LEFT" | "RIGHT" | "CENTER";
  widthApprox: number;
}

export interface OcrMergedCell {
  cellId: string;
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
  rowSpan: number;
  colSpan: number;
  text: string;
  mergedDirection: "HORIZONTAL" | "VERTICAL" | "BOTH";
}

export interface OcrTableTotalSummary {
  rowId: string;
  rowIndex: number;
  label: string; // e.g. "Total", "Subtotal", "Current Due"
  columnIndex: number;
  amount: number;
  calculatedColumnSum?: number;
  arithmeticMatches: boolean;
  discrepancy?: number;
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

  // Spatial coordinates & coordinate system (Requirements 11 & 12)
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;

  confidence: number;
  confidenceNormalized?: number;
  confidenceTier?: OcrConfidenceTier;

  // Table Reconstruction Hierarchical Structure (Requirement 18)
  tableRows?: OcrTableRow[];
  tableColumns?: OcrTableColumn[];
  headerRows?: OcrTableRow[];
  dataRows?: OcrTableRow[];
  totalRows?: OcrTableRow[];
  hasMergedCells?: boolean;
  mergedCells?: OcrMergedCell[];
  hasRepeatedHeaders?: boolean;
  repeatedHeaderRowIndices?: number[];
  isContinuation?: boolean;
  continuedFromTableId?: string;
  continuedFromPage?: number;
  continuedOnPage?: number;
  continuesToTableId?: string;
  detectedTotals?: OcrTableTotalSummary[];

  // Multi-Page Table Continuation Support (Requirement 19)
  isMultiPage?: boolean;
  pagesSpanned?: number[];
  constituentTableIds?: string[];
  continuationMarkerDetected?: boolean;
  continuationMarkerText?: string;
  logicalTableId?: string;
}

// ---------------------------------------------------------------------------
// Candidate Date Recognition Types (Requirement 17)
// ---------------------------------------------------------------------------

export interface CandidateDateRecognition {
  candidateId: string;
  pageNumber: number;
  /** Exact original string from OCR text (NEVER mutated or destroyed!) */
  originalRaw: string;
  /** Normalized ISO 8601 string: YYYY-MM-DD (e.g. 2026-09-01) */
  normalizedIsoDate: string | null;
  /** Date components */
  components?: {
    year: number;
    month: number;
    day: number;
  };
  /** Detected format pattern (e.g. "DD/MM/YYYY", "YYYY-MM-DD", "DD MMM YYYY", "MMMM D, YYYY") */
  detectedFormat: string;
  /** Regional pattern classification */
  localePattern: "SOUTH_AFRICAN" | "INTERNATIONAL" | "AMBIGUOUS";
  /** Whether the date is valid on the Gregorian calendar (valid days in month, leap year) */
  isCalendarValid: boolean;
  /** Bounding box of the date token if spatially resolved */
  boundingBox?: OcrBoundingBox;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
    coordinateSystem: CoordinateSystem;
  };
  confidence: number;
  confidenceTier: OcrConfidenceTier;
  contextSnippet?: string;
  validationErrors?: OcrDetectedError[];
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

  // Spatial coordinates & coordinate system (Requirements 11 & 12)
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;

  confidence: number;
  confidenceNormalized?: number;
  confidenceTier?: OcrConfidenceTier;
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
  confidenceTier?: OcrConfidenceTier; // Requirement 13: page-level confidence tier (HIGH | MEDIUM | LOW)
  isReliable?: boolean; // Requirement 13: explicitly false for low-confidence
  detectedErrors?: OcrDetectedError[]; // Requirement 14: detected OCR errors on page
  characterCount: number;
  isNativeDigital: boolean;
  isScannedRaster: boolean;
  processingDurationMs: number;
  detectedOrientation?: DocumentOrientation;
  detectedRotation?: RotationDegrees;
  appliedRotation?: RotationDegrees;
  wasOrientationCorrected?: boolean;
  languageUsed?: string;
  candidateDates?: CandidateDateRecognition[]; // Requirement 17: identified candidate dates on page
  sections?: OcrDocumentSection[]; // Requirement 20: identified document sections on page
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

  // Requirements 11 & 12: Detailed spatial coordinates and coordinate system
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  coordinateSystem?: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;

  // Requirements 21 & 22: Evidence & Processing Run linkage
  processingRun?: string;
  ocrRunId?: string;
  ocr?: boolean;
  isOcr?: boolean;
  sourceText?: string;
}

/**
 * Authoritative Field Evidence Record (Requirement 21)
 * Every extracted field must be traceable to OCR evidence.
 *
 * Example:
 * Field: Account Number
 * Value: 123456789
 * Document: document-001
 * Page: 1
 * OCR: true
 * Source Text: 123456789
 * Bounding Box: [x, y, w, h]
 * Confidence: 98%
 * Processing Run: ocr-run-001
 */
export interface OcrFieldEvidence<T = string | number | null> {
  field: string;
  fieldKey?: string;
  fieldLabel?: string;
  value: T;
  rawValue?: string;
  document: string;
  documentId?: string;
  page: number;
  pageNumber?: number;
  ocr: boolean;
  isOcr?: boolean;
  sourceText: string;
  boundingBox: OcrBoundingBox;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  coordinateSystem?: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;
  confidence: number;
  confidenceScore?: number;
  confidenceTier?: OcrConfidenceTier;
  processingRun: string;
  ocrRunId?: string;
  extractionMethod?: string;
  extractedAt?: string;
}

// ---------------------------------------------------------------------------
// OCR Processing Run Record (Requirement 22)
// ---------------------------------------------------------------------------

export type OcrProcessingRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIAL";

/**
 * Authoritative OCR Processing Run Record (Requirement 22)
 * Every OCR execution must create a processing run.
 *
 * Stores:
 * OCR run ID
 * document ID
 * page ID
 * provider
 * provider version
 * configuration
 * language
 * preprocessing version
 * start time
 * end time
 * processing duration
 * status
 * error
 * output version
 *
 * This makes OCR reproducible and auditable.
 */
export interface OcrProcessingRun {
  ocrRunId: string;
  documentId: string;
  pageId?: string;
  pageIds?: string[];
  pageRuns?: OcrPageProcessingRun[];
  provider: string;
  providerVersion: string;
  configuration: Record<string, any>;
  language: string;
  preprocessingVersion: string;
  startTime: string;
  endTime: string | null;
  processingDuration: number | null;
  processingDurationMs?: number | null;
  status: OcrProcessingRunStatus;
  error: string | { code?: string; message: string; stack?: string } | null;
  outputVersion: string;

  // Metadata for audit trail & reproducibility
  startedAt?: string;
  completedAt?: string | null;
  totalPages?: number;
  evidenceCount?: number;
  overallConfidence?: number;
  overallConfidenceTier?: OcrConfidenceTier;
  characterCount?: number;
  totalWords?: number;
  totalLines?: number;
  totalTables?: number;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface OcrPageProcessingRun {
  pageRunId: string;
  ocrRunId: string;
  documentId: string;
  pageId: string;
  pageNumber: number;
  provider: string;
  providerVersion: string;
  configuration: Record<string, any>;
  language: string;
  preprocessingVersion: string;
  startTime: string;
  endTime: string | null;
  processingDuration: number | null;
  status: OcrProcessingRunStatus;
  error: string | { code?: string; message: string; stack?: string } | null;
  outputVersion: string;
  characterCount?: number;
  wordCount?: number;
  lineCount?: number;
  tableCount?: number;
  averageConfidence?: number;
  confidenceTier?: OcrConfidenceTier;
}

/**
 * Authoritative response to the question:
 * "Where exactly on the invoice did this value come from?"
 * Bridges the OCR layer to the Document Intelligence evidence model.
 */
export interface OcrEvidenceLocationReport {
  question: "Where exactly on the invoice did this value come from?";
  found: boolean;
  isGrounded: boolean;
  fieldKey: string;
  fieldLabel: string;
  value: string | number | null;
  documentId: string;
  pageNumber: number;
  boundingBox: OcrBoundingBox | null;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  coordinateSystem: CoordinateSystem | null;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    coordinateSystem: CoordinateSystem;
  } | null;
  groundingText: string;
  contextSnippet: string;
  extractionMethod: string;
  confidence: number;
  confidenceTier: OcrConfidenceTier;
  explanation: string;
  evidenceChain: string;
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
  isReliable: boolean; // Requirement 13: strictly false for low-confidence (<70%) or critical error state
  reviewRequired: boolean;
  reviewReasons: string[];
  detectedErrors?: OcrDetectedError[]; // Requirement 14: all detected OCR issues
  tables: OcrTableStructure[];
  candidateDates?: CandidateDateRecognition[]; // Requirement 17: all identified candidate dates across document
  sections?: OcrDocumentSection[]; // Requirement 20: all detected sections across document
  documentStructure?: DocumentStructureAnalysis; // Requirement 20: comprehensive document structure
  multiPageTables?: OcrTableStructure[]; // Requirement 19: multi-page tables continuing across pages
  rawFullText: string;

  // Extracted domain determinants based on category
  invoiceDeterminants?: OcrExtractedInvoiceDeterminants;
  statementDeterminants?: OcrExtractedStatementDeterminants;
  creditNoteDeterminants?: OcrExtractedCreditNoteDeterminants;
  adjustmentDeterminants?: OcrExtractedAdjustmentDeterminants;
  tariffDeterminants?: OcrExtractedTariffDeterminants;
  meterDeterminants?: OcrExtractedMeterDeterminants;

  // Requirement 21: Direct Field Evidence Records Dictionary
  evidenceRecords?: Record<string, OcrFieldEvidence>;
  fieldEvidenceList?: OcrFieldEvidence[];

  // Requirement 22: Authoritative OCR Processing Run Record
  processingRun?: OcrProcessingRun;

  // Execution timing and audit
  executionEngine: "TESSERACT_HYBRID" | "TESSERACT_PURE" | "DIGITAL_FALLBACK";
  startedAt: string;
  completedAt: string;
  durationMs: number;

  // Per-page status tracking (populated during background processing)
  pageStatuses?: PageProcessingStatus[];

  // Language configuration and audit trail for this OCR run
  ocrLanguageConfig?: OcrRunLanguageConfig;
}

// ---------------------------------------------------------------------------
// OCR Error Detection & Audit Types (Requirement 14)
// ---------------------------------------------------------------------------

export type OcrErrorType =
  | "SUBSTITUTION_O_0"
  | "SUBSTITUTION_I_1"
  | "SUBSTITUTION_L_1"
  | "SUBSTITUTION_S_5"
  | "SUBSTITUTION_B_8"
  | "SUBSTITUTION_G_6"
  | "SUBSTITUTION_Z_2"
  | "COMMA_DECIMAL_AMBIGUITY"
  | "DECIMAL_POINT_MISSING"
  | "CURRENCY_SYMBOL_CORRUPTION"
  | "DATE_CORRUPTION"
  | "ACCOUNT_NUMBER_CORRUPTION"
  | "METER_NUMBER_CORRUPTION"
  | "SCALE_SHIFT_DROPPED_DECIMAL"
  | "THOUSANDS_SEPARATOR_CORRUPTION"
  | "POWER_FACTOR_OUT_OF_BOUNDS"
  | "PERCENTAGE_OUT_OF_BOUNDS"
  | "INVALID_UNIT_SPECIFICATION"
  | "NEGATIVE_FORMAT_AMBIGUITY";

export interface OcrDetectedError {
  errorId: string;
  errorType: OcrErrorType;
  /** Exact original text read by OCR. MUST NEVER BE SILENTLY MUTATED! */
  originalOcrValue: string;
  /** Field key if associated with a determinant (e.g. "totalAmountDue", "accountNumber") */
  fieldKey?: string;
  fieldLabel?: string;
  pageNumber: number;
  boundingBox?: OcrBoundingBox;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
    coordinateSystem: CoordinateSystem;
  };
  /** Explanation of the potential error detected */
  potentialError: string;
  /** Result of validation step: why this failed or requires scrutiny */
  validationResult: string;
  /** Unapplied candidate interpretation for human review display only. NEVER silently applied! */
  suggestedCandidate?: string;
  /** Confidence score penalty applied to the extraction (e.g., 25 points) */
  confidencePenalty: number;
  /** Severity level of the issue */
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  /** Whether this issue requires human review */
  reviewRequired: boolean;
}

// ---------------------------------------------------------------------------
// Page Processing Status
// ---------------------------------------------------------------------------

/**
 * Per-page processing lifecycle state.
 *
 * Populated by `PdfPageRasterizer` and threaded through `HybridDocumentProcessor`
 * so callers can track progress without loading all pages at once.
 *
 * Stored alongside OCR results so the UI can show real-time progress and
 * distinguish failed pages from unprocessed pages.
 */
export type PageProcessingState =
  "PENDING" | "RASTERIZING" | "PREPROCESSING" | "OCR" | "DONE" | "FAILED";

export interface PageProcessingStatus {
  /** 1-based page number within the source document. */
  pageNumber: number;
  /** Current processing lifecycle state. */
  state: PageProcessingState;
  /** ISO 8601 timestamp when this page entered the current state. */
  stateEnteredAt: string;
  /** Whether this page required OCR (vs. native digital extraction). */
  requiredOcr: boolean | null;
  /** OCR confidence for this page once DONE, or null while pending. */
  ocrConfidence: number | null;
  /** Error message if state === "FAILED". Null otherwise. */
  errorMessage: string | null;
  /** Preprocessing decisions made for this page (populated after PREPROCESSING). */
  preprocessingDecision?: PreprocessingDecision;
}

// ---------------------------------------------------------------------------
// Preprocessing Decision Record
// ---------------------------------------------------------------------------

/**
 * Audit record of which preprocessing transforms were applied to a page image,
 * and why. Captured once per scanned page and stored alongside OCR evidence.
 *
 * The design principle: transforms are NOT applied blindly. Each is gated on
 * image metrics. This record makes the decision transparent and auditable.
 */
export interface PreprocessingDecision {
  /** Was the image resolution sufficient for OCR without upscaling? */
  resolutionSufficient: boolean;
  /** Input DPI as determined from page geometry. */
  inputDpi: number;
  /** Effective DPI after any resolution normalisation. */
  effectiveDpi: number;
  /** Was grayscale conversion applied? Always true for rasterized pages. */
  grayscaleApplied: boolean;
  /** Was the image detected as inverted (light text on dark background)? */
  inversionDetected: boolean;
  /** Was contrast enhancement applied? (Skipped when contrastRatio >= 0.7) */
  contrastEnhancementApplied: boolean;
  /** Measured contrast ratio before enhancement (Michelson, 0..1). */
  contrastRatioBefore: number;
  /** Was noise reduction applied? (Skipped when image is already clean). */
  noiseReductionApplied: boolean;
  /** Was border cleanup applied? */
  borderCleanupApplied: boolean;
  /** Estimated skew angle in degrees. */
  estimatedSkewDegrees: number;
  /** Was deskew correction applied? (Skipped when |angle| < 0.3°) */
  deskewApplied: boolean;
  /** Was Otsu binarization applied? (Skipped for high-quality digital renders). */
  binarizationApplied: boolean;
  /** Reason binarization was skipped, if applicable. */
  binarizationSkippedReason?: string;
  /** Detected orientation: PORTRAIT or LANDSCAPE */
  orientation: DocumentOrientation;
  /** Detected rotation angle (0, 90, 180, or 270 degrees). */
  detectedRotationDegrees: RotationDegrees;
  /** Applied correction rotation angle (0, 90, 180, or 270 degrees). */
  appliedRotationDegrees: RotationDegrees;
  /** Whether orientation was corrected prior to OCR recognition. */
  orientationCorrectionApplied: boolean;
  /** Confidence in orientation detection (0..100). */
  orientationConfidence?: number;
}

// ---------------------------------------------------------------------------
// OCR Run Language Configuration
// ---------------------------------------------------------------------------

/**
 * Audit record of the language configuration used for an OCR execution run.
 * Preserved alongside document results to prevent unverified assumptions.
 */
export interface OcrRunLanguageConfig {
  /** Language requested by caller, if any. */
  requestedLanguage?: string;
  /** Language detected by automatic language detection, if executed. */
  detectedLanguage?: string;
  /** Confidence score (0..100) of language detection. */
  languageDetectionConfidence?: number;
  /** Actual BCP-47 / ISO 639-2 language code supplied to OCR engine. */
  actualLanguageUsed: string;
  /** Fallback language used when detection is ambiguous or low confidence. */
  fallbackLanguage: string;
  /** Flag indicating whether the fallback language was chosen over detection. */
  isFallbackUsed: boolean;
  /** Human-readable explanation of why this language was selected. */
  selectionReason: string;
  /** List of languages supported in this environment. */
  supportedLanguages: string[];
}

// ---------------------------------------------------------------------------
// Numeric Protection & Decimal Validation Types (Requirements 15 & 16)
// ---------------------------------------------------------------------------

export type NumericFieldCategory =
  | "ACCOUNT_NUMBER"
  | "METER_NUMBER"
  | "INVOICE_NUMBER"
  | "DATE"
  | "KWH"
  | "KVA"
  | "KVAH"
  | "KVARH"
  | "DEMAND"
  | "POWER_FACTOR"
  | "TARIFF"
  | "RATE"
  | "AMOUNT"
  | "VAT"
  | "TOTAL";

export type DecimalSeparatorType = "DOT" | "COMMA" | "NONE" | "AMBIGUOUS";

export type ThousandsSeparatorType =
  | "SPACE"
  | "COMMA"
  | "DOT"
  | "APOSTROPHE"
  | "NONE"
  | "MIXED";

export type NegativeNumberFormat =
  | "LEADING_MINUS"
  | "TRAILING_MINUS"
  | "PARENTHESES"
  | "CREDIT_SUFFIX"
  | "DEBIT_SUFFIX"
  | "NONE";

export interface ScaleShiftDetection {
  detected: boolean;
  shiftFactor?: number; // e.g. 10, 100, 1000, 10000
  originalOcrValue: string;
  candidateCorrectedValue?: string;
  reason: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface DocumentLocaleProfile {
  name: string; // "SOUTH_AFRICA_DEFAULT" | "INTERNATIONAL_ANGLO" | "INTERNATIONAL_CONTINENTAL" | "AUTO_DETECT"
  currencySymbols: string[];
  decimalSeparators: Array<"." | ",">;
  thousandsSeparators: Array<" " | "," | "." | "'">;
  standardVatPercentage?: number;
  dateFormatOrder: "YMD" | "DMY" | "MDY" | "AUTO";
}

export interface ParsedNumericField {
  category: NumericFieldCategory;
  /** Exact original string extracted by OCR (NEVER silently mutated!) */
  originalRaw: string;
  /** Cleaned text representation preserving structure */
  normalizedText: string;
  /** Computed numeric value or null if unparseable/unobserved */
  numericValue: number | null;
  /** Is this a negative number or credit value */
  isNegative: boolean;
  /** The specific negative notation detected */
  negativeFormat: NegativeNumberFormat;
  /** Whether the field specifies a percentage */
  isPercentage: boolean;
  /** Parsed percentage value (e.g. 15 for 15%) */
  percentageValue?: number;
  /** Currency symbol if present (e.g. "R", "ZAR", "$", "€", "£", "c") */
  currencySymbol?: string;
  /** Standard currency ISO code (e.g. "ZAR", "USD", "EUR", "GBP") */
  currencyIsoCode?: string;
  /** Unit of measurement (e.g. "kWh", "kVA", "kVAh", "kVArh", "kW", "c/kWh", "R/kVA", "PF") */
  unit?: string;
  /** Detected decimal separator */
  decimalSeparator: DecimalSeparatorType;
  /** Detected thousands separator */
  thousandsSeparator: ThousandsSeparatorType;
  /** Scale shift detection details */
  scaleShift: ScaleShiftDetection;
  /** Validation errors detected during analysis */
  validationErrors: OcrDetectedError[];
  /** Overall validity flag */
  isValid: boolean;
  /** Confidence score (0..100) after any validation penalties */
  confidenceScore: number;
  /** Confidence tier */
  confidenceTier: OcrConfidenceTier;
  /** Whether this numeric field requires human audit review */
  reviewRequired: boolean;
  /** Specific audit review reasons */
  reviewReasons: string[];
  /** Candidate correction suggestions for human inspection ONLY */
  suggestedCandidate?: string;
}

export interface ValidatedDateField {
  /** Exact original string from OCR (NEVER mutated!) */
  originalRaw: string;
  /** Normalized ISO 8601 date string (YYYY-MM-DD) or null if invalid */
  isoDate: string | null;
  /** Detected format pattern (e.g. "YYYY-MM-DD", "DD/MM/YYYY", "DD MMM YYYY") */
  formatDetected: string;
  /** Regional pattern classification */
  localePattern: "SOUTH_AFRICAN" | "INTERNATIONAL" | "UNKNOWN";
  /** Whether date is calendar-valid (month 1-12, valid days in month, leap years) */
  isValidDate: boolean;
  /** Validation errors */
  validationErrors: OcrDetectedError[];
  /** Whether review is required */
  reviewRequired: boolean;
  /** Suggested candidate for human review */
  suggestedCandidate?: string;
}

// ---------------------------------------------------------------------------
// Document Section & Multi-Format Structural Types (Requirement 20)
// ---------------------------------------------------------------------------

export type DocumentSectionType =
  | "CUSTOMER_INFORMATION"
  | "ACCOUNT_INFORMATION"
  | "METER_INFORMATION"
  | "BILLING_PERIOD"
  | "ENERGY_CHARGES"
  | "DEMAND_CHARGES"
  | "NETWORK_CHARGES"
  | "REACTIVE_ENERGY"
  | "TAX"
  | "TOTAL"
  | "PAYMENT_INFORMATION"
  | "DEPOSIT_INFORMATION"
  | "HISTORICAL_CONSUMPTION"
  | "GENERIC_SECTION";

export type UtilityDocumentFormatVariant =
  | "ESKOM_DIRECT_STANDARD" // Eskom Megaflex, Miniflex, Nightsave
  | "ESKOM_DIRECT_LARGE_POWER" // Large transmission / transmission customer
  | "MUNICIPAL_CITY_POWER_JHB" // City Power / City of Johannesburg
  | "MUNICIPAL_CITY_OF_CAPE_TOWN" // City of Cape Town
  | "MUNICIPAL_ETHEKWINI" // eThekwini (Durban)
  | "MUNICIPAL_TSHWANE" // City of Tshwane (Pretoria)
  | "MUNICIPAL_EKURHULENI" // City of Ekurhuleni
  | "MUNICIPAL_MANGAUNG" // Mangaung (Bloemfontein)
  | "MUNICIPAL_NELSON_MANDELA_BAY" // Nelson Mandela Bay (Gqeberha)
  | "GENERIC_MUNICIPAL" // Generic South African Municipality
  | "UNKNOWN_UTILITY_FORMAT";

export interface OcrDocumentSection {
  sectionId: string;
  sectionType: DocumentSectionType;
  title: string;
  normalizedTitle: string;
  pageNumber: number;
  startLineIndex: number;
  endLineIndex: number;
  boundingBox: OcrBoundingBox;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  coordinateSystem?: CoordinateSystem;
  detailedBoundingBox?: OcrElementBoundingBox;
  confidence: number;
  confidenceTier: OcrConfidenceTier;
  lines: OcrLineBlock[];
  blocks?: OcrLayoutBlock[];
  tables: OcrTableStructure[];
  keyValuePairs: OcrKeyValuePair[];
  rawText: string;
  detectedFormatVariant?: UtilityDocumentFormatVariant;
}

export interface DocumentStructureAnalysis {
  documentId?: string;
  totalPages: number;
  detectedFormatVariant: UtilityDocumentFormatVariant;
  sections: OcrDocumentSection[];
  sectionsByType: Record<DocumentSectionType, OcrDocumentSection[]>;
  customerSection?: OcrDocumentSection;
  accountSection?: OcrDocumentSection;
  meterSection?: OcrDocumentSection;
  billingPeriodSection?: OcrDocumentSection;
  energyChargesSection?: OcrDocumentSection;
  demandChargesSection?: OcrDocumentSection;
  networkChargesSection?: OcrDocumentSection;
  reactiveEnergySection?: OcrDocumentSection;
  taxSection?: OcrDocumentSection;
  totalSection?: OcrDocumentSection;
  readingOrderSections: OcrDocumentSection[];
}

