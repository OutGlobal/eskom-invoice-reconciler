/**
 * Enterprise Upload & Ingestion Pipeline Domain Types
 * Defines data structures for persistent upload records, lifecycle states,
 * and utility data sources.
 */

export type UploadProcessingStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "PARTIALLY_PROCESSED";

export type UploadFileType =
  | "PDF_INVOICE"
  | "CSV_INTERVAL_DATA"
  | "EXCEL_WORKBOOK"
  | "METER_EXPORT"
  | "AMR_DATA"
  | "RAW_METER_LOG"
  | "TARIFF_DOCUMENT"
  | "UTILITY_DATA";

export type UploadValidationStatus = "PENDING" | "VALID" | "INVALID" | "REVIEW_REQUIRED";

export type UploadErrorStatus = "NONE" | "WARNING" | "ERROR" | "FATAL";

export interface UploadRecord {
  id: string;
  organisationId: string;
  userId?: string | null;
  filename: string;
  fileType: UploadFileType;
  fileSizeBytes: number;
  fileHashSha256: string;
  storageLocation: string;
  processingStatus: UploadProcessingStatus;
  processingStart?: string | null;
  processingCompletion?: string | null;
  rowCount?: number | null;
  recordCount?: number | null;
  validationStatus: UploadValidationStatus;
  errorStatus: UploadErrorStatus;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUploadInput {
  id?: string;
  organisationId: string;
  userId?: string | null;
  filename: string;
  fileType: UploadFileType;
  fileSizeBytes: number;
  fileHashSha256: string;
  storageLocation: string;
  processingStatus?: UploadProcessingStatus;
  processingStart?: string | null;
  processingCompletion?: string | null;
  rowCount?: number;
  recordCount?: number;
  validationStatus?: UploadValidationStatus;
  errorStatus?: UploadErrorStatus;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface UpdateUploadInput {
  processingStatus?: UploadProcessingStatus;
  processingStart?: string | null;
  processingCompletion?: string | null;
  rowCount?: number;
  recordCount?: number;
  validationStatus?: UploadValidationStatus;
  errorStatus?: UploadErrorStatus;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface UploadFilter {
  organisationId?: string;
  processingStatus?: UploadProcessingStatus;
  fileType?: UploadFileType;
  validationStatus?: UploadValidationStatus;
  search?: string;
  limit?: number;
  offset?: number;
}
