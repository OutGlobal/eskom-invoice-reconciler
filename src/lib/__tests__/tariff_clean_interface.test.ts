/**
 * Clean Tariff Interface Verification Test Suite
 * ========================================================
 * Verifies that the reconciliation engine consumes tariff information
 * strictly through a clean interface:
 *
 *   getApplicableTariff(site, meter, billingPeriod)
 *   calculateCharge(tariff, quantity, timePeriod, chargeType)
 *
 * Verifies:
 * 1. Tariff engine rules decouple from hard-coded Eskom schedules.
 * 2. Pluggable provider architecture allows feature/tariff-engine integration.
 * 3. Decimal arbitrary precision arithmetic without floating-point drift.
 * 4. Deterministic reconciliation engine static interface exposure.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import Decimal from "decimal.js-light";
import {
  TariffInterface,
  getApplicableTariff,
  calculateCharge,
  type ITariffEngineService,
} from "../../domain/tariff/tariffInterface";
import { TariffStorageService } from "../../domain/tariff/tariffStorageService";
import { DeterministicReconciliationEngine } from "../../domain/reconciliation/reconciliationEngine";
import type { TariffVersionDefinition } from "../../domain/tariff/types";

// Mock tariff definition supplied externally (e.g. from uploaded document or feature/tariff-engine)
const SAMPLE_MOCK_TARIFF: TariffVersionDefinition = {
  header: {
    tariff_code: "CUSTOM_COMMERCIAL_TOU",
    tariff_name: "Custom Commercial Time-Of-Use 2024",
    tariff_family: "commercial",
    version: "2024.1",
    effective_date: "2024-01-01",
    expiry_date: "2024-12-31",
    utility: "Utility Corp",
    vat_rate: 0.15,
    is_locked: true,
  },
  components: [
    {
      rule_id: "RULE_ENERGY_PEAK",
      component_code: "ACTIVE_ENERGY_PEAK",
      component_name: "Peak Active Energy",
      component_category: "energy",
      unit_of_measure: "c/kWh",
      high_season_rate: 450.50,
      low_season_rate: 220.25,
      tou_period: "peak",
      season: "all",
    },
    {
      rule_id: "RULE_ENERGY_STANDARD",
      component_code: "ACTIVE_ENERGY_STANDARD",
      component_name: "Standard Active Energy",
      component_category: "energy",
      unit_of_measure: "c/kWh",
      high_season_rate: 180.00,
      low_season_rate: 140.00,
      tou_period: "standard",
      season: "all",
    },
    {
      rule_id: "RULE_ENERGY_OFF_PEAK",
      component_code: "ACTIVE_ENERGY_OFF_PEAK",
      component_name: "Off-Peak Active Energy",
      component_category: "energy",
      unit_of_measure: "c/kWh",
      high_season_rate: 95.50,
      low_season_rate: 85.00,
      tou_period: "off_peak",
      season: "all",
    },
    {
      rule_id: "RULE_DEMAND",
      component_code: "NETWORK_DEMAND",
      component_name: "Network Demand Charge",
      component_category: "demand",
      unit_of_measure: "R/kVA/month",
      rate_zar: 150.00,
      season: "all",
    },
    {
      rule_id: "RULE_SERVICE",
      component_code: "SERVICE_CHARGE",
      component_name: "Daily Service Charge",
      component_category: "basic",
      unit_of_measure: "R/day",
      flat_rate: 125.50,
      season: "all",
    },
  ],
};

export async function runTariffCleanInterfaceTests() {
  console.log("\n=======================================================");
  console.log("  TEST SUITE: TARIFF CLEAN INTERFACE ARCHITECTURE       ");
  console.log("=======================================================\n");

  // Reset providers before tests
  TariffInterface.resetProvider();
  TariffStorageService.clearMemoryStore();

  // TEST 1: getApplicableTariff returns null when no tariff is registered (no hardcoding)
  console.log("Test 1: getApplicableTariff returns null without hard-coded fallbacks...");
  const missingTariff = await getApplicableTariff(
    "SITE-ALPHA",
    "MTR-001",
    { start: "2024-03-01", end: "2024-03-31" },
  );
  assert.strictEqual(
    missingTariff,
    null,
    "Should return null when no tariff exists instead of silently hardcoding Eskom",
  );
  console.log("✅ Passed: No silent hardcoded fallback.\n");

  // TEST 2: Register tariff in TariffStorageService and resolve via getApplicableTariff
  console.log("Test 2: getApplicableTariff resolves dynamically registered tariff...");
  await TariffStorageService.saveTariffVersion(SAMPLE_MOCK_TARIFF, { forceOverwrite: true });

  const resolvedTariff = await getApplicableTariff(
    { siteId: "SITE-ALPHA", tariffCode: "CUSTOM_COMMERCIAL_TOU" },
    "MTR-001",
    { start: "2024-03-01", end: "2024-03-31" },
  );
  assert.ok(resolvedTariff !== null, "Should resolve registered tariff definition");
  assert.strictEqual(
    resolvedTariff?.header.tariff_code,
    "CUSTOM_COMMERCIAL_TOU",
    "Tariff code must match registered specification",
  );
  console.log("✅ Passed: Dynamic tariff resolution successful.\n");

  // TEST 3: calculateCharge calculates active energy peak charge in c/kWh
  console.log("Test 3: calculateCharge evaluates active energy peak charge...");
  const peakKwh = new Decimal("10000"); // 10,000 kWh
  // In high season: rate is 450.50 c/kWh -> 10,000 * 450.50 / 100 = R 45,050.00
  const peakChargeHigh = calculateCharge(
    SAMPLE_MOCK_TARIFF,
    peakKwh,
    { season: "high", touPeriod: "peak" },
    "ACTIVE_ENERGY_PEAK",
  );

  assert.strictEqual(peakChargeHigh.unit, "c/kWh");
  assert.strictEqual(peakChargeHigh.amountZar.toFixed(2), "45050.00");
  assert.strictEqual(peakChargeHigh.formula, "quantity * rate / 100");
  console.log(`✅ Passed: High season peak charge calculated: R ${peakChargeHigh.amountZar.toFixed(2)}.\n`);

  // In low season: rate is 220.25 c/kWh -> 10,000 * 220.25 / 100 = R 22,025.00
  const peakChargeLow = calculateCharge(
    SAMPLE_MOCK_TARIFF,
    peakKwh,
    { season: "low", touPeriod: "peak" },
    "ACTIVE_ENERGY_PEAK",
  );
  assert.strictEqual(peakChargeLow.amountZar.toFixed(2), "22025.00");
  console.log(`✅ Passed: Low season peak charge calculated: R ${peakChargeLow.amountZar.toFixed(2)}.\n`);

  // TEST 4: calculateCharge evaluates demand charge (R/kVA/month)
  console.log("Test 4: calculateCharge evaluates demand charge...");
  const demandKva = new Decimal("125.5"); // 125.5 kVA
  // Rate is R 150.00 / kVA -> 125.5 * 150 = R 18,825.00
  const demandCharge = calculateCharge(
    SAMPLE_MOCK_TARIFF,
    demandKva,
    { season: "high" },
    "NETWORK_DEMAND",
  );
  assert.strictEqual(demandCharge.amountZar.toFixed(2), "18825.00");
  assert.strictEqual(demandCharge.formula, "quantity * rate");
  console.log(`✅ Passed: Demand charge calculated: R ${demandCharge.amountZar.toFixed(2)}.\n`);

  // TEST 5: calculateCharge evaluates daily service charge (R/day)
  console.log("Test 5: calculateCharge evaluates daily service charge...");
  const billingDays = 31;
  // Rate is R 125.50 / day -> 31 * 125.50 = R 3,890.50
  const serviceCharge = calculateCharge(
    SAMPLE_MOCK_TARIFF,
    billingDays,
    {},
    "SERVICE_CHARGE",
  );
  assert.strictEqual(serviceCharge.amountZar.toFixed(2), "3890.50");
  console.log(`✅ Passed: Service charge calculated: R ${serviceCharge.amountZar.toFixed(2)}.\n`);

  // TEST 6: calculateCharge evaluates statutory VAT (15%)
  console.log("Test 6: calculateCharge evaluates VAT (15%)...");
  const subtotal = new Decimal("100000.00");
  const vatCharge = calculateCharge(
    SAMPLE_MOCK_TARIFF,
    subtotal,
    {},
    "VAT",
  );
  assert.strictEqual(vatCharge.amountZar.toFixed(2), "15000.00");
  console.log(`✅ Passed: VAT calculated: R ${vatCharge.amountZar.toFixed(2)}.\n`);

  // TEST 7: Custom external provider registration (feature/tariff-engine)
  console.log("Test 7: Custom provider registration from feature/tariff-engine...");
  let customProviderCalled = false;
  const mockExternalProvider: ITariffEngineService = {
    getApplicableTariff: (site, meter, period) => {
      customProviderCalled = true;
      return SAMPLE_MOCK_TARIFF;
    },
    calculateCharge: (tariff, qty, time, type) => {
      return {
        chargeType: type,
        chargeName: "External Tariff Engine Charge",
        quantity: new Decimal(qty),
        rateApplied: new Decimal("99.99"),
        unit: "ZAR",
        amountZar: new Decimal(qty).mul("99.99").toDecimalPlaces(2),
        formula: "external_engine(qty, rate)",
        ruleId: "EXT_RULE_01",
        tariffCode: "EXTERNAL_TARIFF",
        tariffVersion: "3.0",
      };
    },
  };

  TariffInterface.registerProvider(mockExternalProvider);

  const customResolved = await getApplicableTariff("SITE-EXT", "MTR-EXT", "2024-03-01 to 2024-03-31");
  assert.strictEqual(customProviderCalled, true, "Should delegate to registered external tariff provider");
  assert.strictEqual(customResolved?.header.tariff_code, "CUSTOM_COMMERCIAL_TOU");

  const customCharge = calculateCharge(SAMPLE_MOCK_TARIFF, 10, {}, "SPECIAL_SURCHARGE");
  assert.strictEqual(customCharge.ruleId, "EXT_RULE_01");
  assert.strictEqual(customCharge.amountZar.toFixed(2), "999.90");
  console.log("✅ Passed: Custom tariff engine integration verified.\n");

  // TEST 8: Static methods on DeterministicReconciliationEngine
  console.log("Test 8: DeterministicReconciliationEngine static interface exposure...");
  assert.strictEqual(typeof DeterministicReconciliationEngine.getApplicableTariff, "function");
  assert.strictEqual(typeof DeterministicReconciliationEngine.calculateCharge, "function");
  console.log("✅ Passed: DeterministicReconciliationEngine exposes clean interface.\n");

  // Cleanup
  TariffInterface.resetProvider();
  TariffStorageService.clearMemoryStore();

  console.log("=======================================================");
  console.log("  ALL CLEAN TARIFF INTERFACE TESTS PASSED (8/8)        ");
  console.log("=======================================================\n");
  return true;
}

// Self-executing runner
if (process.argv[1]?.endsWith("tariff_clean_interface.test.ts")) {
  runTariffCleanInterfaceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failure:", err);
      process.exit(1);
    });
}
