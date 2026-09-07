/**
 * Canonical Invoice Extraction Domain Types
 * Enterprise Electricity Invoice Ingestion & Extraction Engine
 */

export type InvoiceLifecycleState =
  | "UPLOADED"
  | "EXTRACTED"
  | "VALIDATED"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "READY_FOR_RECONCILIATION"
  | "RECONCILING"
  | "RECONCILED"
  | "DISPUTED"
  | "CLOSED";

export interface ExtractedField<T = string | number> {
  field_name: string;
  value: T;
  unit: string; // e.g. 'kWh', 'kVA', 'kVARh', 'ZAR', 'c/kWh', 'R/kVA', 'days', 'ratio', 'text'
  source_page: number; // 1-based index
  source_text_reference: string;
  confidence_score: number; // 0.0 to 1.0
  parser_version: string;
}

export interface ExtractedInvoiceLineItem {
  line_item_number: number;
  charge_code?: string;
  charge_label: string;
  rate: ExtractedField<number>;
  quantity: ExtractedField<number>;
  unit_of_measure: string;
  invoiced_amount: ExtractedField<number>;
  normalized_amount?: number;
  source_page: number;
  source_text_reference: string;
  confidence_score: number;
  calculation_status?: "verified" | "unverified" | "discrepancy";
}

export interface ExtractedInvoiceDeterminant {
  determinant_name: string;
  determinant_value: ExtractedField<number>;
  unit: string;
  period_start?: string;
  period_end?: string;
  source_page: number;
  source_text_reference: string;
}

export interface BillingDeterminantRecord {
  // Energy Determinants
  peak_kwh: number;
  standard_kwh: number;
  off_peak_kwh: number;
  total_kwh: number;

  // Demand & Reactive Determinants
  maximum_demand_kva: number;
  notified_maximum_demand_kva: number;
  utilised_capacity_kva: number;
  reactive_energy_kvarh: number;
  power_factor: number;

  // Financial Charges Breakdown
  energy_charges_zar: number;
  network_charges_zar: number;
  demand_charges_zar: number;
  service_charges_zar: number;
  ancillary_charges_zar: number;
  subsidies_adjustments_zar: number;

  // Totals
  subtotal_zar: number;
  vat_zar: number;
  total_invoice_zar: number;
}

export interface InvoiceDiscrepancy {
  rule_id: string;
  rule_name: string;
  severity: "critical" | "major" | "warning";
  expected_value: string | number;
  actual_value: string | number;
  variance_amount?: number;
  message: string;
}

export interface InvoiceValidationSummary {
  status: "valid" | "discrepancy" | "failed";
  energy_reconciled: boolean;
  financial_reconciled: boolean;
  discrepancies: InvoiceDiscrepancy[];
}

export type PageClassificationType =
  | "tax_invoice_header"
  | "line_item_breakdown"
  | "meter_reading_schedule"
  | "annexure_notes"
  | "unknown";

export interface ClassifiedPage {
  page_number: number;
  classification: PageClassificationType;
  confidence: number;
  text_content: string;
}

export interface InvoiceCorrectionEntry {
  id: string;
  invoice_record_id: string;
  field_name: string;
  original_value: string | number;
  corrected_value: string | number;
  reason: string;
  user_id?: string;
  user_name: string;
  timestamp: string;
  approved_by?: string;
}

export interface InvoiceHeaderMeta {
  invoice_id: string;
  account_number: string;
  organisation_id?: string;
  client_name?: string;
  site_id?: string;
  site_name?: string;
  pod_id?: string;
  premise_id?: string;
  meter_number?: string;
  billing_period_start: string;
  billing_period_end: string;
  invoice_date: string;
  tariff_code?: string;
  tariff_name?: string;
  supply_voltage?: number;
  source_file_id?: string;
  sha256_hash: string;
  extraction_status: "success" | "partial" | "failed";
  validation_status: "passed" | "warnings" | "failed";
  reconciliation_status: "unprocessed" | "pending" | "matched" | "discrepancy";
  lifecycle_state: InvoiceLifecycleState;
}

export interface InvoiceExtractionMetadata {
  sha256_hash: string;
  source_filename: string;
  file_size_bytes: number;
  page_count: number;
  document_type: "embedded-text" | "scanned-pdf" | "image" | "hybrid";
  overall_confidence: number;
  needs_human_review: boolean;
  low_confidence_fields: string[];
  extracted_at: string;
  parser_version: string;
}

export interface ExtractedInvoiceDocument {
  id?: string;
  lifecycle_state?: InvoiceLifecycleState;

  // Required Header & Account Fields
  account_number: ExtractedField<string>;
  customer_name: ExtractedField<string>;
  premise_id: ExtractedField<string>;
  meter_number: ExtractedField<string>;
  invoice_number: ExtractedField<string>;
  billing_period_start: ExtractedField<string>;
  billing_period_end: ExtractedField<string>;
  invoice_date: ExtractedField<string>;
  tariff_name: ExtractedField<string>;
  tariff_code: ExtractedField<string>;

  // Demand & Capacity Determinants
  notified_maximum_demand: ExtractedField<number>;
  utilised_capacity: ExtractedField<number>;
  maximum_demand: ExtractedField<number>;

  // Active & Reactive Energy Determinants
  active_energy: ExtractedField<number>;
  peak_kwh: ExtractedField<number>;
  standard_kwh: ExtractedField<number>;
  off_peak_kwh: ExtractedField<number>;
  total_kwh: ExtractedField<number>;
  reactive_energy_kvarh: ExtractedField<number>;
  power_factor: ExtractedField<number>;

  // Itemized Charge Totals
  demand_charges: ExtractedField<number>;
  network_charges: ExtractedField<number>;
  capacity_charges: ExtractedField<number>;
  service_charges: ExtractedField<number>;
  reliability_services: ExtractedField<number>;
  levies: ExtractedField<number>;
  adjustments: ExtractedField<number>;

  // Financial Header Totals
  subtotal_amount: ExtractedField<number>;
  vat_amount: ExtractedField<number>;
  total_invoice_amount: ExtractedField<number>;
  opening_balance: ExtractedField<number>;
  closing_balance: ExtractedField<number>;
  payments: ExtractedField<number>;
  credits: ExtractedField<number>;
  other_charges: ExtractedField<number>;

  // Detailed Tables & Determinants
  line_items: ExtractedInvoiceLineItem[];
  determinants: ExtractedInvoiceDeterminant[];

  // Document Metadata & Validation Results
  metadata: InvoiceExtractionMetadata;
  validation_summary: InvoiceValidationSummary;

  // Human Review Audit Log
  corrections_log?: InvoiceCorrectionEntry[];
}
