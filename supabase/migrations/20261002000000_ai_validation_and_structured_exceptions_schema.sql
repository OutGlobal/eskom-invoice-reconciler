-- ============================================================================
-- ENERA AI VALIDATION, VERIFICATION & STRUCTURED EXCEPTIONS SCHEMA (STAGE 35)
-- ============================================================================
-- Migration: 20261002000000_ai_validation_and_structured_exceptions_schema.sql
-- Description:
--   Persists immutable validation runs, field validations, validation findings,
--   confidence breakdowns, evidence references, field corrections, approvals,
--   and structured validation exceptions with tenant isolation and RLS policies.
-- ============================================================================

-- 1. VALIDATION RUNS TABLE
CREATE TABLE IF NOT EXISTS public.validation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_run_id TEXT UNIQUE NOT NULL,
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    ocr_run_id TEXT,
    model_provider TEXT NOT NULL DEFAULT 'google-gemini-pro',
    prompt_version TEXT NOT NULL DEFAULT 'v2.4.0-prompt-contract',
    validation_version INT NOT NULL DEFAULT 1,
    idempotency_key TEXT UNIQUE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration_ms INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN (
        'PENDING_VALIDATION',
        'VALIDATING',
        'VALID',
        'PARTIALLY_VALID',
        'REVIEW_REQUIRED',
        'APPROVED',
        'REJECTED',
        'AUTOMATICALLY_APPROVED',
        'MANUALLY_APPROVED',
        'PENDING'
    )),
    overall_score NUMERIC(5, 2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    confidence_tier TEXT NOT NULL CHECK (confidence_tier IN ('HIGH', 'MEDIUM', 'LOW')),
    findings_count INT NOT NULL DEFAULT 0,
    errors_count INT NOT NULL DEFAULT 0,
    ai_failure_mode TEXT,
    reconciliation_handoff_ready BOOLEAN NOT NULL DEFAULT false,
    full_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for validation_runs
CREATE INDEX IF NOT EXISTS idx_val_runs_doc_id ON public.validation_runs(document_id);
CREATE INDEX IF NOT EXISTS idx_val_runs_org_id ON public.validation_runs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_val_runs_status ON public.validation_runs(status);
CREATE INDEX IF NOT EXISTS idx_val_runs_created_at ON public.validation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_val_runs_ocr_run ON public.validation_runs(ocr_run_id);

-- 2. FIELD VALIDATIONS TABLE
CREATE TABLE IF NOT EXISTS public.field_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_run_id TEXT NOT NULL REFERENCES public.validation_runs(validation_run_id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    field_key TEXT NOT NULL,
    field_label TEXT NOT NULL,
    extracted_value TEXT,
    raw_value TEXT,
    optical_confidence NUMERIC(5, 2) CHECK (optical_confidence >= 0 AND optical_confidence <= 100),
    validation_score NUMERIC(5, 2) CHECK (validation_score >= 0 AND validation_score <= 100),
    status TEXT NOT NULL CHECK (status IN ('VALID', 'INVALID', 'UNCERTAIN', 'MISSING', 'CONFLICT', 'REVIEW_REQUIRED')),
    is_grounded BOOLEAN NOT NULL DEFAULT false,
    source_page INT DEFAULT 1,
    bounding_box JSONB,
    source_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_val_run_id ON public.field_validations(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_field_val_doc_id ON public.field_validations(document_id);
CREATE INDEX IF NOT EXISTS idx_field_val_field_key ON public.field_validations(field_key);

-- 3. VALIDATION FINDINGS TABLE
CREATE TABLE IF NOT EXISTS public.validation_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_run_id TEXT NOT NULL REFERENCES public.validation_runs(validation_run_id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    category TEXT NOT NULL,
    rule_code TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL,
    is_passed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_val_findings_run_id ON public.validation_findings(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_val_findings_doc_id ON public.validation_findings(document_id);

-- 4. VALIDATION CONFIDENCE BREAKDOWN TABLE
CREATE TABLE IF NOT EXISTS public.validation_confidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    validation_run_id TEXT NOT NULL REFERENCES public.validation_runs(validation_run_id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    optical_score NUMERIC(5, 2) NOT NULL,
    grounding_score NUMERIC(5, 2) NOT NULL,
    semantic_score NUMERIC(5, 2) NOT NULL,
    deterministic_score NUMERIC(5, 2) NOT NULL,
    cross_field_score NUMERIC(5, 2) NOT NULL,
    overall_score NUMERIC(5, 2) NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('HIGH', 'MEDIUM', 'LOW')),
    policy_action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_val_conf_run_id ON public.validation_confidence(validation_run_id);
CREATE INDEX IF NOT EXISTS idx_val_conf_doc_id ON public.validation_confidence(document_id);

-- 5. EVIDENCE REFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.evidence_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    field_key TEXT NOT NULL,
    source_page INT NOT NULL DEFAULT 1,
    extraction_method TEXT NOT NULL DEFAULT 'NATIVE_PDF_TEXT',
    bounding_box JSONB,
    verbatim_text TEXT NOT NULL,
    optical_confidence NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_ref_doc_id ON public.evidence_references(document_id);
CREATE INDEX IF NOT EXISTS idx_evidence_ref_field_key ON public.evidence_references(field_key);

-- 6. FIELD CORRECTIONS & OVERRIDES TABLE
CREATE TABLE IF NOT EXISTS public.field_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correction_id TEXT UNIQUE NOT NULL,
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    field_key TEXT NOT NULL,
    original_value TEXT,
    corrected_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    source_page INT DEFAULT 1,
    bounding_box JSONB,
    source_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_corr_doc_id ON public.field_corrections(document_id);
CREATE INDEX IF NOT EXISTS idx_field_corr_field_key ON public.field_corrections(field_key);
CREATE INDEX IF NOT EXISTS idx_field_corr_reviewer ON public.field_corrections(reviewer);

-- 7. VALIDATION APPROVALS TABLE
CREATE TABLE IF NOT EXISTS public.validation_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    validation_run_id TEXT NOT NULL,
    approval_state TEXT NOT NULL CHECK (approval_state IN (
        'PENDING_VALIDATION',
        'VALIDATING',
        'VALID',
        'PARTIALLY_VALID',
        'REVIEW_REQUIRED',
        'APPROVED',
        'REJECTED'
    )),
    approval_method TEXT NOT NULL CHECK (approval_method IN ('AUTOMATIC', 'MANUAL', 'NONE')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    review_notes TEXT,
    audit_verification_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_val_appr_doc_id ON public.validation_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_val_appr_state ON public.validation_approvals(approval_state);

-- 8. VALIDATION ERRORS & STRUCTURED EXCEPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.validation_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exception_id TEXT UNIQUE NOT NULL,
    document_id TEXT NOT NULL,
    organisation_id TEXT NOT NULL DEFAULT 'DEFAULT_ORG',
    code TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'OVERRIDDEN', 'WAIVED', 'DISMISSED')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    field_key TEXT,
    observed_value TEXT,
    expected_value TEXT,
    difference TEXT,
    page_number INT DEFAULT 1,
    evidence_source_text TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    resolution_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_val_err_doc_id ON public.validation_errors(document_id);
CREATE INDEX IF NOT EXISTS idx_val_err_severity ON public.validation_errors(severity);
CREATE INDEX IF NOT EXISTS idx_val_err_status ON public.validation_errors(status);
CREATE INDEX IF NOT EXISTS idx_val_err_code ON public.validation_errors(code);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & TENANT ISOLATION POLICIES
-- ============================================================================

ALTER TABLE public.validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_errors ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
DO $$
BEGIN
    -- validation_runs RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_validation_runs') THEN
        CREATE POLICY tenant_isolation_validation_runs ON public.validation_runs
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;

    -- field_validations RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_field_validations') THEN
        CREATE POLICY tenant_isolation_field_validations ON public.field_validations
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;

    -- validation_findings RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_validation_findings') THEN
        CREATE POLICY tenant_isolation_validation_findings ON public.validation_findings
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;

    -- validation_confidence RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_validation_confidence') THEN
        CREATE POLICY tenant_isolation_validation_confidence ON public.validation_confidence
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;

    -- evidence_references RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_evidence_references') THEN
        CREATE POLICY tenant_isolation_evidence_references ON public.evidence_references
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;

    -- field_corrections RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_field_corrections') THEN
        CREATE POLICY tenant_isolation_field_corrections ON public.field_corrections
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;

    -- validation_approvals RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_validation_approvals') THEN
        CREATE POLICY tenant_isolation_validation_approvals ON public.validation_approvals
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;

    -- validation_errors RLS
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_validation_errors') THEN
        CREATE POLICY tenant_isolation_validation_errors ON public.validation_errors
            FOR ALL
            USING (
                organisation_id = COALESCE(current_setting('app.current_tenant_id', true), organisation_id)
                OR auth.role() = 'service_role'
            );
    END IF;
END $$;
