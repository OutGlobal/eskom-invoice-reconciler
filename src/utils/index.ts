/**
 * Platform Utilities Module
 * Common utilities for class merging, currency/number formatting, and data transformation
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { FinancialMath } from "@/domain/services/financialMath";

/**
 * Merges Tailwind classes safely with clsx and twMerge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a numeric value into official South African Rand (ZAR) currency representation
 */
export function formatZar(value: number): string {
  return (
    "R " +
    FinancialMath.roundCurrency(value).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Formats a generic numeric value with locale separators and configurable precision
 */
export function formatNumber(value: number, decimals: number = 2): string {
  const safeVal = isNaN(value) ? 0 : value;
  return safeVal.toLocaleString("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
