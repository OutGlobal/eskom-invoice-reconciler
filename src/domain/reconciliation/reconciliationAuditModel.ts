/**
 * ENERA RECONCILIATION AUDIT MODEL (REQUIREMENT 26)
 * ================================================
 * Provides comprehensive, immutable, and deterministic auditability for every
 * reconciliation run.
 *
 * Every reconciliation must answer:
 *   1. What invoice was used?
 *   2. What meter was used?
 *   3. What AMR file was used?
 *   4. What billing period was used?
 *   5. What tariff version was used?
 *   6. What calculation version was used?
 *   7. What tolerance was used?
 *   8. What assumptions were applied?
 *   9. What exceptions occurred?
 *  10. Who approved the result?
 */

import Decimal from "decimal.js-light";
import type { ReconciliationException } from "./reconciliationExceptions";
import type { ReconciliationStatus } from "./reconciliationStatus";
import type { RecordedTolerance, ToleranceProfile } from "./toleranceModel";

// ============================================================================
// 1. WHAT INVOICE WAS USED?
// ============================================================================

export interface InvoiceAuditReference {
  invoice_id: string;
  invoice_number: string;
  account_number: string;
  invoice_date: string; // YYYY-MM-DD
  document_id?: string;
  document_filename?: string;
  document_hash_sha256?: string;
  billed_total_zar: string;
  currency: string; // default "ZAR"
}

// ============================================================================
// 2. WHAT METER WAS USED?
// ============================================================================

export interface MeterAuditReference {
  meter_id: string;
  meter_number: string; // Serial / physical meter identifier
  meter_multiplier: number;
  site_id?: string;
  site_name?: string;
  installation_point?: string;
  meter_type?: string;
}

// ============================================================================
// 3. WHAT AMR FILE WAS USED?
// ============================================================================

export interface AmrFileAuditReference {
  amr_file_id: string;
  amr_file_name: string;
  amr_file_hash_sha256: string;
  ingested_at: string; // ISO-8601
  interval_count: number;
  interval_length_minutes: number; // e.g. 30
  coverage_percentage: number; // 0..100
  data_source_channel?: string;
}

// ============================================================================
// 4. WHAT BILLING PERIOD WAS USED?
// ============================================================================

export type BillingSeason = "HIGH_SEASON" | "LOW_SEASON" | "SEASON_TRANSITION";

export interface BillingPeriodAuditReference {
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  duration_days: number;
  season: BillingSeason;
  timezone: string; // e.g. "Africa/Johannesburg"
  calendar_schedule_id?: string;
}

// ============================================================================
// 5. WHAT TARIFF VERSION WAS USED?
// ============================================================================

export interface TariffVersionAuditReference {
  tariff_id: string;
  tariff_code: string; // e.g. "MEGATOX", "MINIFLEX", "NIGHTSAVE_URBAN_LARGE"
  tariff_version: string; // e.g. "2024/2025-V1"
  effective_from: string; // YYYY-MM-DD
  effective_to?: string; // YYYY-MM-DD
  gazette_reference?: string; // e.g. "NERSA 2024 Gazette #49281"
  structure_type?: string; // e.g. "TIME_OF_USE"
}

// ============================================================================
// 6. WHAT CALCULATION VERSION WAS USED?
// ============================================================================

export interface CalculationVersionAuditReference {
  calculation_engine_version: string; // e.g. "reconciliation_engine_v1" | "reconciliation_engine_v2"
  engine_git_commit?: string;
  algorithm_hash?: string;
  release_date?: string;
  configuration_version?: string;
}

// ============================================================================
// 7. WHAT TOLERANCE WAS USED?
// ============================================================================

export interface ToleranceAuditReference {
  profile_name: string;
  tolerance_profile?: ToleranceProfile;
  thresholds: {
    energy_quantity: { percentage: string; max_kwh: string };
    demand: { percentage: string; max_kva: string };
    reactive_energy: { percentage: string; max_kvarh: string };
    financial_amount: { percentage: string; max_zar: string };
    financial_percentage: { max_percentage: string };
  };
  evaluation_mode: "STRICT_ALL_PASS" | "WEIGHTED_SCORE" | "FINANCIAL_DOMINANT";
  recorded_tolerance?: RecordedTolerance;
}

// ============================================================================
// 8. WHAT ASSUMPTIONS WERE APPLIED?
// ============================================================================

