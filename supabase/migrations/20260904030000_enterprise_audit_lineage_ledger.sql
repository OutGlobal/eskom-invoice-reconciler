-- Migration: Enterprise Audit & Cryptographic Lineage System
-- Description: Creates reproducible run snapshots and append-only audit ledger with cryptographic SHA-256 hash chain and immutable RLS policies

-- 1. Create Reproducible Reconciliation Run Snapshots Table
CREATE TABLE IF NOT EXISTS public.reconciliation_run_snapshots (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organisation_id UUID,
  source_file_ids TEXT[] NOT NULL DEFAULT '{}',
  source_file_hashes TEXT[] NOT NULL DEFAULT '{}',
  invoice_id TEXT,
  meter_id TEXT,
  tariff_version_id TEXT,
  tariff_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  calendar_version TEXT NOT NULL DEFAULT '2025/2026-V1',
  parser_version TEXT NOT NULL DEFAULT '1.0.0',
  calculation_engine_version TEXT NOT NULL DEFAULT '2.0.0',
  application_version TEXT NOT NULL DEFAULT '1.0.0',
  configuration_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  execution_environment TEXT NOT NULL DEFAULT 'production-browser',
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. Create Cryptographic Hash Chain Audit Ledger Table
CREATE TABLE IF NOT EXISTS public.audit_events_ledger (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_number BIGSERIAL UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  actor_id UUID,
  actor_email TEXT NOT NULL DEFAULT 'system@eskombalancer.co.za',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  previous_event_hash TEXT NOT NULL,
  current_event_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  state_before_hash TEXT,
  state_after_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indexes for high-performance audit lookups
CREATE INDEX IF NOT EXISTS idx_audit_ledger_sequence ON public.audit_events_ledger (sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_event_type ON public.audit_events_ledger (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_object ON public.audit_events_ledger (object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_actor ON public.audit_events_ledger (actor_id);
CREATE INDEX IF NOT EXISTS idx_run_snapshots_run_id ON public.reconciliation_run_snapshots (run_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.reconciliation_run_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events_ledger ENABLE ROW LEVEL SECURITY;

-- 3. IMMUTABLE APPEND-ONLY RLS POLICIES
-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.audit_events_ledger;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.audit_events_ledger;
DROP POLICY IF EXISTS "Allow select for authenticated snapshots" ON public.reconciliation_run_snapshots;
DROP POLICY IF EXISTS "Allow insert for authenticated snapshots" ON public.reconciliation_run_snapshots;

-- Read policy for all users
CREATE POLICY "Allow select for all" ON public.audit_events_ledger
  FOR SELECT TO authenticated, anon USING (true);

-- Insert policy for all users
CREATE POLICY "Allow insert for all" ON public.audit_events_ledger
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- Read policy for run snapshots
CREATE POLICY "Allow select for all snapshots" ON public.reconciliation_run_snapshots
  FOR SELECT TO authenticated, anon USING (true);

-- Insert policy for run snapshots
CREATE POLICY "Allow insert for all snapshots" ON public.reconciliation_run_snapshots
  FOR INSERT TO authenticated, anon WITH CHECK (true);

-- REVOKE UPDATE AND DELETE TO GUARANTEE IMMUTABLE APPEND-ONLY LEDGER
REVOKE UPDATE, DELETE ON public.audit_events_ledger FROM authenticated, anon, public;
REVOKE UPDATE, DELETE ON public.reconciliation_run_snapshots FROM authenticated, anon, public;

-- Grant SELECT & INSERT permissions
GRANT SELECT, INSERT ON public.audit_events_ledger TO authenticated, anon;
GRANT SELECT, INSERT ON public.reconciliation_run_snapshots TO authenticated, anon;
GRANT USAGE, SELECT ON SEQUENCE public.audit_events_ledger_sequence_number_seq TO authenticated, anon;
