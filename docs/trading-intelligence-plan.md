# ENERA Trading Intelligence — implementation plan (MoT)
## Confirmed repository observations
- TanStack Start/Router + React 19 + TypeScript; Supabase JS; Vercel deployment.
- Existing `src/routes/energy.tsx` is customer consumption/invoice analytics, not a trading ledger.
- Existing build script runs enterprise, security and charge tests before Vite build.
- Root layout includes AuthGate; new `/trading` route follows the same routing convention.
## Safety and scope
- Feature branch only. Do not alter legacy invoice or meter data, existing migrations, production secrets, billing calculations, or deploy settings.
- Initial route is a local illustrative settlement simulation, not real billing or licensed-market execution.
- Proposed SQL is additive in a separate `trading` schema, NOT applied to the live database.
- No service-role key in frontend; do not expose financial tables before tenant policies and backend authorization are implemented.
## Data design
- Organizations (trader, generator, customer, network operator)
- Meters and immutable interval readings, including timezone and quality
- Versioned PPA, offtake and network contracts
- Settlement runs with frozen input snapshots and calculation version
- Settlement lines for all financial legs, and independently verified payments
## Next engineering milestones
1. Confirm existing organization membership/tenant model and current database migrations.
2. Implement secure server-side import, validation, duplicate handling and meter quality rules.
3. Add interval-matched multi-generator/multi-customer allocation and TOU-aware contract pricing.
4. Add network charges, losses, imbalance and regulatory scheme adapters based on signed agreements.
5. Build draft/review/approve settlement lifecycle and double-entry financial posting with idempotency.
6. Connect ENERA invoice reconciliation, export and dispute workflows using traceable source IDs.
7. Run existing `npm run build`, targeted Vitest, RLS tests and end-to-end regressions in CI before merging.
## Current limitations
The foundation does not calculate statutory wheeling credits, VAT, actual balancing penalties, payment settlement, or real invoices. Its simplistic full-generation PPA payable assumption is illustrative only.
