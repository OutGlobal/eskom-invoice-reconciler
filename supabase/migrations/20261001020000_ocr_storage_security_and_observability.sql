-- ============================================================================
-- ENERA OCR STORAGE SECURITY POLICIES & OBSERVABILITY SCHEMA (REQS 35 & 36)
-- ============================================================================
-- Enforces:
-- 1. Private Storage Buckets (public = false) for OCR raster cache & source files
-- 2. Tenant-Isolated Storage RLS Policies for file access & signed URLs
-- 3. Dedicated Operational Telemetry Table (ocr_operational_telemetry)
--    recording: document_id, ocr_run_id, page_id, provider, processing_time_ms,
--    status, error_code, retry_count (WITHOUT raw invoice financial payload)
-- ============================================================================

-- 1. Create Private Storage Bucket for OCR Raster Cache if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ocr_raster_cache',
    'ocr_raster_cache',
    false,
    52428800, -- 50 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/tiff', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- 2. Storage RLS Policies for ocr_raster_cache
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_raster_cache_tenant_read"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'ocr_raster_cache'
        AND (
            auth.role() = 'service_role'
            OR (
                name LIKE 'tenants/' || COALESCE(
                    (auth.jwt() -> 'app_metadata' ->> 'organisation_id'),
                    (auth.jwt() -> 'user_metadata' ->> 'organisation_id'),
                    'NONE'
                ) || '/%'
            )
        )
    );

CREATE POLICY "ocr_raster_cache_tenant_insert"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'ocr_raster_cache'
        AND (
            auth.role() = 'service_role'
            OR (
                name LIKE 'tenants/' || COALESCE(
                    (auth.jwt() -> 'app_metadata' ->> 'organisation_id'),
                    (auth.jwt() -> 'user_metadata' ->> 'organisation_id'),
                    'NONE'
                ) || '/%'
            )
        )
    );

CREATE POLICY "ocr_raster_cache_tenant_delete"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'ocr_raster_cache'
        AND (
            auth.role() = 'service_role'
            OR (
                name LIKE 'tenants/' || COALESCE(
                    (auth.jwt() -> 'app_metadata' ->> 'organisation_id'),
                    (auth.jwt() -> 'user_metadata' ->> 'organisation_id'),
                    'NONE'
                ) || '/%'
            )
        )
    );

-- 3. Dedicated Operational Telemetry Table (Requirement 36)
CREATE TABLE IF NOT EXISTS public.ocr_operational_telemetry (
    telemetry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(255) NOT NULL,
    ocr_run_id VARCHAR(255) NOT NULL,
    page_id VARCHAR(255),
    organisation_id VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    processing_time_ms INTEGER NOT NULL CHECK (processing_time_ms >= 0),
    status VARCHAR(50) NOT NULL,
    error_code VARCHAR(100),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    sanitized_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient observability and dashboard reporting
CREATE INDEX IF NOT EXISTS idx_ocr_telemetry_org ON public.ocr_operational_telemetry(organisation_id);
CREATE INDEX IF NOT EXISTS idx_ocr_telemetry_doc ON public.ocr_operational_telemetry(document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_telemetry_run ON public.ocr_operational_telemetry(ocr_run_id);
CREATE INDEX IF NOT EXISTS idx_ocr_telemetry_provider ON public.ocr_operational_telemetry(provider);
CREATE INDEX IF NOT EXISTS idx_ocr_telemetry_status ON public.ocr_operational_telemetry(status);
CREATE INDEX IF NOT EXISTS idx_ocr_telemetry_created ON public.ocr_operational_telemetry(created_at DESC);

-- Enable RLS on ocr_operational_telemetry
ALTER TABLE public.ocr_operational_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_telemetry_tenant_select"
    ON public.ocr_operational_telemetry
    FOR SELECT
    USING (
        auth.role() = 'service_role'
        OR organisation_id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'organisation_id'),
            (auth.jwt() -> 'user_metadata' ->> 'organisation_id'),
            'NONE'
        )
    );

CREATE POLICY "ocr_telemetry_tenant_insert"
    ON public.ocr_operational_telemetry
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role'
        OR organisation_id = COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'organisation_id'),
            (auth.jwt() -> 'user_metadata' ->> 'organisation_id'),
            'NONE'
        )
    );
