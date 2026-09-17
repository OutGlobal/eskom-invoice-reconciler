import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`CTA STRATEGY TEST FAILED: ${message}`);
  }
}

export async function runCtaStrategyTestSuite() {
  console.log("=========================================================");
  console.log("  ENERA CLEANER CTA STRATEGY VERIFICATION SUITE");
  console.log("=========================================================\n");

  const repoRoot = path.resolve(process.cwd());
  const landingDir = path.join(repoRoot, "src", "components", "landing", "enera");

  // The active landing page components rendered in src/routes/index.tsx
  const activeLandingFiles = [
    "EneraNav.tsx",
    "EneraHeroSection.tsx",
    "EneraProductSignalsSection.tsx",
    "EneraProductInterfacePreviewSection.tsx",
    "EneraAudienceSection.tsx",
    "EneraBillSignalSection.tsx",
    "EneraCopilotSection.tsx",
    "EneraAISection.tsx",
    "EneraTrustSection.tsx",
    "EneraContactSection.tsx",
    "EneraFooter.tsx",
  ];

  // 1. Gather all declared DOM IDs across active landing components
  console.log("--- Check 1: Collecting Valid DOM Anchor IDs ---");
  const declaredAnchorIds = new Set<string>();

  for (const filename of activeLandingFiles) {
    const filePath = path.join(landingDir, filename);
    assert(fs.existsSync(filePath), `Active file ${filename} must exist`);
    const content = fs.readFileSync(filePath, "utf-8");

    // Match id="..." patterns
    const idMatches = content.matchAll(/id=["']([^"']+)["']/g);
    for (const match of idMatches) {
      declaredAnchorIds.add(match[1]);
    }
  }

  console.log(
    `Found ${declaredAnchorIds.size} declared DOM anchor IDs on landing page:`,
    Array.from(declaredAnchorIds).sort(),
  );
  assert(declaredAnchorIds.has("contact"), "DOM must have #contact anchor");
  assert(declaredAnchorIds.has("how-it-works"), "DOM must have #how-it-works anchor");
  assert(declaredAnchorIds.has("interface-previews"), "DOM must have #interface-previews anchor");
  console.log("✅ Check 1 Passed: Core CTA target anchors exist in DOM.\n");

  // 2. Verify Section Action Links Use Standardized CTA Phrases
  console.log("--- Check 2: Verifying Standardized CTA Phrases & Targets ---");
  const approvedCtaPhrases = new Set(["REQUEST A DEMO", "EXPLORE ENERA", "EXPLORE THE PLATFORM"]);

  // Check section ending action links in key sections
  const sectionExpectations = [
    {
      file: "EneraProductSignalsSection.tsx",
      expectedCta: "EXPLORE THE PLATFORM",
      target: "#interface-previews",
    },
    {
      file: "EneraProductInterfacePreviewSection.tsx",
      expectedCta: "REQUEST A DEMO",
      target: "#contact",
    },
    { file: "EneraAudienceSection.tsx", expectedCta: "EXPLORE ENERA", target: "#how-it-works" },
    {
      file: "EneraBillSignalSection.tsx",
      expectedCta: "EXPLORE THE PLATFORM",
      target: "#interface-previews",
    },
    { file: "EneraCopilotSection.tsx", expectedCta: "REQUEST A DEMO", target: "#contact" },
    { file: "EneraAISection.tsx", expectedCta: "REQUEST A DEMO", target: "#contact" },
    { file: "EneraTrustSection.tsx", expectedCta: "REQUEST A DEMO", target: "#contact" },
    { file: "EneraContactSection.tsx", expectedCta: "REQUEST A DEMO", target: null }, // submit button
  ];

  for (const exp of sectionExpectations) {
    const content = fs.readFileSync(path.join(landingDir, exp.file), "utf-8");
    assert(
      content.includes(exp.expectedCta),
      `${exp.file} must contain standardized CTA phrase "${exp.expectedCta}"`,
    );
    if (exp.target) {
      assert(
        content.includes(`href="${exp.target}"`),
        `${exp.file} CTA "${exp.expectedCta}" must route to "${exp.target}"`,
      );
    }
  }
  console.log(
    `✅ Check 2 Passed: All ${sectionExpectations.length} audited sections use standardized CTA phrases and valid routes.\n`,
  );

  // 3. Verify Every In-Page Anchor Link (#...) Routes to an Existing Anchor ID
  console.log("--- Check 3: Verifying Zero Broken Anchor Routes ---");
  let totalHrefsChecked = 0;
  for (const filename of activeLandingFiles) {
    const content = fs.readFileSync(path.join(landingDir, filename), "utf-8");
    const hrefMatches = content.matchAll(/href=["']#([^"']+)["']/g);

    for (const match of hrefMatches) {
      const anchor = match[1];
      totalHrefsChecked++;
      assert(
        declaredAnchorIds.has(anchor),
        `Broken anchor link found in ${filename}: href="#${anchor}" does not match any declared element id`,
      );
    }
  }
  console.log(
    `Checked ${totalHrefsChecked} internal anchor links across active landing components. Zero broken anchors.`,
  );
  console.log("✅ Check 3 Passed: 100% of internal links route to verified DOM anchors.\n");

  // 4. Verify No Dead / Empty Buttons
  console.log("--- Check 4: Verifying Zero Dead Buttons ---");
  for (const filename of activeLandingFiles) {
    const content = fs.readFileSync(path.join(landingDir, filename), "utf-8");
    // Find all <button ...> tags
    const buttonMatches = content.matchAll(/<button\b([^>]*)>/g);

    for (const match of buttonMatches) {
      const attrs = match[1];
      const hasOnClick = attrs.includes("onClick");
      const isSubmit = attrs.includes('type="submit"');
      assert(
        hasOnClick || isSubmit,
        `Found dead button without onClick or type="submit" in ${filename}: <button ${attrs}>`,
      );
    }
  }
  console.log(
    "✅ Check 4 Passed: Zero dead buttons found. Every button triggers a real state change or form submission.\n",
  );

  console.log("=========================================================");
  console.log("  ALL CLEANER CTA STRATEGY CHECKS PASSED (100%)");
  console.log("=========================================================");
}

describe("STAGE 19: Cleaner CTA Strategy", () => {
  it("passes all CTA taxonomy and route integrity checks", async () => {
    await runCtaStrategyTestSuite();
  });
});

if (process.argv[1]?.endsWith("test_cta_strategy.test.ts")) {
  runCtaStrategyTestSuite().catch((err) => {
    console.error("CTA Strategy test suite failed:", err);
    process.exit(1);
  });
}
