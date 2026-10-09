# Cleanup roadmap

- [x] Remove production-reachable embedded invoice, meter, spreadsheet, customer, tariff-book, and municipal records
- [x] Ensure initial stores and pages are empty until upload
- [x] Verify key pages and production data paths

- [x] Fix all current TypeScript build errors
- [x] Remove stale persisted/demo upload registry records
- [x] Verify clean empty pages and build

## Upload-to-account loading

- [x] Persist upload registry, extracted account records, and loaded datasets across reloads
- [x] Create/update customer accounts from extracted invoice facts
- [x] Associate uploaded files with account/customer and show the relationship
- [x] Restore uploaded data automatically and verify upload/customer screens

## Stage 40 & 41 — Reconciliation Engine & Real Data Pipeline

- [x] Stage 40 Test Suite: Matching, AMR, Energy, Financial, and Failure domain coverage (100% green)
- [x] Tariff Clean Interface: Pluggable `getApplicableTariff` and `calculateCharge` contract decoupling reconciliation from `feature/tariff-engine`
- [x] Stage 41 Real Data End-to-End Test: 15-stage pipeline from invoice upload through dashboard persistence with verified zero-volatile dependency
