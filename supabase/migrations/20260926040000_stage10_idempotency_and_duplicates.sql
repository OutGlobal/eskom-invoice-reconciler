-- =========================================================================
-- Migration: Stage 10 — Idempotency & Duplicate Protection Architecture
-- =========================================================================
-- Prevents accidental duplicate processing.
-- Identifies duplicates using cryptographic checksum/hash (SHA-256).
-- Ensures:
--   1. Duplicates are identified accurately, not relying solely on filename
--   2. Downstream financial records are NOT blindly created for duplicates
--   3. System directly references the authoritative existing document
--   4. Audit information is preserved immutably for every duplicate attempt
-- =========================================================================

-- 1. Document Duplicate Audit Log Table
CREATE TABLE IF NOT EXISTS public.document_duplicate_audit_log (
    id VARCHAR(100) PRIMARY KEY,
    audit_id VARCHAR(100) NOT NULL,
    organisation_id VARCHAR(100) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    original_document_id VARCHAR(100) NOT NULL,
    attempted_filename TEXT NOT NULL,
    attempted_by VARCHAR(100),
    checksum TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    action_taken TEXT NOT NULL DEFAULT 'REFERENCED_EXISTING_DOCUMENT',
    financial_records_suppressed BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Audit Lineage Indexes
CREATE INDEX IF NOT EXISTS idx_dup_audit_org_orig_doc
    ON public.document_duplicate_audit_log (organisation_id, original_document_id);

CREATE INDEX IF NOT EXISTS idx_dup_audit_org_checksum
    ON public.document_duplicate_audit_log (organisation_id, checksum);

CREATE INDEX IF NOT EXISTS idx_dup_audit_attempted_at
    ON public.document_duplicate_audit_log (attempted_at DESC);

-- 2. Extend public.uploads and document_registry with duplicate tracking metrics
ALTER TABLE public.uploads
    ADD COLUMN IF NOT EXISTS duplicate_attempts_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_duplicate_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS duplicate_of_id VARCHAR(100);

-- Update processing_status check constraint to support DUPLICATE state
ALTER TABLE public.uploads DROP CONSTRAINT IF EXISTS uploads_processing_status_check;
ALTER TABLE public.uploads ADD CONSTRAINT uploads_processing_status_check CHECK (
    processing_status IN (
        'UPLOADED',
        'STORED',
        'INSPECTING',
        'EXTRACTING',
        'CLASSIFYING',
        'READY_FOR_VALIDATION',
        'REVIEW_REQUIRED',
        'UNSUPPORTED',
        'VALIDATING',
        'VALIDATED',
        'PROCESSING',
        'PROCESSED',
        'FAILED',
        'PARTIALLY_PROCESSED',
        'DUPLICATE'
    )
);

-- Index for instant checksum lookups partitioned by organisation
CREATE INDEX IF NOT EXISTS idx_uploads_org_checksum
    ON public.uploads (organisation_id, checksum);

CREATE INDEX IF NOT EXISTS idx_uploads_org_file_hash
    ON public.uploads (organisation_id, file_hash_sha256);

-- 3. Enable Row Level Security (RLS) on Duplicate Audit Log
ALTER TABLE public.document_duplicate_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS "tenant_isolation_select_document_duplicate_audit" ON public.document_duplicate_audit_log;
CREATE POLICY "tenant_isolation_select_document_duplicate_audit"
    ON public.document_duplicate_audit_log
    FOR SELECT
    TO authenticated
    USING (
        organisation_id = (auth.jwt() ->> 'organisation_id')
    );

DROP POLICY IF EXISTS "tenant_isolation_insert_document_duplicate_audit" ON public.document_duplicate_audit_log;
CREATE POLICY "tenant_isolation_insert_document_duplicate_audit"
    ON public.document_duplicate_audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organisation_id = (auth.jwt() ->> 'organisation_id')
    );
