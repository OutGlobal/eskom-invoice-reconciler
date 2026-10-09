/**
 * UNIT TEST SUITE: RECONCILIATION AUDITABILITY & CALCULATION VERSIONING
 * ======================================================================
 * Tests Requirement 26 (Auditability Model answering 10 questions)
 * and Requirement 27 (Calculation Engine Versioning & Immutability).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js-light";

import {
  ReconciliationAuditModelBuilder,
  type ReconciliationAuditModel,
  type InvoiceAuditReference,
  type MeterAuditReference,
  type AmrFileAuditReference,
  type BillingPeriodAuditReference,
  type TariffVersionAuditReference,
  type CalculationVersionAuditReference,
  type ToleranceAuditReference,
  type AppliedAssumption,
  type ApprovalAuditReference,
} from "../../domain/reconciliation/reconciliationAuditModel";

import {
  CALCULATION_ENGINE_V1,
  CALCULATION_ENGINE_V2,
  CALCULATION_ENGINE_VERSIONS,
  CalculationVersioningEngine,
  SilentRecalculationProhibitedError,
  type HistoricalCalculationRecord,
} from "../../domain/reconciliation/calculationVersioningEngine";

import { ReconciliationExceptionFactory } from "../../domain/reconciliation/reconciliationExceptions";

describe("Requirement 26: Auditability Model (10 Mandatory Answers)", () => {
  const sampleInvoice: InvoiceAuditReference = {
    invoice_id: "INV-2024-06-001",
    invoice_number: "9876543210",
    account_number: "ACC-54321",
    invoice_date: "2024-07-02",
    document_id: "DOC-PDF-001",
    document_filename: "Eskom_Invoice_June_2024.pdf",
    document_hash_sha256: "SHA256:abcdef1234567890abcdef1234567890",
    billed_total_zar: "450250.75",
    currency: "ZAR",
  };

  const sampleMeter: MeterAuditReference = {
    meter_id: "MTR-001",
    meter_number: "ESK-MET-998822",
    meter_multiplier: 1.0,
    site_id: "SITE-MIDRAND-01",
    site_name: "Midrand Industrial Park Substation",
    meter_type: "FOUR_QUADRANT_SOLID_STATE",
  };

  const sampleAmrFile: AmrFileAuditReference = {
    amr_file_id: "AMR-FILE-202406",
    amr_file_name: "amr_telemetry_202406.csv",
    amr_file_hash_sha256: "SHA256:11223344556677889900aabbccddeeff",
    ingested_at: "2024-07-01T02:00:00Z",
    interval_count: 1440,
    interval_length_minutes: 30,
    coverage_percentage: 100.0,
    data_source_channel: "MV90_PULSE_COLLECTOR",
  };

  const sampleBillingPeriod: BillingPeriodAuditReference = {
    start_date: "2024-06-01",
    end_date: "2024-06-30",
    duration_days: 30,
    season: "HIGH_SEASON",
    timezone: "Africa/Johannesburg",
    calendar_schedule_id: "ESKOM-TOU-CALENDAR-2024",
  };

  const sampleTariffVersion: TariffVersionAuditReference = {
    tariff_id: "TRF-MEGATOX-2024",
    tariff_code: "MEGATOX",
    tariff_version: "2024/2025-V1",
    effective_from: "2024-04-01",
    effective_to: "2025-03-31",
    gazette_reference: "NERSA Gazette #49281 Eskom Retail Tariff Plan",
    structure_type: "TIME_OF_USE",
  };

  const sampleCalculationVersion: CalculationVersionAuditReference = {
    calculation_engine_version: CALCULATION_ENGINE_V1,
    engine_git_commit: "43497bd",
    algorithm_hash: "SHA256:ALGO-RECON-V1",
    release_date: "2024-01-15",
    configuration_version: "1.0.0",
  };

  const sampleTolerance: ToleranceAuditReference = {
    profile_name: "STANDARD_COMMERCIAL_PROFILE",
    thresholds: {
      energy_quantity: { percentage: "0.50", max_kwh: "100.00" },
      demand: { percentage: "1.00", max_kva: "10.00" },
      reactive_energy: { percentage: "2.00", max_kvarh: "50.00" },
      financial_amount: { percentage: "0.50", max_zar: "50.00" },
      financial_percentage: { max_percentage: "0.50" },
    },
    evaluation_mode: "STRICT_ALL_PASS",
  };

  const sampleAssumptions: AppliedAssumption[] = [
    {
      id: "ASM-001",
      category: "CALENDAR",
      description: "Youth Day on Sunday 16 June observed on Monday 17 June as public holiday off-peak TOU schedule.",
      governing_rule: "Public Holidays Act No 36 of 1994",
      applied_at: "2024-07-02T10:00:00Z",
    },
    {
      id: "ASM-002",
      category: "ROUNDING",
      description: "Financial currency amounts rounded to 2 decimal places using Decimal.ROUND_HALF_UP.",
      governing_rule: "Eskom Commercial Tariff Schedule",
      applied_at: "2024-07-02T10:00:00Z",
    },
  ];

  const sampleExceptions = [
    ReconciliationExceptionFactory.energyVariance({
      billed_kwh: 125000,
      expected_kwh: 124950,
      variance_kwh: 50,
      variance_percent: 0.04,
      threshold_percent: 0.50,
    }),
  ];

  const sampleApproval: ApprovalAuditReference = {
    approval_id: "APPR-8899",
    status: "APPROVED",
    approved_by_user_id: "USR-CHIEF-AUDITOR-01",
    approver_name: "Jane Doe (Lead Energy Auditor)",
    approver_email: "jane.doe@enera-ai.com",
    approver_role: "LEAD_ENERGY_AUDITOR",
    approved_at: "2024-07-02T14:30:00Z",
    decision_notes: "Minor 50 kWh energy variance within 0.5% tolerance threshold. Reconciled and approved for billing disbursement.",
    approval_signature_hash: "SHA256:SIG-JANE-DOE-20240702",
  };

  it("builds a complete ReconciliationAuditModel answering all 10 core questions", () => {
    const auditModel = ReconciliationAuditModelBuilder.create({
      reconciliation_id: "RECON-2024-06-001",
      reconciliation_run_id: "RUN-998811",
      organisation_id: "ORG-ACME-CORP",
      reconciliation_status: "COMPLETED",
      invoice: sampleInvoice,
      meter: sampleMeter,
      amr_file: sampleAmrFile,
      billing_period: sampleBillingPeriod,
      tariff_version: sampleTariffVersion,
      calculation_version: sampleCalculationVersion,
      tolerance: sampleTolerance,
      assumptions: sampleAssumptions,
      exceptions: sampleExceptions,
      approval: sampleApproval,
    });

    assert.ok(auditModel.reconciliation_id === "RECON-2024-06-001");
    assert.ok(auditModel.audit_record_hash_sha256?.startsWith("SHA256:FINGERPRINT-"));

    // Extract all answers directly
    const answers = ReconciliationAuditModelBuilder.answerAuditQuestions(auditModel);

    // 1. What invoice was used?
    assert.strictEqual(answers.what_invoice_was_used.invoice_number, "9876543210");
    assert.strictEqual(answers.what_invoice_was_used.account_number, "ACC-54321");
    assert.strictEqual(answers.what_invoice_was_used.billed_total_zar, "450250.75");

    // 2. What meter was used?
    assert.strictEqual(answers.what_meter_was_used.meter_number, "ESK-MET-998822");
    assert.strictEqual(answers.what_meter_was_used.meter_multiplier, 1.0);

    // 3. What AMR file was used?
    assert.strictEqual(answers.what_amr_file_was_used.amr_file_name, "amr_telemetry_202406.csv");
    assert.strictEqual(answers.what_amr_file_was_used.interval_count, 1440);
    assert.strictEqual(answers.what_amr_file_was_used.coverage_percentage, 100.0);

    // 4. What billing period was used?
    assert.strictEqual(answers.what_billing_period_was_used.start_date, "2024-06-01");
    assert.strictEqual(answers.what_billing_period_was_used.end_date, "2024-06-30");
    assert.strictEqual(answers.what_billing_period_was_used.season, "HIGH_SEASON");

    // 5. What tariff version was used?
    assert.strictEqual(answers.what_tariff_version_was_used.tariff_code, "MEGATOX");
    assert.strictEqual(answers.what_tariff_version_was_used.tariff_version, "2024/2025-V1");

    // 6. What calculation version was used?
    assert.strictEqual(answers.what_calculation_version_was_used.calculation_engine_version, CALCULATION_ENGINE_V1);

    // 7. What tolerance was used?
    assert.strictEqual(answers.what_tolerance_was_used.profile_name, "STANDARD_COMMERCIAL_PROFILE");
    assert.strictEqual(answers.what_tolerance_was_used.thresholds.energy_quantity.percentage, "0.50");

    // 8. What assumptions were applied?
    assert.strictEqual(answers.what_assumptions_were_applied.length, 2);
    assert.strictEqual(answers.what_assumptions_were_applied[0].category, "CALENDAR");

    // 9. What exceptions occurred?
    assert.strictEqual(answers.what_exceptions_occurred.length, 1);
    assert.strictEqual(answers.what_exceptions_occurred[0].code, "ENERGY_VARIANCE");

    // 10. Who approved the result?
    assert.strictEqual(answers.who_approved_the_result.status, "APPROVED");
    assert.strictEqual(answers.who_approved_the_result.approver_name, "Jane Doe (Lead Energy Auditor)");
  });

  it("fails audit validation if any mandatory determinant pillar is omitted", () => {
    // Missing invoice and meter
    const invalidCandidate: Partial<ReconciliationAuditModel> = {
      reconciliation_id: "REC-INCOMPLETE",
      amr_file: sampleAmrFile,
      billing_period: sampleBillingPeriod,
    };

    const validation = ReconciliationAuditModelBuilder.validateAuditCompleteness(invalidCandidate);
    assert.strictEqual(validation.isValid, false);
    assert.ok(validation.missingPillars.some((p) => p.includes("invoice")));
    assert.ok(validation.missingPillars.some((p) => p.includes("meter")));
    assert.ok(validation.missingPillars.some((p) => p.includes("tariff_version")));
    assert.ok(validation.missingPillars.some((p) => p.includes("calculation_version")));
    assert.ok(validation.missingPillars.some((p) => p.includes("tolerance")));
  });

  it("throws error in create() when required audit pillars are missing", () => {
    assert.throws(
      () => {
        ReconciliationAuditModelBuilder.create({
          reconciliation_id: "REC-FAIL",
          reconciliation_run_id: "RUN-FAIL",
          organisation_id: "ORG-FAIL",
          reconciliation_status: "FAILED",
          // @ts-expect-error test invalid invoice
          invoice: null,
          meter: sampleMeter,
          amr_file: sampleAmrFile,
          billing_period: sampleBillingPeriod,
          tariff_version: sampleTariffVersion,
          calculation_version: sampleCalculationVersion,
          tolerance: sampleTolerance,
        });
      },
      /Missing mandatory audit determinants/,
    );
  });
});

describe("Requirement 27: Calculation Versioning & Reproducibility", () => {
  it("defines standard calculation versions v1 and v2 with formula specifications", () => {
    const v1Meta = CALCULATION_ENGINE_VERSIONS[CALCULATION_ENGINE_V1];
    const v2Meta = CALCULATION_ENGINE_VERSIONS[CALCULATION_ENGINE_V2];

    assert.strictEqual(v1Meta.version, "reconciliation_engine_v1");
    assert.strictEqual(v1Meta.semantic_version, "1.0.0");
    assert.ok(v1Meta.formula_specification.tou_aggregation.length > 0);

    assert.strictEqual(v2Meta.version, "reconciliation_engine_v2");
    assert.strictEqual(v2Meta.semantic_version, "2.0.0");
    assert.strictEqual(v2Meta.is_current_default, true);
    assert.ok(v2Meta.formula_specification.power_factor_formula.includes("vector"));
  });

  it("ensures historical reconciliations remain reproducible under their original calculation version", () => {
    const historicalRun: HistoricalCalculationRecord = {
      reconciliation_id: "RECON-HIST-001",
      run_id: "RUN-HIST-001",
      calculation_engine_version: CALCULATION_ENGINE_V1,
      invoice_id: "INV-2023-11",
      meter_id: "MTR-HIST",
      billing_period_start: "2023-11-01",
      billing_period_end: "2023-11-30",
      tariff_version_id: "TRF-2023",
      result_checksum: "SHA256:HIST-RUN-001-CANONICAL",
      calculated_total_zar: "125430.50",
      status: "COMPLETED",
      is_immutable: true,
      created_at: "2023-12-01T12:00:00Z",
    };

    // Replay with identical inputs
    const repro = CalculationVersioningEngine.reproduceHistoricalRun(historicalRun, {
      billed_total_zar: "125430.50",
      expected_calculated_total_zar: "125430.50",
    });

    assert.strictEqual(repro.is_reproducible, true);
    assert.strictEqual(repro.drift_detected, false);
    assert.strictEqual(repro.version_used, CALCULATION_ENGINE_V1);
    assert.strictEqual(repro.numerical_difference_zar, "0.00");
  });

  it("detects drift when replayed calculations do not match the historical record", () => {
    const historicalRun: HistoricalCalculationRecord = {
      reconciliation_id: "RECON-HIST-DRIFT",
      run_id: "RUN-HIST-DRIFT",
      calculation_engine_version: CALCULATION_ENGINE_V1,
      invoice_id: "INV-2023-11",
      meter_id: "MTR-HIST",
      billing_period_start: "2023-11-01",
      billing_period_end: "2023-11-30",
      tariff_version_id: "TRF-2023",
      result_checksum: "SHA256:HIST-RUN-DRIFT",
      calculated_total_zar: "125430.50",
      status: "COMPLETED",
      is_immutable: true,
      created_at: "2023-12-01T12:00:00Z",
    };

    // Replay with divergent result
    const repro = CalculationVersioningEngine.reproduceHistoricalRun(historicalRun, {
      billed_total_zar: "125430.50",
      expected_calculated_total_zar: "125500.00", // R 69.50 drift
    });

    assert.strictEqual(repro.is_reproducible, false);
    assert.strictEqual(repro.drift_detected, true);
    assert.strictEqual(repro.numerical_difference_zar, "69.50");
  });

  it("PROHIBITS SILENT RECALCULATION: throws SilentRecalculationProhibitedError on in-place cross-version recalculation", () => {
    const historicalRun: HistoricalCalculationRecord = {
      reconciliation_id: "RECON-LOCKED-01",
      run_id: "RUN-LOCKED-01",
      calculation_engine_version: CALCULATION_ENGINE_V1,
      invoice_id: "INV-2023-01",
      meter_id: "MTR-LOCKED",
      billing_period_start: "2023-01-01",
      billing_period_end: "2023-01-31",
      tariff_version_id: "TRF-2023",
      result_checksum: "SHA256:ORIGINAL-RUN",
      calculated_total_zar: "98000.00",
      status: "COMPLETED",
      is_immutable: true,
      created_at: "2023-02-01T08:00:00Z",
    };

    // Attempting to evaluate or overwrite in-place with v2 must throw
    assert.throws(
      () => {
        CalculationVersioningEngine.assertNoSilentRecalculation(
          historicalRun,
          CALCULATION_ENGINE_V2,
        );
      },
      (err: any) => {
        assert.ok(err instanceof SilentRecalculationProhibitedError);
        assert.ok(err.message.includes("Cannot silently recalculate or mutate historical reconciliation"));
        assert.ok(err.message.includes("Historical reconciliations are immutable"));
        return true;
      },
    );
  });

  it("handles explicit version transitions (v1 -> v2) by creating a linked superseding record without mutating historical run", () => {
    const historicalRun: HistoricalCalculationRecord = {
      reconciliation_id: "RECON-ORIG-01",
      run_id: "RUN-ORIG-01",
      calculation_engine_version: CALCULATION_ENGINE_V1,
      invoice_id: "INV-2024-05",
      meter_id: "MTR-001",
      billing_period_start: "2024-05-01",
      billing_period_end: "2024-05-31",
      tariff_version_id: "TRF-2024",
      result_checksum: "SHA256:ORIG-CHECKSUM",
      calculated_total_zar: "310000.00",
      status: "COMPLETED",
      is_immutable: true,
      created_at: "2024-06-01T10:00:00Z",
    };

    const superseding = CalculationVersioningEngine.createSupersedingRecalculation({
      historicalRecord: historicalRun,
      newVersion: CALCULATION_ENGINE_V2,
      newCalculatedTotalZar: "309850.25",
      recalculationReason: "Upgraded to Engine v2 with IEEE-1459 vector power factor and holiday substitutions.",
      performedByUserId: "USR-ENGINEER-01",
    });

    // 1. Original historical record remains intact, only stamping who superseded it
    assert.strictEqual(superseding.original_record.reconciliation_id, "RECON-ORIG-01");
    assert.strictEqual(superseding.original_record.calculation_engine_version, CALCULATION_ENGINE_V1);
    assert.strictEqual(superseding.original_record.calculated_total_zar, "310000.00");
    assert.ok(superseding.original_record.superseded_by_run_id?.startsWith("RUN-"));

    // 2. Superseding record is a brand new, distinct run under v2
    assert.ok(superseding.superseding_record.reconciliation_id !== historicalRun.reconciliation_id);
    assert.strictEqual(superseding.superseding_record.calculation_engine_version, CALCULATION_ENGINE_V2);
    assert.strictEqual(
      new Decimal(superseding.superseding_record.calculated_total_zar.toString()).toFixed(2),
      "309850.25",
    );

    // 3. Version transition and audit trace are explicitly documented
    assert.strictEqual(superseding.version_transition.from_version, CALCULATION_ENGINE_V1);
    assert.strictEqual(superseding.version_transition.to_version, CALCULATION_ENGINE_V2);
    assert.ok(superseding.audit_entry_id.startsWith("AUDIT-RECON-MIGRATION-"));
    assert.strictEqual(superseding.performed_by_user_id, "USR-ENGINEER-01");
  });
});
