/**
 * Document Intelligence Domain Types (Foundational Layer)
 * ========================================================
 * Implements the 10-Stage Document Intelligence Architecture:
 * UPLOAD → STORAGE → DOCUMENT REGISTRY → PDF INSPECTION →
 * PAGE EXTRACTION → TEXT EXTRACTION → LAYOUT ANALYSIS →
 * DOCUMENT CLASSIFICATION → EXTRACTION EVIDENCE → OCR/AI HANDOFF
 */

export type BoundingBox = [x: number, y: number, width: number, height: number];

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

export type DocumentLifecycleStatus =
  | "REGISTERED"
  | "INSPECTED"
  | "PAGES_EXTRACTED"
  | "TEXT_EXTRACTED"
  | "LAYOUT_ANALYZED"
  | "CLASSIFIED"
  | "EVIDENCE_PREPARED"
  | "READY_FOR_OCR_AI"
  | "FAILED";

export type DocumentSourceType = "PDF_DIGITAL" | "PDF_SCANNED" | "PDF_HYBRID" | "IMAGE_RASTER";

export interface DocumentStorageReference {
  storageBucket: string;
  storagePath: string;
  fileHashSha256: string;
  fileSizeBytes: number;
  mimeType: string;
  storedAt: string;
}

export interface DocumentRegistryRecord {
  documentId: string;
  organisationId: string;
  filename: string;
  fileHashSha256: string;
  fileSizeBytes: number;
  mimeType: string;
  status: DocumentLifecycleStatus;
  currentStage: DocumentProcessingStage;
  stageProgressPct: number;
  sourceType: DocumentSourceType;
  storage: DocumentStorageReference;
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
  pdfVersion: string;
}

export interface PdfInspectionResult {
  pdfVersion: string;
  isEncrypted: boolean;
  pageCount: number;
  fileSizeBytes: number;
  hasEmbeddedText: boolean;
  isScannedLikely: boolean;
  totalCharacterCount: number;
  estimatedTextDensity: number; // characters per page average
  metadata: PdfMetadata;
  integrityValid: boolean;
  inspectionNotes: string[];
}

export interface PageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface ExtractedPage {
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

export type LayoutBlockType =
  | "HEADER"
  | "FOOTER"
  | "KEY_VALUE_GROUP"
  | "TABLE"
  | "PARAGRAPH"
  | "METRIC_CARD"
  | "MARGIN_NOTE";

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
}

export interface TableRow {
  rowIndex: number;
  cells: TableCell[];
  bbox: BoundingBox;
  isHeaderRow: boolean;
}

export interface TableColumn {
  colIndex: number;
  headerText: string;
  minX: number;
  maxX: number;
}

export interface DetectedTable {
  tableId: string;
  pageNumber: number;
  title?: string;
  bbox: BoundingBox;
  columns: TableColumn[];
  rows: TableRow[];
  confidence: number;
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

export interface PageLayoutAnalysis {
  pageNumber: number;
  blocks: LayoutBlock[];
  tables: DetectedTable[];
  keyValues: KeyValueProperty[];
}

export type DocumentCategory =
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
  tariffName: string;
  confidence: number;
  rationale: string[];
  pageClassifications: PageClassificationRecord[];
}

export type ExtractionMethodType =
  | "PDF_TEXT_STREAM"
  | "LAYOUT_TABLE_CELL"
  | "KEY_VALUE_PAIR"
  | "SYNTACTIC_REGEX"
  | "FALLBACK_STREAM";

export interface ExtractionEvidenceItem {
  evidenceId: string;
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
  inspection: PdfInspectionResult;
  pages: ExtractedPage[];
  textLines: ExtractedTextLine[];
  layouts: PageLayoutAnalysis[];
  classification: DocumentClassificationResult;
  evidence: ExtractionEvidenceItem[];
  handoff: {
    ocrPlan: OcrHandoffPlan;
    aiValidationPayload: AiValidationPayload;
  };
  processingTimestamp: string;
  processingDurationMs: number;
}
