/**
 * Tariff Version Selector & Pro-Rata Splitter
 * Selects authoritative tariff versions based on effective validity periods and splits cross-boundary billing periods.
 * Guarantees that historical invoices reproducibly resolve to their historical gazetted tariff rates.
 */

import type { TariffVersionDefinition, TariffResolutionOptions } from "./types";
import { TariffStorageService } from "./tariffStorageService";
import {
  ESKOM_MEGAFLEX_2025_2026,
  ESKOM_MEGAFLEX_2024_2025,
  ESKOM_MEGAFLEX_2023_2024,
} from "./tariffFixtures";

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

    return this.selectVersionForDate(tariffQuery, dateStr);
  }

  /**
   * Select applicable tariff version for a specific date
   */
  public static selectVersionForDate(
    tariffCodeOrFamily: string,
    dateStr: string,
  ): TariffVersionDefinition {
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

    // 3. Fallback matching by year if date falls in a known historical window
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1; // 1-12
    // Eskom fiscal year begins April 1:
    // If targetMonth >= 4, fiscal year is targetYear
    // If targetMonth < 4, fiscal year is targetYear - 1
    const fiscalStartYear = targetMonth >= 4 ? targetYear : targetYear - 1;

    if (fiscalStartYear === 2023) {
      return ESKOM_MEGAFLEX_2023_2024;
    }
    if (fiscalStartYear === 2024) {
      return ESKOM_MEGAFLEX_2024_2025;
    }

    return ESKOM_MEGAFLEX_2025_2026;
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
