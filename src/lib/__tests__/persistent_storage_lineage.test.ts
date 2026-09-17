/**
 * Stage 7 — Persistent Object Storage, Non-Destruction & 6-Tier Lineage Test Suite
 *
 * Verifies:
 *  1. Persistent Object Storage of original files (never transient/localStorage/FileReader)
 *  2. Retrieval and cryptographic SHA-256 integrity check of stored original files
 *  3. Strict Tenant Isolation on Object Storage access (cross-tenant download blocked)
 *  4. Non-Destruction Guarantee (original files never destroyed after processing)
 *  5. Statutory Retention Policy evaluation & deletion safeguards (PERMANENT, 7_YEARS_STATUTORY)
 *  6. Canonical 6-Tier Data Lineage Graph:
 *       ORGANISATION -> UPLOAD -> STORED FILE -> EXTRACTED DATA -> ANALYSIS -> RESULTS
 *  7. Cross-tenant access rejection on Lineage queries
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { FileStorageSecurityService } from "../../domain/security/fileStorageSecurityService";
import { LineageTrackingService } from "../../domain/lineage/lineageTrackingService";
import { ReconciliationStorageService } from "../../domain/reconciliation/reconciliationStorageService";
import { TenantIsolationViolationError } from "../../domain/security/tenantContextService";
import type { UserSecurityContext } from "../../domain/security/types";

describe("Stage 7: Persistent Storage, Retention Policies & 6-Tier Lineage", () => {
  const TENANT_A = "11111111-1111-1111-1111-111111111111";
  const TENANT_B = "22222222-2222-2222-2222-222222222222";

  const USER_A_ADMIN: UserSecurityContext = {
    userId: "usr-admin-a",
    organisationId: TENANT_A,
    role: "ADMIN",
  };

  const USER_A_VIEWER: UserSecurityContext = {
    userId: "usr-viewer-a",
    organisationId: TENANT_A,
    role: "VIEWER",
  };

  const USER_B_ADMIN: UserSecurityContext = {
    userId: "usr-admin-b",
    organisationId: TENANT_B,
    role: "ADMIN",
  };

  const SUPER_ADMIN: UserSecurityContext = {
    userId: "usr-super",
    organisationId: "super-org",
    role: "SUPER_ADMIN",
  };

  beforeEach(() => {
    SecureIngestionGateway.clearCache();
  });

  const generateMockPdfBytes = (content: string): Uint8Array => {
    const header = "%PDF-1.7\n";
    const body = `1 0 obj\n<< /Type /Catalog >>\nendobj\nstream\n${content}\nendstream\n%%EOF\n`;
    return new TextEncoder().encode(header + body);
  };

  it("1. stores original file bytes persistently in object storage upon upload", async () => {
    const rawContent =
      "ACCOUNT: 0123456789\nTOTAL: R 85,250.00\nESKOM INVOICE\n2025-01-01 to 2025-01-31";
    const bytes = generateMockPdfBytes(rawContent);
    const filename = "eskom_invoice_jan2025.pdf";

    const result = await SecureIngestionGateway.processUpload(
      bytes,
      filename,
      TENANT_A,
      USER_A_ADMIN.userId,
      undefined,
      USER_A_ADMIN,
    );

    expect(result.success).toBe(true);
    expect(result.uploadRecord).toBeDefined();

    const uploadId = result.uploadRecord.id;
    const storageLocation = result.uploadRecord.storageLocation;

    // Verify storage path structure: tenants/{organisation_id}/uploads/{upload_id}/{sanitized_filename}
    expect(storageLocation).toContain(`tenants/${TENANT_A}/uploads/${uploadId}/`);

    // Verify original file can be downloaded directly from object storage
    const downloadRes = await FileStorageSecurityService.downloadOriginalFile(
      storageLocation,
      USER_A_ADMIN,
    );

    expect(downloadRes.success).toBe(true);
    expect(downloadRes.data).toBeDefined();
    expect(downloadRes.data!.byteLength).toBe(bytes.byteLength);

    // Cryptographic SHA-256 integrity verification
    const downloadedHash = await SecureIngestionGateway.computeSha256(downloadRes.data!);
    expect(downloadedHash).toBe(result.fileHeader.sha256Checksum);
  });

  it("2. enforces strict tenant isolation on object storage download", async () => {
    const bytes = generateMockPdfBytes("CONFIDENTIAL TENANT A UTILITY DATA");
    const filename = "tenant_a_confidential.pdf";

    const result = await SecureIngestionGateway.processUpload(
      bytes,
      filename,
      TENANT_A,
      USER_A_ADMIN.userId,
      undefined,
      USER_A_ADMIN,
    );

    const storageLocation = result.uploadRecord.storageLocation;

    // Tenant A admin can download
    const allowed = await FileStorageSecurityService.downloadOriginalFile(
      storageLocation,
      USER_A_ADMIN,
    );
    expect(allowed.success).toBe(true);

    // Super Admin can download
    const superAllowed = await FileStorageSecurityService.downloadOriginalFile(
      storageLocation,
      SUPER_ADMIN,
    );
    expect(superAllowed.success).toBe(true);

    // Tenant B attempt MUST throw TenantIsolationViolationError
    await expect(
      FileStorageSecurityService.downloadOriginalFile(storageLocation, USER_B_ADMIN),
    ).rejects.toThrow(TenantIsolationViolationError);
  });

  it("3. guarantees original files are NEVER destroyed after processing completes (Non-Destruction Guarantee)", async () => {
    const bytes = generateMockPdfBytes("ESKOM RECONCILIATION AUDIT ARCHIVE");
    const filename = "Impala_March_2026.pdf";

    const result = await SecureIngestionGateway.processUpload(
      bytes,
      filename,
      TENANT_A,
      USER_A_ADMIN.userId,
      undefined,
      USER_A_ADMIN,
    );

    expect(["PROCESSED", "PARTIALLY_PROCESSED"]).toContain(result.uploadRecord.processingStatus);

    // Retrieve Source File metadata
    const sourceFile = await FileStorageSecurityService.getSourceFileByUploadId(
      result.uploadRecord.id,
      USER_A_ADMIN,
    );

    expect(sourceFile).toBeDefined();
    expect(sourceFile!.retentionPolicy).toBe("PERMANENT");
    expect(sourceFile!.isDeleted).toBe(false);
    expect(sourceFile!.storageBucket).toBe("source_files");

    // Verify original file is still accessible and intact in object storage
    const dl = await FileStorageSecurityService.downloadOriginalFile(
      sourceFile!.storagePath,
      USER_A_ADMIN,
    );
    expect(dl.success).toBe(true);
    expect(dl.data!.byteLength).toBe(bytes.byteLength);
  });

  it("4. rejects destruction of files protected by statutory PERMANENT retention policy", async () => {
    const bytes = generateMockPdfBytes("STATUTORY PERMANENT FILE RECORD");
    const filename = "statutory_record.pdf";

    const result = await SecureIngestionGateway.processUpload(
      bytes,
      filename,
      TENANT_A,
      USER_A_ADMIN.userId,
      undefined,
      USER_A_ADMIN,
    );

    const sourceFileId = result.uploadRecord.id;

    // Attempting deletion under PERMANENT policy must fail
    const delResult = await FileStorageSecurityService.deleteOriginalFile(
      sourceFileId,
      USER_A_ADMIN,
      "Routine cleanup request",
    );

    expect(delResult.success).toBe(false);
    expect(delResult.error).toContain("Statutory permanent retention policy active");

    // File remains intact in storage
    const sourceFile = await FileStorageSecurityService.getSourceFileMetadata(
      sourceFileId,
      USER_A_ADMIN,
    );
    expect(sourceFile!.isDeleted).toBe(false);
  });

  it("5. evaluates explicit time-bound statutory retention policies (7_YEARS_STATUTORY & 30_DAYS)", async () => {
    // 5a. Active 7-Year Statutory Policy (Future Date)
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5).toISOString(); // 5 years left
    const activeEval = FileStorageSecurityService.evaluateRetentionPolicy({
      retentionPolicy: "7_YEARS_STATUTORY",
      retentionUntil: futureDate,
    });
    expect(activeEval.canDelete).toBe(false);
    expect(activeEval.reason).toContain("Retention period active");

    // 5b. Expired Retention Policy (Past Date)
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // Expired yesterday
    const expiredEval = FileStorageSecurityService.evaluateRetentionPolicy({
      retentionPolicy: "30_DAYS",
      retentionUntil: pastDate,
    });
    expect(expiredEval.canDelete).toBe(true);
    expect(expiredEval.reason).toContain("Retention period expired");

    // 5c. Authorized deletion of expired file by Admin with statutory reason
    const testFileId = "source-expired-test-01";
    const testStoragePath = FileStorageSecurityService.buildStoragePath(
      TENANT_A,
      testFileId,
      "temp_interval_export.csv",
    );

    await FileStorageSecurityService.uploadOriginalFile(
      testStoragePath,
      new TextEncoder().encode("time,kw\n2025-01-01,100"),
      "text/csv",
      USER_A_ADMIN,
    );

    FileStorageSecurityService.registerSourceFileMetadata({
      id: testFileId,
      organisationId: TENANT_A,
      uploadId: testFileId,
      filename: "temp_interval_export.csv",
      fileSizeBytes: 24,
      mimeType: "text/csv",
      storageBucket: FileStorageSecurityService.BUCKET_NAME,
      storagePath: testStoragePath,
      fileHashSha256: "dummy-hash",
      retentionPolicy: "30_DAYS",
      retentionUntil: pastDate,
      isArchived: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      status: "parsed",
    });

    // Viewer cannot delete
    const viewerDel = await FileStorageSecurityService.deleteOriginalFile(
      testFileId,
      USER_A_VIEWER,
      "Statutory expiration purge",
    );
    expect(viewerDel.success).toBe(false);
    expect(viewerDel.error).toContain("Unauthorized");

    // Admin can delete expired file
    const adminDel = await FileStorageSecurityService.deleteOriginalFile(
      testFileId,
      USER_A_ADMIN,
      "Statutory expiration purge approved under corporate compliance rule #44",
    );
    expect(adminDel.success).toBe(true);

    const deletedRecord = await FileStorageSecurityService.getSourceFileMetadata(
      testFileId,
      USER_A_ADMIN,
    );
    expect(deletedRecord!.isDeleted).toBe(true);
    expect(deletedRecord!.deletedAt).toBeDefined();
    expect(deletedRecord!.deletionReason).toContain("rule #44");
  });

  it("6. validates and traces the complete 6-tier relationship chain: ORGANISATION -> UPLOAD -> STORED FILE -> EXTRACTED DATA -> ANALYSIS -> RESULTS", async () => {
    // Step 1: Upload and Ingestion (Creates Tier 1, Tier 2, Tier 3, Tier 4)
    const bytes = generateMockPdfBytes("Impala March 2026 Eskom Megaflex Tax Invoice");
    const filename = "Impala_March_2026.pdf";

    const uploadRes = await SecureIngestionGateway.processUpload(
      bytes,
      filename,
      TENANT_A,
      USER_A_ADMIN.userId,
      undefined,
      USER_A_ADMIN,
    );

    expect(uploadRes.success).toBe(true);
    const uploadId = uploadRes.uploadRecord.id;

    // Step 2: Perform Reconciliation (Creates Tier 5: ANALYSIS & Tier 6: RESULTS)
    const runId = `RUN-STAGE7-${Date.now()}`;
    const invoiceNum = uploadRes.extractedInvoice?.accountNumber || "7856504676";
    const billedTotal = uploadRes.extractedInvoice?.totalInvoice || 15462529.74;

    await ReconciliationStorageService.saveRun(
      {
        run_id: runId,
        tenant_id: TENANT_A,
        organisation_id: TENANT_A,
        upload_id: uploadId,
        invoice_id: invoiceNum,
        status: "COMPLETED",
        billed_total: billedTotal,
        expected_total_zar: billedTotal,
        total_variance_zar: 0,
        variance_percentage: 0,
        comparisons: [
          {
            component_code: "ENERGY_PEAK",
            component_name: "Peak Active Energy",
            billed_value: 50000,
            calculated_value: 50000,
            variance_value: 0,
            percentage_variance: 0,
            unit: "kWh",
            status: "PASS",
          },
        ],
      },
      USER_A_ADMIN,
    );

    // Step 3: Query Canonical 6-Tier Lineage Graph
    const lineage = await LineageTrackingService.getLineageForUpload(uploadId, USER_A_ADMIN);

    expect(lineage).not.toBeNull();

    // Tier 1: ORGANISATION
    expect(lineage!.organisation.organisationId).toBe(TENANT_A);

    // Tier 2: UPLOAD
    expect(lineage!.upload.uploadId).toBe(uploadId);
    expect(lineage!.upload.filename).toBe(filename);
    expect(lineage!.upload.fileType).toBe("PDF_INVOICE");

    // Tier 3: STORED FILE
    expect(lineage!.storedFile.sourceFileId).toBe(uploadId);
    expect(lineage!.storedFile.storageBucket).toBe("source_files");
    expect(lineage!.storedFile.retentionPolicy).toBe("PERMANENT");
    expect(lineage!.storedFile.isDeleted).toBe(false);

    // Tier 4: EXTRACTED DATA
    expect(lineage!.extractedData).toBeDefined();
    expect(lineage!.extractedData!.accountNumber).toBe("7856504676");
    expect(lineage!.extractedData!.invoicedTotal).toBe(billedTotal);

    // Tier 5: ANALYSIS
    expect(lineage!.analysis).toBeDefined();
    expect(lineage!.analysis!.reconciliationRunId).toBe(runId);
    expect(lineage!.analysis!.status).toBe("COMPLETED");

    // Tier 6: RESULTS
    expect(lineage!.results).toBeDefined();
    expect(lineage!.results!.totalInvoiced).toBe(billedTotal);
    expect(lineage!.results!.totalReconciled).toBe(billedTotal);
    expect(lineage!.results!.variance).toBe(0);
    expect(lineage!.results!.status).toBe("PASS");

    // Full 6-Tier Chain Complete
    expect(lineage!.lineageChainComplete).toBe(true);

    // Step 4: Reverse Traceability from Invoice Record ID
    const reverseLineage = await LineageTrackingService.getLineageForInvoice(
      invoiceNum,
      USER_A_ADMIN,
    );
    expect(reverseLineage).not.toBeNull();
    expect(reverseLineage!.upload.uploadId).toBe(uploadId);
    expect(reverseLineage!.storedFile.sourceFileId).toBe(uploadId);

    // Step 5: Reverse Traceability from Reconciliation Run ID
    const runLineage = await LineageTrackingService.getLineageForReconciliation(
      runId,
      USER_A_ADMIN,
    );
    expect(runLineage).not.toBeNull();
    expect(runLineage!.upload.uploadId).toBe(uploadId);
    expect(runLineage!.analysis!.reconciliationRunId).toBe(runId);
  });

  it("7. blocks cross-tenant access to lineage tracking graphs", async () => {
    const bytes = generateMockPdfBytes("TENANT A PRIVATE LINEAGE RECORD");
    const filename = "tenant_a_lineage.pdf";

    const uploadRes = await SecureIngestionGateway.processUpload(
      bytes,
      filename,
      TENANT_A,
      USER_A_ADMIN.userId,
      undefined,
      USER_A_ADMIN,
    );

    const uploadId = uploadRes.uploadRecord.id;

    // Tenant A can query lineage
    const allowed = await LineageTrackingService.getLineageForUpload(uploadId, USER_A_ADMIN);
    expect(allowed).not.toBeNull();

    // Tenant B attempt to query Tenant A's lineage MUST throw TenantIsolationViolationError
    await expect(
      LineageTrackingService.getLineageForUpload(uploadId, USER_B_ADMIN),
    ).rejects.toThrow(TenantIsolationViolationError);
  });
});
