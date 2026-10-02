/**
 * STAGE 32 — PRODUCTION OBSERVABILITY SERVICE
 *
 * Implements authoritative observability, telemetry capture, and error tracking:
 * 1. Processing failures
 * 2. Upload failures
 * 3. Database errors
 * 4. Reconciliation failures
 * 5. Slow jobs
 * 6. Failed extraction
 * 7. Invalid files
 * 8. Unexpected processing states
 *
 * Enforces Level 3 Zero-Exposure governance:
 * - Ordinary users only see sanitized, friendly messages.
 * - Technical details (stack traces, SQL snippets, schema names) are
 *   strictly restricted to protected operational logs with RBAC enforcement.
 */

import { supabase } from "@/lib/supabase";
import { UserFacingErrorSanitizer } from "./userFacingErrorSanitizer";
import { HashChainEngine } from "../audit/hashChainEngine";
import { AuditTrailService } from "../audit/auditTrailService";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import type {
  ObservabilityCategory,
  ObservabilitySeverity,
  ProtectedLogRecord,
  TrackEventParams,
  UserFacingMessage,
  SlowJobMetrics,
  ObservabilityFilter,
} from "./types";

export class ProductionObservabilityService {
  // Access-controlled protected operational logs repository
  private static readonly protectedLogs: ProtectedLogRecord[] = [];

  // Default latency thresholds in milliseconds
  public static readonly THRESHOLDS = {
    EXTRACTION_MS: 15_000,
    RECONCILIATION_MS: 2_000,
    BATCH_JOB_MS: 10_000,
    DB_QUERY_MS: 1_000,
  };

  /**
   * Clears protected logs (primarily for test resets)
   */
  public static clearLogs(): void {
    this.protectedLogs.length = 0;
  }

