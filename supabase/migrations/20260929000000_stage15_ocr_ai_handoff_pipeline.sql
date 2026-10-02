-- ============================================================================
-- STAGE 15 — OCR & AI PIPELINE HANDOFF AUDIT & STORAGE
-- ============================================================================
-- Prepares the persistent contracts and audit tables for the multi-stage pipeline:
--   Document Intelligence -> OCR -> Structured Extraction -> AI Validation ->
--   Deterministic Validation -> Human Review -> Approved Data -> Reconciliation

-- 1. OCR Handoff Packages Table
CREATE TABLE IF NOT EXISTS public.ocr_handoff_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL,
    organisation_id UUID NOT NULL,
    checksum TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'ESKOM_TARIFF_INVOICE',
    total_pages INTEGER NOT NULL CHECK (total_pages > 0),
    status TEXT NOT NULL DEFAULT 'READY_FOR_OCR' CHECK (status IN ('READY_FOR_OCR', 'PROCESSING', 'COMPLETED', 'ERROR')),
    target_engine TEXT NOT NULL DEFAULT 'TESSERACT',
    package_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for document lookup
CREATE INDEX IF NOT EXISTS idx_ocr_handoff_doc_org 
ON public.ocr_handoff_packages (document_id, organisation_id);

-- 2. AI Validation Handoff Packages Table
CREATE TABLE IF NOT EXISTS public.ai_validation_handoff_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL,
    organisation_id UUID NOT NULL,
    checksum TEXT NOT NULL,
    document_classification TEXT NOT NULL DEFAULT 'ESKOM_MEGAFLEX_INVOICE',
    determinants_payload JSONB NOT NULL,
    validation_checklist JSONB NOT NULL,
    state TEXT NOT NULL DEFAULT 'READY_FOR_AI_VALIDATION' CHECK (state IN ('READY_FOR_AI_VALIDATION', 'AI_VALIDATION_IN_PROGRESS', 'COMPLETED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_val_handoff_doc_org 
ON public.ai_validation_handoff_packages (document_id, organisation_id);

-- 3. Pipeline Stage Executions Audit Log
CREATE TABLE IF NOT EXISTS public.pipeline_stage_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL,
    organisation_id UUID NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN (
        'DOCUMENT_INTELLIGENCE',
        'OCR',
        'STRUCTURED_EXTRACTION',
        'AI_VALIDATION',
        'DETERMINISTIC_VALIDATION',
        'HUMAN_REVIEW',
        'APPROVED_DATA',
        'RECONCILIATION'
    )),
    status TEXT NOT NULL CHECK (status IN (
        'PENDING',
        'IN_PROGRESS',
        'COMPLETED',
        'FAILED',
        'SKIPPED',
        'REQUIRES_REVIEW'
    )),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    input_package_hash TEXT,
    output_artifact_hash TEXT,
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_exec_doc_stage 
ON public.pipeline_stage_executions (document_id, stage, created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ocr_handoff_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_validation_handoff_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stage_executions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Tenant Isolation)
CREATE POLICY "Tenant isolation for ocr_handoff_packages"
ON public.ocr_handoff_packages
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);

CREATE POLICY "Tenant isolation for ai_validation_handoff_packages"
ON public.ai_validation_handoff_packages
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);

CREATE POLICY "Tenant isolation for pipeline_stage_executions"
ON public.pipeline_stage_executions
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);
