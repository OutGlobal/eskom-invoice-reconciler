import {
  DataQualityAssessmentResult,
  QualityClassification,
  QualityIssueRecord,
  QualityCheckCode,
  IssueSeverity,
} from "./types";
import { CanonicalTelemetryRecord } from "../telemetry/types";

export interface QualityAssessmentInput {
  telemetryRecords: CanonicalTelemetryRecord[];
  invoiceRecord?: {
    invoiceNumber: string;
    meterNumber: string;
    tariffCode: string;
    startDate: string;
    endDate: string;
  };
  siteTariffCode?: string;
  nmdLimitKva?: number;
}

export function evaluateDataQuality(input: QualityAssessmentInput): DataQualityAssessmentResult {
  const issues: QualityIssueRecord[] = [];
  const deductions: Array<{ code: QualityCheckCode; deduction: number; reason: string }> = [];
  const records = input.telemetryRecords || [];
  const nmdKva = input.nmdLimitKva || 250;

  // 1. MISSING_INTERVALS & 12. METER_GAPS
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

    // Check Invalid Timestamp
    if (!r.timestamp_utc || isNaN(Date.parse(r.timestamp_utc))) {
      invalidTimestamps.push(rowNum);
    }

    // Check Timezone Mismatch (Must be SAST UTC+2 or +02:00)
    if (r.timezone && !r.timezone.includes("Johannesburg") && !r.timezone.includes("UTC+2") && !r.timezone.includes("+02")) {
      timezoneMismatches.push(rowNum);
    }

    // Check Duplicate Interval
    if (timestampSet.has(r.timestamp_utc)) {
      duplicates.push(rowNum);
    } else {
      timestampSet.add(r.timestamp_utc);
    }

    // Check Negative Energy/Power
    if (r.active_energy_kwh < 0 || r.active_power_kw < 0 || r.apparent_power_kva < 0) {
      negativeValues.push(rowNum);
    }

    // Check Impossible Demand (>250% NMD)
    if (r.apparent_power_kva > nmdKva * 2.5) {
      impossibleDemandRows.push(rowNum);
    }

    // Check Impossible Power Factor (out of -1 to 1 range)
    if (r.power_factor < -1.0 || r.power_factor > 1.0) {
      impossiblePfRows.push(rowNum);
    }

    // Check Unexpected Interval Duration (not 15m or 30m)
    if (r.interval_minutes !== 15 && r.interval_minutes !== 30) {
      unexpectedDurationRows.push(rowNum);
    }

    // Check Consumption Spike (>500% spike compared to prev interval)
    if (i > 0 && prevKw > 10 && r.active_power_kw > prevKw * 5) {
      spikeRows.push(rowNum);
    }
    prevKw = r.active_power_kw;
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

  // Add Detected Issues
  addIssue("INVALID_TIMESTAMPS", "Invalid or Unparseable Timestamps", "CRITICAL", 15, `${invalidTimestamps.length} intervals have unparseable timestamps`, invalidTimestamps);
  addIssue("TIMEZONE_MISMATCH", "Timezone Mismatch", "HIGH", 10, `${timezoneMismatches.length} intervals have non-SAST timezone strings`, timezoneMismatches);
  addIssue("DUPLICATE_INTERVALS", "Duplicate Interval Timestamps", "HIGH", 10, `${duplicates.length} duplicate interval records detected`, duplicates);
  addIssue("NEGATIVE_VALUES", "Negative Energy or Power", "CRITICAL", 15, `${negativeValues.length} interval records have impossible negative active energy/power`, negativeValues);
  addIssue("IMPOSSIBLE_DEMAND", "Impossible Maximum Demand (>250% NMD)", "CRITICAL", 15, `${impossibleDemandRows.length} intervals exceed 250% of site NMD capacity`, impossibleDemandRows, 5800.0);
  addIssue("IMPOSSIBLE_POWER_FACTOR", "Impossible Power Factor Range", "HIGH", 10, `${impossiblePfRows.length} intervals have power factor outside [-1.0, 1.0] bounds`, impossiblePfRows, 2450.0);
  addIssue("UNEXPECTED_INTERVAL_DURATION", "Unexpected Interval Duration", "MEDIUM", 5, `${unexpectedDurationRows.length} intervals have non-standard duration (not 15m/30m)`, unexpectedDurationRows);
  addIssue("UNEXPECTED_CONSUMPTION_SPIKES", "Unexpected Consumption Spike (>500%)", "MEDIUM", 5, `${spikeRows.length} intervals exhibit >500% consumption spikes`, spikeRows);

  // 13. INVOICE_PERIOD_MISMATCH Check
  if (input.invoiceRecord && records.length > 0) {
    const invStart = Date.parse(input.invoiceRecord.startDate);
    const invEnd = Date.parse(input.invoiceRecord.endDate);
    const firstTelemetry = Date.parse(records[0].timestamp_utc);
    const lastTelemetry = Date.parse(records[records.length - 1].timestamp_utc);

    if (firstTelemetry > invStart || lastTelemetry < invEnd) {
      addIssue("INVOICE_PERIOD_MISMATCH", "Invoice Period Mismatch", "HIGH", 10, "Telemetry interval date range does not cover full invoice billing period", [1], 1200.0);
    }

    // 14. METER_INVOICE_MISMATCH Check
    if (input.invoiceRecord.meterNumber && records[0].meter_id && !records[0].meter_id.includes(input.invoiceRecord.meterNumber)) {
      addIssue("METER_INVOICE_MISMATCH", "Meter / Invoice ID Mismatch", "CRITICAL", 15, `Invoice meter number '${input.invoiceRecord.meterNumber}' does not match telemetry meter ID '${records[0].meter_id}'`, [1], 4500.0);
    }

    // 15. TARIFF_MISMATCH Check
    if (input.siteTariffCode && input.invoiceRecord.tariffCode !== input.siteTariffCode) {
      addIssue("TARIFF_MISMATCH", "Tariff Schedule Mismatch", "HIGH", 10, `Invoice tariff '${input.invoiceRecord.tariffCode}' differs from assigned site tariff '${input.siteTariffCode}'`, [1], 3200.0);
    }
  }

  // Calculate Overall Quality Score
  const totalDeductions = deductions.reduce((sum, d) => sum + d.deduction, 0);
  const overallScore = Math.max(0, Math.min(100, 100 - totalDeductions));

  // Determine Classification
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
    issues,
    scoreDeductions: deductions,
    evaluatedIntervalsCount: records.length,
    evaluatedInvoiceNo: input.invoiceRecord?.invoiceNumber,
    evaluatedAt: new Date().toISOString(),
  };
}
