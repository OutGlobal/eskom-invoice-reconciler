-- Enterprise PostgreSQL/Supabase Production Schema Migration for Eskom Reconciler
-- Target Project: bramhseicmakyihvnvpo
-- Migration Version: 20260904010000

-- Ensure Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. ORGANISATIONS DOMAIN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    vat_number TEXT,
    registration_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organisations IS 'Top-level enterprise organisation multi-tenancy anchor';
COMMENT ON COLUMN public.organisations.code IS 'Unique organization business identifier code';

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'Platform users linked to organisations';

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organisation_id, role_name)
);

COMMENT ON TABLE public.roles IS 'Role-based access control roles per organisation';

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (role_id, permission_key)
);

COMMENT ON TABLE public.permissions IS 'Fine-grained RBAC permission entries';

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role_id)
);

-- ==========================================
-- 2. CUSTOMERS / SITES DOMAIN
-- ==========================================

-- Safely extend existing public.customers if missing organisation_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'organisation_id') THEN
        ALTER TABLE public.customers ADD COLUMN organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    site_code TEXT NOT NULL,
    site_name TEXT NOT NULL,
    premise_id TEXT,
    address TEXT,
    supply_voltage_kv NUMERIC(18,6) CHECK (supply_voltage_kv >= 0),
    supply_zone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id, site_code)
);

COMMENT ON TABLE public.sites IS 'Physical facilities and points of electricity delivery';

CREATE TABLE IF NOT EXISTS public.meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    meter_number TEXT NOT NULL UNIQUE,
    meter_type TEXT NOT NULL DEFAULT 'AMR_INTERVAL' CHECK (meter_type IN ('AMR_INTERVAL', 'CUMULATIVE_DIAL', 'SMART_SUBMETER')),
    is_amr BOOLEAN NOT NULL DEFAULT true,
    installation_date DATE,
    ct_ratio NUMERIC(18,6) DEFAULT 1.0 CHECK (ct_ratio > 0),
    vt_ratio NUMERIC(18,6) DEFAULT 1.0 CHECK (vt_ratio > 0),
    overall_multiplier NUMERIC(18,6) DEFAULT 1.0 CHECK (overall_multiplier > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meters IS 'Physical or virtual metering devices installed at sites';

CREATE TABLE IF NOT EXISTS public.meter_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    channel_code TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    measurement_unit TEXT NOT NULL CHECK (measurement_unit IN ('kWh', 'kVARh', 'kVA', 'kW', 'PowerFactor')),
    multiplier NUMERIC(18,6) NOT NULL DEFAULT 1.0 CHECK (multiplier > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (meter_id, channel_code)
);

COMMENT ON TABLE public.meter_channels IS 'Telemetry data channels per meter (e.g. Active import, Reactive, kVA)';

CREATE TABLE IF NOT EXISTS public.tariff_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    meter_id UUID REFERENCES public.meters(id) ON DELETE SET NULL,
    tariff_version_id UUID, -- Foreign key added below after tariff tables created
    effective_from DATE NOT NULL,
    effective_to DATE,
    notified_max_demand_kva NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (notified_max_demand_kva >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE public.tariff_assignments IS 'Historical and active tariff structure assignments per site/meter';

-- ==========================================
-- 3. FILES DOMAIN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.source_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_hash_sha256 TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'parsed', 'failed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.source_files IS 'Catalog of raw uploaded PDF invoices and AMR telemetry files';

CREATE TABLE IF NOT EXISTS public.file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file_id UUID NOT NULL REFERENCES public.source_files(id) ON DELETE CASCADE,
    version_number INT NOT NULL CHECK (version_number >= 1),
    storage_path TEXT NOT NULL,
    file_hash_sha256 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_file_id, version_number)
);

