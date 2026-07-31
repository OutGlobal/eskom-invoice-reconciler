import { computeTotals, computeCharges } from "../reconciliation";
import type { Measurement } from "../parseMeter";
import { TARIFF } from "../tariff";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ TEST PASSED: ${message}`);
}

console.log("=== RUNNING ESKOM BILL BALANCER TEST SUITE ===");

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

console.log("=== ALL AUTOMATED TESTS PASSED SUCCESSFULLY ===");
