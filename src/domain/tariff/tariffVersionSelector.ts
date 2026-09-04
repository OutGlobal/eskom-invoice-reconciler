/**
 * Tariff Version Selector & Pro-Rata Splitter
 * Selects applicable tariff versions based on effective dates and splits cross-boundary billing periods
 */

import type { TariffVersionDefinition } from "./types";
import { ESKOM_MEGAFLEX_2025_2026 } from "./tariffFixtures";

export interface BillingSubPeriod {
  sub_period_start: string; // YYYY-MM-DD
  sub_period_end: string; // YYYY-MM-DD
  days_count: number;
  tariff_version: TariffVersionDefinition;
}

export class TariffVersionSelector {
  private static registeredVersions: TariffVersionDefinition[] = [ESKOM_MEGAFLEX_2025_2026];

  /**
   * Register a new tariff version definition in the repository
   */
  public static registerVersion(version: TariffVersionDefinition): void {
    this.registeredVersions.push(version);
  }

  /**
   * Select applicable tariff version for a specific date
   */
  public static selectVersionForDate(
    tariffCodeOrFamily: string,
    dateStr: string,
  ): TariffVersionDefinition {
    const targetDate = new Date(dateStr);

    const matched = this.registeredVersions.find((v) => {
      const isCodeMatch =
        v.header.tariff_code.toLowerCase() === tariffCodeOrFamily.toLowerCase() ||
        v.header.tariff_family.toLowerCase() === tariffCodeOrFamily.toLowerCase();

      if (!isCodeMatch) return false;

      const effFrom = new Date(v.header.effective_date);
      const effTo = v.header.expiry_date ? new Date(v.header.expiry_date) : new Date("2099-12-31");

      return targetDate >= effFrom && targetDate <= effTo;
    });

    return matched || ESKOM_MEGAFLEX_2025_2026;
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
