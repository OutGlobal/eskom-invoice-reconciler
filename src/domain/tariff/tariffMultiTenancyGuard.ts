/**
 * ENERA TARIFF MULTI-TENANCY & SECURITY GUARD (REQUIREMENT 24)
 * =============================================================
 * Enforces strict multi-tenant isolation, role-based authorization (RBAC),
 * and zero-exposure security boundaries across tariffs, calculations,
 * source documents, and audit logs.
 *
 * KEY RULES:
 *   1. Distinguishes centrally maintained utility tariffs (Eskom national,
 *      City Power, eThekwini) from organisation-specific private tariffs.
 *   2. Centrally maintained tariffs (organisationId === null || isCentral === true):
 *      - Readable by all authenticated tenants.
 *      - Modifiable and approvable ONLY by SUPER_ADMIN.
 *   3. Organisation-specific private tariffs:
 *      - Strictly isolated to the owner tenant.
 *      - Cannot be accessed or modified by other organisations.
 *   4. Calculation runs, source documents, and audit logs:
 *      - 100% tenant-isolated. Cross-tenant access triggers TenantIsolationViolationError.
 *   5. Zero Exposure (ENERA Level 3 Embargo):
 *      - Never expose service-role keys, database passwords, internal tokens, or
 *        another organisation's private tariff rates to the client bundle.
 */

import type { UserSecurityContext, SecurityPermission } from "../security/types";
import {
  TenantIsolationViolationError,
  hasPermission,
} from "../security/tenantContextService";

export interface TariffSecurityRecord {
  id?: string;
  tariff_code?: string;
  tariff_name?: string;
  organisation_id?: string | null;
  organisationId?: string | null;
  is_central?: boolean;
  isCentral?: boolean;
  status?: string;
  approval_status?: string;
  [key: string]: any;
}

export interface CalculationSecurityRecord {
  id?: string;
  run_id?: string;
  organisation_id?: string;
  organisationId?: string;
  [key: string]: any;
}

export interface DocumentSecurityRecord {
  id?: string;
  organisation_id?: string;
  organisationId?: string;
  [key: string]: any;
}

export class TariffMultiTenancyGuard {
  /**
   * Resolves the organisation ID from a generic record format
   */
  public static extractOrgId(record: {
    organisation_id?: string | null;
    organisationId?: string | null;
  }): string | null {
    if (record.organisation_id !== undefined) return record.organisation_id;
    if (record.organisationId !== undefined) return record.organisationId;
    return null;
  }

  /**
   * Checks whether a tariff is centrally maintained (national utility or municipality)
   */
  public static isCentralTariff(tariff: TariffSecurityRecord): boolean {
    if (tariff.is_central === true || tariff.isCentral === true) return true;
    const orgId = this.extractOrgId(tariff);
    return orgId === null || orgId === undefined || orgId === "" || orgId === "CENTRAL";
  }

