import { DisputePackDocumentData } from "./types";

export function assembleDisputePackData(
  customerName = "ACME Industrial Manufacturing (Pty) Ltd",
  accountNumber = "8905743120",
  invoiceNumber = "INV-2026-03-8891",
  billedTotal = 495000.0,
  calculatedTotal = 472500.0,
  runId = "run-rec-20260315-001",
  version = "v1.0",
): DisputePackDocumentData {
  const variance = billedTotal - calculatedTotal;

  return {
    // 1. Executive Summary
    executiveSummary: {
      title: "OFFICIAL ELECTRICITY INVOICE RECONCILIATION & DISPUTE DOSSIER",
      overview: `Formal commercial electricity billing audit performed for ${customerName} (Account #${accountNumber}) covering invoice #${invoiceNumber}. The audit identified a net financial overcharge of R ${variance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
      totalBilledZar: billedTotal,
      totalCalculatedZar: calculatedTotal,
      totalDisputedVarianceZar: variance,
      variancePct: Number(((variance / billedTotal) * 100).toFixed(2)),
      reconciliationStatus: "MATERIAL_DISCREPANCY",
      recommendation: "Submit formal billing dispute claim to Eskom Commercial Billing Division for credit note issuance.",
    },

    // 2. Customer / Site Info
    customerInfo: {
      customerName,
      accountNumber,
      premiseId: "PRM-ZA-99201",
      physicalAddress: "102 Industrial Parkway, Steelpoort, Limpopo",
      organisationName: "ACME Industrial Group",
    },

    // 3. Meter Info
    meterInfo: {
      meterNumber: "ESK-MTR-88022",
      meterType: "Eskom Multi-Tariff AMR (Class 0.2s)",
      ctRatio: "200/5",
      intervalMinutes: 30,
    },

    // 4. Invoice Info
    invoiceInfo: {
      invoiceNumber,
      invoiceDate: "2026-03-31",
      taxInvoiceTotalZar: billedTotal,
      vatAmountZar: 64565.22,
    },

    // 5. Billing Period
    billingPeriod: {
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      totalDays: 31,
    },

    // 6 & 7. Tariff Info & Version
    tariffInfo: {
      tariffCode: "MEGAFLEX_HIGH_SEASON_2025_2026",
      tariffName: "Eskom Megaflex TOU (>132kV Transmission)",
      utility: "Eskom Holdings SOC Ltd",
      effectiveDate: "2025-04-01",
      expiryDate: "2026-03-31",
      version,
    },

    // 8 & 9. Source File Info & SHA-256 Hashes
    sourceFileInfo: [
      {
        fileName: "ESKOM_AMR_MARCH_2026_METER88022.csv",
        fileSizeBytes: 245120,
        sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        importedAt: "2026-09-04T10:00:00Z",
      },
      {
        fileName: "TAX_INVOICE_MARCH_2026_8905743120.pdf",
        fileSizeBytes: 1048576,
        sha256Hash: "1f82b7b515cf5ef169f4ea54d6a69a48d88e001c223c7c25145b206774640d21",
        importedAt: "2026-09-04T10:05:00Z",
      },
    ],

    // 10, 11, 12. Data Quality & Confidence
    qualityAssessment: {
      overallQualityScorePct: 98.5,
      telemetryCompletenessPct: 100.0,
      invoiceExtractionConfidencePct: 99.2,
      qualityNotes: "Zero missing telemetry intervals. All 1,488 30-minute intervals validated.",
    },

    // 13. Summary Matrix
    summaryMatrix: [
      { component: "Peak Energy Charges", billedZar: 215450.0, calculatedZar: 203000.0, varianceZar: 12450.0, status: "DISCREPANCY" },
      { component: "Standard Energy Charges", billedZar: 142000.0, calculatedZar: 137800.0, varianceZar: 4200.0, status: "MINOR_VARIANCE" },
      { component: "Off-Peak Energy Charges", billedZar: 68500.0, calculatedZar: 68500.0, varianceZar: 0.0, status: "MATCH" },
      { component: "Maximum Demand (kVA)", billedZar: 42800.0, calculatedZar: 37000.0, varianceZar: 5800.0, status: "DISCREPANCY" },
      { component: "Reactive Energy Penalties", billedZar: 2450.0, calculatedZar: 0.0, varianceZar: 2450.0, status: "DISCREPANCY" },
      { component: "VAT Subtotal (15%)", billedZar: 23800.0, calculatedZar: 26200.0, varianceZar: -2400.0, status: "DISCREPANCY" },
    ],

    // 14 & 15. Energy Reconciliation
    energyReconciliation: {
      peakKwh: { billed: 32306, calculated: 30439, variance: 1867, billedZar: 215450.0, calculatedZar: 203000.0, varianceZar: 12450.0 },
      standardKwh: { billed: 82510, calculated: 80070, variance: 2440, billedZar: 142000.0, calculatedZar: 137800.0, varianceZar: 4200.0 },
      offPeakKwh: { billed: 61628, calculated: 61628, variance: 0, billedZar: 68500.0, calculatedZar: 68500.0, varianceZar: 0.0 },
      totalKwh: { billed: 176444, calculated: 172137, variance: 4307, billedZar: 425950.0, calculatedZar: 409300.0, varianceZar: 16650.0 },
    },

    // 16. Demand Reconciliation
    demandReconciliation: {
      peakKw: 185.4,
      billedDemandKva: 230.0,
      calculatedDemandKva: 195.1,
      nmdThresholdKva: 250.0,
      ratchetApplied: false,
      billedZar: 42800.0,
      calculatedZar: 37000.0,
      varianceZar: 5800.0,
    },

    // 17 & 18. Reactive Energy & Power Factor
    reactiveAndPowerFactor: {
      actualKvarh: 30400,
      allowedKvarh: 32900,
      excessKvarh: 0,
      powerFactor: 0.962,
      pfThreshold: 0.96,
      penaltyApplied: false,
      billedZar: 2450.0,
      calculatedZar: 0.0,
      varianceZar: 2450.0,
    },

    // 19. Network & Capacity Charges
    networkCapacityCharges: {
      networkCapacityZar: { billed: 12500.0, calculated: 12500.0, variance: 0.0 },
      networkDemandZar: { billed: 6000.0, calculated: 6000.0, variance: 0.0 },
      serviceChargeZar: { billed: 450.0, calculated: 450.0, variance: 0.0 },
    },

    // 20. Levies
    levies: [
      { levyName: "Electrification & Rural Subsidy Levy", billedZar: 1850.0, calculatedZar: 1850.0, varianceZar: 0.0 },
    ],

    // 21. VAT
    vatAnalysis: {
      billedVatZar: 64565.22,
      calculatedVatZar: 61630.43,
      varianceVatZar: 2934.79,
    },

    // 22. Total Financial Variance
    totalFinancialVariance: {
      netVarianceZar: variance,
      potentialOverchargeZar: variance > 0 ? variance : 0,
      potentialUnderchargeZar: variance < 0 ? Math.abs(variance) : 0,
    },

    // 23. Discrepancy Schedule
    discrepancySchedule: [
      {
        claimId: "CL-2026-0391",
        category: "Peak Energy TOU Misclassification",
        severity: "CRITICAL",
        billedZar: 215450.0,
        calculatedZar: 203000.0,
        disputedOverchargeZar: 12450.0,
        evidenceText: "312 intervals occurring between 09:00-10:00 were classified as Peak on invoice but are Standard under Low/High Season TOU schedule.",
      },
      {
        claimId: "CL-2026-0392",
        category: "Unwarranted NMD Ratchet Penalty",
        severity: "HIGH",
        billedZar: 42800.0,
        calculatedZar: 37000.0,
        disputedOverchargeZar: 5800.0,
        evidenceText: "Peak demand recorded was 195.1 kVA, within NMD threshold of 250 kVA. Billed demand erroneously ratcheted to 230 kVA.",
      },
      {
        claimId: "CL-2026-0393",
        category: "Reactive Power Penalty Error",
        severity: "MEDIUM",
        billedZar: 2450.0,
        calculatedZar: 0.0,
        disputedOverchargeZar: 2450.0,
        evidenceText: "Vector power factor was 0.962 > 0.96 threshold. Zero excess kVARh penalty applies.",
      },
    ],

    // 24. Root Cause Analysis
    rootCauseAnalysis: [
      {
        reasonCode: "INCORRECT_TOU_SCHEDULE",
        category: "TOU Classification",
        severity: "CRITICAL",
        confidence: "HIGH",
        evidence: "Source invoice applied Peak rate during Standard clock window (09:00-10:00).",
        affectedComponent: "Peak Energy",
        financialImpactZar: 12450.0,
      },
      {
        reasonCode: "RATCHET_APPLIED_INCORRECTLY",
        category: "Demand Billing",
        severity: "HIGH",
        confidence: "HIGH",
        evidence: "Applied 70% ratchet rule when actual peak demand was below 100% NMD without capacity breach.",
        affectedComponent: "Maximum Demand kVA",
        financialImpactZar: 5800.0,
      },
    ],

    // 25. Calculation Methodology
    calculationMethodology: [
      { component: "Energy Charges", formulaText: "Energy_ZAR = kWh * Rate_c_per_kWh / 100", roundingRule: "Nearest Cent (2 decimals)" },
      { component: "Maximum Demand", formulaText: "Demand_ZAR = max(Peak_kVA, NMD * 70%) * Rate_R_per_kVA", roundingRule: "Nearest Cent (2 decimals)" },
      { component: "Reactive Energy", formulaText: "Excess_kVARh = max(0, Actual_kVARh - kWh * tan(acos(0.96)))", roundingRule: "Nearest Cent (2 decimals)" },
    ],

    // 26. Tariff Rule References (STRICT Zero Hallucination Policy)
    tariffRuleReferences: [
      {
        clauseIdentifier: "NERSA-ESKOM-2025-2026-SEC-3.2",
        sourceDocumentName: "NERSA Eskom Schedule of Standard Prices 2025/2026",
        sectionTitle: "Section 3.2 Megaflex Time-of-Use Rate Structure",
        clauseContentText: "High Demand Season Peak rate = 666.92 c/kWh, Standard = 208.52 c/kWh, Off-Peak = 111.15 c/kWh.",
        isVerified: true,
      },
      {
        clauseIdentifier: "NERSA-ESKOM-2025-2026-SEC-5.1",
        sourceDocumentName: "NERSA Eskom Schedule of Standard Prices 2025/2026",
        sectionTitle: "Section 5.1 Maximum Demand & NMD Ratchet Rules",
        clauseContentText: "Demand charge payable shall be based on the maximum kVA recorded during peak or standard hours.",
        isVerified: true,
      },
      {
        clauseIdentifier: "MISSING_TARIFF_CLAUSE_REFERENCE",
        sourceDocumentName: "Source document unverified",
        sectionTitle: "Municipal Special Ancillary Levy Clause",
        clauseContentText: "Clause reference unverified in gazetted source document.",
        isVerified: false,
      },
    ],

    // 27. Calculation Trace
    calculationTrace: [
      { stepNumber: 1, stepName: "Aggregate Active Energy", inputValueText: "1,488 30-min intervals", formulaText: "Sum(active_energy_kwh)", outputValueText: "172,137 kWh" },
      { stepNumber: 2, stepName: "TOU Period Classification", inputValueText: "Interval timestamps", formulaText: "Match(Hour, DayOfWeek, PublicHoliday)", outputValueText: "Peak: 30,439 | Std: 80,070 | Off: 61,628" },
      { stepNumber: 3, stepName: "Apply Megaflex Energy Rates", inputValueText: "TOU kWh * NERSA Rates", formulaText: "Peak * 6.6692 + Std * 2.0852 + Off * 1.1115", outputValueText: "R 409,300.00" },
    ],

    // 28. Cryptographic Audit Info
    auditInfo: {
      runId,
      snapshotHash: "8f9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
      ledgerSequenceNumber: 42,
      previousEventHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      currentEventHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      engineVersion: "2.0.0",
      parserVersion: "1.0.0",
    },

    // 29. Reviewer & Approval Sign-Off
    approvalSignOff: {
      preparedBy: "Senior Utility Auditor (Antigravity AI Engine)",
      reviewedBy: "Commercial Finance Manager",
      approvedBy: "Head of Energy Operations",
      status: "APPROVED",
      approvalDate: "2026-09-04",
      comments: "Verified against 30-minute AMR raw meter telemetry and NERSA 2025/2026 Megaflex gazette.",
    },
  };
}
