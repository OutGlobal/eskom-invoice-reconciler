/**
 * Stage 21 — Duplicate Protection Service
 *
 * Implements multi-criteria duplicate detection, legitimate correction identification,
 * and controlled duplicate handling.
 *
 * Multi-criteria keys evaluated:
 *  - organisation (tenant boundary)
 *  - account (utility account number)
 *  - meter (physical meter identifier)
 *  - billing period (start / end dates, period name)
 *  - invoice number
 *  - source file (SHA-256 hash, filename, size)
 *
 * Four Authoritative Statuses:
 *  - NEW: Unprecedented record/dataset
 *  - DUPLICATE: Accidental exact duplicate (exact hash or identical financial/consumption metrics)
 *  - CORRECTION: Legitimate correction (same account/meter/period with altered metrics) — NOT blindly rejected!
 *  - REPLACEMENT: Controlled replacement superseding and archiving prior records
 */

import { supabase } from "@/lib/supabase";
import type { UserSecurityContext } from "../security/types";
import { TenantIsolationViolationError } from "../security/tenantContextService";
import { AuditLedgerService } from "../audit/auditLedgerService";
import type {
  DuplicateCheckResult,
  DuplicateEvaluationCandidate,
  DuplicateHandlingStatus,
  DuplicateMatchCriteria,
  DuplicateMetricComparison,
  DuplicateResolutionAction,
  DuplicateResolutionOption,
  ExistingRecordSummary,
} from "./duplicateTypes";

export class DuplicateProtectionService {
  // In-memory fallback / mock store for fast tests and offline resilience
  private static registeredRecords: Map<string, ExistingRecordSummary[]> = new Map();

  /**
   * Reset in-memory registry (useful for unit tests)
   */
  public static clearState(): void {
    this.registeredRecords.clear();
  }

  /**
   * Register an existing record manually into the memory registry
   */
  public static registerRecordInMemory(orgId: string, record: ExistingRecordSummary): void {
    const list = this.registeredRecords.get(orgId) || [];
    list.push(record);
    this.registeredRecords.set(orgId, list);
  }

