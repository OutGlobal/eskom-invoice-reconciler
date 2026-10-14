-- ==============================================================================
-- TARIFF CALCULATION VERSIONING, INTEGRITY & MULTI-TENANCY MIGRATION
-- Requirements 22 (Calculation Versioning & Reproducibility),
-- Requirements 23 (Database & Data Integrity),
-- Requirements 24 (Security & Multi-Tenancy)
-- ==============================================================================

-- CONCEPTUAL ENTITY CONSOLIDATION AUDIT (Requirement 23):
-- The following 16 conceptual entities are consolidated or extended with existing Supabase schema:
--   1. Tariffs -> public.tariff_schedules (extended with organisation_id, is_central)
--   2. Tariff versions -> public.tariff_versions (extended with approval_status, calculation_engine_version, published_at, published_by)
--   3. Applicability rules -> public.tariff_applicability_rules (new)
--   4. Charge components -> public.tariff_components (existing, linked to tariff_versions)
--   5. Rates -> public.tariff_rates (existing, linked to tariff_components)
--   6. TOU calendars -> public.tariff_tou_periods & public.calendar_holiday_configs (tou_calendars)
--   7. Seasonal definitions -> public.tariff_seasons & public.calendar_season_configs (seasonal_definitions)
--   8. Demand bands -> public.tariff_demand_bands (new)
--   9. Tax rules -> public.tariff_tax_rules (new)
--  10. Rounding rules -> public.tariff_rounding_rules (new)
--  11. Source documents -> public.source_files / public.document_registry (source_documents)
--  12. Import runs -> public.tariff_import_runs (new)
--  13. Validation results -> public.tariff_validation_results (new)
--  14. Approval history -> public.tariff_approval_history (new)
--  15. Calculation runs -> public.calculation_runs (new)
--  16. Calculation line items -> public.calculation_line_items (new)

-- 1. EXTEND TARIFF MASTER TABLES WITH MULTI-TENANCY & PUBLICATION GUARDS
-- ------------------------------------------------------------------------------

-- Central vs Organisation-specific Tariffs:
-- organisation_id IS NULL => Centrally maintained utility tariff (Eskom, City Power)
-- organisation_id IS NOT NULL => Organisation-specific customized/negotiated tariff
ALTER TABLE IF EXISTS public.tariff_schedules
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_central BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS public.tariff_versions
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_central BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calculation_engine_version TEXT NOT NULL DEFAULT 'ENERA-TARIFF-ENGINE-V2.0';

-- 2. TARIFF APPLICABILITY RULES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_applicability_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID NOT NULL REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    voltage_level TEXT,
    customer_class TEXT,
    supply_type TEXT,
    min_demand_kva NUMERIC(18,6) CHECK (min_demand_kva >= 0),
    max_demand_kva NUMERIC(18,6) CHECK (max_demand_kva >= min_demand_kva),
    geographic_territory TEXT,
    eligibility_criteria JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tariff_applicability_rules IS 'Structured eligibility criteria for matching meters to applicable tariffs';

-- 3. TARIFF DEMAND BANDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_demand_bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID NOT NULL REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    band_code TEXT NOT NULL,
    band_name TEXT NOT NULL,
    band_lower_kva NUMERIC(18,6) NOT NULL CHECK (band_lower_kva >= 0),
    band_upper_kva NUMERIC(18,6) CHECK (band_upper_kva IS NULL OR band_upper_kva >= band_lower_kva),
    rate_value NUMERIC(18,6) NOT NULL CHECK (rate_value >= 0),
    unit_of_measure TEXT NOT NULL DEFAULT 'R/kVA/month',
    excess_demand_penalty_rate NUMERIC(18,6) DEFAULT 0 CHECK (excess_demand_penalty_rate >= 0),
    min_demand_charge NUMERIC(18,2) DEFAULT 0 CHECK (min_demand_charge >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tariff_version_id, band_code)
);

COMMENT ON TABLE public.tariff_demand_bands IS 'Capacity bands, minimum demand charges, and excess demand penalty structures';

-- 4. TARIFF TAX RULES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_tax_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    tax_rule_code TEXT NOT NULL,
    tax_name TEXT NOT NULL,
    vat_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1500 CHECK (vat_rate BETWEEN 0 AND 1),
    taxable_base TEXT NOT NULL DEFAULT 'ALL_NON_EXEMPT_CHARGES',
    exempt_components JSONB NOT NULL DEFAULT '[]',
    effective_from DATE NOT NULL,
    effective_to DATE,
    rounding_method TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE public.tariff_tax_rules IS 'Configurable historical VAT and tax rules with effective dates and exemptions';

