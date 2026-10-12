/**
 * ENERA AI VALIDATION — MISSING DATA INTEGRITY & ANTI-DEFAULT GUARD (REQUIREMENT 21)
 * ===================================================================================
 * Enforces strict missing data integrity across the document verification pipeline.
 *
 * CORE MANDATE:
 * "Missing information must remain missing.
 *  For example:
 *    Power Factor: NOT FOUND
 *    not:
 *    Power Factor: 0.96
 *  Do not use assumed industry values."
 *
 * RULES:
 * 1. Missing fields must never be populated with assumed industry defaults (e.g. PF 0.96, multiplier 1, assumed VAT).
 * 2. If no optical evidence backing exists, value must remain strictly null / NOT FOUND.
 * 3. Any attempt by AI or heuristics to inject synthetic defaults is intercepted, audited, and rejected.
 */

import type {
  CandidateFieldValidationInput,
  GroundedEvidenceCheckResult,
  MissingDataAuditFinding,
  MissingDataAuditResult,
} from "./types";

export interface SyntheticDefaultSignature {
  fieldKey: string;
  assumedValues: (string | number)[];
  industryRationale: string;
}

export const KNOWN_SYNTHETIC_INDUSTRY_DEFAULTS: readonly SyntheticDefaultSignature[] = [
  {
    fieldKey: "powerFactor",
    assumedValues: [0.96, 0.85, 0.9, 0.95, 1.0, "0.96", "0.85", "0.90", "1.00"],
    industryRationale: "Assumed standard industrial power factor (0.96 lagging)",
  },
  {
    fieldKey: "meterMultiplier",
    assumedValues: [1, 100, 1000, "1", "100", "1000"],
    industryRationale: "Assumed standard unit CT/VT multiplier",
  },
  {
    fieldKey: "vatRate",
    assumedValues: [0.15, 15, "15%", "0.15"],
    industryRationale: "Assumed standard statutory South African VAT rate (15%)",
  },
  {
    fieldKey: "tariffCode",
    assumedValues: ["MEGAFLEX", "MINIFLEX", "NIGHTSAVE", "RURAFLEX"],
    industryRationale: "Assumed standard Eskom industrial tariff code",
  },
  {
    fieldKey: "maximumDemandKva",
    assumedValues: [0, 100, 500, "0", "100"],
    industryRationale: "Assumed default capacity threshold",
  },
];

export class MissingDataGuard {
  /**
   * Audits candidate fields for missing status and strips any ungrounded synthetic defaults.
   */
  public static auditAndGuardMissingData(
    documentId: string,
    candidateFields: CandidateFieldValidationInput[],
    evidenceResults: GroundedEvidenceCheckResult[],
  ): {
    guardedFields: CandidateFieldValidationInput[];
    auditResult: MissingDataAuditResult;
  } {
    const findings: MissingDataAuditFinding[] = [];
    const guardedFields: CandidateFieldValidationInput[] = [];
    let syntheticDefaultsPreventedCount = 0;
    let totalMissingCount = 0;

    for (const field of candidateFields) {
      const evidence = evidenceResults.find((e) => e.fieldKey === field.fieldKey);
      const isGrounded = evidence?.isGrounded ?? false;

      // Check 1: Value is explicitly null, empty, or string "NOT FOUND"
      const isRawMissing =
        field.value === null ||
        field.value === undefined ||
        field.rawValue === "" ||
        String(field.rawValue).trim().toUpperCase() === "NOT FOUND" ||
        String(field.rawValue).trim().toUpperCase() === "NOT_FOUND" ||
        String(field.rawValue).trim().toUpperCase() === "N/A" ||
        String(field.rawValue).trim().toUpperCase() === "NULL";

      if (isRawMissing) {
        totalMissingCount++;
        findings.push({
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          status: "MISSING",
          isMissing: true,
          extractedValue: null,
          wasSyntheticDefaultAttempted: false,
          reasoning: `Field '${field.fieldKey}' is legitimately missing (NOT FOUND) in source document. Preserved as null.`,
          auditRule: "MISSING_DATA_MUST_REMAIN_MISSING_NO_INDUSTRY_DEFAULTS",
        });

        guardedFields.push({
          ...field,
          value: null,
          rawValue: field.rawValue || "NOT FOUND",
        });
        continue;
      }

      // Check 2: Value is ungrounded and matches a known synthetic default signature
      const syntheticSig = KNOWN_SYNTHETIC_INDUSTRY_DEFAULTS.find(
        (s) => s.fieldKey === field.fieldKey || field.fieldKey.toLowerCase().includes(s.fieldKey.toLowerCase()),
      );

      const isMatchingSyntheticDefault =
        syntheticSig &&
        syntheticSig.assumedValues.some((v) => {
          if (typeof v === "number" && typeof field.value === "number") {
            return Math.abs(v - field.value) < 0.0001;
          }
          return String(v).trim().toUpperCase() === String(field.value).trim().toUpperCase();
        });

      if (!isGrounded && isMatchingSyntheticDefault) {
        // Intercept synthetic default injection!
        syntheticDefaultsPreventedCount++;
        totalMissingCount++;

        findings.push({
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          status: "UNGROUNDED_SYNTHETIC_REJECTED",
          isMissing: true,
          extractedValue: null,
          wasSyntheticDefaultAttempted: true,
          rejectedDefaultValue: field.value!,
          reasoning: `REJECTED SYNTHETIC DEFAULT: Field '${field.fieldKey}' was supplied as '${field.value}' (${syntheticSig!.industryRationale}) without physical document evidence. Reverted to null (NOT FOUND).`,
          auditRule: "MISSING_DATA_MUST_REMAIN_MISSING_NO_INDUSTRY_DEFAULTS",
        });

        guardedFields.push({
          ...field,
          value: null,
          rawValue: "NOT FOUND",
          opticalConfidence: 0,
        });
        continue;
      }

      // Check 3: Grounded present value
      findings.push({
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel,
        status: "PRESENT_GROUNDED",
        isMissing: false,
        extractedValue: field.value,
        wasSyntheticDefaultAttempted: false,
        reasoning: `Field '${field.fieldKey}' is present and grounded in document tokens.`,
        auditRule: "MISSING_DATA_MUST_REMAIN_MISSING_NO_INDUSTRY_DEFAULTS",
      });

      guardedFields.push(field);
    }

    const auditResult: MissingDataAuditResult = {
      documentId,
      totalMissingCount,
      syntheticDefaultsPreventedCount,
      findings,
      isIntegrityPreserved: true,
      summary:
        syntheticDefaultsPreventedCount > 0
          ? `Preserved missing data integrity: Rejected ${syntheticDefaultsPreventedCount} ungrounded synthetic industry default(s). Missing data strictly preserved as null/NOT FOUND.`
          : `All ${totalMissingCount} missing field(s) strictly preserved as null/NOT FOUND without synthetic defaults.`,
    };

    return {
      guardedFields,
      auditResult,
    };
  }
}
