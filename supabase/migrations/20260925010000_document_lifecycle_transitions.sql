-- ====================================================================
-- DOCUMENT INTELLIGENCE FOUNDATION: DOCUMENT LIFECYCLE TRANSITIONS
-- Stage 1: State Machine & Immutable Transition Persistence
-- ====================================================================

-- 1. Create document_lifecycle_transitions table
CREATE TABLE IF NOT EXISTS public.document_lifecycle_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    from_state TEXT CHECK (
        from_state IS NULL OR from_state IN (
            'UPLOADED',
            'STORED',
            'INSPECTING',
            'EXTRACTING',
            'CLASSIFYING',
            'READY_FOR_VALIDATION',
            'FAILED',
            'REVIEW_REQUIRED',
            'UNSUPPORTED'
        )
    ),
    to_state TEXT NOT NULL CHECK (
        to_state IN (
            'UPLOADED',
            'STORED',
            'INSPECTING',
            'EXTRACTING',
            'CLASSIFYING',
            'READY_FOR_VALIDATION',
            'FAILED',
            'REVIEW_REQUIRED',
            'UNSUPPORTED'
        )
    ),
    triggered_by TEXT NOT NULL,
    stage TEXT,
    reason TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_lifecycle_transitions IS 'Immutable audit register of all document lifecycle state transitions for the Document Intelligence pipeline';

-- 2. Create performance indices for fast lineage querying
CREATE INDEX IF NOT EXISTS idx_doc_lifecycle_transitions_doc_id
    ON public.document_lifecycle_transitions (document_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_doc_lifecycle_transitions_org_id
    ON public.document_lifecycle_transitions (organisation_id);

CREATE INDEX IF NOT EXISTS idx_doc_lifecycle_transitions_to_state
    ON public.document_lifecycle_transitions (to_state);

CREATE INDEX IF NOT EXISTS idx_doc_lifecycle_transitions_created_at
    ON public.document_lifecycle_transitions (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.document_lifecycle_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolated access for document_lifecycle_transitions" ON public.document_lifecycle_transitions;
CREATE POLICY "Tenant isolated access for document_lifecycle_transitions"
    ON public.document_lifecycle_transitions
    FOR ALL
    TO authenticated
    USING (
        organisation_id = public.auth_user_organisation_id()
        OR organisation_id IS NULL
        OR public.is_super_admin()
    )
    WITH CHECK (
        organisation_id = public.auth_user_organisation_id()
        OR organisation_id IS NULL
        OR public.is_super_admin()
    );
