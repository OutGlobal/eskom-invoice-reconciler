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

export type IssueSourceType =
  | "INVOICE"
  | "METER"
  | "TELEMETRY_BATCH"
  | "SITE"
  | "RECONCILIATION";

export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ResolutionStatus =
  | "UNRESOLVED"
  | "UNDER_REVIEW"
  | "RESOLVED"
  | "EXPLICITLY_OVERRIDDEN";

export type EntityQualityType =
  | "invoice"
  | "meter"
  | "telemetry_batch"
  | "site"
  | "reconciliation";

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
