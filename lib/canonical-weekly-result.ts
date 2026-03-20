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
  getWeeklyMatchupScore,
  type PlayerStatsResolver,
} from "./fantasy-scoring.ts";
import type { DailyLineupMap, RosterPlayer } from "./store.ts";
import { getHistoricalRosterForDate } from "./roster-history.ts";

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

export interface CanonicalResolvedMatchup {
  matchupKey: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeDailyScores: Record<string, number>;
  awayDailyScores: Record<string, number>;
  status: MatchupStatus;
  winnerId: string | null;
}

export interface CanonicalStandingInput {
  teamId: string;
  name?: string;
}

export interface CanonicalStandingRow {
  teamId: string;
  name?: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pct: number;
  streak: string;
  gb: number;
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
  const homeDailyScores = buildCanonicalDailyScoreBreakdown(
    homeRoster,
    homeDailyLineups,
    dateStrings,
    resolvePlayerStats,
  );
  const awayDailyScores = buildCanonicalDailyScoreBreakdown(
    awayRoster,
    awayDailyLineups,
    dateStrings,
    resolvePlayerStats,
  );
  const homeScore = sumDailyScores(homeDailyScores, dateStrings);
  const awayScore = sumDailyScores(awayDailyScores, dateStrings);

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

export function buildCanonicalDailyScoreBreakdown(
  roster: RosterPlayer[],
  dailyLineups: DailyLineupMap,
  dateStrings: string[],
  resolvePlayerStats: PlayerStatsResolver,
): Record<string, number> {
  return Object.fromEntries(
    dateStrings.map((dateStr) => {
      const historicalRoster = getHistoricalRosterForDate(roster, dateStr);
      return [
        dateStr,
        getWeeklyMatchupScore(
          historicalRoster,
          dailyLineups,
          [dateStr],
          resolvePlayerStats,
        ),
      ];
    }),
  );
}

function sumDailyScores(dailyScores: Record<string, number>, dateStrings: string[]): number {
  return dateStrings.reduce((total, dateStr) => total + (dailyScores[dateStr] ?? 0), 0);
}

export function buildCanonicalStandings(
  teams: CanonicalStandingInput[],
  matchups: CanonicalResolvedMatchup[],
): CanonicalStandingRow[] {
  const rows = new Map<string, CanonicalStandingRow>();

  for (const team of teams) {
    rows.set(team.teamId, {
      teamId: team.teamId,
      name: team.name,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pct: 0,
      streak: "-",
      gb: 0,
    });
  }

  const finalized = [...matchups]
    .filter((matchup) => matchup.status === "final")
    .sort((a, b) => b.week - a.week);

  for (const matchup of finalized) {
    const home = rows.get(matchup.homeTeamId);
    const away = rows.get(matchup.awayTeamId);
    if (!home || !away) continue;

    home.pointsFor += matchup.homeScore;
    home.pointsAgainst += matchup.awayScore;
    away.pointsFor += matchup.awayScore;
    away.pointsAgainst += matchup.homeScore;

    if (matchup.homeScore > matchup.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (matchup.awayScore > matchup.homeScore) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }

  const sorted = [...rows.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointsFor - a.pointsFor;
  });

  const leader = sorted[0];
  for (const row of sorted) {
    const total = row.wins + row.losses + row.ties;
    row.pct = total === 0 ? 0 : (row.wins + 0.5 * row.ties) / total;
    row.streak = computeStreak(row.teamId, finalized);
    row.gb = !leader
      ? 0
      : ((leader.wins - row.wins) + (row.losses - leader.losses)) / 2;
  }

  return sorted;
}

function computeStreak(teamId: string, matchups: CanonicalResolvedMatchup[]): string {
  let count = 0;
  let streakType = "";
  for (const matchup of matchups) {
    if (matchup.homeTeamId !== teamId && matchup.awayTeamId !== teamId) continue;
    const result =
      matchup.winnerId === null ? "T" : matchup.winnerId === teamId ? "W" : "L";
    if (!streakType) {
      streakType = result;
      count = 1;
      continue;
    }
    if (result !== streakType) break;
    count += 1;
  }
  return streakType ? `${streakType}${count}` : "-";
}
