/**
 * Meter Validation Engine
 * Prevents impossible configurations, invalid ratio parameters,
 * overlapping effective date ranges, and invalid meter metadata.
 */

import type { MeterConfigurationRecord, MeterRecord } from "./types";

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export class MeterValidationEngine {
  /**
   * Validate a proposed Meter Configuration Record
   */
  public static validateConfiguration(
    config: Partial<MeterConfigurationRecord>,
    existingConfigs: MeterConfigurationRecord[] = [],
  ): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. CT Ratio validation
    if (!config.ct_ratio_numerator || config.ct_ratio_numerator <= 0) {
      issues.push({
        code: "INVALID_CT_NUMERATOR",
        field: "ct_ratio_numerator",
        message: "CT ratio primary numerator must be a positive number greater than 0 (e.g. 200).",
        severity: "error",
      });
    }

    if (!config.ct_ratio_denominator || config.ct_ratio_denominator <= 0) {
      issues.push({
        code: "INVALID_CT_DENOMINATOR",
        field: "ct_ratio_denominator",
        message: "CT ratio secondary denominator must be a positive number greater than 0 (e.g. 5).",
        severity: "error",
      });
    }

    // 2. VT Ratio validation
    if (!config.vt_ratio_numerator || config.vt_ratio_numerator <= 0) {
      issues.push({
        code: "INVALID_VT_NUMERATOR",
        field: "vt_ratio_numerator",
        message: "VT ratio primary numerator must be a positive number greater than 0 (e.g. 11000).",
        severity: "error",
      });
    }

    if (!config.vt_ratio_denominator || config.vt_ratio_denominator <= 0) {
      issues.push({
        code: "INVALID_VT_DENOMINATOR",
        field: "vt_ratio_denominator",
        message: "VT ratio secondary denominator must be a positive number greater than 0 (e.g. 110).",
        severity: "error",
      });
    }

    // 3. Scaling factors
    if (!config.pulse_scaling || config.pulse_scaling <= 0) {
      issues.push({
        code: "INVALID_PULSE_SCALING",
        field: "pulse_scaling",
        message: "Pulse scaling factor must be greater than 0.",
        severity: "error",
      });
    }

    if (!config.register_scaling || config.register_scaling <= 0) {
      issues.push({
        code: "INVALID_REGISTER_SCALING",
        field: "register_scaling",
        message: "Register scaling factor must be greater than 0.",
        severity: "error",
      });
    }

    // 4. Multiplier source
    if (!config.multiplier_source || config.multiplier_source.trim().length === 0) {
      issues.push({
        code: "MISSING_MULTIPLIER_SOURCE",
        field: "multiplier_source",
        message: "A traceable multiplier source (e.g. 'Nameplate Verification', 'Calibration Cert #104') is required.",
        severity: "error",
      });
    }

    // 5. Effective dates sequence
    if (!config.effective_start_date) {
      issues.push({
        code: "MISSING_EFFECTIVE_START",
        field: "effective_start_date",
        message: "Effective start date is required.",
        severity: "error",
      });
    }

    if (config.effective_start_date && config.effective_end_date) {
      if (new Date(config.effective_end_date) < new Date(config.effective_start_date)) {
        issues.push({
          code: "INVALID_DATE_SEQUENCE",
          field: "effective_end_date",
          message: "Effective end date cannot precede the effective start date.",
          severity: "error",
        });
      }
    }

    // 6. Overlapping Date Range Validation against existing configurations
    if (config.effective_start_date) {
      const newStart = new Date(config.effective_start_date).getTime();
      const newEnd = config.effective_end_date
        ? new Date(config.effective_end_date).getTime()
        : Infinity;

      for (const existing of existingConfigs) {
        // Skip comparing against self when editing an existing version
        if (config.id && existing.id === config.id) continue;
        if (config.version_number && existing.version_number === config.version_number) continue;

        const existStart = new Date(existing.effective_start_date).getTime();
        const existEnd = existing.effective_end_date
          ? new Date(existing.effective_end_date).getTime()
          : Infinity;

        // Check date range intersection: max(start1, start2) <= min(end1, end2)
        const overlapStart = Math.max(newStart, existStart);
        const overlapEnd = Math.min(newEnd, existEnd);

        if (overlapStart <= overlapEnd) {
          issues.push({
            code: "OVERLAPPING_CONFIGURATION_DATES",
            field: "effective_start_date",
            message: `Effective date range (${config.effective_start_date} to ${
              config.effective_end_date || "active"
            }) overlaps with existing Configuration Version #${existing.version_number} (${
              existing.effective_start_date
            } to ${existing.effective_end_date || "active"}).`,
            severity: "error",
          });
          break;
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validate Meter Master-Data Record
   */
  public static validateMeter(meter: Partial<MeterRecord>): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (!meter.serial_number || meter.serial_number.trim().length === 0) {
      issues.push({
        code: "MISSING_SERIAL_NUMBER",
        field: "serial_number",
        message: "Meter serial number is required.",
        severity: "error",
      });
    }

    if (!meter.installation_date) {
      issues.push({
        code: "MISSING_INSTALLATION_DATE",
        field: "installation_date",
        message: "Installation date is required.",
        severity: "error",
      });
    }

    if (meter.installation_date && meter.removal_date) {
      if (new Date(meter.removal_date) < new Date(meter.installation_date)) {
        issues.push({
          code: "INVALID_REMOVAL_DATE",
          field: "removal_date",
          message: "Removal date cannot be earlier than installation date.",
          severity: "error",
        });
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