COMMENT ON TABLE public.file_versions IS 'Version tracking for re-uploaded or modified files';

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file_id UUID NOT NULL REFERENCES public.source_files(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('AMR_CSV_INGEST', 'PDF_INVOICE_OCR', 'MUNICIPAL_BILL_INGEST')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    correlation_id TEXT NOT NULL,
    error_summary TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ingestion_jobs IS 'Asynchronous background ingestion pipeline execution jobs';

CREATE TABLE IF NOT EXISTS public.ingestion_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingestion_job_id UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
    error_code TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_details JSONB,
    line_number INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ingestion_errors IS 'Structured line-item error log for failed parsing/ingestion';

CREATE TABLE IF NOT EXISTS public.parser_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingestion_job_id UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
    parser_name TEXT NOT NULL,
    extracted_data JSONB NOT NULL,
    confidence_score NUMERIC(18,6) CHECK (confidence_score BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.parser_results IS 'Raw extracted JSON payloads prior to database normalization';

-- ==========================================
-- 4. TELEMETRY DOMAIN (Partitioned Time-Series)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.telemetry_intervals (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES public.meter_channels(id) ON DELETE SET NULL,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    local_timestamp TIMESTAMP NOT NULL,
    source_timezone TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    kw NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (kw >= 0),
    kva NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (kva >= 0),
    kvarh NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (kvarh >= 0),
    kwh NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (kwh >= 0),
    power_factor NUMERIC(18,6) DEFAULT 1.0 CHECK (power_factor BETWEEN -1.0 AND 1.0),
    tou_period TEXT CHECK (tou_period IN ('peak', 'standard', 'off_peak')),
    season TEXT CHECK (season IN ('high', 'low')),
    quality_code TEXT NOT NULL DEFAULT 'valid' CHECK (quality_code IN ('valid', 'estimated', 'interpolated', 'suspect', 'missing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (timestamp_utc, id)
) PARTITION BY RANGE (timestamp_utc);

COMMENT ON TABLE public.telemetry_intervals IS 'High-throughput 15/30-minute interval readings partitioned by date range';

-- Default partitions for historical & current periods
CREATE TABLE IF NOT EXISTS public.telemetry_intervals_y2025 PARTITION OF public.telemetry_intervals
    FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2026-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.telemetry_intervals_y2026 PARTITION OF public.telemetry_intervals
    FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.telemetry_intervals_y2027 PARTITION OF public.telemetry_intervals
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.telemetry_intervals_default PARTITION OF public.telemetry_intervals
    DEFAULT;

CREATE TABLE IF NOT EXISTS public.telemetry_quality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    timestamp_utc TIMESTAMPTZ NOT NULL,
    quality_score NUMERIC(18,6) CHECK (quality_score BETWEEN 0 AND 100),
    anomaly_flags JSONB,
    validated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.telemetry_quality IS 'Quality scores and validation anomaly flags per timestamp';

CREATE TABLE IF NOT EXISTS public.telemetry_gap_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID NOT NULL REFERENCES public.meters(id) ON DELETE CASCADE,
    gap_start_utc TIMESTAMPTZ NOT NULL,
    gap_end_utc TIMESTAMPTZ NOT NULL,
    missing_intervals INT NOT NULL CHECK (missing_intervals > 0),
    resolution_status TEXT NOT NULL DEFAULT 'open' CHECK (resolution_status IN ('open', 'interpolated', 'estimated', 'accepted_loss')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (gap_end_utc > gap_start_utc)
);

COMMENT ON TABLE public.telemetry_gap_events IS 'Audit register of missing telemetry interval windows';

-- ==========================================
-- 5. TARIFFS DOMAIN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.tariff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_code TEXT NOT NULL UNIQUE,
    tariff_name TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'Eskom',
    tariff_family TEXT NOT NULL CHECK (tariff_family IN ('megaflex', 'miniflex', 'nightsave', 'municipal')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tariff_schedules IS 'Master catalog of published Eskom and Municipal tariff structures';

CREATE TABLE IF NOT EXISTS public.tariff_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_schedule_id UUID NOT NULL REFERENCES public.tariff_schedules(id) ON DELETE CASCADE,
    version_label TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    nersa_gazette_ref TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tariff_schedule_id, version_label),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE public.tariff_versions IS 'Effective date versions for gazetted NERSA tariff rates';

-- Link tariff_assignments to tariff_versions now that tariff_versions exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tariff_assignments_tariff_version_id_fkey'
    ) THEN
        ALTER TABLE public.tariff_assignments 
        ADD CONSTRAINT tariff_assignments_tariff_version_id_fkey 
        FOREIGN KEY (tariff_version_id) REFERENCES public.tariff_versions(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tariff_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID NOT NULL REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    component_code TEXT NOT NULL,
    component_name TEXT NOT NULL,
    component_type TEXT NOT NULL CHECK (component_type IN (
        'ACTIVE_ENERGY', 'NETWORK_CAPACITY', 'NETWORK_DEMAND', 'TRANSMISSION_NETWORK',
        'GENERATION_CAPACITY', 'ANCILLARY_SERVICE', 'REACTIVE_ENERGY', 'SERVICE_CHARGE',
        'ADMINISTRATION_CHARGE', 'ELECTRIFICATION_SUBSIDY', 'AFFORDABILITY_SUBSIDY'
    )),
    unit_of_measure TEXT NOT NULL CHECK (unit_of_measure IN ('c/kWh', 'R/kVA/month', 'R/kW/month', 'R/kVARh', 'R/day', 'R/month', '%')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tariff_version_id, component_code)
);

COMMENT ON TABLE public.tariff_components IS 'Distinct unbundled rate components within a tariff schedule';

CREATE TABLE IF NOT EXISTS public.tariff_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_component_id UUID NOT NULL REFERENCES public.tariff_components(id) ON DELETE CASCADE,
    season TEXT CHECK (season IN ('high', 'low', 'all')),
    tou_period TEXT CHECK (tou_period IN ('peak', 'standard', 'off_peak', 'all')),
    voltage_level TEXT,
    rate_value NUMERIC(18,6) NOT NULL CHECK (rate_value >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE public.tariff_rates IS 'Exact gazetted numeric rates with precision NUMERIC(18,6)';

CREATE TABLE IF NOT EXISTS public.tariff_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_name TEXT NOT NULL CHECK (season_name IN ('high', 'low')),
    start_month INT NOT NULL CHECK (start_month BETWEEN 1 AND 12),
    start_day INT NOT NULL CHECK (start_day BETWEEN 1 AND 31),
    end_month INT NOT NULL CHECK (end_month BETWEEN 1 AND 12),
    end_day INT NOT NULL CHECK (end_day BETWEEN 1 AND 31),
    description TEXT
);

COMMENT ON TABLE public.tariff_seasons IS 'Definition of High-Demand (Winter: Jun-Aug) and Low-Demand (Summer: Sep-May) seasons';

CREATE TABLE IF NOT EXISTS public.tariff_tou_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season TEXT NOT NULL CHECK (season IN ('high', 'low')),
    day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday', 'public_holiday')),
    hour_start INT NOT NULL CHECK (hour_start BETWEEN 0 AND 23),
    hour_end INT NOT NULL CHECK (hour_end BETWEEN 0 AND 23),
    tou_period TEXT NOT NULL CHECK (tou_period IN ('peak', 'standard', 'off_peak'))
);

COMMENT ON TABLE public.tariff_tou_periods IS 'Time-of-Use clock schedule buckets by hour and day type';

CREATE TABLE IF NOT EXISTS public.tariff_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL UNIQUE,
    holiday_name TEXT NOT NULL,
    tou_treatment TEXT NOT NULL DEFAULT 'off_peak' CHECK (tou_treatment IN ('off_peak', 'sunday_schedule'))
);

COMMENT ON TABLE public.tariff_holidays IS 'Official South African public holidays treated as off-peak in TOU billing';

CREATE TABLE IF NOT EXISTS public.tariff_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID NOT NULL REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    rule_code TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    rule_params JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tariff_version_id, rule_code)
);

