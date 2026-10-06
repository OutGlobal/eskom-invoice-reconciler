-- ============================================================================
-- STAGE 4 — PERSISTENT PAGE REGISTRY MIGRATION
-- Migration: 20260926010000_stage4_persistent_page_registry.sql
--
-- Description:
-- Creates persistent page-level information where each page is strictly
-- traceable back to its parent document (uploads/document_registry).
--
-- Captures where technically possible:
-- - document ID (document_id -> uploads.id)
-- - page number (page_number >= 1)
-- - page dimensions (width, height, aspect_ratio, rotation, unit)
-- - extracted text (extracted_text)
-- - extraction method (PDF_TEXT_STREAM, TESSERACT_OCR, LAYOUT_TABLE_CELL, etc.)
-- - OCR required (ocr_required)
-- - OCR status (ocr_status)
-- - processing timestamp (processing_timestamp)
-- - layout information (layout_blocks, detected_tables, key_values)
-- - extraction confidence (extraction_confidence)
--
-- Provides exact provenance for ENERA validation: "Where did this value come from?"
-- ============================================================================

-- 1. Create public.document_pages table
CREATE TABLE IF NOT EXISTS public.document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL CHECK (page_number >= 1),
    
    -- Dimensions & Viewport Geometry
    width NUMERIC(10,2) NOT NULL DEFAULT 595.00,
    height NUMERIC(10,2) NOT NULL DEFAULT 842.00,
    aspect_ratio NUMERIC(10,4) NOT NULL DEFAULT 0.7071,
    rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270)),
    unit VARCHAR(10) NOT NULL DEFAULT 'pt',
    orientation VARCHAR(20) NOT NULL DEFAULT 'PORTRAIT' CHECK (orientation IN ('PORTRAIT', 'LANDSCAPE')),
    
    -- Text & Content Extraction
    extracted_text TEXT NOT NULL DEFAULT '',
    character_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    has_text BOOLEAN NOT NULL DEFAULT false,
    has_images BOOLEAN NOT NULL DEFAULT false,
    image_count INTEGER NOT NULL DEFAULT 0,
    is_scanned BOOLEAN NOT NULL DEFAULT false,
    
    -- Extraction Provenance & Method
    extraction_method VARCHAR(50) NOT NULL DEFAULT 'PDF_TEXT_STREAM'
        CHECK (extraction_method IN (
            'PDF_TEXT_STREAM',
            'PDFJS_VIEWPORT',
            'TESSERACT_OCR',
            'LAYOUT_TABLE_CELL',
            'KEY_VALUE_PAIR',
            'SYNTACTIC_REGEX',
            'HYBRID',
            'FALLBACK_STREAM'
        )),
    
    -- OCR Lifecycle
    ocr_required BOOLEAN NOT NULL DEFAULT false,
    ocr_status VARCHAR(50) NOT NULL DEFAULT 'NOT_REQUIRED'
        CHECK (ocr_status IN ('NOT_REQUIRED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    
    -- Spatial Layout & Structural Analysis
    layout_information JSONB NOT NULL DEFAULT '{}'::jsonb,
    layout_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    detected_tables JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_values JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Extraction Quality & Confidence
    extraction_confidence NUMERIC(6,4) NOT NULL DEFAULT 1.0000
        CHECK (extraction_confidence BETWEEN 0.0000 AND 1.0000),
    
    -- Cryptographic Integrity & Timestamps
    page_hash_sha256 VARCHAR(64),
    processing_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Enforce single row per page per document
    CONSTRAINT uq_document_pages_doc_page UNIQUE (document_id, page_number)
);

-- Comments on public.document_pages
COMMENT ON TABLE public.document_pages IS
'Stage 4 Persistent Page Registry: Traceable page-level extraction, layout geometry, OCR state, and validation provenance.';

COMMENT ON COLUMN public.document_pages.document_id IS 'Parent document identifier referencing uploads.id';
COMMENT ON COLUMN public.document_pages.page_number IS '1-based sequential page index within parent document';
COMMENT ON COLUMN public.document_pages.width IS 'Page width in points (pt)';
COMMENT ON COLUMN public.document_pages.height IS 'Page height in points (pt)';
COMMENT ON COLUMN public.document_pages.extraction_method IS 'Source extraction method (PDF_TEXT_STREAM, TESSERACT_OCR, etc.)';
COMMENT ON COLUMN public.document_pages.layout_information IS 'Full structural layout blocks, tables, and key-values for spatial audit';
COMMENT ON COLUMN public.document_pages.extraction_confidence IS 'Normalized extraction confidence score between 0.0000 and 1.0000';

-- 2. Performance & Foreign Key Indexing
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id
    ON public.document_pages(document_id);

CREATE INDEX IF NOT EXISTS idx_document_pages_organisation_id
    ON public.document_pages(organisation_id);

CREATE INDEX IF NOT EXISTS idx_document_pages_doc_page_composite
    ON public.document_pages(document_id, page_number);

CREATE INDEX IF NOT EXISTS idx_document_pages_ocr_status
    ON public.document_pages(ocr_status);

CREATE INDEX IF NOT EXISTS idx_document_pages_processing_timestamp
    ON public.document_pages(processing_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_document_pages_confidence
    ON public.document_pages(extraction_confidence);

-- 3. Row Level Security (RLS) & Multi-Tenant Isolation
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation policy for document_pages" ON public.document_pages;
CREATE POLICY "Tenant isolation policy for document_pages"
ON public.document_pages
FOR ALL
USING (
    organisation_id = auth.jwt() ->> 'organisation_id'::text
    OR organisation_id::text = current_setting('request.jwt.claim.organisation_id', true)
    OR auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
)
WITH CHECK (
    organisation_id = auth.jwt() ->> 'organisation_id'::text
    OR organisation_id::text = current_setting('request.jwt.claim.organisation_id', true)
    OR auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
);

-- 4. Canonical Updatable View: public.page_registry
CREATE OR REPLACE VIEW public.page_registry AS
SELECT
    dp.id,
    dp.document_id,
    dp.organisation_id,
    dp.page_number,
    dp.width,
    dp.height,
    dp.aspect_ratio,
    dp.rotation,
    dp.unit,
    dp.orientation,
    dp.extracted_text,
    dp.character_count,
    dp.token_count,
    dp.has_text,
    dp.has_images,
    dp.image_count,
    dp.is_scanned,
    dp.extraction_method,
    dp.ocr_required,
    dp.ocr_status,
    dp.layout_information,
    dp.layout_blocks,
    dp.detected_tables,
    dp.key_values,
    dp.extraction_confidence,
    dp.page_hash_sha256,
    dp.processing_timestamp,
    dp.created_at,
    dp.updated_at
FROM public.document_pages dp;

COMMENT ON VIEW public.page_registry IS
'Canonical view over document_pages exposing all page-level audit and provenance properties';

-- INSTEAD OF INSERT trigger for page_registry view
CREATE OR REPLACE FUNCTION public.fn_page_registry_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organisation_id IS NULL OR NEW.organisation_id <> auth.uid() THEN
        RAISE EXCEPTION 'organisation_id does not match authenticated user context';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.uploads u
        WHERE u.id = NEW.document_id
          AND u.organisation_id = NEW.organisation_id
    ) THEN
        RAISE EXCEPTION 'document_id is not accessible for organisation_id %', NEW.organisation_id;
    END IF;
    INSERT INTO public.document_pages (
        id,
        document_id,
        organisation_id,
        page_number,
        width,
        height,
        aspect_ratio,
        rotation,
        unit,
        orientation,
        extracted_text,
        character_count,
        token_count,
        has_text,
        has_images,
        image_count,
        is_scanned,
        extraction_method,
        ocr_required,
        ocr_status,
        layout_information,
        layout_blocks,
        detected_tables,
        key_values,
        extraction_confidence,
        page_hash_sha256,
        processing_timestamp,
        created_at,
        updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.document_id,
        NEW.organisation_id,
        NEW.page_number,
        COALESCE(NEW.width, 595.00),
        COALESCE(NEW.height, 842.00),
        COALESCE(NEW.aspect_ratio, 0.7071),
        COALESCE(NEW.rotation, 0),
        COALESCE(NEW.unit, 'pt'),
        COALESCE(NEW.orientation, 'PORTRAIT'),
        COALESCE(NEW.extracted_text, ''),
        COALESCE(NEW.character_count, LENGTH(COALESCE(NEW.extracted_text, ''))),
        COALESCE(NEW.token_count, 0),
        COALESCE(NEW.has_text, LENGTH(COALESCE(NEW.extracted_text, '')) > 30),
        COALESCE(NEW.has_images, false),
        COALESCE(NEW.image_count, 0),
        COALESCE(NEW.is_scanned, false),
        COALESCE(NEW.extraction_method, 'PDF_TEXT_STREAM'),
        COALESCE(NEW.ocr_required, false),
        COALESCE(NEW.ocr_status, 'NOT_REQUIRED'),
        COALESCE(NEW.layout_information, '{}'::jsonb),
        COALESCE(NEW.layout_blocks, '[]'::jsonb),
        COALESCE(NEW.detected_tables, '[]'::jsonb),
        COALESCE(NEW.key_values, '[]'::jsonb),
        COALESCE(NEW.extraction_confidence, 1.0000),
        NEW.page_hash_sha256,
        COALESCE(NEW.processing_timestamp, now()),
        COALESCE(NEW.created_at, now()),
        COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (document_id, page_number) DO UPDATE SET
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        aspect_ratio = EXCLUDED.aspect_ratio,
        rotation = EXCLUDED.rotation,
        unit = EXCLUDED.unit,
        orientation = EXCLUDED.orientation,
        extracted_text = EXCLUDED.extracted_text,
        character_count = EXCLUDED.character_count,
        token_count = EXCLUDED.token_count,
        has_text = EXCLUDED.has_text,
        has_images = EXCLUDED.has_images,
        image_count = EXCLUDED.image_count,
        is_scanned = EXCLUDED.is_scanned,
        extraction_method = EXCLUDED.extraction_method,
        ocr_required = EXCLUDED.ocr_required,
        ocr_status = EXCLUDED.ocr_status,
        layout_information = EXCLUDED.layout_information,
        layout_blocks = EXCLUDED.layout_blocks,
        detected_tables = EXCLUDED.detected_tables,
        key_values = EXCLUDED.key_values,
        extraction_confidence = EXCLUDED.extraction_confidence,
        page_hash_sha256 = EXCLUDED.page_hash_sha256,
        processing_timestamp = EXCLUDED.processing_timestamp,
        updated_at = now()
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_page_registry_insert ON public.page_registry;
CREATE TRIGGER trg_page_registry_insert
INSTEAD OF INSERT ON public.page_registry
FOR EACH ROW EXECUTE FUNCTION public.fn_page_registry_insert();

-- INSTEAD OF UPDATE trigger for page_registry view
CREATE OR REPLACE FUNCTION public.fn_page_registry_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.organisation_id IS NULL OR NEW.organisation_id <> auth.uid() THEN
        RAISE EXCEPTION 'organisation_id does not match authenticated user context';
    END IF;

    IF NEW.document_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.uploads u
        WHERE u.id = NEW.document_id
          AND u.organisation_id = NEW.organisation_id
    ) THEN
        RAISE EXCEPTION 'document_id is not accessible for organisation_id %', NEW.organisation_id;
    END IF;

    UPDATE public.document_pages SET
        width = COALESCE(NEW.width, width),
        height = COALESCE(NEW.height, height),
        aspect_ratio = COALESCE(NEW.aspect_ratio, aspect_ratio),
        rotation = COALESCE(NEW.rotation, rotation),
        unit = COALESCE(NEW.unit, unit),
        orientation = COALESCE(NEW.orientation, orientation),
        extracted_text = COALESCE(NEW.extracted_text, extracted_text),
        character_count = COALESCE(NEW.character_count, character_count),
        token_count = COALESCE(NEW.token_count, token_count),
        has_text = COALESCE(NEW.has_text, has_text),
        has_images = COALESCE(NEW.has_images, has_images),
        image_count = COALESCE(NEW.image_count, image_count),
        is_scanned = COALESCE(NEW.is_scanned, is_scanned),
        extraction_method = COALESCE(NEW.extraction_method, extraction_method),
        ocr_required = COALESCE(NEW.ocr_required, ocr_required),
        ocr_status = COALESCE(NEW.ocr_status, ocr_status),
        layout_information = COALESCE(NEW.layout_information, layout_information),
        layout_blocks = COALESCE(NEW.layout_blocks, layout_blocks),
        detected_tables = COALESCE(NEW.detected_tables, detected_tables),
        key_values = COALESCE(NEW.key_values, key_values),
        extraction_confidence = COALESCE(NEW.extraction_confidence, extraction_confidence),
        page_hash_sha256 = COALESCE(NEW.page_hash_sha256, page_hash_sha256),
        processing_timestamp = COALESCE(NEW.processing_timestamp, processing_timestamp),
        updated_at = now()
    WHERE (id = OLD.id OR (document_id = OLD.document_id AND page_number = OLD.page_number))
      AND organisation_id = auth.uid()
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_page_registry_update ON public.page_registry;
CREATE TRIGGER trg_page_registry_update
INSTEAD OF UPDATE ON public.page_registry
FOR EACH ROW EXECUTE FUNCTION public.fn_page_registry_update();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_pages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_registry TO authenticated, service_role;
