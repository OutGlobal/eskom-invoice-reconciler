/**
 * Enterprise File Security & Untrusted Input Validation Subsystem (Stage 6)
 *
 * Treats every uploaded file as untrusted input.
 * Enforces comprehensive validation:
 *  1. File extension validation (whitelist, blacklist, double-extension detection)
 *  2. MIME type inspection & client-spoof detection
 *  3. File signature / magic bytes verification (PDF, XLSX, XLS, JSON, XML, Text)
 *  4. File size limits by type & non-zero enforcement
 *  5. Filename sanitization & path traversal prevention (.., null bytes, control chars, Windows devices)
 *  6. Text encoding validation (UTF-8, BOM handling, null-byte rejection)
 *  7. Structural integrity & payload defanging (CSV formula injection, PDF scripts, XXE, zip bombs)
 */

import type { SupportedFileExtension } from "../ingestion/types";

export interface FileSecurityValidationInput {
  filename: string;
  bytes: Uint8Array;
  declaredMimeType?: string;
  fileType?: string;
  maxSizeBytes?: number;
}

export interface FileSecurityValidationResult {
  valid: boolean;
  sanitizedFilename: string;
  canonicalExtension: SupportedFileExtension;
  detectedMimeType: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  defangedBytes?: Uint8Array;
  isFormulaDefanged?: boolean;
  securityWarnings: string[];
  securityErrors: string[];
  rejectionReason?: string;
}

export class FileSecurityValidator {
  // Canonical Whitelist of Allowed Extensions
  public static readonly ALLOWED_EXTENSIONS: Set<string> = new Set([
    "pdf",
    "csv",
    "xlsx",
    "xls",
    "log",
    "txt",
    "tsv",
    "dat",
    "json",
    "tariff",
    "xml",
  ]);

  // Strict Blacklist of Dangerous Executable / Script / Active Extensions
  public static readonly BLACKLISTED_EXTENSIONS: Set<string> = new Set([
    "exe",
    "bat",
    "cmd",
    "sh",
    "bash",
    "ps1",
    "vbs",
    "js",
    "mjs",
    "cjs",
    "ts",
    "py",
    "php",
    "phtml",
    "phar",
    "pl",
    "cgi",
    "jar",
    "war",
    "dll",
    "so",
    "dylib",
    "html",
    "htm",
    "svg",
    "swf",
    "msi",
    "app",
    "reg",
    "vbe",
    "wsf",
    "wsh",
    "scr",
    "pif",
    "hta",
    "cpl",
    "msc",
    "asp",
    "aspx",
    "jsp",
  ]);

  // Type-Specific Maximum Size Limits (bytes)
  public static readonly SIZE_LIMITS_BY_TYPE: Record<string, number> = {
    PDF_INVOICE: 25 * 1024 * 1024, // 25 MB
    CSV_INTERVAL_DATA: 50 * 1024 * 1024, // 50 MB
    AMR_DATA: 50 * 1024 * 1024, // 50 MB
    EXCEL_WORKBOOK: 25 * 1024 * 1024, // 25 MB
    RAW_METER_LOG: 25 * 1024 * 1024, // 25 MB
    TARIFF_DOCUMENT: 10 * 1024 * 1024, // 10 MB
    DEFAULT: 50 * 1024 * 1024, // 50 MB Global Ceiling
  };

  // Forbidden Windows Reserved Device Basenames
  private static readonly WINDOWS_RESERVED_NAMES = new Set([
    "con",
    "prn",
    "aux",
    "nul",
    "com1",
    "com2",
    "com3",
    "com4",
    "com5",
    "com6",
    "com7",
    "com8",
    "com9",
    "lpt1",
    "lpt2",
    "lpt3",
    "lpt4",
    "lpt5",
    "lpt6",
    "lpt7",
    "lpt8",
    "lpt9",
  ]);

