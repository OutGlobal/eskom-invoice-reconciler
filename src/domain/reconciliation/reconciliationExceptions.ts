/**
 * ENERA RECONCILIATION ENGINE: RECONCILIATION EXCEPTIONS (REQUIREMENT 24)
 * =======================================================================
 * Strongly typed exception model for utility billing and AMR interval reconciliation.
 *
 * Core Governance Rules:
 *   1. Standard exception codes:
 *      - MISSING_AMR_DATA
 *      - INCOMPLETE_AMR_DATA
 *      - DUPLICATE_AMR_INTERVAL
 *      - INVALID_TIMESTAMP
 *      - UNIT_MISMATCH
 *      - METER_MISMATCH
 *      - ACCOUNT_MISMATCH
 *      - BILLING_PERIOD_MISMATCH
 *      - ENERGY_VARIANCE
 *      - DEMAND_VARIANCE
 *      - REACTIVE_VARIANCE
 *      - CHARGE_VARIANCE
 *      - TARIFF_UNAVAILABLE
 *      - INSUFFICIENT_DATA
 *
 *   2. Every exception MUST contain:
 *      - code
 *      - severity
 *      - description
 *      - affected field
 *      - evidence
 *      - source
 *      - status
 */

import Decimal from "decimal.js-light";

export type ReconciliationExceptionCode =
  | "MISSING_AMR_DATA"
  | "INCOMPLETE_AMR_DATA"
  | "DUPLICATE_AMR_INTERVAL"
  | "INVALID_TIMESTAMP"
  | "UNIT_MISMATCH"
  | "METER_MISMATCH"
  | "ACCOUNT_MISMATCH"
  | "BILLING_PERIOD_MISMATCH"
  | "ENERGY_VARIANCE"
  | "DEMAND_VARIANCE"
  | "REACTIVE_VARIANCE"
  | "CHARGE_VARIANCE"
  | "TARIFF_UNAVAILABLE"
  | "INSUFFICIENT_DATA";

export type ExceptionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ExceptionStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "INVESTIGATING"
  | "RESOLVED"
  | "SUPPRESSED"
  | "ESCALATED";

export type ExceptionSource =
  | "AMR_DATA_INGESTION"
  | "DATA_COVERAGE_ENGINE"
  | "INTERVAL_VALIDATION"
  | "TIMEZONE_NORMALIZATION"
  | "METER_IDENTIFICATION"
  | "ACCOUNT_IDENTIFICATION"
  | "BILLING_PERIOD_IDENTIFICATION"
  | "TARIFF_ENGINE"
  | "ENERGY_RECONCILIATION"
  | "DEMAND_RECONCILIATION"
  | "REACTIVE_RECONCILIATION"
  | "CHARGE_RECONCILIATION"
  | "VARIANCE_ENGINE"
  | "SYSTEM";

export interface ExceptionEvidence {
  [key: string]: any;
}

export interface ReconciliationException {
  /** Unique exception identifier for tracking, audit trail, and deduplication */
  id: string;
  /** Authoritative exception code (Requirement 24) */
  code: ReconciliationExceptionCode;
  /** Severity level classification */
  severity: ExceptionSeverity;
  /** Descriptive, human-readable explanation of the business exception */
  description: string;
  /** Name of the specific field or component affected (Requirement 24) */
  affected_field: string;
  /** Structured, immutable evidence proving the exception condition */
  evidence: ExceptionEvidence;
  /** Subsystem or component where the exception originated (Requirement 24) */
  source: ExceptionSource;
  /** Current lifecycle status of the exception (Requirement 24) */
  status: ExceptionStatus;
  /** ISO 8601 UTC timestamp when the exception was recorded */
  recorded_at: string;
  /** Optional resolution timestamp if resolved */
  resolved_at?: string;
  /** Optional human resolution notes */
  resolution_notes?: string;
  /** Optional suggested remediation action */
  remediation_hint?: string;
}

export interface ExceptionCodeMetadata {
  code: ReconciliationExceptionCode;
  default_severity: ExceptionSeverity;
  default_source: ExceptionSource;
  default_affected_field: string;
  label: string;
  description_template: string;
  remediation_guidance: string;
}

