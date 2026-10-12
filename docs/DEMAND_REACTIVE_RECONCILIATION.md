# Demand and reactive quantity reconciliation

The reconciliation domain now exposes `reconcileDemandReactive` and accepts explicit evidence through `ReconciliationEngine.reconcileInvoice`'s `demand_reactive` input. Results are returned as `quantity_comparisons`, separate from monetary line items. Significant differences affect the run status; unresolved evidence requires review. No monetary reactive penalty is calculated by this quantity module or by the invoice reconciliation audit path.

## Contract

- Supply a versioned rule and an invoice quantity for each requested maximum, TOU, notified, or utilised determinant. Units must match the rule.
- Interval maximum is an explicit method, not a default. No implicit kW/kVA conversion occurs.
- TOU inputs must be classified by the tariff calendar. Missing classification is unresolved.
- Configured capacity supports independently sourced notified demand. A tariff evaluator supports averaging windows, ratchets, historical determinants and other supplied tariff methodologies. The caller owns validation of coverage, units, meter identity and billing-period boundaries before supplying intervals.
- Missing/invalid selected interval values are unresolved, never zero or invoice-derived matches.
- Supply reactive AMR totals for the same meter, period and import/export convention as the invoice, and explicitly assert comparability. AMR power factor uses the configured energy-vector method; this is not an arithmetic average of interval power factors. Zero active and reactive energy leaves PF undefined.
- Tolerances are absolute quantity thresholds and relative fractions. A difference is significant only if both are exceeded; a zero invoice denominator has no relative percentage and uses the absolute threshold.
- Quantity results retain billed/calculated values, signed variance, rule identity/version and unresolved reasons. Missing values remain null.

## Integration boundary

This change adds the domain contract and integrates the `ReconciliationEngine.reconcileInvoice` entry point. Callers must supply `demand_reactive` to select applicable methods; the legacy peak quantity is not silently treated as the billing method. Without explicit scope evidence, reactive comparison requires review. Other legacy `DeterministicReconciliationEngine` entry points, ingestion adapters, database schemas and UI rendering are not migrated here. Tariff monetary calculations are not modified; penalty-rule implementation remains owned by the Tariff Engine.
