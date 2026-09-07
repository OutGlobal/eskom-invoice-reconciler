-- Database Migration: Formal Data-Governance Subsystem
-- Creates data_quality_issues, data_quality_scores, and data_quality_review_queues tables

CREATE TABLE IF NOT EXISTS public.data_quality_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id VARCHAR(100) NOT NULL UNIQUE,
    source VARCHAR(50) NOT NULL, -- 'INVOICE', 'METER', 'TELEMETRY_BATCH', 'SITE', 'RECONCILIATION'
    record_id VARCHAR(100) NOT NULL,
    quality_state VARCHAR(100) NOT NULL, -- 'MISSING', 'DUPLICATE', 'ESTIMATED', 'INVALID', 'CORRECTED', 'MULTIPLIER_ANOMALY', 'TIMESTAMP_ANOMALY', 'ROLLOVER_EVENT', 'ABNORMAL_DEMAND', 'ABNORMAL_PF', 'UNEXPLAINED_INVOICE_VAL', 'EXTRACTION_CONFIDENCE_FAILURE'
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    description TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    resolution_status VARCHAR(50) NOT NULL DEFAULT 'UNRESOLVED', -- 'UNRESOLVED', 'UNDER_REVIEW', 'RESOLVED', 'EXPLICITLY_OVERRIDDEN'
    resolved_by VARCHAR(100),
    resolved_timestamp TIMESTAMPTZ,
    deduction_points NUMERIC(5,2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'invoice', 'meter', 'telemetry_batch', 'site', 'reconciliation'
    entity_id VARCHAR(100) NOT NULL,
    quality_score NUMERIC(5,2) NOT NULL, -- 0.00 to 100.00
    classification VARCHAR(50) NOT NULL, -- 'EXCELLENT', 'GOOD', 'ACCEPTABLE', 'POOR', 'CRITICAL'
    evaluated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Security Policies
ALTER TABLE public.data_quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_quality_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read data_quality_issues"
    ON public.data_quality_issues FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert/update data_quality_issues"
    ON public.data_quality_issues FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read data_quality_scores"
    ON public.data_quality_scores FOR SELECT
    TO authenticated, anon
    USING (true);
