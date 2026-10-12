/**
 * RECONCILIATION ENGINE: EXCEPTIONS & STATUS TEST SUITE
 * ======================================================
 * Verifies Requirements 24 & 25:
 *
 * 24. RECONCILIATION EXCEPTIONS:
 *     - Standard exception codes:
 *       MISSING_AMR_DATA, INCOMPLETE_AMR_DATA, DUPLICATE_AMR_INTERVAL,
 *       INVALID_TIMESTAMP, UNIT_MISMATCH, METER_MISMATCH, ACCOUNT_MISMATCH,
 *       BILLING_PERIOD_MISMATCH, ENERGY_VARIANCE, DEMAND_VARIANCE,
 *       REACTIVE_VARIANCE, CHARGE_VARIANCE, TARIFF_UNAVAILABLE, INSUFFICIENT_DATA
 *     - Every exception must contain:
 *       code, severity, description, affected_field, evidence, source, status
 *
 * 25. RECONCILIATION STATUS:
 *     - Statuses: PENDING, PROCESSING, COMPLETED, COMPLETED_WITH_EXCEPTIONS, REVIEW_REQUIRED, FAILED
 *     - Golden Invariant:
 *       "A completed reconciliation with incomplete AMR data must NOT be represented as a clean successful reconciliation."
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js-light";

import {
  ReconciliationExceptionCode,
  ReconciliationException,
  ReconciliationExceptionFactory,
  EXCEPTION_CODE_METADATA_REGISTRY,
} from "../../domain/reconciliation/reconciliationExceptions";

import {
  ReconciliationStatus,
  RECONCILIATION_STATUS_REGISTRY,
  ReconciliationStatusResolver,
} from "../../domain/reconciliation/reconciliationStatus";

describe("Requirement 24: Reconciliation Exceptions Model", () => {
  const allRequiredCodes: ReconciliationExceptionCode[] = [
    "MISSING_AMR_DATA",
    "INCOMPLETE_AMR_DATA",
    "DUPLICATE_AMR_INTERVAL",
    "INVALID_TIMESTAMP",
    "UNIT_MISMATCH",
    "METER_MISMATCH",
    "ACCOUNT_MISMATCH",
    "BILLING_PERIOD_MISMATCH",
    "ENERGY_VARIANCE",
    "DEMAND_VARIANCE",
    "REACTIVE_VARIANCE",
    "CHARGE_VARIANCE",
    "TARIFF_UNAVAILABLE",
    "INSUFFICIENT_DATA",
  ];

  it("defines metadata for all 14 standard reconciliation exception codes", () => {
    for (const code of allRequiredCodes) {
      const meta = EXCEPTION_CODE_METADATA_REGISTRY[code];
      assert.ok(meta, `Metadata must be defined for code: ${code}`);
      assert.equal(meta.code, code);
      assert.ok(meta.default_severity.length > 0);
      assert.ok(meta.default_source.length > 0);
      assert.ok(meta.default_affected_field.length > 0);
      assert.ok(meta.description_template.length > 0);
      assert.ok(meta.remediation_guidance.length > 0);
    }
  });

  it("ensures every generated exception contains all 7 mandatory fields", () => {
    for (const code of allRequiredCodes) {
      const exc = ReconciliationExceptionFactory.create({
        code,
        evidence: { sample_key: `sample_value_for_${code}`, observed_at: new Date().toISOString() },
      });

      // 1. code
      assert.equal(exc.code, code, "Exception must contain code");
      // 2. severity
      assert.ok(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(exc.severity), "Exception must contain valid severity");
      // 3. description
      assert.ok(typeof exc.description === "string" && exc.description.length > 0, "Exception must contain description");
      // 4. affected field
      assert.ok(typeof exc.affected_field === "string" && exc.affected_field.length > 0, "Exception must contain affected_field");
      // 5. evidence
      assert.ok(typeof exc.evidence === "object" && exc.evidence !== null, "Exception must contain evidence");
      assert.ok(Object.keys(exc.evidence).length > 0, "Evidence must be non-empty");
      // 6. source
      assert.ok(typeof exc.source === "string" && exc.source.length > 0, "Exception must contain source");
      // 7. status
      assert.ok(["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "SUPPRESSED", "ESCALATED"].includes(exc.status), "Exception must contain status");
      // Unique ID
      assert.ok(exc.id.startsWith(`EXC-${code}-`), "Exception must contain deterministic ID");
    }
  });

  it("creates MISSING_AMR_DATA exception with specific evidence and critical severity", () => {
    const exc = ReconciliationExceptionFactory.missingAmrData({
      meter_number: "ESK-MTR-00982",
      billing_period_start: "2026-03-01",
      billing_period_end: "2026-03-31",
      account_number: "ACC-882190",
    });

    assert.equal(exc.code, "MISSING_AMR_DATA");
    assert.equal(exc.severity, "CRITICAL");
    assert.equal(exc.source, "AMR_DATA_INGESTION");
    assert.equal(exc.affected_field, "interval_data");
    assert.equal(exc.evidence.meter_number, "ESK-MTR-00982");
    assert.ok(exc.description.includes("No AMR interval telemetry data was found"));
  });

  it("creates INCOMPLETE_AMR_DATA exception capturing gap evidence and coverage metrics", () => {
    const exc = ReconciliationExceptionFactory.incompleteAmrData({
      meter_number: "MTR-4401",
      expected_intervals: 1440,
      actual_intervals: 1380,
      missing_intervals: 60,
      coverage_percentage: new Decimal("95.83"),
      gaps: [{ gapStart: "2026-03-15T00:00:00Z", gapEnd: "2026-03-16T06:00:00Z", missingCount: 60 }],
    });

    assert.equal(exc.code, "INCOMPLETE_AMR_DATA");
    assert.equal(exc.severity, "HIGH");
    assert.equal(exc.source, "DATA_COVERAGE_ENGINE");
    assert.equal(exc.affected_field, "data_coverage");
    assert.equal(exc.evidence.missing_intervals, 60);
    assert.ok(exc.description.includes("covers only 95.83%"));
  });

  it("creates METER_MISMATCH exception flagging serial number discrepancy", () => {
    const exc = ReconciliationExceptionFactory.meterMismatch({
      invoice_meter_number: "INV-MTR-100",
      amr_meter_number: "AMR-MTR-200",
    });

    assert.equal(exc.code, "METER_MISMATCH");
    assert.equal(exc.severity, "CRITICAL");
    assert.equal(exc.affected_field, "meter_number");
    assert.ok(exc.description.includes("INV-MTR-100"));
    assert.ok(exc.description.includes("AMR-MTR-200"));
  });

  it("creates ENERGY_VARIANCE exception with numerical variance evidence", () => {
    const exc = ReconciliationExceptionFactory.energyVariance({
      component_code: "PEAK_KWH",
      billed_kwh: "12500.00",
      amr_kwh: "12000.00",
      absolute_variance: "500.00",
      percentage_variance: "4.1667",
      tolerance_threshold: "100.00 kWh",
    });

    assert.equal(exc.code, "ENERGY_VARIANCE");
    assert.equal(exc.severity, "HIGH");
    assert.equal(exc.affected_field, "peak_kwh");
    assert.equal(exc.evidence.absolute_variance, "500.00");
  });
});

describe("Requirement 25: Reconciliation Status Model & Business Invariants", () => {
  const allRequiredStatuses: ReconciliationStatus[] = [
    "PENDING",
    "PROCESSING",
    "COMPLETED",
    "COMPLETED_WITH_EXCEPTIONS",
    "REVIEW_REQUIRED",
    "FAILED",
  ];

  it("defines registry metadata for all 6 required reconciliation statuses", () => {
    for (const status of allRequiredStatuses) {
      const def = RECONCILIATION_STATUS_REGISTRY[status];
      assert.ok(def, `Registry must define status: ${status}`);
      assert.equal(def.status, status);
      assert.ok(def.label.length > 0);
      assert.ok(def.business_meaning.length > 0);
      assert.ok(typeof def.is_terminal === "boolean");
      assert.ok(typeof def.is_clean_success === "boolean");
      assert.ok(typeof def.requires_human_attention === "boolean");
      assert.ok(typeof def.allows_automatic_payment_release === "boolean");
    }
  });

  it("enforces ONLY COMPLETED has is_clean_success === true and allows payment release", () => {
    for (const status of allRequiredStatuses) {
      const def = RECONCILIATION_STATUS_REGISTRY[status];
      if (status === "COMPLETED") {
        assert.equal(def.is_clean_success, true);
        assert.equal(def.allows_automatic_payment_release, true);
        assert.equal(def.requires_human_attention, false);
      } else {
        assert.equal(def.is_clean_success, false, `${status} must NOT be clean success`);
        assert.equal(def.allows_automatic_payment_release, false, `${status} must NOT allow auto payment release`);
      }
    }
  });

  it("resolves PENDING when in initial lifecycle phase", () => {
    const res = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "PENDING",
      exceptions: [],
    });
    assert.equal(res.status, "PENDING");
    assert.equal(res.is_clean_success, false);
  });

  it("resolves PROCESSING when actively running", () => {
    const res = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "PROCESSING",
      exceptions: [],
    });
    assert.equal(res.status, "PROCESSING");
    assert.equal(res.is_clean_success, false);
  });

  it("resolves FAILED when fatal error occurred or tariff schedule is unavailable", () => {
    const res = ReconciliationStatusResolver.deriveStatus({
      fatal_error: new Error("NERSA gazetted tariff document could not be resolved"),
      exceptions: [
        ReconciliationExceptionFactory.tariffUnavailable({ tariff_code: "UNKNOWN_TARIFF" }),
      ],
    });
    assert.equal(res.status, "FAILED");
    assert.equal(res.is_clean_success, false);
  });

  it("CORE INVARIANT: Completed reconciliation with incomplete AMR data must NEVER be COMPLETED", () => {
    // Scenario 1: Coverage is 96.5% (< 100%)
    const res1 = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      coverage_percentage: new Decimal("96.50"),
      exceptions: [],
    });
    assert.notEqual(res1.status, "COMPLETED", "Incomplete AMR data must NEVER yield COMPLETED status");
    assert.equal(res1.status, "COMPLETED_WITH_EXCEPTIONS");
    assert.equal(res1.is_clean_success, false);
    assert.equal(res1.has_amr_data_deficiency, true);

    // Scenario 2: has_incomplete_amr flag is explicitly true
    const res2 = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      has_incomplete_amr: true,
      coverage_percentage: 100, // even if reported as 100
      exceptions: [],
    });
    assert.notEqual(res2.status, "COMPLETED");
    assert.equal(res2.status, "COMPLETED_WITH_EXCEPTIONS");

    // Scenario 3: INCOMPLETE_AMR_DATA exception exists in list
    const incompleteExc = ReconciliationExceptionFactory.incompleteAmrData({
      expected_intervals: 1440,
      actual_intervals: 1400,
      missing_intervals: 40,
      coverage_percentage: "97.22",
    });

    const res3 = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      exceptions: [incompleteExc],
    });
    assert.notEqual(res3.status, "COMPLETED");
    assert.equal(res3.status, "REVIEW_REQUIRED"); // High severity exception promotes to REVIEW_REQUIRED
    assert.equal(res3.is_clean_success, false);

    // Scenario 4: MISSING_AMR_DATA exception exists
    const missingExc = ReconciliationExceptionFactory.missingAmrData({ meter_number: "M1" });
    const res4 = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      exceptions: [missingExc],
    });
    assert.notEqual(res4.status, "COMPLETED");
    assert.equal(res4.status, "REVIEW_REQUIRED");
  });

  it("resolves REVIEW_REQUIRED when METER_MISMATCH or ACCOUNT_MISMATCH occurs", () => {
    const meterExc = ReconciliationExceptionFactory.meterMismatch({
      invoice_meter_number: "MTR-1",
      amr_meter_number: "MTR-2",
    });

    const res = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      exceptions: [meterExc],
      has_meter_mismatch: true,
      coverage_percentage: 100,
    });

    assert.equal(res.status, "REVIEW_REQUIRED");
    assert.equal(res.critical_exception_count, 1);
    assert.equal(res.definition.requires_human_attention, true);
    assert.equal(res.is_clean_success, false);
  });

  it("resolves REVIEW_REQUIRED when overall variance is OUTSIDE_TOLERANCE", () => {
    const res = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      coverage_percentage: 100,
      overall_variance_status: "OUTSIDE_TOLERANCE",
      all_components_within_tolerance: false,
      exceptions: [
        ReconciliationExceptionFactory.energyVariance({
          component_code: "PEAK_KWH",
          billed_kwh: 10000,
          amr_kwh: 9000,
          absolute_variance: 1000,
          percentage_variance: 11.11,
        }),
      ],
    });

    assert.equal(res.status, "REVIEW_REQUIRED");
    assert.equal(res.is_clean_success, false);
  });

  it("resolves COMPLETED ONLY when AMR is 100% complete, zero open exceptions, and all variances within tolerance", () => {
    const resClean = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      has_incomplete_amr: false,
      coverage_percentage: new Decimal("100.00"),
      exceptions: [],
      overall_variance_status: "MATCH",
      all_components_within_tolerance: true,
      has_meter_mismatch: false,
      has_account_mismatch: false,
    });

    assert.equal(resClean.status, "COMPLETED");
    assert.equal(resClean.is_clean_success, true);
    assert.equal(resClean.has_amr_data_deficiency, false);
    assert.equal(resClean.unresolved_exception_count, 0);
    assert.equal(resClean.definition.allows_automatic_payment_release, true);
  });

  it("resolves COMPLETED when variances are non-zero but strictly WITHIN_TOLERANCE and AMR is 100% complete", () => {
    const resWithinTol = ReconciliationStatusResolver.deriveStatus({
      lifecycle_phase: "EXECUTION_COMPLETE",
      has_incomplete_amr: false,
      coverage_percentage: 100,
      exceptions: [],
      overall_variance_status: "WITHIN_TOLERANCE",
      all_components_within_tolerance: true,
    });

    assert.equal(resWithinTol.status, "COMPLETED");
    assert.equal(resWithinTol.is_clean_success, true);
  });
});
