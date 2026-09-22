/**
 * Stage 20: Realtime & Automatic Refresh Domain Types
 */

export type RefreshEventType =
  | "PROCESSING_STARTED"
  | "PROCESSING_PROGRESS"
  | "PROCESSING_COMPLETED"
  | "PROCESSING_FAILED"
  | "DATA_MUTATED"
  | "TENANT_SWITCHED";

export interface RefreshEventPayload {
  jobId?: string;
  entityType?: "invoice" | "meter_telemetry" | "job" | "reconciliation" | "discrepancy";
  organisationId?: string;
  siteId?: string;
  recordCount?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export type RefreshEventListener = (payload: RefreshEventPayload) => void;

export interface RealtimeSubscriptionOptions {
  organisationId?: string;
  tables?: Array<
    "invoice_records" | "processing_jobs" | "reconciliation_runs" | "discrepancy_events"
  >;
  onRefresh?: (payload: RefreshEventPayload) => void;
  debounceMs?: number;
  enablePollingFallback?: boolean;
  pollingIntervalMs?: number;
}

export interface RealtimeSubscriptionHandle {
  channelId: string;
  unsubscribe: () => void;
  isActive: () => boolean;
}

export const CANONICAL_QUERY_KEYS = {
  dashboard: (orgId?: string) => ["dashboard", orgId || "all"] as const,
  charts: (orgId?: string) => ["charts", orgId || "all"] as const,
  invoices: (orgId?: string) => ["invoices", orgId || "all"] as const,
  reconciliations: (orgId?: string) => ["reconciliations", orgId || "all"] as const,
  jobs: (orgId?: string) => ["jobs", orgId || "all"] as const,
  sites: (orgId?: string) => ["sites", orgId || "all"] as const,
} as const;