-- 5. TARIFF ROUNDING RULES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_rounding_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    policy_id TEXT NOT NULL,
    policy_name TEXT NOT NULL,
    rate_precision INT NOT NULL DEFAULT 4 CHECK (rate_precision BETWEEN 0 AND 10),
    rate_rounding_method TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    quantity_precision INT NOT NULL DEFAULT 2 CHECK (quantity_precision BETWEEN 0 AND 10),
    quantity_rounding_method TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    charge_line_precision INT NOT NULL DEFAULT 2 CHECK (charge_line_precision BETWEEN 0 AND 4),
    charge_line_rounding_method TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    tax_precision INT NOT NULL DEFAULT 2 CHECK (tax_precision BETWEEN 0 AND 4),
    tax_rounding_method TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    final_total_precision INT NOT NULL DEFAULT 2 CHECK (final_total_precision BETWEEN 0 AND 4),
    final_total_rounding_method TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tariff_version_id, policy_id)
);

COMMENT ON TABLE public.tariff_rounding_rules IS 'Explicit configurable rounding policies for rates, quantities, taxes, and totals';

-- 6. TARIFF VALIDATION RESULTS & APPROVAL HISTORY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID NOT NULL REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    validation_status TEXT NOT NULL CHECK (validation_status IN ('passed', 'failed', 'warning')),
    validation_score NUMERIC(5,2) NOT NULL CHECK (validation_score BETWEEN 0 AND 100),
    rule_integrity_checks JSONB NOT NULL DEFAULT '{}',
    mathematical_consistency_checks JSONB NOT NULL DEFAULT '{}',
    validation_errors JSONB NOT NULL DEFAULT '[]',
    validated_by TEXT NOT NULL DEFAULT 'TariffValidationEngine',
    validated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tariff_validation_results IS 'Automated validation audit checks gating tariff approval';

CREATE TABLE IF NOT EXISTS public.tariff_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_version_id UUID NOT NULL REFERENCES public.tariff_versions(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    review_notes TEXT NOT NULL,
    validation_result_id UUID REFERENCES public.tariff_validation_results(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tariff_approval_history IS 'Formal human governance approval history for publication';

-- 7. TARIFF IMPORT RUNS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tariff_import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
    source_file_id UUID REFERENCES public.source_files(id) ON DELETE SET NULL,
    tariff_version_id UUID REFERENCES public.tariff_versions(id) ON DELETE SET NULL,
    import_status TEXT NOT NULL CHECK (import_status IN ('queued', 'parsing', 'validating', 'completed', 'failed')),
    source_hash_sha256 TEXT NOT NULL,
    components_extracted INT NOT NULL DEFAULT 0,
    rates_extracted INT NOT NULL DEFAULT 0,
    error_log JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.tariff_import_runs IS 'Tracks extraction, ingestion, and validation runs for uploaded tariff documents';

-- 8. CALCULATION RUNS & CALCULATION LINE ITEMS (REPRODUCIBILITY LEDGER)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calculation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL UNIQUE,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    parent_run_id UUID REFERENCES public.calculation_runs(id) ON DELETE SET NULL,
    recalculation_reason TEXT,
    invoice_record_id UUID REFERENCES public.invoice_records(id) ON DELETE SET NULL,
    meter_id UUID REFERENCES public.meters(id) ON DELETE SET NULL,
    tariff_version_id UUID REFERENCES public.tariff_versions(id) ON DELETE SET NULL,
    tariff_code TEXT NOT NULL,
    tariff_version TEXT NOT NULL,
    tariff_rule_version TEXT NOT NULL DEFAULT '1.0',
    tax_rule_version TEXT NOT NULL DEFAULT '1.0',
    meter_config_version TEXT NOT NULL DEFAULT '1.0',
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    calculation_engine_version TEXT NOT NULL,
    rounding_policy_id TEXT NOT NULL,
    input_data_references JSONB NOT NULL DEFAULT '{}',
    selected_assumptions JSONB NOT NULL DEFAULT '{}',
    result_summary JSONB NOT NULL DEFAULT '{}',
    total_expected_zar NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_invoiced_zar NUMERIC(18,2) DEFAULT 0,
    variance_zar NUMERIC(18,2) DEFAULT 0,
    exceptions JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'superseded', 'disputed', 'flagged_for_review', 'failed')),
    is_immutable BOOLEAN NOT NULL DEFAULT true,
    reproducibility_checksum TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    CHECK (billing_period_end >= billing_period_start)
);

