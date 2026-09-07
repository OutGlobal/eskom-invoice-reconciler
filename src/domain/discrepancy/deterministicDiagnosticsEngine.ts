/**
 * Deterministic Diagnostics & Root-Cause Engine
 * Scans reconciliation payload and telemetry/invoice evidence to generate 100% rule-based
 * discrepancy records. Prohibits AI from inventing financial values.
 */

import Decimal from "decimal.js-light";
import type { AuthoritativeReconciliationPayload } from "../reconciliation/types";
import type {
  DiscrepancyRecord,
  DiscrepancyCode,
  DiscrepancySeverity,
  DiscrepancyStatus,
  RootCauseChainStep,
  DrillDownPath,
} from "./types";

export class DeterministicDiagnosticsEngine {
  /**
   * Scan an Authoritative Reconciliation Payload and generate deterministic discrepancy records
   */
  public static scan(payload: AuthoritativeReconciliationPayload): DiscrepancyRecord[] {
    const records: DiscrepancyRecord[] = [];
    const runAt = payload.completed_at || new Date().toISOString();

    for (const comp of payload.determinant_comparisons) {
      if (comp.classification === "PASS") continue;

      const absVar = comp.variance_value.abs();

      // Map determinant code to system discrepancy code
      let code: DiscrepancyCode = "CHG-001";
      let category = "Utility Charges";
      let severity: DiscrepancySeverity = "MEDIUM";
      let recAction = "Verify billed line item charge with utility statement.";

      if (comp.determinant_code.includes("PEAK") || comp.determinant_code.includes("STANDARD") || comp.determinant_code.includes("OFF_PEAK")) {
        code = "TOU-001";
        category = "Time-of-Use Allocation";
        severity = absVar.gt(1000) ? "CRITICAL" : "HIGH";
        recAction = "Re-align AMR 30-min interval TOU clock schedules against gazetted public holiday exception calendar.";
      } else if (comp.determinant_code.includes("DEMAND") || comp.determinant_code.includes("RATCHET")) {
        code = "DEM-001";
        category = "Demand & Capacity";
        severity = "CRITICAL";
        recAction = "Audit 30-minute peak kVA demand interval and verify Notified Maximum Demand (NMD) contract threshold.";
      } else if (comp.determinant_code.includes("REACTIVE")) {
        code = "REA-001";
        category = "Reactive Power";
        severity = "MEDIUM";
        recAction = "Inspect power factor lagging threshold (0.95) and verify excess kVARh penalty calculation.";
      } else if (comp.determinant_code.includes("NETWORK")) {
        code = "NET-001";
        category = "Network & Transmission";
        severity = "HIGH";
        recAction = "Verify transmission zone distance (<300km) and distribution voltage category rates.";
      } else if (comp.determinant_code.includes("VAT")) {
        code = "VAT-001";
        category = "Tax Settlement";
        severity = "HIGH";
        recAction = "Verify 15.00% VAT calculation against standard-rated vs zero-rated subtotal charge line items.";
      } else if (comp.determinant_code.includes("TOTAL")) {
        code = "TAR-001";
        category = "Tariff Rate Structure";
        severity = "CRITICAL";
        recAction = "Check if active gazetted NERSA tariff schedule version matches invoice billing period.";
      }

      // Root Cause Chain Propagation
      const rootCauseChain: RootCauseChainStep[] = [
        {
          step: 1,
          node_type: "ROOT_CAUSE",
          description: `Discrepancy detected in ${comp.determinant_name} (${comp.determinant_code})`,
          detail: `Billed value ${comp.billed_value.toString()} vs Calculated value ${comp.calculated_value.toString()} ${comp.unit_of_measure}`,
        },
        {
          step: 2,
          node_type: "TOU_RATE",
          description: "Tariff & TOU Clock Schedule Evaluation",
          detail: `Rule ID ${comp.explanation.rate_applied} evaluated under active tariff schedule`,
        },
        {
          step: 3,
          node_type: "LINE_ITEM_CHARGE",
          description: "Line Item Charge Computation",
          detail: `Formula: ${comp.explanation.formula_used}`,
        },
        {
          step: 4,
          node_type: "INVOICE_VARIANCE",
          description: "Invoice Settlement Variance",
          detail: `Variance: ${comp.variance_value.toString()} ${comp.unit_of_measure} (${comp.variance_percentage.toFixed(2)}%)`,
        },
      ];

      // 6-Level Drill-Down Traceability Path
      const drillDownPath: DrillDownPath = {
        discrepancy_code: code,
        invoice_id: payload.invoice_id,
        determinant_code: comp.determinant_code,
        calculation_summary: `${comp.explanation.formula_used} => ${comp.calculated_value.toString()} ${comp.unit_of_measure}`,
        telemetry_summary: `Telemetry Batch ${payload.telemetry_batch_id}`,
        tariff_rule_id: comp.explanation.rate_applied || "RULE_GAZETTE_2025",
        source_file_name: `Eskom_Invoice_${payload.invoice_id}.pdf`,
      };

      records.push({
        id: `DISC-${code}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        code,
        category,
        severity,
        status: "OPEN",
        description: `Variance detected in ${comp.determinant_name}: Billed ${comp.billed_value.toString()} ${comp.unit_of_measure} vs Calculated ${comp.calculated_value.toString()} ${comp.unit_of_measure} (${comp.variance_percentage.toFixed(2)}% variance).`,
        evidence: `Extracted Eskom Billed ${comp.billed_value.toString()} ${comp.unit_of_measure} differs from deterministic calculated ${comp.calculated_value.toString()} ${comp.unit_of_measure} by ${comp.variance_value.toString()} ${comp.unit_of_measure}.`,
        source_records: {
          invoice_id: payload.invoice_id,
          telemetry_batch_id: payload.telemetry_batch_id,
          meter_id: "METER_MAIN_01",
          source_file_id: `FILE_${payload.invoice_id}`,
          tariff_rule_id: comp.explanation.rate_applied,
        },
        calculation: {
          input_value: comp.explanation.input_value,
          formula: comp.explanation.formula_used,
          rate_applied: comp.explanation.rate_applied,
          precision: comp.explanation.precision,
          output_value: comp.calculated_value.toString(),
        },
        financial_impact_zar: comp.unit_of_measure === "ZAR" ? absVar : new Decimal(0),
        recommended_action: recAction,
        confidence: 0.995,
        root_cause_chain: rootCauseChain,
        drill_down_path: drillDownPath,
        reconciliation_run_id: payload.run_id,
        created_at: runAt,
        updated_at: runAt,
      });
    }

    return records;
  }

  /**
   * Helper method to generate sample records for all 12 system discrepancy codes
   */
  public static generateAllCodesSample(): DiscrepancyRecord[] {
    const codes: Array<{ code: DiscrepancyCode; name: string; cat: string; sev: DiscrepancySeverity; zar: string }> = [
      { code: "TAR-001", name: "Tariff Mismatch", cat: "Tariff Schedule", sev: "CRITICAL", zar: "44587.50" },
      { code: "DEM-001", name: "Demand Discrepancy", cat: "Demand & Capacity", sev: "CRITICAL", zar: "14250.00" },
      { code: "MUL-001", name: "Meter Multiplier Discrepancy", cat: "Meter Master Data", sev: "HIGH", zar: "22100.00" },
      { code: "TOU-001", name: "TOU Allocation Discrepancy", cat: "Time-of-Use Clock", sev: "HIGH", zar: "8950.00" },
      { code: "EST-001", name: "Estimated Billing", cat: "Meter Reading Type", sev: "MEDIUM", zar: "5200.00" },
      { code: "TEL-001", name: "Missing Telemetry", cat: "Telemetry Quality", sev: "HIGH", zar: "11400.00" },
      { code: "TEL-002", name: "Telemetry Quality Failure", cat: "Telemetry Quality", sev: "MEDIUM", zar: "3200.00" },
      { code: "REA-001", name: "Reactive Energy Discrepancy", cat: "Reactive Power", sev: "MEDIUM", zar: "1850.00" },
      { code: "NET-001", name: "Network Charge Discrepancy", cat: "Network & Capacity", sev: "HIGH", zar: "6400.00" },
      { code: "CHG-001", name: "Unexpected Charge", cat: "Line Item Audit", sev: "LOW", zar: "450.00" },
      { code: "VAT-001", name: "VAT Discrepancy", cat: "Tax Settlement", sev: "HIGH", zar: "6688.13" },
      { code: "INV-001", name: "Invoice Extraction Inconsistency", cat: "Document Extraction", sev: "MEDIUM", zar: "1200.00" },
    ];

    const runAt = new Date().toISOString();

    return codes.map((item, idx) => ({
      id: `DISC-${item.code}-FIXTURE`,
      code: item.code,
      category: item.cat,
      severity: item.sev,
      status: idx % 2 === 0 ? "OPEN" : "UNDER_REVIEW",
      description: `Deterministic detection for ${item.name} (${item.code})`,
      evidence: `System rule evaluation matched discrepancy condition for ${item.code} grounded in NERSA gazetted schedule standards.`,
      source_records: {
        invoice_id: "INV-2025-07-MEGA01",
        telemetry_batch_id: "BATCH_2025_07",
        meter_id: "METER_MAIN_01",
        source_file_id: "FILE_MEGA_JUL_2025.pdf",
        tariff_rule_id: `RULE-${item.code}`,
      },
      calculation: {
        input_value: "Billed value differs from calculated",
        formula: "abs(Billed - Calculated)",
        rate_applied: "Gazetted NERSA 2025/2026 Rate",
        precision: "Decimal.js-light NUMERIC(18,4)",
        output_value: item.zar,
      },
      financial_impact_zar: new Decimal(item.zar),
      recommended_action: `Execute audit investigation for ${item.name} and submit dispute pack to utility provider.`,
      confidence: 1.0,
      root_cause_chain: [
        { step: 1, node_type: "ROOT_CAUSE", description: `${item.name} Identified`, detail: `Triggered by code ${item.code}` },
        { step: 2, node_type: "TOU_RATE", description: "Rate Schedule Applied", detail: "NERSA 2025/26 Table 1" },
        { step: 3, node_type: "LINE_ITEM_CHARGE", description: "Line Item Computation", detail: "Deterministic formula matched" },
        { step: 4, node_type: "INVOICE_VARIANCE", description: "Financial Settlement Variance", detail: `Financial impact R ${item.zar}` },
      ],
      drill_down_path: {
        discrepancy_code: item.code,
        invoice_id: "INV-2025-07-MEGA01",
        determinant_code: item.code,
        calculation_summary: `Calculated R ${item.zar} variance`,
        telemetry_summary: "AMR 30-min telemetry verified",
        tariff_rule_id: `RULE-${item.code}`,
        source_file_name: "Eskom_Invoice_July_2025.pdf",
      },
      reconciliation_run_id: "RECON-FIXTURE-001",
      created_at: runAt,
      updated_at: runAt,
    }));
  }
}
