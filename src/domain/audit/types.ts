/**
 * Audit & Cryptographic Lineage Domain Types
 * Eskom Management Platform
 */

/**
 * 12 Major Lifecycle Audit Event Types
 */
export type AuditEventType =
  | 'FILE_UPLOADED'
  | 'FILE_PARSED'
  | 'FILE_VALIDATED'
  | 'INVOICE_CREATED'
  | 'TARIFF_SELECTED'
  | 'RECONCILIATION_STARTED'
  | 'RECONCILIATION_COMPLETED'
  | 'DISCREPANCY_CREATED'
  | 'REPORT_GENERATED'
  | 'EXPORT_GENERATED'
  | 'USER_REVIEWED'
  | 'USER_APPROVED';

/**
 * Immutably Append-Only Cryptographic Hash Chain Audit Event Record
 */
export interface AuditEventRecord {
  event_id: string;
  sequence_number: number;
  event_type: AuditEventType;
  actor_id?: string;
  actor_email: string;
  timestamp: string; // ISO 8601 UTC
  object_type: string; // e.g. 'source_file', 'invoice', 'reconciliation_run', 'discrepancy'
  object_id: string;
  previous_event_hash: string; // H_{n-1}
  current_event_hash: string;  // H_n
  payload_hash: string;        // SHA-256(payload)
  state_before_hash?: string;  // Optional pre-event state hash
  state_after_hash?: string;   // Optional post-event state hash
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Reproducible Reconciliation Run Snapshot Structure
 */
export interface ReproducibleRunSnapshot {
  run_id: string;
  user_id?: string;
  organisation_id?: string;
  source_file_ids: string[];
  source_file_hashes: string[];
  invoice_id?: string;
  meter_id?: string;
  tariff_version_id?: string;
  tariff_snapshot: Record<string, any>;
  calendar_version: string;
  parser_version: string;
  calculation_engine_version: string;
  application_version: string;
  configuration_snapshot: Record<string, any>;
  started_at: string;
  completed_at?: string;
  execution_environment: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  created_at: string;
}

/**
 * Cryptographic Hash Chain Integrity Verification Summary
 */
export interface HashChainVerificationResult {
  is_valid: boolean;
  total_events_checked: number;
  genesis_hash: string;
  latest_hash: string;
  tampered_event_ids: string[];
  tampered_sequence_numbers: number[];
  first_broken_sequence_number?: number;
  verification_timestamp: string;
  failure_reason?: string;
}
