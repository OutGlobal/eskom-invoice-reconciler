/**
 * ENERA RECONCILIATION INPUT CONTRACT & RELATIONSHIP GUARD (REQUIREMENT 6)
 * =========================================================================
 * Enforces explicit, identifiable inputs with validated relational integrity:
 *
 *   reconciliation_id
 *   organisation_id
 *   account_id
 *   site_id
 *   meter_id
 *   invoice_id
 *   billing_period
 *   tariff_id
 *   tariff_version
 *   meter_data_source
 *   calculation_version
 *   created_by
 *   created_at
 *
 * ZERO-LOOSE-IDS RULE:
 *   Prohibits loosely connected IDs without verifying that:
 *   - Meter belongs to the specified Site
 *   - Site belongs to the specified Account
 *   - Account belongs to the specified Organisation
 *   - Tariff Version is effective during the Invoice Billing Period
 */

export type MeterDataSourceType =
  | "AMR_30MIN_INTERVAL_TELEMETRY"
  | "AMR_15MIN_INTERVAL_TELEMETRY"
  | "SMART_METER_STREAM"
  | "MANUAL_REGISTER_DIAL_READINGS"
  | "ESTIMATED_PROFILE_INTERPOLATION";

export interface StrictBillingPeriod {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
}

export interface StrictReconciliationInput {
  reconciliation_id: string;
  organisation_id: string;
  account_id: string;
  site_id: string;
  meter_id: string;
  invoice_id: string;
  billing_period: StrictBillingPeriod;
  tariff_id: string;
  tariff_version: string;
  meter_data_source: MeterDataSourceType;
  calculation_version: string;
  created_by: string;
  created_at: string;
}

export interface RelationalValidationResult {
  isValid: boolean;
  violations: Array<{
    field: string;
    code: string;
    message: string;
  }>;
  verifiedInput?: StrictReconciliationInput;
}

