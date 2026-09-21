import { create } from "zustand";
import type { Measurement } from "./parseMeter";

export interface TariffData {
  name: string;
  voltage: string;
  zone: string;
  powerFactor: number;
  networkCapacity: number;
  networkDemand: number;
  generationCapacity: number;
  transmissionNetwork: number;
  legacy: number;
  ancillary: number;
  electrification: number;
  affordability: number;
  energy: {
    high: { peak: number; standard: number; offPeak: number };
    low: { peak: number; standard: number; offPeak: number };
  };
  source?: string; // filename
}

export interface UploadedFile {
  name: string;
  size: number;
  type: "tariff" | "meter" | "invoice";
  uploadedAt: Date;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  count?: number;
}

export interface CustomerInfo {
  name: string;
  meter: string;
  accountNumber: string;
  address: string;
  nmd: number;
}

export interface InvoiceData {
  source?: string;
  customerName: string;
  accountNumber: string;
  meterNumber: string;
  tariffName: string;
  voltage: string;
  nmd?: number | null;
  billingPeriod: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  peakKWh?: number | null;
  standardKWh?: number | null;
  offPeakKWh?: number | null;
  totalKWh?: number | null;
  maxDemandKVA?: number | null;
  transmissionNetworkCharge?: number | null;
  networkCapacityCharge?: number | null;
  generationCapacityCharge?: number | null;
  networkDemandCharge?: number | null;
  ancillary?: number | null;
  legacy?: number | null;
  affordability?: number | null;
  electrification?: number | null;
  reactive?: number | null;
  peakEnergyCharge?: number | null;
  standardEnergyCharge?: number | null;
  offPeakEnergyCharge?: number | null;
  vat?: number | null;
  invoiceTotal?: number | null;
  totalInclVat?: number | null;
  reconciledTotal?: number | null;
  // Extended (optional) fields extracted from real Eskom invoices
  invoiceNo?: string;
  billingDate?: string;
  dueDate?: string;
  accountMonth?: string;
  vatReg?: string;
  premiseId?: string;
  utilisedCapacity?: number;
  address?: string;
  administrationCharge?: number;
  serviceCharge?: number;
  connectionCharge?: number;
  demandPeak?: number;
  demandStd?: number;
  demandOffPeak?: number;
  demandReading?: number;
  simMaxDemand?: number;
  loadFactor?: number;
  reactivePeak?: number;
  reactiveStd?: number;
  reactiveOffPeak?: number;
  reactiveTotal?: number;
  region?: string;
  billingOffice?: string;
  taxInvoiceNo?: string;
  invoiceNumber?: string;
  meterReadings?: InvoiceMeterReadingStored[];
  extraction?: InvoiceExtractionAudit;
  normalizedJson?: NormalizedInvoiceJson;
}

export interface InvoiceLineItemStored {
  label: string;
  normalizedName?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  rateUnit?: string;
  amount: number;
  confidence?: number;
  needsReview?: boolean;
  originalValue?: string;
  alternatives?: string[];
}

export interface InvoiceMeterReadingStored {
  label: string;
  previousReading?: number;
  currentReading?: number;
  readingDate?: string;
  multiplier?: number;
  meterConstant?: number;
  confidence?: number;
  needsReview?: boolean;
}

export interface InvoiceFieldExtraction {
  value: string | number;
  confidence: number;
  raw: string;
  needsReview: boolean;
  alternatives?: string[];
}

export interface InvoiceExtractionAudit {
  documentType: "embedded-text" | "scanned-pdf" | "image";
  parserVersion: string;
  extractedAt: string;
  overallConfidence: number;
  needsReview: boolean;
  totalValidation: "passed" | "review" | "not-available";
  originalInvoice: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  };
  fields: Record<string, InvoiceFieldExtraction>;
  rawTextPreview: string;
}

