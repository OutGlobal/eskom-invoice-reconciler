import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  identityFromVerifiedUser,
  trustedIdentityHeaders,
} from "../../domain/security/verifiedIdentity";
import { setWorkspaceScope, clearWorkspaceScope, scopedDatabaseName } from "../workspaceIdentity";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser } }) }));
import { authenticateRequest } from "../../domain/security/authenticateRequest";

const user = {
  id: "user-a",
  email: "user@example.test",
  app_metadata: { organisation_id: "org-a", role: "ANALYST" },
};
describe("production identity and cache hardening", () => {
  beforeEach(() => {
    clearWorkspaceScope();
    getUser.mockReset();
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-public-key");
  });
  it("requires administrator-provisioned organisation and role", () => {
    expect(() => identityFromVerifiedUser({ id: "x" })).toThrow();
    expect(() =>
      identityFromVerifiedUser({
        ...user,
        app_metadata: { organisation_id: "org-a", role: "toString" },
      }),
    ).toThrow();
    expect(identityFromVerifiedUser(user).role).toBe("ANALYST");
  });
  it("overwrites forged tenant and role headers", () => {
    const headers = trustedIdentityHeaders(
      new Headers({
        "X-Tenant-ID": "org-b",
        "X-User-Role": "SUPER_ADMIN",
        "x-organisation-id": "org-c",
        "X-User-ID": "victim",
      }),
      identityFromVerifiedUser(user),
    );
    expect(headers.get("X-Tenant-ID")).toBe("org-a");
    expect(headers.get("X-User-Role")).toBe("ANALYST");
    expect(headers.get("X-User-ID")).toBe("user-a");
    expect(headers.has("x-organisation-id")).toBe(false);
  });
  it("refuses unauthenticated requests even with admin headers", async () => {
    const result = await authenticateRequest(
      new Request("https://example.test/api/jobs", { headers: { "X-User-Role": "SUPER_ADMIN" } }),
    );
    expect((result as Response).status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });
  it("rejects invalid and unprovisioned sessions", async () => {
    const request = new Request("https://example.test/api/uploads", {
      headers: { authorization: "Bearer test" },
    });
    getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid") });
    expect(((await authenticateRequest(request)) as Response).status).toBe(401);
    getUser.mockResolvedValueOnce({
      data: { user: { id: "x", user_metadata: { role: "SUPER_ADMIN", organisation_id: "org-a" } } },
      error: null,
    });
    expect(((await authenticateRequest(request)) as Response).status).toBe(403);
  });
  it("denies uploads for read-only users", async () => {
    getUser.mockResolvedValue({
      data: { user: { ...user, app_metadata: { ...user.app_metadata, role: "READ_ONLY" } } },
      error: null,
    });
    const result = await authenticateRequest(
      new Request("https://example.test/api/uploads/ingest", {
        method: "POST",
        headers: { authorization: "Bearer test", "X-User-Role": "SUPER_ADMIN" },
      }),
    );
    expect((result as Response).status).toBe(403);
  });
  it("accepts verified identity, not forged headers", async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    const result = await authenticateRequest(
      new Request("https://example.test/api/jobs", {
        method: "POST",
        headers: { authorization: "Bearer test", "X-User-Role": "SUPER_ADMIN" },
      }),
    );
    expect(result).toBeInstanceOf(Request);
    expect((result as Request).headers.get("X-User-Role")).toBe("ANALYST");
  });
  it("separates users and organisations and rejects signed-out cache access", () => {
    expect(() => scopedDatabaseName("workspace")).toThrow();
    setWorkspaceScope("user-a", "org-a");
    const first = scopedDatabaseName("workspace");
    setWorkspaceScope("user-b", "org-a");
    expect(scopedDatabaseName("workspace")).not.toBe(first);
    setWorkspaceScope("user-a", "org-b");
    expect(scopedDatabaseName("workspace")).not.toBe(first);
    clearWorkspaceScope();
    expect(() => scopedDatabaseName("workspace")).toThrow();
  });
});
