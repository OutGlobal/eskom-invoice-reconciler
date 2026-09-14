import React, { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EneraNav } from "@/components/landing/enera/EneraNav";
import { EneraHeroSection } from "@/components/landing/enera/EneraHeroSection";

// Lazy-load all below-the-fold sections for optimal critical path rendering & code splitting
const EneraProductSignalsSection = lazy(() =>
  import("@/components/landing/enera/EneraProductSignalsSection").then((m) => ({
    default: m.EneraProductSignalsSection,
  })),
);
const EneraProductInterfacePreviewSection = lazy(() =>
  import("@/components/landing/enera/EneraProductInterfacePreviewSection").then((m) => ({
    default: m.EneraProductInterfacePreviewSection,
  })),
);
const EneraAudienceSection = lazy(() =>
  import("@/components/landing/enera/EneraAudienceSection").then((m) => ({
    default: m.EneraAudienceSection,
  })),
);
const EneraBillSignalSection = lazy(() =>
  import("@/components/landing/enera/EneraBillSignalSection").then((m) => ({
    default: m.EneraBillSignalSection,
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
      className="w-full py-20 bg-[#0c121e] flex items-center justify-center min-h-[220px]"
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
        title: "ENERA | Energy Financial Intelligence",
      },
      {
        name: "description",
        content:
          "ENERA transforms complex energy and billing information into clear, actionable intelligence for better financial and operational decisions.",
      },
      {
        property: "og:site_name",
        content: "ENERA",
      },
      {
        property: "og:title",
        content: "ENERA | Energy Financial Intelligence",
      },
      {
        property: "og:description",
        content:
          "ENERA transforms complex energy and billing information into clear, actionable intelligence for better financial and operational decisions.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:title",
        content: "ENERA | Energy Financial Intelligence",
      },
      {
        name: "twitter:description",
        content:
          "ENERA transforms complex energy and billing information into clear, actionable intelligence for better financial and operational decisions.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/52505294-a8b7-405f-bd46-268d13880296/id-preview-99af2560--d4e14f91-1593-4534-bd09-833873bc7bd1.lovable.app-1785402555429.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/52505294-a8b7-405f-bd46-268d13880296/id-preview-99af2560--d4e14f91-1593-4534-bd09-833873bc7bd1.lovable.app-1785402555429.png",
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

      {/* 1. Header Navigation (Above-the-fold critical) */}
      <EneraNav />

      {/* 2. Main Narrative Flow */}
      <main
        id="main-content"
        tabIndex={-1}
        className="outline-none"
        aria-label="ENERA Energy Financial Intelligence"
      >
        {/* Above-the-fold Hero & Executive Value Proposition */}
        <EneraHeroSection />

        {/* Below-the-fold Deferred Rendering Sections */}
        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 2. Unified Capabilities: One Platform. Multiple Energy Signals. */}
            <EneraProductSignalsSection />
          </Suspense>
        </div>

        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 3. Product Interface Previews: See The Signal Behind The Number */}
            <EneraProductInterfacePreviewSection />
          </Suspense>
        </div>

        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 4. Stakeholders: Built For The People Who Manage Energy */}
            <EneraAudienceSection />
          </Suspense>
        </div>

        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 5. How It Works: Four-Step Reconciler Methodology */}
            <EneraBillSignalSection />
          </Suspense>
        </div>

        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 6. Financial Intelligence: See The Financial Signal */}
            <EneraCopilotSection />
          </Suspense>
        </div>

        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 7. Intelligent Assistance: Ask Better Questions */}
            <EneraAISection />
          </Suspense>
        </div>

        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 8. Trust & Governance: Intelligence You Can Trace */}
            <EneraTrustSection />
          </Suspense>
        </div>

        <div className="enera-section-deferred">
          <Suspense fallback={<SectionFallback />}>
            {/* 9. Contact: Executive Demo & Briefing Request */}
            <EneraContactSection />
          </Suspense>
        </div>
      </main>

      {/* 3. Institutional Footer */}
      <div className="enera-section-deferred">
        <Suspense fallback={<SectionFallback />}>
          <EneraFooter />
        </Suspense>
      </div>
    </div>
  );
}