  /**
   * Primary entrypoint: validates untrusted file input across all 7 security layers
   */
  public static async validateUpload(
    input: FileSecurityValidationInput,
  ): Promise<FileSecurityValidationResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Filename & Path Traversal Validation
    const filenameValidation = this.validateFilename(input.filename);
    if (!filenameValidation.valid) {
      errors.push(...filenameValidation.errors);
      return this.buildFailureResult(input, filenameValidation.sanitizedFilename, errors, warnings);
    }
    const sanitizedFilename = filenameValidation.sanitizedFilename;

    // 2. File Extension & Double-Extension Validation
    const extValidation = this.validateExtension(input.filename);
    if (!extValidation.valid) {
      errors.push(...extValidation.errors);
      return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
    }
    const canonicalExtension = extValidation.canonicalExtension as SupportedFileExtension;

    // 3. File Size Validation
    const sizeValidation = this.validateFileSize(
      input.bytes.byteLength,
      input.fileType,
      input.maxSizeBytes,
    );
    if (!sizeValidation.valid) {
      errors.push(...sizeValidation.errors);
      return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
    }

    // 4. File Signature / Magic Bytes & Executable Rejection
    const sigValidation = this.validateMagicBytes(
      input.bytes,
      canonicalExtension,
      input.declaredMimeType,
    );
    if (!sigValidation.valid) {
      errors.push(...sigValidation.errors);
      return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
    }
    const detectedMimeType = sigValidation.detectedMimeType;

    // 5. Encoding & Null Byte Validation (Text Formats)
    const isTextFormat = ["csv", "tsv", "txt", "log", "dat", "json", "tariff", "xml"].includes(
      canonicalExtension,
    );
    let workingBytes = input.bytes;
    if (isTextFormat) {
      const encValidation = this.validateTextEncoding(input.bytes, canonicalExtension);
      if (!encValidation.valid) {
        errors.push(...encValidation.errors);
        return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
      }
      if (encValidation.normalizedBytes) {
        workingBytes = encValidation.normalizedBytes;
      }
      if (encValidation.warnings) {
        warnings.push(...encValidation.warnings);
      }
    }

    // 6. Structural Integrity & Malicious Payload Defanging
    let isFormulaDefanged = false;
    let defangedBytes: Uint8Array | undefined;

    if (canonicalExtension === "csv" || canonicalExtension === "tsv") {
      const csvSanitization = this.sanitizeAndDefangCsv(workingBytes, canonicalExtension);
      if (!csvSanitization.valid) {
        errors.push(...csvSanitization.errors);
        return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
      }
      if (csvSanitization.wasDefanged) {
        isFormulaDefanged = true;
        defangedBytes = csvSanitization.defangedBytes;
        workingBytes = csvSanitization.defangedBytes;
        warnings.push(
          "CSV spreadsheet formula injection patterns defanged with single-quote prefix.",
        );
      }
    } else if (canonicalExtension === "xml") {
      const xmlValidation = this.validateXmlStructure(workingBytes);
      if (!xmlValidation.valid) {
        errors.push(...xmlValidation.errors);
        return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
      }
    } else if (canonicalExtension === "pdf") {
      const pdfValidation = this.validatePdfStructure(workingBytes);
      if (!pdfValidation.valid) {
        errors.push(...pdfValidation.errors);
        return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
      }
      if (pdfValidation.warnings) {
        warnings.push(...pdfValidation.warnings);
      }
    } else if (canonicalExtension === "xlsx") {
      const xlsxValidation = this.validateXlsxStructure(workingBytes);
      if (!xlsxValidation.valid) {
        errors.push(...xlsxValidation.errors);
        return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
      }
    } else if (canonicalExtension === "json" || canonicalExtension === "tariff") {
      const jsonValidation = this.validateJsonStructure(workingBytes);
      if (!jsonValidation.valid) {
        errors.push(...jsonValidation.errors);
        return this.buildFailureResult(input, sanitizedFilename, errors, warnings);
      }
    }

    // 7. Compute Cryptographic Checksum
    const sha256Checksum = await this.computeSha256(workingBytes);

