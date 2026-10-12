-- =========================================================================
-- Migration: Stage 8 — Document Evidence Model & Field Provenance Registry
-- =========================================================================
-- Creates canonical document_field_evidence table to guarantee that every
-- extracted field is permanently traceable to:
-- Document → Page → Region/Text → Extraction Method → Extracted Value → Confidence
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.document_field_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(100) NOT NULL,
    organisation_id VARCHAR(100) NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    field_key VARCHAR(100) NOT NULL,
    field_label VARCHAR(200) NOT NULL,
    raw_value TEXT NOT NULL,
    normalized_value JSONB,
    unit VARCHAR(50),
    page_number INT NOT NULL CHECK (page_number >= 1),
    bbox JSONB NOT NULL, -- [minX, minY, width, height]
    region_text TEXT NOT NULL,
    context_snippet TEXT,
    extraction_method VARCHAR(100) NOT NULL,
    extraction_method_label VARCHAR(100) NOT NULL DEFAULT 'Native PDF text',
    confidence_score NUMERIC(5, 4) NOT NULL DEFAULT 1.0000,
    confidence_level VARCHAR(50) NOT NULL DEFAULT 'HIGH',
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_field_evidence UNIQUE (document_id, field_key)
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_doc_field_evidence_doc_id 
    ON public.document_field_evidence (document_id);

CREATE INDEX IF NOT EXISTS idx_doc_field_evidence_org_id 
    ON public.document_field_evidence (organisation_id);

CREATE INDEX IF NOT EXISTS idx_doc_field_evidence_page 
    ON public.document_field_evidence (document_id, page_number);

CREATE INDEX IF NOT EXISTS idx_doc_field_evidence_key 
    ON public.document_field_evidence (field_key);

-- Enable Row Level Security (RLS)
ALTER TABLE public.document_field_evidence ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DROP POLICY IF EXISTS "tenant_isolation_select_document_field_evidence" ON public.document_field_evidence;
CREATE POLICY "tenant_isolation_select_document_field_evidence"
    ON public.document_field_evidence
    FOR SELECT
    USING (
        organisation_id = public.auth_user_organisation_id()
    );

DROP POLICY IF EXISTS "tenant_isolation_insert_document_field_evidence" ON public.document_field_evidence;
CREATE POLICY "tenant_isolation_insert_document_field_evidence"
    ON public.document_field_evidence
    FOR INSERT
    WITH CHECK (
        organisation_id = public.auth_user_organisation_id()
    );

DROP POLICY IF EXISTS "tenant_isolation_update_document_field_evidence" ON public.document_field_evidence;
CREATE POLICY "tenant_isolation_update_document_field_evidence"
    ON public.document_field_evidence
    FOR UPDATE
    USING (
        organisation_id = public.auth_user_organisation_id()
    );
