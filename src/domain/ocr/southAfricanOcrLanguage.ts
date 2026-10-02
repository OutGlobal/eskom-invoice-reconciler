/**
 * ENERA PRODUCTION OCR ENGINE — SOUTH AFRICAN UTILITY DOCUMENT LANGUAGE LAYER
 * ============================================================================
 * Tailored for South African utility bills and statements (Eskom, City Power,
 * City of Cape Town, eThekwini, City of Tshwane, Ekurhuleni, Mangaung, etc.).
 *
 * Core principles:
 * 1. Primary language: English ("eng") — national utility standard.
 * 2. Secondary & regional: Afrikaans ("afr") — extensive municipal usage.
 * 3. Additional official languages: isiZulu ("zul"), isiXhosa ("xho"),
 *    Sesotho ("sot"), Setswana ("tsn").
 * 4. Dual-language bills ("eng+afr") — common on Western Cape & municipal bills.
 * 5. SAFEGUARD: "Do not assume that language detection is always correct."
 *    - Language detection is treated as a proposal, not ground truth.
 *    - When confidence is low (< 70%) or ambiguous, safely fall back to "eng".
 * 6. AUDIT: The complete language configuration (requested, detected, confidence,
 *    actual used, fallback used, reason) is stored with every OCR processing run.
 */

import type { OcrRunLanguageConfig } from "./types";

/**
 * Official South African languages supported in utility billing contexts.
 */
export type SouthAfricanUtilityLanguage = "eng" | "afr" | "zul" | "xho" | "sot" | "tsn" | "eng+afr";

export interface LanguageMetadata {
  code: SouthAfricanUtilityLanguage;
  name: string;
  nativeName: string;
  isPrimaryUtilityLanguage: boolean;
  typicalUtilityRegions: string[];
}

export const SOUTH_AFRICAN_LANGUAGES: Record<SouthAfricanUtilityLanguage, LanguageMetadata> = {
  eng: {
    code: "eng",
    name: "English",
    nativeName: "English",
    isPrimaryUtilityLanguage: true,
    typicalUtilityRegions: ["National", "Eskom Direct", "City Power", "eThekwini", "Tshwane"],
  },
  afr: {
    code: "afr",
    name: "Afrikaans",
    nativeName: "Afrikaans",
    isPrimaryUtilityLanguage: true,
    typicalUtilityRegions: ["City of Cape Town", "Drakenstein", "Stellenbosch", "Free State"],
  },
  "eng+afr": {
    code: "eng+afr",
    name: "Bilingual (English & Afrikaans)",
    nativeName: "Tweetalig (Engels & Afrikaans)",
    isPrimaryUtilityLanguage: true,
    typicalUtilityRegions: ["Western Cape Municipalities", "Historical Eskom Accounts"],
  },
  zul: {
    code: "zul",
    name: "isiZulu",
    nativeName: "isiZulu",
    isPrimaryUtilityLanguage: false,
    typicalUtilityRegions: ["KwaZulu-Natal", "eThekwini", "Msunduzi"],
  },
  xho: {
    code: "xho",
    name: "isiXhosa",
    nativeName: "isiXhosa",
    isPrimaryUtilityLanguage: false,
    typicalUtilityRegions: ["Eastern Cape", "Nelson Mandela Bay", "Buffalo City"],
  },
  sot: {
    code: "sot",
    name: "Sesotho",
    nativeName: "Sesotho",
    isPrimaryUtilityLanguage: false,
    typicalUtilityRegions: ["Free State", "Mangaung", "Maluti-a-Phofung"],
  },
  tsn: {
    code: "tsn",
    name: "Setswana",
    nativeName: "Setswana",
    isPrimaryUtilityLanguage: false,
    typicalUtilityRegions: ["North West", "Sol Plaatje", "Rustenburg"],
  },
};

/**
 * Diagnostic utility vocabulary for South African billing documents.
 */
const AFRIKAANS_UTILITY_KEYWORDS = [
  "belastingfaktuur",
  "btw-registrasie",
  "rekeningnommer",
  "faktuurnommer",
  "elektrisiteit",
  "kragverbruik",
  "verbruik",
  "meterlesing",
  "vorige lesing",
  "huidige lesing",
  "wyserverskil",
  "vermenigvuldigingsfaktor",
  "maksimum aanvraag",
  "aktiewe energie",
  "reaktiewe energie",
  "kragfaktor",
  "netwerkheffing",
  "diensheffing",
  "totale bedrag",
  "subtotaal",
  "saldo",
  "tarief",
  "munisipaliteit",
  "betaling ontvang",
  "vervaldatum",
];

