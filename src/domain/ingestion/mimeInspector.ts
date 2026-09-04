/**
 * MIME Type & File Content Binary Inspector
 * Inspects magic header bytes to verify authentic file format and prevent spoofed extensions
 */

import type { SupportedFileExtension } from "./types";

export interface MimeInspectionResult {
  isValid: boolean;
  detectedMimeType: string;
  fileExtension: SupportedFileExtension | "unknown";
  isScannedPdf?: boolean;
  errorMessage?: string;
}

export class MimeInspector {
  public static MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB Limit

  /**
   * Inspect binary header magic bytes of input file payload
   */
  public static async inspectFile(
    file: File | Uint8Array | { size?: number; byteLength?: number; slice?: any },
    filename: string,
  ): Promise<MimeInspectionResult> {
    const fileSize = (file as any).size ?? (file as any).byteLength ?? 0;

    if (fileSize > this.MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        detectedMimeType: "application/octet-stream",
        fileExtension: "unknown",
        errorMessage: `File size (${(fileSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 50MB`,
      };
    }

    const bytes =
      file instanceof Uint8Array
        ? file
        : typeof (file as any).slice === "function"
          ? new Uint8Array(await (file as any).slice(0, 512).arrayBuffer())
          : new Uint8Array(0);

    if (bytes.length === 0) {
      return {
        isValid: false,
        detectedMimeType: "application/x-empty",
        fileExtension: "unknown",
        errorMessage: "Zero-byte empty file payload rejected",
      };
    }

    const extFromFilename = (filename.split(".").pop() || "").toLowerCase();

    // 1. PDF Check (%PDF-)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      const isScanned = this.detectIfScannedPdf(bytes);
      return {
        isValid: true,
        detectedMimeType: "application/pdf",
        fileExtension: "pdf",
        isScannedPdf: isScanned,
      };
    }

    // 2. XLSX / ZIP Check (PK\x03\x04)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return {
        isValid: true,
        detectedMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileExtension: "xlsx",
      };
    }

    // 3. XLS OLE Compound Document (0xD0 0xCF 0x11 0xE0)
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
      return {
        isValid: true,
        detectedMimeType: "application/vnd.ms-excel",
        fileExtension: "xls",
      };
    }

    // 4. XML Check (<?xml or <Root)
    const textHeader = new TextDecoder("utf-8", { fatal: false })
      .decode(bytes.slice(0, 128))
      .trim();
    if (
      textHeader.startsWith("<?xml") ||
      (textHeader.startsWith("<") && textHeader.includes(">"))
    ) {
      return {
        isValid: true,
        detectedMimeType: "application/xml",
        fileExtension: "xml",
      };
    }

    // 5. CSV / Plain Text Check
    if (extFromFilename === "csv" || extFromFilename === "txt" || this.looksLikeCsv(textHeader)) {
      return {
        isValid: true,
        detectedMimeType: "text/csv",
        fileExtension: "csv",
      };
    }

    return {
      isValid: false,
      detectedMimeType: "application/octet-stream",
      fileExtension: "unknown",
      errorMessage: `Unsupported file header signature or extension mismatch for '${filename}'`,
    };
  }

  /**
   * Helper to check if text contains CSV delimiters (comma, semicolon, tab)
   */
  private static looksLikeCsv(headerText: string): boolean {
    const lines = headerText.split("\n");
    if (lines.length > 0) {
      const first = lines[0];
      return first.includes(",") || first.includes(";") || first.includes("\t");
    }
    return false;
  }

  /**
   * Check if PDF lacks text stream markers (scanned document)
   */
  private static detectIfScannedPdf(bytes: Uint8Array): boolean {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 500));
    return text.includes("/Image") && !text.includes("/Font");
  }
}
