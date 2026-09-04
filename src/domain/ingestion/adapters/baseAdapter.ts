/**
 * Abstract Base Layout Adapter Interface
 */

import type { ExtractedInvoiceFields, IngestionErrorRecord } from "../types";

export interface AdapterExtractionResult {
  success: boolean;
  documentType:
    "INVOICE_PDF" | "AMR_TELEMETRY_CSV" | "AMR_TELEMETRY_XLSX" | "TELEMETRY_XML" | "MUNICIPAL_BILL";
  extractedFields?: ExtractedInvoiceFields;
  intervals?: any[];
  rawTextPreview: string;
  confidenceScore: number; // 0.00 to 1.00
  needsHumanReview: boolean;
  ambiguityReasons: string[];
  errors: IngestionErrorRecord[];
}

export interface ILayoutAdapter {
  canHandle(fileExtension: string, mimeType: string): boolean;
  extract(file: File, bytes: Uint8Array, jobId: string): Promise<AdapterExtractionResult>;
}
