/**
 * Multi-Site & Meter Tariff Assignment Engine
 * ========================================================
 * Determines which tariff structure applies to a specific account, site, meter,
 * and billing period, with support for temporal assignment windows and multi-site portfolios.
 */

import type { TariffVersionDefinition, TariffResolutionOptions } from "./types";
import { TariffVersionSelector, type BillingSubPeriod } from "./tariffVersionSelector";
import { TariffApprovalService } from "./tariffApprovalService";
import { TariffStorageService } from "./tariffStorageService";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

export interface TariffAssignmentRecord {
  id?: string;
  organisation_id?: string;
  site_id: string;
  site_name?: string;
  meter_id?: string;
  meter_number?: string;
  account_number?: string;
  tariff_code: string;
  tariff_name?: string;
  effective_from: string; // YYYY-MM-DD
  effective_to?: string; // YYYY-MM-DD (null = currently active)
  notified_max_demand_kva: number;
  voltage_level?: string;
  created_at?: string;
}

export interface SiteTariffResolutionQuery {
  siteId?: string;
  meterId?: string;
  accountNumber?: string;
  billingPeriodStart: string | Date;
  billingPeriodEnd?: string | Date;
  tariffCodeHint?: string;
  voltageLevel?: string;
}

export interface ResolvedTariffResult {
  isAssigned: boolean;
  assignmentSource: "METER_ASSIGNMENT" | "SITE_ASSIGNMENT" | "ACCOUNT_ASSIGNMENT" | "INVOICE_HINT" | "DEFAULT_CATALOG";
  tariffCode: string;
  notifiedMaxDemandKva: number;
  isCrossBoundary: boolean;
  activeVersion: TariffVersionDefinition;
  subPeriods?: BillingSubPeriod[];
}

export class TariffAssignmentEngine {
  private static localAssignments: TariffAssignmentRecord[] = [];

  /**
   * Register an in-memory assignment (useful for tests or offline workspace mode)
   */
  public static registerAssignment(assignment: TariffAssignmentRecord): void {
    this.localAssignments.push(assignment);
  }

  /**
   * Clear local in-memory assignments (for test teardown)
   */
  public static clearAssignments(): void {
    this.localAssignments = [];
  }

