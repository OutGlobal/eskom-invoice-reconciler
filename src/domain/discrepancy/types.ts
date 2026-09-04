/**
 * Discrepancy Analysis Engine Types & Domain Contracts
 * Eskom Management Platform
 */

import Decimal from 'decimal.js-light';
import type { LineItemComparisonResult, ReconciliationRunPayload } from '../reconciliation/types';
import type { CanonicalTelemetryRecord, TelemetryQualityMetrics } from '../telemetry/types';
import type { ExtractedInvoiceDocument } from '../invoice/types';
import type { TariffScheduleHeader } from '../tariff/types';

/**
 * 22 Deterministic Root Cause Reason Codes
 */
export type DiscrepancyReasonCode =
  | 'METER_CLOCK_DRIFT'
  | 'INCORRECT_TIMEZONE'
  | 'DST_ISSUE'
  | 'MISSING_INTERVALS'
  | 'DUPLICATE_INTERVALS'
  | 'METER_RESET'
  | 'INCORRECT_TOU_SCHEDULE'
  | 'INCORRECT_SEASON'
  | 'INCORRECT_HOLIDAY_CALENDAR'
  | 'INCORRECT_TARIFF_VERSION'
  | 'INCORRECT_TARIFF_RATE'
  | 'INCORRECT_DEMAND_DETERMINANT'
  | 'RATCHET_APPLIED_INCORRECTLY'
  | 'REACTIVE_CALCULATION_MISMATCH'
  | 'POWER_FACTOR_THRESHOLD_MISMATCH'
  | 'NETWORK_CHARGE_MISMATCH'
  | 'CAPACITY_CHARGE_MISMATCH'
  | 'LEVY_MISMATCH'
  | 'VAT_CALCULATION_MISMATCH'
  | 'INVOICE_EXTRACTION_ERROR'
  | 'METER_TO_INVOICE_MAPPING_ERROR'
  | 'DATA_QUALITY_ISSUE';

export type DiagnosticSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type DiagnosticConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type DiagnosticCategory =
  | 'TELEMETRY_QUALITY'
  | 'TARIFF_SCHEDULE'
  | 'BILLING_DETERMINANTS'
  | 'UTILITY_CHARGES'
  | 'INGESTION_MAPPING';

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
  reconciliationRun?: ReconciliationRunPayload;
  telemetryRecords?: CanonicalTelemetryRecord[];
  telemetryMetrics?: TelemetryQualityMetrics;
  extractedInvoice?: ExtractedInvoiceDocument;
  tariffHeader?: TariffScheduleHeader;
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
