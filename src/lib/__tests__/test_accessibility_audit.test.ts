import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Stage 23: Accessibility Audit", () => {
  const stylesPath = path.resolve(__dirname, "../../styles.css");
  const navPath = path.resolve(__dirname, "../../components/landing/enera/EneraNav.tsx");
  const previewPath = path.resolve(
    __dirname,
    "../../components/landing/enera/EneraProductInterfacePreviewSection.tsx",
  );
  const contactPath = path.resolve(
    __dirname,
    "../../components/landing/enera/EneraContactSection.tsx",
  );
  const flowVisualPath = path.resolve(
    __dirname,
    "../../components/landing/enera/EneraHeroFlowVisual.tsx",
  );
  const copilotPath = path.resolve(
    __dirname,
    "../../components/landing/enera/EneraCopilotSection.tsx",
  );
  const aiPath = path.resolve(__dirname, "../../components/landing/enera/EneraAISection.tsx");
  const trustPath = path.resolve(__dirname, "../../components/landing/enera/EneraTrustSection.tsx");
  const footerPath = path.resolve(__dirname, "../../components/landing/enera/EneraFooter.tsx");
  const indexPath = path.resolve(__dirname, "../../routes/index.tsx");

  describe("1. Visible Focus States & Reduced Motion Support (src/styles.css)", () => {
    const stylesContent = fs.readFileSync(stylesPath, "utf-8");

    it("defines high-contrast visible focus outline for interactive elements", () => {
      expect(stylesContent).toContain(":focus-visible");
      expect(stylesContent).toContain("outline: 2px solid #22d3ee");
      expect(stylesContent).toContain("outline-offset: 2px");
    });

    it("provides light background focus ring adaptation for WCAG contrast compliance", () => {
      expect(stylesContent).toContain(".bg-white :focus-visible");
      expect(stylesContent).toContain("outline-color: #0284c7");
    });

    it("includes comprehensive reduced motion support", () => {
      expect(stylesContent).toContain("@media (prefers-reduced-motion: reduce)");
      expect(stylesContent).toContain("scroll-behavior: auto !important");
      expect(stylesContent).toContain("animation-duration: 0.01ms !important");
      expect(stylesContent).toContain("transition-duration: 0.01ms !important");
    });

    it("includes screen reader utilities (.sr-only and .focus:not-sr-only)", () => {
      expect(stylesContent).toContain(".sr-only");
      expect(stylesContent).toContain(".focus\\:not-sr-only:focus-visible");
    });
  });

  describe("2. Accessible Navigation & Keyboard Support (EneraNav.tsx)", () => {
    const navContent = fs.readFileSync(navPath, "utf-8");

    it("provides accessible dropdown buttons with aria-expanded and aria-controls", () => {
      expect(navContent).toContain('id="products-menu-button"');
      expect(navContent).toContain('aria-expanded={activeDropdown === "products"}');
      expect(navContent).toContain('aria-controls="products-menu"');
      expect(navContent).toContain('id="solutions-menu-button"');
      expect(navContent).toContain('aria-expanded={activeDropdown === "solutions"}');
      expect(navContent).toContain('aria-controls="solutions-menu"');
    });

    it("provides accessible dropdown menus with role region and aria-labelledby", () => {
      expect(navContent).toContain('id="products-menu"');
      expect(navContent).toContain('role="region"');
      expect(navContent).toContain('aria-labelledby="products-menu-button"');
      expect(navContent).toContain('id="solutions-menu"');
      expect(navContent).toContain('aria-labelledby="solutions-menu-button"');
    });

    it("supports keyboard Escape key handler to dismiss open menus", () => {
      expect(navContent).toContain('e.key === "Escape"');
      expect(navContent).toContain("setMobileMenuOpen(false)");
      expect(navContent).toContain("setActiveDropdown(null)");
    });

    it("provides accessible mobile navigation toggle and modal dialog drawer", () => {
      expect(navContent).toContain("aria-expanded={mobileMenuOpen}");
      expect(navContent).toContain('aria-controls="mobile-nav-dialog"');
      expect(navContent).toContain('id="mobile-nav-dialog"');
      expect(navContent).toContain('role="dialog"');
      expect(navContent).toContain('aria-modal="true"');
      expect(navContent).toContain('aria-label="Mobile Navigation Menu"');
    });
  });

  describe("3. WAI-ARIA Tabs & High Contrast (EneraProductInterfacePreviewSection.tsx)", () => {
    const previewContent = fs.readFileSync(previewPath, "utf-8");

    it("implements standard WAI-ARIA tablist and tab semantics", () => {
      expect(previewContent).toContain('role="tablist"');
      expect(previewContent).toContain('aria-label="Platform Views"');
      expect(previewContent).toContain('role="tab"');
      expect(previewContent).toContain("aria-selected={isActive}");
      expect(previewContent).toContain("aria-controls={`panel-${tab.id}`}");
      expect(previewContent).toContain('role="tabpanel"');
      expect(previewContent).toContain("aria-labelledby={`tab-${activeTab}`}");
    });

    it("eliminates low-contrast text-slate-500 on dark obsidian backgrounds", () => {
      expect(previewContent).not.toContain("text-slate-500");
      expect(previewContent).toContain("text-slate-400");
    });

    it("marks purely decorative window chrome dots with aria-hidden", () => {
      expect(previewContent).toContain('aria-hidden="true"');
    });
  });

  describe("4. Accessible Forms (EneraContactSection.tsx)", () => {
    const contactContent = fs.readFileSync(contactPath, "utf-8");

    it("connects every form input and select with explicit label htmlFor", () => {
      expect(contactContent).toContain('htmlFor="workEmail"');
      expect(contactContent).toContain('id="workEmail"');
      expect(contactContent).toContain('htmlFor="contactOrganization"');
      expect(contactContent).toContain('id="contactOrganization"');
      expect(contactContent).toContain('htmlFor="contactMonthlySpend"');
      expect(contactContent).toContain('id="contactMonthlySpend"');
      expect(contactContent).toContain('htmlFor="contactSupplyType"');
      expect(contactContent).toContain('id="contactSupplyType"');
    });

    it("provides aria-required on mandatory fields and autocomplete hints", () => {
      expect(contactContent).toContain('aria-required="true"');
      expect(contactContent).toContain('autoComplete="email"');
      expect(contactContent).toContain('autoComplete="organization"');
    });

    it("announces submission status using role=status and aria-live=polite", () => {
      expect(contactContent).toContain('role="status"');
      expect(contactContent).toContain('aria-live="polite"');
    });

    it("guarantees accessible 44px touch target sizes for inputs and buttons", () => {
      expect(contactContent).toContain("min-h-[44px]");
    });
  });

  describe("5. WAI-ARIA Tabs in Copilot & AI Sections", () => {
    const copilotContent = fs.readFileSync(copilotPath, "utf-8");
    const aiContent = fs.readFileSync(aiPath, "utf-8");

    it("EneraCopilotSection implements tablist, tab, and tabpanel attributes", () => {
      expect(copilotContent).toContain('role="tablist"');
      expect(copilotContent).toContain('role="tab"');
      expect(copilotContent).toContain("aria-selected={isSelected}");
      expect(copilotContent).toContain('aria-controls="copilot-stage-detail"');
      expect(copilotContent).toContain('id="copilot-stage-detail"');
      expect(copilotContent).toContain('role="tabpanel"');
    });

    it("EneraAISection implements tablist, tab, and tabpanel attributes", () => {
      expect(aiContent).toContain('role="tablist"');
      expect(aiContent).toContain('role="tab"');
      expect(aiContent).toContain("aria-selected={isSelected}");
      expect(aiContent).toContain('aria-controls="ai-outcome-panel"');
      expect(aiContent).toContain('id="ai-outcome-panel"');
      expect(aiContent).toContain('role="tabpanel"');
    });
  });

  describe("6. Readable Font Sizes & Contrast across Landing Sections", () => {
    const flowVisualContent = fs.readFileSync(flowVisualPath, "utf-8");
    const trustContent = fs.readFileSync(trustPath, "utf-8");
    const footerContent = fs.readFileSync(footerPath, "utf-8");

    it("EneraHeroFlowVisual does not contain sub-10px unreadable fonts", () => {
      expect(flowVisualContent).not.toContain("text-[9px]");
      expect(flowVisualContent).not.toContain("text-[8px]");
    });

    it("EneraTrustSection uses high-contrast text on white surfaces", () => {
      expect(trustContent).toContain("text-slate-600");
    });

    it("EneraFooter uses high-contrast text and keyboard focus rings on links", () => {
      expect(footerContent).toContain("text-slate-400");
      expect(footerContent).toContain("focus-ring-enera");
      expect(footerContent).toContain('aria-hidden="true"');
    });
  });

  describe("7. Semantic HTML Landmarks & Skip Link (src/routes/index.tsx)", () => {
    const indexContent = fs.readFileSync(indexPath, "utf-8");

    it("contains an accessible skip-to-main-content link", () => {
      expect(indexContent).toContain('href="#main-content"');
      expect(indexContent).toContain("Skip to main content");
      expect(indexContent).toContain("sr-only focus:not-sr-only");
    });

    it("uses main landmark with id main-content and tabIndex -1", () => {
      expect(indexContent).toContain("<main");
      expect(indexContent).toContain('id="main-content"');
      expect(indexContent).toContain("tabIndex={-1}");
    });
  });

  describe("8. No Information Conveyed Only Through Colour", () => {
    const flowVisualContent = fs.readFileSync(flowVisualPath, "utf-8");
    const previewContent = fs.readFileSync(previewPath, "utf-8");

    it("verifies that verification statuses pair icons, text labels, and color", () => {
      expect(flowVisualContent).toContain("VERIFIED");
      expect(flowVisualContent).toContain("<Check");
      expect(previewContent).toContain("Clean Match");
      expect(previewContent).toContain("Discrepancy");
      expect(previewContent).toContain("WARNING");
    });
  });
});
