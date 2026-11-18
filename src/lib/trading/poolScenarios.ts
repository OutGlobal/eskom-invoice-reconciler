/** Planning-only interval pool allocator. Not a market dispatch, nomination or invoice engine. */
export type PoolParticipant = { id: string; name: string; kWh: number };
export type PoolMode = "bilateral" | "many-to-one" | "one-to-many" | "many-to-many";
export type PoolAllocation = { generatorId: string; consumerId: string; kWh: number };
export type PoolResult = {
  allocations: PoolAllocation[];
  suppliedKWh: number;
  demandKWh: number;
  allocatedKWh: number;
  surplusKWh: number;
  deficitKWh: number;
  coveragePercent: number;
};
function check(participants: PoolParticipant[], label: string) {
  if (!participants.length) throw new Error(`At least one ${label} is required`);
  const ids = new Set<string>();
  for (const p of participants) {
    if (!p.id.trim() || !p.name.trim() || ids.has(p.id)) throw new Error(`Invalid or duplicate ${label} identifier`);
    if (!Number.isFinite(p.kWh) || p.kWh < 0) throw new Error(`${label} kWh must be finite and non-negative`);
    ids.add(p.id);
  }
}
export function allocateEnergyPool(mode: PoolMode, generators: PoolParticipant[], consumers: PoolParticipant[]): PoolResult {
  check(generators, "generator"); check(consumers, "consumer");
  if ((mode === "bilateral" && (generators.length !== 1 || consumers.length !== 1)) ||
      (mode === "many-to-one" && consumers.length !== 1) ||
      (mode === "one-to-many" && generators.length !== 1)) throw new Error("Participant counts do not match scenario");
  if (!(["bilateral", "many-to-one", "one-to-many", "many-to-many"] as string[]).includes(mode)) throw new Error("Unsupported scenario");
  // Deterministic first-in-first-out allocation; priority is explicit input order.
  const available = generators.map(g => ({ ...g }));
  const allocations: PoolAllocation[] = [];
  for (const consumer of consumers) {
    let need = consumer.kWh;
    for (const generator of available) {
      const kWh = Math.min(need, generator.kWh);
      if (kWh > 0) allocations.push({ generatorId: generator.id, consumerId: consumer.id, kWh });
      need -= kWh; generator.kWh -= kWh;
      if (need === 0) break;
    }
  }
  const suppliedKWh = generators.reduce((s, g) => s + g.kWh, 0);
  const demandKWh = consumers.reduce((s, c) => s + c.kWh, 0);
  const allocatedKWh = allocations.reduce((s, a) => s + a.kWh, 0);
  return { allocations, suppliedKWh, demandKWh, allocatedKWh,
    surplusKWh: suppliedKWh - allocatedKWh, deficitKWh: demandKWh - allocatedKWh,
    coveragePercent: demandKWh === 0 ? 100 : 100 * allocatedKWh / demandKWh };
}