/**
 * Authoritative registry of all reconciliation exception codes and default metadata.
 */
export const EXCEPTION_CODE_METADATA_REGISTRY: Readonly<
  Record<ReconciliationExceptionCode, ExceptionCodeMetadata>
> = {
  MISSING_AMR_DATA: {
    code: "MISSING_AMR_DATA",
    default_severity: "CRITICAL",
    default_source: "AMR_DATA_INGESTION",
    default_affected_field: "interval_data",
    label: "Missing AMR Telemetry",
    description_template:
      "No AMR interval telemetry data was found or uploaded for the specified meter and billing period.",
    remediation_guidance:
      "Upload or ingest 30-minute AMR interval telemetry for the meter covering the invoice billing cycle.",
  },
  INCOMPLETE_AMR_DATA: {
    code: "INCOMPLETE_AMR_DATA",
    default_severity: "HIGH",
    default_source: "DATA_COVERAGE_ENGINE",
    default_affected_field: "data_coverage",
    label: "Incomplete AMR Interval Coverage",
    description_template:
      "AMR telemetry does not cover 100% of the invoice billing period. Gaps or missing intervals detected.",
    remediation_guidance:
      "Request supplemental telemetry from utility or AMR provider to backfill missing interval periods.",
  },
  DUPLICATE_AMR_INTERVAL: {
    code: "DUPLICATE_AMR_INTERVAL",
    default_severity: "MEDIUM",
    default_source: "INTERVAL_VALIDATION",
    default_affected_field: "interval_timestamps",
    label: "Duplicate AMR Telemetry Intervals",
    description_template:
      "Duplicate interval timestamps were detected in the AMR telemetry stream.",
    remediation_guidance:
      "Deduplicate intervals using latest or validated reading per unique timestamp.",
  },
  INVALID_TIMESTAMP: {
    code: "INVALID_TIMESTAMP",
    default_severity: "HIGH",
    default_source: "TIMEZONE_NORMALIZATION",
    default_affected_field: "timestamp",
    label: "Invalid or Non-Normalizable Timestamp",
    description_template:
      "Interval record contains an unparseable, out-of-sequence, or ambiguous timezone timestamp.",
    remediation_guidance:
      "Normalize timestamps to Africa/Johannesburg (SAST, UTC+02:00) with ISO 8601 compliance.",
  },
  UNIT_MISMATCH: {
    code: "UNIT_MISMATCH",
    default_severity: "CRITICAL",
    default_source: "ENERGY_RECONCILIATION",
    default_affected_field: "unit_of_measure",
    label: "Unit of Measure Mismatch",
    description_template:
      "Telemetry unit of measure contradicts the billed tariff determinant unit (e.g. kW vs kVA, Wh vs kWh).",
    remediation_guidance:
      "Verify meter scaling factor and unit multiplier. Convert raw meter units to invoice billed units.",
  },
  METER_MISMATCH: {
    code: "METER_MISMATCH",
    default_severity: "CRITICAL",
    default_source: "METER_IDENTIFICATION",
    default_affected_field: "meter_number",
    label: "Meter Serial Number Mismatch",
    description_template:
      "The meter number stated on the invoice does not match the serial number registered in the AMR telemetry.",
    remediation_guidance:
      "Verify meter asset register and ensure invoice is reconciled against the correct physical meter telemetry.",
  },
  ACCOUNT_MISMATCH: {
    code: "ACCOUNT_MISMATCH",
    default_severity: "CRITICAL",
    default_source: "ACCOUNT_IDENTIFICATION",
    default_affected_field: "account_number",
    label: "Account Number Mismatch",
    description_template:
      "The invoice account number does not match the registered site account for this telemetry stream.",
    remediation_guidance:
      "Confirm site allocation and ensure the invoice corresponds to the designated account.",
  },
  BILLING_PERIOD_MISMATCH: {
    code: "BILLING_PERIOD_MISMATCH",
    default_severity: "HIGH",
    default_source: "BILLING_PERIOD_IDENTIFICATION",
    default_affected_field: "billing_period",
    label: "Billing Period Date Range Mismatch",
    description_template:
      "The invoice billing period start/end dates do not align with the AMR telemetry interval capture window.",
    remediation_guidance:
      "Align AMR interval filtering to the exact start and end timestamps stated on the utility invoice.",
  },
  ENERGY_VARIANCE: {
    code: "ENERGY_VARIANCE",
    default_severity: "HIGH",
    default_source: "ENERGY_RECONCILIATION",
    default_affected_field: "active_energy_kwh",
    label: "Active Energy Variance Exceeds Tolerance",
    description_template:
      "Variance between invoice billed kWh and AMR-derived kWh breaches the configured tolerance threshold.",
    remediation_guidance:
      "Review TOU allocation, check for meter rollover or multiplier errors, and prepare audit dispute.",
  },
  DEMAND_VARIANCE: {
    code: "DEMAND_VARIANCE",
    default_severity: "HIGH",
    default_source: "DEMAND_RECONCILIATION",
    default_affected_field: "billed_demand",
    label: "Billed Demand Variance Exceeds Tolerance",
    description_template:
      "Variance between invoice billed demand and AMR-derived utilised billing demand breaches configured tolerance.",
    remediation_guidance:
      "Check tariff demand methodology rules (e.g. kVA vs kW, TOU window scope, NMD ratchet application).",
  },
  REACTIVE_VARIANCE: {
    code: "REACTIVE_VARIANCE",
    default_severity: "MEDIUM",
    default_source: "REACTIVE_RECONCILIATION",
    default_affected_field: "reactive_energy_kvarh",
    label: "Reactive Energy or Power Factor Discrepancy",
    description_template:
      "Reactive energy (kVArh) or power factor differs significantly between invoice and AMR telemetry.",
    remediation_guidance:
      "Verify power factor vector calculation, check capacitor bank operations, and audit reactive charges.",
  },
  CHARGE_VARIANCE: {
    code: "CHARGE_VARIANCE",
    default_severity: "HIGH",
    default_source: "CHARGE_RECONCILIATION",
    default_affected_field: "billed_charge_zar",
    label: "Line Charge Calculation Variance",
    description_template:
      "Billed financial charge amount differs from expected charge calculated from gazetted tariff rates.",
    remediation_guidance:
      "Cross-check billed rate against authoritative NERSA gazetted rate for the applicable tariff and season.",
  },
  TARIFF_UNAVAILABLE: {
    code: "TARIFF_UNAVAILABLE",
    default_severity: "CRITICAL",
    default_source: "TARIFF_ENGINE",
    default_affected_field: "tariff_version",
    label: "Applicable Tariff Schedule Unavailable",
    description_template:
      "The authoritative tariff rate schedule cannot be resolved or is missing from the Tariff Engine.",
    remediation_guidance:
      "Upload or ingest gazetted NERSA tariff version definition covering the billing period date range.",
  },
  INSUFFICIENT_DATA: {
    code: "INSUFFICIENT_DATA",
    default_severity: "HIGH",
    default_source: "VARIANCE_ENGINE",
    default_affected_field: "source_data",
    label: "Insufficient Data for Reconciliation",
    description_template:
      "Required invoice quantities, rates, or AMR telemetry streams are missing or unmetered.",
    remediation_guidance:
      "Provide complete invoice line items or AMR interval data to enable automated reconciliation.",
  },
};

