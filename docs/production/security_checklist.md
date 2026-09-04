# Production Security & Compliance Checklist

## 1. Authentication & Tenant Authorization

- [x] **Row Level Security (RLS):** Enabled on all Supabase tables (`organisations`, `meters`, `canonical_telemetry`, `invoices`, `reconciliation_runs`).
- [x] **Service Role Key Isolation:** `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side workers and build environments. Never bundled into browser assets.
- [x] **RBAC Roles:** Enforced roles: `SUPER_ADMIN`, `ORG_ADMIN`, `ENERGY_MANAGER`, `ANALYST`, `AUDITOR`, `REVIEWER`, `READ_ONLY`.

---

## 2. Injection & Storage Security

- [x] **CSV Formula Injection:** Pre-filters `=`, `+`, `-`, `@` characters prior to exporting CSV reports.
- [x] **SQL Injection:** 100% parameterized SQL via PostgREST and Supabase Client SDK.
- [x] **XSS & Content Security Policy (CSP):** Strict HTML escaping and CSP headers on Cloudflare Worker response headers.
- [x] **Rate Limiting:** Enforces max 120 requests/minute per client IP.
- [x] **Storage Policy Boundaries:** Storage buckets (`invoices`, `amr-telemetry`, `dispute-packs`) enforce signed-URL authentication and tenant ownership.
