/**
 * Stage 22: Authoritative Audit Trail Subsystem Types
 * Comprehensive, persistent audit lineage for regulatory compliance and financial governance.
 */

export type AuditActionCategory =
  | "upload"
  | "processing"
  | "data_extraction"
  | "data_correction"
  | "reconciliation"
  | "report_generation"
  | "configuration_changes"
  | "tariff_changes"
  | "user_actions"
  | "permission_changes";

export type AuditTrailActionCode =
  // Upload actions
  | "UPLOAD_INITIATED"
  | "UPLOAD_COMPLETED"
  | "UPLOAD_FAILED"
  | "UPLOAD_DUPLICATE_RESOLVED"
  // Processing actions
  | "PROCESSING_JOB_QUEUED"
  | "PROCESSING_JOB_STARTED"
  | "PROCESSING_STAGE_TRANSITION"
  | "PROCESSING_JOB_COMPLETED"
  | "PROCESSING_JOB_FAILED"
  // Data extraction actions
  | "INVOICE_DATA_EXTRACTED"
  | "INTERVAL_TELEMETRY_EXTRACTED"
  | "BILLING_DETERMINANTS_EXTRACTED"
  | "TARIFF_CODE_EXTRACTED"
  // Data correction actions
  | "INVOICE_FIELD_CORRECTED"
  | "DUPLICATE_CORRECTION_ACCEPTED"
  | "TELEMETRY_INTERVAL_CORRECTED"
  | "MANUAL_READING_OVERRIDDEN"
  // Reconciliation actions
  | "RECONCILIATION_RUN_INITIATED"
  | "RECONCILIATION_RUN_SAVED"
  | "RECONCILIATION_DISCREPANCY_FLAGGED"
  | "RECONCILIATION_SETTLEMENT_APPROVED"
  // Report generation actions
  | "DISPUTE_PACK_EXCEL_GENERATED"
  | "DISPUTE_PACK_PDF_GENERATED"
  | "EXECUTIVE_REPORT_EXPORTED"
  | "COMPLIANCE_AUDIT_EXPORTED"
  // Configuration changes
  | "METER_CONFIGURATION_CHANGED"
  | "RATIO_MULTIPLIER_UPDATED"
  | "ORGANISATION_SETTINGS_CHANGED"
  | "CALENDAR_RULE_MODIFIED"
  // Tariff changes
  | "TARIFF_VERSION_ASSIGNED"
  | "TARIFF_RATES_UPDATED"
  | "TARIFF_STRUCTURE_MODIFIED"
  // User actions
  | "USER_LOGIN_RECORDED"
  | "INVOICE_REVIEW_SUBMITTED"
  | "WORKFLOW_STEP_APPROVED"
  | "DISPUTE_PACK_FILED"
  // Permission changes
  | "USER_ROLE_ASSIGNED"
  | "SITE_ACCESS_UPDATED"
  | "SECURITY_PERMISSION_GRANTED"
  | "SECURITY_PERMISSION_REVOKED"
  | (string & {});

export interface AuditActor {
  userId: string;
  email: string;
  displayName?: string;
  role: string;
  ipAddressMasked?: string;
}

export interface AuditTargetRecord {
  entityType:
    | "invoice"
    | "source_file"
    | "processing_job"
    | "reconciliation_run"
    | "meter_configuration"
    | "tariff_structure"
    | "user_profile"
    | "system_settings"
    | "report"
    | (string & {});
  recordId: string;
  recordLabel?: string;
}

export interface AuditFieldDiff {
  field: string;
  previousValue: any;
  newValue: any;
  changeType: "added" | "modified" | "deleted";
}

export interface AuditStateSnapshot {
  [key: string]: any;
}

export interface AuditTrailRecord {
  id: string;
  organisationId: string;
  category: AuditActionCategory;
  action: AuditTrailActionCode;
  description: string;
  actor: AuditActor;
  timestamp: string; // ISO 8601 UTC
  record: AuditTargetRecord;
  previousState?: AuditStateSnapshot | null;
  newState?: AuditStateSnapshot | null;
  diff?: AuditFieldDiff[];
  metadata: Record<string, any>;
  hash: string; // SHA-256 integrity seal
  created_at: string;
}

export interface RecordAuditActionParams {
  organisationId: string;
  category: AuditActionCategory;
  action: AuditTrailActionCode;
  description: string;
  actor?: Partial<AuditActor>;
  record: AuditTargetRecord;
  previousState?: AuditStateSnapshot | null;
  newState?: AuditStateSnapshot | null;
  metadata?: Record<string, any>;
}

export interface AuditTrailFilter {
  organisationId?: string;
  categories?: AuditActionCategory[];
  action?: string;
  recordId?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
}

export interface AuditTrailPagination {
  page?: number;
  pageSize?: number;
}

export interface AuditTrailQueryResult {
  records: AuditTrailRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
