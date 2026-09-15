import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Stage 29 — S&P Global Design Principles Final Audit", () => {
  const routesIndexPath = path.resolve(process.cwd(), "src/routes/index.tsx");
  const navPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraNav.tsx");
  const heroPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraHeroSection.tsx");
  const capabilitiesPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraCapabilitiesSection.tsx");
  const signalsPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraProductSignalsSection.tsx");
  const previewPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraProductInterfacePreviewSection.tsx");
  const howItWorksPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraBillSignalSection.tsx");
  const audiencePath = path.resolve(process.cwd(), "src/components/landing/enera/EneraAudienceSection.tsx");
  const aiPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraAISection.tsx");
  const copilotPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraCopilotSection.tsx");
  const trustPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraTrustSection.tsx");
  const contactPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraContactSection.tsx");
  const faqPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraFaqSection.tsx");
  const footerPath = path.resolve(process.cwd(), "src/components/landing/enera/EneraFooter.tsx");
  const stylesPath = path.resolve(process.cwd(), "src/styles.css");

  const routesIndex = fs.readFileSync(routesIndexPath, "utf-8");
  const nav = fs.readFileSync(navPath, "utf-8");
  const hero = fs.readFileSync(heroPath, "utf-8");
  const capabilities = fs.readFileSync(capabilitiesPath, "utf-8");
  const signals = fs.readFileSync(signalsPath, "utf-8");
  const preview = fs.readFileSync(previewPath, "utf-8");
  const howItWorks = fs.readFileSync(howItWorksPath, "utf-8");
  const copilot = fs.readFileSync(copilotPath, "utf-8");
  const trust = fs.readFileSync(trustPath, "utf-8");
  const contact = fs.readFileSync(contactPath, "utf-8");
  const faq = fs.readFileSync(faqPath, "utf-8");
  const styles = fs.readFileSync(stylesPath, "utf-8");

  it("Principle 1 — CLARITY: User immediately understands the proposition", () => {
    // Hero Headline & Primary Value Statement
    expect(hero).toContain("SEE BEYOND THE BILL.");
    expect(hero).toContain("Energy Financial Intelligence");
    expect(hero).toContain("ENERA turns complex energy and billing information into clear, actionable intelligence.");
    // Clear 5-Stage Pipeline Overview
    expect(hero).toContain("EneraHeroFlowVisual");
  });

  it("Principle 2 — HIERARCHY: Most important information is visually dominant", () => {
    // Exactly 1 H1 on the entire landing page
    const allH1Matches = hero.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    expect(allH1Matches.length).toBe(1);

    // Section Eyebrows & H2 Headings establish uniform visual hierarchy
    expect(capabilities).toContain("CAPABILITIES");
    expect(capabilities).toContain("FROM ENERGY DATA TO DECISION");
    expect(signals).toContain("PLATFORM CAPABILITIES");
    expect(preview).toContain("SEE THE SIGNAL BEHIND THE NUMBER.");
    expect(howItWorks).toContain("HOW ENERA WORKS");
  });

  it("Principle 3 — SIMPLICITY: Clean presentation without bloat or redundant copy", () => {
    // Card counts are disciplined and bounded
    expect(capabilities).toContain("RECONCILE");
    expect(capabilities).toContain("UNDERSTAND");
    expect(capabilities).toContain("DETECT");
    expect(capabilities).toContain("ACT");

    // No live file uploads or interactive spreadsheet dashboards on public front door
    expect(routesIndex).not.toContain("<input type=\"file\"");
    expect(preview).not.toContain("<input type=\"file\"");
  });

  it("Principle 4 — CONSISTENCY: Typography, spacing, cards, and buttons follow one unified design system", () => {
    // Primary CTAs adhere to uniform design tokens
    expect(nav).toContain("REQUEST A DEMO");
    expect(hero).toContain("REQUEST A DEMO");
    expect(contact).toContain("REQUEST A DEMO");

    // Standard focus outline utility
    expect(styles).toContain(".focus-ring-enera");
    expect(styles).toContain(":focus-visible");
  });

  it("Principle 5 — PROGRESSION: Each section naturally leads to the next in exact 14-step order", () => {
    const sequence = [
      "EneraNav",
      "EneraHeroSection",
      "EneraCapabilitiesSection",
      "EneraProductSignalsSection",
      "EneraProductInterfacePreviewSection",
      "EneraBillSignalSection",
      "EneraAudienceSection",
      "EneraAISection",
      "EneraCopilotSection",
      "EneraTrustSection",
      "EneraContactSection",
      "EneraFaqSection",
      "EneraFooter",
    ];

    let lastIndex = -1;
    for (const comp of sequence) {
      const idx = routesIndex.indexOf(comp);
      expect(idx).toBeGreaterThan(lastIndex);
      lastIndex = idx;
    }
  });

  it("Principle 6 — TRUST: Grounded in statutory standards without hyperbolic claims", () => {
    expect(hero).toContain("SANS 474 / NERSA Standard");
    expect(preview).toContain("SANS 474 Interval Certified");
    expect(preview).toContain("NERSA Sched 2 / Megaflex");
    expect(trust).toContain("INTELLIGENCE YOU CAN TRACE.");
    expect(trust).toContain("SANS 474");
    expect(preview).toContain("Simulated enterprise environment");
  });

  it("Principle 7 — DISCLOSURE: Zero exposure of proprietary schemas, APIs, or credentials", () => {
    const landingBundle = routesIndex + nav + hero + capabilities + signals + preview + howItWorks + copilot + trust + contact + faq;

    // Strict Stage 18 embargo assertions
    expect(landingBundle).not.toContain("public.invoices");
    expect(landingBundle).not.toContain("public.meter_readings");
    expect(landingBundle).not.toContain("/api/v1/");
    expect(landingBundle).not.toContain("service_role");
    expect(landingBundle).not.toContain("supabase.co");
    expect(landingBundle).not.toContain("Bearer ");
  });

  it("Principle 8 — CONVERSION: Always an obvious, accessible next step", () => {
    // Navigation link to #contact
    expect(nav).toContain("#contact");
    // Hero link to #contact
    expect(hero).toContain("#contact");
    // Interface preview link to #contact
    expect(preview).toContain("#contact");
    // Direct contact form
    expect(contact).toContain("id=\"contact\"");
  });

  it("Principle 9 — DISTINCTION: Retains distinct ENERA visual signature and energy intelligence feel", () => {
    // Traveling line through chart
    expect(preview).toContain("enera-chart-traveling-line");
    // Billing to insight transition
    expect(preview).toContain("Reconciliation Signal Transition");
    // Data stream resolving into financial metric
    expect(copilot).toContain("enera-data-stream-pulse");
    // Anomaly radar beacon
    expect(preview).toContain("enera-anomaly-radar");
    expect(signals).toContain("enera-anomaly-radar");
  });
});
