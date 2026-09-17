/**
 * Authoritative Schema Registry & Domain Mapping
 * Stage 3 — Database Source of Truth
 *
 * Formally maps and governs all 25 application domain entities:
 * 1. ORGANISATIONS
 * 2. USERS
 * 3. ROLES
 * 4. SITES
 * 5. METERS
 * 6. ACCOUNTS
 * 7. TARIFFS
 * 8. TARIFF_VERSIONS
 * 9. INVOICES
 * 10. INVOICE_LINE_ITEMS
 * 11. UPLOADS
 * 12. SOURCE_FILES
 * 13. METER_READINGS
 * 14. INTERVAL_DATA
 * 15. ENERGY_TOTALS
 * 16. DEMAND_DATA
 * 17. REACTIVE_ENERGY
 * 18. RECONCILIATIONS
 * 19. RECONCILIATION_RESULTS
 * 20. ANOMALIES
 * 21. ANALYSIS_RESULTS
 * 22. REPORTS
 * 23. AUDIT_LOGS
 * 24. PROCESSING_JOBS
 * 25. PROCESSING_ERRORS
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserSecurityContext } from "../security/types";

export type DomainConceptName =
  | "ORGANISATIONS"
  | "USERS"
  | "ROLES"
  | "SITES"
  | "METERS"
  | "ACCOUNTS"
  | "TARIFFS"
  | "TARIFF_VERSIONS"
  | "INVOICES"
  | "INVOICE_LINE_ITEMS"
  | "UPLOADS"
  | "SOURCE_FILES"
  | "METER_READINGS"
  | "INTERVAL_DATA"
  | "ENERGY_TOTALS"
  | "DEMAND_DATA"
  | "REACTIVE_ENERGY"
  | "RECONCILIATIONS"
  | "RECONCILIATION_RESULTS"
  | "ANOMALIES"
  | "ANALYSIS_RESULTS"
  | "REPORTS"
  | "AUDIT_LOGS"
  | "PROCESSING_JOBS"
  | "PROCESSING_ERRORS";

export interface DomainSchemaDefinition {
  concept: DomainConceptName;
  physicalTable: string;
  canonicalView: string;
  primaryKey: string;
  foreignKeys: string[];
  tenantScoped: boolean;
  tenantKey?: string;
  description: string;
  isExistingStructureReused: boolean;
}

/**
 * Authoritative mapping of all 25 domain concepts to database structures
 */
