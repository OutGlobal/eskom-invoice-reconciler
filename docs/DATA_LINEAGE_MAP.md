# ENERA Authoritative Internal Data Lineage Map

> **Operational Engineering Standard & Provenance Catalog**  
> **Core Principle**: For every number shown anywhere in ENERA, the engineering team must be able to deterministically answer:  
> **"Where did this number come from?"**

---

## 1. Architectural Provenance Model

Every number rendered in the ENERA Command Centre, reports, and analytical views traces through a verified, immutable data pipeline:

$$\text{UPLOAD} \longrightarrow \text{STORE} \longrightarrow \text{PROCESS} \longrightarrow \text{RECONCILE} \longrightarrow \text{ANALYSE} \longrightarrow \text{SAVE} \longrightarrow \text{DISPLAY}$$

No synthetic mocks, no hardcoded fallbacks, and no manual database interventions are permitted. If a database record does not exist, the metric evaluates to zero or surfaces an authentic empty state.

---

## 2. Canonical Top-Down Provenance Hierarchies

### Example A: Total Energy Cost

```text
Dashboard
   ↓
Total Energy Cost
   ↓
Reconciliation Results
   ↓
Invoice Charges
   ↓
Invoice Record
   ↓
Uploaded PDF
```

- **UI Metric**: Total Billed Energy Cost (`cmd_total_billed_amount`)
- **Presentation Layer**: Command Centre Header & Portfolio KPI Summary
- **Aggregation Layer**: `DashboardService.getAggregatedDashboardData` $\rightarrow$ `queryDatabaseAggregates`
- **Reconciliation Layer**: `reconciliation_runs` & line-item variance evaluation
- **Unbundled Charges**: `invoice_line_items` (Active energy, Demand, Network, Levies)
- **Persistent Header**: `invoice_records.invoiced_total` (with SHA-256 document fingerprint)
- **Source Byte Stream**: Tenant-isolated file store `tenants/:orgId/uploads/:uplId/eskom_invoice.pdf`

---

### Example B: Actual kWh (Active Energy Consumption)

```text
Dashboard
   ↓
Actual kWh
   ↓
Monthly Energy Aggregation
   ↓
Validated Interval Data
   ↓
AMR CSV
   ↓
Original Uploaded File
```

- **UI Metric**: Total Active Energy Consumed (`cmd_total_energy`)
- **Presentation Layer**: Energy & Demand Determinants Overview Card
- **Aggregation Layer**: Sum of Peak, Standard, and Off-Peak interval buckets across the billing cycle
- **Deterministic Time-Series**: `telemetry_intervals` (30-minute interval readings mapped to SAST)
- **Validation Stage**: Data Quality Engine (Stage 11) unit normalization ($kW \times 0.5h \rightarrow kWh$)
- **Ingestion Parser**: `AmrIntervalIngestionEngine.processIntervalStream`
- **Source Byte Stream**: Tenant-isolated file store `tenants/:orgId/uploads/:uplId/telemetry.csv`

---

### Example C: Reconciled Tariff Total

```text
Dashboard
   ↓
Total Calculated Amount
   ↓
Deterministic Tariff Calculation
   ↓
Gazetted NERSA Tariff Rate Schedule
   ↓
Tariff Version Definition
   ↓
Gazetted Schedule of Standard Prices
```

- **UI Metric**: Total Recalculated Amount (`cmd_total_calculated_amount`)
- **Presentation Layer**: Financial Impact Summary
- **Deterministic Engine**: `DeterministicTariffEngine.calculate` using arbitrary-precision `Decimal`
- **Applied Rules**: High/Low season TOU calendar slots, voltage surcharges, transmission zone factors
- **Gazetted Catalog**: `tariff_versions` (e.g. Megaflex 2025/2026, Miniflex, Ruraflex)
- **Regulatory Foundation**: NERSA Approved Eskom Schedule of Standard Prices

---

### Example D: Net Billing Variance

