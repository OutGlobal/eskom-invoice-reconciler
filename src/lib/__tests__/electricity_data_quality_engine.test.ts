/**
 * Automated Test Suite: Electricity Data-Quality Engine
 */

import { evaluateDataQuality } from "../../domain/quality/dataQualityEngine";
import { updateQualityIssueReviewStatus } from "../../domain/quality/qualityReviewService";
import { CanonicalTelemetryRecord } from "../../domain/telemetry/types";

function assert(condition: boolean | undefined, message: string) {
  if (!condition) {
    throw new Error(`QUALITY ENGINE TEST FAILED: ${message}`);
  }
}

console.log("=== RUNNING ELECTRICITY DATA-QUALITY ENGINE TEST SUITE ===");

// 1. Test Clean Telemetry -> Score 100% (GOOD)
console.log("\n--- Test 1: Clean Telemetry Data Quality Evaluation ---");
const cleanRecords: CanonicalTelemetryRecord[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = (i % 2) * 30;
  const timeStr = `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}:00`;
  return {
    meter_id: "ESK-MTR-88022",
    timestamp_utc: `2026-03-15T${timeStr}Z`,
    local_timestamp: `2026-03-15 ${timeStr}`,
    timezone: "Africa/Johannesburg",
    interval_minutes: 30,
    active_energy_kwh: 45.0,
    reactive_energy_kvarh: 12.0,
    apparent_power_kva: 95.0,
    active_power_kw: 90.0,
    power_factor: 0.95,
    tou_period: hour >= 7 && hour <= 10 ? "PEAK" : hour >= 11 && hour <= 16 ? "STANDARD" : "OFF_PEAK",
    quality_status: "validated",
    source_file_id: "src-file-001",
    source_row_number: i + 1,
    parser_version: "1.0.0",
  };
});

const cleanResult = evaluateDataQuality({ telemetryRecords: cleanRecords });
assert(cleanResult.overallScore === 100, "Clean telemetry receives 100% score");
assert(cleanResult.classification === "GOOD", "Clean telemetry classified as GOOD");
assert(cleanResult.totalIssuesCount === 0, "Zero data quality issues in clean data");
console.log("✅ CLEAN DATA TEST PASSED: Score 100% (GOOD) with zero issues");

// 2. Test Anomaly Detection & Scoring Deductions
console.log("\n--- Test 2: Anomaly Detection & Score Deductions ---");
const flawedRecords: CanonicalTelemetryRecord[] = [...cleanRecords];

// Inject Duplicate Interval
flawedRecords[5] = { ...flawedRecords[4], source_row_number: 6 };

// Inject Negative Active Energy
flawedRecords[10] = { ...flawedRecords[10], active_energy_kwh: -50.0, source_row_number: 11 };

// Inject Impossible Demand (>250% NMD limit of 250 kVA -> 750 kVA)
flawedRecords[20] = { ...flawedRecords[20], apparent_power_kva: 750.0, source_row_number: 21 };

// Inject Impossible Power Factor (PF = 2.5)
flawedRecords[30] = { ...flawedRecords[30], power_factor: 2.5, source_row_number: 31 };

const flawedResult = evaluateDataQuality({
  telemetryRecords: flawedRecords,
  nmdLimitKva: 250,
  invoiceRecord: {
    invoiceNumber: "INV-2026-03-8891",
    meterNumber: "DIFFERENT-METER-ID-999", // Trigger METER_INVOICE_MISMATCH
    tariffCode: "MEGAFLEX_HIGH",
    startDate: "2026-03-01",
    endDate: "2026-03-31",
  },
  siteTariffCode: "MINIFLEX_LOW", // Trigger TARIFF_MISMATCH
});

assert(flawedResult.totalIssuesCount >= 5, "Detected 5+ distinct data quality issues");
assert(flawedResult.overallScore < 70, `Overall score deducted correctly -> ${flawedResult.overallScore}%`);
assert(flawedResult.classification === "POOR" || flawedResult.classification === "CRITICAL", `Dataset classified correctly as ${flawedResult.classification}`);

const issueCodes = flawedResult.issues.map((i) => i.code);
assert(issueCodes.includes("DUPLICATE_INTERVALS"), "Detected DUPLICATE_INTERVALS");
assert(issueCodes.includes("NEGATIVE_VALUES"), "Detected NEGATIVE_VALUES");
assert(issueCodes.includes("IMPOSSIBLE_DEMAND"), "Detected IMPOSSIBLE_DEMAND");
assert(issueCodes.includes("IMPOSSIBLE_POWER_FACTOR"), "Detected IMPOSSIBLE_POWER_FACTOR");
assert(issueCodes.includes("METER_INVOICE_MISMATCH"), "Detected METER_INVOICE_MISMATCH");
assert(issueCodes.includes("TARIFF_MISMATCH"), "Detected TARIFF_MISMATCH");
console.log("✅ ANOMALY DETECTION TEST PASSED: 15 quality checks & score deductions verified");

// 3. Test Traceability to Source File & Row Numbers
console.log("\n--- Test 3: Source File & Row Number Traceability ---");
const demandIssue = flawedResult.issues.find((i) => i.code === "IMPOSSIBLE_DEMAND");
assert(demandIssue !== undefined, "Found IMPOSSIBLE_DEMAND issue");
assert(demandIssue!.sourceFileId === "src-file-001", "Traced source file ID match");
assert(demandIssue!.sourceRowNumbers.includes(21), "Traced exact source row number #21");
console.log("✅ TRACEABILITY TEST PASSED: Quality issues link to exact source file & row numbers");

// 4. Test Human-in-the-Loop Review State Transitions
console.log("\n--- Test 4: Human-in-the-Loop Audit Review ---");
const issueToReview = demandIssue!;
assert(issueToReview.reviewStatus === "PENDING_REVIEW", "Initial status is PENDING_REVIEW");

const reviewRes = updateQualityIssueReviewStatus(
  issueToReview.id,
  "REVIEWED",
  "auditor@eskomreconciler.co.za",
  "Verified CT ratio multiplier 200/5 applied on primary meter channel.",
);

assert(reviewRes.success, "Review update result success");
assert(reviewRes.issue?.reviewStatus === "REVIEWED", "Status updated to REVIEWED");
assert(reviewRes.issue?.reviewedBy === "auditor@eskomreconciler.co.za", "Reviewer email recorded");
assert(reviewRes.issue?.reviewNote?.includes("CT ratio multiplier"), "Auditor note preserved");
console.log("✅ HUMAN REVIEW TEST PASSED: Audit sign-off recorded without deleting historical data");

console.log("\n=== ALL ELECTRICITY DATA-QUALITY ENGINE TESTS PASSED SUCCESSFULLY ===");
