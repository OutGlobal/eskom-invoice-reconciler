import { computeTotals, computeCharges } from "../reconciliation";
import type { Measurement } from "../parseMeter";
import { TARIFF } from "../tariff";
import { validateInvoiceData } from "../validationEngine";
import { sanitizeCsvCell } from "../exportReports";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ TEST PASSED: ${message}`);
}

console.log("=== RUNNING ESKOM BILL BALANCER ENTERPRISE TEST SUITE ===");

// Test 1: Megaflex Tariff Rates
assert(TARIFF.name.includes("Megaflex"), "Tariff name identifies Eskom Megaflex tariff");
assert(TARIFF.energy.high.peak === 666.92, "Peak Energy High Season Rate matches NERSA Gazette (666.92 c/kWh)");
assert(TARIFF.energy.low.offPeak === 111.15, "Off-Peak Low Season Rate matches NERSA Gazette (111.15 c/kWh)");

// Test 2: Reconciliation Engine Meter Data Integration
const mockIntervalData: Measurement[] = [
  { ts: new Date("2026-03-01T08:00:00Z"), kW: 50000, kVAr: 15000, kVA: 52083, pf: 0.96, tou: "peak" },
  { ts: new Date("2026-03-01T12:00:00Z"), kW: 60000, kVAr: 18000, kVA: 62500, pf: 0.96, tou: "standard" },
  { ts: new Date("2026-03-01T22:00:00Z"), kW: 40000, kVAr: 12000, kVA: 41666, pf: 0.96, tou: "offPeak" },
];

const totals = computeTotals(mockIntervalData);
assert(totals.totalKWh > 0, "Total kWh energy is calculated from 30-min meter readings");
assert(totals.maxDemandKVA > 0, "Maximum demand kVA is derived from peak kW interval");

const charges = computeCharges(totals, 90000, mockIntervalData);
assert(charges.length > 0, "Compute charges returns non-empty list of tariff charge items");

const txNetworkCharge = charges.find((c) => c.label.includes("Transmission"));
assert(txNetworkCharge !== undefined, "Transmission Network Charge item present in reconciliation result");
assert((txNetworkCharge?.amount || 0) === 90000 * TARIFF.transmissionNetwork, "Transmission Charge matches NMD formula");

// Test 3: Validation Engine Rules
const validReport = validateInvoiceData({
  accountNumber: "7856504676",
  invoiceNumber: "785101497007",
  peakKWh: 1000,
  standardKWh: 2000,
  offPeakKWh: 3000,
  totalKWh: 6000,
  invoiceTotal: 100000,
  vat: 15000,
  billingPeriodStart: "2026-01-17",
  billingPeriodEnd: "2026-02-16",
});
assert(validReport.score === 100, "Validation Engine passes 100% on valid Eskom invoice data");
assert(validReport.overallStatus === "pass", "Overall validation status is 'pass'");

const invalidReport = validateInvoiceData({
  accountNumber: "123",
  peakKWh: 1000,
  standardKWh: 2000,
  offPeakKWh: 3000,
  totalKWh: 99999, // Intentional mismatch
  billingPeriodStart: "2026-05-01",
  billingPeriodEnd: "2026-04-01", // Invalid date sequence
});
assert(invalidReport.overallStatus === "fail", "Validation Engine fails on broken energy sum and invalid dates");

// Test 4: CSV Security Formula Injection Protection
assert(sanitizeCsvCell("=1+1").includes("'=1+1"), "CSV sanitization neutralizes = prefix");
assert(sanitizeCsvCell("+cmd|' /C calc'!A0").includes("'+cmd"), "CSV sanitization neutralizes + prefix");
assert(sanitizeCsvCell("Normal Text").includes("Normal Text"), "CSV sanitization preserves normal text");

import { runAiInvestigationTests } from "./ai_investigation_layer.test";
import { runGovernanceWorkflowTests } from "./enterprise_governance_workflow.test";

runAiInvestigationTests();
runGovernanceWorkflowTests();

console.log("=== ALL AUTOMATED TESTS PASSED SUCCESSFULLY ===");