  /**
   * Asserts whether the caller can read the target tariff.
   * Central tariffs are readable by all authenticated tenants.
   * Private tariffs are strictly restricted to the owning tenant or SUPER_ADMIN.
   */
  public static assertCanReadTariff(
    context: UserSecurityContext,
    tariff: TariffSecurityRecord,
  ): void {
    if (!context) {
      throw new Error("UNAUTHENTICATED: Security context is required to access tariffs.");
    }

    if (context.role === "SUPER_ADMIN") return;

    if (this.isCentralTariff(tariff)) {
      // Central utility tariffs are public to all authenticated platform tenants
      return;
    }

    const targetOrgId = this.extractOrgId(tariff);
    if (!targetOrgId || targetOrgId !== context.organisationId) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        targetOrgId || "UNKNOWN_TENANT",
        `Access denied: Organisation '${context.organisationId}' cannot view private tariff belonging to '${targetOrgId}'.`,
      );
    }
  }

  /**
   * Asserts whether the caller can modify or update the target tariff.
   * Central tariffs: SUPER_ADMIN only.
   * Tenant tariffs: Owning tenant with management permissions or SUPER_ADMIN.
   */
  public static assertCanModifyTariff(
    context: UserSecurityContext,
    tariff: TariffSecurityRecord,
  ): void {
    if (!context) {
      throw new Error("UNAUTHENTICATED: Security context is required to modify tariffs.");
    }

    if (context.role === "SUPER_ADMIN") return;

    if (this.isCentralTariff(tariff)) {
      throw new Error(
        `FORBIDDEN: Centrally maintained utility tariff [${tariff.tariff_code || tariff.id || "CENTRAL"}] can only be modified by platform Super Administrators.`,
      );
    }

    const targetOrgId = this.extractOrgId(tariff);
    if (!targetOrgId || targetOrgId !== context.organisationId) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        targetOrgId || "UNKNOWN_TENANT",
        `Access denied: Organisation '${context.organisationId}' cannot modify private tariff belonging to '${targetOrgId}'.`,
      );
    }

    // Role check: Only ORGANISATION_ADMIN or ENERGY_MANAGER can configure organisation tariffs
    const allowedRoles = ["ORGANISATION_ADMIN", "ENERGY_MANAGER"];
    if (!allowedRoles.includes(context.role)) {
      throw new Error(
        `FORBIDDEN: Role '${context.role}' does not have permission to modify tariff configurations. Required: ORGANISATION_ADMIN or ENERGY_MANAGER.`,
      );
    }
  }

  /**
   * Asserts whether the caller can approve a tariff version for production use.
   * Central tariffs: SUPER_ADMIN only.
   * Tenant tariffs: ORGANISATION_ADMIN or reviewer in the owning tenant.
   */
  public static assertCanApproveTariff(
    context: UserSecurityContext,
    tariff: TariffSecurityRecord,
  ): void {
    if (!context) {
      throw new Error("UNAUTHENTICATED: Security context is required to approve tariffs.");
    }

    if (context.role === "SUPER_ADMIN") return;

    if (this.isCentralTariff(tariff)) {
      throw new Error(
        "FORBIDDEN: Publishing centrally maintained utility tariffs requires platform Super Admin approval.",
      );
    }

    const targetOrgId = this.extractOrgId(tariff);
    if (!targetOrgId || targetOrgId !== context.organisationId) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        targetOrgId || "UNKNOWN_TENANT",
        `Access denied: Cannot approve tariff belonging to organisation '${targetOrgId}'.`,
      );
    }

    const isOrgAdmin = context.role === "ORGANISATION_ADMIN";
    const canApprove = hasPermission(context, "PERM_APPROVE_FINDINGS");
    if (!isOrgAdmin && !canApprove) {
      throw new Error(
        `FORBIDDEN: User '${context.email}' lacks tariff approval authority for organisation '${context.organisationId}'.`,
      );
    }
  }

  /**
   * Asserts whether the caller can run import jobs for tariffs.
   */
  public static assertCanImportTariff(
    context: UserSecurityContext,
    targetOrgId?: string | null,
  ): void {
    if (!context) {
      throw new Error("UNAUTHENTICATED: Security context required for tariff import.");
    }

    if (context.role === "SUPER_ADMIN") return;

    if (!targetOrgId || targetOrgId === "CENTRAL") {
      throw new Error("FORBIDDEN: Only Super Administrators may import central utility tariffs.");
    }

    if (targetOrgId !== context.organisationId) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        targetOrgId,
        `Access denied: Cannot import tariffs into target organisation '${targetOrgId}'.`,
      );
    }

    if (!hasPermission(context, "PERM_UPLOAD_FILES") && context.role !== "ENERGY_MANAGER") {
      throw new Error(
        `FORBIDDEN: Role '${context.role}' does not have file/tariff import permissions.`,
      );
    }
  }

  /**
   * Asserts whether the caller can view a calculation run result.
   * Strictly tenant-isolated.
   */
  public static assertCanReadCalculationRun(
    context: UserSecurityContext,
    run: CalculationSecurityRecord,
  ): void {
    if (!context) {
      throw new Error("UNAUTHENTICATED: Security context is required to view calculation results.");
    }

    if (context.role === "SUPER_ADMIN") return;

    const runOrgId = this.extractOrgId(run);
    if (!runOrgId || runOrgId !== context.organisationId) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        runOrgId || "UNKNOWN_TENANT",
        `Access denied: Cannot access calculation run belonging to organisation '${runOrgId}'.`,
      );
    }
  }

  /**
   * Asserts whether the caller can trigger a recalculation workflow.
   * Requires reconciliation execution permissions within the caller's tenant.
   */
  public static assertCanRecalculate(
    context: UserSecurityContext,
    run: CalculationSecurityRecord,
  ): void {
    this.assertCanReadCalculationRun(context, run);

    if (context.role === "SUPER_ADMIN") return;

    if (!hasPermission(context, "PERM_RUN_RECONCILIATION")) {
      throw new Error(
        `FORBIDDEN: User '${context.email}' lacks PERM_RUN_RECONCILIATION to trigger recalculations.`,
      );
    }
  }

  /**
   * Asserts access to source documents (invoices, meter interval files).
   */
  public static assertCanAccessSourceDocument(
    context: UserSecurityContext,
    doc: DocumentSecurityRecord,
  ): void {
    if (!context) {
      throw new Error("UNAUTHENTICATED: Security context is required to access source documents.");
    }

    if (context.role === "SUPER_ADMIN") return;

    const docOrgId = this.extractOrgId(doc);
    if (!docOrgId || docOrgId !== context.organisationId) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        docOrgId || "UNKNOWN_TENANT",
        `Access denied: Cannot access source document belonging to organisation '${docOrgId}'.`,
      );
    }
  }

  /**
   * Asserts access to tenant audit log entries.
   */
  public static assertCanAccessAuditLog(
    context: UserSecurityContext,
    targetOrgId: string,
  ): void {
    if (!context) {
      throw new Error("UNAUTHENTICATED: Security context is required to access audit ledger.");
    }

    if (context.role === "SUPER_ADMIN") return;

    if (context.organisationId !== targetOrgId) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        targetOrgId,
        `Access denied: Cannot access audit logs of organisation '${targetOrgId}'.`,
      );
    }

    if (!hasPermission(context, "PERM_VIEW_AUDIT_LEDGER")) {
      throw new Error(
        `FORBIDDEN: User '${context.email}' lacks PERM_VIEW_AUDIT_LEDGER permissions.`,
      );
    }
  }

  /**
   * Filters a list of tariffs to only those visible to the caller:
   * 1. All centrally maintained utility tariffs
   * 2. Private tariffs belonging strictly to the caller's organisation
   */
  public static filterVisibleTariffs<T extends TariffSecurityRecord>(
    context: UserSecurityContext,
    tariffs: T[],
  ): T[] {
    if (!context) return [];
    if (context.role === "SUPER_ADMIN") return [...tariffs];

    return tariffs.filter((t) => {
      if (this.isCentralTariff(t)) return true;
      const orgId = this.extractOrgId(t);
      return orgId === context.organisationId;
    });
  }

  /**
   * Sanitizes tariff payload before returning to client.
   * Strips database credentials, internal service role secrets, or
   * private configuration properties in accordance with ENERA Level 3 Embargo.
   */
  public static sanitizeTariffForClient<T extends Record<string, any>>(tariff: T): Partial<T> {
    if (!tariff || typeof tariff !== "object") return tariff;

    const sanitized = { ...tariff };

    // Strip sensitive / private fields
    const embargoKeys = [
      "service_role_key",
      "supabase_service_role_key",
      "db_password",
      "internal_db_host",
      "system_prompt",
      "jwt_secret",
      "raw_sql",
      "api_secret",
      "internal_credentials",
    ];

    for (const key of embargoKeys) {
      delete sanitized[key];
    }

    return sanitized;
  }
}
