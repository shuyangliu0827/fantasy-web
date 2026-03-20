/**
 * lib/canonical-weekly-result.ts
 *
 * Single canonical weekly-matchup result pipeline.
 *
 * ALL pages (scoreboard, matchup detail, schedule, standings) must derive
 * scores from `computeCanonicalWeeklyResult`.  No page should implement its
 * own aggregation logic.
 *
 * Architecture:
 *   Layer 1 – daily truth  : getDailyStarterScore  (fantasy-scoring.ts)
 *   Layer 2 – weekly truth : computeCanonicalWeeklyResult  (this file)
 *   Layer 3 – views        : scoreboard / matchup / schedule / standings
 */

import {
  buildDailyScoreBreakdown,
  getWeeklyMatchupScore,
  type PlayerStatsResolver,
} from "./fantasy-scoring.ts";
import type { DailyLineupMap, RosterPlayer } from "./store.ts";

// ── Status ────────────────────────────────────────────────────────────────────

/** Explicit matchup lifecycle state.  Never show a number without a status. */
export type MatchupStatus = "pending" | "live" | "final";

// ── Result type ───────────────────────────────────────────────────────────────

export interface CanonicalWeeklyResult {
  /** Total fantasy points for the home team over the full official week. */
  homeScore: number;
  /** Total fantasy points for the away team over the full official week. */
  awayScore: number;
  /** Per-day breakdown for home team (all 7 official dates, 0 for missing days). */
  homeDailyScores: Record<string, number>;
  /** Per-day breakdown for away team (all 7 official dates, 0 for missing days). */
  awayDailyScores: Record<string, number>;
  /** Lifecycle status of the matchup. */
  status: MatchupStatus;
  /**
   * ID of the winning fantasy_team row, or null for a tie / non-final week.
   * Only set when status === "final".
   */
  winnerId: string | null;
}

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Compute the canonical weekly matchup result from raw lineup + game-stat inputs.
 *
 * Design guarantees:
 * - Always iterates the full official `dateStrings` array (7 UTC dates Mon–Sun).
 * - A date with no lineup or no game stats contributes exactly 0 — it is never
 *   skipped from the sum.
 * - Pure / deterministic: same inputs always produce the same output.
 * - No DB reads, no side effects, no async — purely derives from caller-supplied data.
 */
export function computeCanonicalWeeklyResult(params: {
  homeTeamId: string;
  awayTeamId: string;
  homeRoster: RosterPlayer[];
  awayRoster: RosterPlayer[];
  homeDailyLineups: DailyLineupMap;
  awayDailyLineups: DailyLineupMap;
  /** Full official week date strings (exactly 7, Mon–Sun, UTC YYYY-MM-DD). */
  dateStrings: string[];
  resolvePlayerStats: PlayerStatsResolver;
  weekStatus: "pending" | "current" | "past" | "future";
}): CanonicalWeeklyResult {
  const {
    homeTeamId,
    awayTeamId,
    homeRoster,
    awayRoster,
    homeDailyLineups,
    awayDailyLineups,
    dateStrings,
    resolvePlayerStats,
    weekStatus,
  } = params;

  // Aggregate over the full official week date set — missing dates return 0 from
  // getDailyStarterScore, so the sum is always over all 7 canonical dates.
  const homeScore = getWeeklyMatchupScore(
    homeRoster,
    homeDailyLineups,
    dateStrings,
    resolvePlayerStats,
  );
  const awayScore = getWeeklyMatchupScore(
    awayRoster,
    awayDailyLineups,
    dateStrings,
    resolvePlayerStats,
  );

  const homeDailyScores = buildDailyScoreBreakdown(
    homeRoster,
    homeDailyLineups,
    dateStrings,
    resolvePlayerStats,
  );
  const awayDailyScores = buildDailyScoreBreakdown(
    awayRoster,
    awayDailyLineups,
    dateStrings,
    resolvePlayerStats,
  );

  const status: MatchupStatus =
    weekStatus === "past"
      ? "final"
      : weekStatus === "current"
        ? "live"
        : "pending";

  // Winner is only determined for final matchups.
  const winnerId =
    status === "final"
      ? homeScore > awayScore
        ? homeTeamId
        : awayScore > homeScore
          ? awayTeamId
          : null // tie
      : null;

  return {
    homeScore,
    awayScore,
    homeDailyScores,
    awayDailyScores,
    status,
    winnerId,
  };
}
