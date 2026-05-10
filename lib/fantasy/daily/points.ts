// lib/contest-points.ts
//
// Pure scoring rules for Daily Fantasy MVP.  No DB imports — safe to use
// on both server and client.
//
// ── Points tiers (highest applicable wins; participation is the floor) ──
//   Rank 1       → 500 pts
//   Rank 2–3     → 400 pts
//   Rank 4–10    → 300 pts
//   Top 10%      → 200 pts
//   Top 25%      → 100 pts
//   Any scored   →  20 pts  (participation floor)
//
// ── Tie-breaking ───────────────────────────────────────────────
// Among lineups with equal total_fpts, the one with the earlier submitted_at
// gets the numerically-lower rank.  Settlement sorts DESC fpts, ASC submitted_at
// before calling assignRanks, so rank 1 always belongs to the earliest
// submitter when scores are tied at the top.  Tied rank entries both receive
// the same points tier (e.g. two rank-2 entries both get 400 pts).

export const PARTICIPATION_POINTS = 20;

/**
 * Returns the points awarded for a given rank and total entry count.
 * Applies the highest applicable tier; participation (20 pts) is the floor.
 */
export function calcPointsAwarded(rank: number, totalEntries: number): number {
  if (rank === 1)  return 500;
  if (rank <= 3)   return 400;
  if (rank <= 10)  return 300;
  if (rank / totalEntries <= 0.10) return 200;
  if (rank / totalEntries <= 0.25) return 100;
  return PARTICIPATION_POINTS;
}

/**
 * Assigns competition ranks (RANK() semantics, gaps on ties) to a pre-sorted
 * array of entries.  Input MUST be sorted DESC total_fpts, ASC submitted_at.
 *
 * Returns a Map<lineup_id, rank>.
 */
export function assignRanks(
  entries: { id: string; total_fpts: number }[],
): Map<string, number> {
  const ranks = new Map<string, number>();
  for (let i = 0; i < entries.length; i++) {
    // Rank = 1-based index of first entry with this score.
    // Since input is sorted and ties have equal fpts, detect boundary by
    // comparing with the previous entry.
    const isNewScore = i === 0 || entries[i].total_fpts !== entries[i - 1].total_fpts;
    const rank = isNewScore ? i + 1 : ranks.get(entries[i - 1].id)!;
    ranks.set(entries[i].id, rank);
  }
  return ranks;
}

/** Returns the Monday (UTC) of the week containing `date`. */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** Returns the Sunday (UTC) of the week containing `date`. */
export function getWeekEnd(date: Date = new Date()): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return end;
}

/** Formats a Date as YYYY-MM-DD (UTC). */
export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
