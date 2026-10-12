/**
 * Shared File Handling Utilities
 * File extensions, client-side download helpers, and safe file utilities
 */

import { FileSecurityValidator } from "@/domain/security/fileSecurityValidator";

/**
 * Extracts lowercase file extension without the leading dot
 * e.g. "invoice.PDF" -> "pdf"
 */
export function getFileExtension(filename: string): string {
  if (!filename || !filename.includes(".")) return "";
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Checks if a filename has an allowed extension supported by the platform
 */
export function isAllowedFileExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return FileSecurityValidator.ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Triggers a browser download of an in-memory Blob or file buffer
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
