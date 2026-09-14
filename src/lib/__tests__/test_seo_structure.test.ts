import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Stage 24 — SEO Structure & Metadata Audit", () => {
  const rootRoutePath = path.resolve(__dirname, "../../routes/__root.tsx");
  const indexRoutePath = path.resolve(__dirname, "../../routes/index.tsx");
  const eneraComponentsDir = path.resolve(__dirname, "../../components/landing/enera");

  const rootRouteContent = fs.readFileSync(rootRoutePath, "utf-8");
  const indexRouteContent = fs.readFileSync(indexRoutePath, "utf-8");

  describe("Primary Positioning & Metadata Specifications", () => {
    it("should configure exact required Title: 'ENERA | Energy Financial Intelligence'", () => {
      expect(indexRouteContent).toContain('title: "ENERA | Energy Financial Intelligence"');
      expect(rootRouteContent).toContain('title: "ENERA | Energy Financial Intelligence"');
    });

    it("should configure exact required Description", () => {
      const expectedDescription =
        "ENERA transforms complex energy and billing information into clear, actionable intelligence for better financial and operational decisions.";
      expect(indexRouteContent).toContain(expectedDescription);
      expect(rootRouteContent).toContain(expectedDescription);
    });

    it("should include complete Open Graph metadata (og:title, og:description, og:type, og:site_name)", () => {
      expect(indexRouteContent).toContain('property: "og:title"');
      expect(indexRouteContent).toContain('content: "ENERA | Energy Financial Intelligence"');
      expect(indexRouteContent).toContain('property: "og:description"');
      expect(indexRouteContent).toContain('property: "og:type"');
      expect(indexRouteContent).toContain('content: "website"');
      expect(indexRouteContent).toContain('property: "og:site_name"');
      expect(indexRouteContent).toContain('content: "ENERA"');
    });

    it("should include complete Twitter metadata (twitter:card, twitter:title, twitter:description)", () => {
      expect(indexRouteContent).toContain('name: "twitter:card"');
      expect(indexRouteContent).toContain('content: "summary_large_image"');
      expect(indexRouteContent).toContain('name: "twitter:title"');
      expect(indexRouteContent).toContain('content: "ENERA | Energy Financial Intelligence"');
      expect(indexRouteContent).toContain('name: "twitter:description"');
    });

    it("should NOT expose internal technical implementation details in metadata (Level 3 Governance)", () => {
      // Forbidden technical strings in metadata sections
      const forbiddenTerms = [
        "supabase",
        "postgres",
        "mongodb",
        "schema",
        "database_url",
        "service_role",
        "api/v1",
        "jwt",
        "localhost",
      ];

      // Extract metadata blocks
      const indexHeadMatch = indexRouteContent.match(/head:\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\)/);
      const rootHeadMatch = rootRouteContent.match(/head:\s*\(\)\s*=>\s*\(\{([\s\S]*?)\}\)/);

      expect(indexHeadMatch).toBeTruthy();
      expect(rootHeadMatch).toBeTruthy();

      const indexHead = indexHeadMatch ? indexHeadMatch[1].toLowerCase() : "";
      const rootHead = rootHeadMatch ? rootHeadMatch[1].toLowerCase() : "";

      for (const term of forbiddenTerms) {
        expect(indexHead).not.toContain(term);
        expect(rootHead).not.toContain(term);
      }
    });
  });

  describe("Heading Structure: Exactly ONE H1 Per Page", () => {
    it("should have exactly one H1 across the ENERA landing page components", () => {
      const eneraFiles = fs
        .readdirSync(eneraComponentsDir)
        .filter((f) => f.endsWith(".tsx") && !f.includes(".test."));

      const h1Occurrences: { file: string; line: string }[] = [];

      for (const file of eneraFiles) {
        const filePath = path.join(eneraComponentsDir, file);
        const lines = fs.readFileSync(filePath, "utf-8").split("\n");
        lines.forEach((line, idx) => {
          if (/<h1\b/i.test(line)) {
            h1Occurrences.push({ file, line: `Line ${idx + 1}: ${line.trim()}` });
          }
        });
      }

      // Exactly ONE H1 across all landing components
      expect(h1Occurrences).toHaveLength(1);
      expect(h1Occurrences[0].file).toBe("EneraHeroSection.tsx");
    });
  });

  describe("Heading Hierarchy: Logical H2 and H3 Structure", () => {
    const activeLandingSections = [
      "EneraProductSignalsSection.tsx",
      "EneraProductInterfacePreviewSection.tsx",
      "EneraAudienceSection.tsx",
      "EneraBillSignalSection.tsx",
      "EneraCopilotSection.tsx",
      "EneraAISection.tsx",
      "EneraTrustSection.tsx",
      "EneraContactSection.tsx",
    ];

    it("should define an H2 for every major landing section", () => {
      for (const file of activeLandingSections) {
        const filePath = path.join(eneraComponentsDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content).toMatch(/<h2\b/);
      }
    });

    it("should define H3 headings under H2 in sections and footer", () => {
      const footerPath = path.join(eneraComponentsDir, "EneraFooter.tsx");
      const footerContent = fs.readFileSync(footerPath, "utf-8");
      
      // Footer columns should use structured H3
      expect(footerContent).toContain("PLATFORM");
      expect(footerContent).toContain("SOLUTIONS");
      expect(footerContent).toContain("RESOURCES");
      expect(footerContent).toContain("COMPANY");
      expect(footerContent).toContain("LEGAL");
      expect(footerContent).toMatch(/<h3[^>]*>\s*PLATFORM\s*<\/h3>/);
      expect(footerContent).toMatch(/<h3[^>]*>\s*SOLUTIONS\s*<\/h3>/);
      expect(footerContent).toMatch(/<h3[^>]*>\s*RESOURCES\s*<\/h3>/);
      expect(footerContent).toMatch(/<h3[^>]*>\s*COMPANY\s*<\/h3>/);
      expect(footerContent).toMatch(/<h3[^>]*>\s*LEGAL\s*<\/h3>/);
    });

    it("should not skip from H2 directly to H4 without preceding H3 in product preview", () => {
      const previewPath = path.join(eneraComponentsDir, "EneraProductInterfacePreviewSection.tsx");
      const previewContent = fs.readFileSync(previewPath, "utf-8");
      // All anomaly subcards and dossier cards should use H3
      expect(previewContent).toMatch(/<h3[^>]*>[\s\S]*?Statutory Public Holiday Billed as Weekday Peak[\s\S]*?<\/h3>/);
      expect(previewContent).toMatch(/<h3[^>]*>[\s\S]*?Maximum Demand Ratchet Overstatement[\s\S]*?<\/h3>/);
      expect(previewContent).toMatch(/<h3[^>]*>[\s\S]*?Power Factor Boundary Compliant[\s\S]*?<\/h3>/);
      expect(previewContent).toMatch(/<h3[^>]*>[\s\S]*?Apex Precision Manufacturing[\s\S]*?<\/h3>/);
    });
  });
});
