import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LogIn, ShieldCheck, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

/**
 * Client-side session gate. The database enforces the real security boundary
 * (RLS policies scoped to the `authenticated` role); this simply makes the app
 * usable by acquiring a session before any Data API call is made.
 */
export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession()
      .then((res) => {
        if (!active) return;
        setSession(res?.data?.session || null);
        setReady(true);
      })
      .catch((err) => {
        console.warn("Supabase auth session fetch notice:", err);
        if (active) setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  return { session, ready };
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSupabaseSession();
  const [bypassAuth, setBypassAuth] = useState(false);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-semibold">Eskom Meter Data Reconciliation</span>
            <Loader2 className="ml-1 h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Verifying your secure session…</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-md border border-border bg-secondary/50"
              />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-lg border border-border bg-secondary/40" />
          <div className="h-56 animate-pulse rounded-lg border border-border bg-secondary/40" />
        </div>
      </div>
    );
  }

  if (!session && !bypassAuth) {
    return <SignInScreen onBypass={() => setBypassAuth(true)} />;
  }
  return <>{children}</>;
}

function friendlyAuthError(err: any): string {
  const code = err?.code || err?.error_code || "";
  const msg: string = err?.message || "Authentication failed";
  if (code === "invalid_credentials")
    return "Email or password is incorrect. If you have not registered yet, use Register below.";
  if (code === "email_not_confirmed")
    return "This account still needs email confirmation. Open the confirmation link we emailed you, then sign in.";
  if (code === "email_address_invalid")
    return "That email domain is not accepted by the identity provider. Use a real, deliverable mailbox.";
  if (code === "over_email_send_rate_limit")
    return "Too many emails sent just now. Wait a minute and try again.";
  if (code === "user_already_exists")
    return "An account with this email already exists — switch to Sign in.";
  if (code === "weak_password") return "Password too weak. Use at least 8 characters.";
  return msg;
}

function SignInScreen({ onBypass }: { onBypass?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleAuth = async (targetEmail: string, targetPass: string, isSignIn: boolean) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    setBusy(true);
    setNotice(null);
    try {
      if (isSignIn) {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: targetPass,
        });
        if (error) throw error;
        toast.success("Signed in successfully!");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: targetPass,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created and signed in!");
        } else {
          setMode("signin");
          setNotice(
            `We sent a confirmation link to ${cleanEmail}. Confirm it, then sign in with the same password.`,
          );
          toast.success("Confirmation email sent.");
        }
      }
    } catch (err: any) {
      const message = friendlyAuthError(err);
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setNotice("Enter your work email first, then resend the confirmation link.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setNotice(`Confirmation link resent to ${cleanEmail}.`);
      toast.success("Confirmation link resent.");
    } catch (err: any) {
      const message = friendlyAuthError(err);
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAuth(email, password, mode === "signin");
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-semibold">Secure Access</span>
        </div>
        <h1 className="mt-3 text-lg font-semibold text-foreground">
          Eskom Meter Data Reconciliation
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Commercial billing, reconciliation and recovery data is restricted. Sign in to continue.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@eskombalancer.co.za"
              autoComplete="email"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {notice && (
          <p className="mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] leading-relaxed text-foreground">
            {notice}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={resendConfirmation}
          className="mt-3 w-full rounded-md border border-border py-2 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50"
        >
          Resend confirmation link
        </button>


        {onBypass && (
          <button
            type="button"
            onClick={onBypass}
            className="mt-3 w-full rounded-md border border-primary/40 bg-primary/10 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition text-center block"
          >
            ⚡ Continue to Demo Dashboard (Guest Access)
          </button>
        )}

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account yet? Register" : "Already registered? Sign in"}
        </button>
      </div>
    </div>
  );
}

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await supabase.auth.signOut();
        setBusy(false);
      }}
      className="text-xs rounded-md border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground transition"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
