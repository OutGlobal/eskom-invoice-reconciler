import React, { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EneraNav } from "@/components/landing/enera/EneraNav";
import { EneraHeroSection } from "@/components/landing/enera/EneraHeroSection";
import { EneraProductSignalsSection } from "@/components/landing/enera/EneraProductSignalsSection";
import { EneraProductInterfacePreviewSection } from "@/components/landing/enera/EneraProductInterfacePreviewSection";
import { EneraAudienceSection } from "@/components/landing/enera/EneraAudienceSection";
import { EneraBillSignalSection } from "@/components/landing/enera/EneraBillSignalSection";

// Lazy-load subsequent sections for optimal initial bundle rendering
const EneraCopilotSection = lazy(() =>
  import("@/components/landing/enera/EneraCopilotSection").then((m) => ({
    default: m.EneraCopilotSection,
  })),
);
const EneraAISection = lazy(() =>
  import("@/components/landing/enera/EneraAISection").then((m) => ({
    default: m.EneraAISection,
  })),
);
const EneraTrustSection = lazy(() =>
  import("@/components/landing/enera/EneraTrustSection").then((m) => ({
    default: m.EneraTrustSection,
  })),
);
const EneraContactSection = lazy(() =>
  import("@/components/landing/enera/EneraContactSection").then((m) => ({
    default: m.EneraContactSection,
  })),
);
const EneraFooter = lazy(() =>
  import("@/components/landing/enera/EneraFooter").then((m) => ({
    default: m.EneraFooter,
  })),
);

function SectionFallback() {
  return (
    <div
      className="w-full py-20 bg-[#030712] flex items-center justify-center min-h-[200px]"
      aria-hidden="true"
    >
      <div className="w-5 h-5 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "ENERA — Energy Financial Intelligence | SEE BEYOND THE BILL",
      },
      {
        name: "description",
        content:
          "Enterprise energy financial intelligence platform. Reconcile utility determinants, verify statutory TOU schedules, and recover unearned charges with mathematical certainty.",
      },
    ],
  }),
  component: EneraLandingPage,
});

function EneraLandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-cyan-500/20 selection:text-cyan-950 font-sans antialiased overflow-x-hidden">
      {/* Keyboard Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-cyan-400 focus:text-slate-950 focus:font-mono focus:font-bold focus:rounded-lg focus:shadow-2xl focus:border focus:border-cyan-300"
      >
        Skip to main content
      </a>

      {/* 1. Header Navigation */}
      <EneraNav />

      {/* 2. Main Narrative Flow (7 Core Sections) */}
      <main
        id="main-content"
        tabIndex={-1}
        className="outline-none"
        aria-label="ENERA Platform Architecture"
      >
        {/* 1. Hero & Executive Value Proposition */}
        <EneraHeroSection />

        {/* 2. Unified Capabilities: One Platform. Multiple Energy Signals. */}
        <EneraProductSignalsSection />

        {/* 3. Product Interface Previews: See The Signal Behind The Number */}
        <EneraProductInterfacePreviewSection />

        {/* 4. Stakeholders: Built For The People Who Manage Energy */}
        <EneraAudienceSection />

        {/* 5. How It Works: Four-Step Reconciler Methodology */}
        <EneraBillSignalSection />

        <Suspense fallback={<SectionFallback />}>
          {/* 6. Financial Intelligence: See The Financial Signal */}
          <EneraCopilotSection />

          {/* 7. Intelligent Assistance: Ask Better Questions */}
          <EneraAISection />

          {/* 8. Trust & Governance: Intelligence You Can Trace */}
          <EneraTrustSection />

          {/* 9. Contact: Executive Demo & Briefing Request */}
          <EneraContactSection />
        </Suspense>
      </main>

      {/* 3. Institutional Footer */}
      <Suspense fallback={<SectionFallback />}>
        <EneraFooter />
      </Suspense>
    </div>
  );
}
