/**
 * Anomaly Detection Engine
 * Eskom Management Platform — Automated Billing & Interval Anomaly Auditor
 */

import type {
  CanonicalTelemetryInterval,
  ReconciliationResult,
  DiscrepancyEvent,
} from "../types/canonical";

export interface AnomalyInsight {
  id: string;
  category:
    | "CURTAILMENT_PEAK_SPIKE"
    | "NMD_EXCEEDANCE"
    | "TRANSMISSION_ALIGNMENT"
    | "SOLAR_WHEELING_NETTING";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  title: string;
  description: string;
  financialImpactR: number;
  nersaReference: string;
  isActionable: boolean;
}

export class AnomalyEngine {
  /**
   * Scans a reconciliation result and interval measurements for automated billing anomalies
   */
  public static scanForAnomalies(
    recon: ReconciliationResult,
    intervals: CanonicalTelemetryInterval[],
  ): AnomalyInsight[] {
    const insights: AnomalyInsight[] = [];

    const peak = intervals.reduce<CanonicalTelemetryInterval | null>((highest, interval) =>
      !highest || interval.kVA > highest.kVA ? interval : highest, null);
    const baselineKVA = recon.nmdStatus.contractedNmdKVA;
    if (peak && baselineKVA > 0 && peak.kVA > baselineKVA) {
      insights.push({
        id: "anom-nmd-exceedance",
        category: "NMD_EXCEEDANCE",
        severity: "HIGH",
        title: "Notified maximum demand exceeded",
        description: `Uploaded meter data recorded ${peak.kVA.toLocaleString()} kVA against a contracted limit of ${baselineKVA.toLocaleString()} kVA.`,
        financialImpactR: 0,
        nersaReference: "Uploaded tariff and contract evidence required",
        isActionable: true,
      });
    }

    return insights;
  }
}