  /**
   * Creates or updates an authoritative tariff assignment for a site or meter
   */
  public static async assignTariff(
    assignment: TariffAssignmentRecord,
  ): Promise<TariffAssignmentRecord> {
    const record: TariffAssignmentRecord = {
      ...assignment,
      id: assignment.id || `assign-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: assignment.created_at || new Date().toISOString(),
    };

    // Store in local cache
    this.localAssignments = this.localAssignments.filter(
      (a) =>
        !(
          a.site_id === record.site_id &&
          a.meter_id === record.meter_id &&
          a.effective_from === record.effective_from
        ),
    );
    this.localAssignments.push(record);

    // Persist to local workspace store
    try {
      const { LocalWorkspaceStore } = await import("@/lib/localWorkspaceStore");
      await LocalWorkspaceStore.saveTariff(`assignment_${record.id}`, record);
    } catch {
      // non-blocking
    }

    // Persist to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        await supabase.from("tariff_assignments").upsert({
          id: record.id,
          site_id: record.site_id,
          meter_id: record.meter_id || null,
          effective_from: record.effective_from,
          effective_to: record.effective_to || null,
          notified_max_demand_kva: record.notified_max_demand_kva,
        } as any);
      } catch {
        // non-blocking
      }
    }

    return record;
  }

  /**
   * Authoritatively determines the applicable tariff for a site, meter, and billing window.
   */
  public static async resolveApplicableTariff(
    query: SiteTariffResolutionQuery,
  ): Promise<ResolvedTariffResult> {
    const startStr =
      query.billingPeriodStart instanceof Date
        ? query.billingPeriodStart.toISOString().substring(0, 10)
        : String(query.billingPeriodStart).substring(0, 10);

    const endStr = query.billingPeriodEnd
      ? query.billingPeriodEnd instanceof Date
        ? query.billingPeriodEnd.toISOString().substring(0, 10)
        : String(query.billingPeriodEnd).substring(0, 10)
      : startStr;

    // 1. Search for Meter-specific assignment first
    let matchedAssignment: TariffAssignmentRecord | undefined;
    let assignmentSource: ResolvedTariffResult["assignmentSource"] = "DEFAULT_CATALOG";

    if (query.meterId) {
      matchedAssignment = this.findMatchingAssignment(
        this.localAssignments,
        startStr,
        (a) => a.meter_id === query.meterId,
      );
      if (matchedAssignment) {
        assignmentSource = "METER_ASSIGNMENT";
      }
    }

    // 2. Search for Site-specific assignment
    if (!matchedAssignment && query.siteId) {
      matchedAssignment = this.findMatchingAssignment(
        this.localAssignments,
        startStr,
        (a) => a.site_id === query.siteId && !a.meter_id,
      );
      if (matchedAssignment) {
        assignmentSource = "SITE_ASSIGNMENT";
      }
    }

    // 3. Search for Account-level assignment
    if (!matchedAssignment && query.accountNumber) {
      matchedAssignment = this.findMatchingAssignment(
        this.localAssignments,
        startStr,
        (a) => a.account_number === query.accountNumber,
      );
      if (matchedAssignment) {
        assignmentSource = "ACCOUNT_ASSIGNMENT";
      }
    }

    // 4. Fallback to tariff code hint from invoice or query
    const targetTariffCode =
      matchedAssignment?.tariff_code || query.tariffCodeHint || "ESKOM_MEGAFLEX_HV_2025_2026";

    if (!matchedAssignment && query.tariffCodeHint) {
      assignmentSource = "INVOICE_HINT";
    }

    // 5. Select applicable tariff version for the start date
    const activeVersion =
      TariffVersionSelector.selectVersionForDate(targetTariffCode, startStr) ||
      TariffStorageService.getVersionForDate(targetTariffCode, startStr) ||
      TariffStorageService.getAnyVersionForDate(startStr);

    if (!activeVersion) {
      throw new Error(
        `Unable to resolve an applicable tariff for code '${targetTariffCode}' covering date '${startStr}'. ` +
          `Please import and approve the relevant tariff schedule first.`,
      );
    }

    // 6. Enforce that the tariff is approved before reconciliation
    TariffApprovalService.assertApprovedForReconciliation(activeVersion);

    // 7. Check if billing period crosses a tariff boundary
    let subPeriods: BillingSubPeriod[] | undefined;
    let isCrossBoundary = false;

    if (startStr !== endStr) {
      try {
        const potentialSplits = TariffVersionSelector.splitBillingPeriod(
          targetTariffCode,
          startStr,
          endStr,
        );
        if (potentialSplits.length > 1) {
          isCrossBoundary = true;
          subPeriods = potentialSplits;
        }
      } catch {
        // If single period covers both start and end, splitBillingPeriod throws or returns 1
        isCrossBoundary = false;
      }
    }

    return {
      isAssigned: Boolean(matchedAssignment),
      assignmentSource,
      tariffCode: activeVersion.header.tariff_code,
      notifiedMaxDemandKva: matchedAssignment?.notified_max_demand_kva ?? 0,
      isCrossBoundary,
      activeVersion,
      subPeriods,
    };
  }

  private static findMatchingAssignment(
    assignments: TariffAssignmentRecord[],
    dateStr: string,
    predicate: (a: TariffAssignmentRecord) => boolean,
  ): TariffAssignmentRecord | undefined {
    return assignments.find((a) => {
      if (!predicate(a)) return false;
      const effFrom = a.effective_from;
      const effTo = a.effective_to || "2099-12-31";
      return dateStr >= effFrom && dateStr <= effTo;
    });
  }
}
