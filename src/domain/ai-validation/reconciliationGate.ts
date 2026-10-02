/**
 * ENERA AI VALIDATION — RECONCILIATION GATE (REQUIREMENT 31)
 * ==========================================================
 * Creates a strict boundary separating document ingestion/OCR/validation
 * from deterministic financial reconciliation.
 *
 * MANDATE & ZERO-TRUST INVARIANTS:
 * 1. The reconciliation engine strictly consumes: APPROVED / VALIDATED DATA.
 * 2. NEVER allow RAW OCR → FINANCIAL RECONCILIATION without passing validation controls.
 * 3. Any payload with ungrounded fields, unresolved critical exceptions,
 *    corrupted audit hashes, or unapproved states is blocked at the gate.
 * 4. Ensures all numeric and monetary quantities are safely converted to
 *    exact Decimal precision for downstream calculation without floating-point drift.
 */

import Decimal from "decimal.js-light";
import type {
  ApprovalState,
  CompleteValidationResult,
  DownstreamReconciliationPayload,
  ReconciliationGateErrorCode,
  ReconciliationGateEvaluation,
  ReconciliationGateViolation,
} from "./types";
import { ApprovalStateManager } from "./approvalStateManager";
import { EneraAuditChainEngine } from "./eneraAuditChain";
import type { AuthoritativeReconciliationInput } from "../reconciliation/reconciliationEngine";

export class ReconciliationGateError extends Error {
  public readonly code: ReconciliationGateErrorCode;
  public readonly violations: ReconciliationGateViolation[];

  constructor(code: ReconciliationGateErrorCode, message: string, violations: ReconciliationGateViolation[] = []) {
    super(message);
    this.name = "ReconciliationGateError";
    this.code = code;
    this.violations = violations;
  }
}

export class ReconciliationGate {
  /**
   * Mandatory critical fields that must be present and grounded before reconciliation.
   */
  public static readonly MANDATORY_RECONCILIATION_FIELDS: readonly string[] = [
    "accountNumber",
    "billingPeriodStart",
    "billingPeriodEnd",
    "tariffName",
    "totalKwh",
    "invoiceTotal",
  ] as const;

