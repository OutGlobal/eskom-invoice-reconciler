import { DailyAggregateSummary, ChunkedBatchConfig } from "./types";
import { CanonicalTelemetryRecord } from "../telemetry/types";

export function computeServerSideDailyAggregates(
  records: CanonicalTelemetryRecord[],
): DailyAggregateSummary[] {
  const map = new Map<
    string,
    {
      meterId: string;
      dateStr: string;
      totalKwh: number;
      peakKwh: number;
      stdKwh: number;
      offKwh: number;
      maxKw: number;
      maxKva: number;
      pfSum: number;
      count: number;
    }
  >();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const dateStr = r.local_timestamp.substring(0, 10);
    const key = `${r.meter_id}_${dateStr}`;

    let item = map.get(key);
    if (!item) {
      item = {
        meterId: r.meter_id,
        dateStr,
        totalKwh: 0,
        peakKwh: 0,
        stdKwh: 0,
        offKwh: 0,
        maxKw: 0,
        maxKva: 0,
        pfSum: 0,
        count: 0,
      };
      map.set(key, item);
    }

    const kwh = r.active_energy_kwh || 0;
    item.totalKwh += kwh;

    if (r.tou_period === "PEAK") item.peakKwh += kwh;
    else if (r.tou_period === "STANDARD") item.stdKwh += kwh;
    else item.offKwh += kwh;

    if (r.active_power_kw > item.maxKw) item.maxKw = r.active_power_kw;
    if (r.apparent_power_kva > item.maxKva) item.maxKva = r.apparent_power_kva;
    item.pfSum += r.power_factor || 1.0;
    item.count += 1;
  }

  const result: DailyAggregateSummary[] = [];
  map.forEach((val) => {
    result.push({
      meterId: val.meterId,
      dateStr: val.dateStr,
      totalActiveKwh: Number(val.totalKwh.toFixed(3)),
      peakKwh: Number(val.peakKwh.toFixed(3)),
      standardKwh: Number(val.stdKwh.toFixed(3)),
      offPeakKwh: Number(val.offKwh.toFixed(3)),
      peakKw: Number(val.maxKw.toFixed(2)),
      peakKva: Number(val.maxKva.toFixed(2)),
      avgPowerFactor: Number((val.pfSum / val.count).toFixed(3)),
      intervalCount: val.count,
    });
  });

  return result;
}

export function executeBatchProcessing<T, R>(
  items: T[],
  batchConfig: ChunkedBatchConfig,
  processor: (batch: T[]) => R[],
): R[] {
  const results: R[] = [];
  const { batchSize } = batchConfig;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const processed = processor(batch);
    results.push(...processed);
  }

  return results;
}
