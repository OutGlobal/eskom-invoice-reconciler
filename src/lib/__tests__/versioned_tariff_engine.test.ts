import Decimal from "decimal.js-light";
import { DeterministicEngine, DeterministicTariffEngine } from "../../domain/tariff/deterministicEngine";
import { TariffVersionSelector } from "../../domain/tariff/tariffVersionSelector";
import { TariffValidationEngine } from "../../domain/tariff/tariffValidationEngine";
import { explainAppliedRate, explainAppliedRateByRule } from "../../domain/tariff/rateLineageExplainer";
import {
  ESKOM_MEGAFLEX_2025_2026,
  ESKOM_MINIFLEX_2025_2026,
  ESKOM_NIGHTSAVE_2025_2026,
  MUNICIPAL_COJ_BULK_2025_2026,
} from "../../domain/tariff/tariffFixtures";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ TEST PASSED: ${message}`);
  }
}

export function runVersionedTariffEngineTests() {
  console.log("\n=== RUNNING VERSIONED DETERMINISTIC TARIFF ENGINE TESTS ===\n");

  // Test 1: Megaflex High Season Active Energy & Demand
  const inputMegaflex = {
    billing_start: "2025-07-01",
    billing_end: "2025-07-31",
    notified_maximum_demand_kva: new Decimal(1000),
    utilised_capacity_kva: new Decimal(1200),
    maximum_demand_kva: new Decimal(1200),
    active_energy_kwh: new Decimal(500000),
    peak_kwh: new Decimal(100000),
    standard_kwh: new Decimal(250000),
    off_peak_kwh: new Decimal(150000),
    reactive_energy_kvarh: new Decimal(50000),
    power_factor: new Decimal(0.92),
  };

  const resultMegaflex = DeterministicEngine.calculateTariff(inputMegaflex, ESKOM_MEGAFLEX_2025_2026);

  assert(resultMegaflex.tariff_code.includes("MEGAFLEX"), "Tariff code includes MEGAFLEX");
  assert(resultMegaflex.tariff_version === "2025.1", "Tariff version is 2025.1");
  assert(resultMegaflex.season === "high", "Season identified as high season");
  assert(resultMegaflex.subtotal_ex_vat.toNumber() > 0, "Subtotal ex VAT is greater than 0");

  const expectedVat = resultMegaflex.subtotal_ex_vat
    .times(0.15)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
  assert(
    Math.abs(resultMegaflex.vat_amount.toNumber() - expectedVat) < 0.01,
    "15% VAT matches exact Decimal rounding",
  );

  assert(resultMegaflex.audit_trace.length > 0, "Audit trace contains steps");
  const peakStep = resultMegaflex.audit_trace.find((s) => s.component_code === "PEAK_ENERGY_HIGH");
  assert(peakStep !== undefined, "Peak energy audit step is present");
  assert(
    Boolean(
      peakStep?.rate_applied.includes("666.9200 c/kWh") || peakStep?.rate_applied.includes("666.92"),
    ),
    "Applied peak rate matches gazetted Megaflex rate",
  );

  // Test 2: Miniflex Low Season Charges
  const inputMiniflex = {
    billing_start: "2025-10-01",
    billing_end: "2025-10-31",
    notified_maximum_demand_kva: new Decimal(300),
    utilised_capacity_kva: new Decimal(280),
    maximum_demand_kva: new Decimal(280),
    active_energy_kwh: new Decimal(100000),
    peak_kwh: new Decimal(20000),
    standard_kwh: new Decimal(50000),
    off_peak_kwh: new Decimal(30000),
    reactive_energy_kvarh: new Decimal(5000),
    power_factor: new Decimal(0.96),
  };

  const resultMiniflex = DeterministicTariffEngine.calculate(inputMiniflex, ESKOM_MINIFLEX_2025_2026);
  assert(resultMiniflex.tariff_code.includes("MINIFLEX"), "Tariff code includes MINIFLEX");
  assert(resultMiniflex.season === "low", "Season identified as low season");
  assert(resultMiniflex.items.length > 0, "Miniflex produces line items");

  // Test 3: Rate Lineage Explainer
  const explanation = explainAppliedRate({
    tariffCodeOrFamily: "megaflex",
    dateStr: "2025-07-15",
    componentCode: "PEAK_ENERGY_HIGH",
  });

  assert(explanation.tariff_name.includes("Megaflex"), "Lineage tariff name includes Megaflex");
  assert(explanation.version_number === "2025.1", "Lineage version is 2025.1");
  assert(explanation.season === "high", "Lineage season is high");
  assert(explanation.explanation_text.includes("Applied rate of"), "Explanation text describes applied rate");
  assert(
    explanation.gazette_reference.includes("NERSA"),
    "Gazette reference matches NERSA schedule",
  );

  // Test 4: Overlapping Version Validation
  const v1 = ESKOM_MEGAFLEX_2025_2026;
  const v2 = {
    ...ESKOM_MEGAFLEX_2025_2026,
    header: {
      ...ESKOM_MEGAFLEX_2025_2026.header,
      version: "2025.2",
      effective_date: "2025-05-01",
    },
  };

  const validation = TariffValidationEngine.validateNoOverlappingVersions([v1, v2]);
  assert(!validation.isValid, "Overlapping tariff versions flagged as invalid");
  assert(validation.errors.length > 0, "Validation errors returned for overlap");
  assert(validation.errors[0].code === "ERR_TARIFF_VERSION_OVERLAP", "Overlap error code is ERR_TARIFF_VERSION_OVERLAP");

  console.log("✅ All Versioned Tariff Engine Tests passed successfully.");
}

if (process.argv[1] && process.argv[1].includes("versioned_tariff_engine")) {
  runVersionedTariffEngineTests();
  process.exit(0);
}
