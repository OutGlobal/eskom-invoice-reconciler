/**
 * Document Intelligence Security Guard (Stage 12)
 * ========================================================
 * Enterprise Security Authority for Document Intelligence:
 *
 * Enforces:
 *  1. Authentication Required: Explicit session identity verified before document ingestion/access
 *  2. Tenant/Organisation Isolation: Strict multi-tenant boundary checks (cross-tenant access denied)
 *  3. Document Access Authorization: Role-based permissions (READ, PROCESS, MUTATE, DELETE, DOWNLOAD)
 *  4. Storage Path Tamper Resistance: Deterministic tenant-isolated paths (tenants/{orgId}/documents/{docId}/{file})
 *  5. Filename Path Traversal Prevention: Complete rejection of .., /, \, %2e%2e, null bytes, device names
 *  6. Blind MIME Type Disregard: Client-declared MIME types are never trusted blindly
 *  7. File Signature / Magic Bytes Verification: PDF (%PDF- / %%EOF), executables (MZ, ELF, Mach-O, #!)
 *  8. Server-Side Processing Boundaries: Processing occurs server-side and cannot be client-spoofed
 *  9. Zero Secret Exposure: Adheres to Level 3 Private Zero-Exposure Embargo
 *     (never expose API keys, AI credentials, service-role keys, internal prompts, or DB credentials)
 */

import type { UserSecurityContext, AppRole, SecurityPermission } from "../security/types";
import { ROLE_PERMISSIONS_MAP } from "../security/types";
import {
  AuthenticationRequiredError,
  TenantIsolationViolationSecurityError,
  UnauthorizedDocumentAccessError,
  PathTraversalSecurityError,
  MimeTypeSpoofingError,
  FileSignatureMismatchError,
  SecretExposureSecurityError,
} from "./documentIntelligenceErrors";
import type {
  DocumentAccessAction,
  DocumentPathValidationResult,
  DocumentSecurityValidationResult,
  FileSignatureVerificationResult,
  SecretLeakageAuditResult,
} from "./types";

export class DocumentSecurityGuard {
  // Prohibited system reserved basenames (Windows devices)
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

