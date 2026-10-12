import { scopedDatabaseName } from "./workspaceIdentity";
import type { Measurement } from "./parseMeter";
import type { InvoiceData } from "./store";
import type { UploadRecord } from "@/domain/upload/types";
import type { PageRegistryRecord } from "@/domain/intelligence/types";

export interface SavedCustomerAccount {
  accountNumber: string;
  customerName: string;
  meterNumber: string;
  address: string;
  nmd: number;
  updatedAt: string;
}

export interface SavedDataset {
  key: "active";
  invoice: InvoiceData | null;
  rows: Measurement[];
  updatedAt: string;
}

const DB_NAME = "enera_workspace";
const DB_VERSION = 3;
const UPLOADS = "uploads";
const CUSTOMERS = "customers";
const DATASETS = "datasets";
const TARIFFS = "tariffs";
const PAGES = "document_pages";

const memoryFallback = new Map<string, Map<string, any>>();
function getMemoryStore(storeName: string): Map<string, any> {
  if (!memoryFallback.has(storeName)) {
    memoryFallback.set(storeName, new Map());
  }
  return memoryFallback.get(storeName)!;
}

function available() {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(scopedDatabaseName(DB_NAME), DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(UPLOADS)) db.createObjectStore(UPLOADS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CUSTOMERS))
        db.createObjectStore(CUSTOMERS, { keyPath: "accountNumber" });
      if (!db.objectStoreNames.contains(DATASETS))
        db.createObjectStore(DATASETS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(TARIFFS)) db.createObjectStore(TARIFFS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(PAGES)) {
        const pageStore = db.createObjectStore(PAGES, { keyPath: "id" });
        pageStore.createIndex("documentId", "documentId", { unique: false });
        pageStore.createIndex("documentId_pageNumber", ["documentId", "pageNumber"], {
          unique: true,
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function request<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const result = operation(transaction.objectStore(storeName));
    let value: T;
    result.onsuccess = () => {
      value = result.result;
    };
    result.onerror = () => reject(result.error);
    transaction.oncomplete = () => {
      db.close();
      resolve(value);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("Cache transaction aborted"));
    };
  });
}

export class LocalWorkspaceStore {
  /** Clear in-memory fallback stores (useful for test isolation) */
  static clearMemoryStore(): void {
    memoryFallback.clear();
  }

  static async exportSnapshot() {
    if (!available()) throw new Error("Browser storage unavailable");
    return {
      uploads: await request<UploadRecord[]>(UPLOADS, "readonly", (store) => store.getAll()),
      customers: await request<SavedCustomerAccount[]>(CUSTOMERS, "readonly", (store) =>
        store.getAll(),
      ),
      dataset:
        (await request<SavedDataset | undefined>(DATASETS, "readonly", (store) =>
          store.get("active"),
        )) || null,
      tariffs: await request<Array<{ key: string; payload: unknown }>>(
        TARIFFS,
        "readonly",
        (store) => store.getAll(),
      ),
    };
  }

