/**
 * Document Intelligence Domain Types (Foundational Layer)
 * ========================================================
 * Implements the 10-Stage Document Intelligence Architecture:
 * UPLOAD → STORAGE → DOCUMENT REGISTRY → PDF INSPECTION →
 * PAGE EXTRACTION → TEXT EXTRACTION → LAYOUT ANALYSIS →
 * DOCUMENT CLASSIFICATION → EXTRACTION EVIDENCE → OCR/AI HANDOFF
 */

export type BoundingBox = [x: number, y: number, width: number, height: number];

export type CoordinateSystem =
  "PIXEL_SPACE" | "NORMALIZED_0_1" | "NORMALIZED_PERCENT" | "PDF_POINTS";

export interface DetailedElementBoundingBox {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: CoordinateSystem;
  confidence: number;
}

export type DocumentProcessingStage =
  | "UPLOAD"
  | "STORAGE"
  | "DOCUMENT_REGISTRY"
  | "PDF_INSPECTION"
  | "PAGE_EXTRACTION"
  | "TEXT_EXTRACTION"
  | "LAYOUT_ANALYSIS"
  | "DOCUMENT_CLASSIFICATION"
  | "EXTRACTION_EVIDENCE"
  | "OCR_AI_HANDOFF";

export type DocumentLifecycleState =
  | "UPLOADED"
  | "STORED"
  | "INSPECTING"
  | "EXTRACTING"
  | "CLASSIFYING"
  | "READY_FOR_VALIDATION"
  | "FAILED"
  | "REVIEW_REQUIRED"
  | "UNSUPPORTED"
  | "DUPLICATE";

export type DocumentLifecycleStatus = DocumentLifecycleState;

export interface DocumentStateTransition {
  transitionId: string;
  documentId: string;
  organisationId?: string;
  fromState: DocumentLifecycleState | null;
  toState: DocumentLifecycleState;
  timestamp: string;
  triggeredBy: string;
  stage?: DocumentProcessingStage;
  reason?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export type DocumentSourceType = "PDF_DIGITAL" | "PDF_SCANNED" | "PDF_HYBRID" | "IMAGE_RASTER";

export interface DocumentStorageReference {
  storageBucket: string;
  storagePath: string;
  fileHashSha256: string;
  fileSizeBytes: number;
  mimeType: string;
  storedAt: string;
}

export type ExtractionStatus = "PENDING" | "EXTRACTING" | "COMPLETED" | "FAILED" | "SKIPPED";
export type OcrStatus = "NOT_REQUIRED" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ValidationStatus = "PENDING" | "VALID" | "INVALID" | "REVIEW_REQUIRED";
export type ErrorStatus = "NONE" | "WARNING" | "ERROR" | "FATAL";

export interface DocumentRegistryRecord {
  // --- Minimum 21 Foundational Fields (Stage 2 Specification) ---
  documentId: string;
  organisationId: string;
  uploadedBy?: string | null;
  originalFilename: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  detectedFileType: string;
  uploadTimestamp: string;
  processingStatus: DocumentLifecycleState;
  processingStartedTimestamp?: string | null;
  processingCompletedTimestamp?: string | null;
  pageCount: number;
  documentClassification: string;
  extractionStatus: ExtractionStatus;
  ocrStatus: OcrStatus;
  validationStatus: ValidationStatus;
  errorStatus: ErrorStatus;
  checksum: string;
  createdTimestamp: string;
  updatedTimestamp: string;

  // --- Backwards-Compatible Field Aliases & Domain Pipeline Metadata ---
  id?: string;
  filename: string;
  fileHashSha256: string;
  fileSizeBytes: number;
  status: DocumentLifecycleState;
  state: DocumentLifecycleState;
  currentStage: DocumentProcessingStage;
  stageProgressPct: number;
  sourceType: DocumentSourceType;
  storage: DocumentStorageReference;
  stateTransitions: DocumentStateTransition[];
  failureReason?: string;
  reviewReason?: string;
  unsupportedReason?: string;
  errorMessage?: string | null;
  latestProcessingRunId?: string;
  processingRunsCount?: number;
  duplicateAttemptsCount?: number;
  lastDuplicateAttemptAt?: string | null;
  isDuplicate?: boolean;
  duplicateOfDocumentId?: string | null;
  errorCode?: DocumentErrorCode | string | null;
  userMessage?: string | null;
  errorDetails?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  keywords?: string[];
  pdfVersion: string;
}

export type PageOrientation = "PORTRAIT" | "LANDSCAPE";

export type PdfTypeClassification = "TEXT_PDF" | "SCANNED_PDF" | "HYBRID_PDF";

export type DocumentProcessingRoute =
  | "NATIVE_TEXT_LAYOUT" // TEXT PDF: PDF -> Native text extraction -> Layout analysis
  | "PAGE_RENDER_OCR_RECONSTRUCTION"; // SCANNED PDF: PDF -> Page rendering -> OCR -> Text + layout reconstruction

export interface TableInspectionCandidate {
  tableIndex: number;
  pageNumber: number;
  bbox?: BoundingBox;
  title?: string;
  headerKeywords: string[];
  estimatedRowCount: number;
  estimatedColumnCount: number;
  confidence: number;
}

export interface PageInspectionDetail {
  pageNumber: number; // 1-indexed
  dimensions: PageDimensions;
  orientation: PageOrientation;
  rotation: 0 | 90 | 180 | 270;
  hasEmbeddedText: boolean;
  characterCount: number;
  hasImages: boolean;
  imageCount: number;
  appearsScanned: boolean;
  isTextExtractionPossible: boolean;
  isOcrLikelyRequired: boolean;
  detectedTables: TableInspectionCandidate[];
}

export interface PageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  rotation: 0 | 90 | 180 | 270;
  unit?: "pt" | "px" | "mm";
}

