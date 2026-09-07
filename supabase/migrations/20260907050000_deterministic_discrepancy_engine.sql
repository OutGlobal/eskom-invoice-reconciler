-- Database Migration: Deterministic Discrepancy & Root-Cause Analysis Subsystem
-- Creates discrepancy_records table and RLS policies

CREATE TABLE IF NOT EXISTS public.discrepancy_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL, -- 'TAR-001', 'DEM-001', 'MUL-001', 'TOU-001', 'EST-001', 'TEL-001', 'TEL-002', 'REA-001', 'NET-001', 'CHG-001', 'VAT-001', 'INV-001'
    category VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISPUTED', 'RESOLVED', 'REJECTED'
    description TEXT NOT NULL,
    evidence TEXT NOT NULL,
    source_records JSONB NOT NULL, -- { invoice_id, telemetry_batch_id, meter_id, source_file_id, tariff_rule_id }
    calculation JSONB NOT NULL, -- { input, formula, rate, precision, output }
    financial_impact_zar NUMERIC(18,2) NOT NULL DEFAULT 0.00,
    recommended_action TEXT,
    confidence NUMERIC(4,3) DEFAULT 1.000,
    root_cause_chain JSONB, -- Array of root cause propagation steps
    drill_down_path JSONB, -- 6-level drill-down traceability object
    reconciliation_run_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Security Policies
ALTER TABLE public.discrepancy_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read discrepancy_records"
    ON public.discrepancy_records FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert/update discrepancy_records"
    ON public.discrepancy_records FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
