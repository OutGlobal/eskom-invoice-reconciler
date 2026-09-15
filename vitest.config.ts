import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/lib/__tests__/dashboard_command_centre.test.ts",
      "src/lib/__tests__/secure_ingestion_gateway.test.ts",
      "src/lib/__tests__/adversarial_principal_audit.test.ts",
      "src/lib/__tests__/authoritative_reconciliation_engine.test.ts",
      "src/lib/__tests__/deterministic_calendar_engine.test.ts",
      "src/lib/__tests__/data_governance_subsystem.test.ts",
      "src/lib/__tests__/deterministic_discrepancy_engine.test.ts",
      "src/lib/__tests__/test_public_disclosure_model.test.ts",
      "src/lib/__tests__/test_cta_strategy.test.ts",
      "src/lib/__tests__/test_responsive_viewports.test.ts",
      "src/lib/__tests__/test_performance_audit.test.ts",
      "src/lib/__tests__/test_accessibility_audit.test.ts",
      "src/lib/__tests__/test_seo_structure.test.ts",
      "src/lib/__tests__/test_page_structure_sequence.test.ts",
      "src/lib/__tests__/test_public_website_front_door_audit.test.ts",
      "src/lib/__tests__/test_visual_signature_advanced.test.ts",
      "src/lib/__tests__/test_sp_global_principles_audit.test.ts",
      "src/lib/__tests__/production_data_lifecycle.test.ts",
      "src/lib/__tests__/database_source_of_truth.test.ts",
    ],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
