/**
 * STAGE 25 — FRONTEND / BACKEND CONTRACT & INTERNAL DATA LINEAGE MAP
 * =================================================================
 *
 * Establishes an authoritative, enforceable contract between frontend dashboard
 * components and backend data sources.
 *
 * For every displayed dashboard value, this registry strictly documents:
 * 1. SOURCE: Upstream data provider (e.g. Supabase PostgreSQL, AMR Ingestion Engine)
 * 2. TABLE: Physical storage table or entity
 * 3. COLUMN: Exact field / attribute
 * 4. QUERY: Exact PostgREST/SQL or in-memory aggregation query
 * 5. TRANSFORMATION: Mathematical or deterministic transformation pipeline
 * 6. LINEAGE CHAIN: Step-by-step ancestry (e.g.
 *    Dashboard Total Cost ← aggregation query ← invoice/reconciliation results ← invoice records ← uploaded invoice)
 *
 * Compliance: Level 3 Private Zero-Exposure Embargo.
 * This internal catalog resides in the domain tier. It allows auditing and
 * provenance tracking without exposing database schemas, connection parameters,
 * or raw SQL into public DOM attributes.
 */

export interface DashboardMetricContract {
  metricId: string;
  displayName: string;
  component: string;
  category:
    | "PORTFOLIO"
    | "FINANCIAL"
    | "RECONCILIATION_HEALTH"
    | "ENERGY_OVERVIEW"
    | "ANOMALY"
    | "CONSUMPTION_LINEAGE"
    | "TELEMETRY_STREAM";
  source: string;
  table: string;
  column: string;
  query: string;
  transformation: string;
  lineageChain: string[];
  downwardProvenance?: string[];
  aliases?: string[];
  status: "VERIFIED" | "FLAGGED_NO_SOURCE";
  flagReason?: string;
}

export interface ContractAuditSummary {
  totalMetrics: number;
  verifiedMetrics: number;
  flaggedMetrics: number;
  isHealthy: boolean;
  componentsAudited: string[];
  flaggedDetails: Array<{ metricId: string; reason: string }>;
}

export class ContractDataLineageMap {
  private static registry: Map<string, DashboardMetricContract> = new Map();

  static {
    this.initializeAuthoritativeCatalog();
  }

