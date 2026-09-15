import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Stage 25 — Page Structure Sequence Verification", () => {
  const indexRoutePath = path.resolve(__dirname, "../../routes/index.tsx");
  const eneraDir = path.resolve(__dirname, "../../components/landing/enera");

  const indexContent = fs.readFileSync(indexRoutePath, "utf-8");

  describe("Exact 14-Step Homepage Section Sequence", () => {
    it("should order components in the exact 14-step sequence requested", () => {
      // Find the positions of each section in the index.tsx file
      const positions = {
        nav: indexContent.indexOf("<EneraNav"),
        hero: indexContent.indexOf("<EneraHeroSection"),
        capabilities: indexContent.indexOf("<EneraCapabilitiesSection"),
        signals: indexContent.indexOf("<EneraProductSignalsSection"),
        interfacePreview: indexContent.indexOf("<EneraProductInterfacePreviewSection"),
        howItWorks: indexContent.indexOf("<EneraBillSignalSection"),
        audience: indexContent.indexOf("<EneraAudienceSection"),
        ai: indexContent.indexOf("<EneraAISection"),
        copilot: indexContent.indexOf("<EneraCopilotSection"),
        trust: indexContent.indexOf("<EneraTrustSection"),
        contact: indexContent.indexOf("<EneraContactSection"),
        faq: indexContent.indexOf("<EneraFaqSection"),
        footer: indexContent.indexOf("<EneraFooter"),
      };

      // All components must exist
      for (const [name, pos] of Object.entries(positions)) {
        expect(pos, `Expected component ${name} to exist in index.tsx`).toBeGreaterThan(-1);
      }

      // Exact ordered sequence check:
      // 1. Navigation -> 2. Hero -> 3/4. Capabilities -> 5. Platform Capabilities -> 6. Product Visual ->
      // 7. How it works -> 8. Who it is for -> 9. AI -> 10. Financial intelligence -> 11. Trust ->
      // 12. CTA -> 13. Resources / FAQ -> 14. Footer
      expect(positions.nav).toBeLessThan(positions.hero);
      expect(positions.hero).toBeLessThan(positions.capabilities);
      expect(positions.capabilities).toBeLessThan(positions.signals);
      expect(positions.signals).toBeLessThan(positions.interfacePreview);
      expect(positions.interfacePreview).toBeLessThan(positions.howItWorks);
      expect(positions.howItWorks).toBeLessThan(positions.audience);
      expect(positions.audience).toBeLessThan(positions.ai);
      expect(positions.ai).toBeLessThan(positions.copilot);
      expect(positions.copilot).toBeLessThan(positions.trust);
      expect(positions.trust).toBeLessThan(positions.contact);
      expect(positions.contact).toBeLessThan(positions.faq);
      expect(positions.faq).toBeLessThan(positions.footer);
    });
  });

  describe("Content & Headings Alignment for Each Sequence Step", () => {
    it("Step 2 (Hero): Should contain 'SEE BEYOND THE BILL.'", () => {
      const heroContent = fs.readFileSync(path.join(eneraDir, "EneraHeroSection.tsx"), "utf-8");
      expect(heroContent).toContain("SEE BEYOND THE BILL.");
    });

    it("Step 3 & 4 (Intro & Core Capabilities): Should contain 'FROM ENERGY DATA TO DECISION.' and RECONCILE, UNDERSTAND, DETECT, ACT", () => {
      const capContent = fs.readFileSync(path.join(eneraDir, "EneraCapabilitiesSection.tsx"), "utf-8");
      expect(capContent).toContain("FROM ENERGY DATA TO DECISION");
      expect(capContent).toContain("RECONCILE");
      expect(capContent).toContain("UNDERSTAND");
      expect(capContent).toContain("DETECT");
      expect(capContent).toContain("ACT");
    });

    it("Step 5 (Platform Capabilities): Should include Billing, Energy, Tariff, Demand, Anomaly, Reporting, Multi-site", () => {
      const signalsContent = fs.readFileSync(path.join(eneraDir, "EneraProductSignalsSection.tsx"), "utf-8");
      expect(signalsContent).toContain("BILLING");
      expect(signalsContent).toContain("ENERGY");
      expect(signalsContent).toContain("TARIFF");
      expect(signalsContent).toContain("DEMAND");
      expect(signalsContent).toContain("ANOMALY");
      expect(signalsContent).toContain("REPORTING");
      expect(signalsContent).toContain("MULTI-SITE");
    });

    it("Step 6 (Product Visual): Should contain 'SEE THE SIGNAL BEHIND THE NUMBER.'", () => {
      const previewContent = fs.readFileSync(path.join(eneraDir, "EneraProductInterfacePreviewSection.tsx"), "utf-8");
      expect(previewContent).toContain("SEE THE SIGNAL BEHIND THE NUMBER.");
    });

    it("Step 7 (How It Works): Should contain CONNECT, ANALYSE, UNDERSTAND, ACT", () => {
      const howContent = fs.readFileSync(path.join(eneraDir, "EneraBillSignalSection.tsx"), "utf-8");
      expect(howContent).toContain("CONNECT");
      expect(howContent).toContain("ANALYSE");
      expect(howContent).toContain("UNDERSTAND");
      expect(howContent).toContain("ACT");
    });

    it("Step 8 (Who It Is For): Should contain Energy, Finance, Facilities, Audit, Executives", () => {
      const audContent = fs.readFileSync(path.join(eneraDir, "EneraAudienceSection.tsx"), "utf-8");
      expect(audContent).toContain("ENERGY");
      expect(audContent).toContain("FINANCE");
      expect(audContent).toContain("FACILITIES");
      expect(audContent).toContain("AUDIT");
      expect(audContent).toContain("EXECUTIVES");
    });

    it("Step 9 (AI): Should contain 'ASK BETTER QUESTIONS.'", () => {
      const aiContent = fs.readFileSync(path.join(eneraDir, "EneraAISection.tsx"), "utf-8");
      expect(aiContent).toContain("ASK BETTER QUESTIONS.");
    });

    it("Step 10 (Financial Intelligence): Should contain 'SEE THE FINANCIAL SIGNAL.'", () => {
      const copilotContent = fs.readFileSync(path.join(eneraDir, "EneraCopilotSection.tsx"), "utf-8");
      expect(copilotContent).toContain("SEE THE FINANCIAL SIGNAL.");
    });

    it("Step 11 (Trust): Should contain 'INTELLIGENCE YOU CAN TRACE.'", () => {
      const trustContent = fs.readFileSync(path.join(eneraDir, "EneraTrustSection.tsx"), "utf-8");
      expect(trustContent).toContain("INTELLIGENCE YOU CAN TRACE.");
    });

    it("Step 12 (CTA): Should contain 'REQUEST A DEMO'", () => {
      const ctaContent = fs.readFileSync(path.join(eneraDir, "EneraContactSection.tsx"), "utf-8");
      expect(ctaContent).toContain("REQUEST A DEMO");
    });

    it("Step 13 (Resources / FAQ): Should render FAQ section with questions and answers", () => {
      const faqContent = fs.readFileSync(path.join(eneraDir, "EneraFaqSection.tsx"), "utf-8");
      expect(faqContent).toContain("FREQUENTLY ASKED QUESTIONS");
      expect(faqContent).toContain("What data does ENERA need to reconcile an account?");
      expect(faqContent).toContain("Which tariffs and regulatory schedules are supported?");
      expect(faqContent).toContain("What types of billing discrepancies does ENERA identify?");
    });

    it("Step 14 (Footer): Should render comprehensive enterprise footer", () => {
      const footerContent = fs.readFileSync(path.join(eneraDir, "EneraFooter.tsx"), "utf-8");
      expect(footerContent).toContain("PLATFORM");
      expect(footerContent).toContain("SOLUTIONS");
      expect(footerContent).toContain("RESOURCES");
      expect(footerContent).toContain("COMPANY");
      expect(footerContent).toContain("LEGAL");
    });
  });
});
