/**
 * STAGE 12 — SECURITY TEST SUITE
 * ========================================================
 * Authoritative verification of Stage 12 Security Requirements:
 *
 * 1. Authentication is required
 * 2. Tenant/organisation isolation is enforced
 * 3. Users can only access authorised documents
 * 4. Supabase Storage policies are correct
 * 5. Database RLS is correct
 * 6. Document paths cannot be manipulated
 * 7. Uploaded filenames cannot cause path traversal
 * 8. MIME type is not trusted blindly
 * 9. File signatures/magic bytes are checked where practical
 * 10. Processing occurs server-side where appropriate
 * 11. Secrets never reach the browser (Zero Secret Exposure / Level 3 Embargo)
 * 12. Do not expose: API keys, AI credentials, service-role keys, internal prompts, endpoints, DB credentials
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DocumentSecurityGuard } from "@/domain/intelligence/documentSecurityGuard";
import { DocumentIntelligencePipeline } from "@/domain/intelligence/documentIntelligencePipeline";
import {
  AuthenticationRequiredError,
  TenantIsolationViolationSecurityError,
  UnauthorizedDocumentAccessError,
  PathTraversalSecurityError,
  MimeTypeSpoofingError,
  FileSignatureMismatchError,
  SecretExposureSecurityError,
} from "@/domain/intelligence/documentIntelligenceErrors";
import type { UserSecurityContext } from "@/domain/security/types";
import { SecurityHardeningService } from "@/domain/security/securityHardeningService";

// Helper: build minimal valid PDF byte stream with %PDF- header and %%EOF footer
function createValidPdfBytes(content = "Eskom Invoice INV-2026-09"): Uint8Array {
  const text = `%PDF-1.7\n1 0 obj\n<< /Length 20 >>\nstream\n${content}\nendstream\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n120\n%%EOF`;
  return new TextEncoder().encode(text);
}

// Helper: build malicious executable binary bytes (DOS/PE MZ header)
function createExecutableMzBytes(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes[0] = 0x4d; // 'M'
  bytes[1] = 0x5a; // 'Z'
  bytes[2] = 0x90;
  bytes[3] = 0x00;
  return bytes;
}

// Helper: build Linux ELF binary bytes
function createExecutableElfBytes(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes[0] = 0x7f;
  bytes[1] = 0x45; // 'E'
  bytes[2] = 0x4c; // 'L'
  bytes[3] = 0x46; // 'F'
  return bytes;
}

// Helper: build Shell Script shebang bytes
function createShellScriptBytes(): Uint8Array {
  return new TextEncoder().encode("#!/bin/bash\nrm -rf /\n");
}

describe("STAGE 12 — SECURITY SUBSYSTEM", () => {
  const tenantAlpha = "org-alpha-1111";
  const tenantBeta = "org-beta-2222";

  const adminContextAlpha: UserSecurityContext = {
    userId: "user-admin-alpha",
    email: "admin@alpha.co.za",
    organisationId: tenantAlpha,
    role: "ORGANISATION_ADMIN",
    permissions: [
      "PERM_VIEW_DASHBOARD",
      "PERM_VIEW_TELEMETRY",
      "PERM_VIEW_INVOICES",
      "PERM_UPLOAD_INVOICE",
      "PERM_UPLOAD_TELEMETRY",
      "PERM_EXECUTE_RECONCILIATION",
      "PERM_MANAGE_ORGANISATION",
    ],
  };

  const readOnlyContextAlpha: UserSecurityContext = {
    userId: "user-readonly-alpha",
    email: "readonly@alpha.co.za",
    organisationId: tenantAlpha,
    role: "READ_ONLY",
    permissions: ["PERM_VIEW_DASHBOARD", "PERM_VIEW_TELEMETRY", "PERM_VIEW_INVOICES"],
  };

  const auditorContextAlpha: UserSecurityContext = {
    userId: "user-auditor-alpha",
    email: "auditor@alpha.co.za",
    organisationId: tenantAlpha,
    role: "AUDITOR",
    permissions: ["PERM_VIEW_DASHBOARD", "PERM_VIEW_TELEMETRY", "PERM_VIEW_INVOICES"],
  };

  const superAdminContext: UserSecurityContext = {
    userId: "super-admin-global",
    email: "root@enera.io",
    organisationId: "org-global-master",
    role: "SUPER_ADMIN",
    permissions: [
      "PERM_VIEW_DASHBOARD",
      "PERM_VIEW_TELEMETRY",
      "PERM_VIEW_INVOICES",
      "PERM_UPLOAD_INVOICE",
      "PERM_UPLOAD_TELEMETRY",
      "PERM_EXECUTE_RECONCILIATION",
      "PERM_MANAGE_ORGANISATION",
      "PERM_EXPORT_DATA",
      "PERM_MANAGE_USERS",
    ],
  };

  // =========================================================================
  // 1. AUTHENTICATION IS REQUIRED
  // =========================================================================
  describe("1. Authentication Requirement", () => {
    it("should reject unauthenticated access when security context is missing", () => {
      expect(() => {
        DocumentSecurityGuard.assertAuthenticated(null);
      }).toThrowError(AuthenticationRequiredError);

      expect(() => {
        DocumentSecurityGuard.assertAuthenticated(undefined);
      }).toThrowError(AuthenticationRequiredError);
    });

    it("should reject context with missing or empty userId", () => {
      expect(() => {
        DocumentSecurityGuard.assertAuthenticated({
          userId: "",
          email: "guest@example.com",
          organisationId: tenantAlpha,
          role: "READ_ONLY",
          permissions: [],
        });
      }).toThrowError(AuthenticationRequiredError);
    });

    it("should reject context with missing organisation attribution", () => {
      expect(() => {
        DocumentSecurityGuard.assertAuthenticated({
          userId: "user-123",
          email: "user@example.com",
          organisationId: "",
          role: "READ_ONLY",
          permissions: [],
        });
      }).toThrowError(AuthenticationRequiredError);
    });

    it("should accept valid authenticated user security context", () => {
      expect(() => {
        DocumentSecurityGuard.assertAuthenticated(adminContextAlpha);
      }).not.toThrow();
    });

    it("should reject pipeline execution when strictSecurity is enabled and context is missing", async () => {
      const pdfBytes = createValidPdfBytes();
      await expect(
        DocumentIntelligencePipeline.processDocument(pdfBytes, "valid_invoice.pdf", tenantAlpha, {
          strictSecurity: true,
          context: undefined,
          throwOnError: true,
        }),
      ).rejects.toThrowError(AuthenticationRequiredError);
    });
  });

  // =========================================================================
  // 2. TENANT / ORGANISATION ISOLATION
  // =========================================================================
  describe("2. Tenant / Organisation Isolation", () => {
    it("should permit access within the user's own organisation", () => {
      expect(() => {
        DocumentSecurityGuard.assertTenantAccess(adminContextAlpha, tenantAlpha);
      }).not.toThrow();
    });

    it("should strictly deny cross-tenant access and throw TenantIsolationViolationSecurityError", () => {
      expect(() => {
        DocumentSecurityGuard.assertTenantAccess(adminContextAlpha, tenantBeta);
      }).toThrowError(TenantIsolationViolationSecurityError);
    });

    it("should permit SUPER_ADMIN global access across any tenant", () => {
      expect(() => {
        DocumentSecurityGuard.assertTenantAccess(superAdminContext, tenantBeta);
      }).not.toThrow();
    });

    it("should block cross-tenant processing in DocumentIntelligencePipeline", async () => {
      const pdfBytes = createValidPdfBytes();
      await expect(
        DocumentIntelligencePipeline.processDocument(
          pdfBytes,
          "invoice.pdf",
          tenantBeta, // target org
          {
            context: adminContextAlpha, // caller is tenantAlpha
            throwOnError: true,
          },
        ),
      ).rejects.toThrowError(TenantIsolationViolationSecurityError);
    });
  });

  // =========================================================================
  // 3. USERS CAN ONLY ACCESS AUTHORISED DOCUMENTS
  // =========================================================================
  describe("3. Document Access Authorization", () => {
    const docAlpha = {
      organisationId: tenantAlpha,
      uploadedBy: "user-admin-alpha",
      documentId: "doc-111",
    };

    it("should allow READ access for all authenticated tenant members", () => {
      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(readOnlyContextAlpha, docAlpha, "READ");
      }).not.toThrow();

      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(auditorContextAlpha, docAlpha, "READ");
      }).not.toThrow();
    });

    it("should forbid READ_ONLY and AUDITOR roles from initiating PROCESS runs", () => {
      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(readOnlyContextAlpha, docAlpha, "PROCESS");
      }).toThrowError(UnauthorizedDocumentAccessError);

      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(auditorContextAlpha, docAlpha, "PROCESS");
      }).toThrowError(UnauthorizedDocumentAccessError);
    });

    it("should allow ORGANISATION_ADMIN to initiate PROCESS runs", () => {
      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(adminContextAlpha, docAlpha, "PROCESS");
      }).not.toThrow();
    });

    it("should forbid READ_ONLY from MUTATING or DELETING documents", () => {
      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(readOnlyContextAlpha, docAlpha, "MUTATE");
      }).toThrowError(UnauthorizedDocumentAccessError);

      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(readOnlyContextAlpha, docAlpha, "DELETE");
      }).toThrowError(UnauthorizedDocumentAccessError);
    });

    it("should forbid non-admin from modifying documents owned by another user", () => {
      const regularOperatorContext: UserSecurityContext = {
        userId: "user-operator-other",
        email: "other@alpha.co.za",
        organisationId: tenantAlpha,
        role: "ENERGY_MANAGER",
        permissions: ["PERM_VIEW_DASHBOARD", "PERM_VIEW_INVOICES", "PERM_UPLOAD_INVOICE"],
      };

      expect(() => {
        DocumentSecurityGuard.assertDocumentAccess(
          regularOperatorContext,
          docAlpha, // uploaded by user-admin-alpha
          "DELETE",
        );
      }).toThrowError(UnauthorizedDocumentAccessError);
    });
  });

  // =========================================================================
  // 4. SUPABASE STORAGE POLICIES & PATH ISOLATION
  // =========================================================================
  describe("4. Supabase Storage Policies & Path Isolation", () => {
    it("should verify storage paths adhere to tenants/{organisation_id}/* format", () => {
      const validPath = `tenants/${tenantAlpha}/documents/doc-123/safe_invoice.pdf`;
      const result = DocumentSecurityGuard.validateStoragePath(validPath, tenantAlpha);
      expect(result.isValid).toBe(true);
    });

    it("should reject storage paths that do not start with tenants/", () => {
      const invalidPath = "public/uploads/invoice.pdf";
      const result = DocumentSecurityGuard.validateStoragePath(invalidPath, tenantAlpha);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("tenants/");
    });

    it("should reject cross-tenant storage path access", () => {
      const crossPath = `tenants/${tenantBeta}/documents/doc-123/safe_invoice.pdf`;
      const result = DocumentSecurityGuard.validateStoragePath(crossPath, tenantAlpha);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("does not match expected organisation");
    });

    it("should verify storage access policy via SecurityHardeningService", () => {
      const validPath = `tenants/${tenantAlpha}/documents/doc-123/invoice.pdf`;
      const check = SecurityHardeningService.verifyStorageAccessPolicy(
        adminContextAlpha,
        validPath,
      );
      expect(check.allowed).toBe(true);

      const crossPath = `tenants/${tenantBeta}/documents/doc-123/invoice.pdf`;
      const crossCheck = SecurityHardeningService.verifyStorageAccessPolicy(
        adminContextAlpha,
        crossPath,
      );
      expect(crossCheck.allowed).toBe(false);
    });
  });

  // =========================================================================
  // 5. DATABASE RLS INTEGRITY & MUTATION REVOCATION
  // =========================================================================
  describe("5. Database Row Level Security (RLS) Verification", () => {
    it("should pass comprehensive security audit across all 10 security domains", () => {
      const audit = SecurityHardeningService.runComprehensiveSecurityAudit();
      expect(audit.isFullyHardened).toBe(true);
      expect(audit.vulnerabilityCount).toBe(0);

      const rlsCheck = audit.checks.find((c) => c.category === "ROW_LEVEL_SECURITY");
      expect(rlsCheck?.status).toBe("SECURE");

      const storageCheck = audit.checks.find((c) => c.category === "STORAGE_PERMISSIONS");
      expect(storageCheck?.status).toBe("SECURE");

      const apiCheck = audit.checks.find((c) => c.category === "API_ACCESS");
      expect(apiCheck?.status).toBe("SECURE");
    });
  });

  // =========================================================================
  // 6. DOCUMENT PATHS CANNOT BE MANIPULATED
  // =========================================================================
  describe("6. Storage Path Manipulation Prevention", () => {
    it("should deterministically construct secure storage paths", () => {
      const path = DocumentSecurityGuard.buildSecureStoragePath(
        "org_alpha",
        "doc_001",
        "Eskom_Invoice_2026.pdf",
      );
      expect(path).toBe("tenants/org_alpha/documents/doc_001/Eskom_Invoice_2026.pdf");
    });

    it("should sanitize path components to prevent directory injection", () => {
      const path = DocumentSecurityGuard.buildSecureStoragePath(
        "org/../evil_org",
        "doc/../../escape",
        "../../malicious.pdf",
      );
      expect(path).not.toContain("..");
      expect(path).toMatch(/^tenants\/[a-zA-Z0-9_-]+\/documents\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/);
    });

    it("should reject storage paths with double slashes or backward slashes", () => {
      expect(
        DocumentSecurityGuard.validateStoragePath("tenants//org/documents/1/f.pdf").isValid,
      ).toBe(false);
      expect(
        DocumentSecurityGuard.validateStoragePath("tenants\\org\\documents\\1\\f.pdf").isValid,
      ).toBe(false);
    });
  });

  // =========================================================================
  // 7. UPLOADED FILENAMES CANNOT CAUSE PATH TRAVERSAL
  // =========================================================================
  describe("7. Uploaded Filename Path Traversal Prevention", () => {
    it("should detect and reject directory traversal using '../'", () => {
      const traversalFilenames = [
        "../../etc/passwd",
        "../../../var/log/system.log",
        "..\\..\\windows\\system32\\cmd.exe",
        "nested/../../secret.pdf",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "%2e%2e\\windows\\system32",
      ];

      for (const name of traversalFilenames) {
        const result = DocumentSecurityGuard.sanitizeUploadedFilename(name);
        expect(result.isValid).toBe(false);
        expect(result.isTraversalAttempt).toBe(true);

        expect(() => {
          DocumentSecurityGuard.assertSafeFilename(name);
        }).toThrowError(PathTraversalSecurityError);
      }
    });

    it("should detect and reject null-byte truncation attacks", () => {
      const nullByteFilenames = ["invoice.pdf\0.exe", "safe.pdf%00.sh", "document\0_malicious.bat"];

      for (const name of nullByteFilenames) {
        const result = DocumentSecurityGuard.sanitizeUploadedFilename(name);
        expect(result.isValid).toBe(false);
        expect(result.isTraversalAttempt).toBe(true);

        expect(() => {
          DocumentSecurityGuard.assertSafeFilename(name);
        }).toThrowError(PathTraversalSecurityError);
      }
    });

    it("should reject Windows system reserved device names", () => {
      const reservedNames = ["con.pdf", "prn.pdf", "aux.pdf", "nul.pdf", "com1.pdf", "lpt1.pdf"];
      for (const name of reservedNames) {
        const result = DocumentSecurityGuard.sanitizeUploadedFilename(name);
        expect(result.isValid).toBe(false);
        expect(result.errors.some((e) => e.includes("system reserved"))).toBe(true);
      }
    });

    it("should reject dangerous executable and script extensions", () => {
      const dangerousNames = [
        "invoice.pdf.exe",
        "exploit.sh",
        "script.vbs",
        "payload.bat",
        "backdoor.py",
        "webshell.php",
      ];

      for (const name of dangerousNames) {
        const result = DocumentSecurityGuard.sanitizeUploadedFilename(name);
        expect(result.isValid).toBe(false);
      }
    });

    it("should cleanly sanitize legitimate utility bill filenames", () => {
      const safe = DocumentSecurityGuard.assertSafeFilename("Eskom Megaflex Invoice - 2026-09.pdf");
      expect(safe).toBe("Eskom_Megaflex_Invoice_-_2026-09.pdf");
    });
  });

  // =========================================================================
  // 8. MIME TYPE IS NOT TRUSTED BLINDLY
  // =========================================================================
  describe("8. Blind MIME Type Disregard", () => {
    it("should reject file claiming to be application/pdf when actual bytes are plain text or random binary", () => {
      const fakePdfBytes = new TextEncoder().encode("Hello this is plain text not a PDF");
      const result = DocumentSecurityGuard.verifyMimeAndMagicBytes(
        fakePdfBytes,
        "application/pdf",
        "fake_invoice.pdf",
      );

      expect(result.isValid).toBe(false);
      expect(result.detectedMimeType).not.toBe("application/pdf");
      expect(result.errors.some((e) => e.includes("MIME spoofing"))).toBe(true);

      expect(() => {
        DocumentSecurityGuard.assertMimeAndSignatureValid(
          fakePdfBytes,
          "application/pdf",
          "fake_invoice.pdf",
        );
      }).toThrowError(MimeTypeSpoofingError);
    });

    it("should reject file named invoice.pdf when content is an HTML script", () => {
      const htmlBytes = new TextEncoder().encode("<html><script>alert(1)</script></html>");
      expect(() => {
        DocumentSecurityGuard.assertMimeAndSignatureValid(
          htmlBytes,
          "application/pdf",
          "invoice.pdf",
        );
      }).toThrowError(MimeTypeSpoofingError);
    });
  });

  // =========================================================================
  // 9. FILE SIGNATURES & MAGIC BYTES VERIFICATION
  // =========================================================================
  describe("9. File Signatures / Magic Bytes Verification", () => {
    it("should successfully verify standard PDF with %PDF- header and %%EOF trailer", () => {
      const validPdfBytes = createValidPdfBytes();
      const result = DocumentSecurityGuard.verifyMimeAndMagicBytes(
        validPdfBytes,
        "application/pdf",
        "invoice.pdf",
      );

      expect(result.isValid).toBe(true);
      expect(result.detectedMimeType).toBe("application/pdf");
      expect(result.isPdf).toBe(true);
      expect(result.hasEofMarker).toBe(true);
    });

    it("should immediately reject DOS/Windows PE executable binary (MZ header)", () => {
      const mzBytes = createExecutableMzBytes();
      const result = DocumentSecurityGuard.verifyMimeAndMagicBytes(
        mzBytes,
        "application/pdf",
        "disguised_invoice.pdf",
      );

      expect(result.isValid).toBe(false);
      expect(result.isExecutable).toBe(true);
      expect(result.detectedMimeType).toBe("application/x-dosexec");

      expect(() => {
        DocumentSecurityGuard.assertMimeAndSignatureValid(
          mzBytes,
          "application/pdf",
          "disguised_invoice.pdf",
        );
      }).toThrowError(FileSignatureMismatchError);
    });

    it("should immediately reject Linux ELF executable binary", () => {
      const elfBytes = createExecutableElfBytes();
      const result = DocumentSecurityGuard.verifyMimeAndMagicBytes(
        elfBytes,
        "application/pdf",
        "malware.pdf",
      );

      expect(result.isValid).toBe(false);
      expect(result.isExecutable).toBe(true);
      expect(result.detectedMimeType).toBe("application/x-executable");
    });

    it("should immediately reject executable shell script header", () => {
      const shBytes = createShellScriptBytes();
      const result = DocumentSecurityGuard.verifyMimeAndMagicBytes(
        shBytes,
        "text/plain",
        "script.txt",
      );

      expect(result.isValid).toBe(false);
      expect(result.isExecutable).toBe(true);
      expect(result.detectedMimeType).toBe("application/x-sh");
    });
  });

  // =========================================================================
  // 10. SERVER-SIDE PROCESSING BOUNDARY VERIFICATION
  // =========================================================================
  describe("10. Server-Side Processing Boundary", () => {
    it("should verify that ingestion security cannot be client-spoofed", () => {
      const boundary = DocumentSecurityGuard.verifyServerSideProcessingBoundary();
      expect(boundary.isEnforced).toBe(true);
      expect(boundary.details).toContain("authoritative domain services");
    });

    it("should run comprehensive ingestion security validation", () => {
      const validPdfBytes = createValidPdfBytes();
      const scan = DocumentSecurityGuard.validateDocumentIngestionSecurity({
        fileData: validPdfBytes,
        filename: "September_2026_Megaflex.pdf",
        organisationId: tenantAlpha,
        documentId: "doc-test-123",
        declaredMimeType: "application/pdf",
        context: adminContextAlpha,
        strictSecurity: true,
      });

      expect(scan.isSecure).toBe(true);
      expect(scan.sanitizedFilename).toBe("September_2026_Megaflex.pdf");
      expect(scan.storagePath).toBe(
        `tenants/${tenantAlpha}/documents/doc-test-123/September_2026_Megaflex.pdf`,
      );
      expect(scan.detectedMimeType).toBe("application/pdf");
      expect(scan.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // 11. SECRETS NEVER REACH THE BROWSER (ZERO SECRET EXPOSURE)
  // =========================================================================
  describe("11. Zero Secret Exposure & Confidentiality Embargo", () => {
    it("should confirm client environment does not expose sensitive keys", () => {
      const envAudit = SecurityHardeningService.auditEnvironmentSecrets();
      expect(envAudit.isSecure).toBe(true);
      expect(envAudit.leakedKeys).toHaveLength(0);
    });

    it("should detect and reject target objects that accidentally embed service role keys", () => {
      const leakyObject = {
        documentId: "doc-123",
        supabase_service_role_key: "eyJhbGciOi...",
      };

      const audit = DocumentSecurityGuard.auditSecretLeakage(leakyObject);
      expect(audit.isSecure).toBe(false);
      expect(audit.violations.some((v) => v.includes("SERVICE_ROLE"))).toBe(true);

      expect(() => {
        DocumentSecurityGuard.assertZeroSecretExposure(leakyObject);
      }).toThrowError(SecretExposureSecurityError);
    });

    it("should detect and reject target objects that embed database connection credentials", () => {
      const leakyDbObject = {
        documentId: "doc-123",
        database_url: "postgresql://postgres:SuperSecretPassword123@db.supabase.co:5432/postgres",
      };

      const audit = DocumentSecurityGuard.auditSecretLeakage(leakyDbObject);
      expect(audit.isSecure).toBe(false);
      expect(audit.violations.some((v) => v.includes("Postgres connection string"))).toBe(true);
    });

    it("should detect and reject target objects that embed internal system prompts", () => {
      const leakyPromptObject = {
        documentId: "doc-123",
        internal_system_prompt: "You are an internal utility extraction engine...",
      };

      const audit = DocumentSecurityGuard.auditSecretLeakage(leakyPromptObject);
      expect(audit.isSecure).toBe(false);
      expect(
        audit.violations.some((v) => v.includes("SYSTEM_PROMPT") || v.includes("INTERNAL_PROMPT")),
      ).toBe(true);
    });

    it("should verify that DocumentIntelligencePipeline outputs never expose confidential secrets", async () => {
      const pdfBytes = createValidPdfBytes("Official Eskom Megaflex Bill Account 123456789");
      const pkg = await DocumentIntelligencePipeline.processDocument(
        pdfBytes,
        "clean_invoice.pdf",
        tenantAlpha,
        {
          context: adminContextAlpha,
          strictSecurity: true,
        },
      );

      expect(() => {
        DocumentSecurityGuard.assertZeroSecretExposure(pkg);
      }).not.toThrow();
    });
  });
});
