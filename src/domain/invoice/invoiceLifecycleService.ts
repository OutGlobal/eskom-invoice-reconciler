/**
 * Invoice Lifecycle Service
 * Manages strict 10-state lifecycle progression, state transition validations,
 * duplicate detection, and non-destructive validation flagging.
 */

import type {
  InvoiceLifecycleState,
  ExtractedInvoiceDocument,
  InvoiceValidationSummary,
} from "./types";

export class InvoiceLifecycleService {
  /**
   * Complete list of valid 10 lifecycle states in order
   */
  public static readonly LIFECYCLE_STATES: InvoiceLifecycleState[] = [
    "UPLOADED",
    "EXTRACTED",
    "VALIDATED",
    "REVIEW_REQUIRED",
    "APPROVED",
    "READY_FOR_RECONCILIATION",
    "RECONCILING",
    "RECONCILED",
    "DISPUTED",
    "CLOSED",
  ];

  /**
   * Allowed state transitions map
   */
  private static readonly ALLOWED_TRANSITIONS: Record<
    InvoiceLifecycleState,
    InvoiceLifecycleState[]
  > = {
    UPLOADED: ["EXTRACTED"],
    EXTRACTED: ["VALIDATED", "REVIEW_REQUIRED"],
    VALIDATED: ["APPROVED", "REVIEW_REQUIRED"],
    REVIEW_REQUIRED: ["APPROVED", "DISPUTED"],
    APPROVED: ["READY_FOR_RECONCILIATION"],
    READY_FOR_RECONCILIATION: ["RECONCILING"],
    RECONCILING: ["RECONCILED", "DISPUTED"],
    RECONCILED: ["CLOSED", "DISPUTED"],
    DISPUTED: ["REVIEW_REQUIRED", "CLOSED"],
    CLOSED: [], // Terminal state unless reopened by admin
  };

  /**
   * Check if transition from currentState to targetState is permitted
   */
  public static canTransition(
    currentState: InvoiceLifecycleState,
    targetState: InvoiceLifecycleState,
  ): boolean {
    const allowed = this.ALLOWED_TRANSITIONS[currentState] || [];
    return allowed.includes(targetState);
  }

  /**
   * Determine initial lifecycle state following extraction & validation
   */
  public static determineInitialState(
    document: ExtractedInvoiceDocument,
    validationSummary: InvoiceValidationSummary,
  ): InvoiceLifecycleState {
    const lowConfidence = document.metadata.needs_human_review;
    const hasDiscrepancies = validationSummary.status === "failed" || validationSummary.discrepancies.length > 0;

    if (lowConfidence || hasDiscrepancies) {
      return "REVIEW_REQUIRED";
    }

    return "VALIDATED";
  }

  /**
   * Attempt state transition, throwing an error if illegal
   */
  public static transitionState(
    currentState: InvoiceLifecycleState,
    targetState: InvoiceLifecycleState,
  ): InvoiceLifecycleState {
    if (!this.canTransition(currentState, targetState)) {
      throw new Error(
        `Illegal invoice state transition from ${currentState} to ${targetState}. Allowed transitions: ${
          this.ALLOWED_TRANSITIONS[currentState]?.join(", ") || "None"
        }`,
      );
    }
    return targetState;
  }

  /**
   * Detect potential duplicate invoice by SHA-256 hash or Invoice Number + Account Number
   */
  public static isDuplicate(
    incomingDoc: { sha256Hash: string; invoiceNumber: string; accountNumber: string },
    existingInvoices: Array<{ sha256_hash?: string; invoice_number: string; account_number: string }>,
  ): { isDuplicate: boolean; reason?: string } {
    for (const existing of existingInvoices) {
      if (existing.sha256_hash && existing.sha256_hash === incomingDoc.sha256Hash) {
        return {
          isDuplicate: true,
          reason: `Exact file duplicate detected (SHA-256 checksum ${incomingDoc.sha256Hash.substring(0, 12)}...)`,
        };
      }
      if (
        existing.invoice_number === incomingDoc.invoiceNumber &&
        existing.account_number === incomingDoc.accountNumber
      ) {
        return {
          isDuplicate: true,
          reason: `Duplicate invoice number ${incomingDoc.invoiceNumber} for account ${incomingDoc.accountNumber}`,
        };
      }
    }
    return { isDuplicate: false };
  }

  /**
   * Get human-readable description for lifecycle state
   */
  public static getStateLabel(state: InvoiceLifecycleState): string {
    const labels: Record<InvoiceLifecycleState, string> = {
      UPLOADED: "Uploaded",
      EXTRACTED: "Extracted",
      VALIDATED: "Validated",
      REVIEW_REQUIRED: "Review Required",
      APPROVED: "Approved",
      READY_FOR_RECONCILIATION: "Ready for Recon",
      RECONCILING: "Reconciling",
      RECONCILED: "Reconciled",
      DISPUTED: "Disputed",
      CLOSED: "Closed",
    };
    return labels[state] || state;
  }

  /**
   * Get badge color styling for UI
   */
  public static getStateBadgeStyle(state: InvoiceLifecycleState): string {
    const styles: Record<InvoiceLifecycleState, string> = {
      UPLOADED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      EXTRACTED: "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
      VALIDATED: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
      REVIEW_REQUIRED: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
      APPROVED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
      READY_FOR_RECONCILIATION: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300",
      RECONCILING: "bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-300",
      RECONCILED: "bg-emerald-200 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-100",
      DISPUTED: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-300",
      CLOSED: "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100",
    };
    return styles[state] || "bg-gray-100 text-gray-800";
  }
}
