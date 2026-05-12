export const dynamic = "force-dynamic";
// app/api/basketball-games/[id]/events/[eventId]/route.ts
//
// DELETE — undo a stat event. Requires stats permission. Deletes the row
// then recomputes the aggregate basketball_player_game_stats for that
// (game_id, player_id).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireStatsPermission,
} from "@/lib/basketball/access";
import { recomputeBoxScore } from "@/lib/basketball/aggregate";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const { id, eventId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);

    const { data: event, error: loadErr } = await supabase
      .from("basketball_stat_events")
      .select("id, basketball_league_id, game_id, player_id")
      .eq("id", eventId)
      .maybeSingle();
    if (loadErr) throw new AccessError(loadErr.message, 500);
    if (!event) throw new AccessError("event_not_found", 404);
    if (event.game_id !== id) {
      throw new AccessError("event_wrong_game", 400);
    }
    await requireStatsPermission(supabase, event.basketball_league_id, userId);

    const { error: delErr } = await supabase
      .from("basketball_stat_events")
      .delete()
      .eq("id", eventId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const { stats, error: aggErr } = await recomputeBoxScore(
      supabase,
      { id: event.game_id, basketball_league_id: event.basketball_league_id },
      event.player_id,
    );
    if (aggErr) return NextResponse.json({ error: aggErr }, { status: 500 });
    return NextResponse.json({ stats, deleted_event_id: eventId });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
