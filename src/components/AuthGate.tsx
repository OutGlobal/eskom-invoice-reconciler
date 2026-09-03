import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LogIn, ShieldCheck, Loader2, Mail, AlertTriangle, RefreshCw } from "lucide-react";
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

function SignInScreen({ onBypass }: { onBypass?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setAuthError(null);
    setUnconfirmedEmail(null);

    const cleanEmail = email.trim();

    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes("email not confirmed")) {
            setUnconfirmedEmail(cleanEmail);
            setAuthError("Your email has not been confirmed yet. Please check your inbox or resend the confirmation link below.");
          } else if (errMsg.includes("invalid login credentials")) {
            setAuthError("Invalid email or password. Please double-check your credentials.");
          } else {
            setAuthError(error.message);
          }
          return;
        }

        if (data.session) {
          toast.success("Signed in successfully!");
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });

        if (error) {
          setAuthError(error.message);
          return;
        }

        if (data.session) {
          toast.success("Account created and signed in!");
        } else {
          setUnconfirmedEmail(cleanEmail);
          toast.success("Account created! Check your email to confirm.");
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || "An error occurred during authentication.");
    } finally {
      setBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    const target = unconfirmedEmail || email.trim();
    if (!target) {
      toast.error("Please enter your email address first.");
      return;
    }
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success(`Confirmation link sent to ${target}! Check your inbox.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend confirmation email.");
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg space-y-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-semibold">Secure Access</span>
          </div>
          <h1 className="mt-2 text-lg font-semibold text-foreground">
            Eskom Meter Data Reconciliation
          </h1>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Commercial billing, reconciliation and recovery data is restricted. Sign in to your account or continue in demo mode.
          </p>
        </div>

        {authError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <div className="leading-relaxed">{authError}</div>
            </div>
            {unconfirmedEmail && (
              <button
                type="button"
                disabled={resendBusy}
                onClick={handleResendConfirmation}
                className="inline-flex items-center gap-1.5 text-xs text-red-300 underline font-medium hover:text-white transition disabled:opacity-50"
              >
                {resendBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                Resend confirmation link to {unconfirmedEmail}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-3">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@company.co.za"
              autoComplete="email"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1 font-medium">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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

        {mode === "signup" && (
          <p className="text-[11px] text-muted-foreground bg-muted/30 border border-border/50 rounded p-2 text-center leading-relaxed">
            Note: Check your inbox after registration to confirm your email before signing in.
          </p>
        )}

        {onBypass && (
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={onBypass}
              className="w-full rounded-md border border-primary/40 bg-primary/10 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition text-center block"
            >
              ⚡ Continue to Demo Dashboard (Guest Access)
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setAuthError(null);
          }}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground pt-1"
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
