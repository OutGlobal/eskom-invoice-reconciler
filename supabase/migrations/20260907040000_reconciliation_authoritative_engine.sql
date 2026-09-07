-- Database Migration: Authoritative Deterministic Reconciliation Engine
-- Creates reconciliation_runs, reconciliation_determinant_comparisons, reconciliation_tolerance_configs, and reconciliation_regression_fixtures

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) NOT NULL UNIQUE,
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'DEFAULT_TENANT',
    invoice_id VARCHAR(100) NOT NULL,
    telemetry_batch_id VARCHAR(100),
    tariff_version_id VARCHAR(100) NOT NULL,
    calendar_version_id VARCHAR(100) NOT NULL DEFAULT '2025.1',
    engine_version VARCHAR(50) NOT NULL DEFAULT '2.0.0',
    configuration_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(50) NOT NULL, -- 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED'
    classification VARCHAR(50) NOT NULL, -- 'PASS', 'WARNING', 'DISCREPANCY', 'CRITICAL'
    result_checksum VARCHAR(100) NOT NULL, -- SHA-256 fingerprint for idempotency
    billed_total_zar NUMERIC(18,2) NOT NULL,
    calculated_total_zar NUMERIC(18,2) NOT NULL,
    variance_total_zar NUMERIC(18,2) NOT NULL,
    variance_percentage NUMERIC(18,4) NOT NULL,
    overall_confidence NUMERIC(5,4) DEFAULT 1.0000,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reconciliation_determinant_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) NOT NULL REFERENCES public.reconciliation_runs(run_id) ON DELETE CASCADE,
    determinant_code VARCHAR(100) NOT NULL,
    determinant_name VARCHAR(150) NOT NULL,
    billed_value NUMERIC(18,4) NOT NULL,
    calculated_value NUMERIC(18,4) NOT NULL,
    variance_value NUMERIC(18,4) NOT NULL,
    variance_percentage NUMERIC(18,4) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    classification VARCHAR(50) NOT NULL, -- 'PASS', 'WARNING', 'DISCREPANCY', 'CRITICAL'
    calculation_explanation JSONB, -- { input, formula, rate, precision, rounding_method, output }
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reconciliation_tolerance_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'DEFAULT_TENANT',
    percentage_tolerance NUMERIC(8,4) DEFAULT 0.50, -- 0.5%
    absolute_zar_tolerance NUMERIC(18,2) DEFAULT 50.00, -- R 50.00
    kwh_tolerance NUMERIC(18,2) DEFAULT 100.00,
    kva_tolerance NUMERIC(18,2) DEFAULT 5.00,
    kvarh_tolerance NUMERIC(18,2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reconciliation_regression_fixtures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_code VARCHAR(100) NOT NULL UNIQUE,
    fixture_name VARCHAR(200) NOT NULL,
    utility VARCHAR(100) NOT NULL,
    tariff_code VARCHAR(100) NOT NULL,
    invoice_payload JSONB NOT NULL,
    expected_results JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Security Policies
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_determinant_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_tolerance_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_regression_fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read reconciliation_runs"
    ON public.reconciliation_runs FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert/update reconciliation_runs"
    ON public.reconciliation_runs FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read reconciliation_determinant_comparisons"
    ON public.reconciliation_determinant_comparisons FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated read reconciliation_tolerance_configs"
    ON public.reconciliation_tolerance_configs FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated read reconciliation_regression_fixtures"
    ON public.reconciliation_regression_fixtures FOR SELECT
    TO authenticated, anon
    USING (true);
