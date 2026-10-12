-- ====================================================================
-- STAGE 37 — DATABASE PERFORMANCE & LARGE DATASETS OPTIMIZATION
-- Comprehensive Index Review for High-Volume Access Patterns:
-- 1. Billing-Period Queries
-- 2. Timestamp Queries
-- 3. Account Queries
-- 4. Meter Queries
-- 5. Organisation Filters (Multi-tenant RLS)
-- 6. Reconciliation Queries
-- 7. Foreign Key Coverage (Prevent seq scans on cascade/joins)
-- 8. Server-Side AMR Aggregation Functions (Avoid loading millions into browser)
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. BILLING-PERIOD ACCESS PATTERN INDEXES
-- Optimizes temporal slicing across invoices, telemetry intervals & reconciliations
-- --------------------------------------------------------------------

-- Composite index for billing-period filtering scoped by tenant organisation
CREATE INDEX IF NOT EXISTS idx_invoice_records_org_billing_range
ON public.invoice_records (organisation_id, billing_start, billing_end);

-- Account-level temporal query optimization
CREATE INDEX IF NOT EXISTS idx_invoice_records_account_billing_range
ON public.invoice_records (account_number, billing_start, billing_end);

-- Reconciliation temporal lookups by billing period
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'reconciliation_runs' AND column_name = 'billing_period_start'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_period_range
        ON public.reconciliation_runs (billing_period_start, billing_period_end);
    END IF;
END $$;


-- --------------------------------------------------------------------
-- 2. TIMESTAMP ACCESS PATTERN INDEXES
-- Optimizes high-throughput time-series interval lookups and chronological event sorting
-- --------------------------------------------------------------------

-- Primary time-series extraction index for meter interval feeds (UTC desc)
CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_meter_ts_desc
ON public.telemetry_intervals (meter_id, timestamp_utc DESC);

-- Channel-specific time-series range retrieval (e.g., active energy import kWh)
CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_meter_channel_ts
ON public.telemetry_intervals (meter_id, channel, timestamp_utc DESC);

-- Chronological tenant-level event timelines
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at_desc
ON public.audit_events_ledger (created_at DESC);


-- --------------------------------------------------------------------
-- 3. ACCOUNT ACCESS PATTERN INDEXES
-- Optimizes billing customer account lookups and customer-to-invoice resolution
-- --------------------------------------------------------------------

-- Fast account lookups within an organisation
CREATE INDEX IF NOT EXISTS idx_customers_org_account_num
ON public.customers (organisation_id, account_number);

-- Chronological invoice history per account number
CREATE INDEX IF NOT EXISTS idx_invoice_records_account_created
ON public.invoice_records (account_number, created_at DESC);


-- --------------------------------------------------------------------
-- 4. METER ACCESS PATTERN INDEXES
-- Optimizes physical device lookups, site-to-meter traversal, and status filtering
-- --------------------------------------------------------------------

-- Fast meter lookup by meter number scoped to organisation
CREATE INDEX IF NOT EXISTS idx_meters_org_meter_number
ON public.meters (organisation_id, meter_number);

-- Active meter lookup per site
CREATE INDEX IF NOT EXISTS idx_meters_site_active_status
ON public.meters (site_id, status)
WHERE status = 'ACTIVE';


-- --------------------------------------------------------------------
-- 5. ORGANISATION FILTERING ACCESS PATTERNS (TENANT RLS POLICIES)
-- Optimizes multi-tenant isolation so queries never do unindexed full-table scans
-- --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_org_id
ON public.reconciliation_runs (organisation_id);

CREATE INDEX IF NOT EXISTS idx_sites_org_id
ON public.sites (organisation_id);

CREATE INDEX IF NOT EXISTS idx_meters_org_id
ON public.meters (organisation_id);


-- --------------------------------------------------------------------
-- 6. RECONCILIATION ACCESS PATTERNS
-- Optimizes invoice-to-reconciliation linkage, idempotency checks, and line items
-- --------------------------------------------------------------------

-- Link between invoice and reconciliation run
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_invoice_status
ON public.reconciliation_runs (invoice_id, status);

-- Deterministic idempotency key lookup for instant duplicate prevention
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'reconciliation_runs' AND column_name = 'idempotency_key'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_idempotency_key
        ON public.reconciliation_runs (idempotency_key);
    END IF;
END $$;

