/**
 * Comprehensive Production Tariff Engine Verification Test Suite
 * ===============================================================
 * Validates the core architectural principles of the ENERA Production Tariff Engine:
 * 1. Deterministic: Decimal.js-light arbitrary precision arithmetic
 * 2. Versioned: Explicit version labels and validity periods
 * 3. Effective-date aware: Eskom (Apr 1 - Mar 31) and Municipal (Jul 1 - Jun 30) cycles
 * 4. Evidence-based: Gazette references, checksums, and rate lineage explanations
 * 5. Configuration-driven: Rules and components defined as data, not hardcoded logic
 * 6. Auditable: Step-by-step CalculationAuditStep trace for all billed components
 * 7. Multi-site capable: Site and meter-level temporal assignments (TariffAssignmentEngine)
 * 8. Multi-utility: Eskom (Megaflex, Miniflex, Nightsave) and Municipal (CoJ Bulk Industrial)
 * 9. Separation of Extracted vs Approved: Extracted tariffs must be approved prior to reconciliation
 * 10. Strict Historical Immutability: Historical tariffs locked against in-place mutation
 */

import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import {
  TariffStorageService,
  TariffVersionSelector,
  DeterministicTariffEngine,
  TariffApprovalService,
  TariffAssignmentEngine,
  TariffValidationEngine,
  TouScheduleEngine,
  explainAppliedRateByRule,
  TariffImmutabilityViolationError,
  UnapprovedTariffReconciliationError,
  type TariffVersionDefinition,
  type DeterministicCalculationInput,
} from "@/domain/tariff";
import {
  ESKOM_MEGAFLEX_2024_2025,
  ESKOM_MEGAFLEX_2025_2026,
  ESKOM_MINIFLEX_2025_2026,
  ESKOM_NIGHTSAVE_2025_2026,
  MUNICIPAL_COJ_BULK_2024_2025,
  MUNICIPAL_COJ_BULK_2025_2026,
} from "@/domain/tariff/tariffFixtures";

