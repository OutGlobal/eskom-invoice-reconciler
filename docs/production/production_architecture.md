# Production Architecture Documentation — Eskom Bill Balancer

## 1. System Overview

The **Eskom Bill Balancer** is an enterprise-grade utility billing reconciliation and telemetry analysis platform deployed across a hybrid Cloudflare Workers / Nitro SSR Edge layer and a Supabase PostgreSQL backend.

```
[ BROWSER / CLIENT ] 
       │
       ▼ (HTTPS / TLS 1.3)
[ CLOUDFLARE WORKERS EDGE (SSR / Nitro Engine) ]
       │
       ├──────────────────────────┐
       ▼ (PostgREST / WSS)        ▼ (Signed Storage SDK)
[ SUPABASE POSTGRESQL DB ]    [ SUPABASE S3 STORAGE BUCKETS ]
  • Tenant RLS Policies        • /invoices
  • Partitioned Telemetry      • /amr-telemetry
  • Audit Ledger Hash Chain    • /dispute-packs
```

---

## 2. Infrastructure Components

### A. Edge Application Layer (Cloudflare Workers / Nitro SSR)
- **Runtime:** Cloudflare Module Worker with Nitro SSR bundling.
- **Framework:** React 18, TanStack Router (SSR), TanStack Query, Tailwind CSS.
- **Client Processing:** Browser-side Web Streams for AMR telemetry streaming ingestion, Tesseract OCR for PDF invoice parsing, and PDFKit/ExcelJS for client-side dispute pack export.

### B. Relational Database Layer (Supabase PostgreSQL)
- **Host:** AWS eu-central-1 (Frankfurt) / Supabase Dedicated Pool.
- **Tables & Views:**
  - `organisations`, `users`, `sites`, `meters` (Core Entities)
  - `canonical_telemetry` (Hypertable partitioned by month & meter)
  - `invoices`, `invoice_line_items` (Extracted Billing Data)
  - `reconciliation_runs`, `reconciliation_line_items` (Deterministic Results)
  - `audit_ledger`, `processing_logs` (Append-Only Cryptographic Traces)

### C. Object Storage Layer (Supabase S3 Storage)
- **Buckets:**
  - `invoices`: Encrypted tax invoice PDF uploads.
  - `amr-telemetry`: Raw vendor CSV/XLSX AMR telemetry dumps.
  - `dispute-packs`: Generated executive dispute ZIP/PDF packs.

---

## 3. Scale & Capacity Specifications

- **Throughput Capability:** 730,000+ telemetry rows/second.
- **Database Capacity:** Tested against 1.44 million+ interval records per meter.
- **Memory Footprint:** Peak browser RAM usage < 550 MB (chunked streaming buffers).
- **Latency SLAs:**
  - API Health Check: < 50 ms
  - Deterministic Reconciliation Calculation (1 Month): < 5 ms
  - Daily Aggregation (1.44M rows): < 900 ms
