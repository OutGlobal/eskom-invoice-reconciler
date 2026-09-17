/**
 * Enterprise Secure Document & Telemetry Ingestion Gateway Domain Types
 */

import type { DuplicateCheckResult, DuplicateHandlingStatus } from "./duplicateTypes";

export type SupportedFileExtension =
  "pdf" | "csv" | "xls" | "xlsx" | "xml" | "log" | "txt" | "tsv" | "json" | "tariff";

export type IngestionDocumentType =
  | "INVOICE_PDF"
  | "AMR_TELEMETRY_CSV"
  | "AMR_TELEMETRY_XLSX"
  | "TELEMETRY_XML"
  | "MUNICIPAL_BILL"
  | "RAW_METER_LOG"
  | "TARIFF_DOCUMENT"
  | "METER_EXPORT";

export type IngestionLifecycleState =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "PARTIALLY_PROCESSED"
  | "PARSED"
  | "NORMALIZED"
  | "READY"
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
  duplicateStatus?: DuplicateHandlingStatus;
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
  openingReading?: number | null;
  closingReading?: number | null;
  notifiedMaximumDemand?: number | null;
  billedMaximumDemand?: number | null;
  utilisedCapacity?: number | null;
  peakKwh?: number | null;
  standardKwh?: number | null;
  offPeakKwh?: number | null;
  totalKwh?: number | null;
  kva?: number | null;
  kvarh?: number | null;
  powerFactor?: number | null;
  energyCharges?: number | null;
  demandCharges?: number | null;
  networkCharges?: number | null;
  serviceCharges?: number | null;
  ancillaryCharges?: number | null;
  subsidies?: number | null;
  vat?: number | null;
  totalInvoice: number;
  previousBalance?: number | null;
  payments?: number | null;
  adjustments?: number | null;
  credits?: number | null;
  debits?: number | null;
  lineItems?: Array<{
    lineItemNumber: number;
    chargeCode?: string;
    chargeLabel: string;
    rate?: number | null;
    quantity?: number | null;
    unitOfMeasure?: string;
    invoicedAmount: number;
  }>;
  missingFields?: string[];
  customerId?: string;
  siteId?: string;
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

export interface IngestionAuditLogEntry {
  stage: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
}

export interface IngestionBatchJob {
  batchId: string;
  jobId: string;
  documentId: string;
  documentType: SupportedFileExtension | IngestionDocumentType | "UNKNOWN";
  state: IngestionLifecycleState;
  overallConfidenceScore: number; // 0.00 to 1.00
  processingDurationMs: number;
  rowsSeen: number;
  rowsImported: number;
  rowsRejected: number;
  rowsDuplicate: number;
  errorCount: number;
  logs: IngestionAuditLogEntry[];
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
  intervals?: any[];
  intervalSummary?: import("../telemetry/types").IntervalProcessingSummary;
  rawExtractionText?: string;
  confidenceScore: number;
  errors: IngestionErrorRecord[];
  logs?: IngestionAuditLogEntry[];
  signedDownloadUrl?: string;
  isIdempotentDuplicate: boolean;
  duplicateResult?: DuplicateCheckResult;
  uploadRecord?: import("../upload/types").UploadRecord;
}
