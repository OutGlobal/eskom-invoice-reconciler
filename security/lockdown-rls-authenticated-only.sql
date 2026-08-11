-- ============================================================================
-- SECURITY HARDENING — run this once in your Supabase SQL editor
-- (Project bramhseicmakyihvnvpo → SQL Editor → New query → paste → Run)
--
-- Removes fully public (anonymous) read/write access to every business,
-- financial and audit table. After running this, the Data API only serves
-- users with a valid Supabase Auth session — the app now has a sign-in gate.
-- ============================================================================

-- 1. Drop the permissive USING(true) / WITH CHECK(true) policies
DROP POLICY IF EXISTS "Public Read Customers" ON public.customers;
DROP POLICY IF EXISTS "Public Manage Customers" ON public.customers;
DROP POLICY IF EXISTS "Public Read Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public Manage Invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public Read Overcharge Recoveries" ON public.overcharge_recoveries;
DROP POLICY IF EXISTS "Public Manage Overcharge Recoveries" ON public.overcharge_recoveries;
DROP POLICY IF EXISTS "Public Read Reconciliation Items" ON public.reconciliation_line_items;
DROP POLICY IF EXISTS "Public Manage Reconciliation Items" ON public.reconciliation_line_items;
DROP POLICY IF EXISTS "Public Read Meter Readings" ON public.meter_readings;
DROP POLICY IF EXISTS "Public Manage Meter Readings" ON public.meter_readings;
DROP POLICY IF EXISTS "Public Read Uploads" ON public.uploads;
DROP POLICY IF EXISTS "Public Manage Uploads" ON public.uploads;
DROP POLICY IF EXISTS "Public Read Raw Docs" ON public.raw_documents;
DROP POLICY IF EXISTS "Public Manage Raw Docs" ON public.raw_documents;
DROP POLICY IF EXISTS "Public Read Validation Results" ON public.validation_results;
DROP POLICY IF EXISTS "Public Manage Validation Results" ON public.validation_results;
DROP POLICY IF EXISTS "Public Read AI Logs" ON public.ai_analysis_logs;
DROP POLICY IF EXISTS "Public Manage AI Logs" ON public.ai_analysis_logs;
DROP POLICY IF EXISTS "Public Read Processing Logs" ON public.processing_logs;
DROP POLICY IF EXISTS "Public Manage Processing Logs" ON public.processing_logs;

-- 2. Ensure RLS is enabled, revoke anon grants, and add authenticated-only
--    policies scoped per operation (SELECT / INSERT / UPDATE / DELETE).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','invoices','overcharge_recoveries','reconciliation_line_items',
    'meter_readings','uploads','raw_documents','validation_results',
    'ai_analysis_logs','processing_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)',
      'auth_select_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)',
      'auth_insert_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      'auth_update_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)',
      'auth_delete_' || t, t);
  END LOOP;
END $$;

-- 3. Verify: every policy below should be scoped to the authenticated role.
-- SELECT tablename, policyname, roles, cmd, qual, with_check
--   FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
