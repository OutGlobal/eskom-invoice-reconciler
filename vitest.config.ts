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
    ],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
