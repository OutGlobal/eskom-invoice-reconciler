-- =========================================================================
-- Migration: Stage 9 — Document Extraction Runs Architecture & History
-- =========================================================================
-- Tracks processing runs across document lifecycles.
-- A document may be processed multiple times (e.g. algorithm upgrades,
-- OCR retries, manual corrections) without destroying historical evidence.
--
-- Tracked Properties (Stage 9 Specification):
--   - document ID (document_id)
--   - processing run ID (run_id)
--   - extraction version (extraction_version)
--   - extraction method (extraction_method)
--   - started (started_at)
--   - completed (completed_at)
--   - status (status)
--   - errors (errors)
--   - processing duration (processing_duration_ms)
--   - pages processed (pages_processed)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.document_extraction_runs (
    run_id VARCHAR(100) PRIMARY KEY,
    document_id VARCHAR(100) NOT NULL,
    organisation_id VARCHAR(100) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    extraction_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    extraction_method VARCHAR(100) NOT NULL DEFAULT 'NATIVE_PDF_TEXT',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING' 
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL')),
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    processing_duration_ms INT,
    pages_processed INT NOT NULL DEFAULT 0,
    evidence_count INT NOT NULL DEFAULT 0,
    is_latest_run BOOLEAN NOT NULL DEFAULT true,
    triggered_by VARCHAR(100) NOT NULL DEFAULT 'INITIAL_UPLOAD',
    extracted_fields_snapshot JSONB,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Lineage Indexes
CREATE INDEX IF NOT EXISTS idx_extraction_runs_doc_id 
    ON public.document_extraction_runs (document_id);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_doc_latest 
    ON public.document_extraction_runs (document_id, is_latest_run);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_doc_started 
    ON public.document_extraction_runs (document_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_org_id 
    ON public.document_extraction_runs (organisation_id);

CREATE INDEX IF NOT EXISTS idx_extraction_runs_status 
    ON public.document_extraction_runs (status);

-- Extend document_field_evidence to support run-partitioning
ALTER TABLE public.document_field_evidence 
    ADD COLUMN IF NOT EXISTS run_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS extraction_version VARCHAR(50) DEFAULT '1.0.0';

CREATE INDEX IF NOT EXISTS idx_doc_field_evidence_run_id 
    ON public.document_field_evidence (run_id);

-- Extend document_registry to track latest run reference and count
ALTER TABLE public.document_registry 
    ADD COLUMN IF NOT EXISTS latest_processing_run_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS processing_runs_count INT DEFAULT 1;

-- Enable Row Level Security (RLS)
ALTER TABLE public.document_extraction_runs ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS "tenant_isolation_select_document_extraction_runs" ON public.document_extraction_runs;
CREATE POLICY "tenant_isolation_select_document_extraction_runs"
    ON public.document_extraction_runs
    FOR SELECT
    TO authenticated
    USING (
        organisation_id = (auth.jwt() ->> 'organisation_id')
    );

DROP POLICY IF EXISTS "tenant_isolation_insert_document_extraction_runs" ON public.document_extraction_runs;
CREATE POLICY "tenant_isolation_insert_document_extraction_runs"
    ON public.document_extraction_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organisation_id = (auth.jwt() ->> 'organisation_id')
    );

DROP POLICY IF EXISTS "tenant_isolation_update_document_extraction_runs" ON public.document_extraction_runs;
CREATE POLICY "tenant_isolation_update_document_extraction_runs"
    ON public.document_extraction_runs
    FOR UPDATE
    TO authenticated
    USING (
        organisation_id = (auth.jwt() ->> 'organisation_id')
    )
    WITH CHECK (
        organisation_id = (auth.jwt() ->> 'organisation_id')
    );
