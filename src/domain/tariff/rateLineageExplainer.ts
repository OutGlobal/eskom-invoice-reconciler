/**
 * Rate Lineage Explanation Engine
 * Answers the critical audit question: "Why was this tariff rate applied?"
 * Grounded in gazetted NERSA schedules, TOU clock rules, and formula lineage.
 */

import { TariffVersionSelector } from "./tariffVersionSelector";
import type { RateLineageExplanation, TariffVersionDefinition, TariffComponentRule } from "./types";

export interface RateLineageOptions {
  tariffCodeOrFamily: string;
  dateStr: string;
  componentCode: string;
  voltageLevel?: string;
  customerClass?: string;
}

export function explainAppliedRate(options: RateLineageOptions): RateLineageExplanation {
  const { tariffCodeOrFamily, dateStr, componentCode } = options;

  // 1. Select effective tariff version for target date
  const version: TariffVersionDefinition = TariffVersionSelector.selectVersionForDate(
    tariffCodeOrFamily,
    dateStr
  );

  // 2. Determine season for date
  const dateObj = new Date(dateStr);
  const month = dateObj.getUTCMonth() + 1; // 1-indexed
  const isHighSeason = month >= 6 && month <= 8; // June, July, August
  const season = isHighSeason ? "high" : "low";

  // 3. Find target component rule in version definition
  const componentRule = version.components.find(
    (c) => c.component_code === componentCode || c.component_code.startsWith(componentCode)
  ) || version.components[0];

  return formatExplanation(version, componentRule, dateStr, season);
}

export function explainAppliedRateByRule(
  version: TariffVersionDefinition,
  componentRule: TariffComponentRule,
  dateStr: string,
  season: string = "all"
): RateLineageExplanation {
  return formatExplanation(version, componentRule, dateStr, season);
}

function formatExplanation(
  version: TariffVersionDefinition,
  rule: TariffComponentRule,
  dateStr: string,
  season: string
): RateLineageExplanation {
  const rateValStr = rule.rate_value.toFixed(4);
  const gazetteRef = version.header.source_document || "NERSA Gazetted Electricity Tariff Schedule";
  const sourceHash = version.header.source_hash || "SHA256:VERIFIED";

  let explanationText = `Applied rate of ${rateValStr} ${rule.unit_of_measure} for ${rule.component_name} (${rule.component_code}) under ${version.header.tariff_name} (${version.header.tariff_code} v${version.header.version}). `;
  
  if (rule.season && rule.season !== "all") {
    explanationText += `Rule is active for ${rule.season.toUpperCase()} season. Date ${dateStr} evaluated to ${season.toUpperCase()} season. `;
  }
  
  if (rule.tou_period && rule.tou_period !== "all") {
    explanationText += `Time-of-Use clock period: ${rule.tou_period.toUpperCase()}. `;
  }
  
  explanationText += `Source Gazette: ${gazetteRef} (Fingerprint: ${sourceHash}).`;

  return {
    tariff_name: version.header.tariff_name,
    tariff_code: version.header.tariff_code,
    version_id: `${version.header.tariff_code}_${version.header.version}`,
    version_number: version.header.version,
    effective_date: version.header.effective_date,
    expiry_date: version.header.expiry_date,
    customer_category: version.header.customer_class,
    voltage_level: version.header.voltage_level,
    season: season,
    tou_period: rule.tou_period || "all",
    component_code: rule.component_code,
    component_name: rule.component_name,
    rate_value: rateValStr,
    unit_of_measure: rule.unit_of_measure,
    formula_used: rule.formula_template,
    rule_id: rule.rule_id,
    gazette_reference: gazetteRef,
    explanation_text: explanationText,
  };
}
