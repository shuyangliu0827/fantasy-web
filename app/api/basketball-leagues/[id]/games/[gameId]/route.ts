export const dynamic = "force-dynamic";
// DELETE /api/basketball-leagues/[id]/games/[gameId]
//
// League admin / platform admin / approved stat keeper deletes a
// scheduled game. Refuses when the game already has box-score rows
// (preserves audit trail) or when a contest for that game's league-local
// date is already locked or scored.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireStatsPermission,
} from "@/lib/basketball/access";
import { todayInTimezone } from "@/lib/basketball/contest-date";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { id, gameId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireStatsPermission(supabase, id, userId);

    // Game must exist and belong to this league.
    const { data: game, error: gameErr } = await supabase
      .from("basketball_games")
      .select("id, basketball_league_id, scheduled_at")
      .eq("id", gameId)
      .maybeSingle();
    if (gameErr) return NextResponse.json({ error: gameErr.message }, { status: 500 });
    if (!game || game.basketball_league_id !== id) {
      return NextResponse.json({ error: "game_not_found" }, { status: 404 });
    }

    // Refuse if any box-score rows reference this game.
    const { count: statCount, error: statErr } = await supabase
      .from("basketball_player_game_stats")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId);
    if (statErr) return NextResponse.json({ error: statErr.message }, { status: 500 });
    if ((statCount ?? 0) > 0) {
      return NextResponse.json({ error: "has_box_score" }, { status: 409 });
    }

    // Refuse if the contest for this game's league-local date is locked/scored.
    if (game.scheduled_at) {
      const { data: league, error: leagueErr } = await supabase
        .from("basketball_leagues")
        .select("timezone")
        .eq("id", id)
        .maybeSingle<{ timezone: string }>();
      if (leagueErr) return NextResponse.json({ error: leagueErr.message }, { status: 500 });
      const tz = league?.timezone || "UTC";
      const localDate = todayInTimezone(tz, new Date(game.scheduled_at));

      const { data: contest, error: contestErr } = await supabase
        .from("basketball_contests")
        .select("id, status")
        .eq("basketball_league_id", id)
        .eq("date", localDate)
        .maybeSingle();
      if (contestErr) return NextResponse.json({ error: contestErr.message }, { status: 500 });
      if (contest && (contest.status === "locked" || contest.status === "scored")) {
        return NextResponse.json({ error: "contest_locked" }, { status: 409 });
      }
    }

    const { error: delErr } = await supabase
      .from("basketball_games")
      .delete()
      .eq("id", gameId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
