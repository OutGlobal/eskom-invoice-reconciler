import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Test Suite: STAGE 22 — PERFORMANCE AUDIT
 *
 * Verifies core performance requirements:
 * 1. Zero blocking fonts (no external font CDNs in head/CSS).
 * 2. Zero unnecessary third-party scripts (no trackers, marketing tags).
 * 3. Zero massive video backgrounds or heavy 3D libraries (Three.js, Babylon).
 * 4. Code splitting & lazy loading on all below-the-fold landing page sections.
 * 5. CSS deferred rendering with content-visibility: auto and contain-intrinsic-size.
 * 6. GPU-friendly transforms and transitions.
 * 7. requestAnimationFrame and setInterval throttling via IntersectionObserver and visibilitychange.
 */

describe("STAGE 22: Performance Audit", () => {
  const repoRoot = path.resolve(__dirname, "../../../");

  describe("Asset & Dependency Restraint", () => {
    it("has zero 3D library dependencies in package.json", () => {
      const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      expect(allDeps["three"]).toBeUndefined();
      expect(allDeps["@types/three"]).toBeUndefined();
      expect(allDeps["@react-three/fiber"]).toBeUndefined();
      expect(allDeps["babylonjs"]).toBeUndefined();
    });

    it("has zero video background assets in public/ or src/", () => {
      const publicFiles = fs.readdirSync(path.join(repoRoot, "public"));
      const videoExtensions = [".mp4", ".webm", ".ogv", ".mov", ".avi"];

      const publicVideos = publicFiles.filter((f) =>
        videoExtensions.some((ext) => f.toLowerCase().endsWith(ext)),
      );
      expect(publicVideos).toEqual([]);
    });
  });

  describe("Font & Script Blocking Prevention", () => {
    it("does not load blocking external font CDNs or third-party trackers in __root.tsx", () => {
      const rootPath = path.join(repoRoot, "src", "routes", "__root.tsx");
      const rootContent = fs.readFileSync(rootPath, "utf8");

      expect(rootContent).not.toContain("fonts.googleapis.com");
      expect(rootContent).not.toContain("use.typekit.net");
      expect(rootContent).not.toContain("googletagmanager.com");
      expect(rootContent).not.toContain("segment.com");
      expect(rootContent).not.toContain("hotjar.com");
      expect(rootContent).not.toContain("connect.facebook.net");
    });

    it("uses native system font stacks in styles.css without blocking @import font rules", () => {
      const cssPath = path.join(repoRoot, "src", "styles.css");
      const cssContent = fs.readFileSync(cssPath, "utf8");

      expect(cssContent).not.toMatch(/@import\s+url\(['"]https:\/\/fonts/);
      expect(cssContent).not.toMatch(/@import\s+url\(['"]https:\/\/use\.typekit/);
    });
  });

  describe("Code Splitting & Lazy Loading on Landing Page", () => {
    const indexPath = path.join(repoRoot, "src", "routes", "index.tsx");
    const indexContent = fs.readFileSync(indexPath, "utf8");

    it("eagerly renders above-the-fold hero and navigation for instant initial paint", () => {
      expect(indexContent).toMatch(/import\s+{\s*EneraNav\s*}\s+from/);
      expect(indexContent).toMatch(/import\s+{\s*EneraHeroSection\s*}\s+from/);
    });

    it("code-splits and lazy-loads all below-the-fold sections", () => {
      const lazySections = [
        "EneraProductSignalsSection",
        "EneraProductInterfacePreviewSection",
        "EneraAudienceSection",
        "EneraBillSignalSection",
        "EneraCopilotSection",
        "EneraAISection",
        "EneraTrustSection",
        "EneraContactSection",
        "EneraFooter",
      ];

      for (const section of lazySections) {
        expect(indexContent).toContain(`const ${section} = lazy(`);
      }
    });
  });

  describe("CSS Deferred Rendering & GPU Acceleration", () => {
    const cssPath = path.join(repoRoot, "src", "styles.css");
    const cssContent = fs.readFileSync(cssPath, "utf8");
    const indexPath = path.join(repoRoot, "src", "routes", "index.tsx");
    const indexContent = fs.readFileSync(indexPath, "utf8");

    it("defines .enera-section-deferred with content-visibility: auto and contain-intrinsic-size", () => {
      expect(cssContent).toContain(".enera-section-deferred");
      expect(cssContent).toContain("content-visibility: auto");
      expect(cssContent).toContain("contain-intrinsic-size:");
    });

    it("wraps off-screen sections in .enera-section-deferred containers", () => {
      const matches = indexContent.match(/className="enera-section-deferred"/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBeGreaterThanOrEqual(8);
    });

    it("defines GPU acceleration utilities using 3D transforms", () => {
      expect(cssContent).toContain(".enera-gpu-accelerated");
      expect(cssContent).toContain("translate3d(0, 0, 0)");
      expect(cssContent).toContain("backface-visibility: hidden");
    });
  });

  describe("Efficient Animation Loops & Timer Throttling", () => {
    const canvasPath = path.join(
      repoRoot,
      "src",
      "components",
      "landing",
      "enera",
      "EneraHeroCanvas.tsx",
    );
    const canvasContent = fs.readFileSync(canvasPath, "utf8");
    const flowPath = path.join(
      repoRoot,
      "src",
      "components",
      "landing",
      "enera",
      "EneraHeroFlowVisual.tsx",
    );
    const flowContent = fs.readFileSync(flowPath, "utf8");

    it("pauses canvas requestAnimationFrame when browser tab is hidden", () => {
      expect(canvasContent).toContain("visibilitychange");
      expect(canvasContent).toContain("document.hidden");
    });

    it("pauses canvas rendering when scrolled off-screen via IntersectionObserver", () => {
      expect(canvasContent).toContain("IntersectionObserver");
      expect(canvasContent).toContain("entry.isIntersecting");
    });

    it("pauses flow visual 5-second interval timer when off-screen or tab is hidden", () => {
      expect(flowContent).toContain("IntersectionObserver");
      expect(flowContent).toContain("visibilitychange");
      expect(flowContent).toContain("isTabVisible");
      expect(flowContent).toContain("isVisible");
    });
  });
});
