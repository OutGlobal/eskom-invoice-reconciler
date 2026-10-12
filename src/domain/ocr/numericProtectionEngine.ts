/**
 * ENERA PRODUCTION OCR ENGINE — NUMERIC PROTECTION & DECIMAL VALIDATION ENGINE
 * ==============================================================================
 * Requirements 15 & 16:
 *
 * 15. NUMERIC PROTECTION:
 * Utility invoices contain critical numbers. OCR must carefully preserve:
 *   - account numbers
 *   - meter numbers
 *   - invoice numbers
 *   - dates
 *   - kWh (Active Energy)
 *   - kVA (Apparent Power / Maximum Demand)
 *   - kVAh (Apparent Energy)
 *   - kVArh (Reactive Energy)
 *   - demand (kW / kVA Peak Demand)
 *   - power factor (strictly 0.00 to 1.00)
 *   - tariffs (codes & structures)
 *   - rates (c/kWh, R/kVA, R/day)
 *   - amounts (subtotals, charges, levies)
 *   - VAT (rate & amount)
 *   - totals (total due, total payable)
 *
 * Explicit Protection:
 *   - "R 12 345.67" must NOT become "R 1234567" without detection!
 *   - "12.50" must NOT silently become "1250"!
 *   - Never silently rewrite values — preserve original OCR strings immutably.
 *
 * 16. DECIMAL VALIDATION:
 * Validation checks around:
 *   - decimal separators ('.' and ',')
 *   - thousands separators (space ' ', comma ',', dot '.', apostrophe ''')
 *   - currency formatting (R, ZAR, cents, $, €, £)
 *   - negative numbers (leading minus, trailing minus, parentheses, CR/DR)
 *   - percentages (15%, 15.00%, 14%, 0%)
 *   - units (kWh, kVA, kVAh, kVArh, c/kWh, R/kVA, etc.)
 *   - dates (SA and international formats)
 *
 * Supports common South African formatting patterns without hard-coding
 * assumptions that would prevent valid international documents from being processed.
 */

import type {
  DecimalSeparatorType,
  DocumentLocaleProfile,
  NegativeNumberFormat,
  NumericFieldCategory,
  OcrConfidenceTier,
  OcrDetectedError,
  OcrErrorType,
  ParsedNumericField,
  ScaleShiftDetection,
  ThousandsSeparatorType,
  ValidatedDateField,
} from "./types";

// ---------------------------------------------------------------------------
// Built-in Locale Profiles
// ---------------------------------------------------------------------------

export const SOUTH_AFRICA_LOCALE_PROFILE: DocumentLocaleProfile = {
  name: "SOUTH_AFRICA_DEFAULT",
  currencySymbols: ["R", "ZAR", "c", "cents"],
  decimalSeparators: [".", ","], // English uses '.', Afrikaans/Municipal uses ','
  thousandsSeparators: [" ", ",", "."], // SABS standard is space; commercial bills use ',' or space
  standardVatPercentage: 15.0,
  dateFormatOrder: "AUTO", // Supports YMD (2026-03-31) and DMY (31/03/2026)
};

export const INTERNATIONAL_ANGLO_LOCALE_PROFILE: DocumentLocaleProfile = {
  name: "INTERNATIONAL_ANGLO",
  currencySymbols: ["$", "USD", "£", "GBP", "C$", "A$"],
  decimalSeparators: ["."],
  thousandsSeparators: [",", " "],
  standardVatPercentage: 20.0,
  dateFormatOrder: "MDY",
};

export const INTERNATIONAL_CONTINENTAL_LOCALE_PROFILE: DocumentLocaleProfile = {
  name: "INTERNATIONAL_CONTINENTAL",
  currencySymbols: ["€", "EUR", "kr"],
  decimalSeparators: [","],
  thousandsSeparators: [".", " "],
  standardVatPercentage: 19.0,
  dateFormatOrder: "DMY",
};

export const INTERNATIONAL_SWISS_LOCALE_PROFILE: DocumentLocaleProfile = {
  name: "INTERNATIONAL_SWISS",
  currencySymbols: ["CHF"],
  decimalSeparators: ["."],
  thousandsSeparators: ["'", " "],
  standardVatPercentage: 8.1,
  dateFormatOrder: "DMY",
};

export const AUTO_DETECT_LOCALE_PROFILE: DocumentLocaleProfile = {
  name: "AUTO_DETECT",
  currencySymbols: ["R", "ZAR", "c", "$", "USD", "€", "EUR", "£", "GBP", "CHF"],
  decimalSeparators: [".", ","],
  thousandsSeparators: [" ", ",", ".", "'"],
  dateFormatOrder: "AUTO",
};

// ---------------------------------------------------------------------------
// Standard Valid Utility Units
// ---------------------------------------------------------------------------

export const VALID_UTILITY_UNITS: Record<string, string[]> = {
  ENERGY: ["kwh", "kwh", "mwh", "gwh", "wh"],
  POWER_DEMAND: ["kva", "mva", "kw", "mw"],
  APPARENT_ENERGY: ["kvah", "mvah"],
  REACTIVE_ENERGY: ["kvarh", "mvarh"],
  RATES: [
    "c/kwh",
    "cents/kwh",
    "r/kva",
    "r/kw",
    "r/day",
    "r/month",
    "$/kwh",
    "€/kwh",
    "c/kva",
    "r/kwh",
  ],
  POWER_FACTOR: ["pf", "cos phi", "cos φ", "lag", "lead"],
  PERCENT: ["%", "percent"],
};

export interface NumericParseOptions {
  localeProfile?: DocumentLocaleProfile;
  expectedUnit?: string;
  expectedDecimalPlaces?: number;
  baselineComparisonValue?: number; // e.g., previous month or subtotal for scale shift detection
  pageNumber?: number;
  baseConfidence?: number;
}

export interface DateParseOptions {
  localeProfile?: DocumentLocaleProfile;
  pageNumber?: number;
  baseConfidence?: number;
}

