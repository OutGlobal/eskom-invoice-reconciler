/**
 * ENERA TARIFF MATCHING ENGINE (REQUIREMENT 19)
 * ============================================
 * Explainable, multi-dimensional tariff selection subsystem.
 *
 * GOVERNANCE RULES:
 * 1. Implement explainable tariff-selection:
 *    getApplicableTariff({ organisationId, account, site, meter, billingPeriod, supplyConfiguration })
 * 2. Consider:
 *    - Utility / provider
 *    - Municipality or service territory
 *    - Customer class
 *    - Tariff code
 *    - Voltage level
 *    - Meter type
 *    - Supply type
 *    - Demand or capacity band
 *    - Effective dates
 *    - Contract-specific eligibility
 *    - Approved tariff status
 * 3. Return the selected tariff version and the reason it was selected.
 * 4. If multiple tariffs match, do not arbitrarily choose one.
 *    Return a structured ambiguity result and require review.
 * 5. If no approved tariff matches, return TARIFF_UNAVAILABLE.
 * 6. Never fall back silently to the newest tariff.
 */

import Decimal from "decimal.js-light";
import type {
  TariffVersionDefinition,
  TariffMatchingCriteria,
  TariffMatchingResult,
  TariffMatchingStatus,
} from "./types";
import { TariffStorageService } from "./tariffStorageService";
import { TariffAssignmentEngine } from "./tariffAssignmentEngine";

export class TariffMatchingEngine {
  private static localTariffCatalog: TariffVersionDefinition[] = [];

  /**
   * Register a tariff in the matching engine catalog
   */
  public static registerTariff(tariff: TariffVersionDefinition): void {
    this.localTariffCatalog = this.localTariffCatalog.filter(
      (t) => !(t.header.tariff_code === tariff.header.tariff_code && t.header.version === tariff.header.version),
    );
    this.localTariffCatalog.push(tariff);
  }

  /**
   * Clear local registered tariffs (for test teardown)
   */
  public static clearCatalog(): void {
    this.localTariffCatalog = [];
  }

  /**
   * Authoritative, explainable tariff-selection function
   */
  public static async getApplicableTariff(
    criteria: TariffMatchingCriteria,
  ): Promise<TariffMatchingResult> {
    return this.getApplicableTariffSync(criteria);
  }

