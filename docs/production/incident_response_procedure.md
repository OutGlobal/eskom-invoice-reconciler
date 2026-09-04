# Incident Response Standard Operating Procedure (SOP)

## 1. Incident Severity Definitions

- **P0 (Critical Outage / Discrepancy):** Financial calculation error resulting in incorrect dispute pack output, platform downtime, or data loss.
- **P1 (Major Issue):** Ingestion pipeline failure, OCR extraction performance degradation (>15s), or single-tenant connectivity issues.
- **P2 (Minor Issue):** Non-blocking UI layout bug or minor telemetry warning.

---

## 2. Escalation & Response Triage Matrix

```
[ ALERT DETECTED ] ──▶ [ INCIDENT COMMANDER ] ──▶ [ TRIAGE & DIAGNOSIS ]
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
           [ P0: CALCULATION ERROR ]                                           [ P1: INGESTION STALL ]
   • Pause auto-dispute generation                                      • Re-queue ingestion job
   • Freeze reconciliation approvals                                    • Run stream diagnostic worker
   • Execute emergency hotfix / rollback                                • Notify site administrator
```

### Response Actions
1. **Immediate Lockdown:** If a calculation discrepancy is detected, update `reconciliation_settings` to set `require_manual_approval = true`.
2. **Investigation & Diagnosis:** Run `npx tsx src/lib/__tests__/run-tests.ts` locally to reproduce deterministic engine state.
3. **Hotfix & Deployment:** Apply fix, run full test suite gate (`npm test`), and deploy fix commit.
4. **Post-Mortem:** Publish formal RCA report within 24 hours documenting root cause, financial impact, and preventative actions.