-- Line item breakdown lookups per reconciliation
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'reconciliation_line_items'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_reconciliation_line_items_rec_id
        ON public.reconciliation_line_items (reconciliation_id);
    END IF;
END $$;


-- --------------------------------------------------------------------
-- 7. FOREIGN KEY COVERAGE INDEXES
-- Prevents sequential table scans during JOINs, CASCADE deletes, and FK checks
-- --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_fk_invoice_records_site_id
ON public.invoice_records (site_id);

CREATE INDEX IF NOT EXISTS idx_fk_invoice_records_customer_id
ON public.invoice_records (customer_id);

CREATE INDEX IF NOT EXISTS idx_fk_meters_site_id
ON public.meters (site_id);

CREATE INDEX IF NOT EXISTS idx_fk_sites_customer_id
ON public.sites (customer_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'discrepancy_events'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'discrepancy_events' AND column_name = 'reconciliation_run_id'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_fk_discrepancy_events_rec_run_id
            ON public.discrepancy_events (reconciliation_run_id);
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'discrepancy_events' AND column_name = 'invoice_id'
        ) THEN
            CREATE INDEX IF NOT EXISTS idx_fk_discrepancy_events_invoice_id
            ON public.discrepancy_events (invoice_id);
        END IF;
    END IF;
END $$;


-- --------------------------------------------------------------------
-- 8. SERVER-SIDE AGGREGATION FUNCTION FOR LARGE AMR DATASETS (REQ 36)
-- Aggregates raw intervals into <= 300 discrete time buckets directly inside Postgres
-- Avoids transferring millions of raw intervals across network or into React memory.
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_aggregated_meter_telemetry(
    p_meter_id UUID,
    p_start_utc TIMESTAMPTZ,
    p_end_utc TIMESTAMPTZ,
    p_target_buckets INT DEFAULT 200
)
RETURNS TABLE (
    bucket_start TIMESTAMPTZ,
    bucket_end TIMESTAMPTZ,
    channel TEXT,
    interval_count BIGINT,
    avg_value NUMERIC,
    sum_value NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    has_estimated_data BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_duration INTERVAL;
    v_bucket_width INTERVAL;
BEGIN
    -- Calculate adaptive bucket width based on target bucket count
    v_duration := p_end_utc - p_start_utc;
    IF v_duration <= INTERVAL '0 seconds' THEN
        RETURN;
    END IF;

    -- Ensure a minimum bucket width of 30 minutes
    v_bucket_width := GREATEST(INTERVAL '30 minutes', v_duration / GREATEST(1, p_target_buckets));

    RETURN QUERY
    SELECT
        time_bucket,
        time_bucket + v_bucket_width AS bucket_end,
        ti.channel,
        COUNT(*)::BIGINT AS interval_count,
        ROUND(AVG(COALESCE(ti.engineering_value, ti.raw_value))::NUMERIC, 4) AS avg_value,
        ROUND(SUM(COALESCE(ti.billed_value, ti.engineering_value, ti.raw_value))::NUMERIC, 4) AS sum_value,
        ROUND(MIN(COALESCE(ti.engineering_value, ti.raw_value))::NUMERIC, 4) AS min_value,
        ROUND(MAX(COALESCE(ti.engineering_value, ti.raw_value))::NUMERIC, 4) AS max_value,
        BOOL_OR(COALESCE(ti.quality_state, 'ACTUAL') IN ('ESTIMATED', 'SUBSTITUTED', 'INTERPOLATED')) AS has_estimated_data
    FROM (
        SELECT 
            ti_sub.*,
            -- Group by calculated time bucket
            p_start_utc + (FLOOR(EXTRACT(EPOCH FROM (ti_sub.timestamp_utc - p_start_utc)) / EXTRACT(EPOCH FROM v_bucket_width)) * EXTRACT(EPOCH FROM v_bucket_width) * INTERVAL '1 second') AS time_bucket
        FROM public.telemetry_intervals ti_sub
        WHERE ti_sub.meter_id = p_meter_id
          AND ti_sub.timestamp_utc >= p_start_utc
          AND ti_sub.timestamp_utc < p_end_utc
    ) ti
    GROUP BY time_bucket, ti.channel
    ORDER BY time_bucket ASC;
END;
$$;

COMMENT ON FUNCTION public.get_aggregated_meter_telemetry IS 
'Requirement 36: Server-side temporal downsampling function. Scales to millions of intervals by downsampling to <= p_target_buckets in the database engine without pushing raw rows to the frontend.';