const ENGLISH_UTILITY_KEYWORDS = [
  "tax invoice",
  "vat registration",
  "account number",
  "invoice number",
  "electricity",
  "consumption",
  "meter reading",
  "previous reading",
  "current reading",
  "dial difference",
  "multiplying factor",
  "maximum demand",
  "active energy",
  "reactive energy",
  "power factor",
  "network charge",
  "service charge",
  "total amount due",
  "total due",
  "subtotal",
  "balance",
  "tariff",
  "municipality",
  "payment received",
  "due date",
];

const ZULU_UTILITY_KEYWORDS = [
  "i-invoysi",
  "i-akhawunti",
  "ugesi",
  "ukusetshenziswa",
  "inani",
  "isamba",
  "intela",
];

export interface LanguageDetectionResult {
  detectedLanguage: SouthAfricanUtilityLanguage;
  confidence: number; // 0..100
  isDualLanguage: boolean;
  matchedEnglishKeywords: string[];
  matchedAfrikaansKeywords: string[];
  matchedZuluKeywords: string[];
}

export class SouthAfricanLanguageManager {
  /** Default fallback language when detection is low confidence or ambiguous. */
  public static readonly DEFAULT_FALLBACK_LANGUAGE: SouthAfricanUtilityLanguage = "eng";

  /** Minimum detection confidence (0..100) required to adopt detected language over fallback. */
  public static readonly DETECTION_ADOPTION_THRESHOLD = 70.0;

  /**
   * Detects the dominant language or bilingual structure of text extracted from
   * a South African utility bill.
   *
   * Analyzes domain-specific terminology (billing keywords, tariff names, tax markers).
   */
  public static detectLanguage(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return {
        detectedLanguage: "eng",
        confidence: 0,
        isDualLanguage: false,
        matchedEnglishKeywords: [],
        matchedAfrikaansKeywords: [],
        matchedZuluKeywords: [],
      };
    }

    const lower = text.toLowerCase();

    const matchedEng = ENGLISH_UTILITY_KEYWORDS.filter((kw) => lower.includes(kw));
    const matchedAfr = AFRIKAANS_UTILITY_KEYWORDS.filter((kw) => lower.includes(kw));
    const matchedZul = ZULU_UTILITY_KEYWORDS.filter((kw) => lower.includes(kw));

    const engCount = matchedEng.length;
    const afrCount = matchedAfr.length;
    const zulCount = matchedZul.length;
    const totalMatches = engCount + afrCount + zulCount;

    if (totalMatches === 0) {
      // Unrecognized vocabulary — default to English with low confidence
      return {
        detectedLanguage: "eng",
        confidence: 30.0,
        isDualLanguage: false,
        matchedEnglishKeywords: [],
        matchedAfrikaansKeywords: [],
        matchedZuluKeywords: [],
      };
    }

    // Check for bilingual documents (very common on municipal utility invoices)
    const isBilingual = engCount >= 2 && afrCount >= 2;
    if (isBilingual) {
      const balanceRatio = Math.min(engCount, afrCount) / Math.max(engCount, afrCount);
      const confidence = Math.min(98.0, 75.0 + balanceRatio * 23.0);
      return {
        detectedLanguage: "eng+afr",
        confidence: Number(confidence.toFixed(1)),
        isDualLanguage: true,
        matchedEnglishKeywords: matchedEng,
        matchedAfrikaansKeywords: matchedAfr,
        matchedZuluKeywords: matchedZul,
      };
    }

    if (afrCount > engCount && afrCount > zulCount) {
      const confidence = Math.min(99.0, 60.0 + (afrCount / (afrCount + engCount + 1)) * 39.0);
      return {
        detectedLanguage: "afr",
        confidence: Number(confidence.toFixed(1)),
        isDualLanguage: false,
        matchedEnglishKeywords: matchedEng,
        matchedAfrikaansKeywords: matchedAfr,
        matchedZuluKeywords: matchedZul,
      };
    }

    if (zulCount > engCount && zulCount > afrCount) {
      const confidence = Math.min(95.0, 60.0 + (zulCount / (zulCount + engCount + 1)) * 35.0);
      return {
        detectedLanguage: "zul",
        confidence: Number(confidence.toFixed(1)),
        isDualLanguage: false,
        matchedEnglishKeywords: matchedEng,
        matchedAfrikaansKeywords: matchedAfr,
        matchedZuluKeywords: matchedZul,
      };
    }

