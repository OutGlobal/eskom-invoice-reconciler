/**
 * Data Quality Storage Service
 * Enterprise Persistence Service for Data Governance Issues, 5-Entity Scores & Review Queues
 * Manages Supabase DB integration for UNRESOLVED, UNDER_REVIEW, RESOLVED, and EXPLICITLY_OVERRIDDEN statuses.
 */

import { supabase } from "@/integrations/supabase/client";
import type { DataQualityIssueRecord, ResolutionStatus } from "./types";
import { DataGovernanceEngine } from "./dataQualityEngine";

export class QualityStorageService {
  /**
   * Fetch all data quality issue records from Supabase or sample fixtures
   */
  public static async getIssues(): Promise<DataQualityIssueRecord[]> {
    try {
      const { data: dbIssues, error } = await supabase
        .from("data_quality_issues")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !dbIssues || dbIssues.length === 0) {
        console.warn("[QualityStorageService] Supabase issues table empty or unavailable, using sample fixtures.");
        return DataGovernanceEngine.generateSampleGovernanceIssues();
      }

      return dbIssues.map((row: any) => ({
        issue_id: row.issue_id,
        source: row.source,
        record_id: row.record_id,
        quality_state: row.quality_state,
        severity: row.severity,
        description: row.description,
        recommended_action: row.recommended_action,
        resolution_status: row.resolution_status as ResolutionStatus,
        resolved_by: row.resolved_by,
        resolved_timestamp: row.resolved_timestamp,
        deduction_points: Number(row.deduction_points || 5),
        created_at: row.created_at,
      }));
    } catch (e) {
      console.warn("[QualityStorageService] Exception loading quality issues:", e);
      return DataGovernanceEngine.generateSampleGovernanceIssues();
    }
  }

  /**
   * Update resolution status in review queue (RESOLVED, EXPLICITLY_OVERRIDDEN, UNDER_REVIEW)
   */
  public static async updateResolution(
    issueId: string,
    newStatus: ResolutionStatus,
    resolvedBy: string = "Auditor Admin"
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resolvedAt = new Date().toISOString();
      const { error } = await supabase
        .from("data_quality_issues")
        .update({
          resolution_status: newStatus,
          resolved_by: resolvedBy,
          resolved_timestamp: resolvedAt,
          updated_at: resolvedAt,
        } as any)
        .eq("issue_id", issueId);

      if (error) {
        console.error("[QualityStorageService] Error updating resolution:", error);
        return { success: false, message: error.message };
      }

      return { success: true, message: `Issue ${issueId} updated to ${newStatus}` };
    } catch (e: any) {
      console.error("[QualityStorageService] Exception updating resolution:", e);
      return { success: false, message: e.message || "Failed to update resolution." };
    }
  }
}