export interface PdfInspectionResult {
  // --- Stage 3 Mandated Inspection Properties ---
  pageCount: number; // number of pages
  hasEmbeddedText: boolean; // whether text is embedded
  hasImages: boolean; // whether pages contain images
  imageCount: number; // total image count detected
  appearsScanned: boolean; // whether pages appear scanned
  isTextExtractionPossible: boolean; // whether text extraction is possible
  isOcrLikelyRequired: boolean; // whether OCR is likely required
  metadata: PdfMetadata; // document metadata where available
  pageDimensions: PageDimensions; // primary/first page dimensions
  orientation: PageOrientation; // orientation (PORTRAIT / LANDSCAPE)
  rotation: 0 | 90 | 180 | 270; // page rotation degrees
  detectedTables: TableInspectionCandidate[]; // detected tables where possible
  tableCount: number; // count of detected tables

  // --- Workflow Routing: TEXT PDF vs SCANNED PDF ---
  pdfType: PdfTypeClassification; // TEXT_PDF, SCANNED_PDF, HYBRID_PDF
  processingRoute: DocumentProcessingRoute; // NATIVE_TEXT_LAYOUT or PAGE_RENDER_OCR_RECONSTRUCTION
  workflowSteps: string[]; // Sequential processing steps

  // --- Per-Page Inspection Breakdown ---
  pages: PageInspectionDetail[];

  // --- Backwards Compatibility Aliases & Diagnostics ---
  isScannedLikely: boolean; // alias for appearsScanned
  textExtractionPossible: boolean; // alias for isTextExtractionPossible
  ocrLikelyRequired: boolean; // alias for isOcrLikelyRequired
  pdfVersion: string;
  isEncrypted: boolean;
  fileSizeBytes: number;
  totalCharacterCount: number;
  estimatedTextDensity: number; // characters per page average
  integrityValid: boolean;
  inspectionNotes: string[];
}

export interface ExtractedPage {
  documentId?: string;
  pageNumber: number; // 1-indexed
  dimensions: PageDimensions;
  hasText: boolean;
  isScanned: boolean;
  characterCount: number;
  tokenCount: number;
  rawText: string;
}

export interface ExtractedTextToken {
  text: string;
  bbox: BoundingBox;
  fontSize?: number;
  fontFamily?: string;
  confidence: number;
}

export interface ExtractedTextLine {
  lineNumber: number;
  pageNumber: number;
  text: string;
  bbox: BoundingBox;
  tokens: ExtractedTextToken[];
  confidence: number;
}

export interface ExtractedParagraph {
  paragraphId: string;
  pageNumber: number;
  text: string;
  bbox: BoundingBox;
  lines: ExtractedTextLine[];
  confidence: number;
  indentation: number;
  lineCount: number;
}

export type PageEvidenceEntityType =
  | "NUMERIC_VALUE"
  | "DATE"
  | "ACCOUNT_NUMBER"
  | "METER_NUMBER"
  | "INVOICE_NUMBER"
  | "TARIFF_NAME"
  | "FINANCIAL_VALUE"
  | "UNIT";

export interface PageEvidenceEntity {
  entityId: string;
  entityType: PageEvidenceEntityType;
  rawValue: string;
  normalizedValue: string | number | null;
  pageNumber: number;
  lineNumber: number;
  bbox: BoundingBox;
  contextSnippet: string;
  confidence: number;
  unit?: string;
}

export interface PageTextStructure {
  pageNumber: number;
  dimensions: PageDimensions;
  lines: ExtractedTextLine[];
  paragraphs: ExtractedParagraph[];
  tables: DetectedTable[];
  entities: PageEvidenceEntity[];
  rawText: string;
  characterCount: number;
  wordCount: number;
  tokenCount: number;
  isScanned: boolean;
  hasText: boolean;
}

