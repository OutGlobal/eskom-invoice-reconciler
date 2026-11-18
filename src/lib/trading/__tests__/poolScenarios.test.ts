import { describe, it, expect } from "vitest";
import { allocateEnergyPool as run } from "../poolScenarios";
const g = (id: string, kWh: number) => ({ id, name: id, kWh });
describe("energy pool scenarios", () => {
  it("handles bilateral matching", () => { const r = run("bilateral", [g("G1",100)], [g("C1",80)]); expect([r.allocatedKWh,r.surplusKWh,r.deficitKWh]).toEqual([80,20,0]); });
  it("aggregates multiple generators for one customer", () => { const r = run("many-to-one",[g("G1",40),g("G2",70)],[g("C1",100)]); expect(r.allocations.map(a=>a.kWh)).toEqual([40,60]); expect(r.surplusKWh).toBe(10); });
  it("allocates one generator to several customers", () => { const r = run("one-to-many",[g("G1",100)],[g("C1",70),g("C2",60)]); expect(r.allocations.map(a=>a.kWh)).toEqual([70,30]); expect(r.deficitKWh).toBe(30); });
  it("matches many-to-many without double counting", () => { const r = run("many-to-many",[g("G1",50),g("G2",80)],[g("C1",60),g("C2",90)]); expect(r.allocatedKWh).toBe(130); expect(r.deficitKWh).toBe(20); expect(r.allocations).toHaveLength(3); });
  it("rejects invalid data and mismatched topology", () => { expect(()=>run("bilateral",[g("G1",10),g("G2",10)],[g("C1",10)])).toThrow(); expect(()=>run("many-to-many",[g("G1",-1)],[g("C1",2)])).toThrow(); });
  it("does not invent energy for zero demand", () => { const r=run("bilateral",[g("G1",10)],[g("C1",0)]);expect(r.allocatedKWh).toBe(0);expect(r.coveragePercent).toBe(100); });
});