export interface NormalizedInvoiceJson {
  metadata: {
    customerName: string;
    accountNumber: string;
    premiseId: string;
    meterNumber: string;
    tariff: string;
    region: string;
    billingOffice: string;
    billingDate: string;
    billingPeriod: { start: string; end: string };
    invoiceNumber: string;
    vatNumber: string;
    accountMonth: string;
    dueDate: string;
    notifiedMaximumDemand?: number | null;
    utilisedCapacity?: number | null;
    simultaneousMaximumDemand?: number | null;
    loadFactor?: number | null;
  };
  consumption: {
    peakKwh?: number | null;
    standardKwh?: number | null;
    offPeakKwh?: number | null;
    totalKwh?: number | null;
    peakDemand?: number | null;
    standardDemand?: number | null;
    offPeakDemand?: number | null;
    peakReactive?: number | null;
    standardReactive?: number | null;
    offPeakReactive?: number | null;
  };
  charges: {
    administration?: number | null;
    transmissionNetwork?: number | null;
    distributionNetwork?: number | null;
    generationCapacity?: number | null;
    networkDemand?: number | null;
    peakEnergy?: number | null;
    standardEnergy?: number | null;
    offPeakEnergy?: number | null;
    ancillaryService?: number | null;
    legacy?: number | null;
    affordabilitySubsidy?: number | null;
    electrificationSubsidy?: number | null;
    serviceCharge?: number | null;
    connectionCharge?: number | null;
    vat?: number | null;
    totalInvoice?: number | null;
    totalInclVat?: number | null;
  };
}

interface AppState {
  rows: Measurement[];
  setRows: (r: Measurement[]) => void;

  invoice: InvoiceData | null;
  setInvoice: (i: InvoiceData | null) => void;

  invoiceItems: InvoiceLineItemStored[];
  setInvoiceItems: (items: InvoiceLineItemStored[]) => void;

  processedInvoiceNumbers: string[];
  addProcessedInvoiceNumber: (invoiceNumber: string) => void;

  tariff: TariffData;
  setTariff: (t: TariffData) => void;

  customer: CustomerInfo;
  setCustomer: (c: Partial<CustomerInfo>) => void;

  invoiceTotal: number;
  invoiceLines: Record<string, number>;
  setInvoiceTotal: (n: number) => void;
  setInvoiceLines: (v: Record<string, number>) => void;

  uploads: UploadedFile[];
  addUpload: (u: UploadedFile) => void;

  validation: ValidationIssue[];
  setValidation: (v: ValidationIssue[]) => void;

  billingStart: string;
  billingEnd: string;
  setBilling: (s: string, e: string) => void;

  batchInvoices: InvoiceData[];
  addBatchInvoice: (inv: InvoiceData) => void;

  overrideInvoiceField: (fieldPath: string, newValue: number | string) => void;
  overrideInvoiceChargeLine: (labelOrNormalized: string, newAmount: number) => void;
}

const initialTariff: TariffData = {
  name: "Awaiting tariff upload",
  voltage: "",
  zone: "",
  powerFactor: 0,
  networkCapacity: 0,
  networkDemand: 0,
  generationCapacity: 0,
  transmissionNetwork: 0,
  legacy: 0,
  ancillary: 0,
  electrification: 0,
  affordability: 0,
  energy: {
    high: { peak: 0, standard: 0, offPeak: 0 },
    low: { peak: 0, standard: 0, offPeak: 0 },
  },
};

function invoiceLinesFromItems(invoice: InvoiceData, items: InvoiceLineItemStored[]) {
  const lines: Record<string, number> = {};
  for (const item of items) {
    if (!item.normalizedName) continue;
    lines[item.normalizedName] = (lines[item.normalizedName] || 0) + item.amount;
  }
  const ensure = (label: string, value?: number) => {
    if (value && !lines[label]) lines[label] = value;
  };
  ensure("Administration Charge", invoice.administrationCharge);
  ensure("Transmission Network Charge", invoice.transmissionNetworkCharge);
  ensure("Distribution Network Capacity Charge", invoice.networkCapacityCharge);
  ensure("Generation Capacity Charge", invoice.generationCapacityCharge);
  ensure("Network Demand Charge", invoice.networkDemandCharge);
  ensure("Peak Energy", invoice.peakEnergyCharge);
  ensure("Standard Energy", invoice.standardEnergyCharge);
  ensure("Off-Peak Energy", invoice.offPeakEnergyCharge);
  ensure("Ancillary Service Charge", invoice.ancillary);
  ensure("Legacy Charge", invoice.legacy);
  ensure("Affordability Subsidy", invoice.affordability);
  ensure("Electrification & Rural Subsidy", invoice.electrification);
  ensure("Service Charge", invoice.serviceCharge);
  ensure("Connection Charge", invoice.connectionCharge);
  lines["Total Charges"] = invoice.invoiceTotal;
  return lines;
}

