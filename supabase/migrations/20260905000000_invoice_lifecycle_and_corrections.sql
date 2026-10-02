-- ==============================================================================
-- Enterprise Billing-Account & Invoice Subsystem Migration
-- 10-State Lifecycle, Decoupled Determinants, & Immutable Corrections Audit Register
-- ==============================================================================

-- 1. Ensure invoice_records has all 10-state lifecycle support & meta fields
ALTER TABLE public.invoice_records
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS pod_id TEXT,
  ADD COLUMN IF NOT EXISTS premise_id TEXT,
  ADD COLUMN IF NOT EXISTS meter_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_date DATE,
  ADD COLUMN IF NOT EXISTS tariff_code TEXT,
  ADD COLUMN IF NOT EXISTS tariff_name TEXT,
  ADD COLUMN IF NOT EXISTS supply_voltage NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS source_file_id UUID,
  ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'passed',
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'unprocessed',
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'UPLOADED';

-- Add check constraint for the 10 lifecycle states
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_lifecycle_state'
    ) THEN
        ALTER TABLE public.invoice_records
        ADD CONSTRAINT chk_invoice_lifecycle_state CHECK (
            lifecycle_state IN (
                'UPLOADED',
                'EXTRACTED',
                'VALIDATED',
                'REVIEW_REQUIRED',
                'APPROVED',
                'READY_FOR_RECONCILIATION',
                'RECONCILING',
                'RECONCILED',
                'DISPUTED',
                'CLOSED'
            )
        );
    END IF;
END $$;

-- 2. Create append-only audit corrections register table
CREATE TABLE IF NOT EXISTS public.invoice_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_record_id UUID NOT NULL REFERENCES public.invoice_records(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    original_value TEXT,
    corrected_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    user_id UUID,
    user_name TEXT NOT NULL DEFAULT 'System User',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_corrections IS 'Append-only audit register for human review corrections on extracted utility invoices';

-- 3. Create indices for multi-criteria search performance
CREATE INDEX IF NOT EXISTS idx_invoice_records_lifecycle_state ON public.invoice_records (lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_invoice_records_organisation_id ON public.invoice_records (organisation_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_pod_id ON public.invoice_records (pod_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_sha256_hash ON public.invoice_records (sha256_hash);
CREATE INDEX IF NOT EXISTS idx_invoice_corrections_invoice_id ON public.invoice_corrections (invoice_record_id);

-- 4. Enable Row Level Security
ALTER TABLE public.invoice_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view corrections for accessible invoices"
    ON public.invoice_corrections FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert corrections for accessible invoices"
    ON public.invoice_corrections FOR INSERT
    TO authenticated
    WITH CHECK (true);
