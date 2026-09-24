import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
  "https://placeholder-project.supabase.co";

const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
  "placeholder-anon-key";

export const isSupabaseConfigured =
  Boolean(
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL)
  ) &&
  !SUPABASE_URL.includes("placeholder-project.supabase.co") &&
  SUPABASE_ANON_KEY !== "placeholder-anon-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface SupabaseInvoice {
  id?: string;
  account_number: string;
  invoice_number: string;
  customer_name: string;
  premise_id?: string;
  tariff_name?: string;
  billing_period?: string;
  billing_start?: string;
  billing_end?: string;
  peak_kwh?: number;
  standard_kwh?: number;
  off_peak_kwh?: number;
  total_kwh?: number;
  max_demand_kva?: number;
  invoiced_total?: number;
  reconciled_total?: number;
  variance_amount?: number;
  status?: string;
  raw_json?: any;
  created_at?: string;
}

export interface SupabaseRecovery {
  id?: string;
  period_name: string;
  dates: string;
  invoice_no: string;
  supply_location: string;
  premise_id: string;
  charge_category: string;
  invoiced_amount: number;
  calculated_amount: number;
  recovery_amount: number;
  root_cause: string;
  detailed_explanation: string;
  audit_formula: string;
  tariff_ref: string;
  status: "approved" | "pending" | "ready";
  created_at?: string;
}

/** Utility to fetch all seeded invoices from Supabase */
export async function fetchSupabaseInvoices(): Promise<SupabaseInvoice[]> {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetchInvoices notice:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Supabase connection error:", err);
    return [];
  }
}

/** Utility to fetch all overcharge recovery claims from Supabase */
export async function fetchSupabaseRecoveries(): Promise<SupabaseRecovery[]> {
  try {
    const { data, error } = await supabase
      .from("overcharge_recoveries")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Supabase fetchRecoveries notice:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("Supabase fetchRecoveries connection error:", err);
    return [];
  }
}

/** Utility to save or sync an invoice to Supabase */
export async function syncInvoiceToSupabase(inv: any): Promise<any> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from("invoices")
      .upsert(inv, { onConflict: "invoice_number" });
    if (error) {
      console.error("Failed to sync invoice to Supabase:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error syncing invoice to Supabase:", err);
    return null;
  }
}

/** Sync interval meter readings to Supabase database */
export async function syncMeterReadingsToSupabase(invoiceNumber: string, measurements: any[]): Promise<void> {
  if (!isSupabaseConfigured || !measurements || measurements.length === 0) return;
  try {
    const payload = measurements.slice(0, 500).map((m: any) => ({
      invoice_number: invoiceNumber,
      timestamp: m.ts instanceof Date ? m.ts.toISOString() : String(m.ts),
      kw: m.kW,
      kvar: m.kVAr,
      kva: m.kVA,
      power_factor: m.pf,
      tou: m.tou,
    }));
    const { error } = await supabase.from("meter_readings").insert(payload);
    if (error) console.warn("syncMeterReadingsToSupabase warning:", error.message);
  } catch (err) {
    console.warn("syncMeterReadingsToSupabase error:", err);
  }
}

/** Persist non-lossy raw document, OCR JSON, and detected tables */
export async function saveRawDocumentData(doc: any): Promise<any> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from("raw_documents").insert(doc);
    if (error) console.warn("saveRawDocumentData warning:", error.message);
    return data;
  } catch (err) {
    console.warn("saveRawDocumentData error:", err);
    return null;
  }
}

/** Persist automated validation engine results */
export async function saveValidationResults(results: any): Promise<any> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.from("validation_results").insert(results);
    if (error) console.warn("saveValidationResults warning:", error.message);
    return data;
  } catch (err) {
    console.warn("saveValidationResults error:", err);
    return null;
  }
}

/** Log pipeline step execution */
export async function saveProcessingLog(uploadId: string, stage: string, level: string, message: string, details?: any): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("processing_logs").insert({
      upload_id: uploadId,
      stage,
      level,
      message,
      details,
    });
  } catch {
    // Silent fallback
  }
}