export interface DocumentTextExtractionResult {
  pages: PageTextStructure[];
  totalPageCount: number;
  allLines: ExtractedTextLine[];
  allParagraphs: ExtractedParagraph[];
  allTables: DetectedTable[];
  allEntities: PageEvidenceEntity[];
  entitiesByType: Record<PageEvidenceEntityType, PageEvidenceEntity[]>;
  extractionMethod: ExtractionMethodType;
  processingTimestamp: string;
}

export type LayoutBlockType =
  "HEADER" | "FOOTER" | "KEY_VALUE_GROUP" | "TABLE" | "PARAGRAPH" | "METRIC_CARD" | "MARGIN_NOTE";

export interface LayoutBlock {
  blockId: string;
  pageNumber: number;
  type: LayoutBlockType;
  bbox: BoundingBox;
  text: string;
  confidence: number;
}

export interface TableCell {
  rowIndex: number;
  colIndex: number;
  text: string;
  bbox: BoundingBox;
  isHeader: boolean;
  confidence: number;
  // Stage 6 Relational additions: Column -> Row -> Cell -> Page -> Source Document
  cellId?: string;
  rowId?: string;
  columnId?: string;
  tableId?: string;
  pageNumber?: number;
  documentId?: string;
  columnHeader?: string;
  normalizedValue?: string | number | null;
  isTotal?: boolean;
  isSpanned?: boolean;
  colSpan?: number;
  rowSpan?: number;
}

export interface TableRow {
  rowIndex: number;
  cells: TableCell[];
  bbox: BoundingBox;
  isHeaderRow: boolean;
  // Stage 6 Relational additions:
  rowId?: string;
  tableId?: string;
  pageNumber?: number;
  documentId?: string;
  isTotalRow?: boolean;
  isSubtotalRow?: boolean;
  isSectionHeaderRow?: boolean;
  rawText?: string;
}

export interface TableColumn {
  colIndex: number;
  headerText: string;
  minX: number;
  maxX: number;
  // Stage 6 Relational additions:
  columnId?: string;
  tableId?: string;
  pageNumber?: number;
  documentId?: string;
  width?: number;
  detectedType?: "TEXT" | "NUMERIC" | "CURRENCY" | "DATE" | "UNIT" | "MIXED";
  alignment?: "LEFT" | "RIGHT" | "CENTER";
}

export type ImperfectLayoutFlag =
  | "BORDERLESS_TABLE"
  | "IRREGULAR_COLUMN_ALIGNMENT"
  | "MULTI_LINE_WRAPPED_CELL"
  | "SPARSE_OR_EMPTY_CELLS"
  | "MERGED_TOTAL_ROW"
  | "EMBEDDED_SUBSECTION_HEADER"
  | "RAGGED_COLUMNS"
  | "SYNTHESIZED_HEADERS";

export interface DetectedTable {
  tableId: string;
  pageNumber: number;
  title?: string;
  bbox: BoundingBox;
  columns: TableColumn[];
  rows: TableRow[];
  confidence: number;
  // Stage 6 Relational & Imperfect Layout additions:
  documentId?: string;
  cells?: TableCell[];
  isImperfect?: boolean;
  imperfectLayoutFlags?: ImperfectLayoutFlag[];
  layoutNotes?: string[];
}

export interface KeyValueProperty {
  propertyKey: string;
  rawLabel: string;
  rawValue: string;
  pageNumber: number;
  keyBbox: BoundingBox;
  valueBbox: BoundingBox;
  confidence: number;
}

export interface HeadingBlock {
  headingId: string;
  pageNumber: number;
  documentId: string;
  text: string;
  level: 1 | 2 | 3;
  bbox: BoundingBox;
  isRepeated?: boolean;
  confidence: number;
}

export interface LayoutParagraph {
  paragraphId: string;
  pageNumber: number;
  documentId: string;
  text: string;
  lines: ExtractedTextLine[];
  bbox: BoundingBox;
  lineCount: number;
  indentation: number;
  confidence: number;
}

export interface LayoutLabel {
  labelId: string;
  pageNumber: number;
  documentId: string;
  text: string;
  normalizedKey: string;
  bbox: BoundingBox;
  associatedValueId?: string;
  confidence: number;
}

export interface LayoutValue {
  valueId: string;
  labelId?: string;
  pageNumber: number;
  documentId: string;
  text: string;
  normalizedValue: string | number | null;
  valueType: "STRING" | "NUMBER" | "DATE" | "CURRENCY";
  bbox: BoundingBox;
  confidence: number;
}

export interface LabelValuePair {
  pairId: string;
  labelId: string;
  valueId: string;
  rawLabel: string;
  rawValue: string;
  normalizedKey: string;
  normalizedValue: string | number | null;
  pageNumber: number;
  documentId: string;
  labelBbox: BoundingBox;
  valueBbox: BoundingBox;
  combinedBbox: BoundingBox;
  alignment: "HORIZONTAL" | "VERTICAL";
  distance: number;
  confidence: number;
}

