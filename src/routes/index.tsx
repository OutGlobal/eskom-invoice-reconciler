import React, { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EneraNav } from "@/components/landing/enera/EneraNav";
import { EneraHeroSection } from "@/components/landing/enera/EneraHeroSection";
import { EneraCapabilitiesSection } from "@/components/landing/enera/EneraCapabilitiesSection";
import { EneraProductSignalsSection } from "@/components/landing/enera/EneraProductSignalsSection";
import { EneraProductInterfacePreviewSection } from "@/components/landing/enera/EneraProductInterfacePreviewSection";
import { EneraAudienceSection } from "@/components/landing/enera/EneraAudienceSection";
import { EneraBillSignalSection } from "@/components/landing/enera/EneraBillSignalSection";

// Lazy-load subsequent sections for optimal initial bundle rendering
const EneraDifferenceSection = lazy(() =>
  import("@/components/landing/enera/EneraDifferenceSection").then((m) => ({
    default: m.EneraDifferenceSection,
  })),
);
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
const EneraSouthAfricanContextSection = lazy(() =>
  import("@/components/landing/enera/EneraSouthAfricanContextSection").then((m) => ({
    default: m.EneraSouthAfricanContextSection,
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
        {/* 1. Hero & Executive Value Proposition + Determinant Ticker */}
        <EneraHeroSection />

        {/* 2. From Energy Data to Decision */}
        <EneraCapabilitiesSection />

        {/* 3. Product Capabilities: One Platform. Multiple Energy Signals. */}
        <EneraProductSignalsSection />

        {/* 4. Product Interface Previews: See The Signal Behind The Number */}
        <EneraProductInterfacePreviewSection />

        {/* 5. Solutions: Commercial, Mining & Municipal Grid Frameworks */}
        <EneraSouthAfricanContextSection />

        {/* 6. Stakeholders: Built For The People Who Manage Energy */}
        <EneraAudienceSection />

        {/* 4. How It Works: Signal Decomposition & Deterministic Reconciliation */}
        <EneraBillSignalSection />

        <Suspense fallback={<SectionFallback />}>
          {/* Ground-Truth Reconciliation Ledger */}
          <EneraDifferenceSection />

          {/* 5. Insights: Executive Financial Intelligence Studio */}
          <EneraCopilotSection />

          {/* 6. Intelligent Assistance: Ask Better Questions */}
          <EneraAISection />

          {/* 7. Trust & Governance: Intelligence You Can Trace */}
          <EneraTrustSection />

          {/* 7. Contact: Executive Demo & Briefing Request */}
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
