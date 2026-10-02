/**
 * STAGE 32 — USER-FACING ERROR SANITIZER
 *
 * Implements strict Level 3 Public Disclosure Model compliance:
 * - Translates raw technical stack traces, database constraint errors,
 *   and unhandled exceptions into friendly, non-technical business messages.
 * - Redacts internal schema identifiers (e.g. public.*, tables, columns),
 *   SQLSTATE codes, file system paths, Node/V8 stack traces, and secrets.
 * - Generates unique reference codes (e.g. ERR-OBS-XXXX) so users can quote
 *   them to support without exposing internal architecture.
 */

import type { ObservabilityCategory, UserFacingMessage } from "./types";

export class UserFacingErrorSanitizer {
  private static readonly TECHNICAL_PATTERNS = [
    /relation\s+["']?public\.[a-z0-9_]+["']?/gi,
    /column\s+["']?[a-z0-9_]+["']?\s+of\s+relation/gi,
    /syntax\s+error\s+at\s+or\s+near/gi,
    /violates\s+foreign\s+key\s+constraint/gi,
    /violates\s+not-null\s+constraint/gi,
    /violates\s+check\s+constraint/gi,
    /SQLSTATE\s+[0-9A-Z]{5}/gi,
    /PostgREST/gi,
    /at\s+[a-zA-Z0-9_$.]+\s+\([^)]+:[0-9]+:[0-9]+\)/g, // Stack trace lines
    /at\s+\/[^\s]+/g, // File path stacks
    /node_modules/gi,
    /TypeError:\s+[^\n]+/gi,
    /ReferenceError:\s+[^\n]+/gi,
    /RangeError:\s+[^\n]+/gi,
    /ECONNREFUSED/gi,
    /ETIMEDOUT/gi,
    /SELECT\s+.+FROM/gi,
    /INSERT\s+INTO/gi,
    /UPDATE\s+.+SET/gi,
    /DELETE\s+FROM/gi,
  ];

  /**
   * Generates a unique, user-quotable support reference code
   */
  public static generateReferenceCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "ERR-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Checks whether a string contains raw technical, database, or stack trace artifacts
   */
  public static containsTechnicalDetails(text: string): boolean {
    return this.TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
  }

  /**
   * Sanitizes a raw error into a friendly, professional user-facing message
   */
  public static sanitize(
    category: ObservabilityCategory,
    rawError?: unknown,
    customUserMessage?: string,
    actionableHint?: string,
    retryAllowed = true,
  ): UserFacingMessage {
    const referenceCode = this.generateReferenceCode();
    const rawMessage = this.extractRawMessage(rawError);

    // If a clean custom message was explicitly provided and contains no technical leaks, use it
    if (customUserMessage && !this.containsTechnicalDetails(customUserMessage)) {
      return {
        referenceCode,
        title: this.getDefaultTitle(category),
        message: customUserMessage,
        actionableHint: actionableHint || this.getDefaultHint(category),
        retryAllowed,
      };
    }

    // Map by category to user-friendly text
    switch (category) {
      case "DATABASE_ERROR":
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "We encountered a temporary database connectivity issue while saving your information. Your uploaded data is securely preserved.",
          actionableHint:
            actionableHint ||
            "Please wait a few moments and try your request again. Our technical team has been notified.",
          retryAllowed: true,
        };

      case "FAILED_EXTRACTION":
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "We were unable to extract complete billing details from the uploaded document. This often occurs when scanned documents are blurry, misaligned, or in an unrecognized format.",
          actionableHint:
            actionableHint ||
            "Please ensure your document is a clear, legible PDF or upload your data as a standard CSV or Excel file.",
          retryAllowed: true,
        };

      case "INVALID_FILE":
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "The file provided could not be processed because its format or content structure does not match the expected specification.",
          actionableHint:
            actionableHint ||
            "Please verify that the file is an authentic PDF tax invoice or valid AMR telemetry spreadsheet (CSV/XLSX).",
          retryAllowed: false,
        };

      case "UPLOAD_FAILURE":
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "The file upload could not be completed, possibly due to an unstable network connection or file size limitation.",
          actionableHint:
            actionableHint ||
            "Please check your internet connection and try uploading the document again.",
          retryAllowed: true,
        };

      case "RECONCILIATION_FAILURE":
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "The system was unable to complete the billing reconciliation for this period. Some expected tariff rates or meter interval readings were missing.",
          actionableHint:
            actionableHint ||
            "Please confirm that the assigned tariff and meter interval readings cover the entire billing period.",
          retryAllowed: true,
        };

      case "SLOW_JOB":
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "Your document is being processed, but execution is taking longer than expected due to large file volume or high system load.",
          actionableHint:
            actionableHint ||
            "You may safely navigate away; your job will continue processing in the background.",
          retryAllowed: false,
        };

      case "UNEXPECTED_STATE":
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "An unexpected condition occurred during background processing. The document has been safely preserved to prevent data loss.",
          actionableHint:
            actionableHint ||
            "You can retry processing directly from the stored file using the Retry button.",
          retryAllowed: true,
        };

      case "PROCESSING_FAILURE":
      default:
        return {
          referenceCode,
          title: this.getDefaultTitle(category),
          message:
            "An issue occurred while processing this record. Your original source file remains securely stored in the platform vault.",
          actionableHint:
            actionableHint ||
            "Please retry processing, or quote the reference code above to support if the issue persists.",
          retryAllowed: true,
        };
    }
  }

  /**
   * Safely extracts text message from an unknown error object without crashing
   */
  public static extractRawMessage(error: unknown): string {
    if (!error) return "Unknown error condition";
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && "message" in error) {
      return String((error as any).message);
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private static getDefaultTitle(category: ObservabilityCategory): string {
    switch (category) {
      case "DATABASE_ERROR":
        return "Service Temporarily Unavailable";
      case "FAILED_EXTRACTION":
        return "Extraction Incomplete";
      case "INVALID_FILE":
        return "Unsupported File";
      case "UPLOAD_FAILURE":
        return "File Upload Interrupted";
      case "RECONCILIATION_FAILURE":
        return "Reconciliation Notice";
      case "SLOW_JOB":
        return "Processing Performance Notice";
      case "UNEXPECTED_STATE":
        return "Processing State Notice";
      case "PROCESSING_FAILURE":
      default:
        return "Processing Notice";
    }
  }

  private static getDefaultHint(category: ObservabilityCategory): string {
    switch (category) {
      case "INVALID_FILE":
        return "Please verify file format and upload an authentic invoice or telemetry file.";
      case "FAILED_EXTRACTION":
        return "Check scan clarity or upload in spreadsheet format.";
      default:
        return "You can safely retry this action or contact support with your reference code.";
    }
  }
}
