# ENERA Public Disclosure Model & Information Classification Standard

**Classification Version:** 1.0  
**Effective Date:** September 2026  
**Status:** Canonical Platform Policy  
**Target Audience:** Engineering, Product, Marketing, Security, External Auditors, and Client Reviewers

---

## 1. Objective & Philosophy

ENERA operates at the intersection of critical utility infrastructure, enterprise treasury operations, and large-scale industrial telemetry. Transparency and institutional trust are foundational to our mission. However, protecting enterprise client confidentiality, infrastructure integrity, and proprietary analytical methods requires strict boundaries on information disclosure.

This standard establishes the **Three-Tier Public Disclosure Model** governing all public-facing communication, including the public website, marketing materials, API documentation, client demos, repository documentation, and AI agent outputs.

> **Guiding Principle:**  
> The public surface communicates **WHAT ENERA DOES**, never **HOW ENERA IS INTERNALLY IMPLEMENTED**.

---

## 2. The Three-Tier Classification

```
┌────────────────────────────────────────────────────────┐
│                   LEVEL 1 — PUBLIC                     │
│               Safe to Explain in Detail                │
├────────────────────────────────────────────────────────┤
│                 LEVEL 2 — CONTROLLED                   │
│          High-Level Conceptual Explanation Only        │
├────────────────────────────────────────────────────────┤
│                   LEVEL 3 — PRIVATE                    │
│             Strict Zero-Exposure Embargo               │
└────────────────────────────────────────────────────────┘
```

---

### LEVEL 1 — PUBLIC (Safe to Explain)

Level 1 information describes the business value, functional capabilities, operational workflows, and domain outcomes of the ENERA platform. It is fully approved for public websites, whitepapers, press releases, conference presentations, and general sales collateral.

#### Approved Scope & Categories:

- **Capabilities:** High-level platform abilities (e.g., automated invoice audit, interval meter cross-referencing, tariff validation).
- **Outcomes:** Business results (e.g., billing variance resolution, overcharge recovery dossiers, variance visibility).
- **Use Cases:** Practical application contexts (e.g., industrial plants, commercial real estate portfolios, municipal power buyers).
- **Benefits:** Strategic value (e.g., audit readiness, reduced treasury disputes, automated invoice verification).
- **Industries:** Target sectors (e.g., Mining, Manufacturing, Real Estate, Municipal Distributors, Agriculture).
- **Workflows:** High-level operational stages (e.g., _Energy data → Consumption → Billing → Cost → Insight → Decision_).
- **Reporting:** Description of executive outputs (e.g., board packs, variance reports, dispute packs, audit trails).
- **Energy Intelligence:** Granular understanding of power consumption across peak, standard, and off-peak periods.
- **Billing Intelligence:** Understanding utility rate structures, seasonal adjustments, and statutory levies.
- **Reconciliation:** Comparative verification between physical meter registers and billed charges.
- **Anomaly Identification:** Identifying unexplained load spikes, missing data intervals, and rate misalignment.
- **Consumption Analysis:** Baseload characterization, load factor calculations, and power factor analysis.
- **Financial Visibility:** Portfolio-wide view of energy expenditure, budget variance, and recovery potential.

---

### LEVEL 2 — CONTROLLED (High-Level Explanation Only)

Level 2 covers technical methodologies, operational architecture, and security governance. These topics may be discussed publicly **only at a conceptual, high level**. Deep technical details, specific configurations, or implementation mechanics are restricted to qualified enterprise prospects under mutual non-disclosure agreements (NDAs).

#### Controlled Scope & Rules of Engagement:

- **Data Processing:**
  - _Allowed:_ Explain that interval data is cleaned, validated, aligned to 30-minute intervals, and reconciled against official tariff schedules.
  - _Prohibited:_ Revealing specific parsing scripts, regex patterns, internal data pipelines, or ETL worker code.
- **AI-Assisted Analysis:**
  - _Allowed:_ Explain that AI functions as an analytical query assistant to highlight trends, summarize billing variances, and surface priority investigations.
  - _Prohibited:_ Revealing system prompts, LLM model configurations, temperature settings, agent orchestration, or prompt engineering frameworks.
- **Integrations:**
  - _Allowed:_ State compatibility with standard AMR/AMI meter data formats (CSV, MV-90, Excel) and official utility invoice formats.
  - _Prohibited:_ Exposing internal webhook endpoints, ingress authentication tokens, webhook handlers, or third-party service credentials.
- **Security Approach:**
  - _Allowed:_ Reference adherence to industry standards, role-based access control (RBAC), tenant isolation, and encrypted transit (TLS 1.3).
  - _Prohibited:_ Disclosing firewall configurations, VPC topologies, IAM policy JSON, or penetration test findings.
- **Data Handling:**
  - _Allowed:_ Emphasize tenant data segregation, cryptographic integrity checks, and data retention policies.
  - _Prohibited:_ Describing underlying physical storage topology, replica locations, or object storage bucket names.
