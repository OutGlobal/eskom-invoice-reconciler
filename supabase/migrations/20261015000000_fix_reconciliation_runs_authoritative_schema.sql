-- ============================================================================
-- Migration: 20261015000000_fix_reconciliation_runs_authoritative_schema.sql
-- Description: Additive schema migration to ensure public.reconciliation_runs 
--              contains all authoritative reconciliation engine columns and indexes,
--              preventing schema cache warnings and ensuring persistent DB telemetry.
-- ============================================================================

-- 1. Ensure all authoritative reconciliation engine columns exist on public.reconciliation_runs
ALTER TABLE IF EXISTS public.reconciliation_runs
    ADD COLUMN IF NOT EXISTS run_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(100) DEFAULT 'DEFAULT_TENANT',
    ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS telemetry_batch_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS calendar_version_id VARCHAR(100) DEFAULT '2025.1',
    ADD COLUMN IF NOT EXISTS engine_version VARCHAR(50) DEFAULT '2.0.0',
    ADD COLUMN IF NOT EXISTS configuration_version VARCHAR(50) DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS classification VARCHAR(50),
    ADD COLUMN IF NOT EXISTS result_checksum VARCHAR(100),
    ADD COLUMN IF NOT EXISTS billed_total_zar NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS calculated_total_zar NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS variance_total_zar NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS variance_percentage NUMERIC(18,4),
    ADD COLUMN IF NOT EXISTS overall_confidence NUMERIC(5,4) DEFAULT 1.0000,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS error_code TEXT,
    ADD COLUMN IF NOT EXISTS failure_stage TEXT,
    ADD COLUMN IF NOT EXISTS failure_message TEXT;

-- 2. Create indices for authoritative run lookup, idempotency, and tenant partitioning
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_runs_run_id 
    ON public.reconciliation_runs (run_id) 
    WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_tenant_id 
    ON public.reconciliation_runs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_invoice_id_auth 
    ON public.reconciliation_runs (invoice_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_checksum 
    ON public.reconciliation_runs (result_checksum);

-- 3. Ensure public.reconciliation_determinant_comparisons exists with proper indexes
CREATE TABLE IF NOT EXISTS public.reconciliation_determinant_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id VARCHAR(100) NOT NULL,
    determinant_code VARCHAR(100) NOT NULL,
    determinant_name VARCHAR(150) NOT NULL,
    billed_value NUMERIC(18,4) NOT NULL,
    calculated_value NUMERIC(18,4) NOT NULL,
    variance_value NUMERIC(18,4) NOT NULL,
    variance_percentage NUMERIC(18,4) NOT NULL,
    unit_of_measure VARCHAR(50) NOT NULL,
    classification VARCHAR(50) NOT NULL,
    calculation_explanation JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_det_comparisons_run_id 
    ON public.reconciliation_determinant_comparisons (run_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_det_comparisons_code 
    ON public.reconciliation_determinant_comparisons (determinant_code);

-- 4. Enable Row Level Security
ALTER TABLE IF EXISTS public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reconciliation_determinant_comparisons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reconciliation_determinant_comparisons' 
        AND policyname = 'Allow authenticated read reconciliation_determinant_comparisons'
    ) THEN
        CREATE POLICY "Allow authenticated read reconciliation_determinant_comparisons"
            ON public.reconciliation_determinant_comparisons FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'reconciliation_determinant_comparisons' 
        AND policyname = 'Allow authenticated insert/update reconciliation_determinant_comparisons'
    ) THEN
        CREATE POLICY "Allow authenticated insert/update reconciliation_determinant_comparisons"
            ON public.reconciliation_determinant_comparisons FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

COMMENT ON COLUMN public.reconciliation_runs.billed_total_zar IS 'Authoritative invoiced total in ZAR for variance calculation';
COMMENT ON COLUMN public.reconciliation_runs.calculated_total_zar IS 'Authoritative recalculated total in ZAR based on deterministic interval telemetry';
COMMENT ON COLUMN public.reconciliation_runs.variance_total_zar IS 'Recalculated variance in ZAR (calculated - billed)';
