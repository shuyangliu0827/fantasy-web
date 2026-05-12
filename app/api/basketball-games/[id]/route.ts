export const dynamic = "force-dynamic";
// app/api/basketball-games/[id]/route.ts
//
// GET — visibility-gated. Game detail with teams, full box score (joined
// to player names), and public media. members_only media is filtered out
// for non-members.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireViewPermission,
} from "@/lib/basketball/access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const { data: game, error: loadErr } = await supabase
      .from("basketball_games")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) throw new AccessError(loadErr.message, 500);
    if (!game) throw new AccessError("game_not_found", 404);

    const access = await requireViewPermission(
      supabase,
      game.basketball_league_id,
      userId,
    );

    const teamIds = [game.home_team_id, game.away_team_id].filter(Boolean) as string[];
    const [{ data: teams }, { data: boxScore }, { data: media }] = await Promise.all([
      teamIds.length
        ? supabase
            .from("basketball_teams")
            .select("id, name, abbreviation, city")
            .in("id", teamIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("basketball_player_game_stats")
        .select("*, basketball_players!inner(id, display_name, position, jersey_number)")
        .eq("game_id", id),
      supabase
        .from("basketball_game_media")
        .select("*")
        .eq("game_id", id)
        .order("created_at", { ascending: false }),
    ]);

    const memberOrAdmin =
      access.isPlatformAdmin ||
      access.leagueAdminRole !== null ||
      access.memberStatus === "approved";
    const filteredMedia = (media ?? []).filter(
      (m) => m.visibility === "public" || memberOrAdmin,
    );

    return NextResponse.json({
      game,
      teams: teams ?? [],
      box_score: boxScore ?? [],
      media: filteredMedia,
      access,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
