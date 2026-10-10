/**
 * ENERA MATCHING ENGINE (REQUIREMENT 30)
 * =====================================
 * Implements deterministic matching logic for:
 *   - account
 *   - site
 *   - meter
 *   - billing period
 *   - invoice
 *   - AMR dataset
 *
 * Uses explicit matching rules.
 * If multiple candidates match: returns AMBIGUOUS_MATCH.
 * Refuses to randomly or arbitrarily select a candidate.
 */

export interface InvoiceMatchTarget {
  invoiceId: string;
  invoiceNumber: string;
  accountNumber: string;
  siteId?: string;
  meterNumber: string;
  billingPeriodStart: string; // ISO date YYYY-MM-DD
  billingPeriodEnd: string; // ISO date YYYY-MM-DD
  tenantId?: string;
}

export interface AmrDatasetCandidate {
  datasetId: string;
  fileName?: string;
  sourceHash?: string;
  accountNumber?: string;
  siteId?: string;
  meterNumber: string;
  periodStart: string; // ISO date YYYY-MM-DD or ISO timestamp
  periodEnd: string; // ISO date YYYY-MM-DD or ISO timestamp
  intervalCount: number;
  intervalMinutes?: number;
  readingsSummary?: {
    totalKWh?: number;
    maxDemandKVA?: number;
    reactiveKVarh?: number;
  };
  metadata?: Record<string, any>;
}

export type MatchingDecision = "EXACT_MATCH" | "AMBIGUOUS_MATCH" | "NO_MATCH" | "PARTIAL_MATCH";

export interface CandidateRuleEvaluation {
  candidateId: string;
  meterMatch: boolean;
  accountMatch: boolean;
  siteMatch: boolean;
  periodCoverageMatch: boolean;
  isEligible: boolean;
  failureReasons: string[];
  matchedDimensions: string[];
}

export interface MatchingResult {
  decision: MatchingDecision;
  invoiceId: string;
  invoiceNumber: string;
  targetCriteria: {
    accountNumber: string;
    siteId?: string;
    meterNumber: string;
    billingPeriod: { start: string; end: string };
  };
  matchedCandidate: AmrDatasetCandidate | null;
  allMatchingCandidates: AmrDatasetCandidate[];
  candidateEvaluations: CandidateRuleEvaluation[];
  explanation: string;
  requiresUserResolution: boolean;
}

export class MatchingEngine {
  /**
   * Normalize an alphanumeric identifier (meter, account, site)
   */
  public static normalizeId(val: string | null | undefined): string {
    if (!val) return "";
    return val
      .trim()
      .toUpperCase()
      .replace(/[\s\-_]/g, "");
  }

