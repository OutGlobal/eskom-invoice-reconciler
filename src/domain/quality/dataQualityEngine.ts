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
  DataQualityStatus,
  QualityRuleCode,
  ValidationFinding,
  ValidationReport,
  PreReconciliationDataset,
  DataQualityEngineOptions,
} from "./types";

export class DataGovernanceEngine {
  /**
   * Calculate 5-Entity Quality Scores (Invoice, Meter, Telemetry Batch, Site, Reconciliation)
   */
  public static calculateScores(issues: DataQualityIssueRecord[]): FiveEntityScoreSummary {
    const activeUnresolvedIssues = issues.filter(
      (i) => i.resolution_status === "UNRESOLVED" || i.resolution_status === "UNDER_REVIEW",
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
    hasExplicitOverridePathway: boolean = false,
  ): GatekeeperValidationResult {
    const blockingIssues = issues.filter(
      (i) =>
        (i.severity === "CRITICAL" || i.severity === "HIGH") &&
        i.resolution_status !== "RESOLVED" &&
        i.resolution_status !== "EXPLICITLY_OVERRIDDEN",
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


}

export function evaluateDataQuality(
  input: QualityAssessmentInput,
): DataQualityAssessmentResult & { issuesCount: number } {
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
    if (
      r.interval_minutes !== undefined &&
      r.interval_minutes !== 15 &&
      r.interval_minutes !== 30
    ) {
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
    const invStart = input.invoiceRecord.startDate
      ? Date.parse(input.invoiceRecord.startDate)
      : NaN;
    const invEnd = input.invoiceRecord.endDate ? Date.parse(input.invoiceRecord.endDate) : NaN;
    const firstTelemetry = records[0].timestamp_utc ? Date.parse(records[0].timestamp_utc) : NaN;
    const lastTelemetry = records[records.length - 1].timestamp_utc
      ? Date.parse(records[records.length - 1].timestamp_utc)
      : NaN;

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

/**
 * Stage 11 — Authoritative Pre-Reconciliation Data Quality Engine
 *
 * Validates telemetry, invoice determinants, and paired reconciliation datasets across
 * 15 mandatory anomaly categories before reconciliation.
 *
 * Guarantees non-destructive validation: suspicious records are flagged with rich diagnostic
 * metadata, never silently deleted or dropped.
 */
export class DataQualityEngine {
  public static readonly VERSION = "Stage11-v1.0";

  /**
   * Pre-Reconciliation Data Validation & Quality Assessment
   */
  public static validatePreReconciliation(
    dataset: PreReconciliationDataset,
    options?: DataQualityEngineOptions,
  ): ValidationReport {
    const reportId = `DQR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const evaluatedAt = new Date().toISOString();
    const findings: ValidationFinding[] = [];
    const statusCounts: Record<DataQualityStatus, number> = {
      VALID: 0,
      WARNING: 0,
      INVALID: 0,
      INCOMPLETE: 0,
    };
    const ruleCounts: Partial<Record<QualityRuleCode, number>> = {};

    const intervals = dataset.intervals || [];
    const invoice = dataset.invoice;
    const nmdLimit = options?.nmdKvaLimit ?? dataset.nmd_kva_limit ?? 250;
    const expectedCadence = dataset.expected_interval_minutes || 30;
    const allowNegativeGen =
      options?.allowNegativeGeneration ?? dataset.allow_negative_generation ?? false;
    const refNow = options?.referenceNow || dataset.reference_now || new Date();
    const clockToleranceMs = (options?.toleranceMinutes ?? 60) * 60 * 1000;
    const kwhVarianceTolerancePct = options?.kwhVarianceTolerancePct ?? 5.0;

    const helperAddFinding = (finding: Omit<ValidationFinding, "id" | "created_at">) => {
      const fullFinding: ValidationFinding = {
        ...finding,
        id: `FND-${finding.rule_code}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        source_file_id: dataset.source_file_id,
        affected_meter_id:
          dataset.intervals?.[0]?.meter_id || invoice?.meterNumber || invoice?.meter_number,
        affected_account_number: invoice?.accountNumber || invoice?.account_number,
        created_at: evaluatedAt,
      };
      findings.push(fullFinding);
      statusCounts[fullFinding.status] = (statusCounts[fullFinding.status] || 0) + 1;
      ruleCounts[fullFinding.rule_code] = (ruleCounts[fullFinding.rule_code] || 0) + 1;
    };

    const flaggedIntervals: any[] = [];
    let flaggedCount = 0;

    const missingTimestampRows: number[] = [];
    const invalidDateRows: number[] = [];
    const futureDateRows: number[] = [];
    const negativeConsumptionRows: number[] = [];
    const impossibleReadingRows: number[] = [];
    const incorrectDurationRows: number[] = [];
    const unitMismatchRows: number[] = [];
    const touMismatchRows: number[] = [];
    const meterResetRows: number[] = [];
    const missingMeterRows: number[] = [];

    const seenTimestamps = new Map<string, number[]>();
    const parsedValidIntervals: Array<{
      date: Date;
      timeMs: number;
      rowNum: number;
      intervalObj: any;
      durationMinutes: number;
    }> = [];

    let prevRegisterVal: number | null = null;

    for (let i = 0; i < intervals.length; i++) {
      const row = intervals[i];
      const rowNum = row.source_row_number ?? i + 1;
      const flags: string[] = [];

      // 1. Check Missing Meter Identifier on interval
      const mId = row.meter_id || row.meterId || row.meter_number || row.meterNumber;
      if (!mId || String(mId).trim() === "" || String(mId).toUpperCase().includes("UNASSIGNED")) {
        missingMeterRows.push(rowNum);
        flags.push("MISSING_METER_IDENTIFIER");
      }

      // 2. Check Missing Timestamps
      const rawTs = row.timestamp ?? row.timestamp_utc ?? row.local_timestamp ?? row.ts;
      if (!rawTs || (typeof rawTs === "string" && rawTs.trim() === "")) {
        missingTimestampRows.push(rowNum);
        flags.push("MISSING_TIMESTAMP");
      } else {
        // 3. Check Invalid Dates
        const parsedDate =
          rawTs instanceof Date
            ? rawTs
            : new Date(typeof rawTs === "string" ? rawTs.replace(/\//g, "-") : rawTs);
        if (isNaN(parsedDate.getTime())) {
          invalidDateRows.push(rowNum);
          flags.push("INVALID_DATE");
        } else {
          const timeMs = parsedDate.getTime();

          // 4. Check Future Dates
          if (timeMs > refNow.getTime() + clockToleranceMs) {
            futureDateRows.push(rowNum);
            flags.push("FUTURE_DATE");
          }

          // 5. Check Duplicate Timestamps (scoped to meter)
          const meterKey = `${mId || "default"}__${parsedDate.toISOString()}`;
          const existingRows = seenTimestamps.get(meterKey);
          if (existingRows) {
            existingRows.push(rowNum);
            flags.push("DUPLICATE_TIMESTAMP");
          } else {
            seenTimestamps.set(meterKey, [rowNum]);
          }

          // Capture interval duration
          const intervalDuration =
            row.interval_minutes ??
            row.interval_duration_minutes ??
            row.intervalMinutes ??
            expectedCadence;
          if (
            intervalDuration !== 5 &&
            intervalDuration !== 15 &&
            intervalDuration !== 30 &&
            intervalDuration !== 60
          ) {
            incorrectDurationRows.push(rowNum);
            flags.push("INCORRECT_INTERVAL_DURATION");
          } else if (dataset.expected_interval_minutes && intervalDuration !== expectedCadence) {
            incorrectDurationRows.push(rowNum);
            flags.push("INCORRECT_INTERVAL_DURATION");
          }

          parsedValidIntervals.push({
            date: parsedDate,
            timeMs,
            rowNum,
            intervalObj: row,
            durationMinutes: intervalDuration,
          });
        }
      }

      // 6. Check Negative Consumption Where Invalid
      const activeKwh =
        row.kwh ??
        row.active_energy_kwh ??
        (row.channel === "kWh" ? row.engineering_value : undefined);
      const activeKw =
        row.kw ??
        row.active_power_kw ??
        row.kW ??
        (row.channel === "kW" ? row.engineering_value : undefined);
      if (!allowNegativeGen) {
        if (
          (activeKwh !== undefined && activeKwh < -0.001) ||
          (activeKw !== undefined && activeKw < -0.001)
        ) {
          negativeConsumptionRows.push(rowNum);
          flags.push("NEGATIVE_CONSUMPTION");
        }
      }

      // 7. Check Impossible Readings
      const appKva =
        row.kva ??
        row.apparent_power_kva ??
        row.kVA ??
        (row.channel === "kVA" ? row.engineering_value : undefined);
      const pf =
        row.power_factor ??
        row.pf ??
        (row.channel === "power_factor" ? row.engineering_value : undefined);

      let isImpossible = false;
      if (appKva !== undefined && appKva > nmdLimit * 3.0) {
        isImpossible = true;
      }
      if (activeKw !== undefined && activeKw > nmdLimit * 3.0) {
        isImpossible = true;
      }
      if (pf !== undefined && (pf < -1.01 || pf > 1.01)) {
        isImpossible = true;
      }
      if (activeKw !== undefined && appKva !== undefined && activeKw > appKva + 1.0) {
        isImpossible = true;
      }
      if (isImpossible) {
        impossibleReadingRows.push(rowNum);
        flags.push("IMPOSSIBLE_READING");
      }

      // 8. Check Meter Resets
      const cumRegister =
        row.cumulative_register ??
        row.cumulativeKwh ??
        row.raw_cumulative_register ??
        row.rawCumulative;
      if (cumRegister !== undefined && !isNaN(cumRegister)) {
        if (prevRegisterVal !== null && cumRegister < prevRegisterVal) {
          meterResetRows.push(rowNum);
          flags.push("METER_RESET");
        }
        prevRegisterVal = cumRegister;
      }

      // 9. Check Unit Mismatches
      if (
        row.source_units?.active_power === "W" &&
        row.kw !== undefined &&
        row.source_values?.active_power === row.kw
      ) {
        unitMismatchRows.push(rowNum);
        flags.push("UNIT_MISMATCH");
      }
      if (row.channel === "kVA" && row.kwh !== undefined && row.kwh > 0 && row.kw === undefined) {
        unitMismatchRows.push(rowNum);
        flags.push("UNIT_MISMATCH");
      }

      // 10. Check Inconsistent TOU Totals within interval
      if (
        row.peak_kwh !== undefined &&
        row.standard_kwh !== undefined &&
        row.off_peak_kwh !== undefined &&
        row.kwh !== undefined
      ) {
        const sumTou = row.peak_kwh + row.standard_kwh + row.off_peak_kwh;
        if (Math.abs(sumTou - row.kwh) > 0.05) {
          touMismatchRows.push(rowNum);
          flags.push("INCONSISTENT_TOTALS");
        }
      }

      // Non-Destructive Flagging Guarantee
      const isFlagged = flags.length > 0;
      if (isFlagged) {
        flaggedCount++;
      }
      flaggedIntervals.push({
        ...row,
        is_flagged: isFlagged,
        quality_flags: flags,
        quality_status: isFlagged
          ? flags.includes("NEGATIVE_CONSUMPTION") ||
            flags.includes("IMPOSSIBLE_READING") ||
            flags.includes("INVALID_DATE")
            ? "invalid"
            : "suspect"
          : row.quality_status || "validated",
      });
    }

    // Process Chronological Sequence for Missing Intervals & Overlaps
    parsedValidIntervals.sort((a, b) => a.timeMs - b.timeMs);
    const missingIntervalGaps: Array<{ start: string; end: string; missingCount: number }> = [];
    const overlappingRows: number[] = [];

    for (let j = 0; j < parsedValidIntervals.length - 1; j++) {
      const curr = parsedValidIntervals[j];
      const next = parsedValidIntervals[j + 1];
      const diffMs = next.timeMs - curr.timeMs;
      const expectedStepMs = curr.durationMinutes * 60 * 1000;

      // Overlapping intervals: next interval starts before current interval has elapsed
      if (diffMs < expectedStepMs - 1000 && diffMs > 0) {
        overlappingRows.push(next.rowNum);
      }

      // Missing intervals: gap exceeds expected interval duration
      if (diffMs > expectedStepMs + 1000) {
        const missingCount = Math.floor(diffMs / expectedStepMs) - 1;
        if (missingCount > 0) {
          missingIntervalGaps.push({
            start: curr.date.toISOString(),
            end: next.date.toISOString(),
            missingCount,
          });
        }
      }
    }

    // Consolidate Findings across the 15 Rules:

    // Rule 1: Missing Timestamps
    if (missingTimestampRows.length > 0) {
      helperAddFinding({
        rule_code: "MISSING_TIMESTAMPS",
        status: "INCOMPLETE",
        severity: "CRITICAL",
        title: "Missing Telemetry Timestamps",
        description: `Found ${missingTimestampRows.length} interval records with missing or empty timestamp values.`,
        recommended_action: "Inspect source data file and verify timestamp column mapping.",
        affected_count: missingTimestampRows.length,
        affected_row_numbers: missingTimestampRows.slice(0, 50),
      });
    }

    // Rule 2: Duplicate Timestamps
    const duplicateRows: number[] = [];
    for (const [, rows] of seenTimestamps.entries()) {
      if (rows.length > 1) {
        duplicateRows.push(...rows.slice(1));
      }
    }
    if (duplicateRows.length > 0) {
      helperAddFinding({
        rule_code: "DUPLICATE_TIMESTAMPS",
        status: duplicateRows.length > 10 ? "INVALID" : "WARNING",
        severity: duplicateRows.length > 10 ? "HIGH" : "MEDIUM",
        title: "Duplicate Interval Timestamps",
        description: `Detected ${duplicateRows.length} duplicate timestamp readings for the same meter identifier.`,
        recommended_action:
          "Apply deduplication policy or re-export intervals with unified temporal index.",
        affected_count: duplicateRows.length,
        affected_row_numbers: duplicateRows.slice(0, 50),
      });
    }

    // Rule 3: Invalid Dates
    if (invalidDateRows.length > 0) {
      helperAddFinding({
        rule_code: "INVALID_DATES",
        status: "INVALID",
        severity: "CRITICAL",
        title: "Invalid or Unparseable Date Values",
        description: `Encountered ${invalidDateRows.length} interval records with unparseable date strings.`,
        recommended_action: "Verify file date-time format string (e.g. YYYY-MM-DD vs DD/MM/YYYY).",
        affected_count: invalidDateRows.length,
        affected_row_numbers: invalidDateRows.slice(0, 50),
      });
    }

    // Rule 4: Future Dates
    if (futureDateRows.length > 0) {
      helperAddFinding({
        rule_code: "FUTURE_DATES",
        status: "INVALID",
        severity: "HIGH",
        title: "Future Dated Telemetry Readings",
        description: `Found ${futureDateRows.length} intervals with timestamps extending beyond reference clock time.`,
        recommended_action: "Check meter clock synchronization and time zone configuration.",
        affected_count: futureDateRows.length,
        affected_row_numbers: futureDateRows.slice(0, 50),
      });
    }

    // Rule 5: Negative Consumption
    if (negativeConsumptionRows.length > 0) {
      helperAddFinding({
        rule_code: "NEGATIVE_CONSUMPTION",
        status: "INVALID",
        severity: "CRITICAL",
        title: "Negative Energy Consumption on Non-Generating Site",
        description: `Detected ${negativeConsumptionRows.length} interval readings with negative active energy/power on an import-only premise.`,
        recommended_action:
          "Check current transformer (CT) polarity or confirm if premise possesses solar/embedded generation.",
        affected_count: negativeConsumptionRows.length,
        affected_row_numbers: negativeConsumptionRows.slice(0, 50),
      });
    }

    // Rule 6: Impossible Readings
    if (impossibleReadingRows.length > 0) {
      helperAddFinding({
        rule_code: "IMPOSSIBLE_READINGS",
        status: "INVALID",
        severity: "CRITICAL",
        title: "Impossible Physical Electrical Readings",
        description: `Identified ${impossibleReadingRows.length} readings violating physical boundaries (>300% NMD, PF outside [-1.0, 1.0], or kW > kVA).`,
        recommended_action:
          "Validate meter multiplier factors (CT/VT ratios) and hardware calibration.",
        affected_count: impossibleReadingRows.length,
        affected_row_numbers: impossibleReadingRows.slice(0, 50),
      });
    }

    // Rule 7: Meter Resets
    if (meterResetRows.length > 0) {
      helperAddFinding({
        rule_code: "METER_RESETS",
        status: "WARNING",
        severity: "HIGH",
        title: "Cumulative Meter Register Reset / Roll Event",
        description: `Detected ${meterResetRows.length} instances where cumulative dial registers decreased without prior rollover flag.`,
        recommended_action:
          "Verify dial rollover capacity (e.g. 1M / 10M kWh ceiling) or meter replacement event.",
        affected_count: meterResetRows.length,
        affected_row_numbers: meterResetRows.slice(0, 50),
      });
    }

    // Rule 8: Missing Intervals (Gaps)
    if (missingIntervalGaps.length > 0) {
      const totalMissing = missingIntervalGaps.reduce((sum, g) => sum + g.missingCount, 0);
      const isLargeGap = missingIntervalGaps.some((g) => g.missingCount > 4);
      helperAddFinding({
        rule_code: "MISSING_INTERVALS",
        status: isLargeGap ? "INCOMPLETE" : "WARNING",
        severity: isLargeGap ? "HIGH" : "MEDIUM",
        title: "Missing Interval Time Gaps",
        description: `Found ${missingIntervalGaps.length} chronological gaps accounting for ${totalMissing} missing interval periods.`,
        recommended_action: isLargeGap
          ? "Request AMR re-polling or complete file re-export before running financial reconciliation."
          : "Apply authorized linear estimation for gaps under 2 hours.",
        affected_count: totalMissing,
        affected_timestamps: missingIntervalGaps.map((g) => `${g.start} to ${g.end}`),
      });
    }

    // Rule 9: Overlapping Intervals
    if (overlappingRows.length > 0) {
      helperAddFinding({
        rule_code: "OVERLAPPING_INTERVALS",
        status: "INVALID",
        severity: "HIGH",
        title: "Overlapping Telemetry Intervals",
        description: `Identified ${overlappingRows.length} intervals overlapping preceding reading durations.`,
        recommended_action:
          "Check for multi-meter channel collision or uncoordinated telemetry concatenation.",
        affected_count: overlappingRows.length,
        affected_row_numbers: overlappingRows.slice(0, 50),
      });
    }

    // Rule 10: Incorrect Interval Duration
    if (incorrectDurationRows.length > 0) {
      helperAddFinding({
        rule_code: "INCORRECT_INTERVAL_DURATION",
        status: "WARNING",
        severity: "MEDIUM",
        title: "Non-Standard Interval Duration",
        description: `Found ${incorrectDurationRows.length} intervals deviating from expected ${expectedCadence}-minute cadence.`,
        recommended_action: "Align integration duration setting with meter configuration profile.",
        affected_count: incorrectDurationRows.length,
        affected_row_numbers: incorrectDurationRows.slice(0, 50),
      });
    }

    // Rule 11: Unit Mismatches
    if (unitMismatchRows.length > 0) {
      helperAddFinding({
        rule_code: "UNIT_MISMATCHES",
        status: "INVALID",
        severity: "HIGH",
        title: "Physical Unit Discordance / Channel Inversion",
        description: `Detected ${unitMismatchRows.length} intervals with mismatched engineering units or unscaled metric prefixes.`,
        recommended_action:
          "Enforce Stage 10 Canonical Unit Normalisation scaling prior to ingestion.",
        affected_count: unitMismatchRows.length,
        affected_row_numbers: unitMismatchRows.slice(0, 50),
      });
    }

    // Rule 12: Inconsistent Totals
    if (touMismatchRows.length > 0) {
      helperAddFinding({
        rule_code: "INCONSISTENT_TOTALS",
        status: "INVALID",
        severity: "HIGH",
        title: "TOU Bucket Sum Inconsistency",
        description: `Found ${touMismatchRows.length} intervals where peak_kwh + standard_kwh + off_peak_kwh deviates from total kwh.`,
        recommended_action: "Recompute TOU decomposition via statutory NERSA calendar schedules.",
        affected_count: touMismatchRows.length,
        affected_row_numbers: touMismatchRows.slice(0, 50),
      });
    }
    if (
      invoice &&
      (invoice.totalKwh !== undefined || invoice.total_kwh !== undefined) &&
      intervals.length > 0
    ) {
      const invTotalKwh = invoice.totalKwh ?? invoice.total_kwh ?? 0;
      const sumIntervalKwh = intervals.reduce(
        (acc, r) => acc + (r.kwh ?? r.active_energy_kwh ?? 0),
        0,
      );
      if (
        invTotalKwh > 0 &&
        sumIntervalKwh > 0 &&
        missingTimestampRows.length === 0 &&
        invalidDateRows.length === 0
      ) {
        const diffPct = (Math.abs(sumIntervalKwh - invTotalKwh) / invTotalKwh) * 100;
        if (diffPct > kwhVarianceTolerancePct) {
          helperAddFinding({
            rule_code: "INCONSISTENT_TOTALS",
            status: diffPct > 15 ? "INVALID" : "WARNING",
            severity: diffPct > 15 ? "HIGH" : "MEDIUM",
            title: "Discrepancy Between Interval Sum and Invoiced Energy",
            description: `Sum of interval active energy (${sumIntervalKwh.toFixed(1)} kWh) differs from billed invoice total (${invTotalKwh.toFixed(1)} kWh) by ${diffPct.toFixed(2)}%.`,
            recommended_action: "Inspect billing period boundaries or verify meter multipliers.",
            affected_count: intervals.length,
          });
        }
      }
    }

    // Rule 13: Missing Billing Periods
    if (invoice) {
      const bStart = invoice.billingStart || invoice.billing_start;
      const bEnd = invoice.billingEnd || invoice.billing_end;
      if (!bStart || !bEnd || String(bStart).trim() === "" || String(bEnd).trim() === "") {
        helperAddFinding({
          rule_code: "MISSING_BILLING_PERIODS",
          status: "INCOMPLETE",
          severity: "CRITICAL",
          title: "Missing Billing Period Dates",
          description: "Invoice or target dataset lacks billing period start and/or end date.",
          recommended_action:
            "Extract valid billing period from invoice document before running reconciliation.",
          affected_count: 1,
        });
      }
    }

    // Rule 14: Missing Meter Identifiers
    const invMeter = invoice?.meterNumber || invoice?.meter_number || invoice?.meter_id;
    if (invoice && (!invMeter || String(invMeter).trim() === "")) {
      helperAddFinding({
        rule_code: "MISSING_METER_IDENTIFIERS",
        status: "INCOMPLETE",
        severity: "CRITICAL",
        title: "Missing Invoice Meter Identifier",
        description: "Invoice determinant structure does not specify a meter number.",
        recommended_action: "Assign valid meter identifier to invoice before linking telemetry.",
        affected_count: 1,
      });
    }
    if (missingMeterRows.length > 0) {
      helperAddFinding({
        rule_code: "MISSING_METER_IDENTIFIERS",
        status: "INCOMPLETE",
        severity: "HIGH",
        title: "Missing Meter ID in Interval Telemetry",
        description: `Found ${missingMeterRows.length} interval rows lacking a valid meter identifier.`,
        recommended_action:
          "Assign meter ID from file metadata or customer premise asset register.",
        affected_count: missingMeterRows.length,
        affected_row_numbers: missingMeterRows.slice(0, 50),
      });
    }

    // Rule 15: Missing Account Identifiers
    if (invoice) {
      const accNo = invoice.accountNumber || invoice.account_number;
      if (!accNo || String(accNo).trim() === "") {
        helperAddFinding({
          rule_code: "MISSING_ACCOUNT_IDENTIFIERS",
          status: "INCOMPLETE",
          severity: "CRITICAL",
          title: "Missing Customer Account Identifier",
          description: "Invoice dataset lacks customer account number.",
          recommended_action:
            "Provide Eskom or municipal account number for billing reconciliation.",
          affected_count: 1,
        });
      }
    }

    // Resolve Overall Data-Quality Status
    let overallStatus: DataQualityStatus = "VALID";
    if (findings.some((f) => f.status === "INVALID")) {
      overallStatus = "INVALID";
    } else if (findings.some((f) => f.status === "INCOMPLETE")) {
      overallStatus = "INCOMPLETE";
    } else if (findings.some((f) => f.status === "WARNING")) {
      overallStatus = "WARNING";
    }

    // Calculate Quality Score (0 to 100)
    let totalDeductions = 0;
    for (const f of findings) {
      if (f.severity === "CRITICAL") totalDeductions += 25;
      else if (f.severity === "HIGH") totalDeductions += 15;
      else if (f.severity === "MEDIUM") totalDeductions += 5;
      else totalDeductions += 2;
    }
    const qualityScore = Math.max(0, Math.min(100, 100 - totalDeductions));
    const canProceed = overallStatus === "VALID" || overallStatus === "WARNING";

    return {
      report_id: reportId,
      overall_status: overallStatus,
      quality_score: qualityScore,
      evaluated_at: evaluatedAt,
      batch_id: dataset.batch_id,
      source_file_id: dataset.source_file_id,
      meter_id: dataset.intervals?.[0]?.meter_id || invoice?.meterNumber || invoice?.meter_number,
      account_number: invoice?.accountNumber || invoice?.account_number,
      total_records_evaluated: intervals.length,
      flagged_records_count: flaggedCount,
      findings,
      status_counts: statusCounts,
      rule_counts: ruleCounts,
      can_proceed_to_reconciliation: canProceed,
      flagged_intervals: flaggedIntervals,
    };
  }
}
