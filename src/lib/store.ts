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

interface AppState {
  rows: Measurement[];
  setRows: (r: Measurement[]) => void;

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
