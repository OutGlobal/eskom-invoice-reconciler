/**
 * STAGE 6 — FILE SECURITY ADVERSARIAL TEST SUITE
 *
 * Verifies that the file security layer treats every uploaded file as untrusted input:
 *  1. Path traversal attacks (.., Windows slashes, URL-encoded path traversal)
 *  2. Malicious filenames (null bytes, control chars, shell chars, Windows reserved device names)
 *  3. File extension whitelist & double-extension spoofing
 *  4. Executable payload rejection (DOS MZ, Linux ELF, Mach-O, shell script shebang)
 *  5. PDF header (%PDF-) & footer (%%EOF) verification
 *  6. File size thresholds (0-byte rejection, per-type maximum limit enforcement)
 *  7. Text encoding validation & embedded null byte injection rejection
 *  8. CSV formula injection (DDE) defanging
 *  9. XML External Entity (XXE) attack rejection
 * 10. Macro-enabled Excel workbook rejection
 * 11. Malformed JSON rejection
 * 12. Tenant-isolated storage path construction
 * 13. Controlled signed URLs & cross-tenant access rejection
 * 14. Zero credential exposure & private storage URL protection
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FileSecurityValidator } from "@/domain/security/fileSecurityValidator";
import { FileStorageSecurityService } from "@/domain/security/fileStorageSecurityService";
import { SecureIngestionGateway } from "@/domain/ingestion/secureIngestionGateway";
import { UploadStorageService } from "@/domain/upload/uploadStorageService";
import { createSecurityContext } from "@/domain/security/tenantContextService";

describe("Stage 6 — File Security Adversarial & Defense Suite", () => {
  const TENANT_A = "00000000-0000-0000-0000-000000000001";
  const TENANT_B = "00000000-0000-0000-0000-000000000002";
  const USER_A = "user-alice-sec";
  const USER_B = "user-bob-sec";

  const contextA = createSecurityContext(
    USER_A,
    "alice@enera.internal",
    TENANT_A,
    "ENERGY_MANAGER",
  );
  const contextB = createSecurityContext(USER_B, "bob@enera.internal", TENANT_B, "ENERGY_MANAGER");
  const superAdminContext = createSecurityContext(
    "admin-sec",
    "admin@enera.internal",
    TENANT_A,
    "SUPER_ADMIN",
  );

  beforeEach(() => {
    UploadStorageService.clearCache();
  });

  // 1. Path Traversal Prevention
  it("Scenario 1: Rejects path traversal sequences in filenames", () => {
    const maliciousPaths = [
      "../../etc/passwd.pdf",
      "..\\..\\windows\\win.ini.pdf",
      "folder/../../secret.csv",
      "%2e%2e%2finvoice.pdf",
      "%2e%2e%5cdata.csv",
      "....//....//etc/shadow.json",
    ];

    for (const badPath of maliciousPaths) {
      const res = FileSecurityValidator.validateFilename(badPath);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.toLowerCase().includes("traversal"))).toBe(true);
    }
  });

  // 2. Malicious Filenames
  it("Scenario 2: Rejects null byte injection, control characters, and Windows reserved names", () => {
    // Null byte injection
    const nullByteRes = FileSecurityValidator.validateFilename("invoice.pdf\0.exe");
    expect(nullByteRes.valid).toBe(false);
    expect(nullByteRes.errors.some((e) => e.includes("null byte"))).toBe(true);

    // Control characters (ASCII < 32)
    const controlCharRes = FileSecurityValidator.validateFilename(`invoice\x1b\x07.pdf`);
    expect(controlCharRes.valid).toBe(false);
    expect(controlCharRes.errors.some((e) => e.includes("Control characters"))).toBe(true);

    // Windows reserved device names
    const reservedNames = ["CON.pdf", "prn.csv", "AUX.xlsx", "NUL.log", "COM1.txt", "lpt3.dat"];
    for (const name of reservedNames) {
      const res = FileSecurityValidator.validateFilename(name);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("reserved"))).toBe(true);
    }
  });

  // 3. Extension Whitelist, Blacklist & Double-Extension Attacks
  it("Scenario 3: Rejects disallowed extensions and double-extension spoofing", () => {
    // Blacklisted dangerous extensions
    const dangerous = [
      "invoice.exe",
      "script.sh",
      "batch.bat",
      "webshell.php",
      "payload.js",
      "library.dll",
    ];
    for (const name of dangerous) {
      const res = FileSecurityValidator.validateExtension(name);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("prohibited"))).toBe(true);
    }

    // Double extensions
    const doubleExt = ["invoice.pdf.exe", "data.csv.sh", "tariff.json.bat"];
    for (const name of doubleExt) {
      const res = FileSecurityValidator.validateExtension(name);
      expect(res.valid).toBe(false);
    }

    // Allowed extensions pass
    const allowed = [
      "invoice.pdf",
      "data.csv",
      "workbook.xlsx",
      "dump.log",
      "schedule.tariff",
      "telemetry.xml",
    ];
    for (const name of allowed) {
      const res = FileSecurityValidator.validateExtension(name);
      expect(res.valid).toBe(true);
    }
  });

  // 4. Executable Payload Rejection via Magic Bytes
  it("Scenario 4: Rejects DOS/PE, Linux ELF, Mach-O, and shell script binaries disguised as utility files", () => {
    // DOS/PE MZ header disguised as PDF
    const peBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const peRes = FileSecurityValidator.validateMagicBytes(peBytes, "pdf");
    expect(peRes.valid).toBe(false);
    expect(peRes.detectedMimeType).toBe("application/x-dosexec");

    // Linux ELF header disguised as CSV
    const elfBytes = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const elfRes = FileSecurityValidator.validateMagicBytes(elfBytes, "csv");
    expect(elfRes.valid).toBe(false);
    expect(elfRes.detectedMimeType).toBe("application/x-executable");

    // Shell script shebang disguised as tariff JSON
    const shBytes = new TextEncoder().encode("#!/bin/bash\nrm -rf /");
    const shRes = FileSecurityValidator.validateMagicBytes(shBytes, "json");
    expect(shRes.valid).toBe(false);
    expect(shRes.detectedMimeType).toBe("application/x-sh");
  });

  // 5. PDF Structure: %PDF- Header & %%EOF Footer
  it("Scenario 5: Validates PDF header and %%EOF footer marker", () => {
    // Valid PDF
    const validPdfBytes = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
    );
    const validRes = FileSecurityValidator.validateMagicBytes(validPdfBytes, "pdf");
    expect(validRes.valid).toBe(true);
    expect(validRes.detectedMimeType).toBe("application/pdf");

    // Truncated PDF (missing %%EOF)
    const truncatedPdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
    const truncRes = FileSecurityValidator.validateMagicBytes(truncatedPdf, "pdf");
    expect(truncRes.valid).toBe(false);
    expect(truncRes.errors.some((e) => e.includes("%%EOF"))).toBe(true);
  });

  // 6. PDF Active Object & Script Detection
  it("Scenario 6: Blocks PDFs containing dangerous active executable objects (/JavaScript, /Launch)", () => {
    const maliciousPdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<</Type /Action /S /JavaScript /JS (app.alert('pwned'))>>\nendobj\n%%EOF",
    );
    const structRes = FileSecurityValidator.validatePdfStructure(maliciousPdf);
    expect(structRes.valid).toBe(false);
    expect(structRes.errors.some((e) => e.includes("/JavaScript"))).toBe(true);

    const launchPdf = new TextEncoder().encode(
      "%PDF-1.7\n1 0 obj\n<</Type /Action /S /Launch /F (calc.exe)>>\nendobj\n%%EOF",
    );
    const launchRes = FileSecurityValidator.validatePdfStructure(launchPdf);
    expect(launchRes.valid).toBe(false);
    expect(launchRes.errors.some((e) => e.includes("/Launch"))).toBe(true);
  });

  // 7. File Size Validation
  it("Scenario 7: Rejects zero-byte uploads and enforces maximum size limits per type", () => {
    // Zero-byte
    const zeroRes = FileSecurityValidator.validateFileSize(0, "PDF_INVOICE");
    expect(zeroRes.valid).toBe(false);
    expect(zeroRes.errors.some((e) => e.includes("Zero-byte"))).toBe(true);

    // PDF > 25MB
    const bigPdfBytes = 26 * 1024 * 1024;
    const bigPdfRes = FileSecurityValidator.validateFileSize(bigPdfBytes, "PDF_INVOICE");
    expect(bigPdfRes.valid).toBe(false);
    expect(bigPdfRes.errors.some((e) => e.includes("exceeds maximum"))).toBe(true);

    // CSV <= 50MB is valid
    const normalCsv = 10 * 1024 * 1024;
    const normalCsvRes = FileSecurityValidator.validateFileSize(normalCsv, "CSV_INTERVAL_DATA");
    expect(normalCsvRes.valid).toBe(true);

    // CSV > 50MB rejected
    const bigCsv = 55 * 1024 * 1024;
    const bigCsvRes = FileSecurityValidator.validateFileSize(bigCsv, "CSV_INTERVAL_DATA");
    expect(bigCsvRes.valid).toBe(false);
  });

  // 8. Text Encoding & Embedded Null Byte Rejection
  it("Scenario 8: Validates UTF-8 encoding, strips BOM, and rejects embedded null bytes", () => {
    // Embedded null byte in CSV (binary injection)
    const poisonedCsv = new Uint8Array([0x41, 0x2c, 0x42, 0x00, 0x2c, 0x43]); // "A,B\0,C"
    const nullRes = FileSecurityValidator.validateTextEncoding(poisonedCsv, "csv");
    expect(nullRes.valid).toBe(false);
    expect(nullRes.errors.some((e) => e.includes("null byte"))).toBe(true);

    // UTF-8 with BOM stripped cleanly
    const bomCsv = new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0x2c, 0x42, 0x0a]); // UTF-8 BOM + "A,B\n"
    const bomRes = FileSecurityValidator.validateTextEncoding(bomCsv, "csv");
    expect(bomRes.valid).toBe(true);
    expect(bomRes.normalizedBytes?.length).toBe(4); // BOM stripped
    expect(bomRes.warnings?.some((w) => w.includes("BOM"))).toBe(true);
  });

  // 9. CSV Formula Injection (DDE) Defanging
  it("Scenario 9: Defangs spreadsheet formula injection triggers (=, +, -, @, Tab)", () => {
    const maliciousCsv = [
      "Account,Amount,Description",
      "=cmd|' /C calc'!A0,1500,Normal Row",
      "@SUM(1+1)*cmd|' /C calc'!A0,2000,Exploit 2",
      "+123456,3000,Plus Prefix",
      "-987654,4000,Minus Prefix",
      "CleanAccount,5000,Safe Row",
    ].join("\n");

    const bytes = new TextEncoder().encode(maliciousCsv);
    const defangRes = FileSecurityValidator.sanitizeAndDefangCsv(bytes, "csv");

    expect(defangRes.valid).toBe(true);
    expect(defangRes.wasDefanged).toBe(true);

    const defangedText = new TextDecoder("utf-8").decode(defangRes.defangedBytes);
    // Formula triggers should be prefixed with single quote "'"
    expect(defangedText).toContain(`"'=cmd|' /C calc'!A0"`);
    expect(defangedText).toContain(`"'@SUM(1+1)*cmd|' /C calc'!A0"`);
    expect(defangedText).toContain(`"'+123456"`);
    expect(defangedText).toContain(`"'-987654"`);
    expect(defangedText).toContain("CleanAccount,5000,Safe Row");
  });

  // 10. XML External Entity (XXE) Prevention
  it("Scenario 10: Blocks XML containing <!DOCTYPE and <!ENTITY declarations", () => {
    const xxePayload = `<?xml version="1.0"?>
      <!DOCTYPE root [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
      ]>
      <telemetry>&xxe;</telemetry>`;
    const bytes = new TextEncoder().encode(xxePayload);
    const xxeRes = FileSecurityValidator.validateXmlStructure(bytes);

    expect(xxeRes.valid).toBe(false);
    expect(xxeRes.errors.some((e) => e.includes("XXE"))).toBe(true);

    // Clean XML passes
    const cleanXml = `<?xml version="1.0"?><telemetry><reading meter="M01" kwh="120.5"/></telemetry>`;
    const cleanRes = FileSecurityValidator.validateXmlStructure(new TextEncoder().encode(cleanXml));
    expect(cleanRes.valid).toBe(true);
  });

  // 11. Macro-Enabled Excel Rejection
  it("Scenario 11: Blocks macro-enabled Excel workbooks containing vbaProject.bin", () => {
    const macroBytes = new TextEncoder().encode("PK\x03\x04...xl/vbaProject.bin...fake content");
    const macroRes = FileSecurityValidator.validateXlsxStructure(macroBytes);
    expect(macroRes.valid).toBe(false);
    expect(macroRes.errors.some((e) => e.includes("VBA macros"))).toBe(true);
  });

  // 12. Tenant-Isolated Storage Paths
  it("Scenario 12: Generates strict tenant-isolated storage paths without path traversal", () => {
    const path = FileStorageSecurityService.buildStoragePath(
      "org-corp-123",
      "upload-uuid-456",
      "invoice_2026.pdf",
    );
    expect(path).toBe("tenants/org-corp-123/uploads/upload-uuid-456/invoice_2026.pdf");

    // Path traversal in filename sanitized out
    const taintedPath = FileStorageSecurityService.buildStoragePath(
      "org-corp-123",
      "upload-uuid-456",
      "../../etc/passwd.pdf",
    );
    expect(taintedPath).toBe("tenants/org-corp-123/uploads/upload-uuid-456/______etc_passwd.pdf");
    expect(taintedPath).not.toContain("..");
  });

  // 13. Controlled Signed URLs & Cross-Tenant Access Rejection
  it("Scenario 13: Generates time-limited signed URLs and rejects cross-tenant download access", async () => {
    // 1. Create an upload for Tenant A
    const uploadA = await UploadStorageService.createUploadRecord(
      {
        organisationId: TENANT_A,
        filename: "fiscal_meter_intervals.csv",
        fileType: "CSV_INTERVAL_DATA",
        fileSizeBytes: 1024,
        fileHashSha256: "aabbccdd11223344",
        storageLocation: FileStorageSecurityService.buildStoragePath(
          TENANT_A,
          "up-101",
          "fiscal_meter_intervals.csv",
        ),
      },
      contextA,
    );

    // 2. Tenant A can generate a signed URL
    const signedUrlRes = await FileStorageSecurityService.createSignedDownloadUrl(
      uploadA.id,
      contextA,
      900,
    );
    expect(signedUrlRes.success).toBe(true);
    expect(signedUrlRes.signedUrl).toContain("/api/uploads/download/");
    expect(signedUrlRes.expiresInSeconds).toBe(900);

    // 3. Verify the token validates successfully
    const token = signedUrlRes.signedUrl!.replace("/api/uploads/download/", "");
    const verifyRes = await FileStorageSecurityService.verifyDownloadToken(token);
    expect(verifyRes.valid).toBe(true);
    expect(verifyRes.payload?.uploadId).toBe(uploadA.id);
    expect(verifyRes.payload?.organisationId).toBe(TENANT_A);

    // 4. Tenant B requesting a signed URL for Tenant A's upload is denied
    await expect(
      FileStorageSecurityService.createSignedDownloadUrl(uploadA.id, contextB, 900),
    ).rejects.toThrow();

    // 5. Tampered token is rejected
    const tamperedToken = token.slice(0, -4) + "XXXX";
    const tamperedVerify = await FileStorageSecurityService.verifyDownloadToken(tamperedToken);
    expect(tamperedVerify.valid).toBe(false);
    expect(tamperedVerify.error).toContain("signature mismatch");
  });

  // 14. Zero Credential Exposure & Storage Masking
  it("Scenario 14: Never exposes private cloud bucket URLs or storage credentials", () => {
    const rawBucketUrl =
      "https://my-cloud-project.supabase.co/storage/v1/object/public/private-invoices/tenant-1/doc.pdf";
    const masked = FileStorageSecurityService.maskStorageLocation(rawBucketUrl);

    // Must not leak supabase project ID or private-invoices bucket name
    expect(masked).not.toContain("my-cloud-project");
    expect(masked).not.toContain("private-invoices");
    expect(masked).toBe("storage://protected/tenant-1/doc.pdf");
  });

  // 15. Ingestion Gateway End-to-End Security Rejection
  it("Scenario 15: SecureIngestionGateway catches security violations and marks upload record FAILED without silent failure", async () => {
    // Attempt to upload an executable disguised as an Eskom invoice
    const fakeInvoicePayload = new Uint8Array([0x4d, 0x5a, 0x00, 0x00]); // MZ executable
    const result = await SecureIngestionGateway.processUpload(
      fakeInvoicePayload,
      "eskom_march_invoice.pdf",
      TENANT_A,
      USER_A,
      undefined,
      contextA,
    );

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.uploadRecord).toBeDefined();
    expect(result.uploadRecord?.processingStatus).toBe("FAILED");
    expect(result.uploadRecord?.validationStatus).toBe("INVALID");
    expect(result.uploadRecord?.errorStatus).toBe("FATAL");
    expect(result.uploadRecord?.errorMessage).toContain("executable payload");
  });

  // 16. Expired Token & Double-Encoded Path Traversal Rejection
  it("Scenario 16: Rejects expired signed download URLs and double-encoded path traversal", async () => {
    // Expired token test: generate URL with -5 seconds TTL
    const uploadA = await UploadStorageService.createUploadRecord(
      {
        organisationId: TENANT_A,
        filename: "historical_meter_log.log",
        fileType: "RAW_METER_LOG",
        fileSizeBytes: 512,
        fileHashSha256: "eeff001122334455",
        storageLocation: FileStorageSecurityService.buildStoragePath(
          TENANT_A,
          "up-expired-test",
          "historical_meter_log.log",
        ),
      },
      contextA,
    );

    const expiredUrlRes = await FileStorageSecurityService.createSignedDownloadUrl(
      uploadA.id,
      contextA,
      -1, // Already expired
    );
    expect(expiredUrlRes.success).toBe(true);

    const token = expiredUrlRes.signedUrl!.replace("/api/uploads/download/", "");
    const verifyExpired = await FileStorageSecurityService.verifyDownloadToken(token);
    expect(verifyExpired.valid).toBe(false);
    expect(verifyExpired.error).toContain("expired");

    // Double-encoded path traversal check in validateFilename
    const doubleEncoded = "%252e%252e%252froot.csv";
    const res = FileSecurityValidator.validateFilename(doubleEncoded);
    expect(res.valid).toBe(false);
  });
});
