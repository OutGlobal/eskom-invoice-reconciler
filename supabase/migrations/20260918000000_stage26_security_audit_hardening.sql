-- ==============================================================================
-- ESKOM RECONCILER STAGE 26: SECURITY HARDENING & DATABASE-ENFORCED ACCESS CONTROL
-- Migration: 20260918000000_stage26_security_audit_hardening.sql
-- ==============================================================================

-- 1. FORCE ROW LEVEL SECURITY ON ALL BUSINESS TABLES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'organisations', 'users', 'roles', 'permissions', 'user_roles',
        'customers', 'sites', 'points_of_delivery', 'meters', 'meter_channels', 'meter_configurations',
        'tariff_assignments', 'source_files', 'file_versions', 'raw_documents',
        'ingestion_jobs', 'ingestion_errors', 'parser_results',
        'telemetry_intervals', 'telemetry_quality', 'telemetry_gap_events',
        'invoice_records', 'invoice_line_items', 'invoice_determinants',
        'reconciliation_runs', 'reconciliation_results', 'reconciliation_determinant_comparisons',
        'discrepancy_events', 'discrepancy_records',
        'calculation_snapshots', 'source_hashes', 'reconciliation_ledger',
        'generated_reports', 'dispute_packs', 'report_exports', 'audit_events'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
        END IF;
    END LOOP;
END $$;


-- 2. REVOKE ALL MUTATION PRIVILEGES FROM ANONYMOUS ROLE
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    tbl TEXT;
    public_tables TEXT[] := ARRAY[
        'organisations', 'users', 'roles', 'permissions', 'user_roles',
        'customers', 'sites', 'points_of_delivery', 'meters', 'meter_channels', 'meter_configurations',
        'tariff_assignments', 'source_files', 'file_versions', 'raw_documents',
        'ingestion_jobs', 'ingestion_errors', 'parser_results',
        'telemetry_intervals', 'telemetry_quality', 'telemetry_gap_events',
        'invoice_records', 'invoice_line_items', 'invoice_determinants',
        'reconciliation_runs', 'reconciliation_results', 'reconciliation_determinant_comparisons',
        'discrepancy_events', 'discrepancy_records',
        'calculation_snapshots', 'source_hashes', 'reconciliation_ledger',
        'generated_reports', 'dispute_packs', 'report_exports', 'audit_events'
    ];
BEGIN
    FOREACH tbl IN ARRAY public_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon;', tbl);
        END IF;
    END LOOP;
END $$;


-- 3. ENFORCE USER RECORD OWNERSHIP & MUTATION RESTRICTIONS
-- ------------------------------------------------------------------------------

-- Invoice records: users cannot modify or delete invoice records of other organisations
DROP POLICY IF EXISTS "Tenant write isolation policy for invoice_records" ON public.invoice_records;
CREATE POLICY "Tenant write isolation policy for invoice_records"
ON public.invoice_records
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

DROP POLICY IF EXISTS "Tenant delete isolation policy for invoice_records" ON public.invoice_records;
CREATE POLICY "Tenant delete isolation policy for invoice_records"
ON public.invoice_records
FOR DELETE
TO authenticated
USING (
    (organisation_id = public.auth_user_organisation_id() AND public.is_super_admin())
    OR public.is_super_admin()
);

-- Discrepancy events: cannot modify or delete discrepancies of other organisations
DROP POLICY IF EXISTS "Tenant write isolation policy for discrepancy_events" ON public.discrepancy_events;
CREATE POLICY "Tenant write isolation policy for discrepancy_events"
ON public.discrepancy_events
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

-- Source Files: cannot access or modify uploaded source files of other organisations
DROP POLICY IF EXISTS "Tenant write isolation policy for source_files" ON public.source_files;
CREATE POLICY "Tenant write isolation policy for source_files"
ON public.source_files
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


-- 4. STORAGE OBJECT ACCESS ENFORCEMENT
-- ------------------------------------------------------------------------------
-- Ensure storage bucket 'source_files' is private
UPDATE storage.buckets
SET public = false
WHERE id = 'source_files';

-- Ensure storage policy checks tenant folder prefix strictly
DROP POLICY IF EXISTS "Tenant isolated storage access for source_files" ON storage.objects;
CREATE POLICY "Tenant isolated storage access for source_files"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'source_files' AND (
        (
            (storage.foldername(name))[1] = 'tenants' AND
            (storage.foldername(name))[2] = public.auth_user_organisation_id()::text
        )
        OR public.is_super_admin()
    )
)
WITH CHECK (
    bucket_id = 'source_files' AND (
        (
            (storage.foldername(name))[1] = 'tenants' AND
            (storage.foldername(name))[2] = public.auth_user_organisation_id()::text
        )
        OR public.is_super_admin()
    )
);

-- Deny all anonymous storage access
REVOKE ALL ON SCHEMA storage FROM anon;
