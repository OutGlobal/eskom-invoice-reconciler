/**
 * Telemetry XML Feed Layout Adapter
 */

import type { AdapterExtractionResult, ILayoutAdapter } from "./baseAdapter";

export class TelemetryXmlAdapter implements ILayoutAdapter {
  public canHandle(fileExtension: string, mimeType: string): boolean {
    return fileExtension.toLowerCase() === "xml" || mimeType.includes("xml");
  }

  public async extract(
    file: File,
    bytes: Uint8Array,
    jobId: string,
  ): Promise<AdapterExtractionResult> {
    const errors: any[] = [];
    const ambiguityReasons: string[] = [];

    try {
      const text = new TextDecoder("utf-8").decode(bytes);

      if (!text.includes("<") || !text.includes(">")) {
        throw new Error("Invalid or corrupt XML payload structure");
      }

      // Basic regex extraction for XML elements
      const accountMatch = text.match(/<AccountNumber>(.*?)<\/AccountNumber>/i);
      const totalKwhMatch = text.match(/<TotalKwh>(.*?)<\/TotalKwh>/i);
      const totalInvMatch = text.match(/<TotalInvoice>(.*?)<\/TotalInvoice>/i);

      const accountNumber = accountMatch?.[1]?.trim() || "";
      const totalKwh = totalKwhMatch ? Number(totalKwhMatch[1]) : 0;
      const totalInvoice = totalInvMatch ? Number(totalInvMatch[1]) : 0;
      const hasRequiredValues = Boolean(accountNumber && totalKwhMatch && totalInvMatch);

      return {
        success: true,
        documentType: "TELEMETRY_XML",
        extractedFields: {
          accountNumber,
          pod: "",
          premiseId: "",
          meterNumber: "",
          meterSerial: "",
          billingPeriod: "XML Feed Period",
          invoiceDate: "",
          tariff: "",
          voltage: "",
          notifiedMaximumDemand: 0,
          billedMaximumDemand: 0,
          utilisedCapacity: 0,
          peakKwh: 0,
          standardKwh: 0,
          offPeakKwh: 0,
          totalKwh,
          kva: 0,
          kvarh: 0,
          powerFactor: 0,
          energyCharges: 0,
          demandCharges: 0,
          networkCharges: 0,
          serviceCharges: 0,
          ancillaryCharges: 0,
          subsidies: 0,
          vat: totalInvoice * 0.15,
          totalInvoice,
          previousBalance: 0,
          payments: 0,
          adjustments: 0,
          credits: 0,
          debits: totalInvoice,
        },
        rawTextPreview: text.substring(0, 500),
        confidenceScore: hasRequiredValues ? 0.95 : 0.4,
        needsHumanReview: !hasRequiredValues,
        ambiguityReasons: hasRequiredValues ? ambiguityReasons : ["Required XML billing fields are missing"],
        errors,
      };
    } catch (err: any) {
      errors.push({
        id: `ERR-${Date.now()}-xml`,
        jobId,
        errorCode: "XML_PARSER_EXCEPTION",
        errorMessage: err.message || "Failed to parse XML telemetry payload",
        severity: "critical",
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        documentType: "TELEMETRY_XML",
        rawTextPreview: "",
        confidenceScore: 0.0,
        needsHumanReview: true,
        ambiguityReasons: [err.message || "XML parsing exception"],
        errors,
      };
    }
  }
}