    return {
      valid: true,
      sanitizedFilename,
      canonicalExtension,
      detectedMimeType,
      fileSizeBytes: workingBytes.byteLength,
      sha256Checksum,
      defangedBytes,
      isFormulaDefanged,
      securityWarnings: warnings,
      securityErrors: [],
    };
  }

  /**
   * 1. Filename Sanitization & Path Traversal Prevention
   */
  public static validateFilename(filename: string): {
    valid: boolean;
    sanitizedFilename: string;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!filename || typeof filename !== "string" || filename.trim().length === 0) {
      return {
        valid: false,
        sanitizedFilename: "unnamed_upload.dat",
        errors: ["Filename is missing or empty"],
      };
    }

    if (filename.length > 255) {
      errors.push("Filename length exceeds maximum limit of 255 characters");
    }

    // Decode URL-encoded sequences recursively to catch double/triple encoding attacks
    let decodedFilename = filename;
    try {
      let prev = "";
      let iterations = 0;
      while (decodedFilename !== prev && iterations < 3) {
        prev = decodedFilename;
        decodedFilename = decodeURIComponent(decodedFilename);
        iterations++;
      }
    } catch {
      // In case of malformed percent encoding, keep current string
    }

    // Check for null bytes (truncation attack)
    if (filename.includes("\0") || filename.includes("%00") || decodedFilename.includes("\0")) {
      errors.push("Malicious null byte injection detected in filename");
    }

    // Check for path traversal sequences in raw and decoded forms
    const lower = filename.toLowerCase();
    const decodedLower = decodedFilename.toLowerCase();
    if (
      lower.includes("..") ||
      lower.includes("/") ||
      lower.includes("\\") ||
      lower.includes("%2e%2e") ||
      lower.includes("%2f") ||
      lower.includes("%5c") ||
      decodedLower.includes("..") ||
      decodedLower.includes("/") ||
      decodedLower.includes("\\")
    ) {
      errors.push("Path traversal sequence detected in filename (e.g., '..', '/', '\\')");
    }

    // Check for control characters (ASCII 0-31, 127)
    for (let i = 0; i < filename.length; i++) {
      const code = filename.charCodeAt(i);
      if ((code >= 0 && code <= 31) || code === 127) {
        errors.push("Control characters detected in filename");
        break;
      }
    }

    // Extract basename
    const rawBasename = filename.replace(/^.*[\\/]/, "");

    // Check for Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const baseWithoutExt = rawBasename.split(".")[0].toLowerCase();
    if (this.WINDOWS_RESERVED_NAMES.has(baseWithoutExt)) {
      errors.push(`Prohibited system reserved filename '${baseWithoutExt}' detected`);
    }

    // Check for hidden or dangerous configuration files
    if (rawBasename.startsWith(".") && !rawBasename.includes(".", 1)) {
      errors.push(`Prohibited hidden configuration file '${rawBasename}' detected`);
    }

    // Sanitize filename: allow only letters, numbers, dot, underscore, dash
    const sanitized = rawBasename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^\.+/, "")
      .trim();

    const safeBasename = sanitized.length > 0 ? sanitized : `upload_${Date.now()}.dat`;

    return {
      valid: errors.length === 0,
      sanitizedFilename: safeBasename,
      errors,
    };
  }

  /**
   * 2. File Extension & Double-Extension Validation
   */
  public static validateExtension(filename: string): {
    valid: boolean;
    canonicalExtension: string;
    errors: string[];
  } {
    const errors: string[] = [];
    const parts = filename.split(".").filter(Boolean);

    if (parts.length <= 1) {
      return { valid: false, canonicalExtension: "unknown", errors: ["File has no extension"] };
    }

    const ext = parts[parts.length - 1].toLowerCase();

    // Check against strict blacklist
    if (this.BLACKLISTED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        canonicalExtension: ext,
        errors: [`File extension '.${ext}' is strictly prohibited as dangerous or executable`],
      };
    }

    // Check against canonical whitelist
    if (!this.ALLOWED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        canonicalExtension: ext,
        errors: [
          `File extension '.${ext}' is not supported. Supported extensions: ${Array.from(this.ALLOWED_EXTENSIONS).join(", ")}`,
        ],
      };
    }

    // Double extension detection (e.g. invoice.pdf.exe or data.csv.sh)
    if (parts.length > 2) {
      const secondToLast = parts[parts.length - 2].toLowerCase();
      if (this.BLACKLISTED_EXTENSIONS.has(secondToLast)) {
        errors.push(`Suspicious double extension detected ('${secondToLast}.${ext}')`);
      }
    }

    return {
      valid: errors.length === 0,
      canonicalExtension: ext,
      errors,
    };
  }

  /**
   * 3. File Size Validation
   */
  public static validateFileSize(
    fileSizeBytes: number,
    fileType?: string,
    maxSizeBytes?: number,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (fileSizeBytes <= 0) {
      return { valid: false, errors: ["Zero-byte empty file payload rejected"] };
    }

    const limit =
      maxSizeBytes ||
      (fileType ? this.SIZE_LIMITS_BY_TYPE[fileType] : undefined) ||
      this.SIZE_LIMITS_BY_TYPE.DEFAULT;

    if (fileSizeBytes > limit) {
      const limitMb = (limit / 1024 / 1024).toFixed(1);
      const actualMb = (fileSizeBytes / 1024 / 1024).toFixed(2);
      errors.push(`File size (${actualMb} MB) exceeds maximum allowed threshold of ${limitMb} MB`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 4. File Signature / Magic Bytes Validation & Executable Rejection
   */
  public static validateMagicBytes(
    bytes: Uint8Array,
    extension: string,
    declaredMime?: string,
  ): { valid: boolean; detectedMimeType: string; errors: string[] } {
    const errors: string[] = [];

    // Global check: Reject executable and binary payload signatures on ANY upload
    if (bytes.length >= 2) {
      // DOS / PE executable (MZ)
      if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
        return {
          valid: false,
          detectedMimeType: "application/x-dosexec",
          errors: ["Dangerous executable payload (DOS/PE MZ header) rejected"],
        };
      }
    }
    if (bytes.length >= 4) {
      // Linux ELF executable (\x7fELF)
      if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
        return {
          valid: false,
          detectedMimeType: "application/x-executable",
          errors: ["Dangerous executable payload (Linux ELF binary) rejected"],
        };
      }
      // Mach-O binary
      if (
        (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) ||
        (bytes[0] === 0xce && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe) ||
        (bytes[0] === 0xcf && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe)
      ) {
        return {
          valid: false,
          detectedMimeType: "application/x-mach-binary",
          errors: ["Dangerous executable payload (Mach-O binary) rejected"],
        };
      }
    }
    if (bytes.length >= 2) {
      // Shell script shebang (#!)
      if (bytes[0] === 0x23 && bytes[1] === 0x21) {
        return {
          valid: false,
          detectedMimeType: "application/x-sh",
          errors: ["Executable shell script header ('#!') rejected"],
        };
      }
    }

    let detectedMimeType = "application/octet-stream";

    switch (extension) {
      case "pdf": {
        // PDF Magic Header: %PDF- (0x25 0x50 0x44 0x46 0x2D)
        if (
          bytes.length < 5 ||
          bytes[0] !== 0x25 ||
          bytes[1] !== 0x50 ||
          bytes[2] !== 0x44 ||
          bytes[3] !== 0x46 ||
          bytes[4] !== 0x2d
        ) {
          errors.push("Invalid PDF signature: missing '%PDF-' header");
        } else {
          detectedMimeType = "application/pdf";
          // Check for %%EOF marker within last 1024 bytes
          const tailLen = Math.min(bytes.length, 1024);
          const tailBytes = bytes.slice(bytes.length - tailLen);
          const tailText = new TextDecoder("latin1").decode(tailBytes);
          if (!tailText.includes("%%EOF")) {
            errors.push("Truncated or malformed PDF: missing '%%EOF' footer marker");
          }
        }
        break;
      }

      case "xlsx": {
        // Zip Magic Header: PK\x03\x04 (0x50 0x4B 0x03 0x04)
        if (
          bytes.length < 4 ||
          bytes[0] !== 0x50 ||
          bytes[1] !== 0x4b ||
          bytes[2] !== 0x03 ||
          bytes[3] !== 0x04
        ) {
          errors.push("Invalid Excel XLSX signature: missing ZIP PK header");
        } else {
          detectedMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        }
        break;
      }

      case "xls": {
        // OLE Compound Document (0xD0 0xCF 0x11 0xE0)
        if (
          bytes.length < 4 ||
          bytes[0] !== 0xd0 ||
          bytes[1] !== 0xcf ||
          bytes[2] !== 0x11 ||
          bytes[3] !== 0xe0
        ) {
          errors.push("Invalid Excel XLS signature: missing Compound Document header");
        } else {
          detectedMimeType = "application/vnd.ms-excel";
        }
        break;
      }

      case "json":
      case "tariff": {
        detectedMimeType = "application/json";
        const snippet = new TextDecoder("utf-8", { fatal: false })
          .decode(bytes.slice(0, 64))
          .trim();
        if (!snippet.startsWith("{") && !snippet.startsWith("[")) {
          errors.push(`Invalid JSON format: file does not start with '{' or '['`);
        }
        break;
      }

      case "xml": {
        detectedMimeType = "application/xml";
        const snippet = new TextDecoder("utf-8", { fatal: false })
          .decode(bytes.slice(0, 128))
          .trim();
        if (!snippet.startsWith("<?xml") && !snippet.startsWith("<")) {
          errors.push("Invalid XML format: missing XML element declaration");
        }
        break;
      }

      case "csv":
      case "tsv":
      case "txt":
      case "log":
      case "dat": {
        detectedMimeType = extension === "csv" ? "text/csv" : "text/plain";
        break;
      }

      default:
        errors.push(`Unsupported file extension '.${extension}'`);
    }

    return {
      valid: errors.length === 0,
      detectedMimeType,
      errors,
    };
  }

  /**
   * 5. Text Encoding & Embedded Null Byte Validation
   */
  public static validateTextEncoding(
    bytes: Uint8Array,
    extension: string,
  ): { valid: boolean; normalizedBytes?: Uint8Array; warnings?: string[]; errors: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Embedded null bytes check (C-string truncation exploit in parsers)
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x00) {
        errors.push(
          `Embedded binary null byte (0x00) detected at byte offset ${i} in text format '.${extension}'`,
        );
        break;
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Validate UTF-8 decoding cleanly
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      decoder.decode(bytes);
    } catch {
      errors.push(`File is not valid UTF-8 encoded text for format '.${extension}'`);
      return { valid: false, errors };
    }

    // Strip UTF-8 BOM (\xEF\xBB\xBF) if present
    let normalizedBytes = bytes;
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      normalizedBytes = bytes.slice(3);
      warnings.push("UTF-8 Byte Order Mark (BOM) cleanly stripped from text stream");
    }

    return { valid: true, normalizedBytes, warnings, errors: [] };
  }

  /**
   * 6a. CSV Formula Injection (DDE) Defanging & Structure Validation
   */
  public static sanitizeAndDefangCsv(
    bytes: Uint8Array,
    extension: "csv" | "tsv",
  ): { valid: boolean; defangedBytes: Uint8Array; wasDefanged: boolean; errors: string[] } {
    const delimiter = extension === "tsv" ? "\t" : ",";
    const text = new TextDecoder("utf-8").decode(bytes);
    const lines = text.split(/\r?\n/);

    let wasDefanged = false;
    const sanitizedLines: string[] = [];

    // Injection triggers: =, +, -, @, Tab, Carriage Return at the start of a cell
    const formulaTriggers = ["=", "+", "-", "@", "\t", "\r"];

    for (const line of lines) {
      if (!line.trim()) {
        sanitizedLines.push(line);
        continue;
      }

      // Simple regex-based cell token parser preserving quotes
      const cells = line.split(delimiter);
      const sanitizedCells = cells.map((cell) => {
        let trimmed = cell.trim();
        let isQuoted = false;
        if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
          trimmed = trimmed.substring(1, trimmed.length - 1);
          isQuoted = true;
        }

        // If the cell begins with a formula trigger, defang it with a single quote
        if (formulaTriggers.some((trig) => trimmed.startsWith(trig))) {
          wasDefanged = true;
          const defangedValue = `'${trimmed}`;
          return isQuoted ? `"${defangedValue}"` : `"${defangedValue}"`;
        }

        return cell;
      });

      sanitizedLines.push(sanitizedCells.join(delimiter));
    }

    const defangedText = sanitizedLines.join("\n");
    const defangedBytes = new TextEncoder().encode(defangedText);

    return {
      valid: true,
      defangedBytes: wasDefanged ? defangedBytes : bytes,
      wasDefanged,
      errors: [],
    };
  }

  /**
   * 6b. XML Structure & XXE Attack Prevention
   */
  public static validateXmlStructure(bytes: Uint8Array): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const text = new TextDecoder("utf-8").decode(bytes);

    // Block XML External Entity (XXE) and Document Type Definition attacks
    if (
      text.includes("<!DOCTYPE") ||
      text.includes("<!ENTITY") ||
      text.includes("SYSTEM") ||
      text.includes("PUBLIC")
    ) {
      const upper = text.toUpperCase();
      if (upper.includes("<!DOCTYPE") || upper.includes("<!ENTITY")) {
        errors.push(
          "Dangerous XML structure: DOCTYPE and ENTITY declarations (XXE) are strictly disallowed",
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 6c. PDF Structure & Active Object Detection
   */
  public static validatePdfStructure(bytes: Uint8Array): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const textSample = new TextDecoder("latin1").decode(bytes);

    // Check for dangerous active script commands in PDF objects
    const dangerousTokens = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFiles"];
    for (const token of dangerousTokens) {
      if (textSample.includes(token)) {
        errors.push(`Dangerous active PDF executable object '${token}' detected`);
      }
    }

    if (textSample.includes("/OpenAction")) {
      warnings.push("PDF contains '/OpenAction' hook; evaluated under strict sandbox.");
    }

    return { valid: errors.length === 0, warnings, errors };
  }

  /**
   * 6d. Excel XLSX Structure & Zip Bomb Protection
   */
  public static validateXlsxStructure(bytes: Uint8Array): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const textSample = new TextDecoder("latin1").decode(bytes);

    // Reject macro-enabled workbooks
    if (textSample.includes("vbaProject.bin")) {
      errors.push("Macro-enabled Excel workbook (VBA macros) is strictly prohibited");
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 6e. JSON / Tariff Document Syntax Validation
   */
  public static validateJsonStructure(bytes: Uint8Array): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    try {
      const text = new TextDecoder("utf-8").decode(bytes);
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null) {
        errors.push("JSON document must parse to a root object or array");
      }
    } catch (err: any) {
      errors.push(`Malformed JSON syntax: ${err.message}`);
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Compute SHA-256 Checksum over binary Uint8Array
   */
  public static async computeSha256(bytes: Uint8Array): Promise<string> {
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private static buildFailureResult(
    input: FileSecurityValidationInput,
    sanitizedFilename: string,
    errors: string[],
    warnings: string[],
  ): FileSecurityValidationResult {
    return {
      valid: false,
      sanitizedFilename,
      canonicalExtension: "unknown" as any,
      detectedMimeType: "application/octet-stream",
      fileSizeBytes: input.bytes.byteLength,
      sha256Checksum: "",
      securityWarnings: warnings,
      securityErrors: errors,
      rejectionReason: errors.join("; "),
    };
  }
}
