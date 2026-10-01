# ENERA Pull Request Preparation Specifications

> **Engineering Standard & Pull Request Manifests**  
> **Status**: Active (Stage 22)  
> **Target Integration Branch**: `develop`

---

## Index of Feature Branch PRs

1. [`refactor/codebase-cleanup`](#1-refactorcodebase-cleanup)
2. [`feature/upload-pipeline`](#2-featureupload-pipeline)
3. [`feature/document-intelligence`](#3-featuredocument-intelligence)
4. [`feature/ocr`](#4-featureocr)
5. [`feature/ai-validation`](#5-featureai-validation)
6. [`feature/tariff-engine`](#6-featuretariff-engine)
7. [`feature/energy-analytics`](#7-featureenergy-analytics)
8. [`feature/reconciliation-engine`](#8-featurereconciliation-engine)
9. [`feature/reporting`](#9-featurereporting)
10. [`security/hardening`](#10-securityhardening)

---

### 1. `refactor/codebase-cleanup`

* **Title**: `refactor(core): codebase cleanup, dead code elimination, and fixture import resolution`
* **Purpose**: Clean up dead code, eliminate linter code quality warnings, resolve broken test fixture import paths across dashboard test suites, and untrack local `.env`.
* **Changes**:
  - Removed unused, dead variable declarations (e.g. `storedInvoiceRecord` in `dataPersistenceVerificationEngine.ts`).
  - Corrected relative import paths in `src/lib/__tests__/fixtures/sampleInvoice.ts` and `stage35_dashboard_review.test.ts`.
  - Replaced empty `catch {}` blocks across domain services with documented error fallback intent (`no-empty`).
  - Replaced unsafe `Function` type with explicit typed callback signatures in `stage20_automatic_refresh.test.ts`.
  - Removed non-null assertions on optional chains in `stage23_error_handling.test.ts`.
  - Converted unassigned `let` variables to `const` (`prefer-const`).
  - Untracked `.env` from git index and updated `.gitignore` and `.env.example`.
* **Files/components affected**:
  - `src/lib/__tests__/fixtures/sampleInvoice.ts`
  - `src/lib/__tests__/stage35_dashboard_review.test.ts`
  - `src/lib/__tests__/stage20_automatic_refresh.test.ts`
  - `src/lib/__tests__/stage23_error_handling.test.ts`
  - `src/domain/charts/chartDataService.ts`
  - `src/domain/dashboard/dashboardService.ts`
  - `src/domain/governance/approvalWorkflowEngine.ts`
  - `src/domain/ingestion/duplicateProtectionService.ts`
  - `src/domain/ingestion/secureIngestionGateway.ts`
  - `src/domain/invoice/invoiceStorageService.ts`
  - `src/domain/meter/meterStorageService.ts`
  - `src/domain/observability/productionObservabilityService.ts`
  - `src/domain/reconciliation/reconciliationStorageService.ts`
  - `src/domain/reports/reportStorageService.ts`
  - `src/domain/security/tenantContextService.ts`
  - `src/domain/tariff/tariffStorageService.ts`
  - `src/domain/testing/dataPersistenceVerificationEngine.ts`
  - `src/domain/testing/endToEndVerificationEngine.ts`
  - `.gitignore`, `.env.example`
* **Database changes**: None.
* **Security implications**: Untracked `.env` from git index, preventing credential leakage in compliance with Stage 18 Level 3 Zero-Exposure governance.
* **Testing performed**:
  - `npx tsc --noEmit` $\to$ Passed (0 errors).
  - `npm test` $\to$ Passed (20/20 scenarios, 100%).
  - `npx vitest run src/lib/__tests__/dashboard_command_centre.test.ts src/lib/__tests__/stage35_dashboard_review.test.ts` $\to$ Passed (13/13 tests).
* **Known limitations**: Prettier formatting divergences remain deferred to prevent massive file diff noise.
* **Rollback considerations**: Clean git revert of commit `ca658a7` and `e4b4a3d`. No database or stateful side effects.
* **Dependencies**: None.

---

### 2. `feature/upload-pipeline`

* **Title**: `feat(upload): enterprise secure upload gateway, multipart chunking, and file vault storage`
* **Purpose**: Provide resilient, multi-format file ingestion (PDF invoices, AMR interval CSVs, Excel spreadsheets, logger files) with header verification, anti-spoofing, SHA-256 deduplication, and persistent vault storage.
* **Changes**:
  - Implementation of `SecureIngestionGateway` lifecycle state machine (`UPLOADED` $\to$ `VALIDATING` $\to$ `PROCESSING` $\to$ `PROCESSED`).
  - Binary magic byte validation for PDF, CSV, XLSX, and text log files.
  - Idempotent duplicate file handling via SHA-256 hash caching.
  - Quarantining of corrupt, spoofed, or oversized files with explicit error audit records.
  - Storage vault persistence in Supabase `source_files` bucket with signed download URL tokens.
* **Files/components affected**:
  - `src/features/upload/index.ts`
  - `src/domain/ingestion/secureIngestionGateway.ts`
  - `src/domain/ingestion/duplicateProtectionService.ts`
  - `src/domain/security/fileStorageSecurityService.ts`
  - `src/components/upload/SecureUploadGateway.tsx`
* **Database changes**: Writes to `public.source_files`, `public.upload_records`, `public.ingestion_jobs`.
* **Security implications**: 50MB file size limit enforced, executable payloads blocked via magic-byte checking, files stored in private bucket with 15-minute signed token access.
* **Testing performed**:
  - `src/lib/__tests__/upload_ingestion_pipeline.test.ts` (10/10 passed).
  - `src/lib/__tests__/file_security_adversarial.test.ts` (Adversarial MIME spoofing and size limits).
  - `npm test` (Scenario 16: SHA-256 idempotency).
* **Known limitations**: Synthetic PDF buffers parsed via `pdfjs-dist` in headless Node environment log legacy build notice.
* **Rollback considerations**: Revert upload gateway files. Preserved binary files in bucket remain intact without corrupting relational tables.
* **Dependencies**: `security/hardening`.

---

### 3. `feature/document-intelligence`

* **Title**: `feat(docs): deterministic PDF layout decomposition, table extraction, and determinant normalization`
* **Purpose**: Parse structured digital PDF electricity bills from Eskom and municipalities to extract verified billing determinants, TOU energy consumption, and line items without LLM hallucination.
* **Changes**:
  - Eskom Megaflex and municipal layout adapter implementations.
  - Line-item table detection, charge categorization (network, transmission, generation, environmental, VAT).
  - Determinant extraction: Account number, meter ID, billing period start/end, notified maximum demand (NMD), peak/standard/off-peak active energy (kWh), maximum demand (kVA), reactive energy (kVArh).
  - Explicit null preservation—missing values are never silently converted into zero.
* **Files/components affected**:
  - `src/features/documents/index.ts`
  - `src/domain/ingestion/adapters/pdfInvoiceAdapter.ts`
  - `src/lib/pdfInvoice.ts`
  - `src/routes/invoices.tsx`
* **Database changes**: Persists extracted invoice records to `public.invoices`, line items to `public.invoice_line_items`, and determinants to `public.invoice_determinants`.
* **Security implications**: Level 3 Zero-Exposure compliance—no internal parser regexes, parsing logic, or model prompts exposed on public routes or DOM.
* **Testing performed**:
  - `src/lib/__tests__/pdf_invoice_ingestion.test.ts`.
  - `src/lib/__tests__/stage10_data_normalisation.test.ts`.
  - `npm test` (Scenario 15: PDF extraction confidence gate).
* **Known limitations**: Raster/scanned PDFs with no digital text layer cannot be parsed digitally and must be routed to `feature/ocr`.
* **Rollback considerations**: Revert adapter code. Invoices can be re-parsed at any time from original immutable files stored in vault.
* **Dependencies**: `feature/upload-pipeline`, `security/hardening`.

---

### 4. `feature/ocr`

* **Title**: `feat(ocr): optical character recognition fallback engine and low-confidence human review routing`
* **Purpose**: Extract text and tabular determinants from scanned, photographed, or degraded invoices where native PDF text streams are unavailable.
* **Changes**:
  - Tesseract worker pool initialization with memory throttling.
  - Image pre-processing: Grayscale conversion, contrast stretching, and de-skewing.
  - Character and determinant confidence scoring; documents scoring $<0.85$ are flagged with `REVIEW_REQUIRED`.
  - Integration with the human-in-the-loop review workflow.
* **Files/components affected**:
  - `src/domain/ingestion/adapters/scannedInvoiceOcrAdapter.ts`
  - `src/domain/jobs/processingJobEngine.ts`
  - `src/components/upload/SecureUploadGateway.tsx`
* **Database changes**: Updates `public.ingestion_jobs` status (`partially_processed` / `review_required`) and stores extraction confidence in `public.invoices.extraction_confidence`.
* **Security implications**: OCR worker pool is memory-capped to protect against resource exhaustion DoS attacks.
* **Testing performed**:
  - Scanned PDF invoice tests in `secure_ingestion_gateway.test.ts` (Scenario 2).
  - `npm test` (Scenario 15).
* **Known limitations**: Scanned low-resolution invoices ($<150$ DPI) produce lower confidence and require human verification.
* **Rollback considerations**: If OCR is disabled, scanned documents cleanly transition to `MANUAL_ENTRY_REQUIRED` without impacting digital PDF processing.
* **Dependencies**: `feature/document-intelligence`, `feature/upload-pipeline`.

---

### 5. `feature/ai-validation`

* **Title**: `feat(ai): deterministic discrepancy analysis, anomaly detection, and validation engine`
* **Purpose**: Cross-reference extracted invoice determinants against physical meter telemetry and statutory rate bounds to catch billing discrepancies, seasonal irregularities, and potential utility overcharges.
* **Changes**:
  - Automated validation rules enforcing mathematical consistency (e.g. line-item sums = invoice total).
  - Determinant cross-referencing between utility billed kWh and AMR recorded kWh.
  - Discrepancy confidence evaluation and anomaly categorization (`CONSUMPTION_ANOMALY`, `DEMAND_SPIKE`, `RATE_MISMATCH`).
  - Structured dispute draft text generator.
* **Files/components affected**:
  - `src/features/ai/index.ts`
  - `src/domain/validation/**`
  - `src/lib/validationEngine.ts`
  - `src/lib/aiAuditor.ts`
  - `src/lib/aiDisputeGenerator.ts`
* **Database changes**: Logs flagged issues into `public.discrepancy_events` and records audit actions in `public.audit_events_ledger`.
* **Security implications**: Internal anomaly detection thresholds and dispute drafting prompts remain strictly embargoed from client bundles.
* **Testing performed**:
  - `src/lib/__tests__/electricity_data_quality_engine.test.ts`.
  - `src/lib/__tests__/stage11_data_quality_engine.test.ts`.
  - `src/lib/__tests__/stage14_financial_integrity.test.ts`.
* **Known limitations**: Anomaly detection relies on having at least 95% complete interval data for the billing period.
* **Rollback considerations**: Anomaly flags are non-destructive and can be dismissed or purged without altering invoices or meter readings.
* **Dependencies**: `feature/document-intelligence`, `feature/energy-analytics`, `security/hardening`.

---

### 6. `feature/tariff-engine`

* **Title**: `feat(tariff): NERSA gazetted Eskom Megaflex rate schedules, TOU calendar, and seasonal boundary engine`
* **Purpose**: Model statutory Eskom Megaflex, Nightsave, Miniflex, and municipal electricity tariffs with exact Time-of-Use hourly slots, High/Low seasonal boundaries, and SAST public holiday calendar rules.
* **Changes**:
  - Structured `TariffDefinition` rate model supporting energy charges, network charges, transmission surcharges, and reactive energy rules.
  - High Season (June–August) and Low Season (September–May) boundary evaluation.
  - Time-of-Use slot engine: Peak, Standard, and Off-Peak allocations.
  - South African Standard Time (SAST) deterministic calendar engine with gazetted public holiday substitutions.
  - Version-controlled tariff storage with immutability locks.
* **Files/components affected**:
  - `src/features/tariffs/index.ts`
  - `src/domain/tariff/**`
  - `src/lib/tariff.ts`
  - `src/lib/municipalTariff.ts`
* **Database changes**: Persists to `public.tariff_definitions` and `public.tariff_versions` with organization scoping and active version pointers.
* **Security implications**: Locked tariff versions are immutable; modifying an active tariff produces an audited successor version to prevent rate tampering.
* **Testing performed**:
  - `src/lib/__tests__/stage13_tariff_engine.test.ts`.
  - `src/lib/__tests__/deterministic_calendar_engine.test.ts`.
  - `npm test` (Scenarios 7, 11, 12, 13, 14).
* **Known limitations**: Non-standard commercial agreements (PPAs, wheeling credits) require uploading a bespoke tariff schedule document.
* **Rollback considerations**: Prior tariff versions remain preserved in storage; rolling back simply activates the previous version ID.
* **Dependencies**: `security/hardening`.

---

### 7. `feature/energy-analytics`

* **Title**: `feat(analytics): AMR interval telemetry streaming, 30-min load profiling, and vector power factor calculations`
* **Purpose**: Ingest and normalize automatic meter reading (AMR) telemetry, compute active/apparent/reactive power determinants, derive vector power factor, and detect unsupplied outage intervals.
* **Changes**:
  - Streaming ingestion parser for 30-minute interval CSV, Excel, and logger formats.
  - Interval aggregation into `CanonicalEnergyRecord` with timestamp alignment to SAST.
  - Vector power factor calculation: $PF = \frac{kW}{kVA} = \frac{kW}{\sqrt{kW^2 + kVAr^2}}$.
  - Reactive energy surcharge derivation ($>30\%$ of active energy during Peak & Standard hours).
  - Outage and gap detection algorithm identifying unsupplied grid intervals.
* **Files/components affected**:
  - `src/features/analytics/index.ts`
  - `src/domain/telemetry/**`
  - `src/domain/meter/**`
  - `src/lib/parseMeter.ts`
* **Database changes**: Partitioned bulk writes to `public.telemetry_intervals`, gap records in `public.telemetry_missing_gaps`, meter metadata in `public.meters` and `public.meter_configurations`.
* **Security implications**: Strict multi-tenant isolation ensures interval telemetry is accessible only by authorized organization members.
* **Testing performed**:
  - `src/lib/__tests__/amr_interval_ingestion.test.ts`.
  - `src/lib/__tests__/streaming_ingestion_pipeline.test.ts`.
  - `npm test` (Scenarios 6, 8, 9, 10).
* **Known limitations**: Telemetry uploads $>500,000$ intervals must be streamed in chunks of 5,000 intervals.
* **Rollback considerations**: Telemetry intervals can be deleted or re-imported from raw source files in vault storage.
* **Dependencies**: `feature/upload-pipeline`, `security/hardening`.

---

### 8. `feature/reconciliation-engine`

* **Title**: `feat(reconciliation): authoritative mathematical reconciliation engine, 14-determinant variance calculation, and cryptographic audit lineage`
* **Purpose**: Perform authoritative reconciliation comparing billed utility determinants against physical meter telemetry and statutory tariffs, calculate financial variances, classify discrepancy severity, and seal results in an immutable hash chain.
* **Changes**:
  - Authoritative reconciliation execution across all 14 core comparison metrics.
  - Decimal financial calculation using `decimal.js-light` to eliminate floating-point drift.
  - Discrepancy outcome classification: `PASS`, `TOLERABLE_VARIANCE`, `MATERIAL_DISCREPANCY`.
  - Strict tariff upload gatekeeper: Refuses to execute reconciliation without an active, verified tariff definition.
  - Append-only cryptographic SHA-256 hash chaining for reconciliation runs (`reconciliation_run_snapshots`).
* **Files/components affected**:
  - `src/features/reconciliation/index.ts`
  - `src/domain/reconciliation/**`
  - `src/domain/audit/auditLedgerService.ts`
  - `src/lib/reconciliation.ts`
* **Database changes**: Inserts into `public.reconciliation_runs`, `public.reconciliation_results`, `public.discrepancy_events`, and `public.reconciliation_run_snapshots`.
* **Security implications**: Cryptographic hash chain guarantees that historical reconciliation results cannot be modified retroactively without detection.
* **Testing performed**:
  - `src/lib/__tests__/authoritative_reconciliation_engine.test.ts` (5/5 passed).
  - `npm test` (Scenarios 1–5, 18–20: 100% passed).
* **Known limitations**: Requires prior upload and extraction of both an invoice and an applicable tariff schedule document.
* **Rollback considerations**: Reconciliation runs are append-only. To roll back an erroneous run, a superseding run record is created with audit notes.
* **Dependencies**: `feature/document-intelligence`, `feature/energy-analytics`, `feature/tariff-engine`, `feature/ai-validation`, `security/hardening`.

---

### 9. `feature/reporting`

* **Title**: `feat(reporting): dispute pack generation, cryptographic audit certificates, and executive reporting suite`
* **Purpose**: Generate formal Eskom dispute packages (PDF and Excel formats), cryptographic audit verification certificates, and executive financial summaries based on immutable reconciliation runs.
* **Changes**:
  - Formal Eskom dispute pack builder conforming to statutory utility dispute submission formats.
  - Cryptographic audit certificate generator including SHA-256 run verification seal.
  - Excel multi-tab workbook builder detailing interval-by-interval variance calculations.
  - Executive financial exposure dashboard exports.
* **Files/components affected**:
  - `src/features/reports/index.ts`
  - `src/domain/reports/**`
  - `src/lib/exportReports.ts`
  - `src/lib/reportBuilders.ts`
  - `src/routes/reports.tsx`
* **Database changes**: Inserts report metadata into `public.generated_reports` and logs generation events to `public.audit_events_ledger`.
* **Security implications**: Generated dispute files are stored in private vault storage with signed, expiring download URLs.
* **Testing performed**:
  - `src/lib/__tests__/stage32_observability.test.ts`.
  - `npm test` (Scenario 20: Tamper-evident verification).
* **Known limitations**: Client-side PDF generation is throttled for bills with $>500$ line items to avoid browser memory spikes.
* **Rollback considerations**: Generated reports are derived read-only artifacts. Code reverts do not affect persisted reconciliation data.
* **Dependencies**: `feature/reconciliation-engine`, `security/hardening`.

---

### 10. `security/hardening`

* **Title**: `sec(core): multi-tenant row-level security, Level 3 zero-exposure model, and cryptographic lineage`
* **Purpose**: Enforce zero-trust security across the platform, including PostgreSQL Row-Level Security (RLS) on all 26 migrations, Level 3 Zero-Exposure public disclosure embargo, and signed token download gating.
* **Changes**:
  - Row-Level Security (RLS) policies across all domain tables.
  - Multi-tenant context enforcement (`UserSecurityContext`) preventing cross-tenant data leakage.
  - Sanitization of user-facing error messages to prevent database schema and stack trace leaks.
  - Signed download URL token generator with 15-minute expiration for vault storage.
  - Audit trail service maintaining an append-only ledger of all mutations.
* **Files/components affected**:
  - `src/domain/security/**`
  - `src/domain/audit/**`
  - `supabase/migrations/**`
  - `src/domain/observability/productionObservabilityService.ts`
* **Database changes**: RLS policy definitions and grants on all tables in `public` schema.
* **Security implications**: Protects all tenant records, guarantees zero exposure of internal system prompts, algorithms, and database structures.
* **Testing performed**:
  - `src/lib/__tests__/stage26_security.test.ts` (7/7 passed).
  - `src/lib/__tests__/tenant_isolation.test.ts` (Cross-tenant access blocked).
  - `src/lib/__tests__/test_public_disclosure_model.test.ts` (Level 3 embargo verified).
* **Known limitations**: Remote Supabase database operations require valid user JWT; tests execute with simulated security contexts.
* **Rollback considerations**: Policy updates must be verified against development before production application to prevent locking tenant access.
* **Dependencies**: None (Root security foundation).
