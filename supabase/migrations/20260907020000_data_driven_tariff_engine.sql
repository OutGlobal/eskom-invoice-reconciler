-- ==============================================================================
-- Enterprise Data-Driven Versioned Tariff Management Engine Migration
-- Tariffs are DATA, not frontend code.
-- ==============================================================================

-- 1. Create tariff_families table
CREATE TABLE IF NOT EXISTS public.tariff_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_code TEXT NOT NULL UNIQUE,
    family_name TEXT NOT NULL,
    utility TEXT NOT NULL DEFAULT 'Eskom',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tariff_families IS 'Catalog of supported tariff families (Megaflex, Miniflex, Nightsave, Businessrate, Municipal)';

-- 2. Ensure public.tariff_versions has comprehensive attributes
ALTER TABLE public.tariff_versions
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.tariff_families(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_category TEXT DEFAULT 'urban_transmission',
  ADD COLUMN IF NOT EXISTS voltage_category TEXT DEFAULT 'high',
  ADD COLUMN IF NOT EXISTS reactive_penalty_rate NUMERIC(18,6) DEFAULT 0.1450,
  ADD COLUMN IF NOT EXISTS pf_threshold NUMERIC(5,4) DEFAULT 0.95,
  ADD COLUMN IF NOT EXISTS nmd_ratchet_multiplier NUMERIC(5,2) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,4) DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS gazette_reference TEXT,
  ADD COLUMN IF NOT EXISTS gazette_sha256 TEXT;

-- 3. Create tariff_audit_logs for tracking version edits & gazette lineage
CREATE TABLE IF NOT EXISTS public.tariff_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN ('VERSION_CREATED', 'RATE_MODIFIED', 'GAZETTE_SUPERSEDED')),
    change_summary TEXT NOT NULL,
    configured_by TEXT NOT NULL DEFAULT 'Tariff Specialist',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tariff_audit_logs IS 'Append-only audit trail for tariff version changes and gazette lineage';

-- 4. Seed initial Tariff Families
INSERT INTO public.tariff_families (family_code, family_name, utility, description)
VALUES
    ('MEGAFLEX', 'Eskom Megaflex', 'Eskom', 'High & Medium Voltage Urban Transmission & Distribution TOU Tariff'),
    ('MINIFLEX', 'Eskom Miniflex', 'Eskom', 'Medium & Low Voltage Urban TOU Tariff'),
    ('NIGHTSAVE', 'Eskom Nightsave Urban', 'Eskom', 'High & Medium Voltage Off-Peak Night-Heavy Demand Tariff'),
    ('BUSINESSRATE', 'Eskom Businessrate', 'Eskom', 'Commercial & Small Business Non-TOU / TOU Tariff'),
    ('MUNICIPAL_COJ', 'City of Johannesburg Bulk', 'City of Johannesburg', 'Municipal Bulk Industrial TOU Tariff')
ON CONFLICT (family_code) DO NOTHING;

-- 5. Performance Indices
CREATE INDEX IF NOT EXISTS idx_tariff_versions_dates ON public.tariff_versions (effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_tariff_versions_code ON public.tariff_versions (tariff_code);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_component ON public.tariff_rates (tariff_component_id);

-- 6. Enable Row Level Security
ALTER TABLE public.tariff_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tariff_families"
    ON public.tariff_families FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read tariff_audit_logs"
    ON public.tariff_audit_logs FOR SELECT TO authenticated USING (true);