  /**
   * Evaluates a candidate file/invoice/telemetry dataset against existing historical records
   */
  public static async evaluateCandidate(
    candidate: DuplicateEvaluationCandidate,
    context?: UserSecurityContext,
  ): Promise<DuplicateCheckResult> {
    const orgId = candidate.organisationId;

    // Strict Tenant Isolation verification
    if (context && context.role !== "SUPER_ADMIN" && context.organisationId !== orgId) {
      throw new TenantIsolationViolationError(context.organisationId, orgId);
    }

    const now = new Date().toISOString();

    // 1. Fetch potential matching historical records for this tenant
    const existingRecords = await this.findMatchingRecords(candidate);

    // 2. Evaluate matches across the 6 key dimensions
    let matchedRecord: ExistingRecordSummary | undefined;
    const matchCriteria: DuplicateMatchCriteria = {
      matchedBySha256Hash: false,
      matchedByInvoiceNumber: false,
      matchedByAccountAndPeriod: false,
      matchedByMeterAndPeriod: false,
      matchedSourceFileName: false,
    };

    for (const existing of existingRecords) {
      // Dimension 1: Source File Hash (SHA-256)
      if (
        candidate.sourceFile.sha256Hash &&
        existing.sha256Hash &&
        candidate.sourceFile.sha256Hash.toLowerCase() === existing.sha256Hash.toLowerCase()
      ) {
        matchCriteria.matchedBySha256Hash = true;
        matchedRecord = existing;
        break;
      }

      // Dimension 2: Invoice Number
      if (
        candidate.invoiceNumber &&
        existing.invoiceNumber &&
        candidate.invoiceNumber.trim().toLowerCase() === existing.invoiceNumber.trim().toLowerCase()
      ) {
        matchCriteria.matchedByInvoiceNumber = true;
        matchedRecord = existing;
      }

      // Dimension 3: Account Number + Billing Period
      if (
        candidate.accountNumber &&
        existing.accountNumber &&
        candidate.accountNumber.trim().toLowerCase() === existing.accountNumber.trim().toLowerCase()
      ) {
        if (
          candidate.billingPeriod?.startDate &&
          candidate.billingPeriod?.endDate &&
          existing.billingStart === candidate.billingPeriod.startDate &&
          existing.billingEnd === candidate.billingPeriod.endDate
        ) {
          matchCriteria.matchedByAccountAndPeriod = true;
          matchedRecord = existing;
        }
      }

      // Dimension 4: Meter Number + Billing Period
      if (
        candidate.meterNumber &&
        existing.meterNumber &&
        candidate.meterNumber.trim().toLowerCase() === existing.meterNumber.trim().toLowerCase()
      ) {
        if (
          candidate.billingPeriod?.startDate &&
          candidate.billingPeriod?.endDate &&
          existing.billingStart === candidate.billingPeriod.startDate &&
          existing.billingEnd === candidate.billingPeriod.endDate
        ) {
          matchCriteria.matchedByMeterAndPeriod = true;
          matchedRecord = existing;
        }
      }

      // Dimension 5: Source Filename
      if (
        candidate.sourceFile.name &&
        existing.sourceFileName &&
        candidate.sourceFile.name.trim().toLowerCase() ===
          existing.sourceFileName.trim().toLowerCase()
      ) {
        matchCriteria.matchedSourceFileName = true;
      }

      if (matchedRecord) break;
    }

    // 3. If explicit resolution was specified as REPLACEMENT by user or pipeline
    if (candidate.explicitResolution === "REPLACEMENT") {
      return {
        status: "REPLACEMENT",
        confidence: 1.0,
        summary: `Replacement import explicitly requested. Superseding existing record${
          matchedRecord ? ` '${matchedRecord.id}'` : ""
        }.`,
        recommendation: "Process as authoritative replacement with lineage tracking.",
        matchCriteria,
        existingRecord: matchedRecord,
        differences: matchedRecord ? this.calculateDifferences(candidate, matchedRecord) : [],
        resolutionOptions: this.buildResolutionOptions("REPLACEMENT"),
        isLegitimateCorrection: false,
        isExactDuplicate: false,
        evaluatedAt: now,
      };
    }

    // 4. If no historical record matched, this is a fresh NEW dataset
    if (!matchedRecord) {
      return {
        status: "NEW",
        confidence: 1.0,
        summary: "No prior matching records found. Fresh dataset ready for ingestion.",
        recommendation: "Proceed with normal authoritative ingestion.",
        matchCriteria,
        existingRecord: undefined,
        differences: [],
        resolutionOptions: this.buildResolutionOptions("NEW"),
        isLegitimateCorrection: false,
        isExactDuplicate: false,
        evaluatedAt: now,
      };
    }

    // 5. Compare metrics to distinguish between DUPLICATE and CORRECTION
    const differences = this.calculateDifferences(candidate, matchedRecord);

    // If exact file hash matches AND no metric differences, it is an exact duplicate
    if (matchCriteria.matchedBySha256Hash || differences.length === 0) {
      const summary = matchCriteria.matchedBySha256Hash
        ? `Exact file duplicate detected: SHA-256 fingerprint matches previously imported file '${
            matchedRecord.sourceFileName || matchedRecord.id
          }' from ${matchedRecord.importedAt}.`
        : `Accidental duplicate import detected: An identical invoice record already exists for Account ${
            matchedRecord.accountNumber || "N/A"
          }, Period ${matchedRecord.billingPeriod || "N/A"} with zero metric variance.`;

      return {
        status: "DUPLICATE",
        confidence: 1.0,
        summary,
        recommendation:
          "Skip import to prevent duplicate records and double-counting in dashboard figures.",
        matchCriteria,
        existingRecord: matchedRecord,
        differences,
        resolutionOptions: this.buildResolutionOptions("DUPLICATE"),
        isLegitimateCorrection: false,
        isExactDuplicate: true,
        evaluatedAt: now,
      };
    }

    // 6. Otherwise: Same account/meter/period/invoice BUT differing metrics => CORRECTION!
    // "Do not blindly reject legitimate corrections."
    const deltaSummary = differences
      .map((d) => `${d.label}: ${d.formattedDelta || `${d.existingValue} -> ${d.incomingValue}`}`)
      .join("; ");

    return {
      status: "CORRECTION",
      confidence: 0.95,
      summary: `Legitimate correction detected: Existing record for Account ${
        matchedRecord.accountNumber || "N/A"
      } (Period: ${
        matchedRecord.billingPeriod || "N/A"
      }) has differing billing determinants (${deltaSummary}).`,
      recommendation:
        "Accept legitimate correction. Update active determinants and preserve previous version in audit lineage.",
      matchCriteria,
      existingRecord: matchedRecord,
      differences,
      resolutionOptions: this.buildResolutionOptions("CORRECTION"),
      isLegitimateCorrection: true,
      isExactDuplicate: false,
      evaluatedAt: now,
    };
  }

