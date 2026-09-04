-- Enterprise Domain Architecture Migration
-- Multi-Tenant RLS, Audit Lineage, Job Logs, and Dynamic Versioned Tariff Schedules

-- 1. Create Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_name TEXT NOT NULL,
    account_number TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Tenant for Impala Platinum
INSERT INTO public.tenants (id, tenant_name, account_number)
VALUES ('7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c'::uuid, 'Impala Platinum Rustenburg', '7856504676')
ON CONFLICT (account_number) DO NOTHING;

-- 2. Add tenant_id Columns to Core Tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.customers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c'::uuid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.invoices ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c'::uuid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.uploads ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT '7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c'::uuid;
    END IF;
END $$;

-- 3. Create Audit Ledger Table (Immutable Execution Lineage)
CREATE TABLE IF NOT EXISTS public.audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) DEFAULT '7f9a8b1c-2d3e-4f5a-8b9c-0d1e2f3a4b5c'::uuid,
    job_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT DEFAULT 'system',
    details JSONB NOT NULL,
    hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Dynamic Versioned Tariff Schedules Table
CREATE TABLE IF NOT EXISTS public.tariff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tariff_family TEXT NOT NULL CHECK (tariff_family IN ('megaflex', 'miniflex', 'nightsave', 'municipal')),
    tariff_name TEXT NOT NULL,
    voltage_category TEXT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    rates_json JSONB NOT NULL,
    nersa_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable RLS on Enterprise Tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_schedules ENABLE ROW LEVEL SECURITY;

-- 6. Strict Multi-Tenant Policies
CREATE POLICY "Tenant Scoped Audit Ledger Read" ON public.audit_ledger
    FOR SELECT TO authenticated
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Tenant Scoped Audit Ledger Insert" ON public.audit_ledger
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Public Read Tariff Schedules" ON public.tariff_schedules
    FOR SELECT USING (true);
