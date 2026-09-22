# Phase 3 — Entity Data Map

> **Principle**: Every entity listed here is grounded in physical migration SQL.
> No entity is invented. Where a required entity is missing, the gap is documented.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Exists — physical table |
| 🗂 | Exists — canonical view over physical table |
| ⚠️ | Partially exists — needs column or FK addition |
| ❌ | Does not exist — required, documented below |

---

## 1. Organisation ✅

| Field | Value |
|---|---|
| **Entity** | Organisation |
| **Table** | `public.organisations` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | — (root anchor, no parent) |
| **Organisation Isolation** | Self-referential — IS the tenant anchor |
| **Source** | Admin provisioning / Supabase seed |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |

**Key columns**: `code TEXT UNIQUE`, `name`, `vat_number`, `registration_number`

**Notes**: Root multi-tenancy anchor. Every other entity eventually traces its `organisation_id` back here. Seeded with `IMPALA_PLAT`.

---

## 2. User ✅

| Field | Value |
|---|---|
| **Entity** | User |
| **Table** | `public.users` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `organisation_id → public.organisations(id)` |
| **Organisation Isolation** | Via `organisation_id` |
| **Source** | Supabase Auth sync / admin provisioning |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |

**Key columns**: `email TEXT UNIQUE`, `full_name`, `is_active`

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.roles` | RBAC role definitions per org (`organisation_id`, `role_name`) |
| `public.permissions` | Fine-grained permission keys per role |
| `public.user_roles` | Many-to-many junction — user ↔ role assignments |

---

## 3. Site ✅

| Field | Value |
|---|---|
| **Entity** | Site |
| **Table** | `public.sites` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `customer_id → public.customers(id)` |
| **Organisation Isolation** | Via `customers.organisation_id` (transitive) |
| **Source** | Admin setup / account onboarding |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |

**Key columns**: `site_code TEXT`, `site_name`, `premise_id`, `address`, `supply_voltage_kv`, `supply_zone`

> ⚠️ **Gap**: Organisation isolation is transitive (via `customers`). A direct `organisation_id` on `sites` would make RLS simpler and more resilient.

**Supporting table**:

| Table | Purpose |
|---|---|
| `public.points_of_delivery` | Official grid POD linked to a site |

---

## 4. Meter ✅

| Field | Value |
|---|---|
| **Entity** | Meter |
| **Table** | `public.meters` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `site_id → public.sites(id)`, `pod_id → public.points_of_delivery(id)` |
| **Organisation Isolation** | Via `sites → customers → organisations` (transitive) |
| **Source** | Admin setup / metering engineer entry |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |

**Key columns**: `meter_number TEXT UNIQUE`, `meter_type` (`AMR_INTERVAL` / `CUMULATIVE_DIAL` / `SMART_SUBMETER`), `is_amr`, `installation_date`, `ct_ratio`, `vt_ratio`, `overall_multiplier`, `serial_number`, `manufacturer`, `model`, `status` (`ACTIVE` / `INACTIVE` / `DECOMMISSIONED` / `SUSPENDED`), `communication_source` (`AMR_API` / `MODBUS` / `DLMS_COSEM` / `CSV_UPLOAD` / `MANUAL_ENTRY`)

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.meter_channels` | Telemetry channels per meter (`kWh`, `kVARh`, `kVA`, `kW`, `PowerFactor`) |
| `public.meter_configurations` | Versioned CT/VT ratio and multiplier history per meter |

---

## 5. Account ✅ (View + Physical Table)

| Field | Value |
|---|---|
| **Entity** | Account (Billing Customer) |
| **Physical Table** | `public.customers` |
| **Canonical View** | `public.accounts` |
| **Primary Key** | `id UUID` (as `account_id` in view) |
| **Foreign Keys** | `organisation_id → public.organisations(id)` |
| **Organisation Isolation** | Via `organisation_id` |
| **Source** | Invoice extraction / admin setup |
| **`created_at`** | ✅ `TIMESTAMPTZ DEFAULT now()` |
| **`updated_at`** | ❌ Missing on `public.customers` |

**Key columns**: `account_number TEXT UNIQUE`, `customer_name` / `name`, `meter_number`, `address`, `nmd` / `nmd_kva`, `premise_id`, `supply_voltage_kv`

**Canonical view** (`public.accounts`) joins `customers ← organisations` to expose `organisation_name` and `organisation_code`.

