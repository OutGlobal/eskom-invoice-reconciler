import { createClient } from "@supabase/supabase-js";

const env = import.meta.env;
const runtime = typeof process === "undefined" ? undefined : process.env;
const url =
  env?.VITE_SUPABASE_URL || env?.NEXT_PUBLIC_SUPABASE_URL ||
  runtime?.VITE_SUPABASE_URL || runtime?.NEXT_PUBLIC_SUPABASE_URL || runtime?.SUPABASE_URL;
const key =
  env?.VITE_SUPABASE_PUBLISHABLE_KEY || env?.VITE_SUPABASE_ANON_KEY ||
  env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  runtime?.VITE_SUPABASE_PUBLISHABLE_KEY || runtime?.VITE_SUPABASE_ANON_KEY ||
  runtime?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || runtime?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  runtime?.SUPABASE_PUBLISHABLE_KEY || runtime?.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  url && key && !url.includes("placeholder-project.supabase.co") && key !== "placeholder-anon-key",
);

const defaultClient = isSupabaseConfigured
  ? createClient(url!, key!)
  : createClient("https://unconfigured.invalid", "unconfigured", {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: {
        fetch: async () =>
          new Response(JSON.stringify({ message: "Supabase is not configured" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          }),
      },
    });
let serverClientResolver: (() => typeof defaultClient | undefined) | undefined;
/** Installed only by the server entry; AsyncLocalStorage prevents request crossover. */
export function setServerClientResolver(resolver: () => typeof defaultClient | undefined): void {
  serverClientResolver = resolver;
}
export const supabase: typeof defaultClient = new Proxy(defaultClient, {
  get(_target, property) {
    const client = serverClientResolver?.() || defaultClient;
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

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
      throw error;
    }
    return data || [];
  } catch (err) {
    console.warn("Supabase connection error:", err);
    throw err;
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
      throw error;
    }
    return data || [];
  } catch (err) {
    console.warn("Supabase fetchRecoveries connection error:", err);
    throw err;
  }
}

