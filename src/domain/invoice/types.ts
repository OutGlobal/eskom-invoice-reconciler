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
  // Energy Determinants (Nullable when not billed or absent on non-TOU/single-rate tariffs)
  peak_kwh: number | null;
  standard_kwh: number | null;
  off_peak_kwh: number | null;
  total_kwh: number | null;
  opening_reading?: number | null;
  closing_reading?: number | null;

  // Demand & Reactive Determinants (Nullable when unmeasured or unbilled)
  maximum_demand_kva: number | null;
  notified_maximum_demand_kva: number | null;
  utilised_capacity_kva: number | null;
  reactive_energy_kvarh: number | null;
  power_factor: number | null;

  // Financial Charges Breakdown (Nullable when not levied)
  energy_charges_zar: number | null;
  network_charges_zar: number | null;
  demand_charges_zar: number | null;
  service_charges_zar: number | null;
  ancillary_charges_zar: number | null;
  subsidies_adjustments_zar: number | null;

  // Totals
  subtotal_zar: number | null;
  vat_zar: number | null;
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

  // Meter Dial Readings (Opening & Closing)
  opening_reading?: ExtractedField<number | null>;
  closing_reading?: ExtractedField<number | null>;

  // Demand & Capacity Determinants (Nullable when unmeasured or unbilled)
  notified_maximum_demand: ExtractedField<number | null>;
  utilised_capacity: ExtractedField<number | null>;
  maximum_demand: ExtractedField<number | null>;

  // Active & Reactive Energy Determinants (Nullable when unmeasured or unbilled)
  active_energy: ExtractedField<number | null>;
  peak_kwh: ExtractedField<number | null>;
  standard_kwh: ExtractedField<number | null>;
  off_peak_kwh: ExtractedField<number | null>;
  total_kwh: ExtractedField<number | null>;
  reactive_energy_kvarh: ExtractedField<number | null>;
  power_factor: ExtractedField<number | null>;

  // Itemized Charge Totals
  demand_charges: ExtractedField<number | null>;
  network_charges: ExtractedField<number | null>;
  capacity_charges: ExtractedField<number | null>;
  service_charges: ExtractedField<number | null>;
  reliability_services: ExtractedField<number | null>;
  levies: ExtractedField<number | null>;
  adjustments: ExtractedField<number | null>;

  // Financial Header Totals
  subtotal_amount: ExtractedField<number | null>;
  vat_amount: ExtractedField<number | null>;
  total_invoice_amount: ExtractedField<number>;
  opening_balance: ExtractedField<number | null>;
  closing_balance: ExtractedField<number | null>;
  payments: ExtractedField<number | null>;
  credits: ExtractedField<number | null>;
  other_charges: ExtractedField<number | null>;

  // Detailed Tables & Determinants
  line_items: ExtractedInvoiceLineItem[];
  determinants: ExtractedInvoiceDeterminant[];

  // Document Metadata & Validation Results
  metadata: InvoiceExtractionMetadata;
  validation_summary: InvoiceValidationSummary;

  // Explicit tracking of missing fields (Never silently coerce to 0)
  missing_fields?: string[];

  // Entity Links
  customer_id?: string;
  site_id?: string;
  meter_id?: string;

  // Human Review Audit Log
  corrections_log?: InvoiceCorrectionEntry[];
}