  static async importSnapshot(
    snapshot: Awaited<ReturnType<typeof LocalWorkspaceStore.exportSnapshot>>,
  ): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([UPLOADS, CUSTOMERS, DATASETS, TARIFFS], "readwrite");
      for (const name of [UPLOADS, CUSTOMERS, DATASETS, TARIFFS]) tx.objectStore(name).clear();
      snapshot.uploads.forEach((record) => tx.objectStore(UPLOADS).put(record));
      snapshot.customers.forEach((record) => tx.objectStore(CUSTOMERS).put(record));
      snapshot.tariffs.forEach((record) => tx.objectStore(TARIFFS).put(record));
      if (snapshot.dataset)
        tx.objectStore(DATASETS).put({
          ...snapshot.dataset,
          rows: snapshot.dataset.rows.map((row) => ({ ...row, ts: new Date(row.ts) })),
        });
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("Restore failed"));
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  static async saveUpload(record: UploadRecord): Promise<void> {
    if (!available()) {
      getMemoryStore(UPLOADS).set(record.id, record);
      return;
    }
    await request(UPLOADS, "readwrite", (store) => store.put(record));
  }

  static async listUploads(): Promise<UploadRecord[]> {
    if (!available()) {
      const records = Array.from(getMemoryStore(UPLOADS).values());
      return records.sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
    }
    try {
      const records = await request<UploadRecord[]>(UPLOADS, "readonly", (store) => store.getAll());
      return records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    } catch {
      return [];
    }
  }

  static async saveCustomer(customer: SavedCustomerAccount): Promise<void> {
    if (!customer.accountNumber) return;
    if (!available()) {
      getMemoryStore(CUSTOMERS).set(customer.accountNumber, customer);
      return;
    }
    await request(CUSTOMERS, "readwrite", (store) => store.put(customer));
  }

  static async listCustomers(): Promise<SavedCustomerAccount[]> {
    if (!available()) {
      return Array.from(getMemoryStore(CUSTOMERS).values());
    }
    try {
      return await request<SavedCustomerAccount[]>(CUSTOMERS, "readonly", (store) =>
        store.getAll(),
      );
    } catch {
      return [];
    }
  }

  static async findCustomerByMeter(meterNumber: string): Promise<SavedCustomerAccount | null> {
    if (!meterNumber) return null;
    const normalized = meterNumber.trim().toLowerCase();
    const customers = await this.listCustomers();
    return (
      customers.find((customer) => customer.meterNumber.trim().toLowerCase() === normalized) || null
    );
  }

  static async saveDataset(invoice: InvoiceData | null, rows: Measurement[]): Promise<void> {
    const dataset: SavedDataset = {
      key: "active",
      invoice,
      rows,
      updatedAt: new Date().toISOString(),
    };
    if (!available()) {
      getMemoryStore(DATASETS).set("active", dataset);
      return;
    }
    await request(DATASETS, "readwrite", (store) => store.put(dataset));
  }

  static async loadDataset(): Promise<SavedDataset | null> {
    if (!available()) {
      const dataset = getMemoryStore(DATASETS).get("active");
      if (!dataset) return null;
      return {
        ...dataset,
        rows: dataset.rows.map((row: any) => ({ ...row, ts: new Date(row.ts) })),
      };
    }
    try {
      const dataset = await request<SavedDataset | undefined>(DATASETS, "readonly", (store) =>
        store.get("active"),
      );
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
    if (!key) return;
    if (!available()) {
      getMemoryStore(TARIFFS).set(key, { key, payload });
      return;
    }
    try {
      await request(TARIFFS, "readwrite", (store) => store.put({ key, payload }));
    } catch {
      // Non-blocking: reconciliation still uses the in-memory registry this session
    }
  }

  static async listTariffs(): Promise<unknown[]> {
    if (!available()) {
      return Array.from(getMemoryStore(TARIFFS).values()).map((r: any) => r.payload);
    }
    try {
      const records = await request<{ key: string; payload: unknown }[]>(
        TARIFFS,
        "readonly",
        (store) => store.getAll(),
      );
      return records.map((record) => record.payload);
    } catch {
      return [];
    }
  }

  /**
   * Stage 4: Persistent Page Registry local storage methods
   */
  static async savePageRecord(record: PageRegistryRecord): Promise<void> {
    if (!record.documentId) return;
    const cleanRecord = {
      ...record,
      id: record.id || `${record.documentId}_p${record.pageNumber}`,
    };
    if (!available()) {
      getMemoryStore(PAGES).set(cleanRecord.id, cleanRecord);
      return;
    }
    await request(PAGES, "readwrite", (store) => store.put(cleanRecord));
  }

  static async getPageRecord(
    documentId: string,
    pageNumber: number,
  ): Promise<PageRegistryRecord | null> {
    if (!documentId) return null;
    if (!available()) {
      const all = Array.from(getMemoryStore(PAGES).values());
      return all.find((p) => p.documentId === documentId && p.pageNumber === pageNumber) || null;
    }
    try {
      const all = await request<PageRegistryRecord[]>(PAGES, "readonly", (store) => store.getAll());
      return all.find((p) => p.documentId === documentId && p.pageNumber === pageNumber) || null;
    } catch {
      return null;
    }
  }

  static async listPageRecordsForDocument(documentId: string): Promise<PageRegistryRecord[]> {
    if (!documentId) return [];
    if (!available()) {
      const all = Array.from(getMemoryStore(PAGES).values());
      return all
        .filter((p) => p.documentId === documentId)
        .sort((a, b) => a.pageNumber - b.pageNumber);
    }
    try {
      const all = await request<PageRegistryRecord[]>(PAGES, "readonly", (store) => store.getAll());
      return all
        .filter((p) => p.documentId === documentId)
        .sort((a, b) => a.pageNumber - b.pageNumber);
    } catch {
      return [];
    }
  }

  /**
   * Generic key-value local storage support
   */
  static async set(key: string, val: any): Promise<void> {
    getMemoryStore("key_value").set(key, val);
  }

  static async get<T>(key: string): Promise<T | null> {
    return (getMemoryStore("key_value").get(key) as T) ?? null;
  }
}