  /**
   * Normalize calendar date to YYYY-MM-DD string
   */
  public static normalizeDate(dateVal: string | Date | null | undefined): string {
    if (!dateVal) return "";
    if (dateVal instanceof Date) {
      return dateVal.toISOString().slice(0, 10);
    }
    const str = String(dateVal).trim();
    if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.slice(0, 10);
    }
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return str;
  }

  /**
   * Check if AMR date range covers the invoice billing period.
   * Tolerates a 1-day boundary for daily/midnight interval cutoffs.
   */
  public static evaluatePeriodCoverage(
    amrStart: string,
    amrEnd: string,
    invStart: string,
    invEnd: string,
  ): { covers: boolean; reason?: string } {
    const amrStartMs = new Date(this.normalizeDate(amrStart)).getTime();
    const amrEndMs = new Date(this.normalizeDate(amrEnd)).getTime();
    const invStartMs = new Date(this.normalizeDate(invStart)).getTime();
    const invEndMs = new Date(this.normalizeDate(invEnd)).getTime();

    if (
      Number.isNaN(amrStartMs) ||
      Number.isNaN(amrEndMs) ||
      Number.isNaN(invStartMs) ||
      Number.isNaN(invEndMs)
    ) {
      return { covers: false, reason: "Unparseable date in period comparison" };
    }

    const ONE_DAY_MS = 86400000;
    // AMR must start on or before invoice start (with 24h grace for start interval)
    const startsInTime = amrStartMs <= invStartMs + ONE_DAY_MS;
    // AMR must end on or after invoice end (with 24h grace for ending boundary)
    const endsInTime = amrEndMs + ONE_DAY_MS >= invEndMs;

    if (!startsInTime) {
      return {
        covers: false,
        reason: `AMR start (${this.normalizeDate(amrStart)}) is later than billing start (${this.normalizeDate(invStart)})`,
      };
    }
    if (!endsInTime) {
      return {
        covers: false,
        reason: `AMR end (${this.normalizeDate(amrEnd)}) is earlier than billing end (${this.normalizeDate(invEnd)})`,
      };
    }

    return { covers: true };
  }

  /**
   * Evaluate a single candidate dataset against invoice target criteria
   */
  public static evaluateCandidate(
    target: InvoiceMatchTarget,
    candidate: AmrDatasetCandidate,
  ): CandidateRuleEvaluation {
    const failureReasons: string[] = [];
    const matchedDimensions: string[] = [];

    // 1. METER RULE (Mandatory)
    const normInvMeter = this.normalizeId(target.meterNumber);
    const normAmrMeter = this.normalizeId(candidate.meterNumber);
    const meterMatch = normInvMeter !== "" && normInvMeter === normAmrMeter;

    if (meterMatch) {
      matchedDimensions.push("METER");
    } else {
      failureReasons.push(
        `Meter mismatch: invoice '${target.meterNumber}' vs candidate '${candidate.meterNumber}'`,
      );
    }

    // 2. ACCOUNT RULE
    let accountMatch = true;
    if (candidate.accountNumber && target.accountNumber) {
      const normInvAcc = this.normalizeId(target.accountNumber);
      const normAmrAcc = this.normalizeId(candidate.accountNumber);
      accountMatch = normInvAcc === normAmrAcc;
      if (accountMatch) {
        matchedDimensions.push("ACCOUNT");
      } else {
        failureReasons.push(
          `Account mismatch: invoice '${target.accountNumber}' vs candidate '${candidate.accountNumber}'`,
        );
      }
    } else if (target.accountNumber) {
      // Inferred account compatibility when AMR does not specify account header
      matchedDimensions.push("ACCOUNT_INFERRED");
    }

    // 3. SITE RULE
    let siteMatch = true;
    if (candidate.siteId && target.siteId) {
      const normInvSite = this.normalizeId(target.siteId);
      const normAmrSite = this.normalizeId(candidate.siteId);
      siteMatch = normInvSite === normAmrSite;
      if (siteMatch) {
        matchedDimensions.push("SITE");
      } else {
        failureReasons.push(
          `Site mismatch: invoice '${target.siteId}' vs candidate '${candidate.siteId}'`,
        );
      }
    } else if (target.siteId) {
      matchedDimensions.push("SITE_INFERRED");
    }

    // 4. BILLING PERIOD COVERAGE RULE
    const periodCoverage = this.evaluatePeriodCoverage(
      candidate.periodStart,
      candidate.periodEnd,
      target.billingPeriodStart,
      target.billingPeriodEnd,
    );
    const periodCoverageMatch = periodCoverage.covers;
    if (periodCoverageMatch) {
      matchedDimensions.push("BILLING_PERIOD");
    } else {
      failureReasons.push(`Period coverage failure: ${periodCoverage.reason}`);
    }

    const isEligible = meterMatch && accountMatch && siteMatch && periodCoverageMatch;

    return {
      candidateId: candidate.datasetId,
      meterMatch,
      accountMatch,
      siteMatch,
      periodCoverageMatch,
      isEligible,
      failureReasons,
      matchedDimensions,
    };
  }

  /**
   * Match an invoice target against an array of candidate AMR datasets.
   *
   * Explicit Rules:
   * - EXACT_MATCH: Exactly 1 candidate matches all criteria.
   * - AMBIGUOUS_MATCH: 2 or more candidates match all criteria. DO NOT RANDOMLY SELECT ONE.
   * - PARTIAL_MATCH: Candidates match meter but fail date or account.
   * - NO_MATCH: No candidates match meter.
   */
  public static matchInvoiceToAmrCandidates(
    target: InvoiceMatchTarget,
    candidates: AmrDatasetCandidate[],
  ): MatchingResult {
    const evaluations: CandidateRuleEvaluation[] = [];
    const matchingCandidates: AmrDatasetCandidate[] = [];

    for (const candidate of candidates) {
      const evalRes = this.evaluateCandidate(target, candidate);
      evaluations.push(evalRes);
      if (evalRes.isEligible) {
        matchingCandidates.push(candidate);
      }
    }

    // SCENARIO 1: EXACT MATCH (Exactly 1 matching candidate)
    if (matchingCandidates.length === 1) {
      const matched = matchingCandidates[0];
      return {
        decision: "EXACT_MATCH",
        invoiceId: target.invoiceId,
        invoiceNumber: target.invoiceNumber,
        targetCriteria: {
          accountNumber: target.accountNumber,
          siteId: target.siteId,
          meterNumber: target.meterNumber,
          billingPeriod: {
            start: target.billingPeriodStart,
            end: target.billingPeriodEnd,
          },
        },
        matchedCandidate: matched,
        allMatchingCandidates: matchingCandidates,
        candidateEvaluations: evaluations,
        explanation: `Exact unambiguous match found: AMR dataset '${matched.datasetId}' matches meter '${target.meterNumber}', account '${target.accountNumber}', and billing period ${target.billingPeriodStart} to ${target.billingPeriodEnd}.`,
        requiresUserResolution: false,
      };
    }

    // SCENARIO 2: AMBIGUOUS MATCH (Multiple candidates match)
    // CORE INVARIANT: Do NOT randomly select one!
    if (matchingCandidates.length > 1) {
      const ids = matchingCandidates.map((c) => `'${c.datasetId}'`).join(", ");
      return {
        decision: "AMBIGUOUS_MATCH",
        invoiceId: target.invoiceId,
        invoiceNumber: target.invoiceNumber,
        targetCriteria: {
          accountNumber: target.accountNumber,
          siteId: target.siteId,
          meterNumber: target.meterNumber,
          billingPeriod: {
            start: target.billingPeriodStart,
            end: target.billingPeriodEnd,
          },
        },
        matchedCandidate: null, // STRICT REFUSAL: Never pick arbitrarily
        allMatchingCandidates: matchingCandidates,
        candidateEvaluations: evaluations,
        explanation: `AMBIGUOUS_MATCH: ${matchingCandidates.length} candidate AMR datasets (${ids}) match meter '${target.meterNumber}', account '${target.accountNumber}', and billing period. Refusing to select randomly. User confirmation is mandatory.`,
        requiresUserResolution: true,
      };
    }

    // SCENARIO 3: NO MATCH or PARTIAL MATCH
    const hasMeterMatch = evaluations.some((e) => e.meterMatch);
    const decision: MatchingDecision = hasMeterMatch ? "PARTIAL_MATCH" : "NO_MATCH";

    const reason = hasMeterMatch
      ? `Meter '${target.meterNumber}' matched in repository, but billing period (${target.billingPeriodStart} to ${target.billingPeriodEnd}) or account criteria was not satisfied.`
      : `No AMR datasets found matching meter '${target.meterNumber}'.`;

    return {
      decision,
      invoiceId: target.invoiceId,
      invoiceNumber: target.invoiceNumber,
      targetCriteria: {
        accountNumber: target.accountNumber,
        siteId: target.siteId,
        meterNumber: target.meterNumber,
        billingPeriod: {
          start: target.billingPeriodStart,
          end: target.billingPeriodEnd,
        },
      },
      matchedCandidate: null,
      allMatchingCandidates: [],
      candidateEvaluations: evaluations,
      explanation: reason,
      requiresUserResolution: true,
    };
  }
}
