-- ====================================================================
-- STAGE 7: PERSISTENT STORAGE & 6-TIER LINEAGE ARCHITECTURE
-- Establishes persistent object storage, database metadata relationships,
-- and statutory retention policies.
-- ====================================================================

-- 1. Ensure Supabase Storage Bucket for Original Source Files exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'source_files',
    'source_files',
    false,
    52428800, -- 50 MiB Maximum Limit
    ARRAY[
        'application/pdf',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/plain',
        'application/json',
        'application/xml',
        'application/octet-stream'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- 2. Storage Row Level Security (RLS) Policy for Tenant-Isolated Storage
-- Format: tenants/{organisation_id}/uploads/{upload_id}/{sanitized_filename}
DROP POLICY IF EXISTS "Tenant isolated storage access for source_files" ON storage.objects;
CREATE POLICY "Tenant isolated storage access for source_files"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'source_files' AND (
        (storage.foldername(name))[1] = 'tenants' AND
        (storage.foldername(name))[2] = public.auth_user_organisation_id()::text
        OR public.is_super_admin()
    )
)
WITH CHECK (
    bucket_id = 'source_files' AND (
        (storage.foldername(name))[1] = 'tenants' AND
        (storage.foldername(name))[2] = public.auth_user_organisation_id()::text
        OR public.is_super_admin()
    )
);

-- 3. Enhance public.source_files with Upload Linkage & Retention Metadata
ALTER TABLE IF EXISTS public.source_files
    ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'source_files',
    ADD COLUMN IF NOT EXISTS retention_policy TEXT NOT NULL DEFAULT 'PERMANENT',
    ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_source_files_upload_id ON public.source_files (upload_id);
CREATE INDEX IF NOT EXISTS idx_source_files_retention ON public.source_files (retention_policy, is_deleted);

-- 4. Enhance public.invoice_records with Lineage Foreign Keys
ALTER TABLE IF EXISTS public.invoice_records
    ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.source_files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_records_source_file ON public.invoice_records (source_file_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_upload ON public.invoice_records (upload_id);

-- 5. Enhance public.telemetry_intervals with Lineage Foreign Keys
ALTER TABLE IF EXISTS public.telemetry_intervals
    ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.source_files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_source_file ON public.telemetry_intervals (source_file_id);

-- 6. Enhance public.reconciliation_runs with Lineage Foreign Keys
ALTER TABLE IF EXISTS public.reconciliation_runs
    ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.source_files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_source_file ON public.reconciliation_runs (source_file_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_upload ON public.reconciliation_runs (upload_id);

-- 7. Canonical 6-Tier Data Lineage Graph View
-- ORGANISATION -> UPLOAD -> STORED FILE -> EXTRACTED DATA -> ANALYSIS -> RESULTS
CREATE OR REPLACE VIEW public.data_lineage_graph_view AS
SELECT
    -- Tier 1: ORGANISATION
    org.id AS organisation_id,
    org.name AS organisation_name,

    -- Tier 2: UPLOAD
    u.id AS upload_id,
    u.filename AS upload_filename,
    u.file_type AS upload_file_type,
    u.file_size_bytes,
    u.processing_status AS upload_status,
    u.upload_timestamp,

    -- Tier 3: STORED FILE
    sf.id AS source_file_id,
    sf.storage_bucket,
    sf.storage_path,
    sf.file_hash_sha256,
    sf.retention_policy,
    sf.is_archived AS file_archived,
    sf.is_deleted AS file_deleted,

    -- Tier 4: EXTRACTED DATA
    ir.id AS invoice_record_id,
    ir.invoice_number,
    ir.account_number,
    ir.billing_start,
    ir.billing_end,
    ir.invoiced_total,

    -- Tier 5: ANALYSIS
    rr.id AS reconciliation_run_id,
    rr.status AS reconciliation_status,
    rr.run_at AS reconciliation_run_at,

    -- Tier 6: RESULTS
    res.id AS reconciliation_result_id,
    res.total_invoiced AS result_invoiced,
    res.total_reconciled AS result_reconciled,
    res.total_variance AS result_variance

FROM public.organisations org
JOIN public.uploads u ON u.organisation_id = org.id
LEFT JOIN public.source_files sf ON sf.upload_id = u.id OR sf.id = u.id
LEFT JOIN public.invoice_records ir ON ir.upload_id = u.id OR ir.source_file_id = sf.id
LEFT JOIN public.reconciliation_runs rr ON rr.invoice_record_id = ir.id OR rr.upload_id = u.id
LEFT JOIN public.reconciliation_results res ON res.reconciliation_run_id = rr.id;

COMMENT ON VIEW public.data_lineage_graph_view IS 'Complete 6-tier end-to-end lineage mapping from organisation down to mathematical results';
