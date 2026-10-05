# Production hardening rollout — first implementation batch

## Implemented in this branch

- Protected API requests require a Supabase-verified bearer token. Caller-supplied identity headers are overwritten, not trusted.
- Organisation and role come exclusively from administrator-owned `app_metadata`. `user_metadata` is never an authorization source.
- Request-local database clients carry the authenticated bearer token; no service-role key is used. Concurrent requests use AsyncLocalStorage isolation.
- Guest bypass is removed. Browser databases are namespaced by organisation and user. Legacy unscoped databases are deliberately not imported automatically.
- Sign-out/account changes reload the application to dispose of in-memory records.
- Upload processing no longer uses a hardcoded organisation/user.
- Reporting preferences have a persisted table with owner/organisation RLS. These preferences do not override financial calculations.
- Database errors no longer become a false successful connection indicator.
- Unconfigured notifications/connectors are labelled honestly; notification toggle is disabled.
- Copilot is labelled rules-based; no paid model provider is introduced.
- Identity/cache regression tests are included in the build gate.
- A CI workflow template is provided in `production-hardening.yml.example`; an administrator can install it under `.github/workflows/` after reviewing workflow permissions.

## Required before merge/deployment

1. Apply `20261005000000_workspace_preferences.sql` in the intended Supabase environment. This branch does not apply migrations remotely.
2. Provision each approved user's `app_metadata.organisation_id` and `app_metadata.role` through the trusted Supabase Admin API or equivalent administrator tooling. Never allow clients to edit these values. Refresh sessions after changes. Supported roles are in `src/domain/security/types.ts`.
3. Verify existing table/storage RLS against two real organisations. JWT claim provisioning here does not prove all older policies are correct.
4. Supply existing public Supabase configuration to both server and browser build contexts. No replacement credentials are committed.
5. Clients calling protected APIs must send their session bearer token. Legacy identity-header-only integrations must migrate.
6. Test sign-out/account switching and uploaded-file access in a browser. Legacy unscoped local files remain on disk but are not restored; recover/export needed files through an approved process before deleting them.

## Explicitly not complete

- Durable background worker/queue: the existing processing engine remains local/in-process. Keep the processing tab open. No claim is made that processing survives a restart or disconnect.
- Guaranteed remote persistence for every ingestion path: fallbacks still exist. Local records are not backups. Upload metadata distinguishes local versus confirmed remote registry persistence; this does not confirm all derived data were saved.
- Email/Slack delivery: no provider credentials or destinations were supplied, so delivery remains disabled.
- Organisation governance CRUD: the legacy fabricated admin panel is removed from settings; real administrator provisioning is required.
- Live browser/database acceptance tests: unit tests are not evidence of real tenant-isolation or restore behaviour.
- Model-backed AI: deliberately not enabled without an explicit provider/cost choice.

## Acceptance checklist

- No bearer token / invalid token returns 401; unprovisioned user returns 403.
- Forged identity headers never grant another tenant or role.
- Read-only users cannot submit uploads or reconciliation mutations.
- Organisation A cannot list/download organisation B records through database or API.
- User B on the same browser cannot restore user A's workspace cache.
- Failed preference writes never display success; successful settings survive a second device.
- Upload invoice, interval data and tariff; reconcile; export; reload; verify source documents and derived results remotely before calling the workflow production-ready.
- Interrupted processing is explicitly local until the durable-worker follow-up lands.

Production is unchanged by this PR. Review and deploy only after provisioning, migration and acceptance checks.
