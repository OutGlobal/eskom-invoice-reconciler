-- ENERA Trading Intelligence: additive foundation only; do not modify existing ENERA tables.
-- Apply after reviewing current Supabase organization/authorization model.
create schema if not exists trading;
create table if not exists trading.organizations (
 id uuid primary key default gen_random_uuid(), name text not null, role text not null check(role in ('trader','generator','customer','network_operator')), created_at timestamptz not null default now()
);
create table if not exists trading.meters (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references trading.organizations(id),
 external_meter_id text not null, direction text not null check(direction in ('generation','consumption','bidirectional')),
 timezone text not null default 'Africa/Johannesburg', unique(organization_id,external_meter_id)
);
create table if not exists trading.contracts (
 id uuid primary key default gen_random_uuid(), trader_id uuid not null references trading.organizations(id),
 counterparty_id uuid not null references trading.organizations(id),
 contract_type text not null check(contract_type in ('ppa','offtake','network')),
 starts_on date not null, ends_on date, currency char(3) not null default 'ZAR',
 terms jsonb not null default '{}'::jsonb, status text not null default 'draft',
 check(ends_on is null or ends_on >= starts_on)
);
create table if not exists trading.meter_intervals (
 id uuid primary key default gen_random_uuid(), meter_id uuid not null references trading.meters(id),
 interval_start timestamptz not null, interval_minutes integer not null check(interval_minutes in (5,15,30,60)),
 energy_kwh numeric(20,6) not null check(energy_kwh>=0),
 quality text not null default 'unverified', source_document_id uuid, ingested_at timestamptz not null default now(),
 unique(meter_id,interval_start,interval_minutes)
);
create table if not exists trading.settlement_runs (
 id uuid primary key default gen_random_uuid(), trader_id uuid not null references trading.organizations(id),
 period_start timestamptz not null, period_end timestamptz not null,
 status text not null default 'draft' check(status in ('draft','review','approved','void')),
 rule_version text not null, input_snapshot jsonb not null, created_at timestamptz not null default now(),
 check(period_end > period_start)
);
create table if not exists trading.settlement_lines (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references trading.settlement_runs(id),
 contract_id uuid references trading.contracts(id), meter_interval_id uuid references trading.meter_intervals(id),
 line_type text not null, energy_kwh numeric(20,6) not null default 0,
 amount_zar numeric(20,4) not null, calculation_trace jsonb not null default '{}'::jsonb
);
create table if not exists trading.payment_records (
 id uuid primary key default gen_random_uuid(), settlement_run_id uuid not null references trading.settlement_runs(id),
 counterparty_id uuid not null references trading.organizations(id), amount_zar numeric(20,4) not null,
 payment_reference text, paid_at timestamptz, status text not null default 'pending'
);
-- SECURITY: no API grants or tenant policies until the application's authorization model is reviewed.
alter table trading.organizations enable row level security;
alter table trading.meters enable row level security;
alter table trading.contracts enable row level security;
alter table trading.meter_intervals enable row level security;
alter table trading.settlement_runs enable row level security;
alter table trading.settlement_lines enable row level security;
alter table trading.payment_records enable row level security;
revoke all on schema trading from public, anon, authenticated;
revoke all on all tables in schema trading from public, anon, authenticated;
