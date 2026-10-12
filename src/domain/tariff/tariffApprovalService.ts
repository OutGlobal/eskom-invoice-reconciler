/**
 * Tariff Review & Approval Lifecycle Service
 * ========================================================
 * Implements the core architectural principles:
 * 1. Separate extracted tariff information from approved tariff rules.
 * 2. Never treat an AI-extracted rate as approved merely because the extraction confidence is high.
 * 3. Authoritative reconciliation requires an officially reviewed, gazetted, and locked tariff version.
 */

import {
  type TariffVersionDefinition,
  type TariffApprovalStatus,
  TariffImmutabilityViolationError,
  UnapprovedTariffReconciliationError,
} from "./types";
import { TariffStorageService } from "./tariffStorageService";
import { TariffValidationEngine, type ValidationResult } from "./tariffValidationEngine";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export interface TariffReviewerContext {
  userId: string;
  role?: string;
  notes?: string;
}

export interface ExtractedTariffSubmissionOptions {
  confidence?: number;
  sourceDocument?: string;
  sourceHash?: string;
  extractorId?: string;
}

export interface ApprovalOperationResult {
  success: boolean;
  message: string;
  tariffCode: string;
  version: string;
  approvalStatus: TariffApprovalStatus;
  validation: ValidationResult;
  definition: TariffVersionDefinition;
}

export class TariffApprovalService {
  /**
   * Submits an extracted tariff document into the tariff library in 'pending_approval' status.
   * STRICT INVARIANT: Extracted rates are NEVER marked as approved merely because extraction confidence is high.
   */
  public static async submitExtractedTariff(
    definition: TariffVersionDefinition,
    options: ExtractedTariffSubmissionOptions = {},
  ): Promise<ApprovalOperationResult> {
    const validation = TariffValidationEngine.validateVersion(definition);

    // Build the pending-approval tariff structure
    const pendingDefinition: TariffVersionDefinition = {
      ...definition,
      header: {
        ...definition.header,
        status: "draft",
        approval_status: "pending_approval",
        extraction_confidence: options.confidence ?? definition.header.extraction_confidence ?? 0.95,
        extracted_from_document:
          options.sourceDocument || definition.header.source_document || "Extracted Document",
        source_hash: options.sourceHash || definition.header.source_hash || "",
        is_locked: false, // Unlocked during review so human specialist can adjust OCR/extraction errors
        lock_reason: "Draft tariff pending human specialist review and verification against gazette.",
      },
    };

    // Save as draft in persistent storage
    await TariffStorageService.saveTariffVersion(pendingDefinition, {
      userId: options.extractorId || "TARIFF_INGESTION_PIPELINE",
      changeSummary: `Imported extracted tariff schedule [${pendingDefinition.header.tariff_code} v${pendingDefinition.header.version}] pending formal approval`,
      forceOverwrite: true,
    });

    return {
      success: validation.isValid,
      message: validation.isValid
        ? `Tariff [${pendingDefinition.header.tariff_code} v${pendingDefinition.header.version}] submitted successfully. Awaiting human specialist review.`
        : `Tariff [${pendingDefinition.header.tariff_code} v${pendingDefinition.header.version}] submitted with ${validation.errors.length} validation errors requiring review.`,
      tariffCode: pendingDefinition.header.tariff_code,
      version: pendingDefinition.header.version,
      approvalStatus: "pending_approval",
      validation,
      definition: pendingDefinition,
    };
  }

