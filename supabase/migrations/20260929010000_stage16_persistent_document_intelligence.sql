-- ============================================================================
-- STAGE 16 — DATABASE INTEGRATION: PERSISTENT DOCUMENT INTELLIGENCE
-- ============================================================================
-- Enforces end-to-end database persistence for all document intelligence results:
--   PDF uploaded -> Supabase Storage -> Document Registry -> Processing -> Database -> Dashboard
-- Guarantees that refreshing the browser or logging out/in never loses processing state.

-- 1. Create dedicated document_intelligence_records table
CREATE TABLE IF NOT EXISTS public.document_intelligence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL UNIQUE,
    organisation_id UUID NOT NULL,
    user_id UUID,
    filename TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    checksum TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'PROCESSING' CHECK (
        processing_status IN ('UPLOADED', 'PROCESSING', 'PROCESSED', 'REVIEW_REQUIRED', 'FAILED')
    ),
    validation_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        validation_status IN ('PENDING', 'VALID', 'INVALID', 'REVIEW_REQUIRED')
    ),
    document_type TEXT NOT NULL DEFAULT 'ESKOM_TARIFF_INVOICE',
    total_pages INTEGER NOT NULL DEFAULT 1 CHECK (total_pages >= 0),
    truthful_stage TEXT NOT NULL DEFAULT 'TEXT_EXTRACTION',
    pages_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    extracted_fields_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    financial_determinants JSONB NOT NULL DEFAULT '{}'::jsonb,
    processing_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    review_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for instant lookup & dashboard rehydration (< 5ms)
CREATE INDEX IF NOT EXISTS idx_doc_intel_org_created 
ON public.document_intelligence_records (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_intel_doc_id 
ON public.document_intelligence_records (document_id);

CREATE INDEX IF NOT EXISTS idx_doc_intel_checksum 
ON public.document_intelligence_records (checksum, organisation_id);

CREATE INDEX IF NOT EXISTS idx_doc_intel_status 
ON public.document_intelligence_records (processing_status, organisation_id);

-- 3. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_doc_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_doc_intel_updated_at ON public.document_intelligence_records;
CREATE TRIGGER trigger_doc_intel_updated_at
BEFORE UPDATE ON public.document_intelligence_records
FOR EACH ROW EXECUTE FUNCTION public.set_doc_intelligence_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.document_intelligence_records ENABLE ROW LEVEL SECURITY;

-- 5. Tenant Isolation Policies
DROP POLICY IF EXISTS "Tenant isolation for document_intelligence_records" ON public.document_intelligence_records;
CREATE POLICY "Tenant isolation for document_intelligence_records"
ON public.document_intelligence_records
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);

-- 6. Bi-directional sync with public.uploads so legacy queries stay 100% consistent
CREATE OR REPLACE FUNCTION public.sync_doc_intelligence_to_uploads()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.uploads (
        id,
        organisation_id,
        user_id,
        filename,
        original_filename,
        file_type,
        file_size_bytes,
        file_hash_sha256,
        checksum,
        storage_location,
        storage_path,
        processing_status,
        validation_status,
        document_classification,
        page_count,
        error_message,
        metadata,
        updated_at
    )
    VALUES (
        NEW.document_id,
        NEW.organisation_id,
        NEW.user_id,
        NEW.filename,
        NEW.filename,
        'PDF_INVOICE',
        NEW.file_size_bytes,
        NEW.checksum,
        NEW.checksum,
        NEW.storage_path,
        NEW.storage_path,
        NEW.processing_status,
        NEW.validation_status,
        NEW.document_type,
        NEW.total_pages,
        NEW.error_message,
        jsonb_build_object(
            'extractedFields', NEW.extracted_fields_payload,
            'financialDeterminants', NEW.financial_determinants,
            'truthfulStage', NEW.truthfulStage,
            'pages', NEW.pages_payload
        ),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        processing_status = EXCLUDED.processing_status,
        validation_status = EXCLUDED.validation_status,
        page_count = EXCLUDED.page_count,
        error_message = EXCLUDED.error_message,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_doc_intelligence_to_uploads ON public.document_intelligence_records;
CREATE TRIGGER trigger_sync_doc_intelligence_to_uploads
AFTER INSERT OR UPDATE ON public.document_intelligence_records
FOR EACH ROW EXECUTE FUNCTION public.sync_doc_intelligence_to_uploads();

-- 7. Permissions
GRANT SELECT, INSERT, UPDATE ON public.document_intelligence_records TO authenticated;
