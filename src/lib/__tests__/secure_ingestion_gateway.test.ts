// @ts-expect-error vitest types imported dynamically
import { describe, expect, it, beforeEach } from "vitest";
import { SecureIngestionGateway } from "../../domain/ingestion/secureIngestionGateway";
import { MimeInspector } from "../../domain/ingestion/mimeInspector";
import { QuarantineManager } from "../../domain/ingestion/quarantineManager";
import { SignedUrlService } from "../../domain/ingestion/signedUrlService";

describe("Enterprise Secure Document & Telemetry Ingestion Gateway Suite", () => {
  beforeEach(() => {
    SecureIngestionGateway.clearCache();
  });

  it("Scenario 1: Valid Digital PDF Invoice Ingestion", async () => {
    const pdfBytes = new TextEncoder().encode(
      "%PDF-1.7 Valid Eskom Megaflex Invoice Sample Payload",
    );
    const file = new File([pdfBytes], "Impala_March_2026.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(file, "Impala_March_2026.pdf");

    expect(result.success).toBe(true);
    expect(result.fileHeader.fileExtension).toBe("pdf");
    expect(result.fileHeader.detectedMimeType).toBe("application/pdf");
    expect(result.batchJob.state).toBe("READY");
    expect(result.extractedInvoice).toBeDefined();
    expect(result.extractedInvoice?.accountNumber).toBe("7856504676");
    expect(result.extractedInvoice?.totalInvoice).toBeGreaterThan(0);
    expect(result.signedDownloadUrl).toBeDefined();
  });

  it("Scenario 2: Scanned PDF Invoice with OCR Fallback Detection", async () => {
    const pdfBytes = new TextEncoder().encode("%PDF-1.4 Scanned Image Stream /Image /Type /Page");
    const file = new File([pdfBytes], "Scanned_Eskom_Bill.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(file, "Scanned_Eskom_Bill.pdf");

    expect(result.success).toBe(true);
    expect(result.fileHeader.detectedMimeType).toBe("application/pdf");
    expect(result.confidenceScore).toBeGreaterThan(0);
  });

  it("Scenario 3: Malformed / Corrupt PDF (Quarantined)", async () => {
    const corruptBytes = new TextEncoder().encode("CORRUPT_NOT_A_PDF_STREAM_12345");
    const file = new File([corruptBytes], "Corrupt_Invoice.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(file, "Corrupt_Invoice.pdf");

    expect(result.success).toBe(false);
    expect(result.batchJob.state).toBe("QUARANTINED");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(QuarantineManager.getQuarantinedJobs().length).toBeGreaterThan(0);
  });

  it("Scenario 4: Duplicate PDF Upload (SHA-256 Idempotency Guarantee)", async () => {
    const pdfBytes = new TextEncoder().encode(
      "%PDF-1.7 Unique Eskom Document Content For Idempotency Test",
    );
    const file1 = new File([pdfBytes], "Invoice_Duplicate.pdf", { type: "application/pdf" });
    const file2 = new File([pdfBytes], "Invoice_Duplicate.pdf", { type: "application/pdf" });

    const res1 = await SecureIngestionGateway.processUpload(file1, "Invoice_Duplicate.pdf");
    const res2 = await SecureIngestionGateway.processUpload(file2, "Invoice_Duplicate.pdf");

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res2.isIdempotentDuplicate).toBe(true);
    expect(res2.fileHeader.sha256Checksum).toBe(res1.fileHeader.sha256Checksum);
  });

  it("Scenario 5: Invalid MIME Type / Spoofed Extension Rejection", async () => {
    const exeBytes = new TextEncoder().encode(
      "MZ\x90\x00\x03\x00\x00\x00 Executable Binary Header",
    );
    const file = new File([exeBytes], "malicious_script.pdf", { type: "application/pdf" });

    const result = await SecureIngestionGateway.processUpload(file, "malicious_script.pdf");

    expect(result.success).toBe(false);
    expect(result.batchJob.state).toBe("QUARANTINED");
    expect(result.errors[0].errorCode).toBe("INVALID_MIME_SIGNATURE");
  });

  it("Scenario 6: Oversized File Rejection (>50MB)", async () => {
    const largeFile = {
      size: 55 * 1024 * 1024,
      slice: () => new Blob([new Uint8Array(100)]),
    } as any;

    const mimeRes = await MimeInspector.inspectFile(largeFile, "huge_file.pdf");

    expect(mimeRes.isValid).toBe(false);
    expect(mimeRes.errorMessage).toContain("exceeds maximum limit of 50MB");
  });

  it("Scenario 7: AMR Telemetry CSV Stream Ingestion", async () => {
    const csvContent = "Timestamp,kW,kVA,kVAR,PF,TOU\n2026-03-04T10:00:00Z,1000,1020,200,0.98,peak";
    const csvBytes = new TextEncoder().encode(csvContent);
    const file = new File([csvBytes], "meter_intervals.csv", { type: "text/csv" });

    const result = await SecureIngestionGateway.processUpload(file, "meter_intervals.csv");

    expect(result.success).toBe(true);
    expect(result.batchJob.documentType).toBe("AMR_TELEMETRY_CSV");
    expect(result.batchJob.state).toBe("READY");
  });

  it("Scenario 8: AMR Telemetry XLSX Spreadsheet Ingestion", async () => {
    const xlsxMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const file = new File([xlsxMagic], "meter_workbook.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const result = await SecureIngestionGateway.processUpload(file, "meter_workbook.xlsx");

    expect(result.success).toBe(true);
    expect(result.batchJob.documentType).toBe("AMR_TELEMETRY_XLSX");
  });

  it("Scenario 9: Telemetry XML Feed Ingestion", async () => {
    const xmlContent = `<?xml version="1.0"?>
    <EskomTelemetryFeed>
      <AccountNumber>7856504676</AccountNumber>
      <TotalKwh>51680000</TotalKwh>
      <TotalInvoice>98380358.13</TotalInvoice>
    </EskomTelemetryFeed>`;
    const xmlBytes = new TextEncoder().encode(xmlContent);
    const file = new File([xmlBytes], "feed.xml", { type: "application/xml" });

    const result = await SecureIngestionGateway.processUpload(file, "feed.xml");

    expect(result.success).toBe(true);
    expect(result.batchJob.documentType).toBe("TELEMETRY_XML");
    expect(result.extractedInvoice?.accountNumber).toBe("7856504676");
  });

  it("Scenario 10: Private Signed Download URL Generation", async () => {
    const signedRes = await SignedUrlService.getSignedDownloadUrl(
      "private/org-123/doc-456/sample.pdf",
    );

    expect(signedRes.signedUrl).toBeDefined();
    expect(signedRes.signedUrl).toContain("sample.pdf");
  });
});