describe("ENERA Production Tariff Engine — Architecture & Principles", () => {
  beforeEach(() => {
    TariffStorageService.resetToDefaults();
    TariffVersionSelector.reset();
    TariffAssignmentEngine.clearAssignments();
  });

  // =========================================================================
  // Principle 1: Deterministic Calculations & Exact Decimal Math
  // =========================================================================
  describe("Principle 1: Deterministic Charge Calculations", () => {
    it("evaluates active energy, demand, fixed, and statutory charges with exact Decimal math", () => {
      const input: DeterministicCalculationInput = {
        billing_start: "2025-06-01",
        billing_end: "2025-06-30",
        notified_maximum_demand_kva: new Decimal(1000),
        utilised_capacity_kva: new Decimal(850),
        maximum_demand_kva: new Decimal(850),
        active_energy_kwh: new Decimal(250000),
        peak_kwh: new Decimal(50000),
        standard_kwh: new Decimal(120000),
        off_peak_kwh: new Decimal(80000),
        reactive_energy_kvarh: new Decimal(40000),
        power_factor: new Decimal(0.96),
      };

      const result = DeterministicTariffEngine.calculateTariff(input, ESKOM_MEGAFLEX_2025_2026);

      // Determinism & Structure
      expect(result.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(result.season).toBe("high");
      expect(result.billing_days).toBe(30);
      expect(result.items.length).toBeGreaterThanOrEqual(6);

      // Verify line items
      const peakItem = result.items.find((i) => i.component_code === "PEAK_ENERGY_HIGH");
      expect(peakItem).toBeDefined();
      expect(peakItem?.quantity.toNumber()).toBe(50000);
      expect(peakItem?.unit).toBe("c/kWh");
      // Rand amount = 50000 * 666.92 / 100 = 333460.00
      expect(peakItem?.amount_zar.toNumber()).toBe(333460.0);

      // Subtotal Ex-VAT and 15% VAT
      const expectedVat = result.subtotal_ex_vat
        .mul(new Decimal("0.15"))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      expect(result.vat_amount.toNumber()).toBe(expectedVat.toNumber());
      expect(result.total_inc_vat.toNumber()).toBe(
        result.subtotal_ex_vat.add(expectedVat).toNumber(),
      );

      // Step-by-step audit trace exists for every item
      expect(result.audit_trace.length).toBe(result.items.length);
      result.audit_trace.forEach((step) => {
        expect(step.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
        expect(step.rule_id).toBeDefined();
        expect(step.formula_used).toBeDefined();
        expect(step.calculated_amount_zar).toBeDefined();
      });
    });
  });

  // =========================================================================
  // Principle 2: Separation of Extracted vs Approved Tariff Rules
  // =========================================================================
  describe("Principle 2: Separation of Extracted vs Approved Tariff Rules", () => {
    it("never treats an AI-extracted tariff as approved merely because extraction confidence is high", async () => {
      // Simulate an AI-extracted tariff from an uploaded document with 100% confidence
      const rawExtractedTariff: TariffVersionDefinition = {
        ...ESKOM_MEGAFLEX_2025_2026,
        header: {
          ...ESKOM_MEGAFLEX_2025_2026.header,
          version: "2025.EXTRACTED",
          status: "draft",
          source_document: "OCR_Eskom_Schedule_Scan.pdf",
          source_hash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef",
          is_locked: false,
        },
      };

      // Submit extracted tariff to approval pipeline
      const submission = await TariffApprovalService.submitExtractedTariff(rawExtractedTariff, {
        confidence: 0.99,
        sourceDocument: "OCR_Eskom_Schedule_Scan.pdf",
      });

      expect(submission.approvalStatus).toBe("pending_approval");
      expect(submission.definition.header.status).toBe("draft");
      expect(submission.definition.header.is_locked).toBe(false);

      // Invariant: Unapproved tariff cannot be used for reconciliation
      expect(
        TariffApprovalService.isTariffApprovedForReconciliation(submission.definition),
      ).toBe(false);

      expect(() => {
        TariffApprovalService.assertApprovedForReconciliation(submission.definition);
      }).toThrow(UnapprovedTariffReconciliationError);
    });

    it("allows a Tariff Specialist to review and formally approve a draft tariff", async () => {
      const draftTariff: TariffVersionDefinition = {
        ...MUNICIPAL_COJ_BULK_2025_2026,
        header: {
          ...MUNICIPAL_COJ_BULK_2025_2026.header,
          tariff_code: "COJ_EXTRACTED_REVIEW_2025",
          version: "2025.1",
          status: "draft",
          approval_status: "pending_approval",
          is_locked: false,
        },
      };

      await TariffApprovalService.submitExtractedTariff(draftTariff, {
        confidence: 0.94,
        sourceDocument: "City_of_Joburg_ByLaw_Gazette.pdf",
      });

      // Human review and approval
      const approval = await TariffApprovalService.approveTariff(
        "COJ_EXTRACTED_REVIEW_2025",
        "2025.1",
        {
          userId: "SPECIALIST_SARAH_M",
          role: "Senior Tariff Specialist",
          notes: "Verified against Official Provincial Gazette Extraordinary #241",
        },
      );

      expect(approval.success).toBe(true);
      expect(approval.approvalStatus).toBe("approved");
      expect(["active", "superseded"]).toContain(approval.definition.header.status);
      expect(approval.definition.header.approved_by).toBe("SPECIALIST_SARAH_M");
      expect(approval.definition.header.is_locked).toBe(true); // Locked upon approval

      // Now safe for reconciliation
      expect(
        TariffApprovalService.isTariffApprovedForReconciliation(approval.definition),
      ).toBe(true);
    });
  });

  // =========================================================================
  // Principle 3: Multi-Site & Meter Tariff Assignment
  // =========================================================================
  describe("Principle 3: Multi-Site & Meter Tariff Assignment", () => {
    it("resolves meter-specific assignment before falling back to site assignment", async () => {
      // Setup site assignment (Megaflex) and specific solar meter assignment (Miniflex)
      await TariffAssignmentEngine.assignTariff({
        site_id: "SITE-JHB-MANUFACTURING",
        site_name: "Johannesburg Heavy Industrial Facility",
        tariff_code: "ESKOM_MEGAFLEX_HV_2025_2026",
        effective_from: "2025-04-01",
        notified_max_demand_kva: 2500,
      });

      await TariffAssignmentEngine.assignTariff({
        site_id: "SITE-JHB-MANUFACTURING",
        meter_id: "MTR-SOLAR-IMPORT-02",
        tariff_code: "ESKOM_MINIFLEX_MV_2025_2026",
        effective_from: "2025-04-01",
        notified_max_demand_kva: 500,
      });

      // 1. Resolve for specific meter -> Miniflex
      const meterRes = await TariffAssignmentEngine.resolveApplicableTariff({
        siteId: "SITE-JHB-MANUFACTURING",
        meterId: "MTR-SOLAR-IMPORT-02",
        billingPeriodStart: "2025-06-15",
      });
      expect(meterRes.assignmentSource).toBe("METER_ASSIGNMENT");
      expect(meterRes.tariffCode).toBe("ESKOM_MINIFLEX_MV_2025_2026");
      expect(meterRes.notifiedMaxDemandKva).toBe(500);

      // 2. Resolve for general site meter -> Megaflex
      const siteRes = await TariffAssignmentEngine.resolveApplicableTariff({
        siteId: "SITE-JHB-MANUFACTURING",
        meterId: "MTR-MAIN-INCOMER-01",
        billingPeriodStart: "2025-06-15",
      });
      expect(siteRes.assignmentSource).toBe("SITE_ASSIGNMENT");
      expect(siteRes.tariffCode).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(siteRes.notifiedMaxDemandKva).toBe(2500);
    });
  });

  // =========================================================================
  // Principle 4: Multi-Utility & Municipal Tariffs
  // =========================================================================
  describe("Principle 4: Multi-Utility Support (Eskom & Municipalities)", () => {
    it("supports Eskom tariff families (Megaflex, Miniflex, Nightsave)", () => {
      const megaflex = TariffVersionSelector.selectVersionForDate("megaflex", "2025-05-01");
      const miniflex = TariffVersionSelector.selectVersionForDate("miniflex", "2025-05-01");
      const nightsave = TariffVersionSelector.selectVersionForDate("nightsave", "2025-05-01");

      expect(megaflex?.header.tariff_family).toBe("megaflex");
      expect(miniflex?.header.tariff_family).toBe("miniflex");
      expect(nightsave?.header.tariff_family).toBe("nightsave");
    });

    it("supports municipal tariff validity cycles starting on July 1st", () => {
      const coj = TariffVersionSelector.selectVersionForDate("municipal", "2025-07-15");
      expect(coj).toBeDefined();
      expect(coj?.header.utility).toBe("City of Johannesburg");
      expect(coj?.header.effective_date).toBe("2025-07-01");
      expect(coj?.header.expiry_date).toBe("2026-06-30");
    });
  });

  // =========================================================================
  // Principle 5: Strict Historical Immutability
  // =========================================================================
  describe("Principle 5: Strict Historical Immutability", () => {
    it("prohibits silent in-place rate mutation of locked historical tariffs", async () => {
      const locked2024 = TariffStorageService.getVersion("ESKOM_MEGAFLEX_HV_2024_2025", "2024.1")!;
      expect(locked2024.header.is_locked).toBe(true);

      const tampered: TariffVersionDefinition = {
        ...locked2024,
        components: locked2024.components.map((c) => ({
          ...c,
          rate_value: new Decimal(1.0),
        })),
      };

      await expect(TariffStorageService.saveTariffVersion(tampered)).rejects.toThrow(
        TariffImmutabilityViolationError,
      );
    });
  });

  // =========================================================================
  // Principle 6: Evidence & Explainability
  // =========================================================================
  describe("Principle 6: Evidence & Explainability", () => {
    it("explains why a rate was applied with official gazette reference and formula", () => {
      const tariff = ESKOM_MEGAFLEX_2025_2026;
      const peakRule = tariff.components.find((c) => c.component_code === "PEAK_ENERGY_HIGH")!;

      const explanation = explainAppliedRateByRule(tariff, peakRule, "2025-06-15");

      expect(explanation.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(explanation.version_number).toBe("2025.1");
      expect(explanation.season).toBe("high");
      expect(explanation.gazette_reference).toBe(tariff.header.source_document);
      expect(explanation.explanation_text).toContain("PEAK_ENERGY_HIGH");
      expect(explanation.explanation_text).toContain("666.92");
    });
  });
});