    // Default to English with confidence proportional to match density
    const confidence = Math.min(99.0, 65.0 + (engCount / (engCount + afrCount + 1)) * 34.0);
    return {
      detectedLanguage: "eng",
      confidence: Number(confidence.toFixed(1)),
      isDualLanguage: false,
      matchedEnglishKeywords: matchedEng,
      matchedAfrikaansKeywords: matchedAfr,
      matchedZuluKeywords: matchedZul,
    };
  }

  /**
   * Resolves the authoritative OCR language configuration for a processing run.
   *
   * SAFEGUARD: Never blindly trust automatic language detection.
   * - If caller explicitly specifies requestedLanguage, honor it.
   * - If detected language confidence is >= DETECTION_ADOPTION_THRESHOLD (70%),
   *   adopt detected language.
   * - If detection confidence is below threshold or ambiguous, safely fall back
   *   to configured default ("eng") and document the reason.
   */
  public static resolveExecutionLanguage(options: {
    requestedLanguage?: string;
    sampleText?: string;
    providerConfigLanguage?: string;
    supportedLanguages?: string[];
  }): OcrRunLanguageConfig {
    const fallback = (options.providerConfigLanguage ||
      this.DEFAULT_FALLBACK_LANGUAGE) as SouthAfricanUtilityLanguage;
    const supported = options.supportedLanguages || Object.keys(SOUTH_AFRICAN_LANGUAGES);

    // 1. Explicit caller request takes highest precedence
    if (options.requestedLanguage && options.requestedLanguage.trim().length > 0) {
      const req = options.requestedLanguage.trim().toLowerCase();
      const isSupported = supported.includes(req) || req === "eng";
      return {
        requestedLanguage: req,
        actualLanguageUsed: isSupported ? req : fallback,
        fallbackLanguage: fallback,
        isFallbackUsed: !isSupported,
        selectionReason: isSupported
          ? `Explicitly requested by caller: "${req}"`
          : `Requested language "${req}" is not supported by active OCR engine; fell back to "${fallback}"`,
        supportedLanguages: supported,
      };
    }

    // 2. Language detection on available text sample (if available)
    if (options.sampleText && options.sampleText.trim().length > 10) {
      const detection = this.detectLanguage(options.sampleText);

      // Check if detection meets adoption criteria
      if (detection.confidence >= this.DETECTION_ADOPTION_THRESHOLD) {
        const isSupported = supported.includes(detection.detectedLanguage);
        if (isSupported) {
          return {
            detectedLanguage: detection.detectedLanguage,
            languageDetectionConfidence: detection.confidence,
            actualLanguageUsed: detection.detectedLanguage,
            fallbackLanguage: fallback,
            isFallbackUsed: false,
            selectionReason: detection.isDualLanguage
              ? `Detected bilingual South African utility bill (confidence ${detection.confidence}%)`
              : `High-confidence South African vocabulary detection: "${detection.detectedLanguage}" (${detection.confidence}%)`,
            supportedLanguages: supported,
          };
        }

        // Detected language not supported by engine -> safe fallback
        return {
          detectedLanguage: detection.detectedLanguage,
          languageDetectionConfidence: detection.confidence,
          actualLanguageUsed: fallback,
          fallbackLanguage: fallback,
          isFallbackUsed: true,
          selectionReason: `Detected "${detection.detectedLanguage}" (${detection.confidence}%), but engine lacks model pack; safely fell back to "${fallback}"`,
          supportedLanguages: supported,
        };
      }

      // Detection confidence too low -> safe fallback (Do not assume detection is correct!)
      return {
        detectedLanguage: detection.detectedLanguage,
        languageDetectionConfidence: detection.confidence,
        actualLanguageUsed: fallback,
        fallbackLanguage: fallback,
        isFallbackUsed: true,
        selectionReason: `Detection confidence (${detection.confidence}%) below safe adoption threshold (${this.DETECTION_ADOPTION_THRESHOLD}%); safely fell back to default "${fallback}"`,
        supportedLanguages: supported,
      };
    }

    // 3. No sample text or caller request -> use standard fallback
    return {
      actualLanguageUsed: fallback,
      fallbackLanguage: fallback,
      isFallbackUsed: false,
      selectionReason: `Default South African utility language configuration: "${fallback}"`,
      supportedLanguages: supported,
    };
  }
}
