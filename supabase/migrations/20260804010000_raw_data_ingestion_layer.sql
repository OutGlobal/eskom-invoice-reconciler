-- Migration: Raw Data Ingestion & Audit Trail Layer
-- Target Project: bramhseicmakyihvnvpo

-- 1. Create Uploads Table
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    file_size NUMERIC NOT NULL,
    file_type TEXT NOT NULL,
    storage_path TEXT,
    uploaded_by TEXT DEFAULT 'system',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Raw Documents Table (Stores non-lossy raw text, OCR, tables, and AI outputs)
CREATE TABLE IF NOT EXISTS public.raw_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    invoice_number TEXT REFERENCES public.invoices(invoice_number) ON DELETE SET NULL,
    raw_text TEXT,
    ocr_json JSONB,
    detected_tables JSONB,
    page_metadata JSONB,
    confidence_score NUMERIC DEFAULT 0.0,
    parser_type TEXT CHECK (parser_type IN ('pdfjs', 'tesseract_ocr', 'ai_fallback', 'hybrid')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Validation Results Table (Stores audit mathematical checks)
CREATE TABLE IF NOT EXISTS public.validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    invoice_number TEXT,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pass', 'warning', 'fail')),
    message TEXT NOT NULL,
    expected_value TEXT,
    actual_value TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create AI Analysis Logs Table
CREATE TABLE IF NOT EXISTS public.ai_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    prompt_summary TEXT,
    model_used TEXT DEFAULT 'gemini-1.5-pro',
    extracted_json JSONB,
    conflict_resolutions JSONB,
    confidence_score NUMERIC DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Processing Logs Table (Step-by-step pipeline execution timeline)
CREATE TABLE IF NOT EXISTS public.processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE,
    stage TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    message TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Enable RLS Security Policies
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Uploads" ON public.uploads FOR SELECT USING (true);
CREATE POLICY "Public Manage Uploads" ON public.uploads FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read Raw Docs" ON public.raw_documents FOR SELECT USING (true);
CREATE POLICY "Public Manage Raw Docs" ON public.raw_documents FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read Validation Results" ON public.validation_results FOR SELECT USING (true);
CREATE POLICY "Public Manage Validation Results" ON public.validation_results FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read AI Logs" ON public.ai_analysis_logs FOR SELECT USING (true);
CREATE POLICY "Public Manage AI Logs" ON public.ai_analysis_logs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read Processing Logs" ON public.processing_logs FOR SELECT USING (true);
CREATE POLICY "Public Manage Processing Logs" ON public.processing_logs FOR ALL USING (true) WITH CHECK (true);
