/**
 * Invoice Storage Service
 * Handles cryptographic hashing, database persistence, multi-criteria queries,
 * and lifecycle state updates in Supabase.
 */

import { supabase } from "../../lib/supabase";
import type {
  ExtractedInvoiceDocument,
  InvoiceLifecycleState,
  InvoiceHeaderMeta,
} from "./types";
import { InvoiceLifecycleService } from "./invoiceLifecycleService";

export interface InvoiceSearchFilter {
  clientId?: string;
  accountNumber?: string;
  podId?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  invoiceNumber?: string;
  tariffName?: string;
  lifecycleState?: InvoiceLifecycleState | "ALL";
  discrepancyOnly?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export class InvoiceStorageService {
  /**
   * Calculate SHA-256 fingerprint for document content
   */
  public static async computeSha256(content: Uint8Array | string): Promise<string> {
    const encoder = new TextEncoder();
    const data: BufferSource =
      typeof content === "string" ? encoder.encode(content) : (content as BufferSource);

    if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    const { createHash } = await import("crypto");
    const buffer = typeof content === "string" ? Buffer.from(content) : Buffer.from(content);
    return createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Persist extracted invoice document to Supabase database tables
   */
  public static async saveExtractedInvoice(doc: ExtractedInvoiceDocument): Promise<{
    success: boolean;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      const invoiceNumber = doc.invoice_number.value || `INV-DRAFT-${Date.now()}`;
      const accountNumber = doc.account_number.value || "ACC-UNKNOWN";
      const billingStart =
        doc.billing_period_start.value || new Date().toISOString().substring(0, 10);
      const billingEnd = doc.billing_period_end.value || new Date().toISOString().substring(0, 10);

      const initialState = doc.lifecycle_state || InvoiceLifecycleService.determineInitialState(doc, doc.validation_summary);

      const recordPayload = {
        invoice_number: invoiceNumber,
        account_number: accountNumber,
        customer_name: doc.customer_name.value || "Unknown Client",
        premise_id: doc.premise_id.value || null,
        meter_number: doc.meter_number.value || null,
        invoice_date: doc.invoice_date.value || new Date().toISOString().substring(0, 10),
        tariff_code: doc.tariff_code.value || null,
        tariff_name: doc.tariff_name.value || null,
        billing_period_name: `${billingStart} to ${billingEnd}`,
        billing_start: billingStart,
        billing_end: billingEnd,
        total_kwh: Number(doc.total_kwh.value) || 0,
        peak_kwh: Number(doc.peak_kwh.value) || 0,
        standard_kwh: Number(doc.standard_kwh.value) || 0,
        off_peak_kwh: Number(doc.off_peak_kwh.value) || 0,
        max_demand_kva: Number(doc.maximum_demand.value) || 0,
        invoiced_total: Number(doc.total_invoice_amount.value) || 0,
        sha256_hash: doc.metadata.sha256_hash,
        extraction_status: doc.metadata.overall_confidence > 0 ? "success" : "failed",
        validation_status: doc.validation_summary.status === "valid" ? "passed" : "warnings",
        lifecycle_state: initialState,
        status: initialState.toLowerCase(),
        raw_data: doc as any,
      };

      const { data: record, error: recordError } = await supabase
        .from("invoice_records")
        .upsert(recordPayload, { onConflict: "invoice_number" })
        .select("id")
        .single();

      if (recordError && !recordError.message.includes("FetchError")) {
        console.warn("Supabase invoice_records upsert warning:", recordError.message);
      }

      const invoiceId = record?.id || `local-${Date.now()}`;

      // 2. Insert into parser_results
      const parserPayload = {
        ingestion_job_id: "00000000-0000-0000-0000-000000000000",
        parser_name: doc.metadata.parser_version,
        extracted_data: doc as any,
        confidence_score: doc.metadata.overall_confidence,
      };

      await supabase.from("parser_results").insert(parserPayload).select().single();

      // 3. Insert Line Items
      if (doc.line_items.length > 0 && record?.id) {
        const lineItemPayloads = doc.line_items.map((item) => ({
          invoice_record_id: record.id,
          line_item_number: item.line_item_number,
          charge_code: item.charge_code || null,
          charge_label: item.charge_label,
          rate: Number(item.rate.value) || 0,
          quantity: Number(item.quantity.value) || 0,
          unit_of_measure: item.unit_of_measure,
          invoiced_amount: Number(item.invoiced_amount.value) || 0,
        }));

        await supabase.from("invoice_line_items").insert(lineItemPayloads);
      }

      return {
        success: true,
        invoiceId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to save extracted invoice",
      };
    }
  }

  /**
   * Update invoice lifecycle state in database
   */
  public static async updateLifecycleState(
    invoiceId: string,
    targetState: InvoiceLifecycleState,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from("invoice_records")
        .update({
          lifecycle_state: targetState,
          status: targetState.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (error && !error.message.includes("FetchError")) {
        console.warn("Supabase updateLifecycleState warning:", error.message);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Query invoice records with multi-criteria filtering
   */
  public static async queryInvoices(
    filter: InvoiceSearchFilter,
  ): Promise<InvoiceHeaderMeta[]> {
    try {
      let query = supabase.from("invoice_records").select("*");

      if (filter.accountNumber) {
        query = query.ilike("account_number", `%${filter.accountNumber}%`);
      }
      if (filter.invoiceNumber) {
        query = query.ilike("invoice_number", `%${filter.invoiceNumber}%`);
      }
      if (filter.tariffName) {
        query = query.ilike("tariff_name", `%${filter.tariffName}%`);
      }
      if (filter.lifecycleState && filter.lifecycleState !== "ALL") {
        query = query.eq("lifecycle_state", filter.lifecycleState);
      }
      if (filter.minAmount !== undefined) {
        query = query.gte("invoiced_total", filter.minAmount);
      }
      if (filter.maxAmount !== undefined) {
        query = query.lte("invoiced_total", filter.maxAmount);
      }

      const { data, error } = await query;

      if (error && !error.message.includes("FetchError")) {
        console.warn("Supabase queryInvoices warning:", error.message);
        return [];
      }

      if (!data) return [];

      return data.map((item: any) => ({
        invoice_id: item.id,
        account_number: item.account_number,
        organisation_id: item.organisation_id,
        client_name: item.customer_name || item.client_name,
        site_id: item.site_id,
        site_name: item.site_name || "Primary Site",
        pod_id: item.pod_id,
        premise_id: item.premise_id,
        meter_number: item.meter_id || item.meter_number,
        billing_period_start: item.billing_start,
        billing_period_end: item.billing_end,
        invoice_date: item.invoice_date || item.billing_start,
        tariff_code: item.tariff_code,
        tariff_name: item.tariff_name,
        supply_voltage: item.supply_voltage ? Number(item.supply_voltage) : undefined,
        source_file_id: item.source_file_id,
        sha256_hash: item.sha256_hash || "",
        extraction_status: item.extraction_status || "success",
        validation_status: item.validation_status || "passed",
        reconciliation_status: item.reconciliation_status || "unprocessed",
        lifecycle_state: (item.lifecycle_state as InvoiceLifecycleState) || "EXTRACTED",
      }));
    } catch (err: any) {
      console.warn("Query invoices error:", err.message);
      return [];
    }
  }
}
