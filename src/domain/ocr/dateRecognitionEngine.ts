/**
 * ENERA PRODUCTION OCR ENGINE — DATE RECOGNITION ENGINE
 * ======================================================
 * Requirement 17: DATE RECOGNITION
 *
 * OCR identifies candidate dates such as:
 *   - 01/09/2026       (DD/MM/YYYY)
 *   - 2026-09-01       (YYYY-MM-DD ISO)
 *   - 01 Sep 2026      (DD MMM YYYY)
 *   - September 1, 2026 (Month D, YYYY)
 *   - 01-09-2026, 01.09.2026
 *   - 2026/09/01, 2026.09.01
 *   - 20260901
 *
 * Strict Preservation Principles:
 *   1. Preserve the original OCR text immutably (originalRaw).
 *   2. Normalize the candidate date separately (normalizedIsoDate: YYYY-MM-DD).
 *   3. Never destroy the original evidence.
 */

import type {
  CandidateDateRecognition,
  CoordinateSystem,
  DocumentLocaleProfile,
  OcrBoundingBox,
  OcrConfidenceTier,
  OcrDetectedError,
  OcrLineBlock,
  OcrPageResult,
} from "./types";
import { SOUTH_AFRICA_LOCALE_PROFILE } from "./numericProtectionEngine";

export interface DateScanOptions {
  pageNumber?: number;
  localeProfile?: DocumentLocaleProfile;
  baseConfidence?: number;
}

export class DateRecognitionEngine {
  private static readonly MONTH_NAMES: Record<string, number> = {
    JANUARY: 1,
    JAN: 1,
    FEBRUARY: 2,
    FEB: 2,
    MARCH: 3,
    MAR: 3,
    APRIL: 4,
    APR: 4,
    MAY: 5,
    JUNE: 6,
    JUN: 6,
    JULY: 7,
    JUL: 7,
    AUGUST: 8,
    AUG: 8,
    SEPTEMBER: 9,
    SEP: 9,
    SEPT: 9,
    OCTOBER: 10,
    OCT: 10,
    NOVEMBER: 11,
    NOV: 11,
    DECEMBER: 12,
    DEC: 12,
    // Afrikaans month names common on South African utility documents
    JANUARIE: 1,
    FEBRUARIE: 2,
    MAART: 3,
    MEI: 5,
    JUNIE: 6,
    JULIE: 7,
    OKTOBER: 10,
  };

  /**
   * Scans an entire OCR page to recognize all candidate dates with spatial grounding.
   * NEVER modifies or destroys original OCR text.
   */
  public static recognizeDatesInPage(page: OcrPageResult): CandidateDateRecognition[] {
    const candidates: CandidateDateRecognition[] = [];

    // Scan line by line for spatial grounding
    for (const line of page.lines) {
      const lineCandidates = this.recognizeCandidateDatesInText(line.text, {
        pageNumber: page.pageNumber,
        baseConfidence: line.confidence,
      });

      for (const cand of lineCandidates) {
        // Ground with line bounding box
        cand.boundingBox = line.boundingBox;
        cand.coordinates = {
          x: line.x !== undefined ? line.x : line.boundingBox[0],
          y: line.y !== undefined ? line.y : line.boundingBox[1],
          width: line.width !== undefined ? line.width : line.boundingBox[2],
          height: line.height !== undefined ? line.height : line.boundingBox[3],
          coordinateSystem: line.coordinateSystem || "NORMALIZED_0_1",
        };
        cand.contextSnippet = line.text;
        candidates.push(cand);
      }
    }

    return candidates;
  }

