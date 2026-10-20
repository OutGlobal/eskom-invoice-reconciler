/**
 * Shared automatic reconciliation runner.
 *
 * Builds the authoritative reconciliation input from the currently loaded
 * invoice and interval telemetry, then executes the deterministic engine.
 * Used by the reconciliation workspace and immediately after an upload so a
 * reconciliation result exists without any manual action.
 */
import Decimal from "decimal.js-light";
import { computeTotals } from "@/lib/reconciliation";
import {
  DeterministicReconciliationEngine,
  DEFAULT_TOLERANCE_CONFIG,
} from "./reconciliationEngine";
import type { AuthoritativeReconciliationPayload, ToleranceConfig } from "./types";
import { TariffStorageService } from "@/domain/tariff/tariffStorageService";
import type { InvoiceData } from "@/lib/store";
import type { Measurement } from "@/lib/parseMeter";
import { TariffInterface } from "@/domain/tariff/tariffInterface";
import { PowerFactorEngine } from "./powerFactorEngine";
import { ALL_PRODUCTION_TARIFF_FIXTURES } from "@/domain/tariff/tariffFixtures";

export type AutoReconciliationStatus =
  "COMPLETED" | "AWAITING_INVOICE" | "AWAITING_METER_DATA" | "AWAITING_TARIFF" | "FAILED";

export interface AutoReconciliationOutcome {
  status: AutoReconciliationStatus;
  message: string;
  payload: AuthoritativeReconciliationPayload | null;
}

