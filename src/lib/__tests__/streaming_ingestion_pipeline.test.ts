import { StreamingIngestionService } from "../../domain/services/streamingIngestionService";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ STREAMING TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ STREAMING TEST PASSED: ${message}`);
}

async function runStreamingPipelineTests() {
  console.log("=== RUNNING ENTERPRISE STREAMING INGESTION PIPELINE TEST SUITE ===");

  // Test 1: Large Synthetic Dataset Streaming (1,000+ Rows)
  console.log("\n--- Test 1: Large Synthetic Telemetry Dataset Streaming ---");
  const largeCsvLines = ["Timestamp,kW,kVARh,kVA,PowerFactor"];
  const baseDate = new Date("2026-03-01T00:00:00Z");
  for (let i = 0; i < 1000; i++) {
    const d = new Date(baseDate.getTime() + i * 30 * 60 * 1000);
    const tsStr = d.toISOString();
    const kw = (50000 + (i % 100) * 100).toFixed(2);
    const kvar = (15000 + (i % 50) * 50).toFixed(2);
    const kva = (52000 + (i % 100) * 100).toFixed(2);
    largeCsvLines.push(`${tsStr},${kw},${kvar},${kva},0.96`);
  }
  const largeCsv = largeCsvLines.join("\n");

  let progressCalled = false;
  const largeSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "large_meter_telemetry_1k.csv", size: largeCsv.length, content: largeCsv },
    (pct, rows) => {
      progressCalled = true;
    }
  );

  assert(progressCalled, "Progress callback was invoked during streaming chunk processing");
  assert(largeSummary.rowsSeen === 1000, `Rows seen matches 1000 input lines (actual: ${largeSummary.rowsSeen})`);
  assert(largeSummary.rowsImported === 1000, `All 1000 valid synthetic rows imported (actual: ${largeSummary.rowsImported})`);
  assert(largeSummary.rowsRejected === 0, "Zero rows rejected in valid synthetic stream");
  assert(largeSummary.status === "completed", "Job status is 'completed'");

  // Test 2: Idempotency (Duplicate File Upload Detection)
  console.log("\n--- Test 2: SHA-256 Idempotency Duplicate Detection ---");
  const dupSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "large_meter_telemetry_1k.csv", size: largeCsv.length, content: largeCsv }
  );
  assert(dupSummary.isDuplicateFile, "Duplicate SHA-256 file hash detected on re-upload");
  assert(dupSummary.rowsDuplicate === 1, "Duplicate file record tracked in summary metrics");

  // Test 3: Malformed CSVs (Mismatched / Missing Columns)
  console.log("\n--- Test 3: Malformed CSV Row Rejection ---");
  const malformedCsv = [
    "Timestamp,kW,kVARh,kVA,PowerFactor",
    "2026-03-01T00:00:00Z,50000,15000,52000,0.96",
    "INVALID_MALFORMED_LINE_WITHOUT_COMMAS",
    "2026-03-01T01:00:00Z,51000,15500,53000,0.96",
  ].join("\n");

  const malformedSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "malformed_test.csv", size: malformedCsv.length, content: malformedCsv }
  );

  assert(malformedSummary.rowsSeen === 3, "Rows seen count includes malformed row");
  assert(malformedSummary.rowsImported === 2, "Imported valid rows (2 valid rows processed)");
  assert(malformedSummary.rowsRejected === 1, "Rejected 1 malformed row without crashing pipeline");
  assert(malformedSummary.status === "completed_with_warnings", "Job completed with warnings status");
  assert(malformedSummary.errors.some((e) => e.errorCode === "MISMATCHED_COLUMN_COUNT"), "Mismatched column count error recorded");

  // Test 4: Missing Required Columns in Header
  console.log("\n--- Test 4: Missing Required Header Columns ---");
  const missingColCsv = [
    "RandomCol1,RandomCol2,RandomCol3",
    "Val1,Val2,Val3",
  ].join("\n");

  const missingColSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "missing_columns.csv", size: missingColCsv.length, content: missingColCsv }
  );

  assert(missingColSummary.status === "failed", "Job failed when required timestamp/active power header columns are missing");
  assert(missingColSummary.errors.some((e) => e.errorCode === "MISSING_REQUIRED_COLUMN"), "Missing required column error logged");

  // Test 5: Unexpected Extra Columns
  console.log("\n--- Test 5: Unexpected Extra Columns ---");
  const extraColCsv = [
    "Timestamp,kW,kVARh,kVA,PowerFactor,UnexpectedVendorCode,UnknownSensorMetadata",
    "2026-03-01T00:00:00Z,50000,15000,52000,0.96,VENDOR_XYZ,SENSOR_99",
  ].join("\n");

  const extraColSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "extra_columns.csv", size: extraColCsv.length, content: extraColCsv }
  );

  assert(extraColSummary.warnings.some((w) => w.includes("unexpected column")), "Transformation warning logged for unexpected extra columns");
  assert(extraColSummary.rowsImported === 1, "Valid row imported despite unexpected columns");

  // Test 6: Invalid Timestamp Values
  console.log("\n--- Test 6: Invalid Timestamp Strings ---");
  const invalidTsCsv = [
    "Timestamp,kW,kVARh,kVA,PowerFactor",
    "2026-02-31 25:61:00,50000,15000,52000,0.96",
    "NOT_A_DATE,50000,15000,52000,0.96",
  ].join("\n");

  const invalidTsSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "invalid_ts.csv", size: invalidTsCsv.length, content: invalidTsCsv }
  );

  assert(invalidTsSummary.rowsRejected === 2, "Rejected 2 invalid timestamp rows");
  assert(invalidTsSummary.errors.filter((e) => e.errorCode === "INVALID_TIMESTAMP").length === 2, "Logged 2 INVALID_TIMESTAMP error records");

  // Test 7: Invalid Numerical Values
  console.log("\n--- Test 7: Non-Numeric Active Power Values ---");
  const invalidNumCsv = [
    "Timestamp,kW,kVARh,kVA,PowerFactor",
    "2026-03-01T00:00:00Z,N/A,15000,52000,0.96",
    "2026-03-01T00:30:00Z,INVALID_STR,15000,52000,0.96",
  ].join("\n");

  const invalidNumSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "invalid_num.csv", size: invalidNumCsv.length, content: invalidNumCsv }
  );

  assert(invalidNumSummary.rowsRejected === 2, "Rejected non-numeric kW rows");
  assert(invalidNumSummary.errors.some((e) => e.errorCode === "INVALID_NUMERIC"), "INVALID_NUMERIC error code logged");

  // Test 8: Negative / Impossible Energy & Demand Values
  console.log("\n--- Test 8: Negative & Impossible Power Values ---");
  const negativeCsv = [
    "Timestamp,kW,kVARh,kVA,PowerFactor",
    "2026-03-01T00:00:00Z,-50000,15000,52000,0.96",
    "2026-03-01T00:30:00Z,50000,15000,52000,2.5",
  ].join("\n");

  const negativeSummary = await StreamingIngestionService.processStreamingIngestion(
    { name: "negative_values.csv", size: negativeCsv.length, content: negativeCsv }
  );

  assert(negativeSummary.rowsRejected === 1, "Rejected negative active power row (-50000 kW)");
  assert(negativeSummary.errors.some((e) => e.errorCode === "NEGATIVE_IMPOSSIBLE_VALUE"), "NEGATIVE_IMPOSSIBLE_VALUE critical error logged");
  assert(negativeSummary.errors.some((e) => e.errorCode === "INVALID_POWER_FACTOR_BOUNDS"), "INVALID_POWER_FACTOR_BOUNDS warning logged for pf 2.5");

  console.log("\n=== ALL 8 ENTERPRISE STREAMING INGESTION TESTS PASSED SUCCESSFULLY ===");
  process.exit(0);
}

runStreamingPipelineTests().catch((err) => {
  console.error("❌ Fatal Streaming Pipeline Test Error:", err);
  process.exit(1);
});
