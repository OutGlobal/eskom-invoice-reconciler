/**
 * Abstract Base Layout Adapter Interface
 */

import type { ExtractedInvoiceFields, IngestionDocumentType, IngestionErrorRecord } from "../types";

export interface AdapterExtractionResult {
  success: boolean;
  documentType: IngestionDocumentType;
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
