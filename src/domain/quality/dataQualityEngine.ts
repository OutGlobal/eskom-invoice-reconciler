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
  QualityAssessmentInput,
  DataQualityAssessmentResult,
  QualityClassification,
  QualityIssueRecord,
  QualityCheckCode,
  IssueSeverity,
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

      const nonNegative = score.lt(0) ? new Decimal("0.00") : score;
      return nonNegative.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
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

export function evaluateDataQuality(input: QualityAssessmentInput): DataQualityAssessmentResult & { issuesCount: number } {
  const issues: QualityIssueRecord[] = [];
  const deductions: Array<{ code: QualityCheckCode; deduction: number; reason: string }> = [];
  const records = input?.telemetryRecords || [];
  const nmdKva = input?.nmdLimitKva || 250;

  const timestampSet = new Set<string>();
  const duplicates: number[] = [];
  const invalidTimestamps: number[] = [];
  const timezoneMismatches: number[] = [];
  const negativeValues: number[] = [];
  const impossibleDemandRows: number[] = [];
  const impossiblePfRows: number[] = [];
  const spikeRows: number[] = [];
  const unexpectedDurationRows: number[] = [];

  let prevKw = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const rowNum = r.source_row_number || i + 1;

    // Check Invalid Timestamp or Invalid Quality Status
    if (!r.timestamp_utc || isNaN(Date.parse(r.timestamp_utc)) || r.quality_status === "invalid") {
      invalidTimestamps.push(rowNum);
    }

    // Check Timezone Mismatch (Must be SAST UTC+2 or +02:00)
    if (
      r.timezone &&
      !r.timezone.includes("Johannesburg") &&
      !r.timezone.includes("UTC+2") &&
      !r.timezone.includes("+02")
    ) {
      timezoneMismatches.push(rowNum);
    }

    // Check Duplicate Interval
    if (timestampSet.has(r.timestamp_utc)) {
      duplicates.push(rowNum);
    } else {
      timestampSet.add(r.timestamp_utc);
    }

    // Check Negative Energy/Power
    if (
      (r.active_energy_kwh !== undefined && r.active_energy_kwh < 0) ||
      (r.active_power_kw !== undefined && r.active_power_kw < 0) ||
      (r.apparent_power_kva !== undefined && r.apparent_power_kva < 0)
    ) {
      negativeValues.push(rowNum);
    }

    // Check Impossible Demand (>250% NMD)
    if (r.apparent_power_kva !== undefined && r.apparent_power_kva > nmdKva * 2.5) {
      impossibleDemandRows.push(rowNum);
    }

    // Check Impossible Power Factor (out of -1 to 1 range)
    if (r.power_factor !== undefined && (r.power_factor < -1.0 || r.power_factor > 1.0)) {
      impossiblePfRows.push(rowNum);
    }

    // Check Unexpected Interval Duration (not 15m or 30m)
    if (r.interval_minutes !== undefined && r.interval_minutes !== 15 && r.interval_minutes !== 30) {
      unexpectedDurationRows.push(rowNum);
    }

    // Check Consumption Spike (>500% spike compared to prev interval)
    if (i > 0 && prevKw > 10 && r.active_power_kw !== undefined && r.active_power_kw > prevKw * 5) {
      spikeRows.push(rowNum);
    }
    if (r.active_power_kw !== undefined) {
      prevKw = r.active_power_kw;
    }
  }

  // Issue Helper
  const addIssue = (
    code: QualityCheckCode,
    title: string,
    severity: IssueSeverity,
    deduction: number,
    desc: string,
    rows: number[],
    zarImpact = 0,
  ) => {
    if (rows.length === 0) return;
    issues.push({
      id: `qual-${code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code,
      title,
      severity,
      description: desc,
      affectedRecordsCount: rows.length,
      estimatedFinancialImpactZar: zarImpact,
      sourceFileId: records[0]?.source_file_id || "src-file-001",
      sourceRowNumbers: rows.slice(0, 50),
      deductionPoints: deduction,
      reviewStatus: "PENDING_REVIEW",
    });
    deductions.push({ code, deduction, reason: desc });
  };

  addIssue(
    "INVALID_TIMESTAMPS",
    "Invalid or Unparseable Timestamps",
    "CRITICAL",
    15,
    `${invalidTimestamps.length} intervals have unparseable or invalid timestamps`,
    invalidTimestamps,
  );
  addIssue(
    "TIMEZONE_MISMATCH",
    "Timezone Mismatch",
    "HIGH",
    10,
    `${timezoneMismatches.length} intervals have non-SAST timezone strings`,
    timezoneMismatches,
  );
  addIssue(
    "DUPLICATE_INTERVALS",
    "Duplicate Interval Timestamps",
    "HIGH",
    10,
    `${duplicates.length} duplicate interval records detected`,
    duplicates,
  );
  addIssue(
    "NEGATIVE_VALUES",
    "Negative Energy or Power",
    "CRITICAL",
    15,
    `${negativeValues.length} interval records have impossible negative active energy/power`,
    negativeValues,
  );
  addIssue(
    "IMPOSSIBLE_DEMAND",
    "Impossible Maximum Demand (>250% NMD)",
    "CRITICAL",
    15,
    `${impossibleDemandRows.length} intervals exceed 250% of site NMD capacity`,
    impossibleDemandRows,
    5800.0,
  );
  addIssue(
    "IMPOSSIBLE_POWER_FACTOR",
    "Impossible Power Factor Range",
    "HIGH",
    10,
    `${impossiblePfRows.length} intervals have power factor outside [-1.0, 1.0] bounds`,
    impossiblePfRows,
    2450.0,
  );
  addIssue(
    "UNEXPECTED_INTERVAL_DURATION",
    "Unexpected Interval Duration",
    "MEDIUM",
    5,
    `${unexpectedDurationRows.length} intervals have non-standard duration (not 15m/30m)`,
    unexpectedDurationRows,
  );
  addIssue(
    "UNEXPECTED_CONSUMPTION_SPIKES",
    "Unexpected Consumption Spike (>500%)",
    "MEDIUM",
    5,
    `${spikeRows.length} intervals exhibit >500% consumption spikes`,
    spikeRows,
  );

  // Check Invoice Linkage
  if (input?.invoiceRecord && records.length > 0) {
    const invStart = input.invoiceRecord.startDate ? Date.parse(input.invoiceRecord.startDate) : NaN;
    const invEnd = input.invoiceRecord.endDate ? Date.parse(input.invoiceRecord.endDate) : NaN;
    const firstTelemetry = records[0].timestamp_utc ? Date.parse(records[0].timestamp_utc) : NaN;
    const lastTelemetry = records[records.length - 1].timestamp_utc ? Date.parse(records[records.length - 1].timestamp_utc) : NaN;

    if (!isNaN(invStart) && !isNaN(invEnd) && (!isNaN(firstTelemetry) || !isNaN(lastTelemetry))) {
      if (firstTelemetry > invStart || lastTelemetry < invEnd) {
        addIssue(
          "INVOICE_PERIOD_MISMATCH",
          "Invoice Period Mismatch",
          "HIGH",
          10,
          "Telemetry interval date range does not cover full invoice billing period",
          [1],
          1200.0,
        );
      }
    }

    if (
      input.invoiceRecord.meterNumber &&
      records[0].meter_id &&
      !records[0].meter_id.includes(input.invoiceRecord.meterNumber)
    ) {
      addIssue(
        "METER_INVOICE_MISMATCH",
        "Meter / Invoice ID Mismatch",
        "CRITICAL",
        15,
        `Invoice meter number '${input.invoiceRecord.meterNumber}' does not match telemetry meter ID '${records[0].meter_id}'`,
        [1],
        4500.0,
      );
    }

    if (input.siteTariffCode && input.invoiceRecord.tariffCode !== input.siteTariffCode) {
      addIssue(
        "TARIFF_MISMATCH",
        "Tariff Schedule Mismatch",
        "HIGH",
        10,
        `Invoice tariff '${input.invoiceRecord.tariffCode}' differs from assigned site tariff '${input.siteTariffCode}'`,
        [1],
        3200.0,
      );
    }
  }

  const totalDeductions = deductions.reduce((sum, d) => sum + d.deduction, 0);
  const overallScore = Math.max(0, Math.min(100, 100 - totalDeductions));

  let classification: QualityClassification = "GOOD";
  if (overallScore >= 90) classification = "GOOD";
  else if (overallScore >= 80) classification = "ACCEPTABLE";
  else if (overallScore >= 70) classification = "WARNING";
  else if (overallScore >= 50) classification = "POOR";
  else classification = "CRITICAL";

  return {
    overallScore,
    classification,
    totalIssuesCount: issues.length,
    issuesCount: issues.length,
    issues,
    scoreDeductions: deductions,
    evaluatedIntervalsCount: records.length,
    evaluatedInvoiceNo: input?.invoiceRecord?.invoiceNumber,
    evaluatedAt: new Date().toISOString(),
  };
}


