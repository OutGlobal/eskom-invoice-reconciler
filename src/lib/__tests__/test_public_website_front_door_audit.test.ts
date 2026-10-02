import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Stage 26 — Public Website vs Application Dashboard Separation Audit", () => {
  const indexRoutePath = path.resolve(__dirname, "../../routes/index.tsx");
  const rootRoutePath = path.resolve(__dirname, "../../routes/__root.tsx");
  const landingDir = path.resolve(__dirname, "../../components/landing/enera");

  const indexContent = fs.readFileSync(indexRoutePath, "utf-8");
  const rootContent = fs.readFileSync(rootRoutePath, "utf-8");

  describe("1. Public Landing Page Front-Door Boundary", () => {
    it("should NOT mount application dashboard components on the public homepage", () => {
      const appDashboardComponents = [
        "CommandCentreDashboard",
        "SecureUploadGateway",
        "AuditViewer",
        "AnomalyDashboard",
        "InvoiceSelector",
        "AppSidebar",
      ];

      for (const comp of appDashboardComponents) {
        expect(indexContent).not.toContain(comp);
      }
    });

    it("should NOT include live file upload dropzones or file inputs on the public homepage", () => {
      // Find all active components imported in index.tsx
      const importedComponentMatches = indexContent.matchAll(
        /import\("@\/components\/landing\/enera\/([^"]+)"\)/g,
      );
      const importedFiles = Array.from(importedComponentMatches).map((m) => `${m[1]}.tsx`);

      // Add directly imported components
      importedFiles.push("EneraNav.tsx", "EneraHeroSection.tsx");

      for (const file of importedFiles) {
        const filePath = path.join(landingDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          // Ensure no live file upload input exists on the public landing page
          expect(content).not.toMatch(/<input[^>]*type=["']file["']/i);
          expect(content).not.toMatch(/dropzone/i);
        }
      }
    });

    it("should frame product visuals as previews and demonstrations, not working client dashboards", () => {
      const previewPath = path.join(landingDir, "EneraProductInterfacePreviewSection.tsx");
      const previewContent = fs.readFileSync(previewPath, "utf-8");

      // Verify that the visual interface is explicitly declared as a demonstration
      expect(previewContent).toContain("Simulated enterprise environment");
      expect(previewContent).toContain("synthetic demonstration data");
    });
  });

  describe("2. Authenticated Application Gating & Containment", () => {
    it("should gate application routes behind AuthGate in the root layout", () => {
      expect(rootContent).toContain(
        'const isPublicPage = pathname === "/" || pathname === "/login";',
      );
      expect(rootContent).toContain("<AuthGate>");
      expect(rootContent).toContain("<SidebarProvider>");
      expect(rootContent).toContain("<AppSidebar />");
    });

    it("should route all landing CTAs to demo briefings, exploration, or client portal sign-in", () => {
      const navPath = path.join(landingDir, "EneraNav.tsx");
      const heroPath = path.join(landingDir, "EneraHeroSection.tsx");
      const footerPath = path.join(landingDir, "EneraFooter.tsx");

      const navContent = fs.readFileSync(navPath, "utf-8");
      const heroContent = fs.readFileSync(heroPath, "utf-8");
      const footerContent = fs.readFileSync(footerPath, "utf-8");

      // Navigation actions
      expect(navContent).toContain('href="#contact"');
      expect(navContent).toContain('to={session ? "/dashboard" : "/login"}');

      // Hero actions
      expect(heroContent).toContain('href="#contact"');
      expect(heroContent).toContain('href="#how-it-works"');

      // Footer actions
      expect(footerContent).toContain('to={session ? "/dashboard" : "/login"}');
      expect(footerContent).toContain('href="#contact"');
    });
  });

  describe("3. Explaining vs Executing (What ENERA Does vs Working Dashboard)", () => {
    it("should present marketing & educational value across all landing components", () => {
      // 14 sequence sections must focus on outcomes, capabilities, methodologies, stakeholders, and trust
      expect(indexContent).toContain("EneraCapabilitiesSection"); // FROM ENERGY DATA TO DECISION
      expect(indexContent).toContain("EneraProductSignalsSection"); // ONE PLATFORM. MULTIPLE ENERGY SIGNALS
      expect(indexContent).toContain("EneraProductInterfacePreviewSection"); // SEE THE SIGNAL BEHIND THE NUMBER
      expect(indexContent).toContain("EneraBillSignalSection"); // HOW ENERA WORKS
      expect(indexContent).toContain("EneraAudienceSection"); // BUILT FOR THE PEOPLE WHO MANAGE ENERGY
      expect(indexContent).toContain("EneraAISection"); // ASK BETTER QUESTIONS
      expect(indexContent).toContain("EneraCopilotSection"); // SEE THE FINANCIAL SIGNAL
      expect(indexContent).toContain("EneraTrustSection"); // INTELLIGENCE YOU CAN TRACE
      expect(indexContent).toContain("EneraContactSection"); // REQUEST A DEMO
      expect(indexContent).toContain("EneraFaqSection"); // FREQUENTLY ASKED QUESTIONS
    });
  });
});
