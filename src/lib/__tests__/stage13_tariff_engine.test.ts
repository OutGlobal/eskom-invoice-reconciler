/**
 * Stage 13 — Tariff Engine Test Suite
 *
 * Validates:
 * 1. Architecture Determination: Inspection of 5 core dimensions
 *    (hard-coded, database-driven, manually entered, uploaded, versioned)
 * 2. Controlled Persistent Storage: Persistence, indexing, querying by code, version, and family
 * 3. Temporal Validity Periods: Dynamic selection of tariffs based on invoice billing period
 * 4. Strict Historical Immutability: Prohibiting mutations to historical or locked tariffs
 * 5. Historical Reproducibility: Historical invoices evaluate against historical tariffs reproducibly
 * 6. Pro-Rata Mid-Period Splitting: Splitting billing periods crossing annual April 1 fiscal boundaries
 */

import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js-light";
import { TariffStorageService } from "@/domain/tariff/tariffStorageService";
import { TariffVersionSelector } from "@/domain/tariff/tariffVersionSelector";
import { DeterministicTariffEngine } from "@/domain/tariff/deterministicEngine";
import { DeterministicReconciliationEngine } from "@/domain/reconciliation/reconciliationEngine";
import {
  TariffImmutabilityViolationError,
  type TariffVersionDefinition,
} from "@/domain/tariff/types";
import {
  ESKOM_MEGAFLEX_2023_2024,
  ESKOM_MEGAFLEX_2024_2025,
  ESKOM_MEGAFLEX_2025_2026,
  ESKOM_MEGAFLEX_2026_2027,
  ESKOM_MINIFLEX_2024_2025,
  ESKOM_MINIFLEX_2025_2026,
  MUNICIPAL_COJ_BULK_2024_2025,
  MUNICIPAL_COJ_BULK_2025_2026,
} from "@/domain/tariff/tariffFixtures";