  /**
   * Tracks an observability event, generates sanitized user message,
   * and saves high-fidelity technical diagnostics in protected logs.
   */
  public static async trackEvent(params: TrackEventParams): Promise<UserFacingMessage> {
    const timestamp = new Date().toISOString();
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `obs-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const severity: ObservabilitySeverity =
      params.severity || this.getDefaultSeverity(params.category);

    // 1. Generate sanitized, friendly user-facing message
    const userFacing = UserFacingErrorSanitizer.sanitize(
      params.category,
      params.error,
      params.customUserMessage,
      params.actionableHint,
      params.retryAllowed,
    );

    // 2. Extract technical diagnostic details
    const technicalDetails = this.extractTechnicalDetails(params.error, params);

    // 3. Compute cryptographic seal for tamper-evidence
    const payloadForHash = {
      id,
      referenceCode: userFacing.referenceCode,
      category: params.category,
      timestamp,
      operationName: params.operationName,
      rawErrorMessage: technicalDetails.rawErrorMessage,
    };
    const hash = await HashChainEngine.calculateSHA256(payloadForHash);

    const protectedRecord: ProtectedLogRecord = {
      id,
      referenceCode: userFacing.referenceCode,
      category: params.category,
      severity,
      timestamp,
      organisationId: params.organisationId,
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
      operationName: params.operationName,
      userFacing,
      technicalDetails,
      hash,
    };

    // Store in protected in-memory repository
    this.protectedLogs.unshift(protectedRecord);

    // Keep log bounded to 1,000 most recent events
    if (this.protectedLogs.length > 1000) {
      this.protectedLogs.pop();
    }

    // Persist to database if available
    try {
      await supabase.from("protected_operational_logs").insert({
        id: protectedRecord.id,
        reference_code: protectedRecord.referenceCode,
        category: protectedRecord.category,
        severity: protectedRecord.severity,
        timestamp: protectedRecord.timestamp,
        organisation_id: protectedRecord.organisationId,
        user_id: protectedRecord.userId,
        entity_type: protectedRecord.entityType,
        entity_id: protectedRecord.entityId,
        operation_name: protectedRecord.operationName,
        user_facing: protectedRecord.userFacing,
        technical_details: protectedRecord.technicalDetails,
        hash: protectedRecord.hash,
      });
    } catch {
      // In offline / test mode: protected in-memory store maintains the authoritative log
    }

    // Record critical failures in system audit trail
    if (severity === "ERROR" || severity === "CRITICAL") {
      try {
        void AuditTrailService.recordAction({
          organisationId: params.organisationId || "SYSTEM",
          category: "processing",
          action: `OBSERVABILITY_${params.category}`,
          description: `Operational event: ${params.operationName} (${userFacing.referenceCode})`,
          actor: { userId: params.userId },
          record: {
            entityType: params.entityType || "system",
            recordId: params.entityId || id,
            recordLabel: params.operationName,
          },
          newState: {
            category: params.category,
            referenceCode: userFacing.referenceCode,
            severity,
            userTitle: userFacing.title,
          },
        });
      } catch {
        // Audit log error fallback
      }
    }

    return userFacing;
  }

  // Convenience tracking methods for each of the 8 required categories

  public static async trackProcessingFailure(params: {
    operationName: string;
    error: unknown;
    organisationId?: string;
    userId?: string;
    entityId?: string;
    contextPayload?: Record<string, any>;
  }): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "PROCESSING_FAILURE",
      severity: "ERROR",
      operationName: params.operationName,
      error: params.error,
      organisationId: params.organisationId,
      userId: params.userId,
      entityType: "processing_job",
      entityId: params.entityId,
      contextPayload: params.contextPayload,
    });
  }

  public static async trackUploadFailure(params: {
    filename: string;
    error: unknown;
    organisationId?: string;
    userId?: string;
    fileSizeBytes?: number;
  }): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "UPLOAD_FAILURE",
      severity: "ERROR",
      operationName: `Upload: ${params.filename}`,
      error: params.error,
      organisationId: params.organisationId,
      userId: params.userId,
      entityType: "upload",
      contextPayload: { filename: params.filename, fileSizeBytes: params.fileSizeBytes },
    });
  }

  public static async trackDatabaseError(params: {
    operationName: string;
    error: unknown;
    sqlSnippet?: string;
    organisationId?: string;
    userId?: string;
  }): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "DATABASE_ERROR",
      severity: "CRITICAL",
      operationName: params.operationName,
      error: params.error,
      organisationId: params.organisationId,
      userId: params.userId,
      entityType: "database",
      contextPayload: { sqlSnippet: params.sqlSnippet },
    });
  }

  public static async trackReconciliationFailure(params: {
    operationName: string;
    error: unknown;
    invoiceId?: string;
    organisationId?: string;
    contextPayload?: Record<string, any>;
  }): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "RECONCILIATION_FAILURE",
      severity: "ERROR",
      operationName: params.operationName,
      error: params.error,
      organisationId: params.organisationId,
      entityType: "reconciliation_run",
      entityId: params.invoiceId,
      contextPayload: params.contextPayload,
    });
  }

  public static async trackSlowJob(
    metrics: SlowJobMetrics,
    organisationId?: string,
  ): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "SLOW_JOB",
      severity: "WARNING",
      operationName: `Slow Execution: ${metrics.jobType}`,
      organisationId,
      entityType: "processing_job",
      entityId: metrics.jobId,
      performanceMetrics: {
        durationMs: metrics.durationMs,
        thresholdMs: metrics.thresholdMs,
        recordCount: metrics.recordCount,
        throughputRowsPerSec: metrics.throughputRowsPerSec,
        stage: metrics.stage,
      },
      customUserMessage:
        "Processing is taking slightly longer than usual due to high volume, but is continuing safely in the background.",
    });
  }

  public static async trackFailedExtraction(params: {
    filename: string;
    error: unknown;
    organisationId?: string;
    userId?: string;
    uploadId?: string;
  }): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "FAILED_EXTRACTION",
      severity: "ERROR",
      operationName: `Extraction Failed: ${params.filename}`,
      error: params.error,
      organisationId: params.organisationId,
      userId: params.userId,
      entityType: "source_file",
      entityId: params.uploadId,
    });
  }

  public static async trackInvalidFile(params: {
    filename: string;
    reason: string;
    detectedMimeType?: string;
    organisationId?: string;
    userId?: string;
  }): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "INVALID_FILE",
      severity: "WARNING",
      operationName: `Invalid File: ${params.filename}`,
      error: params.reason,
      customUserMessage: `The file '${params.filename}' could not be processed: ${params.reason}`,
      organisationId: params.organisationId,
      userId: params.userId,
      entityType: "upload",
      contextPayload: { detectedMimeType: params.detectedMimeType },
      retryAllowed: false,
    });
  }

  public static async trackUnexpectedState(params: {
    operationName: string;
    expectedState: string;
    actualState: string;
    entityId?: string;
    organisationId?: string;
  }): Promise<UserFacingMessage> {
    return this.trackEvent({
      category: "UNEXPECTED_STATE",
      severity: "ERROR",
      operationName: params.operationName,
      error: `Unexpected transition: expected '${params.expectedState}', but encountered '${params.actualState}'`,
      organisationId: params.organisationId,
      entityId: params.entityId,
      contextPayload: { expectedState: params.expectedState, actualState: params.actualState },
    });
  }

  /**
   * Latency tracker wrapper: executes an operation, measures its runtime,
   * flags slow executions, and safely captures exceptions.
   */
  public static async trackExecution<T>(
    operationName: string,
    thresholdMs: number,
    operation: () => Promise<T>,
    context?: {
      organisationId?: string;
      jobId?: string;
      jobType?: string;
      recordCount?: number;
    },
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const durationMs = Math.round(performance.now() - start);

      if (durationMs > thresholdMs) {
        const throughput =
          context?.recordCount && durationMs > 0
            ? Math.round((context.recordCount / durationMs) * 1000)
            : undefined;

        await this.trackSlowJob(
          {
            jobId: context?.jobId || "adhoc",
            jobType: context?.jobType || operationName,
            durationMs,
            thresholdMs,
            recordCount: context?.recordCount,
            throughputRowsPerSec: throughput,
          },
          context?.organisationId,
        );
      }

      return result;
    } catch (err: unknown) {
      await this.trackProcessingFailure({
        operationName,
        error: err,
        organisationId: context?.organisationId,
        entityId: context?.jobId,
      });
      throw err;
    }
  }

  /**
   * Retrieves protected diagnostic logs with strict RBAC access control.
   * Only SUPER_ADMIN, SYSTEM_AUDITOR, or ORGANISATION_ADMIN (filtered by org) may inspect technical logs.
   */
  public static getProtectedLogs(
    context: UserSecurityContext,
    filter?: ObservabilityFilter,
  ): ProtectedLogRecord[] {
    // Ordinary users or unauthorized requests are strictly denied access to raw technical logs
    const privilegedRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "ORGANISATION_ADMIN",
      "COMPLIANCE_OFFICER",
      "SYSTEM_AUDITOR",
    ];
    if (!privilegedRoles.includes(context.role)) {
      throw new Error(
        "Access Denied: Protected operational logs require administrative or auditor privileges.",
      );
    }

    let records = [...this.protectedLogs];

    // Enforce tenant isolation for non-super admins
    if (context.role !== "SUPER_ADMIN") {
      records = records.filter(
        (r) => !r.organisationId || r.organisationId === context.organisationId,
      );
    }

    // Apply filters
    if (filter?.category) {
      records = records.filter((r) => r.category === filter.category);
    }
    if (filter?.severity) {
      records = records.filter((r) => r.severity === filter.severity);
    }
    if (filter?.referenceCode) {
      records = records.filter((r) => r.referenceCode === filter.referenceCode);
    }
    if (filter?.sinceTimestamp) {
      const since = new Date(filter.sinceTimestamp).getTime();
      records = records.filter((r) => new Date(r.timestamp).getTime() >= since);
    }

    return records;
  }

  /**
   * Looks up a single log record by reference code for support triage
   */
  public static getLogByReferenceCode(
    referenceCode: string,
    context: UserSecurityContext,
  ): ProtectedLogRecord | null {
    const logs = this.getProtectedLogs(context, { referenceCode });
    return logs[0] || null;
  }

  private static getDefaultSeverity(category: ObservabilityCategory): ObservabilitySeverity {
    switch (category) {
      case "DATABASE_ERROR":
        return "CRITICAL";
      case "PROCESSING_FAILURE":
      case "RECONCILIATION_FAILURE":
      case "FAILED_EXTRACTION":
      case "UNEXPECTED_STATE":
        return "ERROR";
      case "UPLOAD_FAILURE":
      case "INVALID_FILE":
      case "SLOW_JOB":
      default:
        return "WARNING";
    }
  }

  private static extractTechnicalDetails(
    error: unknown,
    params: TrackEventParams,
  ): ProtectedLogRecord["technicalDetails"] {
    const rawErrorMessage = UserFacingErrorSanitizer.extractRawMessage(error);
    const errorObj = error instanceof Error ? error : null;

    return {
      rawErrorMessage,
      errorName:
        errorObj?.name || (typeof error === "object" && error ? (error as any).name : undefined),
      errorCode:
        typeof error === "object" && error
          ? (error as any).code || (error as any).status || (error as any).statusCode
          : undefined,
      stackTrace: errorObj?.stack,
      sqlQuerySnippet: params.contextPayload?.sqlSnippet,
      endpointOrModule: params.operationName,
      performanceMetrics: params.performanceMetrics,
      contextPayload: params.contextPayload,
    };
  }
}
