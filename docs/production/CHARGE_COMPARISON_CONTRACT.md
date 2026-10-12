# Invoice charge reconciliation boundary

Inspected `feature/tariff-engine` at 7dbc3ef. Its public module exports the deterministic tariff engine and version types but no standalone applicable-rate provider yet. This change defines the consumer contract; it does not merge tariff branch code or guess rate selection rules.

Flow: tariff provider → normalized applicable rate with version/rule/source evidence → `compareInvoiceCharge` → traceable comparison row.

The tariff branch must implement `ApplicableRateProvider.resolveApplicableRate`. It owns account/date/season/TOU selection, cents-to-currency conversion, quantity units and currency. A returned rate must apply to the full requested period; split rows in that provider/caller when tariffs change within a period. Percentage, tiered, ratcheted or composite charges need appropriately normalized quantities/rates or a future explicit formula contract; do not treat them as flat rates implicitly.

Each row contains description, billed/expected quantity, billed/expected rate, billed/expected amount, signed variance, variance percent, status and invoice/quantity/tariff evidence. Amounts round HALF_UP to two decimals. Variance is billed minus expected; percentage denominator is absolute expected amount and is null for zero expected. Missing quantities/rates/evidence leave the row unresolved with reason codes. Missing billed quantity/rate remain null rather than inferred from totals. No tolerance threshold or tariff value is embedded here.

This is an additive engine interface, not a replacement of legacy reconciliation paths or a UI integration. Legacy tariff/VAT behaviour elsewhere is unchanged. Consumer must supply stable row IDs and real source locators. No database migration or production deployment is required by this interface-only PR.

Run `npm run test:charges`. The build gate includes these checks.