```text
Dashboard
   ↓
Net Variance
   ↓
Deterministic Discrepancy Engine
   ↓
Extracted Billed Charges vs Calculated Tariff Determinants
   ↓
Harmonized Invoice Record & AMR Readings
   ↓
Uploaded Tax Invoice PDF & Telemetry CSV
```

- **UI Metric**: Net Variance Amount (`cmd_net_variance`)
- **Presentation Layer**: Command Centre Variance Badge & Dispute Dossier
- **Calculation**: $\text{Variance} = \text{Total Billed} - \text{Total Calculated}$
- **Significance**: Positive value denotes potential utility overcharge eligible for formal dispute claim.

---

### Example E: Maximum Demand (kVA)

```text
Dashboard
   ↓
Maximum Demand (kVA)
   ↓
Monthly Maximum Demand High-Water Mark
   ↓
30-Minute Interval Apparent Power Peaks
   ↓
AMR Telemetry Stream (kVA Imp)
   ↓
Original Uploaded File
```

- **UI Metric**: Max Demand kVA (`cmd_max_demand`)
- **Presentation Layer**: Maximum Demand Metric Box
- **Calculation**: High-water mark maximum of apparent power ($S = \sqrt{P^2 + Q^2}$) across standard/peak billing hours
- **Source Attribute**: `invoice_records.max_demand_kva` & `telemetry_intervals.apparent_power_kva`

---

### Example F: Average Power Factor ($\cos \varphi$)

```text
Dashboard
   ↓
Average Power Factor (PF)
   ↓
Vector Power Factor Calculation: kWh / √(kWh² + kVARh²)
   ↓
Integrated Active & Reactive Energy Determinants
   ↓
Validated 30-Minute Telemetry Intervals
   ↓
Original Uploaded File
```

- **UI Metric**: Average Power Factor (`cmd_average_power_factor`)
- **Presentation Layer**: Power Factor Metric Box
- **Calculation**: Trigonometric cosine derivation bounded in $[0, 1.0]$. Values below $0.96$ trigger reactive energy penalty analysis.

---

### Example G: Potential Financial Recovery

```text
Dashboard
   ↓
Potential Recovery
   ↓
Overbilling Discrepancy Aggregator
   ↓
Itemized Charge Variances (where Billed > Tariff)
   ↓
Reconciliation Results & Determinant Line Items
   ↓
Uploaded Tax Invoice PDF
```

- **UI Metric**: Potential Recovery ZAR (`cmd_potential_recovery`)
- **Presentation Layer**: Financial Recovery Register Card
- **Calculation**: Sum of discrete positive determinant discrepancies where billed line item exceeded gazetted tariff rule.

---

### Example H: Telemetry Health Quality Score

```text
Telemetry View
   ↓
Telemetry Health Quality Score (%)
   ↓
Data Quality Engine (Stage 11)
   ↓
Interval Quality Flags (VALID_MEASURED, ESTIMATED, SUSPECT)
   ↓
Normalized 30-Minute Intervals
   ↓
Raw AMR Telemetry Stream
   ↓
Original Uploaded File
```

- **UI Metric**: Quality Score (`telemetry_health_score`)
- **Presentation Layer**: Telemetry Page Health Banner
- **Calculation**: Ratio of clean measured intervals to total expected interval count for the billing period.

---

## 3. Comprehensive Metric Provenance Directory

