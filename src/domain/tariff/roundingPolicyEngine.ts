/**
 * ENERA ROUNDING AND PRECISION ENGINE (REQUIREMENT 18)
 * ====================================================
 * Authoritative, configurable rounding subsystem for tariff billing determinants,
 * rates, charge lines, taxes, and final invoice reconciliation totals.
 *
 * GOVERNANCE RULES:
 * 1. Rounding can materially affect invoice totals.
 * 2. Never round intermediate calculation values prematurely.
 * 3. Line-item rounding and final-total rounding are NOT interchangeable;
 *    both must be tracked and compared.
 * 4. Record the precision and rounding method used for each calculation.
 * 5. If the official source does not establish a necessary rule, expose the assumption
 *    and flag it for approved configuration rather than hiding it.
 */

import Decimal from "decimal.js-light";
import type {
  RoundingMethod,
  RoundingPolicyConfig,
  CalculationRoundingAudit,
} from "./types";

/**
 * Standard NERSA approved billing code rounding policy
 */
export const STANDARD_NERSA_ROUNDING_POLICY: RoundingPolicyConfig = {
  policy_id: "ROUNDING_NERSA_STANDARD",
  policy_name: "NERSA Standard Electricity Billing Rounding Policy",
  rate_precision: 4, // Gazetted rates often have 4 decimal places in c/kWh or R/kWh
  rate_rounding_method: "ROUND_HALF_UP",
  quantity_precision: 2, // 2 decimal places for meter kWh / kVA quantities
  quantity_rounding_method: "ROUND_HALF_UP",
  charge_line_precision: 2, // 2 decimal places (cents) for charge lines
  charge_line_rounding_method: "ROUND_HALF_UP",
  tax_precision: 2, // 2 decimal places for statutory VAT
  tax_rounding_method: "ROUND_HALF_UP",
  final_total_precision: 2, // 2 decimal places for final invoice total
  final_total_rounding_method: "ROUND_HALF_UP",
  intermediate_calculations_rule: "UNROUNDED_FULL_PRECISION",
  is_approved: true,
  source_authority: "NERSA Approved Electricity Reseller & Billing Code of Practice Section 6",
};

/**
 * Banker's Rounding (Round-half-to-even) policy for high-volume transactions
 */
export const BANKERS_ROUNDING_POLICY: RoundingPolicyConfig = {
  policy_id: "ROUNDING_BANKERS_EVEN",
  policy_name: "High-Volume Financial Banker's Rounding Policy (Round Half Even)",
  rate_precision: 4,
  rate_rounding_method: "ROUND_HALF_EVEN",
  quantity_precision: 4,
  quantity_rounding_method: "ROUND_HALF_EVEN",
  charge_line_precision: 2,
  charge_line_rounding_method: "ROUND_HALF_EVEN",
  tax_precision: 2,
  tax_rounding_method: "ROUND_HALF_EVEN",
  final_total_precision: 2,
  final_total_rounding_method: "ROUND_HALF_EVEN",
  intermediate_calculations_rule: "UNROUNDED_FULL_PRECISION",
  is_approved: true,
  source_authority: "IEEE 754 / GAAP Half-Even Standard",
};

export class RoundingPolicyEngine {
  private static registeredPolicies: Map<string, RoundingPolicyConfig> = new Map([
    [STANDARD_NERSA_ROUNDING_POLICY.policy_id, STANDARD_NERSA_ROUNDING_POLICY],
    [BANKERS_ROUNDING_POLICY.policy_id, BANKERS_ROUNDING_POLICY],
  ]);

  /**
   * Register a custom or municipal rounding policy
   */
  public static registerPolicy(policy: RoundingPolicyConfig): void {
    this.registeredPolicies.set(policy.policy_id, policy);
  }

  /**
   * Retrieve a policy by ID or fallback to standard NERSA policy
   */
  public static getPolicy(policyId?: string): RoundingPolicyConfig {
    if (policyId && this.registeredPolicies.has(policyId)) {
      return this.registeredPolicies.get(policyId)!;
    }
    return STANDARD_NERSA_ROUNDING_POLICY;
  }

  /**
   * Core deterministic rounding function supporting all RoundingMethod strategies
   */
  public static applyRounding(
    value: Decimal | number | string,
    precision: number,
    method: RoundingMethod = "ROUND_HALF_UP",
  ): Decimal {
    const val = value instanceof Decimal ? value : new Decimal(String(value));

    if (method === "UNROUNDED") {
      return val;
    }

    let decimalMode: number;
    switch (method) {
      case "ROUND_HALF_UP":
        decimalMode = Decimal.ROUND_HALF_UP;
        break;
      case "ROUND_HALF_EVEN":
        decimalMode = Decimal.ROUND_HALF_EVEN;
        break;
      case "ROUND_UP":
        decimalMode = Decimal.ROUND_UP;
        break;
      case "ROUND_DOWN":
        decimalMode = Decimal.ROUND_DOWN;
        break;
      case "ROUND_CEILING":
        decimalMode = Decimal.ROUND_CEIL;
        break;
      case "ROUND_FLOOR":
        decimalMode = Decimal.ROUND_FLOOR;
        break;
      default:
        decimalMode = Decimal.ROUND_HALF_UP;
    }

    return val.toDecimalPlaces(precision, decimalMode);
  }

