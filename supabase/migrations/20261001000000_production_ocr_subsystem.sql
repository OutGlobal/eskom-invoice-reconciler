-- ============================================================================
-- PRODUCTION OCR SUBSYSTEM — DATABASE PERSISTENCE & AUDIT SCHEMA
-- ============================================================================
-- Authoritative storage for OCR runs, extracted page tokens, bounding boxes,
-- layout structures, and non-fabricated billing determinants:
--
--   PDF / Image
--        ↓
--   PAGE IMAGES
--        ↓
--       OCR
--        ↓
--      TEXT
--        ↓
--     WORDS
--        ↓
--     LINES
--        ↓
--   TABLE / LAYOUT STRUCTURE
--        ↓
--   CONFIDENCE
--        ↓
--    EVIDENCE
--        ↓
--    DATABASE (ocr_extraction_runs & ocr_page_tokens)
--
-- Strict Multi-Tenant Isolation with Row Level Security (RLS).
-- ============================================================================

-- 1. Master OCR Extraction Runs Table
CREATE TABLE IF NOT EXISTS public.ocr_extraction_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocr_run_id TEXT NOT NULL UNIQUE,
    document_id TEXT NOT NULL,
    organisation_id UUID NOT NULL,
    checksum TEXT NOT NULL,
    filename TEXT NOT NULL,
    document_category TEXT NOT NULL CHECK (
        document_category IN (
            'INVOICE',
            'STATEMENT',
            'CREDIT_NOTE',
            'ADJUSTMENT',
            'TARIFF_DOCUMENT',
            'METER_DOCUMENT',
            'UNKNOWN'
        )
    ),
    total_pages INTEGER NOT NULL CHECK (total_pages > 0),
    overall_confidence NUMERIC(5,2) NOT NULL CHECK (overall_confidence >= 0 AND overall_confidence <= 100),
    confidence_tier TEXT NOT NULL CHECK (confidence_tier IN ('HIGH', 'MEDIUM', 'LOW')),
    review_required BOOLEAN NOT NULL DEFAULT FALSE,
    review_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    execution_engine TEXT NOT NULL CHECK (
        execution_engine IN ('TESSERACT_HYBRID', 'TESSERACT_PURE', 'DIGITAL_FALLBACK')
    ),
    raw_full_text TEXT NOT NULL DEFAULT '',
    determinants_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    tables_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rapid lookup (<5ms)
CREATE INDEX IF NOT EXISTS idx_ocr_runs_doc_org 
ON public.ocr_extraction_runs (document_id, organisation_id);

CREATE INDEX IF NOT EXISTS idx_ocr_runs_org_created 
ON public.ocr_extraction_runs (organisation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_runs_checksum_org 
ON public.ocr_extraction_runs (checksum, organisation_id);

CREATE INDEX IF NOT EXISTS idx_ocr_runs_review 
ON public.ocr_extraction_runs (review_required, organisation_id);

-- 2. Granular OCR Page Tokens & Spatial Coordinate Layout Table
CREATE TABLE IF NOT EXISTS public.ocr_page_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocr_run_id TEXT NOT NULL REFERENCES public.ocr_extraction_runs(ocr_run_id) ON DELETE CASCADE,
    document_id TEXT NOT NULL,
    organisation_id UUID NOT NULL,
    page_number INTEGER NOT NULL CHECK (page_number > 0),
    page_confidence NUMERIC(5,2) NOT NULL CHECK (page_confidence >= 0 AND page_confidence <= 100),
    is_scanned_raster BOOLEAN NOT NULL DEFAULT FALSE,
    is_native_digital BOOLEAN NOT NULL DEFAULT FALSE,
    geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
    lines_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    words_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_values_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    tables_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    character_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_tokens_run_page 
ON public.ocr_page_tokens (ocr_run_id, page_number);

CREATE INDEX IF NOT EXISTS idx_ocr_tokens_doc_org 
ON public.ocr_page_tokens (document_id, organisation_id);

-- 3. Automatic updated_at trigger for ocr_extraction_runs
CREATE OR REPLACE FUNCTION public.set_ocr_extraction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ocr_extraction_updated_at ON public.ocr_extraction_runs;
CREATE TRIGGER trigger_ocr_extraction_updated_at
BEFORE UPDATE ON public.ocr_extraction_runs
FOR EACH ROW EXECUTE FUNCTION public.set_ocr_extraction_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ocr_extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocr_page_tokens ENABLE ROW LEVEL SECURITY;

-- 5. Tenant Isolation Policies
DROP POLICY IF EXISTS "Tenant isolation for ocr_extraction_runs" ON public.ocr_extraction_runs;
CREATE POLICY "Tenant isolation for ocr_extraction_runs"
ON public.ocr_extraction_runs
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);

DROP POLICY IF EXISTS "Tenant isolation for ocr_page_tokens" ON public.ocr_page_tokens;
CREATE POLICY "Tenant isolation for ocr_page_tokens"
ON public.ocr_page_tokens
FOR ALL
USING (
    auth.uid() IS NOT NULL AND (
        organisation_id = (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::uuid
        OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    )
);
