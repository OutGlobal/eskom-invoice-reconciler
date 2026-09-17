/**
 * Stage 14 — Financial Calculation Integrity Test Suite
 * Validates:
 * 1. Unsafe floating-point calculation prevention
 * 2. Database numeric / decimal type compliance
 * 3. Calculation precision (28-digit working precision, 4-digit determinants, 6-digit rates)
 * 4. Statutory rounding rules (SARS / NERSA symmetric ROUND_HALF_UP)
 * 5. Multi-tiered variance tolerance matrix (Tiers 0 - 4)
 * 6. Internal documentation & Zero Public Disclosure embargo (Level 3 Private)
 * 7. Historical reproducibility down to the exact cent
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js-light";
import fs from "node:fs";
import path from "node:path";
import { FinancialPrecisionEngine } from "@/domain/financial/financialPrecisionEngine";
import { DatabaseTypeRegistry } from "@/domain/financial/databaseTypeRegistry";
import { VarianceTolerancePolicy } from "@/domain/financial/varianceTolerancePolicy";
import { FINANCIAL_INTEGRITY_STANDARDS } from "@/domain/financial/financialIntegrityStandards";

describe("Stage 14: Financial Calculation Integrity", () => {
  describe("Requirement 1: Unsafe Floating-Point Prevention", () => {
    it("demonstrates IEEE-754 binary floating point failures in standard JavaScript", () => {
      // Standard JS binary float addition error
      const jsFloatSum = 0.1 + 0.2;
      expect(jsFloatSum === 0.3).toBe(false);
      expect(jsFloatSum).toBe(0.30000000000000004);

      // Standard JS binary float multiplication error
      const jsFloatMul = 19.99 * 100;
      expect(jsFloatMul === 1999).toBe(false);
      expect(jsFloatMul).toBe(1998.9999999999998);

      // Standard JS toFixed rounding failure (losing a cent on statutory half-up)
      const jsToFixed = (1.005).toFixed(2);
      expect(jsToFixed).toBe("1.00"); // Incorrectly truncated in standard JS engines!
    });

    it("FinancialPrecisionEngine guarantees exact arithmetic without floating-point drift", () => {
      // Exact addition
      const exactSum = FinancialPrecisionEngine.add("0.1", "0.2");
      expect(exactSum.toString()).toBe("0.3");

      // Exact multiplication
      const exactMul = FinancialPrecisionEngine.multiply("19.99", "100");
      expect(exactMul.toString()).toBe("1999");

      // Exact statutory rounding to nearest cent
      const exactRound = FinancialPrecisionEngine.roundCurrency("1.005");
      expect(FinancialPrecisionEngine.formatCurrency(exactRound)).toBe("1.01"); // Correctly rounded up to 1.01!
    });

    it("detects and quantifies floating-point drift between float and Decimal", () => {
      const jsFloat = 0.1 + 0.2;
      const dec = FinancialPrecisionEngine.add("0.1", "0.2");

      const drift = FinancialPrecisionEngine.detectFloatingPointDrift(jsFloat, dec);
      expect(drift.hasDrift).toBe(true);
      expect(drift.difference.gt(0)).toBe(true);
    });

    it("rejects non-finite numbers and empty inputs safely", () => {
      expect(() => FinancialPrecisionEngine.toDecimal(NaN)).toThrow(TypeError);
      expect(() => FinancialPrecisionEngine.toDecimal(Infinity)).toThrow(TypeError);
      expect(() => FinancialPrecisionEngine.toDecimal("   ")).toThrow(TypeError);
      expect(() => FinancialPrecisionEngine.divide(100, 0)).toThrow(RangeError);
    });
  });

  describe("Requirement 2: Database Numeric/Decimal Types", () => {
    it("validates NUMERIC(18,2) for financial currency values", () => {
      const spec = DatabaseTypeRegistry.SPECIFICATIONS["NUMERIC(18,2)"];
      expect(spec.precision).toBe(18);
      expect(spec.scale).toBe(2);
      expect(spec.unit).toBe("ZAR");

      // Valid monetary values
      expect(DatabaseTypeRegistry.validate("1450234.50", "NUMERIC(18,2)").isValid).toBe(true);
      expect(DatabaseTypeRegistry.validate("-50.25", "NUMERIC(18,2)").isValid).toBe(true);

      // Value exceeding precision bounds
      expect(DatabaseTypeRegistry.validate("10000000000000000.00", "NUMERIC(18,2)").isValid).toBe(false);
    });

    it("validates NUMERIC(18,4) for energy and demand determinants", () => {
      const spec = DatabaseTypeRegistry.SPECIFICATIONS["NUMERIC(18,4)"];
      expect(spec.precision).toBe(18);
      expect(spec.scale).toBe(4);

      // Determinant values with up to 4 decimal places
      const result = DatabaseTypeRegistry.validate("45678.1234", "NUMERIC(18,4)");
      expect(result.isValid).toBe(true);
      expect(result.formattedValue).toBe("45678.1234");
    });

    it("validates NUMERIC(18,6) for gazetted tariff rates and telemetry measurements", () => {
      const spec = DatabaseTypeRegistry.SPECIFICATIONS["NUMERIC(18,6)"];
      expect(spec.precision).toBe(18);
      expect(spec.scale).toBe(6);

      // Micro-cent rate (e.g. c/kWh rate with 6 decimals)
      const result = DatabaseTypeRegistry.validate("342.158725", "NUMERIC(18,6)");
      expect(result.isValid).toBe(true);
      expect(result.formattedValue).toBe("342.158725");
    });

    it("assertTypeCompliance throws TypeError on invalid database bounds", () => {
      expect(() => {
        DatabaseTypeRegistry.assertTypeCompliance("9999999999999999999999.00", "NUMERIC(18,2)", "total_zar");
      }).toThrow(TypeError);
    });
  });

  describe("Requirement 3: Calculation Precision", () => {
    it("operates at 28 digits intermediate working precision without loss", () => {
      expect(FinancialPrecisionEngine.CONFIG.workingPrecision).toBe(28);

      // High precision division that would truncate in 64-bit IEEE float
      const highPrecisionVal = FinancialPrecisionEngine.divide("1", "3");
      // Must have 28 significant digits
      expect((highPrecisionVal as any).precision()).toBe(28);
      expect(highPrecisionVal.toString().startsWith("0.3333333333333333333333333333")).toBe(true);
    });

    it("multiplyAndDivide prevents intermediate truncation error during rate scaling", () => {
      // Calculation: 12,345.6789 kWh at 234.567891 c/kWh / 100
      const quantity = new Decimal("12345.6789");
      const rate = new Decimal("234.567891");

      const intermediate = FinancialPrecisionEngine.multiplyAndDivide(quantity, rate, 100);
      const rounded = FinancialPrecisionEngine.roundCurrency(intermediate);

      // 12345.6789 * 234.567891 = 2895899.9806454999 / 100 = 28958.999806454999 -> R 28,959.00
      expect(FinancialPrecisionEngine.formatCurrency(rounded)).toBe("28959.00");
    });
  });

  describe("Requirement 4: Statutory Rounding Rules (SARS & NERSA)", () => {
    it("strictly follows statutory symmetric ROUND_HALF_UP", () => {
      // Positive numbers >= 0.5 cent round away from zero
      expect(FinancialPrecisionEngine.formatCurrency("10.005")).toBe("10.01");
      expect(FinancialPrecisionEngine.formatCurrency("10.004")).toBe("10.00");
      expect(FinancialPrecisionEngine.formatCurrency("10.0049")).toBe("10.00");
      expect(FinancialPrecisionEngine.formatCurrency("10.0051")).toBe("10.01");

      // Negative numbers (adjustments/credits) round symmetrically away from zero
      expect(FinancialPrecisionEngine.formatCurrency("-10.005")).toBe("-10.01");
      expect(FinancialPrecisionEngine.formatCurrency("-10.004")).toBe("-10.00");
    });

    it("maintains strict line-item to subtotal mathematical consistency", () => {
      // 3 items with fractional half-cents
      const item1 = FinancialPrecisionEngine.calculateLineItem("100.5", "125.5", "c/kWh", "PEAK", "Peak Energy");
      const item2 = FinancialPrecisionEngine.calculateLineItem("200.25", "95.2", "c/kWh", "STD", "Standard Energy");
      const item3 = FinancialPrecisionEngine.calculateLineItem("30", "150.75", "R/kVA", "DEMAND", "Demand Charge");

      const totals = FinancialPrecisionEngine.calculateReconciliationTotals([item1, item2, item3]);

      // Subtotal MUST equal sum of rounded items
      const expectedSubtotal = item1.roundedAmount.plus(item2.roundedAmount).plus(item3.roundedAmount);
      expect(totals.subtotalExVat.equals(expectedSubtotal)).toBe(true);

      // VAT (15%) must equal roundCurrency(Subtotal * 0.15)
      const expectedVat = FinancialPrecisionEngine.roundCurrency(totals.subtotalExVat.times(0.15));
      expect(totals.vatAmount.equals(expectedVat)).toBe(true);

      // Total must equal Subtotal + VAT
      const expectedTotal = totals.subtotalExVat.plus(totals.vatAmount);
      expect(totals.totalIncVat.equals(expectedTotal)).toBe(true);
    });
  });

  describe("Requirement 5: Five-Tier Variance Tolerance Matrix", () => {
    it("Tier 0: classifies variance <= R 0.10 as PASS_ROUNDING_ACCEPTABLE", () => {
      const billed = new Decimal("50000.05");
      const calculated = new Decimal("50000.00");

      const result = VarianceTolerancePolicy.evaluate(billed, calculated, "TOTAL_INVOICE_ZAR");
      expect(result.tier).toBe("TIER_0_IMMATERIAL_ROUNDING");
      expect(result.status).toBe("PASS_ROUNDING_ACCEPTABLE");
      expect(result.isRoundingOnly).toBe(true);
      expect(result.isWithinTolerance).toBe(true);
    });

    it("Tier 1: classifies variance <= R 50.00 and <= 0.5% as PASS_WITHIN_TOLERANCE", () => {
      const billed = new Decimal("100025.00");
      const calculated = new Decimal("100000.00"); // R 25.00 variance = 0.025%

      const result = VarianceTolerancePolicy.evaluate(billed, calculated, "TOTAL_INVOICE_ZAR");
      expect(result.tier).toBe("TIER_1_ACCEPTABLE_TOLERANCE");
      expect(result.status).toBe("PASS_WITHIN_TOLERANCE");
      expect(result.isWithinTolerance).toBe(true);
      expect(result.isMaterial).toBe(false);
    });

    it("Tier 2: classifies non-material variance > R 50.00 as WARNING_FLAGGED", () => {
      const billed = new Decimal("101500.00");
      const calculated = new Decimal("100000.00"); // R 1,500.00 variance = 1.48% (> 0.5% and > R 50, but < 2% and < R 5,000)

      const result = VarianceTolerancePolicy.evaluate(billed, calculated, "TOTAL_INVOICE_ZAR");
      expect(result.tier).toBe("TIER_2_WARNING_NON_MATERIAL");
      expect(result.status).toBe("WARNING_FLAGGED");
      expect(result.isWithinTolerance).toBe(false);
      expect(result.isMaterial).toBe(false);
    });

    it("Tier 3: classifies variance > R 5,000.00 as MATERIAL_DISCREPANCY", () => {
      const billed = new Decimal("108000.00");
      const calculated = new Decimal("100000.00"); // R 8,000.00 variance = 8.0%

      const result = VarianceTolerancePolicy.evaluate(billed, calculated, "TOTAL_INVOICE_ZAR");
      expect(result.tier).toBe("TIER_3_MATERIAL_DISCREPANCY");
      expect(result.status).toBe("MATERIAL_DISCREPANCY");
      expect(result.isMaterial).toBe(true);
      expect(result.isCritical).toBe(false);
    });

    it("Tier 4: classifies variance > R 50,000.00 or > 10% as CRITICAL_ANOMALY", () => {
      const billed = new Decimal("175000.00");
      const calculated = new Decimal("100000.00"); // R 75,000.00 variance = 75.0%

      const result = VarianceTolerancePolicy.evaluate(billed, calculated, "TOTAL_INVOICE_ZAR");
      expect(result.tier).toBe("TIER_4_CRITICAL_ANOMALY");
      expect(result.status).toBe("CRITICAL_ANOMALY");
      expect(result.isCritical).toBe(true);
      expect(result.explanation).toContain("CRITICAL ANOMALY");
    });

    it("evaluates component-specific tolerances for active energy, demand, and reactive power", () => {
      // Demand tolerance: <= 5 kVA is within tolerance
      const demandOk = VarianceTolerancePolicy.evaluate("104.5", "100.0", "DEMAND_KVA");
      expect(demandOk.isWithinTolerance).toBe(true);

      // Demand discrepancy: 60 kVA (> 50 kVA material threshold, 6.0% between 2% and 10%) is material
      const demandMaterial = VarianceTolerancePolicy.evaluate("1000.0", "940.0", "DEMAND_KVA");
      expect(demandMaterial.tier).toBe("TIER_3_MATERIAL_DISCREPANCY");
    });
  });

  describe("Requirement 6: Internal Documentation & Zero Public Disclosure (Level 3 Private)", () => {
    it("internal technical specification document exists and contains comprehensive rules", () => {
      const specPath = path.resolve(process.cwd(), "src/domain/financial/financialIntegritySpecification.md");
      expect(fs.existsSync(specPath)).toBe(true);

      const content = fs.readFileSync(specPath, "utf8");
      expect(content).toContain("CONFIDENTIALITY NOTICE — LEVEL 3 PRIVATE EMBARGO");
      expect(content).toContain("Prevention of Unsafe Floating-Point Drift");
      expect(content).toContain("NUMERIC(18,2)");
      expect(content).toContain("ROUND_HALF_UP");
      expect(content).toContain("Five-Tier Variance Tolerance Policy");
    });

    it("programmatic standards codify statutory citations and embargo level", () => {
      expect(FINANCIAL_INTEGRITY_STANDARDS.embargoLevel).toBe("LEVEL_3_PRIVATE");
      expect(FINANCIAL_INTEGRITY_STANDARDS.precisionStandards.intermediateWorkingDigits).toBe(28);
      expect(FINANCIAL_INTEGRITY_STANDARDS.regulatoryReferences.sarsVatAct).toContain("South African Value-Added Tax Act");
    });

    it("public landing and website files do NOT expose proprietary calculation logic or internal thresholds", () => {
      const publicFiles = [
        path.resolve(process.cwd(), "src/routes/index.tsx"),
      ];

      const publicDir = path.resolve(process.cwd(), "src/components/landing/enera");
      if (fs.existsSync(publicDir)) {
        const componentFiles = fs.readdirSync(publicDir)
          .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
          .map((f) => path.join(publicDir, f));
        publicFiles.push(...componentFiles);
      }

      // Disallowed proprietary strings in public files
      const embargoedTerms = [
        "FINANCIAL_INTEGRITY_STANDARDS",
        "tier0RoundingThresholdZar",
        "tier4CriticalThresholdZar",
        "public.reconciliation_runs",
        "roundingOnlyThreshold",
      ];

      for (const file of publicFiles) {
        if (!fs.existsSync(file)) continue;
        const text = fs.readFileSync(file, "utf8");
        for (const term of embargoedTerms) {
          expect(text.includes(term), `Public file ${path.basename(file)} leaked embargoed term '${term}'`).toBe(false);
        }
      }
    });
  });

  describe("Requirement 7: Historical Reproducibility Down to the Exact Cent", () => {
    it("produces identical SHA-256 checksum and exact cent values across repeated runs", () => {
      const inputDataset = {
        invoiceNumber: "INV-HISTORICAL-2024-001",
        tariffCode: "ESKOM_MEGAFLEX_HV_2024_2025",
        peakKwh: "125430.5000",
        standardKwh: "345670.2500",
        offPeakKwh: "512400.7500",
        peakRate: "345.123400", // c/kWh
        stdRate: "189.543200",
        offPeakRate: "98.765400",
        demandKva: "1850.5000",
        demandRate: "125.750000", // R/kVA
      };

      const calculateRun = () => {
        const peak = FinancialPrecisionEngine.calculateLineItem(inputDataset.peakKwh, inputDataset.peakRate, "c/kWh", "PEAK", "Peak");
        const std = FinancialPrecisionEngine.calculateLineItem(inputDataset.standardKwh, inputDataset.stdRate, "c/kWh", "STD", "Standard");
        const off = FinancialPrecisionEngine.calculateLineItem(inputDataset.offPeakKwh, inputDataset.offPeakRate, "c/kWh", "OFF", "Off-Peak");
        const dem = FinancialPrecisionEngine.calculateLineItem(inputDataset.demandKva, inputDataset.demandRate, "R/kVA", "DEMAND", "Demand");

        const totals = FinancialPrecisionEngine.calculateReconciliationTotals([peak, std, off, dem]);
        const checksum = FinancialPrecisionEngine.generateReproducibilityChecksum(totals);

        return { totals, checksum };
      };

      const run1 = calculateRun();
      const run2 = calculateRun();
      const run3 = calculateRun();

      // Cent-exact matching
      expect(run1.totals.subtotalExVat.toString()).toBe(run2.totals.subtotalExVat.toString());
      expect(run2.totals.subtotalExVat.toString()).toBe(run3.totals.subtotalExVat.toString());

      expect(run1.totals.vatAmount.toString()).toBe(run2.totals.vatAmount.toString());
      expect(run1.totals.totalIncVat.toString()).toBe(run3.totals.totalIncVat.toString());

      // Cryptographic fingerprint matching
      expect(run1.checksum).toBe(run2.checksum);
      expect(run2.checksum).toBe(run3.checksum);
      expect(run1.checksum).toHaveLength(64);
    });
  });
});
