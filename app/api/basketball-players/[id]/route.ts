export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/route.ts
//
// GET — visibility-gated. Player detail with season totals/averages and
// per-game log. Aggregations computed from basketball_player_game_stats.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireViewPermission,
} from "@/lib/basketball/access";

const STAT_KEYS = [
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "fantasy_points",
] as const;

type StatKey = (typeof STAT_KEYS)[number];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const { data: player, error: loadErr } = await supabase
      .from("basketball_players")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) throw new AccessError(loadErr.message, 500);
    if (!player) throw new AccessError("player_not_found", 404);

    const access = await requireViewPermission(
      supabase,
      player.basketball_league_id,
      userId,
    );

    const [{ data: team }, { data: statRows }] = await Promise.all([
      player.team_id
        ? supabase
            .from("basketball_teams")
            .select("id, name, abbreviation")
            .eq("id", player.team_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("basketball_player_game_stats")
        .select("*")
        .eq("player_id", id),
    ]);

    const games = statRows ?? [];
    const totals: Record<StatKey, number> = {
      pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
      fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, fantasy_points: 0,
    };
    for (const g of games) {
      for (const k of STAT_KEYS) {
        totals[k] += Number((g as Record<string, unknown>)[k] ?? 0);
      }
    }
    const gp = games.length;
    const averages = Object.fromEntries(
      STAT_KEYS.map((k) => [k, gp ? +(totals[k] / gp).toFixed(2) : 0]),
    ) as Record<StatKey, number>;

    return NextResponse.json({
      player,
      team: team ?? null,
      season: { games_played: gp, totals, averages },
      game_log: games,
      access,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