COMMENT ON TABLE public.tariff_rules IS 'Algorithmic tariff rules (e.g. 12-month rolling NMD ratchet, 30% kVARh threshold)';

-- ==========================================
-- 6. INVOICES DOMAIN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.invoice_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
    meter_id UUID REFERENCES public.meters(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    account_number TEXT NOT NULL,
    billing_period_name TEXT NOT NULL,
    billing_start DATE NOT NULL,
    billing_end DATE NOT NULL,
    total_kwh NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (total_kwh >= 0),
    peak_kwh NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (peak_kwh >= 0),
    standard_kwh NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (standard_kwh >= 0),
    off_peak_kwh NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (off_peak_kwh >= 0),
    max_demand_kva NUMERIC(18,6) NOT NULL DEFAULT 0 CHECK (max_demand_kva >= 0),
    invoiced_total NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (invoiced_total >= 0),
    reconciled_total NUMERIC(18,2) DEFAULT 0 CHECK (reconciled_total >= 0),
    variance_amount NUMERIC(18,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ingested', 'validated', 'reconciled', 'under_dispute', 'resolved')),
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (billing_end >= billing_start)
);

COMMENT ON TABLE public.invoice_records IS 'Canonical header record for ingested Eskom or municipal utility invoices';

CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_record_id UUID NOT NULL REFERENCES public.invoice_records(id) ON DELETE CASCADE,
    line_item_number INT NOT NULL,
    charge_code TEXT,
    charge_label TEXT NOT NULL,
    rate NUMERIC(18,6) DEFAULT 0,
    quantity NUMERIC(18,6) DEFAULT 0,
    unit_of_measure TEXT,
    invoiced_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    calculated_amount NUMERIC(18,2) DEFAULT 0,
    variance_amount NUMERIC(18,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (invoice_record_id, line_item_number)
);

COMMENT ON TABLE public.invoice_line_items IS 'Unbundled individual charge lines from physical invoices';

CREATE TABLE IF NOT EXISTS public.invoice_determinants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_record_id UUID NOT NULL REFERENCES public.invoice_records(id) ON DELETE CASCADE,
    determinant_name TEXT NOT NULL,
    determinant_value NUMERIC(18,6) NOT NULL,
    unit TEXT NOT NULL,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_determinants IS 'Extracted peak demand timestamps, active energy totals, and loss factors';

-- ==========================================
-- 7. RECONCILIATION DOMAIN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    invoice_record_id UUID NOT NULL REFERENCES public.invoice_records(id) ON DELETE CASCADE,
    meter_id UUID REFERENCES public.meters(id) ON DELETE SET NULL,
    tariff_version_id UUID REFERENCES public.tariff_versions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    correlation_id TEXT NOT NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reconciliation_runs IS 'Audit tracking for each mathematical reconciliation execution';

CREATE TABLE IF NOT EXISTS public.reconciliation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_run_id UUID NOT NULL UNIQUE REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
    total_invoiced NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_reconciled NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_variance NUMERIC(18,2) NOT NULL DEFAULT 0,
    summary_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reconciliation_results IS 'Summary total comparison and variance metrics per reconciliation run';

CREATE TABLE IF NOT EXISTS public.discrepancy_reason_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('TARIFF_ESCALATION', 'DEMAND_RATCHET', 'DAY_WEIGHTING', 'WHEELING_OFFSET', 'METER_ROLLOVER', 'REACTIVE_PENALTY')),
    description TEXT
);

