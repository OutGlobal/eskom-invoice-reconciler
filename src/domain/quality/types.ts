/**
 * Formal Data Governance & Quality Engine Domain Types
 * Enforces visibility, traceability, 5-entity quality scoring, review queues,
 * and strict reconciliation gatekeeper policies.
 */

import Decimal from "decimal.js-light";

export type QualityStateCategory =
  | "MISSING"
  | "DUPLICATE"
  | "ESTIMATED"
  | "INVALID"
  | "CORRECTED"
  | "MULTIPLIER_ANOMALY"
  | "TIMESTAMP_ANOMALY"
  | "ROLLOVER_EVENT"
  | "ABNORMAL_DEMAND"
  | "ABNORMAL_PF"
  | "UNEXPLAINED_INVOICE_VAL"
  | "EXTRACTION_CONFIDENCE_FAILURE";

export type IssueSourceType = "INVOICE" | "METER" | "TELEMETRY_BATCH" | "SITE" | "RECONCILIATION";

export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ResolutionStatus = "UNRESOLVED" | "UNDER_REVIEW" | "RESOLVED" | "EXPLICITLY_OVERRIDDEN";

export type EntityQualityType = "invoice" | "meter" | "telemetry_batch" | "site" | "reconciliation";

export interface EntityQualityScore {
  entity_type: EntityQualityType;
  entity_id: string;
  quality_score: Decimal; // 0.0 to 100.0
  classification: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "POOR" | "CRITICAL";
}

export interface FiveEntityScoreSummary {
  invoice_score: Decimal;
  meter_score: Decimal;
  telemetry_batch_score: Decimal;
  site_score: Decimal;
  reconciliation_score: Decimal;
  overall_governance_score: Decimal;
}

export interface DataQualityIssueRecord {
  issue_id: string;
  source: IssueSourceType;
  record_id: string;
  quality_state: QualityStateCategory;
  severity: IssueSeverity;
  description: string;
  recommended_action: string;
  resolution_status: ResolutionStatus;
  resolved_by?: string;
  resolved_timestamp?: string;
  deduction_points: number;
  client_id?: string;
  site_id?: string;
  meter_id?: string;
  billing_period?: string;
  created_at: string;
}

export interface GatekeeperValidationResult {
  isPermitted: boolean;
  blockedReason?: string;
  blockingIssues: DataQualityIssueRecord[];
}

export type QualityCheckCode =
  | "MISSING_INTERVALS"
  | "DUPLICATE_INTERVALS"
  | "INVALID_TIMESTAMPS"
  | "TIMEZONE_MISMATCH"
  | "DST_ANOMALIES"
  | "COUNTER_RESETS"
  | "NEGATIVE_VALUES"
  | "IMPOSSIBLE_DEMAND"
  | "IMPOSSIBLE_POWER_FACTOR"
  | "UNEXPECTED_INTERVAL_DURATION"
  | "UNEXPECTED_CONSUMPTION_SPIKES"
  | "METER_GAPS"
  | "INVOICE_PERIOD_MISMATCH"
  | "METER_INVOICE_MISMATCH"
  | "TARIFF_MISMATCH";

export type QualityClassification = "GOOD" | "ACCEPTABLE" | "WARNING" | "POOR" | "CRITICAL";

export type ReviewStatus = "PENDING_REVIEW" | "REVIEWED" | "DISMISSED_WITH_JUSTIFICATION";

