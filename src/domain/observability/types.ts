/**
 * STAGE 32 — OBSERVABILITY & PRODUCTION VISIBILITY TYPES
 *
 * Defines event models, severity levels, performance metrics,
 * and access-controlled log structures for production observability.
 */

export type ObservabilityCategory =
  | "PROCESSING_FAILURE"
  | "UPLOAD_FAILURE"
  | "DATABASE_ERROR"
  | "RECONCILIATION_FAILURE"
  | "SLOW_JOB"
  | "FAILED_EXTRACTION"
  | "INVALID_FILE"
  | "UNEXPECTED_STATE";

export type ObservabilitySeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export interface UserFacingMessage {
  referenceCode: string;
  title: string;
  message: string;
  actionableHint?: string;
  retryAllowed: boolean;
}

export interface SlowJobMetrics {
  jobId: string;
  jobType: string;
  durationMs: number;
  thresholdMs: number;
  recordCount?: number;
  throughputRowsPerSec?: number;
  stage?: string;
}

export interface ProtectedLogRecord {
  id: string;
  referenceCode: string;
  category: ObservabilityCategory;
  severity: ObservabilitySeverity;
  timestamp: string;
  organisationId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  operationName: string;
  // User-facing sanitized view
  userFacing: UserFacingMessage;
  // Protected diagnostic details (never exposed to ordinary users)
  technicalDetails: {
    rawErrorMessage: string;
    errorName?: string;
    errorCode?: string | number;
    stackTrace?: string;
    sqlQuerySnippet?: string;
    endpointOrModule?: string;
    performanceMetrics?: Record<string, any>;
    contextPayload?: Record<string, any>;
  };
  hash: string;
}

export interface TrackEventParams {
  category: ObservabilityCategory;
  severity?: ObservabilitySeverity;
  organisationId?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  operationName: string;
  error?: unknown;
  customUserMessage?: string;
  actionableHint?: string;
  retryAllowed?: boolean;
  performanceMetrics?: Record<string, any>;
  contextPayload?: Record<string, any>;
}

export interface ObservabilityFilter {
  category?: ObservabilityCategory;
  severity?: ObservabilitySeverity;
  organisationId?: string;
  sinceTimestamp?: string;
  referenceCode?: string;
}
