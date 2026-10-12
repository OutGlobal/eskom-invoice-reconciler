import { describe, it, expect, vi } from "vitest";
vi.mock("../supabase", () => ({ supabase: {} }));
import { validateBackup } from "../workspaceBackup";
const valid = () => ({
  version: 1,
  userId: "user-a",
  organisationId: "org-a",
  createdAt: new Date().toISOString(),
  workspace: { uploads: [], customers: [], tariffs: [], dataset: null },
  files: [],
});
describe("workspace backup validation", () => {
  it("accepts a versioned account-scoped snapshot", () => {
    expect(() => validateBackup(valid(), "user-a", "org-a")).not.toThrow();
  });
  it("rejects different users and organisations", () => {
    expect(() => validateBackup(valid(), "user-b", "org-a")).toThrow();
    expect(() => validateBackup(valid(), "user-a", "org-b")).toThrow();
  });
  it("rejects malformed records and unknown versions", () => {
    expect(() => validateBackup({ ...valid(), version: 2 }, "user-a", "org-a")).toThrow();
    expect(() =>
      validateBackup(
        { ...valid(), workspace: { uploads: [{}], customers: [], tariffs: [] } },
        "user-a",
        "org-a",
      ),
    ).toThrow();
  });
  it("rejects invalid interval timestamps", () => {
    expect(() =>
      validateBackup(
        {
          ...valid(),
          workspace: {
            ...valid().workspace,
            dataset: { key: "active", rows: [{ ts: "invalid" }] },
          },
        },
        "user-a",
        "org-a",
      ),
    ).toThrow();
  });
});
