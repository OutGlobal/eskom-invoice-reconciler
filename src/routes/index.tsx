import React, { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EneraNav } from "@/components/landing/enera/EneraNav";
import { EneraHeroSection } from "@/components/landing/enera/EneraHeroSection";
import { EneraBillSignalSection } from "@/components/landing/enera/EneraBillSignalSection";
import { EngineFlowConnector } from "@/components/landing/enera/EneraBrandPrimitives";

// Lazy-load below-the-fold sections for optimal bundle splitting and initial load performance
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
const EneraNetworkSection = lazy(() =>
  import("@/components/landing/enera/EneraNetworkSection").then((m) => ({
    default: m.EneraNetworkSection,
  })),
);
const EneraImpactSection = lazy(() =>
  import("@/components/landing/enera/EneraImpactSection").then((m) => ({
    default: m.EneraImpactSection,
  })),
);
const EneraInteractiveUploadSection = lazy(() =>
  import("@/components/landing/enera/EneraInteractiveUploadSection").then((m) => ({
    default: m.EneraInteractiveUploadSection,
  })),
);
const EneraSouthAfricanContextSection = lazy(() =>
  import("@/components/landing/enera/EneraSouthAfricanContextSection").then((m) => ({
    default: m.EneraSouthAfricanContextSection,
  })),
);
const EneraAuditTrailSection = lazy(() =>
  import("@/components/landing/enera/EneraAuditTrailSection").then((m) => ({
    default: m.EneraAuditTrailSection,
  })),
);
const EneraFinalCtaSection = lazy(() =>
  import("@/components/landing/enera/EneraFinalCtaSection").then((m) => ({
    default: m.EneraFinalCtaSection,
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
      className="w-full py-28 bg-[#030712] flex items-center justify-center min-h-[300px]"
      aria-hidden="true"
    >
      <div className="w-6 h-6 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
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
          "AI-powered energy intelligence that reconciles every charge, detects hidden anomalies and helps businesses understand where every energy rand goes.",
      },
    ],
  }),
  component: EneraLandingPage,
});

function EneraLandingPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white selection:bg-cyan-500/30 selection:text-cyan-200 font-sans antialiased overflow-x-hidden">
      {/* Keyboard Accessibility Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:top-4 focus:left-4 focus:z-[100] focus:bg-cyan-400 focus:text-slate-950 focus:font-mono focus:font-bold focus:rounded-lg focus:shadow-2xl focus:border focus:border-cyan-300 focus:ring-4 focus:ring-cyan-500/40"
      >
        Skip to main content
      </a>

      {/* 1. Transparent-to-blur Sticky Navigation */}
      <EneraNav />

      {/* 2. Main Narrative Progression */}
      <main
        id="main-content"
        tabIndex={-1}
        className="outline-none"
        aria-label="ENERA Platform Narrative"
      >
        {/* PHASE 01: ENERGY — The Front Door to an Energy Intelligence Engine */}
        <EneraHeroSection />

        <EngineFlowConnector from="ENERGY" to="DATA" />

        {/* PHASE 02: DATA — "EVERY BILL HAS A SIGNAL" Progressive Deconstruction */}
        <EneraBillSignalSection />

        <EngineFlowConnector from="DATA" to="UNDERSTANDING" />

        <Suspense fallback={<SectionFallback />}>
          {/* PHASE 03: UNDERSTANDING — "ASK YOUR ENERGY DATA" & "ONE PLATFORM. EVERY ENERGY SIGNAL" */}
          <EneraCopilotSection />
          <EneraNetworkSection />

          <EngineFlowConnector from="UNDERSTANDING" to="RECONCILIATION" />

          {/* PHASE 04: RECONCILIATION — "FIND THE DIFFERENCE" Billed vs Consumed Ground Truth */}
          <EneraDifferenceSection />

          <EngineFlowConnector from="RECONCILIATION" to="ANOMALY" />

          {/* PHASE 05: ANOMALY — Complex SA Tariff Anomalies & 12-Node Cryptographic Audit Chain */}
          <EneraSouthAfricanContextSection />
          <EneraAuditTrailSection />

          <EngineFlowConnector from="ANOMALY" to="INSIGHT" />

          {/* PHASE 06: INSIGHT — "TURN ENERGY DATA INTO ADVANTAGE" Executive Balance Sheet Advantage */}
          <EneraImpactSection />

          <EngineFlowConnector from="INSIGHT" to="RECOVERY" />

          {/* PHASE 07: RECOVERY — "DROP A BILL. WATCH ENERA THINK" & Returning Energy Climax */}
          <EneraInteractiveUploadSection />
          <EneraFinalCtaSection />
        </Suspense>
      </main>

      {/* Stage 17: Minimal Luxury Footer */}
      <Suspense fallback={<SectionFallback />}>
        <EneraFooter />
      </Suspense>
    </div>
  );
}
