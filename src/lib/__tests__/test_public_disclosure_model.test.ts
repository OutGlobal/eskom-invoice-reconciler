import { describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    throw new Error(`DISCLOSURE MODEL TEST FAILED: ${message}`);
  }
}

export async function runDisclosureModelTestSuite() {
  console.log("=========================================================");
  console.log("  ENERA PUBLIC DISCLOSURE MODEL VERIFICATION SUITE");
  console.log("=========================================================\n");

  const repoRoot = path.resolve(process.cwd());

  // 1. Verify Canonical Documentation Exists and Contains All 3 Tiers
  console.log("--- Check 1: Canonical Documentation Exists ---");
  const docPath = path.join(repoRoot, "docs", "PUBLIC_DISCLOSURE_MODEL.md");
  assert(fs.existsSync(docPath), "docs/PUBLIC_DISCLOSURE_MODEL.md must exist");
  const docContent = fs.readFileSync(docPath, "utf-8");

  assert(docContent.includes("LEVEL 1 — PUBLIC"), "Must define LEVEL 1 — PUBLIC");
  assert(docContent.includes("LEVEL 2 — CONTROLLED"), "Must define LEVEL 2 — CONTROLLED");
  assert(docContent.includes("LEVEL 3 — PRIVATE"), "Must define LEVEL 3 — PRIVATE");
  console.log("✅ Check 1 Passed: Canonical 3-tier standard documented.\n");

  // 2. Verify AGENTS.md Codifies the Standard
  console.log("--- Check 2: AGENTS.md Codifies Policy ---");
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  assert(fs.existsSync(agentsPath), "AGENTS.md must exist");
  const agentsContent = fs.readFileSync(agentsPath, "utf-8");
  assert(
    agentsContent.includes("Public Disclosure Model"),
    "AGENTS.md must include Public Disclosure Model",
  );
  assert(agentsContent.includes("LEVEL 1 — PUBLIC"), "AGENTS.md must define Level 1");
  assert(agentsContent.includes("LEVEL 2 — CONTROLLED"), "AGENTS.md must define Level 2");
  assert(agentsContent.includes("LEVEL 3 — PRIVATE"), "AGENTS.md must define Level 3");
  console.log("✅ Check 2 Passed: AGENTS.md codifies public disclosure rules for all agents.\n");

  // 3. Scan Public Components for Level 3 Prohibited Disclosures
  console.log("--- Check 3: Public Component Scanning for Level 3 Exposure ---");
  const publicDirs = [path.join(repoRoot, "src", "components", "landing", "enera")];
  const publicFiles = [path.join(repoRoot, "src", "routes", "index.tsx")];

  for (const dir of publicDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
      for (const f of files) {
        publicFiles.push(path.join(dir, f));
      }
    }
  }

  // Level 3 Prohibited strings or regexes in public surfaces
  const prohibitedPatterns = [
    {
      pattern: /public\.(invoices|meter_readings|overcharge_recoveries|raw_documents)/i,
      name: "Raw database schema table",
    },
    { pattern: /bramhseicmakyihvnvpo/i, name: "Internal project ID" },
    { pattern: /db\.[a-z0-9]+\.supabase\.co/i, name: "Database host reference" },
    { pattern: /service_role/i, name: "Service role credential" },
    { pattern: /SUPABASE_SERVICE/i, name: "Service role environment variable" },
    { pattern: /POST https:\/\/[^\s]+\/api\/v1\//i, name: "Raw private REST API endpoint" },
    { pattern: /system prompt:/i, name: "System prompt leak" },
    { pattern: /model configuration:/i, name: "Model configuration leak" },
  ];

  let totalFilesScanned = 0;
  const violations: string[] = [];

  for (const file of publicFiles) {
    if (!fs.existsSync(file)) continue;
    totalFilesScanned++;
    const content = fs.readFileSync(file, "utf-8");

    for (const rule of prohibitedPatterns) {
      if (rule.pattern.test(content)) {
        violations.push(`${path.basename(file)}: exposed ${rule.name}`);
      }
    }
  }

  console.log(`Scanned ${totalFilesScanned} public-facing files.`);
  if (violations.length > 0) {
    console.error("Violations detected:", violations);
  }
  assert(
    violations.length === 0,
    `Found ${violations.length} Level 3 disclosure violations in public files`,
  );
  console.log("✅ Check 3 Passed: 0 Level 3 private disclosures across all public files.\n");

  console.log("=========================================================");
  console.log("  ALL PUBLIC DISCLOSURE MODEL CHECKS PASSED (100%)");
  console.log("=========================================================");
}

describe("STAGE 18: Public Disclosure Model", () => {
  it("passes all public disclosure validation checks", async () => {
    await runDisclosureModelTestSuite();
  });
});

if (process.argv[1]?.endsWith("test_public_disclosure_model.test.ts")) {
  runDisclosureModelTestSuite().catch((err) => {
    console.error("Disclosure model test failed:", err);
    process.exit(1);
  });
}