> ⚠️ **Gap**: `public.customers` is missing `updated_at`. Needs migration.

---

## 6. Invoice ✅

| Field | Value |
|---|---|
| **Entity** | Invoice |
| **Physical Table** | `public.invoice_records` (canonical, enterprise) |
| **Legacy Table** | `public.invoices` (initial seed — preserved for backward compat) |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `customer_id → customers(id)`, `site_id → sites(id)`, `meter_id → meters(id)`, `source_file_id → source_files(id)`, `upload_id → uploads(id)` |
| **Organisation Isolation** | `organisation_id UUID` direct column |
| **Source** | PDF OCR extraction via `SecureIngestionGateway` |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |

**Key columns**: `invoice_number TEXT UNIQUE`, `account_number`, `billing_period_name`, `billing_start DATE`, `billing_end DATE`, `total_kwh`, `peak_kwh`, `standard_kwh`, `off_peak_kwh`, `max_demand_kva`, `invoiced_total`, `reconciled_total`, `variance_amount`, `status` (`draft` / `ingested` / `validated` / `reconciled` / `under_dispute` / `resolved`), `raw_data JSONB`

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.invoice_line_items` | Unbundled individual charge lines from physical invoices |
| `public.invoice_determinants` | Extracted peak demand timestamps, active energy totals, and loss factors |
| `public.overcharge_recoveries` | Formal overcharge recovery register with audit formulas |

---

## 7. Upload ✅

| Field | Value |
|---|---|
| **Entity** | Upload |
| **Table** | `public.uploads` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `organisation_id → organisations(id)`, `user_id → users(id)` |
| **Organisation Isolation** | `organisation_id UUID NOT NULL` — enforced by RLS + FORCE RLS |
| **Source** | File upload via `SecureIngestionGateway.processUpload()` |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` (trigger-maintained) |

**Key columns**: `filename`, `file_type`, `file_size_bytes`, `file_hash_sha256`, `storage_location`, `processing_status` (`UPLOADED` / `VALIDATING` / `VALIDATED` / `PROCESSING` / `PROCESSED` / `FAILED` / `PARTIALLY_PROCESSED`), `validation_status`, `error_status`, `error_message`, `row_count`, `record_count`, `metadata JSONB`

**Storage path format**: `tenants/{organisation_id}/uploads/{upload_id}/{sanitized_filename}`

**Object storage bucket**: `source_files` (private, 50 MiB limit, tenant-path-isolated RLS)

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.source_files` | Cryptographic catalog of raw binary objects in storage bucket |
| `public.file_versions` | Version history for re-uploaded or corrected files |
| `public.upload_pipeline_view` | Canonical view of upload + ingestion status |

---

## 8. Meter Data (Telemetry) ✅

| Field | Value |
|---|---|
| **Entity** | Meter Data / Interval Telemetry |
| **Physical Table** | `public.telemetry_intervals` (partitioned by year) |
| **Legacy Table** | `public.meter_readings` (initial migration — linked by `invoice_number`) |
| **Canonical View** | `public.interval_data` |
| **Primary Key** | `(timestamp_utc, id)` — composite, partition-aware |
| **Foreign Keys** | `meter_id → meters(id)`, `channel_id → meter_channels(id)`, `source_file_id → source_files(id)`, `upload_id → uploads(id)` |
| **Organisation Isolation** | Via `meter_id → sites → customers → organisations` |
| **Source** | AMR CSV ingestion via `SecureIngestionGateway` |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ❌ Not applicable — append-only time series |

**Key columns**: `timestamp_utc TIMESTAMPTZ`, `local_timestamp TIMESTAMP`, `kw`, `kva`, `kvarh`, `kwh`, `power_factor`, `tou_period` (`peak` / `standard` / `off_peak`), `season` (`high` / `low`), `quality_code` (`valid` / `estimated` / `interpolated` / `suspect` / `missing`)

**Partitions**: `y2025`, `y2026`, `y2027`, `default`

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.telemetry_quality` | Quality scores and anomaly flags per timestamp |
| `public.telemetry_gap_events` | Register of missing telemetry windows |

---

## 9. Tariff ✅

| Field | Value |
|---|---|
| **Entity** | Tariff |
| **Physical Table** | `public.tariff_schedules` (master catalog) |
| **Canonical View** | `public.tariffs` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | — (shared reference table) |
| **Organisation Isolation** | Global / shared — no `organisation_id` |
| **Source** | NERSA gazette / admin configuration |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ❌ Intentionally absent — tariff schedules are immutable |

