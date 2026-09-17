/**
 * Stage 16 — Server-Side Processing Jobs Test Suite
 * Eskom Bill Balancer Platform
 *
 * Verifies:
 * 1. Full asynchronous pipeline lifecycle (QUEUED -> RUNNING -> COMPLETED)
 * 2. Large CSV interval streaming & progress reporting
 * 3. Excel telemetry workbook ingestion on backend worker
 * 4. Real-time status tracking & progress subscriptions
 * 5. Safe stopping on ambiguity (PAUSED_AMBIGUITY) & server resumption
 * 6. Strict tenant isolation (cross-tenant access rejection)
 * 7. In-flight job cancellation
 * 8. Public Disclosure Model Level 3 private zero-exposure compliance
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as XLSX from "xlsx";
import { ProcessingJobEngine } from "../../domain/jobs/processingJobEngine";
import { TenantIsolationViolationError } from "../../domain/security/tenantContextService";
import type { UserSecurityContext } from "../../domain/security/types";
import type { JobProgressUpdate } from "../../domain/jobs/types";

describe("Stage 16 — Server-Side Processing Jobs Engine", () => {
  const TENANT_A = "11111111-1111-1111-1111-111111111111";
  const TENANT_B = "22222222-2222-2222-2222-222222222222";

  const USER_A_ADMIN: UserSecurityContext = {
    userId: "usr-admin-a",
    email: "admin-a@enera.internal",
    organisationId: TENANT_A,
    role: "ORGANISATION_ADMIN",
    permissions: [
      "PERM_MANAGE_ORGANISATION",
      "PERM_UPLOAD_FILES",
      "PERM_RUN_RECONCILIATION",
      "PERM_VIEW_DATA",
    ],
  };

  const USER_B_ADMIN: UserSecurityContext = {
    userId: "usr-admin-b",
    email: "admin-b@enera.internal",
    organisationId: TENANT_B,
    role: "ORGANISATION_ADMIN",
    permissions: [
      "PERM_MANAGE_ORGANISATION",
      "PERM_UPLOAD_FILES",
      "PERM_RUN_RECONCILIATION",
      "PERM_VIEW_DATA",
    ],
  };

  const SUPER_ADMIN: UserSecurityContext = {
    userId: "usr-super-admin",
    email: "super@enera.internal",
    organisationId: "SYSTEM",
    role: "SUPER_ADMIN",
    permissions: [
      "PERM_MANAGE_ORGANISATION",
      "PERM_MANAGE_USERS",
      "PERM_UPLOAD_FILES",
      "PERM_RUN_RECONCILIATION",
      "PERM_APPROVE_FINDINGS",
      "PERM_EXPORT_REPORTS",
      "PERM_VIEW_AUDIT_LEDGER",
      "PERM_VIEW_DATA",
    ],
  };

  beforeEach(() => {
    ProcessingJobEngine.clearState();
  });

  const samplePdfBytes = new TextEncoder().encode(
    "%PDF-1.5\nEskom Megaflex Tax Invoice Account: 7856504676 Period: 2025-01-01 to 2025-01-31 Total: 15462529.74\n%%EOF",
  );

  const sampleCsvContent = `timestamp,meter_id,active_power_kwh,reactive_power_kvarh,apparent_power_kva
2025-01-01T00:00:00Z,MTR-ESKOM-001,150.5,35.2,160.0
2025-01-01T00:30:00Z,MTR-ESKOM-001,148.0,34.0,155.0
2025-01-01T01:00:00Z,MTR-ESKOM-001,152.1,36.1,162.0
2025-01-01T01:30:00Z,MTR-ESKOM-001,149.8,33.9,158.0`;

  it("1. executes full asynchronous pipeline on server (QUEUED -> RUNNING -> COMPLETED)", async () => {
    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        invoiceFile: {
          name: "Eskom_Invoice_Jan2025.pdf",
          size: samplePdfBytes.byteLength,
          type: "application/pdf",
          data: samplePdfBytes,
        },
        meterFile: {
          name: "Telemetry_Jan2025.csv",
          size: sampleCsvContent.length,
          type: "text/csv",
          data: new TextEncoder().encode(sampleCsvContent),
        },
      },
      USER_A_ADMIN,
    );

    expect(job.jobId).toMatch(/^JOB-/);
    expect(job.status).toBe("QUEUED");
    expect(job.currentStage).toBe("QUEUED");
    expect(job.progressPercentage).toBe(0);

    // Await server-side execution completion
    const status = await ProcessingJobEngine.waitForTerminalState(job.jobId);

    expect(status).not.toBeNull();
    expect(status.status).toBe("COMPLETED");
    expect(status.currentStage).toBe("COMPLETED");
    expect(status.progressPercentage).toBe(100);
    expect(status.recordsProcessed).toBe(4);
    expect(status.resultPayload).toBeDefined();
    expect(status.resultPayload!.reconciliation).toBeDefined();
    expect(status.resultPayload!.diagnostics).toBeDefined();
    expect(status.resultPayload!.telemetrySummary?.recordsCount).toBe(4);
  });

  it("2. streams large CSV interval datasets with incremental batch progress", async () => {
    // Generate a 500-interval CSV
    let largeCsv = "timestamp,meter_id,active_power_kwh,reactive_power_kvarh,apparent_power_kva\n";
    for (let i = 0; i < 500; i++) {
      const date = new Date(Date.UTC(2025, 0, 1, 0, i * 30)).toISOString();
      largeCsv += `${date},MTR-ESKOM-001,150.0,30.0,160.0\n`;
    }

    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        meterFile: {
          name: "Large_AMR_Dataset.csv",
          size: largeCsv.length,
          type: "text/csv",
          data: new TextEncoder().encode(largeCsv),
        },
      },
      USER_A_ADMIN,
    );

    const status = await ProcessingJobEngine.waitForTerminalState(job.jobId);

    expect(status.status).toBe("COMPLETED");
    expect(status.recordsProcessed).toBe(500);
    expect(status.totalRecords).toBe(500);
  });

  it("3. processes Excel workbooks on backend worker without browser heap crashes", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      { timestamp: "2025-01-01T00:00:00Z", meter_id: "MTR-ESKOM-001", kwh: 120.5, kvarh: 30.2, kva: 125.0 },
      { timestamp: "2025-01-01T00:30:00Z", meter_id: "MTR-ESKOM-001", kwh: 118.0, kvarh: 29.5, kva: 122.0 },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Intervals");
    const xlsxBuffer = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));

    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        jobType: "EXCEL_PROCESSING",
        meterFile: {
          name: "Telemetry_Intervals_Q1.xlsx",
          size: xlsxBuffer.byteLength,
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          data: xlsxBuffer,
        },
      },
      USER_A_ADMIN,
    );

    const status = await ProcessingJobEngine.waitForTerminalState(job.jobId);

    expect(status.status).toBe("COMPLETED");
    expect(status.stageMessage).toContain("completed successfully");
  });

  it("4. supports real-time progress subscription across processing stages", async () => {
    const updates: JobProgressUpdate[] = [];

    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        invoiceFile: {
          name: "Eskom_Invoice_Feb2025.pdf",
          size: samplePdfBytes.byteLength,
          type: "application/pdf",
          data: samplePdfBytes,
        },
        meterFile: {
          name: "Meter_Data.csv",
          size: sampleCsvContent.length,
          type: "text/csv",
          data: new TextEncoder().encode(sampleCsvContent),
        },
      },
      USER_A_ADMIN,
    );

    const unsubscribe = ProcessingJobEngine.onJobProgress(job.jobId, (upd) => {
      updates.push(upd);
    });

    const status = await ProcessingJobEngine.waitForTerminalState(job.jobId);
    unsubscribe();

    expect(status.status).toBe("COMPLETED");
    expect(updates.length).toBeGreaterThan(3);
    const stagesSeen = updates.map((u) => u.stage);
    expect(stagesSeen).toContain("UPLOAD_VERIFICATION");
    expect(stagesSeen).toContain("PDF_EXTRACTION");
    expect(stagesSeen).toContain("COMPLETED");

    // Monotonically increasing progress
    for (let i = 1; i < updates.length; i++) {
      expect(updates[i].progressPercentage).toBeGreaterThanOrEqual(updates[i - 1].progressPercentage);
    }
  });

  it("5. stops safely on ambiguity (PAUSED_AMBIGUITY) and resumes upon user resolution", async () => {
    // Mismatched meter ID between invoice and CSV
    const mismatchedCsv = `timestamp,meter_id,active_power_kwh
2025-01-01T00:00:00Z,MTR-DIFFERENT-METER-999,120.0`;

    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        invoiceFile: {
          name: "Eskom_Invoice_Jan2025.pdf",
          size: samplePdfBytes.byteLength,
          type: "application/pdf",
          data: samplePdfBytes,
        },
        meterFile: {
          name: "Mismatched_Meter.csv",
          size: mismatchedCsv.length,
          type: "text/csv",
          data: new TextEncoder().encode(mismatchedCsv),
        },
      },
      USER_A_ADMIN,
    );

    // Wait for ambiguity pause
    const pausedStatus = await ProcessingJobEngine.waitForTerminalState(job.jobId);

    expect(pausedStatus.status).toBe("PAUSED_AMBIGUITY");
    expect(pausedStatus.ambiguityReport).toBeDefined();
    expect(pausedStatus.ambiguityReport!.requiresAttention).toBe(true);

    // User provides resolution
    const resumed = await ProcessingJobEngine.resolveJobAmbiguity(
      {
        jobId: job.jobId,
        resolvedMeterId: "MTR-ESKOM-001",
      },
      USER_A_ADMIN,
    );

    expect(resumed.status).toBe("RUNNING");

    // Wait for resumed completion
    const finalStatus = await ProcessingJobEngine.waitForTerminalState(job.jobId);

    expect(finalStatus.status).toBe("COMPLETED");
  });

  it("6. enforces strict tenant isolation on job status queries and resolution", async () => {
    const jobA = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        meterFile: {
          name: "Tenant_A_Data.csv",
          size: sampleCsvContent.length,
          type: "text/csv",
          data: new TextEncoder().encode(sampleCsvContent),
        },
      },
      USER_A_ADMIN,
    );

    // Tenant A can query
    const jobStatusA = await ProcessingJobEngine.getJobStatus(jobA.jobId, USER_A_ADMIN);
    expect(jobStatusA).not.toBeNull();

    // Super Admin can query
    const jobStatusSuper = await ProcessingJobEngine.getJobStatus(jobA.jobId, SUPER_ADMIN);
    expect(jobStatusSuper).not.toBeNull();

    // Tenant B attempt to query Tenant A's job MUST throw TenantIsolationViolationError
    await expect(ProcessingJobEngine.getJobStatus(jobA.jobId, USER_B_ADMIN)).rejects.toThrow(
      TenantIsolationViolationError,
    );

    // Tenant B attempt to resolve Tenant A's job MUST throw TenantIsolationViolationError
    await expect(
      ProcessingJobEngine.resolveJobAmbiguity(
        {
          jobId: jobA.jobId,
          resolvedMeterId: "MTR-HACKED",
        },
        USER_B_ADMIN,
      ),
    ).rejects.toThrow(TenantIsolationViolationError);

    // Tenant B attempt to cancel Tenant A's job MUST throw TenantIsolationViolationError
    await expect(ProcessingJobEngine.cancelJob(jobA.jobId, USER_B_ADMIN)).rejects.toThrow(
      TenantIsolationViolationError,
    );
  });

  it("7. allows cancellation of in-flight jobs", async () => {
    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        meterFile: {
          name: "Cancel_Test.csv",
          size: sampleCsvContent.length,
          type: "text/csv",
          data: new TextEncoder().encode(sampleCsvContent),
        },
      },
      USER_A_ADMIN,
    );

    const cancelled = await ProcessingJobEngine.cancelJob(job.jobId, USER_A_ADMIN);
    expect(cancelled).toBe(true);

    const status = await ProcessingJobEngine.getJobStatus(job.jobId, USER_A_ADMIN);
    expect(status!.status).toBe("CANCELLED");
    expect(status!.stageMessage).toContain("cancelled");
  });

  it("8. complies with Public Disclosure Model Level 3 private zero-exposure rules", async () => {
    const job = await ProcessingJobEngine.submitJob(
      {
        organisationId: TENANT_A,
        meterFile: {
          name: "Disclosure_Audit.csv",
          size: sampleCsvContent.length,
          type: "text/csv",
          data: new TextEncoder().encode(sampleCsvContent),
        },
      },
      USER_A_ADMIN,
    );

    const status = await ProcessingJobEngine.waitForTerminalState(job.jobId);
    expect(status.status).toBe("COMPLETED");

    const serialized = JSON.stringify(status);

    // Embargoed schemas and internal identifiers
    const FORBIDDEN_TOKENS = [
      "public.invoices",
      "public.meter_readings",
      "public.telemetry_intervals",
      "supabase.co",
      "bramhseicmakyihvnvpo",
      "postgres://",
      "service_role",
      "JWT",
      "VITE_SUPABASE_ANON_KEY",
    ];

    for (const token of FORBIDDEN_TOKENS) {
      expect(serialized).not.toContain(token);
    }
  });
});
