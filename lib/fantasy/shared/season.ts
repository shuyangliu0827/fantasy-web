// lib/season.ts
// Shared NBA season helpers — reuse everywhere instead of hardcoding season text.
// NBA regular season typically starts in October, so:
//   Oct–Dec → season is "YYYY-(YY+1)"   e.g. Oct 2025 → "2025-26"
//   Jan–Sep → season started last year   e.g. Mar 2026 → "2025-26"
//
// All functions accept an optional `date` parameter so callers can pass an explicit
// UTC date rather than relying on the system clock. This makes them testable and
// prevents module-level constants from freezing the season at cold-start time.
// Always use UTC month so the result is the same regardless of server/client timezone.
//
// SEASON YEAR SEMANTICS — read carefully before using:
//   - getCurrentSeasonLabel()    → "2025-26"   (UI label, both years)
//   - getCurrentSeasonYear()     → 2026        (ENDING year — for UI/league business logic)
//   - getCurrentBdlSeasonYear()  → 2025        (STARTING year — REQUIRED for Ball Don't Lie API)
//
// Ball Don't Lie's `seasons[]` / `season=` query parameters expect the season's
// STARTING year. Calling /stats?seasons[]=2026 or /season_averages?season=2026
// during the 2025-26 season returns 0 rows, which silently breaks the stats
// refresh pipeline. Always use getCurrentBdlSeasonYear() for BDL API calls.

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
 * Returns the ENDING year of the NBA season for the given date as a number.
 * e.g. during 2025-26 season → 2026
 *
 * Use this for UI labels and league/business logic that key off the season's
 * ending year (e.g. "2026 Season Rankings"). Do NOT use this for the Ball
 * Don't Lie API — see getCurrentBdlSeasonYear() instead.
 *
 * Defaults to the current UTC date when no argument is provided.
 */
export function getCurrentSeasonYear(date: Date = new Date()): number {
  const month = date.getUTCMonth();
  return month >= 9 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
}

/**
 * Returns the STARTING year of the NBA season for the given date as a number.
 * e.g. during 2025-26 season → 2025
 *
 * This is the ONLY correct value to pass to Ball Don't Lie API endpoints whose
 * `season` / `seasons[]` parameter encodes an NBA season — including:
 *   - /stats?seasons[]=YYYY
 *   - /season_averages?season=YYYY
 *   - /games?seasons[]=YYYY
 *
 * BDL uses starting-year semantics, while UI labels (and getCurrentSeasonYear)
 * use ending-year semantics. Mixing the two silently returns 0 rows.
 *
 *   Oct 2025 → 2025
 *   Nov 2025 → 2025
 *   Jan 2026 → 2025
 *   May 2026 → 2025
 *   Sep 2026 → 2025
 *   Oct 2026 → 2026
 *
 * Defaults to the current UTC date when no argument is provided.
 */
export function getCurrentBdlSeasonYear(date: Date = new Date()): number {
  const month = date.getUTCMonth(); // 0-indexed; October = 9
  return month >= 9 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}
