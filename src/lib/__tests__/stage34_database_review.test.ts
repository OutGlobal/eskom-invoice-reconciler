import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { AUTHORITATIVE_DOMAIN_REGISTRY } from "../../domain/database/authoritativeSchemaRegistry";

describe("Stage 34 — Final Database Review & Schema Governance", () => {
  const rootDir = process.cwd();
  const migrationsDir = path.resolve(rootDir, "supabase/migrations");

  // Read all SQL migrations into a single consolidated string
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const fullSchemaSql = migrationFiles
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf-8"))
    .join("\n\n");

  // 1. FOREIGN KEYS & RELATIONSHIP REVIEW
  describe("1. Foreign Keys & Hierarchical Relationships", () => {
    it("verifies the 5-level core hierarchy: Organisation -> Site -> POD -> Meter -> Channel", () => {
      // Organisation -> Site
      expect(fullSchemaSql).toMatch(/REFERENCES\s+public\.organisations\s*\(\s*id\s*\)/i);
      // Site -> POD
      expect(fullSchemaSql).toMatch(/REFERENCES\s+public\.sites\s*\(\s*id\s*\)/i);
      // POD -> Meter
      expect(fullSchemaSql).toMatch(/REFERENCES\s+public\.points_of_delivery\s*\(\s*id\s*\)/i);
      // Meter -> Channel
      expect(fullSchemaSql).toMatch(/REFERENCES\s+public\.meters\s*\(\s*id\s*\)/i);
    });

    it("verifies account relationships (customers -> organisations, sites, invoices)", () => {
      // customer -> organisation
      expect(fullSchemaSql).toMatch(
        /ALTER TABLE public\.customers ADD COLUMN organisation_id UUID REFERENCES public\.organisations/i,
      );
      // site -> customer
      expect(fullSchemaSql).toMatch(/customer_id UUID NOT NULL REFERENCES public\.customers/i);
      // invoice_records -> customer
      expect(fullSchemaSql).toMatch(/customer_id UUID REFERENCES public\.customers/i);
    });

    it("verifies invoice and reconciliation run foreign keys cascade cleanly", () => {
      // invoice_line_items -> invoice_records
      expect(fullSchemaSql).toMatch(
        /invoice_record_id UUID NOT NULL REFERENCES public\.invoice_records\(id\)\s+ON DELETE CASCADE/i,
      );
      // reconciliation_results -> reconciliation_runs
      expect(fullSchemaSql).toMatch(
        /reconciliation_run_id UUID NOT NULL UNIQUE REFERENCES public\.reconciliation_runs\(id\)\s+ON DELETE CASCADE/i,
      );
      // discrepancy_events -> reconciliation_runs
      expect(fullSchemaSql).toMatch(
        /reconciliation_run_id UUID NOT NULL REFERENCES public\.reconciliation_runs\(id\)\s+ON DELETE CASCADE/i,
      );
    });

    it("verifies all 25 domain concepts have defined primary and foreign keys in the registry", () => {
      const concepts = Object.values(AUTHORITATIVE_DOMAIN_REGISTRY);
      expect(concepts.length).toBe(25);

      for (const def of concepts) {
        expect(def.primaryKey).toBe("id");
        if (def.tenantScoped && def.concept !== "ORGANISATIONS") {
          expect(def.tenantKey).toBeDefined();
        }
      }
    });
  });

  // 2. PERFORMANCE INDEXING COVERAGE
  describe("2. Performance Indexing for Critical Query Patterns", () => {
    it("verifies organisation filtering indexes exist for multi-tenant isolation", () => {
      const orgIndexes = [
        "idx_customers_organisation_id",
        "idx_users_organisation_id",
        "idx_sites_tenant",
        "idx_meters_tenant",
        "idx_invoice_records_organisation_id",
        "idx_reconciliation_runs_tenant",
        "idx_uploads_org_status",
        "idx_source_files_tenant",
        "idx_telemetry_intervals_tenant",
        "idx_audit_ledger_org_created",
      ];

      for (const idx of orgIndexes) {
        expect(fullSchemaSql).toContain(idx);
      }
    });

    it("verifies site filtering and premise relationship indexes exist", () => {
      const siteIndexes = [
        "idx_sites_customer_id",
        "idx_meters_site_id",
        "idx_points_of_delivery_site",
        "idx_invoice_records_site",
        "idx_invoice_records_site_period",
      ];

      for (const idx of siteIndexes) {
        expect(fullSchemaSql).toContain(idx);
      }
    });

    it("verifies billing period and chronological invoice indexes exist", () => {
      const billingIndexes = [
        "idx_invoice_records_billing_period",
        "idx_invoice_records_billing_dates",
        "idx_invoice_records_org_dates",
        "idx_invoice_records_org_created",
      ];

      for (const idx of billingIndexes) {
        expect(fullSchemaSql).toContain(idx);
      }
    });

    it("verifies account and meter lookup indexes exist", () => {
      const meterAndAccountIndexes = [
        "idx_customers_org_account",
        "idx_invoice_records_customer",
        "idx_invoice_records_account_meter",
        "idx_telemetry_intervals_meter_id",
        "idx_telemetry_intervals_meter_ts",
        "idx_telemetry_intervals_org_meter_ts",
      ];

      for (const idx of meterAndAccountIndexes) {
        expect(fullSchemaSql).toContain(idx);
      }
    });

    it("verifies processing status and reconciliation lifecycle indexes exist", () => {
      const statusIndexes = [
        "idx_uploads_org_status",
        "idx_invoice_records_lifecycle_state",
        "idx_reconciliation_runs_tenant_status",
        "idx_reconciliation_runs_org_run_at",
        "idx_reconciliation_runs_org_status_run",
        "idx_discrepancy_events_org_status",
      ];

      for (const idx of statusIndexes) {
        expect(fullSchemaSql).toContain(idx);
      }
    });

    it("verifies timestamp and chronological audit ledger indexes exist", () => {
      const timestampIndexes = [
        "idx_telemetry_intervals_timestamp_utc",
        "idx_audit_ledger_sequence",
        "idx_audit_ledger_org_created",
        "idx_source_files_org_created",
        "idx_uploads_org_created",
      ];

      for (const idx of timestampIndexes) {
        expect(fullSchemaSql).toContain(idx);
      }
    });
  });

  // 3. CONSTRAINTS, DATA TYPES & NULLABILITY
  describe("3. Constraints, Unique Constraints, Data Types & Nullability", () => {
    it("enforces unique constraints on business identifiers", () => {
      // Account number uniqueness
      expect(fullSchemaSql).toMatch(/account_number\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
      // Invoice number uniqueness
      expect(fullSchemaSql).toMatch(/invoice_number\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
      // POD code uniqueness
      expect(fullSchemaSql).toMatch(/pod_code\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
      // Reconciliation run results uniqueness per run
      expect(fullSchemaSql).toMatch(/reconciliation_run_id\s+UUID\s+NOT\s+NULL\s+UNIQUE/i);
    });

    it("enforces non-negative constraints on physical engineering and financial values", () => {
      expect(fullSchemaSql).toMatch(
        /file_size_bytes\s+BIGINT\s+NOT\s+NULL\s+CHECK\s*\(\s*file_size_bytes\s*>=\s*0\s*\)/i,
      );
      expect(fullSchemaSql).toMatch(
        /row_count\s+INT\s+DEFAULT\s+0\s+CHECK\s*\(\s*row_count\s*>=\s*0\s*\)/i,
      );
      expect(fullSchemaSql).toMatch(
        /record_count\s+INT\s+DEFAULT\s+0\s+CHECK\s*\(\s*record_count\s*>=\s*0\s*\)/i,
      );
      expect(fullSchemaSql).toMatch(/CHECK\s*\(\s*supply_voltage_kv\s*>=\s*0\s*\)/i);
      expect(fullSchemaSql).toMatch(/CHECK\s*\(\s*notified_maximum_demand_kva\s*>=\s*0\s*\)/i);
    });

    it("enforces high-precision NUMERIC types for financial currency and energy measurements", () => {
      // Verifies decimal financial precision
      expect(fullSchemaSql).toMatch(/NUMERIC\s*\(\s*18\s*,\s*2\s*\)/i);
      // Verifies high precision engineering/rate precision
      expect(fullSchemaSql).toMatch(
        /NUMERIC\s*\(\s*18\s*,\s*4\s*\)|NUMERIC\s*\(\s*18\s*,\s*6\s*\)/i,
      );
    });

    it("enforces TIMESTAMPTZ with timezone on all audit and created_at timestamps", () => {
      expect(fullSchemaSql).toMatch(/created_at\s+TIMESTAMPTZ\s+DEFAULT\s+now\(\)/i);
      expect(fullSchemaSql).toMatch(/updated_at\s+TIMESTAMPTZ\s+DEFAULT\s+now\(\)/i);
      expect(fullSchemaSql).toMatch(/timestamp_utc\s+TIMESTAMPTZ/i);
    });
  });

  // 4. ROW-LEVEL SECURITY (RLS) POLICIES
  describe("4. Row Level Security (RLS) Policy Governance", () => {
    it("verifies RLS is enabled on all tenant-scoped operational tables", () => {
      const rlsTables = [
        "organisations",
        "users",
        "customers",
        "sites",
        "meters",
        "points_of_delivery",
        "meter_channels",
        "invoice_records",
        "invoice_line_items",
        "telemetry_intervals",
        "reconciliation_runs",
        "reconciliation_results",
        "discrepancy_events",
        "uploads",
        "source_files",
        "audit_events_ledger",
      ];

      for (const table of rlsTables) {
        expect(
          fullSchemaSql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`) ||
            fullSchemaSql.includes(
              `ALTER TABLE IF EXISTS public.${table} ENABLE ROW LEVEL SECURITY`,
            ),
          `Table ${table} must have RLS enabled!`,
        ).toBe(true);
      }
    });

    it("verifies anon access is revoked on core tenant tables", () => {
      expect(fullSchemaSql).toMatch(/REVOKE\s+ALL\s+ON\s+public\.customers\s+FROM\s+anon;/i);
      expect(fullSchemaSql).toMatch(/REVOKE\s+ALL\s+ON\s+public\.invoice_records\s+FROM\s+anon;/i);
      expect(fullSchemaSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+public\.telemetry_intervals\s+FROM\s+anon;/i,
      );
      expect(fullSchemaSql).toMatch(
        /REVOKE\s+ALL\s+ON\s+public\.reconciliation_runs\s+FROM\s+anon;/i,
      );
    });
  });
});
