-- Eskom Management Platform Schema & Seeding Migration
-- Target Supabase Project: bramhseicmakyihvnvpo

-- 1. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    meter_number TEXT NOT NULL,
    address TEXT,
    nmd NUMERIC DEFAULT 90000,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    premise_id TEXT,
    tariff_name TEXT,
    billing_period TEXT,
    billing_start DATE,
    billing_end DATE,
    peak_kwh NUMERIC DEFAULT 0,
    standard_kwh NUMERIC DEFAULT 0,
    off_peak_kwh NUMERIC DEFAULT 0,
    total_kwh NUMERIC DEFAULT 0,
    max_demand_kva NUMERIC DEFAULT 0,
    invoiced_total NUMERIC DEFAULT 0,
    reconciled_total NUMERIC DEFAULT 0,
    variance_amount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Processed',
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Overcharge Recoveries Register Table
CREATE TABLE IF NOT EXISTS public.overcharge_recoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_name TEXT NOT NULL,
    dates TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    supply_location TEXT NOT NULL,
    premise_id TEXT NOT NULL,
    charge_category TEXT NOT NULL,
    invoiced_amount NUMERIC NOT NULL,
    calculated_amount NUMERIC NOT NULL,
    recovery_amount NUMERIC NOT NULL,
    root_cause TEXT NOT NULL,
    detailed_explanation TEXT NOT NULL,
    audit_formula TEXT NOT NULL,
    tariff_ref TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'ready')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Reconciliation Line Items Table
CREATE TABLE IF NOT EXISTS public.reconciliation_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    charge_label TEXT NOT NULL,
    basis TEXT,
    rate NUMERIC DEFAULT 0,
    quantity NUMERIC DEFAULT 0,
    calculated_amount NUMERIC DEFAULT 0,
    invoiced_amount NUMERIC DEFAULT 0,
    variance_amount NUMERIC DEFAULT 0,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Meter Readings Table
CREATE TABLE IF NOT EXISTS public.meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT REFERENCES public.invoices(invoice_number) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    kw NUMERIC DEFAULT 0,
    kvar NUMERIC DEFAULT 0,
    kva NUMERIC DEFAULT 0,
    power_factor NUMERIC DEFAULT 0.96,
    tou TEXT CHECK (tou IN ('peak', 'standard', 'offPeak')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. RLS Security Policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overcharge_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Public Manage Customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read Invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Public Manage Invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read Overcharge Recoveries" ON public.overcharge_recoveries FOR SELECT USING (true);
CREATE POLICY "Public Manage Overcharge Recoveries" ON public.overcharge_recoveries FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read Reconciliation Items" ON public.reconciliation_line_items FOR SELECT USING (true);
CREATE POLICY "Public Manage Reconciliation Items" ON public.reconciliation_line_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public Read Meter Readings" ON public.meter_readings FOR SELECT USING (true);
CREATE POLICY "Public Manage Meter Readings" ON public.meter_readings FOR ALL USING (true) WITH CHECK (true);
