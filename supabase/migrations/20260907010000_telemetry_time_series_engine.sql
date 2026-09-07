-- ==============================================================================
-- Enterprise Telemetry Time-Series Ingestion & Quality Validation Migration
-- 15-Point Quality Engine, 8 Quality States, Quarantine Ledger & Gap Analytics
-- ==============================================================================

-- 1. Ensure telemetry_intervals table has all 8-quality states & audit columns
ALTER TABLE public.telemetry_intervals
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.points_of_delivery(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'kWh',
  ADD COLUMN IF NOT EXISTS raw_value NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS multiplier_applied NUMERIC(18,6) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS engineering_value NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS billed_value NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kWh',
  ADD COLUMN IF NOT EXISTS source_file_id UUID REFERENCES public.source_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ingestion_batch_id UUID,
  ADD COLUMN IF NOT EXISTS quality_state TEXT NOT NULL DEFAULT 'ACTUAL';

-- Add check constraint for the 8 Quality States
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_telemetry_quality_state'
    ) THEN
        ALTER TABLE public.telemetry_intervals
        ADD CONSTRAINT chk_telemetry_quality_state CHECK (
            quality_state IN (
                'ACTUAL',
                'ESTIMATED',
                'INTERPOLATED',
                'MISSING',
                'INVALID',
                'DUPLICATE',
                'CORRECTED',
                'MANUAL_OVERRIDE'
            )
        );
    END IF;
END $$;

-- 2. Create telemetry_quarantine table (never silently discard bad data)
CREATE TABLE IF NOT EXISTS public.telemetry_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingestion_batch_id UUID NOT NULL,
    source_file_id UUID REFERENCES public.source_files(id) ON DELETE SET NULL,
    meter_id TEXT,
    row_number INT NOT NULL,
    raw_snippet TEXT NOT NULL,
    validation_code TEXT NOT NULL,
    failure_reason TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'critical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telemetry_quarantine IS 'Quarantine ledger for rejected or malformed time-series telemetry records';

-- 3. Create telemetry_missing_gaps table
CREATE TABLE IF NOT EXISTS public.telemetry_missing_gaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    expected_interval TIMESTAMPTZ NOT NULL,
    received_interval TIMESTAMPTZ,
    missing_duration_minutes INT NOT NULL DEFAULT 30,
    quality_impact TEXT NOT NULL DEFAULT 'HIGH' CHECK (quality_impact IN ('HIGH', 'MEDIUM', 'LOW')),
    estimation_permitted BOOLEAN NOT NULL DEFAULT true,
    suggested_method TEXT DEFAULT 'LINEAR_INTERPOLATION',
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ESTIMATED', 'IGNORED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telemetry_missing_gaps IS 'Detected time-series interval gaps requiring audit or estimation';

-- 4. Create telemetry_estimations table
CREATE TABLE IF NOT EXISTS public.telemetry_estimations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gap_id UUID REFERENCES public.telemetry_missing_gaps(id) ON DELETE SET NULL,
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    interval_timestamp TIMESTAMPTZ NOT NULL,
    estimated_kwh NUMERIC(18,6) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('LINEAR_INTERPOLATION', 'SAME_DAY_PRIOR_WEEK', 'HISTORICAL_MEDIAN')),
    source_intervals JSONB NOT NULL,
    reason TEXT NOT NULL,
    confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    engine_version TEXT NOT NULL DEFAULT 'telemetry-estimation-v1.0',
    created_by TEXT NOT NULL DEFAULT 'Estimation Framework Engine',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telemetry_estimations IS 'Audit trail of all configured telemetry estimations and source intervals';

-- 5. Performance Indices & Partitioning Helpers
CREATE INDEX IF NOT EXISTS idx_telemetry_meter_time ON public.telemetry_intervals (meter_id, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_telemetry_batch ON public.telemetry_intervals (ingestion_batch_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_quality_state ON public.telemetry_intervals (quality_state);
CREATE INDEX IF NOT EXISTS idx_telemetry_quarantine_batch ON public.telemetry_quarantine (ingestion_batch_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_gaps_meter ON public.telemetry_missing_gaps (meter_id, expected_interval);

-- 6. Enable Row Level Security
ALTER TABLE public.telemetry_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_missing_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_estimations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read telemetry_quarantine"
    ON public.telemetry_quarantine FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert telemetry_quarantine"
    ON public.telemetry_quarantine FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read telemetry_missing_gaps"
    ON public.telemetry_missing_gaps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update telemetry_missing_gaps"
    ON public.telemetry_missing_gaps FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read telemetry_estimations"
    ON public.telemetry_estimations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert telemetry_estimations"
    ON public.telemetry_estimations FOR INSERT TO authenticated WITH CHECK (true);
