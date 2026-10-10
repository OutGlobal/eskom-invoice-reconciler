/**
 * Versioned Deterministic Tariff Engine Domain Types
 * Enterprise Data-Driven Tariff Model for Eskom & Municipal Utilities
 * Tariffs are DATA, not frontend code.
 */

import Decimal from "decimal.js-light";

export type SeasonType = "high" | "low";
export type TouPeriodType = "peak" | "standard" | "off_peak";
export type DayType = "weekday" | "saturday" | "sunday" | "public_holiday";
export type VoltageCategory = "high" | "medium" | "low" | "transmission";
export type CustomerClass =
  | "urban_transmission"
  | "urban_distribution"
  | "rural"
  | "municipal_bulk"
  | "commercial"
  | "industrial"
  | "residential";
export type TariffStatus = "active" | "superseded" | "draft" | "archived";
export type TariffApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected";
export type TariffFamilyType =
  | "megaflex"
  | "miniflex"
  | "nightsave"
  | "businessrate"
  | "municipal"
  | "custom";

export type TariffSupplyType =
  | "single_phase"
  | "three_phase"
  | "transmission"
  | "dual_feeder"
  | "dedicated"
  | "standard";

export type TariffMeteringType =
  | "amr_interval"
  | "tou_smart"
  | "conventional_demand"
  | "prepaid"
  | "credit"
  | "bulk_metered";

export type CanonicalComponentType =
  | "ACTIVE_ENERGY"
  | "ENERGY_PEAK"
  | "ENERGY_STANDARD"
  | "ENERGY_OFF_PEAK"
  | "FIXED_DAILY_CHARGE"
  | "FIXED_MONTHLY_CHARGE"
  | "SERVICE_CHARGE"
  | "ADMINISTRATION_CHARGE"
  | "DEMAND_CHARGE"
  | "NETWORK_CHARGE"
  | "NETWORK_CAPACITY"
  | "NETWORK_DEMAND"
  | "TRANSMISSION_NETWORK"
  | "CAPACITY_CHARGE"
  | "GENERATION_CAPACITY"
  | "ANCILLARY_SERVICE"
  | "REACTIVE_ENERGY"
  | "POWER_FACTOR_PENALTY"
  | "NMD_RATCHET_PENALTY"
  | "MINIMUM_CHARGE"
  | "DISCOUNT_OR_CREDIT"
  | "TAX_OR_LEVY"
  | "OTHER_ADJUSTMENT"
  | "ELECTRIFICATION_SUBSIDY"
  | "AFFORDABILITY_SUBSIDY";

export interface ContractedDemandBand {
  min_demand_kva?: Decimal;
  max_demand_kva?: Decimal;
}

export interface CanonicalTariffIdentity {
  utility: string;
  tariff_id: string;
  tariff_name: string;
  tariff_code: string;
  tariff_category: string;
  tariff_description?: string;
  municipality_or_territory: string;
  customer_class: CustomerClass;
  voltage_level: VoltageCategory;
  supply_type: TariffSupplyType;
  metering_type: TariffMeteringType;
  currency: "ZAR";
  status: TariffStatus;
}

export interface CanonicalTariffApplicability {
  applicable_customer_classes: CustomerClass[];
  region_or_municipality: string[];
  voltage_levels: VoltageCategory[];
  supply_configuration?: string[];
  contracted_demand_bands?: ContractedDemandBand;
  meter_types?: TariffMeteringType[];
  applicable_dates: {
    effective_from: string;
    effective_to?: string;
  };
  eligibility_conditions?: string[];
}

export interface CanonicalTariffVersioning {
  tariff_version_id: string;
  version_number: string;
  effective_from_date: string; // YYYY-MM-DD
  effective_to_date?: string; // YYYY-MM-DD
  source_document_id?: string;
  source_document_version?: string;
  import_timestamp: string;
  approval_status: TariffApprovalStatus;
  approved_by?: string;
  approval_timestamp?: string;
  calculation_rule_version: string;
  is_locked: boolean;
  lock_reason?: string;
}

export interface TariffScheduleHeader {
  tariff_code: string;
  tariff_name: string;
  utility: string; // e.g. 'Eskom', 'City of Johannesburg', 'City of Tshwane'
  tariff_family: TariffFamilyType;
  version: string; // e.g. '2023.1', '2024.1', '2025.1', '2026.1'
  effective_date: string; // YYYY-MM-DD
  expiry_date?: string; // YYYY-MM-DD
  season: SeasonType;
  voltage_level: VoltageCategory;
  customer_class: CustomerClass;
  status: TariffStatus;
  approval_status?: TariffApprovalStatus;
  approved_by?: string;
  approved_at?: string;
  approval_notes?: string;
  extraction_confidence?: number;
  extracted_from_document?: string;
  vat_treatment: "standard_15" | "zero_rated";
  source_document: string; // e.g. 'NERSA Tariff Schedule Gazette 2025/26'
  source_hash: string; // SHA-256 fingerprint of source gazette
  is_locked?: boolean; // When true, rates cannot be mutated in place
  lock_reason?: string; // Audit notation for why the version is locked

