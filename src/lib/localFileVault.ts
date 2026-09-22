/**
 * Local File Vault
 * Durable browser-side storage (IndexedDB) for original uploaded source documents.
 * Guarantees that every uploaded file remains retrievable/downloadable even when the
 * remote object store is unavailable. No file contents are ever fabricated here.
 */

export interface VaultedFile {
  key: string;
  uploadId?: string;
  storagePath?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storedAt: string;
  bytes: ArrayBuffer;
}

const DB_NAME = "enera_file_vault";
const STORE_NAME = "source_files";
const DB_VERSION = 1;

function isAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("uploadId", "uploadId", { unique: false });
        store.createIndex("storagePath", "storagePath", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const request = fn(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export class LocalFileVault {
  /** Persist an original uploaded file so it can always be downloaded again. */
  public static async store(
    file: File | Blob,
    meta: { uploadId?: string; storagePath?: string; fileName: string; mimeType?: string },
  ): Promise<{ success: boolean; key?: string; error?: string }> {
    if (!isAvailable()) return { success: false, error: "Local vault unavailable" };
    try {
      const bytes = await file.arrayBuffer();
      const key = meta.uploadId || meta.storagePath || `${meta.fileName}:${Date.now()}`;
      const record: VaultedFile = {
        key,
        uploadId: meta.uploadId,
        storagePath: meta.storagePath,
        fileName: meta.fileName,
        mimeType: meta.mimeType || (file as File).type || "application/octet-stream",
        sizeBytes: bytes.byteLength,
        storedAt: new Date().toISOString(),
        bytes,
      };
      await tx("readwrite", (store) => store.put(record));
      if (meta.storagePath && meta.storagePath !== key) {
        await tx("readwrite", (store) => store.put({ ...record, key: meta.storagePath! }));
      }
      return { success: true, key };
    } catch (err: any) {
      return { success: false, error: err?.message || "Vault write failed" };
    }
  }

  public static async get(keyOrId: string): Promise<VaultedFile | null> {
    if (!isAvailable() || !keyOrId) return null;
    try {
      const direct = await tx<VaultedFile | undefined>("readonly", (store) => store.get(keyOrId));
      return direct || null;
    } catch {
      return null;
    }
  }

  public static async list(): Promise<VaultedFile[]> {
    if (!isAvailable()) return [];
    try {
      const all = await tx<VaultedFile[]>("readonly", (store) => store.getAll() as any);
      return Array.isArray(all) ? all : [];
    } catch {
      return [];
    }
  }

  /** Trigger a browser download of a vaulted file. Returns false when not stored locally. */
  public static async download(keyOrId: string, fallbackName?: string): Promise<boolean> {
    const record = await this.get(keyOrId);
    if (!record || typeof document === "undefined") return false;
    const blob = new Blob([record.bytes], { type: record.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = record.fileName || fallbackName || "source-document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  public static async remove(keyOrId: string): Promise<void> {
    if (!isAvailable()) return;
    try {
      await tx("readwrite", (store) => store.delete(keyOrId));
    } catch {
      /* no-op */
    }
  }
}