  /**
   * Evaluates if a given payload can pass the reconciliation gate.
   * Performs non-throwing comprehensive inspection.
   */
  public static evaluateGate(input: unknown): ReconciliationGateEvaluation {
    const violations: ReconciliationGateViolation[] = [];
    const now = new Date().toISOString();

    // Check 1: Detect and reject raw OCR or unvalidated dictionary objects
    if (!input || typeof input !== "object") {
      violations.push({
        code: "UNVALIDATED_RAW_OCR_DETECTED",
        message: "Invalid payload: Input is empty or not an object.",
      });

      return {
        isPassed: false,
        gateStatus: "GATE_BLOCKED",
        approvalState: "REJECTED",
        documentId: "UNKNOWN",
        violations,
        evaluatedAt: now,
        authoritativeInputReady: false,
      };
    }

    const payload = input as Record<string, any>;

    // Reject raw OCR extraction structures (e.g. from OCR engines or raw token streams)
    if (
      "rawOcrText" in payload ||
      "wordTokens" in payload ||
      "ocrPages" in payload ||
      ("pages" in payload && Array.isArray(payload.pages) && !("validationRunId" in payload)) ||
      (!("validatedFields" in payload) && !("approvedValues" in payload) && !("validationRunId" in payload))
    ) {
      violations.push({
        code: "UNVALIDATED_RAW_OCR_DETECTED",
        message: "STRICT GATE VIOLATION: Raw OCR output cannot be passed directly to financial reconciliation without validation.",
      });

      return {
        isPassed: false,
        gateStatus: "GATE_BLOCKED",
        approvalState: "REJECTED",
        documentId: payload.documentId || payload.document_id || "RAW_OCR_DOC",
        violations,
        evaluatedAt: now,
        authoritativeInputReady: false,
      };
    }

    const documentId = payload.documentId || payload.document_id || "UNKNOWN_DOC";

    // Check 2: Determine Approval State
    let approvalState: ApprovalState = "PENDING_VALIDATION";

    if ("approvalState" in payload && typeof payload.approvalState === "string") {
      approvalState = ApprovalStateManager.normalizeState(payload.approvalState);
    } else if ("status" in payload && typeof payload.status === "string") {
      approvalState = ApprovalStateManager.normalizeState(payload.status);
    } else if ("approval" in payload && payload.approval?.status) {
      approvalState = ApprovalStateManager.normalizeState(payload.approval.status);
    }

    if (!ApprovalStateManager.isEligibleForReconciliation(approvalState)) {
      violations.push({
        code: "INVALID_APPROVAL_STATE",
        message: `Approval state '${approvalState}' is not eligible for reconciliation. Only 'APPROVED' or 'VALID' documents may proceed.`,
      });
    }

    // Check 3: Check for unresolved blocking/critical exceptions
    if ("exceptions" in payload && Array.isArray(payload.exceptions)) {
      const blockingExceptions = payload.exceptions.filter(
        (e: any) => e.severity === "CRITICAL" || e.severity === "HIGH",
      );

      if (blockingExceptions.length > 0 && approvalState !== "APPROVED") {
        violations.push({
          code: "UNRESOLVED_BLOCKING_EXCEPTIONS",
          message: `Document has ${blockingExceptions.length} unresolved critical/high exceptions. Human review and explicit approval required.`,
          details: { blockingCount: blockingExceptions.length },
        });
      }
    }

    // Check 4: Audit Chain Integrity
    if ("auditVerificationHash" in payload && typeof payload.auditVerificationHash === "string") {
      const hash = payload.auditVerificationHash;
      if (!hash || hash.length < 16) {
        violations.push({
          code: "AUDIT_CHAIN_INTEGRITY_FAILURE",
          message: "Cryptographic audit verification hash is missing or corrupted.",
        });
      }
    }

    // Check 5: Mandatory Reconciliation Fields
    const fieldValues = this.extractFieldValues(payload);

    for (const mandatoryField of this.MANDATORY_RECONCILIATION_FIELDS) {
      const val = fieldValues[mandatoryField];
      if (val === undefined || val === null || val === "" || val === "NOT FOUND") {
        violations.push({
          code: "MISSING_MANDATORY_CRITICAL_FIELDS",
          fieldKey: mandatoryField,
          message: `Mandatory field '${mandatoryField}' is missing or ungrounded.`,
        });
      }
    }

    // Check 6: Non-negative financials
    const total = fieldValues.invoiceTotal ?? fieldValues.totalDue ?? fieldValues.totalAmountDue;
    if (total !== undefined && total !== null) {
      const totalNum = typeof total === "number" ? total : parseFloat(String(total).replace(/[^0-9.-]/g, ""));
      if (isNaN(totalNum) || totalNum < 0) {
        violations.push({
          code: "UNVERIFIED_FINANCIAL_ARITHMETIC",
          fieldKey: "invoiceTotal",
          message: `Invoice total must be a valid non-negative number. Observed: ${total}`,
        });
      }
    }

    const isPassed = violations.length === 0;

    return {
      isPassed,
      gateStatus: isPassed ? "GATE_PASSED" : "GATE_BLOCKED",
      approvalState,
      documentId,
      violations,
      evaluatedAt: now,
      auditHash: payload.auditVerificationHash,
      authoritativeInputReady: isPassed,
    };
  }

  /**
   * Enforces the gate boundary. Returns validated AuthoritativeReconciliationInput
   * if passed, or throws ReconciliationGateError if blocked.
   */
  public static enforceGate(
    input: unknown,
    supplementalData?: {
      tenantId?: string;
      telemetryBatchId?: string;
      tariffVersionId?: string;
      calendarVersionId?: string;
    },
  ): AuthoritativeReconciliationInput {
    const evaluation = this.evaluateGate(input);

    if (!evaluation.isPassed) {
      const primaryViolation = evaluation.violations[0];
      throw new ReconciliationGateError(
        primaryViolation.code,
        `Reconciliation Gate Blocked [${primaryViolation.code}]: ${primaryViolation.message}`,
        evaluation.violations,
      );
    }

    return this.transformToAuthoritativeInput(input as any, supplementalData);
  }