export interface RepeatedHeader {
  repeatedHeaderId: string;
  text: string;
  normalizedText: string;
  pagesOccurred: number[];
  frequency: number;
  headerType:
    "DOCUMENT_TITLE" | "ORGANISATION_HEADER" | "TABLE_CONTINUATION_HEADER" | "SECTION_HEADER";
  bboxesByPage: Record<number, BoundingBox>;
  confidence: number;
}

export interface FooterBlock {
  footerId: string;
  pageNumber: number;
  documentId: string;
  text: string;
  bbox: BoundingBox;
  isRepeated: boolean;
  confidence: number;
}

export interface PageNumberIndicator {
  pageNumberId: string;
  pageNumber: number;
  documentId: string;
  rawText: string;
  currentPageNumber: number;
  totalPages?: number;
  bbox: BoundingBox;
  confidence: number;
}

export type LayoutTotalType =
  | "SUBTOTAL"
  | "VAT"
  | "TOTAL_DUE"
  | "CURRENT_CHARGES"
  | "BALANCE_BROUGHT_FORWARD"
  | "ENERGY_TOTAL"
  | "OTHER";

export interface LayoutTotal {
  totalId: string;
  pageNumber: number;
  documentId: string;
  label: string;
  rawAmount: string;
  numericAmount: number;
  currency: string;
  isCredit: boolean;
  totalType: LayoutTotalType;
  bbox: BoundingBox;
  sourceRowId?: string;
  sourceTableId?: string;
  confidence: number;
}

export type LayoutSectionType =
  | "HEADER_SECTION"
  | "ACCOUNT_DETAILS"
  | "METER_READINGS"
  | "ENERGY_CHARGES"
  | "NETWORK_CHARGES"
  | "LEVIES_TAXES"
  | "TOTALS_SUMMARY"
  | "PAYMENT_ADVICE"
  | "FOOTER_SECTION"
  | "GENERAL_SECTION";

export interface LayoutSection {
  sectionId: string;
  documentId: string;
  pageNumber: number;
  sectionType: LayoutSectionType;
  title: string;
  bbox: BoundingBox;
  containedElementIds: string[];
  confidence: number;
}

export interface PageLayoutRepresentation {
  pageNumber: number;
  documentId: string;
  headings: HeadingBlock[];
  paragraphs: LayoutParagraph[];
  tables: DetectedTable[];
  labels: LayoutLabel[];
  values: LayoutValue[];
  labelValuePairs: LabelValuePair[];
  repeatedHeaders: RepeatedHeader[];
  footers: FooterBlock[];
  pageNumbers: PageNumberIndicator[];
  totals: LayoutTotal[];
  sections: LayoutSection[];
  blocks: LayoutBlock[];
}

export interface DocumentLayoutRepresentation {
  documentId: string;
  totalPages: number;
  headings: HeadingBlock[];
  paragraphs: LayoutParagraph[];
  tables: DetectedTable[];
  labels: LayoutLabel[];
  values: LayoutValue[];
  labelValuePairs: LabelValuePair[];
  repeatedHeaders: RepeatedHeader[];
  footers: FooterBlock[];
  pageNumbers: PageNumberIndicator[];
  totals: LayoutTotal[];
  sections: LayoutSection[];
  pages: PageLayoutRepresentation[];
  tableRelationshipSummary: {
    totalTables: number;
    totalRows: number;
    totalColumns: number;
    totalCells: number;
    imperfectTableCount: number;
  };
  processingTimestamp: string;
}

export interface PageLayoutAnalysis {
  pageNumber: number;
  documentId?: string;
  blocks: LayoutBlock[];
  tables: DetectedTable[];
  keyValues: KeyValueProperty[];
  // Stage 6 additions:
  headings?: HeadingBlock[];
  paragraphs?: LayoutParagraph[];
  labels?: LayoutLabel[];
  values?: LayoutValue[];
  labelValuePairs?: LabelValuePair[];
  repeatedHeaders?: RepeatedHeader[];
  footers?: FooterBlock[];
  pageNumbers?: PageNumberIndicator[];
  totals?: LayoutTotal[];
  sections?: LayoutSection[];
}

export type ClassificationConfidenceLevel =
  "HIGH_CONFIDENCE" | "MEDIUM_CONFIDENCE" | "LOW_CONFIDENCE" | "UNKNOWN";

export type StandardDocumentCategory =
  | "UTILITY_INVOICE"
  | "UTILITY_STATEMENT"
  | "METER_DATA"
  | "TARIFF_DOCUMENT"
  | "CREDIT_NOTE"
  | "ADJUSTMENT"
  | "PAYMENT_DOCUMENT"
  | "OTHER"
  | "UNKNOWN";

