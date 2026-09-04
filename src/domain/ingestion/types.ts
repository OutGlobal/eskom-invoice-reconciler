/**
 * Enterprise Secure Document & Telemetry Ingestion Gateway Domain Types
 */

export type SupportedFileExtension = "pdf" | "csv" | "xls" | "xlsx" | "xml";

export type IngestionDocumentType =
  "INVOICE_PDF" | "AMR_TELEMETRY_CSV" | "AMR_TELEMETRY_XLSX" | "TELEMETRY_XML" | "MUNICIPAL_BILL";

export type IngestionLifecycleState =
  | "UPLOADED"
  | "PROCESSING"
  | "PARSED"
  | "VALIDATED"
  | "NORMALIZED"
  | "READY"
  | "FAILED"
  | "QUARANTINED"
  | "REVIEW_REQUIRED";

export interface FileMetadataHeader {
  documentId: string;
  filename: string;
  fileSizeBytes: number;
  detectedMimeType: string;
  fileExtension: SupportedFileExtension | string;
  sha256Checksum: string;
  uploaderId?: string;
  organisationId: string;
  uploadedAt: string;
  isDuplicate: boolean;
  duplicateOfDocumentId?: string;
}

export interface ExtractedInvoiceFields {
  accountNumber: string;
  pod: string;
  premiseId: string;
  meterNumber: string;
  meterSerial: string;
  billingPeriod: string;
  billingStart?: string;
  billingEnd?: string;
  invoiceDate: string;
  dueDate?: string;
  tariff: string;
  voltage: string;
  notifiedMaximumDemand: number;
  billedMaximumDemand: number;
  utilisedCapacity: number;
  peakKwh: number;
  standardKwh: number;
  offPeakKwh: number;
  totalKwh: number;
  kva: number;
  kvarh: number;
  powerFactor: number;
  energyCharges: number;
  demandCharges: number;
  networkCharges: number;
  serviceCharges: number;
  ancillaryCharges: number;
  subsidies: number;
  vat: number;
  totalInvoice: number;
  previousBalance: number;
  payments: number;
  adjustments: number;
  credits: number;
  debits: number;
}

export interface ExtractionPageInfo {
  pageNumber: number;
  boundingPoly?: { x: number; y: number; width: number; height: number };
  rawSnippetText: string;
}

export interface ExtractedFieldDetail<T = any> {
  value: T;
  confidence: number; // 0.0 to 1.0
  sourcePageInfo?: ExtractionPageInfo;
  needsReview: boolean;
  ambiguityReason?: string;
}

export type StructuredExtractedInvoice = {
  [K in keyof ExtractedInvoiceFields]: ExtractedFieldDetail<ExtractedInvoiceFields[K]>;
};

export interface IngestionBatchJob {
  batchId: string;
  jobId: string;
  documentId: string;
  documentType: IngestionDocumentType;
  state: IngestionLifecycleState;
  overallConfidenceScore: number; // 0.00 to 1.00
  processingDurationMs: number;
  rowsSeen: number;
  rowsImported: number;
  rowsRejected: number;
  rowsDuplicate: number;
  errorCount: number;
  logs: Array<{
    stage: string;
    level: "info" | "warn" | "error";
    message: string;
    timestamp: string;
  }>;
  quarantineReason?: string;
  createdRecordId?: string;
}

export interface IngestionErrorRecord {
  id: string;
  jobId: string;
  rowNumber?: number;
  columnName?: string;
  rawValue?: string;
  errorCode: string;
  errorMessage: string;
  severity: "critical" | "major" | "minor" | "warning";
  timestamp: string;
}

export interface IngestionGatewayResult {
  success: boolean;
  fileHeader: FileMetadataHeader;
  batchJob: IngestionBatchJob;
  extractedInvoice?: ExtractedInvoiceFields;
  rawExtractionText?: string;
  confidenceScore: number;
  errors: IngestionErrorRecord[];
  signedDownloadUrl?: string;
  isIdempotentDuplicate: boolean;
}
