/**
 * Authoritative Deterministic Reconciliation Engine Domain Types
 * Enforces zero floating-point drift, 14-determinant comparison, idempotency checksums,
 * and calculation explanation lineage.
 */

import Decimal from "decimal.js-light";

export type ReconciliationRunStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REVIEW_REQUIRED"
  | "PASS"
  | "PASS_WITH_WARNINGS"
  | "MATERIAL_DISCREPANCY";

export type ReconciliationClassification = "PASS" | "WARNING" | "DISCREPANCY" | "CRITICAL";

export interface ToleranceConfig {
  percentage_tolerance: Decimal; // e.g. 0.50 for 0.5%
  absolute_zar_tolerance: Decimal; // e.g. R 50.00
  kwh_tolerance: Decimal; // e.g. 100 kWh
  kva_tolerance: Decimal; // e.g. 5 kVA
  kvarh_tolerance: Decimal; // e.g. 50 kVARh
}

export const DEFAULT_TOLERANCE_CONFIG: ToleranceConfig = {
  percentage_tolerance: new Decimal("0.50"), // 0.5%
  absolute_zar_tolerance: new Decimal("50.00"), // R 50.00
  kwh_tolerance: new Decimal("100.00"),
  kva_tolerance: new Decimal("5.00"),
  kvarh_tolerance: new Decimal("50.00"),
};

export interface CalculationExplanation {
  input_value: string;
  formula_used: string;
  rate_applied: string;
  unit: string;
  precision: string;
  rounding_method: string; // e.g. 'Decimal.ROUND_HALF_UP (2 decimals)'
  output_value: string;
}

export interface DeterminantComparisonItem {
  determinant_code: string;
  determinant_name: string;
  billed_value: Decimal;
  calculated_value: Decimal;
  variance_value: Decimal;
  variance_percentage: Decimal;
  unit_of_measure: string;
  classification: ReconciliationClassification;
  explanation: CalculationExplanation;
}

export interface AuthoritativeReconciliationPayload {
  run_id: string;
  tenant_id: string;
  invoice_id: string;
  telemetry_batch_id: string;
  tariff_version_id: string;
  calendar_version_id: string;
  engine_version: string;
  configuration_version: string;
  created_at: string;
  completed_at: string;
  status: ReconciliationRunStatus;
  classification: ReconciliationClassification;
  result_checksum: string; // SHA-256 fingerprint of input metadata and result
  billed_total_zar: Decimal;
  calculated_total_zar: Decimal;
  variance_total_zar: Decimal;
  variance_percentage: Decimal;
  determinant_comparisons: DeterminantComparisonItem[];
}

export type DiscrepancyClassification =
  | "MATCH"
  | "ROUNDING_VARIANCE"
  | "DATA_QUALITY"
  | "METER_DATA_GAP"
  | "TOU_CLASSIFICATION"
  | "TARIFF_VERSION"
  | "DEMAND_VARIANCE"
  | "REACTIVE_ENERGY_VARIANCE"
  | "POWER_FACTOR_VARIANCE"
  | "NETWORK_CHARGE_VARIANCE"
  | "CAPACITY_VARIANCE"
  | "LEVY_VARIANCE"
  | "VAT_VARIANCE"
  | "MATERIAL_DISCREPANCY"
  | "UNRESOLVED";

export interface ComponentTolerance {
  component_code: string;
  component_name: string;
  absolute_tolerance_zar: Decimal;
  percentage_tolerance: Decimal; // e.g. 0.005 for 0.5%
  unit: string;
}

export interface ReconciliationConfig {
  utility_id?: string;
  tariff_code?: string;
  site_id?: string;
  tolerances: Record<string, ComponentTolerance>;
}

export interface LineItemComparisonResult {
  component_code: string;
  component_name: string;
  billed_value: Decimal;
  calculated_value: Decimal;
  absolute_variance: Decimal;
  percentage_variance: Decimal;
  unit: string;
  tolerance: ComponentTolerance;
  status: "MATCH" | "ROUNDING_VARIANCE" | "MATERIAL_DISCREPANCY" | "UNRESOLVED";
  reason_code: DiscrepancyClassification;
  root_cause_description?: string;
}

export interface ReconciliationRunPayload {
  run_id: string; // Unique UUID for every execution
  invoice_record_id: string;
  invoice_number: string;
  account_number: string;
  billing_start: string;
  billing_end: string;
  status: ReconciliationRunStatus;
  overall_confidence: number; // 0.0 to 1.0
  telemetry_data_quality_score: number; // 0.0 to 100.0
  expected_total_zar: Decimal;
  billed_total_zar: Decimal;
  total_variance_zar: Decimal;
  variance_percent: Decimal;
  comparisons: LineItemComparisonResult[];
  discrepancies: LineItemComparisonResult[];
  root_causes: string[];
  calculation_trace: any[];
  run_at: string;
}

