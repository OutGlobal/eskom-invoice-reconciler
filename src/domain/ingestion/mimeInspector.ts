/**
 * MIME Type & File Content Binary Inspector
 * Inspects magic header bytes to verify authentic file format and prevent spoofed extensions
 */

import type { SupportedFileExtension } from "./types";
import { FileSecurityValidator } from "../security/fileSecurityValidator";

export interface MimeInspectionResult {
  isValid: boolean;
  detectedMimeType: string;
  fileExtension: SupportedFileExtension | "unknown";
  isScannedPdf?: boolean;
  errorMessage?: string;
  sanitizedFilename?: string;
  isFormulaDefanged?: boolean;
}

export class MimeInspector {
  public static MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB Limit

  /**
   * Inspect binary header magic bytes of input file payload
   */
  public static async inspectFile(
    file:
      File | Uint8Array | { size?: number; byteLength?: number; slice?: any; arrayBuffer?: any },
    filename: string,
  ): Promise<MimeInspectionResult> {
    const fileSize =
      typeof (file as any)?.size === "number"
        ? (file as any).size
        : typeof (file as any)?.byteLength === "number"
          ? (file as any).byteLength
          : 0;

    if (fileSize > this.MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        detectedMimeType: "unknown",
        fileExtension: "unknown",
        errorMessage: `File size exceeds maximum limit of 50MB (${(fileSize / (1024 * 1024)).toFixed(1)}MB uploaded)`,
      };
    }

    let bytes: Uint8Array;

    if (file instanceof Uint8Array) {
      bytes = file;
    } else if (typeof (file as any).arrayBuffer === "function") {
      bytes = new Uint8Array(await (file as any).arrayBuffer());
    } else if (typeof (file as any).slice === "function") {
      bytes = new Uint8Array(await (file as any).slice(0, 512).arrayBuffer());
    } else {
      bytes = new Uint8Array(0);
    }

    // Run zero-trust FileSecurityValidator pre-flight checks
    const secResult = await FileSecurityValidator.validateUpload({
      filename,
      bytes,
    });

    if (!secResult.valid) {
      return {
        isValid: false,
        detectedMimeType: secResult.detectedMimeType,
        fileExtension: "unknown",
        errorMessage: secResult.rejectionReason,
        sanitizedFilename: secResult.sanitizedFilename,
      };
    }

    const isScanned =
      secResult.canonicalExtension === "pdf" ? this.detectIfScannedPdf(bytes) : false;

    return {
      isValid: true,
      detectedMimeType: secResult.detectedMimeType,
      fileExtension: secResult.canonicalExtension,
      isScannedPdf: isScanned,
      sanitizedFilename: secResult.sanitizedFilename,
      isFormulaDefanged: secResult.isFormulaDefanged,
    };
  }

  /**
   * Check if PDF lacks text stream markers (scanned document)
   */
  public static detectIfScannedPdf(bytes: Uint8Array): boolean {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096));
    const hasImage = text.includes("/Image") || text.includes("/XObject");
    const hasFont = text.includes("/Font");
    return hasImage && !hasFont;
  }
}
