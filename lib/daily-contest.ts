import { calcFantasyPoints } from "@/lib/scoring-config";
import { getCanonicalPlayerPosition, normalizePosition } from "@/lib/player-metadata";
import { normalizeTeamCode } from "@/lib/i18n";

export const DAILY_CONTEST_TIER_COUNTS = { T1: 1, T2: 1, T3: 1, T4: 2 } as const;
export const DAILY_CONTEST_TOTAL_SLOTS = 5;

export type ContestTier = keyof typeof DAILY_CONTEST_TIER_COUNTS;

export type ContestPlayer = {
  id: number;
  name: string;
  team: string;
  position: string;
  injury: string | null;
  fptsAvg: number;
  tier: ContestTier;
};

type CacheRow = {
  player_id: number;
  name: string;
  team: string;
  position: string;
  injury?: string | null;
  pts_avg: number;
  fgm_avg: number;
  fga_avg: number;
  fg3m_avg: number;
  ftm_avg: number;
  fta_avg: number;
  reb_avg: number;
  ast_avg: number;
  stl_avg: number;
  blk_avg: number;
  tov_avg: number;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

export function isOutStatus(injury: string | null | undefined): boolean {
  if (!injury) return false;
  return injury.trim().toLowerCase() === "out";
}

function assignTierByRank(index: number, total: number): ContestTier {
  if (total <= 0) return "T4";
  const ratio = (index + 1) / total;
  if (ratio <= 0.25) return "T1";
  if (ratio <= 0.5) return "T2";
  if (ratio <= 0.75) return "T3";
  return "T4";
}

export function buildContestPoolFromRows(rows: CacheRow[]): ContestPlayer[] {
  const canonicalPool = rows
    .map((row) => {
      const position = getCanonicalPlayerPosition(row.name, row.position);
      return {
        id: row.player_id,
        name: row.name,
        team: normalizeTeamCode(row.team),
        position: normalizePosition(position),
        injury: row.injury ?? null,
        fptsAvg: round1(calcFantasyPoints({
          pts: row.pts_avg || 0,
          fgm: row.fgm_avg || 0,
          fga: row.fga_avg || 0,
          fg3m: row.fg3m_avg || 0,
          ftm: row.ftm_avg || 0,
          fta: row.fta_avg || 0,
          reb: row.reb_avg || 0,
          ast: row.ast_avg || 0,
          stl: row.stl_avg || 0,
          blk: row.blk_avg || 0,
          tov: row.tov_avg || 0,
        })),
      };
    })
    .filter((p) => !isOutStatus(p.injury) && p.position !== "N/A");

  canonicalPool.sort((a, b) => b.fptsAvg - a.fptsAvg || a.name.localeCompare(b.name));

  return canonicalPool.map((p, index, all) => ({
    ...p,
    tier: assignTierByRank(index, all.length),
  }));
}

export function validateTierSelections(playerIds: number[], pool: ContestPlayer[]): { ok: true } | { ok: false; error: string } {
  if (playerIds.length !== DAILY_CONTEST_TOTAL_SLOTS) {
    return { ok: false, error: `Lineup must contain exactly ${DAILY_CONTEST_TOTAL_SLOTS} players.` };
  }

  const unique = new Set(playerIds);
  if (unique.size !== playerIds.length) {
    return { ok: false, error: "Lineup cannot include duplicate players." };
  }

  const poolById = new Map(pool.map((p) => [p.id, p]));
  const selected = playerIds.map((id) => poolById.get(id)).filter(Boolean) as ContestPlayer[];

  if (selected.length !== playerIds.length) {
    return { ok: false, error: "Lineup includes players not in today's contest pool." };
  }

  const counts: Record<ContestTier, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  for (const player of selected) counts[player.tier]++;

  for (const [tier, requiredCount] of Object.entries(DAILY_CONTEST_TIER_COUNTS) as Array<[ContestTier, number]>) {
    if (counts[tier] !== requiredCount) {
      return { ok: false, error: `${tier} requires exactly ${requiredCount} player(s).` };
    }
  }

  return { ok: true };
}

export function scoreLineupProjection(playerIds: number[], pool: ContestPlayer[]): number {
  const byId = new Map(pool.map((p) => [p.id, p.fptsAvg]));
  return round1(playerIds.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0));
}
