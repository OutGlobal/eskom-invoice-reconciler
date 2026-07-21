import { create } from "zustand";
import type { Measurement } from "./parseMeter";
import { TARIFF as DEFAULT_TARIFF } from "./tariff";

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
  nmd: number;
  billingPeriod: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  peakKWh: number;
  standardKWh: number;
  offPeakKWh: number;
  totalKWh: number;
  maxDemandKVA: number;
  transmissionNetworkCharge: number;
  networkCapacityCharge: number;
  generationCapacityCharge: number;
  networkDemandCharge: number;
  ancillary: number;
  legacy: number;
  affordability: number;
  electrification: number;
  reactive: number;
  peakEnergyCharge: number;
  standardEnergyCharge: number;
  offPeakEnergyCharge: number;
  vat: number;
  invoiceTotal: number;
  totalInclVat: number;
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
    notifiedMaximumDemand: number;
    utilisedCapacity: number;
    simultaneousMaximumDemand: number;
    loadFactor: number;
  };
  consumption: {
    peakKwh: number;
    standardKwh: number;
    offPeakKwh: number;
    totalKwh: number;
    peakDemand: number;
    standardDemand: number;
    offPeakDemand: number;
    peakReactive: number;
    standardReactive: number;
    offPeakReactive: number;
  };
  charges: {
    administration: number;
    transmissionNetwork: number;
    distributionNetwork: number;
    generationCapacity: number;
    networkDemand: number;
    peakEnergy: number;
    standardEnergy: number;
    offPeakEnergy: number;
    ancillaryService: number;
    legacy: number;
    affordabilitySubsidy: number;
    electrificationSubsidy: number;
    serviceCharge: number;
    connectionCharge: number;
    vat: number;
    totalInvoice: number;
    totalInclVat: number;
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
}

const initialTariff: TariffData = { ...DEFAULT_TARIFF } as TariffData;

export const useApp = create<AppState>((set) => ({
  rows: [],
  setRows: (rows) => set({ rows }),

  invoice: null,
  setInvoice: (invoice) => set({ invoice }),

  invoiceItems: [],
  setInvoiceItems: (invoiceItems) => set({ invoiceItems }),

  processedInvoiceNumbers: [],
  addProcessedInvoiceNumber: (invoiceNumber) => set((s) => (
    invoiceNumber && !s.processedInvoiceNumbers.includes(invoiceNumber)
      ? { processedInvoiceNumbers: [...s.processedInvoiceNumbers, invoiceNumber] }
      : s
  )),

  tariff: initialTariff,
  setTariff: (tariff) => set({ tariff }),

  customer: {
    name: "Millennium",
    meter: "33kV Sub Incomer",
    accountNumber: "—",
    address: "—",
    nmd: 90000,
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
}));
