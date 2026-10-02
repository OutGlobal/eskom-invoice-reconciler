-- ==============================================================================
-- ESKOM RECONCILER ENTERPRISE TENANT ISOLATION & ROW LEVEL SECURITY (RLS)
-- Migration: 20260915010000_tenant_isolation_rls.sql
-- Stage 4: Strict Multi-Tenant Association and Database-Enforced Isolation
-- ==============================================================================

-- 1. EXTEND ALL BUSINESS TABLES WITH DIRECT organisation_id ASSOCIATIONS
-- ------------------------------------------------------------------------------

-- Sites table: associate directly with organisation_id (derived from customer/account)
ALTER TABLE IF EXISTS public.sites
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Meters table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.meters
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Points of Delivery table
ALTER TABLE IF EXISTS public.points_of_delivery
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Invoice Records table: ensure organisation_id exists
ALTER TABLE IF EXISTS public.invoice_records
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

-- Invoice Line Items table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.invoice_line_items
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Invoice Determinants table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.invoice_determinants
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Reconciliation Runs table: ensure organisation_id exists
ALTER TABLE IF EXISTS public.reconciliation_runs
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

-- Discrepancy Events table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.discrepancy_events
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Discrepancy Records table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.discrepancy_records
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Telemetry Intervals table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.telemetry_intervals
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Raw Documents table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.raw_documents
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

-- Ingestion Jobs table: associate directly with organisation_id
ALTER TABLE IF EXISTS public.ingestion_jobs
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;


-- 2. BACKFILL organisation_id FOR EXISTING CHILD RECORDS WHERE NULL
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    -- Backfill sites from customers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sites') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
        UPDATE public.sites s
        SET organisation_id = c.organisation_id
        FROM public.customers c
        WHERE s.customer_id = c.id
          AND s.organisation_id IS NULL
          AND c.organisation_id IS NOT NULL;
    END IF;

    -- Backfill meters from sites
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meters') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sites') THEN
        UPDATE public.meters m
        SET organisation_id = s.organisation_id
        FROM public.sites s
        WHERE m.site_id = s.id
          AND m.organisation_id IS NULL
          AND s.organisation_id IS NOT NULL;
    END IF;

    -- Backfill invoice_line_items from invoice_records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_line_items') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_records') THEN
        UPDATE public.invoice_line_items ili
        SET organisation_id = ir.organisation_id
        FROM public.invoice_records ir
        WHERE ili.invoice_record_id = ir.id
          AND ili.organisation_id IS NULL
          AND ir.organisation_id IS NOT NULL;
    END IF;

    -- Backfill discrepancy_events from invoice_records or reconciliation_runs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discrepancy_events') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_records') THEN
        UPDATE public.discrepancy_events de
        SET organisation_id = ir.organisation_id
        FROM public.invoice_records ir
        WHERE de.invoice_record_id = ir.id
          AND de.organisation_id IS NULL
          AND ir.organisation_id IS NOT NULL;
    END IF;

    -- Backfill ingestion_jobs from source_files
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ingestion_jobs') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'source_files') THEN
        UPDATE public.ingestion_jobs ij
        SET organisation_id = sf.organisation_id
        FROM public.source_files sf
        WHERE ij.source_file_id = sf.id
          AND ij.organisation_id IS NULL
          AND sf.organisation_id IS NOT NULL;
    END IF;
END $$;