export const AUTHORITATIVE_DOMAIN_REGISTRY: Record<DomainConceptName, DomainSchemaDefinition> = {
  ORGANISATIONS: {
    concept: "ORGANISATIONS",
    physicalTable: "organisations",
    canonicalView: "organisations",
    primaryKey: "id",
    foreignKeys: [],
    tenantScoped: true,
    tenantKey: "id",
    description: "Corporate tenant entity root anchor",
    isExistingStructureReused: true,
  },
  USERS: {
    concept: "USERS",
    physicalTable: "users",
    canonicalView: "users",
    primaryKey: "id",
    foreignKeys: ["organisation_id -> organisations(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Authenticated system users with tenant role bindings",
    isExistingStructureReused: true,
  },
  ROLES: {
    concept: "ROLES",
    physicalTable: "roles",
    canonicalView: "roles",
    primaryKey: "id",
    foreignKeys: [],
    tenantScoped: false,
    description: "RBAC security roles and permission assignments",
    isExistingStructureReused: true,
  },
  SITES: {
    concept: "SITES",
    physicalTable: "sites",
    canonicalView: "sites",
    primaryKey: "id",
    foreignKeys: ["organisation_id -> organisations(id)", "customer_id -> customers(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Physical mining, industrial, or commercial premises",
    isExistingStructureReused: true,
  },
  METERS: {
    concept: "METERS",
    physicalTable: "meters",
    canonicalView: "meters",
    primaryKey: "id",
    foreignKeys: ["site_id -> sites(id)"],
    tenantScoped: true,
    tenantKey: "site_id",
    description: "Physical electricity meters and AMR communication channels",
    isExistingStructureReused: true,
  },
  ACCOUNTS: {
    concept: "ACCOUNTS",
    physicalTable: "customers",
    canonicalView: "accounts",
    primaryKey: "id",
    foreignKeys: ["organisation_id -> organisations(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Authoritative utility billing accounts and customer contracts",
    isExistingStructureReused: true,
  },
  TARIFFS: {
    concept: "TARIFFS",
    physicalTable: "tariff_schedules",
    canonicalView: "tariffs",
    primaryKey: "id",
    foreignKeys: [],
    tenantScoped: false,
    description: "Master catalog of gazetted NERSA/Eskom tariff structures",
    isExistingStructureReused: true,
  },
  TARIFF_VERSIONS: {
    concept: "TARIFF_VERSIONS",
    physicalTable: "tariff_versions",
    canonicalView: "tariff_versions",
    primaryKey: "id",
    foreignKeys: ["tariff_schedule_id -> tariff_schedules(id)"],
    tenantScoped: false,
    description: "Effective date versions with unbundled rates and rules",
    isExistingStructureReused: true,
  },
  INVOICES: {
    concept: "INVOICES",
    physicalTable: "invoice_records",
    canonicalView: "invoices",
    primaryKey: "id",
    foreignKeys: ["customer_id -> customers(id)", "site_id -> sites(id)", "meter_id -> meters(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Canonical header record for physical utility tax invoices",
    isExistingStructureReused: true,
  },
  INVOICE_LINE_ITEMS: {
    concept: "INVOICE_LINE_ITEMS",
    physicalTable: "invoice_line_items",
    canonicalView: "invoice_line_items",
    primaryKey: "id",
    foreignKeys: ["invoice_record_id -> invoice_records(id)"],
    tenantScoped: true,
    tenantKey: "invoice_record_id",
    description: "Unbundled line-by-line charges from physical invoices",
    isExistingStructureReused: true,
  },
  UPLOADS: {
    concept: "UPLOADS",
    physicalTable: "uploads",
    canonicalView: "upload_pipeline_view",
    primaryKey: "id",
    foreignKeys: ["organisation_id -> organisations(id)", "user_id -> users(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Authoritative file upload and ingestion lifecycle tracking registry",
    isExistingStructureReused: true,
  },
  SOURCE_FILES: {
    concept: "SOURCE_FILES",
    physicalTable: "source_files",
    canonicalView: "source_files",
    primaryKey: "id",
    foreignKeys: ["organisation_id -> organisations(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Ingested PDF and AMR telemetry file store with SHA-256 integrity",
    isExistingStructureReused: true,
  },
  METER_READINGS: {
    concept: "METER_READINGS",
    physicalTable: "meter_readings",
    canonicalView: "meter_readings",
    primaryKey: "id",
    foreignKeys: [],
    tenantScoped: false,
    description: "Raw periodic meter reading measurements and registers",
    isExistingStructureReused: true,
  },
  INTERVAL_DATA: {
    concept: "INTERVAL_DATA",
    physicalTable: "telemetry_intervals",
    canonicalView: "interval_data",
    primaryKey: "id",
    foreignKeys: ["meter_id -> meters(id)"],
    tenantScoped: true,
    tenantKey: "meter_id",
    description: "Partitioned 15/30-minute timeseries telemetry interval records",
    isExistingStructureReused: true,
  },
  ENERGY_TOTALS: {
    concept: "ENERGY_TOTALS",
    physicalTable: "invoice_determinants",
    canonicalView: "energy_totals",
    primaryKey: "id",
    foreignKeys: ["invoice_record_id -> invoice_records(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Authoritative active energy determinants (Peak, Standard, Off-Peak kWh)",
    isExistingStructureReused: true,
  },
  DEMAND_DATA: {
    concept: "DEMAND_DATA",
    physicalTable: "telemetry_daily_aggregates",
    canonicalView: "demand_data",
    primaryKey: "id",
    foreignKeys: ["meter_id -> meters(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Maximum demand, notified capacity (NMD), and excess kVA determinants",
    isExistingStructureReused: true,
  },
  REACTIVE_ENERGY: {
    concept: "REACTIVE_ENERGY",
    physicalTable: "tariff_components",
    canonicalView: "reactive_energy",
    primaryKey: "id",
    foreignKeys: [],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Reactive energy determinants, power factor, and 30% kVARh penalty metrics",
    isExistingStructureReused: true,
  },
  RECONCILIATIONS: {
    concept: "RECONCILIATIONS",
    physicalTable: "reconciliation_runs",
    canonicalView: "reconciliations",
    primaryKey: "id",
    foreignKeys: [
      "organisation_id -> organisations(id)",
      "invoice_record_id -> invoice_records(id)",
      "meter_id -> meters(id)",
      "tariff_version_id -> tariff_versions(id)",
    ],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Authoritative deterministic reconciliation run register",
    isExistingStructureReused: true,
  },
  RECONCILIATION_RESULTS: {
    concept: "RECONCILIATION_RESULTS",
    physicalTable: "reconciliation_results",
    canonicalView: "reconciliation_results",
    primaryKey: "id",
    foreignKeys: ["reconciliation_run_id -> reconciliation_runs(id)"],
    tenantScoped: true,
    tenantKey: "reconciliation_run_id",
    description: "Mathematical reconciliation comparison and total variance outputs",
    isExistingStructureReused: true,
  },
  ANOMALIES: {
    concept: "ANOMALIES",
    physicalTable: "discrepancy_events",
    canonicalView: "anomalies",
    primaryKey: "id",
    foreignKeys: [
      "reconciliation_run_id -> reconciliation_runs(id)",
      "invoice_record_id -> invoice_records(id)",
      "reason_code_id -> discrepancy_reason_codes(id)",
    ],
    tenantScoped: true,
    tenantKey: "reconciliation_run_id",
    description: "Flagged tariff, demand, calendar, or telemetry overcharge discrepancies",
    isExistingStructureReused: true,
  },
  ANALYSIS_RESULTS: {
    concept: "ANALYSIS_RESULTS",
    physicalTable: "calculation_snapshots",
    canonicalView: "analysis_results",
    primaryKey: "id",
    foreignKeys: ["reconciliation_run_id -> reconciliation_runs(id)"],
    tenantScoped: true,
    tenantKey: "reconciliation_run_id",
    description: "Immutable mathematical calculation snapshots and audit inputs/outputs",
    isExistingStructureReused: true,
  },
  REPORTS: {
    concept: "REPORTS",
    physicalTable: "generated_reports",
    canonicalView: "reports",
    primaryKey: "id",
    foreignKeys: ["organisation_id -> organisations(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Catalog of generated executive summaries and dispute packs",
    isExistingStructureReused: true,
  },
  AUDIT_LOGS: {
    concept: "AUDIT_LOGS",
    physicalTable: "audit_events",
    canonicalView: "audit_logs",
    primaryKey: "id",
    foreignKeys: ["organisation_id -> organisations(id)", "user_id -> users(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Tamper-evident system activity and administrative audit ledger",
    isExistingStructureReused: true,
  },
  PROCESSING_JOBS: {
    concept: "PROCESSING_JOBS",
    physicalTable: "ingestion_jobs",
    canonicalView: "processing_jobs",
    primaryKey: "id",
    foreignKeys: ["source_file_id -> source_files(id)"],
    tenantScoped: true,
    tenantKey: "organisation_id",
    description: "Pipeline ingestion job register with correlation IDs and statuses",
    isExistingStructureReused: true,
  },
  PROCESSING_ERRORS: {
    concept: "PROCESSING_ERRORS",
    physicalTable: "ingestion_errors",
    canonicalView: "processing_errors",
    primaryKey: "id",
    foreignKeys: ["job_id -> ingestion_jobs(id)"],
    tenantScoped: false,
    description: "Fatal and non-fatal pipeline error diagnostics and stack traces",
    isExistingStructureReused: true,
  },
};

export class AuthoritativeSchemaRegistry {
  /**
   * Return all 25 canonical domain names
   */
  public static getAllDomainNames(): DomainConceptName[] {
    return Object.keys(AUTHORITATIVE_DOMAIN_REGISTRY) as DomainConceptName[];
  }

  /**
   * Check if a domain concept is recognized
   */
  public static isDomainRecognized(name: string): boolean {
    const upper = name.toUpperCase() as DomainConceptName;
    return upper in AUTHORITATIVE_DOMAIN_REGISTRY;
  }

  /**
   * Get metadata for a specific domain concept
   */
  public static getDefinition(name: DomainConceptName): DomainSchemaDefinition {
    return AUTHORITATIVE_DOMAIN_REGISTRY[name];
  }

  /**
   * Get the primary physical database table name for a domain concept
   */
  public static getPhysicalTableName(name: DomainConceptName): string {
    return AUTHORITATIVE_DOMAIN_REGISTRY[name]?.physicalTable || name.toLowerCase();
  }

  /**
   * Get the canonical view name for a domain concept
   */
  public static getCanonicalViewName(name: DomainConceptName): string {
    return AUTHORITATIVE_DOMAIN_REGISTRY[name]?.canonicalView || name.toLowerCase();
  }

  /**
   * Build a resilient query targeting canonical view or physical table,
   * automatically enforcing tenant isolation if organisationId or context is provided.
   */
  public static queryDomain(
    supabaseClient: SupabaseClient<any, any, any>,
    name: DomainConceptName,
    optionsOrPreferView:
      | boolean
      | {
          preferView?: boolean;
          organisationId?: string;
          context?: UserSecurityContext;
          select?: string;
        } = false,
  ) {
    const preferView =
      typeof optionsOrPreferView === "boolean"
        ? optionsOrPreferView
        : !!optionsOrPreferView?.preferView;
    const orgId =
      typeof optionsOrPreferView === "object"
        ? optionsOrPreferView.organisationId || optionsOrPreferView.context?.organisationId
        : undefined;

    const selectClause =
      typeof optionsOrPreferView === "object" ? optionsOrPreferView.select : undefined;

    const def = AUTHORITATIVE_DOMAIN_REGISTRY[name];
    const targetTable = preferView ? def.canonicalView : def.physicalTable;
    const queryBuilder = supabaseClient.from(targetTable);

    if (orgId && def.tenantScoped && def.tenantKey) {
      const filterable = selectClause
        ? queryBuilder.select(selectClause)
        : queryBuilder.select("*");
      return (filterable as any).eq(def.tenantKey, orgId);
    }

    if (selectClause) {
      return queryBuilder.select(selectClause);
    }

    return queryBuilder;
  }
}