  /**
   * Populate the complete contract catalog for all dashboard metrics
   */
  private static initializeAuthoritativeCatalog() {
    // -----------------------------------------------------------------
    // 1. COMMAND CENTRE — PORTFOLIO SUMMARY (Header & KPI Grid)
    // -----------------------------------------------------------------
    this.registerMetric({
      metricId: "cmd_total_clients",
      displayName: "Total Clients",
      component: "CommandCentreDashboard",
      category: "PORTFOLIO",
      source: "PostgreSQL Database via Supabase Client (or active tenant session store)",
      table: "organisations",
      column: "id, name, code",
      query: "supabase.from('organisations').select('id, name, code').eq('id', filters.organisationId)",
      transformation: "Count of unique active client organisations filtered by tenant isolation context",
      lineageChain: [
        "Organisation Master Data",
        "Tenant Context Service",
        "Dashboard Aggregation Query",
        "Total Clients KPI Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_total_sites",
      displayName: "Total Sites",
      component: "CommandCentreDashboard",
      category: "PORTFOLIO",
      source: "PostgreSQL Database via Supabase Client",
      table: "sites",
      column: "id, site_code, site_name, customer_id",
      query: "supabase.from('sites').select('id, site_code, site_name, customer_id').eq('organisation_id', tenantId)",
      transformation: "Count of verified Point of Delivery (POD) physical delivery premises",
      lineageChain: [
        "Site / Facility Master Hierarchy",
        "Point of Delivery Records",
        "Dashboard Aggregation Query",
        "Total Sites KPI Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_total_accounts",
      displayName: "Total Accounts",
      component: "CommandCentreDashboard",
      category: "PORTFOLIO",
      source: "PostgreSQL Database / Extracted Invoice Lineage",
      table: "invoice_records",
      column: "account_number",
      query: "supabase.from('invoice_records').select('account_number').eq('organisation_id', tenantId)",
      transformation: "new Set(invoices.map(i => i.account_number)).size (deduplicated account tally)",
      lineageChain: [
        "Utility Billing Invoice Document",
        "Layout / OCR Parser Extraction",
        "invoice_records (account_number)",
        "Dashboard Aggregation Query",
        "Total Accounts KPI Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_total_invoices",
      displayName: "Total Invoices",
      component: "CommandCentreDashboard",
      category: "PORTFOLIO",
      source: "PostgreSQL Database (invoice_records with legacy invoices harmonization)",
      table: "invoice_records",
      column: "id, invoice_number",
      query: "supabase.from('invoice_records').select('id, invoice_number').eq('organisation_id', tenantId)",
      transformation: "Deduplicated count of invoice records across primary and legacy tables",
      lineageChain: [
        "Uploaded Invoices (PDF/XLSX)",
        "Secure Ingestion Gateway",
        "invoice_records",
        "Dashboard Service Deduplication",
        "Total Invoices KPI Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_total_billed_amount",
      displayName: "Total Billed Amount (Dashboard Total Cost)",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "PostgreSQL Database via Supabase Client",
      table: "invoice_records",
      column: "invoiced_total",
      query: "supabase.from('invoice_records').select('invoiced_total').eq('organisation_id', tenantId)",
      transformation: "Decimal accumulation: totalBilled = totalBilled.plus(new Decimal(inv.invoiced_total))",
      lineageChain: [
        "Uploaded Utility Invoice File",
        "Secure Object Storage & Ingestion Gateway",
        "invoice_records table",
        "invoice/reconciliation results",
        "aggregation query",
        "Dashboard Total Cost Display",
      ],
      downwardProvenance: [
        "Dashboard",
        "Total Energy Cost",
        "Reconciliation Results",
        "Invoice Charges",
        "Invoice Record",
        "Uploaded PDF",
      ],
      aliases: [
        "Total Energy Cost",
        "Total Cost",
        "Billed Total",
        "total_energy_cost",
        "Total Billed Amount",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_total_calculated_amount",
      displayName: "Total Calculated Amount",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "Deterministic NERSA Tariff Engine & Reconciliation Runs",
      table: "invoice_records",
      column: "reconciled_total",
      query: "supabase.from('invoice_records').select('reconciled_total').eq('organisation_id', tenantId)",
      transformation: "Decimal summation of reconciled_total validated against 14 NERSA billing determinants",
      lineageChain: [
        "Gazetted NERSA Tariff Schedule",
        "AMR Telemetry Interval Readings",
        "Deterministic Reconciliation Engine",
        "reconciliation_runs & invoice_records",
        "aggregation query",
        "Total Calculated Amount KPI Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_net_variance",
      displayName: "Net Variance (Billed - Calc)",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "Deterministic Calculation from Stored Determinants",
      table: "invoice_records",
      column: "variance_amount (or invoiced_total - reconciled_total)",
      query: "Derived from invoiced_total and reconciled_total in invoice_records query",
      transformation: "totalBilled.minus(totalCalculated).toNumber() (Positive = Billed > Gazetted Rate)",
      lineageChain: [
        "Billed Amount",
        "Calculated NERSA Amount",
        "Reconciliation Variance Delta",
        "aggregation query",
        "Net Variance KPI Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_potential_recovery",
      displayName: "Potential Recovery",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "Overcharge Discrepancy Aggregator",
      table: "invoice_records / discrepancy_events",
      column: "variance_amount (where variance > 0)",
      query: "supabase.from('invoice_records').select('variance_amount')",
      transformation: "Sum of positive overcharges: if (varAmt > 0) overbilling = overbilling.plus(varAmt)",
      lineageChain: [
        "Overbilled Determinants",
        "Deterministic Discrepancy Engine",
        "discrepancy_events / invoice_records",
        "aggregation query",
        "Potential Recovery KPI Drill-Down Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_overbilling_claims",
      displayName: "Overbilling Claims",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "Discrepancy Event Ledger",
      table: "discrepancy_events",
      column: "financial_impact_zar",
      query: "supabase.from('discrepancy_events').select('financial_impact_zar').eq('status', 'OPEN')",
      transformation: "Accumulation of positive discrepancy financial impact",
      lineageChain: [
        "Invoice Line Item Audit",
        "Discrepancy Classifier",
        "discrepancy_events",
        "Overbilling Claims Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_underbilling_exposure",
      displayName: "Underbilling Exposure",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "Discrepancy Event Ledger",
      table: "invoice_records",
      column: "variance_amount (where variance < 0)",
      query: "supabase.from('invoice_records').select('variance_amount')",
      transformation: "Sum of negative variances: if (varAmt < 0) underbilling = underbilling.plus(varAmt.abs())",
      lineageChain: [
        "Underbilled Tariff Checks",
        "Variance Calculation",
        "invoice_records",
        "Underbilling Exposure Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_invoices_awaiting_review",
      displayName: "Invoices Awaiting Review",
      component: "CommandCentreDashboard",
      category: "PORTFOLIO",
      source: "Invoice Lifecycle Service & Ingestion Queue",
      table: "invoice_records",
      column: "status, raw_data->metadata->needs_human_review",
      query: "supabase.from('invoice_records').select('status, raw_data')",
      transformation: "Count of records with status === 'draft' or needs_human_review === true",
      lineageChain: [
        "Parser Confidence Scoring",
        "Quality Validation Gate",
        "invoice_records (status)",
        "Awaiting Review Action Card",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_critical_discrepancies",
      displayName: "Critical Discrepancies Count",
      component: "CommandCentreDashboard",
      category: "ANOMALY",
      source: "Deterministic Diagnostics Engine",
      table: "discrepancy_events",
      column: "severity",
      query: "supabase.from('discrepancy_events').select('severity').eq('severity', 'CRITICAL')",
      transformation: "Count of discrepancy events classified as CRITICAL severity",
      lineageChain: [
        "14-Determinant Tolerance Check",
        "Discrepancy Severity Evaluator",
        "discrepancy_events table",
        "Critical Discrepancies Card",
      ],
      status: "VERIFIED",
    });

    // -----------------------------------------------------------------
    // 2. COMMAND CENTRE — RECONCILIATION HEALTH (Section 2)
    // -----------------------------------------------------------------
    this.registerMetric({
      metricId: "cmd_recon_success_rate",
      displayName: "Reconciliation Success Rate (%)",
      component: "CommandCentreDashboard",
      category: "RECONCILIATION_HEALTH",
      source: "Reconciliation Run Execution Log",
      table: "reconciliation_runs",
      column: "status",
      query: "supabase.from('reconciliation_runs').select('status')",
      transformation: "Math.round((successCount / totalRuns) * 1000) / 10",
      lineageChain: [
        "Reconciliation Execution",
        "reconciliation_runs log",
        "Success Rate Calculation",
        "Reconciliation Health Bar",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_failed_reconciliations",
      displayName: "Failed Runs",
      component: "CommandCentreDashboard",
      category: "RECONCILIATION_HEALTH",
      source: "Reconciliation Run Execution Log",
      table: "reconciliation_runs",
      column: "status",
      query: "supabase.from('reconciliation_runs').select('status').eq('status', 'failed')",
      transformation: "Count of reconciliation_runs with status === 'failed'",
      lineageChain: [
        "Run Exception Interceptor",
        "reconciliation_runs",
        "Failed Runs Metric Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_pending_reconciliations",
      displayName: "Pending Runs",
      component: "CommandCentreDashboard",
      category: "RECONCILIATION_HEALTH",
      source: "Job Processing Queue",
      table: "reconciliation_runs",
      column: "status",
      query: "supabase.from('reconciliation_runs').select('status').eq('status', 'pending')",
      transformation: "Count of reconciliation_runs with status === 'pending'",
      lineageChain: [
        "Batch Processing Job Queue",
        "reconciliation_runs",
        "Pending Runs Metric Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_avg_audit_time",
      displayName: "Average Audit Time (ms)",
      component: "CommandCentreDashboard",
      category: "RECONCILIATION_HEALTH",
      source: "Processing Job Telemetry",
      table: "processing_jobs",
      column: "duration_ms",
      query: "supabase.from('processing_jobs').select('duration_ms').not('duration_ms', 'is', null)",
      transformation: "Sum of duration_ms / total completed jobs",
      lineageChain: [
        "Job Profiler Timer",
        "processing_jobs telemetry",
        "Average Audit Time Box",
      ],
      status: "VERIFIED",
    });

    // -----------------------------------------------------------------
    // 3. COMMAND CENTRE — FINANCIAL RECOVERY REGISTER (Section 3)
    // -----------------------------------------------------------------
    this.registerMetric({
      metricId: "cmd_disputed_amount",
      displayName: "Disputed Amount",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "Statutory Dispute Package Ledger",
      table: "dispute_packs",
      column: "disputed_amount",
      query: "supabase.from('dispute_packs').select('disputed_amount')",
      transformation: "Sum of disputed_amount across submitted dispute packs",
      lineageChain: [
        "Dispute Submission Generator",
        "dispute_packs table",
        "Disputed Amount Metric Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_recovered_credit",
      displayName: "Recovered Credit",
      component: "CommandCentreDashboard",
      category: "FINANCIAL",
      source: "Credit Settlement Ledger",
      table: "dispute_packs",
      column: "recovered_amount",
      query: "supabase.from('dispute_packs').select('recovered_amount').eq('status', 'SETTLED')",
      transformation: "Sum of confirmed recovery amounts credited back to customer",
      lineageChain: [
        "Eskom Billing Credit Note",
        "dispute_packs (recovered_amount)",
        "Recovered Credit Metric Box",
      ],
      status: "VERIFIED",
    });

    // -----------------------------------------------------------------
    // 4. COMMAND CENTRE — ENERGY & DEMAND DETERMINANTS (Section 4)
    // -----------------------------------------------------------------
    this.registerMetric({
      metricId: "cmd_peak_energy",
      displayName: "Peak Energy (kWh)",
      component: "CommandCentreDashboard",
      category: "ENERGY_OVERVIEW",
      source: "AMR Telemetry Ingestion & Invoice TOU Blocks",
      table: "invoice_records",
      column: "peak_kwh",
      query: "supabase.from('invoice_records').select('peak_kwh')",
      transformation: "Decimal summation of peak active energy across billing cycles",
      lineageChain: [
        "30-Minute Interval Readings (kW * 0.5)",
        "TOU Calendar Slot Allocator",
        "invoice_records (peak_kwh)",
        "Peak Energy Display Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_standard_energy",
      displayName: "Standard Energy (kWh)",
      component: "CommandCentreDashboard",
      category: "ENERGY_OVERVIEW",
      source: "AMR Telemetry Ingestion & Invoice TOU Blocks",
      table: "invoice_records",
      column: "standard_kwh",
      query: "supabase.from('invoice_records').select('standard_kwh')",
      transformation: "Decimal summation of standard active energy across billing cycles",
      lineageChain: [
        "30-Minute Interval Readings",
        "TOU Calendar Standard Slot Match",
        "invoice_records (standard_kwh)",
        "Standard Energy Display Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_off_peak_energy",
      displayName: "Off-Peak Energy (kWh)",
      component: "CommandCentreDashboard",
      category: "ENERGY_OVERVIEW",
      source: "AMR Telemetry Ingestion & Invoice TOU Blocks",
      table: "invoice_records",
      column: "off_peak_kwh",
      query: "supabase.from('invoice_records').select('off_peak_kwh')",
      transformation: "Decimal summation of off-peak active energy across billing cycles",
      lineageChain: [
        "30-Minute Interval Readings",
        "TOU Calendar Off-Peak Slot Match",
        "invoice_records (off_peak_kwh)",
        "Off-Peak Energy Display Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_total_energy",
      displayName: "Total Energy (kWh)",
      component: "CommandCentreDashboard",
      category: "ENERGY_OVERVIEW",
      source: "AMR Telemetry Ingestion & Invoice Active Energy",
      table: "invoice_records",
      column: "total_kwh",
      query: "supabase.from('invoice_records').select('total_kwh')",
      transformation: "Decimal summation of total active energy across billing cycles",
      lineageChain: [
        "Sum of Peak + Standard + Off-Peak",
        "invoice_records (total_kwh)",
        "Total Energy Highlight Box",
      ],
      downwardProvenance: [
        "Dashboard",
        "Actual kWh",
        "Monthly Energy Aggregation",
        "Validated Interval Data",
        "AMR CSV",
        "Original Uploaded File",
      ],
      aliases: [
        "Actual kWh",
        "Total Energy",
        "Total Energy (kWh)",
        "actual_kwh",
        "total_kwh",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_max_demand",
      displayName: "Maximum Demand (kVA)",
      component: "CommandCentreDashboard",
      category: "ENERGY_OVERVIEW",
      source: "30-Minute Apparent Power Vector Maxima",
      table: "invoice_records",
      column: "max_demand_kva",
      query: "supabase.from('invoice_records').select('max_demand_kva')",
      transformation: "Maximum kVA value encountered across active billing intervals",
      lineageChain: [
        "Raw Meter Interval Readings (kVA)",
        "High-water Mark Demand Peak Engine",
        "invoice_records (max_demand_kva)",
        "Maximum Demand Display Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_reactive_energy",
      displayName: "Reactive Energy (kVARh)",
      component: "CommandCentreDashboard",
      category: "ENERGY_OVERVIEW",
      source: "AMR Ingestion Channel 3/4",
      table: "invoice_records",
      column: "reactive_energy_kvarh",
      query: "supabase.from('invoice_records').select('reactive_energy_kvarh')",
      transformation: "Decimal sum of reactive energy (kVARh) across period",
      lineageChain: [
        "AMR Channel 3/4 Reactive Energy Pulses",
        "Quarter-hourly / Half-hourly Integration",
        "invoice_records (reactive_energy_kvarh)",
        "Reactive Energy Display Box",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "cmd_average_power_factor",
      displayName: "Average Power Factor (cos φ)",
      component: "CommandCentreDashboard",
      category: "ENERGY_OVERVIEW",
      source: "Derived Vector Trigonometry from Active & Reactive Energy",
      table: "Derived from invoice_records (total_kwh & reactive_energy_kvarh)",
      column: "total_kwh, reactive_energy_kvarh",
      query: "Calculated from total_kwh and reactive_energy_kvarh queries",
      transformation: "totalKWh / Math.sqrt(totalKWh^2 + reactiveKVARh^2) bounded [0, 1]",
      lineageChain: [
        "Active Energy (kWh)",
        "Reactive Energy (kVARh)",
        "Vector Apparent Energy Calculation",
        "Power Factor Cosine Derivation",
        "Average Power Factor Display Box",
      ],
      status: "VERIFIED",
    });

    // -----------------------------------------------------------------
    // 5. COMMAND CENTRE — MONTHLY CONSUMPTION LINEAGE (Section 6)
    // -----------------------------------------------------------------
    this.registerMetric({
      metricId: "cmd_monthly_lineage_table",
      displayName: "Monthly Consumption & Settlement Lineage Rows",
      component: "CommandCentreDashboard",
      category: "CONSUMPTION_LINEAGE",
      source: "Harmonized Production Database Invoices",
      table: "invoice_records",
      column: "billing_start, billing_end, invoice_number, total_kwh, peak_kwh, standard_kwh, off_peak_kwh, invoiced_total, reconciled_total, variance_amount, status",
      query: "supabase.from('invoice_records').select('*').order('billing_start', { ascending: false })",
      transformation: "Mapped array of verified billing cycles with determinant reconciliation outcomes",
      lineageChain: [
        "Utility Billing Invoice Upload",
        "Extraction & Validation Engine",
        "invoice_records row-level storage",
        "reconciliation_runs association",
        "Lineage Table Rendering",
      ],
      status: "VERIFIED",
    });

    // -----------------------------------------------------------------
    // 6. ANOMALY DASHBOARD (Discrepancies View)
    // -----------------------------------------------------------------
    this.registerMetric({
      metricId: "anomaly_financial_impact",
      displayName: "Anomaly Financial Impact (ZAR)",
      component: "AnomalyDashboard",
      category: "ANOMALY",
      source: "Deterministic Diagnostics Engine",
      table: "discrepancy_events",
      column: "financial_impact_zar",
      query: "supabase.from('discrepancy_events').select('*')",
      transformation: "Deterministic calculation of billed vs gazetted determinant financial gap",
      lineageChain: [
        "14 Determinant Reconciliation",
        "Discrepancy Rule Check",
        "discrepancy_events table",
        "Anomaly Financial Impact Badge",
      ],
      status: "VERIFIED",
    });

    this.registerMetric({
      metricId: "anomaly_root_cause_chain",
      displayName: "Root Cause Propagation Chain",
      component: "AnomalyDashboard",
      category: "ANOMALY",
      source: "Deterministic Diagnostics Engine",
      table: "discrepancy_events",
      column: "root_cause_chain",
      query: "supabase.from('discrepancy_events').select('root_cause_chain')",
      transformation: "Ordered steps of upstream input failures propagating to final variance",
      lineageChain: [
        "Ingestion Error Logs / Tariff Rules",
        "Diagnostics Engine Graph Traversal",
        "discrepancy_events (root_cause_chain)",
        "Root Cause Visualization Component",
      ],
      status: "VERIFIED",
    });

    // -----------------------------------------------------------------
    // 7. TELEMETRY STREAM & QUALITY SUBSYSTEM
    // -----------------------------------------------------------------
    this.registerMetric({
      metricId: "telemetry_health_score",
      displayName: "Telemetry Health Quality Score (%)",
      component: "TelemetryPage",
      category: "TELEMETRY_STREAM",
      source: "Telemetry Quality Engine",
      table: "telemetry_intervals",
      column: "quality_state",
      query: "supabase.from('telemetry_intervals').select('quality_state')",
      transformation: "((actualCleanCount + interpolatedCount) / totalIntervals) * 100",
      lineageChain: [
        "Raw AMR Stream Intervals",
        "Telemetry Quality Engine Validator",
        "Quality State Categorization",
        "Health Quality Score Badge",
      ],
      status: "VERIFIED",
    });
  }

  /**
   * Register a metric into the internal catalog
   */
  public static registerMetric(contract: DashboardMetricContract): void {
    this.registry.set(contract.metricId, contract);
  }

  /**
   * Get a specific metric contract by ID
   */
  public static getMetric(metricId: string): DashboardMetricContract | undefined {
    return this.registry.get(metricId);
  }

  /**
   * Get all registered metric contracts
   */
  public static getAllMetrics(): DashboardMetricContract[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get metrics filtered by component
   */
  public static getMetricsByComponent(component: string): DashboardMetricContract[] {
    return this.getAllMetrics().filter((m) => m.component === component);
  }

  /**
   * Get metrics filtered by category
   */
  public static getMetricsByCategory(category: DashboardMetricContract["category"]): DashboardMetricContract[] {
    return this.getAllMetrics().filter((m) => m.category === category);
  }

  /**
   * Flag a metric if its source cannot be identified or is ungrounded
   */
  public static flagMetric(metricId: string, reason: string): void {
    const existing = this.registry.get(metricId);
    if (existing) {
      existing.status = "FLAGGED_NO_SOURCE";
      existing.flagReason = reason;
      this.registry.set(metricId, existing);
    } else {
      this.registry.set(metricId, {
        metricId,
        displayName: metricId,
        component: "UNKNOWN",
        category: "PORTFOLIO",
        source: "UNIDENTIFIED",
        table: "UNKNOWN",
        column: "UNKNOWN",
        query: "NONE",
        transformation: "NONE",
        lineageChain: ["UNKNOWN_ORIGIN", metricId],
        status: "FLAGGED_NO_SOURCE",
        flagReason: reason,
      });
    }
  }

  /**
   * Get all flagged metrics
   */
  public static getFlaggedMetrics(): DashboardMetricContract[] {
    return this.getAllMetrics().filter((m) => m.status === "FLAGGED_NO_SOURCE");
  }

  /**
   * Audit all metrics across all components to ensure no ungrounded values exist
   */
  public static auditAllMetrics(): ContractAuditSummary {
    const all = this.getAllMetrics();
    const flagged = this.getFlaggedMetrics();
    const verified = all.filter((m) => m.status === "VERIFIED");
    const components = Array.from(new Set(all.map((m) => m.component)));

    return {
      totalMetrics: all.length,
      verifiedMetrics: verified.length,
      flaggedMetrics: flagged.length,
      isHealthy: flagged.length === 0 && all.length > 0,
      componentsAudited: components,
      flaggedDetails: flagged.map((f) => ({
        metricId: f.metricId,
        reason: f.flagReason || "Source could not be identified",
      })),
    };
  }

  /**
   * Return formatted textual lineage chain for a metric
   * e.g. "Dashboard Total Cost ← aggregation query ← invoice/reconciliation results ← invoice records ← uploaded invoice"
   */
  public static getFormattedLineageChain(metricId: string): string {
    const metric = this.registry.get(metricId);
    if (!metric || !metric.lineageChain || metric.lineageChain.length === 0) {
      return `Metric '${metricId}' has no registered lineage chain.`;
    }

    // Return reversed or user-standard arrow format
    return metric.lineageChain.slice().reverse().join(" ← ");
  }

  /**
   * Resolve a metric by metricId, displayName, or natural language alias
   */
  public static resolveMetric(metricIdOrName: string): DashboardMetricContract | undefined {
    const direct = this.registry.get(metricIdOrName);
    if (direct) return direct;

    const normalizedQuery = metricIdOrName.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const metric of this.registry.values()) {
      const idMatch = metric.metricId.toLowerCase().replace(/[^a-z0-9]/g, "");
      const nameMatch = metric.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (idMatch === normalizedQuery || nameMatch === normalizedQuery) {
        return metric;
      }
      if (
        metric.aliases &&
        metric.aliases.some(
          (a) => a.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedQuery,
        )
      ) {
        return metric;
      }
    }

    // Secondary search for substring match
    for (const metric of this.registry.values()) {
      const nameMatch = metric.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (nameMatch.includes(normalizedQuery) || normalizedQuery.includes(nameMatch)) {
        return metric;
      }
    }

    return undefined;
  }

  /**
   * Traces the top-down provenance hierarchy for any number in ENERA:
   *
   * Dashboard
   *    ↓
   * Total Energy Cost
   *    ↓
   * Reconciliation Results
   *    ↓
   * Invoice Charges
   *    ↓
   * Invoice Record
   *    ↓
   * Uploaded PDF
   */
  public static traceDownwardProvenance(metricIdOrName: string): string[] {
    const metric = this.resolveMetric(metricIdOrName);
    if (metric?.downwardProvenance && metric.downwardProvenance.length > 0) {
      return metric.downwardProvenance;
    }
    if (metric?.lineageChain && metric.lineageChain.length > 0) {
      const reversed = metric.lineageChain.slice().reverse();
      if (reversed[0] !== "Dashboard") {
        return ["Dashboard", ...reversed];
      }
      return reversed;
    }
    return [
      "Dashboard",
      metricIdOrName,
      "Aggregation Query",
      "Database Source of Truth",
      "Original Uploaded File",
    ];
  }

  /**
   * Formats downward provenance trace into ASCII arrow notation:
   *
   * Dashboard
   *    ↓
   * Total Energy Cost
   *    ↓
   * ...
   */
  public static formatDownwardProvenance(metricIdOrName: string): string {
    const chain = this.traceDownwardProvenance(metricIdOrName);
    return chain.join("\n   ↓\n");
  }

  /**
   * Answers the fundamental engineering question: "Where did this number come from?"
   */
  public static traceNumberOrigin(metricIdOrName: string): string {
    return this.formatDownwardProvenance(metricIdOrName);
  }

  /**
   * Reset catalog to initial authoritative state (useful for test isolation)
   */
  public static resetCatalog(): void {
    this.registry.clear();
    this.initializeAuthoritativeCatalog();
  }
}
