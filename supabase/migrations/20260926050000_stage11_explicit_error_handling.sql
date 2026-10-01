-- =========================================================================
-- Migration: Stage 11 — Explicit Error Handling & Failure Audit Subsystem
-- =========================================================================
-- Every failure across the Document Intelligence pipeline must be explicit:
--   - PDF_CORRUPTED
--   - PDF_PASSWORD_PROTECTED
--   - UNSUPPORTED_FORMAT
--   - TEXT_EXTRACTION_FAILED
--   - LAYOUT_EXTRACTION_FAILED
--   - PAGE_PROCESSING_FAILED
--   - DOCUMENT_CLASSIFICATION_FAILED
--   - STORAGE_ERROR
--   - DATABASE_ERROR
--
-- Guarantees:
-- 1. Never silently swallow exceptions.
-- 2. Never fabricate or display fake success states.
-- 3. Errors are persisted immutably and accessible to authorised users.
-- =========================================================================

-- 1. Persistent Document Error Log Table
CREATE TABLE IF NOT EXISTS public.document_errors (
    id VARCHAR(100) PRIMARY KEY,
    document_id VARCHAR(100) NOT NULL,
    organisation_id VARCHAR(100) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    stage VARCHAR(50) NOT NULL,
    error_code VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    user_message TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    stack_trace TEXT,
    is_fatal BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Audit Query Indexes
CREATE INDEX IF NOT EXISTS idx_doc_errors_doc_id 
    ON public.document_errors (document_id);

CREATE INDEX IF NOT EXISTS idx_doc_errors_org_id 
    ON public.document_errors (organisation_id);

CREATE INDEX IF NOT EXISTS idx_doc_errors_code 
    ON public.document_errors (error_code);

CREATE INDEX IF NOT EXISTS idx_doc_errors_created_at 
    ON public.document_errors (created_at DESC);

-- 2. Extend public.uploads and document_registry with explicit error code columns
ALTER TABLE public.uploads
    ADD COLUMN IF NOT EXISTS error_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS user_message TEXT,
    ADD COLUMN IF NOT EXISTS error_details JSONB DEFAULT '{}'::jsonb;

-- 3. Enable Row Level Security (RLS) on Document Errors
ALTER TABLE public.document_errors ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS "tenant_isolation_select_document_errors" ON public.document_errors;
CREATE POLICY "tenant_isolation_select_document_errors"
    ON public.document_errors
    FOR SELECT
    USING (
        organisation_id = COALESCE(
            current_setting('app.current_organisation_id', true),
            '00000000-0000-0000-0000-000000000001'
        )
        OR organisation_id = '00000000-0000-0000-0000-000000000001'
    );

DROP POLICY IF EXISTS "tenant_isolation_insert_document_errors" ON public.document_errors;
CREATE POLICY "tenant_isolation_insert_document_errors"
    ON public.document_errors
    FOR INSERT
    WITH CHECK (
        organisation_id = COALESCE(
            current_setting('app.current_organisation_id', true),
            '00000000-0000-0000-0000-000000000001'
        )
        OR organisation_id = '00000000-0000-0000-0000-000000000001'
    );
