/**
 * Deterministic Discrepancy Engine Types & Domain Contracts
 * Enforces zero AI invention of financial values, 12 system discrepancy codes,
 * root-cause propagation chains, and 6-level drill-down traceability.
 */

import Decimal from "decimal.js-light";

export type DiscrepancyCode =
  | "TAR-001" // Tariff mismatch
  | "DEM-001" // Demand discrepancy
  | "MUL-001" // Meter multiplier discrepancy
  | "TOU-001" // TOU allocation discrepancy
  | "EST-001" // Estimated billing
  | "TEL-001" // Missing telemetry
  | "TEL-002" // Telemetry quality failure
  | "REA-001" // Reactive energy discrepancy
  | "NET-001" // Network charge discrepancy
  | "CHG-001" // Unexpected charge
  | "VAT-001" // VAT discrepancy
  | "INV-001"; // Invoice extraction inconsistency

export type DiscrepancySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DiscrepancyStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "CONFIRMED"
  | "DISPUTED"
  | "RESOLVED"
  | "REJECTED";

export interface RootCauseChainStep {
  step: number;
  node_type: "ROOT_CAUSE" | "TOU_RATE" | "LINE_ITEM_CHARGE" | "INVOICE_VARIANCE";
  description: string;
  detail: string;
}

export interface DrillDownPath {
  discrepancy_code: string;
  invoice_id: string;
  determinant_code: string;
  calculation_summary: string;
  telemetry_summary: string;
  tariff_rule_id: string;
  source_file_name: string;
}

export interface DiscrepancyRecord {
  id: string;
  code: DiscrepancyCode;
  category: string;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  description: string;
  evidence: string;
  source_records: {
    invoice_id: string;
    telemetry_batch_id?: string;
    meter_id?: string;
    source_file_id?: string;
    tariff_rule_id?: string;
  };
  calculation: {
    input_value: string;
    formula: string;
    rate_applied: string;
    precision: string;
    output_value: string;
  };
  financial_impact_zar: Decimal;
  recommended_action: string;
  confidence: number; // 0.0 to 1.0
  root_cause_chain: RootCauseChainStep[];
  drill_down_path: DrillDownPath;
  reconciliation_run_id?: string;
  created_at: string;
  updated_at: string;
}
