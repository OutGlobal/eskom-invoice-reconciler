-- ==============================================================================
-- ENERA Production Database Source of Truth Migration
-- Version: 20260915000000
-- Harmonizes existing tables with 25 canonical domain views & server-side RPCs
-- ==============================================================================

-- 1. CANONICAL VIEW: ACCOUNTS
-- Maps existing public.customers to the standard billing account domain
CREATE OR REPLACE VIEW public.accounts AS
SELECT
    c.id AS account_id,
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

COMMENT ON VIEW public.accounts IS 'Authoritative billing accounts mapped from customer profiles and organisations';

-- 2. CANONICAL VIEW: ENERGY_TOTALS
-- Exposes unbundled active energy determinants (Peak, Standard, Off-Peak, Total kWh)
CREATE OR REPLACE VIEW public.energy_totals AS
SELECT
    ir.id AS invoice_record_id,
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

COMMENT ON VIEW public.energy_totals IS 'Authoritative active energy consumption determinants per invoice period';

-- 3. CANONICAL VIEW: DEMAND_DATA
-- Exposes peak kVA, active power, power factor, and NMD ratchet metrics
CREATE OR REPLACE VIEW public.demand_data AS
SELECT
    ir.id AS invoice_record_id,
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

COMMENT ON VIEW public.demand_data IS 'Authoritative maximum demand and NMD capacity determinants';

-- 4. CANONICAL VIEW: PROCESSING_JOBS
-- Combines ingestion jobs with source file metadata for unified pipeline monitoring
CREATE OR REPLACE VIEW public.processing_jobs AS
SELECT
    ij.id AS job_id,
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

COMMENT ON VIEW public.processing_jobs IS 'Authoritative ingestion and processing job register';

-- 5. RPC FUNCTION: GET_DASHBOARD_AGGREGATES
-- Server-side deterministic aggregation function for fast, single-query dashboard loading
CREATE OR REPLACE FUNCTION public.get_dashboard_aggregates(p_org_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    v_total_billed NUMERIC(18,2) := 0;
    v_total_reconciled NUMERIC(18,2) := 0;
    v_total_variance NUMERIC(18,2) := 0;
    v_overbilling NUMERIC(18,2) := 0;
    v_underbilling NUMERIC(18,2) := 0;
    v_total_kwh NUMERIC(18,6) := 0;
    v_peak_kwh NUMERIC(18,6) := 0;
    v_standard_kwh NUMERIC(18,6) := 0;
    v_off_peak_kwh NUMERIC(18,6) := 0;
    v_max_demand NUMERIC(18,6) := 0;
    v_invoice_count INT := 0;
    v_reconciled_count INT := 0;
    v_discrepancy_count INT := 0;
BEGIN
    -- Aggregate Invoice Financials & Energy
    SELECT
        COALESCE(SUM(invoiced_total), 0),
        COALESCE(SUM(reconciled_total), 0),
        COALESCE(SUM(variance_amount), 0),
        COALESCE(SUM(CASE WHEN variance_amount > 0 THEN variance_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN variance_amount < 0 THEN ABS(variance_amount) ELSE 0 END), 0),
        COALESCE(SUM(total_kwh), 0),
        COALESCE(SUM(peak_kwh), 0),
        COALESCE(SUM(standard_kwh), 0),
        COALESCE(SUM(off_peak_kwh), 0),
        COALESCE(MAX(max_demand_kva), 0),
        COUNT(*)
    INTO
        v_total_billed,
        v_total_reconciled,
        v_total_variance,
        v_overbilling,
        v_underbilling,
        v_total_kwh,
        v_peak_kwh,
        v_standard_kwh,
        v_off_peak_kwh,
        v_max_demand,
        v_invoice_count
    FROM public.invoice_records
    WHERE (p_org_id IS NULL OR organisation_id = p_org_id);

    -- Count Completed Reconciliations
    SELECT COUNT(*)
    INTO v_reconciled_count
    FROM public.reconciliation_runs
    WHERE status = 'completed'
      AND (p_org_id IS NULL OR organisation_id = p_org_id);

    -- Count Discrepancies
    SELECT COUNT(*)
    INTO v_discrepancy_count
    FROM public.discrepancy_events
    WHERE (p_org_id IS NULL OR organisation_id = p_org_id);

    result := jsonb_build_object(
        'has_data', (v_invoice_count > 0),
        'total_invoices', v_invoice_count,
        'reconciled_invoices', v_reconciled_count,
        'critical_discrepancies', v_discrepancy_count,
        'total_billed_zar', v_total_billed,
        'total_reconciled_zar', v_total_reconciled,
        'total_variance_zar', v_total_variance,
        'overbilling_zar', v_overbilling,
        'underbilling_zar', v_underbilling,
        'total_kwh', v_total_kwh,
        'peak_kwh', v_peak_kwh,
        'standard_kwh', v_standard_kwh,
        'off_peak_kwh', v_off_peak_kwh,
        'max_demand_kva', v_max_demand
    );

    RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_dashboard_aggregates IS 'Fast server-side calculation of portfolio energy and reconciliation aggregates';
