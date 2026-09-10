import React, { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EneraNav } from "@/components/landing/enera/EneraNav";
import { EneraHeroSection } from "@/components/landing/enera/EneraHeroSection";
import { EneraBillSignalSection } from "@/components/landing/enera/EneraBillSignalSection";

// Lazy-load below-the-fold sections for optimal bundle splitting and initial load performance
const EneraDifferenceSection = lazy(() =>
  import("@/components/landing/enera/EneraDifferenceSection").then((m) => ({
    default: m.EneraDifferenceSection,
  }))
);
const EneraCopilotSection = lazy(() =>
  import("@/components/landing/enera/EneraCopilotSection").then((m) => ({
    default: m.EneraCopilotSection,
  }))
);
const EneraNetworkSection = lazy(() =>
  import("@/components/landing/enera/EneraNetworkSection").then((m) => ({
    default: m.EneraNetworkSection,
  }))
);
const EneraImpactSection = lazy(() =>
  import("@/components/landing/enera/EneraImpactSection").then((m) => ({
    default: m.EneraImpactSection,
  }))
);
const EneraInteractiveUploadSection = lazy(() =>
  import("@/components/landing/enera/EneraInteractiveUploadSection").then((m) => ({
    default: m.EneraInteractiveUploadSection,
  }))
);
const EneraSouthAfricanContextSection = lazy(() =>
  import("@/components/landing/enera/EneraSouthAfricanContextSection").then((m) => ({
    default: m.EneraSouthAfricanContextSection,
  }))
);
const EneraAuditTrailSection = lazy(() =>
  import("@/components/landing/enera/EneraAuditTrailSection").then((m) => ({
    default: m.EneraAuditTrailSection,
  }))
);
const EneraFinalCtaSection = lazy(() =>
  import("@/components/landing/enera/EneraFinalCtaSection").then((m) => ({
    default: m.EneraFinalCtaSection,
  }))
);
const EneraFooter = lazy(() =>
  import("@/components/landing/enera/EneraFooter").then((m) => ({
    default: m.EneraFooter,
  }))
);

function SectionFallback() {
  return (
    <div className="w-full py-28 bg-[#030712] flex items-center justify-center min-h-[300px]" aria-hidden="true">
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
      {/* 1. Transparent-to-blur Sticky Navigation */}
      <EneraNav />

      {/* 2. Main Narrative Progression */}
      <main>
        {/* Stage 3-7: Cinematic Hero with Canvas Particle Engine & Controlled Scene Loop */}
        <EneraHeroSection />

        {/* Stage 8: "EVERY BILL HAS A SIGNAL" — Progressive Deconstruction */}
        <EneraBillSignalSection />

        <Suspense fallback={<SectionFallback />}>
          {/* Stage 9: "FIND THE DIFFERENCE" — Billed vs Actual Ground Truth */}
          <EneraDifferenceSection />

          {/* Stage 10: "ASK YOUR ENERGY DATA" — AI Energy Copilot */}
          <EneraCopilotSection />

          {/* Stage 11: "ONE PLATFORM. EVERY ENERGY SIGNAL" — Interactive Topology Network */}
          <EneraNetworkSection />

          {/* Stage 12: "TURN ENERGY DATA INTO ADVANTAGE" — Executive ROI Impact */}
          <EneraImpactSection />

          {/* Stage 13: "DROP A BILL. WATCH ENERA THINK" — Interactive Upload Simulator & /upload Gateway */}
          <EneraInteractiveUploadSection />

          {/* Stage 14: SOUTH AFRICAN ENERGY CONTEXT — Eskom, Megaflex, Municipal Billing, AMR, TOU Determinants */}
          <EneraSouthAfricanContextSection />

          {/* Stage 15: "EVERY NUMBER HAS A TRAIL" — 7-Node Cryptographic Audit Chain */}
          <EneraAuditTrailSection />

          {/* Stage 16: "YOUR NEXT BILL SHOULDN'T BE A SURPRISE" — Cinematic Echo Final CTA */}
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
