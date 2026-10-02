-- Enterprise Ingestion Pipeline Schema Enhancements Migration
-- Target Supabase Project: bramhseicmakyihvnvpo
-- Migration Version: 20260904020000

-- 1. Enhance ingestion_jobs Table
ALTER TABLE public.ingestion_jobs 
    ADD COLUMN IF NOT EXISTS parser_version TEXT DEFAULT 'v4.4.0',
    ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '2026.1',
    ADD COLUMN IF NOT EXISTS rows_seen INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rows_imported INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rows_rejected INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rows_duplicate INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rows_invalid INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS error_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS processing_duration_ms BIGINT DEFAULT 0;

-- Update status constraint on ingestion_jobs
DO $$
BEGIN
    ALTER TABLE public.ingestion_jobs DROP CONSTRAINT IF EXISTS ingestion_jobs_status_check;
    ALTER TABLE public.ingestion_jobs ADD CONSTRAINT ingestion_jobs_status_check 
        CHECK (status IN ('queued', 'processing', 'completed', 'completed_with_warnings', 'failed'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

COMMENT ON COLUMN public.ingestion_jobs.parser_version IS 'Version tag of layout parser engine used for ingestion';
COMMENT ON COLUMN public.ingestion_jobs.rows_seen IS 'Total raw rows encountered during file stream processing';
COMMENT ON COLUMN public.ingestion_jobs.rows_imported IS 'Valid rows successfully stored in database';
COMMENT ON COLUMN public.ingestion_jobs.rows_rejected IS 'Malformed or invalid rows rejected during streaming';

-- 2. Enhance ingestion_errors Table
ALTER TABLE public.ingestion_errors 
    ADD COLUMN IF NOT EXISTS row_number INT,
    ADD COLUMN IF NOT EXISTS column_name TEXT,
    ADD COLUMN IF NOT EXISTS raw_value TEXT,
    ADD COLUMN IF NOT EXISTS error_description TEXT,
    ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'warning';

-- Update severity constraint on ingestion_errors
DO $$
BEGIN
    ALTER TABLE public.ingestion_errors DROP CONSTRAINT IF EXISTS ingestion_errors_severity_check;
    ALTER TABLE public.ingestion_errors ADD CONSTRAINT ingestion_errors_severity_check 
        CHECK (severity IN ('critical', 'major', 'minor', 'warning'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

COMMENT ON TABLE public.ingestion_errors IS 'Line-by-line malformed row error audit register for enterprise streaming ingestion';
COMMENT ON COLUMN public.ingestion_errors.row_number IS '1-based index line number in source file where error occurred';
COMMENT ON COLUMN public.ingestion_errors.raw_value IS 'Raw unparsed cell string payload that failed validation';

-- 3. Indexes for Ingestion Lookups
CREATE INDEX IF NOT EXISTS idx_source_files_hash ON public.source_files (file_hash_sha256);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_source_file ON public.ingestion_jobs (source_file_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_errors_job_id ON public.ingestion_errors (ingestion_job_id);
