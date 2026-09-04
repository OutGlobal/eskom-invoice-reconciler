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

export function hasPermission(context: UserSecurityContext, permission: SecurityPermission): boolean {
  if (context.role === "SUPER_ADMIN") return true;
  return context.permissions.includes(permission);
}

export function validateTenantAccess(
  context: UserSecurityContext,
  targetOrganisationId: string,
): { allowed: boolean; reason?: string } {
  if (context.role === "SUPER_ADMIN") {
    return { allowed: true };
  }

  if (!context.organisationId || !targetOrganisationId) {
    return { allowed: false, reason: "Missing organisation ID in security context" };
  }

  if (context.organisationId !== targetOrganisationId) {
    return {
      allowed: false,
      reason: `UNAUTHORIZED_TENANT_ACCESS: User organisation '${context.organisationId}' cannot access target organisation '${targetOrganisationId}'`,
    };
  }

  return { allowed: true };
}
