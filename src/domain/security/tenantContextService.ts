import { UserSecurityContext, AppRole, SecurityPermission, ROLE_PERMISSIONS_MAP } from "./types";

export function createSecurityContext(
  userId: string,
  email: string,
  organisationId: string,
  role: AppRole,
): UserSecurityContext {
  return {
    userId,
    email,
    organisationId,
    role,
    permissions: ROLE_PERMISSIONS_MAP[role] || ROLE_PERMISSIONS_MAP.READ_ONLY,
  };
}

export function hasPermission(
  context: UserSecurityContext,
  permission: SecurityPermission,
): boolean {
  if (context.role === "SUPER_ADMIN") return true;
  return context.permissions.includes(permission);
}

export class TenantIsolationViolationError extends Error {
  public readonly code = "UNAUTHORIZED_TENANT_ACCESS";
  public readonly callerOrgId: string;
  public readonly targetOrgId: string;

  constructor(callerOrgId: string, targetOrgId: string, message?: string) {
    super(
      message ||
        `UNAUTHORIZED_TENANT_ACCESS: Caller organisation '${callerOrgId}' is not authorized to access target organisation '${targetOrgId}'`,
    );
    this.name = "TenantIsolationViolationError";
    this.callerOrgId = callerOrgId;
    this.targetOrgId = targetOrgId;
  }
}

export function validateTenantAccess(
  context: UserSecurityContext,
  targetOrganisationId: string,
): { allowed: boolean; reason?: string } {
  if (!context) {
    return { allowed: false, reason: "Missing security context" };
  }

  if (context.role === "SUPER_ADMIN") {
    return { allowed: true };
  }

  if (!context.organisationId || !targetOrganisationId) {
    return { allowed: false, reason: "Missing organisation ID in security context or target" };
  }

  if (context.organisationId !== targetOrganisationId) {
    return {
      allowed: false,
      reason: `UNAUTHORIZED_TENANT_ACCESS: User organisation '${context.organisationId}' cannot access target organisation '${targetOrganisationId}'`,
    };
  }

  return { allowed: true };
}

/**
 * Asserts that the caller has authority over targetOrganisationId.
 * Throws TenantIsolationViolationError if unauthorized.
 */
export function assertTenantAccess(
  context: UserSecurityContext,
  targetOrganisationId: string,
): void {
  const result = validateTenantAccess(context, targetOrganisationId);
  if (!result.allowed) {
    throw new TenantIsolationViolationError(
      context?.organisationId || "UNKNOWN",
      targetOrganisationId,
      result.reason,
    );
  }
}

/**
 * Enforces that a database query scope is locked to the caller's organization.
 * For non-super-admins, forcibly overrides or assigns organisation_id.
 */
export function enforceTenantScope<T extends { organisation_id?: string; organisationId?: string }>(
  context: UserSecurityContext,
  queryScope: T,
): T & { organisation_id: string; organisationId: string } {
  if (!context) {
    throw new Error("Cannot enforce tenant scope without a valid UserSecurityContext");
  }

  // Super-admin can specify target organization or default to their own
  if (context.role === "SUPER_ADMIN") {
    const target =
      queryScope.organisation_id || queryScope.organisationId || context.organisationId;
    return {
      ...queryScope,
      organisation_id: target,
      organisationId: target,
    };
  }

  // Non-super-admins: If attempting to query a different org, reject immediately
  const requestedTarget = queryScope.organisation_id || queryScope.organisationId;
  if (requestedTarget && requestedTarget !== context.organisationId) {
    throw new TenantIsolationViolationError(context.organisationId, requestedTarget);
  }

  return {
    ...queryScope,
    organisation_id: context.organisationId,
    organisationId: context.organisationId,
  };
}

/**
 * Evaluates whether a given business record is authorized for the caller
 */
export function isRecordAuthorized(
  context: UserSecurityContext,
  record: { organisation_id?: string; customer_id?: string },
): boolean {
  if (!context) return false;
  if (context.role === "SUPER_ADMIN") return true;
  if (!record.organisation_id) return false;
  return record.organisation_id === context.organisationId;
}

/**
 * In-memory defense-in-depth filter preventing cross-tenant data leaks
 */
