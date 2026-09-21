# Automatic Upload-to-Account Loading

## Goal
Make every uploaded document persist in the registry, automatically extract and load its data, create or update the matching customer account, and clearly show which files belong to which account.

## Changes
- Persist upload records in the browser alongside the original file when remote storage is unavailable, so registry entries survive reloads.
- Save extracted account metadata on each upload: customer name, account number, meter number, billing period, and linked record type.
- Create or update the customer account automatically after invoice extraction; use extracted facts only and flag missing identity details instead of inventing them.
- Link meter files to an account by extracted meter number, or to the active account when an exact meter match is available; otherwise show “Unassigned” for review.
- Restore uploaded invoice and interval data from saved records when the app opens or an account is selected.
- Add Account and Customer columns to the Upload Registry and include the relationship in file details.
- Make the Customers page merge remotely stored accounts with locally persisted extracted accounts.

## Validation
- Upload an invoice and interval file, confirm both appear in the registry with their account relationship.
- Reload the page and confirm the files, customer account, invoice values, and interval data remain available.
- Confirm unknown files stay saved and downloadable without being assigned to a fabricated account.
- Run the existing test suite and verify the Upload and Customers pages in the browser.

## Technical details
The fix will extend the existing IndexedDB storage rather than replace the current ingestion code. Remote persistence remains primary; durable browser storage is the fallback when the configured remote tables or file bucket reject writes.
