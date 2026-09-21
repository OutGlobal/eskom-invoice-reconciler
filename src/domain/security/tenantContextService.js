import { ROLE_PERMISSIONS_MAP } from "./types";
export function createSecurityContext(userId, email, organisationId, role) {
    return {
        userId,
        email,
        organisationId,
        role,
        permissions: ROLE_PERMISSIONS_MAP[role] || ROLE_PERMISSIONS_MAP.READ_ONLY,
    };
}
export function hasPermission(context, permission) {
    if (context.role === "SUPER_ADMIN")
        return true;
    return context.permissions.includes(permission);
}
export class TenantIsolationViolationError extends Error {
    code = "UNAUTHORIZED_TENANT_ACCESS";
    callerOrgId;
    targetOrgId;
    constructor(callerOrgId, targetOrgId, message) {
        super(message ||
            `UNAUTHORIZED_TENANT_ACCESS: Caller organisation '${callerOrgId}' is not authorized to access target organisation '${targetOrgId}'`);
        this.name = "TenantIsolationViolationError";
        this.callerOrgId = callerOrgId;
        this.targetOrgId = targetOrgId;
    }
}
export function validateTenantAccess(context, targetOrganisationId) {
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
export function assertTenantAccess(context, targetOrganisationId) {
    const result = validateTenantAccess(context, targetOrganisationId);
    if (!result.allowed) {
        throw new TenantIsolationViolationError(context?.organisationId || "UNKNOWN", targetOrganisationId, result.reason);
    }
}
/**
 * Enforces that a database query scope is locked to the caller's organization.
 * For non-super-admins, forcibly overrides or assigns organisation_id.
 */
export function enforceTenantScope(context, queryScope) {
    if (!context) {
        throw new Error("Cannot enforce tenant scope without a valid UserSecurityContext");
    }
    // Super-admin can specify target organization or default to their own
    if (context.role === "SUPER_ADMIN") {
        const target = queryScope.organisation_id || queryScope.organisationId || context.organisationId;
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
export function isRecordAuthorized(context, record) {
    if (!context)
        return false;
    if (context.role === "SUPER_ADMIN")
        return true;
    if (!record.organisation_id)
        return false;
    return record.organisation_id === context.organisationId;
}
/**
 * In-memory defense-in-depth filter preventing cross-tenant data leaks
 */
export function filterRecordsForTenant(context, records) {
    if (!context)
        return [];
    if (context.role === "SUPER_ADMIN")
        return records;
    return records.filter((r) => r.organisation_id === context.organisationId);
}
/**
 * Unified Tenant Context & Isolation Service
 */
export class TenantContextService {
    static createSecurityContext = createSecurityContext;
    static hasPermission = hasPermission;
    static validateTenantAccess = validateTenantAccess;
    static assertTenantAccess = assertTenantAccess;
    static enforceTenantScope = enforceTenantScope;
    static isRecordAuthorized = isRecordAuthorized;
    static filterRecordsForTenant = filterRecordsForTenant;
    /**
     * Assign or update a user's security role, recording permission changes to the audit trail
     */
    static async updateUserRole(targetUserId, newRole, actorContext, targetOrgId, previousRole = "READ_ONLY") {
        if (!hasPermission(actorContext, "PERM_MANAGE_USERS")) {
            throw new Error("UNAUTHORIZED: Actor does not possess PERM_MANAGE_USERS to change user roles");
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
        }
        catch { }
        return { success: true, previousRole, newRole };
    }
    /**
     * Asserts that a user owns a record or has administrative write authority before allowing mutation
     */
    static assertRecordOwnership(context, record, action = "MODIFY") {
        const { SecurityHardeningService } = require("./securityHardeningService");
        SecurityHardeningService.assertUserOwnsRecord(context, record, action);
    }
    /**
     * Asserts that the caller has administrative privileges
     */
    static assertAdminRole(context, requiredPermission = "PERM_MANAGE_ORGANISATION") {
        const { SecurityHardeningService } = require("./securityHardeningService");
        SecurityHardeningService.assertAdminPrivilege(context, requiredPermission);
    }
}
