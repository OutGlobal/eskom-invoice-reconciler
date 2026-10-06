-- ==============================================================================
-- DOCUMENT INTELLIGENCE FOUNDATION: STAGE 12 — SECURITY, RLS & STORAGE POLICIES
-- Migration: 20260928010000_stage12_security_rls_and_storage_policies.sql
-- ==============================================================================
--
-- Enforces Authoritative Security Architecture for Document Intelligence:
-- 1. Authentication is required for all document and storage interactions.
-- 2. Multi-tenant organisation isolation is enforced at the database and storage levels.
-- 3. Document access permissions are strictly restricted to authorized tenant members.
-- 4. Supabase Storage policies enforce private buckets and path prefix tenants/{org_id}/*.
-- 5. Row Level Security (RLS) is ENABLED & FORCED across all document intelligence tables.
-- 6. Document paths and uploaded filenames are protected against path traversal & manipulation.
-- 7. Anonymous mutation rights are completely revoked.
-- 8. Zero exposure of service role keys, internal prompts, or database credentials.
-- ==============================================================================

-- 1. SECURE STORAGE BUCKETS (source_files, invoices, documents)
-- ------------------------------------------------------------------------------
-- Ensure all document storage buckets exist and are strictly PRIVATE (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
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
    ),
    (
        'invoices',
        'invoices',
        false,
        52428800, -- 50 MiB Maximum Limit
        ARRAY[
            'application/pdf',
            'image/png',
            'image/jpeg',
            'application/octet-stream'
        ]
    ),
    (
        'documents',
        'documents',
        false,
        52428800,
        ARRAY[
            'application/pdf',
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/octet-stream'
        ]
    )
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- Ensure public access is unconditionally disabled on all storage buckets
UPDATE storage.buckets
SET public = false
WHERE id IN ('source_files', 'invoices', 'documents');

-- 2. STORAGE ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Path standard: tenants/{organisation_id}/documents/{document_id}/{sanitized_filename}
-- or tenants/{organisation_id}/uploads/{upload_id}/{sanitized_filename}
-- (storage.foldername(name))[1] must be 'tenants'
-- (storage.foldername(name))[2] must match the authenticated user's organisation_id

-- Drop old/permissive policies if any exist
DROP POLICY IF EXISTS "Tenant isolated storage access for source_files" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated storage access for invoices" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated storage access for documents" ON storage.objects;
DROP POLICY IF EXISTS "Tenant isolated storage access all buckets" ON storage.objects;

-- Create authoritative storage isolation policy across all document storage buckets
CREATE POLICY "Tenant isolated storage access for document buckets"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id IN ('source_files', 'invoices', 'documents') AND (
        (
            (storage.foldername(name))[1] = 'tenants' AND
            (storage.foldername(name))[2] = public.auth_user_organisation_id()::text
        )
        OR public.is_super_admin()
    )
)
WITH CHECK (
    bucket_id IN ('source_files', 'invoices', 'documents') AND (
        (
            (storage.foldername(name))[1] = 'tenants' AND
            (storage.foldername(name))[2] = public.auth_user_organisation_id()::text
        )
        OR public.is_super_admin()
    )
);

-- Deny all anonymous storage access
REVOKE ALL ON SCHEMA storage FROM anon;
REVOKE ALL ON TABLE storage.objects FROM anon;
REVOKE ALL ON TABLE storage.buckets FROM anon;


-- 3. ENABLE & FORCE ROW LEVEL SECURITY ON ALL DOCUMENT INTELLIGENCE TABLES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    doc_tables TEXT[] := ARRAY[
        'uploads',
        'document_pages',
        'document_field_evidence',
        'document_extraction_runs',
        'document_duplicate_audit_log',
        'document_errors',
        'source_files',
        'document_lifecycle_transitions'
    ];
BEGIN
    FOREACH tbl IN ARRAY doc_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
        END IF;
    END LOOP;
END $$;


-- 4. REVOKE ALL MUTATIONS FROM ANONYMOUS ROLE ON DOCUMENT TABLES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    doc_tables TEXT[] := ARRAY[
        'uploads',
        'document_pages',
        'document_field_evidence',
        'document_extraction_runs',
        'document_duplicate_audit_log',
        'document_errors',
        'source_files',
        'document_lifecycle_transitions'
    ];
BEGIN
    FOREACH tbl IN ARRAY doc_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon;', tbl);
        END IF;
    END LOOP;
END $$;


-- 5. AUTHORITATIVE TENANT ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

-- (A) public.uploads / document_registry
DROP POLICY IF EXISTS "Tenant select isolation policy for uploads" ON public.uploads;
CREATE POLICY "Tenant select isolation policy for uploads"
ON public.uploads
FOR SELECT
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Tenant insert isolation policy for uploads" ON public.uploads;
CREATE POLICY "Tenant insert isolation policy for uploads"
ON public.uploads
FOR INSERT
TO authenticated
WITH CHECK (
    (organisation_id = public.auth_user_organisation_id() AND uploaded_by = auth.uid())
    OR organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Tenant update isolation policy for uploads" ON public.uploads;
CREATE POLICY "Tenant update isolation policy for uploads"
ON public.uploads
FOR UPDATE
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Tenant delete isolation policy for uploads" ON public.uploads;
CREATE POLICY "Tenant delete isolation policy for uploads"
ON public.uploads
FOR DELETE
TO authenticated
USING (
    (organisation_id = public.auth_user_organisation_id() AND public.is_super_admin())
    OR public.is_super_admin()
);

-- (B) public.document_pages
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_pages') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Tenant select isolation for document_pages" ON public.document_pages';
        EXECUTE 'CREATE POLICY "Tenant select isolation for document_pages"
        ON public.document_pages
        FOR SELECT
        TO authenticated
        USING (
            organisation_id = public.auth_user_organisation_id()
            OR public.is_super_admin()
        )';

        EXECUTE 'DROP POLICY IF EXISTS "Tenant insert/update isolation for document_pages" ON public.document_pages';
        EXECUTE 'CREATE POLICY "Tenant insert/update isolation for document_pages"
        ON public.document_pages
        FOR ALL
        TO authenticated
        USING (
            organisation_id = public.auth_user_organisation_id()
            OR public.is_super_admin()
        )
        WITH CHECK (
            organisation_id = public.auth_user_organisation_id()
            OR public.is_super_admin()
        )';
    END IF;
END
$$;

-- (C) public.document_field_evidence
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_field_evidence') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Tenant isolation for document_field_evidence" ON public.document_field_evidence';
        EXECUTE 'CREATE POLICY "Tenant isolation for document_field_evidence"
        ON public.document_field_evidence
        FOR ALL
        TO authenticated
        USING (
            organisation_id = public.auth_user_organisation_id()
            OR public.is_super_admin()
        )
        WITH CHECK (
            organisation_id = public.auth_user_organisation_id()
            OR public.is_super_admin()
        )';
    END IF;
END
$$;

-- (D) public.document_extraction_runs
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_extraction_runs') THEN
    DROP POLICY IF EXISTS "Tenant isolation for document_extraction_runs" ON public.document_extraction_runs;
    CREATE POLICY "Tenant isolation for document_extraction_runs"
    ON public.document_extraction_runs
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
END IF;

-- (E) public.document_duplicate_audit_log
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_duplicate_audit_log') THEN
    DROP POLICY IF EXISTS "Tenant isolation for document_duplicate_audit_log" ON public.document_duplicate_audit_log;
    CREATE POLICY "Tenant isolation for document_duplicate_audit_log"
    ON public.document_duplicate_audit_log
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
END IF;

-- (F) public.document_errors
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_errors') THEN
    DROP POLICY IF EXISTS "Tenant isolation for document_errors" ON public.document_errors;
    CREATE POLICY "Tenant isolation for document_errors"
    ON public.document_errors
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
END IF;


-- 6. PATH TRAVERSAL & FILENAME INTEGRITY DATABASE CHECK CONSTRAINTS
-- ------------------------------------------------------------------------------
-- Ensure uploads storage_path cannot contain path traversal sequences or escape tenant prefix
ALTER TABLE public.uploads DROP CONSTRAINT IF EXISTS check_uploads_storage_path_safe;
ALTER TABLE public.uploads ADD CONSTRAINT check_uploads_storage_path_safe CHECK (
    storage_path IS NULL OR (
        storage_path ~ '^tenants/[a-zA-Z0-9_-]+/.*$' AND
        storage_path NOT LIKE '%..%' AND
        storage_path NOT LIKE '%\%' AND
        storage_path NOT LIKE '%//%' AND
        storage_path NOT LIKE '%' || chr(0) || '%'
    )
);

-- Ensure original_filename cannot contain path traversal characters
ALTER TABLE public.uploads DROP CONSTRAINT IF EXISTS check_uploads_filename_safe;
ALTER TABLE public.uploads ADD CONSTRAINT check_uploads_filename_safe CHECK (
    original_filename IS NULL OR (
        original_filename NOT LIKE '%..%' AND
        original_filename NOT LIKE '%/%' AND
        original_filename NOT LIKE '%\%' AND
        original_filename NOT LIKE '%' || chr(0) || '%'
    )
);

-- 7. GRANT PERMISSIONS TO AUTHENTICATED AND SERVICE ROLE ONLY
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_field_evidence TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_extraction_runs TO authenticated;
GRANT SELECT, INSERT ON public.document_duplicate_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.document_errors TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
