/**
 * Enterprise Reconciliation Engine Domain Types
 * Core domain types for automated utility bill reconciliation
 */

import Decimal from 'decimal.js-light';
import type { CalculationAuditStep } from '../tariff/types';

export type DiscrepancyClassification =
  | 'MATCH'
  | 'ROUNDING_VARIANCE'
  | 'DATA_QUALITY'
  | 'METER_DATA_GAP'
  | 'TOU_CLASSIFICATION'
  | 'TARIFF_VERSION'
  | 'DEMAND_VARIANCE'
  | 'REACTIVE_ENERGY_VARIANCE'
  | 'POWER_FACTOR_VARIANCE'
  | 'NETWORK_CHARGE_VARIANCE'
  | 'CAPACITY_VARIANCE'
  | 'LEVY_VARIANCE'
  | 'VAT_VARIANCE'
  | 'MATERIAL_DISCREPANCY'
  | 'UNRESOLVED';

export type ReconciliationRunStatus =
  | 'PASS'
  | 'PASS_WITH_WARNINGS'
  | 'REVIEW_REQUIRED'
  | 'MATERIAL_DISCREPANCY'
  | 'FAILED';

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
  status: 'MATCH' | 'ROUNDING_VARIANCE' | 'MATERIAL_DISCREPANCY' | 'UNRESOLVED';
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
  calculation_trace: CalculationAuditStep[];
  run_at: string;
}
