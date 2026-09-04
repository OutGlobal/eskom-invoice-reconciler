# Emergency Rollback Standard Operating Procedure (SOP)

## 1. Rollback Trigger Criteria

A rollback MUST be initiated if any of the following occur post-deployment:
- P0 billing discrepancy error affecting live reconciliation values.
- Edge worker HTTP 5xx error rate > 0.5% over 5 minutes.
- Unhandled data corruption during telemetry ingestion.
- Critical security breach or RLS policy leak.

---

## 2. Step-by-Step Rollback Execution

### Step 1: Revert Cloudflare Edge Worker Release
Roll back to the previous stable worker release version via Wrangler CLI:

```bash
npx wrangler rollback --env production
```
Or redeploy the previous git release commit:
```bash
git checkout v2.0.9-stable
npm run build
npx wrangler deploy --env production
```

### Step 2: Database Schema & Migration Rollback
If a database migration introduced an incompatible column or view:
1. Do **NOT** drop tables or columns containing production data.
2. Apply the corresponding idempotent rollback script:
   ```sql
   BEGIN;
   -- Revert non-breaking views or triggers
   CREATE OR REPLACE VIEW v_active_reconciliations AS ...;
   COMMIT;
   ```

### Step 3: Flush Edge CDN Cache
Purge Cloudflare Edge cache for static assets:
```bash
npx wrangler cache purge --all
```

### Step 4: Verify Post-Rollback Health
Run the production smoke test suite to confirm operational stability:
```bash
npx tsx src/lib/__tests__/production_smoke_test.test.ts
```
