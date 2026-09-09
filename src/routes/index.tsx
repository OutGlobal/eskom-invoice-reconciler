import { createFileRoute } from "@tanstack/react-router";
import { EneraNav } from "@/components/landing/enera/EneraNav";
import { EneraHeroSection } from "@/components/landing/enera/EneraHeroSection";
import { EneraBillSignalSection } from "@/components/landing/enera/EneraBillSignalSection";
import { EneraDifferenceSection } from "@/components/landing/enera/EneraDifferenceSection";
import { EneraCopilotSection } from "@/components/landing/enera/EneraCopilotSection";
import { EneraNetworkSection } from "@/components/landing/enera/EneraNetworkSection";
import { EneraImpactSection } from "@/components/landing/enera/EneraImpactSection";
import { EneraInteractiveUploadSection } from "@/components/landing/enera/EneraInteractiveUploadSection";
import { EneraAuditTrailSection } from "@/components/landing/enera/EneraAuditTrailSection";
import { EneraFinalCtaSection } from "@/components/landing/enera/EneraFinalCtaSection";
import { EneraFooter } from "@/components/landing/enera/EneraFooter";

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

        {/* Stage 9: "FIND THE DIFFERENCE" — Billed vs Actual Ground Truth */}
        <EneraDifferenceSection />

        {/* Stage 10: "ASK YOUR ENERGY DATA" — AI Energy Copilot */}
        <EneraCopilotSection />

        {/* Stage 11: "ONE PLATFORM. EVERY ENERGY SIGNAL" — Interactive Topology Network */}
        <EneraNetworkSection />

        {/* Stage 12: "TURN ENERGY DATA INTO ADVANTAGE" — Executive ROI Impact */}
        <EneraImpactSection />

        {/* Stage 13-14: "DROP A BILL. WATCH ENERA THINK" — Interactive Upload Simulator & /upload Gateway */}
        <EneraInteractiveUploadSection />

        {/* Stage 15: "EVERY NUMBER HAS A TRAIL" — 7-Node Cryptographic Audit Chain */}
        <EneraAuditTrailSection />

        {/* Stage 16: "YOUR NEXT BILL SHOULDN'T BE A SURPRISE" — Cinematic Echo Final CTA */}
        <EneraFinalCtaSection />
      </main>

      {/* Stage 17: Minimal Luxury Footer */}
      <EneraFooter />
    </div>
  );
}
