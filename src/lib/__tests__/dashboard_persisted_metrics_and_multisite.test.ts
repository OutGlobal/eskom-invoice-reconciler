/**
 * ENERA Enterprise Test Suite: Dashboard Integration & Multi-Site Support
 * Requirements 34 & 35
 */

import assert from "node:assert";
import Decimal from "decimal.js-light";
import { DashboardService } from "../../domain/dashboard/dashboardService";
import { ReconciliationStorageService } from "../../domain/reconciliation/reconciliationStorageService";
import { InvoiceStorageService } from "../../domain/invoice/invoiceStorageService";
import {
  MultiSiteHierarchyService,
} from "../../domain/organisation/multiSiteHierarchyService";

async function runDashboardAndMultiSiteTests() {
  console.log("==================================================================");
  console.log("  ENERA TEST SUITE: DASHBOARD INTEGRATION & MULTI-SITE (REQ 34 & 35)");
  console.log("==================================================================\n");

  const TEST_ORG_ID = "org-multisite-enterprise-2026";

  ReconciliationStorageService.clearMemoryStore();
  InvoiceStorageService.clearMemoryRecords();
  MultiSiteHierarchyService.clearMemoryStore();

  // -----------------------------------------------------------------------------
  // TEST 1: True Honest Empty State when no persisted reconciliation data exists
  // -----------------------------------------------------------------------------
  console.log("--- Test 1: True Honest Empty State when no persisted data exists ---");
  const emptyDashboard = await DashboardService.getAggregatedDashboardData({
    organisationId: "org-clean-empty-tenant",
    source: "database",
  });

  assert.strictEqual(emptyDashboard.hasData, false, "Dashboard must indicate hasData=false on empty state");
  assert.strictEqual(emptyDashboard.portfolioSummary.hasData, false, "PortfolioSummary must have hasData=false");
  assert.strictEqual(emptyDashboard.portfolioSummary.invoicesProcessed, 0);
  assert.strictEqual(emptyDashboard.portfolioSummary.reconciliationsCompleted, 0);
  assert.strictEqual(emptyDashboard.portfolioSummary.reconciliationsRequiringReview, 0);
  assert.strictEqual(emptyDashboard.portfolioSummary.totalBilled, 0);
  assert.strictEqual(emptyDashboard.portfolioSummary.totalExpected, 0);
  assert.strictEqual(emptyDashboard.portfolioSummary.totalVariance, 0);
  assert.strictEqual(emptyDashboard.portfolioSummary.potentialFinancialDiscrepancies, 0);
  assert.strictEqual(emptyDashboard.portfolioSummary.dataCoveragePct, null);
  assert.strictEqual(emptyDashboard.monthlyConsumption.length, 0);
  assert.strictEqual(emptyDashboard.criticalAlerts.length, 0);
  assert.strictEqual(emptyDashboard.availableSites?.length, 0);
  assert.strictEqual(emptyDashboard.availableAccounts?.length, 0);
  console.log("✅ Test 1 Passed: True Honest Empty State confirmed (zero fabricated values).\n");

  // -----------------------------------------------------------------------------
  // TEST 2: Real metrics calculated strictly from persisted reconciliation data
  // -----------------------------------------------------------------------------
  console.log("--- Test 2: Real metrics calculated strictly from persisted reconciliation data ---");
  const run1 = {
    run_id: "RUN-MULTISITE-PERSISTED-001",
    organisation_id: TEST_ORG_ID,
    tenant_id: TEST_ORG_ID,
    invoice_id: "INV-PERSIST-001",
    status: "COMPLETED",
    billed_total_zar: new Decimal(1250000.0),
    calculated_total_zar: new Decimal(1250000.0),
    variance_total_zar: new Decimal(0.0),
    data_coverage_percentage: 100.0,
    classification: "PASS",
  };

  const run2 = {
    run_id: "RUN-MULTISITE-PERSISTED-002",
    organisation_id: TEST_ORG_ID,
    tenant_id: TEST_ORG_ID,
    invoice_id: "INV-PERSIST-002",
    status: "REVIEW_REQUIRED",
    billed_total_zar: new Decimal(850000.0),
    calculated_total_zar: new Decimal(820000.0),
    variance_total_zar: new Decimal(30000.0),
    data_coverage_percentage: 95.8,
    classification: "DISCREPANCY",
  };

  await ReconciliationStorageService.saveRun(run1);
  await ReconciliationStorageService.saveRun(run2);

  const dashboard = await DashboardService.getAggregatedDashboardData({
    organisationId: TEST_ORG_ID,
    source: "database",
  });

  assert.strictEqual(dashboard.hasData, true, "Dashboard must have hasData=true when persisted runs exist");
  assert.strictEqual(dashboard.portfolioSummary.hasData, true);

  const summary = dashboard.portfolioSummary;
  // 8 Authoritative Real Metrics
  assert.strictEqual(summary.invoicesProcessed, 2, "Invoices processed must be 2");
  assert.strictEqual(summary.reconciliationsCompleted, 1, "Reconciliations completed must be 1");
  assert.strictEqual(summary.reconciliationsRequiringReview, 1, "Reconciliations requiring review must be 1");
  assert.strictEqual(summary.totalBilled, 2100000.0, "Total billed must be R 2,100,000");
  assert.strictEqual(summary.totalExpected, 2070000.0, "Total expected must be R 2,070,000");
  assert.strictEqual(summary.totalVariance, 30000.0, "Total variance must be R 30,000");
  assert.strictEqual(summary.potentialFinancialDiscrepancies, 30000.0, "Potential financial discrepancies must be R 30,000");
  assert.strictEqual(summary.dataCoveragePct, 97.9, "Data coverage must be 97.9%");
  console.log("✅ Test 2 Passed: All 8 real metrics match persisted data with 100% precision.\n");

  // -----------------------------------------------------------------------------
  // TEST 3: Multi-site structure Organisation -> Customer -> Site -> (Meter & Invoices)
  // -----------------------------------------------------------------------------
  console.log("--- Test 3: Architecture supports Organisation -> Customer -> Site -> (Meter & Invoices) ---");
  const org = MultiSiteHierarchyService.registerOrganisation({
    id: "org-sasol-group",
    name: "Sasol Enterprise Global",
    code: "SASOL-SA",
  });

  const cust1 = MultiSiteHierarchyService.registerCustomer({
    id: "cust-sasol-mining",
    organisationId: org.id,
    customerName: "Sasol Mining Operations",
    accountNumber: "ACC-SASOL-MINE-01",
  });

  const cust2 = MultiSiteHierarchyService.registerCustomer({
    id: "cust-sasol-synfuels",
    organisationId: org.id,
    customerName: "Sasol Synfuels & Chemicals",
    accountNumber: "ACC-SASOL-SYN-02",
  });

  const site1 = MultiSiteHierarchyService.registerSite({
    id: "site-secunda-colliery",
    customerId: cust1.id,
    organisationId: org.id,
    siteName: "Secunda Colliery Extraction Pit",
    siteCode: "SEC-MINE-01",
    supplyVoltageKv: 132,
    nmdKva: 80000,
  });

  const site2 = MultiSiteHierarchyService.registerSite({
    id: "site-secunda-prep-plant",
    customerId: cust1.id,
    organisationId: org.id,
    siteName: "Secunda Coal Beneficiation Plant",
    siteCode: "SEC-PREP-02",
    supplyVoltageKv: 33,
    nmdKva: 45000,
  });

  const site3 = MultiSiteHierarchyService.registerSite({
    id: "site-sasolburg-chemical",
    customerId: cust2.id,
    organisationId: org.id,
    siteName: "Sasolburg Chemical Complex",
    siteCode: "SAS-CHEM-01",
    supplyVoltageKv: 66,
    nmdKva: 60000,
  });

  const mtr1 = MultiSiteHierarchyService.registerMeter({
    id: "mtr-sec-001",
    siteId: site1.id,
    meterNumber: "Eskom-MTR-889101",
    multiplier: 4000,
    tariffCode: "Megaflex Non-Local Authority",
  });

  const mtr2 = MultiSiteHierarchyService.registerMeter({
    id: "mtr-sec-002",
    siteId: site2.id,
    meterNumber: "Eskom-MTR-889102",
    multiplier: 2500,
    tariffCode: "Megaflex Non-Local Authority",
  });

  const mtr3 = MultiSiteHierarchyService.registerMeter({
    id: "mtr-sas-003",
    siteId: site3.id,
    meterNumber: "Eskom-MTR-774201",
    multiplier: 5000,
    tariffCode: "Megaflex Non-Local Authority",
  });

  InvoiceStorageService.saveInvoiceRecord({
    id: "INV-SASOL-01",
    organisation_id: org.id,
    customer_id: cust1.id,
    site_id: site1.id,
    meter_id: mtr1.id,
    account_number: cust1.accountNumber,
    invoice_number: "INV-SASOL-01",
    billing_period: "September 2026",
    invoiced_total: 2450000,
    reconciled_total: 2420000,
    variance_amount: 30000,
    status: "VALIDATED",
  });

  InvoiceStorageService.saveInvoiceRecord({
    id: "INV-SASOL-02",
    organisation_id: org.id,
    customer_id: cust1.id,
    site_id: site2.id,
    meter_id: mtr2.id,
    account_number: cust1.accountNumber,
    invoice_number: "INV-SASOL-02",
    billing_period: "September 2026",
    invoiced_total: 1350000,
    reconciled_total: 1350000,
    variance_amount: 0,
    status: "VALIDATED",
  });

  InvoiceStorageService.saveInvoiceRecord({
    id: "INV-SASOL-03",
    organisation_id: org.id,
    customer_id: cust2.id,
    site_id: site3.id,
    meter_id: mtr3.id,
    account_number: cust2.accountNumber,
    invoice_number: "INV-SASOL-03",
    billing_period: "September 2026",
    invoiced_total: 3100000,
    reconciled_total: 3080000,
    variance_amount: 20000,
    status: "VALIDATED",
  });

  const tree = await MultiSiteHierarchyService.buildHierarchy(org.id);

  assert.strictEqual(tree.totalOrganisations, 1);
  assert.strictEqual(tree.totalCustomers, 2);
  assert.strictEqual(tree.totalSites, 3);
  assert.strictEqual(tree.totalMeters, 3);
  assert.strictEqual(tree.totalInvoices, 3);

  const sasolOrg = tree.organisations[0];
  assert.strictEqual(sasolOrg.name, "Sasol Enterprise Global");
  assert.strictEqual(sasolOrg.customers.length, 2);

  const miningCust = sasolOrg.customers.find((c) => c.id === cust1.id);
  assert.ok(miningCust);
  assert.strictEqual(miningCust?.sites.length, 2);

  const collierySite = miningCust?.sites.find((s) => s.id === site1.id);
  assert.ok(collierySite);
  assert.strictEqual(collierySite?.meters.length, 1);
  assert.strictEqual(collierySite?.meters[0].meterNumber, "Eskom-MTR-889101");
  assert.strictEqual(collierySite?.invoices.length, 1);
  assert.strictEqual(collierySite?.invoices[0].billedTotalZar, 2450000);
  console.log("✅ Test 3 Passed: Multi-site tree Organisation -> Customer -> Site -> (Meter & Invoices) verified.\n");

  // -----------------------------------------------------------------------------
  // TEST 4: Multi-site cascading filtering and tier rollup
  // -----------------------------------------------------------------------------
  console.log("--- Test 4: Multi-site cascading filtering and aggregation rollup ---");
  // Organisation Rollup (across all 3 sites and 2 customers)
  const orgMetrics = MultiSiteHierarchyService.aggregateMetrics(tree.organisations[0]);
  assert.strictEqual(orgMetrics.totalCustomers, 2);
  assert.strictEqual(orgMetrics.totalSites, 3);
  assert.strictEqual(orgMetrics.totalMeters, 3);
  assert.strictEqual(orgMetrics.totalInvoices, 3);
  assert.strictEqual(orgMetrics.totalBilledZar, 6900000);
  assert.strictEqual(orgMetrics.totalExpectedZar, 6850000);
  assert.strictEqual(orgMetrics.totalVarianceZar, 50000);

  // Filter Customer 1
  const filteredByCustomer = MultiSiteHierarchyService.filterHierarchy(tree, {
    customerId: "cust-sasol-mining",
  });
  assert.strictEqual(filteredByCustomer.totalCustomers, 1);
  assert.strictEqual(filteredByCustomer.totalSites, 2);
  assert.strictEqual(filteredByCustomer.totalMeters, 2);
  assert.strictEqual(filteredByCustomer.totalInvoices, 2);

  const cust1Metrics = MultiSiteHierarchyService.aggregateMetrics(
    filteredByCustomer.organisations[0].customers[0],
  );
  assert.strictEqual(cust1Metrics.totalSites, 2);
  assert.strictEqual(cust1Metrics.totalBilledZar, 3800000);
  assert.strictEqual(cust1Metrics.totalVarianceZar, 30000);

  // Filter Site 1
  const filteredBySite = MultiSiteHierarchyService.filterHierarchy(tree, {
    siteId: "site-secunda-colliery",
  });
  assert.strictEqual(filteredBySite.totalSites, 1);
  assert.strictEqual(filteredBySite.totalMeters, 1);
  assert.strictEqual(filteredBySite.totalInvoices, 1);

  const siteMetrics = MultiSiteHierarchyService.aggregateMetrics(
    filteredBySite.organisations[0].customers[0].sites[0],
  );
  assert.strictEqual(siteMetrics.totalBilledZar, 2450000);
  assert.strictEqual(siteMetrics.totalVarianceZar, 30000);
  console.log("✅ Test 4 Passed: Cascading filtering and tier aggregation verified.\n");

  console.log("==================================================================");
  console.log("  ALL REQUIREMENTS 34 & 35 TESTS PASSED SUCCESSFULLY (4/4)");
  console.log("==================================================================");
}

runDashboardAndMultiSiteTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