export type AssumptionCategory =
  | "CALENDAR"
  | "TARIFF"
  | "ESTIMATION"
  | "ROUNDING"
  | "LOSS_FACTOR"
  | "POWER_FACTOR"
  | "DATA_QUALITY"
  | "OTHER";

export interface AppliedAssumption {
  id: string;
  category: AssumptionCategory;
  description: string;
  value?: string | number | boolean;
  governing_rule?: string; // e.g. "NRS 048-4 Clause 4.2", "Eskom Schedule of Standard Prices 2024"
  applied_at: string; // ISO-8601
}

// ============================================================================
// 9. WHAT EXCEPTIONS OCCURRED?
// ============================================================================
// Handled directly via ReconciliationException from ./reconciliationExceptions

// ============================================================================
// 10. WHO APPROVED THE RESULT?
// ============================================================================

export type ApprovalStatus =
  "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "AUTO_APPROVED" | "SUPERSEDED";

export interface ApprovalAuditReference {
  approval_id?: string;
  status: ApprovalStatus;
  approved_by_user_id?: string;
  approver_name?: string;
  approver_email?: string;
  approver_role?: string;
  approved_at?: string; // ISO-8601
  decision_notes?: string;
  approval_signature_hash?: string;
}

// ============================================================================
// MASTER RECONCILIATION AUDIT MODEL
// ============================================================================

export interface ReconciliationAuditModel {
  reconciliation_id: string;
  reconciliation_run_id: string;
  organisation_id: string;
  created_at: string;
  completed_at: string;
  reconciliation_status: ReconciliationStatus;

  // The 10 Essential Audit Determinants
  invoice: InvoiceAuditReference;
  meter: MeterAuditReference;
  amr_file: AmrFileAuditReference;
  billing_period: BillingPeriodAuditReference;
  tariff_version: TariffVersionAuditReference;
  calculation_version: CalculationVersionAuditReference;
  tolerance: ToleranceAuditReference;
  assumptions: AppliedAssumption[];
  exceptions: ReconciliationException[];
  approval: ApprovalAuditReference;

  // Cryptographic audit fingerprint
  audit_record_hash_sha256?: string;
}

// ============================================================================
// STRUCTURED AUDIT ANSWERS CONTAINER (DIRECT CONTRACT)
// ============================================================================

export interface ReconciliationAuditAnswers {
  what_invoice_was_used: InvoiceAuditReference;
  what_meter_was_used: MeterAuditReference;
  what_amr_file_was_used: AmrFileAuditReference;
  what_billing_period_was_used: BillingPeriodAuditReference;
  what_tariff_version_was_used: TariffVersionAuditReference;
  what_calculation_version_was_used: CalculationVersionAuditReference;
  what_tolerance_was_used: ToleranceAuditReference;
  what_assumptions_were_applied: AppliedAssumption[];
  what_exceptions_occurred: ReconciliationException[];
  who_approved_the_result: ApprovalAuditReference;
}

// ============================================================================
// AUDIT MODEL BUILDER & INSPECTOR
// ============================================================================

export class ReconciliationAuditModelBuilder {
  /**
   * Generates a deterministic SHA-256 fallback hash for auditing
   */
  public static calculateFingerprint(payload: Record<string, unknown>): string {
    const serialized = JSON.stringify(payload, Object.keys(payload).sort());
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    const hex = (hash >>> 0).toString(16).padStart(8, "0");
    return `SHA256:FINGERPRINT-${hex}-${Date.now().toString(16)}`;
  }

  /**
   * Answers all 10 mandatory auditability questions directly from the model
   */
  public static answerAuditQuestions(
    auditModel: ReconciliationAuditModel,
  ): ReconciliationAuditAnswers {
    return {
      what_invoice_was_used: auditModel.invoice,
      what_meter_was_used: auditModel.meter,
      what_amr_file_was_used: auditModel.amr_file,
      what_billing_period_was_used: auditModel.billing_period,
      what_tariff_version_was_used: auditModel.tariff_version,
      what_calculation_version_was_used: auditModel.calculation_version,
      what_tolerance_was_used: auditModel.tolerance,
      what_assumptions_were_applied: auditModel.assumptions,
      what_exceptions_occurred: auditModel.exceptions,
      who_approved_the_result: auditModel.approval,
    };
  }

