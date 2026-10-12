/**
 * ENERA PRODUCTION OCR OBSERVABILITY & OPERATIONAL TELEMETRY SERVICE (REQUIREMENT 36)
 * ===================================================================================
 * Records structured operational telemetry for monitoring, debugging, and auditability:
 *
 * Operational Metrics:
 * - document_id
 * - ocr_run_id
 * - page_id
 * - provider
 * - processing_time (duration_ms)
 * - status
 * - error_code
 * - retry_count
 *
 * MANDATE: Do NOT log entire invoices or sensitive financial information unnecessarily.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { LocalWorkspaceStore } from "@/lib/localWorkspaceStore";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import { OcrSecurityGuard } from "../security/ocrSecurityGuard";

export interface OcrOperationalTelemetryEvent {
  telemetryId?: string;
  documentId: string;
  ocrRunId: string;
  pageId?: string;
  organisationId: string;
  provider: string;
  processingTimeMs: number;
  status:
    "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED" | "REVIEW_REQUIRED";
  errorCode?: string | null;
  retryCount: number;
  sanitizedMetadata?: Record<string, any>;
  createdAt?: string;
}

export interface OcrTelemetryAggregateSummary {
  totalEvents: number;
  completedCount: number;
  failedCount: number;
  reviewRequiredCount: number;
  averageProcessingTimeMs: number;
  providerBreakdown: Record<string, number>;
  retryEventCount: number;
}

export class OcrObservabilityService {
  private static readonly inMemoryTelemetryLogs: OcrOperationalTelemetryEvent[] = [];
  private static readonly STORAGE_KEY = "enera_ocr_telemetry";

  /**
   * Clears telemetry logs (for testing resets)
   */
  public static clearLogs(): void {
    this.inMemoryTelemetryLogs.length = 0;
  }

  /**
   * Records an operational telemetry event while strictly redacting sensitive financial data
   */
  public static async recordTelemetry(
    event: OcrOperationalTelemetryEvent,
    context?: UserSecurityContext,
  ): Promise<OcrOperationalTelemetryEvent> {
    const orgId = event.organisationId || context?.organisationId || "DEFAULT_TENANT";

    // Tenant check
    if (context && context.role !== "SUPER_ADMIN" && context.organisationId !== orgId) {
      throw new TenantIsolationViolationError(context.organisationId, orgId);
    }

    const timestamp = event.createdAt || new Date().toISOString();
    const telemetryId =
      event.telemetryId ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `telem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    // Strictly sanitize and redact any metadata
    const sanitizedMetadata = event.sanitizedMetadata
      ? OcrSecurityGuard.sanitizeLogPayload(event.sanitizedMetadata)
      : {};

    const record: OcrOperationalTelemetryEvent = {
      telemetryId,
      documentId: event.documentId,
      ocrRunId: event.ocrRunId,
      pageId: event.pageId,
      organisationId: orgId,
      provider: event.provider,
      processingTimeMs: Math.max(0, event.processingTimeMs),
      status: event.status,
      errorCode: event.errorCode || null,
      retryCount: Math.max(0, event.retryCount || 0),
      sanitizedMetadata,
      createdAt: timestamp,
    };

    // 1. L1 in-memory log
    this.inMemoryTelemetryLogs.push(record);

    // 2. L2 local workspace storage
    try {
      const existing =
        (await LocalWorkspaceStore.get<OcrOperationalTelemetryEvent[]>(this.STORAGE_KEY)) || [];
      await LocalWorkspaceStore.set(this.STORAGE_KEY, [...existing.slice(-1000), record]);
    } catch {
      // Local storage fallback
    }

    // 3. L3 Supabase database persistence
    if (isSupabaseConfigured) {
      try {
        await supabase.from("ocr_operational_telemetry" as any).insert({
          telemetry_id: record.telemetryId,
          document_id: record.documentId,
          ocr_run_id: record.ocrRunId,
          page_id: record.pageId,
          organisation_id: record.organisationId,
          provider: record.provider,
          processing_time_ms: record.processingTimeMs,
          status: record.status,
          error_code: record.errorCode,
          retry_count: record.retryCount,
          sanitized_metadata: record.sanitizedMetadata,
          created_at: record.createdAt,
        });
      } catch {
        // Remote DB persistence fallback
      }
    }

    return record;
  }

  /**
   * Retrieves operational telemetry events for a given document or OCR run
   */
  public static async getTelemetryForDocument(
    documentId: string,
    context?: UserSecurityContext,
  ): Promise<OcrOperationalTelemetryEvent[]> {
    const matching = this.inMemoryTelemetryLogs.filter((t) => t.documentId === documentId);
    if (context && context.role !== "SUPER_ADMIN") {
      for (const item of matching) {
        if (item.organisationId !== context.organisationId) {
          throw new TenantIsolationViolationError(context.organisationId, item.organisationId);
        }
      }
    }
    return matching;
  }

  /**
   * Computes aggregate operational metrics for health dashboards
   */
  public static getAggregateMetrics(organisationId?: string): OcrTelemetryAggregateSummary {
    const filtered = organisationId
      ? this.inMemoryTelemetryLogs.filter((t) => t.organisationId === organisationId)
      : this.inMemoryTelemetryLogs;

    if (filtered.length === 0) {
      return {
        totalEvents: 0,
        completedCount: 0,
        failedCount: 0,
        reviewRequiredCount: 0,
        averageProcessingTimeMs: 0,
        providerBreakdown: {},
        retryEventCount: 0,
      };
    }

    let totalDuration = 0;
    let completed = 0;
    let failed = 0;
    let reviewRequired = 0;
    let retries = 0;
    const providers: Record<string, number> = {};

    for (const event of filtered) {
      totalDuration += event.processingTimeMs;
      if (event.status === "COMPLETED") completed++;
      if (event.status === "FAILED") failed++;
      if (event.status === "REVIEW_REQUIRED") reviewRequired++;
      if (event.retryCount > 0) retries += event.retryCount;

      providers[event.provider] = (providers[event.provider] || 0) + 1;
    }

    return {
      totalEvents: filtered.length,
      completedCount: completed,
      failedCount: failed,
      reviewRequiredCount: reviewRequired,
      averageProcessingTimeMs: Math.round(totalDuration / filtered.length),
      providerBreakdown: providers,
      retryEventCount: retries,
    };
  }
}
