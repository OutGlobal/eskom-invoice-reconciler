-- ==============================================================================
-- STAGE 3: AUTHORITATIVE DATABASE SOURCE OF TRUTH CANONICAL MIGRATION
-- Migration: 20260916010000_stage3_database_source_of_truth_canonical.sql
--
-- Harmonizes the database as the authoritative source of truth for all 25 domain concepts:
-- 1. ORGANISATIONS          (public.organisations)
-- 2. USERS                  (public.users)
-- 3. ROLES                  (public.roles)
-- 4. SITES                  (public.sites)
-- 5. METERS                 (public.meters)
-- 6. ACCOUNTS               (public.accounts view -> public.customers)
-- 7. TARIFFS                (public.tariffs view -> public.tariff_schedules)
-- 8. TARIFF_VERSIONS        (public.tariff_versions)
-- 9. INVOICES               (public.invoice_records & public.invoices)
-- 10. INVOICE_LINE_ITEMS    (public.invoice_line_items)
-- 11. UPLOADS               (public.uploads)
-- 12. SOURCE_FILES          (public.source_files)
-- 13. METER_READINGS        (public.meter_readings)
-- 14. INTERVAL_DATA         (public.interval_data view -> public.telemetry_intervals)
-- 15. ENERGY_TOTALS         (public.energy_totals view -> public.invoice_determinants / invoice_records)
-- 16. DEMAND_DATA           (public.demand_data view -> public.telemetry_daily_aggregates / invoice_records)
-- 17. REACTIVE_ENERGY       (public.reactive_energy view -> public.tariff_components / telemetry_intervals)
-- 18. RECONCILIATIONS       (public.reconciliations view -> public.reconciliation_runs)
-- 19. RECONCILIATION_RESULTS(public.reconciliation_results)
-- 20. ANOMALIES             (public.anomalies view -> public.discrepancy_events)
-- 21. ANALYSIS_RESULTS      (public.analysis_results view -> public.calculation_snapshots)
-- 22. REPORTS               (public.reports view -> public.generated_reports)
-- 23. AUDIT_LOGS            (public.audit_logs view -> public.audit_events)
-- 24. PROCESSING_JOBS       (public.processing_jobs view -> public.ingestion_jobs)
-- 25. PROCESSING_ERRORS     (public.processing_errors view -> public.ingestion_errors)
--
-- Principle: Do NOT create redundant duplicate tables if equivalent structures exist.
-- Reuse existing physical storage via zero-overhead PostgreSQL views with explicit grants.
-- ==============================================================================

BEGIN;

-- 1. CANONICAL VIEW: ACCOUNTS
CREATE OR REPLACE VIEW public.accounts AS
SELECT
    c.id AS account_id,
    c.id AS id,
    c.organisation_id,
    c.account_number,
    c.name AS account_name,
    c.premise_id,
    c.meter_number,
    c.nmd_kva,
    c.address,
    c.supply_voltage_kv,
    c.created_at,
    o.name AS organisation_name,
    o.code AS organisation_code
FROM public.customers c
LEFT JOIN public.organisations o ON c.organisation_id = o.id;

COMMENT ON VIEW public.accounts IS 'Authoritative billing accounts domain view mapped from customers and organisations';

-- 2. CANONICAL VIEW: TARIFFS
CREATE OR REPLACE VIEW public.tariffs AS
SELECT
    ts.id AS tariff_id,
    ts.id AS id,
    ts.tariff_code,
    ts.tariff_name,
    ts.provider,
    ts.tariff_family,
    ts.description,
    ts.created_at
FROM public.tariff_schedules ts;

COMMENT ON VIEW public.tariffs IS 'Authoritative master tariff catalog canonical view mapped from tariff_schedules';

-- 3. CANONICAL VIEW: INTERVAL_DATA
CREATE OR REPLACE VIEW public.interval_data AS
SELECT
    ti.id,
    ti.meter_id,
    ti.organisation_id,
    ti.timestamp_utc,
    ti.active_energy_kwh,
    ti.reactive_energy_kvarh,
    ti.apparent_energy_kvah,
    ti.active_power_kw,
    ti.reactive_power_kvar,
    ti.apparent_power_kva,
    ti.power_factor,
    ti.tou_bucket,
    ti.season,
    ti.is_estimated,
    ti.quality_score,
    ti.created_at
FROM public.telemetry_intervals ti;

COMMENT ON VIEW public.interval_data IS 'Canonical timeseries interval telemetry view mapped from partitioned telemetry_intervals';

