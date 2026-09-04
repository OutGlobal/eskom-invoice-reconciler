/**
 * Reconciliation Storage Service
 * Persists every reconciliation execution independently to PostgreSQL/Supabase
 */

import { supabase } from "../../lib/supabase";
import type { ReconciliationRunPayload } from "./types";

export class ReconciliationStorageService {
  /**
   * Persist a reconciliation run independently (always inserts a new unique run)
   */
  public static async saveRun(payload: ReconciliationRunPayload): Promise<{
    success: boolean;
    runId?: string;
    error?: string;
  }> {
    try {
      // 1. Insert into reconciliation_runs (Unique execution record)
      const runRecord = {
        status:
          payload.status === "PASS" || payload.status === "PASS_WITH_WARNINGS"
            ? "completed"
            : "failed",
        correlation_id: payload.run_id,
        invoice_record_id: "00000000-0000-0000-0000-000000000000", // Reference or fallback
        run_at: payload.run_at,
      };

      const { data: insertedRun, error: runError } = await supabase
        .from("reconciliation_runs")
        .insert(runRecord)
        .select("id")
        .single();

      if (runError && !runError.message.includes("FetchError")) {
        console.warn("Supabase reconciliation_runs insert warning:", runError.message);
      }

      const dbRunId = insertedRun?.id || payload.run_id;

      // 2. Insert into reconciliation_results
      const resultRecord = {
        reconciliation_run_id: dbRunId,
        total_invoiced: payload.billed_total_zar.toNumber(),
        total_reconciled: payload.expected_total_zar.toNumber(),
        total_variance: payload.total_variance_zar.toNumber(),
        summary_json: payload as any,
      };

      await supabase.from("reconciliation_results").insert(resultRecord);

      // 3. Insert Discrepancy Events for flagged overcharges
      if (payload.discrepancies.length > 0 && insertedRun?.id) {
        const discrepancyRecords = payload.discrepancies.map((d) => ({
          reconciliation_run_id: insertedRun.id,
          invoice_record_id: "00000000-0000-0000-0000-000000000000",
          rule_id: d.component_code,
          severity: d.status === "MATERIAL_DISCREPANCY" ? "critical" : "minor",
          invoiced_amount: d.billed_value.toNumber(),
          reconciled_amount: d.calculated_value.toNumber(),
          variance_amount: d.absolute_variance.toNumber(),
          root_cause: d.root_cause_description || `Discrepancy in ${d.component_name}`,
          status: "open",
        }));

        await supabase.from("discrepancy_events").insert(discrepancyRecords);
      }

      return {
        success: true,
        runId: dbRunId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to persist reconciliation run",
      };
    }
  }
}
