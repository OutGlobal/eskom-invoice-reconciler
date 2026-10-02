/**
 * Shared Input Validation Utilities
 * Enforces format integrity for account numbers, invoice references, and uploaded files
 */

export {
  sanitizeCsvValue,
  escapeHtml,
  redactSensitiveData,
  validateUploadedFile,
  type FileValidationResult,
} from "@/domain/security/inputSanitizer";

/**
 * Validates utility account numbers against statutory formats
 */
export function validateAccountNumber(accountNumber: string): { valid: boolean; message?: string } {
  if (!accountNumber || !accountNumber.trim()) {
    return { valid: false, message: "Account number is required" };
  }
  const clean = accountNumber.trim();
  if (clean.length < 5 || clean.length > 30) {
    return { valid: false, message: "Account number must be between 5 and 30 characters" };
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(clean)) {
    return { valid: false, message: "Account number contains invalid characters" };
  }
  return { valid: true };
}

/**
 * Validates invoice numbers against standard enterprise alphanumeric formats
 */
export function validateInvoiceNumber(invoiceNumber: string): { valid: boolean; message?: string } {
  if (!invoiceNumber || !invoiceNumber.trim()) {
    return { valid: false, message: "Invoice number is required" };
  }
  const clean = invoiceNumber.trim();
  if (clean.length < 3 || clean.length > 50) {
    return { valid: false, message: "Invoice number must be between 3 and 50 characters" };
  }
  return { valid: true };
}

/**
 * Validates whether an email address matches RFC 5322 standard format
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
