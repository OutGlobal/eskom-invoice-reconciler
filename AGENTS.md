<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## ENERA Public Disclosure Model & Information Governance (Stage 18)

All agents, developers, and code generators working in this repository must strictly adhere to the **Three-Tier Public Disclosure Model**:

### LEVEL 1 — PUBLIC (Safe to Explain)

Safe to explain in full detail across public pages, components, and documentation:

- capabilities, outcomes, use cases, benefits, industries, workflows, reporting
- energy intelligence, billing intelligence, reconciliation, anomaly identification, consumption analysis, financial visibility
- public messaging must communicate: **WHAT ENERA DOES**, not how it is implemented.

### LEVEL 2 — CONTROLLED (High-Level Only)

Only explain at a high, conceptual level:

- data processing, AI-assisted analysis, integrations
- security approach, data handling, evidence, auditability
- never provide low-level code snippets, parse logic, or internal pipelines in public content.

### LEVEL 3 — PRIVATE (Strict Zero-Exposure Embargo)

Never expose publicly on any website page, public route, demo interface, DOM attribute, or client bundle:

- source code, database schemas (e.g. `public.invoices`, `public.meter_readings`)
- API endpoints (e.g. `/api/v1/*`), internal URLs, or webhook endpoints
- secrets, passwords, tokens, JWTs, or environment variables
- authentication implementation, security architecture, or network topologies
- internal algorithms, model prompts, system prompts, or internal thresholds
- infrastructure topology, cloud project IDs, internal IDs, or database hostnames
- Supabase configuration or server configurations
