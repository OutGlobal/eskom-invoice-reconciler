import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Stage 27 — Advanced Visual Signature & Subtle Movement Moments", () => {
  const stylesPath = path.resolve(process.cwd(), "src/styles.css");
  const interfacePreviewPath = path.resolve(
    process.cwd(),
    "src/components/landing/enera/EneraProductInterfacePreviewSection.tsx",
  );
  const copilotSectionPath = path.resolve(
    process.cwd(),
    "src/components/landing/enera/EneraCopilotSection.tsx",
  );
  const signalsSectionPath = path.resolve(
    process.cwd(),
    "src/components/landing/enera/EneraProductSignalsSection.tsx",
  );

  const stylesContent = fs.readFileSync(stylesPath, "utf-8");
  const interfacePreviewContent = fs.readFileSync(interfacePreviewPath, "utf-8");
  const copilotContent = fs.readFileSync(copilotSectionPath, "utf-8");
  const signalsContent = fs.readFileSync(signalsSectionPath, "utf-8");

  it("defines GPU-friendly animation keyframes for traveling energy line, anomaly radar, and stream pulses", () => {
    // 1. Chart traveling line
    expect(stylesContent).toContain(".enera-chart-traveling-line");
    expect(stylesContent).toContain("@keyframes enera-chart-stream");

    // 2. Anomaly radar ping
    expect(stylesContent).toContain(".enera-anomaly-radar");
    expect(stylesContent).toContain("@keyframes enera-radar-ping");

    // 3. Data stream pulse
    expect(stylesContent).toContain(".enera-data-stream-pulse");
    expect(stylesContent).toContain("@keyframes enera-stream-flow");

    // 4. Accessibility & reduced motion safeguards
    expect(stylesContent).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesContent).toContain("animation-duration: 0.01ms !important");
  });

  it("implements a thin energy line traveling through the 24-hour demand chart in View 3", () => {
    // View 3 should have an SVG overlay with the traveling energy line
    expect(interfacePreviewContent).toContain("chartEnergyGradient");
    expect(interfacePreviewContent).toContain("enera-chart-traveling-line");
    expect(interfacePreviewContent).toContain("Morning Peak Waypoint");
    expect(interfacePreviewContent).toContain("Evening Peak Waypoint");
    // Telemetry scanner line present
    expect(interfacePreviewContent).toContain("enera-scan");
  });

  it("implements a billing number transitioning into a clean financial insight in View 1", () => {
    // Billing to insight transition card
    expect(interfacePreviewContent).toContain("Reconciliation Signal Transition");
    expect(interfacePreviewContent).toContain("transitionView");
    expect(interfacePreviewContent).toContain("R 1,842,500.00");
    expect(interfacePreviewContent).toContain("Deterministic Verification");
    expect(interfacePreviewContent).toContain("+R 53,380.00 Credit");
    expect(interfacePreviewContent).toContain("16-June Public Holiday Peak misclassification");
  });

  it("implements a data stream resolving into a financial metric in EneraCopilotSection", () => {
    // Data stream resolution
    expect(copilotContent).toContain("TELEMETRY STREAM TO FINANCIAL METRIC RESOLUTION");
    expect(copilotContent).toContain("INCOMING TELEMETRY STREAM");
    expect(copilotContent).toContain("enera-data-stream-pulse");
    expect(copilotContent).toContain("Deterministic Tariff Engine");
    expect(copilotContent).toContain("RESOLVED FINANCIAL METRIC");

    // Scenarios demonstrating direct mathematical resolution
    expect(copilotContent).toContain("+R 24,180.00");
    expect(copilotContent).toContain("+R 14,166.00");
    expect(copilotContent).toContain("+R 27,800.00");
  });

  it("implements subtle anomaly radar indicators across interface and signals", () => {
    // Subtle anomaly radar in View 4 and on chart peak in View 3
    expect(interfacePreviewContent).toContain("enera-anomaly-radar");
    expect(interfacePreviewContent).toContain("Flagged: +250 kVA Overstated");

    // Anomaly radar in platform capabilities
    expect(signalsContent).toContain("enera-anomaly-radar");
    expect(signalsContent).toContain("ANOMALY");
  });

  it("supports viewport entrance animations for charts while respecting reduced motion", () => {
    // IntersectionObserver and viewport entry state
    expect(interfacePreviewContent).toContain("IntersectionObserver");
    expect(interfacePreviewContent).toContain("hasEnteredViewport");
    expect(interfacePreviewContent).toContain("prefers-reduced-motion");
    expect(interfacePreviewContent).toContain("INTERVAL_BARS");

    // Bars animate smoothly with staggered delay
    expect(interfacePreviewContent).toContain('hasEnteredViewport ? `${bar.h}%` : "0%"');
    expect(interfacePreviewContent).toContain("transitionDelay");
  });

  it("strictly abides by Stage 18 Public Disclosure Model (no private technical leaks)", () => {
    const combinedLandingCode = interfacePreviewContent + copilotContent + signalsContent;

    // Zero-exposure checks
    expect(combinedLandingCode).not.toContain("public.invoices");
    expect(combinedLandingCode).not.toContain("public.meter_readings");
    expect(combinedLandingCode).not.toContain("supabase.co");
    expect(combinedLandingCode).not.toContain("process.env.");
    expect(combinedLandingCode).not.toContain("service_role");
    expect(combinedLandingCode).not.toContain("Bearer ");
  });
});