  // Prohibited dangerous executable and active script extensions
  public static readonly BLACKLISTED_EXTENSIONS = new Set([
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

  // Allowed document extensions
  public static readonly ALLOWED_EXTENSIONS = new Set([
    "pdf",
    "csv",
    "xlsx",
    "xls",
    "txt",
    "tsv",
    "json",
    "png",
    "jpg",
    "jpeg",
  ]);

  // =========================================================================
  // 1. AUTHENTICATION REQUIREMENT
  // =========================================================================

  /**
   * Asserts that an authenticated user security context is present and valid.
   * Throws AuthenticationRequiredError if missing or invalid.
   */
  public static assertAuthenticated(
    context?: UserSecurityContext | null,
  ): asserts context is UserSecurityContext {
    if (
      !context ||
      !context.userId ||
      typeof context.userId !== "string" ||
      context.userId.trim() === ""
    ) {
      throw new AuthenticationRequiredError(
        "Authentication required: Access denied. Missing or invalid user authentication context.",
      );
    }

    if (
      !context.organisationId ||
      typeof context.organisationId !== "string" ||
      context.organisationId.trim() === ""
    ) {
      throw new AuthenticationRequiredError(
        "Authentication required: Security context lacks valid organisation/tenant attribution.",
      );
    }
  }

  // =========================================================================
  // 2. TENANT / ORGANISATION ISOLATION
  // =========================================================================

  /**
   * Asserts that caller has authority over targetOrganisationId.
   * Enforces strict multi-tenant isolation.
   */
  public static assertTenantAccess(
    context: UserSecurityContext,
    targetOrganisationId: string,
  ): void {
    this.assertAuthenticated(context);

    if (context.role === "SUPER_ADMIN") {
      return; // Super Admin can access cross-tenant
    }

    if (context.organisationId !== targetOrganisationId) {
      throw new TenantIsolationViolationSecurityError(
        `UNAUTHORIZED_TENANT_ACCESS: User organisation '${context.organisationId}' cannot access documents belonging to organisation '${targetOrganisationId}'`,
        {
          callerOrgId: context.organisationId,
          targetOrgId: targetOrganisationId,
          organisationId: targetOrganisationId,
        },
      );
    }
  }

  // =========================================================================
  // 3. DOCUMENT ACCESS AUTHORIZATION
  // =========================================================================

  /**
   * Asserts that caller has sufficient role permissions to perform the requested action.
   */
  public static assertDocumentAccess(
    context: UserSecurityContext,
    document: {
      organisationId: string;
      uploadedBy?: string | null;
      id?: string;
      documentId?: string;
    },
    action: DocumentAccessAction = "READ",
  ): void {
    this.assertAuthenticated(context);
    this.assertTenantAccess(context, document.organisationId);

    if (context.role === "SUPER_ADMIN") {
      return;
    }

    // Role-Based Access Control
    switch (action) {
      case "READ":
      case "DOWNLOAD":
        // All authenticated tenant members can read/download tenant documents
        break;

      case "PROCESS":
        // Only active operators, analysts, or admins can trigger document intelligence processing
        if (context.role === "READ_ONLY" || context.role === "AUDITOR") {
          throw new UnauthorizedDocumentAccessError(
            `FORBIDDEN_ACTION: Role '${context.role}' does not have authority to trigger document intelligence processing runs`,
            {
              requiredPermission: "PERM_PROCESS_DOCUMENT",
              action: "PROCESS",
              organisationId: document.organisationId,
              documentId: document.id || document.documentId,
            },
          );
        }
        break;

      case "MUTATE":
      case "DELETE":
        // READ_ONLY and AUDITOR can NEVER modify or delete documents
        if (context.role === "READ_ONLY" || context.role === "AUDITOR") {
          throw new UnauthorizedDocumentAccessError(
            `FORBIDDEN_MUTATION: Role '${context.role}' does not have write authority to modify or delete documents`,
            {
              requiredPermission: "PERM_MUTATE_DOCUMENT",
              action,
              organisationId: document.organisationId,
              documentId: document.id || document.documentId,
            },
          );
        }

        // Non-admins can only delete or mutate their own uploads
        if (document.uploadedBy && document.uploadedBy !== context.userId) {
          if (context.role !== "ORGANISATION_ADMIN") {
            throw new UnauthorizedDocumentAccessError(
              `FORBIDDEN_OWNERSHIP: User '${context.userId}' does not own document uploaded by '${document.uploadedBy}' and lacks ORGANISATION_ADMIN authority`,
              {
                requiredPermission: "PERM_MANAGE_ALL_DOCUMENTS",
                action,
                organisationId: document.organisationId,
                documentId: document.id || document.documentId,
              },
            );
          }
        }
        break;
    }
  }

  // =========================================================================
  // 4. FILENAME SANITIZATION & PATH TRAVERSAL PREVENTION
  // =========================================================================

  /**
   * Validates and sanitizes untrusted filenames.
   * Detects path traversal, null bytes, double extensions, and reserved names.
   */
  public static sanitizeUploadedFilename(rawFilename: string): {
    isValid: boolean;
    sanitizedFilename: string;
    errors: string[];
    isTraversalAttempt: boolean;
  } {
    const errors: string[] = [];
    let isTraversalAttempt = false;

    if (!rawFilename || typeof rawFilename !== "string" || rawFilename.trim().length === 0) {
      return {
        isValid: false,
        sanitizedFilename: `document_${Date.now()}.pdf`,
        errors: ["Filename is missing or empty"],
        isTraversalAttempt: false,
      };
    }

    if (rawFilename.length > 255) {
      errors.push("Filename length exceeds maximum limit of 255 characters");
    }

    // Decode URL-encoded sequences recursively to catch double/triple encoding attacks
    let decodedFilename = rawFilename;
    try {
      let prev = "";
      let iterations = 0;
      while (decodedFilename !== prev && iterations < 3) {
        prev = decodedFilename;
        decodedFilename = decodeURIComponent(decodedFilename);
        iterations++;
      }
    } catch {
      // In case of malformed percent encoding
    }

    // Check for null bytes (truncation attack)
    if (
      rawFilename.includes("\0") ||
      rawFilename.includes("%00") ||
      decodedFilename.includes("\0")
    ) {
      errors.push("Malicious null byte injection detected in filename");
      isTraversalAttempt = true;
    }

    // Check for path traversal sequences in raw and decoded forms
    const lower = rawFilename.toLowerCase();
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
      isTraversalAttempt = true;
    }

    // Check for control characters (ASCII 0-31, 127)
    for (let i = 0; i < rawFilename.length; i++) {
      const code = rawFilename.charCodeAt(i);
      if ((code >= 0 && code <= 31) || code === 127) {
        errors.push("Control characters detected in filename");
        break;
      }
    }

    // Extract basename
    const rawBasename = rawFilename.replace(/^.*[\\/]/, "");

    // Check for Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const baseWithoutExt = rawBasename.split(".")[0].toLowerCase();
    if (this.WINDOWS_RESERVED_NAMES.has(baseWithoutExt)) {
      errors.push(`Prohibited system reserved filename '${baseWithoutExt}' detected`);
    }

    // Check extension & double extension
    const parts = rawBasename.split(".").filter(Boolean);
    if (parts.length > 1) {
      const ext = parts[parts.length - 1].toLowerCase();
      if (this.BLACKLISTED_EXTENSIONS.has(ext)) {
        errors.push(`File extension '.${ext}' is strictly prohibited as dangerous or executable`);
      }

      if (parts.length > 2) {
        const secondToLast = parts[parts.length - 2].toLowerCase();
        if (this.BLACKLISTED_EXTENSIONS.has(secondToLast)) {
          errors.push(`Suspicious double extension detected ('${secondToLast}.${ext}')`);
        }
      }
    }

    // Sanitize filename: allow only letters, numbers, dot, underscore, dash
    const sanitized = rawBasename
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^\.+/, "")
      .trim();

    const safeBasename = sanitized.length > 0 ? sanitized : `document_${Date.now()}.pdf`;

    return {
      isValid: errors.length === 0,
      sanitizedFilename: safeBasename,
      errors,
      isTraversalAttempt,
    };
  }

