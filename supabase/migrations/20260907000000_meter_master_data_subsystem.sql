-- ==============================================================================
-- Enterprise Meter Master-Data & Configuration History Subsystem Migration
-- 5-Level Hierarchy: Organisation -> Site -> Point of Delivery (POD) -> Meter -> Channel
-- 3-Tier Values: Raw Register -> Engineering -> Billed Value
-- ==============================================================================

-- 1. Create points_of_delivery table
CREATE TABLE IF NOT EXISTS public.points_of_delivery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    pod_code TEXT NOT NULL UNIQUE,
    pod_name TEXT NOT NULL,
    supply_voltage_kv NUMERIC(18,6) DEFAULT 11.0 CHECK (supply_voltage_kv >= 0),
    notified_maximum_demand_kva NUMERIC(18,6) DEFAULT 5000 CHECK (notified_maximum_demand_kva >= 0),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE public.points_of_delivery IS 'Official Utility Point of Delivery (POD) connecting physical sites to grid meters';

-- 2. Extend public.meters table with comprehensive master-data attributes
ALTER TABLE public.meters
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.points_of_delivery(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS removal_date DATE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS communication_source TEXT DEFAULT 'AMR_API';

-- Add constraints for meter status & communication source
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_meters_status'
    ) THEN
        ALTER TABLE public.meters
        ADD CONSTRAINT chk_meters_status CHECK (
            status IN ('ACTIVE', 'INACTIVE', 'DECOMMISSIONED', 'SUSPENDED')
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_meters_comm_source'
    ) THEN
        ALTER TABLE public.meters
        ADD CONSTRAINT chk_meters_comm_source CHECK (
            communication_source IN ('AMR_API', 'MODBUS', 'DLMS_COSEM', 'CSV_UPLOAD', 'MANUAL_ENTRY')
        );
    END IF;
END $$;

-- 3. Create meter_configurations table for versioned effective date configuration history
CREATE TABLE IF NOT EXISTS public.meter_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    version_number INT NOT NULL CHECK (version_number >= 1),
    effective_start_date DATE NOT NULL,
    effective_end_date DATE,
    ct_ratio_numerator NUMERIC(18,6) NOT NULL DEFAULT 200 CHECK (ct_ratio_numerator > 0),
    ct_ratio_denominator NUMERIC(18,6) NOT NULL DEFAULT 5 CHECK (ct_ratio_denominator > 0),
    ct_ratio NUMERIC(18,6) GENERATED ALWAYS AS (ct_ratio_numerator / ct_ratio_denominator) STORED,
    vt_ratio_numerator NUMERIC(18,6) NOT NULL DEFAULT 11000 CHECK (vt_ratio_numerator > 0),
    vt_ratio_denominator NUMERIC(18,6) NOT NULL DEFAULT 110 CHECK (vt_ratio_denominator > 0),
    vt_ratio NUMERIC(18,6) GENERATED ALWAYS AS (vt_ratio_numerator / vt_ratio_denominator) STORED,
    combined_multiplier NUMERIC(18,6) NOT NULL DEFAULT 4000 CHECK (combined_multiplier > 0),
    pulse_scaling NUMERIC(18,6) NOT NULL DEFAULT 1.0 CHECK (pulse_scaling > 0),
    register_scaling NUMERIC(18,6) NOT NULL DEFAULT 1.0 CHECK (register_scaling > 0),
    overall_multiplier NUMERIC(18,6) NOT NULL DEFAULT 4000 CHECK (overall_multiplier > 0),
    multiplier_source TEXT NOT NULL DEFAULT 'Nameplate Verification',
    change_reason TEXT,
    configured_by TEXT NOT NULL DEFAULT 'Metering Engineer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (meter_id, version_number),
    CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);

COMMENT ON TABLE public.meter_configurations IS 'Versioned, effective-dated CT/VT ratios, pulse scaling, and multiplier history per meter';

-- 4. Extend public.meter_channels table
ALTER TABLE public.meter_channels
  ADD COLUMN IF NOT EXISTS measurement_type TEXT DEFAULT 'ACTIVE_KWH',
  ADD COLUMN IF NOT EXISTS pulse_weight NUMERIC(18,6) DEFAULT 1.0 CHECK (pulse_weight > 0);

-- 5. Create performance indices
CREATE INDEX IF NOT EXISTS idx_points_of_delivery_site ON public.points_of_delivery (site_id);
CREATE INDEX IF NOT EXISTS idx_meters_pod ON public.meters (pod_id);
CREATE INDEX IF NOT EXISTS idx_meter_configurations_meter ON public.meter_configurations (meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_configurations_dates ON public.meter_configurations (effective_start_date, effective_end_date);
CREATE INDEX IF NOT EXISTS idx_meter_channels_meter ON public.meter_channels (meter_id);

-- 6. Enable Row Level Security
ALTER TABLE public.points_of_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read PODs"
    ON public.points_of_delivery FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can manage PODs"
    ON public.points_of_delivery FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read meter_configurations"
    ON public.meter_configurations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert meter_configurations"
    ON public.meter_configurations FOR INSERT
    TO authenticated
    WITH CHECK (true);