describe("Stage 13: Tariff Engine", () => {
  beforeEach(() => {
    TariffStorageService.resetToDefaults();
    TariffVersionSelector.reset();
  });

  // =========================================================================
  // Requirement 1: Inspection & Functional Determination
  // =========================================================================
  describe("Requirement 1: Inspection & Architecture Determination", () => {
    it("classifies tariff functionality across all 5 mandatory dimensions", () => {
      const classification = TariffStorageService.getTariffArchitectureClassification();

      // 1. Hard-coded: Default fixtures exist for initialisation and fallback
      expect(classification.is_hardcoded).toBe(true);

      // 2. Database-driven: Integrated with persistent tables and audit trail
      expect(classification.is_database_driven).toBe(true);

      // 3. Manually entered: Supported via /tariff route UI
      expect(classification.is_manually_entered).toBe(true);

      // 4. Uploaded: Supported via TariffDocumentAdapter
      expect(classification.is_uploaded).toBe(true);

      // 5. Versioned: Explicit NERSA validity periods & version identifiers
      expect(classification.is_versioned).toBe(true);

      // Governance & Persistence Invariants
      expect(classification.primary_source).toBe("CONTROLLED_PERSISTENT_STORE");
      expect(classification.historical_immutability_enforced).toBe(true);
      expect(classification.reproducibility_guaranteed).toBe(true);
      expect(classification.supported_validity_periods).toContain("2023/2024");
      expect(classification.supported_validity_periods).toContain("2024/2025");
      expect(classification.supported_validity_periods).toContain("2025/2026");
      expect(classification.supported_validity_periods).toContain("2026/2027");
    });
  });

  // =========================================================================
  // Requirement 2: Controlled Persistent Storage
  // =========================================================================
  describe("Requirement 2: Controlled Persistent Storage & Multi-Utility Catalog", () => {
    it("loads all gazetted production tariff versions from controlled persistent storage", async () => {
      const allVersions = await TariffStorageService.getAllVersions();

      expect(allVersions.length).toBeGreaterThanOrEqual(8);

      // Verify Megaflex versions across cycles
      const megaflexVersions = TariffStorageService.getVersionsByFamily("megaflex");
      expect(megaflexVersions.length).toBeGreaterThanOrEqual(4);

      const codes = megaflexVersions.map((v) => v.header.tariff_code);
      expect(codes).toContain("ESKOM_MEGAFLEX_HV_2023_2024");
      expect(codes).toContain("ESKOM_MEGAFLEX_HV_2024_2025");
      expect(codes).toContain("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(codes).toContain("ESKOM_MEGAFLEX_HV_2026_2027");

      // Verify Municipal multi-utility support
      const municipalVersions = TariffStorageService.getVersionsByFamily("municipal");
      expect(municipalVersions.length).toBeGreaterThanOrEqual(2);
      expect(municipalVersions[0].header.utility).toBe("City of Johannesburg");
    });

    it("retrieves a specific version by code and version label", () => {
      const v2024 = TariffStorageService.getVersion("ESKOM_MEGAFLEX_HV_2024_2025", "2024.1");
      expect(v2024).not.toBeNull();
      expect(v2024?.header.effective_date).toBe("2024-04-01");
      expect(v2024?.header.expiry_date).toBe("2025-03-31");
      expect(v2024?.header.status).toBe("superseded");
      expect(v2024?.header.is_locked).toBe(true);
    });
  });

  // =========================================================================
  // Requirement 3: Support Tariff Validity Periods
  // =========================================================================
  describe("Requirement 3: Temporal Validity Periods Resolution", () => {
    it("resolves the exact tariff version matching historical, current, and future billing dates", () => {
      // 1. Historical 2023/2024 period (June 2023)
      const t2023 = TariffVersionSelector.selectVersionForDate("megaflex", "2023-06-15");
      expect(t2023.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2023_2024");
      expect(t2023.header.version).toBe("2023.1");

      // 2. Historical 2024/2025 period (July 2024)
      const t2024 = TariffVersionSelector.selectVersionForDate("megaflex", "2024-07-15");
      expect(t2024.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2024_2025");
      expect(t2024.header.version).toBe("2024.1");

      // 3. Current 2025/2026 period (June 2025)
      const t2025 = TariffVersionSelector.selectVersionForDate("megaflex", "2025-06-15");
      expect(t2025.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(t2025.header.version).toBe("2025.1");

      // 4. Projected 2026/2027 period (May 2026)
      const t2026 = TariffVersionSelector.selectVersionForDate("megaflex", "2026-05-15");
      expect(t2026.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2026_2027");
      expect(t2026.header.version).toBe("2026.1");

      // Verify rates strictly differ according to NERSA annual gazetted increases
      const peak2023 = t2023.components.find((c) => c.component_code === "PEAK_ENERGY_HIGH")!;
      const peak2024 = t2024.components.find((c) => c.component_code === "PEAK_ENERGY_HIGH")!;
      const peak2025 = t2025.components.find((c) => c.component_code === "PEAK_ENERGY_HIGH")!;
      const peak2026 = t2026.components.find((c) => c.component_code === "PEAK_ENERGY_HIGH")!;

      expect(peak2024.rate_value.toNumber()).toBeGreaterThan(peak2023.rate_value.toNumber());
      expect(peak2025.rate_value.toNumber()).toBeGreaterThan(peak2024.rate_value.toNumber());
      expect(peak2026.rate_value.toNumber()).toBeGreaterThan(peak2025.rate_value.toNumber());
    });

    it("supports municipal tariff validity cycles starting on July 1st", () => {
      const coj2024 = TariffVersionSelector.selectVersionForDate("municipal", "2024-08-15");
      expect(coj2024.header.tariff_code).toBe("COJ_BULK_INDUSTRIAL_2024_2025");
      expect(coj2024.header.effective_date).toBe("2024-07-01");

      const coj2025 = TariffVersionSelector.selectVersionForDate("municipal", "2025-08-15");
      expect(coj2025.header.tariff_code).toBe("COJ_BULK_INDUSTRIAL_2025_2026");
      expect(coj2025.header.effective_date).toBe("2025-07-01");
    });
  });

  // =========================================================================
  // Requirement 4: Strict Historical Immutability (Never Overwrite Historical Tariffs)
  // =========================================================================
  describe("Requirement 4: Strict Historical Immutability & Overwrite Prevention", () => {
    it("throws TariffImmutabilityViolationError when attempting to overwrite a locked historical tariff", async () => {
      // Fetch the locked 2024/2025 Megaflex tariff
      const locked2024 = TariffStorageService.getVersion("ESKOM_MEGAFLEX_HV_2024_2025", "2024.1")!;
      expect(locked2024.header.is_locked).toBe(true);

      // Attempt to maliciously or accidentally modify the peak rate
      const mutatedVersion: TariffVersionDefinition = {
        ...locked2024,
        components: locked2024.components.map((c) =>
          c.component_code === "PEAK_ENERGY_HIGH"
            ? { ...c, rate_value: new Decimal("999.99") } // Tampered rate
            : c,
        ),
      };

      // Invariant: Must reject in-place mutation of locked/historical tariff version
      await expect(TariffStorageService.saveTariffVersion(mutatedVersion)).rejects.toThrow(
        TariffImmutabilityViolationError,
      );

      // Verify stored rate in persistent store is UNCHANGED
      const currentStored = TariffStorageService.getVersion(
        "ESKOM_MEGAFLEX_HV_2024_2025",
        "2024.1",
      )!;
      const peakRate = currentStored.components.find(
        (c) => c.component_code === "PEAK_ENERGY_HIGH",
      )!;
      expect(peakRate.rate_value.toNumber()).not.toBe(999.99);
      expect(peakRate.rate_value.toNumber()).toBe(
        locked2024.components
          .find((c) => c.component_code === "PEAK_ENERGY_HIGH")!
          .rate_value.toNumber(),
      );
    });

    it("allows publishing a new distinct version identifier with an audit trail", async () => {
      const base = ESKOM_MEGAFLEX_2025_2026;

      // Create a legitimate new revision (v2025.2 - e.g. NERSA approved mid-year subsidy adjustment)
      const newVersion: TariffVersionDefinition = {
        ...base,
        header: {
          ...base.header,
          version: "2025.2",
          source_document: "NERSA Gazette Errata Notice 441",
          is_locked: true,
          lock_reason: "Gazetted errata adjustment locked",
        },
      };

      const saveResult = await TariffStorageService.saveTariffVersion(newVersion, {
        userId: "NERA_TARIFF_ADMIN",
        changeSummary: "Published approved mid-year gazette errata version",
      });

      expect(saveResult.success).toBe(true);

      // Verify both 2025.1 and 2025.2 coexist without overwriting historical version
      const v1 = TariffStorageService.getVersion("ESKOM_MEGAFLEX_HV_2025_2026", "2025.1");
      const v2 = TariffStorageService.getVersion("ESKOM_MEGAFLEX_HV_2025_2026", "2025.2");

      expect(v1).not.toBeNull();
      expect(v2).not.toBeNull();
      expect(v1?.header.version).toBe("2025.1");
      expect(v2?.header.version).toBe("2025.2");
    });
  });

  // =========================================================================
  // Requirement 5: Historical Invoice Reproducibility
  // =========================================================================
  describe("Requirement 5: Historical Reconciliation Reproducibility", () => {
    it("reproduces exact historical financial results for a 2024 invoice and differentiates from 2025", () => {
      const consumptionInput = {
        notified_maximum_demand_kva: new Decimal(500),
        utilised_capacity_kva: new Decimal(500),
        maximum_demand_kva: new Decimal(500),
        active_energy_kwh: new Decimal(100000),
        peak_kwh: new Decimal(20000),
        standard_kwh: new Decimal(50000),
        off_peak_kwh: new Decimal(30000),
        reactive_energy_kvarh: new Decimal(10000),
        power_factor: new Decimal(0.95),
      };

      // 1. Historical 2024 billing period (June 2024)
      const historical2024Tariff = TariffVersionSelector.selectVersionForDate(
        "megaflex",
        "2024-06-15",
      );
      const result2024 = DeterministicTariffEngine.calculate(
        {
          ...consumptionInput,
          billing_start: "2024-06-01",
          billing_end: "2024-06-30",
        },
        historical2024Tariff,
      );

      // 2. Current 2025 billing period (June 2025)
      const current2025Tariff = TariffVersionSelector.selectVersionForDate(
        "megaflex",
        "2025-06-15",
      );
      const result2025 = DeterministicTariffEngine.calculate(
        {
          ...consumptionInput,
          billing_start: "2025-06-01",
          billing_end: "2025-06-30",
        },
        current2025Tariff,
      );

      // Invariant 1: 2024 result used 2024 tariff version
      expect(result2024.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2024_2025");
      expect(result2024.tariff_version).toBe("2024.1");

      // Invariant 2: 2025 result used 2025 tariff version
      expect(result2025.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(result2025.tariff_version).toBe("2025.1");

      // Invariant 3: 2025 charges are higher due to annual rate increase
      expect(result2025.subtotal_ex_vat.toNumber()).toBeGreaterThan(
        result2024.subtotal_ex_vat.toNumber(),
      );

      // Invariant 4: Re-running 2024 multiple times yields identical reproducible Decimal results
      const repeatRun2024 = DeterministicTariffEngine.calculate(
        {
          ...consumptionInput,
          billing_start: "2024-06-01",
          billing_end: "2024-06-30",
        },
        historical2024Tariff,
      );

      expect(repeatRun2024.subtotal_ex_vat.toNumber()).toBe(result2024.subtotal_ex_vat.toNumber());
      expect(repeatRun2024.total_inc_vat.toNumber()).toBe(result2024.total_inc_vat.toNumber());
    });

    it("reconciliationEngine automatically resolves historical tariff version from invoice dates", () => {
      // Historical invoice from July 2024
      const historicalDataset = {
        site_id: "SITE-HIST-2024",
        account_number: "ACC-HIST-2024",
        invoice: {
          invoice_number: "INV-HIST-2024-001",
          account_number: "ACC-HIST-2024",
          billing_start: "2024-07-01",
          billing_end: "2024-07-31",
          total_kwh: 50000,
          maximum_demand_kva: 200,
          total_invoice_amount: 120000,
          tariff_code: "Megaflex",
        },
        intervals: [
          {
            meter_id: "MTR-HIST-01",
            timestamp: "2024-07-15T12:00:00.000Z",
            interval_minutes: 30,
            kw: 200,
            kva: 210,
            kwh: 100,
            quality_status: "validated",
          },
        ],
      };

      const record = DeterministicReconciliationEngine.reconcileStoredDataset(historicalDataset);

      // Verify that reconciliation dynamically resolved the 2024/2025 Megaflex tariff
      expect(record.audit_record.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2024_2025");
      expect(record.audit_record.tariff_version).toBe("2024.1");
    });
  });

  // =========================================================================
  // Requirement 6: Mid-Period Pro-Rata Boundary Splitting
  // =========================================================================
  describe("Requirement 6: Pro-Rata Billing Period Splitting Across Fiscal Boundaries", () => {
    it("splits a cross-boundary billing period into sub-periods across April 1 tariff adjustment", () => {
      // Billing period from March 15 to April 15 (crosses April 1 Eskom annual increase)
      const subPeriods = TariffVersionSelector.splitBillingPeriod(
        "megaflex",
        "2025-03-15",
        "2025-04-15",
      );

      expect(subPeriods.length).toBe(2);

      // Sub-period 1: March 15 to March 31 (17 days) -> 2024/2025 Megaflex
      expect(subPeriods[0].sub_period_start).toBe("2025-03-15");
      expect(subPeriods[0].sub_period_end).toBe("2025-03-31");
      expect(subPeriods[0].days_count).toBe(17);
      expect(subPeriods[0].tariff_version.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2024_2025");
      expect(subPeriods[0].tariff_version.header.version).toBe("2024.1");

      // Sub-period 2: April 1 to April 15 (15 days) -> 2025/2026 Megaflex
      expect(subPeriods[1].sub_period_start).toBe("2025-04-01");
      expect(subPeriods[1].sub_period_end).toBe("2025-04-15");
      expect(subPeriods[1].days_count).toBe(15);
      expect(subPeriods[1].tariff_version.header.tariff_code).toBe("ESKOM_MEGAFLEX_HV_2025_2026");
      expect(subPeriods[1].tariff_version.header.version).toBe("2025.1");
    });
  });
});
