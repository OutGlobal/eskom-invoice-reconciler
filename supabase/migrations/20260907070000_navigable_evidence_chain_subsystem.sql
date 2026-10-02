-- Database Migration: Navigable 12-Node Evidence Explorer & Auditability Subsystem
-- Creates evidence_chains, evidence_chain_nodes, and RLS security policies

CREATE TABLE IF NOT EXISTS public.evidence_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id VARCHAR(100) NOT NULL UNIQUE,
    variance_id VARCHAR(100) NOT NULL,
    reconciliation_run_id VARCHAR(100) NOT NULL,
    invoice_id VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'DEFAULT_TENANT',
    site_id VARCHAR(100) NOT NULL DEFAULT 'SITE_01',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evidence_chain_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id VARCHAR(100) NOT NULL UNIQUE,
    chain_id VARCHAR(100) NOT NULL REFERENCES public.evidence_chains(chain_id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL, -- 'SOURCE_FILE', 'INVOICE', 'INVOICE_LINE', 'BILLING_DETERMINANT', 'TELEMETRY_INTERVAL', 'METER_CONFIGURATION', 'MULTIPLIER', 'TARIFF_RULE', 'CALENDAR_RULE', 'CALCULATION', 'VARIANCE', 'DISCREPANCY'
    stable_object_id VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    sequence_index INT NOT NULL, -- 1..12
    node_data JSONB NOT NULL, -- Detailed display evidence
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Security Policies
ALTER TABLE public.evidence_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_chain_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read evidence_chains"
    ON public.evidence_chains FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert/update evidence_chains"
    ON public.evidence_chains FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read evidence_chain_nodes"
    ON public.evidence_chain_nodes FOR SELECT
    TO authenticated, anon
    USING (true);
