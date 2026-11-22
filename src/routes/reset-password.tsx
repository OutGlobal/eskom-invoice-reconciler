import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, Loader2, LockKeyhole } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset your password — ENERA AI" }] }),
  component: ResetPasswordPage,
});

type Status = "verifying" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const mark = (next: Status) => { if (mounted) setStatus(next); };
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") mark("ready");
    });
    const verify = async () => {
      try {
        // Supabase can deliver a recovery session as a URL hash (implicit),
        // a code (PKCE), or a token_hash (custom recovery email template).
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const query = new URLSearchParams(window.location.search);
        const authError = hash.get("error_description") || query.get("error_description");
        if (authError) throw new Error("This recovery link is invalid or has expired.");
        const tokenHash = query.get("token_hash");
        const code = query.get("code");
        if (tokenHash && query.get("type") === "recovery") {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (error) throw error;
          mark("ready");
        } else if (code) {
          // Supabase may exchange the PKCE code automatically during client initialization.
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          }
          mark("ready");
        } else if (hash.get("access_token") && hash.get("refresh_token") && hash.get("type") === "recovery") {
          const { error } = await supabase.auth.setSession({
            access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")!,
          });
          if (error) throw error;
          mark("ready");
        } else {
          // Supabase may have already consumed the callback before React mounts.
          const { data: { session } } = await supabase.auth.getSession();
          if (session && window.sessionStorage.getItem("enera_recovery_pending") === "true") mark("ready");
          else mark("invalid");
        }
      } catch {
        mark("invalid");
      }
    };
    const url = new URL(window.location.href);
    if (url.searchParams.has("code") || url.searchParams.has("token_hash") || window.location.hash.includes("type=recovery")) {
      window.sessionStorage.setItem("enera_recovery_pending", "true");
    }
    void verify();
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (password.length < 12) return setMessage("Use at least 12 characters.");
    if (password !== confirm) return setMessage("Passwords do not match.");
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Recovery session expired. Request a new link.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.sessionStorage.removeItem("enera_recovery_pending");
      setStatus("done");
      await supabase.auth.signOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update password.");
    } finally { setBusy(false); }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] px-4 text-white">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-cyan-500/20 bg-slate-900 p-8 shadow-xl">
        <div className="flex items-center gap-3 text-cyan-400"><ShieldCheck size={28} /><span className="font-semibold tracking-widest">ENERA AI</span></div>
        <h1 className="text-2xl font-bold">Reset your password</h1>
        {status === "verifying" && <p className="flex items-center gap-2 text-slate-300"><Loader2 className="animate-spin" size={18} /> Verifying your secure recovery link…</p>}
        {status === "invalid" && <div className="space-y-3"><p role="alert" className="text-rose-300">This password reset link is invalid, expired, or has already been used. Request a new one from the login page.</p><Link to="/login" className="inline-block text-cyan-400 underline">Return to login</Link></div>}
        {status === "done" && <div className="space-y-3"><p role="status" className="text-emerald-300">Your password has been updated successfully. Sign in using your new password.</p><Link to="/login" className="inline-block text-cyan-400 underline">Sign in to ENERA</Link></div>}
        {status === "ready" && <form onSubmit={updatePassword} className="space-y-4">
          <p className="text-sm text-slate-300">Choose a new password for your verified ENERA account.</p>
          <label className="block text-sm">New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white" /></label>
          <label className="block text-sm">Confirm new password<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white" /></label>
          {message && <p role="alert" className="text-sm text-rose-300">{message}</p>}
          <button disabled={busy} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 p-3 font-semibold text-slate-950 disabled:opacity-50"><LockKeyhole size={18} />{busy ? "Updating password…" : "Save new password"}</button>
        </form>}
      </section>
    </main>
  );
}