export function runAutomaticReconciliation(
  invoice: Partial<InvoiceData> | null | undefined,
  rows: Measurement[] | null | undefined,
  tolerance: ToleranceConfig = DEFAULT_TOLERANCE_CONFIG,
): AutoReconciliationOutcome {
  if (!invoice || !(invoice.invoiceNumber || invoice.invoiceNo || invoice.accountNumber)) {
    return {
      status: "AWAITING_INVOICE",
      message: "Reconciliation is waiting for an invoice to be uploaded.",
      payload: null,
    };
  }

  if (!rows || rows.length === 0) {
    return {
      status: "AWAITING_METER_DATA",
      message: "Reconciliation is waiting for interval meter data to be uploaded.",
      payload: null,
    };
  }

  let tariffVersion = invoice.tariffName
    ? TariffStorageService.getVersionForDate(invoice.tariffName, invoice.billingPeriodStart || "")
    : null;

  // If no custom uploaded tariff is active, resolve against gazetted NERSA production fixtures
  if (!tariffVersion) {
    const query = (invoice.tariffName || "").toLowerCase().trim();
    const dateObj = invoice.billingPeriodStart ? new Date(invoice.billingPeriodStart) : new Date();
    const targetIso = !Number.isNaN(dateObj.getTime())
      ? dateObj.toISOString().substring(0, 10)
      : new Date().toISOString().substring(0, 10);

    if (query) {
      tariffVersion =
        ALL_PRODUCTION_TARIFF_FIXTURES.find((v) => {
          const code = v.header.tariff_code.toLowerCase();
          const name = v.header.tariff_name.toLowerCase();
          const family = v.header.tariff_family.toLowerCase();
          const matches =
            code.includes(query) ||
            name.includes(query) ||
            family.includes(query) ||
            query.includes(family);
          if (!matches) return false;
          const eff = v.header.effective_date;
          const exp = v.header.expiry_date || "2099-12-31";
          return targetIso >= eff && targetIso <= exp;
        }) || null;

      if (!tariffVersion) {
        tariffVersion =
          ALL_PRODUCTION_TARIFF_FIXTURES.find((v) => {
            const code = v.header.tariff_code.toLowerCase();
            const name = v.header.tariff_name.toLowerCase();
            const family = v.header.tariff_family.toLowerCase();
            return (
              code.includes(query) ||
              name.includes(query) ||
              family.includes(query) ||
              query.includes(family)
            );
          }) || null;
      }
    }

    if (!tariffVersion) {
      tariffVersion = TariffInterface.getApplicableTariffSync(
        invoice.accountNumber || (invoice as any).id || invoice.invoiceNumber || "",
        invoice.meterNumber || "",
        {
          start: (invoice as any).billingStart || invoice.billingPeriodStart || "",
          end: (invoice as any).billingEnd || invoice.billingPeriodEnd || "",
        },
      );
    }
  }

  if (!tariffVersion) {
    return {
      status: "AWAITING_TARIFF",
      message:
        "Reconciliation is waiting for a tariff document that covers this billing period to be uploaded.",
      payload: null,
    };
  }

  try {
    const validRows = rows
      .map((r) => ({ ...r, ts: new Date(r.ts) }))
      .filter(
        (r) => Number.isFinite(r.ts.getTime()) && Number.isFinite(r.kW) && Number.isFinite(r.kVA),
      );
    if (!validRows.length) {
      return {
        status: "AWAITING_METER_DATA",
        message: "No valid interval measurements are available. Review the uploaded meter data.",
        payload: null,
      };
    }

    // -------------------------------------------------------------
    // AUTOMATIC PROCESSING (Zero Manual Entry): Aggregate AMR rows
    // -------------------------------------------------------------
    const bStart = invoice.billingPeriodStart ? new Date(invoice.billingPeriodStart).getTime() : 0;
    const bEnd = invoice.billingPeriodEnd
      ? new Date(invoice.billingPeriodEnd).getTime() + 86400000
      : Infinity;
    const inPeriodRows = validRows.filter((r) => {
      const t = r.ts.getTime();
      return t >= bStart && t <= bEnd;
    });
    const activeRows = inPeriodRows.length > 0 ? inPeriodRows : validRows;

    const totals = computeTotals(activeRows, invoice.nmd || 0);

    let totalReactiveKvarh = new Decimal(0);
    for (const r of activeRows) {
      if ((r as any).kVAR !== undefined) {
        totalReactiveKvarh = totalReactiveKvarh.plus(new Decimal((r as any).kVAR || 0).mul(0.5));
      } else if ((r as any).kvarh !== undefined) {
        totalReactiveKvarh = totalReactiveKvarh.plus(new Decimal((r as any).kvarh || 0));
      }
    }

    const pfRecord = PowerFactorEngine.calculatePowerFactor({
      kWh: totals.totalKWh,
      kVArh: totalReactiveKvarh,
    });

    const input = {
      invoice_id: invoice.invoiceNumber || invoice.invoiceNo || invoice.accountNumber || "",
      invoice_number: invoice.invoiceNumber || invoice.invoiceNo || invoice.accountNumber || "",
      account_number: invoice.accountNumber || "",
      billing_start: invoice.billingPeriodStart || "",
      billing_end: invoice.billingPeriodEnd || "",
      tariff_version: tariffVersion,

      billed_peak_kwh: new Decimal(invoice.peakKWh || 0),
      billed_standard_kwh: new Decimal(invoice.standardKWh || 0),
      billed_off_peak_kwh: new Decimal(invoice.offPeakKWh || 0),
      billed_total_kwh: new Decimal(invoice.totalKWh || 0),
      billed_maximum_demand_kva: new Decimal(invoice.maxDemandKVA || 0),
      billed_ratcheted_demand_kva: new Decimal(invoice.maxDemandKVA || 0),
      billed_reactive_energy_kvarh: new Decimal(invoice.reactive || 0),
      billed_energy_charges_zar: new Decimal(
        (invoice.peakEnergyCharge || 0) +
          (invoice.standardEnergyCharge || 0) +
          (invoice.offPeakEnergyCharge || 0),
      ),
      billed_demand_charges_zar: new Decimal(invoice.networkDemandCharge || 0),
      billed_network_charges_zar: new Decimal(
        (invoice.transmissionNetworkCharge || 0) + (invoice.networkCapacityCharge || 0),
      ),
      billed_service_charges_zar: new Decimal(invoice.serviceCharge || 0),
      billed_ancillary_charges_zar: new Decimal(invoice.ancillary || 0),
      billed_vat_zar: new Decimal(invoice.vat || 0),
      billed_total_invoice_zar: new Decimal(invoice.totalInclVat || invoice.invoiceTotal || 0),

      // Derived Calculated Telemetry Determinants
      calc_peak_kwh: new Decimal(totals.peakKWh),
      calc_standard_kwh: new Decimal(totals.standardKWh),
      calc_off_peak_kwh: new Decimal(totals.offPeakKWh),
      calc_total_kwh: new Decimal(totals.totalKWh),
      calc_maximum_demand_kva: new Decimal(totals.maxDemandKVA),
      calc_ratcheted_demand_kva: new Decimal(totals.maxDemandKVA),
      calc_reactive_energy_kvarh: totalReactiveKvarh,
      calc_power_factor: pfRecord.calculated_pf,
    };

    const payload = DeterministicReconciliationEngine.reconcile(input, tolerance);
    return {
      status: "COMPLETED",
      message:
        "Reconciliation calculated from available 30-minute meter intervals. Partial coverage is not a complete billing-period verification.",
      payload,
    };
  } catch (err: any) {
    return {
      status: "FAILED",
      message: err?.message || "Reconciliation could not be completed for the uploaded documents.",
      payload: null,
    };
  }
}

