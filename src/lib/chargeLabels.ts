export const CHARGE_LABELS = {
  administration: "Administration Charge",
  transmissionNetwork: "Transmission Network Charge",
  distributionNetwork: "Distribution Network Capacity Charge",
  generationCapacity: "Generation Capacity Charge",
  networkDemand: "Network Demand Charge",
  peakEnergy: "Peak Energy",
  standardEnergy: "Standard Energy",
  offPeakEnergy: "Off-Peak Energy",
  ancillaryService: "Ancillary Service Charge",
  legacy: "Legacy Charge",
  affordabilitySubsidy: "Affordability Subsidy",
  electrificationSubsidy: "Electrification & Rural Subsidy",
  serviceCharge: "Service Charge",
  connectionCharge: "Connection Charge",
  vat: "VAT",
  totalInvoice: "Total Charges",
  totalInclVat: "Total Due",
} as const;

export type ChargeKey = keyof typeof CHARGE_LABELS;
