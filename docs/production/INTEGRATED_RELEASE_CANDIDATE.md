# Integrated release candidate

## Purpose

Prepare one reviewed release containing the current platform capabilities and
outstanding tariff calculation enhancements. Sequential deployment promotion is
not feature integration.

## Scope

The candidate combines the current `main` platform baseline with the outstanding
`feature/tariff-engine` work, targeting `develop` for integration review. The
inspected upload, document intelligence, OCR, analytics, reporting, AI validation,
security, cleanup, and upload-connection branches contain no outstanding feature
commits beyond this baseline. Reconciliation, document, and charge-comparison
branches contain merge-only history with no additional file changes to integrate.

Features include versioned tariff calculations, traceable charge comparison,
calculation reproducibility, and tenant-aware validation alongside the existing
upload, OCR, reporting, analytics, and reconciliation capabilities.

## Verification

- TypeScript: passes.
- Production build, including enterprise, security, backup, and charge tests: passes.
- New tariff calculation suites: 33 tests pass.
- Full Vitest run: not complete; scanned-document OCR assertion fails. The same
  assertion fails on unchanged `main` (9 tests pass, 1 fails in the isolated suite).
- Lint: blocked by 997 errors and 25 warnings; cleanup must be assessed separately.
- Remote database policies, migration execution, and browser end-to-end behavior
  are not verified by these local checks.

## Review gates

Keep this candidate a draft until domain and engineering review, failing checks,
staging integration tests, and database migration review are complete. Existing
branch demo-access and identity fallback behavior requires security review before
approving the release. No database migrations were applied by this integration.
Follow the repository release workflow: review into `develop`, staging validation,
then an explicitly approved release to `main`. Do not automatically merge or deploy.

## Rollback

Revert the integration merge commits without rewriting published history. Restore
the previously approved production deployment if a subsequent rollout regresses.
Database changes need a separately reviewed rollback strategy; do not delete
persisted customer data or immutable calculation history.