**Key columns**: `tariff_code TEXT UNIQUE`, `tariff_name`, `provider` (default `Eskom`), `tariff_family` (`megaflex` / `miniflex` / `nightsave` / `municipal`)

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.tariff_versions` | Effective-date versioned NERSA gazetted rate sets |
| `public.tariff_components` | Unbundled rate components (energy, network, demand, subsidy…) |
| `public.tariff_rates` | Exact numeric rates `NUMERIC(18,6)` per component |
| `public.tariff_seasons` | High (Jun–Aug) / Low (Sep–May) season definitions |
| `public.tariff_tou_periods` | TOU clock schedule by hour × day-type |
| `public.tariff_holidays` | SA public holidays treated as off-peak |
| `public.tariff_rules` | Algorithmic rules (NMD ratchet, reactive penalty) |
| `public.tariff_assignments` | Historical/active tariff assignment per site/meter |

---

## 10. Reconciliation ✅

| Field | Value |
|---|---|
| **Entity** | Reconciliation |
| **Physical Table** | `public.reconciliation_runs` |
| **Canonical View** | `public.reconciliations` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `organisation_id → organisations(id)`, `invoice_record_id → invoice_records(id)`, `meter_id → meters(id)`, `tariff_version_id → tariff_versions(id)`, `source_file_id → source_files(id)`, `upload_id → uploads(id)` |
| **Organisation Isolation** | `organisation_id UUID` direct column |
| **Source** | `ReconciliationStorageService` / deterministic engine |
| **`created_at`** | ✅ `run_at TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ❌ Not present — runs are immutable execution snapshots |

