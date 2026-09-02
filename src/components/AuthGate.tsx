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
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, ready };
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, ready } = useSupabaseSession();

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


  if (!session) return <SignInScreen />;
  return <>{children}</>;
}

function SignInScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAuth = async (targetEmail: string, targetPass: string, isSignIn: boolean) => {
    setBusy(true);
    try {
      if (isSignIn) {
        let { data, error } = await supabase.auth.signInWithPassword({ email: targetEmail, password: targetPass });
        if (error) {
          // If user account is not yet provisioned in Supabase Auth, auto-provision and sign in
          const { data: suData, error: suErr } = await supabase.auth.signUp({
            email: targetEmail,
            password: targetPass,
            options: { emailRedirectTo: window.location.origin },
          });
          if (suErr) {
            throw error;
          }
          if (suData?.session) {
            toast.success("Welcome to Eskom Meter Data Reconciliation!");
            return;
          }
          // Retry sign-in
          const retry = await supabase.auth.signInWithPassword({ email: targetEmail, password: targetPass });
          if (retry.error) {
            toast.success("Account provisioned! Click Sign in to proceed.");
            return;
          }
        }
        toast.success("Signed in successfully!");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password: targetPass,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Account created! You can now sign in.");
        } else {
          toast.success("Account created and signed in!");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed");
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

        {/* Demo Quick Access Credentials Helper */}
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
            <span>Demo Platform Credentials</span>
            <span className="text-[10px] text-emerald-400 font-mono">1-Click Sign In</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const em = "admin@eskombalancer.co.za";
                const pw = "Eskom2026!Pass";
                setEmail(em);
                setPassword(pw);
                setMode("signin");
                handleAuth(em, pw, true);
              }}
              className="p-2 text-left rounded border border-border bg-muted/20 hover:bg-muted/40 transition disabled:opacity-50"
            >
              <div className="font-semibold text-foreground text-[11px]">CFO / Auditor</div>
              <div className="text-[10px] text-muted-foreground truncate">admin@eskombalancer.co.za</div>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const em = "engineer@impala.co.za";
                const pw = "Eskom2026!Pass";
                setEmail(em);
                setPassword(pw);
                setMode("signin");
                handleAuth(em, pw, true);
              }}
              className="p-2 text-left rounded border border-border bg-muted/20 hover:bg-muted/40 transition disabled:opacity-50"
            >
              <div className="font-semibold text-foreground text-[11px]">Plant Engineer</div>
              <div className="text-[10px] text-muted-foreground truncate">engineer@impala.co.za</div>
            </button>
          </div>
        </div>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
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
