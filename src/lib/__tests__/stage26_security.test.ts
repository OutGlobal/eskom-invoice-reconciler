/**
 * STAGE 26 — COMPREHENSIVE SECURITY & DEFENSE-IN-DEPTH TEST SUITE
 * ===============================================================
 *
 * Verifies that:
 * 1. Users cannot access another organisation's data (Tenant Isolation)
 * 2. Users cannot modify records they do not own (Record Ownership & RBAC Guard)
 * 3. Sensitive files are protected (Storage path isolation, signed URLs, no public bucket)
 * 4. Service credentials never reach the browser (Zero service_role leakage)
 * 5. Admin functions are protected (Non-bypassable admin assertions)
 * 6. Database policies enforce access (RLS and anonymous mutation revocation)
 * 7. Do not assume frontend route protection is sufficient (Domain and gateway level enforcement)
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  SecurityHardeningService,
  type ComprehensiveSecurityAuditReport,
} from "../../domain/security/securityHardeningService";
import {
  createSecurityContext,
  assertTenantAccess,
  validateTenantAccess,
  enforceTenantScope,
  TenantIsolationViolationError,
} from "../../domain/security/tenantContextService";
import { FileStorageSecurityService } from "../../domain/security/fileStorageSecurityService";
import { UploadStorageService } from "../../domain/upload/uploadStorageService";
import type { UserSecurityContext } from "../../domain/security/types";

describe("Stage 26 — Security Hardening & Zero-Exposure Defense", () => {
  const ORG_ALPHA = "11111111-1111-1111-1111-111111111111";
  const ORG_BETA = "22222222-2222-2222-2222-222222222222";

  const userAlphaRegular: UserSecurityContext = createSecurityContext(
    "usr-alpha-001",
    "alice@alpha.co.za",
    ORG_ALPHA,
    "ENERGY_MANAGER",
  );

  const userAlphaReadOnly: UserSecurityContext = createSecurityContext(
    "usr-alpha-002",
    "bob@alpha.co.za",
    ORG_ALPHA,
    "READ_ONLY",
  );

  const userAlphaAdmin: UserSecurityContext = createSecurityContext(
    "usr-alpha-admin",
    "admin@alpha.co.za",
    ORG_ALPHA,
    "ORGANISATION_ADMIN",
  );

  const userBetaRegular: UserSecurityContext = createSecurityContext(
    "usr-beta-001",
    "charlie@beta.co.za",
    ORG_BETA,
    "ENERGY_MANAGER",
  );

  const superAdmin: UserSecurityContext = createSecurityContext(
    "usr-superadmin",
    "security@enera.io",
    "00000000-0000-0000-0000-000000000000",
    "SUPER_ADMIN",
  );

  it("Requirement 1: Users CANNOT access another organisation's data (Cross-Tenant Isolation)", () => {
    // User from Org Alpha attempts to access Org Beta
    const validation = validateTenantAccess(userAlphaRegular, ORG_BETA);
    expect(validation.allowed).toBe(false);
    expect(validation.reason).toContain("UNAUTHORIZED_TENANT_ACCESS");

    // Assertion must throw TenantIsolationViolationError
    expect(() => {
      assertTenantAccess(userAlphaRegular, ORG_BETA);
    }).toThrowError(TenantIsolationViolationError);

    // enforceTenantScope must reject cross-tenant scope injection
    expect(() => {
      enforceTenantScope(userAlphaRegular, { organisation_id: ORG_BETA });
    }).toThrowError(TenantIsolationViolationError);

    // Super Admin can access with global override
    expect(validateTenantAccess(superAdmin, ORG_ALPHA).allowed).toBe(true);
    expect(validateTenantAccess(superAdmin, ORG_BETA).allowed).toBe(true);
  });

  it("Requirement 2: Users CANNOT modify records they do not own (Record Ownership & RBAC Guard)", () => {
    // Record belonging to Org Beta
    const betaInvoiceRecord = {
      id: "inv-beta-999",
      organisation_id: ORG_BETA,
      created_by: "usr-beta-001",
    };

    // User Alpha attempts to modify Org Beta record -> REJECTED
    expect(() => {
      SecurityHardeningService.assertUserOwnsRecord(userAlphaRegular, betaInvoiceRecord, "MODIFY");
    }).toThrowError(TenantIsolationViolationError);

    // User Alpha attempts to delete Org Beta record -> REJECTED
    expect(() => {
      SecurityHardeningService.assertUserOwnsRecord(userAlphaRegular, betaInvoiceRecord, "DELETE");
    }).toThrowError(TenantIsolationViolationError);

    // Record belonging to Org Alpha, created by usr-alpha-001
    const alphaRecord = {
      id: "inv-alpha-001",
      organisation_id: ORG_ALPHA,
      created_by: "usr-alpha-001",
    };

    // Creator can modify their own record
    expect(() => {
      SecurityHardeningService.assertUserOwnsRecord(userAlphaRegular, alphaRecord, "MODIFY");
    }).not.toThrow();

    // Read-only user cannot modify even within own organization
    expect(() => {
      SecurityHardeningService.assertUserOwnsRecord(userAlphaReadOnly, alphaRecord, "MODIFY");
    }).toThrow(/FORBIDDEN_MUTATION/);

    // Another user in the same org cannot modify without admin role
    const otherUserSameOrg = createSecurityContext(
      "usr-alpha-003",
      "dan@alpha.co.za",
      ORG_ALPHA,
      "ANALYST",
    );
    expect(() => {
      SecurityHardeningService.assertUserOwnsRecord(otherUserSameOrg, alphaRecord, "MODIFY");
    }).toThrow(/FORBIDDEN_RECORD_OWNERSHIP/);

    // Organisation Admin CAN manage records within their own org
    expect(() => {
      SecurityHardeningService.assertUserOwnsRecord(userAlphaAdmin, alphaRecord, "MODIFY");
    }).not.toThrow();
  });

  it("Requirement 3: Sensitive files are protected (Storage path isolation, signed URLs & path traversal protection)", async () => {
    const uploadId = "upload-test-sec-001";
    const filename = "tariff_invoice_impala.pdf";

    // Build storage path
    const pathAlpha = FileStorageSecurityService.buildStoragePath(ORG_ALPHA, uploadId, filename);
    expect(pathAlpha).toBe(`tenants/${ORG_ALPHA}/uploads/${uploadId}/${filename}`);

    // Verify storage access policy: User Alpha has access to own tenant path
    const accessAlpha = SecurityHardeningService.verifyStorageAccessPolicy(
      userAlphaRegular,
      pathAlpha,
    );
    expect(accessAlpha.allowed).toBe(true);

    // User Beta attempts to access Alpha's file path -> REJECTED
    const accessBeta = SecurityHardeningService.verifyStorageAccessPolicy(
      userBetaRegular,
      pathAlpha,
    );
    expect(accessBeta.allowed).toBe(false);
    expect(accessBeta.reason).toContain("STORAGE_ACCESS_DENIED");

    // Malicious path traversal attempts are detected and denied
    const traversalPath = `tenants/${ORG_ALPHA}/uploads/../../../etc/passwd`;
    const traversalCheck = SecurityHardeningService.verifyStorageAccessPolicy(
      userAlphaRegular,
      traversalPath,
    );
    expect(traversalCheck.allowed).toBe(false);
    expect(traversalCheck.reason).toContain("path traversal");

    // Create upload record for Alpha
    await UploadStorageService.createUploadRecord({
      id: uploadId,
      organisationId: ORG_ALPHA,
      userId: userAlphaRegular.userId,
      filename,
      fileType: "application/pdf",
      fileSizeBytes: 1024,
      fileHashSha256: "hash-001",
      storageLocation: pathAlpha,
    });

    // Alpha can generate signed download URL for own file
    const signedUrlAlpha = await FileStorageSecurityService.createSignedDownloadUrl(
      uploadId,
      userAlphaRegular,
    );
    expect(signedUrlAlpha.success).toBe(true);
    expect(signedUrlAlpha.signedUrl).toBeDefined();

    // User Beta attempting to generate signed download URL for Alpha's file -> REJECTED
    await expect(
      FileStorageSecurityService.createSignedDownloadUrl(uploadId, userBetaRegular),
    ).rejects.toThrow(TenantIsolationViolationError);
  });

  it("Requirement 4: Service credentials NEVER reach the browser (Zero service_role leakage)", () => {
    // Audit environment secrets
    const audit = SecurityHardeningService.auditEnvironmentSecrets();
    expect(audit.isSecure).toBe(true);
    expect(audit.leakedKeys).toHaveLength(0);

    // Verify SUPABASE_SERVICE_ROLE_KEY is not exposed
    const envVars = [
      typeof import.meta !== "undefined" ? (import.meta as any).env : {},
      typeof process !== "undefined" ? process.env : {},
    ];

    for (const envObj of envVars) {
      if (!envObj) continue;
      // Client-facing keys must not contain service_role
      for (const [key, val] of Object.entries(envObj)) {
        if (key.startsWith("VITE_") && typeof val === "string") {
          expect(key).not.toContain("SERVICE_ROLE");
          expect(val).not.toContain("service_role");
        }
      }
    }
  });

  it("Requirement 5: Admin functions are strictly protected (Independent of UI route protection)", () => {
    // Non-admin user attempts admin function -> REJECTED
    expect(() => {
      SecurityHardeningService.assertAdminPrivilege(userAlphaRegular, "PERM_MANAGE_ORGANISATION");
    }).toThrowError(/ADMIN_ACCESS_DENIED/);

    expect(() => {
      SecurityHardeningService.assertAdminPrivilege(userAlphaReadOnly, "PERM_MANAGE_USERS");
    }).toThrowError(/ADMIN_ACCESS_DENIED/);

    // Organisation Admin can manage their organisation
    expect(() => {
      SecurityHardeningService.assertAdminPrivilege(userAlphaAdmin, "PERM_MANAGE_ORGANISATION");
    }).not.toThrow();

    // Super Admin has global override
    expect(() => {
      SecurityHardeningService.assertAdminPrivilege(superAdmin, "PERM_MANAGE_ORGANISATION");
    }).not.toThrow();
  });

  it("Requirement 6: Comprehensive Security Audit verifies all 10 security domains", () => {
    const report: ComprehensiveSecurityAuditReport =
      SecurityHardeningService.runComprehensiveSecurityAudit();

    expect(report.totalChecks).toBe(10);
    expect(report.vulnerabilityCount).toBe(0);
    expect(report.isFullyHardened).toBe(true);

    const categories = report.checks.map((c) => c.category);
    expect(categories).toContain("AUTHENTICATION");
    expect(categories).toContain("AUTHORIZATION");
    expect(categories).toContain("ROW_LEVEL_SECURITY");
    expect(categories).toContain("STORAGE_PERMISSIONS");
    expect(categories).toContain("DATABASE_POLICIES");
    expect(categories).toContain("API_ACCESS");
    expect(categories).toContain("SERVICE_ROLES");
    expect(categories).toContain("ENVIRONMENT_VARIABLES");
    expect(categories).toContain("FRONTEND_EXPOSURE");
    expect(categories).toContain("ADMIN_PERMISSIONS");

    for (const check of report.checks) {
      expect(check.status).toBe("SECURE");
    }
  });

  it("Requirement 7: Do not assume frontend route protection is sufficient (Direct backend domain calls fail safely)", () => {
    // Simulates an attacker bypassing TanStack Router guards and calling domain logic directly with no or spoofed context
    const spoofedContext: UserSecurityContext = {
      userId: "attacker-666",
      email: "attacker@evil.com",
      organisationId: "attacker-org-999",
      role: "READ_ONLY",
      permissions: ["PERM_VIEW_DATA"],
    };

    // Attacker tries to modify Org Alpha invoice directly through security service
    expect(() => {
      SecurityHardeningService.assertUserOwnsRecord(
        spoofedContext,
        { organisation_id: ORG_ALPHA, id: "inv-alpha-001" },
        "MODIFY",
      );
    }).toThrowError(TenantIsolationViolationError);

    // Attacker tries to invoke admin function directly
    expect(() => {
      SecurityHardeningService.assertAdminPrivilege(spoofedContext, "PERM_MANAGE_ORGANISATION");
    }).toThrowError(/ADMIN_ACCESS_DENIED/);
  });
});