export interface CreateExceptionInput {
  code: ReconciliationExceptionCode;
  severity?: ExceptionSeverity;
  description?: string;
  affected_field?: string;
  evidence: ExceptionEvidence;
  source?: ExceptionSource;
  status?: ExceptionStatus;
  remediation_hint?: string;
}

export class ReconciliationExceptionFactory {
  private static counter: number = 0;

  /**
   * Deterministically generate a unique ID for an exception.
   */
  public static generateId(code: ReconciliationExceptionCode, affectedField: string): string {
    this.counter += 1;
    const cleanField = affectedField.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
    const timestampPart = Date.now().toString(36);
    return `EXC-${code}-${cleanField}-${timestampPart}-${this.counter}`;
  }

  /**
   * Create a fully populated ReconciliationException with all 7 mandatory fields.
   */
  public static create(input: CreateExceptionInput): ReconciliationException {
    const meta = EXCEPTION_CODE_METADATA_REGISTRY[input.code];
    const affectedField = input.affected_field || meta.default_affected_field;
    const severity = input.severity || meta.default_severity;
    const source = input.source || meta.default_source;
    const description = input.description || meta.description_template;
    const status = input.status || "OPEN";
    const remediation = input.remediation_hint || meta.remediation_guidance;

    return {
      id: this.generateId(input.code, affectedField),
      code: input.code,
      severity,
      description,
      affected_field: affectedField,
      evidence: input.evidence,
      source,
      status,
      recorded_at: new Date().toISOString(),
      remediation_hint: remediation,
    };
  }

