# ENERA Git Commit Strategy & Engineering Standard

> **Engineering Standard & Contribution Rules**  
> **Status**: Active (Stage 19)  
> **Repository Integration Baseline**: `develop`

---

## 1. Core Principles

Every commit in this repository represents an atomic, verifiable unit of work. Commits must be self-explanatory, technically specific, and adhere to standard Conventional Commits formatting.

### Required Structure

```text
<type>(<scope>): <concise imperatively phrased description>

[optional body providing technical context, rationale, or breaking changes]
```

---

## 2. Allowed Commit Types

| Type | Purpose | Example |
| :--- | :--- | :--- |
| `feat` | New capability or feature module | `feat(ingestion): add document ingestion pipeline` |
| `fix` | Bug fix or error correction | `fix(upload): correct upload state handling` |
| `refactor` | Structural improvement with no behavior change | `refactor(utils): consolidate shared validation` |
| `chore` | Maintenance, configuration, branch setup | `chore(git): establish development branch` |
| `docs` | Documentation additions or revisions | `docs(architecture): document branch dependency graph` |
| `test` | Test fixtures, unit suites, end-to-end verification | `test(dashboard): restore fixture import paths` |
| `sec` | Security hardening, RLS policies, sanitization | `sec(env): untrack local env file and update gitignore` |

---

## 3. Strict Anti-Patterns (BANNED)

Vague, meaningless, or low-information commit messages are **strictly prohibited**.

### Prohibited Examples:
❌ `"changes"`  
❌ `"updates"`  
❌ `"stuff"`  
❌ `"final"`  
❌ `"wip"`  
❌ `"fixed"`  
❌ `"patch"`  
❌ `"cleaning code"`  
❌ `"trying again"`  

### Prohibited Commit Practices:
1. **Never commit secrets**: No `.env`, API keys, database credentials, or tokens (Stage 18 Level 3 Zero-Exposure Embargo).
2. **Never commit broken builds**: Every commit must pass typecheck (`npx tsc --noEmit`) and pre-commit test assertions.
3. **Never mix unrelated domains**: Do not mix OCR algorithms, tariff schedules, AI models, and reconciliation redesign into a single commit.

---

## 4. Per-Branch Architectural Commit Examples

### `feature/upload-pipeline`
- `feat(upload): implement chunked multipart file upload handler`
- `fix(upload): correct upload state handling on network disconnect`
- `refactor(upload): extract SHA-256 deduplication into dedicated service`
- `sec(upload): enforce MIME magic byte verification for PDF and CSV`

### `feature/document-intelligence`
- `feat(docs): add document ingestion pipeline for Eskom Megaflex invoices`
- `fix(docs): resolve line-item table parsing boundary errors`
- `refactor(docs): decouple invoice layout adapter from storage layer`

### `feature/ocr`
- `feat(ocr): add OCR processing with low-confidence review routing`
- `fix(ocr): handle multi-page scanned PDF orientation normalization`
- `refactor(ocr): replace direct worker spawn with pooled Tesseract manager`

### `feature/ai-validation`
- `feat(ai): add AI document validation for billing determinant cross-checks`
- `fix(ai): correct false-positive anomaly score on seasonal tariff changes`
- `refactor(ai): encapsulate dispute generator prompt templates`

### `feature/tariff-engine`
- `feat(tariff): add gazetted NERSA 2026 Eskom Megaflex rate schedule`
- `fix(tariff): correct public holiday substitution logic in SAST calendar`
- `refactor(tariff): consolidate seasonal boundary validation helpers`

### `feature/energy-analytics`
- `feat(analytics): add 30-minute interval AMR telemetry aggregation`
- `fix(analytics): correct reactive power vector calculation for lagging PF`
- `refactor(analytics): extract load duration curve calculation into utility`

### `feature/reconciliation-engine`
- `feat(reconciliation): persist reconciliation results to authoritative store`
- `feat(reconciliation): calculate 14 core comparison metrics deterministically`
- `fix(reconciliation): enforce strict uploaded tariff requirement`
- `refactor(reconciliation): isolate tolerance thresholds from math engine`

### `feature/reporting`
- `feat(reporting): generate statutory Eskom dispute pack in PDF format`
- `fix(reporting): ensure SHA-256 audit certificate seal matches run snapshot`
- `refactor(reporting): modularize dispute pack Excel workbook builder`

### `security/hardening`
- `sec(auth): enforce strict tenant isolation across all reconciliation endpoints`
- `sec(rls): add row-level security policy for meter telemetry partitions`
- `sec(audit): implement tamper-evident SHA-256 cryptographic hash chain`
