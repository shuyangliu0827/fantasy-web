// lib/scoring-config.ts
// Centralized scoring configuration for Fantasy Basketball.
//
// This is the single source of truth for ESPN default fantasy points weights.
// All scoring calculations (API routes, scoring engine, settings UI) import from here.
//
// Architecture notes:
// - Only 'h2h_points' scoring is active. H2H Categories and Rotisserie are reserved.
// - If points_system is 'espn_default', use ESPN_DEFAULT_WEIGHTS.
// - If points_system is 'custom', use league.points_weights from the DB.
// - If scoring_type is not 'h2h_points', points weights do not apply.

export type PointsWeights = {
  pts: number;   // Points scored
  reb: number;   // Rebounds
  ast: number;   // Assists
  stl: number;   // Steals
  blk: number;   // Blocks
  fg3m: number;  // 3-pointers made
  tov: number;   // Turnovers (typically negative)
};

/** Official ESPN default fantasy points weights */
export const ESPN_DEFAULT_WEIGHTS: PointsWeights = {
  pts:  1,
  reb:  1,
  ast:  1,
  stl:  2,
  blk:  2,
  fg3m: 1,
  tov:  -1,
};

export type ScoringType = "h2h_points" | "h2h_categories" | "rotisserie";
export type PointsSystem = "espn_default" | "custom";

/** League shape required by getLeaguePointsWeights */
type LeagueForScoring = {
  scoring_type?: string | null;
  points_system?: string | null;
  points_weights?: Partial<PointsWeights> | null;
};

/**
 * Resolves the effective points weights for a league.
 * Returns ESPN_DEFAULT_WEIGHTS for non-h2h_points leagues so callers always
 * receive a valid weight object (simplifies math code paths).
 */
export function getLeaguePointsWeights(league: LeagueForScoring): PointsWeights {
  if (league.scoring_type !== "h2h_points") {
    return ESPN_DEFAULT_WEIGHTS;
  }
  if (league.points_system === "custom" && league.points_weights) {
    return {
      pts:  league.points_weights.pts  ?? ESPN_DEFAULT_WEIGHTS.pts,
      reb:  league.points_weights.reb  ?? ESPN_DEFAULT_WEIGHTS.reb,
      ast:  league.points_weights.ast  ?? ESPN_DEFAULT_WEIGHTS.ast,
      stl:  league.points_weights.stl  ?? ESPN_DEFAULT_WEIGHTS.stl,
      blk:  league.points_weights.blk  ?? ESPN_DEFAULT_WEIGHTS.blk,
      fg3m: league.points_weights.fg3m ?? ESPN_DEFAULT_WEIGHTS.fg3m,
      tov:  league.points_weights.tov  ?? ESPN_DEFAULT_WEIGHTS.tov,
    };
  }
  return ESPN_DEFAULT_WEIGHTS;
}

/**
 * Calculates fantasy points for a single player's game stats using provided weights.
 */
export function calcFantasyPoints(
  stats: { pts: number; reb: number; ast: number; stl: number; blk: number; fg3m: number; tov: number },
  weights: PointsWeights = ESPN_DEFAULT_WEIGHTS,
): number {
  return (
    stats.pts  * weights.pts  +
    stats.reb  * weights.reb  +
    stats.ast  * weights.ast  +
    stats.stl  * weights.stl  +
    stats.blk  * weights.blk  +
    stats.fg3m * weights.fg3m +
    stats.tov  * weights.tov
  );
}
