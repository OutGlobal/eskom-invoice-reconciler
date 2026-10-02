/**
 * Platform Shared Utilities Registry
 * Unified access to formatting, date handling, validation, error sanitization, and file helpers
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes safely with clsx and twMerge
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Formatting
export * from "./formatting";

// Dates
export * from "./dates";

// Validation
export * from "./validation";

// Errors
export * from "./errors";

// Files
export * from "./files";