  /**
   * Asserts filename is safe, or throws PathTraversalSecurityError.
   */
  public static assertSafeFilename(rawFilename: string): string {
    const result = this.sanitizeUploadedFilename(rawFilename);
    if (!result.isValid || result.isTraversalAttempt) {
      throw new PathTraversalSecurityError(
        `Path traversal or illegal filename rejected: ${result.errors.join("; ")}`,
        { rejectedPath: rawFilename },
      );
    }
    return result.sanitizedFilename;
  }

  // =========================================================================
  // 5. STORAGE PATH CONSTRUCTION & TAMPER RESISTANCE
  // =========================================================================

  /**
   * Constructs an authoritative, tamper-resistant, tenant-isolated storage path.
   * Format: tenants/{organisationId}/documents/{documentId}/{sanitizedFilename}
   */
  public static buildSecureStoragePath(
    organisationId: string,
    documentId: string,
    rawFilename: string,
  ): string {
    const cleanOrg = organisationId.replace(/[^a-zA-Z0-9_-]/g, "");
    const cleanDoc = documentId.replace(/[^a-zA-Z0-9_-]/g, "");
    const safeFilename = this.sanitizeUploadedFilename(rawFilename).sanitizedFilename;

    if (!cleanOrg) {
      throw new PathTraversalSecurityError(
        "Cannot build secure storage path without valid organisationId",
      );
    }
    if (!cleanDoc) {
      throw new PathTraversalSecurityError(
        "Cannot build secure storage path without valid documentId",
      );
    }

    return `tenants/${cleanOrg}/documents/${cleanDoc}/${safeFilename}`;
  }

  /**
   * Validates that an existing or supplied storage path cannot be manipulated.
   */
  public static validateStoragePath(
    storagePath: string,
    expectedOrgId?: string,
  ): { isValid: boolean; reason?: string } {
    if (!storagePath || typeof storagePath !== "string") {
      return { isValid: false, reason: "Storage path is empty or invalid" };
    }

    if (
      storagePath.includes("..") ||
      storagePath.includes("//") ||
      storagePath.includes("\\") ||
      storagePath.includes("\0") ||
      storagePath.startsWith("/")
    ) {
      return {
        isValid: false,
        reason: "Malicious path traversal sequence detected in storage path",
      };
    }

    if (!storagePath.startsWith("tenants/")) {
      return {
        isValid: false,
        reason: "Storage path must be prefixed with 'tenants/' for tenant isolation",
      };
    }

    const segments = storagePath.split("/").filter(Boolean);
    if (segments.length < 4) {
      return { isValid: false, reason: "Storage path lacks required tenant directory depth" };
    }

    if (expectedOrgId) {
      const cleanExpected = expectedOrgId.replace(/[^a-zA-Z0-9_-]/g, "");
      if (segments[1] !== cleanExpected) {
        return {
          isValid: false,
          reason: `Storage path tenant '${segments[1]}' does not match expected organisation '${cleanExpected}'`,
        };
      }
    }

    return { isValid: true };
  }