-- 4. CANONICAL VIEW: ENERGY_TOTALS
CREATE OR REPLACE VIEW public.energy_totals AS
SELECT
    ir.id AS invoice_record_id,
    ir.id AS id,
    ir.organisation_id,
    ir.account_number,
    ir.invoice_number,
    ir.billing_period_name,
    ir.billing_start,
    ir.billing_end,
    COALESCE(ir.total_kwh, 0) AS total_kwh,
    COALESCE(ir.peak_kwh, 0) AS peak_kwh,
    COALESCE(ir.standard_kwh, 0) AS standard_kwh,
    COALESCE(ir.off_peak_kwh, 0) AS off_peak_kwh,
    CASE 
        WHEN COALESCE(ir.total_kwh, 0) > 0 THEN 
            ROUND((COALESCE(ir.peak_kwh, 0) / ir.total_kwh) * 100, 2)
        ELSE 0 
    END AS peak_ratio_pct,
    ir.created_at
FROM public.invoice_records ir;

COMMENT ON VIEW public.energy_totals IS 'Authoritative active energy consumption totals per billing period';

-- 5. CANONICAL VIEW: DEMAND_DATA
CREATE OR REPLACE VIEW public.demand_data AS
SELECT
    ir.id AS invoice_record_id,
    ir.id AS id,
    ir.organisation_id,
    ir.account_number,
    ir.invoice_number,
    ir.billing_period_name,
    ir.billing_start,
    ir.billing_end,
    COALESCE(ir.max_demand_kva, 0) AS max_demand_kva,
    COALESCE(c.nmd_kva, 0) AS notified_max_demand_kva,
    CASE 
        WHEN COALESCE(c.nmd_kva, 0) > 0 AND COALESCE(ir.max_demand_kva, 0) > c.nmd_kva THEN 
            ir.max_demand_kva - c.nmd_kva
        ELSE 0 
    END AS excess_demand_kva,
    CASE 
        WHEN COALESCE(c.nmd_kva, 0) > 0 AND COALESCE(ir.max_demand_kva, 0) > c.nmd_kva THEN 
            true
        ELSE false 
    END AS is_nmd_exceeded,
    ir.created_at
FROM public.invoice_records ir
LEFT JOIN public.customers c ON ir.account_number = c.account_number;

COMMENT ON VIEW public.demand_data IS 'Authoritative maximum demand and NMD capacity determinants view';

-- 6. CANONICAL VIEW: REACTIVE_ENERGY
CREATE OR REPLACE VIEW public.reactive_energy AS
SELECT
    id.id,
    id.invoice_record_id,
    ir.organisation_id,
    ir.account_number,
    ir.invoice_number,
    ir.billing_period_name,
    ir.billing_start,
    ir.billing_end,
    id.determinant_name,
    id.determinant_value AS reactive_kvarh,
    id.unit,
    CASE 
        WHEN COALESCE(ir.total_kwh, 0) > 0 AND (id.determinant_value > (ir.total_kwh * 0.30)) THEN 
            id.determinant_value - (ir.total_kwh * 0.30)
        ELSE 0
    END AS billable_excess_kvarh,
    id.created_at
FROM public.invoice_determinants id
JOIN public.invoice_records ir ON id.invoice_record_id = ir.id
WHERE id.determinant_name ILIKE '%reactive%' OR id.unit ILIKE '%kvar%';

COMMENT ON VIEW public.reactive_energy IS 'Authoritative reactive energy and threshold exceedance view';

-- 7. CANONICAL VIEW: RECONCILIATIONS
CREATE OR REPLACE VIEW public.reconciliations AS
SELECT
    rr.id AS reconciliation_id,
    rr.id,
    rr.organisation_id,
    rr.invoice_record_id,
    rr.meter_id,
    rr.tariff_version_id,
    rr.status,
    rr.correlation_id,
    rr.run_at,
    res.total_invoiced,
    res.total_reconciled,
    res.total_variance,
    res.summary_json
FROM public.reconciliation_runs rr
LEFT JOIN public.reconciliation_results res ON rr.id = res.reconciliation_run_id;

COMMENT ON VIEW public.reconciliations IS 'Authoritative reconciliations view mapped from reconciliation_runs & results';

-- 8. CANONICAL VIEW: ANOMALIES
CREATE OR REPLACE VIEW public.anomalies AS
SELECT
    de.id AS anomaly_id,
    de.id,
    de.organisation_id,
    de.reconciliation_run_id,
    de.invoice_record_id,
    de.reason_code_id,
    rc.code AS reason_code,
    rc.category AS reason_category,
    de.rule_id,
    de.severity,
    de.invoiced_amount,
    de.reconciled_amount,
    de.variance_amount,
    de.root_cause,
    de.status,
    de.created_at
