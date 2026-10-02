/**
 * Automated Unit Test Suite: Advanced Billing Determinants Engine
 * Tests high PF, low PF, boundary PF, zero energy, zero apparent energy,
 * missing reactive data, missing demand data, and configurable NMD ratchet rules.
 */

import Decimal from "decimal.js-light";
import { ReactivePowerCalculator } from "../../domain/determinants/reactivePowerCalculator";
import { DemandCalculator } from "../../domain/determinants/demandCalculator";
import { DeterminantEngine } from "../../domain/determinants/determinantEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ DETERMINANTS TEST FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ DETERMINANTS TEST PASSED: ${message}`);
  }
}

function runAdvancedDeterminantsTests() {
  console.log("\n=== RUNNING ADVANCED BILLING DETERMINANTS TEST SUITE ===\n");

  // Test 1: High Power Factor (PF >= 0.96 Threshold -> No Penalty)
  console.log("--- Test 1: High Power Factor (PF >= 0.96 Threshold) ---");
  // kWh = 100,000, kVARh = 10,000 -> PF = 100000 / sqrt(100000^2 + 10000^2) = 0.9950
  const highPfRes = ReactivePowerCalculator.calculateReactivePenalty({
    active_energy_kwh: new Decimal("100000"),
    reactive_energy_kvarh: new Decimal("10000"),
    season: "high",
    tou_period: "peak",
  });

  assert(highPfRes.status === "SUCCESS", "High PF calculation status is SUCCESS");
  assert(
    highPfRes.pf_calculated!.gt(new Decimal("0.99")),
    `Calculated vector PF (${highPfRes.pf_calculated!.toString()}) > 0.99`,
  );
  assert(highPfRes.excess_kvarh!.eq(new Decimal(0)), "Zero excess kVARh calculated for High PF");
  assert(highPfRes.value.eq(new Decimal(0)), "Zero Rand penalty for High PF");

  // Test 2: Low Power Factor (PF < 0.96 Threshold -> Penalty Calculated)
  console.log("\n--- Test 2: Low Power Factor (PF < 0.96 Threshold) ---");
  // kWh = 100,000, kVARh = 60,000 -> PF = 100000 / sqrt(100000^2 + 60000^2) = 0.8575 < 0.96
  const lowPfRes = ReactivePowerCalculator.calculateReactivePenalty({
    active_energy_kwh: new Decimal("100000"),
    reactive_energy_kvarh: new Decimal("60000"),
    season: "high",
    tou_period: "peak",
  });

  assert(lowPfRes.status === "SUCCESS", "Low PF calculation status is SUCCESS");
  assert(
    lowPfRes.pf_calculated!.lt(new Decimal("0.96")),
    `Calculated vector PF (${lowPfRes.pf_calculated!.toString()}) < 0.96`,
  );
  assert(
    lowPfRes.excess_kvarh!.gt(new Decimal(0)),
    `Excess kVARh derived (${lowPfRes.excess_kvarh!.toString()} kVARh)`,
  );
  assert(
    lowPfRes.value.gt(new Decimal(0)),
    `Reactive penalty amount calculated (R ${lowPfRes.value.toFixed(2)})`,
  );

  // Test 3: Boundary Power Factor (PF = 0.96 Exact Threshold)
  console.log("\n--- Test 3: Boundary Power Factor (PF = 0.96 Exact Threshold) ---");
  // For 100,000 kWh at PF 0.96: kVARh_allowed = 100000 * tan(16.26 deg) = 29,166.67 kVARh
  const boundaryPfRes = ReactivePowerCalculator.calculateReactivePenalty({
    active_energy_kwh: new Decimal("100000"),
    reactive_energy_kvarh: new Decimal("29166.67"),
    season: "high",
    tou_period: "peak",
  });

  assert(boundaryPfRes.status === "SUCCESS", "Boundary PF calculation status is SUCCESS");
  assert(
    boundaryPfRes.excess_kvarh!.lte(new Decimal("0.01")),
    `Boundary excess kVARh is zero (${boundaryPfRes.excess_kvarh!.toString()})`,
  );
  assert(boundaryPfRes.value.lte(new Decimal("0.01")), "Boundary reactive penalty is R 0.00");

  // Test 4: Zero Active Energy (kWh = 0)
  console.log("\n--- Test 4: Zero Active Energy (kWh = 0) ---");
  const zeroEnergyRes = ReactivePowerCalculator.calculateReactivePenalty({
    active_energy_kwh: new Decimal(0),
    reactive_energy_kvarh: new Decimal(0),
    season: "high",
    tou_period: "peak",
  });

  assert(
    zeroEnergyRes.status === "ZERO_ENERGY_NO_PENALTY",
    "Zero energy returns status ZERO_ENERGY_NO_PENALTY",
  );
  assert(zeroEnergyRes.pf_calculated!.eq(new Decimal("1.00")), "Zero energy evaluates PF to 1.00");
  assert(zeroEnergyRes.value.eq(new Decimal(0)), "Zero energy penalty amount is R 0.00");

  // Test 5: Zero Apparent Energy (kVA = 0)
  console.log("\n--- Test 5: Zero Apparent Energy (kVA = 0) ---");
  const zeroKvaRes = ReactivePowerCalculator.calculateReactivePenalty({
    active_energy_kwh: new Decimal(0),
    reactive_energy_kvarh: new Decimal(500),
    season: "high",
    tou_period: "peak",
  });

  assert(
    zeroKvaRes.pf_calculated!.eq(new Decimal("0.00")),
    "Zero active kWh evaluates PF to 0.00 without throwing zero division",
  );

  // Test 6: Missing Reactive Telemetry Data (Zero Fabrication Policy)
  console.log("\n--- Test 6: Missing Reactive Data (Zero Fabrication Policy) ---");
  const missingReactiveRes = ReactivePowerCalculator.calculateReactivePenalty({
    active_energy_kwh: new Decimal("100000"),
    reactive_energy_kvarh: undefined, // Missing data!
    season: "high",
    tou_period: "peak",
  });

  assert(
    missingReactiveRes.status === "MISSING_REACTIVE_DATA",
    "Missing reactive data returns status MISSING_REACTIVE_DATA",
  );
  assert(
    missingReactiveRes.value.eq(new Decimal(0)),
    "Missing reactive data returns zero penalty without fabricating numbers",
  );

  // Test 7: Missing Demand Telemetry Data (Zero Fabrication Policy)
  console.log("\n--- Test 7: Missing Demand Data (Zero Fabrication Policy) ---");
  const missingDemandRes = DemandCalculator.calculateDemand({
    peak_interval_kva: undefined, // Missing demand data!
    notified_maximum_demand_kva: new Decimal("5000"),
  });

  assert(
    missingDemandRes.status === "MISSING_DEMAND_DATA",
    "Missing demand data returns status MISSING_DEMAND_DATA",
  );
  assert(
    missingDemandRes.value.eq(new Decimal(0)),
    "Missing demand data returns zero billing demand without fabricating numbers",
  );

  // Test 8: Configurable NMD Demand Ratchet Rule (70% NMD Ratchet)
  console.log("\n--- Test 8: Configurable NMD Demand Ratchet Rule (70% NMD) ---");
  // NMD = 5,000 kVA -> 70% NMD = 3,500 kVA. Actual Measured Peak = 3,000 kVA (< 3,500 kVA).
  // Billing Demand should ratchet to 3,500 kVA!
  const ratchetRes = DemandCalculator.calculateDemand({
    peak_interval_kva: new Decimal("3000"),
    notified_maximum_demand_kva: new Decimal("5000"),
  });

  assert(ratchetRes.status === "SUCCESS", "Ratchet calculation status is SUCCESS");
  assert(ratchetRes.ratchet_applied === true, "70% NMD Ratchet rule flag set to true");
  assert(
    ratchetRes.billing_demand_kva!.eq(new Decimal("3500.00")),
    `Billing demand ratcheted to 3,500 kVA (actual: ${ratchetRes.billing_demand_kva!.toString()})`,
  );

  // Test 9: Comprehensive Determinant Engine
  console.log("\n--- Test 9: Unified Determinant Engine ---");
  const fullSummary = DeterminantEngine.calculateDeterminants({
    billing_start: "2025-07-01",
    billing_end: "2025-07-31",
    peak_kwh: new Decimal("250000"),
    standard_kwh: new Decimal("600000"),
    off_peak_kwh: new Decimal("400000"),
    peak_interval_kva: new Decimal("4850"),
    notified_maximum_demand_kva: new Decimal("5000"),
    reactive_energy_kvarh: new Decimal("180000"),
    season: "high",
  });

  assert(fullSummary.status === "SUCCESS", "Unified determinant engine status is SUCCESS");
  assert(
    fullSummary.active_energy_kwh.eq(new Decimal("1250000")),
    `Calculated active energy total (${fullSummary.active_energy_kwh.toString()} kWh)`,
  );
  assert(
    fullSummary.utilised_capacity_percent.eq(new Decimal("97.00")),
    `Utilised capacity percentage (${fullSummary.utilised_capacity_percent.toString()}%)`,
  );
  assert(
    fullSummary.audit_trace.length >= 2,
    `Generated ${fullSummary.audit_trace.length} audit steps`,
  );

  console.log("\n=== ALL ADVANCED BILLING DETERMINANTS TESTS PASSED SUCCESSFULLY ===\n");
}

runAdvancedDeterminantsTests();
