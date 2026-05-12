export const dynamic = "force-dynamic";
// GET /api/basketball-contests/[id]/players
// Returns the frozen player pool (joined to player metadata + team).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();

  const { data: contest, error: cErr } = await supabase
    .from("basketball_contests")
    .select("id, basketball_league_id, status")
    .eq("id", id)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  const { data: pool, error: poolErr } = await supabase
    .from("basketball_contest_players")
    .select(
      "id, contest_id, player_id, team_id, salary, tier, projected_points, season_avg_fp, games_played",
    )
    .eq("contest_id", id);
  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });

  const playerIds = (pool ?? []).map((p) => p.player_id);
  const teamIds = (pool ?? [])
    .map((p) => p.team_id)
    .filter((x): x is string => !!x);

  type PlayerMeta = {
    id: string;
    display_name: string;
    position: string | null;
    jersey_number: string | null;
    avatar_url: string | null;
  };
  type TeamMeta = { id: string; name: string; abbreviation: string | null };

  const [playersRes, teamsRes] = await Promise.all([
    playerIds.length > 0
      ? supabase
          .from("basketball_players")
          .select("id, display_name, position, jersey_number, avatar_url")
          .in("id", playerIds)
      : Promise.resolve({ data: [] as PlayerMeta[] }),
    teamIds.length > 0
      ? supabase
          .from("basketball_teams")
          .select("id, name, abbreviation")
          .in("id", teamIds)
      : Promise.resolve({ data: [] as TeamMeta[] }),
  ]);

  const pById = new Map<string, PlayerMeta>(
    ((playersRes.data ?? []) as PlayerMeta[]).map((p) => [p.id, p]),
  );
  const tById = new Map<string, TeamMeta>(
    ((teamsRes.data ?? []) as TeamMeta[]).map((t) => [t.id, t]),
  );

  const rows = (pool ?? []).map((p) => {
    const player = pById.get(p.player_id);
    const team = p.team_id ? tById.get(p.team_id) : null;
    return {
      contest_player_id: p.id,
      player_id: p.player_id,
      name: player?.display_name ?? "—",
      position: player?.position ?? null,
      jersey_number: player?.jersey_number ?? null,
      avatar_url: player?.avatar_url ?? null,
      team_id: p.team_id,
      team_name: team?.name ?? null,
      team_abbr: team?.abbreviation ?? null,
      salary: p.salary,
      tier: p.tier,
      projected_points: Number(p.projected_points ?? 0),
      season_avg_fp: Number(p.season_avg_fp ?? 0),
      games_played: p.games_played,
    };
  });
  rows.sort((a, b) => b.salary - a.salary || (b.season_avg_fp - a.season_avg_fp));

  return NextResponse.json({
    contest_id: contest.id,
    status: contest.status,
    players: rows,
  });
}
