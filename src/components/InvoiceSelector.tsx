import { useEffect, useState } from "react";
import { Calendar, FileText, CheckCircle2, Upload, Beaker } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "react-hot-toast";

export function InvoiceSelector({ compact = false }: { compact?: boolean }) {
  const activeInvoice = useApp((s) => s.invoice);
  const setInvoice = useApp((s) => s.setInvoice);
  const batchInvoices = useApp((s) => s.batchInvoices);

  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Query real uploaded invoices from Supabase
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    supabase
      .from("invoice_records")
      .select("*")
      .order("billing_start", { ascending: false })
      .then(({ data, error }) => {
        if (isMounted) {
          if (data && data.length > 0) {
            setDbInvoices(data);
            // If store has no active invoice, select the most recent real uploaded invoice
            if (!useApp.getState().invoice) {
              const latest = data[0];
              setInvoice({
                accountNumber: latest.account_number,
                customerName: latest.customer_name || "Enterprise Client",
                meterNumber: latest.meter_number || latest.premise_id || "",
                tariffName: latest.tariff_name || latest.tariff_code || "Megaflex",
                voltage: "132 kV",
                nmd: 0,
                billingPeriod: latest.billing_period_name,
                billingPeriodStart: latest.billing_start,
                billingPeriodEnd: latest.billing_end,
                peakKWh: Number(latest.peak_kwh) || 0,
                standardKWh: Number(latest.standard_kwh) || 0,
                offPeakKWh: Number(latest.off_peak_kwh) || 0,
                totalKWh: Number(latest.total_kwh) || 0,
                maxDemandKVA: Number(latest.max_demand_kva) || 0,
                transmissionNetworkCharge: 0,
                networkCapacityCharge: 0,
                generationCapacityCharge: 0,
                networkDemandCharge: 0,
                ancillary: 0,
                legacy: 0,
                affordability: 0,
                electrification: 0,
                reactive: 0,
                peakEnergyCharge: 0,
                standardEnergyCharge: 0,
                offPeakEnergyCharge: 0,
                vat: 0,
                invoiceTotal: Number(latest.invoiced_total) || 0,
                totalInclVat: Number(latest.invoiced_total) || 0,
                invoiceNumber: latest.invoice_number,
                taxInvoiceNo: latest.invoice_number,
              });
            }
          }
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [setInvoice]);

  // Merge database records with active store batch uploads
  const allInvoices = [
    ...dbInvoices,
    ...batchInvoices.filter(
      (b) => !dbInvoices.some((db) => db.invoice_number === (b.invoiceNumber || b.taxInvoiceNo))
    ),
  ];

  const handleSelectRealInvoice = (inv: any) => {
    const invNum = inv.invoice_number || inv.invoiceNumber || inv.taxInvoiceNo;
    setInvoice({
      accountNumber: inv.account_number || inv.accountNumber,
      customerName: inv.customer_name || inv.customerName || "Enterprise Client",
      meterNumber: inv.meter_number || inv.meterNumber || "",
      tariffName: inv.tariff_name || inv.tariffName || "Megaflex",
      voltage: inv.voltage || "132 kV",
      nmd: inv.nmd || 0,
      billingPeriod: inv.billing_period_name || inv.billingPeriod,
      billingPeriodStart: inv.billing_start || inv.billingPeriodStart,
      billingPeriodEnd: inv.billing_end || inv.billingPeriodEnd,
      peakKWh: Number(inv.peak_kwh || inv.peakKWh) || 0,
      standardKWh: Number(inv.standard_kwh || inv.standardKWh) || 0,
      offPeakKWh: Number(inv.off_peak_kwh || inv.offPeakKWh) || 0,
      totalKWh: Number(inv.total_kwh || inv.totalKWh) || 0,
      maxDemandKVA: Number(inv.max_demand_kva || inv.maxDemandKVA) || 0,
      transmissionNetworkCharge: 0,
      networkCapacityCharge: 0,
      generationCapacityCharge: 0,
      networkDemandCharge: 0,
      ancillary: 0,
      legacy: 0,
      affordability: 0,
      electrification: 0,
      reactive: 0,
      peakEnergyCharge: 0,
      standardEnergyCharge: 0,
      offPeakEnergyCharge: 0,
      vat: 0,
      invoiceTotal: Number(inv.invoiced_total || inv.invoiceTotal) || 0,
      totalInclVat: Number(inv.invoiced_total || inv.invoiceTotal) || 0,
      invoiceNumber: invNum,
      taxInvoiceNo: invNum,
    });
    toast.success(`Active invoice switched to ${invNum}`);
  };

  const handleLoadSandboxBenchmark = (month: "FEB" | "MARCH" | "APRIL" | "MAY") => {
    const store = useApp.getState();
    if (month === "FEB") store.loadFeb2026SampleInvoice();
    if (month === "MARCH") store.loadMarch2026SampleInvoice();
    if (month === "APRIL") store.loadApril2026SampleInvoice();
    if (month === "MAY") store.loadMay2026SampleInvoice();
    toast.success(`Loaded Benchmark Sandbox (${month} 2026)`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 border border-border/80 rounded-xl p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground">Active Invoice:</span>
        </div>

        {allInvoices.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {allInvoices.map((inv) => {
              const invNum = inv.invoice_number || inv.invoiceNumber || inv.taxInvoiceNo;
              const isActive =
                activeInvoice?.invoiceNumber === invNum || activeInvoice?.taxInvoiceNo === invNum;
              const label = inv.billing_period_name || inv.billingPeriod || invNum;
              const totalZar = inv.invoiced_total || inv.invoiceTotal;

              return (
                <button
                  key={invNum}
                  onClick={() => handleSelectRealInvoice(inv)}
                  className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/50"
                  }`}
                >
                  {isActive && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground shrink-0" />
                  )}
                  <span>{label}</span>
                  {!compact && totalZar && (
                    <span
                      className={`text-[10px] rounded px-1.5 py-0.2 font-mono ${
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      R {Number(totalZar).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[11px] font-medium">
              No Utility Invoices Ingested
            </span>
            <Link
              to="/upload"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
            >
              <Upload className="h-3 w-3" /> Upload Invoice (PDF)
            </Link>
          </div>
        )}
      </div>

      {/* Benchmark Sandbox Selector (Strictly Segregated Developer/Evaluator Utility) */}
      <div className="flex items-center gap-2">
        <select
          onChange={(e) => {
            if (e.target.value) {
              handleLoadSandboxBenchmark(e.target.value as any);
              e.target.value = "";
            }
          }}
          defaultValue=""
          className="text-[11px] bg-background border border-border/70 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
        >
          <option value="" disabled>
            🧪 Benchmark Sandbox Mode...
          </option>
          <option value="FEB">Feb 2026 Benchmark (Impala R97m)</option>
          <option value="MARCH">Mar 2026 Benchmark (Curtailment R98m)</option>
          <option value="APRIL">Apr 2026 Benchmark (Pro-Rata R91m)</option>
          <option value="MAY">May 2026 Benchmark (Wheeling R97m)</option>
        </select>

        {activeInvoice && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-md px-2.5 py-1 font-mono text-[11px]">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>
              Inv: <strong className="text-foreground">{activeInvoice.taxInvoiceNo || activeInvoice.accountNumber}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
