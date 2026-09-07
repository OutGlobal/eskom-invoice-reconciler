-- Database Migration: Deterministic Configurable Calendar & TOU Subsystem
-- Creates calendar_holiday_configs, calendar_season_configs, and calendar_audit_logs

CREATE TABLE IF NOT EXISTS public.calendar_holiday_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(100) NOT NULL,
    country_code VARCHAR(10) DEFAULT 'ZA',
    holiday_type VARCHAR(50) DEFAULT 'public', -- 'public', 'special', 'observed'
    tou_treatment VARCHAR(50) DEFAULT 'sunday_schedule', -- 'sunday_schedule', 'saturday_schedule', 'off_peak'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(holiday_date, country_code)
);

CREATE TABLE IF NOT EXISTS public.calendar_season_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utility VARCHAR(100) NOT NULL DEFAULT 'Eskom',
    season_code VARCHAR(50) NOT NULL, -- 'high', 'low'
    season_name VARCHAR(100) NOT NULL,
    start_month INT NOT NULL, -- 1..12 (e.g. 6 for June)
    start_day INT NOT NULL,   -- 1..31
    end_month INT NOT NULL,   -- 1..12 (e.g. 8 for August)
    end_day INT NOT NULL,     -- 1..31
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calendar_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,
    holiday_id UUID,
    changed_by VARCHAR(100) DEFAULT 'SYSTEM',
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Security Policies
ALTER TABLE public.calendar_holiday_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_season_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read calendar_holiday_configs"
    ON public.calendar_holiday_configs FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated insert/update calendar_holiday_configs"
    ON public.calendar_holiday_configs FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow authenticated read calendar_season_configs"
    ON public.calendar_season_configs FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow authenticated read calendar_audit_logs"
    ON public.calendar_audit_logs FOR SELECT
    TO authenticated, anon
    USING (true);
