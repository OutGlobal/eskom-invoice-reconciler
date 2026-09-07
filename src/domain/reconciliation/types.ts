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
  | "REVIEW_REQUIRED";

export type ReconciliationClassification =
  | "PASS"
  | "WARNING"
  | "DISCREPANCY"
  | "CRITICAL";

export interface ToleranceConfig {
  percentage_tolerance: Decimal; // e.g. 0.50 for 0.5%
  absolute_zar_tolerance: Decimal; // e.g. R 50.00
  kwh_tolerance: Decimal; // e.g. 100 kWh
  kva_tolerance: Decimal; // e.g. 5 kVA
  kvarh_tolerance: Decimal; // e.g. 50 kVARh
}

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
