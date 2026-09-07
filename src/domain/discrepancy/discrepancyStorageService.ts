/**
 * Discrepancy Storage Service
 * Enterprise Persistence Service for Discrepancy Records & Root Cause Status Lifecycle
 * Manages Supabase DB integration for OPEN, UNDER_REVIEW, CONFIRMED, DISPUTED, RESOLVED, REJECTED statuses.
 */

import Decimal from "decimal.js-light";
import { supabase } from "@/integrations/supabase/client";
import type { DiscrepancyRecord, DiscrepancyStatus } from "./types";
import { DeterministicDiagnosticsEngine } from "./deterministicDiagnosticsEngine";

export class DiscrepancyStorageService {
  /**
   * Fetch all discrepancy records from Supabase or default sample
   */
  public static async getDiscrepancies(): Promise<DiscrepancyRecord[]> {
    try {
      const { data: dbRecords, error } = await supabase
        .from("discrepancy_records")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !dbRecords || dbRecords.length === 0) {
        console.warn("[DiscrepancyStorageService] Supabase discrepancy records empty or unavailable, using sample fixtures.");
        return DeterministicDiagnosticsEngine.generateAllCodesSample();
      }

      return dbRecords.map((row: any) => ({
        id: row.id,
        code: row.code,
        category: row.category,
        severity: row.severity,
        status: row.status as DiscrepancyStatus,
        description: row.description,
        evidence: row.evidence,
        source_records: row.source_records || {},
        calculation: row.calculation || {},
        financial_impact_zar: new Decimal(row.financial_impact_zar || 0),
        recommended_action: row.recommended_action || "",
        confidence: row.confidence || 1.0,
        root_cause_chain: row.root_cause_chain || [],
        drill_down_path: row.drill_down_path || {},
        reconciliation_run_id: row.reconciliation_run_id,
        created_at: row.created_at,
        updated_at: row.updated_at || row.created_at,
      }));
    } catch (e) {
      console.warn("[DiscrepancyStorageService] Exception loading discrepancies:", e);
      return DeterministicDiagnosticsEngine.generateAllCodesSample();
    }
  }

  /**
   * Update lifecycle status for a discrepancy record (OPEN, UNDER_REVIEW, CONFIRMED, DISPUTED, RESOLVED, REJECTED)
   */
  public static async updateStatus(
    id: string,
    newStatus: DiscrepancyStatus
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from("discrepancy_records")
        .update({ status: newStatus, updated_at: new Date().toISOString() } as any)
        .eq("id", id);

      if (error) {
        console.error("[DiscrepancyStorageService] Error updating status:", error);
        return { success: false, message: error.message };
      }

      return { success: true, message: `Status updated to ${newStatus}` };
    } catch (e: any) {
      console.error("[DiscrepancyStorageService] Exception updating status:", e);
      return { success: false, message: e.message || "Failed to update status." };
    }
  }
}
