-- ====================================================================
-- STAGE 5: FILE UPLOAD SYSTEM & PERSISTENT INGESTION PIPELINE
-- Authoritative Schema Migration for Upload Records & Lifecycle Auditing
-- ====================================================================

-- 1. Create public.uploads table
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    file_hash_sha256 TEXT NOT NULL,
    storage_location TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (
        processing_status IN (
            'UPLOADED',
            'VALIDATING',
            'VALIDATED',
            'PROCESSING',
            'PROCESSED',
            'FAILED',
            'PARTIALLY_PROCESSED'
        )
    ),
    processing_start TIMESTAMPTZ,
    processing_completion TIMESTAMPTZ,
    row_count INT DEFAULT 0 CHECK (row_count >= 0),
    record_count INT DEFAULT 0 CHECK (record_count >= 0),
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        validation_status IN ('PENDING', 'VALID', 'INVALID', 'REVIEW_REQUIRED')
    ),
    error_status TEXT NOT NULL DEFAULT 'NONE' CHECK (
        error_status IN ('NONE', 'WARNING', 'ERROR', 'FATAL')
    ),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.uploads IS 'Authoritative audit and status registry for all ingested files in the Eskom Reconciler platform';

-- 2. Performance & Tenant Indexing
CREATE INDEX IF NOT EXISTS idx_uploads_org_status 
ON public.uploads (organisation_id, processing_status);

CREATE INDEX IF NOT EXISTS idx_uploads_org_created 
ON public.uploads (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_uploads_hash 
ON public.uploads (file_hash_sha256);

CREATE INDEX IF NOT EXISTS idx_uploads_user 
ON public.uploads (user_id);

-- 3. Row-Level Security (RLS) Configuration
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation policy for uploads" ON public.uploads;
CREATE POLICY "Tenant isolation policy for uploads"
ON public.uploads
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- 4. Role Permissions
REVOKE ALL ON public.uploads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;

-- 5. Trigger for updated_at timestamp maintenance
CREATE OR REPLACE FUNCTION public.set_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_uploads_updated_at ON public.uploads;
CREATE TRIGGER trigger_uploads_updated_at
BEFORE UPDATE ON public.uploads
FOR EACH ROW
EXECUTE FUNCTION public.set_uploads_updated_at();

-- 6. Canonical View Synchronisation
-- Link existing public.processing_jobs or source_files for backward-compatible queries
CREATE OR REPLACE VIEW public.upload_pipeline_view AS
SELECT 
    u.id AS upload_id,
    u.organisation_id,
    u.user_id,
    u.filename,
    u.file_type,
    u.file_size_bytes,
    u.storage_location,
    u.processing_status,
    u.processing_start,
    u.processing_completion,
    u.row_count,
    u.record_count,
    u.validation_status,
    u.error_status,
    u.error_message,
    u.metadata,
    u.created_at,
    u.updated_at
FROM public.uploads u;

COMMENT ON VIEW public.upload_pipeline_view IS 'Canonical unified projection of all enterprise uploads and ingestion statuses';