| Metric ID                     | Display Name            | Category        | Database Source                         | Provenance Hierarchy Top $\rightarrow$ Bottom                                                                                                                                |
| ----------------------------- | ----------------------- | --------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cmd_total_clients`           | Total Clients           | PORTFOLIO       | `organisations.id`                      | Dashboard $\rightarrow$ Total Clients $\rightarrow$ Organisation Directory $\rightarrow$ Tenant Isolation Context                                                            |
| `cmd_total_sites`             | Total Sites             | PORTFOLIO       | `sites.id`                              | Dashboard $\rightarrow$ Total Sites $\rightarrow$ Point of Delivery (POD) Records $\rightarrow$ Facility Hierarchy                                                           |
| `cmd_total_accounts`          | Total Accounts          | PORTFOLIO       | `invoice_records.account_number`        | Dashboard $\rightarrow$ Total Accounts $\rightarrow$ Deduplicated Account Registry $\rightarrow$ Invoiced Accounts                                                           |
| `cmd_total_invoices`          | Total Invoices          | PORTFOLIO       | `invoice_records.id`                    | Dashboard $\rightarrow$ Total Invoices $\rightarrow$ Ingestion Registry $\rightarrow$ Uploaded Document Ledger                                                               |
| `cmd_total_billed_amount`     | Total Energy Cost       | FINANCIAL       | `invoice_records.invoiced_total`        | Dashboard $\rightarrow$ Total Energy Cost $\rightarrow$ Reconciliation Results $\rightarrow$ Invoice Charges $\rightarrow$ Invoice Record $\rightarrow$ Uploaded PDF         |
| `cmd_total_calculated_amount` | Total Calculated        | FINANCIAL       | `invoice_records.reconciled_total`      | Dashboard $\rightarrow$ Calculated Cost $\rightarrow$ Deterministic Tariff Engine $\rightarrow$ NERSA Schedule $\rightarrow$ Gazette                                         |
| `cmd_net_variance`            | Net Variance            | FINANCIAL       | `invoice_records.variance_amount`       | Dashboard $\rightarrow$ Net Variance $\rightarrow$ Reconciliation Engine $\rightarrow$ Delta Engine $\rightarrow$ Invoices & Meters                                          |
| `cmd_potential_recovery`      | Potential Recovery      | FINANCIAL       | `discrepancy_events.financial_impact`   | Dashboard $\rightarrow$ Potential Recovery $\rightarrow$ Discrepancy Aggregator $\rightarrow$ Overcharge Schedules $\rightarrow$ Invoices                                    |
| `cmd_total_energy`            | Actual kWh              | ENERGY_OVERVIEW | `invoice_records.total_kwh`             | Dashboard $\rightarrow$ Actual kWh $\rightarrow$ Monthly Energy Aggregation $\rightarrow$ Validated Interval Data $\rightarrow$ AMR CSV $\rightarrow$ Original Uploaded File |
| `cmd_peak_energy`             | Peak Energy (kWh)       | ENERGY_OVERVIEW | `invoice_records.peak_kwh`              | Dashboard $\rightarrow$ Peak kWh $\rightarrow$ TOU Peak Aggregator $\rightarrow$ Peak Intervals $\rightarrow$ AMR CSV                                                        |
| `cmd_standard_energy`         | Standard Energy (kWh)   | ENERGY_OVERVIEW | `invoice_records.standard_kwh`          | Dashboard $\rightarrow$ Standard kWh $\rightarrow$ TOU Standard Aggregator $\rightarrow$ Standard Intervals $\rightarrow$ AMR CSV                                            |
| `cmd_off_peak_energy`         | Off-Peak Energy (kWh)   | ENERGY_OVERVIEW | `invoice_records.off_peak_kwh`          | Dashboard $\rightarrow$ Off-Peak kWh $\rightarrow$ TOU Off-Peak Aggregator $\rightarrow$ Off-Peak Intervals $\rightarrow$ AMR CSV                                            |
| `cmd_max_demand`              | Maximum Demand (kVA)    | ENERGY_OVERVIEW | `invoice_records.max_demand_kva`        | Dashboard $\rightarrow$ Max Demand $\rightarrow$ High-Water Peak Engine $\rightarrow$ kVA Readings $\rightarrow$ AMR CSV                                                     |
| `cmd_reactive_energy`         | Reactive Energy (kVARh) | ENERGY_OVERVIEW | `invoice_records.reactive_energy_kvarh` | Dashboard $\rightarrow$ Reactive Energy $\rightarrow$ kVAR Accumulation $\rightarrow$ Reactive Channel $\rightarrow$ AMR File                                                |
| `cmd_average_power_factor`    | Average Power Factor    | ENERGY_OVERVIEW | Derived ($P$ and $Q$)                   | Dashboard $\rightarrow$ Power Factor $\rightarrow$ Vector Trigonometry $\rightarrow$ Active/Reactive Energy $\rightarrow$ AMR File                                           |
| `cmd_recon_success_rate`      | Success Rate (%)        | RECON_HEALTH    | `reconciliation_runs.status`            | Dashboard $\rightarrow$ Success Rate $\rightarrow$ Run Status Aggregator $\rightarrow$ Pipeline Workers $\rightarrow$ Jobs                                                   |
| `cmd_disputed_amount`         | Disputed Amount         | FINANCIAL       | `dispute_packs.disputed_amount`         | Dashboard $\rightarrow$ Disputed Amount $\rightarrow$ Dispute Packs $\rightarrow$ Audit Claims $\rightarrow$ Reconciliation                                                  |
| `cmd_recovered_credit`        | Recovered Credit        | FINANCIAL       | `dispute_packs.recovered_amount`        | Dashboard $\rightarrow$ Recovered Credit $\rightarrow$ Credit Note Settlements $\rightarrow$ Eskom Dispute Pack                                                              |
| `telemetry_health_score`      | Telemetry Health Score  | TELEMETRY       | `telemetry_intervals.quality_state`     | Telemetry View $\rightarrow$ Health Score $\rightarrow$ Quality Engine $\rightarrow$ Interval Validations $\rightarrow$ AMR CSV                                              |
| `anomaly_financial_impact`    | Anomaly Impact (ZAR)    | ANOMALY         | `discrepancy_events.financial_impact`   | Anomaly View $\rightarrow$ Discrepancy Impact $\rightarrow$ Diagnostics Engine $\rightarrow$ Variance Trace $\rightarrow$ PDF/AMR                                            |

---

## 4. Programmatic Lineage Query API

Engineering teams can query the exact lineage of any number at runtime or in automated test suites using [`ContractDataLineageMap`](file:///Users/admin/Desktop/Eskom%20Bill%20Balancer/src/domain/lineage/contractDataLineageMap.ts):

```typescript
import { ContractDataLineageMap } from "@/domain/lineage/contractDataLineageMap";