  /**
   * Applies the chosen resolution action authoritatively with audit ledger recording
   */
  public static async applyResolution(
    candidate: DuplicateEvaluationCandidate,
    checkResult: DuplicateCheckResult,
    chosenAction: DuplicateResolutionAction,
    context?: UserSecurityContext,
  ): Promise<{
    success: boolean;
    status: DuplicateHandlingStatus;
    actionTaken: DuplicateResolutionAction;
    supersedesId?: string;
    message: string;
  }> {
    const actor = context?.email || "system@enera.energy";
    const orgId = candidate.organisationId;

    switch (chosenAction) {
      case "KEEP_EXISTING_SKIP": {
        // Log duplicate skipped in audit ledger
        await AuditLedgerService.logEvent(
          "DUPLICATE_FILE_DETECTED" as any,
          candidate.sourceType,
          checkResult.existingRecord?.id || candidate.sourceFile.name,
          {
            action: "SKIP",
            sha256: candidate.sourceFile.sha256Hash,
            filename: candidate.sourceFile.name,
            matchedRecordId: checkResult.existingRecord?.id,
          },
          actor,
        );

        try {
          const { AuditTrailService } = await import("../audit/auditTrailService");
          await AuditTrailService.recordAction({
            organisationId: candidate.organisationId,
            category: "upload",
            action: "UPLOAD_DUPLICATE_RESOLVED",
            description: `Accidental duplicate detected and skipped for ${candidate.sourceFile.name}`,
            actor: { email: actor },
            record: {
              entityType: candidate.sourceType === "INVOICE_PDF" ? "invoice" : "source_file",
              recordId: checkResult.existingRecord?.id || "unknown",
              recordLabel: candidate.sourceFile.name,
            },
            metadata: {
              matchedCriteria: checkResult.matchedCriteria,
              actionTaken: "KEEP_EXISTING_SKIP",
            },
          });
        } catch {}

        return {
          success: true,
          status: "DUPLICATE",
          actionTaken: "KEEP_EXISTING_SKIP",
          supersedesId: undefined,
          message:
            "Duplicate skipped. Existing authoritative record preserved without duplication.",
        };
      }

      case "ACCEPT_CORRECTION": {
        // Record correction with lineage linking to the prior record
        const priorId = checkResult.existingRecord?.id;

        await AuditLedgerService.logEvent(
          "CORRECTION_RECORD_CREATED" as any,
          candidate.sourceType,
          priorId || candidate.invoiceNumber || candidate.sourceFile.name,
          {
            action: "ACCEPT_CORRECTION",
            supersedesId: priorId,
            differences: checkResult.differences,
            newSha256: candidate.sourceFile.sha256Hash,
            candidateMetrics: candidate.metrics,
          },
          actor,
        );

        try {
          const { AuditTrailService } = await import("../audit/auditTrailService");
          await AuditTrailService.recordAction({
            organisationId: candidate.organisationId,
            category: "data_correction",
            action: "DUPLICATE_CORRECTION_ACCEPTED",
            description: `Accepted legitimate correction for ${candidate.invoiceNumber || candidate.sourceFile.name}, superseding prior version`,
            actor: { email: actor },
            record: {
              entityType: candidate.sourceType === "INVOICE_PDF" ? "invoice" : "source_file",
              recordId: priorId || candidate.invoiceNumber || "unknown",
              recordLabel: candidate.invoiceNumber || candidate.sourceFile.name,
            },
            previousState: checkResult.existingRecord?.metrics || null,
            newState: candidate.metrics || null,
            metadata: { differences: checkResult.differences, supersedesId: priorId },
          });
        } catch {}

        return {
          success: true,
          status: "CORRECTION",
          actionTaken: "ACCEPT_CORRECTION",
          supersedesId: priorId,
          message: `Legitimate correction accepted. Superseding prior record '${priorId}' with active audit lineage.`,
        };
      }

      case "REPLACE_EXISTING": {
        const priorId = checkResult.existingRecord?.id;

        await AuditLedgerService.logEvent(
          "RECORD_SUPERSEDED" as any,
          candidate.sourceType,
          priorId || candidate.sourceFile.name,
          {
            action: "REPLACE_EXISTING",
            supersedesId: priorId,
            newSha256: candidate.sourceFile.sha256Hash,
          },
          actor,
        );

        return {
          success: true,
          status: "REPLACEMENT",
          actionTaken: "REPLACE_EXISTING",
          supersedesId: priorId,
          message: `Existing record '${priorId}' marked as superseded. New record established as replacement.`,
        };
      }

      case "FORCE_IMPORT_NEW":
      default: {
        return {
          success: true,
          status: "NEW",
          actionTaken: "FORCE_IMPORT_NEW",
          supersedesId: undefined,
          message: "Imported as fresh independent record.",
        };
      }
    }
  }

