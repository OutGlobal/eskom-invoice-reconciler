/**
 * Shared Error Handling Utilities
 * Sanitizes technical exceptions, generates correlation references, and formats user-facing errors
 */

import { UserFacingErrorSanitizer } from "@/domain/observability/userFacingErrorSanitizer";
import type { ObservabilityCategory } from "@/domain/observability/types";

export { UserFacingErrorSanitizer };

/**
 * Extracts a friendly, sanitized error message from any caught error or unknown value.
 * Never leaks database column names, SQLSTATE codes, or internal stack traces.
 */
export function getSanitizedErrorMessage(
  error: unknown,
  defaultFallback: string = "An unexpected error occurred",
  category: ObservabilityCategory = "PROCESSING_FAILURE",
): string {
  if (!error) return defaultFallback;

  const rawMsg = UserFacingErrorSanitizer.extractRawMessage(error);
  if (UserFacingErrorSanitizer.containsTechnicalDetails(rawMsg)) {
    const sanitized = UserFacingErrorSanitizer.sanitize(category, error);
    return sanitized.message;
  }

  return rawMsg || defaultFallback;
}

/**
 * Generates an alphanumeric support reference code for error logging and customer tracking
 * e.g. "ERR-7X9B2K"
 */
export function generateErrorReference(): string {
  return UserFacingErrorSanitizer.generateReferenceCode();
}
