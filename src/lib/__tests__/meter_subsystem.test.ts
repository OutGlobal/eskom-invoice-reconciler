/**
 * Automated Test Suite: Authoritative Meter Master-Data & Configuration Subsystem
 * Tests CT/VT ratios, combined multipliers, register scaling, effective date config resolution,
 * 3-tier value transformations, historical reproducibility, and validation guarding.
 */

import { MeterCalculationService } from "../../domain/meter/meterCalculationService";
import { MeterValidationEngine } from "../../domain/meter/meterValidationEngine";
import type { MeterConfigurationRecord } from "../../domain/meter/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ METER SUBSYSTEM TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ METER SUBSYSTEM TEST PASSED: ${message}`);
  }
}

export async function runMeterSubsystemTests() {
  console.log("\n=== RUNNING METER MASTER-DATA SUBSYSTEM TEST SUITE ===\n");

  // Test 1: CT Ratio Derivation
  console.log("--- Test 1: CT Ratio Derivation ---");
  const ctDerived = MeterCalculationService.deriveMultipliers({
    ctNumerator: 200,
    ctDenominator: 5,
    vtNumerator: 1,
    vtDenominator: 1,
  });
  assert(ctDerived.ctRatio === 40, `Derived CT ratio (200/5 = ${ctDerived.ctRatio})`);

  // Test 2: VT Ratio Derivation
  console.log("\n--- Test 2: VT Ratio Derivation ---");
  const vtDerived = MeterCalculationService.deriveMultipliers({
    ctNumerator: 1,
    ctDenominator: 1,
    vtNumerator: 11000,
    vtDenominator: 110,
  });
  assert(vtDerived.vtRatio === 100, `Derived VT ratio (11000/110 = ${vtDerived.vtRatio})`);

  // Test 3: Combined CT x VT Multiplier
  console.log("\n--- Test 3: Combined CT x VT Multiplier ---");
  const combined = MeterCalculationService.deriveMultipliers({
    ctNumerator: 200,
    ctDenominator: 5,
    vtNumerator: 11000,
    vtDenominator: 110,
  });
  assert(
    combined.combinedMultiplier === 4000,
    `Combined multiplier (40 x 100 = ${combined.combinedMultiplier})`,
  );

  // Test 4: Register & Pulse Scaling Integration
  console.log("\n--- Test 4: Register & Pulse Scaling Factors ---");
  const scaled = MeterCalculationService.deriveMultipliers({
    ctNumerator: 200,
    ctDenominator: 5,
    vtNumerator: 11000,
    vtDenominator: 110,
    pulseScaling: 0.5,
    registerScaling: 10,
  });
  assert(
    scaled.overallMultiplier === 20000,
    `Overall multiplier with scaling (4000 x 0.5 x 10 = ${scaled.overallMultiplier})`,
  );

  // Test 5: Effective Date Config Resolution & Historical Reproducibility
  console.log("\n--- Test 5: Effective Date Resolution & Historical Reproducibility ---");
  const configA: MeterConfigurationRecord = {
    id: "cfg-A",
    meter_id: "mtr-1",
    version_number: 1,
    effective_start_date: "2026-01-01",
    effective_end_date: "2026-03-31",
    ct_ratio_numerator: 200,
    ct_ratio_denominator: 5,
    ct_ratio: 40,
    vt_ratio_numerator: 11000,
    vt_ratio_denominator: 110,
    vt_ratio: 100,
    combined_multiplier: 4000,
    pulse_scaling: 1,
    register_scaling: 1,
    overall_multiplier: 4000,
    multiplier_source: "Commissioning Cert #A",
    configured_by: "Engineer A",
  };

  const configB: MeterConfigurationRecord = {
    id: "cfg-B",
    meter_id: "mtr-1",
    version_number: 2,
    effective_start_date: "2026-04-01",
    effective_end_date: undefined,
    ct_ratio_numerator: 400,
    ct_ratio_denominator: 5,
    ct_ratio: 80,
    vt_ratio_numerator: 11000,
    vt_ratio_denominator: 110,
    vt_ratio: 100,
    combined_multiplier: 8000,
    pulse_scaling: 1,
    register_scaling: 1,
    overall_multiplier: 8000,
    multiplier_source: "Upgrade Cert #B",
    configured_by: "Engineer B",
  };

  const configs = [configA, configB];

  // Resolve reading in February 2026 -> Config A
  const febConfig = MeterCalculationService.resolveConfigurationAtTimestamp("2026-02-15T12:00:00Z", configs);
  assert(febConfig.version_number === 1, "February reading resolved to Configuration Version #1");
  assert(febConfig.overall_multiplier === 4000, "February reading used Multiplier 4000");

  const febTiered = MeterCalculationService.calculateTieredValues(250, febConfig, 1.02, "2026-02-15T12:00:00Z");
  assert(febTiered.raw_register_value === 250, "Feb Raw Register Value = 250");
  assert(febTiered.engineering_value === 1000000, "Feb Engineering Value = 1,000,000 kWh");
  assert(febTiered.billed_value === 1020000, "Feb Billed Value with 2% loss = 1,020,000 kWh");

  // Resolve reading in April 2026 -> Config B
  const aprConfig = MeterCalculationService.resolveConfigurationAtTimestamp("2026-04-15T12:00:00Z", configs);
  assert(aprConfig.version_number === 2, "April reading resolved to Configuration Version #2");
  assert(aprConfig.overall_multiplier === 8000, "April reading used Multiplier 8000");

  const aprTiered = MeterCalculationService.calculateTieredValues(250, aprConfig, 1.02, "2026-04-15T12:00:00Z");
  assert(aprTiered.engineering_value === 2000000, "April Engineering Value = 2,000,000 kWh");

  // Historical Reproducibility Verification: Re-evaluating February reading after April config exists
  const febReplayed = MeterCalculationService.resolveConfigurationAtTimestamp("2026-02-15T12:00:00Z", configs);
  const febReplayedTiered = MeterCalculationService.calculateTieredValues(250, febReplayed, 1.02, "2026-02-15T12:00:00Z");
  assert(
    febReplayedTiered.engineering_value === febTiered.engineering_value,
    "Historical January/February reconciliation result remains 100% reproducible after April config upgrade",
  );

  // Test 6: Validation Engine - Guarding Impossible Configurations
  console.log("\n--- Test 6: Validation Engine Configuration Guarding ---");
  const invalidConfigVal = MeterValidationEngine.validateConfiguration({
    ct_ratio_numerator: -50, // Negative CT ratio
    ct_ratio_denominator: 0, // Zero denominator
    vt_ratio_numerator: 11000,
    vt_ratio_denominator: 110,
    pulse_scaling: 1.0,
    register_scaling: 1.0,
    effective_start_date: "2026-05-01",
    effective_end_date: "2026-04-01", // End before start
    multiplier_source: "", // Missing source
  });

  assert(invalidConfigVal.isValid === false, "Validation engine rejected impossible configuration");
  assert(invalidConfigVal.issues.length >= 3, `Logged ${invalidConfigVal.issues.length} validation issues`);

  // Test 7: Validation Engine - Overlapping Date Ranges
  console.log("\n--- Test 7: Validation Engine Overlapping Date Guarding ---");
  const overlapVal = MeterValidationEngine.validateConfiguration(
    {
      ct_ratio_numerator: 200,
      ct_ratio_denominator: 5,
      vt_ratio_numerator: 11000,
      vt_ratio_denominator: 110,
      pulse_scaling: 1,
      register_scaling: 1,
      effective_start_date: "2026-02-01", // Overlaps with Config A (Jan-Mar)
      multiplier_source: "Audit Test Cert",
    },
    configs,
  );
  assert(overlapVal.isValid === false, "Validation engine caught overlapping date range");
  assert(
    overlapVal.issues.some((i) => i.code === "OVERLAPPING_CONFIGURATION_DATES"),
    "Logged OVERLAPPING_CONFIGURATION_DATES issue",
  );

  console.log("\n=== ALL METER SUBSYSTEM TESTS PASSED SUCCESSFULLY ===\n");
}

if (process.argv[1] && process.argv[1].includes("meter_subsystem")) {
  runMeterSubsystemTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}