/**
 * Stage 12 — Formal Reconciliation Engine Domain Types
 * Enforces core comparison between real BILLED DATA and real METER/SOURCE DATA,
 * zero floating point drift, dynamic calculations, and comprehensive audit trail.
 */

export type CalculationStatus = "SUCCESS" | "FAILED" | "IN_PROGRESS" | "REVIEW_REQUIRED";

export type ReconciliationResultClassification =
  "PASS" | "WARNING" | "MATERIAL_DISCREPANCY" | "CRITICAL";

export interface BilledDataSummary {
  invoice_number: string;
  invoice_id?: string;
  account_number: string;
  meter_number?: string;
  billed_kwh: Decimal;
  billed_kva: Decimal;
  billed_reactive_kvarh: Decimal;
  tariff_charges_zar: Decimal;
  billed_vat_zar: Decimal;
  invoice_total_zar: Decimal;
  billed_breakdown?: {
    peak_kwh?: Decimal;
    standard_kwh?: Decimal;
    off_peak_kwh?: Decimal;
    network_charges_zar?: Decimal;
    service_charges_zar?: Decimal;
    ancillary_charges_zar?: Decimal;
    demand_charges_zar?: Decimal;
  };
}

export interface MeterSourceDataSummary {
  meter_id: string;
  site_id?: string;
  telemetry_batch_id?: string;
  source_file_id?: string;
  interval_count: number;
  calculated_kwh: Decimal;
  calculated_demand_kva: Decimal;
  calculated_reactive_kvarh: Decimal;
  calculated_power_factor: Decimal;
  tou_breakdown: {
    peak_kwh: Decimal;
    standard_kwh: Decimal;
    off_peak_kwh: Decimal;
  };
  period_covered: {
    start: string;
    end: string;
  };
}

export interface ReconciliationVarianceSummary {
  variance_kwh: Decimal; // calculated_kwh - billed_kwh
  variance_kwh_pct: Decimal;
  demand_variance_kva: Decimal; // calculated_demand - billed_kva
  demand_variance_pct: Decimal;
  reactive_variance_kvarh: Decimal; // calculated_reactive - billed_reactive
  reactive_variance_pct: Decimal;
  charges_variance_zar: Decimal; // calculated_charges - tariff_charges
  charges_variance_pct: Decimal;
  vat_variance_zar: Decimal; // calculated_vat - billed_vat
  financial_variance_zar: Decimal; // calculated_total - invoice_total
  financial_variance_pct: Decimal;
}

export interface AuthoritativeReconciliationRecord {
  reconciliation_id: string;
  site: string;
  account: string;
  invoice: BilledDataSummary;
  source_data: MeterSourceDataSummary;
  billing_period: {
    start: string;
    end: string;
    total_days: number;
  };
  calculation_status: CalculationStatus;
  result: ReconciliationResultClassification;
  variance: ReconciliationVarianceSummary;
  calculated_charges_zar: Decimal;
  calculated_vat_zar: Decimal;
  calculated_total_zar: Decimal;
  processing_timestamp: string;
  engine_version: string;
  audit_record: {
    tariff_code: string;
    tariff_version: string;
    trace_steps: any[];
    determinants: DeterminantComparisonItem[];
    checksum: string;
    notes?: string[];
  };
}

export interface ReconcileStoredDataParams {
  invoiceId: string;
  meterId?: string;
  siteId?: string;
  tariffDefinition?: any;
  toleranceConfig?: ToleranceConfig;
  tenantId?: string;
}

export interface StoredReconciliationDataset {
  site_id?: string;
  account_number?: string;
  invoice: {
    invoice_number: string;
    invoice_id?: string;
    account_number: string;
    meter_number?: string;
    billing_start: string | Date;
    billing_end: string | Date;
    total_kwh?: number | Decimal;
    peak_kwh?: number | Decimal;
    standard_kwh?: number | Decimal;
    off_peak_kwh?: number | Decimal;
    maximum_demand_kva?: number | Decimal;
    reactive_energy_kvarh?: number | Decimal;
    tariff_charges_zar?: number | Decimal;
    energy_charges_zar?: number | Decimal;
    demand_charges_zar?: number | Decimal;
    network_charges_zar?: number | Decimal;
    service_charges_zar?: number | Decimal;
    ancillary_charges_zar?: number | Decimal;
    vat_zar?: number | Decimal;
    vat_amount?: number | Decimal;
    total_invoice_zar?: number | Decimal;
    total_invoice_amount?: number | Decimal;
    tariff_code?: string;
    [key: string]: any;
  };
  intervals: any[];
  tariff_definition?: any;
  tolerance_config?: ToleranceConfig;
  tenant_id?: string;
}