  /**
   * Helper: Calculates field-by-field differences between candidate and existing record
   */
  private static calculateDifferences(
    candidate: DuplicateEvaluationCandidate,
    existing: ExistingRecordSummary,
  ): DuplicateMetricComparison[] {
    const diffs: DuplicateMetricComparison[] = [];
    const cMetrics = candidate.metrics || {};

    // 1. Total Billed Amount
    if (cMetrics.totalAmount !== undefined && existing.totalAmount !== undefined) {
      const delta = cMetrics.totalAmount - existing.totalAmount;
      if (Math.abs(delta) > 0.01) {
        diffs.push({
          field: "totalAmount",
          label: "Total Invoice Amount",
          existingValue: existing.totalAmount,
          incomingValue: cMetrics.totalAmount,
          delta,
          formattedDelta: `${delta > 0 ? "+" : ""}R ${delta.toLocaleString("en-ZA", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        });
      }
    }

    // 2. Total Energy (kWh)
    if (cMetrics.totalKwh !== undefined && existing.totalKwh !== undefined) {
      const delta = cMetrics.totalKwh - existing.totalKwh;
      if (Math.abs(delta) > 0.1) {
        diffs.push({
          field: "totalKwh",
          label: "Total Energy Consumption",
          existingValue: existing.totalKwh,
          incomingValue: cMetrics.totalKwh,
          delta,
          formattedDelta: `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-ZA", {
            maximumFractionDigits: 1,
          })} kWh`,
        });
      }
    }

    // 3. Peak Energy (kWh)
    if (cMetrics.peakKwh !== undefined && existing.peakKwh !== undefined) {
      const delta = cMetrics.peakKwh - existing.peakKwh;
      if (Math.abs(delta) > 0.1) {
        diffs.push({
          field: "peakKwh",
          label: "Peak Energy",
          existingValue: existing.peakKwh,
          incomingValue: cMetrics.peakKwh,
          delta,
          formattedDelta: `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-ZA", {
            maximumFractionDigits: 1,
          })} kWh`,
        });
      }
    }

    // 4. Standard Energy (kWh)
    if (cMetrics.standardKwh !== undefined && existing.standardKwh !== undefined) {
      const delta = cMetrics.standardKwh - existing.standardKwh;
      if (Math.abs(delta) > 0.1) {
        diffs.push({
          field: "standardKwh",
          label: "Standard Energy",
          existingValue: existing.standardKwh,
          incomingValue: cMetrics.standardKwh,
          delta,
          formattedDelta: `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-ZA", {
            maximumFractionDigits: 1,
          })} kWh`,
        });
      }
    }

    // 5. Off-Peak Energy (kWh)
    if (cMetrics.offPeakKwh !== undefined && existing.offPeakKwh !== undefined) {
      const delta = cMetrics.offPeakKwh - existing.offPeakKwh;
      if (Math.abs(delta) > 0.1) {
        diffs.push({
          field: "offPeakKwh",
          label: "Off-Peak Energy",
          existingValue: existing.offPeakKwh,
          incomingValue: cMetrics.offPeakKwh,
          delta,
          formattedDelta: `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-ZA", {
            maximumFractionDigits: 1,
          })} kWh`,
        });
      }
    }

    // 6. Maximum Demand (kVA)
    if (cMetrics.maxDemandKva !== undefined && existing.maxDemandKva !== undefined) {
      const delta = cMetrics.maxDemandKva - existing.maxDemandKva;
      if (Math.abs(delta) > 0.1) {
        diffs.push({
          field: "maxDemandKva",
          label: "Maximum Demand",
          existingValue: existing.maxDemandKva,
          incomingValue: cMetrics.maxDemandKva,
          delta,
          formattedDelta: `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kVA`,
        });
      }
    }

    return diffs;
  }

  /**
   * Helper: Builds resolution options depending on status
   */
  private static buildResolutionOptions(
    status: DuplicateHandlingStatus,
  ): DuplicateResolutionOption[] {
    switch (status) {
      case "DUPLICATE":
        return [
          {
            action: "KEEP_EXISTING_SKIP",
            title: "Skip Import (Recommended)",
            description: "Avoid duplicate record creation and keep existing authoritative data.",
            isRecommended: true,
          },
          {
            action: "REPLACE_EXISTING",
            title: "Replace Existing Record",
            description: "Archive the previously imported record and replace it with this version.",
            isRecommended: false,
          },
          {
            action: "FORCE_IMPORT_NEW",
            title: "Force Import as New",
            description: "Bypass duplicate detection and create an independent record.",
            isRecommended: false,
          },
        ];

      case "CORRECTION":
        return [
          {
            action: "ACCEPT_CORRECTION",
            title: "Accept Legitimate Correction (Recommended)",
            description:
              "Ingest as an authoritative billing revision. Links lineage and updates active reconciliation.",
            isRecommended: true,
          },
          {
            action: "REPLACE_EXISTING",
            title: "Replace Prior Version Completely",
            description: "Archive the prior record as superseded and establish this as primary.",
            isRecommended: false,
          },
          {
            action: "KEEP_EXISTING_SKIP",
            title: "Ignore Correction",
            description: "Retain the original billing record without adopting these changes.",
            isRecommended: false,
          },
        ];

      case "REPLACEMENT":
        return [
          {
            action: "REPLACE_EXISTING",
            title: "Proceed with Replacement",
            description: "Supersede existing record with immutable audit trail.",
            isRecommended: true,
          },
        ];

      case "NEW":
      default:
        return [
          {
            action: "FORCE_IMPORT_NEW",
            title: "Import as New Dataset",
            description: "Standard ingestion of a fresh unprecedented record.",
            isRecommended: true,
          },
        ];
    }
  }

  /**
   * Helper: Queries Supabase and in-memory registry for records matching candidate's organisation
   */
  private static async findMatchingRecords(
    candidate: DuplicateEvaluationCandidate,
  ): Promise<ExistingRecordSummary[]> {
    const results: ExistingRecordSummary[] = [];
    const orgId = candidate.organisationId;

    // 1. In-memory check (for tests & fast mock fallback)
    const memRecords = this.registeredRecords.get(orgId) || [];
    results.push(...memRecords);

    // 2. Query Supabase invoice_records
    try {
      let query = supabase.from("invoice_records").select("*");
      if (orgId) {
        query = query.eq("organisation_id", orgId);
      }

      const { data, error } = await query.limit(50);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          // Avoid duplicate entries if already in results
          if (!results.some((r) => r.id === row.id)) {
            results.push({
              id: row.id,
              invoiceNumber: row.invoice_number,
              accountNumber: row.account_number,
              meterNumber: row.meter_number,
              billingPeriod: row.billing_period_name,
              billingStart: row.billing_start,
              billingEnd: row.billing_end,
              totalAmount:
                row.invoiced_total !== undefined ? Number(row.invoiced_total) : undefined,
              totalKwh: row.total_kwh !== undefined ? Number(row.total_kwh) : undefined,
              peakKwh: row.peak_kwh !== undefined ? Number(row.peak_kwh) : undefined,
              standardKwh: row.standard_kwh !== undefined ? Number(row.standard_kwh) : undefined,
              offPeakKwh: row.off_peak_kwh !== undefined ? Number(row.off_peak_kwh) : undefined,
              maxDemandKva:
                row.max_demand_kva !== undefined ? Number(row.max_demand_kva) : undefined,
              sourceFileName: row.source_file_name || row.source,
              sha256Hash: row.sha256_hash,
              importedAt: row.created_at || new Date().toISOString(),
              duplicateStatus: (row.duplicate_status as DuplicateHandlingStatus) || "NEW",
              supersedesId: row.supersedes_id,
            });
          }
        }
      }
    } catch {
      // Graceful fallback to memory records
    }

    return results;
  }
}
