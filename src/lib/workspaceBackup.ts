import { supabase } from "./supabase";
import { identityFromVerifiedUser } from "@/domain/security/verifiedIdentity";
import { LocalWorkspaceStore } from "./localWorkspaceStore";
import { LocalFileVault, type VaultedFile } from "./localFileVault";

const BUCKET = "workspace-backups";
const LIMIT = 25 * 1024 * 1024;
export interface WorkspaceBackup {
  version: 1;
  organisationId: string;
  userId: string;
  createdAt: string;
  workspace: Awaited<ReturnType<typeof LocalWorkspaceStore.exportSnapshot>>;
  files: Array<Omit<VaultedFile, "bytes"> & { base64: string }>;
}

export function validateBackup(
  value: unknown,
  userId: string,
  organisationId: string,
): asserts value is WorkspaceBackup {
  const backup = value as WorkspaceBackup;
  if (
    !backup ||
    backup.version !== 1 ||
    backup.userId !== userId ||
    backup.organisationId !== organisationId ||
    !backup.workspace ||
    !Array.isArray(backup.workspace.uploads) ||
    !Array.isArray(backup.workspace.customers) ||
    !Array.isArray(backup.workspace.tariffs) ||
    !Array.isArray(backup.files)
  )
    throw new Error("Invalid backup or account mismatch");
  if (
    backup.workspace.uploads.some(
      (record) =>
        !record || typeof record.id !== "string" || record.organisationId !== organisationId,
    ) ||
    backup.workspace.customers.some(
      (record) => !record || typeof record.accountNumber !== "string",
    ) ||
    backup.workspace.tariffs.some((record) => !record || typeof record.key !== "string")
  )
    throw new Error("Invalid workspace records");
  for (const file of backup.files) {
    if (
      !file ||
      typeof file.key !== "string" ||
      typeof file.fileName !== "string" ||
      typeof file.base64 !== "string" ||
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes < 0
    )
      throw new Error("Invalid source document");
  }
  const dataset = backup.workspace.dataset;
  if (
    dataset &&
    (dataset.key !== "active" ||
      !Array.isArray(dataset.rows) ||
      dataset.rows.some((row) => !row || !Number.isFinite(Date.parse(String(row.ts)))))
  ) {
    throw new Error("Invalid interval dataset");
  }
}

function encode(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes);
  let text = "";
  for (let i = 0; i < data.length; i += 8192)
    text += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(text);
}
function decode(file: WorkspaceBackup["files"][number]): VaultedFile {
  const raw = atob(file.base64);
  if (raw.length !== file.sizeBytes) throw new Error("Source document size mismatch");
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0)).buffer;
  const { base64: _base64, ...metadata } = file;
  return { ...metadata, bytes };
}
async function identity() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in again");
  return identityFromVerifiedUser(data.user);
}

export async function backupWorkspace(): Promise<string> {
  const owner = await identity();
  const workspace = await LocalWorkspaceStore.exportSnapshot();
  const files = await LocalFileVault.exportFiles();
  if (
    workspace.uploads.length === 0 &&
    workspace.customers.length === 0 &&
    !workspace.dataset &&
    workspace.tariffs.length === 0 &&
    files.length === 0
  )
    throw new Error("Workspace is empty; no backup created");
  if (files.reduce((sum, file) => sum + file.sizeBytes, 0) > LIMIT * 0.7)
    throw new Error("Workspace is too large for snapshot backup (25 MB limit)");
  const backup: WorkspaceBackup = {
    version: 1,
    organisationId: owner.organisationId,
    userId: owner.userId,
    createdAt: new Date().toISOString(),
    workspace,
    files: files.map(({ bytes, ...file }) => ({ ...file, base64: encode(bytes) })),
  };
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  if (blob.size > LIMIT)
    throw new Error("Workspace is too large for snapshot backup (25 MB limit)");
  const current = await identity();
  if (current.userId !== owner.userId || current.organisationId !== owner.organisationId)
    throw new Error("Account changed during backup");
  const path = `${owner.organisationId}/${owner.userId}/${crypto.randomUUID()}.json`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: false, contentType: "application/json" });
  if (error) throw new Error("Remote backup failed. Check storage configuration and permissions.");
  return backup.createdAt;
}

export async function restoreWorkspace(): Promise<string> {
  const owner = await identity();
  const prefix = `${owner.organisationId}/${owner.userId}`;
  const { data: entries, error: listError } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (listError) throw new Error("Cannot list remote backups");
  if (!entries?.length) throw new Error("No remote backup exists for this account");
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${prefix}/${entries[0].name}`);
  if (error || !data) throw new Error("Cannot download remote backup");
  if (data.size > LIMIT) throw new Error("Remote backup exceeds size limit");
  const backup: unknown = JSON.parse(await data.text());
  validateBackup(backup, owner.userId, owner.organisationId);
  // Decode and validate every file before making any local changes.
  const files = backup.files.map(decode);
  const current = await identity();
  if (current.userId !== owner.userId || current.organisationId !== owner.organisationId)
    throw new Error("Account changed during restore");
  const previous = await LocalWorkspaceStore.exportSnapshot();
  await LocalWorkspaceStore.importSnapshot(backup.workspace);
  try {
    await LocalFileVault.importFiles(files);
  } catch (error) {
    try {
      await LocalWorkspaceStore.importSnapshot(previous);
    } catch {
      throw new Error(
        "Restore interrupted. Retry restoring the remote snapshot before using this workspace.",
      );
    }
    throw error;
  }
  return backup.createdAt;
}
