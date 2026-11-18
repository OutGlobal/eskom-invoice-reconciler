import { describe, expect, it } from "vitest";
import { reconcileWheelingIntervals, type MeteredTouInterval } from "../wheelingReconciliation";
const sample: MeteredTouInterval[] = [
  {timestamp:"2026-11-01T10:00:00+02:00",tou:"standard",generatorId:"IPP-1",customerId:"C-1",generatedKWh:100,consumedKWh:70},
  {timestamp:"2026-11-01T18:00:00+02:00",tou:"peak",generatorId:"IPP-1",customerId:"C-1",generatedKWh:20,consumedKWh:80},
];
const terms = {mode:"conventional" as const,lossFactor:0.1,purchaseRateZarPerKWh:{standard:0.8,peak:1},saleRateZarPerKWh:{standard:1.2,peak:2},networkRateZarPerKWh:{standard:0.1,peak:0.2}};
describe("evidence-first TOU wheeling reconciliation",()=>{
 it("matches only the same interval and TOU period",()=>{const r=reconcileWheelingIntervals(sample,terms);expect(r.totals.allocatedKWh).toBe(88);expect(r.lines.map(x=>x.allocatedKWh)).toEqual([70,18]);expect(r.totals.shortfallKWh).toBe(62);});
 it("applies losses before allocation and never creates energy",()=>{const r=reconcileWheelingIntervals(sample,terms);expect(r.totals.lossKWh).toBe(12);expect(r.totals.surplusKWh).toBe(20);});
 it("uses period-specific rates",()=>{const r=reconcileWheelingIntervals(sample,terms);expect(r.totals.customerEnergyChargeZar).toBe(120);expect(r.totals.ippPayableZar).toBe(74);});
 it("does not invent an Eskom credit without an approved rate",()=>{const r=reconcileWheelingIntervals(sample,terms);expect(r.totals.wheelingCreditZar).toBeNull();expect(r.evidence.claimApproved).toBe(false);});
 it("keeps virtual and conventional claims separate",()=>{const r=reconcileWheelingIntervals(sample,{...terms,mode:"virtual",approvedCreditRateZarPerKWh:{standard:0.5,peak:0.7}});expect(r.mode).toBe("virtual");expect(r.totals.wheelingCreditZar).toBeCloseTo(47.6);expect(r.evidence.claimSubmitted).toBe(false);});
 it("rejects duplicate interval allocations and invalid readings",()=>{expect(()=>reconcileWheelingIntervals([...sample,sample[0]],terms)).toThrow(/Duplicate/);expect(()=>reconcileWheelingIntervals([{...sample[0],generatedKWh:-2}],terms)).toThrow(/meter/);});
});
