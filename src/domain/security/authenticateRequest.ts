import { createClient } from "@supabase/supabase-js";
import { identityFromVerifiedUser, trustedIdentityHeaders } from "./verifiedIdentity";
import type { SecurityPermission } from "./types";

export async function authenticateRequest(request: Request): Promise<Request | Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  if (!token) return deny(401, "Authentication required");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return deny(503, "Authentication service unavailable");
  try {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return deny(401, "Invalid or expired session");
    let identity;
    try {
      identity = identityFromVerifiedUser(data.user);
    } catch {
      return deny(403, "Organisation access has not been provisioned");
    }
    const path = new URL(request.url).pathname;
    const permission: SecurityPermission =
      request.method === "GET"
        ? "PERM_VIEW_DATA"
        : path.startsWith("/api/uploads")
          ? "PERM_UPLOAD_FILES"
          : "PERM_RUN_RECONCILIATION";
    if (!identity.permissions.includes(permission)) return deny(403, "Permission denied");
    return new Request(request, { headers: trustedIdentityHeaders(request.headers, identity) });
  } catch {
    return deny(503, "Authentication service unavailable");
  }
}