  /**
   * Round a tariff rate according to policy (e.g. 4 decimal places)
   */
  public static roundRate(
    rate: Decimal | number | string,
    policy: RoundingPolicyConfig = STANDARD_NERSA_ROUNDING_POLICY,
  ): Decimal {
    return this.applyRounding(rate, policy.rate_precision, policy.rate_rounding_method);
  }

  /**
   * Round a measured quantity according to policy (e.g. 2 decimal places for kWh)
   */
  public static roundQuantity(
    quantity: Decimal | number | string,
    policy: RoundingPolicyConfig = STANDARD_NERSA_ROUNDING_POLICY,
  ): Decimal {
    return this.applyRounding(quantity, policy.quantity_precision, policy.quantity_rounding_method);
  }

  /**
   * Round a line item amount in Rand (currency cents precision)
   */
  public static roundChargeLine(
    amountZar: Decimal | number | string,
    policy: RoundingPolicyConfig = STANDARD_NERSA_ROUNDING_POLICY,
  ): Decimal {
    return this.applyRounding(amountZar, policy.charge_line_precision, policy.charge_line_rounding_method);
  }

  /**
   * Round tax amount according to policy
   */
  public static roundTax(
    taxZar: Decimal | number | string,
    policy: RoundingPolicyConfig = STANDARD_NERSA_ROUNDING_POLICY,
  ): Decimal {
    return this.applyRounding(taxZar, policy.tax_precision, policy.tax_rounding_method);
  }

  /**
   * Round final invoice total according to policy
   */
  public static roundFinalTotal(
    totalZar: Decimal | number | string,
    policy: RoundingPolicyConfig = STANDARD_NERSA_ROUNDING_POLICY,
  ): Decimal {
    return this.applyRounding(totalZar, policy.final_total_precision, policy.final_total_rounding_method);
  }

  /**
   * Evaluates line-item rounding vs final-total rounding to audit for penny/cent variances.
   * Do not assume line-item rounding and final-total rounding are interchangeable!
   */
  public static auditCalculationRounding(
    lineItems: Array<{ amount_zar: Decimal }>,
    unroundedSubtotal: Decimal,
    vatRate: Decimal,
    policy: RoundingPolicyConfig = STANDARD_NERSA_ROUNDING_POLICY,
  ): CalculationRoundingAudit {
    // 1. Sum of already-rounded line items
    let lineItemSum = new Decimal(0);
    for (const item of lineItems) {
      lineItemSum = lineItemSum.add(
        this.roundChargeLine(item.amount_zar, policy),
      );
    }

    // 2. Final total computed from unrounded subtotal
    const unroundedVat = unroundedSubtotal.mul(vatRate);
    const unroundedTotal = unroundedSubtotal.add(unroundedVat);
    const roundedUnroundedTotal = this.roundFinalTotal(unroundedTotal, policy);

    const roundedLineVat = this.roundTax(lineItemSum.mul(vatRate), policy);
    const lineTotal = lineItemSum.add(roundedLineVat);

    // Difference between summing rounded line items vs rounding unrounded total
    const discrepancy = lineTotal.sub(roundedUnroundedTotal).abs();

    const isOfficial = policy.is_approved && Boolean(policy.source_authority);
    const assumptionWarning = !isOfficial
      ? `UNAPPROVED_ROUNDING_POLICY: Rounding policy '${policy.policy_name}' has no approved source authority reference. Requires official review.`
      : undefined;

    return {
      policy_id: policy.policy_id,
      rate_precision: policy.rate_precision,
      rate_rounding: policy.rate_rounding_method,
      charge_line_rounding: policy.charge_line_rounding_method,
      tax_rounding: policy.tax_rounding_method,
      final_total_rounding: policy.final_total_rounding_method,
      intermediate_rounding_applied: policy.intermediate_calculations_rule !== "UNROUNDED_FULL_PRECISION",
      line_item_sum_zar: lineItemSum,
      unrounded_sum_zar: unroundedSubtotal,
      rounding_discrepancy_zar: discrepancy,
      is_official_policy: isOfficial,
      assumption_warning: assumptionWarning,
    };
  }
}
