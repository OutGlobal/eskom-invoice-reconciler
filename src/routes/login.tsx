import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { SignInScreen, useSupabaseSession } from "@/components/AuthGate";
import { useEffect } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Client Portal Login — ENERA Energy Financial Intelligence" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session } = useSupabaseSession();
  const navigate = useNavigate();

  // Safely extract redirect destination from query param (e.g. /upload, /reconciliation)
  const getDestination = () => {
    if (typeof window === "undefined") return "/dashboard";
    const target = new URLSearchParams(window.location.search).get("redirect");
    if (target && target.startsWith("/") && !target.startsWith("//")) {
      return target;
    }
    return "/dashboard";
  };

  useEffect(() => {
    if (session) {
      const destination = getDestination();
      navigate({ to: destination as any });
    }
  }, [session, navigate]);

  return (
    <div className="min-h-screen bg-[#030712] text-white flex flex-col justify-between font-sans">
      {/* Top Bar with back to home link */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-cyan-400" />
          <span>Back to ENERA Platform</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[11px] font-mono text-slate-400">ENERA SECURE 256-BIT PORTAL</span>
        </div>
      </header>

      {/* Main Login Screen */}
      <main className="flex-1 flex items-center justify-center p-4">
        <SignInScreen
          onBypass={() => {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem("enera_demo_access", "true");
            }
            const destination = getDestination();
            navigate({ to: destination as any });
          }}
        />
      </main>

      {/* Trust Footer */}
      <footer className="p-4 text-center text-xs text-muted-foreground/60 border-t border-border/40">
        Enterprise access is provisioned by organization administrators. Inquiries: security@outglobal.co.za
      </footer>
    </div>
  );
}
