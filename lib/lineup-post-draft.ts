export type LineupPostDraftPlayer = {
  id?: string;
  name: string;
  slot?: string;
  projectedPoints?: number;
};

export type BuildLineupPostDraftInput = {
  userId?: string;
  leagueId?: string;
  lineupDate?: string;
  lineupWeek?: number;
  generatedAt?: string;
  starters: LineupPostDraftPlayer[];
  bench?: LineupPostDraftPlayer[];
};

export type LineupPostDraft = {
  title: string;
  body: string;
  metadata: {
    user_id?: string;
    league_id?: string;
    lineup_date?: string;
    lineup_week?: number;
    generated_at: string;
    starters: Array<{ id?: string; name: string; slot?: string; projected_points?: number }>;
    bench: Array<{ id?: string; name: string; slot?: string; projected_points?: number }>;
    projected_points?: number;
  };
};

function formatPlayer(player: LineupPostDraftPlayer): string {
  return player.slot ? `${player.slot}: ${player.name}` : player.name;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildLineupPostDraft(input: BuildLineupPostDraftInput): LineupPostDraft {
  const starters = input.starters ?? [];
  const bench = input.bench ?? [];

  const starterProjected = starters
    .map((p) => p.projectedPoints)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const totalProjected = starterProjected.length > 0
    ? roundToTenth(starterProjected.reduce((sum, points) => sum + points, 0))
    : undefined;

  const topStarter = starters
    .filter((p) => typeof p.projectedPoints === "number" && Number.isFinite(p.projectedPoints))
    .sort((a, b) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0))[0]
    ?? starters[0]
    ?? null;

  const title = input.lineupWeek
    ? "My lineup for this week"
    : "My lineup for tonight";

  const lines: string[] = [];
  lines.push(`Starters: ${starters.length > 0 ? starters.map(formatPlayer).join(", ") : "TBD"}`);
  if (bench.length > 0) {
    lines.push(`Bench: ${bench.map(formatPlayer).join(", ")}`);
  }
  if (typeof totalProjected === "number") {
    lines.push(`Projected points: ${totalProjected.toFixed(1)}`);
  }

  if (topStarter) {
    lines.push(`Biggest bet tonight: ${topStarter.name}`);
  } else {
    lines.push("Trusting this group to carry the matchup");
  }

  return {
    title,
    body: lines.join("\n"),
    metadata: {
      user_id: input.userId,
      league_id: input.leagueId,
      lineup_date: input.lineupDate,
      lineup_week: input.lineupWeek,
      generated_at: input.generatedAt ?? new Date().toISOString(),
      starters: starters.map((player) => ({
        id: player.id,
        name: player.name,
        slot: player.slot,
        projected_points: player.projectedPoints,
      })),
      bench: bench.map((player) => ({
        id: player.id,
        name: player.name,
        slot: player.slot,
        projected_points: player.projectedPoints,
      })),
      projected_points: totalProjected,
    },
  };
}
