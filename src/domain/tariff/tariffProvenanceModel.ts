/**
 * Tariff Source Provenance Model
 * ========================================================
 * Preserves the 8-tier provenance chain for every imported rate (Requirement 7):
 *
 *   Tariff
 *     ↓
 *   Tariff Version
 *     ↓
 *   Charge Component
 *     ↓
 *   Rate or Rule
 *     ↓
 *   Source Document
 *     ↓
 *   Page / Table / Row / Cell
 *     ↓
 *   Import Run
 *     ↓
 *   Review and Approval
 */

import type { TariffApprovalStatus, TariffComponentRule } from "./types";

export interface SourceDocumentReference {
  document_id: string;
  filename: string;
  file_hash_sha256: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path?: string;
  document_type: "GAZETTE_PDF" | "MUNICIPAL_SCHEDULE_PDF" | "TARIFF_EXCEL" | "TARIFF_CSV" | "OFFICIAL_NOTICE";
}

export interface DocumentCellLocation {
  page_number?: number;
  table_id?: string;
  table_name?: string;
  row_index?: number;
  cell_coordinate?: string; // e.g. "C14" or "Table 2, Row 4, Col 3"
  raw_text_snippet?: string;
}

export interface TariffImportRunMetadata {
  run_id: string;
  imported_at: string;
  imported_by: string;
  adapter_used: string;
  extraction_confidence: number;
  ai_assisted_interpretation: boolean;
  ambiguity_flags: string[];
}

export interface TariffReviewAndApprovalState {
  approval_status: TariffApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  approval_notes?: string;
  gazette_verified: boolean;
}

export interface TariffRateProvenance {
  tariff_code: string;
  tariff_version: string;
  component_code: string;
  rule_id: string;
  source_document: SourceDocumentReference;
  document_location: DocumentCellLocation;
  import_run: TariffImportRunMetadata;
  review_and_approval: TariffReviewAndApprovalState;
}

export class TariffProvenanceModel {
  /**
   * Formats the complete 8-tier provenance chain as an auditable string
   */
  public static formatProvenanceChain(provenance: TariffRateProvenance): string {
    const docLoc = provenance.document_location;
    const locParts = [
      docLoc.page_number ? `p.${docLoc.page_number}` : "",
      docLoc.table_name || docLoc.table_id ? `[${docLoc.table_name || docLoc.table_id}]` : "",
      docLoc.row_index !== undefined ? `row ${docLoc.row_index}` : "",
      docLoc.cell_coordinate ? `cell ${docLoc.cell_coordinate}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return [
      `Tariff: ${provenance.tariff_code}`,
      `Version: ${provenance.tariff_version}`,
      `Component: ${provenance.component_code}`,
      `Rule ID: ${provenance.rule_id}`,
      `Source: ${provenance.source_document.filename} (${provenance.source_document.file_hash_sha256.substring(0, 12)}...)`,
      `Location: ${locParts || "Document root"}`,
      `Import Run: ${provenance.import_run.run_id} via ${provenance.import_run.adapter_used} (confidence ${Math.round(provenance.import_run.extraction_confidence * 100)}%)`,
      `Approval: ${provenance.review_and_approval.approval_status.toUpperCase()}${provenance.review_and_approval.approved_by ? ` by ${provenance.review_and_approval.approved_by}` : " (awaiting review)"}`,
    ].join(" -> ");
  }

  /**
   * Creates a provenance record for an imported component
   */
  public static createProvenance(params: {
    tariffCode: string;
    tariffVersion: string;
    componentCode: string;
    ruleId: string;
    sourceDocument: SourceDocumentReference;
    location?: DocumentCellLocation;
    importRun: TariffImportRunMetadata;
    reviewAndApproval?: Partial<TariffReviewAndApprovalState>;
  }): TariffRateProvenance {
    return {
      tariff_code: params.tariffCode,
      tariff_version: params.tariffVersion,
      component_code: params.componentCode,
      rule_id: params.ruleId,
      source_document: params.sourceDocument,
      document_location: params.location || {},
      import_run: params.importRun,
      review_and_approval: {
        approval_status: params.reviewAndApproval?.approval_status || "pending_approval",
        approved_by: params.reviewAndApproval?.approved_by,
        approved_at: params.reviewAndApproval?.approved_at,
        approval_notes: params.reviewAndApproval?.approval_notes,
        gazette_verified: params.reviewAndApproval?.gazette_verified ?? false,
      },
    };
  }
}
