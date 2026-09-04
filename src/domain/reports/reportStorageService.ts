import { supabase } from "@/lib/supabase";
import { DisputeReportMetadata } from "./types";

const memoryReportsStore: DisputeReportMetadata[] = [];

export async function saveGeneratedReportMetadata(
  meta: DisputeReportMetadata,
): Promise<{ success: boolean; id: string; warning?: string }> {
  try {
    memoryReportsStore.push(meta);

    // Ensure valid UUID format for DB insert or skip UUID string if custom text format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      meta.reportId,
    );
    const dbPayload: Record<string, any> = {
      report_type:
        meta.reportType === "DISPUTE_PACK_EXCEL" ? "RECONCILIATION_DETAIL" : "EXECUTIVE_SUMMARY",
      title: meta.fileName,
      parameters: {
        run_id: meta.runId,
        version: meta.version,
        sha256_hash: meta.sha256Hash,
        file_size_bytes: meta.fileSizeBytes,
        customer_id: meta.customerId,
        invoice_id: meta.invoiceId,
        created_by: meta.createdBy,
      },
      storage_path: meta.storageUrl || meta.fileName,
    };

    if (isUuid) {
      dbPayload.id = meta.reportId;
    }

    const { data, error } = await supabase
      .from("generated_reports")
      .insert(dbPayload)
      .select("id")
      .single();

    if (error) {
      console.warn("Supabase generated_reports insert warning:", error.message);
      return { success: true, id: meta.reportId, warning: error.message };
    }

    return { success: true, id: data?.id || meta.reportId };
  } catch (err: any) {
    return { success: true, id: meta.reportId, warning: err.message };
  }
}

export async function getGeneratedReportsByRunId(runId: string): Promise<DisputeReportMetadata[]> {
  try {
    const { data, error } = await supabase
      .from("generated_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return memoryReportsStore.filter((r) => r.runId === runId);
    }

    const matches = data.filter((r: any) => r.parameters?.run_id === runId);

    if (matches.length === 0) {
      return memoryReportsStore.filter((r) => r.runId === runId);
    }

    return matches.map((r: any) => ({
      reportId: r.id,
      runId: r.parameters?.run_id || runId,
      version: r.parameters?.version || "v1.0",
      organisationId: r.organisation_id || "",
      customerId: r.parameters?.customer_id || "",
      invoiceId: r.parameters?.invoice_id || "",
      reportType:
        r.report_type === "RECONCILIATION_DETAIL" ? "DISPUTE_PACK_EXCEL" : "DISPUTE_PACK_PDF",
      fileName: r.title,
      fileSizeBytes: r.parameters?.file_size_bytes || 0,
      sha256Hash: r.parameters?.sha256_hash || "",
      storageUrl: r.storage_path,
      createdAt: r.created_at,
      createdBy: r.parameters?.created_by || "",
    }));
  } catch {
    return memoryReportsStore.filter((r) => r.runId === runId);
  }
}
