import { TelemetryNormalizationEngine } from "../../domain/telemetry/normalizationEngine";
import { TelemetryQualityScoreEngine } from "../../domain/telemetry/qualityScoreEngine";
import { ParserRegistry } from "../../domain/telemetry/parserRegistry";
import { EskomAMRParser } from "../../domain/telemetry/parsers/EskomAMRParser";
import { MunicipalAMRParser } from "../../domain/telemetry/parsers/MunicipalAMRParser";
import { GenericCSVParser } from "../../domain/telemetry/parsers/GenericCSVParser";
import { VendorSpecificParser } from "../../domain/telemetry/parsers/VendorSpecificParser";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TELEMETRY ENGINE TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ TELEMETRY ENGINE TEST PASSED: ${message}`);
}

async function runTelemetryEngineTests() {
  console.log("=== RUNNING TELEMETRY NORMALIZATION ENGINE & PARSER ADAPTER TEST SUITE ===");

  // Test 1: Parser Adapter Selection & Routing
  console.log("\n--- Test 1: Parser Adapter Selection ---");
  const eskomParser = ParserRegistry.selectParser("eskom_amr_feb_2026.csv", "Date,Time,kW,kVAr,kVA,PF");
  assert(eskomParser.parserName === "EskomAMRParser", `Selected EskomAMRParser for Eskom AMR format (actual: ${eskomParser.parserName})`);

  const muniParser = ParserRegistry.selectParser("city_power_municipal_telemetry.csv", "Timestamp,CumulativekWh,Status");
  assert(muniParser.parserName === "MunicipalAMRParser", `Selected MunicipalAMRParser for municipal dial format (actual: ${muniParser.parserName})`);

  const vendorParser = ParserRegistry.selectParser("schneider_pulse_export.csv", "Timestamp,Pulses,Meter_ID");
  assert(vendorParser.parserName === "VendorSpecificParser", `Selected VendorSpecificParser for vendor pulse format (actual: ${vendorParser.parserName})`);

  const genericParser = ParserRegistry.selectParser("unknown_data.csv", "ColA,ColB,ColC");
  assert(genericParser.parserName === "GenericCSVParser", `Selected GenericCSVParser fallback for generic CSV (actual: ${genericParser.parserName})`);

  // Test 2: Eskom 30-min AMR Interval Normalization
  console.log("\n--- Test 2: Eskom 30-min AMR Interval Normalization ---");
  const eskomCsv = [
    "Date,Time,kW,kVAr,kVA,PF",
    "2026-03-01 00:00:00,50000,15000,52083,0.96",
    "2026-03-01 00:30:00,52000,15600,54166,0.96",
  ].join("\n");

  const eskomRes = TelemetryNormalizationEngine.normalizeTelemetry("eskom_test.csv", eskomCsv);
  assert(eskomRes.records.length === 2, "Normalized 2 canonical records");
  assert(eskomRes.intervalMinutes === 30, "Detected 30-minute interval duration");
  assert(eskomRes.records[0].active_power_kw === 50000, "Active power kW matches input (50000 kW)");
  assert(eskomRes.records[0].active_energy_kwh === 25000, "Active energy kWh matches 30-min calculation (25000 kWh)");
  assert(eskomRes.records[0].quality_status === "measured", "Quality status is 'measured'");
  assert(eskomRes.records[0].raw_payload?.rawKw === "50000", "Original raw payload preserved untouched");

  // Test 3: Municipal 15-min Cumulative Dial Register & Counter Rollover
  console.log("\n--- Test 3: Cumulative Dial Deltas & Counter Rollover ---");
  const cumulativeCsv = [
    "Timestamp,CumulativekWh",
    "2026-03-01 08:00:00,999800",
    "2026-03-01 08:15:00,999950",
    "2026-03-01 08:30:00,000100", // Counter Rollover! 999950 -> 100 (Max 1,000,000) => Delta 250 kWh
  ].join("\n");

  const muniRes = TelemetryNormalizationEngine.normalizeTelemetry("municipal_dial.csv", cumulativeCsv);
  assert(muniRes.intervalMinutes === 15, "Detected 15-minute interval duration");
  assert(muniRes.records[1].active_energy_kwh === 150, "Calculated delta between 999800 and 999950 (150 kWh)");
  assert(muniRes.rolloverCount === 1, "Counter rollover detected successfully");
  assert(muniRes.records[2].quality_status === "rollover", "Rollover record explicitly flagged with quality_status = 'rollover'");
  assert(muniRes.records[2].active_energy_kwh === 150, "Calculated modulo rollover delta (1000000 - 999950 + 100 = 150 kWh)");

  // Test 4: Gap Detection & Explicit Flagged Estimation
  console.log("\n--- Test 4: Gap Detection & Explicit Flagged Estimation ---");
  const gapCsv = [
    "Timestamp,kW,kVARh,kVA,PowerFactor",
    "2026-03-01 10:00:00,40000,12000,41600,0.96",
    // Missing 10:30 and 11:00 (1.5h gap <= 2h limit => Estimation Permitted!)
    "2026-03-01 11:30:00,46000,13800,47840,0.96",
  ].join("\n");

  const gapRes = TelemetryNormalizationEngine.normalizeTelemetry("gap_test.csv", gapCsv);
  assert(gapRes.gapEvents.length === 1, "Logged 1 telemetry_gap_event record");
  assert(gapRes.gapEvents[0].missingIntervals === 2, "Identified 2 missing intervals in gap window");
  assert(gapRes.gapEvents[0].estimationPermitted === true, "Calculated estimation permitted (gap <= 2h)");
  assert(gapRes.records.length === 4, "Created 2 explicitly flagged estimated records + 2 measured records (total 4)");

  const estimatedRecords = gapRes.records.filter((r) => r.quality_status === "estimated");
  assert(estimatedRecords.length === 2, "Distinguishable estimated records explicitly flagged ('quality_status = estimated')");
  assert(estimatedRecords[0].active_power_kw === 42000, "Linear estimated active power (42000 kW interpolated between 40000 and 46000)");

  // Test 5: Out-of-Order Timestamps & Duplicate Detection
  console.log("\n--- Test 5: Out-of-Order Timestamps & Duplicate Detection ---");
  const outOfOrderCsv = [
    "Timestamp,kW,kVARh,kVA,PowerFactor",
    "2026-03-01 14:00:00,50000,15000,52000,0.96",
    "2026-03-01 13:00:00,48000,14400,49920,0.96", // Out of order!
    "2026-03-01 14:00:00,50000,15000,52000,0.96", // Duplicate!
  ].join("\n");

  const oooRes = TelemetryNormalizationEngine.normalizeTelemetry("ooo_test.csv", outOfOrderCsv);
  assert(
    oooRes.records[0].local_timestamp.includes("13:00:00") || oooRes.records[0].timestamp_utc.includes("11:00:00"),
    "Re-sorted out-of-order timestamps into chronological order (13:00 local / 11:00 UTC)"
  );
  assert(oooRes.duplicateCount === 1, "Detected duplicate timestamp record");
  assert(oooRes.records.some((r) => r.quality_status === "duplicate"), "Duplicate record explicitly flagged ('quality_status = duplicate')");

  // Test 6: Data-Quality Score Engine Metrics Calculation
  console.log("\n--- Test 6: Data-Quality Score Metrics ---");
  const metrics = TelemetryQualityScoreEngine.calculateQualityMetrics(gapRes.records, 4);

  assert(metrics.completenessPercent === 100, `Completeness % is 100% with gap estimation (actual: ${metrics.completenessPercent}%)`);
  assert(metrics.validityPercent === 100, `Validity % is 100% (actual: ${metrics.validityPercent}%)`);
  assert(metrics.estimatedPercent === 50, `Estimated % matches 2/4 records (actual: ${metrics.estimatedPercent}%)`);
  assert(metrics.overallQualityScore > 90, `Overall quality score computed (> 90%) (actual: ${metrics.overallQualityScore}%)`);

  console.log("\n=== ALL TELEMETRY NORMALIZATION ENGINE TESTS PASSED SUCCESSFULLY ===");
  process.exit(0);
}

runTelemetryEngineTests().catch((err) => {
  console.error("❌ Fatal Telemetry Engine Test Error:", err);
  process.exit(1);
});