/**
 * Maps a single Statistical TOU monthly period into an InvoiceData representation.
 */
export function periodToInvoiceData(period: any): Partial<InvoiceData> {
  return {
    accountNumber: period.accountNumber || "7856504676",
    customerName: period.customerName || "Impala Platinum Mine",
    invoiceNumber: `${period.accountNumber || "7856504676"}-${String(period.sheetName || "").replace(/\s+/g, "")}`,
    invoiceNo: `${period.accountNumber || "7856504676"}-${String(period.sheetName || "").replace(/\s+/g, "")}`,
    billingPeriod: period.billingPeriod,
    billingPeriodStart: period.billingStart,
    billingPeriodEnd: period.billingEnd,
    tariffName: period.tariff || "Megaflex Non-Local Trans >132kV",
    peakKWh: period.activeEnergy?.peakKwh ?? 0,
    standardKWh: period.activeEnergy?.standardKwh ?? 0,
    offPeakKWh: period.activeEnergy?.offPeakKwh ?? 0,
    totalKWh: period.activeEnergy?.totalKwh ?? 0,
    maxDemandKVA: period.maxDemandKva?.total ?? period.maxDemandKva?.totalKva ?? 0,
    reactive: period.reactiveEnergy?.totalKvarh ?? 0,
    peakEnergyCharge: period.charges?.peakEnergy ?? 0,
    standardEnergyCharge: period.charges?.standardEnergy ?? 0,
    offPeakEnergyCharge: period.charges?.offPeakEnergy ?? 0,
    networkDemandCharge: period.charges?.networkDemand ?? 0,
    transmissionNetworkCharge: period.charges?.transmissionNetwork ?? 0,
    networkCapacityCharge: period.charges?.networkCapacity ?? 0,
    serviceCharge: (period.charges?.serviceCharge ?? 0) + (period.charges?.administrationCharge ?? 0),
    ancillary: period.charges?.ancillaryService ?? 0,
    vat: period.charges?.vatAmount ?? 0,
    totalInclVat: period.charges?.totalInvoiceAmount ?? 0,
    invoiceTotal: period.charges?.totalInvoiceAmount ?? 0,
  };
}

/**
 * Executes reconciliation across all monthly periods contained in a multi-period workbook.
 */
export function runMultiPeriodReconciliation(
  invoice: any,
  rows: Measurement[] | null | undefined,
  tolerance: ToleranceConfig = DEFAULT_TOLERANCE_CONFIG,
): Array<{ period: string; outcome: AutoReconciliationOutcome }> {
  if (!invoice?.monthlyPeriods || !Array.isArray(invoice.monthlyPeriods) || invoice.monthlyPeriods.length === 0) {
    return [{ period: "Primary", outcome: runAutomaticReconciliation(invoice, rows, tolerance) }];
  }

  return invoice.monthlyPeriods.map((p: any) => {
    const periodInvoice = periodToInvoiceData(p);
    return {
      period: p.sheetName,
      outcome: runAutomaticReconciliation(periodInvoice, rows, tolerance),
    };
  });
}

