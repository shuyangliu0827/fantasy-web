// lib/season.ts
// Shared NBA season helpers — reuse everywhere instead of hardcoding season text.
// NBA regular season typically starts in October, so:
//   Oct–Dec → season is "YYYY-(YY+1)"   e.g. Oct 2025 → "2025-26"
//   Jan–Sep → season started last year   e.g. Mar 2026 → "2025-26"
//
// Both functions accept an optional `date` parameter so callers can pass an explicit
// UTC date rather than relying on the system clock. This makes them testable and
// prevents module-level constants from freezing the season at cold-start time.
// Always use UTC month so the result is the same regardless of server/client timezone.

/**
 * Returns the NBA season label for the given date, e.g. "2025-26".
 * Defaults to the current UTC date when no argument is provided.
 */
export function getCurrentSeasonLabel(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-indexed; October = 9
  if (month >= 9) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/**
 * Returns the ending year of the NBA season for the given date as a number.
 * e.g. during 2025-26 season → 2026
 * Useful for API calls that expect a single season year.
 * Defaults to the current UTC date when no argument is provided.
 */
export function getCurrentSeasonYear(date: Date = new Date()): number {
  const month = date.getUTCMonth();
  return month >= 9 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
}