  // Canonical extensions
  tariff_id?: string;
  tariff_category?: string;
  tariff_description?: string;
  municipality_or_territory?: string;
  supply_type?: TariffSupplyType;
  metering_type?: TariffMeteringType;
  currency?: "ZAR";
  applicability?: CanonicalTariffApplicability;
  versioning_info?: CanonicalTariffVersioning;
  calculation_rule_version?: string;
  source_document_id?: string;
  source_document_version?: string;
  import_timestamp?: string;
}

export interface TouClockWindow {
  hour_start: number; // 0..23
  hour_end: number; // 0..23
  period: TouPeriodType;
}

export interface DayTypeTouConfig {
  day_type: DayType;
  windows: TouClockWindow[];
}

export interface SeasonTouSchedule {
  season: SeasonType;
  schedules: DayTypeTouConfig[];
}

export interface TariffComponentRule {
  component_code: string;
  component_name: string;
  component_type:
    | CanonicalComponentType
    | "ACTIVE_ENERGY"
    | "NETWORK_CAPACITY"
    | "NETWORK_DEMAND"
    | "TRANSMISSION_NETWORK"
    | "GENERATION_CAPACITY"
    | "ANCILLARY_SERVICE"
    | "REACTIVE_ENERGY"
    | "SERVICE_CHARGE"
    | "ADMINISTRATION_CHARGE"
    | "ELECTRIFICATION_SUBSIDY"
    | "AFFORDABILITY_SUBSIDY"
    | "NMD_RATCHET_PENALTY"
    | string;
  unit_of_measure:
    | "c/kWh"
    | "R/kVA/month"
    | "R/kW/month"
    | "R/kVARh"
    | "R/day"
    | "R/month"
    | "%"
    | "R/kVA"
    | "R/kW"
    | "fixed_zar"
    | string;
  season?: SeasonType | "all";
  tou_period?: TouPeriodType | "all";
  voltage_level?: VoltageCategory | "all";
  rate_value: Decimal; // Gazetted rate value
  rule_id: string;
  formula_template: string; // e.g. "quantity * rate / 100"
  provenance?: any; // TariffRateProvenance (Requirement 7)
}

export interface TariffVersionDefinition {
  header: TariffScheduleHeader;
  tou_schedule: SeasonTouSchedule[];
  components: TariffComponentRule[];
  public_holidays: Array<{
    date: string;
    name: string;
    tou_treatment: "sunday_schedule" | "off_peak";
  }>;
  reactive_penalty_rate: Decimal; // R/kVARh for PF < 0.95
  pf_threshold: Decimal; // 0.95
  nmd_ratchet_multiplier: Decimal; // 2.0x for excess demand
  minimum_nmd_kva: Decimal; // 50 kVA
}

export interface CalculationAuditStep {
  step_number: number;
  tariff_code: string;
  tariff_version: string;
  rule_id: string;
  component_code: string;
  component_name: string;
  season: SeasonType | "all";
  tou_period?: TouPeriodType | "all";
  rate_applied: string; // e.g. "666.92 c/kWh"
  input_value: string; // e.g. "250,000.00 kWh"
  unit: string;
  rule_applied: string;
  formula_used: string;
  rounding_rule: string; // e.g. "Decimal.ROUND_HALF_UP (2 decimals)"
  calculated_amount_zar: Decimal;
  formatted_amount_zar: string; // e.g. "R 16,673.00"
}

export interface DeterministicCalculationInput {
  billing_start: string; // YYYY-MM-DD
  billing_end: string; // YYYY-MM-DD
  meter_id?: string;
  account_number?: string;
  notified_maximum_demand_kva: Decimal;
  utilised_capacity_kva: Decimal;
  maximum_demand_kva: Decimal;
  active_energy_kwh: Decimal;
  peak_kwh: Decimal;
  standard_kwh: Decimal;
  off_peak_kwh: Decimal;
  reactive_energy_kvarh: Decimal;
  power_factor: Decimal;
}

export interface TariffCalculationItem {
  component_code: string;
  component_name: string;
  rule_id: string;
  unit: string;
  rate: Decimal;
  quantity: Decimal;
  amount_zar: Decimal;
  audit_step: CalculationAuditStep;
}

export interface TariffCalculationResult {
  tariff_code: string;
  tariff_version: string;
  billing_start: string;
  billing_end: string;
  billing_days: number;
  season: SeasonType;
  items: TariffCalculationItem[];
  subtotal_ex_vat: Decimal;
  vat_amount: Decimal;
  total_inc_vat: Decimal;
  audit_trace: CalculationAuditStep[];
}

/**
 * Rate Lineage Explanation Function Response Contract
 * Answers: "Why was this tariff rate applied?"
 */
export interface RateLineageExplanation {
  tariff_name: string;
  tariff_code: string;
  version_id: string;
  version_number: string;
  effective_date: string;
  expiry_date?: string;
  customer_category: string;
  voltage_level: string;
  season: string;
  tou_period: string;
  component_code: string;
  component_name: string;
  rate_value: string;
  unit_of_measure: string;
  formula_used: string;
  rule_id: string;
  gazette_reference: string;
  explanation_text: string;
}

