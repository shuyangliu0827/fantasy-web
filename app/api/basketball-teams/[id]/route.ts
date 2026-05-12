export const dynamic = "force-dynamic";
// app/api/basketball-teams/[id]/route.ts
//
// GET — visibility-gated. Team detail with roster and upcoming/recent games.

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
    const { data: team, error: loadErr } = await supabase
      .from("basketball_teams")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) throw new AccessError(loadErr.message, 500);
    if (!team) throw new AccessError("team_not_found", 404);

    const access = await requireViewPermission(
      supabase,
      team.basketball_league_id,
      userId,
    );

    const [{ data: roster }, { data: games }] = await Promise.all([
      supabase
        .from("basketball_players")
        .select("id, display_name, position, jersey_number, avatar_url, claim_status")
        .eq("team_id", id)
        .order("display_name"),
      supabase
        .from("basketball_games")
        .select("*")
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .order("scheduled_at", { ascending: false, nullsFirst: false }),
    ]);

    return NextResponse.json({
      team,
      roster: roster ?? [],
      games: games ?? [],
      access,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