  /**
   * Scans a text snippet to discover all candidate dates matching utility invoice patterns.
   * Each candidate preserves originalRaw untouched and normalizes to ISO separately.
   */
  public static recognizeCandidateDatesInText(
    text: string,
    options: DateScanOptions = {},
  ): CandidateDateRecognition[] {
    const candidates: CandidateDateRecognition[] = [];
    const pageNumber = options.pageNumber ?? 1;
    const baseConfidence = options.baseConfidence ?? 95.0;

    if (!text || text.trim().length === 0) {
      return candidates;
    }

    // Pattern 1: ISO 8601 YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (e.g. "2026-09-01")
    const isoRegex = /\b(\d{4})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/g;
    let match: RegExpExecArray | null;

    while ((match = isoRegex.exec(text)) !== null) {
      const originalRaw = match[0];
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const isCalendarValid = this.isCalendarValid(year, month, day);

      candidates.push({
        candidateId: `date-p${pageNumber}-${candidates.length + 1}-${Date.now()}`,
        pageNumber,
        originalRaw, // NEVER destroyed!
        normalizedIsoDate: isCalendarValid ? this.formatIso(year, month, day) : null,
        components: { year, month, day },
        detectedFormat: "YYYY-MM-DD",
        localePattern: "SOUTH_AFRICAN",
        isCalendarValid,
        confidence: baseConfidence,
        confidenceTier: this.scoreToTier(baseConfidence),
        contextSnippet: text,
      });
    }

    // Pattern 2: Slash / Dash / Dot DMY or MDY: e.g. "01/09/2026" or "01-09-2026"
    const dmyRegex = /\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|[12]\d|3[01])[-/.](\d{4})\b/g;
    while ((match = dmyRegex.exec(text)) !== null) {
      const originalRaw = match[0];
      const first = parseInt(match[1], 10);
      const second = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);

      // Disambiguate Day vs Month
      let day: number;
      let month: number;
      let detectedFormat: string;
      let localePattern: "SOUTH_AFRICAN" | "INTERNATIONAL" | "AMBIGUOUS";

      if (first > 12 && second <= 12) {
        // Unambiguously Day-Month-Year (e.g. 25/09/2026)
        day = first;
        month = second;
        detectedFormat = "DD/MM/YYYY";
        localePattern = "SOUTH_AFRICAN";
      } else if (second > 12 && first <= 12) {
        // Unambiguously Month-Day-Year (e.g. 09/25/2026)
        day = second;
        month = first;
        detectedFormat = "MM/DD/YYYY";
        localePattern = "INTERNATIONAL";
      } else {
        // Both <= 12 (e.g. 01/09/2026): South African default is Day/Month/Year
        day = first;
        month = second;
        detectedFormat = "DD/MM/YYYY";
        localePattern = "SOUTH_AFRICAN"; // Also marks ambiguity handled
      }

      const isCalendarValid = this.isCalendarValid(year, month, day);

