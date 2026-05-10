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
  pts:  number;  // Points scored
  fgm:  number;  // Field goals made
  fga:  number;  // Field goal attempts (negative)
  fg3m: number;  // 3-pointers made
  ftm:  number;  // Free throws made
  fta:  number;  // Free throw attempts (negative)
  reb:  number;  // Rebounds
  ast:  number;  // Assists
  stl:  number;  // Steals
  blk:  number;  // Blocks
  tov:  number;  // Turnovers (typically negative)
};

/** Official ESPN default fantasy points weights */
export const ESPN_DEFAULT_WEIGHTS: PointsWeights = {
  pts:   1,
  fgm:   2,
  fga:  -1,
  fg3m:  1,
  ftm:   1,
  fta:  -1,
  reb:   1,
  ast:   2,
  stl:   4,
  blk:   4,
  tov:  -2,
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
      fgm:  league.points_weights.fgm  ?? ESPN_DEFAULT_WEIGHTS.fgm,
      fga:  league.points_weights.fga  ?? ESPN_DEFAULT_WEIGHTS.fga,
      fg3m: league.points_weights.fg3m ?? ESPN_DEFAULT_WEIGHTS.fg3m,
      ftm:  league.points_weights.ftm  ?? ESPN_DEFAULT_WEIGHTS.ftm,
      fta:  league.points_weights.fta  ?? ESPN_DEFAULT_WEIGHTS.fta,
      reb:  league.points_weights.reb  ?? ESPN_DEFAULT_WEIGHTS.reb,
      ast:  league.points_weights.ast  ?? ESPN_DEFAULT_WEIGHTS.ast,
      stl:  league.points_weights.stl  ?? ESPN_DEFAULT_WEIGHTS.stl,
      blk:  league.points_weights.blk  ?? ESPN_DEFAULT_WEIGHTS.blk,
      tov:  league.points_weights.tov  ?? ESPN_DEFAULT_WEIGHTS.tov,
    };
  }
  return ESPN_DEFAULT_WEIGHTS;
}

/**
 * Calculates fantasy points for a single player's game stats using provided weights.
 */
export function calcFantasyPoints(
  stats: { pts: number; fgm: number; fga: number; fg3m: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; tov: number },
  weights: PointsWeights = ESPN_DEFAULT_WEIGHTS,
): number {
  return (
    stats.pts  * weights.pts  +
    stats.fgm  * weights.fgm  +
    stats.fga  * weights.fga  +
    stats.fg3m * weights.fg3m +
    stats.ftm  * weights.ftm  +
    stats.fta  * weights.fta  +
    stats.reb  * weights.reb  +
    stats.ast  * weights.ast  +
    stats.stl  * weights.stl  +
    stats.blk  * weights.blk  +
    stats.tov  * weights.tov
  );
}