export class NumericProtectionEngine {
  /**
   * Main entry point for parsing, validating, and protecting numeric fields.
   * STRICT GUARANTEE: Never silently rewrites the original OCR string.
   */
  public static parseAndProtectNumeric(
    raw: string,
    category: NumericFieldCategory,
    options: NumericParseOptions = {},
  ): ParsedNumericField {
    const originalRaw = raw;
    const trimmed = (raw || "").trim();
    const pageNumber = options.pageNumber ?? 1;
    const baseConfidence = options.baseConfidence ?? 95.0;
    const profile = options.localeProfile ?? SOUTH_AFRICA_LOCALE_PROFILE;

    const validationErrors: OcrDetectedError[] = [];
    const reviewReasons: string[] = [];

    // Handle non-numeric identifier categories directly
    if (category === "ACCOUNT_NUMBER") {
      return this.protectAccountNumber(originalRaw, pageNumber, baseConfidence);
    }
    if (category === "METER_NUMBER") {
      return this.protectMeterNumber(originalRaw, pageNumber, baseConfidence);
    }
    if (category === "INVOICE_NUMBER") {
      return this.protectInvoiceNumber(originalRaw, pageNumber, baseConfidence);
    }
    if (category === "TARIFF") {
      return this.protectTariff(originalRaw, pageNumber, baseConfidence);
    }

    if (!trimmed) {
      return {
        category,
        originalRaw,
        normalizedText: "",
        numericValue: null,
        isNegative: false,
        negativeFormat: "NONE",
        isPercentage: false,
        decimalSeparator: "NONE",
        thousandsSeparator: "NONE",
        scaleShift: {
          detected: false,
          originalOcrValue: originalRaw,
          reason: "Empty value",
          severity: "LOW",
        },
        validationErrors: [],
        isValid: false,
        confidenceScore: 0,
        confidenceTier: "LOW",
        reviewRequired: true,
        reviewReasons: ["Numeric field is empty or missing."],
      };
    }

    // 1. Extract Negative Number Notation
    const negResult = this.extractNegativeFormat(trimmed);
    let workingStr = negResult.cleanStr;
    const isNegative = negResult.isNegative;
    const negativeFormat = negResult.format;

    // 2. Extract Currency Formatting
    const currResult = this.extractCurrencyAndClean(workingStr, profile);
    workingStr = currResult.cleanStr;
    const currencySymbol = currResult.currencySymbol;
    const currencyIsoCode = currResult.currencyIsoCode;

    // 3. Extract Percentage Formatting
    const percResult = this.extractPercentage(workingStr);
    workingStr = percResult.cleanStr;
    const isPercentage = percResult.isPercentage || (category === "VAT" && trimmed.includes("%"));
    const percentageValue = percResult.percentageValue;

    // 4. Extract Unit Specification
    const unitResult = this.extractUnit(workingStr, category);
    workingStr = unitResult.cleanStr;
    const unit = unitResult.unit || options.expectedUnit;

    if (!unitResult.isValidUnit && unitResult.detectedToken) {
      validationErrors.push({
        errorId: `err-unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "INVALID_UNIT_SPECIFICATION",
        originalOcrValue: originalRaw,
        fieldKey: category,
        pageNumber,
        potentialError: `Unrecognized or corrupted unit token '${unitResult.detectedToken}' in ${category} field.`,
        validationResult: "Unit validation failed: not in standard utility dictionary.",
        confidencePenalty: 15,
        severity: "MEDIUM",
        reviewRequired: true,
      });
    }

    // 5. Parse Decimal and Thousands Separators
    const sepResult = this.validateSeparators(workingStr, profile);
    validationErrors.push(...sepResult.errors);

    let parsedNumber: number | null = null;
    if (sepResult.cleanedNumericString) {
      const parsed = parseFloat(sepResult.cleanedNumericString);
      if (!isNaN(parsed)) {
        parsedNumber = isNegative ? -Math.abs(parsed) : parsed;
      }
    }

    // 6. Scale Shift & Dropped Decimal Protection
    const scaleShift = this.detectScaleShift(
      originalRaw,
      category,
      parsedNumber,
      sepResult.decimalSeparator,
      {
        expectedDecimalPlaces: options.expectedDecimalPlaces,
        baselineValue: options.baselineComparisonValue,
        currencySymbol,
        unit,
      },
    );

    if (scaleShift.detected) {
      validationErrors.push({
        errorId: `err-scaleshift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "SCALE_SHIFT_DROPPED_DECIMAL",
        originalOcrValue: originalRaw,
        fieldKey: category,
        pageNumber,
        potentialError: scaleShift.reason,
        validationResult: `Numeric protection triggered: ${scaleShift.shiftFactor ?? "Unknown"}x scale shift detected.`,
        suggestedCandidate: scaleShift.candidateCorrectedValue,
        confidencePenalty: 35,
        severity: scaleShift.severity,
        reviewRequired: true,
      });
    }

    // 7. Domain Specific Bounds Checks
    // Power factor validation: 0.00 <= PF <= 1.00
    if (category === "POWER_FACTOR" && parsedNumber !== null) {
      const pfCheck = this.validatePowerFactor(parsedNumber, originalRaw, pageNumber);
      if (!pfCheck.isValid && pfCheck.error) {
        validationErrors.push(pfCheck.error);
      }
    }

    // Percentage validation (e.g. VAT rate 15% standard in SA, 14% historical, 0% zero-rated)
    if (
      (category === "VAT" || isPercentage) &&
      (percentageValue !== undefined || parsedNumber !== null)
    ) {
      const checkVal = percentageValue ?? parsedNumber;
      if (checkVal !== null && (checkVal < 0 || checkVal > 100)) {
        validationErrors.push({
          errorId: `err-perc-bounds-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          errorType: "PERCENTAGE_OUT_OF_BOUNDS",
          originalOcrValue: originalRaw,
          fieldKey: category,
          pageNumber,
          potentialError: `Percentage value ${checkVal}% is outside logical bounds [0, 100%].`,
          validationResult: "Percentage integrity check failed.",
          suggestedCandidate:
            checkVal > 100 && checkVal % 100 === 0 ? `${checkVal / 100}%` : undefined,
          confidencePenalty: 25,
          severity: "HIGH",
          reviewRequired: true,
        });
      }
    }

    // Calculate final confidence and reliability
    let totalPenalty = 0;
    for (const err of validationErrors) {
      totalPenalty += err.confidencePenalty;
    }
    const confidenceScore = Math.max(
      0,
      Math.min(100, Number((baseConfidence - totalPenalty).toFixed(2))),
    );
    const confidenceTier: OcrConfidenceTier =
      confidenceScore >= 85 ? "HIGH" : confidenceScore >= 70 ? "MEDIUM" : "LOW";

    const hasCriticalError = validationErrors.some(
      (e) => e.severity === "CRITICAL" || e.severity === "HIGH",
    );
    const isValid = parsedNumber !== null && !hasCriticalError && !scaleShift.detected;
    const reviewRequired =
      !isValid || confidenceTier !== "HIGH" || scaleShift.detected || validationErrors.length > 0;

    if (scaleShift.detected) {
      reviewReasons.push(`Scale shift protection: ${scaleShift.reason}`);
    }
    for (const err of validationErrors) {
      if (err.reviewRequired && !reviewReasons.includes(err.potentialError)) {
        reviewReasons.push(err.potentialError);
      }
    }

    const primaryCandidate = validationErrors.find((e) => e.suggestedCandidate)?.suggestedCandidate;

    return {
      category,
      originalRaw,
      normalizedText: sepResult.cleanedNumericString || originalRaw,
      numericValue: parsedNumber,
      isNegative,
      negativeFormat,
      isPercentage,
      percentageValue,
      currencySymbol,
      currencyIsoCode,
      unit,
      decimalSeparator: sepResult.decimalSeparator,
      thousandsSeparator: sepResult.thousandsSeparator,
      scaleShift,
      validationErrors,
      isValid,
      confidenceScore,
      confidenceTier,
      reviewRequired,
      reviewReasons,
      suggestedCandidate: primaryCandidate,
    };
  }

  // ---------------------------------------------------------------------------
  // Date Parsing & Validation (Requirement 16)
  // ---------------------------------------------------------------------------

  /**
   * Validates dates across South African and International patterns.
   * Supported patterns:
   *   SA/ISO: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, DD MMM YYYY, YYYYMMDD
   *   International: MM/DD/YYYY, MMM DD, YYYY
   */
  public static parseAndValidateDate(
    raw: string,
    options: DateParseOptions = {},
  ): ValidatedDateField {
    const originalRaw = raw;
    const trimmed = (raw || "").trim();
    const pageNumber = options.pageNumber ?? 1;
    const validationErrors: OcrDetectedError[] = [];

    if (!trimmed) {
      return {
        originalRaw,
        isoDate: null,
        formatDetected: "EMPTY",
        localePattern: "UNKNOWN",
        isValidDate: false,
        validationErrors: [],
        reviewRequired: true,
      };
    }

    let isoDate: string | null = null;
    let formatDetected = "UNKNOWN";
    let localePattern: "SOUTH_AFRICAN" | "INTERNATIONAL" | "UNKNOWN" = "UNKNOWN";
    let candidate: string | undefined;

    // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      formatDetected = "YYYY-MM-DD";
      localePattern = "SOUTH_AFRICAN"; // Also international standard
      if (this.isCalendarValid(year, month, day)) {
        isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      } else {
        validationErrors.push({
          errorId: `err-date-cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          errorType: "DATE_CORRUPTION",
          originalOcrValue: originalRaw,
          fieldKey: "DATE",
          pageNumber,
          potentialError: `Invalid calendar date components: Year=${year}, Month=${month}, Day=${day}.`,
          validationResult: "Calendar integrity validation failed.",
          confidencePenalty: 30,
          severity: "HIGH",
          reviewRequired: true,
        });
      }
    }

    // 2. Day-first format: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
    if (!isoDate && !formatDetected.startsWith("YYYY")) {
      const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (dmyMatch) {
        const first = parseInt(dmyMatch[1], 10);
        const second = parseInt(dmyMatch[2], 10);
        const year = parseInt(dmyMatch[3], 10);

        // Disambiguate DMY (SA/UK/EU standard) vs MDY (US)
        if (first > 12 && second <= 12) {
          // Unambiguously Day-Month-Year
          formatDetected = "DD/MM/YYYY";
          localePattern = "SOUTH_AFRICAN";
          if (this.isCalendarValid(year, second, first)) {
            isoDate = `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
          }
        } else if (second > 12 && first <= 12) {
          // Unambiguously Month-Day-Year (US International)
          formatDetected = "MM/DD/YYYY";
          localePattern = "INTERNATIONAL";
          if (this.isCalendarValid(year, first, second)) {
            isoDate = `${year}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
          }
        } else {
          // Ambiguous: default to DMY for South African documents while recording alternative candidate
          formatDetected = "DD/MM/YYYY";
          localePattern = "SOUTH_AFRICAN";
          if (this.isCalendarValid(year, second, first)) {
            isoDate = `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
            candidate = `${year}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
          }
        }
      }
    }

    // 3. Text Month format: DD MMM YYYY (e.g. "31 Jan 2026", "28 February 2026")
    if (!isoDate) {
      const textMatch = trimmed.match(
        /^(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})$/i,
      );
      if (textMatch) {
        const day = parseInt(textMatch[1], 10);
        const monthStr = textMatch[2].toUpperCase();
        const year = parseInt(textMatch[3], 10);
        const monthMap: Record<string, number> = {
          JAN: 1,
          FEB: 2,
          MAR: 3,
          APR: 4,
          MAY: 5,
          JUN: 6,
          JUL: 7,
          AUG: 8,
          SEP: 9,
          OCT: 10,
          NOV: 11,
          DEC: 12,
        };
        const month = monthMap[monthStr];
        formatDetected = "DD MMM YYYY";
        localePattern = "SOUTH_AFRICAN";
        if (month && this.isCalendarValid(year, month, day)) {
          isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }

    // 4. Compact 8-digit format: YYYYMMDD
    if (!isoDate && /^\d{8}$/.test(trimmed)) {
      const year = parseInt(trimmed.substring(0, 4), 10);
      const month = parseInt(trimmed.substring(4, 6), 10);
      const day = parseInt(trimmed.substring(6, 8), 10);
      if (year >= 1990 && year <= 2099 && this.isCalendarValid(year, month, day)) {
        formatDetected = "YYYYMMDD";
        localePattern = "SOUTH_AFRICAN";
        isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    const isValidDate = isoDate !== null && validationErrors.length === 0;

    return {
      originalRaw,
      isoDate,
      formatDetected,
      localePattern,
      isValidDate,
      validationErrors,
      reviewRequired: !isValidDate,
      suggestedCandidate: candidate || isoDate || undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Scale Shift & Dropped Decimal Protection (Requirement 15)
  // ---------------------------------------------------------------------------

  /**
   * Specifically detects scale shifts caused by dropped decimal separators or OCR omissions:
   * E.g.:
   *   "R 12 345.67" -> "R 1234567" (100x scale shift!)
   *   "12.50"       -> "1250"       (100x scale shift!)
   *   "0.92"        -> "92"         (100x scale shift!)
   */
  public static detectScaleShift(
    raw: string,
    category: NumericFieldCategory,
    parsedNumber: number | null,
    detectedSeparator: DecimalSeparatorType,
    context: {
      expectedDecimalPlaces?: number;
      baselineValue?: number;
      currencySymbol?: string;
      unit?: string;
    } = {},
  ): ScaleShiftDetection {
    const rawTrimmed = (raw || "").trim();

    // 1. Power Factor Scale Shift (PF is strictly 0.00 to 1.00)
    if (category === "POWER_FACTOR" && parsedNumber !== null) {
      if (parsedNumber > 1.0 && parsedNumber <= 100.0) {
        const corrected = (parsedNumber / 100).toFixed(2);
        return {
          detected: true,
          shiftFactor: 100,
          originalOcrValue: raw,
          candidateCorrectedValue: corrected,
          reason: `Power factor value ${parsedNumber} exceeds 1.00; scale shift of 100x detected (likely dropped decimal for ${corrected}).`,
          severity: "CRITICAL",
        };
      }
      if (parsedNumber > 100.0 && parsedNumber <= 1000.0) {
        const corrected = (parsedNumber / 1000).toFixed(3);
        return {
          detected: true,
          shiftFactor: 1000,
          originalOcrValue: raw,
          candidateCorrectedValue: corrected,
          reason: `Power factor value ${parsedNumber} exceeds 1.00; scale shift of 1000x detected (likely dropped decimal for ${corrected}).`,
          severity: "CRITICAL",
        };
      }
    }

    // 2. Financial Amount / Rate / Total Dropped Decimal Protection
    const isFinancial =
      category === "AMOUNT" || category === "TOTAL" || category === "VAT" || category === "RATE";
    if (isFinancial && parsedNumber !== null) {
      // Check if raw value has NO decimal separator at all, but looks like it has cents
      const hasExplicitDecimal = detectedSeparator === "DOT" || detectedSeparator === "COMMA";
      const digitsOnly = rawTrimmed.replace(/[^0-9]/g, "");

      // Case A: Rate like 12.50 becoming 1250
      if (!hasExplicitDecimal && digitsOnly.length >= 3 && digitsOnly.length <= 6) {
        // If it's a tariff rate (typically c/kWh or R/kWh, e.g. 12.50 or 145.23)
        if (category === "RATE" && parsedNumber >= 500) {
          const cand = (parsedNumber / 100).toFixed(2);
          return {
            detected: true,
            shiftFactor: 100,
            originalOcrValue: raw,
            candidateCorrectedValue: cand,
            reason: `Rate value ${rawTrimmed} has no decimal point; 100x scale shift detected (candidate: ${cand}).`,
            severity: "CRITICAL",
          };
        }
      }

      // Case B: Amount or Total like "R 12 345.67" becoming "R 1234567"
      if (!hasExplicitDecimal && digitsOnly.length >= 5) {
        const cand = `${digitsOnly.slice(0, -2)}.${digitsOnly.slice(-2)}`;
        const candFormatted = context.currencySymbol ? `${context.currencySymbol} ${cand}` : cand;
        return {
          detected: true,
          shiftFactor: 100,
          originalOcrValue: raw,
          candidateCorrectedValue: candFormatted,
          reason: `Financial value '${rawTrimmed}' appears as integer without decimal point; 100x scale shift detected (candidate: ${candFormatted}).`,
          severity: "CRITICAL",
        };
      }

      // Case C: Baseline comparison scale shift (e.g. 10x or 100x anomaly vs baseline)
      if (context.baselineValue && context.baselineValue > 0) {
        const ratio = parsedNumber / context.baselineValue;
        if (ratio >= 9.5 && ratio <= 10.5) {
          return {
            detected: true,
            shiftFactor: 10,
            originalOcrValue: raw,
            candidateCorrectedValue: (parsedNumber / 10).toFixed(2),
            reason: `Observed value ${parsedNumber} is ~10x greater than baseline ${context.baselineValue}; scale shift suspected.`,
            severity: "HIGH",
          };
        }
        if (ratio >= 95.0 && ratio <= 105.0) {
          return {
            detected: true,
            shiftFactor: 100,
            originalOcrValue: raw,
            candidateCorrectedValue: (parsedNumber / 100).toFixed(2),
            reason: `Observed value ${parsedNumber} is ~100x greater than baseline ${context.baselineValue}; scale shift suspected.`,
            severity: "CRITICAL",
          };
        }
      }
    }

    return {
      detected: false,
      originalOcrValue: raw,
      reason: "No scale shift detected",
      severity: "LOW",
    };
  }

  // ---------------------------------------------------------------------------
  // Separator Parsing & Validation (Requirement 16)
  // ---------------------------------------------------------------------------

  /**
   * Validates decimal separators (. or ,) and thousands separators (space, comma, dot, apostrophe).
   * Supports South African standards and International standards dynamically.
   */
  public static validateSeparators(
    str: string,
    profile: DocumentLocaleProfile = SOUTH_AFRICA_LOCALE_PROFILE,
  ): {
    decimalSeparator: DecimalSeparatorType;
    thousandsSeparator: ThousandsSeparatorType;
    cleanedNumericString: string | null;
    errors: OcrDetectedError[];
  } {
    const errors: OcrDetectedError[] = [];
    const trimmed = (str || "").trim();

    if (!trimmed) {
      return {
        decimalSeparator: "NONE",
        thousandsSeparator: "NONE",
        cleanedNumericString: null,
        errors,
      };
    }

    let decimalSeparator: DecimalSeparatorType = "NONE";
    let thousandsSeparator: ThousandsSeparatorType = "NONE";

    // Detect if spaces (or non-breaking / thin spaces) are used as thousands separators
    const hasSpaceSeparator = /[\s\u00A0\u202F]/.test(trimmed);
    const hasComma = trimmed.includes(",");
    const hasDot = trimmed.includes(".");
    const hasApostrophe = trimmed.includes("'");

    // Case 1: Swiss / Bank format: apostrophe thousands + dot decimal (e.g. 12'345.67)
    if (hasApostrophe) {
      thousandsSeparator = "APOSTROPHE";
      const stripped = trimmed.replace(/'/g, "");
      if (hasDot) {
        decimalSeparator = "DOT";
        return {
          decimalSeparator,
          thousandsSeparator,
          cleanedNumericString: stripped,
          errors,
        };
      }
      return {
        decimalSeparator: "NONE",
        thousandsSeparator,
        cleanedNumericString: stripped,
        errors,
      };
    }

    // Case 2: Space thousands separator (South African SABS standard & International SI standard)
    // E.g. "12 345.67" or "12 345,67" or "12 450" or "1 250"
    if (hasSpaceSeparator) {
      thousandsSeparator = "SPACE";
      const stripped = trimmed.replace(/[\s\u00A0\u202F]/g, "");

      if (hasDot && !hasComma) {
        decimalSeparator = "DOT";
        return { decimalSeparator, thousandsSeparator, cleanedNumericString: stripped, errors };
      }
      if (hasComma && !hasDot) {
        decimalSeparator = "COMMA";
        return {
          decimalSeparator,
          thousandsSeparator,
          cleanedNumericString: stripped.replace(/,/g, "."),
          errors,
        };
      }
      if (!hasDot && !hasComma) {
        decimalSeparator = "NONE";
        return {
          decimalSeparator,
          thousandsSeparator,
          cleanedNumericString: stripped,
          errors,
        };
      }
    }

    // Case 3: Both Comma and Dot present (e.g. "12,345.67" vs "12.345,67")
    if (hasComma && hasDot) {
      const lastComma = trimmed.lastIndexOf(",");
      const lastDot = trimmed.lastIndexOf(".");

      if (lastDot > lastComma) {
        // Anglo/SA standard: Comma thousands, Dot decimal (e.g. "12,345.67")
        thousandsSeparator = "COMMA";
        decimalSeparator = "DOT";
        const cleaned = trimmed.replace(/,/g, "");
        return { decimalSeparator, thousandsSeparator, cleanedNumericString: cleaned, errors };
      } else {
        // Continental standard: Dot thousands, Comma decimal (e.g. "12.345,67")
        thousandsSeparator = "DOT";
        decimalSeparator = "COMMA";
        const cleaned = trimmed.replace(/\./g, "").replace(/,/g, ".");
        return { decimalSeparator, thousandsSeparator, cleanedNumericString: cleaned, errors };
      }
    }

    // Case 4: Only Dot present (e.g. "12345.67" or "12.345")
    if (hasDot && !hasComma) {
      // If dot is followed by 2 digits at end, it's virtually always a decimal
      const dotMatch = trimmed.match(/\.(\d+)$/);
      if (dotMatch) {
        const decimals = dotMatch[1];
        if (
          decimals.length === 2 ||
          decimals.length === 1 ||
          decimals.length === 3 ||
          decimals.length === 4
        ) {
          decimalSeparator = "DOT";
          return { decimalSeparator, thousandsSeparator, cleanedNumericString: trimmed, errors };
        }
      }
      // If dot is followed by 3 digits in continental mode without decimals (e.g. "12.345")
      if (profile.name === "INTERNATIONAL_CONTINENTAL" && /\.([0-9]{3})$/.test(trimmed)) {
        thousandsSeparator = "DOT";
        decimalSeparator = "NONE";
        return {
          decimalSeparator,
          thousandsSeparator,
          cleanedNumericString: trimmed.replace(/\./g, ""),
          errors,
        };
      }

      decimalSeparator = "DOT";
      return { decimalSeparator, thousandsSeparator, cleanedNumericString: trimmed, errors };
    }

    // Case 5: Only Comma present (e.g. "12,50" or "12,345")
    if (hasComma && !hasDot) {
      const commaMatch = trimmed.match(/,(\d+)$/);
      if (commaMatch) {
        const decimals = commaMatch[1];
        // In South Africa & Europe, comma is standard decimal (e.g. "12,50")
        if (decimals.length === 2 || decimals.length === 1) {
          decimalSeparator = "COMMA";
          return {
            decimalSeparator,
            thousandsSeparator,
            cleanedNumericString: trimmed.replace(/,/g, "."),
            errors,
          };
        }
        // In Anglo/US, 3 digits after comma without decimal is thousands separator (e.g. "12,345")
        if (decimals.length === 3) {
          thousandsSeparator = "COMMA";
          decimalSeparator = "NONE";
          return {
            decimalSeparator,
            thousandsSeparator,
            cleanedNumericString: trimmed.replace(/,/g, ""),
            errors,
          };
        }
      }

      decimalSeparator = "COMMA";
      return {
        decimalSeparator,
        thousandsSeparator,
        cleanedNumericString: trimmed.replace(/,/g, "."),
        errors,
      };
    }

    // Case 6: Pure integer or plain number without separators
    return {
      decimalSeparator: "NONE",
      thousandsSeparator: "NONE",
      cleanedNumericString: trimmed,
      errors,
    };
  }

  // ---------------------------------------------------------------------------
  // Negative Number Extraction (Requirement 16)
  // ---------------------------------------------------------------------------

  /**
   * Extracts negative notations:
   *   - Leading minus: "-R 450.00", "-450.00"
   *   - Trailing minus: "450.00-", "R 450.00-"
   *   - Parentheses: "(R 450.00)", "(450.00)"
   *   - Credit suffix: "R 450.00 CR", "450.00 CR", "450.00 Credit"
   *   - Debit suffix: "450.00 DR"
   */
  public static extractNegativeFormat(raw: string): {
    cleanStr: string;
    isNegative: boolean;
    format: NegativeNumberFormat;
  } {
    const clean = (raw || "").trim();

    // 1. Accounting Parentheses: "(123.45)" or "(R 123.45)"
    const parenMatch = clean.match(/^\s*\((.*)\)\s*$/);
    if (parenMatch) {
      return {
        cleanStr: parenMatch[1].trim(),
        isNegative: true,
        format: "PARENTHESES",
      };
    }

    // 2. Credit Suffix: "123.45 CR" or "123.45 Credit"
    const crMatch = clean.match(/^(.*?)\s*(?:CR|CREDIT)\s*$/i);
    if (crMatch) {
      return {
        cleanStr: crMatch[1].trim(),
        isNegative: true,
        format: "CREDIT_SUFFIX",
      };
    }

    // 3. Debit Suffix: "123.45 DR" (positive in utility balance)
    const drMatch = clean.match(/^(.*?)\s*(?:DR|DEBIT)\s*$/i);
    if (drMatch) {
      return {
        cleanStr: drMatch[1].trim(),
        isNegative: false,
        format: "DEBIT_SUFFIX",
      };
    }

    // 4. Trailing Minus: "123.45-" or "R 123.45-"
    const trailMinusMatch = clean.match(/^(.*?)\s*-\s*$/);
    if (trailMinusMatch) {
      return {
        cleanStr: trailMinusMatch[1].trim(),
        isNegative: true,
        format: "TRAILING_MINUS",
      };
    }

    // 5. Leading Minus: "-123.45" or "-R 123.45" or "R -123.45"
    if (clean.startsWith("-")) {
      return {
        cleanStr: clean.substring(1).trim(),
        isNegative: true,
        format: "LEADING_MINUS",
      };
    }
    const leadingCurrencyMinusMatch = clean.match(/^([A-Za-z$€£]+)\s*-\s*(.*)$/);
    if (leadingCurrencyMinusMatch) {
      return {
        cleanStr: `${leadingCurrencyMinusMatch[1]} ${leadingCurrencyMinusMatch[2]}`.trim(),
        isNegative: true,
        format: "LEADING_MINUS",
      };
    }

    return {
      cleanStr: clean,
      isNegative: false,
      format: "NONE",
    };
  }

  // ---------------------------------------------------------------------------
  // Currency Extraction (Requirement 16)
  // ---------------------------------------------------------------------------

  public static extractCurrencyAndClean(
    raw: string,
    profile: DocumentLocaleProfile = SOUTH_AFRICA_LOCALE_PROFILE,
  ): {
    cleanStr: string;
    currencySymbol?: string;
    currencyIsoCode?: string;
  } {
    let clean = (raw || "").trim();
    let currencySymbol: string | undefined;
    let currencyIsoCode: string | undefined;

    // Check South African Rand: "R 123.45", "R123.45", "ZAR 123.45"
    const zarMatch =
      clean.match(/^(?:(ZAR|R))\b\s*(.*)$/i) ||
      clean.match(/^R([0-9].*)$/i) ||
      clean.match(/^(.*?)\s*\b(?:(ZAR|R))\b$/i);
    if (zarMatch) {
      currencySymbol = zarMatch[1]
        ? zarMatch[1].toUpperCase()
        : zarMatch[2]
          ? zarMatch[2].toUpperCase()
          : "R";
      currencyIsoCode = "ZAR";
      clean = (zarMatch[2] || zarMatch[1] || "").trim();
    }

    // Check Swiss Franc: "CHF 123.45" or "123.45 CHF"
    const chfMatch = clean.match(/^(?:CHF)\b\s*(.*)$/i) || clean.match(/^(.*?)\s*\b(?:CHF)\b$/i);
    if (!currencySymbol && chfMatch) {
      currencySymbol = "CHF";
      currencyIsoCode = "CHF";
      clean = (chfMatch[1] || chfMatch[2] || "").trim();
    }

    // Check Dollar: "$ 123.45" or "$123.45" or "USD 123.45"
    const usdMatch =
      clean.match(/^(?:\$|USD\b)\s*(.*)$/i) || clean.match(/^(.*?)\s*(?:\$|\bUSD\b)$/i);
    if (!currencySymbol && usdMatch) {
      currencySymbol = "$";
      currencyIsoCode = "USD";
      clean = (usdMatch[1] || usdMatch[2] || "").trim();
    }

    // Check Euro: "€ 123.45" or "123.45 €" or "EUR 123.45"
    const eurMatch =
      clean.match(/^(?:€|EUR\b)\s*(.*)$/i) || clean.match(/^(.*?)\s*(?:€|\bEUR\b)$/i);
    if (!currencySymbol && eurMatch) {
      currencySymbol = "€";
      currencyIsoCode = "EUR";
      clean = (eurMatch[1] || eurMatch[2] || "").trim();
    }

    // Check Pound: "£ 123.45" or "GBP 123.45"
    const gbpMatch =
      clean.match(/^(?:£|GBP\b)\s*(.*)$/i) || clean.match(/^(.*?)\s*(?:£|\bGBP\b)$/i);
    if (!currencySymbol && gbpMatch) {
      currencySymbol = "£";
      currencyIsoCode = "GBP";
      clean = (gbpMatch[1] || gbpMatch[2] || "").trim();
    }

    // Check Cents: "c 123.45" or "123.45 c" or "123.45 cents"
    const centMatch =
      clean.match(/^(?:(cents|c))\b\s*(.*)$/i) || clean.match(/^(.*?)\s*\b(?:(cents|c))\b$/i);
    if (!currencySymbol && centMatch) {
      currencySymbol = "c";
      currencyIsoCode = "ZAR_CENTS";
      clean = (centMatch[2] || centMatch[1] || "").trim();
    }

    // Generic check for profile.currencySymbols if still not matched
    if (!currencySymbol && profile && profile.currencySymbols) {
      for (const sym of profile.currencySymbols) {
        const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const isAlpha = /^[A-Za-z]+$/.test(sym);
        const bound = isAlpha ? "\\b" : "";
        const match =
          clean.match(new RegExp(`^(?:${escaped})${bound}\\s*(.*)$`, "i")) ||
          clean.match(new RegExp(`^(.*?)\\s*${bound}(?:${escaped})$`, "i"));
        if (match) {
          currencySymbol = sym;
          currencyIsoCode = sym;
          clean = (match[1] || match[2] || "").trim();
          break;
        }
      }
    }

    return {
      cleanStr: clean,
      currencySymbol,
      currencyIsoCode,
    };
  }

  // ---------------------------------------------------------------------------
  // Percentage Extraction (Requirement 16)
  // ---------------------------------------------------------------------------

  public static extractPercentage(raw: string): {
    cleanStr: string;
    isPercentage: boolean;
    percentageValue?: number;
  } {
    const clean = (raw || "").trim();
    const percMatch = clean.match(/^(.*?)\s*%\s*$/) || clean.match(/^%\s*(.*)$/);
    if (percMatch) {
      const numPart = (percMatch[1] || percMatch[2] || "").trim();
      const num = parseFloat(numPart.replace(/,/g, "."));
      return {
        cleanStr: numPart,
        isPercentage: true,
        percentageValue: isNaN(num) ? undefined : num,
      };
    }

    return {
      cleanStr: clean,
      isPercentage: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Unit Extraction (Requirement 16)
  // ---------------------------------------------------------------------------

  public static extractUnit(
    raw: string,
    category: NumericFieldCategory,
  ): {
    cleanStr: string;
    unit?: string;
    isValidUnit: boolean;
    detectedToken?: string;
  } {
    const clean = (raw || "").trim();

    // Match trailing unit tokens (e.g. "12 345 kWh", "45.2 kVA", "145.23 c/kWh")
    const unitMatch = clean.match(/^(.*?)\s*([A-Za-z/]+)$/);
    if (unitMatch) {
      const potentialNum = unitMatch[1].trim();
      const potentialUnit = unitMatch[2].trim();

      // Ensure the first part contains digits
      if (/\d/.test(potentialNum)) {
        const lower = potentialUnit.toLowerCase();
        let isValid = false;
        for (const unitList of Object.values(VALID_UTILITY_UNITS)) {
          if (unitList.includes(lower)) {
            isValid = true;
            break;
          }
        }

        return {
          cleanStr: potentialNum,
          unit: potentialUnit,
          isValidUnit: isValid,
          detectedToken: potentialUnit,
        };
      }
    }

    return {
      cleanStr: clean,
      isValidUnit: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Specific Entity Protections (Requirement 15)
  // ---------------------------------------------------------------------------

  /**
   * Preserves Eskom and municipal account numbers immutably.
   * Prevents scientific notation or floating point rounding.
   */
  public static protectAccountNumber(
    raw: string,
    pageNumber: number = 1,
    baseConfidence: number = 95.0,
  ): ParsedNumericField {
    const originalRaw = raw;
    const trimmed = (raw || "").trim();
    const validationErrors: OcrDetectedError[] = [];
    const reviewReasons: string[] = [];

    // Cleaned representation stripping internal spaces e.g. "078 019 8274" -> "0780198274"
    const normalizedText = trimmed.replace(/\s+/g, "");

    // Eskom accounts are typically 10 digits
    const isStandardDigits = /^\d{10}$/.test(normalizedText);
    const hasAlpha = /[A-Za-z]/.test(normalizedText);

    if (hasAlpha) {
      validationErrors.push({
        errorId: `err-acc-alpha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "ACCOUNT_NUMBER_CORRUPTION",
        originalOcrValue: originalRaw,
        fieldKey: "ACCOUNT_NUMBER",
        pageNumber,
        potentialError: `Alphabetic characters detected in account number '${originalRaw}'.`,
        validationResult: "Account number validation failed.",
        suggestedCandidate: normalizedText.replace(/[Oo]/g, "0").replace(/[Il]/g, "1"),
        confidencePenalty: 30,
        severity: "CRITICAL",
        reviewRequired: true,
      });
      reviewReasons.push(`Alphabetic characters in account number: ${originalRaw}`);
    } else if (!isStandardDigits && normalizedText.length > 0) {
      validationErrors.push({
        errorId: `err-acc-len-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "ACCOUNT_NUMBER_CORRUPTION",
        originalOcrValue: originalRaw,
        fieldKey: "ACCOUNT_NUMBER",
        pageNumber,
        potentialError: `Account number '${normalizedText}' has length ${normalizedText.length} (expected 10 digits for Eskom).`,
        validationResult: "Account number length mismatch.",
        confidencePenalty: 15,
        severity: "MEDIUM",
        reviewRequired: true,
      });
      reviewReasons.push(`Account number length ${normalizedText.length} != 10`);
    }

    const confidenceScore = Math.max(
      0,
      baseConfidence - validationErrors.reduce((acc, e) => acc + e.confidencePenalty, 0),
    );
    const confidenceTier: OcrConfidenceTier =
      confidenceScore >= 85 ? "HIGH" : confidenceScore >= 70 ? "MEDIUM" : "LOW";

    return {
      category: "ACCOUNT_NUMBER",
      originalRaw,
      normalizedText,
      numericValue: null, // Account numbers are identifiers, NEVER floating point numbers!
      isNegative: false,
      negativeFormat: "NONE",
      isPercentage: false,
      decimalSeparator: "NONE",
      thousandsSeparator: "NONE",
      scaleShift: {
        detected: false,
        originalOcrValue: originalRaw,
        reason: "N/A for identifiers",
        severity: "LOW",
      },
      validationErrors,
      isValid: validationErrors.length === 0,
      confidenceScore,
      confidenceTier,
      reviewRequired: validationErrors.length > 0,
      reviewReasons,
      suggestedCandidate: validationErrors[0]?.suggestedCandidate,
    };
  }

  /**
   * Preserves meter serial numbers (e.g. "MTR-908123", "8841-B", "0219847192") immutably.
   */
  public static protectMeterNumber(
    raw: string,
    pageNumber: number = 1,
    baseConfidence: number = 95.0,
  ): ParsedNumericField {
    const originalRaw = raw;
    const trimmed = (raw || "").trim();
    const validationErrors: OcrDetectedError[] = [];
    const reviewReasons: string[] = [];

    // Check for corrupt punctuation in meter serial (e.g. "MTR#8841-B")
    if (/[#$*&]/.test(trimmed)) {
      validationErrors.push({
        errorId: `err-mtr-sym-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        errorType: "METER_NUMBER_CORRUPTION",
        originalOcrValue: originalRaw,
        fieldKey: "METER_NUMBER",
        pageNumber,
        potentialError: `Corrupt noise symbol detected in meter number '${originalRaw}'.`,
        validationResult: "Meter serial validation failed.",
        suggestedCandidate: trimmed.replace(/[#$*&]/g, ""),
        confidencePenalty: 20,
        severity: "HIGH",
        reviewRequired: true,
      });
      reviewReasons.push(`Corrupt noise symbol in meter serial '${originalRaw}'`);
    }

    const confidenceScore = Math.max(
      0,
      baseConfidence - validationErrors.reduce((acc, e) => acc + e.confidencePenalty, 0),
    );
    const confidenceTier: OcrConfidenceTier =
      confidenceScore >= 85 ? "HIGH" : confidenceScore >= 70 ? "MEDIUM" : "LOW";

    return {
      category: "METER_NUMBER",
      originalRaw,
      normalizedText: trimmed,
      numericValue: null,
      isNegative: false,
      negativeFormat: "NONE",
      isPercentage: false,
      decimalSeparator: "NONE",
      thousandsSeparator: "NONE",
      scaleShift: {
        detected: false,
        originalOcrValue: originalRaw,
        reason: "N/A for identifiers",
        severity: "LOW",
      },
      validationErrors,
      isValid: validationErrors.length === 0,
      confidenceScore,
      confidenceTier,
      reviewRequired: validationErrors.length > 0,
      reviewReasons,
      suggestedCandidate: validationErrors[0]?.suggestedCandidate,
    };
  }

  /**
   * Preserves tax invoice serial numbers (e.g. "INV-2026-001", "98172635") immutably.
   */
  public static protectInvoiceNumber(
    raw: string,
    pageNumber: number = 1,
    baseConfidence: number = 95.0,
  ): ParsedNumericField {
    const originalRaw = raw;
    const trimmed = (raw || "").trim();

    return {
      category: "INVOICE_NUMBER",
      originalRaw,
      normalizedText: trimmed,
      numericValue: null,
      isNegative: false,
      negativeFormat: "NONE",
      isPercentage: false,
      decimalSeparator: "NONE",
      thousandsSeparator: "NONE",
      scaleShift: {
        detected: false,
        originalOcrValue: originalRaw,
        reason: "N/A for identifiers",
        severity: "LOW",
      },
      validationErrors: [],
      isValid: trimmed.length > 0,
      confidenceScore: baseConfidence,
      confidenceTier: "HIGH",
      reviewRequired: trimmed.length === 0,
      reviewReasons: trimmed.length === 0 ? ["Invoice number is empty"] : [],
    };
  }

  /**
   * Preserves tariff structures (e.g. "Megaflex", "Miniflex", "Nightsave Urban Large") immutably.
   */
  public static protectTariff(
    raw: string,
    pageNumber: number = 1,
    baseConfidence: number = 95.0,
  ): ParsedNumericField {
    const originalRaw = raw;
    const trimmed = (raw || "").trim();

    return {
      category: "TARIFF",
      originalRaw,
      normalizedText: trimmed,
      numericValue: null,
      isNegative: false,
      negativeFormat: "NONE",
      isPercentage: false,
      decimalSeparator: "NONE",
      thousandsSeparator: "NONE",
      scaleShift: {
        detected: false,
        originalOcrValue: originalRaw,
        reason: "N/A for tariff names",
        severity: "LOW",
      },
      validationErrors: [],
      isValid: trimmed.length > 0,
      confidenceScore: baseConfidence,
      confidenceTier: "HIGH",
      reviewRequired: trimmed.length === 0,
      reviewReasons: trimmed.length === 0 ? ["Tariff code is empty"] : [],
    };
  }

  /**
   * Validates power factor values: must be bounded in [0.00, 1.00].
   */
  public static validatePowerFactor(
    value: number,
    raw: string,
    pageNumber: number = 1,
  ): { isValid: boolean; error?: OcrDetectedError } {
    if (value >= 0.0 && value <= 1.0) {
      return { isValid: true };
    }

    const error: OcrDetectedError = {
      errorId: `err-pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      errorType: "POWER_FACTOR_OUT_OF_BOUNDS",
      originalOcrValue: raw,
      fieldKey: "POWER_FACTOR",
      pageNumber,
      potentialError: `Power factor value ${value} is outside physical bounds [0.00, 1.00].`,
      validationResult: "Power factor range check failed.",
      suggestedCandidate: value > 1.0 && value <= 100.0 ? (value / 100).toFixed(2) : undefined,
      confidencePenalty: 30,
      severity: "CRITICAL",
      reviewRequired: true,
    };

    return { isValid: false, error };
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private static isCalendarValid(year: number, month: number, day: number): boolean {
    if (year < 1990 || year > 2099) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    // Check month days
    const daysInMonth = [
      31,
      this.isLeapYear(year) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    return day <= daysInMonth[month - 1];
  }

  private static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }
}
