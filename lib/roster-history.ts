// lib/roster-history.ts
// Pure, side-effect-free helpers for roster ownership history.
// No Supabase dependency — safe to import in tests and server-side code.

import type { RosterPlayer } from "./store";

/**
 * Returns only currently active roster players (no releasedAt set),
 * deduplicated by player id. Use this for current-roster display and
 * active-player validation.
 */
export function getCurrentRoster(roster: RosterPlayer[]): RosterPlayer[] {
  const seen = new Set<string>();
  return roster.filter(p => {
    if (p.releasedAt) return false;
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/**
 * Returns players who were active on a specific UTC date (YYYY-MM-DD),
 * deduplicated by player id.
 *
 * A player is considered "active on dateStr" if:
 *   - acquiredAt <= end-of-that-UTC-day  (or acquiredAt is undefined → always owned)
 *   - releasedAt is undefined OR releasedAt > start-of-that-UTC-day
 */
export function getHistoricalRosterForDate(roster: RosterPlayer[], dateStr: string): RosterPlayer[] {
  const dayStartMs = new Date(dateStr + "T00:00:00.000Z").getTime();
  const dayEndMs   = dayStartMs + 86_400_000; // exclusive end of that UTC day
  const seen = new Set<string>();
  return roster.filter(p => {
    const acquired = p.acquiredAt ?? 0;
    // Acquired strictly after end of this day → not on roster yet
    if (acquired >= dayEndMs) return false;
    // Released at or before start of this day → already gone
    if (p.releasedAt !== undefined && p.releasedAt <= dayStartMs) return false;
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
