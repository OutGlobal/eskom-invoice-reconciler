BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER POLICY "Allow insert for all" ON public.audit_events_ledger TO authenticated;
ALTER POLICY "Allow select for all" ON public.audit_events_ledger TO authenticated;
ALTER POLICY "Allow insert for all snapshots" ON public.reconciliation_run_snapshots TO authenticated;
ALTER POLICY "Allow select for all snapshots" ON public.reconciliation_run_snapshots TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.audit_events_ledger, public.reconciliation_run_snapshots FROM anon;

DO $verify_audit_access$
BEGIN
  IF EXISTS (
    SELECT FROM unnest(ARRAY['public.audit_events_ledger', 'public.reconciliation_run_snapshots']) AS tables(table_name)
    CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) AS privileges(privilege_name)
    WHERE has_table_privilege('anon', table_name, privilege_name)
  ) OR EXISTS (
    SELECT FROM unnest(ARRAY['public.audit_events_ledger', 'public.reconciliation_run_snapshots']) AS tables(table_name)
    CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) AS privileges(privilege_name)
    WHERE has_any_column_privilege('anon', table_name, privilege_name)
  ) THEN
    RAISE EXCEPTION 'Anonymous privileges remain on the audit tables.';
  END IF;
  IF EXISTS (
    SELECT FROM unnest(ARRAY['public.audit_events_ledger', 'public.reconciliation_run_snapshots']) AS tables(table_name)
    WHERE NOT (has_table_privilege('authenticated', table_name, 'SELECT')
      AND has_table_privilege('authenticated', table_name, 'INSERT'))
  ) THEN
    RAISE EXCEPTION 'Signed-in role lost existing audit privileges.';
  END IF;
END;
$verify_audit_access$;
COMMIT;
