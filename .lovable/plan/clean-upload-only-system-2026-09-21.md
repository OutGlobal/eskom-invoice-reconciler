# Clean upload-only system

## Goal
Make the platform start completely empty and populate operational screens only from uploaded files or saved uploaded records.

## Changes
- Remove bundled invoice, municipal statement, meter, spreadsheet, and tariff-book datasets from production code.
- Remove automatic tariff seeding and tariff fallback selection; reconciliation will stop clearly when no uploaded tariff is available.
- Remove fabricated customer, account, billing, charge, demand, and report defaults from upload and reconciliation flows.
- Replace tariff and calendar sample displays with clean upload/configuration empty states.
- Remove bundled data files and unused production sample modules after confirming no live imports remain.
- Keep test-only fixtures isolated from the production application.

## Validation
- Confirm the store initializes with no invoice, customer, meter rows, tariff schedules, uploads, or reconciliation.
- Confirm Dashboard, Upload, Tariffs, Reconciliation, Municipal, and Reports load cleanly without showing operational data.
- Search the production dependency paths for remaining embedded customer records, invoice values, meter files, and tariff schedules.

## Technical details
- Preserve the existing corporate interface and upload workflow.
- Uploaded tariff definitions will be passed into calculation engines explicitly; missing tariff data will produce an empty or blocked state, never a built-in rate schedule.
- No database or security changes are included.
