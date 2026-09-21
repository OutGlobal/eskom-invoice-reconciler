import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL) ||
    "https://bramhseicmakyihvnvpo.supabase.co";
const SUPABASE_ANON_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY) ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYW1oc2VpY21ha3lpaHZudnBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODU2MzgsImV4cCI6MjEwMTM2MTYzOH0.SWNzOxO7ItRuSNuT3SL46A6nIsofjx4MATAki2pGjb0";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
/** Utility to fetch all seeded invoices from Supabase */
export async function fetchSupabaseInvoices() {
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
    }
    catch (err) {
        console.warn("Supabase connection error:", err);
        return [];
    }
}
/** Utility to fetch all overcharge recovery claims from Supabase */
export async function fetchSupabaseRecoveries() {
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
    }
    catch (err) {
        console.warn("Supabase fetchRecoveries connection error:", err);
        return [];
    }
}
/** Utility to save or sync an invoice to Supabase */
export async function syncInvoiceToSupabase(inv) {
    try {
        const { data, error } = await supabase
            .from("invoices")
            .upsert(inv, { onConflict: "invoice_number" });
        if (error) {
            console.error("Failed to sync invoice to Supabase:", error.message);
            return null;
        }
        return data;
    }
    catch (err) {
        console.error("Error syncing invoice to Supabase:", err);
        return null;
    }
}
/** Sync interval meter readings to Supabase database */
export async function syncMeterReadingsToSupabase(invoiceNumber, measurements) {
    try {
        if (!measurements || measurements.length === 0)
            return;
        const payload = measurements.slice(0, 500).map((m) => ({
            invoice_number: invoiceNumber,
            timestamp: m.ts.toISOString(),
            kw: m.kW,
            kvar: m.kVAr,
            kva: m.kVA,
            power_factor: m.pf,
            tou: m.tou,
        }));
        const { error } = await supabase.from("meter_readings").insert(payload);
        if (error)
            console.warn("syncMeterReadingsToSupabase warning:", error.message);
    }
    catch (err) {
        console.warn("syncMeterReadingsToSupabase error:", err);
    }
}
/** Persist non-lossy raw document, OCR JSON, and detected tables */
export async function saveRawDocumentData(doc) {
    try {
        const { data, error } = await supabase.from("raw_documents").insert(doc);
        if (error)
            console.warn("saveRawDocumentData warning:", error.message);
        return data;
    }
    catch (err) {
        console.warn("saveRawDocumentData error:", err);
        return null;
    }
}
/** Persist automated validation engine results */
export async function saveValidationResults(results) {
    try {
        const { data, error } = await supabase.from("validation_results").insert(results);
        if (error)
            console.warn("saveValidationResults warning:", error.message);
        return data;
    }
    catch (err) {
        console.warn("saveValidationResults error:", err);
        return null;
    }
}
/** Log pipeline step execution */
export async function saveProcessingLog(uploadId, stage, level, message, details) {
    try {
        await supabase.from("processing_logs").insert({
            upload_id: uploadId,
            stage,
            level,
            message,
            details,
        });
    }
    catch (err) {
        // Silent fallback
    }
}
