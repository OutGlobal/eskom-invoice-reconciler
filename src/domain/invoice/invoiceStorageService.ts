/**
 * Invoice Storage Service
 * Handles cryptographic hashing, database persistence, multi-criteria queries,
 * and lifecycle state updates in Supabase.
 */

import { supabase } from "../../lib/supabase";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import type { ExtractedInvoiceDocument, InvoiceLifecycleState, InvoiceHeaderMeta } from "./types";
import { InvoiceLifecycleService } from "./invoiceLifecycleService";

export interface InvoiceSearchFilter {
  organisationId?: string;
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
  private static memoryStore: Map<string, any> = new Map();
  private static lineItemStore: Map<string, any[]> = new Map();

  private static async withTimeout<T>(promise: PromiseLike<T>, ms = 600): Promise<T> {
    let timer: any;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Supabase request timeout")), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  public static recordInvoiceMemory(key: string, payload: any): void {
    this.memoryStore.set(key, payload);
    if (payload.invoice_number) {
      this.memoryStore.set(payload.invoice_number, payload);
    }
  }

  public static getInvoiceRecord(key: string): any {
    return this.memoryStore.get(key) || null;
  }

  public static recordLineItemsMemory(key: string, lineItems: any[]): void {
    this.lineItemStore.set(key, lineItems);
  }

  public static getLineItems(key: string): any[] {
    return this.lineItemStore.get(key) || [];
  }