/**
 * Thrown when an attempt is made to mutate or overwrite an existing locked/published tariff version.
 * Enforces the core invariant: Never overwrite a historical tariff in a way that changes historical reconciliation results.
 */
export class TariffImmutabilityViolationError extends Error {
  constructor(
    public readonly tariffCode: string,
    public readonly version: string,
    public readonly reason: string = "Historical tariff version is immutable and locked against modifications to protect historical reconciliation reproducibility.",
  ) {
    super(`TariffImmutabilityViolationError: [${tariffCode} v${version}] - ${reason}`);
    this.name = "TariffImmutabilityViolationError";
  }
}

/**
 * Thrown when attempting to perform authoritative reconciliation with an unapproved or draft tariff.
 * Enforces the core invariant: Never treat an AI-extracted rate as approved merely because extraction confidence is high.
 */
export class UnapprovedTariffReconciliationError extends Error {
  constructor(
    public readonly tariffCode: string,
    public readonly version: string,
    public readonly approvalStatus: string = "pending_approval",
  ) {
    super(
      `UnapprovedTariffReconciliationError: Tariff [${tariffCode} v${version}] is in status '${approvalStatus}'. ` +
        `Authoritative reconciliation requires an officially approved, gazetted tariff version. ` +
        `AI-extracted or draft rates cannot be applied without human review and approval.`,
    );
    this.name = "UnapprovedTariffReconciliationError";
  }
}

/**
 * Thrown when two or more distinct approved tariff versions overlap on an effective date range for the same tariff code.
 * Enforces the core invariant: Prevent conflicting or overlapping approved tariff versions from being selected silently.
 */
export class ConflictingTariffVersionError extends Error {
  constructor(
    public readonly tariffCode: string,
    public readonly date: string,
    public readonly conflictingVersions: string[],
    public readonly reason: string = "Multiple conflicting or overlapping approved tariff versions were found covering this date. Ambiguous selection is prohibited.",
  ) {
    super(
      `ConflictingTariffVersionError: [${tariffCode}] on date ${date} matches multiple approved versions: [${conflictingVersions.join(
        ", ",
      )}]. ${reason}`,
    );
    this.name = "ConflictingTariffVersionError";
  }
}

/**
 * Thrown when a billing period spans across a tariff adjustment boundary and cannot be computed without sub-period readings.
 */
export class CrossBoundaryBillingPeriodReviewRequiredError extends Error {
  constructor(
    public readonly tariffCode: string,
    public readonly billingStart: string,
    public readonly billingEnd: string,
    public readonly splitReason: string,
  ) {
    super(
      `CrossBoundaryBillingPeriodReviewRequiredError: [${tariffCode}] billing period ${billingStart} to ${billingEnd} crosses a tariff revision boundary. ${splitReason}`,
    );
    this.name = "CrossBoundaryBillingPeriodReviewRequiredError";
  }
}

/**
 * Thrown when an account, site, or connection does not satisfy the eligibility conditions for a tariff.
 */
export class TariffNotApplicableError extends Error {
  constructor(
    public readonly tariffCode: string,
    public readonly missingConditions: string[],
  ) {
    super(
      `TariffNotApplicableError: [${tariffCode}] is not applicable. Unmet eligibility conditions: ${missingConditions.join(
        "; ",
      )}`,
    );
    this.name = "TariffNotApplicableError";
  }
}

/**
 * Cross-boundary billing period evaluation result
 */
export interface CrossBoundarySplitEvaluation {
  crosses_tariff_boundary: boolean;
  requires_period_split: boolean;
  review_required: boolean;
  review_reason?: string;
  versions_involved: string[];
  sub_periods: Array<{
    start_date: string;
    end_date: string;
    days: number;
    tariff_version: string;
  }>;
}

/**
 * Unified Canonical Tariff Model representing identity, applicability, versioning, and rules
 */
export interface CanonicalTariffModel extends TariffVersionDefinition {
  identity?: CanonicalTariffIdentity;
  applicability?: CanonicalTariffApplicability;
  versioning?: CanonicalTariffVersioning;
}

/**
 * Options for resolving the authoritative tariff version for an invoice
 */
export interface TariffResolutionOptions {
  tariffCode?: string;
  billingStart: string | Date;
  billingEnd?: string | Date;
  voltageLevel?: VoltageCategory;
  customerClass?: CustomerClass;
  explicitDefinition?: TariffVersionDefinition;
}

/**
 * Formal determination output inspecting existing tariff capabilities
 */
export interface TariffFunctionalityClassification {
  is_hardcoded: boolean;
  is_database_driven: boolean;
  is_manually_entered: boolean;
  is_uploaded: boolean;
  is_versioned: boolean;
  primary_source: "CONTROLLED_PERSISTENT_STORE" | "DATABASE" | "FIXTURES" | "UPLOAD";
  historical_immutability_enforced: boolean;
  reproducibility_guaranteed: boolean;
  supported_validity_periods: string[];
  findings_summary: string[];
}

