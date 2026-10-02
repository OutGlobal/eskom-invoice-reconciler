/**
 * Shared Date Handling Utilities
 * Timezone-deterministic date formatting and SAST (UTC+2) utilities
 */

/**
 * Checks whether an unknown input is a valid non-NaN Date
 */
export function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Safely parses any date representation into a Date object or null if unparseable
 */
export function parseDateSafe(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === "string" || typeof input === "number") {
    const parsed = new Date(input);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Formats a date into ISO calendar format (YYYY-MM-DD)
 */
export function formatDateIso(date: Date | string | null | undefined): string {
  const parsed = parseDateSafe(date);
  if (!parsed) return "";
  return parsed.toISOString().split("T")[0];
}

/**
 * Formats a date into human-readable business format (e.g. "15 Jun 2025")
 */
export function formatDateHuman(date: Date | string | null | undefined): string {
  const parsed = parseDateSafe(date);
  if (!parsed) return "-";
  return parsed.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats a date & time into standard timestamp format (e.g. "2025-06-15 14:30:00")
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  const parsed = parseDateSafe(date);
  if (!parsed) return "-";
  const iso = parsed.toISOString();
  return iso.replace("T", " ").substring(0, 19);
}

/**
 * Converts a UTC Date into local South Africa Standard Time (SAST, UTC+2)
 */
export function toSastDate(date: Date | string): Date {
  const parsed = parseDateSafe(date) || new Date();
  const sastMs = parsed.getTime() + 2 * 60 * 60 * 1000;
  return new Date(sastMs);
}

/**
 * Formats any Date into an official local SAST representation (YYYY-MM-DD HH:mm:ss)
 */
export function formatSastTimestamp(date: Date | string): string {
  const sast = toSastDate(date);
  const year = sast.getUTCFullYear();
  const month = String(sast.getUTCMonth() + 1).padStart(2, "0");
  const day = String(sast.getUTCDate()).padStart(2, "0");
  const hour = String(sast.getUTCHours()).padStart(2, "0");
  const minute = String(sast.getUTCMinutes()).padStart(2, "0");
  const second = String(sast.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

/**
 * Determines if two closed date intervals [startA, endA] and [startB, endB] overlap
 */
export function doDateRangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA.getTime() <= endB.getTime() && endA.getTime() >= startB.getTime();
}