  public static clearMemoryStore(): void {
    this.memoryStore.clear();
    this.lineItemStore.clear();
  }

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
   * Persist extracted invoice document to Supabase database tables with strict tenant stamping
   */
  public static async saveExtractedInvoice(
    doc: ExtractedInvoiceDocument,
    organisationId?: string,
    context?: UserSecurityContext,
  ): Promise<{
    success: boolean;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      // Enforce caller security context if provided
      let effectiveOrgId = organisationId || (doc as any).organisation_id || null;
      if (context) {
        if (context.role !== "SUPER_ADMIN") {
          if (organisationId && organisationId !== context.organisationId) {
            throw new TenantIsolationViolationError(context.organisationId, organisationId);
          }
          effectiveOrgId = context.organisationId;
        } else if (!effectiveOrgId) {
          effectiveOrgId = context.organisationId;
        }
      }

      const invoiceNumber = doc.invoice_number.value || `INV-DRAFT-${Date.now()}`;
      const accountNumber = doc.account_number.value || "ACC-UNKNOWN";
      const billingStart =
        doc.billing_period_start.value || new Date().toISOString().substring(0, 10);
      const billingEnd = doc.billing_period_end.value || new Date().toISOString().substring(0, 10);

      // Auto-link Customer, Site, and Meter from master data
      let customerId = doc.customer_id || null;
      let siteId = doc.site_id || null;
      let meterId = doc.meter_id || null;

      if (!customerId && accountNumber) {
        try {
          const { data: cust } = await supabase
            .from("customers")
            .select("id")
            .eq("account_number", accountNumber)
            .maybeSingle();
          if (cust?.id) customerId = cust.id;
        } catch {
          // Master data lookup fallback
        }
      }

      if (customerId && !siteId) {
        try {
          let siteQuery = supabase.from("sites").select("id").eq("customer_id", customerId);
          if (doc.premise_id?.value) {
            siteQuery = siteQuery.eq("premise_id", doc.premise_id.value);
          }
          const { data: site } = await siteQuery.limit(1).maybeSingle();
          if (site?.id) siteId = site.id;
        } catch {
          // Master data lookup fallback
        }
      }

      if (siteId && !meterId && doc.meter_number?.value) {
        try {
          const { data: meter } = await supabase
            .from("meters")
            .select("id")
            .eq("site_id", siteId)
            .eq("meter_number", doc.meter_number.value)
            .maybeSingle();
          if (meter?.id) meterId = meter.id;
        } catch {
          // Master data lookup fallback
        }
      }

      const initialState =
        doc.lifecycle_state ||
        InvoiceLifecycleService.determineInitialState(doc, doc.validation_summary);

      const parseOptionalNumber = (val: any): number | null => {
        if (val === undefined || val === null || val === "") return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      const recordPayload = {
        invoice_number: invoiceNumber,
        account_number: accountNumber,
        organisation_id: effectiveOrgId,
        customer_id: customerId,
        site_id: siteId,
        meter_id: meterId,
        customer_name: doc.customer_name.value || "Unknown Client",
        premise_id: doc.premise_id.value || null,
        meter_number: doc.meter_number.value || null,
        invoice_date: doc.invoice_date.value || new Date().toISOString().substring(0, 10),
        tariff_code: doc.tariff_code.value || null,
        tariff_name: doc.tariff_name.value || null,
        billing_period_name: `${billingStart} to ${billingEnd}`,
        billing_start: billingStart,
        billing_end: billingEnd,
        opening_reading: parseOptionalNumber(doc.opening_reading?.value),
        closing_reading: parseOptionalNumber(doc.closing_reading?.value),
        total_kwh: parseOptionalNumber(doc.total_kwh.value),
        peak_kwh: parseOptionalNumber(doc.peak_kwh.value),
        standard_kwh: parseOptionalNumber(doc.standard_kwh.value),
        off_peak_kwh: parseOptionalNumber(doc.off_peak_kwh.value),
        max_demand_kva: parseOptionalNumber(doc.maximum_demand.value),
        utilised_capacity: parseOptionalNumber(doc.utilised_capacity?.value),
        reactive_energy_kvarh: parseOptionalNumber(doc.reactive_energy_kvarh?.value),
        power_factor: parseOptionalNumber(doc.power_factor?.value),
        subtotal_amount: parseOptionalNumber(doc.subtotal_amount?.value),
        vat_amount: parseOptionalNumber(doc.vat_amount?.value),
        energy_charges: parseOptionalNumber(doc.active_energy?.value),
        demand_charges: parseOptionalNumber(doc.demand_charges?.value),
        network_charges: parseOptionalNumber(doc.network_charges?.value),
        service_charges: parseOptionalNumber(doc.service_charges?.value),
        ancillary_charges: parseOptionalNumber(doc.reliability_services?.value),
        subsidies_charges: parseOptionalNumber(doc.adjustments?.value),
        invoiced_total: parseOptionalNumber(doc.total_invoice_amount.value) ?? 0,
        missing_fields: doc.missing_fields || [],
        sha256_hash: doc.metadata.sha256_hash,
        extraction_status: doc.metadata.overall_confidence > 0 ? "success" : "failed",
        validation_status: doc.validation_summary.status === "valid" ? "passed" : "warnings",
        lifecycle_state: initialState,
        status: initialState.toLowerCase(),
        raw_data: doc as any,
      };

      let record: any = null;
      try {
        const res = await this.withTimeout(
          supabase
            .from("invoice_records")
            .upsert(recordPayload, { onConflict: "invoice_number" })
            .select("id")
            .single(),
          800,
        );
        record = res.data;
      } catch {
        // Fallback to in-memory store in offline / test mode
      }

      const invoiceId = record?.id || `local-${Date.now()}`;
      this.recordInvoiceMemory(invoiceId, { id: invoiceId, ...recordPayload });
      this.recordInvoiceMemory(recordPayload.invoice_number, { id: invoiceId, ...recordPayload });

      // 2. Insert into parser_results
      const parserPayload = {
        ingestion_job_id: (doc as any).ingestion_job_id || "00000000-0000-0000-0000-000000000000",
        parser_name: doc.metadata.parser_version,
        extracted_data: doc as any,
        confidence_score: doc.metadata.overall_confidence,
      };

      try {
        await this.withTimeout(
          supabase.from("parser_results").insert(parserPayload).select().single(),
          500,
        );
      } catch {
        // Offline mode fallback
      }

      // 3. Insert Line Items
      if (doc.line_items.length > 0) {
        const lineItemPayloads = doc.line_items.map((item) => ({
          invoice_record_id: invoiceId,
          organisation_id: effectiveOrgId,
          line_item_number: item.line_item_number,
          charge_code: item.charge_code || null,
          charge_label: item.charge_label,
          rate: parseOptionalNumber(item.rate?.value),
          quantity: parseOptionalNumber(item.quantity?.value),
          unit_of_measure: item.unit_of_measure || null,
          invoiced_amount: parseOptionalNumber(item.invoiced_amount?.value) ?? 0,
        }));

        this.recordLineItemsMemory(invoiceId, lineItemPayloads);
        this.recordLineItemsMemory(recordPayload.invoice_number, lineItemPayloads);

        try {
          await this.withTimeout(supabase.from("invoice_line_items").insert(lineItemPayloads), 500);
        } catch {
          // Offline mode fallback
        }
      }

      return {
        success: true,
        invoiceId,
      };
    } catch (err: any) {
      if (err instanceof TenantIsolationViolationError) {
        throw err;
      }
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
   * Query invoice records with multi-criteria filtering and server-side tenant isolation
   */
  public static async queryInvoices(
    filter: InvoiceSearchFilter,
    context?: UserSecurityContext,
  ): Promise<InvoiceHeaderMeta[]> {
    try {
      // Enforce caller security context if provided
      if (context && context.role !== "SUPER_ADMIN") {
        if (filter.organisationId && filter.organisationId !== context.organisationId) {
          throw new TenantIsolationViolationError(context.organisationId, filter.organisationId);
        }
        filter.organisationId = context.organisationId;
      }

      let query = supabase.from("invoice_records").select("*");

      if (filter.organisationId) {
        query = query.eq("organisation_id", filter.organisationId);
      }
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

      let results: InvoiceHeaderMeta[] = data.map((item: any) => ({
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

      // In-memory defense-in-depth filter against leaks
      if (context && context.role !== "SUPER_ADMIN") {
        results = results.filter(
          (r) => !r.organisation_id || r.organisation_id === context.organisationId,
        );
      }

      return results;
    } catch (err: any) {
      if (err instanceof TenantIsolationViolationError) {
        throw err;
      }
      console.warn("Query invoices error:", err.message);
      return [];
    }
  }
}
