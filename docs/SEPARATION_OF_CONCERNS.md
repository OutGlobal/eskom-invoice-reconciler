# ENERA Architectural Separation of Concerns Standard

> **Engineering Standard & Domain Boundary Enforcement**  
> **Status**: Active (Stage 20)  
> **Integration Baseline**: `develop`

---

## 1. The Core Principle: Single Major Purpose

Each git branch in this repository exists for **exactly one major purpose**.

Under no circumstances may a branch combine multiple architectural concerns into a single changeset. 

### The Prohibited "Kitchen Sink" Change
```text
❌ STRICTLY FORBIDDEN IN A SINGLE BRANCH:
   OCR Extraction + UI Visual Redesign + Tariff Rate Updates + Database Migrations
```

Such changes obscure regression root causes, violate auditability, make cherry-picking impossible, and risk silent corruption of financial reconciliation.

---

## 2. Architectural Domain Boundary Matrix

| Branch Name | Primary Domain Responsibility | Allowed File Paths | Strictly Prohibited in This Branch |
| :--- | :--- | :--- | :--- |
| **`feature/upload-pipeline`** | Ingestion gateway, multipart chunking, MIME verification, file storage vault, quarantine management. | • `src/features/upload/**`<br>• `src/domain/ingestion/secureIngestionGateway.ts`<br>• `src/domain/security/fileStorageSecurityService.ts`<br>• `src/components/upload/**` | • Tariff calculation formulas<br>• Mathematical reconciliation<br>• UI theme redesigns<br>• Database schema migrations |
| **`feature/document-intelligence`** | Deterministic PDF layout parsing, table line-item detection, determinant extraction. | • `src/features/documents/**`<br>• `src/domain/ingestion/adapters/pdfInvoiceAdapter.ts`<br>• `src/lib/pdfInvoice.ts` | • OCR worker engines<br>• Tariff schedule updates<br>• Global UI redesigns<br>• Database RLS policies |
| **`feature/ocr`** | Fallback visual extraction for degraded/scanned documents, Tesseract worker management, low-confidence review routing. | • `src/domain/ingestion/adapters/scannedInvoiceOcrAdapter.ts`<br>• OCR worker pool scripts & config | • Tariff rate definitions<br>• Meter telemetry math<br>• General landing page / navigation UI<br>• Unrelated database table schemas |
| **`feature/ai-validation`** | Determinant cross-referencing, anomaly detection, discrepancy confidence scoring, dispute candidate flagging. | • `src/features/ai/**`<br>• `src/domain/validation/**`<br>• `src/lib/validationEngine.ts`<br>• `src/lib/aiAuditor.ts` | • Low-level PDF byte parsers<br>• Database schema migrations<br>• Tariff calendar scheduling rules<br>• Global styling / CSS themes |
| **`feature/tariff-engine`** | Eskom Megaflex/NIGHTSAVE structures, seasonal boundaries, TOU hourly slots, public holiday substitutions, rate schedules. | • `src/features/tariffs/**`<br>• `src/domain/tariff/**`<br>• `src/lib/tariff.ts`<br>• `src/lib/municipalTariff.ts` | • PDF layout detection<br>• Telemetry interval parsing<br>• Reconciliation execution logic<br>• Unrelated frontend route changes |
| **`feature/energy-analytics`** | AMR interval telemetry streaming, 30-min aggregation, reactive power vectoring, power factor penalties, demand spikes. | • `src/features/analytics/**`<br>• `src/domain/telemetry/**`<br>• `src/domain/meter/**`<br>• `src/lib/parseMeter.ts` | • PDF OCR extraction<br>• Tariff rate card gazetting<br>• Dispute pack PDF generation<br>• Database credential management |
| **`feature/reconciliation-engine`** | Authoritative mathematical comparisons, billed vs calculated variances, 14 canonical determinant outputs, tamper-evident hash chaining. | • `src/features/reconciliation/**`<br>• `src/domain/reconciliation/**`<br>• `src/lib/reconciliation.ts` | • PDF layout parsing<br>• Raw file upload handlers<br>• Direct tariff schedule creation<br>• Landing page / frontend redesigns |
| **`feature/reporting`** | Audit certificates, dispute pack PDF/Excel synthesis, executive summary dashboards, cryptographic seals. | • `src/features/reports/**`<br>• `src/domain/reports/**`<br>• `src/lib/exportReports.ts`<br>• `src/lib/reportBuilders.ts` | • Reconciliation math redesign<br>• OCR algorithms<br>• AMR streaming parsers<br>• Tariff rate card modifications |
| **`security/hardening`** | Multi-tenant RLS policies, Level 3 zero-exposure model, signed download tokens, input sanitization, database migrations. | • `src/domain/security/**`<br>• `src/domain/audit/**`<br>• `supabase/migrations/**`<br>• Security audit test suites | • Feature business logic changes<br>• Visual UI alterations<br>• Tariff rate changes<br>• OCR engine tuning |

---

## 3. Four Major Anti-Patterns & Prohibitions

### Anti-Pattern 1: The "Kitchen Sink" Branch
* **Problem**: Merging OCR changes with frontend layout updates and tariff rate adjustments.
* **Rule**: Split into independent, targeted branches: `feature/ocr`, `refactor/ui-layout`, and `feature/tariff-engine`.

### Anti-Pattern 2: "Incidental" Database Migrations
* **Problem**: Adding a new database table or modifying an existing column inside a feature or UI branch.
* **Rule**: Database migrations altering shared tables or RLS policies belong in `security/hardening` or a dedicated migration branch reviewed against Stage 14 Supabase standards.

### Anti-Pattern 3: "Drive-By" Refactoring
* **Problem**: A developer working on `feature/upload-pipeline` decides to rewrite date formatting utilities or adjust dashboard charts.
* **Rule**: Keep PRs focused. If a shared utility needs improvement, propose an isolated `refactor/*` or `chore/*` branch first.

### Anti-Pattern 4: Hidden Tariff Adjustments
* **Problem**: Embedding hardcoded tariff rates or modifying TOU slot definitions inside `feature/reconciliation-engine`.
* **Rule**: Reconciliation must consume tariffs strictly via the interface provided by `feature/tariff-engine`. Tariffs are never hardcoded inside calculation engines.

---

## 4. Pre-Commit & Pre-Merge Isolation Checklist

Before any branch is merged into `develop`, verify:

1. [ ] **Single Purpose**: Does this branch address only its stated architectural responsibility?
2. [ ] **File Scope Check**: Are all modified files within the branch's permitted domain boundary?
3. [ ] **No Schema Bleed**: Does this branch avoid sneaking unrelated SQL migrations or RLS changes?
4. [ ] **No Hardcoded Overrides**: Are cross-domain inputs (e.g. tariffs, telemetry) consumed via published interfaces, not embedded constants?
5. [ ] **Zero Regression**: Does `npm test` and `npx tsc --noEmit` pass with zero errors?
