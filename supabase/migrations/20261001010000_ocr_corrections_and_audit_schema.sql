-- ============================================================================
-- OCR CORRECTIONS & PROCESSING RUN AUDIT SCHEMA (REQUIREMENT 30 & 34)
-- ============================================================================
-- Authoritative persistent storage for Human Review corrections, audit trails,
-- and reproducible OCR processing execution runs.
--
-- Strict Multi-Tenant Isolation with Row Level Security (RLS).
-- ============================================================================

-- 1. OCR Processing Execution Runs Table (Requirement 22, 23, 25, 34)
CREATE TABLE IF NOT EXISTS public.ocr_processing_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL UNIQUE,
    document_id TEXT NOT NULL,
    page_id TEXT,
    organisation_id UUID NOT NULL,
    provider TEXT NOT NULL,
    provider_version TEXT NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    language TEXT NOT NULL DEFAULT 'eng',
    preprocessing_version TEXT NOT NULL DEFAULT '1.0.0',
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    processing_duration INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (
        status IN (
            'RUNNING',
            'RETRY_1',
            'RETRY_2',
            'COMPLETED',
            'FAILED',
            'REVIEW_REQUIRED',
            'CANCELLED'
        )
    ),
    retry_attempt INTEGER NOT NULL DEFAULT 0,
    retry_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    error JSONB,
    output_version TEXT NOT NULL DEFAULT '1.0.0',
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_proc_runs_doc_org
ON public.ocr_processing_runs (document_id, organisation_id);

CREATE INDEX IF NOT EXISTS idx_ocr_proc_runs_org_created
ON public.ocr_processing_runs (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_proc_runs_status
ON public.ocr_processing_runs (status, organisation_id);

-- 2. OCR Corrections & Audit Trail Table (Requirement 29, 30, 34)
-- Lifecycle: ORIGINAL_OCR -> USER_CORRECTION -> VALIDATED_VALUE
CREATE TABLE IF NOT EXISTS public.ocr_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correction_id TEXT NOT NULL UNIQUE,
    document_id TEXT NOT NULL,
    organisation_id UUID NOT NULL,
    ocr_run_id TEXT,
    field_key TEXT NOT NULL,
    original_value JSONB,
    corrected_value JSONB,
    validated_value JSONB,
    stage TEXT NOT NULL CHECK (
        stage IN ('ORIGINAL_OCR', 'USER_CORRECTION', 'VALIDATED_VALUE')
    ),
    status TEXT NOT NULL CHECK (
        status IN ('PENDING_REVIEW', 'APPLIED', 'REVERTED')
    ),
    user_id TEXT,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT,
    reason TEXT,
    evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reverted_at TIMESTAMPTZ,
    reverted_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_corrections_doc_field
ON public.ocr_corrections (document_id, field_key);

CREATE INDEX IF NOT EXISTS idx_ocr_corrections_org_time
ON public.ocr_corrections (organisation_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_corrections_status
ON public.ocr_corrections (status, organisation_id);

-- 3. Automatic updated_at triggers
CREATE OR REPLACE FUNCTION public.set_ocr_proc_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ocr_proc_runs_updated_at ON public.ocr_processing_runs;
CREATE TRIGGER trigger_ocr_proc_runs_updated_at
BEFORE UPDATE ON public.ocr_processing_runs
FOR EACH ROW EXECUTE FUNCTION public.set_ocr_proc_runs_updated_at();

DROP TRIGGER IF EXISTS trigger_ocr_corrections_updated_at ON public.ocr_corrections;
CREATE TRIGGER trigger_ocr_corrections_updated_at
BEFORE UPDATE ON public.ocr_corrections
FOR EACH ROW EXECUTE FUNCTION public.set_ocr_proc_runs_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ocr_processing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_corrections ENABLE ROW LEVEL SECURITY;

-- 5. Tenant Isolation Policies
DROP POLICY IF EXISTS "Tenant isolation for ocr_processing_runs" ON public.ocr_processing_runs;
CREATE POLICY "Tenant isolation for ocr_processing_runs"
ON public.ocr_processing_runs
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);

DROP POLICY IF EXISTS "Tenant isolation for ocr_corrections" ON public.ocr_corrections;
CREATE POLICY "Tenant isolation for ocr_corrections"
ON public.ocr_corrections
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);