      // Avoid duplicate matches if already captured
      if (!candidates.some((c) => c.originalRaw === originalRaw)) {
        candidates.push({
          candidateId: `date-p${pageNumber}-${candidates.length + 1}-${Date.now()}`,
          pageNumber,
          originalRaw, // NEVER destroyed!
          normalizedIsoDate: isCalendarValid ? this.formatIso(year, month, day) : null,
          components: { year, month, day },
          detectedFormat,
          localePattern,
          isCalendarValid,
          confidence: baseConfidence,
          confidenceTier: this.scoreToTier(baseConfidence),
          contextSnippet: text,
        });
      }
    }

    // Pattern 3: Day Mon Year e.g. "01 Sep 2026", "1 Sep 2026", "01 September 2026"
    const dayMonYearRegex = /\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-z]{3,10})\s+(\d{4})\b/g;
    while ((match = dayMonYearRegex.exec(text)) !== null) {
      const originalRaw = match[0];
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toUpperCase();
      const year = parseInt(match[3], 10);
      const month = this.MONTH_NAMES[monthStr];

      if (month) {
        const isCalendarValid = this.isCalendarValid(year, month, day);
        if (!candidates.some((c) => c.originalRaw === originalRaw)) {
          candidates.push({
            candidateId: `date-p${pageNumber}-${candidates.length + 1}-${Date.now()}`,
            pageNumber,
            originalRaw, // NEVER destroyed!
            normalizedIsoDate: isCalendarValid ? this.formatIso(year, month, day) : null,
            components: { year, month, day },
            detectedFormat: "DD MMM YYYY",
            localePattern: "SOUTH_AFRICAN",
            isCalendarValid,
            confidence: baseConfidence,
            confidenceTier: this.scoreToTier(baseConfidence),
            contextSnippet: text,
          });
        }
      }
    }

    // Pattern 4: Month Day, Year e.g. "September 1, 2026" or "Sep 1, 2026" or "September 01, 2026"
    const monDayYearRegex = /\b([A-Za-z]{3,10})\s+(0?[1-9]|[12]\d|3[01]),?\s+(\d{4})\b/g;
    while ((match = monDayYearRegex.exec(text)) !== null) {
      const originalRaw = match[0];
      const monthStr = match[1].toUpperCase();
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      const month = this.MONTH_NAMES[monthStr];

      if (month) {
        const isCalendarValid = this.isCalendarValid(year, month, day);
        if (!candidates.some((c) => c.originalRaw === originalRaw)) {
          candidates.push({
            candidateId: `date-p${pageNumber}-${candidates.length + 1}-${Date.now()}`,
            pageNumber,
            originalRaw, // NEVER destroyed!
            normalizedIsoDate: isCalendarValid ? this.formatIso(year, month, day) : null,
            components: { year, month, day },
            detectedFormat: "MMMM D, YYYY",
            localePattern: "INTERNATIONAL",
            isCalendarValid,
            confidence: baseConfidence,
            confidenceTier: this.scoreToTier(baseConfidence),
            contextSnippet: text,
          });
        }
      }
    }

    // Pattern 5: Compact YYYYMMDD (e.g. "20260901")
    const compactRegex = /\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/g;
    while ((match = compactRegex.exec(text)) !== null) {
      const originalRaw = match[0];
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      const isCalendarValid = this.isCalendarValid(year, month, day);

      if (!candidates.some((c) => c.originalRaw === originalRaw)) {
        candidates.push({
          candidateId: `date-p${pageNumber}-${candidates.length + 1}-${Date.now()}`,
          pageNumber,
          originalRaw,
          normalizedIsoDate: isCalendarValid ? this.formatIso(year, month, day) : null,
          components: { year, month, day },
          detectedFormat: "YYYYMMDD",
          localePattern: "SOUTH_AFRICAN",
          isCalendarValid,
          confidence: baseConfidence - 5,
          confidenceTier: this.scoreToTier(baseConfidence - 5),
          contextSnippet: text,
        });
      }
    }

    return candidates;
  }

  /**
   * Normalizes a single raw date candidate, returning both originalRaw and normalized ISO.
   */
  public static normalizeCandidateDate(
    raw: string,
    options: DateScanOptions = {},
  ): CandidateDateRecognition {
    const candidates = this.recognizeCandidateDatesInText(raw, options);
    if (candidates.length > 0) {
      return candidates[0];
    }

    // If no pattern matched, preserve raw evidence with null normalized
    return {
      candidateId: `date-unparsed-${Date.now()}`,
      pageNumber: options.pageNumber ?? 1,
      originalRaw: raw,
      normalizedIsoDate: null,
      detectedFormat: "UNKNOWN",
      localePattern: "AMBIGUOUS",
      isCalendarValid: false,
      confidence: 0,
      confidenceTier: "LOW",
    };
  }

  // ---------------------------------------------------------------------------
  // Validation & Formatting Helpers
  // ---------------------------------------------------------------------------

  public static isCalendarValid(year: number, month: number, day: number): boolean {
    if (year < 1990 || year > 2099) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

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

  public static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private static formatIso(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  private static scoreToTier(score: number): OcrConfidenceTier {
    if (score >= 85) return "HIGH";
    if (score >= 70) return "MEDIUM";
    return "LOW";
  }
}