COMMENT ON TABLE public.discrepancy_reason_codes IS 'Standardized root cause taxonomy for utility overcharge claims';

CREATE TABLE IF NOT EXISTS public.discrepancy_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
    invoice_record_id UUID NOT NULL REFERENCES public.invoice_records(id) ON DELETE CASCADE,
    reason_code_id UUID REFERENCES public.discrepancy_reason_codes(id) ON DELETE SET NULL,
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'major', 'minor', 'info')),
    invoiced_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    reconciled_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    variance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    root_cause TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'disputed', 'accepted_by_eskom', 'rejected', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.discrepancy_events IS 'Overcharge events flagged for commercial recovery from utility';

-- ==========================================
-- 8. AUDIT DOMAIN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    correlation_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_events IS 'System user activity and governance change log';

CREATE TABLE IF NOT EXISTS public.calculation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
    snapshot_name TEXT NOT NULL,
    input_params JSONB NOT NULL,
    calculated_outputs JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.calculation_snapshots IS 'Immutable snapshot of all formula inputs and intermediate steps';

CREATE TABLE IF NOT EXISTS public.source_hashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file_id UUID NOT NULL REFERENCES public.source_files(id) ON DELETE CASCADE,
    file_hash_sha256 TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'sha256',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.source_hashes IS 'Cryptographic proof of source data integrity';

CREATE TABLE IF NOT EXISTS public.reconciliation_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('INVOICE_BILLED', 'CLAIM_RAISED', 'CREDIT_ISSUED', 'PAYMENT_ADJUSTMENT')),
    reference_id UUID NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    balance_after NUMERIC(18,2) NOT NULL,
    hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reconciliation_ledger IS 'Double-entry style financial lineage ledger for overcharge recovery balance tracking';

-- ==========================================
-- 9. REPORTING DOMAIN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('EXECUTIVE_SUMMARY', 'RECONCILIATION_DETAIL', 'DISCREPANCY_REGISTER', 'NMD_RATCHET_ANALYSIS')),
    title TEXT NOT NULL,
    parameters JSONB NOT NULL,
    storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.generated_reports IS 'Catalog of generated executive and audit reports';

CREATE TABLE IF NOT EXISTS public.dispute_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_record_id UUID NOT NULL REFERENCES public.invoice_records(id) ON DELETE CASCADE,
    dispute_reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'resolved', 'escalated')),
    legal_memo TEXT NOT NULL,
    claim_amount NUMERIC(18,2) NOT NULL CHECK (claim_amount > 0),
    pdf_storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dispute_packs IS 'Formal legal claim packages sent to Eskom Key Accounts Management';

