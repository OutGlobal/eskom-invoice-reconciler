# INTERNAL TECHNICAL SPECIFICATION: FINANCIAL CALCULATION INTEGRITY

> **CONFIDENTIALITY NOTICE — LEVEL 3 PRIVATE EMBARGO**  
> This specification documents internal algorithms, precision requirements, mathematical formulas, and internal tolerance thresholds for the ENERA Energy Intelligence and Utility Reconciliation Engine.  
> **STRICT EMBARGO**: In accordance with the Stage 18 Public Disclosure Model, this document and its contents must NEVER be published on public website routes, exposed in client-side bundles, or rendered in unauthenticated DOM attributes.

---

## 1. Scope & Objectives

The financial integrity of utility billing reconciliations, energy determinant evaluations, tariff ratings, and variance determinations requires complete elimination of floating-point inaccuracies, strict adherence to South African statutory accounting standards, and reproducible determinism across all historical records.

This document formally specifies:

1. **Arbitrary-Precision Arithmetic**: Replacement of unsafe IEEE-754 binary floating-point operations with 28-digit decimal arithmetic.
2. **Database Numeric Schema Types**: Exact PostgreSQL / Supabase column mappings for monetary amounts, determinants, rates, and ratios.
3. **Calculation Precision Rules**: Intermediate working precision vs. persistent stored precision.
4. **Statutory Rounding Rules**: Application of symmetric half-up (`ROUND_HALF_UP`) in compliance with SARS and NERSA mandates.
5. **Variance Tolerance Matrix**: A five-tier governance model distinguishing rounding noise from material overcharges.
6. **Information Governance**: Zero-exposure embargo preventing proprietary calculation leaks.
7. **Historical Reproducibility**: Cryptographic fingerprints and immutability guarantees for historical reconciliations.

---

## 2. Prevention of Unsafe Floating-Point Drift

### 2.1 The Vulnerability of IEEE-754 Binary Floats

Standard JavaScript `number` implementations utilize IEEE-754 double-precision 64-bit binary floating-point representation. Binary floating-point cannot accurately represent decimal fractions such as `0.1`, `0.2`, or `0.05`:

- `0.1 + 0.2 === 0.30000000000000004`
- `100.05 * 100 === 10004.999999999998`
- `1.005.toFixed(2) === "1.00"` (fails statutory half-up rounding, losing 1 cent)

In industrial electricity billing where monthly enterprise invoices exceed R 10,000,000.00 and interval datasets comprise 2,880 to 2,976 15-minute readings per month, compound floating-point drift creates cumulative multi-Rand errors and invalidates audit reproducibility.

### 2.2 The Authoritative Engine Standard

All financial, rate, determinant, and tax calculations MUST be executed through the `FinancialPrecisionEngine` utilizing `Decimal.js-light` initialized with:

```typescript
Decimal.set({
  precision: 28, // IEEE 754 decimal128 standard working precision
  rounding: Decimal.ROUND_HALF_UP, // Symmetric statutory half-up rounding
});
```

---

## 3. Authoritative Database Schema Types

To prevent truncation or overflow during persistence, all database entities in PostgreSQL / Supabase are strictly mapped to defined numeric types:

| Business Domain             | PostgreSQL Type | Precision | Scale | Valid Value Range                        | Example Columns                                                                                |
| --------------------------- | --------------- | --------- | ----- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Monetary Currency (ZAR)** | `NUMERIC(18,2)` | 18        | 2     | $\pm \text{R } 9,999,999,999,999,999.99$ | `billed_total_zar`, `invoiced_amount`, `calculated_total_zar`, `variance_total_zar`, `vat_zar` |
| **Tariff Unit Rates**       | `NUMERIC(18,6)` | 18        | 6     | $\pm 999,999,999,999.999999$             | `rate_value`, `reactive_penalty_rate`, `transmission_rate`                                     |
| **Energy Determinants**     | `NUMERIC(18,4)` | 18        | 4     | $\pm 99,999,999,999,999.9999$            | `peak_kwh`, `standard_kwh`, `off_peak_kwh`, `total_kwh`, `max_demand_kva`, `kvarh`             |
| **Telemetry Measurements**  | `NUMERIC(18,6)` | 18        | 6     | $\pm 999,999,999,999.999999$             | `kw`, `kva`, `kvarh`, `kwh`, `multiplier`                                                      |
| **Variance & Ratios**       | `NUMERIC(8,4)`  | 8         | 4     | $\pm 9,999.9999$                         | `variance_percentage`, `power_factor`                                                          |
| **Statutory Rates**         | `NUMERIC(5,4)`  | 5         | 4     | $\pm 9.9999$                             | `vat_rate` (0.1500), `confidence_score` (1.0000)                                               |

---

## 4. Calculation Precision Hierarchy

Calculations operate within a four-level precision hierarchy:

1. **Intermediate Working Precision (28 Digits)**:
   - Intermediate steps (e.g. interval active power integration, transmission loss factor scaling, demand ratchet calculations, Time-of-Use rate evaluation) maintain 28 decimal digits.
   - Premature rounding is strictly prohibited during multi-stage additions or rate multiplications.

2. **Determinant Precision (4 Decimal Places)**:
   - Evaluated monthly consumption quantities (kWh, kVA, kVARh) are stored at scale 4 (`0.0001` units).

3. **Rate Precision (6 Decimal Places)**:
   - Gazetted tariff prices (e.g., Megaflex Peak energy rate `342.150000 c/kWh` or `3.421500 ZAR/kWh`) are stored at scale 6.

