import { describe, expect, it } from "vitest";
import { isPasswordRecoveryCallback, recoveryRedirectPath } from "../recoveryCallback";

describe("Supabase recovery callback routing", () => {
  it("routes fallback recovery hash from landing to reset page", () => {
    expect(recoveryRedirectPath("", "#access_token=sample&refresh_token=sample&type=recovery"))
      .toBe("/reset-password#access_token=sample&refresh_token=sample&type=recovery");
  });
  it("routes recovery token hash callbacks", () => {
    expect(recoveryRedirectPath("?token_hash=sample&type=recovery", ""))
      .toBe("/reset-password?token_hash=sample&type=recovery");
  });
  it("does not redirect ordinary sign in or unrelated callbacks", () => {
    expect(isPasswordRecoveryCallback("", "")).toBe(false);
    expect(recoveryRedirectPath("?code=signin", "")).toBeNull();
    expect(recoveryRedirectPath("", "#access_token=sample&type=signup")).toBeNull();
  });
});
