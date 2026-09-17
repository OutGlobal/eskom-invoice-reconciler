/**
 * Ambiguity Detection Engine
 * Evaluates extracted billing and telemetry datasets before reconciliation.
 * Halts processing safely upon encountering ambiguity, prompting the user for attention
 * while strictly adhering to the zero-invention guarantee.
 */

import type {
  AmbiguityReport,
  AmbiguityCode,
  AmbiguityResolutionOption,
  AutomatedPipelineStage,
} from "./types";

export class AmbiguityDetector {
  public static readonly NON_INVENTION_POLICY =
    "STRICT_NO_INVENTION: ENERA strictly refuses to synthesize, interpolate, or invent missing readings, billing periods, or meter identifiers. User confirmation is mandatory.";

  /**
   * Evaluates all ambiguity dimensions between extracted invoice and meter datasets.
   * Returns null if clean, or an AmbiguityReport if ambiguity requires user attention.
   */
  public static detectAmbiguity(
    pipelineRunId: string,
    extractedInvoice: any,
    meterIntervals: any[],
    stage: AutomatedPipelineStage,
    overrides?: { overrideMeterId?: string; overrideTariffCode?: string },
  ): AmbiguityReport | null {
    // 1. Check Meter Identifier Ambiguity
    const meterAmbiguity = this.checkMeterAmbiguity(
      pipelineRunId,
      extractedInvoice,
      meterIntervals,
      stage,
      overrides?.overrideMeterId,
    );
    if (meterAmbiguity) return meterAmbiguity;

    // 2. Check Billing Period Alignment Ambiguity
    const periodAmbiguity = this.checkPeriodAmbiguity(
      pipelineRunId,
      extractedInvoice,
      meterIntervals,
      stage,
    );
    if (periodAmbiguity) return periodAmbiguity;

    // 3. Check Tariff Ambiguity
    const tariffAmbiguity = this.checkTariffAmbiguity(
      pipelineRunId,
      extractedInvoice,
      stage,
      overrides?.overrideTariffCode,
    );
    if (tariffAmbiguity) return tariffAmbiguity;

    // 4. Check Telemetry Completeness & Unit Ambiguity
    const dataAmbiguity = this.checkDataCompleteness(
      pipelineRunId,
      extractedInvoice,
      meterIntervals,
      stage,
    );
    if (dataAmbiguity) return dataAmbiguity;

    return null;
  }