export interface QualityIssueRecord {
  id: string;
  code: QualityCheckCode;
  title: string;
  severity: IssueSeverity;
  description: string;
  affectedRecordsCount: number;
  estimatedFinancialImpactZar: number;
  sourceFileId: string;
  sourceRowNumbers: number[];
  deductionPoints: number;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface DataQualityAssessmentResult {
  overallScore: number; // 0-100
  classification: QualityClassification;
  totalIssuesCount: number;
  issues: QualityIssueRecord[];
  scoreDeductions: Array<{
    code: QualityCheckCode;
    deduction: number;
    reason: string;
  }>;
  evaluatedIntervalsCount: number;
  evaluatedInvoiceNo?: string;
  evaluatedAt: string;
}

export interface QualityAssessmentInput {
  telemetryRecords?: any[];
  invoiceRecord?: {
    invoiceNumber?: string;
    meterNumber?: string;
    tariffCode?: string;
    startDate?: string;
    endDate?: string;
  };
  siteTariffCode?: string;
  nmdLimitKva?: number;
}

/**
 * Stage 11 — Formal Data-Quality Statuses
 */
export type DataQualityStatus = "VALID" | "WARNING" | "INVALID" | "INCOMPLETE";

/**
 * Stage 11 — The 15 Mandatory Anomaly Detection Rule Codes
 */
export type QualityRuleCode =
  | "MISSING_TIMESTAMPS"
  | "DUPLICATE_TIMESTAMPS"
  | "INVALID_DATES"
  | "FUTURE_DATES"
  | "NEGATIVE_CONSUMPTION"
  | "IMPOSSIBLE_READINGS"
  | "METER_RESETS"
  | "MISSING_INTERVALS"
  | "OVERLAPPING_INTERVALS"
  | "INCORRECT_INTERVAL_DURATION"
  | "UNIT_MISMATCHES"
  | "INCONSISTENT_TOTALS"
  | "MISSING_BILLING_PERIODS"
  | "MISSING_METER_IDENTIFIERS"
  | "MISSING_ACCOUNT_IDENTIFIERS";

export interface ValidationFinding {
  id: string;
  rule_code: QualityRuleCode;
  status: DataQualityStatus;
  severity: IssueSeverity;
  title: string;
  description: string;
  recommended_action: string;
  affected_count: number;
  affected_row_numbers?: number[];
  affected_timestamps?: string[];
  affected_meter_id?: string;
  affected_account_number?: string;
  estimated_financial_impact_zar?: number;
  source_file_id?: string;
  created_at: string;
}

export interface ValidationReport {
  report_id: string;
  overall_status: DataQualityStatus;
  quality_score: number; // 0 to 100
  evaluated_at: string;
  batch_id?: string;
  source_file_id?: string;
  meter_id?: string;
  account_number?: string;
  total_records_evaluated: number;
  flagged_records_count: number;
  findings: ValidationFinding[];
  status_counts: Record<DataQualityStatus, number>;
  rule_counts: Partial<Record<QualityRuleCode, number>>;
  can_proceed_to_reconciliation: boolean;
  flagged_intervals?: any[];
}

export interface PreReconciliationDataset {
  intervals?: any[];
  invoice?: {
    invoiceNumber?: string;
    invoice_number?: string;
    accountNumber?: string;
    account_number?: string;
    meterNumber?: string;
    meter_number?: string;
    meter_id?: string;
    premiseId?: string;
    premise_id?: string;
    billingStart?: string | Date;
    billing_start?: string | Date;
    billingEnd?: string | Date;
    billing_end?: string | Date;
    totalKwh?: number;
    total_kwh?: number;
    peakKwh?: number;
    peak_kwh?: number;
    standardKwh?: number;
    standard_kwh?: number;
    offPeakKwh?: number;
    off_peak_kwh?: number;
    maxDemandKva?: number;
    max_demand_kva?: number;
    lineItems?: any[];
    [key: string]: any;
  };
  expected_interval_minutes?: 5 | 15 | 30 | 60;
  allow_negative_generation?: boolean;
  nmd_kva_limit?: number;
  reference_now?: Date;
  batch_id?: string;
  source_file_id?: string;
  site_id?: string;
}

export interface DataQualityEngineOptions {
  toleranceMinutes?: number;
  nmdKvaLimit?: number;
  allowNegativeGeneration?: boolean;
  referenceNow?: Date;
  strictUnitCheck?: boolean;
  kwhVarianceTolerancePct?: number;
}
