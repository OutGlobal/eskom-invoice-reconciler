-- ====================================================================
-- STAGE 34 — FINAL DATABASE REVIEW & OPTIMIZATION MIGRATION
-- Foreign keys, indexes, constraints, RLS policies, nullability & timestamps
-- ====================================================================

-- 1. ORGANISATION FILTERING INDEXES
-- Optimizes queries filtering by tenant organisation across accounts, users, and audit logs
CREATE INDEX IF NOT EXISTS idx_customers_organisation_id 
ON public.customers (organisation_id);

CREATE INDEX IF NOT EXISTS idx_users_organisation_id 
ON public.users (organisation_id);

CREATE INDEX IF NOT EXISTS idx_audit_ledger_org_created 
ON public.audit_events_ledger (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_ledger_org_seq 
ON public.audit_events_ledger (organisation_id, sequence_number DESC);

CREATE INDEX IF NOT EXISTS idx_discrepancy_events_org_status 
ON public.discrepancy_events (organisation_id, status);

CREATE INDEX IF NOT EXISTS idx_discrepancy_events_org_severity 
ON public.discrepancy_events (organisation_id, severity);

-- 2. SITE RELATIONSHIP & FILTERING INDEXES
-- Optimizes navigation from customer account -> physical sites -> meters
CREATE INDEX IF NOT EXISTS idx_sites_customer_id 
ON public.sites (customer_id);

CREATE INDEX IF NOT EXISTS idx_meters_site_id 
ON public.meters (site_id);

CREATE INDEX IF NOT EXISTS idx_meters_site_status 
ON public.meters (site_id, status);

CREATE INDEX IF NOT EXISTS idx_points_of_delivery_site_dates 
ON public.points_of_delivery (site_id, effective_from, effective_to);

-- 3. ACCOUNT RELATIONSHIP INDEXES
-- Optimizes tenant account lookups and invoice chronological timelines by account
CREATE INDEX IF NOT EXISTS idx_customers_org_account 
ON public.customers (organisation_id, account_number);

CREATE INDEX IF NOT EXISTS idx_invoice_records_customer_period 
ON public.invoice_records (customer_id, billing_start DESC);

-- 4. METER RELATIONSHIP & TELEMETRY INDEXES
-- Optimizes physical meter lookup by serial and interval timeseries extraction
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'meters' AND column_name = 'serial_number'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_meters_serial_number 
        ON public.meters (serial_number);
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'meters' AND column_name = 'meter_serial'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_meters_meter_serial 
        ON public.meters (meter_serial);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_org_meter_ts 
ON public.telemetry_intervals (organisation_id, meter_id, timestamp_utc DESC);

-- 5. BILLING PERIOD & INVOICE INDEXES
-- Optimizes multi-site, multi-period reconciliation queries
CREATE INDEX IF NOT EXISTS idx_invoice_records_site_period 
ON public.invoice_records (site_id, billing_start, billing_end);

CREATE INDEX IF NOT EXISTS idx_invoice_records_org_created 
ON public.invoice_records (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_records_org_lifecycle_created 
ON public.invoice_records (organisation_id, lifecycle_state, created_at DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invoice_determinants'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_invoice_determinants_invoice_id 
        ON public.invoice_determinants (invoice_record_id);
    END IF;
END $$;

-- 6. PROCESSING STATUS & LIFECYCLE RECONCILIATION INDEXES
-- Optimizes reconciliation run queries by execution status and timestamp
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_org_run_at 
ON public.reconciliation_runs (organisation_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_org_status_run 
ON public.reconciliation_runs (organisation_id, status, run_at DESC);

-- 7. TIMESTAMPS & RECENT FILE STORE INDEXES
-- Optimizes document vault retrieval for auditing
CREATE INDEX IF NOT EXISTS idx_source_files_org_created 
ON public.source_files (organisation_id, created_at DESC);

-- 8. RELATIONSHIP INTEGRITY & COMMENTS
COMMENT ON INDEX public.idx_customers_organisation_id IS 'Stage 34: Optimizes RLS tenant isolation and organisation filtering on billing accounts';
COMMENT ON INDEX public.idx_sites_customer_id IS 'Stage 34: Optimizes account to physical premises hierarchy traversal';
COMMENT ON INDEX public.idx_meters_site_id IS 'Stage 34: Optimizes premise to physical grid meter resolution';
COMMENT ON INDEX public.idx_telemetry_intervals_org_meter_ts IS 'Stage 34: High-throughput composite index for 30-minute interval series reconciliation';
COMMENT ON INDEX public.idx_reconciliation_runs_org_run_at IS 'Stage 34: Optimizes chronological audit trail queries for reconciliation runs';
