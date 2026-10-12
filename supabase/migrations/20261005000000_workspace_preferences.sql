-- Apply before enabling the reporting-preferences UI. Identity must be provisioned
-- in auth.users.raw_app_meta_data by a trusted administrator, never user_metadata.
create table if not exists public.workspace_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id text not null,
  company_name text not null check (length(trim(company_name)) between 1 and 200),
  currency text not null check (length(trim(currency)) between 1 and 32),
  vat_rate numeric(5,2) not null check (vat_rate between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, organisation_id)
);
alter table public.workspace_preferences enable row level security;
revoke all on public.workspace_preferences from anon;
grant select, insert, update, delete on public.workspace_preferences to authenticated;
create policy workspace_preferences_owner on public.workspace_preferences
  for all to authenticated
  using (user_id = auth.uid() and organisation_id = auth.jwt()->'app_metadata'->>'organisation_id')
  with check (user_id = auth.uid() and organisation_id = auth.jwt()->'app_metadata'->>'organisation_id');