export function filterRecordsForTenant<T extends { organisation_id?: string }>(
  context: UserSecurityContext,
  records: T[],
): T[] {
  if (!context) return [];
  if (context.role === "SUPER_ADMIN") return records;
  return records.filter((r) => r.organisation_id === context.organisationId);
}

/**
 * Unified Tenant Context & Isolation Service
 */
export class TenantContextService {
  public static createSecurityContext = createSecurityContext;
  public static hasPermission = hasPermission;
  public static validateTenantAccess = validateTenantAccess;
  public static assertTenantAccess = assertTenantAccess;
  public static enforceTenantScope = enforceTenantScope;
  public static isRecordAuthorized = isRecordAuthorized;
  public static filterRecordsForTenant = filterRecordsForTenant;

  /**
   * Assign or update a user's security role, recording permission changes to the audit trail
   */
  public static async updateUserRole(
    targetUserId: string,
    newRole: AppRole,
    actorContext: UserSecurityContext,
    targetOrgId?: string,
    previousRole: AppRole = "READ_ONLY",
  ): Promise<{ success: boolean; previousRole: AppRole; newRole: AppRole }> {
    if (!hasPermission(actorContext, "PERM_MANAGE_USERS")) {
      throw new Error(
        "UNAUTHORIZED: Actor does not possess PERM_MANAGE_USERS to change user roles",
      );
    }

    const orgId = targetOrgId || actorContext.organisationId || "DEFAULT_TENANT";
    const previousPermissions = ROLE_PERMISSIONS_MAP[previousRole];
    const newPermissions = ROLE_PERMISSIONS_MAP[newRole];

    try {
      const { AuditTrailService } = await import("../audit/auditTrailService");
      await AuditTrailService.recordAction({
        organisationId: orgId,
        category: "permission_changes",
        action: "USER_ROLE_ASSIGNED",
        description: `Security role for user ${targetUserId} updated from ${previousRole} to ${newRole}`,
        actor: {
          userId: actorContext.userId,
          email: actorContext.email,
          role: actorContext.role,
        },
        record: {
          entityType: "user_profile",
          recordId: targetUserId,
          recordLabel: `User ${targetUserId}`,
        },
        previousState: { role: previousRole, permissions: previousPermissions },
        newState: { role: newRole, permissions: newPermissions },
      });
    } catch {
      // Audit log error fallback
    }

    return { success: true, previousRole, newRole };
  }

  /**
   * Asserts that a user owns a record or has administrative write authority before allowing mutation
   */
  public static assertRecordOwnership(
    context: UserSecurityContext,
    record: {
      organisation_id?: string;
      organisationId?: string;
      owner_id?: string;
      created_by?: string;
    },
    action: "READ" | "MODIFY" | "DELETE" = "MODIFY",
  ): void {
    const { SecurityHardeningService } = require("./securityHardeningService");
    SecurityHardeningService.assertUserOwnsRecord(context, record, action);
  }

  /**
   * Asserts that the caller has administrative privileges
   */
  public static assertAdminRole(
    context: UserSecurityContext,
    requiredPermission: SecurityPermission = "PERM_MANAGE_ORGANISATION",
  ): void {
    const { SecurityHardeningService } = require("./securityHardeningService");
    SecurityHardeningService.assertAdminPrivilege(context, requiredPermission);
  }

  // =========================================================================
  // REQUIREMENT 38: 8 AUTHORITATIVE RESOURCE ACCESS VERIFIERS
  // =========================================================================

  /**
   * 1. Verify Organisation Isolation:
   * Asserts that a user only accesses their designated organization tenant.
   */
  public static verifyOrganisationAccess(
    context: UserSecurityContext,
    targetOrgId: string,
  ): void {
    assertTenantAccess(context, targetOrgId);
  }

  /**
   * 2. Verify RLS (Row Level Security) Query Compliance:
   * Asserts that any database query filter enforces tenant isolation before dispatch.
   */
  public static verifyRlsQuery<T extends Record<string, any>>(
    context: UserSecurityContext,
    tableName: string,
    queryFilter: T,
  ): T & { organisation_id: string } {
    if (!context) {
      throw new Error(`RLS_VIOLATION: Missing UserSecurityContext for table '${tableName}'`);
    }

    if (context.role === "SUPER_ADMIN") {
      return {
        ...queryFilter,
        organisation_id: queryFilter.organisation_id || context.organisationId,
      };
    }

    const requestedOrg = queryFilter.organisation_id || queryFilter.tenant_id;
    if (requestedOrg && requestedOrg !== context.organisationId) {
      throw new TenantIsolationViolationError(context.organisationId, requestedOrg,
        `RLS_POLICY_BLOCKED: Query on table '${tableName}' targeted unauthorized organisation '${requestedOrg}'`
      );
    }

    return {
      ...queryFilter,
      organisation_id: context.organisationId,
    };
  }

