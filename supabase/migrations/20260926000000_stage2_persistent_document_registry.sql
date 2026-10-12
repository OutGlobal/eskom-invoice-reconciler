-- ====================================================================
-- DOCUMENT INTELLIGENCE FOUNDATION: STAGE 2 — DOCUMENT REGISTRY
-- Adapts existing public.uploads into the authoritative persistent Document Registry
--
-- At minimum captures all 21 foundational fields:
-- 1. document ID (id / document_id)
-- 2. organisation/tenant ID (organisation_id)
-- 3. uploaded by (uploaded_by / user_id)
-- 4. original filename (original_filename / filename)
-- 5. storage path (storage_path / storage_location)
-- 6. file size (file_size / file_size_bytes)
-- 7. MIME type (mime_type)
-- 8. detected file type (detected_file_type / file_type)
-- 9. upload timestamp (upload_timestamp)
-- 10. processing status (processing_status)
-- 11. processing started timestamp (processing_started_at / processing_started_timestamp)
-- 12. processing completed timestamp (processing_completed_at / processing_completed_timestamp)
-- 13. page count (page_count)
-- 14. document classification (document_classification)
-- 15. extraction status (extraction_status)
-- 16. OCR status (ocr_status)
-- 17. validation status (validation_status)
-- 18. error status (error_status)
-- 19. checksum/hash (checksum / file_hash_sha256)
-- 20. created timestamp (created_at / created_timestamp)
-- 21. updated timestamp (updated_at / updated_timestamp)
--
-- Strict rule adherence: Does not create duplicate tables if equivalent structures
-- already exist. Adapts public.uploads and provides an updatable canonical view.
-- ====================================================================

-- 1. Add missing document registry columns to public.uploads
ALTER TABLE IF EXISTS public.uploads
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS original_filename TEXT,
    ADD COLUMN IF NOT EXISTS storage_path TEXT,
    ADD COLUMN IF NOT EXISTS file_size BIGINT CHECK (file_size >= 0),
    ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    ADD COLUMN IF NOT EXISTS detected_file_type TEXT,
    ADD COLUMN IF NOT EXISTS upload_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS page_count INT NOT NULL DEFAULT 0 CHECK (page_count >= 0),
    ADD COLUMN IF NOT EXISTS document_classification TEXT NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN IF NOT EXISTS extraction_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        extraction_status IN ('PENDING', 'EXTRACTING', 'COMPLETED', 'FAILED', 'SKIPPED')
    ),
    ADD COLUMN IF NOT EXISTS ocr_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (
        ocr_status IN ('NOT_REQUIRED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')
    ),
    ADD COLUMN IF NOT EXISTS checksum TEXT;

-- 2. Update processing_status check constraint to support all document intelligence states
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
        'PARTIALLY_PROCESSED'
    )
);

-- 3. Backfill existing rows for synchronous column alignment
UPDATE public.uploads
SET
    uploaded_by = COALESCE(uploaded_by, user_id),
    original_filename = COALESCE(original_filename, filename),
    storage_path = COALESCE(storage_path, storage_location),
    file_size = COALESCE(file_size, file_size_bytes),
    detected_file_type = COALESCE(detected_file_type, file_type),
    upload_timestamp = COALESCE(upload_timestamp, created_at, now()),
    processing_started_at = COALESCE(processing_started_at, processing_start),
    processing_completed_at = COALESCE(processing_completed_at, processing_completion),
    checksum = COALESCE(checksum, file_hash_sha256)
WHERE
    original_filename IS NULL
    OR storage_path IS NULL
    OR file_size IS NULL
    OR checksum IS NULL;

-- 4. Bi-directional synchronization trigger between legacy uploads columns and document registry columns
CREATE OR REPLACE FUNCTION public.sync_uploads_document_registry_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Synchronize uploaded_by and user_id
    NEW.uploaded_by := COALESCE(NEW.uploaded_by, NEW.user_id);
    NEW.user_id := COALESCE(NEW.user_id, NEW.uploaded_by);

    -- Synchronize original_filename and filename
    NEW.original_filename := COALESCE(NEW.original_filename, NEW.filename, 'unnamed_document');
    NEW.filename := COALESCE(NEW.filename, NEW.original_filename, 'unnamed_document');

    -- Synchronize storage_path and storage_location
    NEW.storage_path := COALESCE(NEW.storage_path, NEW.storage_location, '');
    NEW.storage_location := COALESCE(NEW.storage_location, NEW.storage_path, '');

    -- Synchronize file_size and file_size_bytes
    NEW.file_size := COALESCE(NEW.file_size, NEW.file_size_bytes, 0);
    NEW.file_size_bytes := COALESCE(NEW.file_size_bytes, NEW.file_size, 0);

    -- Synchronize checksum and file_hash_sha256
    NEW.checksum := COALESCE(NEW.checksum, NEW.file_hash_sha256, '');
    NEW.file_hash_sha256 := COALESCE(NEW.file_hash_sha256, NEW.checksum, '');

    -- Synchronize detected_file_type and file_type
    NEW.detected_file_type := COALESCE(NEW.detected_file_type, NEW.file_type, 'PDF_INVOICE');
    NEW.file_type := COALESCE(NEW.file_type, NEW.detected_file_type, 'PDF_INVOICE');

    -- Synchronize processing timestamps
    NEW.processing_started_at := COALESCE(NEW.processing_started_at, NEW.processing_start);
    NEW.processing_start := COALESCE(NEW.processing_start, NEW.processing_started_at);

    NEW.processing_completed_at := COALESCE(NEW.processing_completed_at, NEW.processing_completion);
    NEW.processing_completion := COALESCE(NEW.processing_completion, NEW.processing_completed_at);

    -- Synchronize upload timestamp
    NEW.upload_timestamp := COALESCE(NEW.upload_timestamp, NEW.created_at, now());
    NEW.updated_at := now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_uploads_document_registry ON public.uploads;
