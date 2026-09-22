import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EneraNav } from "@/components/landing/enera/EneraNav";
import { EneraHeroSection } from "@/components/landing/enera/EneraHeroSection";
import { EneraCapabilitiesSection } from "@/components/landing/enera/EneraCapabilitiesSection";
import { EneraProductSignalsSection } from "@/components/landing/enera/EneraProductSignalsSection";
import { EneraBillSignalSection } from "@/components/landing/enera/EneraBillSignalSection";
import { EneraAudienceSection } from "@/components/landing/enera/EneraAudienceSection";
import { EneraAISection } from "@/components/landing/enera/EneraAISection";
import { EneraTrustSection } from "@/components/landing/enera/EneraTrustSection";
import { EneraContactSection } from "@/components/landing/enera/EneraContactSection";
import { EneraFaqSection } from "@/components/landing/enera/EneraFaqSection";
import { EneraFooter } from "@/components/landing/enera/EneraFooter";

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
        {/* 2. Hero: SEE BEYOND THE BILL. */}
        <EneraHeroSection />

        {/* Below-the-fold Deferred Rendering Sections */}
        {/* 3. Short product introduction & 4. Core capabilities: FROM ENERGY DATA TO DECISION (RECONCILE, UNDERSTAND, DETECT, ACT) */}
        <div className="enera-section-deferred">
          <EneraCapabilitiesSection />
        </div>

        {/* 5. Platform capabilities: Billing, Energy, Tariff, Demand, Anomaly, Reporting, Multi-site */}
        <div className="enera-section-deferred">
          <EneraProductSignalsSection />
        </div>

        {/* 7. How it works: CONNECT, ANALYSE, UNDERSTAND, ACT */}
        <div className="enera-section-deferred">
          <EneraBillSignalSection />
        </div>

        {/* 8. Who it is for: Energy, Finance, Facilities, Audit, Executives */}
        <div className="enera-section-deferred">
          <EneraAudienceSection />
        </div>

        {/* 9. AI: ASK BETTER QUESTIONS. */}
        <div className="enera-section-deferred">
          <EneraAISection />
        </div>

        {/* 11. Trust: INTELLIGENCE YOU CAN TRACE. */}
        <div className="enera-section-deferred">
          <EneraTrustSection />
        </div>

        {/* 12. CTA: REQUEST A DEMO */}
        <div className="enera-section-deferred">
          <EneraContactSection />
        </div>

        {/* 13. Resources / FAQ */}
        <div className="enera-section-deferred">
          <EneraFaqSection />
        </div>
      </main>

      {/* 14. Institutional Footer */}
      <div className="enera-section-deferred">
        <EneraFooter />
      </div>
    </div>
  );
}