  /**
   * Approves a reviewed tariff version, transitioning it to 'approved' and locking it against in-place mutation.
   */
  public static async approveTariff(
    tariffCode: string,
    version: string,
    reviewer: TariffReviewerContext,
  ): Promise<ApprovalOperationResult> {
    const existing = TariffStorageService.getVersion(tariffCode, version);
    if (!existing) {
      throw new Error(`Tariff [${tariffCode} v${version}] not found in tariff library.`);
    }

    // 1. Strict Structural Validation
    const validation = TariffValidationEngine.validateVersion(existing);
    if (!validation.isValid) {
      throw new Error(
        `Cannot approve tariff [${tariffCode} v${version}] due to validation errors: ` +
          validation.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
      );
    }

    // 2. Non-overlap validation against existing active versions
    const allVersions = await TariffStorageService.getAllVersions();
    const otherActiveVersions = allVersions.filter(
      (v) =>
        v.header.tariff_code === tariffCode &&
        v.header.version !== version &&
        (v.header.approval_status === "approved" || v.header.status === "active"),
    );

    const overlapResult = TariffValidationEngine.validateNoOverlappingVersions([
      ...otherActiveVersions,
      existing,
    ]);
    if (!overlapResult.isValid) {
      throw new Error(
        `Cannot approve tariff [${tariffCode} v${version}] due to date overlap: ` +
          overlapResult.errors.map((e) => e.message).join("; "),
      );
    }

    // 3. Determine active vs superseded status based on expiry date
    const nowIso = new Date().toISOString().substring(0, 10);
    const isPast = existing.header.expiry_date && existing.header.expiry_date < nowIso;
    const finalStatus = isPast ? "superseded" : "active";

    // 4. Create approved, immutable version
    const approvedDefinition: TariffVersionDefinition = {
      ...existing,
      header: {
        ...existing.header,
        status: finalStatus,
        approval_status: "approved",
        approved_by: reviewer.userId,
        approved_at: new Date().toISOString(),
        approval_notes: reviewer.notes || "Approved by Tariff Specialist after gazette verification",
        is_locked: true, // Permanent lock once approved to guarantee reconciliation reproducibility
        lock_reason: `Officially gazetted tariff approved by ${reviewer.userId}; permanently locked for audit reproducibility.`,
      },
    };

    // 5. Persist approved version
    await TariffStorageService.saveTariffVersion(approvedDefinition, {
      userId: reviewer.userId,
      changeSummary: `Tariff version approved by ${reviewer.userId}. ${reviewer.notes || ""}`.trim(),
      forceOverwrite: true,
    });

    // 6. Record append-only audit trail in database
    if (isSupabaseConfigured) {
      try {
        await supabase.from("tariff_audit_logs").insert({
          tariff_code: tariffCode,
          version: version,
          action: "TARIFF_APPROVED",
          changed_by: reviewer.userId,
          details: {
            reviewer_role: reviewer.role || "Tariff Specialist",
            notes: reviewer.notes,
            effective_date: approvedDefinition.header.effective_date,
            expiry_date: approvedDefinition.header.expiry_date,
            components_count: approvedDefinition.components.length,
            source_document: approvedDefinition.header.source_document,
            source_hash: approvedDefinition.header.source_hash,
          },
        } as any);
      } catch {
        // non-blocking
      }
    }

    return {
      success: true,
      message: `Tariff [${tariffCode} v${version}] has been officially approved and locked.`,
      tariffCode,
      version,
      approvalStatus: "approved",
      validation,
      definition: approvedDefinition,
    };
  }

  /**
   * Rejects an inaccurate or superseded draft tariff document.
   */
  public static async rejectTariff(
    tariffCode: string,
    version: string,
    reviewer: TariffReviewerContext,
    reason: string,
  ): Promise<ApprovalOperationResult> {
    const existing = TariffStorageService.getVersion(tariffCode, version);
    if (!existing) {
      throw new Error(`Tariff [${tariffCode} v${version}] not found in tariff library.`);
    }

    if (existing.header.is_locked && existing.header.approval_status === "approved") {
      throw new TariffImmutabilityViolationError(
        tariffCode,
        version,
        "Cannot reject a published, locked, and approved tariff. Publish a superseding errata revision instead.",
      );
    }

    const rejectedDefinition: TariffVersionDefinition = {
      ...existing,
      header: {
        ...existing.header,
        status: "archived",
        approval_status: "rejected",
        approval_notes: `Rejected by ${reviewer.userId}: ${reason}`,
        is_locked: true,
        lock_reason: `Rejected during review: ${reason}`,
      },
    };

    await TariffStorageService.saveTariffVersion(rejectedDefinition, {
      userId: reviewer.userId,
      changeSummary: `Tariff rejected: ${reason}`,
      forceOverwrite: true,
    });

    return {
      success: true,
      message: `Tariff [${tariffCode} v${version}] rejected: ${reason}`,
      tariffCode,
      version,
      approvalStatus: "rejected",
      validation: TariffValidationEngine.validateVersion(rejectedDefinition),
      definition: rejectedDefinition,
    };
  }

  /**
   * Determines if a tariff version is formally approved and safe for reconciliation.
   */
  public static isTariffApprovedForReconciliation(tariff: TariffVersionDefinition | null): boolean {
    if (!tariff || !tariff.header) return false;

    // Explicit approval_status takes precedence
    if (tariff.header.approval_status) {
      return tariff.header.approval_status === "approved";
    }

    // Default gazetted catalog fixtures or established locked records
    return (
      (tariff.header.status === "active" || tariff.header.status === "superseded") &&
      Boolean(tariff.header.is_locked)
    );
  }

  /**
   * Guard function asserting that a tariff version is approved before reconciliation.
   * Throws UnapprovedTariffReconciliationError if unapproved.
   */
  public static assertApprovedForReconciliation(tariff: TariffVersionDefinition): void {
    if (!this.isTariffApprovedForReconciliation(tariff)) {
      throw new UnapprovedTariffReconciliationError(
        tariff.header.tariff_code,
        tariff.header.version,
        tariff.header.approval_status || tariff.header.status || "unapproved",
      );
    }
  }
}
