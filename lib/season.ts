// lib/season.ts
// Shared NBA season helpers — reuse everywhere instead of hardcoding season text.
// NBA regular season typically starts in October, so:
//   Oct–Dec → season is "YYYY-(YY+1)"   e.g. Oct 2025 → "2025-26"
//   Jan–Sep → season started last year   e.g. Mar 2026 → "2025-26"

/**
 * Returns the current NBA season label, e.g. "2025-26".
 */
export function getCurrentSeasonLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed; October = 9
  if (month >= 9) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/**
 * Returns the ending year of the current NBA season as a number.
 * e.g. during 2025-26 season → 2026
 * Useful for API calls that expect a single season year.
 */
export function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth();
  return month >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}
