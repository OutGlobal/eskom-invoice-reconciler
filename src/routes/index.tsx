import { createFileRoute } from "@tanstack/react-router";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { BigIdeaSection } from "@/components/landing/BigIdeaSection";
import { MoneyFlowSection } from "@/components/landing/MoneyFlowSection";
import { InteractiveBillDemo } from "@/components/landing/InteractiveBillDemo";
import { BillStorySection } from "@/components/landing/BillStorySection";
import { ReconciliationVisualSection } from "@/components/landing/ReconciliationVisualSection";
import { AiIntelligenceSection } from "@/components/landing/AiIntelligenceSection";
import { MultiSiteSection } from "@/components/landing/MultiSiteSection";
import { ExecutiveRoiSection } from "@/components/landing/ExecutiveRoiSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TrustAuditSection } from "@/components/landing/TrustAuditSection";
import { UseCasesSection } from "@/components/landing/UseCasesSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "Eskom Bill Balancer — Energy Financial Control System | Utility Reconciliation Platform",
      },
      {
        name: "description",
        content:
          "Autonomous electricity invoice reconciliation and energy financial intelligence for commercial and industrial facilities across South Africa. Know what you should pay. Know what you actually paid. Know where the difference went.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-300 font-sans antialiased overflow-x-hidden">
      {/* Sticky Translucent Navigation */}
      <LandingNav />

      {/* Main Flow */}
      <main>
        {/* 1. Hero Section with Live Energy Intelligence Engine Visual */}
        <HeroSection />

        {/* 2. The Big Idea Typographic Callout */}
        <BigIdeaSection />

        {/* 3. Follow The Money Pipeline Visualization */}
        <MoneyFlowSection />

        {/* 4. Interactive Simulated Bill Drop Engine */}
        <InteractiveBillDemo />

        {/* 5. Every Bill Tells a Story — Anatomy of an Eskom Bill */}
        <BillStorySection />

        {/* 6. Dual Stream Reconciliation Visual */}
        <ReconciliationVisualSection />

        {/* 7. AI Energy Intelligence Natural Language Console */}
        <AiIntelligenceSection />

        {/* 8. Multi-Site Portfolio Command Grid */}
        <MultiSiteSection />

        {/* 9. Financial ROI & Proof Metrics */}
        <ExecutiveRoiSection />

        {/* 10. How It Works 4-Step Journey */}
        <HowItWorksSection />

        {/* 11. Immutable Audit Trail & Regulatory Compliance */}
        <TrustAuditSection />

        {/* 12. Enterprise Persona Use Cases */}
        <UseCasesSection />

        {/* 13. Final CTA & Regulatory Footer */}
        <FinalCtaSection />
      </main>
    </div>
  );
}
