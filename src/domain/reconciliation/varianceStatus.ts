/**
 * ENERA RECONCILIATION ENGINE: VARIANCE STATUS (REQUIREMENT 22)
 * =============================================================
 * Transparent, business-defined statuses for all reconciliation variances:
 *
 *   MATCH
 *   WITHIN_TOLERANCE
 *   OUTSIDE_TOLERANCE
 *   INSUFFICIENT_DATA
 *   UNRESOLVED
 *
 * Business Governance Rule:
 *   "Do not use arbitrary visual statuses without defined business meaning."
 *
 * Every status carries an immutable business definition, audit severity,
 * actionable classification, and deterministic workflow instruction.
 */

export type VarianceStatus =
  | "MATCH"
  | "WITHIN_TOLERANCE"
  | "OUTSIDE_TOLERANCE"
  | "INSUFFICIENT_DATA"
  | "UNRESOLVED";

export interface VarianceStatusDefinition {
  status: VarianceStatus;
  label: string;
  business_meaning: string;
  is_discrepancy: boolean;
  requires_action: boolean;
  audit_severity: "INFO" | "LOW" | "HIGH" | "CRITICAL";
  workflow_action:
    | "AUTO_CLEAR"
    | "LOG_FOR_MONITORING"
    | "FLAG_FOR_DISPUTE_OR_ADJUSTMENT"
    | "REQUEST_DATA_SUPPLEMENT"
    | "ESCALATE_TO_HUMAN_REVIEW";
}

export const VARIANCE_STATUS_REGISTRY: Readonly<Record<VarianceStatus, VarianceStatusDefinition>> = {
  MATCH: {
    status: "MATCH",
    label: "Exact Match",
    business_meaning:
      "Billed and expected (or AMR telemetry-derived) quantities or charges match exactly with zero variance.",
    is_discrepancy: false,
    requires_action: false,
    audit_severity: "INFO",
    workflow_action: "AUTO_CLEAR",
  },
  WITHIN_TOLERANCE: {
    status: "WITHIN_TOLERANCE",
    label: "Within Tolerance",
    business_meaning:
      "Variance is non-zero but falls strictly within the centrally configured permissible operational or financial tolerance threshold.",
    is_discrepancy: false,
    requires_action: false,
    audit_severity: "LOW",
    workflow_action: "LOG_FOR_MONITORING",
  },
  OUTSIDE_TOLERANCE: {
    status: "OUTSIDE_TOLERANCE",
    label: "Outside Tolerance",
    business_meaning:
      "Variance breaches the centrally configured operational or financial tolerance threshold and constitutes an actionable discrepancy requiring explanation, adjustment, or dispute.",
    is_discrepancy: true,
    requires_action: true,
    audit_severity: "HIGH",
    workflow_action: "FLAG_FOR_DISPUTE_OR_ADJUSTMENT",
  },
  INSUFFICIENT_DATA: {
    status: "INSUFFICIENT_DATA",
    label: "Insufficient Data",
    business_meaning:
      "Authoritative reconciliation cannot be computed because essential billed data, AMR interval telemetry, meter multipliers, or tariff rate definitions are missing, incomplete, or corrupted.",
    is_discrepancy: false,
    requires_action: true,
    audit_severity: "HIGH",
    workflow_action: "REQUEST_DATA_SUPPLEMENT",
  },
  UNRESOLVED: {
    status: "UNRESOLVED",
    label: "Unresolved",
    business_meaning:
      "A difference or anomaly exists that cannot be automatically resolved or classified by deterministic reconciliation rules (e.g., conflicting evidence, unmapped custom surcharges, disputed meter reads), requiring human investigation.",
    is_discrepancy: true,
    requires_action: true,
    audit_severity: "CRITICAL",
    workflow_action: "ESCALATE_TO_HUMAN_REVIEW",
  },
};

export interface ResolveVarianceStatusOptions {
  hasSufficientData: boolean;
  isExactMatch?: boolean;
  isWithinTolerance?: boolean;
  isUnresolved?: boolean;
  unresolvedReason?: string;
}

/**
 * Deterministically resolve a VarianceStatus based on explicit business conditions.
 */
export function resolveVarianceStatus(options: ResolveVarianceStatusOptions): VarianceStatus {
  if (!options.hasSufficientData) {
    return "INSUFFICIENT_DATA";
  }

  if (options.isUnresolved) {
    return "UNRESOLVED";
  }

  if (options.isExactMatch) {
    return "MATCH";
  }

  if (options.isWithinTolerance) {
    return "WITHIN_TOLERANCE";
  }

  return "OUTSIDE_TOLERANCE";
}

/**
 * Lookup authoritative definition and metadata for any VarianceStatus.
 */
export function getVarianceStatusDefinition(status: VarianceStatus): VarianceStatusDefinition {
  const def = VARIANCE_STATUS_REGISTRY[status];
  if (!def) {
    throw new Error(`Unknown VarianceStatus: '${String(status)}'`);
  }
  return def;
}
