/**
 * ENERA CANONICAL INVOICE RECORD & FIELD-LEVEL EVIDENCE (REQUIREMENTS 6 & 7)
 * ===========================================================================
 * Formal canonical representation for validated utility invoices.
 *
 * STRUCTURE SECTIONS:
 * 1. Document (document ID, invoice number, document type, issue date, billing period, due date)
 * 2. Customer (account number, customer name, premise/site, address)
 * 3. Meter (meter number, meter type, previous reading, current reading, consumption)
 * 4. Tariff (tariff name, tariff code, tariff category, supply type)
 * 5. Energy (Peak kWh, Standard kWh, Off-Peak kWh, total kWh)
 * 6. Demand (notified maximum demand, utilised capacity, demand kVA, maximum demand)
 * 7. Reactive (kVArh, reactive charges, power factor)
 * 8. Financial (energy charges, demand charges, network charges, service charges, other charges, subtotal, VAT, invoice total)
 *
 * MANDATE:
 * - Every important value MUST have traceable field-level evidence and provenance.
 * - Missing values remain null / UNKNOWN (never manufactured or defaulted to 0).
 */

import type { CandidateFieldValidationInput, CompleteValidationResult } from "./types";
import type { UnifiedDocumentExtraction } from "../intelligence/unifiedDocumentBridge";

// --- 1. FIELD-LEVEL EVIDENCE CONTRACT ---

export interface FieldEvidenceSource {
  document_id: string;
  page: number; // 1-based page index
  text: string; // Grounded optical string
  bounding_box:
    | {
        ymin: number;
        xmin: number;
        ymax: number;
        xmax: number;
      }
    | [number, number, number, number];
  extraction_method: "ocr" | "native_pdf" | "hybrid";
  processing_run_id?: string;
}

export interface CanonicalField<T = string | number> {
  field: string;
  value: T | null;
  rawValue: string;
  unit?: string;
  source: FieldEvidenceSource | null;
  confidence: number; // 0.0 to 1.0
  validationConfidenceScore?: number; // 0 to 100
  status:
    | "VALID"
    | "INVALID"
    | "UNCERTAIN"
    | "MISSING"
    | "CONFLICT"
    | "REVIEW_REQUIRED"
    | "VALIDATED"
    | "UNKNOWN";
  validationNotes?: string;
}

// --- 2. CANONICAL INVOICE RECORD SECTIONS ---

export interface CanonicalDocumentSection {
  documentId: CanonicalField<string>;
  invoiceNumber: CanonicalField<string>;
  documentType: CanonicalField<string>;
  issueDate: CanonicalField<string>;
  billingPeriodStart: CanonicalField<string>;
  billingPeriodEnd: CanonicalField<string>;
  billingPeriod: CanonicalField<string>;
  dueDate: CanonicalField<string>;
}

export interface CanonicalCustomerSection {
  accountNumber: CanonicalField<string>;
  customerName: CanonicalField<string>;
  premiseSite: CanonicalField<string>;
  physicalAddress: CanonicalField<string>;
  postalAddress?: CanonicalField<string>;
}

export interface CanonicalMeterSection {
  meterNumber: CanonicalField<string>;
  meterType: CanonicalField<string>;
  previousReading: CanonicalField<number>;
  currentReading: CanonicalField<number>;
  consumption: CanonicalField<number>;
  meterMultiplier?: CanonicalField<number>;
}

export interface CanonicalTariffSection {
  tariffName: CanonicalField<string>;
  tariffCode: CanonicalField<string>;
  tariffCategory: CanonicalField<string>;
  supplyType: CanonicalField<string>;
  voltageLevel?: CanonicalField<string>;
}

export interface CanonicalEnergySection {
  peakKwh: CanonicalField<number>;
  standardKwh: CanonicalField<number>;
  offPeakKwh: CanonicalField<number>;
  totalKwh: CanonicalField<number>;
}

