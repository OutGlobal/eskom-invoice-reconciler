# ENERA Critical Git & Environment Safety Rules

> **Engineering Operational Directive & Data Loss Prevention Standard**  
> **Status**: Active & Mandatory  
> **Enforcement**: Hard Stop Gate across all agents, developers, and CI workflows

---

## 1. Absolute Prohibitions (Zero Tolerance)

The following commands and operations are strictly **FORBIDDEN** under normal operating conditions:

```bash
# 1. NEVER forcibly discard uncommitted or working tree changes
git reset --hard

# 2. NEVER forcibly delete untracked files or directories
git clean -fd

# 3. NEVER force-push or overwrite remote branch history
git push --force
git push -f
git push --force-with-lease (without explicit authorization and backup)

# 4. NEVER delete branches containing unique work
git branch -D <branch> (if not fully merged into trunk)

# 5. NEVER overwrite or squash another developer's work
# 6. NEVER rewrite published git history (rebase, commit --amend, or squash published commits)
# 7. NEVER delete, modify, or remove existing database migrations in supabase/migrations/
# 8. NEVER delete or strip environment files containing required configurations (.env, .env.local, .env.example)
```

---

## 2. Lovable Platform History Integrity

This repository is connected to **Lovable** (`https://lovable.dev`). 

- Any history rewriting (force pushing, rebasing, amending, or squashing commits that have already been pushed to `origin`) disrupts synchronization and can cause permanent loss of project history.
- All commits pushed to remote branches must be additive, forward-moving changes (`git revert` or compensatory commits instead of history rewrites).

---

## 3. Strict Pre-Conditions for Exception Authorisation

If a catastrophic conflict or corrupted state genuinely requires a destructive operation, it may **ONLY** be executed when all of the following conditions are satisfied:

1. **Explicit Human Confirmation**: Explicitly requested or approved by the engineering lead/repository owner.
2. **Recoverable Checkpoint Created**: A full local and remote backup/checkpoint branch or stash is created prior to execution:
   ```bash
   # Create dated emergency recovery checkpoint
   git branch checkpoint/pre-recovery-$(date +%Y%m%d%H%M%S)
   git push origin checkpoint/pre-recovery-$(date +%Y%m%d%H%M%S)
   ```
3. **Audit Trail**: The rationale, executed commands, and recovery verification steps must be documented in a commit message or incident report.

---

## 4. Preservation of Database Migrations & Environment Assets

- **Database Migrations (`supabase/migrations/`)**:
  - Existing migration files are immutable historical records.
  - Fixes, schema adjustments, or rollbacks must be implemented via **new sequential migrations** (e.g. `20260926000000_...sql`).
  - Never delete or edit previously applied migration files.

- **Environment Configuration (`.env*`)**:
  - Never remove or blank out environment files containing active project configuration.
  - Maintain `.env.example` as a fully annotated template adhering to the Stage 18 Level 3 Public Disclosure model (zero secrets exposed).
