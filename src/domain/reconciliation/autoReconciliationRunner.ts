/**
 * Shared automatic reconciliation runner.
 *
 * Builds the authoritative reconciliation input from the currently loaded
 * invoice and interval telemetry, then executes the deterministic engine.
 * Used by the reconciliation workspace and immediately after an upload so a
 * reconciliation result exists without any manual action.
 */
import Decimal from "decimal.js-light";
import {
  DeterministicReconciliationEngine,
  DEFAULT_TOLERANCE_CONFIG,
} from "./reconciliationEngine";
import type { AuthoritativeReconciliationPayload, ToleranceConfig } from "./types";
import { TariffStorageService } from "@/domain/tariff/tariffStorageService";
import type { InvoiceData } from "@/lib/store";
import type { Measurement } from "@/lib/parseMeter";

export type AutoReconciliationStatus =
  | "COMPLETED"
  | "AWAITING_INVOICE"
  | "AWAITING_METER_DATA"
  | "AWAITING_TARIFF"
  | "FAILED";

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
  if (!invoice || !(invoice.invoiceNumber || invoice.invoiceNo)) {
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

  const tariffVersion = TariffStorageService.getVersionForDate(
    invoice.tariffName || "",
    invoice.billingPeriodStart || "",
  );

  if (!tariffVersion) {
    return {
      status: "AWAITING_TARIFF",
      message:
        "Reconciliation is waiting for a tariff document that covers this billing period to be uploaded.",
      payload: null,
    };
  }

  try {
    const input = {
      invoice_id: invoice.invoiceNumber || invoice.invoiceNo || "",
      invoice_number: invoice.invoiceNumber || invoice.invoiceNo || "",
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
    };

    const payload = DeterministicReconciliationEngine.reconcile(input, tolerance);
    return {
      status: "COMPLETED",
      message: "Reconciliation completed automatically for the uploaded documents.",
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