export type DocumentCategory =
  | StandardDocumentCategory
  // Legacy / sub-category aliases for backward compatibility:
  | "ESKOM_MEGAFLEX_INVOICE"
  | "ESKOM_MINIFLEX_INVOICE"
  | "ESKOM_NIGHTSAVE_INVOICE"
  | "ESKOM_RURAFLEX_INVOICE"
  | "MUNICIPAL_ELECTRICITY_INVOICE"
  | "AMR_INTERVAL_REPORT"
  | "UNKNOWN_UTILITY_DOCUMENT";

export type PageSectionClassification =
  | "PAGE_TAX_INVOICE_HEADER"
  | "PAGE_ACCOUNT_SUMMARY"
  | "PAGE_METER_READING_SCHEDULE"
  | "PAGE_LINE_ITEM_BREAKDOWN"
  | "PAGE_ENVIRONMENT_RENEWABLE_LEVY"
  | "PAGE_ANNEXURE_REMITTANCE"
  | "PAGE_UNKNOWN";

export interface PageClassificationRecord {
  pageNumber: number;
  classification: PageSectionClassification;
  confidence: number;
  matchedSignatures: string[];
}

export interface DocumentClassificationResult {
  category: DocumentCategory;
  standardCategory: StandardDocumentCategory;
  subCategory?: string;
  confidenceLevel: ClassificationConfidenceLevel;
  confidence: number;
  tariffName: string;
  isDeterministic: boolean;
  deterministicIndicators: string[];
  rationale: string[];
  pageClassifications: PageClassificationRecord[];
}

export type ExtractionMethodType =
  | "PDF_TEXT_STREAM"
  | "PDFJS_VIEWPORT"
  | "TESSERACT_OCR"
  | "LAYOUT_TABLE_CELL"
  | "KEY_VALUE_PAIR"
  | "SYNTACTIC_REGEX"
  | "HYBRID"
  | "FALLBACK_STREAM";

export interface PageRegistryRecord {
  // --- Stage 4 Mandated Properties ---
  id?: string;
  documentId: string; // Traceable back to parent document
  organisationId?: string;
  pageNumber: number; // 1-indexed page number
  dimensions: PageDimensions; // page dimensions (width, height, aspect_ratio, rotation, unit)
  extractedText: string; // extracted text
  extractionMethod: ExtractionMethodType; // extraction method
  ocrRequired: boolean; // whether OCR is required for this page
  ocrStatus: OcrStatus; // OCR status (NOT_REQUIRED, QUEUED, PROCESSING, COMPLETED, FAILED)
  processingTimestamp: string; // processing timestamp
  layoutInformation: PageLayoutAnalysis | Record<string, any>; // layout information
  extractionConfidence: number; // extraction confidence (0.0 to 1.0)

