-- =========================================================
-- ESKOM RECONCILER PERFORMANCE OPTIMIZATION & INDEXING MIGRATION
-- Migration: 20260904050000_performance_indexing_aggregates.sql
-- Composite B-Tree Indexes & Daily Aggregates Table
-- =========================================================

-- 1. Create Telemetry Daily Aggregates Table
CREATE TABLE IF NOT EXISTS public.telemetry_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_active_kwh NUMERIC(18,4) NOT NULL DEFAULT 0,
    peak_kwh NUMERIC(18,4) NOT NULL DEFAULT 0,
    standard_kwh NUMERIC(18,4) NOT NULL DEFAULT 0,
    off_peak_kwh NUMERIC(18,4) NOT NULL DEFAULT 0,
    peak_kw NUMERIC(18,4) NOT NULL DEFAULT 0,
    peak_kva NUMERIC(18,4) NOT NULL DEFAULT 0,
    avg_power_factor NUMERIC(6,4) NOT NULL DEFAULT 1.0,
    interval_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (meter_id, date)
);

COMMENT ON TABLE public.telemetry_daily_aggregates IS 'Pre-aggregated daily telemetry summaries for sub-10ms chart & dashboard queries';

-- 2. Composite B-Tree Indexes for Sub-10ms Time-Series Queries
CREATE INDEX IF NOT EXISTS idx_telemetry_daily_meter_date
ON public.telemetry_daily_aggregates(meter_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_source_files_org_hash
ON public.source_files(organisation_id, file_hash_sha256);

CREATE INDEX IF NOT EXISTS idx_invoice_records_org_dates
ON public.invoice_records(organisation_id, billing_period_start, billing_period_end);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_meter_status
ON public.reconciliation_runs(organisation_id, status, started_at DESC);

-- Enable RLS on daily aggregates table
ALTER TABLE public.telemetry_daily_aggregates ENABLE ROW LEVEL SECURITY;