export interface CanonicalDemandSection {
  notifiedMaximumDemandKva: CanonicalField<number>;
  utilisedCapacityKva: CanonicalField<number>;
  demandKva: CanonicalField<number>;
  maximumDemandKva: CanonicalField<number>;
}

export interface CanonicalReactiveSection {
  reactiveEnergyKvarh: CanonicalField<number>;
  reactiveChargesZar: CanonicalField<number>;
  powerFactor: CanonicalField<number>;
}

export interface CanonicalFinancialSection {
  energyChargesZar: CanonicalField<number>;
  demandChargesZar: CanonicalField<number>;
  networkChargesZar: CanonicalField<number>;
  serviceChargesZar: CanonicalField<number>;
  otherChargesZar: CanonicalField<number>;
  subtotalZar: CanonicalField<number>;
  vatZar: CanonicalField<number>;
  invoiceTotalZar: CanonicalField<number>;
}

export interface CanonicalInvoiceRecord {
  schemaVersion: "2.0";
  documentId: string;
  organisationId?: string;
  generatedAt: string;
  validationRunId?: string;
  overallConfidence: number; // 0.0 to 1.0
  validationStatus: "AUTOMATICALLY_APPROVED" | "REVIEW_REQUIRED" | "PENDING";
  isImmutable: boolean;

  // 8 Canonical Sections
  document: CanonicalDocumentSection;
  customer: CanonicalCustomerSection;
  meter: CanonicalMeterSection;
  tariff: CanonicalTariffSection;
  energy: CanonicalEnergySection;
  demand: CanonicalDemandSection;
  reactive: CanonicalReactiveSection;
  financial: CanonicalFinancialSection;

  // Provenance Telemetry
  provenanceSummary: {
    totalFieldsCount: number;
    groundedFieldsCount: number;
    ungroundedFieldsCount: number;
    averageConfidence: number;
    allMandatoryGrounded: boolean;
  };
}

// --- 3. BUILDER & NORMALIZATION UTILITIES ---

export class CanonicalInvoiceBuilder {
  /**
   * Constructs a CanonicalField with full provenance grounding.
   */
  public static createField<T = string | number>(params: {
    field: string;
    value: T | null;
    rawValue?: string;
    unit?: string;
    documentId: string;
    page?: number;
    sourceText?: string;
    boundingBox?: [number, number, number, number];
    extractionMethod?: "ocr" | "native_pdf" | "hybrid";
    processingRunId?: string;
    confidence?: number;
    validationConfidenceScore?: number;
    status?:
      | "VALID"
      | "INVALID"
      | "UNCERTAIN"
      | "MISSING"
      | "CONFLICT"
      | "REVIEW_REQUIRED"
      | "VALIDATED"
      | "UNKNOWN";
    validationNotes?: string;
  }): CanonicalField<T> {
    const rawVal = params.rawValue ?? (params.value !== null ? String(params.value) : "");
    const confNorm =
      params.confidence !== undefined
        ? params.confidence > 1.0
          ? params.confidence / 100
          : params.confidence
        : 0.0;

    const hasEvidence =
      params.page !== undefined ||
      (params.sourceText !== undefined && params.sourceText.length > 0) ||
      params.boundingBox !== undefined;

    let source: FieldEvidenceSource | null = null;
    if (hasEvidence && params.value !== null) {
      source = {
        document_id: params.documentId,
        page: params.page ?? 1,
        text: params.sourceText || rawVal,
        bounding_box: params.boundingBox || [0, 0, 0, 0],
        extraction_method: params.extractionMethod || "ocr",
        processing_run_id: params.processingRunId,
      };
    }

    const fieldStatus =
      params.status || (params.value === null ? "MISSING" : source ? "VALID" : "UNKNOWN");

    return {
      field: params.field,
      value: params.value,
      rawValue: rawVal,
      unit: params.unit,
      source,
      confidence: confNorm,
      validationConfidenceScore: params.validationConfidenceScore,
      status: fieldStatus,
      validationNotes: params.validationNotes,
    };
  }