  // Additional Audit & Provenance Fields
  characterCount?: number;
  tokenCount?: number;
  hasText?: boolean;
  hasImages?: boolean;
  imageCount?: number;
  isScanned?: boolean;
  orientation?: PageOrientation;
  detectedTables?: DetectedTable[];
  keyValues?: KeyValueProperty[];
  layoutBlocks?: LayoutBlock[];
  pageHashSha256?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageValueOrigin {
  documentId: string;
  pageNumber: number;
  fieldKey: string;
  matchedText: string;
  extractionMethod: ExtractionMethodType;
  confidence: number;
  bbox?: BoundingBox;
  contextSnippet?: string;
  dimensions: PageDimensions;
  processingTimestamp: string;
}

export interface ExtractionEvidenceItem {
  evidenceId: string;
  documentId?: string;
  fieldKey: string;
  fieldLabel: string;
  rawValue: string;
  normalizedValue: string | number | null;
  unit: string;
  pageNumber: number;
  bbox: BoundingBox;
  contextSnippet: string;
  confidence: number;
  method: ExtractionMethodType;
}

// =========================================================================
// STAGE 8: DOCUMENT EVIDENCE MODEL & PROVENANCE TYPES
// =========================================================================

export type ProvenanceExtractionMethod =
  | "Native PDF text"
  | "PDF_TEXT_STREAM"
  | "PDFJS_VIEWPORT"
  | "Tesseract OCR"
  | "TESSERACT_OCR"
  | "Layout Table Cell"
  | "LAYOUT_TABLE_CELL"
  | "Key-Value Pair"
  | "KEY_VALUE_PAIR"
  | "Syntactic Regex"
  | "SYNTACTIC_REGEX"
  | "AI Grounded Extraction"
  | "HYBRID";

export type ProvenanceConfidenceTier =
  "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" | ClassificationConfidenceLevel;

export interface FieldProvenanceRef {
  /** Document ID (e.g., 'INV-001' or canonical UUID) */
  documentId: string;
  /** 1-indexed page number */
  pageNumber: number;
  /** Spatial bounding box [minX, minY, width, height] */
  region: BoundingBox;
  /** Exact textual content extracted within the region */
  regionText: string;
  /** Surrounding textual context snippet for visual inspection */
  contextSnippet?: string;
  /** Extraction method identifier */
  extractionMethod: ProvenanceExtractionMethod;
  /** Human-readable extraction method label (e.g., 'Native PDF text') */
  extractionMethodLabel: string;
  /** Authoritative numeric confidence score (0.0 to 1.0) */
  confidenceScore: number;
  /** Confidence classification tier */
  confidenceLevel: ProvenanceConfidenceTier;
  /** Timestamp when evidence was captured */
  extractedAt: string;
  /** Processing run ID that captured this evidence item */
  runId?: string;
  /** Extraction logic version that captured this evidence item */
  extractionVersion?: string;
  /** Coordinate system of spatial bounds */
  coordinateSystem?: CoordinateSystem;
  /** Explicit element bounding box including page, coordinates, and coordinate system */
  detailedBoundingBox?: DetailedElementBoundingBox;
}

export interface ProvenancedField<T = string | number | null> {
  /** Canonical field key (e.g., 'account_number', 'total_amount_due') */
  fieldKey: string;
  /** Human-readable field label (e.g., 'Account Number') */
  fieldLabel: string;
  /** Normalized value (e.g., '123456789' or 2268199.63) */
  value: T;
  /** Raw unparsed textual value from the document */
  rawValue: string;
  /** Unit of measure (e.g., 'kWh', 'kVA', 'ZAR', etc.) */
  unit?: string;
  /** Direct link to document reference */
  document: string;
  /** Direct link to 1-indexed page number */
  page: number;
  /** Direct link to extraction method */
  extraction: string;
  /** Direct link to confidence tier */
  confidence: ProvenanceConfidenceTier;
  /** Complete atomic provenance link */
  provenance: FieldProvenanceRef;
  /** Processing run ID that generated this field */
  runId?: string;
  /** Extraction version that generated this field */
  extractionVersion?: string;
  /** Whether this field has been verified by reviewer or validation rule */
  isVerified?: boolean;
}

export interface ProvenanceTraceSummary {
  field: string;
  value: string | number | null;
  document: string;
  page: number;
  extraction: string;
  confidence: string;
  region?: BoundingBox;
  text?: string;
}

export interface ProvenanceValidationResult {
  isValid: boolean;
  fieldKey: string;
  errors: string[];
  warnings: string[];
  provenanceChain?: {
    document: string;
    page: number;
    region: BoundingBox;
    text: string;
    extraction: string;
    value: any;
    confidence: string;
  };
}

export interface ProvenanceEnforcementResult {
  hasValidProvenance: boolean;
  isValid: boolean;
  provenancedFieldsCount: number;
  provenancedCount: number;
  rejectedFieldsCount: number;
  rejectedCount: number;
  rejectedFields: Array<{ fieldKey: string; reason: string }>;
  rejectedClaims: Array<{ fieldKey: string; reason: string; details?: string }>;
  verifiedFields: ProvenancedField[];
  provenancedFields: Record<string, ProvenancedField>;
}

export interface DocumentEvidencePackage {
  documentId: string;
  organisationId?: string;
  totalFieldsCount: number;
  provenancedFields: Record<string, ProvenancedField>;
  unprovenancedClaims: string[];
  provenanceIntegrity: "PROVENANCED" | "PARTIALLY_PROVENANCED" | "UNPROVENANCED_REJECTED";
  overallConfidence: number;
  compiledAt: string;
}

export interface OcrHandoffPlan {
  needsOcr: boolean;
  scannedPageIndices: number[]; // 1-based page numbers
  reason: string;
  recommendedEngine: "TESSERACT_OCR" | "NATIVE_PDF_TEXT_PASSTHROUGH";
}

export interface AiValidationDeterminantExtraction {
  accountNumber?: string;
  invoiceNumber?: string;
  customerName?: string;
  premiseId?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  tariffName?: string;
  meterNumber?: string;
  peakKwh?: number | null;
  standardKwh?: number | null;
  offPeakKwh?: number | null;
  totalKwh?: number | null;
  maximumDemandKva?: number | null;
  reactiveEnergyKvarh?: number | null;
  subtotalAmountZar?: number | null;
  vatAmountZar?: number | null;
  totalInvoiceAmountZar?: number | null;
}

export interface AiValidationLineItemExtraction {
  lineNumber: number;
  chargeLabel: string;
  chargeCode?: string;
  rate?: number | null;
  quantity?: number | null;
  unitOfMeasure?: string;
  invoicedAmount: number;
  pageNumber: number;
}

export interface AiValidationPayload {
  documentId: string;
  category: DocumentCategory;
  determinants: AiValidationDeterminantExtraction;
  lineItems: AiValidationLineItemExtraction[];
  evidenceCount: number;
  readyForValidation: boolean;
  preliminaryAnomalies: string[];
}

export interface DocumentIntelligencePackage {
  document: DocumentRegistryRecord;
  lifecycleState: DocumentLifecycleState;
  stateTransitions: DocumentStateTransition[];
  inspection: PdfInspectionResult;
  pages: ExtractedPage[];
  pageRegistry?: PageRegistryRecord[];
  textLines: ExtractedTextLine[];
  structuredText?: DocumentTextExtractionResult;
  layouts: PageLayoutAnalysis[];
  layoutRepresentation?: DocumentLayoutRepresentation;
  classification: DocumentClassificationResult;
  evidence: ExtractionEvidenceItem[];
  provenancedFields?: Record<string, ProvenancedField>;
  evidencePackage?: DocumentEvidencePackage;
  currentRun?: DocumentExtractionRun;
  runHistory?: DocumentExtractionRun[];
  handoff: {
    ocrPlan: OcrHandoffPlan;
    aiValidationPayload: AiValidationPayload;
    unifiedExtraction?: any;
    aiStructuredPackage?: any;
  };
  processingTimestamp: string;
  processingDurationMs: number;

