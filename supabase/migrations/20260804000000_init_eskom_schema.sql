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

-- 7. Seed Customer Profile
INSERT INTO public.customers (account_number, customer_name, meter_number, address, nmd)
VALUES ('7856504676', 'Impala Plats Rustenburg Mine', '7856504226', 'Mineral Processes, Beerfontein Farm, Phokeng, PO Box 2634, Rustenburg 0300', 90000)
ON CONFLICT (account_number) DO UPDATE SET customer_name = EXCLUDED.customer_name;

-- 8. Seed 4 Billing Period Invoices
INSERT INTO public.invoices (
    account_number, invoice_number, customer_name, premise_id, tariff_name, billing_period,
    billing_start, billing_end, peak_kwh, standard_kwh, off_peak_kwh, total_kwh, max_demand_kva,
    invoiced_total, reconciled_total, variance_amount, status
) VALUES 
('7856504676', '785101497007', 'Impala Plats Rustenburg Mine', '7856504226', 'Megaflex Non-Local Authority', '17/01/2026 - 16/02/2026', '2026-01-17', '2026-02-16', 6401924, 19531348, 23429968, 49363240, 85740, 97009239.11, 96130404.11, 878835.00, 'Reconciled'),
('7856504676', '7856504676', 'Impala Plats Rustenburg Mine', '7856504226', 'Megaflex Non-Local Authority', '17/02/2026 - 18/03/2026', '2026-02-17', '2026-03-18', 7030857.6, 20198604.0, 22018599.6, 49248061.2, 92948.29, 98380358.13, 97778993.13, 601365.00, 'Reconciled'),
('7856504676', '785684906677', 'Impala Plats Rustenburg Mine', '7856504226', 'Megaflex Non-Local Authority', '19/03/2026 - 16/04/2026', '2026-03-19', '2026-04-16', 5691297, 17769178, 21416490, 44876965, 87034.19, 91251855.72, 90631405.32, 620450.40, 'Under Dispute'),
('7856504676', '785595072130', 'Impala Plats Rustenburg Mine', '7856504226', 'Megaflex Non-Local Authority', '17/04/2026 - 16/05/2026', '2026-04-17', '2026-05-16', 5484841, 17717457, 22564586, 45766884, 87034.19, 97169250.00, 96851250.00, 318000.00, 'Ready to File')
ON CONFLICT (invoice_number) DO UPDATE SET
    invoiced_total = EXCLUDED.invoiced_total,
    reconciled_total = EXCLUDED.reconciled_total,
    variance_amount = EXCLUDED.variance_amount;

-- 9. Seed 4 Overcharge Recovery Register Claims
INSERT INTO public.overcharge_recoveries (
    period_name, dates, invoice_no, supply_location, premise_id, charge_category,
    invoiced_amount, calculated_amount, recovery_amount, root_cause, detailed_explanation,
    audit_formula, tariff_ref, status
) VALUES 
('Feb 2026', '17/01/2026 - 16/02/2026', '785101497007', 'Millennium 33kV - Farm Goedgedacht 114JQ', '7856504226', 'TX Network Capacity Rate Overcharge', 878835.00, 0.00, 878835.00, 'Unnotified Transmission Rate Escalation without required 30-day NERSA Gazette notice.', 'Eskom billed a standalone Transmission Network Capacity charge of R 878,835.00 (85,740 kVA @ R10.25/kVA) without gazetted NERSA tariff approval for the 33kV Megaflex Diversity category. Under NERSA Rule 4.2, transmission costs are already embedded in the distribution network capacity rate for this voltage level. Full credit refund claimed and credited.', 'Invoiced (85,740 kVA @ R10.25) R 878,835.00 - Contract Rate (Embedded R 0.00) = Recoverable Credit R 878,835.00', 'NERSA Megaflex Diversity 33kV Schedule Sec 4.2 & NERSA Tariff Gazette 2025', 'approved'),
('March 2026', '17/02/2026 - 18/03/2026', '7856504676', 'Millennium 33kV - Farm Goedgedacht 114JQ', '7856504226', 'Peak Demand Ratchet Reversal', 2246559.07, 1645194.07, 601365.00, 'Simultaneous Maximum Demand reading misapplied during emergency load reduction window.', 'During the curtailment event on 2026/03/04 at 12:00, Eskom billed maximum demand based on a spike reading of 92,948.29 kVA instead of adjusting for the mandatory 10% load curtailment order issued by Eskom System Operator. Reconciled demand cap is 87,034.19 kVA. Eskom approved the demand ratchet correction.', 'Invoiced (92,948.29 kVA @ R24.17) R 2,246,559.07 - Reconciled (87,034.19 kVA @ R24.17) R 1,645,194.07 = Recovery Credit R 601,365.00', 'NERSA Megaflex Schedule 2025/26 - Emergency Load Curtailment Rule 7.1', 'approved'),
('April 2026', '19/03/2026 - 16/04/2026', '785684906677', 'Millennium 33kV - Farm Goedgedacht 114JQ', '7856504226', 'Mid-Month Tariff Adjustment Variance', 3233935.40, 2613485.00, 620450.40, 'Sub-period day weighting error (13d vs 16d) applied to Network Capacity base rate.', 'Eskom split the April 2026 billing period into 13 days (R35.98/kVA) and 16 days (R39.13/kVA) due to mid-month rate adjustments. However, Eskom applied the new higher rate to 100% of the notified maximum demand for 20 days instead of 16 days, creating an overcharge of R 620,450.40 currently under formal dispute.', 'Invoiced (13d @ R35.98 + 16d @ R39.13 miscalculated) R 3,233,935.40 - Reconciled Weighting R 2,613,485.00 = Recovery Claim R 620,450.40', 'Eskom Megaflex Mid-Year Rate Adjustment & Pro-Rata Weighting Rule 3.4', 'pending'),
('May 2026', '17/04/2026 - 16/05/2026', '785595072130', 'Millennium 33kV - Farm Goedgedacht 114JQ', '7856504226', 'Ancillary & Legacy Subsidy Overcharge', 11240346.71, 10922346.71, 318000.00, 'Electrification Subsidy rate applied to gross consumption before renewable wheeling offsets.', 'The Electrification and Rural Subsidy (R0.0537/kWh) was calculated on gross grid intake (45,766,884 kWh) without netting off the 5,921,787 kWh clean solar wheeling energy generated under the Impala Renewable PPA. Under Eskom Wheeling Guideline 2026, subsidies apply only to net grid import.', 'Invoiced Gross Subsidy (45,766,884 kWh @ R0.0537) R 2,457,681.67 - Net Import (39,845,097 kWh @ R0.0537) R 2,139,681.67 = Recovery Claim R 318,000.00', 'Eskom Schedule of Standard Prices 2026 & Renewable Wheeling Grid Code', 'ready');
