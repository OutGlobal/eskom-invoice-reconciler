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
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
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
            <span className="text-[10px] text-emerald-400 font-mono">1-Click Fill</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail("admin@eskombalancer.co.za");
                setPassword("Eskom2026!Pass");
                setMode("signin");
              }}
              className="p-2 text-left rounded border border-border bg-muted/20 hover:bg-muted/40 transition"
            >
              <div className="font-semibold text-foreground text-[11px]">CFO / Auditor</div>
              <div className="text-[10px] text-muted-foreground truncate">admin@eskombalancer.co.za</div>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("engineer@impala.co.za");
                setPassword("Eskom2026!Pass");
                setMode("signin");
              }}
              className="p-2 text-left rounded border border-border bg-muted/20 hover:bg-muted/40 transition"
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
