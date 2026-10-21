import { useEffect, useState } from "react";
import { Calendar, FileText, CheckCircle2, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "react-hot-toast";
import seedData from "@/assets/millennium_33kv_reconciliation_records.json";

export function InvoiceSelector({ compact = false }: { compact?: boolean }) {
  const activeInvoice = useApp((s) => s.invoice);
  const setInvoice = useApp((s) => s.setInvoice);
  const batchInvoices = useApp((s) => s.batchInvoices);

  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Query real uploaded invoices from Supabase with local seed fallback
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      supabase.from("invoice_records").select("*").order("billing_start", { ascending: false }),
      supabase.from("invoices").select("*").order("billing_start", { ascending: false }),
    ]).then(([recResult, legacyResult]) => {
      if (isMounted) {
        const invoiceMap = new Map<string, any>();
        for (const inv of legacyResult.data || []) {
          const invNum = inv.invoice_number || inv.id;
          if (invNum) {
            invoiceMap.set(invNum, {
              ...inv,
              billing_period_name: inv.billing_period || "Standard Period",
              invoiced_total: Number(inv.invoiced_total) || 0,
            });
          }
        }
        for (const inv of recResult.data || []) {
          const invNum = inv.invoice_number || inv.id;
          if (invNum) {
            invoiceMap.set(invNum, inv);
          }
        }

        const combined = Array.from(invoiceMap.values());

        // Hydrate from multi-period deterministic seed if remote database is empty/offline
        if (combined.length === 0 && seedData?.periods) {
          for (const item of seedData.periods) {
            const inv = item.invoice;
            if (inv) {
              combined.push({
                ...inv,
                account_number: inv.accountNumber,
                customer_name: inv.customerName,
                meter_number: "7856504226F1, F2, F3",
                tariff_name: inv.tariffName,
                voltage: "33 kV",
                billing_period_name: item.periodName.replace("Millenium 33kV ", "").replace("Millenium 33kV - ", ""),
                billing_start: inv.billingPeriodStart,
                billing_end: inv.billingPeriodEnd,
                peak_kwh: inv.peakKWh,
                standard_kwh: inv.standardKWh,
                off_peak_kwh: inv.offPeakKWh,
                total_kwh: inv.totalKWh,
                max_demand_kva: inv.maxDemandKVA,
                invoiced_total: inv.totalInclVat,
                invoice_number: inv.invoiceNumber,
              });
            }
          }
        }

        if (combined.length > 0) {
          setDbInvoices(combined);
          // If store has no active invoice, select the most recent real uploaded invoice
          if (!useApp.getState().invoice) {
            const latest = combined[0];
            setInvoice({
              accountNumber: latest.account_number || latest.accountNumber,
              customerName: latest.customer_name || latest.customerName || "Enterprise Client",
              meterNumber: latest.meter_number || latest.meterNumber || "",
              tariffName: latest.tariff_name || latest.tariffName || "Megaflex",
              voltage: latest.voltage || "33 kV",
              nmd: latest.nmd || 0,
              billingPeriod: latest.billing_period_name || latest.billingPeriod,
              billingPeriodStart: latest.billing_start || latest.billingPeriodStart,
              billingPeriodEnd: latest.billing_end || latest.billingPeriodEnd,
              peakKWh: Number(latest.peak_kwh || latest.peakKWh) || 0,
              standardKWh: Number(latest.standard_kwh || latest.standardKWh) || 0,
              offPeakKWh: Number(latest.off_peak_kwh || latest.offPeakKWh) || 0,
              totalKWh: Number(latest.total_kwh || latest.totalKWh) || 0,
              maxDemandKVA: Number(latest.max_demand_kva || latest.maxDemandKVA) || 0,
              transmissionNetworkCharge: Number(latest.transmissionNetworkCharge) || 0,
              networkCapacityCharge: Number(latest.networkCapacityCharge) || 0,
              generationCapacityCharge: Number(latest.generationCapacityCharge) || 0,
              networkDemandCharge: Number(latest.networkDemandCharge) || 0,
              ancillary: Number(latest.ancillary) || 0,
              legacy: Number(latest.legacy) || 0,
              affordability: Number(latest.affordability) || 0,
              electrification: Number(latest.electrification) || 0,
              reactive: Number(latest.reactive) || 0,
              peakEnergyCharge: Number(latest.peakEnergyCharge) || 0,
              standardEnergyCharge: Number(latest.standardEnergyCharge) || 0,
              offPeakEnergyCharge: Number(latest.offPeakEnergyCharge) || 0,
              serviceCharge: Number(latest.serviceCharge) || 0,
              vat: Number(latest.vat) || 0,
              invoiceTotal: Number(latest.invoiced_total || latest.totalInclVat || latest.invoiceTotal) || 0,
              totalInclVat: Number(latest.invoiced_total || latest.totalInclVat || latest.invoiceTotal) || 0,
              invoiceNumber: latest.invoice_number || latest.invoiceNumber,
              taxInvoiceNo: latest.invoice_number || latest.invoiceNumber,
            });
          }
        }
        setIsLoading(false);
      }
    }).catch((err) => {
      console.warn("Invoice records query notice:", err);
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [setInvoice]);

  // Merge database records with active store batch uploads
  const allInvoices = [
    ...dbInvoices,
    ...batchInvoices.filter(
      (b) => !dbInvoices.some((db) => db.invoice_number === (b.invoiceNumber || b.taxInvoiceNo)),
    ),
  ];

  const handleSelectRealInvoice = (inv: any) => {
    const invNum = inv.invoice_number || inv.invoiceNumber || inv.taxInvoiceNo;
    setInvoice({
      accountNumber: inv.account_number || inv.accountNumber,
      customerName: inv.customer_name || inv.customerName || "Enterprise Client",
      meterNumber: inv.meter_number || inv.meterNumber || "",
      tariffName: inv.tariff_name || inv.tariffName || "Megaflex",
      voltage: inv.voltage || "33 kV",
      nmd: inv.nmd || 0,
      billingPeriod: inv.billing_period_name || inv.billingPeriod,
      billingPeriodStart: inv.billing_start || inv.billingPeriodStart,
      billingPeriodEnd: inv.billing_end || inv.billingPeriodEnd,
      peakKWh: Number(inv.peak_kwh || inv.peakKWh) || 0,
      standardKWh: Number(inv.standard_kwh || inv.standardKWh) || 0,
      offPeakKWh: Number(inv.off_peak_kwh || inv.offPeakKWh) || 0,
      totalKWh: Number(inv.total_kwh || inv.totalKWh) || 0,
      maxDemandKVA: Number(inv.max_demand_kva || inv.maxDemandKVA) || 0,
      transmissionNetworkCharge: Number(inv.transmissionNetworkCharge) || 0,
      networkCapacityCharge: Number(inv.networkCapacityCharge) || 0,
      generationCapacityCharge: Number(inv.generationCapacityCharge) || 0,
      networkDemandCharge: Number(inv.networkDemandCharge) || 0,
      ancillary: Number(inv.ancillary) || 0,
      legacy: Number(inv.legacy) || 0,
      affordability: Number(inv.affordability) || 0,
      electrification: Number(inv.electrification) || 0,
      reactive: Number(inv.reactive) || 0,
      peakEnergyCharge: Number(inv.peakEnergyCharge) || 0,
      standardEnergyCharge: Number(inv.standardEnergyCharge) || 0,
      offPeakEnergyCharge: Number(inv.offPeakEnergyCharge) || 0,
      serviceCharge: Number(inv.serviceCharge) || 0,
      vat: Number(inv.vat) || 0,
      invoiceTotal: Number(inv.invoiced_total || inv.totalInclVat || inv.invoiceTotal) || 0,
      totalInclVat: Number(inv.invoiced_total || inv.totalInclVat || inv.invoiceTotal) || 0,
      invoiceNumber: invNum,
      taxInvoiceNo: invNum,
    });
    toast.success(`Active invoice switched to ${inv.billing_period_name || invNum}`);
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

      <div className="flex items-center gap-2">
        {activeInvoice && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-md px-2.5 py-1 font-mono text-[11px]">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>
              Inv:{" "}
              <strong className="text-foreground">
                {activeInvoice.taxInvoiceNo || activeInvoice.accountNumber}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