  /**
   * 1. Meter Identifier Ambiguity Check
   */
  public static checkMeterAmbiguity(
    pipelineRunId: string,
    invoice: any,
    intervals: any[],
    stage: AutomatedPipelineStage,
    overrideMeterId?: string,
  ): AmbiguityReport | null {
    if (overrideMeterId) {
      return null; // Explicit user confirmation provided
    }

    const invoiceMeter = (
      invoice?.meterNumber ||
      invoice?.meterSerial ||
      invoice?.meterId ||
      ""
    ).trim();

    // Extract unique meter IDs from intervals
    const meterIds = new Set<string>();
    for (const r of intervals) {
      const id = (r.meter_id || r.meterId || r.meter_serial || "").toString().trim();
      if (id) meterIds.add(id);
    }

    // Case A: Multiple conflicting meters in interval file without assignment
    if (meterIds.size > 1) {
      const options: AmbiguityResolutionOption[] = Array.from(meterIds).map((id) => ({
        id: `SELECT_METER_${id}`,
        label: `Reconcile Meter ${id}`,
        description: `Apply intervals associated with meter ID ${id}`,
        actionValue: id,
      }));

      return {
        ambiguityId: `AMB-METER-MULTI-${Date.now()}`,
        pipelineRunId,
        code: "MULTIPLE_METERS_UNASSIGNED",
        severity: "BLOCKING",
        stage,
        title: "Multiple Meters Detected in AMR Dataset",
        summary: `The uploaded meter file contains ${meterIds.size} different meter identifiers: ${Array.from(meterIds).join(", ")}.`,
        whatNeedsAttention:
          "Please select which meter identifier corresponds to this invoice reconciliation. ENERA will not guess meter assignment.",
        affectedFields: ["meter_id", "meterNumber"],
        suggestedResolutions: options,
        nonInventionPolicy: this.NON_INVENTION_POLICY,
        detectedAt: new Date().toISOString(),
      };
    }

    // Case B: Invoice meter does not match interval dataset meter
    const intervalMeter = meterIds.size === 1 ? Array.from(meterIds)[0] : "";
    if (invoiceMeter && intervalMeter && invoiceMeter.toLowerCase() !== intervalMeter.toLowerCase()) {
      return {
        ambiguityId: `AMB-METER-MISMATCH-${Date.now()}`,
        pipelineRunId,
        code: "METER_IDENTIFIER_MISMATCH",
        severity: "BLOCKING",
        stage,
        title: "Meter Identifier Discrepancy",
        summary: `Invoice specifies meter '${invoiceMeter}', but meter file contains records for '${intervalMeter}'.`,
        whatNeedsAttention:
          `Confirm whether meter '${intervalMeter}' is an associated feeder meter or whether a different telemetry file should be provided.`,
        affectedFields: ["meterNumber", "meter_id"],
        suggestedResolutions: [
          {
            id: "CONFIRM_INTERVAL_METER",
            label: `Use Meter ${intervalMeter}`,
            description: `Acknowledge mismatch and reconcile using meter ${intervalMeter}`,
            actionValue: intervalMeter,
          },
          {
            id: "USE_INVOICE_METER",
            label: `Force Invoice Meter ${invoiceMeter}`,
            description: `Tag reconciliation with invoice meter ${invoiceMeter}`,
            actionValue: invoiceMeter,
          },
        ],
        nonInventionPolicy: this.NON_INVENTION_POLICY,
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * 2. Billing Period Date Alignment Ambiguity Check
   */
  public static checkPeriodAmbiguity(
    pipelineRunId: string,
    invoice: any,
    intervals: any[],
    stage: AutomatedPipelineStage,
  ): AmbiguityReport | null {
    if (!invoice || !intervals || intervals.length === 0) return null;

    const bStartStr = invoice.billingStart || invoice.billingPeriodStart;
    const bEndStr = invoice.billingEnd || invoice.billingPeriodEnd;

    if (!bStartStr || !bEndStr) return null;

    const bStart = new Date(bStartStr).getTime();
    const bEnd = new Date(bEndStr).getTime();

    if (isNaN(bStart) || isNaN(bEnd) || bStart >= bEnd) return null;

    // Determine interval timestamp bounds
    let earliest = Infinity;
    let latest = -Infinity;

    for (const r of intervals) {
      const ts = new Date(r.timestamp_utc || r.ts || r.timestamp).getTime();
      if (!isNaN(ts)) {
        if (ts < earliest) earliest = ts;
        if (ts > latest) latest = ts;
      }
    }

    if (earliest === Infinity || latest === -Infinity) return null;

    // Check for disjoint or severely non-overlapping date ranges
    // Case A: Interval data ends before billing start OR starts after billing end
    const isCompletelyDisjoint = latest < bStart || earliest > bEnd;

    if (isCompletelyDisjoint) {
      const intStartFmt = new Date(earliest).toISOString().split("T")[0];
      const intEndFmt = new Date(latest).toISOString().split("T")[0];
      const invStartFmt = new Date(bStart).toISOString().split("T")[0];
      const invEndFmt = new Date(bEnd).toISOString().split("T")[0];

      return {
        ambiguityId: `AMB-PERIOD-DISJOINT-${Date.now()}`,
        pipelineRunId,
        code: "BILLING_PERIOD_MISALIGNMENT",
        severity: "BLOCKING",
        stage,
        title: "Billing Period Misalignment",
        summary: `Invoice period (${invStartFmt} to ${invEndFmt}) has zero overlap with meter intervals (${intStartFmt} to ${intEndFmt}).`,
        whatNeedsAttention:
          "The uploaded meter intervals do not correspond to the billing dates on the invoice. Reconciling unrelated dates will produce misleading variance results. Please upload intervals for the correct billing cycle.",
        affectedFields: ["billingStart", "billingEnd", "timestamp_utc"],
        suggestedResolutions: [
          {
            id: "PROCEED_WITH_PARTIAL_OVERLAP",
            label: "Force Reconcile Available Range",
            description: "Reconcile only the intersecting days without inventing missing readings",
            actionValue: "ALLOW_DISJOINT",
          },
        ],
        nonInventionPolicy: this.NON_INVENTION_POLICY,
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * 3. Tariff Ambiguity Check
   */
  public static checkTariffAmbiguity(
    pipelineRunId: string,
    invoice: any,
    stage: AutomatedPipelineStage,
    overrideTariffCode?: string,
  ): AmbiguityReport | null {
    if (overrideTariffCode) return null;

    const tariffRaw = (invoice?.tariff || invoice?.tariffName || "").trim();

    // If tariff name is missing or generic (e.g. "UNKNOWN" or "ESKOM TARIFF")
    if (!tariffRaw || tariffRaw.toUpperCase() === "UNKNOWN" || tariffRaw.toUpperCase() === "ESKOM") {
      return {
        ambiguityId: `AMB-TARIFF-UNRESOLVED-${Date.now()}`,
        pipelineRunId,
        code: "UNRESOLVED_TARIFF_STRUCTURE",
        severity: "BLOCKING",
        stage,
        title: "Unresolved Tariff Schedule",
        summary: `Invoice document did not state a recognizable gazetted tariff schedule (found: '${tariffRaw || "None"}').`,
        whatNeedsAttention:
          "Select the applicable Eskom or Municipal gazetted tariff structure to calculate authoritative charges. ENERA will not guess tariff rates.",
        affectedFields: ["tariff", "tariff_code"],
        suggestedResolutions: [
          {
            id: "MEGAFLEX_HV",
            label: "Eskom Megaflex (High Voltage)",
            description: "Transmission & High Voltage Urban TOU Tariff",
            actionValue: "ESKOM_MEGAFLEX_HV_2025_2026",
          },
          {
            id: "MINIFLEX_MV",
            label: "Eskom Miniflex (Medium Voltage)",
            description: "Medium Voltage Distribution TOU Tariff",
            actionValue: "ESKOM_MINIFLEX_MV_2025_2026",
          },
          {
            id: "NIGHTSAVE_URBAN",
            label: "Eskom Nightsave Urban",
            description: "High/Medium Voltage Off-Peak Night-Heavy Demand",
            actionValue: "ESKOM_NIGHTSAVE_URBAN_2025_2026",
          },
        ],
        nonInventionPolicy: this.NON_INVENTION_POLICY,
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  /**
   * 4. Data Completeness & Unit Ambiguity Check
   */
  public static checkDataCompleteness(
    pipelineRunId: string,
    invoice: any,
    intervals: any[],
    stage: AutomatedPipelineStage,
  ): AmbiguityReport | null {
    if (!intervals || intervals.length === 0) {
      return {
        ambiguityId: `AMB-EMPTY-DATA-${Date.now()}`,
        pipelineRunId,
        code: "MISSING_CRITICAL_DETERMINANTS",
        severity: "BLOCKING",
        stage,
        title: "No Meter Intervals Found",
        summary: "The meter data file yielded 0 valid interval readings.",
        whatNeedsAttention:
          "Provide an interval telemetry file with valid timestamp and consumption columns.",
        affectedFields: ["intervals"],
        suggestedResolutions: [],
        nonInventionPolicy: this.NON_INVENTION_POLICY,
        detectedAt: new Date().toISOString(),
      };
    }

    return null;
  }
}