CREATE TABLE IF NOT EXISTS public.report_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.generated_reports(id) ON DELETE CASCADE,
    dispute_pack_id UUID REFERENCES public.dispute_packs(id) ON DELETE CASCADE,
    export_format TEXT NOT NULL CHECK (export_format IN ('pdf', 'xlsx', 'csv', 'json')),
    download_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.report_exports IS 'Downloadable export artifact links';

-- ==========================================
-- 10. INDEXES FOR PERFORMANCE & MANDATED LOOKUPS
-- ==========================================

-- Mandated Indexes: meter_id, timestamp_utc, billing_period, invoice_id, reconciliation_run_id, tariff_version_id

CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_meter_id ON public.telemetry_intervals (meter_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_timestamp_utc ON public.telemetry_intervals (timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_intervals_meter_ts ON public.telemetry_intervals (meter_id, timestamp_utc DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_records_meter_id ON public.invoice_records (meter_id);
CREATE INDEX IF NOT EXISTS idx_invoice_records_billing_period ON public.invoice_records (billing_period_name);
CREATE INDEX IF NOT EXISTS idx_invoice_records_billing_dates ON public.invoice_records (billing_start, billing_end);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items (invoice_record_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_invoice_id ON public.reconciliation_runs (invoice_record_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_meter_id ON public.reconciliation_runs (meter_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_tariff_version ON public.reconciliation_runs (tariff_version_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_results_run_id ON public.reconciliation_results (reconciliation_run_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_events_run_id ON public.discrepancy_events (reconciliation_run_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_events_invoice_id ON public.discrepancy_events (invoice_record_id);

CREATE INDEX IF NOT EXISTS idx_tariff_assignments_tariff_version ON public.tariff_assignments (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_components_version_id ON public.tariff_components (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_component_id ON public.tariff_rates (tariff_component_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_correlation ON public.audit_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_dispute_packs_invoice_id ON public.dispute_packs (invoice_record_id);

-- ==========================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS across all new enterprise tables
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parser_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_gap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_tou_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_determinants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discrepancy_reason_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discrepancy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

-- Permissive Read/Manage Policies for authenticated / public app access
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'organisations', 'users', 'roles', 'permissions', 'user_roles',
        'sites', 'meters', 'meter_channels', 'tariff_assignments',
        'source_files', 'file_versions', 'ingestion_jobs', 'ingestion_errors', 'parser_results',
        'telemetry_intervals', 'telemetry_quality', 'telemetry_gap_events',
        'tariff_schedules', 'tariff_versions', 'tariff_components', 'tariff_rates',
        'tariff_seasons', 'tariff_tou_periods', 'tariff_holidays', 'tariff_rules',
        'invoice_records', 'invoice_line_items', 'invoice_determinants',
        'reconciliation_runs', 'reconciliation_results', 'discrepancy_reason_codes', 'discrepancy_events',
        'audit_events', 'calculation_snapshots', 'source_hashes', 'reconciliation_ledger',
        'generated_reports', 'dispute_packs', 'report_exports'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public Read %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Public Read %I" ON public.%I FOR SELECT USING (true)', t, t);

        EXECUTE format('DROP POLICY IF EXISTS "Public Manage %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Public Manage %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
    END LOOP;
END $$;

-- ==========================================
-- 12. SEED DEFAULT TAXONOMIES & TARIFF DATA
-- ==========================================

INSERT INTO public.organisations (id, code, name)
VALUES ('7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c'::uuid, 'IMPALA_PLAT', 'Impala Platinum Rustenburg')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.discrepancy_reason_codes (code, name, category, description)
VALUES 
('TX_RATE_UNNOTIFIED', 'Unnotified Transmission Rate Escalation', 'TARIFF_ESCALATION', 'Transmission capacity rate escalated without NERSA 30-day gazette notice.'),
('CURTAILMENT_RATCHET_OVERCHARGE', 'Demand Ratchet During Load Curtailment', 'DEMAND_RATCHET', 'Maximum demand spike during compulsory load reduction order.'),
('MID_MONTH_PRO_RATA_ERROR', 'Mid-Month Day Weighting Calculation Error', 'DAY_WEIGHTING', 'Incorrect sub-period day fraction applied to split month billing.'),
('WHEELING_SUBSIDY_UNNETTED', 'Subsidies Applied To Gross Energy Pre-Wheeling', 'WHEELING_OFFSET', 'Electrification/Rural subsidy calculated on gross intake without netting clean wheeling energy.')
ON CONFLICT (code) DO NOTHING;