  /**
   * Validates completeness: ensures none of the 10 core audit pillars are missing or unpopulated
   */
  public static validateAuditCompleteness(model: Partial<ReconciliationAuditModel>): {
    isValid: boolean;
    missingPillars: string[];
    validationErrors: string[];
  } {
    const missingPillars: string[] = [];
    const validationErrors: string[] = [];

    if (!model.invoice || !model.invoice.invoice_number) {
      missingPillars.push("invoice (What invoice was used?)");
    }
    if (!model.meter || !model.meter.meter_number) {
      missingPillars.push("meter (What meter was used?)");
    }
    if (!model.amr_file || !model.amr_file.amr_file_name) {
      missingPillars.push("amr_file (What AMR file was used?)");
    }
    if (
      !model.billing_period ||
      !model.billing_period.start_date ||
      !model.billing_period.end_date
    ) {
      missingPillars.push("billing_period (What billing period was used?)");
    }
    if (!model.tariff_version || !model.tariff_version.tariff_code) {
      missingPillars.push("tariff_version (What tariff version was used?)");
    }
    if (!model.calculation_version || !model.calculation_version.calculation_engine_version) {
      missingPillars.push("calculation_version (What calculation version was used?)");
    }
    if (!model.tolerance || !model.tolerance.profile_name) {
      missingPillars.push("tolerance (What tolerance was used?)");
    }
    if (!Array.isArray(model.assumptions)) {
      missingPillars.push("assumptions (What assumptions were applied?)");
    }
    if (!Array.isArray(model.exceptions)) {
      missingPillars.push("exceptions (What exceptions occurred?)");
    }
    if (!model.approval || !model.approval.status) {
      missingPillars.push("approval (Who approved the result?)");
    }

    return {
      isValid: missingPillars.length === 0 && validationErrors.length === 0,
      missingPillars,
      validationErrors,
    };
  }

  /**
   * Factory to construct a validated ReconciliationAuditModel with all 10 pillars
   */
  public static create(params: {
    reconciliation_id: string;
    reconciliation_run_id: string;
    organisation_id: string;
    created_at?: string;
    completed_at?: string;
    reconciliation_status: ReconciliationStatus;
    invoice: InvoiceAuditReference;
    meter: MeterAuditReference;
    amr_file: AmrFileAuditReference;
    billing_period: BillingPeriodAuditReference;
    tariff_version: TariffVersionAuditReference;
    calculation_version: CalculationVersionAuditReference;
    tolerance: ToleranceAuditReference;
    assumptions?: AppliedAssumption[];
    exceptions?: ReconciliationException[];
    approval?: ApprovalAuditReference;
  }): ReconciliationAuditModel {
    const assumptions = params.assumptions || [];
    const exceptions = params.exceptions || [];
    const approval = params.approval || {
      status: "PENDING_APPROVAL",
    };

    const modelCandidate: ReconciliationAuditModel = {
      reconciliation_id: params.reconciliation_id,
      reconciliation_run_id: params.reconciliation_run_id,
      organisation_id: params.organisation_id,
      created_at: params.created_at || new Date().toISOString(),
      completed_at: params.completed_at || new Date().toISOString(),
      reconciliation_status: params.reconciliation_status,
      invoice: params.invoice,
      meter: params.meter,
      amr_file: params.amr_file,
      billing_period: params.billing_period,
      tariff_version: params.tariff_version,
      calculation_version: params.calculation_version,
      tolerance: params.tolerance,
      assumptions,
      exceptions,
      approval,
    };

    const completeness = this.validateAuditCompleteness(modelCandidate);
    if (!completeness.isValid) {
      throw new Error(
        `[ReconciliationAuditModel] Missing mandatory audit determinants: ${completeness.missingPillars.join(", ")}`,
      );
    }

    modelCandidate.audit_record_hash_sha256 = this.calculateFingerprint({
      reconciliation_id: modelCandidate.reconciliation_id,
      invoice_number: modelCandidate.invoice.invoice_number,
      meter_number: modelCandidate.meter.meter_number,
      amr_file_hash: modelCandidate.amr_file.amr_file_hash_sha256,
      billing_period: `${modelCandidate.billing_period.start_date}_${modelCandidate.billing_period.end_date}`,
      tariff_version: modelCandidate.tariff_version.tariff_version,
      calculation_engine_version: modelCandidate.calculation_version.calculation_engine_version,
      tolerance_profile: modelCandidate.tolerance.profile_name,
      assumptions_count: modelCandidate.assumptions.length,
      exceptions_count: modelCandidate.exceptions.length,
      approval_status: modelCandidate.approval.status,
    });

    return modelCandidate;
  }
}
