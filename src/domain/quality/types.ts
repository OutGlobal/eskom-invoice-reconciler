/**
 * Electricity Data-Quality Engine Types
 * Eskom Bill Balancer Platform
 */

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

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

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