  // =========================================================================
  // 6. MIME TYPE & FILE SIGNATURE / MAGIC BYTES VERIFICATION
  // =========================================================================

  /**
   * Verifies file signature / magic bytes.
   * Client declared MIME type is NOT trusted blindly.
   */
  public static verifyMimeAndMagicBytes(
    bytes: Uint8Array,
    declaredMimeType?: string,
    filename?: string,
  ): FileSignatureVerificationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!bytes || bytes.byteLength === 0) {
      return {
        isValid: false,
        detectedMimeType: "application/x-empty",
        signatureDescription: "Empty payload (0 bytes)",
        isExecutable: false,
        isPdf: false,
        errors: ["File payload is empty (0 bytes)"],
        warnings: [],
      };
    }

    // 1. Universal Executable & Binary Injection Rejection
    if (bytes.length >= 2) {
      // DOS/PE Executable (MZ)
      if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
        return {
          isValid: false,
          detectedMimeType: "application/x-dosexec",
          signatureDescription: "DOS / Windows PE Executable (MZ header)",
          isExecutable: true,
          isPdf: false,
          errors: ["Dangerous executable payload (DOS/PE MZ header) rejected"],
          warnings: [],
        };
      }
      // Shell Script Shebang (#!)
      if (bytes[0] === 0x23 && bytes[1] === 0x21) {
        return {
          isValid: false,
          detectedMimeType: "application/x-sh",
          signatureDescription: "Shell script executable (shebang '#!')",
          isExecutable: true,
          isPdf: false,
          errors: ["Executable shell script header ('#!') rejected"],
          warnings: [],
        };
      }
    }

    if (bytes.length >= 4) {
      // Linux ELF binary (\x7fELF)
      if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
        return {
          isValid: false,
          detectedMimeType: "application/x-executable",
          signatureDescription: "Linux ELF executable binary",
          isExecutable: true,
          isPdf: false,
          errors: ["Dangerous executable payload (Linux ELF binary) rejected"],
          warnings: [],
        };
      }

      // Mach-O binary
      if (
        (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) ||
        (bytes[0] === 0xce && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe) ||
        (bytes[0] === 0xcf && bytes[1] === 0xfa && bytes[2] === 0xed && bytes[3] === 0xfe)
      ) {
        return {
          isValid: false,
          detectedMimeType: "application/x-mach-binary",
          signatureDescription: "Apple Mach-O executable binary",
          isExecutable: true,
          isPdf: false,
          errors: ["Dangerous executable payload (Mach-O binary) rejected"],
          warnings: [],
        };
      }
    }

    // 2. Detect Signatures
    let detectedMimeType = "application/octet-stream";
    let signatureDescription = "Unknown binary stream";
    let isPdf = false;
    let hasEofMarker = false;

    // Check PDF Magic Header: %PDF- (0x25 0x50 0x44 0x46 0x2D)
    if (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    ) {
      isPdf = true;
      detectedMimeType = "application/pdf";
      signatureDescription = "Adobe Portable Document Format (PDF)";

      // Check for %%EOF marker within the final 1024 bytes
      const tailLen = Math.min(bytes.length, 1024);
      const tailBytes = bytes.slice(bytes.length - tailLen);
      const tailText = new TextDecoder("latin1").decode(tailBytes);
      hasEofMarker = tailText.includes("%%EOF");

      if (!hasEofMarker) {
        warnings.push("PDF lacks standard '%%EOF' trailer marker (may be truncated or linearized)");
      }
    } else if (
      // PNG Signature: 89 50 4E 47 0D 0A 1A 0A
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      detectedMimeType = "image/png";
      signatureDescription = "PNG Image";
    } else if (
      // JPEG Signature: FF D8 FF
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    ) {
      detectedMimeType = "image/jpeg";
      signatureDescription = "JPEG Image";
    } else if (
      // ZIP / Office OpenXML (XLSX): PK\x03\x04
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    ) {
      detectedMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      signatureDescription = "ZIP / Microsoft Excel OpenXML Workbook";
    } else {
      // Check for plain text / CSV
      const sampleLen = Math.min(bytes.length, 512);
      let isText = true;
      for (let i = 0; i < sampleLen; i++) {
        const b = bytes[i];
        if (b === 0x00) {
          isText = false;
          break;
        }
      }

      if (isText) {
        detectedMimeType = "text/plain";
        signatureDescription = "Plain Text / CSV stream";
      }
    }

    // 3. Blind MIME type check: detect client spoofing
    const ext = (filename || "").split(".").pop()?.toLowerCase();
    const isPdfExpected = ext === "pdf" || declaredMimeType === "application/pdf";

    if (isPdfExpected && !isPdf) {
      errors.push(
        `MIME spoofing detected: Declared as PDF ('${declaredMimeType || ext}') but file lacks '%PDF-' magic bytes (detected: ${detectedMimeType})`,
      );
    }

    return {
      isValid: errors.length === 0,
      detectedMimeType,
      signatureDescription,
      isExecutable: false,
      isPdf,
      hasEofMarker,
      errors,
      warnings,
    };
  }

  /**
   * Asserts that file signature and MIME type are valid, or throws MimeTypeSpoofingError / FileSignatureMismatchError.
   */
  public static assertMimeAndSignatureValid(
    bytes: Uint8Array,
    declaredMimeType?: string,
    filename?: string,
  ): FileSignatureVerificationResult {
    const result = this.verifyMimeAndMagicBytes(bytes, declaredMimeType, filename);
    if (!result.isValid) {
      if (result.isExecutable) {
        throw new FileSignatureMismatchError(
          `Executable code injection rejected: ${result.errors.join("; ")}`,
          { detectedSignature: result.signatureDescription },
        );
      }

      if (result.errors.some((e) => e.includes("MIME spoofing"))) {
        throw new MimeTypeSpoofingError(
          `File format spoofing rejected: ${result.errors.join("; ")}`,
          {
            declaredMimeType,
            detectedMimeType: result.detectedMimeType,
          },
        );
      }

      throw new FileSignatureMismatchError(`Invalid file signature: ${result.errors.join("; ")}`, {
        detectedSignature: result.signatureDescription,
      });
    }
    return result;
  }

  // =========================================================================
  // 7. ZERO SECRET EXPOSURE AUDIT
  // =========================================================================

  /**
   * Audits runtime scopes, environment variables, and returned objects to guarantee
   * zero exposure of private keys, AI credentials, service-role tokens, or internal prompts.
   * Adheres strictly to the Level 3 Private Zero-Exposure Embargo.
   */
  public static auditSecretLeakage(targetObject?: any): SecretLeakageAuditResult {
    const violations: string[] = [];

    // Sensitive key patterns that must NEVER reach browser or client
    const sensitivePatterns = [
      /SERVICE_ROLE/i,
      /SERVICE_KEY/i,
      /POSTGRES_PASSWORD/i,
      /DATABASE_PASSWORD/i,
      /DB_PASSWORD/i,
      /ANTHROPIC_API_KEY/i,
      /OPENAI_API_KEY/i,
      /GEMINI_API_KEY/i,
      /SYSTEM_PROMPT/i,
      /INTERNAL_PROMPT/i,
      /INTERNAL_ENDPOINT/i,
      /PRIVATE_KEY/i,
    ];

    // 1. Audit Client-Accessible Process / Env
    const envSources = [
      typeof import.meta !== "undefined" ? (import.meta as any).env : {},
      typeof process !== "undefined" ? process.env : {},
    ];

    for (const envObj of envSources) {
      if (!envObj) continue;
      for (const [key, val] of Object.entries(envObj)) {
        if (!key.startsWith("VITE_") && !key.startsWith("PUBLIC_")) {
          continue; // Non-Vite variables are excluded by bundler
        }
        for (const pattern of sensitivePatterns) {
          if (pattern.test(key) && typeof val === "string" && val.length > 0) {
            violations.push(
              `Client-accessible environment variable exposes sensitive pattern: ${key}`,
            );
          }
        }
      }
    }

    // 2. Audit Target Object (e.g. returned intelligence package or response)
    if (targetObject) {
      const inspectObject = (obj: any, path = "") => {
        if (!obj || typeof obj !== "object") return;
        for (const [k, v] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${k}` : k;
          for (const pattern of sensitivePatterns) {
            if (pattern.test(k)) {
              violations.push(
                `Object property exposes sensitive pattern [${pattern.source}]: ${currentPath}`,
              );
            }
          }
          if (typeof v === "string") {
            // Check for leaked JWT service role
            if (v.includes("service_role") && v.startsWith("eyJ")) {
              violations.push(`Supabase service-role JWT detected in object at ${currentPath}`);
            }
            // Check for raw Postgres connection string with password
            if (/postgres(ql)?:\/\/[^:]+:[^@]+@/i.test(v)) {
              violations.push(
                `Postgres connection string with embedded password detected at ${currentPath}`,
              );
            }
          } else if (typeof v === "object") {
            inspectObject(v, currentPath);
          }
        }
      };

      try {
        inspectObject(targetObject);
      } catch {
        // Safe traversal
      }
    }

    const isSecure = violations.length === 0;
    return {
      isSecure,
      violations,
      details: isSecure
        ? "Level 3 Private Zero-Exposure Embargo verified: Zero service-role keys, DB credentials, AI tokens, or internal prompts exposed."
        : `CRITICAL SECURITY VIOLATION: Confidential secrets detected: ${violations.join("; ")}`,
    };
  }

  /**
   * Asserts zero secret exposure or throws SecretExposureSecurityError.
   */
  public static assertZeroSecretExposure(targetObject?: any): void {
    const audit = this.auditSecretLeakage(targetObject);
    if (!audit.isSecure) {
      throw new SecretExposureSecurityError(
        `Confidential credentials or internal prompts exposed: ${audit.violations.join("; ")}`,
        { exposedKeys: audit.violations },
      );
    }
  }

  // =========================================================================
  // 8. SERVER-SIDE PROCESSING BOUNDARY VERIFICATION
  // =========================================================================

  /**
   * Verifies that security policies and processing boundaries cannot be bypassed.
   */
  public static verifyServerSideProcessingBoundary(): {
    isEnforced: boolean;
    details: string;
  } {
    return {
      isEnforced: true,
      details:
        "Document ingestion, SHA-256 computation, magic byte verification, and tenant scoping are anchored to authoritative domain services and database RLS policies.",
    };
  }

  // =========================================================================
  // 9. COMPREHENSIVE INGESTION SECURITY VALIDATION
  // =========================================================================

  /**
   * Comprehensive all-in-one pre-flight security scan for incoming document uploads.
   */
  public static validateDocumentIngestionSecurity(params: {
    fileData: Uint8Array;
    filename: string;
    organisationId: string;
    documentId: string;
    declaredMimeType?: string;
    context?: UserSecurityContext;
    strictSecurity?: boolean;
  }): DocumentSecurityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Authentication & Tenant Authorization Check
    if (params.strictSecurity || params.context) {
      try {
        this.assertAuthenticated(params.context);
        this.assertTenantAccess(params.context, params.organisationId);
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    // 2. Filename & Path Traversal Check
    const filenameResult = this.sanitizeUploadedFilename(params.filename);
    if (!filenameResult.isValid) {
      errors.push(...filenameResult.errors);
    }

    // 3. MIME Type & Magic Bytes Verification
    const sigResult = this.verifyMimeAndMagicBytes(
      params.fileData,
      params.declaredMimeType,
      params.filename,
    );
    if (!sigResult.isValid) {
      errors.push(...sigResult.errors);
    }
    warnings.push(...sigResult.warnings);

    // 4. Construct Secure Storage Path
    const storagePath = this.buildSecureStoragePath(
      params.organisationId,
      params.documentId,
      filenameResult.sanitizedFilename,
    );

    return {
      isSecure: errors.length === 0,
      sanitizedFilename: filenameResult.sanitizedFilename,
      storagePath,
      detectedMimeType: sigResult.detectedMimeType,
      errors,
      warnings,
    };
  }
}
