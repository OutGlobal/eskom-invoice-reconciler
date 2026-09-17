-- ==============================================================================
-- Stage 8: PDF / Invoice Ingestion Canonical Schema Migration
-- Explicit Missing Field Support (Nullable Determinants, Zero vs Null Integrity),
-- Opening & Closing Meter Readings, Line Items, Account/Site Foreign Key Linkages
-- ==============================================================================

-- 1. Modify public.invoice_records to allow NULL for determinants
-- Critical Rule: Never silently convert missing data into zero!
-- Determinants that are absent or not billed must be stored as NULL.
ALTER TABLE IF EXISTS public.invoice_records
    ALTER COLUMN total_kwh DROP NOT NULL,
    ALTER COLUMN total_kwh DROP DEFAULT,
    ALTER COLUMN peak_kwh DROP NOT NULL,
    ALTER COLUMN peak_kwh DROP DEFAULT,
    ALTER COLUMN standard_kwh DROP NOT NULL,
    ALTER COLUMN standard_kwh DROP DEFAULT,
    ALTER COLUMN off_peak_kwh DROP NOT NULL,
    ALTER COLUMN off_peak_kwh DROP DEFAULT,
    ALTER COLUMN max_demand_kva DROP NOT NULL,
    ALTER COLUMN max_demand_kva DROP DEFAULT;

-- 2. Add extended billing determinants, readings, and financial breakdowns to public.invoice_records
ALTER TABLE IF EXISTS public.invoice_records
    ADD COLUMN IF NOT EXISTS opening_reading NUMERIC(18,6),
    ADD COLUMN IF NOT EXISTS closing_reading NUMERIC(18,6),
    ADD COLUMN IF NOT EXISTS reactive_energy_kvarh NUMERIC(18,6),
    ADD COLUMN IF NOT EXISTS power_factor NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS utilised_capacity NUMERIC(18,6),
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS energy_charges NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS demand_charges NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS network_charges NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS service_charges NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS ancillary_charges NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS subsidies_charges NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS missing_fields TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Ensure public.invoice_line_items allows NULL rates and quantities (e.g. fixed levies or lump sums)
ALTER TABLE IF EXISTS public.invoice_line_items
    ALTER COLUMN rate DROP DEFAULT,
    ALTER COLUMN quantity DROP DEFAULT;

-- Ensure organisation_id exists on public.invoice_line_items if not already present
ALTER TABLE IF EXISTS public.invoice_line_items
    ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

-- 4. Create performance and linkage indices
CREATE INDEX IF NOT EXISTS idx_invoice_records_customer ON public.invoice_records (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_site ON public.invoice_records (site_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_account_meter ON public.invoice_records (account_number, meter_number);
CREATE INDEX IF NOT EXISTS idx_invoice_records_premise ON public.invoice_records (premise_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_record ON public.invoice_line_items (invoice_record_id);

COMMENT ON COLUMN public.invoice_records.opening_reading IS 'Opening meter dial reading at start of billing cycle (NULL if unbilled/cumulative not printed)';
COMMENT ON COLUMN public.invoice_records.closing_reading IS 'Closing meter dial reading at end of billing cycle (NULL if unbilled/cumulative not printed)';
COMMENT ON COLUMN public.invoice_records.reactive_energy_kvarh IS 'Total reactive energy consumption in kVARh (NULL if single-rate or unbilled)';
COMMENT ON COLUMN public.invoice_records.power_factor IS 'Average power factor across billing period (NULL if unmeasured)';
COMMENT ON COLUMN public.invoice_records.missing_fields IS 'Explicit array of standard determinants that were absent or unbilled in the source document';