  /**
   * Synchronous tariff selection implementation
   */
  public static getApplicableTariffSync(
    criteria: TariffMatchingCriteria,
  ): TariffMatchingResult {
    const startDate =
      criteria.billingPeriod.start instanceof Date
        ? criteria.billingPeriod.start.toISOString().substring(0, 10)
        : String(criteria.billingPeriod.start).substring(0, 10);

    const endDate =
      criteria.billingPeriod.end instanceof Date
        ? criteria.billingPeriod.end.toISOString().substring(0, 10)
        : String(criteria.billingPeriod.end).substring(0, 10);

    const supply = criteria.supplyConfiguration || {};

    // 1. Gather all candidate tariffs from local catalog and persistent storage
    const allStored = TariffStorageService.getAllVersionsSync();
    const candidatePool: TariffVersionDefinition[] = [...this.localTariffCatalog];
    for (const stored of allStored) {
      if (!candidatePool.some((t) => t.header.tariff_code === stored.header.tariff_code && t.header.version === stored.header.version)) {
        candidatePool.push(stored);
      }
    }

    // 2. Filter 1: Approved Tariff Status
    // Unapproved or draft tariffs are strictly disqualified from automated selection
    const approvedTariffs = candidatePool.filter((t) => {
      const status = t.header.status;
      return status === "active" || status === "approved";
    });

    // 3. Filter 2: Effective Dates
    // The billing start date MUST fall within the tariff's gazetted validity period.
    // NEVER fall back silently to the newest tariff!
    const temporallyValidTariffs = approvedTariffs.filter((t) => {
      const effFrom = t.header.effective_date;
      const effTo = t.header.expiry_date || "2099-12-31";
      return startDate >= effFrom && startDate <= effTo;
    });

    if (temporallyValidTariffs.length === 0) {
      return {
        status: "TARIFF_UNAVAILABLE",
        review_required: true,
        review_reason: `TARIFF_UNAVAILABLE: No approved tariff is effective for billing date '${startDate}'. Silent fallback to newest or adjacent versions is prohibited.`,
        search_criteria_summary: {
          billing_start: startDate,
          billing_end: endDate,
          utility: supply.utility,
          customer_class: supply.customer_class,
        },
        evaluated_tariffs_count: candidatePool.length,
      };
    }

    // 4. Check Hierarchical Assignment (Meter -> Site -> Account)
    let assignedTariffCode: string | undefined;
    let assignmentSourceReason: string | undefined;

    if (criteria.meter) {
      const localAssignments = (TariffAssignmentEngine as any).localAssignments || [];
      const meterMatch = localAssignments.find(
        (a: any) =>
          a.meter_id === criteria.meter &&
          startDate >= a.effective_from &&
          (!a.effective_to || startDate <= a.effective_to),
      );
      if (meterMatch) {
        assignedTariffCode = meterMatch.tariff_code;
        assignmentSourceReason = `Explicit meter assignment for meter '${criteria.meter}'`;
      }
    }

    if (!assignedTariffCode && criteria.site) {
      const localAssignments = (TariffAssignmentEngine as any).localAssignments || [];
      const siteMatch = localAssignments.find(
        (a: any) =>
          a.site_id === criteria.site &&
          !a.meter_id &&
          startDate >= a.effective_from &&
          (!a.effective_to || startDate <= a.effective_to),
      );
      if (siteMatch) {
        assignedTariffCode = siteMatch.tariff_code;
        assignmentSourceReason = `Explicit site assignment for site '${criteria.site}'`;
      }
    }

    if (!assignedTariffCode && criteria.account) {
      const localAssignments = (TariffAssignmentEngine as any).localAssignments || [];
      const accMatch = localAssignments.find(
        (a: any) =>
          a.account_number === criteria.account &&
          startDate >= a.effective_from &&
          (!a.effective_to || startDate <= a.effective_to),
      );
      if (accMatch) {
        assignedTariffCode = accMatch.tariff_code;
        assignmentSourceReason = `Explicit account assignment for account '${criteria.account}'`;
      }
    }

    // 5. Score Candidates Against Multi-Dimensional Supply Attributes
    interface ScoredCandidate {
      tariff: TariffVersionDefinition;
      score: number;
      matchedRules: string[];
      conflicts: string[];
    }

    const scoredCandidates: ScoredCandidate[] = [];

    for (const t of temporallyValidTariffs) {
      let score = 0;
      const matchedRules: string[] = [];
      const conflicts: string[] = [];

      // Assignment override
      if (assignedTariffCode) {
        if (
          t.header.tariff_code.toLowerCase() === assignedTariffCode.toLowerCase() ||
          t.header.tariff_family.toLowerCase() === assignedTariffCode.toLowerCase()
        ) {
          score += 100;
          matchedRules.push(assignmentSourceReason!);
        } else {
          // Doesn't match explicit assignment
          continue;
        }
      }

      // Tariff code / family match
      if (supply.tariff_code) {
        const queryCode = supply.tariff_code.toLowerCase();
        const tCode = t.header.tariff_code.toLowerCase();
        const tFamily = t.header.tariff_family.toLowerCase();
        if (tCode === queryCode || tCode.includes(queryCode) || queryCode.includes(tFamily)) {
          score += 40;
          matchedRules.push(`Tariff code matched '${supply.tariff_code}'`);
        } else {
          conflicts.push(`Tariff code mismatch (expected '${supply.tariff_code}', found '${t.header.tariff_code}')`);
        }
      }

      // Utility / Provider match
      if (supply.utility) {
        const queryUtil = supply.utility.toLowerCase();
        const tUtil = t.header.utility.toLowerCase();
        if (tUtil.includes(queryUtil) || queryUtil.includes(tUtil)) {
          score += 20;
          matchedRules.push(`Utility provider matched '${t.header.utility}'`);
        } else {
          conflicts.push(`Utility mismatch (expected '${supply.utility}', found '${t.header.utility}')`);
        }
      }

      // Municipality or service territory
      if (supply.municipality_or_territory) {
        const queryTerritory = supply.municipality_or_territory.toLowerCase();
        const tUtil = t.header.utility.toLowerCase();
        const tName = t.header.tariff_name.toLowerCase();
        if (tUtil.includes(queryTerritory) || tName.includes(queryTerritory)) {
          score += 15;
          matchedRules.push(`Municipality / territory matched '${supply.municipality_or_territory}'`);
        } else {
          conflicts.push(`Territory mismatch for '${supply.municipality_or_territory}'`);
        }
      }

      // Customer class
      if (supply.customer_class) {
        const queryClass = supply.customer_class.toLowerCase();
        const tClass = t.header.customer_class.toLowerCase();
        if (tClass === queryClass || tClass.includes(queryClass)) {
          score += 15;
          matchedRules.push(`Customer class matched '${t.header.customer_class}'`);
        } else {
          conflicts.push(`Customer class mismatch (expected '${supply.customer_class}', found '${t.header.customer_class}')`);
        }
      }

      // Voltage level
      if (supply.voltage_level) {
        const queryVolt = supply.voltage_level.toLowerCase();
        const tVolt = t.header.voltage_level.toLowerCase();
        if (tVolt === queryVolt || queryVolt.includes(tVolt) || tVolt.includes(queryVolt)) {
          score += 10;
          matchedRules.push(`Voltage level matched '${t.header.voltage_level}'`);
        } else {
          conflicts.push(`Voltage level mismatch (expected '${supply.voltage_level}', found '${t.header.voltage_level}')`);
        }
      }

      // Demand or capacity band (e.g. Minimum NMD kVA check)
      if (supply.demand_kva !== undefined) {
        const demandDec = new Decimal(String(supply.demand_kva));
        const minNmd = t.minimum_nmd_kva || new Decimal(0);
        if (demandDec.gte(minNmd)) {
          score += 10;
          matchedRules.push(`Demand of ${demandDec.toString()} kVA satisfies minimum threshold of ${minNmd.toString()} kVA`);
        } else {
          conflicts.push(`Demand ${demandDec.toString()} kVA below tariff minimum ${minNmd.toString()} kVA`);
        }
      }

      // Base temporal eligibility match
      matchedRules.push(`Effective validity window [${t.header.effective_date} to ${t.header.expiry_date || "active"}] covers billing start date '${startDate}'`);
      score += 10;

      // Only retain candidates without fatal conflicts if supply criteria were specified
      const hasFatalConflict =
        (supply.utility && conflicts.some((c) => c.includes("Utility mismatch"))) ||
        (supply.customer_class && conflicts.some((c) => c.includes("Customer class mismatch")));

      if (!hasFatalConflict) {
        scoredCandidates.push({
          tariff: t,
          score,
          matchedRules,
          conflicts,
        });
      }
    }

    if (scoredCandidates.length === 0) {
      return {
        status: "TARIFF_UNAVAILABLE",
        review_required: true,
        review_reason: `TARIFF_UNAVAILABLE: No approved tariff satisfied the specified supply configuration criteria (utility: '${supply.utility || "any"}', class: '${supply.customer_class || "any"}') for date '${startDate}'.`,
        search_criteria_summary: {
          billing_start: startDate,
          supply_criteria: supply,
        },
        evaluated_tariffs_count: candidatePool.length,
      };
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    const highestScore = scoredCandidates[0].score;
    const topMatches = scoredCandidates.filter((c) => c.score === highestScore);

    // 6. Ambiguity Detection: Multiple tariffs match with equal score
    // Do NOT arbitrarily choose one! Return structured ambiguity result.
    if (topMatches.length > 1) {
      return {
        status: "AMBIGUOUS_MATCH",
        review_required: true,
        review_reason: `AMBIGUOUS_MATCH: ${topMatches.length} approved tariffs matched with equal score (${highestScore}). Arbitrary selection is strictly prohibited; manual review is required.`,
        ambiguous_matches: topMatches.map((m) => ({
          tariff: m.tariff,
          reason: `Matched rules: ${m.matchedRules.join("; ")}`,
          conflicting_attributes: m.conflicts,
        })),
        search_criteria_summary: {
          billing_start: startDate,
          highest_score: highestScore,
          matched_codes: topMatches.map((m) => m.tariff.header.tariff_code),
        },
        evaluated_tariffs_count: candidatePool.length,
      };
    }

    // 7. Unique Match Found
    const selected = topMatches[0];
    const reason = `Matched approved tariff '${selected.tariff.header.tariff_name}' (${selected.tariff.header.tariff_code} v${selected.tariff.header.version}). Reasons: ${selected.matchedRules.join(". ")}.`;

    return {
      status: "MATCH_FOUND",
      selected_tariff: selected.tariff,
      selection_reason: reason,
      matching_score: selected.score,
      matched_rules: selected.matchedRules,
      review_required: false,
      search_criteria_summary: {
        billing_start: startDate,
        score: selected.score,
        code: selected.tariff.header.tariff_code,
      },
      evaluated_tariffs_count: candidatePool.length,
    };
  }
}