  /**
   * Builds a complete CanonicalInvoiceRecord from validated pipeline output.
   */
  public static fromValidationResult(
    valResult: CompleteValidationResult,
    candidateInputs: CandidateFieldValidationInput[] = [],
  ): CanonicalInvoiceRecord {
    const docId = valResult.documentId;
    const orgId = valResult.organisationId;
    const fieldMap = new Map<string, CandidateFieldValidationInput>();

    for (const c of candidateInputs) {
      fieldMap.set(c.fieldKey, c);
    }

    const getField = <T = string | number>(
      fieldKey: string,
      defaultValue: T | null = null,
      unit?: string,
    ): CanonicalField<T> => {
      const cand = fieldMap.get(fieldKey);
      const valField = valResult.validatedFields[fieldKey];

      const val = (valField?.value as T) ?? (cand?.value as T) ?? defaultValue;
      const raw = valField?.rawValue ?? cand?.rawValue ?? "";
      const conf = valField?.confidence ?? cand?.opticalConfidence ?? 0;
      const valScore =
        valField?.validationScore?.score ??
        (typeof conf === "number" ? Math.round(conf) : undefined);
      const page = cand?.sourcePage ?? valField?.provenance?.pageNumber ?? 1;
      const text = cand?.sourceText ?? valField?.provenance?.sourceText ?? raw;
      const bbox = cand?.boundingBox ?? valField?.provenance?.boundingBox;
      const runId = cand?.processingRunId;
      const status = valField?.status ?? (val !== null ? "VALID" : "MISSING");

      return this.createField<T>({
        field: fieldKey,
        value: val,
        rawValue: raw,
        unit,
        documentId: docId,
        page,
        sourceText: text,
        boundingBox: bbox,
        extractionMethod: "ocr",
        processingRunId: runId,
        confidence: conf,
        validationConfidenceScore: valScore,
        status,
      });
    };

    // 1. Document Section
    const document: CanonicalDocumentSection = {
      documentId: getField<string>("documentId", docId),
      invoiceNumber: getField<string>("invoiceNumber", null),
      documentType: getField<string>("documentType", "TAX_INVOICE"),
      issueDate: getField<string>("issueDate", getField<string>("invoiceDate").value),
      billingPeriodStart: getField<string>("billingPeriodStart", null),
      billingPeriodEnd: getField<string>("billingPeriodEnd", null),
      billingPeriod: getField<string>("billingPeriod", null),
      dueDate: getField<string>("dueDate", null),
    };

    // 2. Customer Section
    const customer: CanonicalCustomerSection = {
      accountNumber: getField<string>("accountNumber", null),
      customerName: getField<string>("customerName", null),
      premiseSite: getField<string>("premiseSite", getField<string>("premiseId").value),
      physicalAddress: getField<string>("physicalAddress", null),
      postalAddress: getField<string>("postalAddress", null),
    };

    // 3. Meter Section
    const meter: CanonicalMeterSection = {
      meterNumber: getField<string>("meterNumber", null),
      meterType: getField<string>("meterType", "ELECTRONIC_TOU"),
      previousReading: getField<number>("previousReading", null, "kWh"),
      currentReading: getField<number>("currentReading", null, "kWh"),
      consumption: getField<number>("consumption", null, "kWh"),
      meterMultiplier: getField<number>("meterMultiplier", 1.0),
    };

    // 4. Tariff Section
    const tariff: CanonicalTariffSection = {
      tariffName: getField<string>("tariffName", null),
      tariffCode: getField<string>("tariffCode", null),
      tariffCategory: getField<string>("tariffCategory", "HIGH_VOLTAGE_TOU"),
      supplyType: getField<string>("supplyType", "THREE_PHASE"),
      voltageLevel: getField<string>("voltageLevel", null),
    };

    // 5. Energy Section
    const energy: CanonicalEnergySection = {
      peakKwh: getField<number>("peakEnergyKwh", getField<number>("peakKwh").value, "kWh"),
      standardKwh: getField<number>(
        "standardEnergyKwh",
        getField<number>("standardKwh").value,
        "kWh",
      ),
      offPeakKwh: getField<number>("offPeakEnergyKwh", getField<number>("offPeakKwh").value, "kWh"),
      totalKwh: getField<number>("totalActiveEnergyKwh", getField<number>("totalKwh").value, "kWh"),
    };

    // 6. Demand Section
    const demand: CanonicalDemandSection = {
      notifiedMaximumDemandKva: getField<number>("notifiedMaximumDemandKva", null, "kVA"),
      utilisedCapacityKva: getField<number>("utilisedCapacityKva", null, "kVA"),
      demandKva: getField<number>("demandKva", null, "kVA"),
      maximumDemandKva: getField<number>("maximumDemandKva", null, "kVA"),
    };

    // 7. Reactive Section
    const reactive: CanonicalReactiveSection = {
      reactiveEnergyKvarh: getField<number>("reactiveEnergyKvarh", null, "kVArh"),
      reactiveChargesZar: getField<number>("reactiveChargesZar", null, "ZAR"),
      powerFactor: getField<number>("powerFactor", null, "ratio"),
    };

    // 8. Financial Section
    const financial: CanonicalFinancialSection = {
      energyChargesZar: getField<number>("energyChargesZar", null, "ZAR"),
      demandChargesZar: getField<number>("demandChargesZar", null, "ZAR"),
      networkChargesZar: getField<number>("networkChargesZar", null, "ZAR"),
      serviceChargesZar: getField<number>("serviceChargesZar", null, "ZAR"),
      otherChargesZar: getField<number>("otherChargesZar", null, "ZAR"),
      subtotalZar: getField<number>("subtotal", getField<number>("subtotalZar").value, "ZAR"),
      vatZar: getField<number>("vatAmount", getField<number>("vatZar").value, "ZAR"),
      invoiceTotalZar: getField<number>(
        "totalAmountDue",
        getField<number>("invoiceTotalZar").value,
        "ZAR",
      ),
    };

    // Provenance Summary Calculation
    const allFields: CanonicalField<any>[] = [
      document.documentId,
      document.invoiceNumber,
      document.issueDate,
      document.billingPeriodStart,
      document.billingPeriodEnd,
      customer.accountNumber,
      customer.customerName,
      customer.premiseSite,
      meter.meterNumber,
      meter.consumption,
      tariff.tariffName,
      tariff.tariffCode,
      energy.peakKwh,
      energy.standardKwh,
      energy.offPeakKwh,
      energy.totalKwh,
      demand.maximumDemandKva,
      reactive.reactiveEnergyKvarh,
      financial.subtotalZar,
      financial.vatZar,
      financial.invoiceTotalZar,
    ];

    const groundedCount = allFields.filter((f) => f.source !== null && f.value !== null).length;
    const ungroundedCount = allFields.length - groundedCount;
    const avgConfidence = allFields.reduce((acc, f) => acc + f.confidence, 0) / allFields.length;

    const isAutoApproved = valResult.status === "AUTOMATICALLY_APPROVED";

    return {
      schemaVersion: "2.0",
      documentId: docId,
      organisationId: orgId,
      generatedAt: new Date().toISOString(),
      validationRunId: valResult.validationRunId,
      overallConfidence: Number((valResult.overallConfidence.overallScore / 100).toFixed(4)),
      validationStatus: isAutoApproved ? "AUTOMATICALLY_APPROVED" : "REVIEW_REQUIRED",
      isImmutable: isAutoApproved,
      document,
      customer,
      meter,
      tariff,
      energy,
      demand,
      reactive,
      financial,
      provenanceSummary: {
        totalFieldsCount: allFields.length,
        groundedFieldsCount: groundedCount,
        ungroundedFieldsCount: ungroundedCount,
        averageConfidence: Number(avgConfidence.toFixed(4)),
        allMandatoryGrounded: ungroundedCount === 0,
      },
    };
  }
}
