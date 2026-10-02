/**
 * Navigable 12-Node Evidence Explorer Domain Types
 * Enforces stable object IDs, complete 12-node lineage traversal,
 * mandatory calculation/extraction/telemetry/tariff attributes, and tenant authorization security.
 */

import Decimal from "decimal.js-light";

export type EvidenceNodeType =
  | "SOURCE_FILE"
  | "INVOICE"
  | "INVOICE_LINE"
  | "BILLING_DETERMINANT"
  | "TELEMETRY_INTERVAL"
  | "METER_CONFIGURATION"
  | "MULTIPLIER"
  | "TARIFF_RULE"
  | "CALENDAR_RULE"
  | "CALCULATION"
  | "VARIANCE"
  | "DISCREPANCY";

export interface CalculationDisplayEvidence {
  input: string;
  formula: string;
  rate: string;
  units: string;
  precision: string;
  rounding: string;
  output: string;
  engine_version: string;
}

export interface InvoiceExtractionDisplayEvidence {
  extracted_value: string;
  normalized_value: string;
  source_document: string;
  page: number;
  location?: string;
  confidence: number;
}

export interface TelemetryDisplayEvidence {
  meter: string;
  POD: string;
  timestamp: string;
  channel: string;
  raw_value: string;
  multiplier: string;
  engineering_value: string;
  quality_state: string;
  source_file: string;
}

export interface TariffDisplayEvidence {
  tariff: string;
  tariff_version: string;
  effective_date: string;
  rule: string;
  rate: string;
}

export interface AuthorizationContext {
  user_id: string;
  tenant_id: string;
  role: string;
  permitted_site_ids: string[];
}

export interface EvidenceChainNode {
  node_id: string;
  node_type: EvidenceNodeType;
  stable_object_id: string;
  title: string;
  sequence_index: number; // 1 to 12
  node_data:
    | CalculationDisplayEvidence
    | InvoiceExtractionDisplayEvidence
    | TelemetryDisplayEvidence
    | TariffDisplayEvidence
    | Record<string, any>;
}

export interface CompleteEvidenceChain {
  chain_id: string;
  variance_id: string;
  reconciliation_run_id: string;
  invoice_id: string;
  tenant_id: string;
  site_id: string;
  nodes: EvidenceChainNode[];
  created_at: string;
}
