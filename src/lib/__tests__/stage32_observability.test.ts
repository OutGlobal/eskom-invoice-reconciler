/**
 * STAGE 32 — OBSERVABILITY & PRODUCTION VISIBILITY TEST SUITE
 * ========================================================
 *
 * Validates:
 * 1. Tracking for all 8 production categories:
 *    - Processing failures
 *    - Upload failures
 *    - Database errors
 *    - Reconciliation failures
 *    - Slow jobs
 *    - Failed extraction
 *    - Invalid files
 *    - Unexpected processing states
 * 2. Zero Technical Exposure to Ordinary Users:
 *    - Technical stack traces, SQLSTATE codes, table names (public.*),
 *      and file system paths are strictly sanitized into friendly messages.
 * 3. High-Fidelity Protected Logging:
 *    - Complete diagnostic details (stack traces, SQL snippets, latency)
 *      are securely preserved in access-controlled protected logs.
 * 4. Strict Role-Based Access Control on Protected Logs:
 *    - Ordinary users are denied access.
 *    - Administrators and system auditors have access to detailed diagnostics.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { ProductionObservabilityService } from "../../domain/observability/productionObservabilityService";
import { UserFacingErrorSanitizer } from "../../domain/observability/userFacingErrorSanitizer";
import type { UserSecurityContext } from "../../domain/security/types";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";

describe("Stage 32 — Production Observability & Zero-Exposure Error Governance", () => {
  const TENANT_ALPHA = "tenant-alpha-uuid";
  const TENANT_BETA = "tenant-beta-uuid";

  const ORDINARY_USER_CONTEXT: UserSecurityContext = {
    userId: "usr-regular-1",
    organisationId: TENANT_ALPHA,
    role: "USER" as any,
    permissions: ["view_dashboard"],
  };

  const SUPER_ADMIN_CONTEXT: UserSecurityContext = {
    userId: "usr-super-1",
    organisationId: TENANT_ALPHA,
    role: "SUPER_ADMIN",
    permissions: ["all"],
  };

  const ORG_ADMIN_CONTEXT: UserSecurityContext = {
    userId: "usr-org-admin-1",
    organisationId: TENANT_ALPHA,
    role: "ORGANISATION_ADMIN",
    permissions: ["manage_org"],
  };

  beforeEach(() => {
    ProductionObservabilityService.clearLogs();
  });

  it("1. Tracks Processing Failures with Sanitized User Notices and Protected Logs", async () => {
    const rawError = new Error(
      "Worker heap out of memory at PDFParser.parseBuffer (/app/worker.js:142:12)",
    );

    const userNotice = await ProductionObservabilityService.trackProcessingFailure({
      operationName: "PDF Parsing Pipeline",
      error: rawError,
      organisationId: TENANT_ALPHA,
      userId: "usr-test-1",
      entityId: "job-proc-001",
    });

    // Friendly user message
    expect(userNotice.referenceCode).toMatch(/^ERR-[A-Z0-9]{6}$/);
    expect(userNotice.title).toBe("Processing Notice");
    expect(userNotice.message).not.toContain("heap out of memory");
    expect(userNotice.message).not.toContain("worker.js");
    expect(userNotice.retryAllowed).toBe(true);

    // Protected log retains the raw technical details
    const logs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(logs.length).toBe(1);
    expect(logs[0].category).toBe("PROCESSING_FAILURE");
    expect(logs[0].technicalDetails.rawErrorMessage).toContain("Worker heap out of memory");
    expect(logs[0].technicalDetails.stackTrace).toContain("PDFParser.parseBuffer");
    expect(logs[0].referenceCode).toBe(userNotice.referenceCode);
  });

  it("2. Tracks Upload Failures Safely without Exposing Internal Hostnames or Cloud Paths", async () => {
    const rawUploadError = new Error(
      "S3 Upload Failed: Bucket s3://enera-internal-storage-prod-frankfurt/tenants/ timed out after 30000ms",
    );

    const userNotice = await ProductionObservabilityService.trackUploadFailure({
      filename: "eskom_invoice_july_2026.pdf",
      error: rawUploadError,
      organisationId: TENANT_ALPHA,
      userId: "usr-test-1",
      fileSizeBytes: 4_500_000,
    });

    expect(userNotice.title).toBe("File Upload Interrupted");
    expect(userNotice.message).not.toContain("s3://");
    expect(userNotice.message).not.toContain("enera-internal-storage");
    expect(userNotice.actionableHint).toContain("check your internet connection");

    const logs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(logs[0].category).toBe("UPLOAD_FAILURE");
    expect(logs[0].technicalDetails.rawErrorMessage).toContain("s3://enera-internal-storage");
  });

  it("3. Tracks Database Errors and Strictly Redacts SQLSTATE, Table Names & Stack Traces", async () => {
    const rawDbError = {
      message:
        'relation "public.invoices" violates check constraint "billing_end_after_start" (SQLSTATE 23514) at Client.query (/node_modules/pg/lib/client.js:526:17)',
      code: "23514",
      detail: "Failing row contains (inv-123, 2026-08-01, 2026-07-01).",
    };

    const userNotice = await ProductionObservabilityService.trackDatabaseError({
      operationName: "Insert Authoritative Invoice Record",
      error: rawDbError,
      sqlSnippet: "INSERT INTO public.invoices (id, billing_start, billing_end) VALUES (...)",
      organisationId: TENANT_ALPHA,
    });

    // Ordinary user sees zero internal schema details
    expect(userNotice.title).toBe("Service Temporarily Unavailable");
    expect(userNotice.message).not.toContain("public.invoices");
    expect(userNotice.message).not.toContain("SQLSTATE");
    expect(userNotice.message).not.toContain("check constraint");
    expect(userNotice.message).not.toContain("/node_modules/pg");

    // Protected log retains the raw SQL and constraint details for engineers
    const logs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(logs[0].category).toBe("DATABASE_ERROR");
    expect(logs[0].severity).toBe("CRITICAL");
    expect(logs[0].technicalDetails.sqlQuerySnippet).toContain("INSERT INTO public.invoices");
    expect(logs[0].technicalDetails.errorCode).toBe("23514");
  });

  it("4. Tracks Reconciliation Failures with Actionable Domain Guidance", async () => {
    const rawReconError = new Error(
      "Unmatched rate determinants: Megaflex Peak Energy rate R/kWh missing for active season",
    );

    const userNotice = await ProductionObservabilityService.trackReconciliationFailure({
      operationName: "Deterministic Tariff Engine Run",
      error: rawReconError,
      invoiceId: "inv-2026-07-001",
      organisationId: TENANT_ALPHA,
    });

    expect(userNotice.title).toBe("Reconciliation Notice");
    expect(userNotice.message).toContain("missing");
    expect(userNotice.actionableHint).toContain(
      "confirm that the assigned tariff and meter interval readings cover the entire billing period",
    );

    const logs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(logs[0].category).toBe("RECONCILIATION_FAILURE");
    expect(logs[0].entityId).toBe("inv-2026-07-001");
  });

  it("5. Tracks Slow Jobs with Execution Durations and Throughput Metrics", async () => {
    // Simulate a slow job execution exceeding 10 seconds threshold
    await ProductionObservabilityService.trackSlowJob(
      {
        jobId: "job-slow-99",
        jobType: "TELEMETRY_INTERVAL_STREAM",
        durationMs: 14_500,
        thresholdMs: 10_000,
        recordCount: 50_000,
        throughputRowsPerSec: 3_448,
        stage: "NORMALISING",
      },
      TENANT_ALPHA,
    );

    const logs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(logs[0].category).toBe("SLOW_JOB");
    expect(logs[0].severity).toBe("WARNING");
    expect(logs[0].technicalDetails.performanceMetrics?.durationMs).toBe(14_500);
    expect(logs[0].technicalDetails.performanceMetrics?.throughputRowsPerSec).toBe(3_448);
  });

  it("6. Tracks Failed Extractions and Invalid Files", async () => {
    // 6a. Failed Extraction
    const extractionNotice = await ProductionObservabilityService.trackFailedExtraction({
      filename: "blurry_scan_invoice.pdf",
      error: "OCR text density < 0.15; tax invoice table boundaries could not be resolved",
      organisationId: TENANT_ALPHA,
      uploadId: "upl-fail-001",
    });

    expect(extractionNotice.title).toBe("Extraction Incomplete");
    expect(extractionNotice.message).toContain("unable to extract complete billing details");
    expect(extractionNotice.actionableHint).toContain(
      "ensure your document is a clear, legible PDF",
    );

    // 6b. Invalid File
    const invalidFileNotice = await ProductionObservabilityService.trackInvalidFile({
      filename: "malformed_script.exe",
      reason: "Executable file headers detected in PDF upload",
      detectedMimeType: "application/x-msdownload",
      organisationId: TENANT_ALPHA,
    });

    expect(invalidFileNotice.title).toBe("Unsupported File");
    expect(invalidFileNotice.retryAllowed).toBe(false);

    const logs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(logs.some((l) => l.category === "FAILED_EXTRACTION")).toBe(true);
    expect(logs.some((l) => l.category === "INVALID_FILE")).toBe(true);
  });

  it("7. Tracks Unexpected Processing States and Out-of-Order Lifecycle Events", async () => {
    const unexpectedNotice = await ProductionObservabilityService.trackUnexpectedState({
      operationName: "State Machine Transition",
      expectedState: "PROCESSING | NORMALISING",
      actualState: "COMPLETED",
      entityId: "job-anomaly-404",
      organisationId: TENANT_ALPHA,
    });

    expect(unexpectedNotice.title).toBe("Processing State Notice");
    expect(unexpectedNotice.retryAllowed).toBe(true);

    const logs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(logs[0].category).toBe("UNEXPECTED_STATE");
    expect(logs[0].technicalDetails.rawErrorMessage).toContain(
      "expected 'PROCESSING | NORMALISING'",
    );
  });

  it("8. Enforces Strict RBAC: Ordinary Users Denied Access to Protected Logs", async () => {
    // Log an event
    await ProductionObservabilityService.trackDatabaseError({
      operationName: "System DB Query",
      error: "Connection timeout to pg pool 5432",
      organisationId: TENANT_ALPHA,
    });

    // Ordinary user attempt throws Access Denied
    expect(() => {
      ProductionObservabilityService.getProtectedLogs(ORDINARY_USER_CONTEXT);
    }).toThrow(/Access Denied/i);

    // Super admin can access
    const adminLogs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(adminLogs.length).toBeGreaterThan(0);
  });

  it("9. Enforces Tenant Isolation on Protected Operational Logs", async () => {
    await ProductionObservabilityService.trackProcessingFailure({
      operationName: "Tenant Alpha Operation",
      error: "Alpha error",
      organisationId: TENANT_ALPHA,
    });

    await ProductionObservabilityService.trackProcessingFailure({
      operationName: "Tenant Beta Operation",
      error: "Beta error",
      organisationId: TENANT_BETA,
    });

    // Org admin of TENANT_ALPHA only sees Alpha's logs
    const orgAdminLogs = ProductionObservabilityService.getProtectedLogs(ORG_ADMIN_CONTEXT);
    expect(orgAdminLogs.every((l) => l.organisationId === TENANT_ALPHA)).toBe(true);
    expect(orgAdminLogs.some((l) => l.organisationId === TENANT_BETA)).toBe(false);

    // Super Admin sees both
    const superAdminLogs = ProductionObservabilityService.getProtectedLogs(SUPER_ADMIN_CONTEXT);
    expect(superAdminLogs.some((l) => l.organisationId === TENANT_ALPHA)).toBe(true);
    expect(superAdminLogs.some((l) => l.organisationId === TENANT_BETA)).toBe(true);
  });

  it("10. UserFacingErrorSanitizer Verifies No Technical Jargon or SQL Leaks", () => {
    const rawTechnicalSnippet = `
      Error: relation "public.meter_readings" does not exist
      at Client._query (/node_modules/pg/lib/client.js:526:17)
      at Connection.execute (SELECT * FROM public.meter_readings WHERE org_id = '123')
      SQLSTATE 42P01
      PostgREST error: connection pool exhausted
    `;

    expect(UserFacingErrorSanitizer.containsTechnicalDetails(rawTechnicalSnippet)).toBe(true);

    const sanitized = UserFacingErrorSanitizer.sanitize("DATABASE_ERROR", rawTechnicalSnippet);
    expect(UserFacingErrorSanitizer.containsTechnicalDetails(sanitized.message)).toBe(false);
    expect(sanitized.message).not.toContain("public.meter_readings");
    expect(sanitized.message).not.toContain("SQLSTATE");
    expect(sanitized.message).not.toContain("node_modules");
    expect(sanitized.message).not.toContain("PostgREST");
  });
});