  /**
   * Factory for MISSING_AMR_DATA
   */
  public static missingAmrData(evidence: {
    meter_number?: string;
    billing_period_start?: string;
    billing_period_end?: string;
    account_number?: string;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "MISSING_AMR_DATA",
      severity: "CRITICAL",
      affected_field: "interval_data",
      description: `No AMR interval telemetry data was found for meter '${evidence.meter_number || "unknown"}' across billing period ${evidence.billing_period_start || "?"} to ${evidence.billing_period_end || "?"}.`,
      evidence,
      source: "AMR_DATA_INGESTION",
    });
  }

  /**
   * Factory for INCOMPLETE_AMR_DATA
   */
  public static incompleteAmrData(evidence: {
    meter_number?: string;
    expected_intervals: number;
    actual_intervals: number;
    missing_intervals: number;
    coverage_percentage: Decimal | number | string;
    gaps?: any[];
    [key: string]: any;
  }): ReconciliationException {
    const pct = typeof evidence.coverage_percentage === "string"
      ? evidence.coverage_percentage
      : evidence.coverage_percentage.toString();
    return this.create({
      code: "INCOMPLETE_AMR_DATA",
      severity: "HIGH",
      affected_field: "data_coverage",
      description: `AMR telemetry is incomplete: covers only ${pct}% of the billing cycle (${evidence.actual_intervals} of ${evidence.expected_intervals} expected intervals; ${evidence.missing_intervals} missing).`,
      evidence,
      source: "DATA_COVERAGE_ENGINE",
    });
  }

  /**
   * Factory for METER_MISMATCH
   */
  public static meterMismatch(evidence: {
    invoice_meter_number: string;
    amr_meter_number: string;
    invoice_id?: string;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "METER_MISMATCH",
      severity: "CRITICAL",
      affected_field: "meter_number",
      description: `Meter mismatch: Invoice specifies meter '${evidence.invoice_meter_number}' but AMR telemetry is from meter '${evidence.amr_meter_number}'.`,
      evidence,
      source: "METER_IDENTIFICATION",
    });
  }

  /**
   * Factory for ACCOUNT_MISMATCH
   */
  public static accountMismatch(evidence: {
    invoice_account_number: string;
    amr_account_number: string;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "ACCOUNT_MISMATCH",
      severity: "CRITICAL",
      affected_field: "account_number",
      description: `Account mismatch: Invoice account '${evidence.invoice_account_number}' does not match telemetry registered account '${evidence.amr_account_number}'.`,
      evidence,
      source: "ACCOUNT_IDENTIFICATION",
    });
  }

  /**
   * Factory for BILLING_PERIOD_MISMATCH
   */
  public static billingPeriodMismatch(evidence: {
    invoice_start: string;
    invoice_end: string;
    telemetry_start: string;
    telemetry_end: string;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "BILLING_PERIOD_MISMATCH",
      severity: "HIGH",
      affected_field: "billing_period",
      description: `Billing period mismatch: Invoice period (${evidence.invoice_start} to ${evidence.invoice_end}) does not align with telemetry span (${evidence.telemetry_start} to ${evidence.telemetry_end}).`,
      evidence,
      source: "BILLING_PERIOD_IDENTIFICATION",
    });
  }

  /**
   * Factory for ENERGY_VARIANCE
   */
  public static energyVariance(evidence: {
    component_code: string;
    billed_kwh: Decimal | number | string;
    amr_kwh: Decimal | number | string;
    absolute_variance: Decimal | number | string;
    percentage_variance: Decimal | number | string | null;
    tolerance_threshold?: string;
    [key: string]: any;
  }): ReconciliationException {
    const compCode = (evidence.component_code || "active_energy").toString();
    return this.create({
      code: "ENERGY_VARIANCE",
      severity: "HIGH",
      affected_field: compCode.toLowerCase(),
      description: `Energy variance on ${compCode}: Billed ${evidence.billed_kwh ?? 0} kWh vs AMR ${evidence.amr_kwh ?? evidence.expected_kwh ?? 0} kWh (diff: ${evidence.absolute_variance ?? evidence.variance_kwh ?? 0} kWh) exceeds tolerance.`,
      evidence,
      source: "ENERGY_RECONCILIATION",
    });
  }

  /**
   * Factory for DEMAND_VARIANCE
   */
  public static demandVariance(evidence: {
    billed_demand: Decimal | number | string;
    amr_demand: Decimal | number | string;
    unit: string;
    absolute_variance: Decimal | number | string;
    percentage_variance: Decimal | number | string | null;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "DEMAND_VARIANCE",
      severity: "HIGH",
      affected_field: "billed_demand",
      description: `Demand variance: Billed ${evidence.billed_demand} ${evidence.unit} vs AMR ${evidence.amr_demand} ${evidence.unit} (diff: ${evidence.absolute_variance} ${evidence.unit}) exceeds tolerance.`,
      evidence,
      source: "DEMAND_RECONCILIATION",
    });
  }

  /**
   * Factory for REACTIVE_VARIANCE
   */
  public static reactiveVariance(evidence: {
    component: string;
    billed_value: Decimal | number | string;
    amr_value: Decimal | number | string;
    variance: Decimal | number | string;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "REACTIVE_VARIANCE",
      severity: "MEDIUM",
      affected_field: "reactive_energy",
      description: `Reactive discrepancy on ${evidence.component}: Billed ${evidence.billed_value} vs AMR ${evidence.amr_value} (variance: ${evidence.variance}).`,
      evidence,
      source: "REACTIVE_RECONCILIATION",
    });
  }

  /**
   * Factory for CHARGE_VARIANCE
   */
  public static chargeVariance(evidence: {
    component_code: string;
    billed_zar: Decimal | number | string;
    expected_zar: Decimal | number | string;
    variance_zar: Decimal | number | string;
    tariff_code?: string;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "CHARGE_VARIANCE",
      severity: "HIGH",
      affected_field: evidence.component_code.toLowerCase(),
      description: `Charge variance on ${evidence.component_code}: Billed R ${evidence.billed_zar} vs Expected R ${evidence.expected_zar} (variance: R ${evidence.variance_zar}).`,
      evidence,
      source: "CHARGE_RECONCILIATION",
    });
  }

  /**
   * Factory for TARIFF_UNAVAILABLE
   */
  public static tariffUnavailable(evidence: {
    tariff_code?: string;
    billing_period_start?: string;
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "TARIFF_UNAVAILABLE",
      severity: "CRITICAL",
      affected_field: "tariff_version",
      description: `Tariff schedule '${evidence.tariff_code || "unknown"}' is unavailable for billing date '${evidence.billing_period_start || "unknown"}'.`,
      evidence,
      source: "TARIFF_ENGINE",
    });
  }

  /**
   * Factory for INSUFFICIENT_DATA
   */
  public static insufficientData(evidence: {
    reason: string;
    missing_fields: string[];
    [key: string]: any;
  }): ReconciliationException {
    return this.create({
      code: "INSUFFICIENT_DATA",
      severity: "HIGH",
      affected_field: evidence.missing_fields.join(", ") || "general",
      description: `Insufficient data: ${evidence.reason} (missing: ${evidence.missing_fields.join(", ")}).`,
      evidence,
      source: "VARIANCE_ENGINE",
    });
  }
}