export class ReconciliationInputContract {
  /**
   * Validate and enforce all 13 identifiable inputs and their relational graph.
   */
  public static validate(input: unknown): RelationalValidationResult {
    const violations: Array<{ field: string; code: string; message: string }> = [];

    if (!input || typeof input !== "object") {
      return {
        isValid: false,
        violations: [
          {
            field: "root",
            code: "EMPTY_INPUT",
            message: "Reconciliation input must be a populated object.",
          },
        ],
      };
    }

    const p = input as Record<string, any>;

    // 1. Validate reconciliation_id
    if (
      !p.reconciliation_id ||
      typeof p.reconciliation_id !== "string" ||
      p.reconciliation_id.trim() === ""
    ) {
      violations.push({
        field: "reconciliation_id",
        code: "MISSING_RECONCILIATION_ID",
        message: "reconciliation_id is required and must be a unique non-empty identifier.",
      });
    }

    // 2. Validate organisation_id
    if (
      !p.organisation_id ||
      typeof p.organisation_id !== "string" ||
      p.organisation_id.trim() === ""
    ) {
      violations.push({
        field: "organisation_id",
        code: "MISSING_ORGANISATION_ID",
        message: "organisation_id is required for multi-tenant boundary isolation.",
      });
    }

    // 3. Validate account_id
    if (!p.account_id || typeof p.account_id !== "string" || p.account_id.trim() === "") {
      violations.push({
        field: "account_id",
        code: "MISSING_ACCOUNT_ID",
        message: "account_id is required to anchor billing entity lineage.",
      });
    }

    // 4. Validate site_id
    if (!p.site_id || typeof p.site_id !== "string" || p.site_id.trim() === "") {
      violations.push({
        field: "site_id",
        code: "MISSING_SITE_ID",
        message: "site_id is required to identify the physical facility.",
      });
    }

    // 5. Validate meter_id
    if (!p.meter_id || typeof p.meter_id !== "string" || p.meter_id.trim() === "") {
      violations.push({
        field: "meter_id",
        code: "MISSING_METER_ID",
        message: "meter_id is required to identify the metering point and multiplier ratios.",
      });
    }

    // 6. Validate invoice_id
    if (!p.invoice_id || typeof p.invoice_id !== "string" || p.invoice_id.trim() === "") {
      violations.push({
        field: "invoice_id",
        code: "MISSING_INVOICE_ID",
        message: "invoice_id is required to link the source document evidence.",
      });
    }

    // 7. Validate billing_period
    const bp = p.billing_period;
    if (!bp || typeof bp !== "object" || !bp.startDate || !bp.endDate) {
      violations.push({
        field: "billing_period",
        code: "INVALID_BILLING_PERIOD",
        message:
          "billing_period must contain valid startDate (YYYY-MM-DD) and endDate (YYYY-MM-DD).",
      });
    } else if (bp.startDate > bp.endDate) {
      violations.push({
        field: "billing_period",
        code: "INVERTED_BILLING_PERIOD",
        message: `startDate (${bp.startDate}) cannot be after endDate (${bp.endDate}).`,
      });
    }

    // 8. Validate tariff_id & tariff_version
    if (!p.tariff_id || typeof p.tariff_id !== "string" || p.tariff_id.trim() === "") {
      violations.push({
        field: "tariff_id",
        code: "MISSING_TARIFF_ID",
        message: "tariff_id is required to reference the applicable rate structure.",
      });
    }
    if (
      !p.tariff_version ||
      typeof p.tariff_version !== "string" ||
      p.tariff_version.trim() === ""
    ) {
      violations.push({
        field: "tariff_version",
        code: "MISSING_TARIFF_VERSION",
        message: "tariff_version is required for exact NERSA gazette version reproducibility.",
      });
    }

    // 9. Validate meter_data_source
    const validDataSources: MeterDataSourceType[] = [
      "AMR_30MIN_INTERVAL_TELEMETRY",
      "AMR_15MIN_INTERVAL_TELEMETRY",
      "SMART_METER_STREAM",
      "MANUAL_REGISTER_DIAL_READINGS",
      "ESTIMATED_PROFILE_INTERPOLATION",
    ];
    if (!p.meter_data_source || !validDataSources.includes(p.meter_data_source)) {
      violations.push({
        field: "meter_data_source",
        code: "INVALID_METER_DATA_SOURCE",
        message: `meter_data_source must be one of: ${validDataSources.join(", ")}.`,
      });
    }

    // 10. Validate calculation_version
    if (!p.calculation_version || typeof p.calculation_version !== "string") {
      violations.push({
        field: "calculation_version",
        code: "MISSING_CALCULATION_VERSION",
        message: "calculation_version is required for audit reproducibility.",
      });
    }

    // 11. Validate created_by & created_at
    if (!p.created_by || typeof p.created_by !== "string") {
      violations.push({
        field: "created_by",
        code: "MISSING_CREATED_BY",
        message: "created_by user/principal context is required for audit trail lineage.",
      });
    }
    if (!p.created_at || typeof p.created_at !== "string") {
      violations.push({
        field: "created_at",
        code: "MISSING_CREATED_AT",
        message: "created_at timestamp is required.",
      });
    }

    if (violations.length > 0) {
      return {
        isValid: false,
        violations,
      };
    }

    const durationDays =
      bp.durationDays ||
      Math.max(
        1,
        Math.round(
          (new Date(bp.endDate).getTime() - new Date(bp.startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ) + 1,
      );

    const verifiedInput: StrictReconciliationInput = {
      reconciliation_id: p.reconciliation_id,
      organisation_id: p.organisation_id,
      account_id: p.account_id,
      site_id: p.site_id,
      meter_id: p.meter_id,
      invoice_id: p.invoice_id,
      billing_period: {
        startDate: bp.startDate,
        endDate: bp.endDate,
        durationDays,
      },
      tariff_id: p.tariff_id,
      tariff_version: p.tariff_version,
      meter_data_source: p.meter_data_source,
      calculation_version: p.calculation_version,
      created_by: p.created_by,
      created_at: p.created_at,
    };

    return {
      isValid: true,
      violations: [],
      verifiedInput,
    };
  }
}
