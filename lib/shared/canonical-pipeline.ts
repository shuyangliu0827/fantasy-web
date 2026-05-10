/**
 * lib/canonical-pipeline.ts
 *
 * Pure canonical-pipeline helpers.
 * No DB imports — safe for both client and server use.
 *
 * RULES enforced here:
 *   Rule A — null-safe fact writes: only valid (non-zero) stats are stored.
 *   Rule D — canonical standings: W/L/T/PF/PA computed from matchups rows, not
 *             from the potentially-stale fantasy_teams.wins/losses counters.
 */

import type { DateStatsMap } from "@/lib/fantasy/shared/scoring-rules";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchupRecord = {
  home_team_id: string;
  away_team_id: string;
  winner_id: string | null;
  home_score: number;
  away_score: number;
};

export type StandingsTotals = {
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

// ─── Rule A: null-safe stats filter ──────────────────────────────────────────

/**
 * Return only the entries in statsMap that contain valid (non-trivial) data.
 * Records where both fpts === 0 and min === 0 are excluded.
 * This ensures null/empty BDL API responses never overwrite stored valid stats.
 */
export function filterValidStats(statsMap: DateStatsMap): DateStatsMap {
  return Object.fromEntries(
    Object.entries(statsMap).filter(([, s]) => s.fpts > 0 || s.min > 0),
  );
}

// ─── Rule D: canonical standings computation ──────────────────────────────────

/**
 * Compute W/L/T/PF/PA for every team purely from completed matchup rows.
 *
 * This is the single source of truth for standings — it replaces reading from
 * fantasy_teams.wins/losses/ties/points_for/points_against, which can drift
 * when scores are retroactively corrected via saveWeeklyMatchupResult.
 *
 * @param teamIds  All fantasy team IDs that should appear in standings.
 * @param matchups All completed matchup rows with scores and winner.
 */
export function computeStandingsFromMatchups(
  teamIds: string[],
  matchups: MatchupRecord[],
): Record<string, StandingsTotals> {
  const records: Record<string, StandingsTotals> = {};
  for (const id of teamIds) {
    records[id] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
  }

  for (const m of matchups) {
    const home = records[m.home_team_id];
    const away = records[m.away_team_id];
    if (!home || !away) continue;

    home.pointsFor    += Number(m.home_score) || 0;
    home.pointsAgainst += Number(m.away_score) || 0;
    away.pointsFor    += Number(m.away_score) || 0;
    away.pointsAgainst += Number(m.home_score) || 0;

    if (m.winner_id === null) {
      home.ties++;
      away.ties++;
    } else if (m.winner_id === m.home_team_id) {
      home.wins++;
      away.losses++;
    } else {
      away.wins++;
      home.losses++;
    }
  }

  return records;
}
