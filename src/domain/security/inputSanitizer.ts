/**
 * Input & File Sanitization Engine
 * Eskom Bill Balancer Platform
 */

const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx", "pdf", "txt"]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function sanitizeCsvValue(val: string): string {
  if (typeof val !== "string") return val;
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];

  if (dangerousPrefixes.some((p) => val.startsWith(p) || val.trimStart().startsWith(p))) {
    return `'${val}`;
  }
  return val;
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface FileValidationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export function validateUploadedFile(
  fileName: string,
  mimeType: string,
  fileSizeBytes: number,
): FileValidationResult {
  if (fileSizeBytes <= 0) {
    return {
      valid: false,
      errorCode: "EMPTY_FILE",
      errorMessage: "Uploaded file is empty (0 bytes).",
    };
  }

  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      errorCode: "FILE_TOO_LARGE",
      errorMessage: `File size (${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds maximum limit of 50 MB.`,
    };
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Executable script extension blocking check (highest priority security check)
  const dangerousExtensions = [
    "exe",
    "bat",
    "cmd",
    "sh",
    "js",
    "ts",
    "py",
    "php",
    "pl",
    "vbs",
    "jar",
  ];
  if (dangerousExtensions.includes(ext)) {
    return {
      valid: false,
      errorCode: "EXECUTABLE_FILE_BLOCKED",
      errorMessage: `SECURITY ALERT: Upload of executable or script files (.${ext}) is strictly prohibited.`,
    };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      errorCode: "INVALID_FILE_EXTENSION",
      errorMessage: `Unsupported file extension '.${ext}'. Allowed extensions: .csv, .xlsx, .pdf, .txt.`,
    };
  }

  if (
    mimeType &&
    !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase()) &&
    mimeType !== "application/octet-stream"
  ) {
    return {
      valid: false,
      errorCode: "INVALID_MIME_TYPE",
      errorMessage: `Unsupported MIME type '${mimeType}'.`,
    };
  }

  return { valid: true };
}

export function redactSensitiveData(logMessage: string): string {
  if (!logMessage) return "";
  return logMessage
    .replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_+/=]*/g, "[REDACTED_JWT]")
    .replace(
      /(password|secret|apiKey|service_role_key)\s*[:=]\s*["']?[^"'\s,]+["']?/gi,
      "$1=[REDACTED]",
    );
}