function activateInvoice(invoice: InvoiceData, items: InvoiceLineItemStored[]): Partial<AppState> {
  return {
    invoice,
    invoiceLines: invoiceLinesFromItems(invoice, items),
    invoiceItems: items,
    invoiceTotal: invoice.invoiceTotal,
    customer: {
      name: invoice.customerName,
      meter: invoice.meterNumber,
      accountNumber: invoice.accountNumber,
      address: invoice.address || "",
      nmd: invoice.nmd,
    },
    billingStart: invoice.billingPeriodStart || "",
    billingEnd: invoice.billingPeriodEnd || "",
  };
}

export const useApp = create<AppState>((set) => ({
  rows: [],
  setRows: (rows) => set({ rows }),

  // Clean empty state for production default (real user data populated on upload)
  invoice: null,
  setInvoice: (invoice) =>
    set(
      invoice
        ? {
            invoice,
            invoiceTotal: invoice.invoiceTotal,
            billingStart: invoice.billingPeriodStart || "",
            billingEnd: invoice.billingPeriodEnd || "",
          }
        : { invoice: null, invoiceTotal: 0 },
    ),

  invoiceItems: [],
  setInvoiceItems: (invoiceItems) => set({ invoiceItems }),

  processedInvoiceNumbers: [],
  addProcessedInvoiceNumber: (invoiceNumber) =>
    set((s) =>
      invoiceNumber && !s.processedInvoiceNumbers.includes(invoiceNumber)
        ? { processedInvoiceNumbers: [...s.processedInvoiceNumbers, invoiceNumber] }
        : s,
    ),

  tariff: initialTariff,
  setTariff: (tariff) => set({ tariff }),

  customer: {
    name: "",
    meter: "",
    accountNumber: "",
    address: "",
    nmd: 0,
  },
  setCustomer: (c) => set((s) => ({ customer: { ...s.customer, ...c } })),

  invoiceTotal: 0,
  invoiceLines: {},
  setInvoiceTotal: (invoiceTotal) => set({ invoiceTotal }),
  setInvoiceLines: (invoiceLines) => set({ invoiceLines }),

  uploads: [],
  addUpload: (u) => set((s) => ({ uploads: [...s.uploads, u] })),

  validation: [],
  setValidation: (validation) => set({ validation }),

  billingStart: "",
  billingEnd: "",
  setBilling: (billingStart, billingEnd) => set({ billingStart, billingEnd }),

  batchInvoices: [],
  addBatchInvoice: (inv) => set((s) => ({ batchInvoices: [...s.batchInvoices, inv] })),

  overrideInvoiceField: (fieldPath, newValue) =>
    set((s) => {
      if (!s.invoice) return s;
      const inv = { ...s.invoice };
      const ext = inv.extraction
        ? { ...inv.extraction, fields: { ...inv.extraction.fields } }
        : undefined;
      if (ext && ext.fields[fieldPath]) {
        ext.fields[fieldPath] = {
          ...ext.fields[fieldPath],
          value: newValue,
          needsReview: false,
        };
      }
      return {
        invoice: {
          ...inv,
          extraction: ext,
        },
      };
    }),

  overrideInvoiceChargeLine: (labelOrNormalized, newAmount) =>
    set((s) => {
      const lines = { ...s.invoiceLines, [labelOrNormalized]: newAmount };
      const items = s.invoiceItems.map((item) => {
        if (item.label === labelOrNormalized || item.normalizedName === labelOrNormalized) {
          return { ...item, amount: newAmount, needsReview: false };
        }
        return item;
      });
      const total = Object.values(lines).reduce((a, b) => a + b, 0);
      return {
        invoiceLines: lines,
        invoiceItems: items,
        invoiceTotal: s.invoice?.invoiceTotal ? s.invoice.invoiceTotal : total,
      };
    }),
}));