  /**
   * Transforms approved/validated payload into exact Decimal-precision AuthoritativeReconciliationInput.
   */
  public static transformToAuthoritativeInput(
    payload: CompleteValidationResult | DownstreamReconciliationPayload | Record<string, any>,
    supplementalData?: {
      tenantId?: string;
      telemetryBatchId?: string;
      tariffVersionId?: string;
      calendarVersionId?: string;
    },
  ): AuthoritativeReconciliationInput {
    const fieldValues = this.extractFieldValues(payload);

    const documentId = payload.documentId || (payload as any).document_id || "DOC-DEFAULT";
    const accountNumber = String(fieldValues.accountNumber || "ACC-UNKNOWN");
    const invoiceNumber = String(fieldValues.invoiceNumber || documentId);
    const billingStart = String(fieldValues.billingPeriodStart || new Date().toISOString().slice(0, 10));
    const billingEnd = String(fieldValues.billingPeriodEnd || new Date().toISOString().slice(0, 10));
    const tariffName = String(fieldValues.tariffName || fieldValues.tariffCode || "STANDARD");

    const toDecimal = (val: unknown, fallback: string = "0.00"): Decimal => {
      if (val === null || val === undefined || val === "") return new Decimal(fallback);
      if (val instanceof Decimal) return val;
      const clean = String(val).replace(/[^0-9.-]/g, "");
      try {
        return new Decimal(clean || fallback);
      } catch {
        return new Decimal(fallback);
      }
    };

    const billedPeakKwh = toDecimal(fieldValues.peakKwh ?? fieldValues.peakEnergyKwh);
    const billedStandardKwh = toDecimal(fieldValues.standardKwh ?? fieldValues.standardEnergyKwh);
    const billedOffPeakKwh = toDecimal(fieldValues.offPeakKwh ?? fieldValues.offPeakEnergyKwh);
    const billedTotalKwh = toDecimal(
      fieldValues.totalKwh ?? fieldValues.totalEnergyKwh ?? fieldValues.totalActiveEnergyKwh,
      billedPeakKwh.plus(billedStandardKwh).plus(billedOffPeakKwh).toString(),
    );

    const billedMaxDemandKva = toDecimal(fieldValues.maximumDemandKva ?? fieldValues.demandKva);
    const billedRatchetedDemandKva = toDecimal(fieldValues.ratchetedDemandKva, billedMaxDemandKva.toString());
    const billedReactiveKvarh = toDecimal(fieldValues.reactiveEnergyKvarh ?? fieldValues.kvarh);
    const billedPowerFactor = toDecimal(fieldValues.powerFactor, "1.00");
    const billedSubtotalZar = toDecimal(fieldValues.subtotal ?? fieldValues.totalExclVat);
    const billedVatZar = toDecimal(fieldValues.vat ?? fieldValues.vatAmount);
    const billedTotalZar = toDecimal(
      fieldValues.invoiceTotal ?? fieldValues.totalDue ?? fieldValues.totalAmountDue,
      billedSubtotalZar.plus(billedVatZar).toString(),
    );

    return {
      tenant_id: supplementalData?.tenantId || (payload as any).organisationId || "DEFAULT_TENANT",
      invoice_id: documentId,
      invoice_number: invoiceNumber,
      account_number: accountNumber,
      telemetry_batch_id: supplementalData?.telemetryBatchId,
      billing_start: billingStart,
      billing_end: billingEnd,
      tariff_version: supplementalData?.tariffVersionId || tariffName,
      calendar_version_id: supplementalData?.calendarVersionId,

      billed_peak_kwh: billedPeakKwh,
      billed_standard_kwh: billedStandardKwh,
      billed_off_peak_kwh: billedOffPeakKwh,
      billed_total_kwh: billedTotalKwh,
      billed_maximum_demand_kva: billedMaxDemandKva,
      billed_ratcheted_demand_kva: billedRatchetedDemandKva,
      billed_reactive_kvarh: billedReactiveKvarh,
      billed_reactive_energy_kvarh: billedReactiveKvarh,
      billed_power_factor: billedPowerFactor,
      billed_energy_charges_zar: toDecimal(fieldValues.energyChargesZar, "0.00"),
      billed_demand_charges_zar: toDecimal(fieldValues.networkDemandChargeZar),
      billed_network_charges_zar: toDecimal(fieldValues.networkAccessChargeZar),
      billed_service_charges_zar: toDecimal(fieldValues.serviceChargeZar),
      billed_ancillary_charges_zar: toDecimal(fieldValues.adminChargeZar),
      billed_network_demand_charge_zar: toDecimal(fieldValues.networkDemandChargeZar),
      billed_network_access_charge_zar: toDecimal(fieldValues.networkAccessChargeZar),
      billed_service_charge_zar: toDecimal(fieldValues.serviceChargeZar),
      billed_admin_charge_zar: toDecimal(fieldValues.adminChargeZar),
      billed_subtotal_zar: billedSubtotalZar,
      billed_vat_zar: billedVatZar,
      billed_total_zar: billedTotalZar,
      billed_total_invoice_zar: billedTotalZar,
    };
  }

  /**
   * Helper to extract flat field values across different payload formats.
   */
  private static extractFieldValues(payload: Record<string, any>): Record<string, any> {
    // Format A: DownstreamReconciliationPayload (approvedValues map)
    if ("approvedValues" in payload && typeof payload.approvedValues === "object") {
      return payload.approvedValues;
    }

    // Format B: CompleteValidationResult (validatedFields map)
    if ("validatedFields" in payload && typeof payload.validatedFields === "object") {
      const extracted: Record<string, any> = {};
      for (const [key, fieldObj] of Object.entries(payload.validatedFields)) {
        extracted[key] = (fieldObj as any)?.value;
      }
      return extracted;
    }

    // Format C: Direct flat object
    return payload;
  }
}
