/**
 * Supabase may redirect recovery emails to the configured Site URL if the
 * requested redirectTo URL is not allowlisted. Recognise only recovery links,
 * not ordinary sign-in, signup or magic-link callbacks.
 */
export function isPasswordRecoveryCallback(search: string, hash: string): boolean {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  if (query.get("type") === "recovery" || fragment.get("type") === "recovery") return true;
  if (query.get("token_hash") && query.get("type") === "recovery") return true;
  return false;
}

export function recoveryRedirectPath(search: string, hash: string): string | null {
  return isPasswordRecoveryCallback(search, hash) ? `/reset-password${search}${hash}` : null;
}
