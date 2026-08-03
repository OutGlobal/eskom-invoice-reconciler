import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://bramhseicmakyihvnvpo.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYW1oc2VpY21ha3lpaHZudnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODU2MzgsImV4cCI6MjEwMTM2MTYzOH0.SWNzOxO7ItRuSNuT3SL46A6nIsofjx4MATAki2pGjb0";

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
export async function syncInvoiceToSupabase(inv: SupabaseInvoice) {
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
