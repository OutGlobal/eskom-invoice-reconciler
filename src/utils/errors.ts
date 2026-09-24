/**
 * Shared Error Handling Utilities
 * Sanitizes technical exceptions, generates correlation references, and formats user-facing errors
 */

import { UserFacingErrorSanitizer } from "@/domain/observability/userFacingErrorSanitizer";

export { UserFacingErrorSanitizer };

/**
 * Extracts a friendly, sanitized error message from any caught error or unknown value.
 * Never leaks database column names, SQLSTATE codes, or internal stack traces.
 */
export function getSanitizedErrorMessage(error: unknown, defaultFallback: string = "An unexpected error occurred"): string {
  if (!error) return defaultFallback;

  if (typeof error === "string") {
    if (UserFacingErrorSanitizer.containsTechnicalDetails(error)) {
      return UserFacingErrorSanitizer.sanitizeMessage(error).userMessage;
    }
    return error;
  }

  if (error instanceof Error) {
    if (UserFacingErrorSanitizer.containsTechnicalDetails(error.message)) {
      return UserFacingErrorSanitizer.sanitize(error).userMessage;
    }
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = String((error as any).message);
    if (UserFacingErrorSanitizer.containsTechnicalDetails(msg)) {
      return UserFacingErrorSanitizer.sanitizeMessage(msg).userMessage;
    }
    return msg;
  }

  return defaultFallback;
}

/**
 * Generates an alphanumeric support reference code for error logging and customer tracking
 * e.g. "ERR-7X9B2K"
 */
export function generateErrorReference(): string {
  return UserFacingErrorSanitizer.generateReferenceCode();
}
