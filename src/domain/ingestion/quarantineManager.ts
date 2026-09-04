/**
 * Ingestion Quarantine & Malformed Record Manager
 * Ensures corrupt or rejected files never disappear silently and can be audited by administrators
 */

import { supabase } from "@/lib/supabase";
import type { IngestionBatchJob, IngestionErrorRecord } from "./types";

export class QuarantineManager {
  private static quarantinedJobs: Map<
    string,
    { job: IngestionBatchJob; errors: IngestionErrorRecord[] }
  > = new Map();

  /**
   * Quarantine a failed ingestion job and record line-by-line errors
   */
  public static async quarantineJob(
    job: IngestionBatchJob,
    errors: IngestionErrorRecord[],
  ): Promise<void> {
    job.state = "QUARANTINED";
    this.quarantinedJobs.set(job.jobId, { job, errors });

    try {
      // 1. Update status in ingestion_jobs
      await supabase
        .from("ingestion_jobs")
        .update({
          status: "failed",
          error_summary: job.quarantineReason || "Quarantined due to parsing/schema error",
          error_count: errors.length,
        })
        .eq("id", job.jobId);

      // 2. Persist line items into ingestion_errors
      if (errors.length > 0) {
        const payload = errors.map((e) => ({
          ingestion_job_id: job.jobId,
          error_code: e.errorCode,
          error_message: e.errorMessage,
          error_details: { rawValue: e.rawValue, columnName: e.columnName },
          line_number: e.rowNumber || 1,
          severity: e.severity,
        }));

        await supabase.from("ingestion_errors").insert(payload);
      }
    } catch (err) {
      console.warn("QuarantineManager persistence notice:", err);
    }
  }

  /**
   * Retrieve quarantined jobs for user review
   */
  public static getQuarantinedJobs(): Array<{
    job: IngestionBatchJob;
    errors: IngestionErrorRecord[];
  }> {
    return Array.from(this.quarantinedJobs.values());
  }

  /**
   * Clear quarantine memory map
   */
  public static clearMemory(): void {
    this.quarantinedJobs.clear();
  }
}
