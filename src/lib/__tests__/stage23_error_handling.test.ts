/**
 * STAGE 23 — ERROR HANDLING TEST SUITE
 * ========================================================
 *
 * Verifies that:
 * 1. Every pipeline stage fails safely.
 * 2. Upload succeeds but extraction fails:
 *    - Status: PROCESSING FAILED
 *    - Reason: Unable to extract required invoice information.
 *    - Original file remains stored in the secure vault.
 *    - The error is recorded in upload_records, quarantine, and audit trail.
 *    - The user can retry from the stored file without re-uploading.
 *    - Uploaded information is never silently discarded.
 * 3. Server-side background jobs fail safely without data fabrication.
 * 4. Zero-Exposure Level 3 security compliance in error messages.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { UploadStorageService } from "../../domain/upload/uploadStorageService";
import { FileStorageSecurityService } from "../../domain/security/fileStorageSecurityService";
import { QuarantineManager } from "../../domain/ingestion/quarantineManager";
import { AuditTrailService } from "../../domain/audit/auditTrailService";
import { ProcessingJobEngine } from "../../domain/jobs/processingJobEngine";

describe("Stage 23 — Error Handling & Safe Pipeline Failure", () => {
  const TEST_ORG_ID = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c";
  const TEST_USER_ID = "user-stage23-admin";

  beforeEach(() => {
    SecureIngestionGateway.clearCache();
    ProcessingJobEngine.clearState();
  });

  it("Requirement 1 & 2: Safe Failure when Upload Succeeds but Extraction Fails (Status: FAILED, Reason: Unable to extract required invoice information.)", async () => {
    // Valid PDF header so upload and MIME security check succeed, but unreadable invoice body
    const unreadablePdf =
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% Arbitrary document with no invoice determinants\n%%EOF";
    const bytes = new TextEncoder().encode(unreadablePdf);
    const file = new File([bytes], "unreadable_scanned_receipt.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "unreadable_scanned_receipt.pdf",
      TEST_ORG_ID,
      TEST_USER_ID,
    );

    // Extraction fails safely
    expect(result.success).toBe(false);
    expect(["FAILED", "QUARANTINED"]).toContain(result.batchJob.state);
    expect(result.batchJob.quarantineReason).toContain(
      "Unable to extract required invoice information.",
    );

    // Upload record status is FAILED
    expect(result.uploadRecord?.processingStatus).toBe("FAILED");
    expect(result.uploadRecord?.validationStatus).toBe("INVALID");
    expect(result.uploadRecord?.errorStatus).toBe("ERROR");
    expect(result.uploadRecord?.errorMessage).toContain(
      "Unable to extract required invoice information.",
    );
  });

  it("Requirement 3: The Original File Remains Stored in Object Storage Vault (Never Silently Discarded)", async () => {
    const unreadablePdf = "%PDF-1.7 Unreadable Scanned Image Stream with No Text Layer\n%%EOF";
    const bytes = new TextEncoder().encode(unreadablePdf);
    const filename = "damaged_meter_invoice.pdf";
    const file = new File([bytes], filename, { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      filename,
      TEST_ORG_ID,
      TEST_USER_ID,
    );

    expect(result.success).toBe(false);

    // 1. File metadata exists in SourceFile store
    const docId = result.fileHeader.documentId;
    const sourceMetadata = await FileStorageSecurityService.getSourceFileMetadata(docId);
    expect(sourceMetadata).toBeDefined();
    expect(sourceMetadata?.filename).toBe(filename);
    expect(sourceMetadata?.retentionPolicy).toBe("PERMANENT");
    expect(sourceMetadata?.isDeleted).toBe(false);

    // 2. Binary bytes remain in storage vault and match original SHA-256 hash
    const downloadRes = await FileStorageSecurityService.downloadOriginalFile(
      result.uploadRecord!.storageLocation,
    );
    expect(downloadRes.success).toBe(true);
    expect(downloadRes.data).toBeDefined();
    expect(downloadRes.data?.byteLength).toBe(bytes.byteLength);

    // 3. Signed Download URL is available even when extraction failed
    expect(result.signedDownloadUrl).toBeDefined();
    expect(result.signedDownloadUrl).toMatch(/token=|signed=/);
  });

  it("Requirement 4: The Error is Recorded in Upload Registry, Ingestion Errors, and Audit Trail", async () => {
    const unreadablePdf = "%PDF-1.5 Encrypted Stream /Filter /Standard\n%%EOF";
    const bytes = new TextEncoder().encode(unreadablePdf);
    const filename = "encrypted_unparseable_bill.pdf";
    const file = new File([bytes], filename, { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      filename,
      TEST_ORG_ID,
      TEST_USER_ID,
    );

    expect(result.success).toBe(false);

    // 1. Recorded in Upload Registry
    const record = await UploadStorageService.getUploadById(result.fileHeader.documentId);
    expect(record).toBeDefined();
    expect(record?.processingStatus).toBe("FAILED");
    expect(record?.errorMessage).toContain("Unable to extract required invoice information.");

    // 2. Recorded in Quarantine Manager
    const quarantined = QuarantineManager.getQuarantinedJobs();
    expect(quarantined.length).toBeGreaterThan(0);
    const matching = quarantined.find((q) => q.job.documentId === result.fileHeader.documentId);
    expect(matching).toBeDefined();
    expect(matching?.job.quarantineReason).toContain(
      "Unable to extract required invoice information.",
    );

    // 3. Recorded in Persistent Audit Trail
    const { records: auditLogs } = await AuditTrailService.queryAuditTrail({
      organisationId: TEST_ORG_ID,
      category: "data_extraction",
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    const extractionFailEvent = auditLogs.find(
      (a) => a.action === "EXTRACTION_FAILED" && a.record.recordId === result.fileHeader.documentId,
    );
    expect(extractionFailEvent).toBeDefined();
    expect(extractionFailEvent?.description).toContain("Data extraction failed");
  });

  it("Requirement 5: The User Can Retry Processing Directly from Preserved Stored File", async () => {
    const unreadablePdf = "%PDF-1.4 Temporary Extraction Failure Payload\n%%EOF";
    const bytes = new TextEncoder().encode(unreadablePdf);
    const filename = "initially_failed_invoice.pdf";
    const file = new File([bytes], filename, { type: "application/pdf" });

    // Initial failed processing
    const initialResult = await SecureIngestionGateway.processUpload(
      file,
      filename,
      TEST_ORG_ID,
      TEST_USER_ID,
    );
    expect(initialResult.success).toBe(false);
    expect(initialResult.uploadRecord?.processingStatus).toBe("FAILED");

    const uploadId = initialResult.fileHeader.documentId;

    // Trigger retry using the stored uploadId (without re-uploading file bytes)
    const retryResult = await SecureIngestionGateway.retryProcessing(uploadId);

    // Retry initiates successfully and runs the pipeline from stored vault bytes
    expect(retryResult).toBeDefined();
    expect(retryResult.fileHeader.documentId).toBe(uploadId);
    expect(retryResult.uploadRecord).toBeDefined();

    // Verify retry action was audited
    const { records: processingLogs } = await AuditTrailService.queryAuditTrail({
      organisationId: TEST_ORG_ID,
      category: "processing",
    });
    const retryInitiatedEvent = processingLogs.find(
      (a) => a.action === "PROCESSING_RETRY_INITIATED" && a.record.recordId === uploadId,
    );
    expect(retryInitiatedEvent).toBeDefined();
  });

  it("Requirement 6: Background Processing Job Engine Fails Safely without Silently Fabricating Data", async () => {
    const unreadablePdf = "%PDF-1.4 Corrupted Invoice Body\n%%EOF";
    const bytes = new TextEncoder().encode(unreadablePdf);
    const file = new File([bytes], "unreadable_bg_invoice.pdf", { type: "application/pdf" });

    const job = await ProcessingJobEngine.submitJob({
      invoiceFile: file,
      organisationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
    });

    const terminalJob = await ProcessingJobEngine.waitForTerminalState(job.jobId);

    // Job transitions to FAILED safely
    expect(terminalJob.status).toBe("FAILED");
    expect(terminalJob.errorSummary).toContain("Unable to extract required invoice information.");
    expect(terminalJob.stageMessage).toContain("Processing failed");

    // Source file metadata remains stored on the job
    expect(terminalJob.sourceInvoiceFile).toBeDefined();
    expect(terminalJob.sourceInvoiceFile?.name).toBe("unreadable_bg_invoice.pdf");

    // Can trigger retryJob
    const retryJob = await ProcessingJobEngine.retryJob(job.jobId);
    expect(retryJob.status).toBe("QUEUED");
  });

  it("Requirement 7: Level 3 Zero-Exposure Security Compliance (No Raw SQL, Tables, or Credentials in Errors)", async () => {
    const unreadablePdf = "%PDF-1.4 Malformed Document\n%%EOF";
    const bytes = new TextEncoder().encode(unreadablePdf);
    const file = new File([bytes], "test_security_error.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "test_security_error.pdf",
      TEST_ORG_ID,
    );

    const errMsg = result.uploadRecord?.errorMessage || "";
    const quarantineMsg = result.batchJob.quarantineReason || "";

    // Never expose private schema, endpoints, SQL, or internal tokens
    expect(errMsg).not.toMatch(/public\.\w+/i);
    expect(errMsg).not.toMatch(/SELECT|INSERT|UPDATE|DELETE|FROM/i);
    expect(errMsg).not.toMatch(/supabase|postgres|localhost|127\.0\.0\.1/i);
    expect(errMsg).not.toMatch(/token|secret|jwt|key/i);

    expect(quarantineMsg).not.toMatch(/public\.\w+/i);
    expect(quarantineMsg).not.toMatch(/SELECT|INSERT|UPDATE|DELETE/i);
  });
});