  // Stage 10 Idempotency & Duplicate fields
  isDuplicate?: boolean;
  duplicateOfDocumentId?: string;
  duplicateEvaluation?: DuplicateEvaluationResult;
  financialRecordsSuppressed?: boolean;
  duplicateAuditRecord?: DuplicateAuditRecord;
  referencedExistingDocument?: DocumentRegistryRecord;

  // Stage 11 Explicit Error Handling fields
  error?: DocumentErrorRecord;
  isFailed?: boolean;
}

// =========================================================================
// STAGE 9 — EXTRACTION RUNS DOMAIN TYPES
// =========================================================================

export type ExtractionRunStatus =
  "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "PARTIAL";

export interface DocumentExtractionRun {
  /** Processing run ID (run_id) */
  runId: string;
  /** Exact user prompt property alias */
  processingRunId: string;
  /** Parent Document ID */
  documentId: string;
  /** Tenant Organisation ID */
  organisationId: string;
  /** Extraction algorithm/engine version (e.g. '1.0.0', '1.2.0') */
  extractionVersion: string;
  /** Extraction method applied (e.g. 'NATIVE_PDF_TEXT', 'TESSERACT_OCR', 'HYBRID_RECONSTRUCTION') */
  extractionMethod: string;
  /** Run start timestamp (ISO 8601 string) */
  started: string;
  /** Alias for started */
  startedAt: string;
  /** Run completion timestamp (ISO 8601 string | null) */
  completed: string | null;
  /** Alias for completed */
  completedAt: string | null;
  /** Run execution status */
  status: ExtractionRunStatus;
  /** Errors or failure diagnostics encountered during this run */
  errors: string[];
  /** Processing duration in milliseconds */
  processingDuration: number | null;
  /** Alias for processingDuration */
  processingDurationMs: number | null;
  /** Number of pages processed in this run */
  pagesProcessed: number;
  /** Count of grounded evidence items produced */
  evidenceCount?: number;
  /** Whether this is currently the active / latest run */
  isLatestRun?: boolean;
  /** Trigger origin: INITIAL_UPLOAD, MANUAL_REPROCESS, ALGORITHM_UPGRADE, etc. */
  triggeredBy?: string;
  /** Snapshot of provenanced fields extracted during this specific run */
  extractedFieldsSnapshot?: Record<string, ProvenancedField>;
  /** Run diagnostics & engine metadata */
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface StartExtractionRunOptions {
  runId?: string;
  documentId: string;
  organisationId?: string;
  extractionVersion?: string;
  extractionMethod?: string;
  triggeredBy?: string;
  metadata?: Record<string, any>;
}

export interface CompleteExtractionRunOptions {
  pagesProcessed: number;
  evidenceCount?: number;
  extractedFields?: Record<string, ProvenancedField>;
  metadata?: Record<string, any>;
  errors?: string[];
  status?: ExtractionRunStatus;
}

export interface ReprocessDocumentOptions {
  documentId: string;
  organisationId?: string;
  newExtractionVersion?: string;
  preferredMethod?: string;
  forceOcr?: boolean;
  reason?: string;
  triggeredBy?: string;
}

export interface RunComparisonDiff {
  runIdA: string;
  runIdB: string;
  versionA: string;
  versionB: string;
  addedFields: string[];
  removedFields: string[];
  modifiedFields: Array<{
    fieldKey: string;
    valueA: any;
    valueB: any;
    confidenceA: string;
    confidenceB: string;
  }>;
  durationDeltaMs: number;
  pagesProcessedDiff: number;
}

// =========================================================================
// STAGE 10 — IDEMPOTENCY AND DUPLICATE DETECTION DOMAIN TYPES
// =========================================================================

export type DuplicateMatchCriteria = "EXACT_CHECKSUM_HASH" | "SEMANTIC_INVOICE_METADATA" | "NONE";

export interface DuplicateCheckInput {
  bytes?: Uint8Array;
  checksum?: string;
  filename: string;
  organisationId: string;
  userId?: string | null;
  fileSizeBytes?: number;
  mimeType?: string;
  // Optional semantic fields
  accountNumber?: string;
  invoiceNumber?: string;
  billingPeriod?: string;
}

export interface DuplicateEvaluationResult {
  isDuplicate: boolean;
  matchCriteria: DuplicateMatchCriteria;
  checksum: string;
  existingDocumentId?: string;
  existingDocument?: DocumentRegistryRecord | null;
  attemptedFilename: string;
  originalFilename?: string;
  matchedOnChecksum: boolean;
  suppressFinancialRecordCreation: boolean;
  message: string;
  actionTaken: "REFERENCED_EXISTING_DOCUMENT" | "PROCEED_NEW";
  detectedAt: string;
  auditRecord?: DuplicateAuditRecord;
}

export interface DuplicateAttemptInput {
  organisationId: string;
  originalDocumentId: string;
  attemptedFilename: string;
  attemptedBy?: string | null;
  checksum: string;
  fileSizeBytes: number;
  suppressFinancialRecordCreation?: boolean;
  actionTaken?: string;
  metadata?: Record<string, any>;
}

export interface DuplicateAuditRecord {
  id: string;
  auditId: string;
  organisationId: string;
  originalDocumentId: string;
  attemptedFilename: string;
  attemptedBy?: string | null;
  checksum: string;
  fileSizeBytes: number;
  attemptedAt: string;
  actionTaken: string;
  financialRecordsSuppressed: boolean;
  metadata?: Record<string, any>;
}

// =========================================================================
// STAGE 11 — EXPLICIT ERROR HANDLING DOMAIN TYPES
// =========================================================================

export type DocumentErrorCode =
  | "PDF_CORRUPTED"
  | "PDF_PASSWORD_PROTECTED"
  | "UNSUPPORTED_FORMAT"
  | "TEXT_EXTRACTION_FAILED"
  | "LAYOUT_EXTRACTION_FAILED"
  | "PAGE_PROCESSING_FAILED"
  | "DOCUMENT_CLASSIFICATION_FAILED"
  | "STORAGE_ERROR"
  | "DATABASE_ERROR"
  | "UNKNOWN_PROCESSING_ERROR"
  // Stage 12 Security Error Codes
  | "AUTHENTICATION_REQUIRED"
  | "UNAUTHORIZED_TENANT_ACCESS"
  | "UNAUTHORIZED_DOCUMENT_ACCESS"
  | "PATH_TRAVERSAL_DETECTED"
  | "MIME_TYPE_SPOOFED"
  | "INVALID_FILE_SIGNATURE"
  | "MALICIOUS_PAYLOAD_DETECTED"
  | "SECRET_LEAKAGE_DETECTED";

// =========================================================================
// STAGE 12 — SECURITY DOMAIN TYPES
// =========================================================================

export type DocumentAccessAction = "READ" | "PROCESS" | "MUTATE" | "DELETE" | "DOWNLOAD";

export interface FileSignatureVerificationResult {
  isValid: boolean;
  detectedMimeType: string;
  signatureDescription: string;
  isExecutable: boolean;
  isPdf: boolean;
  hasEofMarker?: boolean;
  errors: string[];
  warnings: string[];
}

export interface DocumentPathValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  storagePath: string;
  errors: string[];
  warnings: string[];
}

export interface SecretLeakageAuditResult {
  isSecure: boolean;
  violations: string[];
  details: string;
}

export interface DocumentSecurityValidationResult {
  isSecure: boolean;
  sanitizedFilename: string;
  storagePath: string;
  detectedMimeType: string;
  errors: string[];
  warnings: string[];
}

export interface DocumentErrorRecord {
  id: string;
  documentId: string;
  organisationId: string;
  stage: DocumentProcessingStage;
  errorCode: DocumentErrorCode;
  errorMessage: string;
  userMessage: string;
  details?: Record<string, any>;
  stackTrace?: string;
  isFatal: boolean;
  createdAt: string;
}

export interface RecordErrorInput {
  documentId: string;
  organisationId: string;
  stage: DocumentProcessingStage;
  errorCode: DocumentErrorCode;
  errorMessage: string;
  userMessage?: string;
  details?: Record<string, any>;
  stackTrace?: string;
  isFatal?: boolean;
}

export type {
  PersistedDeterminantField,
  PersistedFinancialDeterminants,
  PersistedDocumentIntelligenceRecord,
  PersistedDocumentPage,
} from "./persistentDocumentIntelligenceService";
