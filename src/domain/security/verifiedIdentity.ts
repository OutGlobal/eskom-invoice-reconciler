import { ROLE_PERMISSIONS_MAP, type AppRole, type UserSecurityContext } from "./types";
import { createSecurityContext } from "./tenantContextService";

/** Only auth-provider-owned app_metadata is trusted; never user_metadata or headers. */
export function identityFromVerifiedUser(user: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
}): UserSecurityContext {
  const org = user.app_metadata?.organisation_id;
  const role = user.app_metadata?.role;
  if (
    typeof org !== "string" ||
    !org.trim() ||
    typeof role !== "string" ||
    !Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS_MAP, role)
  ) {
    throw new Error("Organisation access has not been provisioned");
  }
  return createSecurityContext(user.id, user.email || "", org, role as AppRole);
}

export function trustedIdentityHeaders(headers: Headers, identity: UserSecurityContext): Headers {
  const result = new Headers(headers);
  for (const name of [
    "X-Tenant-ID",
    "x-organisation-id",
    "X-User-Role",
    "X-User-ID",
    "X-User-Email",
  ])
    result.delete(name);
  result.set("X-Tenant-ID", identity.organisationId);
  result.set("X-User-Role", identity.role);
  result.set("X-User-ID", identity.userId);
  result.set("X-User-Email", identity.email);
  return result;
}
