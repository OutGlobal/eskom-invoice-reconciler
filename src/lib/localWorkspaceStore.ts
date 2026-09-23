import type { Measurement } from "./parseMeter";
import type { InvoiceData } from "./store";
import type { UploadRecord } from "@/domain/upload/types";

export interface SavedCustomerAccount {
  accountNumber: string;
  customerName: string;
  meterNumber: string;
  address: string;
  nmd: number;
  updatedAt: string;
}

interface SavedDataset {
  key: "active";
  invoice: InvoiceData | null;
  rows: Measurement[];
  updatedAt: string;
}

const DB_NAME = "enera_workspace";
const DB_VERSION = 2;
const UPLOADS = "uploads";
const CUSTOMERS = "customers";
const DATASETS = "datasets";
const TARIFFS = "tariffs";

function available() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(UPLOADS)) db.createObjectStore(UPLOADS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CUSTOMERS)) db.createObjectStore(CUSTOMERS, { keyPath: "accountNumber" });
      if (!db.objectStoreNames.contains(DATASETS)) db.createObjectStore(DATASETS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(TARIFFS)) db.createObjectStore(TARIFFS, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


async function request<T>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const result = operation(transaction.objectStore(storeName));
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error);
    transaction.oncomplete = () => db.close();
  });
}

export class LocalWorkspaceStore {
  static async saveUpload(record: UploadRecord): Promise<void> {
    if (!available()) return;
    await request(UPLOADS, "readwrite", (store) => store.put(record));
  }

  static async listUploads(): Promise<UploadRecord[]> {
    if (!available()) return [];
    try {
      const records = await request<UploadRecord[]>(UPLOADS, "readonly", (store) => store.getAll());
      return records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    } catch {
      return [];
    }
  }

  static async saveCustomer(customer: SavedCustomerAccount): Promise<void> {
    if (!available() || !customer.accountNumber) return;
    await request(CUSTOMERS, "readwrite", (store) => store.put(customer));
  }

  static async listCustomers(): Promise<SavedCustomerAccount[]> {
    if (!available()) return [];
    try {
      return await request<SavedCustomerAccount[]>(CUSTOMERS, "readonly", (store) => store.getAll());
    } catch {
      return [];
    }
  }

  static async findCustomerByMeter(meterNumber: string): Promise<SavedCustomerAccount | null> {
    if (!meterNumber) return null;
    const normalized = meterNumber.trim().toLowerCase();
    const customers = await this.listCustomers();
    return customers.find((customer) => customer.meterNumber.trim().toLowerCase() === normalized) || null;
  }

  static async saveDataset(invoice: InvoiceData | null, rows: Measurement[]): Promise<void> {
    if (!available()) return;
    const dataset: SavedDataset = { key: "active", invoice, rows, updatedAt: new Date().toISOString() };
    await request(DATASETS, "readwrite", (store) => store.put(dataset));
  }

  static async loadDataset(): Promise<SavedDataset | null> {
    if (!available()) return null;
    try {
      const dataset = await request<SavedDataset | undefined>(DATASETS, "readonly", (store) => store.get("active"));
      if (!dataset) return null;
      return {
        ...dataset,
        rows: dataset.rows.map((row) => ({ ...row, ts: new Date(row.ts) })),
      };
    } catch {
      return null;
    }
  }

  /** Persists an uploaded tariff schedule so it survives a page reload. */
  static async saveTariff(key: string, payload: unknown): Promise<void> {
    if (!available() || !key) return;
    try {
      await request(TARIFFS, "readwrite", (store) => store.put({ key, payload }));
    } catch {
      // Non-blocking: reconciliation still uses the in-memory registry this session
    }
  }

  static async listTariffs(): Promise<unknown[]> {
    if (!available()) return [];
    try {
      const records = await request<{ key: string; payload: unknown }[]>(TARIFFS, "readonly", (store) => store.getAll());
      return records.map((record) => record.payload);
    } catch {
      return [];
    }
  }
}