COMMENT ON TABLE public.calculation_runs IS 'Complete calculation execution provenance storing all 11 required reproducibility dimensions';

CREATE TABLE IF NOT EXISTS public.calculation_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_run_id UUID NOT NULL REFERENCES public.calculation_runs(id) ON DELETE CASCADE,
    line_number INT NOT NULL CHECK (line_number >= 1),
    charge_type TEXT NOT NULL,
    charge_name TEXT NOT NULL,
    quantity NUMERIC(18,6) NOT NULL,
    quantity_unit TEXT NOT NULL,
    rate_applied NUMERIC(18,6) NOT NULL,
    rate_unit TEXT NOT NULL,
    amount_zar NUMERIC(18,2) NOT NULL,
    rule_id TEXT NOT NULL,
    calculation_method TEXT NOT NULL,
    rounding_method TEXT NOT NULL,
    source_evidence JSONB NOT NULL DEFAULT '{}',
    trace JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (calculation_run_id, line_number)
);

COMMENT ON TABLE public.calculation_line_items IS 'Unbundled calculated charge lines with deterministic trace and source evidence';

-- 9. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tariff_schedules_org ON public.tariff_schedules (organisation_id);
CREATE INDEX IF NOT EXISTS idx_tariff_versions_org ON public.tariff_versions (organisation_id);
CREATE INDEX IF NOT EXISTS idx_tariff_versions_approval ON public.tariff_versions (approval_status);
CREATE INDEX IF NOT EXISTS idx_tariff_applicability_version ON public.tariff_applicability_rules (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_demand_bands_version ON public.tariff_demand_bands (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_tax_rules_version ON public.tariff_tax_rules (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_rounding_rules_version ON public.tariff_rounding_rules (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_validation_version ON public.tariff_validation_results (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_approval_version ON public.tariff_approval_history (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_tariff_import_org ON public.tariff_import_runs (organisation_id);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_org ON public.calculation_runs (organisation_id);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_invoice ON public.calculation_runs (invoice_record_id);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_meter ON public.calculation_runs (meter_id);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_tariff ON public.calculation_runs (tariff_version_id);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_parent ON public.calculation_runs (parent_run_id);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_checksum ON public.calculation_runs (reproducibility_checksum);
CREATE INDEX IF NOT EXISTS idx_calculation_line_items_run ON public.calculation_line_items (calculation_run_id);

-- 10. DATABASE INTEGRITY TRIGGER: PREVENT PUBLISHING UNAPPROVED TARIFFS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_tariff_approval_before_publish()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent setting status to 'active' or 'approved' unless approval_status is explicitly 'approved'
    IF (NEW.status = 'active' OR NEW.status = 'approved') AND NEW.approval_status != 'approved' THEN
        RAISE EXCEPTION 'PUBLICATION_GUARD: Cannot activate tariff [% v%] because approval_status is %',
            NEW.tariff_code, NEW.version, NEW.approval_status;
    END IF;

    -- Prevent in-place mutation of locked/immutable historical versions
    IF OLD.is_locked = true AND NEW.is_locked = true AND TG_OP = 'UPDATE' THEN
        IF (OLD.tariff_code != NEW.tariff_code OR OLD.version != NEW.version OR OLD.effective_from != NEW.effective_from) THEN
            RAISE EXCEPTION 'IMMUTABILITY_GUARD: Locked historical tariff [% v%] cannot be mutated in-place. Create a new revision version instead.',
                OLD.tariff_code, OLD.version;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tariff_approval_before_publish ON public.tariff_versions;
CREATE TRIGGER trg_tariff_approval_before_publish
BEFORE INSERT OR UPDATE ON public.tariff_versions
FOR EACH ROW EXECUTE FUNCTION public.check_tariff_approval_before_publish();

-- 11. SECURITY & MULTI-TENANCY ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Enable RLS on all newly added tables
ALTER TABLE public.tariff_applicability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_demand_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_rounding_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_line_items ENABLE ROW LEVEL SECURITY;

-- Tariff Schedules: Central tariffs (organisation_id IS NULL) are readable by all authenticated tenants.
-- Organisation-specific tariffs are strictly isolated.
DROP POLICY IF EXISTS "Tenant isolation policy for tariff_schedules" ON public.tariff_schedules;
CREATE POLICY "Tenant isolation policy for tariff_schedules"
ON public.tariff_schedules
FOR SELECT
TO authenticated
USING (
    organisation_id IS NULL
    OR organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

CREATE POLICY "Admin mutation policy for tariff_schedules"
ON public.tariff_schedules
FOR ALL
TO authenticated
USING (
    (organisation_id IS NOT NULL AND organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    (organisation_id IS NOT NULL AND organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
);

-- Tariff Versions: Central versions readable by all; private versions isolated.
DROP POLICY IF EXISTS "Tenant isolation policy for tariff_versions" ON public.tariff_versions;
CREATE POLICY "Tenant isolation policy for tariff_versions"
ON public.tariff_versions
FOR SELECT
TO authenticated
USING (
    organisation_id IS NULL
    OR organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

CREATE POLICY "Admin mutation policy for tariff_versions"
ON public.tariff_versions
FOR ALL
TO authenticated
USING (
    (organisation_id IS NOT NULL AND organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    (organisation_id IS NOT NULL AND organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
);

-- Calculation Runs: Strict organisation isolation
DROP POLICY IF EXISTS "Tenant isolation policy for calculation_runs" ON public.calculation_runs;
CREATE POLICY "Tenant isolation policy for calculation_runs"
ON public.calculation_runs
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Calculation Line Items: Follows calculation_run parent tenant isolation
DROP POLICY IF EXISTS "Tenant isolation policy for calculation_line_items" ON public.calculation_line_items;
CREATE POLICY "Tenant isolation policy for calculation_line_items"
ON public.calculation_line_items
FOR ALL
TO authenticated
USING (
    calculation_run_id IN (SELECT id FROM public.calculation_runs WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
)
WITH CHECK (
    calculation_run_id IN (SELECT id FROM public.calculation_runs WHERE organisation_id = public.auth_user_organisation_id())
    OR public.is_super_admin()
);

-- Tariff Import Runs: Isolated to tenant
DROP POLICY IF EXISTS "Tenant isolation policy for tariff_import_runs" ON public.tariff_import_runs;
CREATE POLICY "Tenant isolation policy for tariff_import_runs"
ON public.tariff_import_runs
FOR ALL
TO authenticated
USING (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
)
WITH CHECK (
    organisation_id = public.auth_user_organisation_id()
    OR public.is_super_admin()
);

-- Tariff Validation Results & Approval History: Visible to tenant of tariff or if central
DROP POLICY IF EXISTS "Read policy for tariff_validation_results" ON public.tariff_validation_results;
CREATE POLICY "Read policy for tariff_validation_results"
ON public.tariff_validation_results
FOR SELECT
TO authenticated
USING (
    tariff_version_id IN (
        SELECT id FROM public.tariff_versions
        WHERE organisation_id IS NULL OR organisation_id = public.auth_user_organisation_id()
    )
    OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Read policy for tariff_approval_history" ON public.tariff_approval_history;
CREATE POLICY "Read policy for tariff_approval_history"
ON public.tariff_approval_history
FOR SELECT
TO authenticated
USING (
    tariff_version_id IN (
        SELECT id FROM public.tariff_versions
        WHERE organisation_id IS NULL OR organisation_id = public.auth_user_organisation_id()
    )
    OR public.is_super_admin()
);

-- 12. REVOKE ANONYMOUS ACCESS ON NEW TABLES
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.tariff_applicability_rules FROM anon;
REVOKE ALL ON public.tariff_demand_bands FROM anon;
REVOKE ALL ON public.tariff_tax_rules FROM anon;
REVOKE ALL ON public.tariff_rounding_rules FROM anon;
REVOKE ALL ON public.tariff_validation_results FROM anon;
REVOKE ALL ON public.tariff_approval_history FROM anon;
REVOKE ALL ON public.tariff_import_runs FROM anon;
REVOKE ALL ON public.calculation_runs FROM anon;
REVOKE ALL ON public.calculation_line_items FROM anon;