**Key columns**: `status` (`pending` / `processing` / `completed` / `failed`), `correlation_id TEXT`

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.reconciliation_results` | Summary totals (invoiced vs reconciled vs variance) per run |
| `public.reconciliation_line_items` | Line-by-line charge comparison (legacy table) |
| `public.reconciliation_ledger` | Double-entry financial lineage ledger |
| `public.calculation_snapshots` | Immutable formula input/output snapshot per run |

---

## 11. Anomaly ✅

| Field | Value |
|---|---|
| **Entity** | Anomaly / Billing Discrepancy |
| **Physical Table** | `public.discrepancy_events` |
| **Canonical View** | `public.anomalies` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `reconciliation_run_id → reconciliation_runs(id)`, `invoice_record_id → invoice_records(id)`, `reason_code_id → discrepancy_reason_codes(id)` |
| **Organisation Isolation** | Via `reconciliation_run_id → reconciliation_runs.organisation_id` |
| **Source** | Deterministic discrepancy engine |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ❌ Not present — use `status` column for state transitions |

**Key columns**: `rule_id TEXT`, `severity` (`critical` / `major` / `minor` / `info`), `invoiced_amount`, `reconciled_amount`, `variance_amount`, `root_cause TEXT`, `status` (`open` / `disputed` / `accepted_by_eskom` / `rejected` / `closed`)

**Reason code taxonomy** (`public.discrepancy_reason_codes`):

| Code | Category |
|---|---|
| `TX_RATE_UNNOTIFIED` | `TARIFF_ESCALATION` |
| `CURTAILMENT_RATCHET_OVERCHARGE` | `DEMAND_RATCHET` |
| `MID_MONTH_PRO_RATA_ERROR` | `DAY_WEIGHTING` |
| `WHEELING_SUBSIDY_UNNETTED` | `WHEELING_OFFSET` |

---

## 12. Report ✅

| Field | Value |
|---|---|
| **Entity** | Report |
| **Physical Table** | `public.generated_reports` |
| **Canonical View** | `public.reports` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `organisation_id → organisations(id)` |
| **Organisation Isolation** | `organisation_id UUID` direct column |
| **Source** | Report generation engine / dispute pack builder |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ❌ Not present — reports are immutable once generated |

**Key columns**: `report_type` (`EXECUTIVE_SUMMARY` / `RECONCILIATION_DETAIL` / `DISCREPANCY_REGISTER` / `NMD_RATCHET_ANALYSIS`), `title`, `parameters JSONB`, `storage_path`

**Supporting tables**:

| Table | Purpose |
|---|---|
| `public.dispute_packs` | Formal legal claim packages sent to Eskom KAM |
| `public.report_exports` | Downloadable signed URL exports per report or dispute pack |

---

## 13. Audit Log ✅

| Field | Value |
|---|---|
| **Entity** | Audit Log |
| **Physical Table** | `public.audit_events` |
| **Canonical View** | `public.audit_logs` |
| **Primary Key** | `id UUID` |
| **Foreign Keys** | `organisation_id → organisations(id)`, `user_id → users(id)` |
| **Organisation Isolation** | `organisation_id UUID` direct column |
| **Source** | `AuditTrailService` — system-generated, append-only |
| **`created_at`** | ✅ `TIMESTAMPTZ NOT NULL DEFAULT now()` |
| **`updated_at`** | ❌ Not applicable — append-only immutable ledger by design |

**Key columns**: `action TEXT`, `entity_type TEXT`, `entity_id UUID`, `correlation_id TEXT`, `payload JSONB`

---

## Supplementary Entities

| Entity | Table | Purpose |
|---|---|---|
| Source File | `public.source_files` | Cryptographic catalog of raw files in object storage |
| File Version | `public.file_versions` | Re-upload / correction version history |
| Ingestion Job | `public.ingestion_jobs` | Async processing pipeline execution records |
| Ingestion Error | `public.ingestion_errors` | Line-item parsing/ingestion failures |
| Parser Result | `public.parser_results` | Raw extracted JSON before normalization |
| Point of Delivery | `public.points_of_delivery` | Official grid POD per site |
| Meter Config | `public.meter_configurations` | Versioned CT/VT ratio history |
| Tariff Assignment | `public.tariff_assignments` | Active and historical tariff-per-site assignments |
| Calculation Snapshot | `public.calculation_snapshots` | Immutable formula input/output records |
| Source Hash | `public.source_hashes` | SHA-256 proofs of source data integrity |
| Reconciliation Ledger | `public.reconciliation_ledger` | Double-entry financial lineage ledger |
| Overcharge Recovery | `public.overcharge_recoveries` | Approved, pending, and filed claim register |
| Telemetry Quality | `public.telemetry_quality` | Quality scoring and anomaly flags per interval |
| Telemetry Gap Event | `public.telemetry_gap_events` | Missing data window audit register |

---

## Identified Gaps & Recommendations

| # | Entity | Gap | Recommendation |
|---|---|---|---|
| 1 | **Account (`customers`)** | Missing `updated_at` column | Add via migration + trigger |
| 2 | **Site (`sites`)** | No direct `organisation_id` — isolation is transitive via `customers` | Add `organisation_id UUID` for direct RLS enforcement |
| 3 | **Reconciliation (`reconciliation_runs`)** | No `updated_at` — status transitions leave no timestamp trail | Add `updated_at TIMESTAMPTZ` with status-change trigger |
| 4 | **Anomaly (`discrepancy_events`)** | No direct `organisation_id` — isolation is via `reconciliation_run_id` join | Add `organisation_id UUID` directly for single-table RLS |
| 5 | **Tariff Schedule** | No `updated_at` | Intentional — immutable by design; document explicitly |
| 6 | **Audit Events** | No `updated_at` | Intentional — append-only ledger by design; document explicitly |

---

## Entity Relationship Summary

```
organisations
  └── users → user_roles → roles → permissions
  └── customers (accounts)
       └── sites
            └── points_of_delivery
            └── meters
                 └── meter_channels
                 └── meter_configurations
                 └── tariff_assignments ── tariff_versions
                 └── telemetry_intervals (partitioned y2025-y2027)
                      └── telemetry_quality
                      └── telemetry_gap_events
  └── uploads
       └── source_files
            └── file_versions
            └── source_hashes
            └── ingestion_jobs
                 └── ingestion_errors
                 └── parser_results
  └── invoice_records (invoices)
       └── invoice_line_items
       └── invoice_determinants
       └── reconciliation_runs
            └── reconciliation_results
            └── discrepancy_events ── discrepancy_reason_codes
            └── calculation_snapshots
       └── dispute_packs → report_exports
  └── generated_reports → report_exports
  └── audit_events (audit_logs)
  └── reconciliation_ledger

tariff_schedules [global shared]
  └── tariff_versions
       └── tariff_components → tariff_rates
       └── tariff_rules
tariff_seasons / tariff_tou_periods / tariff_holidays [global shared]
```

---

*Phase 3 complete — source: 26 migration files (`20260804000000` → `20260918020000`)*
