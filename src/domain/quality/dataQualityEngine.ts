/**
 * Formal Data Governance & Quality Engine
 * Scans telemetry, meters, invoices, and reconciliation runs for 12 anomaly categories,
 * computes 5-entity quality scores, and enforces strict Reconciliation Gatekeeper policies.
 */

import Decimal from "decimal.js-light";
import type {
  DataQualityIssueRecord,
  FiveEntityScoreSummary,
  QualityStateCategory,
  IssueSourceType,
  GatekeeperValidationResult,
} from "./types";

export class DataGovernanceEngine {
  /**
   * Calculate 5-Entity Quality Scores (Invoice, Meter, Telemetry Batch, Site, Reconciliation)
   */
  public static calculateScores(issues: DataQualityIssueRecord[]): FiveEntityScoreSummary {
    const activeUnresolvedIssues = issues.filter(
      (i) => i.resolution_status === "UNRESOLVED" || i.resolution_status === "UNDER_REVIEW"
    );

    const getScoreForSource = (source: IssueSourceType): Decimal => {
      let score = new Decimal("100.00");
      const sourceIssues = activeUnresolvedIssues.filter((i) => i.source === source);

      for (const issue of sourceIssues) {
        score = score.minus(issue.deduction_points);
      }

      return Decimal.max(score, new Decimal("0.00")).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    };

    const invoiceScore = getScoreForSource("INVOICE");
    const meterScore = getScoreForSource("METER");
    const telemetryBatchScore = getScoreForSource("TELEMETRY_BATCH");
    const siteScore = getScoreForSource("SITE");
    const reconciliationScore = getScoreForSource("RECONCILIATION");

    const overallScore = invoiceScore
      .plus(meterScore)
      .plus(telemetryBatchScore)
      .plus(siteScore)
      .plus(reconciliationScore)
      .div(5)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      invoice_score: invoiceScore,
      meter_score: meterScore,
      telemetry_batch_score: telemetryBatchScore,
      site_score: siteScore,
      reconciliation_score: reconciliationScore,
      overall_governance_score: overallScore,
    };
  }

  /**
   * Reconciliation Gatekeeper Policy:
   * Proves that invalid or unverified telemetry cannot silently enter final reconciliation.
   */
  public static validateReconciliationGatekeeper(
    issues: DataQualityIssueRecord[],
    hasExplicitOverridePathway: boolean = false
  ): GatekeeperValidationResult {
    const blockingIssues = issues.filter(
      (i) =>
        (i.severity === "CRITICAL" || i.severity === "HIGH") &&
        i.resolution_status !== "RESOLVED" &&
        i.resolution_status !== "EXPLICITLY_OVERRIDDEN"
    );

    if (blockingIssues.length > 0 && !hasExplicitOverridePathway) {
      return {
        isPermitted: false,
        blockedReason: `Reconciliation Gatekeeper BLOCKED: ${blockingIssues.length} unresolved CRITICAL/HIGH data quality issues detected (${blockingIssues.map((b) => b.quality_state).join(", ")}). Invalid data cannot enter final financial reconciliation without an explicit override pathway.`,
        blockingIssues,
      };
    }

    return {
      isPermitted: true,
      blockingIssues: [],
    };
  }

  /**
   * Helper generator to create production sample data for all 12 anomaly categories
   */
  public static generateSampleGovernanceIssues(): DataQualityIssueRecord[] {
    const sampleCategories: Array<{ state: QualityStateCategory; source: IssueSourceType; title: string; sev: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; pts: number }> = [
      { state: "MISSING", source: "TELEMETRY_BATCH", title: "Missing 30-min Intervals", sev: "HIGH", pts: 10 },
      { state: "DUPLICATE", source: "TELEMETRY_BATCH", title: "Duplicate Telemetry Timestamps", sev: "MEDIUM", pts: 5 },
      { state: "ESTIMATED", source: "TELEMETRY_BATCH", title: "Utility Estimated Readings", sev: "LOW", pts: 2 },
      { state: "INVALID", source: "TELEMETRY_BATCH", title: "Invalid Telemetry Reading", sev: "CRITICAL", pts: 20 },
      { state: "CORRECTED", source: "TELEMETRY_BATCH", title: "Manual Override Corrected Reading", sev: "LOW", pts: 2 },
      { state: "MULTIPLIER_ANOMALY", source: "METER", title: "CT/VT Multiplier Anomaly", sev: "CRITICAL", pts: 20 },
      { state: "TIMESTAMP_ANOMALY", source: "METER", title: "Clock Drift & Timezone Mismatch", sev: "MEDIUM", pts: 5 },
      { state: "ROLLOVER_EVENT", source: "METER", title: "Dial Counter Rollover Event", sev: "MEDIUM", pts: 5 },
      { state: "ABNORMAL_DEMAND", source: "SITE", title: "Abnormal Demand Peak Spike (>150k kW)", sev: "HIGH", pts: 10 },
      { state: "ABNORMAL_PF", source: "SITE", title: "Abnormal Power Factor (<0.80)", sev: "MEDIUM", pts: 5 },
      { state: "UNEXPLAINED_INVOICE_VAL", source: "INVOICE", title: "Unexplained Invoice Line Subtotal", sev: "HIGH", pts: 10 },
      { state: "EXTRACTION_CONFIDENCE_FAILURE", source: "INVOICE", title: "PDF OCR Extraction Confidence Failure (<80%)", sev: "CRITICAL", pts: 20 },
    ];

    const now = new Date().toISOString();

    return sampleCategories.map((item, idx) => ({
      issue_id: `GOV-${item.state}-${idx + 101}`,
      source: item.source,
      record_id: `REC-${idx + 1001}`,
      quality_state: item.state,
      severity: item.sev,
      description: `Formal governance detection: ${item.title} evaluated on ${item.source}`,
      recommended_action: `Inspect record ${item.source} and apply appropriate resolution or explicit override pathway.`,
      resolution_status: idx % 3 === 0 ? "RESOLVED" : idx % 4 === 0 ? "EXPLICITLY_OVERRIDDEN" : "UNRESOLVED",
      resolved_by: idx % 3 === 0 ? "Auditor Jane Doe" : undefined,
      resolved_timestamp: idx % 3 === 0 ? now : undefined,
      deduction_points: item.pts,
      created_at: now,
    }));
  }
}
