/**
 * Authoritative Reconciliation Regression Test Fixtures
 * Contains known-good gazetted invoice fixtures for automated regression testing.
 * Every billing determinant is explicitly checked.
 */

import Decimal from "decimal.js-light";
import { ESKOM_MEGAFLEX_2025_2026, ESKOM_MINIFLEX_2025_2026, MUNICIPAL_COJ_BULK_2025_2026 } from "../tariff/tariffFixtures";

export interface RegressionFixture {
  fixture_code: string;
  fixture_name: string;
  utility: string;
  tariff_version: any;
  billing_start: string;
  billing_end: string;
  invoice_inputs: {
    invoice_number: string;
    account_number: string;
    peak_kwh: Decimal;
    standard_kwh: Decimal;
    off_peak_kwh: Decimal;
    total_kwh: Decimal;
    maximum_demand_kva: Decimal;
    ratcheted_demand_kva: Decimal;
    reactive_energy_kvarh: Decimal;
    energy_charges_zar: Decimal;
    demand_charges_zar: Decimal;
    network_charges_zar: Decimal;
    service_charges_zar: Decimal;
    ancillary_charges_zar: Decimal;
    vat_zar: Decimal;
    total_invoice_zar: Decimal;
  };
  expected_results: {
    classification: "PASS" | "WARNING" | "DISCREPANCY" | "CRITICAL";
    total_calculated_zar: Decimal;
    total_variance_zar: Decimal;
  };
}

export const MEGAFLEX_JULY_2025_FIXTURE: RegressionFixture = {
  fixture_code: "FIX_MEGA_JUL_2025",
  fixture_name: "Eskom Megaflex Urban July 2025 (High Season)",
  utility: "Eskom",
  tariff_version: ESKOM_MEGAFLEX_2025_2026,
  billing_start: "2025-07-01",
  billing_end: "2025-07-31",
  invoice_inputs: {
    invoice_number: "INV-2025-07-MEGA01",
    account_number: "ACC-987654321",
    peak_kwh: new Decimal("100000"),
    standard_kwh: new Decimal("250000"),
    off_peak_kwh: new Decimal("150000"),
    total_kwh: new Decimal("500000"),
    maximum_demand_kva: new Decimal("1200"),
    ratcheted_demand_kva: new Decimal("1200"),
    reactive_energy_kvarh: new Decimal("50000"),
    energy_charges_zar: new Decimal("1330745.00"), // 100k*6.6692 + 250k*1.9884 + 150k*1.1115 = 666,920 + 497,100 + 166,725
    demand_charges_zar: new Decimal("51420.00"), // 1200 kVA * 42.85
    network_charges_zar: new Decimal("77640.00"), // 1200 kVA * (28.50 + 36.20)
    service_charges_zar: new Decimal("5750.50"), // 185.50 * 31 days
    ancillary_charges_zar: new Decimal("13200.00"), // 500k kWh * (0.68 + 1.96) c/kWh / 100
    vat_zar: new Decimal("221813.33"), // 15% VAT on 1,478,755.50
    total_invoice_zar: new Decimal("1700568.83"),
  },
  expected_results: {
    classification: "PASS",
    total_calculated_zar: new Decimal("1700568.83"),
    total_variance_zar: new Decimal("0.00"),
  },
};

export const MINIFLEX_OCT_2025_FIXTURE: RegressionFixture = {
  fixture_code: "FIX_MINI_OCT_2025",
  fixture_name: "Eskom Miniflex Low Season October 2025",
  utility: "Eskom",
  tariff_version: ESKOM_MINIFLEX_2025_2026,
  billing_start: "2025-10-01",
  billing_end: "2025-10-31",
  invoice_inputs: {
    invoice_number: "INV-2025-10-MINI01",
    account_number: "ACC-123456789",
    peak_kwh: new Decimal("20000"),
    standard_kwh: new Decimal("50000"),
    off_peak_kwh: new Decimal("30000"),
    total_kwh: new Decimal("100000"),
    maximum_demand_kva: new Decimal("300"),
    ratcheted_demand_kva: new Decimal("300"),
    reactive_energy_kvarh: new Decimal("5000"),
    energy_charges_zar: new Decimal("147776.00"),
    demand_charges_zar: new Decimal("7251.00"),
    network_charges_zar: new Decimal("10794.00"),
    service_charges_zar: new Decimal("34672.26"),
    ancillary_charges_zar: new Decimal("390.00"),
    vat_zar: new Decimal("30132.49"),
    total_invoice_zar: new Decimal("231015.75"),
  },
  expected_results: {
    classification: "PASS",
    total_calculated_zar: new Decimal("231015.75"),
    total_variance_zar: new Decimal("0.00"),
  },
};

export const REGRESSION_FIXTURES: RegressionFixture[] = [
  MEGAFLEX_JULY_2025_FIXTURE,
  MINIFLEX_OCT_2025_FIXTURE,
];
