# ENERA Release Workflow & Merge Gatekeeper Standard

> **Engineering Standard & Branch Promotion Governance**  
> **Status**: Active (Stage 23)  
> **Rule**: Zero Automatic Merges — Explicit Stop Gate

---

## 1. The Core Mandate

**Feature branches must NEVER be merged into `main` automatically.**

Any automated pipeline, background agent, or continuous integration task must **STOP before merging** unless explicit human confirmation or a signed change request is provided.

```text
                  ┌───────────────────────────────┐
                  │        feature branch         │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │         pull request          │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │      peer & domain review     │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │    typecheck & test suites    │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │            develop            │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │   staging integration tests   │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │       release candidate       │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │             main              │
                  │   (Production Release Only)   │
                  └───────────────────────────────┘
```

---

## 2. Definitive Stage Requirements

### Stage 1: Feature Branch
- Created directly from `develop`.
- Constrained to exactly **one architectural concern** (Stage 20).
- Atomic commits formatted via Conventional Commits (Stage 19).

### Stage 2: Pull Request
- Author prepares the standardized PR manifest from [`docs/PULL_REQUEST_PREPARATION.md`](./PULL_REQUEST_PREPARATION.md).
- Must document scope, affected components, database changes, security implications, test results, limitations, and rollback plan.

### Stage 3: Review
- Requires peer engineering review.
- Validates strict compliance with the **Three-Tier Public Disclosure Model** (Stage 18 Level 3 zero-exposure embargo).
- Checks that no unrelated domain changes, dead code, or hardcoded constants are included.

### Stage 4: Automated Tests & Typecheck
- `npx tsc --noEmit` must return exit code `0`.
- `npm test` (Master Enterprise 20-scenario suite) must achieve 100% pass rate.
- Subsystem Vitest suites covering the target domain must pass cleanly.
- `npm run build` must compile without bundling errors.

### Stage 5: Merge into `develop`
- Only merged after Stages 2, 3, and 4 are completely verified.
- Merged via standard pull request integration without force-pushing.

### Stage 6: Staging Integration Testing
- Full end-to-end multi-tenant reconciliation runs against test datasets.
- Verification of Supabase PostgreSQL RLS policies, storage bucket policies, and signed download token generation.

### Stage 7: Release Candidate & Version Tagging
- Bump semantic version (e.g. `v2.6.0`).
- Create annotated release tag.
- Compile release notes detailing features, bug fixes, and database migrations.

### Stage 8: Production Promotion to `main`
- Merged to `main` strictly from the approved `release` branch or release tag.
- **NEVER** merged directly from a `feature/*` branch.
- Lovable git history integrity preserved (no rebasing, amending, or squashing of published history).

---

## 3. Merge Gatekeeper Verification Checklist

Before ANY merge is executed:

- [ ] Has automatic merging been withheld? (Confirmed: **STOP BEFORE MERGE**)
- [ ] Is the destination branch `develop` (for PRs) or `main` (for formal releases only)?
- [ ] Did `npx tsc --noEmit` exit with 0 errors?
- [ ] Did `npm test` pass all 20 essential scenarios?
- [ ] Does `git status` show a clean working tree with zero untracked `.env` files?
- [ ] Has human confirmation been explicitly granted for this specific merge?

If ANY checkbox cannot be checked: **HALT EXECUTION IMMEDIATELY**.