FROM public.discrepancy_events de
LEFT JOIN public.discrepancy_reason_codes rc ON de.reason_code_id = rc.id;

COMMENT ON VIEW public.anomalies IS 'Authoritative anomaly and billing discrepancy view mapped from discrepancy_events';

-- 9. CANONICAL VIEW: ANALYSIS_RESULTS
CREATE OR REPLACE VIEW public.analysis_results AS
SELECT
    cs.id AS analysis_id,
    cs.id,
    rr.organisation_id,
    cs.reconciliation_run_id,
    cs.snapshot_name,
    cs.input_params,
    cs.calculated_outputs,
    cs.created_at
FROM public.calculation_snapshots cs
LEFT JOIN public.reconciliation_runs rr ON cs.reconciliation_run_id = rr.id;

COMMENT ON VIEW public.analysis_results IS 'Authoritative calculation snapshots and analysis results view';

-- 10. CANONICAL VIEW: REPORTS
CREATE OR REPLACE VIEW public.reports AS
SELECT
    gr.id AS report_id,
    gr.id,
    gr.organisation_id,
    gr.report_type,
    gr.title,
    gr.parameters,
    gr.storage_path,
    gr.created_at
FROM public.generated_reports gr;

COMMENT ON VIEW public.reports IS 'Authoritative report catalog view mapped from generated_reports';

-- 11. CANONICAL VIEW: AUDIT_LOGS
CREATE OR REPLACE VIEW public.audit_logs AS
SELECT
    ae.id AS log_id,
    ae.id,
    ae.organisation_id,
    ae.user_id,
    ae.action,
    ae.entity_type,
    ae.entity_id,
    ae.correlation_id,
    ae.payload,
    ae.created_at
FROM public.audit_events ae;

COMMENT ON VIEW public.audit_logs IS 'Authoritative system audit log view mapped from audit_events';

-- 12. CANONICAL VIEW: PROCESSING_JOBS
CREATE OR REPLACE VIEW public.processing_jobs AS
SELECT
    ij.id AS job_id,
    ij.id,
    ij.source_file_id,
    sf.organisation_id,
    sf.filename,
    sf.file_size_bytes,
    sf.mime_type,
    sf.file_hash_sha256,
    ij.job_type,
    ij.status,
    ij.correlation_id,
    ij.error_summary,
    ij.started_at,
    ij.completed_at,
    ij.created_at
FROM public.ingestion_jobs ij
LEFT JOIN public.source_files sf ON ij.source_file_id = sf.id;

COMMENT ON VIEW public.processing_jobs IS 'Authoritative pipeline processing jobs view mapped from ingestion_jobs';

-- 13. CANONICAL VIEW: PROCESSING_ERRORS
CREATE OR REPLACE VIEW public.processing_errors AS
SELECT
    ie.id AS error_id,
    ie.id,
    sf.organisation_id,
    ie.job_id,
    ij.job_type,
    ij.correlation_id,
    ie.error_code,
    ie.error_message,
    ie.stack_trace,
    ie.error_payload,
    ie.occurred_at
FROM public.ingestion_errors ie
LEFT JOIN public.ingestion_jobs ij ON ie.job_id = ij.id
LEFT JOIN public.source_files sf ON ij.source_file_id = sf.id;

COMMENT ON VIEW public.processing_errors IS 'Authoritative pipeline error view mapped from ingestion_errors';

-- ==============================================================================
-- 14. PERMISSIONS & POSTGREST SCHEMA EXPOSURE
-- ==============================================================================

GRANT SELECT ON public.accounts TO anon, authenticated, service_role;
GRANT SELECT ON public.tariffs TO anon, authenticated, service_role;
GRANT SELECT ON public.interval_data TO anon, authenticated, service_role;
GRANT SELECT ON public.energy_totals TO anon, authenticated, service_role;
GRANT SELECT ON public.demand_data TO anon, authenticated, service_role;
GRANT SELECT ON public.reactive_energy TO anon, authenticated, service_role;
GRANT SELECT ON public.reconciliations TO anon, authenticated, service_role;
GRANT SELECT ON public.anomalies TO anon, authenticated, service_role;
GRANT SELECT ON public.analysis_results TO anon, authenticated, service_role;
GRANT SELECT ON public.reports TO anon, authenticated, service_role;
GRANT SELECT ON public.audit_logs TO anon, authenticated, service_role;
GRANT SELECT ON public.processing_jobs TO anon, authenticated, service_role;
GRANT SELECT ON public.processing_errors TO anon, authenticated, service_role;

COMMIT;
