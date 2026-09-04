# Database Migration & Deployment Guide

## 1. Migration Execution Principles

1. **Zero-Downtime Schema Evolution:** All database DDL changes MUST be additive (e.g. `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`). Never run destructive `DROP COLUMN` or `DROP TABLE` commands on production databases.
2. **Transaction Safety:** Every migration SQL file is wrapped in an explicit `BEGIN; ... COMMIT;` block.
3. **RLS Enforcement:** Every newly created table must immediately include `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` and an organization isolation policy.

---

## 2. Migration Execution Steps

### Step 1: Verify Supabase Database Connectivity
```bash
npx supabase db remote commit --project-ref bramhseicmakyihvnvpo
```

### Step 2: Apply SQL Migrations in Order
Execute the migration scripts located in `supabase/migrations/`:

```bash
# 1. Core Schema Migration
npx supabase db push --project-ref bramhseicmakyihvnvpo
```

Or apply raw SQL scripts manually via Supabase SQL Editor:
1. `supabase/migrations/20260904000000_enterprise_core_schema.sql`
2. `supabase/migrations/20260904020000_enterprise_ingestion_pipeline.sql`
3. `security/lockdown-rls-authenticated-only.sql`

### Step 3: Verify Migration Integrity
Run the schema verification test suite:
```bash
npx tsx src/lib/__tests__/database_schema_integration.test.ts
```
Expected output: `30 / 30 Domain Query Assertions Passed`.
