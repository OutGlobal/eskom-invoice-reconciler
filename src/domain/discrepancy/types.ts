/**
 * Deterministic Discrepancy Engine Types & Domain Contracts
 * Enforces zero AI invention of financial values, 12 system discrepancy codes,
 * root-cause propagation chains, and 6-level drill-down traceability.
 */

import Decimal from "decimal.js-light";

export type DiscrepancyCode =
  | "TAR-001" // Tariff mismatch
  | "DEM-001" // Demand discrepancy
  | "MUL-001" // Meter multiplier discrepancy
  | "TOU-001" // TOU allocation discrepancy
  | "EST-001" // Estimated billing
  | "TEL-001" // Missing telemetry
  | "TEL-002" // Telemetry quality failure
  | "REA-001" // Reactive energy discrepancy
  | "NET-001" // Network charge discrepancy
  | "CHG-001" // Unexpected charge
  | "VAT-001" // VAT discrepancy
  | "INV-001"; // Invoice extraction inconsistency

export type DiscrepancySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DiscrepancyStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "CONFIRMED"
  | "DISPUTED"
  | "RESOLVED"
  | "REJECTED";

export interface RootCauseChainStep {
  step: number;
  node_type: "ROOT_CAUSE" | "TOU_RATE" | "LINE_ITEM_CHARGE" | "INVOICE_VARIANCE";
  description: string;
  detail: string;
}

export interface DrillDownPath {
  discrepancy_code: string;
  invoice_id: string;
  determinant_code: string;
  calculation_summary: string;
  telemetry_summary: string;
  tariff_rule_id: string;
  source_file_name: string;
}

export interface DiscrepancyRecord {
  id: string;
  code: DiscrepancyCode;
  category: string;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  description: string;
  evidence: string;
  source_records: {
    invoice_id: string;
    telemetry_batch_id?: string;
    meter_id?: string;
    source_file_id?: string;
    tariff_rule_id?: string;
  };
  calculation: {
    input_value: string;
    formula: string;
    rate_applied: string;
    precision: string;
    output_value: string;
  };
  financial_impact_zar: Decimal;
  recommended_action: string;
  confidence: number; // 0.0 to 1.0
  root_cause_chain: RootCauseChainStep[];
  drill_down_path: DrillDownPath;
  reconciliation_run_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 22 Deterministic Root Cause Reason Codes
 */
export type DiscrepancyReasonCode =
  | "METER_CLOCK_DRIFT"
  | "INCORRECT_TIMEZONE"
  | "DST_ISSUE"
  | "MISSING_INTERVALS"
  | "DUPLICATE_INTERVALS"
  | "METER_RESET"
  | "INCORRECT_TOU_SCHEDULE"
  | "INCORRECT_SEASON"
  | "INCORRECT_HOLIDAY_CALENDAR"
  | "INCORRECT_TARIFF_VERSION"
  | "INCORRECT_TARIFF_RATE"
  | "INCORRECT_DEMAND_DETERMINANT"
  | "RATCHET_APPLIED_INCORRECTLY"
  | "REACTIVE_CALCULATION_MISMATCH"
  | "POWER_FACTOR_THRESHOLD_MISMATCH"
  | "NETWORK_CHARGE_MISMATCH"
  | "CAPACITY_CHARGE_MISMATCH"
  | "LEVY_MISMATCH"
  | "VAT_CALCULATION_MISMATCH"
  | "INVOICE_EXTRACTION_ERROR"
  | "METER_TO_INVOICE_MAPPING_ERROR"
  | "DATA_QUALITY_ISSUE";

export type DiagnosticSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type DiagnosticConfidence = "HIGH" | "MEDIUM" | "LOW";

export type DiagnosticCategory =
  | "TELEMETRY_QUALITY"
  | "TARIFF_SCHEDULE"
  | "BILLING_DETERMINANTS"
  | "UTILITY_CHARGES"
  | "INGESTION_MAPPING";

/**
 * Detailed Diagnostic Diagnosis structure for every detected root cause
 */
export interface DiscrepancyDiagnosis {
  id: string;
  reason_code: DiscrepancyReasonCode;
  category: DiagnosticCategory;
  title: string;
  severity: DiagnosticSeverity;
  confidence: DiagnosticConfidence;
  evidence: string;
  affected_records_count: number;
  affected_record_ids?: string[];
  affected_billing_component: string;
  estimated_financial_impact_zar: Decimal;
  nersa_reference?: string;
  recommended_action?: string;
  created_at: string;
}

/**
 * Summary of Discrepancy Analysis Execution
 */
export interface DiscrepancyAnalysisSummary {
  reconciliation_run_id?: string;
  site_id?: string;
  analyzed_at: string;
  total_diagnoses: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_disputed_financial_impact_zar: Decimal;
  high_confidence_count: number;
  diagnoses: DiscrepancyDiagnosis[];
  breakdown_by_category: Record<DiagnosticCategory, number>;
  breakdown_by_reason_code: Record<DiscrepancyReasonCode, number>;
}

/**
 * Input Context passed to the Deterministic Discrepancy Engine
 */
export interface DiagnosticInputContext {
  reconciliationRun?: any;
  telemetryRecords?: any[];
  telemetryMetrics?: any;
  extractedInvoice?: any;
  tariffHeader?: any;
  customerConfig?: {
    site_id?: string;
    contracted_nmd_kva?: number;
    voltage_level_kv?: number;
    account_number?: string;
    meter_number?: string;
    expected_timezone?: string;
    applied_tariff_code?: string;
  };
}