4. **Monetary Settlement Precision (2 Decimal Places)**:
   - All line-item charges, tax obligations, and invoice totals are rounded to exactly 2 decimal places (whole ZAR cents).

---

## 5. Statutory Rounding Rules

### 5.1 The South African Regulatory Mandate

Under the **South African Value-Added Tax Act No. 89 of 1991, Section 65** and NERSA regulatory billing guidelines, financial transactions must follow **symmetric half-up rounding** (`ROUND_HALF_UP`):

- If the fraction to be rounded is $\ge 0.5$ of a cent, round to the next whole cent away from zero.
- If $< 0.5$ of a cent, truncate towards zero.
- Example: `R 100.005` rounds to `R 100.01`. `R 100.004` rounds to `R 100.00`.

### 5.2 Rounding Sequence and Consistency

To avoid the classic "penny rounding discrepancy" (where the sum of rounded line items differs from the rounded sum of items), ENERA enforces the following order of operations:

1. **Line-Item Emission**:
   $$\text{Raw Amount} = \frac{\text{Quantity} \times \text{Rate}}{100} \quad (\text{if rate is c/kWh}) \quad \text{or} \quad \text{Quantity} \times \text{Rate}$$
   $$\text{Rounded Line Item} = \text{roundCurrency}(\text{Raw Amount})$$
2. **Subtotal Summation**:
   $$\text{Subtotal (excl. VAT)} = \sum_{i=1}^{n} \text{Rounded Line Item}_i$$
   The subtotal MUST equal the exact mathematical sum of all rounded line items.
3. **VAT Application**:
   $$\text{VAT Amount} = \text{roundCurrency}(\text{Subtotal (excl. VAT)} \times 0.1500)$$
4. **Total Invoice Amount**:
   $$\text{Total (incl. VAT)} = \text{Subtotal (excl. VAT)} + \text{VAT Amount}$$
5. **Reconciliation Variance**:
   $$\text{Financial Variance} = \text{Billed Total} - \text{Calculated Total}$$

---

## 6. Five-Tier Variance Tolerance Policy

Not all variances indicate overbilling or metering fraud. The engine separates benign rounding differences from material billing errors across five discrete governance tiers:

| Tier       | Name                     | Variance Criteria                                                                            | Status Classification      | System Governance Action                                                                                  |
| ---------- | ------------------------ | -------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Tier 0** | **Immaterial Rounding**  | Absolute $\le \text{R } 0.10$ OR Relative $\le 0.01\%$                                       | `PASS_ROUNDING_ACCEPTABLE` | **Auto-Approved**: Classified as statutory line-item rounding noise. No human action required.            |
| **Tier 1** | **Acceptable Tolerance** | Absolute $\le \text{R } 50.00$ (or component limit) AND Relative $\le 0.50\%$                | `PASS_WITHIN_TOLERANCE`    | **Auto-Approved**: Cleared for standard payment settlement.                                               |
| **Tier 2** | **Non-Material Warning** | Absolute $> \text{R } 50.00$ to $\text{R } 5,000.00$ OR Relative $> 0.50\%$ to $2.00\%$      | `WARNING_FLAGGED`          | **Non-Blocking Flag**: Reconciled with warning; added to monthly auditor review queue.                    |
| **Tier 3** | **Material Discrepancy** | Absolute $> \text{R } 5,000.00$ to $\text{R } 50,000.00$ OR Relative $> 2.00\%$ to $10.00\%$ | `MATERIAL_DISCREPANCY`     | **Settlement Blocked**: Automatic payment hold. System generates dispute dossier.                         |
| **Tier 4** | **Critical Anomaly**     | Absolute $> \text{R } 50,000.00$ OR Relative $> 10.00\%$                                     | `CRITICAL_ANOMALY`         | **System Lock**: Immediate security lock. Flags possible CT/VT multiplier error or incorrect tariff code. |

---

## 7. Information Governance & Zero Public Exposure

In compliance with **Stage 18 Public Disclosure Model**:

- **LEVEL 1 — PUBLIC**: Public marketing materials and web pages may describe _outcomes_: "Automated bill reconciliation, independent tariff calculation, and financial discrepancy detection."
- **LEVEL 2 — CONTROLLED**: Technical overviews may explain conceptual data flow: "Telemetry is validated, energy determinants are matched against gazetted tariffs, and variance thresholds guide human review."
- **LEVEL 3 — PRIVATE (Strict Embargo)**:
  - The exact formulas in Section 5.2.
  - The numerical tolerance thresholds in Section 6.
  - Database schema column names (e.g. `public.reconciliation_runs`).
  - Internal engine code and cryptographic checksum implementations.

Automated CI/CD scanners enforce zero presence of Level 3 constants or schema names on public client routes.

---

## 8. Historical Reproducibility & Immutability

1. **Versioned Calculations**:
   Every reconciliation run records:
   - `engine_version` (e.g. `2.0.0`)
   - `precision_version` (e.g. `28-DP-HALF-UP`)
   - `tariff_version_id` (e.g. `ESKOM_MEGAFLEX_HV_2025_2026`)
   - `calendar_version_id` (e.g. `2025.1`)
2. **Cryptographic Checksum**:
   Each calculation run generates an authoritative SHA-256 fingerprint:
   $$\text{Checksum} = \text{SHA256}(\text{JSON}(\{\text{inputs}, \text{determinants}, \text{rates}, \text{line\_items}, \text{totals}\}))$$
3. **Regression Proof**:
   Locked regression fixtures verify that running the reconciliation on a 10-year-old invoice against its historical tariff version yields identical Rand and cent values down to the second decimal place forever.
