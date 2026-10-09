/**
 * Automated Enterprise Test Suite: 40. TEST SUITE
 * Complete Verification Matrix:
 *  - Matching (exact account, meter, billing-period, ambiguous, no match)
 *  - AMR (complete dataset, missing intervals, duplicate intervals, invalid timestamps, wrong unit, cumulative meter, interval meter)
 *  - Energy (exact match, small variance, large variance)
 *  - Financial (exact total, VAT difference, charge difference, zero expected amount)
 *  - Failure (missing tariff, missing AMR, invalid invoice, calculation error)
 */

import Decimal from "decimal.js-light";
import {
  MatchingEngine,
  type InvoiceMatchTarget,
  type AmrDatasetCandidate,
} from "../../domain/reconciliation/matchingEngine";
import { AmrIntervalIngestionEngine } from "../../domain/telemetry/amrIntervalIngestionEngine";
import { UnitNormalisationEngine } from "../../domain/meter/unitNormalisationEngine";
import { EnergyReconciliationEngine } from "../../domain/reconciliation/energyReconciliationEngine";
import {
  DeterministicReconciliationEngine,
  type AuthoritativeReconciliationInput,
} from "../../domain/reconciliation/reconciliationEngine";
import { DeterministicTariffEngine } from "../../domain/tariff/deterministicEngine";
import {
  ReconciliationFailureHandler,
  type ReconciliationFailureRecord,
} from "../../domain/reconciliation/reconciliationFailureHandler";
import { AutomaticProcessingPipeline } from "../../domain/reconciliation/automaticProcessingPipeline";
import { ESKOM_MEGAFLEX_2025_2026 } from "../../domain/tariff/tariffFixtures";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ ${message}`);
  }
}

export async function runReconciliationMatrixTests(): Promise<void> {
  console.log("=================================================================");
  console.log("  REQUIREMENT 40: COMPLETE RECONCILIATION VERIFICATION MATRIX   ");
  console.log("=================================================================\n");

  // ===========================================================================
  // 1. MATCHING TESTS
  // ===========================================================================
  console.log("--- 1. MATCHING DOMAIN TESTS ---");

  const baseTarget: InvoiceMatchTarget = {
    invoiceId: "INV-MAT-2026-001",
    invoiceNumber: "INV-MAT-2026-001",
    accountNumber: "ACC-ESKOM-1001",
    siteId: "SITE-MIDRAND-01",
    meterNumber: "MTR-882211",
    billingPeriodStart: "2026-04-01",
    billingPeriodEnd: "2026-04-30",
    tenantId: "ORG-ACME",
  };

  // 1.1 Exact Account Match
  const candidateExactAccount: AmrDatasetCandidate = {
    datasetId: "DS-ACC-01",
    accountNumber: "ACC-ESKOM-1001",
    meterNumber: "MTR-882211",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    intervalCount: 1440,
  };
  const evalAccount = MatchingEngine.evaluateCandidate(baseTarget, candidateExactAccount);
  assert(evalAccount.accountMatch === true, "Matching: exact account match verified");
  assert(evalAccount.matchedDimensions.includes("ACCOUNT"), "Matching: ACCOUNT dimension recorded in candidate evaluation");

  // 1.2 Meter Match
  const candidateExactMeter: AmrDatasetCandidate = {
    datasetId: "DS-MTR-01",
    accountNumber: "ACC-ESKOM-1001",
    meterNumber: "MTR-882211",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    intervalCount: 1440,
  };
  const evalMeter = MatchingEngine.evaluateCandidate(baseTarget, candidateExactMeter);
  assert(evalMeter.meterMatch === true, "Matching: meter match verified");
  assert(evalMeter.matchedDimensions.includes("METER"), "Matching: METER dimension recorded in candidate evaluation");

  // 1.3 Billing-Period Match
  const candidatePeriodMatch: AmrDatasetCandidate = {
    datasetId: "DS-PERIOD-01",
    accountNumber: "ACC-ESKOM-1001",
    meterNumber: "MTR-882211",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    intervalCount: 1440,
  };
  const evalPeriod = MatchingEngine.evaluateCandidate(baseTarget, candidatePeriodMatch);
  assert(evalPeriod.periodCoverageMatch === true, "Matching: billing-period match verified");
  assert(evalPeriod.isEligible === true, "Matching: eligible candidate when meter and period align");

  // 1.4 Ambiguous Match (Multiple matching candidates -> AMBIGUOUS_MATCH)
  const candidateA: AmrDatasetCandidate = {
    datasetId: "DS-AMB-01",
    accountNumber: "ACC-ESKOM-1001",
    meterNumber: "MTR-882211",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    intervalCount: 1440,
  };
  const candidateB: AmrDatasetCandidate = {
    datasetId: "DS-AMB-02",
    accountNumber: "ACC-ESKOM-1001",
    meterNumber: "MTR-882211",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    intervalCount: 1440,
  };
  const ambiguousResult = MatchingEngine.matchInvoiceToAmrCandidates(baseTarget, [candidateA, candidateB]);
  assert(ambiguousResult.decision === "AMBIGUOUS_MATCH", "Matching: ambiguous match returned when multiple candidates match");
  assert(ambiguousResult.requiresUserResolution === true, "Matching: ambiguous match requires explicit operator resolution");
  assert(ambiguousResult.matchedCandidate === null, "Matching: engine refuses to pick arbitrarily on ambiguous match");

  // 1.5 No Match (No candidate meets mandatory meter criteria)
  const candidateWrongMeter: AmrDatasetCandidate = {
    datasetId: "DS-WRONG-01",
    accountNumber: "ACC-ESKOM-1001",
    meterNumber: "MTR-DIFF-9999",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    intervalCount: 1440,
  };
  const noMatchResult = MatchingEngine.matchInvoiceToAmrCandidates(baseTarget, [candidateWrongMeter]);
  assert(noMatchResult.decision === "NO_MATCH", "Matching: no match returned when candidate meter differs");
  assert(noMatchResult.matchedCandidate === null, "Matching: matched candidate is null when no match found");


  // ===========================================================================
  // 2. AMR TELEMETRY TESTS
  // ===========================================================================
  console.log("\n--- 2. AMR TELEMETRY DOMAIN TESTS ---");

  // Helper to generate CSV telemetry string
  function generateCsv(lines: string[]): string {
    return lines.join("\n");
  }

  // 2.1 Complete Dataset
  const completeCsvLines = [
    "Date,Time,Active Power kW,Reactive Power kVAr,Voltage V",
    "2026-05-01,00:00:00,120.5,35.2,400",
    "2026-05-01,00:30:00,118.2,34.8,400",
    "2026-05-01,01:00:00,115.0,33.1,400",
    "2026-05-01,01:30:00,114.7,32.9,400",
  ];
  const completeIngestion = await AmrIntervalIngestionEngine.processIntervalFile({
    fileBuffer: generateCsv(completeCsvLines),
    filename: "complete_meter_telemetry.csv",
    meterIdOverride: "MTR-882211",
  });
  assert(completeIngestion.success === true, "AMR: complete dataset processed successfully");
  assert(completeIngestion.intervals.length === 4, "AMR: all 4 intervals ingested");
  assert(completeIngestion.summary.gaps.totalMissingIntervals === 0, "AMR: complete dataset has 0 missing interval gaps");

  // 2.2 Missing Intervals
  const missingIntervalsCsv = [
    "Date,Time,Active Power kW,Reactive Power kVAr",
    "2026-05-01,00:00:00,120.0,30.0",
    "2026-05-01,00:30:00,120.0,30.0",
    // Gap: 01:00 and 01:30 missing
    "2026-05-01,02:00:00,120.0,30.0",
  ];
  const missingIngestion = await AmrIntervalIngestionEngine.processIntervalFile({
    fileBuffer: generateCsv(missingIntervalsCsv),
    filename: "missing_gaps.csv",
    meterIdOverride: "MTR-882211",
  });
  assert(missingIngestion.summary.gaps.totalMissingIntervals >= 2, "AMR: missing intervals detected and counted");
  assert(missingIngestion.summary.gaps.gapEvents.length > 0, "AMR: missing interval gap records recorded in telemetry ledger");

  // 2.3 Duplicate Intervals
  const duplicateIntervalsCsv = [
    "Date,Time,Active Power kW,Reactive Power kVAr",
    "2026-05-01,00:00:00,100.0,25.0",
    "2026-05-01,00:30:00,105.0,26.0",
    "2026-05-01,00:30:00,105.0,26.0", // Duplicate timestamp
    "2026-05-01,01:00:00,110.0,27.0",
  ];
  const dupIngestion = await AmrIntervalIngestionEngine.processIntervalFile({
    fileBuffer: generateCsv(duplicateIntervalsCsv),
    filename: "duplicates.csv",
    meterIdOverride: "MTR-882211",
  });
  assert(dupIngestion.summary.intervals.duplicates > 0, "AMR: duplicate intervals detected");

  // 2.4 Invalid Timestamps
  const invalidTimestampCsv = [
    "Date,Time,Active Power kW,Reactive Power kVAr",
    "2026-05-01,00:00:00,100.0,25.0",
    "INVALID_DATE,CORRUPT_TIME,100.0,25.0", // Invalid timestamp
    "2026-05-01,01:00:00,100.0,25.0",
  ];
  const invalidTsIngestion = await AmrIntervalIngestionEngine.processIntervalFile({
    fileBuffer: generateCsv(invalidTimestampCsv),
    filename: "corrupt_ts.csv",
    meterIdOverride: "MTR-882211",
  });
  assert(invalidTsIngestion.intervals.length === 2, "AMR: corrupt timestamp row excluded from valid intervals");

  // 2.5 Wrong Unit Normalisation
  const convertedMwh = UnitNormalisationEngine.normalize(150, "MWh");
  assert(convertedMwh.wasConverted === true, "AMR: wrong unit (MWh) identified as requiring conversion");
  assert(convertedMwh.value.equals(150000), "AMR: 150 MWh converted accurately to 150,000 kWh");
  assert(convertedMwh.unit === "kWh", "AMR: converted target unit is canonical kWh");

  const convertedWh = UnitNormalisationEngine.normalize(2500000, "Wh");
  assert(convertedWh.value.equals(2500), "AMR: 2,500,000 Wh converted accurately to 2,500 kWh");

  const convertedMw = UnitNormalisationEngine.normalize(2.5, "MW");
  assert(convertedMw.value.equals(2500), "AMR: 2.5 MW demand converted accurately to 2,500 kW");

  // 2.6 Cumulative Meter (Dial Register Delta)
  const cumulativeCsv = [
    "Date,Time,Cumulative Active Register (kWh)",
    "2026-05-01,00:00:00,500000",
    "2026-05-01,00:30:00,500060", // Delta = 60 kWh
    "2026-05-01,01:00:00,500140", // Delta = 80 kWh
  ];
  const cumulativeIngestion = await AmrIntervalIngestionEngine.processIntervalFile({
    fileBuffer: generateCsv(cumulativeCsv),
    filename: "cumulative_registers.csv",
    meterIdOverride: "MTR-882211",
  });
  assert(
    cumulativeIngestion.summary.schemaType === "CUMULATIVE_REGISTERS",
    "AMR: detected cumulative meter schema (CUMULATIVE_REGISTERS)"
  );

  // 2.7 Interval Meter (Discrete kW / kWh per interval)
  const intervalMeterCsv = [
    "Date,Time,Active Power kW",
    "2026-05-01,00:00:00,120.0",
    "2026-05-01,00:30:00,130.0",
  ];
  const intervalIngestion = await AmrIntervalIngestionEngine.processIntervalFile({
    fileBuffer: generateCsv(intervalMeterCsv),
    filename: "interval_meter.csv",
    meterIdOverride: "MTR-882211",
  });
  assert(
    intervalIngestion.summary.schemaType !== "CUMULATIVE_REGISTERS" &&
      (intervalIngestion.summary.schemaType === "GENERIC_INTERVAL" ||
        intervalIngestion.summary.schemaType === "ESKOM_AMR_30M"),
    "AMR: detected discrete interval meter schema (non-cumulative interval readings)"
  );


  // ===========================================================================
  // 3. ENERGY RECONCILIATION TESTS
  // ===========================================================================
  console.log("\n--- 3. ENERGY RECONCILIATION DOMAIN TESTS ---");

  // 3.1 Exact Match
  const energyExact = EnergyReconciliationEngine.reconcileEnergy({
    invoice_peak_kwh: 120000,
    invoice_standard_kwh: 180000,
    invoice_off_peak_kwh: 240000,
    invoice_total_kwh: 540000,
    amr_peak_kwh: 120000,
    amr_standard_kwh: 180000,
    amr_off_peak_kwh: 240000,
    amr_total_kwh: 540000,
  });
  assert(energyExact.net_active_kwh_variance.isZero(), "Energy: exact match has zero net kWh variance");
  assert(energyExact.overall_variance_status === "MATCH", "Energy: exact match overall status is MATCH");
  assert(energyExact.has_material_discrepancy === false, "Energy: exact match has no material discrepancy");

  // 3.2 Small Variance (Within Configured Tolerance)
  const energySmallVariance = EnergyReconciliationEngine.reconcileEnergy({
    invoice_peak_kwh: 120025, // +25 kWh variance (within 100 kWh tolerance)
    invoice_standard_kwh: 180000,
    invoice_off_peak_kwh: 240000,
    invoice_total_kwh: 540025,
    amr_peak_kwh: 120000,
    amr_standard_kwh: 180000,
    amr_off_peak_kwh: 240000,
    amr_total_kwh: 540000,
  });
  assert(energySmallVariance.net_active_kwh_variance.equals(25), "Energy: small variance correctly recorded (25 kWh)");
  assert(energySmallVariance.all_components_within_tolerance === true, "Energy: small variance is within configured tolerance");
  assert(energySmallVariance.overall_variance_status === "WITHIN_TOLERANCE", "Energy: small variance status is WITHIN_TOLERANCE");
  assert(energySmallVariance.has_material_discrepancy === false, "Energy: small variance does not trigger material discrepancy");

  // 3.3 Large Variance (Exceeds Configured Tolerance)
  const energyLargeVariance = EnergyReconciliationEngine.reconcileEnergy({
    invoice_peak_kwh: 155000, // +35,000 kWh variance (far outside 100 kWh tolerance)
    invoice_standard_kwh: 180000,
    invoice_off_peak_kwh: 240000,
    invoice_total_kwh: 575000,
    amr_peak_kwh: 120000,
    amr_standard_kwh: 180000,
    amr_off_peak_kwh: 240000,
    amr_total_kwh: 540000,
  });
  assert(energyLargeVariance.net_active_kwh_variance.equals(35000), "Energy: large variance accurately measured (+35,000 kWh)");
  assert(energyLargeVariance.has_material_discrepancy === true, "Energy: large variance flags has_material_discrepancy");
  assert(energyLargeVariance.overall_variance_status === "OUTSIDE_TOLERANCE", "Energy: large variance classified as OUTSIDE_TOLERANCE");


  // ===========================================================================
  // 4. FINANCIAL RECONCILIATION TESTS
  // ===========================================================================
  console.log("\n--- 4. FINANCIAL RECONCILIATION DOMAIN TESTS ---");

  const tariffCalcInput = {
    billing_start: "2026-05-01",
    billing_end: "2026-05-31",
    notified_maximum_demand_kva: new Decimal(250),
    utilised_capacity_kva: new Decimal(250),
    maximum_demand_kva: new Decimal(250),
    active_energy_kwh: new Decimal(300),
    peak_kwh: new Decimal(100),
    standard_kwh: new Decimal(125),
    off_peak_kwh: new Decimal(75),
    reactive_energy_kvarh: new Decimal(60),
    power_factor: new Decimal(0.98),
  };
  const baseCalc = DeterministicTariffEngine.calculate(tariffCalcInput, ESKOM_MEGAFLEX_2025_2026);

  let calcEnergyZar = new Decimal(0);
  let calcDemandZar = new Decimal(0);
  let calcNetworkZar = new Decimal(0);
  let calcServiceZar = new Decimal(0);
  let calcAncillaryZar = new Decimal(0);
  for (const item of baseCalc.items) {
    const type = item.audit_step.component_code;
    if (type.includes("PEAK") || type.includes("STANDARD") || type.includes("OFF_PEAK")) {
      calcEnergyZar = calcEnergyZar.plus(item.amount_zar);
    } else if (type.includes("DEMAND")) {
      calcDemandZar = calcDemandZar.plus(item.amount_zar);
    } else if (type.includes("NETWORK") || type.includes("CAPACITY") || type.includes("TRANSMISSION")) {
      calcNetworkZar = calcNetworkZar.plus(item.amount_zar);
    } else if (type.includes("SERVICE") || type.includes("ADMIN")) {
      calcServiceZar = calcServiceZar.plus(item.amount_zar);
    } else {
      calcAncillaryZar = calcAncillaryZar.plus(item.amount_zar);
    }
  }
  const calcVatZar = baseCalc.vat_amount;
  const calcTotalInvoiceZar = baseCalc.total_inc_vat;

  // 4.1 Exact Total Match
  const exactInput: AuthoritativeReconciliationInput = {
    invoice_id: "INV-EXACT-01",
    invoice_number: "INV-EXACT-01",
    account_number: "ACC-FIN-01",
    billing_start: "2026-05-01",
    billing_end: "2026-05-31",
    tariff_version: ESKOM_MEGAFLEX_2025_2026,
    billed_peak_kwh: new Decimal(100),
    billed_standard_kwh: new Decimal(125),
    billed_off_peak_kwh: new Decimal(75),
    billed_total_kwh: new Decimal(300),
    billed_maximum_demand_kva: new Decimal(250),
    billed_ratcheted_demand_kva: new Decimal(250),
    billed_reactive_energy_kvarh: new Decimal(60),
    billed_energy_charges_zar: calcEnergyZar,
    billed_demand_charges_zar: calcDemandZar,
    billed_network_charges_zar: calcNetworkZar,
    billed_service_charges_zar: calcServiceZar,
    billed_ancillary_charges_zar: calcAncillaryZar,
    billed_vat_zar: calcVatZar,
    billed_total_invoice_zar: calcTotalInvoiceZar,
    calc_peak_kwh: new Decimal(100),
    calc_standard_kwh: new Decimal(125),
    calc_off_peak_kwh: new Decimal(75),
    calc_total_kwh: new Decimal(300),
    calc_maximum_demand_kva: new Decimal(250),
    calc_ratcheted_demand_kva: new Decimal(250),
    calc_reactive_energy_kvarh: new Decimal(60),
  };
  const exactRecon = DeterministicReconciliationEngine.reconcile(exactInput);
  assert(exactRecon.variance_total_zar.isZero(), "Financial: exact total match yields zero financial variance");
  assert(exactRecon.classification === "PASS", "Financial: exact total result classification is PASS");

  // 4.2 VAT Difference
  const vatDiffInput: AuthoritativeReconciliationInput = {
    ...exactInput,
    invoice_id: "INV-VAT-DIFF-01",
    invoice_number: "INV-VAT-DIFF-01",
    billed_vat_zar: calcVatZar.plus(1000), // R 1,000 VAT error
    billed_total_invoice_zar: calcTotalInvoiceZar.plus(1000),
  };
  const vatDiffRecon = DeterministicReconciliationEngine.reconcile(vatDiffInput);
  const vatComp = vatDiffRecon.determinant_comparisons.find((c) => c.determinant_code === "VAT_ZAR")!;
  assert(
    vatComp.variance_value.abs().equals(1000),
    "Financial: VAT difference accurately isolated (+R 1,000 VAT variance)"
  );
  const energyCompVat = vatDiffRecon.determinant_comparisons.find((c) => c.determinant_code === "ENERGY_CHARGES_ZAR")!;
  assert(
    energyCompVat.variance_value.isZero(),
    "Financial: energy charges variance remains zero when only VAT differs"
  );

  // 4.3 Charge Difference
  const chargeDiffInput: AuthoritativeReconciliationInput = {
    ...exactInput,
    invoice_id: "INV-CHG-DIFF-01",
    invoice_number: "INV-CHG-DIFF-01",
    billed_energy_charges_zar: calcEnergyZar.plus(5000), // R 5,000 charge error
    billed_total_invoice_zar: calcTotalInvoiceZar.plus(5000),
  };
  const chargeDiffRecon = DeterministicReconciliationEngine.reconcile(chargeDiffInput);
  const energyCompChg = chargeDiffRecon.determinant_comparisons.find((c) => c.determinant_code === "ENERGY_CHARGES_ZAR")!;
  assert(
    energyCompChg.variance_value.abs().equals(5000),
    "Financial: charge difference accurately isolated (+R 5,000 charges variance)"
  );

  // 4.4 Zero Expected Amount (Zero consumption / Offline Meter)
  const zeroExpectedInput: AuthoritativeReconciliationInput = {
    ...exactInput,
    invoice_id: "INV-ZERO-EXP-01",
    invoice_number: "INV-ZERO-EXP-01",
    billed_total_invoice_zar: new Decimal(50000),
    calc_peak_kwh: new Decimal(0),
    calc_standard_kwh: new Decimal(0),
    calc_off_peak_kwh: new Decimal(0),
    calc_total_kwh: new Decimal(0),
    calc_maximum_demand_kva: new Decimal(0),
    calc_ratcheted_demand_kva: new Decimal(0),
    calc_reactive_energy_kvarh: new Decimal(0),
  };
  const zeroExpectedRecon = DeterministicReconciliationEngine.reconcile(zeroExpectedInput);
  assert(
    !Number.isNaN(zeroExpectedRecon.variance_total_zar.toNumber()),
    "Financial: zero expected consumption handled safely without NaN or division by zero"
  );
  assert(
    zeroExpectedRecon.variance_total_zar.abs().gt(0),
    "Financial: zero expected consumption calculates non-zero variance against billed total"
  );


  // ===========================================================================
  // 5. FAILURE HANDLING TESTS
  // ===========================================================================
  console.log("\n--- 5. FAILURE HANDLING DOMAIN TESTS ---");

  // 5.1 Missing Tariff
  const missingTariffFailure: ReconciliationFailureRecord = ReconciliationFailureHandler.createFailureRecord({
    runId: "RUN-FAIL-TARIFF-01",
    organisationId: "ORG-ACME",
    stage: "TARIFF_RESOLUTION",
    errorCode: "ERR_MISSING_TARIFF",
    message: "No gazetted NERSA tariff schedule found for tariff code 'INVALID_TARIFF_CODE'.",
    invoiceId: "INV-FAIL-01",
  });
  assert(missingTariffFailure.status === "FAILED", "Failure: missing tariff stored with status FAILED");
  assert(missingTariffFailure.stage === "TARIFF_RESOLUTION", "Failure: stage captured as TARIFF_RESOLUTION");
  assert(missingTariffFailure.error_code === "ERR_MISSING_TARIFF", "Failure: error code captured as ERR_MISSING_TARIFF");
  assert(missingTariffFailure.variance_total_zar === null, "Failure: missing tariff preserves null variance (not 0)");

  // 5.2 Missing AMR
  const missingAmrJob = await AutomaticProcessingPipeline.execute({
    invoice: {
      invoiceNumber: "INV-NO-AMR-01",
      accountNumber: "ACC-101",
      meterNumber: "MTR-MISSING",
      billingPeriodStart: "2026-05-01",
      billingPeriodEnd: "2026-05-31",
    },
    telemetryRows: [],
    amrCandidates: [],
  });
  assert(missingAmrJob.status === "AWAITING_AMR_DATA", "Failure: missing AMR flagged with status AWAITING_AMR_DATA");
  assert(missingAmrJob.message.includes("No AMR interval"), "Failure: missing AMR diagnostic message provided");

  // 5.3 Invalid Invoice
  const invalidInvoiceJob = await AutomaticProcessingPipeline.execute({
    invoice: null, // Null / invalid invoice document
  });
  assert(
    invalidInvoiceJob.status === "AWAITING_INVOICE_VALIDATION",
    "Failure: invalid invoice flagged with status AWAITING_INVOICE_VALIDATION"
  );
  assert(
    invalidInvoiceJob.message.includes("waiting for an invoice to be uploaded and validated"),
    "Failure: invalid invoice explanation returned"
  );

  // 5.4 Calculation Error
  const calculationErrorRecord = ReconciliationFailureHandler.createFailureRecord({
    runId: "RUN-FAIL-CALC-01",
    organisationId: "ORG-ACME",
    stage: "CHARGE_CALCULATION",
    errorCode: "ERR_CALCULATION_ENGINE_CRASH",
    message: "Division by zero encountered in power factor penalty derivation.",
    error: new Error("Division by zero in reactive power formula"),
  });
  assert(calculationErrorRecord.status === "FAILED", "Failure: calculation error status is FAILED");
  assert(calculationErrorRecord.stage === "CHARGE_CALCULATION", "Failure: calculation error stage is CHARGE_CALCULATION");
  assert(calculationErrorRecord.error_code === "ERR_CALCULATION_ENGINE_CRASH", "Failure: error code captured as ERR_CALCULATION_ENGINE_CRASH");
  assert(calculationErrorRecord.calculated_total_zar === null, "Failure: calculated total is null (never silently zero)");
  assert(calculationErrorRecord.variance_total_zar === null, "Failure: variance total is null (never Variance = R0)");

  // Verify display formatter never renders 'Variance = R0' on calculation error
  const failDisplay = ReconciliationFailureHandler.formatVarianceDisplay(
    calculationErrorRecord.status,
    calculationErrorRecord.variance_total_zar
  );
  assert(!failDisplay.text.includes("R 0.00"), "Failure: display NEVER shows 'Variance = R0' on calculation failure");
  assert(failDisplay.text.includes("CALCULATION FAILED"), "Failure: display explicitly indicates 'CALCULATION FAILED'");

  console.log("\n=================================================================");
  console.log("  ALL REQUIREMENT 40 MATRIX TESTS PASSED WITH 100% SUCCESS!      ");
  console.log("=================================================================\n");
}

if (process.argv[1] && process.argv[1].includes("reconciliation_comprehensive_matrix")) {
  runReconciliationMatrixTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}
