import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Stage 33 — Dead Code Removal & Clean Architecture Verification", () => {
  const rootDir = process.cwd();

  const DELETED_FILES = [
    "src/domain/services/ingestionService.ts",
    "src/domain/services/anomalyEngine.ts",
    "src/domain/services/reconciliationEngine.ts",
    "src/domain/services/disputePackService.ts",
    "src/components/RawDataViewer.tsx",
    "src/components/landing/InteractiveBillDemo.tsx",
    "src/components/landing/AiIntelligenceSection.tsx",
    "src/components/landing/BigIdeaSection.tsx",
    "src/components/landing/BillStorySection.tsx",
    "src/components/landing/ExecutiveRoiSection.tsx",
    "src/components/landing/FinalCtaSection.tsx",
    "src/components/landing/HeroSection.tsx",
    "src/components/landing/HowItWorksSection.tsx",
    "src/components/landing/LandingNav.tsx",
    "src/components/landing/MoneyFlowSection.tsx",
    "src/components/landing/MultiSiteSection.tsx",
    "src/components/landing/ReconciliationVisualSection.tsx",
    "src/components/landing/TrustAuditSection.tsx",
    "src/components/landing/UseCasesSection.tsx",
    "src/components/landing/enera/EneraAuditTrailSection.tsx",
    "src/components/landing/enera/EneraDifferenceSection.tsx",
    "src/components/landing/enera/EneraFinalCtaSection.tsx",
    "src/components/landing/enera/EneraHeroSceneEngine.tsx",
    "src/components/landing/enera/EneraImpactSection.tsx",
    "src/components/landing/enera/EneraInteractiveUploadSection.tsx",
    "src/components/landing/enera/EneraNetworkSection.tsx",
    "src/components/landing/enera/EneraSouthAfricanContextSection.tsx",
    "src/components/reconciliation/DisputePackModal.tsx",
    "src/components/reconciliation/ReconciliationDashboard.tsx",
    "src/components/governance/ApprovalWorkflowBar.tsx",
    "src/components/investigation/AiInvestigationPanel.tsx",
    "src/lib/pdfTariff.ts",
    "src/lib/aiParser.ts",
    "src/lib/ingestionPipeline.ts",
  ];

  it("1. Verifies that all 34 confirmed dead files have been completely eliminated from the filesystem", () => {
    for (const relPath of DELETED_FILES) {
      const fullPath = path.resolve(rootDir, relPath);
      expect(
        fs.existsSync(fullPath),
        `Expected dead file '${relPath}' to be deleted, but it still exists!`,
      ).toBe(false);
    }
  });

  it("2. Verifies that zero active source files contain dangling imports targeting deleted modules", () => {
    function walk(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(full));
        } else if (/\.(ts|tsx)$/.test(file) && !file.includes("stage33_dead_code_elimination")) {
          results.push(full);
        }
      });
      return results;
    }

    const allSourceFiles = walk(path.resolve(rootDir, "src"));

    // Specific module specifiers for deleted files
    const deletedModulePatterns = [
      /from\s+["'][^"']*services\/ingestionService["']/,
      /from\s+["'][^"']*services\/anomalyEngine["']/,
      /from\s+["'][^"']*services\/reconciliationEngine["']/,
      /from\s+["'][^"']*services\/disputePackService["']/,
      /from\s+["'][^"']*RawDataViewer["']/,
      /from\s+["'][^"']*InteractiveBillDemo["']/,
      /from\s+["'][^"']*AiIntelligenceSection["']/,
      /from\s+["'][^"']*BigIdeaSection["']/,
      /from\s+["'][^"']*BillStorySection["']/,
      /from\s+["'][^"']*ExecutiveRoiSection["']/,
      /from\s+["'][^"']*HowItWorksSection["']/,
      /from\s+["'][^"']*LandingNav["']/,
      /from\s+["'][^"']*MoneyFlowSection["']/,
      /from\s+["'][^"']*MultiSiteSection["']/,
      /from\s+["'][^"']*ReconciliationVisualSection["']/,
      /from\s+["'][^"']*TrustAuditSection["']/,
      /from\s+["'][^"']*UseCasesSection["']/,
      /from\s+["'][^"']*EneraAuditTrailSection["']/,
      /from\s+["'][^"']*EneraDifferenceSection["']/,
      /from\s+["'][^"']*EneraFinalCtaSection["']/,
      /from\s+["'][^"']*EneraHeroSceneEngine["']/,
      /from\s+["'][^"']*EneraImpactSection["']/,
      /from\s+["'][^"']*EneraInteractiveUploadSection["']/,
      /from\s+["'][^"']*EneraNetworkSection["']/,
      /from\s+["'][^"']*EneraSouthAfricanContextSection["']/,
      /from\s+["'][^"']*DisputePackModal["']/,
      /from\s+["'][^"']*ReconciliationDashboard["']/,
      /from\s+["'][^"']*ApprovalWorkflowBar["']/,
      /from\s+["'][^"']*AiInvestigationPanel["']/,
      /from\s+["'][^"']*pdfTariff["']/,
      /from\s+["'][^"']*aiParser["']/,
      /from\s+["'][^"']*ingestionPipeline["']/,
    ];

    for (const srcFile of allSourceFiles) {
      const content = fs.readFileSync(srcFile, "utf-8");
      for (const pattern of deletedModulePatterns) {
        const matches = content.match(pattern);
        expect(
          matches,
          `File '${path.relative(rootDir, srcFile)}' contains dangling import matching '${pattern}'!`,
        ).toBeNull();
      }
    }
  });

  it("3. Verifies that pruned functions are no longer exported from supabase.ts", () => {
    const supabasePath = path.resolve(rootDir, "src/lib/supabase.ts");
    const content = fs.readFileSync(supabasePath, "utf-8");

    expect(content).not.toContain("saveRawDocumentData");
    expect(content).not.toContain("saveValidationResults");
    expect(content).not.toContain("saveProcessingLog");
    expect(content).not.toContain("syncInvoiceToSupabase");
    expect(content).not.toContain("syncMeterReadingsToSupabase");
    expect(content).not.toContain("SupabaseRawDocument");
    expect(content).not.toContain("SupabaseValidationResult");
  });

  it("4. Verifies that active data persistence and authoritative reconciliation services remain intact", async () => {
    // Authoritative reconciliation engine is imported and functional
    const { DeterministicReconciliationEngine } =
      await import("../../domain/reconciliation/reconciliationEngine");
    expect(DeterministicReconciliationEngine).toBeDefined();
    expect(typeof DeterministicReconciliationEngine.reconcile).toBe("function");

    // Secure ingestion gateway is imported and functional
    const { SecureIngestionGateway } =
      await import("../../domain/ingestion/secureIngestionGateway");
    expect(SecureIngestionGateway).toBeDefined();
    expect(typeof SecureIngestionGateway.processUpload).toBe("function");

    // Production observability service is imported and functional
    const { ProductionObservabilityService } =
      await import("../../domain/observability/productionObservabilityService");
    expect(ProductionObservabilityService).toBeDefined();
  });
});
