/**
 * Data Quality Storage Service
 * Enterprise Persistence Service for Data Governance Issues, 5-Entity Scores & Review Queues
 * Manages Supabase DB integration for UNRESOLVED, UNDER_REVIEW, RESOLVED, and EXPLICITLY_OVERRIDDEN statuses.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  DataQualityIssueRecord,
  DataQualityStatus,
  QualityRuleCode,
  ResolutionStatus,
  ValidationFinding,
  ValidationReport,
} from "./types";
import { DataGovernanceEngine } from "./dataQualityEngine";

export class QualityStorageService {
  private static memoryReports: Map<string, ValidationReport> = new Map();
  private static memoryFindings: Map<string, ValidationFinding[]> = new Map();

  public static clearMemoryStore(): void {
    this.memoryReports.clear();
    this.memoryFindings.clear();
  }

  /**
   * Persists a complete ValidationReport and its findings
   */
  public static async saveValidationReport(
    report: ValidationReport,
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Cache in memory store for fast lookups, test resilience, and offline mode
    this.memoryReports.set(report.report_id, report);
    if (report.batch_id) {
      this.memoryReports.set(report.batch_id, report);
    }
    if (report.source_file_id) {
      this.memoryReports.set(report.source_file_id, report);
    }

    const existingFindings = this.memoryFindings.get(report.report_id) || [];
    this.memoryFindings.set(report.report_id, [...existingFindings, ...report.findings]);

    // 2. Persist findings to Supabase DB if available
    try {
      if (report.findings.length > 0) {
        const rows = report.findings.map((f) => ({
          issue_id: f.id,
          source: (f.affected_account_number ? "INVOICE" : "TELEMETRY_BATCH") as any,
          record_id: report.batch_id || report.source_file_id || report.report_id,
          quality_state: f.rule_code,
          severity: f.severity,
          description: `[${f.status}] ${f.description}`,
          recommended_action: f.recommended_action,
          resolution_status: "UNRESOLVED",
          deduction_points:
            f.severity === "CRITICAL"
              ? 25
              : f.severity === "HIGH"
                ? 15
                : f.severity === "MEDIUM"
                  ? 5
                  : 2,
          created_at: f.created_at,
        }));

        await supabase.from("data_quality_issues").insert(rows as any);
      }
      return { success: true };
    } catch (e: any) {
      console.warn(
        "[QualityStorageService] Could not persist findings to Supabase (using memory cache):",
        e?.message,
      );
      return { success: true };
    }
  }

  /**
   * Retrieves a ValidationReport by report ID, batch ID, or source file ID
   */
  public static getValidationReport(id: string): ValidationReport | null {
    return this.memoryReports.get(id) || null;
  }

  /**
   * Lists validation findings optionally filtered by status or rule code
   */
  public static listValidationFindings(filter?: {
    status?: DataQualityStatus;
    rule_code?: QualityRuleCode;
    report_id?: string;
  }): ValidationFinding[] {
    let allFindings: ValidationFinding[] = [];
    if (filter?.report_id) {
      allFindings = this.memoryFindings.get(filter.report_id) || [];
    } else {
      const reports = Array.from(this.memoryReports.values());
      for (const rep of reports) {
        allFindings.push(...rep.findings);
      }
    }

    // Deduplicate by finding ID
    const uniqueMap = new Map<string, ValidationFinding>();
    for (const f of allFindings) {
      uniqueMap.set(f.id, f);
    }
    let res = Array.from(uniqueMap.values());

    if (filter?.status) {
      res = res.filter((f) => f.status === filter.status);
    }
    if (filter?.rule_code) {
      res = res.filter((f) => f.rule_code === filter.rule_code);
    }

    return res;
  }

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
        return [];
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
      return [];
    }
  }

  /**
   * Update resolution status in review queue (RESOLVED, EXPLICITLY_OVERRIDDEN, UNDER_REVIEW)
   */
  public static async updateResolution(
    issueId: string,
    newStatus: ResolutionStatus,
    resolvedBy: string = "Auditor Admin",
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