// Query by natural language name:
const costTrace = ContractDataLineageMap.traceNumberOrigin("Total Energy Cost");
console.log(costTrace);
/*
Dashboard
   ↓
Total Energy Cost
   ↓
Reconciliation Results
   ↓
Invoice Charges
   ↓
Invoice Record
   ↓
Uploaded PDF
*/

// Query by metric ID or alias:
const kwhTrace = ContractDataLineageMap.traceNumberOrigin("Actual kWh");
console.log(kwhTrace);
/*
Dashboard
   ↓
Actual kWh
   ↓
Monthly Energy Aggregation
   ↓
Validated Interval Data
   ↓
AMR CSV
   ↓
Original Uploaded File
*/

// Fetch formal machine-readable contract:
const contract = ContractDataLineageMap.resolveMetric("cmd_total_billed_amount");
console.log(contract.source); // PostgreSQL Database via Supabase Client
console.log(contract.table); // invoice_records
console.log(contract.column); // invoiced_total
```

---

## 5. Security & Governance (Stage 18 Compliance)

This internal Data Lineage Map adheres to the **Three-Tier Public Disclosure Model**:

- **Level 1 (Public)**: Explains the _functional outcome_ (e.g. "Every number is verified against authoritative meter readings and invoices").
- **Level 2 (Controlled)**: Explains _high-level architecture_ (e.g. "Data flows through automated validation, unit normalization, and NERSA rate calculation").
- **Level 3 (Private - Strict Embargo)**: Physical table names (`invoice_records`, `telemetry_intervals`), raw SQL queries, and internal storage paths documented here are **restricted to internal engineering tiers** and must never be rendered into public DOM attributes, public URLs, or unauthenticated client-side bundles.
