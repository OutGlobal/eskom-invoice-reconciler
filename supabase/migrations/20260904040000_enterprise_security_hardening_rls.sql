-- =========================================================
-- ESKOM RECONCILER ENTERPRISE SECURITY HARDENING MIGRATION
-- Migration: 20260904040000_enterprise_security_hardening_rls.sql
-- Enforces Row Level Security (RLS) policies & tenant isolation.
-- =========================================================

-- Enable RLS across all domain tables
ALTER TABLE IF EXISTS public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telemetry_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discrepancy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reconciliation_run_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_events_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.generated_reports ENABLE ROW LEVEL SECURITY;

-- 1. Customers Table RLS
DROP POLICY IF EXISTS "Tenant isolation policy for customers" ON public.customers;
CREATE POLICY "Tenant isolation policy for customers"
ON public.customers
FOR ALL
TO authenticated
USING (
    organisation_id IN (
        SELECT organisation_id FROM public.users WHERE id = auth.uid()
    )
);

-- 2. Source Files Table RLS
DROP POLICY IF EXISTS "Tenant isolation policy for source_files" ON public.source_files;
CREATE POLICY "Tenant isolation policy for source_files"
ON public.source_files
FOR ALL
TO authenticated
USING (
    organisation_id IN (
        SELECT organisation_id FROM public.users WHERE id = auth.uid()
    )
);

-- 3. Invoice Records Table RLS
DROP POLICY IF EXISTS "Tenant isolation policy for invoice_records" ON public.invoice_records;
CREATE POLICY "Tenant isolation policy for invoice_records"
ON public.invoice_records
FOR ALL
TO authenticated
USING (
    organisation_id IN (
        SELECT organisation_id FROM public.users WHERE id = auth.uid()
    )
);

-- 4. Reconciliation Runs Table RLS
DROP POLICY IF EXISTS "Tenant isolation policy for reconciliation_runs" ON public.reconciliation_runs;
CREATE POLICY "Tenant isolation policy for reconciliation_runs"
ON public.reconciliation_runs
FOR ALL
TO authenticated
USING (
    organisation_id IN (
        SELECT organisation_id FROM public.users WHERE id = auth.uid()
    )
);

-- 5. Reconciliation Run Snapshots RLS
DROP POLICY IF EXISTS "Tenant isolation policy for reconciliation_run_snapshots" ON public.reconciliation_run_snapshots;
CREATE POLICY "Tenant isolation policy for reconciliation_run_snapshots"
ON public.reconciliation_run_snapshots
FOR ALL
TO authenticated
USING (
    organisation_id IN (
        SELECT organisation_id FROM public.users WHERE id = auth.uid()
    )
);

-- 6. Audit Events Ledger (Immutable Append-Only Policies)
DROP POLICY IF EXISTS "Select policy for audit_events_ledger" ON public.audit_events_ledger;
CREATE POLICY "Select policy for audit_events_ledger"
ON public.audit_events_ledger
FOR SELECT
TO authenticated
USING (true);

-- Revoke UPDATE & DELETE on audit_events_ledger for all roles
REVOKE UPDATE, DELETE ON public.audit_events_ledger FROM authenticated, anon, public;