-- 3. PERFORMANCE INDEXES FOR TENANT-SCOPED QUERIES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_sites_tenant ON public.sites (organisation_id);
CREATE INDEX IF NOT EXISTS idx_sites_tenant_site ON public.sites (organisation_id, id);
CREATE INDEX IF NOT EXISTS idx_meters_tenant ON public.meters (organisation_id);
CREATE INDEX IF NOT EXISTS idx_meters_tenant_meter ON public.meters (organisation_id, id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_tenant ON public.invoice_records (organisation_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_tenant_dates ON public.invoice_records (organisation_id, billing_start, billing_end);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_tenant ON public.invoice_line_items (organisation_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_tenant ON public.reconciliation_runs (organisation_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_tenant_status ON public.reconciliation_runs (organisation_id, status);
CREATE INDEX IF NOT EXISTS idx_discrepancy_events_tenant ON public.discrepancy_events (organisation_id);
CREATE INDEX IF NOT EXISTS idx_source_files_tenant ON public.source_files (organisation_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_tenant ON public.telemetry_intervals (organisation_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_tenant ON public.generated_reports (organisation_id);


-- 4. POSTGRESQL AUTHENTICATION & ROLE HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Returns current authenticated user's organisation_id
CREATE OR REPLACE FUNCTION public.auth_user_organisation_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organisation_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- Returns true if current authenticated user has SUPER_ADMIN role
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'SUPER_ADMIN'
    ) OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.role_name = 'SUPER_ADMIN'
    );
$$;


-- 5. CLEAN UP LEGACY PERMISSIVE & ANONYMOUS POLICIES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
            policyname LIKE 'Public Read %' OR
            policyname LIKE 'Public Manage %' OR
            policyname LIKE 'Allow authenticated read %' OR
            policyname LIKE 'Allow authenticated insert%' OR
            policyname LIKE 'Authenticated users can %' OR
            policyname LIKE 'Allow all %'
          )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;


-- 6. ENABLE & FORCE ROW LEVEL SECURITY ACROSS ALL BUSINESS TABLES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    t TEXT;
    all_tables TEXT[] := ARRAY[
        'organisations', 'users', 'roles', 'permissions', 'user_roles',
        'customers', 'sites', 'points_of_delivery', 'meters', 'meter_channels', 'meter_configurations',
        'tariff_assignments', 'source_files', 'file_versions', 'raw_documents', 'ingestion_jobs', 'ingestion_errors', 'parser_results',
        'telemetry_intervals', 'telemetry_quality', 'telemetry_gap_events',
        'invoice_records', 'invoice_line_items', 'invoice_determinants',
        'reconciliation_runs', 'reconciliation_results', 'reconciliation_determinant_comparisons',
        'discrepancy_events', 'discrepancy_records',
        'calculation_snapshots', 'source_hashes', 'reconciliation_ledger',
        'generated_reports', 'dispute_packs', 'report_exports', 'audit_events'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        END IF;
    END LOOP;
END $$;


-- 7. DEFINE STRICT TENANT ISOLATION RLS POLICIES
-- ------------------------------------------------------------------------------

-- Organisations: Users can only see their own organization record (unless SUPER_ADMIN)
DROP POLICY IF EXISTS "Tenant isolation policy for organisations" ON public.organisations;
CREATE POLICY "Tenant isolation policy for organisations"
ON public.organisations
FOR SELECT
TO authenticated
USING (
    id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Users: Users can only see members of their own organization (unless SUPER_ADMIN)
DROP POLICY IF EXISTS "Tenant isolation policy for users" ON public.users;
CREATE POLICY "Tenant isolation policy for users"
ON public.users
FOR SELECT
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Customers / Accounts
DROP POLICY IF EXISTS "Tenant isolation policy for customers" ON public.customers;
CREATE POLICY "Tenant isolation policy for customers"
ON public.customers
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

-- Sites
DROP POLICY IF EXISTS "Tenant isolation policy for sites" ON public.sites;
CREATE POLICY "Tenant isolation policy for sites"
ON public.sites
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR customer_id IN (SELECT id FROM public.customers WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Meters
DROP POLICY IF EXISTS "Tenant isolation policy for meters" ON public.meters;
CREATE POLICY "Tenant isolation policy for meters"
ON public.meters
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR site_id IN (
        SELECT id FROM public.sites 
        WHERE organisation_id = public.auth_user_organisation_id()
           OR customer_id IN (SELECT id FROM public.customers WHERE organisation_id = public.auth_user_organisation_id())
    )
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Source Files (Uploads)
DROP POLICY IF EXISTS "Tenant isolation policy for source_files" ON public.source_files;
CREATE POLICY "Tenant isolation policy for source_files"
ON public.source_files
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

-- Ingestion Jobs
DROP POLICY IF EXISTS "Tenant isolation policy for ingestion_jobs" ON public.ingestion_jobs;
CREATE POLICY "Tenant isolation policy for ingestion_jobs"
ON public.ingestion_jobs
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR source_file_id IN (SELECT id FROM public.source_files WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Raw Documents
DROP POLICY IF EXISTS "Tenant isolation policy for raw_documents" ON public.raw_documents;
CREATE POLICY "Tenant isolation policy for raw_documents"
ON public.raw_documents
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR upload_id IN (SELECT id::text FROM public.source_files WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Invoice Records
DROP POLICY IF EXISTS "Tenant isolation policy for invoice_records" ON public.invoice_records;
CREATE POLICY "Tenant isolation policy for invoice_records"
ON public.invoice_records
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR customer_id IN (SELECT id FROM public.customers WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Invoice Line Items
DROP POLICY IF EXISTS "Tenant isolation policy for invoice_line_items" ON public.invoice_line_items;
CREATE POLICY "Tenant isolation policy for invoice_line_items"
ON public.invoice_line_items
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR invoice_record_id IN (SELECT id FROM public.invoice_records WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Telemetry Intervals
DROP POLICY IF EXISTS "Tenant isolation policy for telemetry_intervals" ON public.telemetry_intervals;
CREATE POLICY "Tenant isolation policy for telemetry_intervals"
ON public.telemetry_intervals
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR meter_id IN (
        SELECT id FROM public.meters 
        WHERE organisation_id = public.auth_user_organisation_id()
           OR site_id IN (SELECT id FROM public.sites WHERE organisation_id = public.auth_user_organisation_id())
    )
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Reconciliation Runs
DROP POLICY IF EXISTS "Tenant isolation policy for reconciliation_runs" ON public.reconciliation_runs;
CREATE POLICY "Tenant isolation policy for reconciliation_runs"
ON public.reconciliation_runs
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

-- Reconciliation Results
DROP POLICY IF EXISTS "Tenant isolation policy for reconciliation_results" ON public.reconciliation_results;
CREATE POLICY "Tenant isolation policy for reconciliation_results"
ON public.reconciliation_results
FOR ALL
TO authenticated
USING (
    reconciliation_run_id IN (SELECT id FROM public.reconciliation_runs WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    reconciliation_run_id IN (SELECT id FROM public.reconciliation_runs WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
);

-- Discrepancy Events
DROP POLICY IF EXISTS "Tenant isolation policy for discrepancy_events" ON public.discrepancy_events;
CREATE POLICY "Tenant isolation policy for discrepancy_events"
ON public.discrepancy_events
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR invoice_record_id IN (SELECT id FROM public.invoice_records WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Discrepancy Records (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'discrepancy_records') THEN
        DROP POLICY IF EXISTS "Tenant isolation policy for discrepancy_records" ON public.discrepancy_records;
        CREATE POLICY "Tenant isolation policy for discrepancy_records"
        ON public.discrepancy_records
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
END $$;

-- Generated Reports
DROP POLICY IF EXISTS "Tenant isolation policy for generated_reports" ON public.generated_reports;
CREATE POLICY "Tenant isolation policy for generated_reports"
ON public.generated_reports
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

-- Audit Events
DROP POLICY IF EXISTS "Tenant isolation policy for audit_events" ON public.audit_events;
CREATE POLICY "Tenant isolation policy for audit_events"
ON public.audit_events
FOR SELECT
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- 8. REVOKE ALL ANONYMOUS / PUBLIC DIRECT MUTATION PRIVILEGES
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.organisations FROM anon;
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.sites FROM anon;
REVOKE ALL ON public.meters FROM anon;
REVOKE ALL ON public.source_files FROM anon;
REVOKE ALL ON public.invoice_records FROM anon;
REVOKE ALL ON public.invoice_line_items FROM anon;
REVOKE ALL ON public.reconciliation_runs FROM anon;
REVOKE ALL ON public.discrepancy_events FROM anon;
REVOKE ALL ON public.telemetry_intervals FROM anon;
REVOKE ALL ON public.generated_reports FROM anon;
REVOKE ALL ON public.audit_events FROM anon;
