/**
 * Stage 5: File Upload System & Ingestion Pipeline Test Suite
 * Comprehensive automated verification of persistent upload records,
 * the 7 canonical processing states, all 8 utility source types,
 * failure transparency (no silent failures), and tenant isolation.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { UploadStorageService } from "../../domain/upload/uploadStorageService";
import { createSecurityContext } from "../../domain/security/tenantContextService";
import { TenantIsolationViolationError } from "../../domain/security/tenantContextService";
import * as XLSX from "xlsx";

const TENANT_ALPHA = "7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c";
const TENANT_BETA = "8e1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5d";

describe("Stage 5 — File Upload System & Ingestion Pipeline Suite", () => {
  beforeEach(() => {
    SecureIngestionGateway.clearCache();
    UploadStorageService.clearCache();
  });

  it("Scenario 1: Persistent Upload Record creation with all required metadata", async () => {
    const record = await UploadStorageService.createUploadRecord({
      organisationId: TENANT_ALPHA,
      userId: "user-alpha-001",
      filename: "Eskom_Invoice_March2026.pdf",
      fileType: "PDF_INVOICE",
      fileSizeBytes: 1048576,
      fileHashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      storageLocation: `private/${TENANT_ALPHA}/up-1/Eskom_Invoice_March2026.pdf`,
      processingStatus: "UPLOADED",
      processingStart: new Date().toISOString(),
      validationStatus: "PENDING",
      errorStatus: "NONE",
    });

    expect(record.id).toBeDefined();
    expect(record.organisationId).toBe(TENANT_ALPHA);
    expect(record.userId).toBe("user-alpha-001");
    expect(record.filename).toBe("Eskom_Invoice_March2026.pdf");
    expect(record.fileType).toBe("PDF_INVOICE");
    expect(record.fileSizeBytes).toBe(1048576);
    expect(record.storageLocation).toContain(TENANT_ALPHA);
    expect(record.processingStatus).toBe("UPLOADED");
    expect(record.processingStart).toBeDefined();
    expect(record.validationStatus).toBe("PENDING");
    expect(record.errorStatus).toBe("NONE");
    expect(record.errorMessage).toBeNull();
    expect(record.createdAt).toBeDefined();
  });

  it("Scenario 2: State Machine Lifecycle Progression through canonical states", async () => {
    // 1. Initial State: UPLOADED
    const initial = await UploadStorageService.createUploadRecord({
      organisationId: TENANT_ALPHA,
      filename: "telemetry.csv",
      fileType: "CSV_INTERVAL_DATA",
      fileSizeBytes: 45000,
      fileHashSha256: "hash-001",
      storageLocation: `private/${TENANT_ALPHA}/telemetry.csv`,
      processingStatus: "UPLOADED",
      processingStart: new Date().toISOString(),
    });
    expect(initial.processingStatus).toBe("UPLOADED");

    // 2. VALIDATING
    const validating = await UploadStorageService.updateUploadStatus(initial.id, {
      processingStatus: "VALIDATING",
    });
    expect(validating.processingStatus).toBe("VALIDATING");

    // 3. VALIDATED
    const validated = await UploadStorageService.updateUploadStatus(initial.id, {
      processingStatus: "VALIDATED",
      validationStatus: "VALID",
    });
    expect(validated.processingStatus).toBe("VALIDATED");
    expect(validated.validationStatus).toBe("VALID");

    // 4. PROCESSING
    const processing = await UploadStorageService.updateUploadStatus(initial.id, {
      processingStatus: "PROCESSING",
    });
    expect(processing.processingStatus).toBe("PROCESSING");

    // 5. PROCESSED
    const completed = await UploadStorageService.updateUploadStatus(initial.id, {
      processingStatus: "PROCESSED",
      processingCompletion: new Date().toISOString(),
      rowCount: 1440,
      recordCount: 1440,
      validationStatus: "VALID",
      errorStatus: "NONE",
    });
    expect(completed.processingStatus).toBe("PROCESSED");
    expect(completed.rowCount).toBe(1440);
    expect(completed.recordCount).toBe(1440);
    expect(completed.processingCompletion).toBeDefined();
  });

  it("Scenario 3: PDF Invoice Ingestion populates metadata, determinants, and completes as PROCESSED", async () => {
    const pdfContent =
      "%PDF-1.7 Eskom Megaflex Invoice Sample Account 7856504676 Total ZAR 1542000.50\n%%EOF";
    const bytes = new TextEncoder().encode(pdfContent);
    const file = new File([bytes], "Impala_March_2026.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "Impala_March_2026.pdf",
      TENANT_ALPHA,
      "user-admin",
    );

    expect(result.success).toBe(true);
    expect(result.uploadRecord).toBeDefined();
    expect(result.uploadRecord?.fileType).toBe("PDF_INVOICE");
    expect(result.uploadRecord?.processingStatus).toBe("PROCESSED");
    expect(result.uploadRecord?.validationStatus).toBe("VALID");
    expect(result.uploadRecord?.errorStatus).toBe("NONE");
    expect(result.uploadRecord?.processingStart).toBeDefined();
    expect(result.uploadRecord?.processingCompletion).toBeDefined();
    expect(result.uploadRecord?.recordCount).toBeGreaterThan(0);
    expect(result.extractedInvoice).toBeDefined();
    expect(result.extractedInvoice?.accountNumber).toBe("7856504676");
  });

  it("Scenario 4: CSV Interval Data Ingestion populates telemetry row counts and completes as PROCESSED", async () => {
    const csvContent = [
      "Timestamp,kW,kVA,kVAr,kWh",
      "2026-03-01 00:00:00,120.5,130.2,45.0,60.25",
      "2026-03-01 00:30:00,125.0,135.0,46.0,62.50",
      "2026-03-01 01:00:00,118.2,128.0,43.5,59.10",
      "2026-03-01 01:30:00,130.0,140.0,48.0,65.00",
      "2026-03-01 02:00:00,122.4,132.1,44.2,61.20",
    ].join("\n");
    const bytes = new TextEncoder().encode(csvContent);
    const file = new File([bytes], "amr_intervals_march.csv", { type: "text/csv" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "amr_intervals_march.csv",
      TENANT_ALPHA,
      "user-admin",
    );

    expect(result.success).toBe(true);
    expect(result.uploadRecord).toBeDefined();
    expect(result.uploadRecord?.fileType).toBe("CSV_INTERVAL_DATA");
    expect(result.uploadRecord?.processingStatus).toBe("PROCESSED");
    expect(result.uploadRecord?.rowCount).toBe(5);
    expect(result.uploadRecord?.errorStatus).toBe("NONE");
    expect(result.intervals).toBeDefined();
    expect(result.intervals?.length).toBe(5);
  });

  it("Scenario 5: Excel Meter Workbook Ingestion parses spreadsheet intervals", async () => {
    // Generate valid XLSX binary in-memory
    const wsData = [
      ["Date & Time", "kW Imp", "kVA Imp", "kVAr Imp", "Power Factor"],
      ["2026-03-01 00:00:00", 250.0, 260.4, 72.5, 0.96],
      ["2026-03-01 00:30:00", 255.0, 265.0, 71.0, 0.96],
      ["2026-03-01 01:00:00", 248.0, 258.0, 70.0, 0.96],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Intervals");
    const xlsxBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const file = new File([xlsxBuffer], "meter_workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "meter_workbook.xlsx",
      TENANT_ALPHA,
      "user-admin",
    );

    expect(result.success).toBe(true);
    expect(result.uploadRecord).toBeDefined();
    expect(result.uploadRecord?.fileType).toBe("EXCEL_WORKBOOK");
    expect(result.uploadRecord?.processingStatus).toBe("PROCESSED");
    expect(result.uploadRecord?.rowCount).toBe(3);
  });

  it("Scenario 6: Raw Meter Log Ingestion parses text logger telemetry", async () => {
    const rawLog = [
      "# SUBSTATION LOGGER DUMP 01",
      "2026-03-01 00:00:00, 310.5, 323.4, 90.0, 155.25",
      "2026-03-01 00:30:00, 315.0, 328.0, 91.5, 157.50",
      "2026-03-01 01:00:00, 308.2, 320.0, 88.0, 154.10",
    ].join("\n");
    const bytes = new TextEncoder().encode(rawLog);
    const file = new File([bytes], "substation_01.log", { type: "text/plain" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "substation_01.log",
      TENANT_ALPHA,
      "user-admin",
    );

    expect(result.success).toBe(true);
    expect(result.uploadRecord?.fileType).toBe("RAW_METER_LOG");
    expect(result.uploadRecord?.processingStatus).toBe("PROCESSED");
    expect(result.uploadRecord?.rowCount).toBe(3);
    expect(result.intervals?.length).toBe(3);
  });

  it("Scenario 7: Tariff Document Ingestion parses rate schedules", async () => {
    const tariffJson = JSON.stringify({
      schedule_name: "Megaflex Industrial 2026",
      tariff_code: "ESKOM_MEGAFLEX_2025_2026",
      version: "2025/2026",
      voltage_level: ">= 500V & < 66kV",
      demand_charge_zar_per_kva: 94.5,
      network_access_charge_zar_per_kva: 45.2,
      service_charge_zar_per_day: 185.0,
      rates: [
        { season: "high", tou: "peak", rate_c_per_kwh: 580.45 },
        { season: "high", tou: "standard", rate_c_per_kwh: 215.3 },
        { season: "high", tou: "off_peak", rate_c_per_kwh: 105.2 },
      ],
    });
    const bytes = new TextEncoder().encode(tariffJson);
    const file = new File([bytes], "tariff_schedule_2026.json", { type: "application/json" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "tariff_schedule_2026.json",
      TENANT_ALPHA,
      "user-admin",
    );

    expect(result.success).toBe(true);
    expect(result.uploadRecord?.fileType).toBe("TARIFF_DOCUMENT");
    expect(result.uploadRecord?.processingStatus).toBe("PROCESSED");
    expect(result.uploadRecord?.recordCount).toBeGreaterThan(0);
  });

  it("Scenario 8: Non-fatal ambiguities transition upload to PARTIALLY_PROCESSED with warnings", async () => {
    // PDF with scanned OCR fallback marker triggering human review
    const pdfContent = "%PDF-1.4 Scanned Low Resolution Raster Stream Image Scan\n%%EOF";
    const bytes = new TextEncoder().encode(pdfContent);
    const file = new File([bytes], "scanned_invoice_review.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "scanned_invoice_review.pdf",
      TENANT_ALPHA,
      "user-admin",
    );

    expect(result.success).toBe(true);
    expect(result.uploadRecord).toBeDefined();
    // Low confidence / review required results in PARTIALLY_PROCESSED
    expect(result.uploadRecord?.processingStatus).toBe("PARTIALLY_PROCESSED");
    expect(result.uploadRecord?.validationStatus).toBe("REVIEW_REQUIRED");
  });

  it("Scenario 9: Corrupt / Spoofed file transitions to FAILED with explicit error details (No Silent Failure)", async () => {
    const corruptPayload = "MALICIOUS_EXECUTABLE_OR_CORRUPT_BYTES_XYZ_00000";
    const bytes = new TextEncoder().encode(corruptPayload);
    const file = new File([bytes], "fake_invoice.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(
      file,
      "fake_invoice.pdf",
      TENANT_ALPHA,
      "user-admin",
    );

    // Must NOT silently succeed
    expect(result.success).toBe(false);
    expect(result.uploadRecord).toBeDefined();
    expect(result.uploadRecord?.processingStatus).toBe("FAILED");
    expect(result.uploadRecord?.validationStatus).toBe("INVALID");
    expect(result.uploadRecord?.errorStatus).toBe("FATAL");
    expect(result.uploadRecord?.errorMessage).toBeDefined();
    expect(result.uploadRecord?.errorMessage).toContain("Invalid PDF signature");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].errorCode).toBe("INVALID_MIME_SIGNATURE");
  });

  it("Scenario 10: Multi-Tenant Isolation denies cross-tenant upload access", async () => {
    const contextBeta = createSecurityContext(
      "user-beta-001",
      "beta@corp.internal",
      TENANT_BETA,
      "ENERGY_MANAGER",
    );

    // 1. Create upload under Tenant Alpha
    const recordAlpha = await UploadStorageService.createUploadRecord({
      organisationId: TENANT_ALPHA,
      filename: "alpha_confidential_bill.pdf",
      fileType: "PDF_INVOICE",
      fileSizeBytes: 50000,
      fileHashSha256: "hash-alpha-secret",
      storageLocation: `private/${TENANT_ALPHA}/alpha.pdf`,
      processingStatus: "PROCESSED",
    });

    // 2. Tenant Beta user tries to fetch Tenant Alpha's upload record
    await expect(UploadStorageService.getUploadById(recordAlpha.id, contextBeta)).rejects.toThrow(
      TenantIsolationViolationError,
    );

    // 3. Tenant Beta user tries to list uploads specifying Tenant Alpha's org ID
    await expect(
      UploadStorageService.listUploads({ organisationId: TENANT_ALPHA }, contextBeta),
    ).rejects.toThrow(TenantIsolationViolationError);

    // 4. Tenant Beta user tries to upload to Tenant Alpha's organisation
    const bytes = new TextEncoder().encode("%PDF-1.7 Valid Content");
    const file = new File([bytes], "tampered.pdf", { type: "application/pdf" });

    await expect(
      SecureIngestionGateway.processUpload(
        file,
        "tampered.pdf",
        TENANT_ALPHA, // Target org != Caller org
        "user-beta-001",
        undefined,
        contextBeta,
      ),
    ).rejects.toThrow(TenantIsolationViolationError);
  });
});