CREATE TRIGGER trigger_sync_uploads_document_registry
BEFORE INSERT OR UPDATE ON public.uploads
FOR EACH ROW
EXECUTE FUNCTION public.sync_uploads_document_registry_columns();

-- 5. Performance Indices for Document Registry Queries
CREATE INDEX IF NOT EXISTS idx_uploads_document_classification ON public.uploads (organisation_id, document_classification);
CREATE INDEX IF NOT EXISTS idx_uploads_extraction_status ON public.uploads (organisation_id, extraction_status);
CREATE INDEX IF NOT EXISTS idx_uploads_ocr_status ON public.uploads (organisation_id, ocr_status);
CREATE INDEX IF NOT EXISTS idx_uploads_upload_timestamp ON public.uploads (organisation_id, upload_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_checksum ON public.uploads (checksum);

-- 6. Canonical Persistent Document Registry View
CREATE OR REPLACE VIEW public.document_registry
WITH (security_invoker = true) AS
SELECT
    u.id AS document_id,
    u.organisation_id,
    COALESCE(u.uploaded_by, u.user_id) AS uploaded_by,
    COALESCE(u.original_filename, u.filename) AS original_filename,
    COALESCE(u.storage_path, u.storage_location) AS storage_path,
    COALESCE(u.file_size, u.file_size_bytes) AS file_size,
    COALESCE(u.mime_type, 'application/pdf') AS mime_type,
    COALESCE(u.detected_file_type, u.file_type) AS detected_file_type,
    COALESCE(u.upload_timestamp, u.created_at) AS upload_timestamp,
    u.processing_status,
    COALESCE(u.processing_started_at, u.processing_start) AS processing_started_timestamp,
    COALESCE(u.processing_completed_at, u.processing_completion) AS processing_completed_timestamp,
    COALESCE(u.page_count, 0) AS page_count,
    COALESCE(u.document_classification, 'UNKNOWN') AS document_classification,
    u.extraction_status,
    u.ocr_status,
    u.validation_status,
    u.error_status,
    COALESCE(u.checksum, u.file_hash_sha256) AS checksum,
    u.created_at AS created_timestamp,
    u.updated_at AS updated_timestamp,
    u.error_message,
    u.metadata
FROM public.uploads u;

COMMENT ON VIEW public.document_registry IS 'Authoritative persistent document registry capturing all foundational document intelligence metadata';

-- 7. INSTEAD OF Triggers to allow full transparent CRUD on public.document_registry
CREATE OR REPLACE FUNCTION public.document_registry_insert_handler()
RETURNS TRIGGER AS $$
DECLARE
    new_id UUID;
BEGIN
    new_id := COALESCE(NEW.document_id, gen_random_uuid());
    INSERT INTO public.uploads (
        id,
        organisation_id,
        user_id,
        uploaded_by,
        filename,
        original_filename,
        storage_location,
        storage_path,
        file_size_bytes,
        file_size,
        mime_type,
        file_type,
        detected_file_type,
        upload_timestamp,
        processing_status,
        processing_start,
        processing_started_at,
        processing_completion,
        processing_completed_at,
        page_count,
        document_classification,
        extraction_status,
        ocr_status,
        validation_status,
        error_status,
        file_hash_sha256,
        checksum,
        error_message,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        new_id,
        NEW.organisation_id,
        NEW.uploaded_by,
        NEW.uploaded_by,
        NEW.original_filename,
        NEW.original_filename,
        NEW.storage_path,
        NEW.storage_path,
        COALESCE(NEW.file_size, 0),
        COALESCE(NEW.file_size, 0),
        COALESCE(NEW.mime_type, 'application/pdf'),
        COALESCE(NEW.detected_file_type, 'PDF_INVOICE'),
        COALESCE(NEW.detected_file_type, 'PDF_INVOICE'),
        COALESCE(NEW.upload_timestamp, now()),
        COALESCE(NEW.processing_status, 'UPLOADED'),
        NEW.processing_started_timestamp,
        NEW.processing_started_timestamp,
        NEW.processing_completed_timestamp,
        NEW.processing_completed_timestamp,
        COALESCE(NEW.page_count, 0),
        COALESCE(NEW.document_classification, 'UNKNOWN'),
        COALESCE(NEW.extraction_status, 'PENDING'),
        COALESCE(NEW.ocr_status, 'NOT_REQUIRED'),
        COALESCE(NEW.validation_status, 'PENDING'),
        COALESCE(NEW.error_status, 'NONE'),
        NEW.checksum,
        NEW.checksum,
        NEW.error_message,
        COALESCE(NEW.metadata, '{}'::jsonb),
        COALESCE(NEW.created_timestamp, now()),
        COALESCE(NEW.updated_timestamp, now())
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_registry_insert ON public.document_registry;
CREATE TRIGGER trigger_document_registry_insert
INSTEAD OF INSERT ON public.document_registry
FOR EACH ROW
EXECUTE FUNCTION public.document_registry_insert_handler();

CREATE OR REPLACE FUNCTION public.document_registry_update_handler()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.uploads
    SET
        organisation_id = COALESCE(NEW.organisation_id, organisation_id),
        uploaded_by = COALESCE(NEW.uploaded_by, uploaded_by),
        user_id = COALESCE(NEW.uploaded_by, user_id),
        original_filename = COALESCE(NEW.original_filename, original_filename),
        filename = COALESCE(NEW.original_filename, filename),
        storage_path = COALESCE(NEW.storage_path, storage_path),
        storage_location = COALESCE(NEW.storage_path, storage_location),
        file_size = COALESCE(NEW.file_size, file_size),
        file_size_bytes = COALESCE(NEW.file_size, file_size_bytes),
        mime_type = COALESCE(NEW.mime_type, mime_type),
        detected_file_type = COALESCE(NEW.detected_file_type, detected_file_type),
        file_type = COALESCE(NEW.detected_file_type, file_type),
        processing_status = COALESCE(NEW.processing_status, processing_status),
        processing_started_at = COALESCE(NEW.processing_started_timestamp, processing_started_at),
        processing_start = COALESCE(NEW.processing_started_timestamp, processing_start),
        processing_completed_at = COALESCE(NEW.processing_completed_timestamp, processing_completed_at),
        processing_completion = COALESCE(NEW.processing_completed_timestamp, processing_completion),
        page_count = COALESCE(NEW.page_count, page_count),
        document_classification = COALESCE(NEW.document_classification, document_classification),
        extraction_status = COALESCE(NEW.extraction_status, extraction_status),
        ocr_status = COALESCE(NEW.ocr_status, ocr_status),
        validation_status = COALESCE(NEW.validation_status, validation_status),
        error_status = COALESCE(NEW.error_status, error_status),
        checksum = COALESCE(NEW.checksum, checksum),
        file_hash_sha256 = COALESCE(NEW.checksum, file_hash_sha256),
        error_message = COALESCE(NEW.error_message, error_message),
        metadata = COALESCE(NEW.metadata, metadata),
        updated_at = now()
    WHERE id = OLD.document_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_registry_update ON public.document_registry;
CREATE TRIGGER trigger_document_registry_update
INSTEAD OF UPDATE ON public.document_registry
FOR EACH ROW
EXECUTE FUNCTION public.document_registry_update_handler();

CREATE OR REPLACE FUNCTION public.document_registry_delete_handler()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.uploads WHERE id = OLD.document_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_document_registry_delete ON public.document_registry;
CREATE TRIGGER trigger_document_registry_delete
INSTEAD OF DELETE ON public.document_registry
FOR EACH ROW
EXECUTE FUNCTION public.document_registry_delete_handler();

-- 8. Enhanced unified upload_pipeline_view
CREATE OR REPLACE VIEW public.upload_pipeline_view AS
SELECT 
    u.id AS upload_id,
    u.id AS document_id,
    u.organisation_id,
    u.user_id,
    u.uploaded_by,
    u.filename,
    u.original_filename,
    u.file_type,
    u.detected_file_type,
    u.file_size_bytes,
    u.file_size,
    u.mime_type,
    u.storage_location,
    u.storage_path,
    u.processing_status,
    u.processing_start,
    u.processing_started_at AS processing_started_timestamp,
    u.processing_completion,
    u.processing_completed_at AS processing_completed_timestamp,
    u.page_count,
    u.document_classification,
    u.extraction_status,
    u.ocr_status,
    u.row_count,
    u.record_count,
    u.validation_status,
    u.error_status,
    u.error_message,
    u.file_hash_sha256 AS checksum,
    u.metadata,
    u.upload_timestamp,
    u.created_at,
    u.updated_at
FROM public.uploads u;

-- 9. Role Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_registry TO authenticated;
GRANT ALL ON public.document_registry TO service_role;
