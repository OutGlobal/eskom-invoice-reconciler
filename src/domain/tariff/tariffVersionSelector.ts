/**
 * Tariff Version Selector & Pro-Rata Splitter
 * Selects authoritative tariff versions based on effective validity periods and splits cross-boundary billing periods.
 * Guarantees that historical invoices reproducibly resolve to their historical gazetted tariff rates.
 */

import type { TariffVersionDefinition, TariffResolutionOptions } from "./types";
import { TariffStorageService } from "./tariffStorageService";

export interface BillingSubPeriod {
  sub_period_start: string; // YYYY-MM-DD
  sub_period_end: string; // YYYY-MM-DD
  days_count: number;
  tariff_version: TariffVersionDefinition;
}

export class TariffVersionSelector {
  private static localRegisteredVersions: TariffVersionDefinition[] = [];

  /**
   * Register a new tariff version definition in the local registry
   */
  public static registerVersion(version: TariffVersionDefinition): void {
    this.localRegisteredVersions.push(version);
    TariffStorageService.saveTariffVersion(version, {
      forceOverwrite: !version.header.is_locked,
    }).catch(() => {
      // Ignore background persist warnings in sync register
    });
  }

  /**
   * Reset local registered versions (for test cleanup)
   */
  public static reset(): void {
    this.localRegisteredVersions = [];
    TariffStorageService.resetToDefaults();
  }

  /**
   * Authoritative resolution of tariff version for an invoice based on billing period and code
   */
  public static async resolveTariffForInvoice(
    options: TariffResolutionOptions,
  ): Promise<TariffVersionDefinition> {
    if (options.explicitDefinition && options.explicitDefinition.header) {
      return options.explicitDefinition;
    }

    const tariffQuery = options.tariffCode || "MEGAFLEX";
    const dateStr =
      options.billingStart instanceof Date
        ? options.billingStart.toISOString().substring(0, 10)
        : String(options.billingStart).substring(0, 10);

    const selected = this.selectVersionForDate(tariffQuery, dateStr);
    if (!selected) throw new Error("Upload an applicable tariff document before reconciliation.");
    return selected;
  }

  /**
   * Select applicable tariff version for a specific date
   */
  public static selectVersionForDate(
    tariffCodeOrFamily: string,
    dateStr: string,
  ): TariffVersionDefinition | null {
    const targetDate = new Date(dateStr);
    const targetIso = targetDate.toISOString().substring(0, 10);

    // 1. Check local registered versions first
    const localMatch = this.localRegisteredVersions.find((v) => {
      const isCodeMatch =
        v.header.tariff_code.toLowerCase().includes(tariffCodeOrFamily.toLowerCase()) ||
        v.header.tariff_family.toLowerCase().includes(tariffCodeOrFamily.toLowerCase()) ||
        tariffCodeOrFamily.toLowerCase().includes(v.header.tariff_family.toLowerCase());

      if (!isCodeMatch) return false;

      const effFrom = v.header.effective_date;
      const effTo = v.header.expiry_date || "2099-12-31";
      return targetIso >= effFrom && targetIso <= effTo;
    });

    if (localMatch) return localMatch;

    // 2. Query controlled persistent store in TariffStorageService
    const storedMatch = TariffStorageService.getVersionForDate(tariffCodeOrFamily, dateStr);
    if (storedMatch) return storedMatch;

    return null;
  }

  /**
   * Split a billing period (start to end) into sub-periods if it crosses a tariff version effective date
   */
  public static splitBillingPeriod(
    tariffCodeOrFamily: string,
    billingStartStr: string,
    billingEndStr: string,
  ): BillingSubPeriod[] {
    const start = new Date(billingStartStr);
    const end = new Date(billingEndStr);

    const subPeriods: BillingSubPeriod[] = [];
    let currentStart = new Date(start);

    while (currentStart <= end) {
      const currentStartStr = currentStart.toISOString().substring(0, 10);
      const activeVersion = this.selectVersionForDate(tariffCodeOrFamily, currentStartStr);
      if (!activeVersion) {
        throw new Error("No uploaded tariff covers this billing period.");
      }

      // Find expiry date of active version or billingEnd
      const versionExpiry = activeVersion.header.expiry_date
        ? new Date(activeVersion.header.expiry_date)
        : end;

      const currentSubEnd = versionExpiry < end ? versionExpiry : end;

      // Calculate days in sub-period (inclusive)
      const diffTime = Math.abs(currentSubEnd.getTime() - currentStart.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      subPeriods.push({
        sub_period_start: currentStart.toISOString().substring(0, 10),
        sub_period_end: currentSubEnd.toISOString().substring(0, 10),
        days_count: days,
        tariff_version: activeVersion,
      });

      // Move to next day after currentSubEnd
      currentStart = new Date(currentSubEnd.getTime() + 86400000);
    }

    return subPeriods;
  }
}
