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
}
