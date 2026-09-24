/**
 * Shared Formatting Utilities
 * Standardized representation for currency, energy quantities, percentages, and storage sizes
 */

import { FinancialMath } from "@/domain/services/financialMath";

/**
 * Formats a numeric value into official South African Rand (ZAR) currency representation
 * e.g. 1250000.5 -> "R 1,250,000.50"
 */
export function formatZar(value: number): string {
  const safeVal = isNaN(value) ? 0 : value;
  return (
    "R " +
    FinancialMath.roundCurrency(safeVal).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Formats a generic numeric value with locale separators and configurable decimal precision
 * e.g. 12345.678 -> "12,345.68"
 */
export function formatNumber(value: number, decimals: number = 2): string {
  const safeVal = isNaN(value) ? 0 : value;
  return safeVal.toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formats a percentage value with optional directional plus sign
 * e.g. 1.25 -> "+1.25%" or "-0.50%"
 */
export function formatPercent(value: number, decimals: number = 2, includeSign: boolean = false): string {
  const safeVal = isNaN(value) ? 0 : value;
  const formatted = safeVal.toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (includeSign && safeVal > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Formats an active energy quantity in kilowatt-hours (kWh)
 * e.g. 1500000 -> "1,500,000.00 kWh"
 */
export function formatKWh(value: number, decimals: number = 2): string {
  return `${formatNumber(value, decimals)} kWh`;
}

/**
 * Formats an apparent power or demand quantity in kilovolt-amperes (kVA)
 * e.g. 1250 -> "1,250.00 kVA"
 */
export function formatKVA(value: number, decimals: number = 2): string {
  return `${formatNumber(value, decimals)} kVA`;
}

/**
 * Formats power factor with fixed 3-decimal precision
 * e.g. 0.942 -> "0.942"
 */
export function formatPowerFactor(value: number): string {
  const safeVal = isNaN(value) ? 1.0 : Math.min(1.0, Math.max(0.0, value));
  return safeVal.toFixed(3);
}

/**
 * Formats binary byte counts into human-readable storage units
 * e.g. 1048576 -> "1.00 MB"
 */
export function formatBytes(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const safeIndex = Math.min(i, units.length - 1);
  const size = bytes / Math.pow(1024, safeIndex);
  return `${size.toFixed(safeIndex === 0 ? 0 : 2)} ${units[safeIndex]}`;
}