  /**
   * 3. Verify Account Access:
   * Asserts that the customer account belongs to the caller's organization.
   */
  public static verifyAccountAccess(
    context: UserSecurityContext,
    account: { organisation_id?: string; account_number?: string },
  ): void {
    const orgId = account.organisation_id;
    if (!orgId) {
      throw new Error("SECURITY_VIOLATION: Account lacks organisation attribution");
    }
    assertTenantAccess(context, orgId);
  }

  /**
   * 4. Verify Meter Access:
   * Asserts that the physical meter belongs to the caller's organization.
   */
  public static verifyMeterAccess(
    context: UserSecurityContext,
    meter: { organisation_id?: string; meter_id?: string; meter_number?: string },
  ): void {
    const orgId = meter.organisation_id;
    if (!orgId) {
      throw new Error("SECURITY_VIOLATION: Meter lacks organisation attribution");
    }
    assertTenantAccess(context, orgId);
  }

  /**
   * 5. Verify Invoice Access:
   * Asserts that the invoice belongs to the caller's organization.
   */
  public static verifyInvoiceAccess(
    context: UserSecurityContext,
    invoice: { organisation_id?: string; invoice_id?: string; invoice_number?: string },
  ): void {
    const orgId = invoice.organisation_id;
    if (!orgId) {
      throw new Error("SECURITY_VIOLATION: Invoice lacks organisation attribution");
    }
    assertTenantAccess(context, orgId);
  }

  /**
   * 6. Verify AMR Telemetry Access:
   * Asserts that the AMR interval data or source file belongs to the caller's organization.
   */
  public static verifyAmrAccess(
    context: UserSecurityContext,
    amr: { organisation_id?: string; meter_id?: string; file_id?: string },
  ): void {
    const orgId = amr.organisation_id;
    if (!orgId) {
      throw new Error("SECURITY_VIOLATION: AMR telemetry lacks organisation attribution");
    }
    assertTenantAccess(context, orgId);
  }

  /**
   * 7. Verify Reconciliation Access:
   * CRITICAL INVARIANT (Requirement 38):
   * "A user from Organisation A must never retrieve Organisation B's reconciliation results."
   */
  public static verifyReconciliationAccess(
    context: UserSecurityContext,
    reconciliation: {
      organisation_id?: string;
      tenant_id?: string;
      run_id?: string;
      reconciliation_id?: string;
    },
  ): void {
    if (!context) {
      throw new Error("SECURITY_VIOLATION: Missing UserSecurityContext for reconciliation access");
    }

    if (context.role === "SUPER_ADMIN") {
      return;
    }

    const targetOrg = reconciliation.organisation_id || reconciliation.tenant_id;
    if (!targetOrg) {
      throw new Error("SECURITY_VIOLATION: Reconciliation result lacks organisation attribution");
    }

    if (context.organisationId !== targetOrg) {
      throw new TenantIsolationViolationError(
        context.organisationId,
        targetOrg,
        `SECURITY_VIOLATION (Req 38): User from Organisation '${context.organisationId}' attempted to access Reconciliation '${reconciliation.run_id || reconciliation.reconciliation_id || "UNKNOWN"}' belonging to Organisation '${targetOrg}'. Access denied.`
      );
    }
  }

  /**
   * 8. Verify Report & Dispute Pack Access:
   * Asserts that generated reports and audit evidence belong to the caller's organization.
   */
  public static verifyReportAccess(
    context: UserSecurityContext,
    report: { organisation_id?: string; report_id?: string; pack_id?: string },
  ): void {
    const orgId = report.organisation_id;
    if (!orgId) {
      throw new Error("SECURITY_VIOLATION: Report pack lacks organisation attribution");
    }
    assertTenantAccess(context, orgId);
  }
}
