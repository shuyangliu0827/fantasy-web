// lib/basketball/contest-salary.ts
//
// Pure salary calibration for basketball-league contests. Given a player's
// season averages (computed from basketball_player_game_stats), return a
// salary in the $4,000–$10,000 range and an informational tier label.
//
// Why bucketed and not continuous: leagues start with very few games. A
// continuous fit on 1–5 game samples is unstable. Buckets give a stable
// "Elite / Solid / Value / Deep" feel that matches the NBA tier model.

export type SalaryTier = 1 | 2 | 3 | 4;

export type PlayerSeason = {
  player_id: string;
  games_played: number;
  avg_fp: number;
};

export type PricedPlayer = {
  player_id: string;
  salary: number;
  tier: SalaryTier;
  projected_points: number;
  season_avg_fp: number;
  games_played: number;
};

/** Heuristic bucket → salary. Deliberately coarse for small samples. */
export function priceOne(season: PlayerSeason): PricedPlayer {
  const avg = Math.max(0, season.avg_fp);

  // Cold-start: no games played → middle Value tier.
  if (season.games_played === 0) {
    return {
      player_id: season.player_id,
      salary: 5000,
      tier: 3,
      projected_points: 0,
      season_avg_fp: 0,
      games_played: 0,
    };
  }

  let salary: number;
  let tier: SalaryTier;
  if (avg >= 30) {
    salary = 10000;
    tier = 1;
  } else if (avg >= 20) {
    salary = 8000;
    tier = 2;
  } else if (avg >= 10) {
    salary = 6000;
    tier = 3;
  } else {
    salary = 4000;
    tier = 4;
  }

  // Slight projection lift towards their average so projected ≈ avg, with
  // a modest regression-to-mean for very small samples.
  const projection =
    season.games_played >= 5 ? avg : avg * 0.85 + 5 * 0.15;

  return {
    player_id: season.player_id,
    salary,
    tier,
    projected_points: Math.round(projection * 10) / 10,
    season_avg_fp: Math.round(avg * 10) / 10,
    games_played: season.games_played,
  };
}

export function priceAll(seasons: PlayerSeason[]): PricedPlayer[] {
  return seasons.map(priceOne);
}

export const TIER_LABEL: Record<SalaryTier, { zh: string; en: string }> = {
  1: { zh: "顶级", en: "Elite" },
  2: { zh: "中坚", en: "Solid" },
  3: { zh: "性价比", en: "Value" },
  4: { zh: "捡漏", en: "Deep Cut" },
};