- **Evidence:**
  - _Allowed:_ Describe that every finding is linked to underlying meter interval readings and gazetted tariff schedules.
  - _Prohibited:_ Sharing proprietary mathematical formulas or exact internal heuristics used to calculate confidence scores.
- **Auditability:**
  - _Allowed:_ Explain that ENERA generates immutable audit dossiers suitable for submission to utility dispute resolution processes.
  - _Prohibited:_ Revealing internal database schema structures, foreign key linkages, or raw table logs.

---

### LEVEL 3 — PRIVATE (Strict Zero-Exposure Embargo)

Level 3 encompasses internal technical implementations, credentials, and infrastructure configurations. **Under no circumstances may Level 3 information be published on the public website, embedded in client-side bundles, checked into public repositories, or included in unvetted outward communications.**

#### Strictly Prohibited Items:

1. **Source Code:** Proprietary business logic, algorithmic engines, and internal libraries.
2. **Database Schemas:** Raw table names (`public.*`), column definitions, foreign keys, and DDL scripts.
3. **API Endpoints:** Internal REST/RPC routes, private ingestion URLs, and microservice paths.
4. **Secrets & Keys:** Service role keys, database connection strings, JWT signing secrets, API tokens, and webhook secrets.
5. **Environment Variables:** Configuration names and values (`DATABASE_URL`, `SUPABASE_SERVICE_KEY`, etc.).
6. **Authentication Implementation:** Internal session token structures, refresh flows, and auth hook scripts.
7. **Security Architecture:** Internal network diagrams, subnet topologies, edge proxy routing, and firewall rules.
8. **Internal Algorithms:** Mathematical formulas and heuristics for proprietary anomaly detection and rate modeling.
9. **Model Prompts:** System prompts, role definitions, few-shot examples, and model instructions.
10. **Internal Thresholds:** Exact numerical trigger criteria for anomaly flagging, confidence scores, and heuristic weights.
11. **Infrastructure Topology:** Cloud provider project IDs, server regions, internal hostnames, and IP ranges.
12. **Internal IDs:** Database UUIDs, tenant internal primary keys, and internal storage bucket references.
13. **Supabase Configuration:** Project references, database credentials, PostgREST settings, and storage buckets.
14. **Server Configuration:** Nginx/Caddy configurations, Nitro worker settings, Docker compose internals, and container orchestrations.

---

## 3. Implementation & Verification Matrix

| Area                       | Level 1 (Public)              | Level 2 (Controlled)         | Level 3 (Private)                   |
| -------------------------- | ----------------------------- | ---------------------------- | ----------------------------------- |
| **Marketing Website**      | Unrestricted; primary focus   | High-level summary only      | **STRICTLY FORBIDDEN**              |
| **Product Previews**       | Synthetic demonstration data  | High-level capability flows  | Real tenant data, internal URLs     |
| **Documentation (Public)** | Getting started, user guides  | High-level architecture      | Schema DDL, internal APIs, keys     |
| **Source Repositories**    | Public descriptions, licenses | Abstract interfaces          | Plaintext secrets, prod credentials |
| **Sales & Briefings**      | Standard enterprise deck      | Architecture brief under NDA | Source code, raw prompt engineering |
| **Agent / AI Assistance**  | Full public explanation       | Conceptual summaries only    | Never disclose or generate in UI    |

---

## 4. Pre-Publication Security Audit Checklist

Before releasing any public-facing page, component, or documentation, engineers and reviewers must verify:

- [ ] **Zero Database Exposure:** No occurrences of raw table names (`public.*`, `invoices`, `meter_readings`) or database connection strings.
- [ ] **Zero Endpoint Exposure:** No internal REST URLs (`/api/v1/*`), port numbers, or webhook destination URLs.
- [ ] **Zero Project / Host Exposure:** No cloud project IDs, internal domain names, or database hostnames.
- [ ] **Zero Prompt / Model Leak:** No system instructions, LLM role prompts, or model configurations in DOM or bundles.
- [ ] **Synthetic Data Only:** All displayed entities, meter serials, and invoice figures are purely synthetic demonstration records.
- [ ] **Outcome-First Copy:** Copy focuses on what the capability delivers to the customer, not the underlying technical mechanism.

---

## 5. Governance & Incident Response

Any accidental exposure of Level 3 information on a public surface constitutes a high-priority security event. Remediation protocol:

1. **Immediate Quarantine:** Revert or deploy an immediate hotfix to sanitize the exposed surface.
2. **Credential Rotation:** If secrets, tokens, or connection strings were exposed, immediately revoke and rotate them in production.
3. **Commit Scrubbing:** For version-controlled repositories, ensure no active references remain on public branches.
4. **Post-Incident Review:** Update automated regression tests to prevent recurrences of the specific disclosure pattern.
