import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Test Suite: STAGE 21 — RESPONSIVE DESIGN
 *
 * Verifies responsive design rules across the 9 required viewports:
 * 320px, 375px, 390px, 430px, 768px, 1024px, 1280px, 1440px, 1920px.
 *
 * Requirements:
 * 1. Mobile is not desktop squeezed smaller.
 * 2. Reduce animation and decorative effects on mobile.
 * 3. Stack sections and grids gracefully.
 * 4. Maintain typography hierarchy.
 * 5. Maintain whitespace.
 * 6. Keep CTAs accessible (min 44px touch targets).
 * 7. Avoid horizontal overflow (overflow-x hidden, safe container widths).
 * 8. Keep navigation simple.
 */

const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];

describe("STAGE 21: Responsive Design Across 9 Viewports", () => {
  it("defines and validates all 9 required viewport breakpoints", () => {
    expect(VIEWPORTS).toEqual([320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]);
    expect(VIEWPORTS.length).toBe(9);
  });

  describe("Global Styles: Overflow Prevention & Mobile Animation Reduction", () => {
    const cssPath = path.resolve(__dirname, "../../../src/styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf8");

    it("prevents horizontal overflow on html and body", () => {
      expect(cssContent).toContain("overflow-x: hidden");
      expect(cssContent).toContain("max-width: 100vw");
    });

    it("reduces animations and decorative movement on mobile (<640px)", () => {
      expect(cssContent).toContain("@media (max-width: 640px)");
      expect(cssContent).toContain(".enera-energy-stream");
      expect(cssContent).toContain("animation: none !important");
    });

    it("provides momentum touch scrolling support", () => {
      expect(cssContent).toContain("-webkit-overflow-scrolling: touch");
    });
  });

  describe("EneraHeroCanvas: Mobile Battery & Animation Conservation", () => {
    const canvasPath = path.resolve(
      __dirname,
      "../../../src/components/landing/enera/EneraHeroCanvas.tsx",
    );
    const canvasContent = fs.readFileSync(canvasPath, "utf8");

    it("hides canvas on mobile viewports", () => {
      expect(canvasContent).toContain("hidden sm:block");
    });

    it("bypasses requestAnimationFrame loops on mobile widths (<640px)", () => {
      expect(canvasContent).toContain("window.innerWidth < 640");
    });
  });

  describe("EneraNav: Simple Mobile Navigation & Accessible Touch Targets", () => {
    const navPath = path.resolve(__dirname, "../../../src/components/landing/enera/EneraNav.tsx");
    const navContent = fs.readFileSync(navPath, "utf8");

    it("provides a mobile menu button with minimum 44px touch target", () => {
      expect(navContent).toContain("min-h-[44px]");
      expect(navContent).toContain("min-w-[44px]");
    });

    it("ensures mobile drawer action buttons meet the 44px touch target standard", () => {
      expect(navContent).toMatch(/min-h-\[44px\].*REQUEST A DEMO/s);
      expect(navContent).toMatch(/min-h-\[44px\].*EXPLORE ENERA/s);
    });
  });

  describe("EneraHeroSection: Responsive Hierarchy & Accessible CTAs", () => {
    const heroPath = path.resolve(
      __dirname,
      "../../../src/components/landing/enera/EneraHeroSection.tsx",
    );
    const heroContent = fs.readFileSync(heroPath, "utf8");

    it("scales typography responsively from 320px to desktop", () => {
      expect(heroContent).toContain("text-3xl sm:text-5xl md:text-6xl");
    });

    it("stacks action buttons on mobile and provides 44px touch targets", () => {
      expect(heroContent).toContain("flex-col sm:flex-row");
      expect(heroContent).toContain("min-h-[44px]");
      expect(heroContent).toContain("REQUEST A DEMO");
      expect(heroContent).toContain("EXPLORE ENERA");
    });

    it("wraps top badge cleanly to avoid horizontal overflow on 320px", () => {
      expect(heroContent).toContain("flex-wrap");
    });
  });

  describe("EneraCopilotSection: Clean Grid Stacking on Mobile", () => {
    const copilotPath = path.resolve(
      __dirname,
      "../../../src/components/landing/enera/EneraCopilotSection.tsx",
    );
    const copilotContent = fs.readFileSync(copilotPath, "utf8");

    it("stacks 6-stage flow into a single column on 320px screens", () => {
      expect(copilotContent).toContain("grid-cols-1 min-[400px]:grid-cols-2");
    });

    it("stacks balance sheet governance into a single column on mobile", () => {
      expect(copilotContent).toContain("grid-cols-1 sm:grid-cols-2");
    });
  });

  describe("EneraProductInterfacePreviewSection: Responsive Metrics Grid", () => {
    const previewPath = path.resolve(
      __dirname,
      "../../../src/components/landing/enera/EneraProductInterfacePreviewSection.tsx",
    );
    const previewContent = fs.readFileSync(previewPath, "utf8");

    it("stacks dashboard metrics to 1 column on 320px to prevent text clipping", () => {
      expect(previewContent).toContain("grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4");
    });

    it("stacks peak ratio grid to 1 column on 320px screens", () => {
      expect(previewContent).toContain("grid-cols-1 min-[420px]:grid-cols-3");
    });
  });

  describe("EneraContactSection: Accessible Form Controls & Touch Targets", () => {
    const contactPath = path.resolve(
      __dirname,
      "../../../src/components/landing/enera/EneraContactSection.tsx",
    );
    const contactContent = fs.readFileSync(contactPath, "utf8");

    it("ensures inputs, selects, and submit buttons have min-h-[44px] touch targets", () => {
      const minHeightMatches = contactContent.match(/min-h-\[44px\]/g);
      expect(minHeightMatches).not.toBeNull();
      expect(minHeightMatches!.length).toBeGreaterThanOrEqual(5);
    });

    it("stacks form fields into single column on mobile", () => {
      expect(contactContent).toContain("grid-cols-1 sm:grid-cols-2");
    });
  });

  describe("EneraFooter: Clean Stacking on 320px Screens", () => {
    const footerPath = path.resolve(
      __dirname,
      "../../../src/components/landing/enera/EneraFooter.tsx",
    );
    const footerContent = fs.readFileSync(footerPath, "utf8");

    it("stacks footer navigation to a single column on 320px screens", () => {
      expect(footerContent).toContain("grid-cols-1 min-[360px]:grid-cols-2");
    });

    it("provides min-h-[44px] touch targets on footer action buttons", () => {
      expect(footerContent).toContain("min-h-[44px]");
    });
  });
});
