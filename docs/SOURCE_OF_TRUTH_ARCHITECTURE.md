# ENERA Source of Truth Architecture Standard

> **Engineering Standard & Architectural Rule**  
> **Effective Stage**: Stage 39 / Production  
> **Core Invariant**: The frontend must never be the permanent source of business data.

---

## 1. The Four Pillars of Truth

```text
┌─────────────────────────────────────────────────────────────┐
│              1. DATABASE (PostgreSQL / Supabase)            │
│             >>> BUSINESS DATA SOURCE OF TRUTH <<<           │
│  • organisations, customers, sites, meters, meter_channels  │
│  • invoice_records, invoice_line_items, invoice_determinants │
│  • telemetry_intervals (partitioned time-series), quality   │
│  • reconciliation_runs, reconciliation_results, discrepancies│
│  • audit_events_ledger (cryptographic hash chain)           │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│           2. OBJECT STORAGE (Supabase Storage Bucket)       │
│             >>> ORIGINAL SOURCE FILES REPOSITORY <<<        │
│  • Bucket: 'source_files' (Private, 50 MiB limit)           │
│  • Path: tenants/{org_id}/uploads/{upload_id}/{filename}    │
│  • Raw byte streams: PDFs, CSVs, XLSXs, XMLs                │
│  • Access: Signed, time-bounded (15 min) download tokens    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│            3. BACKEND PROCESSING (Node / Edge Engines)       │
│                >>> DATA TRANSFORMATION ENGINES <<<          │
│  • Asynchronous execution: ProcessingJobEngine              │
│  • PDF layout analysis & determinants extraction            │
│  • AMR interval unit normalization (kW * 0.5h -> kWh)       │
│  • Deterministic NERSA gazetted tariff calculations         │
│  • Tolerance & discrepancy classification                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                 4. FRONTEND (React / SSR UI)                │
│                   >>> PRESENTATION LAYER <<<                │
│  • Ephemeral presentation & user interaction only           │
│  • Queries database via typed domain services               │
│  • Subscribes to real-time events via RealtimeRefreshManager│
│  • Deterministic fallback: Zero / Authentic Empty State     │
│  • ZERO permanent business data in client memory            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Definitive Layer Responsibilities

### Pillar 1: DATABASE = BUSINESS DATA SOURCE OF TRUTH
- All authoritative business records exist in the relational database schema.
- Every invoice, charge breakdown, interval reading, reconciliation run, discrepancy, site, customer, and meter is persisted with strict foreign-key integrity and Row-Level Security (RLS).
- **Rule**: If a business record does not exist in the database, the system must evaluate to zero or present an authentic empty state. Fabricating in-memory synthetic numbers is strictly forbidden.

### Pillar 2: OBJECT STORAGE = ORIGINAL SOURCE FILES
- All original documents uploaded by clients (Eskom tax invoices, AMR vendor telemetry extracts, dispute dossiers) are stored in the private object storage bucket `source_files`.
- Storage paths are strictly tenant-isolated:
  `tenants/{organisation_id}/uploads/{upload_id}/{sanitized_filename}`
- Original files are never stored inside React state, `localStorage`, `sessionStorage`, or embedded as base64 text in database rows.
- File access is strictly mediated through signed, short-lived (15-minute) tokens verified by HMAC signatures.

### Pillar 3: BACKEND PROCESSING = DATA TRANSFORMATION
- All parsing, OCR extraction, interval normalization, tariff calendar matching, determinant comparisons, discrepancy classifications, and cryptographic checksums are executed by backend processing services.
- Background jobs run asynchronously through [`ProcessingJobEngine`](file:///Users/admin/Desktop/Eskom%20Bill%20Balancer/src/domain/jobs/processingJobEngine.ts) with persistent database tracking in `ingestion_jobs` and `reconciliation_runs`.
- Transformation logic is deterministic, arbitrary-precision (using `Decimal`), and reproducible.

### Pillar 4: FRONTEND = PRESENTATION
- The frontend UI (TanStack Router, React components, Zustand store) is strictly a presentation and interaction medium.
- It displays data fetched from the database via typed aggregation services ([`DashboardService`](file:///Users/admin/Desktop/Eskom%20Bill%20Balancer/src/domain/dashboard/dashboardService.ts), [`InvoiceStorageService`](file:///Users/admin/Desktop/Eskom%20Bill%20Balancer/src/domain/invoice/invoiceStorageService.ts), [`TelemetryStorageService`](file:///Users/admin/Desktop/Eskom%20Bill%20Balancer/src/domain/telemetry/telemetryStorageService.ts), [`ReconciliationStorageService`](file:///Users/admin/Desktop/Eskom%20Bill%20Balancer/src/domain/reconciliation/reconciliationStorageService.ts)).
- When database records update, the frontend updates reactively via [`RealtimeRefreshManager`](file:///Users/admin/Desktop/Eskom%20Bill%20Balancer/src/domain/realtime/realtimeRefreshManager.ts).
- The frontend is **never** the permanent source of business data.

---

## 3. Strictly Prohibited Architectural Anti-Patterns

The following patterns are strictly prohibited in the ENERA platform:

| Prohibited Location | Why It Is Forbidden | Authoritative Replacement |
| :--- | :--- | :--- |
| **React State (`useState`, `useReducer`)** | Volatile; destroyed on reload, navigation, or crash. | Persisted database tables (`invoice_records`, `telemetry_intervals`, `reconciliation_runs`). |
| **`localStorage`** | Vulnerable to XSS, unencrypted, browser-specific, non-isolated across multi-tenant sessions. | Supabase PostgreSQL with tenant RLS. |
| **`sessionStorage`** | Lost on tab closure; unshared across windows; client-side only. | Database sessions and secure signed auth tokens. |
| **Hard-coded arrays in routes** | Produces synthetic, non-reconciled mock figures that bypass auditability. | Live database queries with authentic empty states (`EmptyState`). |
| **Static JSON files** | Stale, unverified against physical meter reads or gazetted NERSA rates. | Authoritative database versioning (`tariff_versions`, `tariff_rates`). |
| **Browser Memory (Heap variables)** | Causes data loss when user signs out, closes tab, or refreshes. | Full database persistence; data survives refresh, logout, and re-login. |

---

## 4. Verification Standard

Every feature, ingestion pipeline, and reconciliation workflow must pass the **11-Step Data Persistence Verification Lifecycle**:
1. **Upload**: Files and metadata are received and written to Object Storage and Database.
2. **Close Browser**: Complete destruction of browser memory / ephemeral state simulator.
3. **Reopen Application**: Boot client with zero lingering heap variables.
4. **Sign In**: Authenticate energy manager or auditor security context.
5. **Data Still Exists**: Query all tenant invoices, intervals, and runs directly from the database.
6. **Refresh Page**: Trigger browser reload (F5 equivalent).
7. **Data Still Exists**: Confirm all KPI totals and line items remain 100% intact.
8. **Sign Out**: Invalidate security token and destroy session memory.
9. **Sign In Again**: Re-authenticate credentials.
10. **Data Still Exists**: Confirm all business figures are identically retrieved.
11. **Zero Browser Memory Dependency**: Prove that clearing memory store produces zero data loss.
